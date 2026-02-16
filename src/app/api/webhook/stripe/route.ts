import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, parseCheckoutSession } from "@/lib/stripe/webhook";
import { upsertOrder } from "@/lib/supabase/queries";
import { inngest } from "@/lib/inngest/client";
import type Stripe from "stripe";

export const runtime = "edge";

/**
 * POST /api/webhook/stripe
 *
 * Handles Stripe webhook events. On checkout.session.completed:
 * 1. Verifies the webhook signature
 * 2. Idempotently upserts the order (duplicate webhooks are no-ops)
 * 3. Sends an "order/created" event to Inngest to trigger generation
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
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      const payload = parseCheckoutSession(session);

      // Idempotent upsert -- returns null if the order already exists
      const order = await upsertOrder({
        stripeCheckoutSessionId: payload.sessionId,
        stripeCustomerEmail: payload.customerEmail,
        amountCents: payload.amountCents,
        currency: payload.currency,
        userInput: payload.metadata as unknown as Record<string, unknown>,
      });

      if (order) {
        // Only send the Inngest event for new orders (not duplicates)
        await inngest.send({
          name: "order/created",
          data: { orderId: order.id },
        });
        console.log(`Order ${order.id} created, Inngest event sent.`);
      } else {
        console.log(
          `Duplicate webhook for session ${payload.sessionId}, skipping.`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Error processing checkout session:", message);
      return NextResponse.json(
        { error: "Processing failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
