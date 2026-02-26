/**
 * Centralized AI model configuration.
 * All orders use the same high-quality models:
 *   low complexity  → AI_MODEL_MANIFEST (default: gpt-4o-mini)
 *   high complexity → AI_MODEL_COMPLEX  (default: gpt-4o)
 */

export const AI_MODEL_MANIFEST =
  process.env.AI_MODEL_MANIFEST ?? "gpt-4o-mini";
export const AI_MODEL_COMPLEX = process.env.AI_MODEL_COMPLEX ?? "gpt-4o";
