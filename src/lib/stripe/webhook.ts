import Stripe from "stripe";
import { getStripe } from "./client";
import type { StripeCheckoutPayload } from "@/types/stripe";

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
 * Throws if the metadata is missing required fields.
 */
export function parseCheckoutSession(
  session: Stripe.Checkout.Session,
): StripeCheckoutPayload {
  const metadata = session.metadata ?? {};
  const userInput = metadata.user_input;

  if (!userInput) {
    throw new Error(
      `Checkout session ${session.id} is missing user_input metadata`,
    );
  }

  return {
    sessionId: session.id,
    customerEmail:
      session.customer_details?.email ?? session.customer_email ?? "",
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    metadata: {
      user_input: userInput,
      character_name: metadata.character_name,
      theme: metadata.theme,
    },
  };
}
