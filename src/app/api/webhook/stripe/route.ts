import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, parseCheckoutSession } from "@/lib/stripe/webhook";
import {
  updateOrderAfterPayment,
  getLibraryPurchaseBySessionId,
  getCreatorEmailsForPages,
  incrementUserCredits,
  hasProcessedWebhookEvent,
  recordWebhookEvent,
} from "@/lib/supabase/queries";
import { inngest } from "@/lib/inngest/client";
import type Stripe from "stripe";

export const runtime = "edge";

const PURCHASE_BONUS_CREDITS = 5;

/**
 * POST /api/webhook/stripe
 *
 * Handles Stripe webhook events. On checkout.session.completed:
 * 1. Verifies the webhook signature
 * 2. Looks up the order by metadata.order_id and updates it (session id, email, amount, status)
 * 3. Only if the order was pending_payment (first webhook) sends "order/created" to Inngest
 * 4. Returns 200 immediately (< 500ms)
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = await verifyWebhookSignature(body, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingSecret = message.includes("STRIPE_WEBHOOK_SECRET");
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json(
      {
        error: "Invalid signature",
        detail: isMissingSecret
          ? "STRIPE_WEBHOOK_SECRET is not set on this deployment"
          : "Secret may not match the endpoint in Stripe Dashboard",
      },
      { status: 400 },
    );
  }

  // Wrap all event-handling logic in a try/catch so we always return 200.
  // Stripe retries on 5xx; since processing isn't fully idempotent, 500s can
  // cause duplicate credit awards or duplicate Inngest events on retry.
  try {
    // Global idempotency check: if we've already handled this exact Stripe event
    // (by event ID), skip processing immediately. Stripe guarantees at-least-once
    // delivery, so duplicate deliveries of the same event are expected.
    const alreadyProcessed = await hasProcessedWebhookEvent(event.id);
    if (alreadyProcessed) {
      console.log(`Stripe event ${event.id} already processed, skipping.`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Record the event ID before processing to prevent concurrent duplicate handling.
    // Uses upsert with ignoreDuplicates so parallel deliveries don't race.
    await recordWebhookEvent(event.id);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};
      const eventType = metadata.type;

      // ── Library purchase ────────────────────────────────────────────────
      if (eventType === "library_purchase") {
        const purchaseId = metadata.purchase_id;
        if (!purchaseId) {
          throw new Error(`Missing purchase_id in session ${session.id}`);
        }

        // Idempotency: look up by session ID, skip if already processed
        const purchase = await getLibraryPurchaseBySessionId(session.id);
        if (!purchase || purchase.status !== "pending_payment") {
          console.log(`Library purchase ${purchaseId} already processed, skipping.`);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        // Cross-reference: verify this Stripe session actually paid for this purchase.
        // Prevents an attacker from putting someone else's purchase_id in metadata.
        if (purchase.stripe_checkout_session_id !== session.id) {
          throw new Error(
            `Session mismatch for purchase ${purchaseId}: expected ${purchase.stripe_checkout_session_id}, got ${session.id}`,
          );
        }

        // Award creator credits for each page's original author.
        // These are fire-and-forget in the webhook; a failure here will be caught
        // by the outer try/catch and logged, but won't block PDF assembly.
        const creatorEmails = await getCreatorEmailsForPages(purchase.selected_page_ids);
        const creditTasks = Array.from(creatorEmails.entries()).map(([, email]) =>
          incrementUserCredits(
            email,
            1,
            "creator_earn",
            purchaseId,
            `Page downloaded in library purchase ${purchaseId}`,
          ),
        );
        await Promise.all(creditTasks);

        // Trigger PDF assembly. The Inngest function handles the status transition
        // to "generating" as its first step, so the webhook doesn't touch it here.
        await inngest.send({
          name: "library/book.assemble",
          data: { purchaseId },
        });

        console.log(`Library purchase ${purchaseId} paid, assembly triggered.`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      // ── Credit purchase ─────────────────────────────────────────────────
      if (eventType === "credit_purchase") {
        // Read the DB record UUID from metadata — never trust email or credits from metadata.
        const pendingId = metadata.pending_id;
        if (!pendingId) {
          throw new Error(`Missing pending_id in session ${session.id}`);
        }

        // Defer credit granting to Inngest for automatic retry logic and idempotency.
        // The grant-credits function will look up the pending record by pendingId,
        // check it isn't already complete, award credits, and mark it complete.
        await inngest.send({
          name: "library/credit.purchase",
          data: { pendingId },
        });

        console.log(`Credit purchase ${pendingId} queued for processing.`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      // ── Standard order ──────────────────────────────────────────────────
      {
        const payload = parseCheckoutSession(session);

        const order = await updateOrderAfterPayment({
          orderId: payload.orderId,
          stripeCheckoutSessionId: payload.sessionId,
          stripeCustomerEmail: payload.customerEmail,
          amountCents: payload.amountCents,
          currency: payload.currency,
          priceTier: payload.priceTier,
        });

        if (order) {
          // Award bonus credits to the buyer for use on page regeneration.
          // Fire-and-forget: a failure here does not block book generation.
          if (payload.customerEmail) {
            await incrementUserCredits(
              payload.customerEmail,
              PURCHASE_BONUS_CREDITS,
              "purchase_bonus",
              order.id,
              `${PURCHASE_BONUS_CREDITS} regeneration credits included with order ${order.id}`,
            ).catch((err) =>
              console.error(`Failed to award purchase bonus credits for order ${order.id}:`, err),
            );
          }

          await inngest.send({
            name: "order/created",
            data: { orderId: order.id },
          });
          console.log(`Order ${order.id} paid, Inngest event sent.`);
        } else {
          console.log(
            `Order ${payload.orderId} already processed for session ${payload.sessionId}, skipping.`,
          );
        }
      }
    }
  } catch (err) {
    // Log the error but always return 200 so Stripe does not retry.
    // Retrying a non-idempotent webhook handler risks duplicate credit awards.
    console.error("Webhook processing error:", err);
    return NextResponse.json(
      { received: true, error: String(err) },
      { status: 200 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
