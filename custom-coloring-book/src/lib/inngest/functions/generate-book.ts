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
import { getPriceTierFromOrder } from "@/lib/ai/config";
import { generateCharacterManifest } from "@/lib/ai/generate-manifest";
import {
  generateSceneDescriptions,
  generateSeed,
  composePagePrompt,
} from "@/lib/ai/generate-pages";
import {
  generateGlobalThemeContext,
  generatePageContextsBatch,
} from "@/lib/ai/generate-context";
import { runReplicatePrediction, runReplicatePredictionImg2Img } from "@/lib/ai/client";
import { assemblePdf } from "@/lib/utils/pdf";
import type { CharacterManifest } from "@/types/manifest";

/**
 * Durable two-step Inngest function triggered by "order/created".
 *
 * Both steps are fully idempotent:
 *
 * Step 1 -- Generate Manifest:
 *   Checks if a manifest already exists (from a previous partial run).
 *   If not, generates one via LLM. Then checks if pages exist; if not,
 *   generates scene descriptions and inserts 20 page rows.
 *
 * Step 2 -- Generate Images:
 *   Queries only pages with status "pending", so already-completed
 *   pages from a prior partial run are skipped. Processes in batches of 5.
 */
export const generateBook = inngest.createFunction(
  {
    id: "generate-book",
    retries: 10,
  },
  { event: "order/created" },
  async ({ event, step }) => {
    const { orderId } = event.data;

    // ----- Step 1: Generate Character Manifest (idempotent) -----
    await step.run("generate-manifest", async () => {
      const order = await getOrder(orderId);

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
      const userInputForManifest =
        description?.trim() ?? "";
      const themeHint =
        themeFromForm?.trim();

      const priceTier = getPriceTierFromOrder(order);

      let manifestRow = await getManifestByOrderId(orderId);

      if (!manifestRow) {
        const manifest = await generateCharacterManifest(
          userInputForManifest,
          priceTier,
          themeHint,
        );
        manifestRow = await insertManifest(
          orderId,
          manifest,
          manifest as unknown as Record<string, unknown>,
        );
      }

      // Build manifest with backward compatibility for existing rows
      const manifest: CharacterManifest = {
        characterName: manifestRow.character_name,
        characterType:
          (manifestRow.character_type as CharacterManifest["characterType"]) ||
          "human", // Default to human for backward compatibility
        species: manifestRow.species ?? null,
        physicalDescription: manifestRow.physical_description ?? null,
        characterKeyFeatures: manifestRow.character_key_features ?? [],
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

      const scenes = await generateSceneDescriptions(manifest, priceTier);

      const globalContext = await generateGlobalThemeContext(manifest, priceTier);
      const pageContexts = await generatePageContextsBatch(
        manifest,
        scenes,
        globalContext,
        priceTier,
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
          fullPrompt: composePagePrompt(manifest, scene, seed, pageContext),
        };
      });

      await insertPages(orderId, manifestRow.id, pageInserts);
      await updateOrderStatus(orderId, "manifest_generated");
    });

    // ----- Step 2: Generate each page image as its own step -----
    // Each page is a separate Inngest step, so completed pages are
    // checkpointed and won't be re-run on retry. This also gives
    // each page its own retry budget via Inngest.
    await step.run("set-generating", async () => {
      await updateOrderStatus(orderId, "generating");
    });

    const pages = await step.run("get-pending-pages", async () => {
      return await getPendingPages(orderId);
    });

    const orderForPreview = await step.run("get-order-for-preview", async () => {
      const o = await getOrder(orderId);
      return {
        previewImageUrl: o.preview_image_url ?? null,
        previewSeed: o.preview_seed ?? null,
      };
    });

    const useImg2Img =
      orderForPreview.previewImageUrl != null &&
      orderForPreview.previewSeed != null;

    for (const page of pages) {
      await step.run(`generate-page-${page.page_number}`, async () => {
        const result = useImg2Img
          ? await runReplicatePredictionImg2Img(
              page.full_prompt,
              (orderForPreview.previewSeed as number) + page.page_number,
              orderForPreview.previewImageUrl as string,
              0.88,
              6,
            )
          : await runReplicatePrediction(page.full_prompt, page.seed, 6);
        await updatePageImage(page.id, result.imageUrl, result.predictionId);
      });

      // Sleep between pages to avoid rate limits
      if (page !== pages[pages.length - 1]) {
        await step.sleep(`wait-after-page-${page.page_number}`, "15s");
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
  },
);
