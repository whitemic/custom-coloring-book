/**
 * Centralized AI model configuration.
 * Manages environment variables for model IDs and provider fallback.
 */

export const AI_MODEL_MANIFEST =
  process.env.AI_MODEL_MANIFEST ?? "gpt-4o-mini";
export const AI_MODEL_COMPLEX = process.env.AI_MODEL_COMPLEX ?? "gpt-4o";

/** Comma-separated list, e.g. "openai,anthropic". Used for Premium tier fallback only. */
export const AI_PROVIDER_FALLBACK =
  process.env.AI_PROVIDER_FALLBACK ?? "openai,anthropic";

/** Minimum amount_cents for Premium tier when using amount-based tier (Option B). e.g. 1499 = $14.99 */
export const PREMIUM_PRICE_CENTS = Number(
  process.env.PREMIUM_PRICE_CENTS ?? "1499",
);

export function getProviderFallbackList(): string[] {
  return AI_PROVIDER_FALLBACK.split(",").map((s) => s.trim().toLowerCase());
}

export type PriceTier = "standard" | "premium";

/**
 * Derive price tier from order for model selection.
 * Option A: use order.price_tier if present (from Stripe metadata).
 * Option B: use amount_cents threshold (PREMIUM_PRICE_CENTS).
 */
export function getPriceTierFromOrder(order: {
  amount_cents?: number | null;
  price_tier?: string | null;
}): PriceTier {
  if (
    order.price_tier === "premium" ||
    (typeof order.price_tier === "string" &&
      order.price_tier.toLowerCase() === "premium")
  ) {
    return "premium";
  }
  if ((order.amount_cents ?? 0) >= PREMIUM_PRICE_CENTS) {
    return "premium";
  }
  return "standard";
}
