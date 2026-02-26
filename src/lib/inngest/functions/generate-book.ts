import { inngest } from "../client";
import {
  getOrder,
  updateOrderStatus,
  updateOrderPdfUrl,
} from "@/lib/supabase/queries";
import {
  insertManifest,
  insertPages,
  getManifestByOrderId,
} from "@/lib/supabase/queries";
import {
  getPendingPages,
  getPagesByOrderId,
  updatePageImage,
} from "@/lib/supabase/queries";
import { generateCharacterManifest } from "@/lib/ai/generate-manifest";
import {
  generateSceneDescriptions,
  generateSeed,
  composeKontextPagePrompt,
  refinePromptFromFeedback,
} from "@/lib/ai/generate-pages";
import {
  generateGlobalThemeContext,
  generatePageContextsBatch,
} from "@/lib/ai/generate-context";
import { runReplicateKontextPro } from "@/lib/ai/client";
import { checkPageQuality, type QualityResult } from "@/lib/ai/quality-gate";
import { assemblePdf } from "@/lib/utils/pdf";
import type { CharacterManifest } from "@/types/manifest";

const MAX_QUALITY_RETRIES = 2;

/**
 * Durable two-step Inngest function triggered by "order/created".
 *
 * Both steps are fully idempotent:
 *
 * Step 1 -- Generate Manifest:
 *   Checks if a manifest already exists (from a previous partial run).
 *   If not, generates one via LLM. Then checks if pages exist; if not,
 *   generates scene descriptions and inserts page rows.
 *
 * Step 2 -- Generate Images:
 *   Queries only pages with status "pending", so already-completed
 *   pages from a prior partial run are skipped.
 *   Each page runs through a Critic-Refiner-Evaluator loop:
 *   - Kontext generates the image
 *   - Quality gate (GPT-4o, Analyze-then-Judge) evaluates it
 *   - On failure, feedback is used to refine the prompt before retry
 *   No Canny pass — Kontext output is the final customer-facing image.
 */
