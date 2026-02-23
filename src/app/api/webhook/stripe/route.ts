import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, parseCheckoutSession } from "@/lib/stripe/webhook";
import { updateOrderAfterPayment } from "@/lib/supabase/queries";
import { inngest } from "@/lib/inngest/client";
import type Stripe from "stripe";

export const runtime = "edge";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
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
