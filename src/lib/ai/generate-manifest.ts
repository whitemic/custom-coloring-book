import { generateObject } from "ai";
import { CharacterManifestSchema } from "@/types/manifest";
import type { CharacterManifest } from "@/types/manifest";
import { MANIFEST_SYSTEM_PROMPT } from "./manifest-prompt";
import { getModel } from "./models";

/**
 * Transform freeform user input into a structured CharacterManifest
 * using the Vercel AI SDK's generateObject (guaranteed schema conformance).
 * Uses gpt-4o (high complexity model) for best manifest quality.
 *
 * If themeHint is provided (from the form's "Theme / Adventure" field), the
 * manifest's theme will be based on it so scenes and backgrounds match the user's choice.
 */
export async function generateCharacterManifest(
  userInput: string,
  themeHint?: string,
): Promise<CharacterManifest> {
  const model = getModel("high");
  const promptParts = [`User's description of their main character:\n\n${userInput}`];
  if (themeHint) {
    promptParts.push(
      `\n\nUser's chosen theme/setting for the coloring book (use this for the theme field): ${themeHint}`,
    );
  }
  const prompt = promptParts.join("");
  const { object } = await generateObject({
    model,
    schema: CharacterManifestSchema,
    system: MANIFEST_SYSTEM_PROMPT,
    prompt,
  });

  return object;
}
