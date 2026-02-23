import Stripe from "stripe";
import { getStripe } from "./client";
import type { StripeCheckoutPayload } from "@/types/stripe";

const PREMIUM_PRICE_CENTS = Number(process.env.PREMIUM_PRICE_CENTS ?? "1499");

function getPriceTierFromSession(
  amountCents: number,
  metadataPriceTier?: string | null,
): "standard" | "premium" {
  if (
    metadataPriceTier === "premium" ||
    (typeof metadataPriceTier === "string" &&
      metadataPriceTier.toLowerCase() === "premium")
  ) {
    return "premium";
  }
  if (amountCents >= PREMIUM_PRICE_CENTS) {
    return "premium";
  }
  return "standard";
}

/**
 * Verify the Stripe webhook signature and construct the event.
 * Uses the async variant compatible with Edge Runtime.
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string,
): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }

  const stripe = getStripe();
  return stripe.webhooks.constructEventAsync(body, signature, secret);
}

/**
 * Extract the fields we care about from a checkout.session.completed event.
 * Order-first flow: metadata must contain order_id (set at checkout).
 */
export function parseCheckoutSession(
  session: Stripe.Checkout.Session,
): StripeCheckoutPayload {
  const metadata = session.metadata ?? {};
  const orderId = metadata.order_id;

  if (!orderId || typeof orderId !== "string") {
    throw new Error(
      `Checkout session ${session.id} is missing order_id metadata`,
    );
  }

  const amountCents = session.amount_total ?? 0;
  const priceTier = getPriceTierFromSession(
    amountCents,
    metadata.price_tier ?? null,
  );

  return {
    orderId,
    sessionId: session.id,
    customerEmail:
      session.customer_details?.email ?? session.customer_email ?? "",
    amountCents,
    currency: session.currency ?? "usd",
    priceTier,
  };
}
