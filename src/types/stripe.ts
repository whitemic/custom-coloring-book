/**
 * Shape of the metadata we attach to the Stripe Checkout Session (order-first flow).
 * We only pass order_id and optional price_tier; form data is stored on the order in the DB.
 */
export interface CheckoutSessionMetadata {
  /** Order UUID created before redirect; webhook uses this to update the order */
  order_id: string;
  /** Optional: "standard" | "premium" for model selection (upsell) */
  price_tier?: string;
}

/**
 * Parsed payload we extract from a `checkout.session.completed` event.
 */
export interface StripeCheckoutPayload {
  orderId: string;
  sessionId: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  /** For model selection: "standard" | "premium" (from metadata or derived from amount) */
  priceTier: "standard" | "premium";
}
