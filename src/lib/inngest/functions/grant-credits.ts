import { inngest } from "../client";
import {
  getPendingCreditPurchaseById,
  incrementUserCredits,
  completePendingCreditPurchase,
} from "@/lib/supabase/queries";

/**
 * Grants credits to a user after a successful Stripe credit-pack purchase.
 * Triggered by "library/credit.purchase" sent from the Stripe webhook.
 *
 * Using Inngest here (rather than inline webhook logic) provides:
 * - Automatic retries (up to 5) if the DB write transiently fails
 * - Idempotency: checks pending record status before awarding
 * - Decoupling: webhook returns 200 immediately, credits are awarded async
 */
export const grantCredits = inngest.createFunction(
  { id: "grant-credits", retries: 5 },
  { event: "library/credit.purchase" },
  async ({ event, step }) => {
    const { pendingId } = event.data;

    await step.run("grant-credits", async () => {
      const pending = await getPendingCreditPurchaseById(pendingId);

      if (!pending) {
        throw new Error(`No pending credit purchase found for id=${pendingId}`);
      }

      // Idempotency: if credits were already awarded on a previous attempt, skip.
      if (pending.status === "complete") {
        console.log(`Credit purchase ${pendingId} already complete, skipping.`);
        return;
      }

      const { email, credits, stripe_session_id } = pending;

      await incrementUserCredits(
        email,
        credits,
        "purchase",
        stripe_session_id ?? pendingId,
        `Purchased ${credits} credits via Stripe`,
      );

      // stripe_session_id is set by linkPendingCreditPurchaseSession before the
      // webhook fires, so it should always be present here. Fall back to pendingId
      // for the rare edge case where the session link hasn't propagated yet.
      await completePendingCreditPurchase(pendingId, stripe_session_id ?? "");
    });
  },
);
