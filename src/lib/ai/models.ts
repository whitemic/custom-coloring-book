import { openai } from "@ai-sdk/openai";
import { AI_MODEL_MANIFEST, AI_MODEL_COMPLEX } from "./config";

/** Return type is compatible with Vercel AI SDK generateObject({ model }) */
type LanguageModel = ReturnType<typeof openai>;

/**
 * Get the appropriate language model for the given complexity.
 * low  → gpt-4o-mini (fast, cheap; used for scene/context generation)
 * high → gpt-4o      (highest quality; used for manifest + quality gate)
 */
export function getModel(complexity: "low" | "high"): LanguageModel {
  if (complexity === "low") {
    return openai(AI_MODEL_MANIFEST);
  }
  return openai(AI_MODEL_COMPLEX);
}
