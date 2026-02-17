import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Lazily initialized Stripe SDK client for server-side usage.
 * Deferred initialization prevents build-time errors when env vars
 * are not yet available.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

    _stripe = new Stripe(key, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }
  return _stripe;
}
