/**
 * Shape of the metadata we attach to the Stripe Checkout Session.
 * This is set when creating the session on the frontend/landing page
 * and read back in the webhook handler.
 */
export interface CheckoutSessionMetadata {
  /** Freeform character description from the user */
  user_input: string;
  /** Optional: character name provided during checkout */
  character_name?: string;
  /** Optional: theme preference selected at checkout */
  theme?: string;
}

/**
 * Parsed payload we extract from a `checkout.session.completed` event.
 */
export interface StripeCheckoutPayload {
  sessionId: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  metadata: CheckoutSessionMetadata;
}
