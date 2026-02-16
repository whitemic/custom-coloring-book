import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { CharacterManifestSchema } from "@/types/manifest";
import type { CharacterManifest } from "@/types/manifest";
import { MANIFEST_SYSTEM_PROMPT } from "./manifest-prompt";

/**
 * Transform freeform user input into a structured CharacterManifest
 * using the Vercel AI SDK's generateObject (guaranteed schema conformance).
 *
 * Model: gpt-4o-mini -- fast, cheap, sufficient for structured extraction.
 * COGS: < $0.01 per manifest.
 */
export async function generateCharacterManifest(
  userInput: string,
): Promise<CharacterManifest> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: CharacterManifestSchema,
    system: MANIFEST_SYSTEM_PROMPT,
    prompt: `User's description of their main character:\n\n${userInput}`,
  });

  return object;
}
