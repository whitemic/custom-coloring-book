import { inngest } from "../client";
import { getOrder, getPagesByOrderId, updatePageImage, incrementUserCredits } from "@/lib/supabase/queries";
import { runReplicateKontextPro } from "@/lib/ai/client";
import { checkPageQuality, type QualityResult } from "@/lib/ai/quality-gate";
import { refinePromptFromFeedback } from "@/lib/ai/generate-pages";

const MAX_QUALITY_RETRIES = 2;

/**
 * Regenerate a single coloring book page using the same Critic-Refiner-Evaluator
 * loop as the main generate-book pipeline.
 *
 * Triggered by "page/regenerate" after the buyer spends 1 credit.
 * On hard failure (lineArtScore ≤ 2 after all retries) the credit is refunded.
 */
export const regeneratePage = inngest.createFunction(
  {
    id: "regenerate-page",
    retries: 2,
  },
  { event: "page/regenerate" },
  async ({ event, step }) => {
    const { pageId, orderId, email } = event.data;

    // Fetch the page and order context inside a step for idempotency.
    const { page, previewImageUrl, prompt, seed } = await step.run(
      "load-page-context",
      async () => {
        const order = await getOrder(orderId);
        if (!order.preview_image_url) {
          throw new Error(`Order ${orderId} has no preview image — cannot regenerate.`);
        }

        const pages = await getPagesByOrderId(orderId);
        const page = pages.find((p) => p.id === pageId);
        if (!page) {
          throw new Error(`Page ${pageId} not found on order ${orderId}.`);
        }

        return {
          page,
          previewImageUrl: order.preview_image_url,
          prompt: page.full_prompt,
          seed: Math.floor(Math.random() * 0x7fffffff),
        };
      },
    );

    // Run the Critic-Refiner-Evaluator loop, same as generate-book.
    await step.run("generate-page-image", async () => {
      // Fetch reference image as a base64 data URI so Replicate CDN expiry
      // and local-dev 127.0.0.1 URLs don't cause failures.
      const imgResponse = await fetch(previewImageUrl);
      if (!imgResponse.ok) {
        throw new Error(
          `Reference image not accessible (${imgResponse.status}): ${previewImageUrl}`,
        );
      }
      const imgBuffer = await imgResponse.arrayBuffer();
      const base64 = Buffer.from(imgBuffer).toString("base64");
      const contentType = imgResponse.headers.get("content-type") ?? "image/png";
      const referenceDataUri = `data:${contentType};base64,${base64}`;

      let currentPrompt = prompt;
      let currentSeed = seed;
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
            `Regen page ${pageId} passed quality gate (attempt ${attempt + 1})`,
          );
          break;
        }

        console.warn(
          `Regen page ${pageId} failed quality gate (attempt ${attempt + 1}/${MAX_QUALITY_RETRIES + 1}): ${quality.feedback}`,
        );

        if (attempt < MAX_QUALITY_RETRIES) {
          currentSeed = (currentSeed + 7919) & 0x7fffffff;
          currentPrompt = await refinePromptFromFeedback(
            currentPrompt,
            quality.feedback,
          );
        }
      }

      // Hard safety check — refund the credit and fail the step so the user
      // knows the regeneration didn't produce a usable image.
      if (lastQuality && lastQuality.lineArtScore <= 2) {
        await incrementUserCredits(
          email,
          1,
          "purchase_bonus",
          pageId,
          `Credit refunded: page ${page.page_number} regen produced colored output after all retries`,
        );
        throw new Error(
          `Regen page ${pageId} produced colored output after all retries ` +
          `(lineArtScore=${lastQuality.lineArtScore}/5). Credit refunded.`,
        );
      }

      await updatePageImage(pageId, finalImageUrl!, finalPredictionId);
      console.log(
        `Regen page ${pageId} complete: predictionId=${finalPredictionId}`,
      );
    });

    return { pageId, status: "complete" };
  },
);
