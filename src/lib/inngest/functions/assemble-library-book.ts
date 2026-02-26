import { inngest } from "../client";
import {
  getLibraryPurchase,
  getPagesByIds,
  updateLibraryPurchaseStatus,
} from "@/lib/supabase/queries";
import { assemblePdf } from "@/lib/utils/pdf";

/**
 * Assembles a custom PDF from user-selected library pages.
 * Triggered by "library/book.assemble" after:
 *   - A successful Stripe payment for a library purchase, OR
 *   - A direct credit redemption (bypasses Stripe).
 *
 * Uses the existing assemblePdf utility, storing the result at
 * {purchaseId}.pdf in the coloring-books Supabase Storage bucket.
 */
export const assembleLibraryBook = inngest.createFunction(
  {
    id: "assemble-library-book",
    retries: 3,
  },
  { event: "library/book.assemble" },
  async ({ event, step }) => {
    const { purchaseId } = event.data;

    try {
    // Step 1: Mark the purchase as generating.
    // Doing this inside Inngest (rather than the webhook) means the status
    // update is retried automatically if it transiently fails, and the webhook
    // can return 200 without waiting on it.
    await step.run("mark-generating", async () => {
      const p = await getLibraryPurchase(purchaseId);
      if (!p) {
        throw new Error(`Library purchase not found: ${purchaseId}`);
      }
      if (p.status === "complete") {
        // Already assembled on a previous run — skip the status update.
        return;
      }
      if (p.status !== "generating") {
        await updateLibraryPurchaseStatus(purchaseId, "generating");
      }
    });

    // Step 2: Fetch the purchase and its selected page IDs
    const purchase = await step.run("fetch-purchase", async () => {
      const p = await getLibraryPurchase(purchaseId);
      if (!p) {
        throw new Error(`Library purchase not found: ${purchaseId}`);
      }
      if (p.status === "complete") {
        // Idempotency: already assembled, nothing to do
        return null;
      }
      return p;
    });

    if (!purchase) return { skipped: true, reason: "already complete" };

    // Step 3: Fetch the image URLs for all selected pages
    const imageUrls = await step.run("fetch-page-images", async () => {
      const pages = await getPagesByIds(purchase.selected_page_ids);

      if (pages.length === 0) {
        throw new Error(`No pages found for purchase: ${purchaseId}`);
      }

      const urls = pages.map((p) => p.image_url).filter((url): url is string => !!url);

      if (urls.length === 0) {
        throw new Error(`No image URLs found for purchase: ${purchaseId}`);
      }

      return urls;
    });

    // Step 4: Assemble and upload the PDF
    // assemblePdf uses the first argument as the filename key:
    // stored as `{purchaseId}.pdf` in the coloring-books bucket.
    const pdfUrl = await step.run("assemble-pdf", async () => {
      return await assemblePdf(purchaseId, imageUrls);
    });

    // Step 5: Mark the purchase as complete
    await step.run("mark-complete", async () => {
      await updateLibraryPurchaseStatus(purchaseId, "complete", pdfUrl);
    });

    return { purchaseId, pdfUrl, pageCount: imageUrls.length };
    } catch (err) {
      // Mark the purchase failed so the download page transitions out of the loading state.
      // Using step.run ensures the DB write is itself retried if it transiently fails.
      await step.run("mark-purchase-failed", async () => {
        await updateLibraryPurchaseStatus(purchaseId, "failed");
        console.error(`Library purchase ${purchaseId} failed permanently:`, err);
      });

      // Re-throw so Inngest records the function run as failed.
      throw err;
    }
  },
);
