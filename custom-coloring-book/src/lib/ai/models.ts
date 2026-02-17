import { openai } from "@ai-sdk/openai";
import {
  AI_MODEL_MANIFEST,
  AI_MODEL_COMPLEX,
  type PriceTier,
} from "./config";

/** Return type is compatible with Vercel AI SDK generateObject({ model }) */
type LanguageModel = ReturnType<typeof openai>;

/**
 * Get the appropriate language model for the given complexity and price tier.
 * Standard tier: always gpt-4o-mini (maintains 80%+ margins).
 * Premium tier: low = gpt-4o-mini, high = gpt-4o (or claude-3-5-sonnet via fallback at call site).
 */
export function getModel(
  complexity: "low" | "high",
  priceTier: PriceTier,
): LanguageModel {
  if (priceTier === "standard") {
    return openai(AI_MODEL_MANIFEST);
  }
  // Premium tier
  if (complexity === "low") {
    return openai(AI_MODEL_MANIFEST);
  }
  return openai(AI_MODEL_COMPLEX);
}