export const generateBook = inngest.createFunction(
  {
    id: "generate-book",
    retries: 3,
  },
  { event: "order/created" },
  async ({ event, step }) => {
    const { orderId } = event.data;

    try {
    // ----- Step 1: Generate Character Manifest (idempotent) -----
    await step.run("generate-manifest", async () => {
      const order = await getOrder(orderId);

      if (!order.preview_image_url) {
        throw new Error(
          "Preview image (seed URL) is required for book generation. The customer must select a character preview before checkout.",
        );
      }

      if (
        order.status === "manifest_generated" ||
        order.status === "generating" ||
        order.status === "complete"
      ) {
        return;
      }

      const raw = order.user_input;
      const description =
        typeof raw === "string"
          ? raw
          : (raw as Record<string, unknown>).user_input as string | undefined;
      const themeFromForm =
        typeof raw === "object" && raw !== null
          ? (raw as Record<string, unknown>).theme as string | undefined
          : undefined;
      const userInputForManifest = description?.trim() ?? "";
      const themeHint = themeFromForm?.trim();

      let manifestRow = await getManifestByOrderId(orderId);

      if (!manifestRow) {
        const manifest = await generateCharacterManifest(
          userInputForManifest,
          themeHint,
        );
        manifestRow = await insertManifest(
          orderId,
          manifest,
          manifest as unknown as Record<string, unknown>,
        );
      }

      const manifest: CharacterManifest = {
        characterName: manifestRow.character_name,
        characterType:
          (manifestRow.character_type as CharacterManifest["characterType"]) ||
          "human",
        species: manifestRow.species ?? null,
        physicalDescription: manifestRow.physical_description ?? null,
        characterKeyFeatures: manifestRow.character_key_features ?? [],
        characterProps: manifestRow.character_props ?? [],
        ageRange: manifestRow.age_range ?? null,
        hair: manifestRow.hair
          ? (manifestRow.hair as CharacterManifest["hair"])
          : null,
        skinTone: manifestRow.skin_tone ?? null,
        outfit: manifestRow.outfit
          ? (manifestRow.outfit as CharacterManifest["outfit"])
          : null,
        theme: manifestRow.theme,
        styleTags: manifestRow.style_tags,
        negativeTags: manifestRow.negative_tags,
      };

      const scenes = await generateSceneDescriptions(manifest);

      const globalContext = await generateGlobalThemeContext(manifest);
      const pageContexts = await generatePageContextsBatch(
        manifest,
        scenes,
        globalContext,
      );

      const pageInserts = scenes.map((scene, idx) => {
        const pageNumber = idx + 1;
        const seed = generateSeed(orderId, pageNumber);
        const pageContext = pageContexts[idx];
        if (!pageContext) {
          throw new Error(
            `Missing page context for scene ${pageNumber}; batch size mismatch.`,
          );
        }
        return {
          pageNumber,
          seed,
          sceneDescription: scene,
          fullPrompt: composeKontextPagePrompt(
            manifest,
            scene,
            pageContext,
          ),
        };
      });

      await insertPages(orderId, manifestRow.id, pageInserts);
      await updateOrderStatus(orderId, "manifest_generated");
    });

    // ----- Step 2: Generate each page image -----
    await step.run("set-generating", async () => {
      await updateOrderStatus(orderId, "generating");
    });

    const pages = await step.run("get-pending-pages", async () => {
      return await getPendingPages(orderId);
    });

    const orderContext = await step.run("get-order-context", async () => {
      const o = await getOrder(orderId);
      const manifestRow = await getManifestByOrderId(orderId);
      if (!manifestRow) throw new Error("Manifest not found for order");

      return {
        // Store just the URL here — the actual image bytes are fetched inside
        // each generate-page step to avoid serializing large base64 data through
        // Inngest's step output store (which has size constraints).
        previewImageUrl: o.preview_image_url ?? null,
      };
    });

    if (!orderContext.previewImageUrl) {
      throw new Error(
        "Preview image (seed URL) is required for book generation. The customer must select a character preview before checkout.",
      );
    }

    const { previewImageUrl } = orderContext;

    /**
     * Fetch the reference image and return it as a base64 data URI.
     * This runs inside each page step so the large binary data is never
     * stored in Inngest's step-output serialization.
     *
     * Using a data URI instead of passing the raw URL means:
     *   1. Replicate CDN URLs (replicate.delivery) that expire after ~24h work fine.
     *   2. Local-dev Supabase Storage URLs (127.0.0.1) are reachable from the
     *      Inngest worker (same machine) even though Replicate's servers can't
     *      reach them — the binary is embedded directly in the API request.
     */
    async function fetchReferenceAsDataUri(url: string): Promise<string> {
      const imgResponse = await fetch(url);
      if (!imgResponse.ok) {
        throw new Error(
          `Reference image not accessible (${imgResponse.status}): ${url}. ` +
          `Re-run the fix-expired-preview script to regenerate it.`,
        );
      }
      const imgBuffer = await imgResponse.arrayBuffer();
      const base64 = Buffer.from(imgBuffer).toString("base64");
      const contentType = imgResponse.headers.get("content-type") ?? "image/png";
      return `data:${contentType};base64,${base64}`;
    }

    for (const page of pages) {
      await step.run(`generate-page-${page.page_number}`, async () => {
        // --- Critic-Refiner-Evaluator loop ---
        // Pass 1: generate with Kontext (character consistency via reference image)
        // Quality gate evaluates with Analyze-then-Judge rubric (GPT-4o)
        // On failure: critic feedback refines the prompt; retry with new seed
        // Kontext output is the final image — no Canny pass

        // Fetch reference image as a base64 data URI inside the step so the
        // large binary doesn't flow through Inngest's step-output serialization.
        const referenceDataUri = await fetchReferenceAsDataUri(previewImageUrl);

        let currentPrompt = page.full_prompt;
        let currentSeed = page.seed;
        let finalImageUrl: string | null = null;
        let finalPredictionId = "";
        let lastQuality: QualityResult | null = null;

        for (let attempt = 0; attempt <= MAX_QUALITY_RETRIES; attempt++) {
          const result = await runReplicateKontextPro(
            currentPrompt,
            currentSeed,
            referenceDataUri,
            6,
          );
          finalImageUrl = result.imageUrl;
          finalPredictionId = result.predictionId;

          const quality = await checkPageQuality(result.imageUrl);
          lastQuality = quality;

          if (quality.pass) {
            console.log(
              `Page ${page.page_number} passed quality gate (attempt ${attempt + 1})`,
            );
            break;
          }

          console.warn(
            `Page ${page.page_number} failed quality gate (attempt ${attempt + 1}/${MAX_QUALITY_RETRIES + 1}): ${quality.feedback}`,
          );

          if (attempt < MAX_QUALITY_RETRIES) {
            // Advance seed and refine the prompt using critic feedback
            currentSeed = (currentSeed + 7919) & 0x7fffffff;
            currentPrompt = await refinePromptFromFeedback(
              currentPrompt,
              quality.feedback,
            );
            console.log(
              `Page ${page.page_number}: prompt refined for retry ${attempt + 2}`,
            );
          }
          // After final retry, proceed with best-effort image (checked below)
        }

        // Safety check: never allow a clearly colored image into a coloring book PDF.
        // lineArtScore <= 2 means visible color fills — this is a hard failure.
        if (lastQuality && lastQuality.lineArtScore <= 2) {
          throw new Error(
            `Page ${page.page_number} produced colored output after all retries ` +
            `(lineArtScore=${lastQuality.lineArtScore}/5). ` +
            `Refusing to include a colored image in the coloring book. ` +
            `Feedback: ${lastQuality.feedback}`,
          );
        }

        console.log(
          `Page ${page.page_number} complete: predictionId=${finalPredictionId}`,
        );
        await updatePageImage(
          page.id,
          finalImageUrl!,
          finalPredictionId,
        );
      });

      if (page !== pages[pages.length - 1]) {
        await step.sleep(`wait-after-page-${page.page_number}`, "5s");
      }
    }

    // ----- Step 3: Assemble PDF from completed page images -----
    await step.run("assemble-pdf", async () => {
      const allPages = await getPagesByOrderId(orderId);
      const imageUrls = allPages
        .filter((p) => p.status === "complete" && p.image_url)
        .map((p) => p.image_url as string);

      if (imageUrls.length === 0) {
        throw new Error("No completed page images to assemble into PDF");
      }

      const pdfUrl = await assemblePdf(orderId, imageUrls);
      await updateOrderPdfUrl(orderId, pdfUrl);
    });

    await step.run("mark-complete", async () => {
      await updateOrderStatus(orderId, "complete");
    });

    return { orderId, status: "complete" };
    } catch (err) {
      // Mark the order failed so the polling UI transitions out of the loading state.
      // Using step.run ensures the DB write is itself retried if it transiently fails.
      await step.run("mark-order-failed", async () => {
        await updateOrderStatus(orderId, "failed");
        console.error(`Order ${orderId} failed permanently:`, err);
      });

      // Re-throw so Inngest records the function run as failed.
      throw err;
    }
  },
);
