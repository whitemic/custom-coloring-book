import { createHash } from "crypto";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { CharacterManifest } from "@/types/manifest";

// ---------------------------------------------------------------------------
// Seed generation
// ---------------------------------------------------------------------------

/**
 * Deterministic seed for a given order + page number.
 * SHA-256 hash truncated to a 32-bit unsigned integer.
 * Ensures Flux.1 produces reproducible outputs and retries are safe.
 */
export function generateSeed(orderId: string, pageNumber: number): number {
  const hash = createHash("sha256")
    .update(`${orderId}-${pageNumber}`)
    .digest("hex");
  // Mask to signed 32-bit positive integer (max 2,147,483,647)
  // to fit within PostgreSQL's integer type
  return parseInt(hash.slice(0, 8), 16) & 0x7fffffff;
}

// ---------------------------------------------------------------------------
// Scene generation (LLM)
// ---------------------------------------------------------------------------

const ScenesSchema = z.object({
  scenes: z
    .array(
      z.object({
        pageNumber: z.number(),
        description: z.string(),
      }),
    )
    .length(3),
});

const SCENE_SYSTEM_PROMPT = `You are a children's coloring book story designer. Given a Character Manifest (name, appearance, theme), generate exactly 3 unique scene descriptions for a coloring book.

RULES:
1. Each scene must feature the main character in a distinct setting or activity related to the theme.
2. Scenes should tell a loose narrative arc: introduction, adventure, resolution.
3. Descriptions should be 1-2 sentences, focusing on WHAT IS HAPPENING and WHERE -- not appearance (that comes from the manifest).
4. Include varied compositions: close-ups, full-body, landscape-heavy scenes.
5. Keep descriptions child-friendly and joyful.
6. Number scenes 1-3.

OUTPUT: Return exactly 3 scene objects in the provided JSON schema.`;

/**
 * Generate 20 unique scene descriptions for a coloring book based on the manifest.
 */
export async function generateSceneDescriptions(
  manifest: CharacterManifest,
): Promise<string[]> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: ScenesSchema,
    system: SCENE_SYSTEM_PROMPT,
    prompt: `Character Manifest:\n\nName: ${manifest.characterName}\nAge: ${manifest.ageRange}\nTheme: ${manifest.theme}\nHair: ${manifest.hair.texture} ${manifest.hair.color} ${manifest.hair.style} (${manifest.hair.length})\nOutfit: ${manifest.outfit.top}, ${manifest.outfit.bottom}, ${manifest.outfit.shoes}\nAccessories: ${manifest.outfit.accessories.join(", ") || "none"}\nStyle: ${manifest.styleTags.join(", ")}`,
  });

  return object.scenes
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((s) => s.description);
}

// ---------------------------------------------------------------------------
// Prompt composition
// ---------------------------------------------------------------------------

/**
 * Compose the full Replicate prompt for a single page.
 * Re-states the character description from the manifest in every prompt
 * to ensure Flux.1 renders a visually coherent character across all pages.
 *
 * The seed is logged in the prompt text for traceability but is passed
 * as a separate Replicate parameter (not parsed from the text).
 */
export function composePagePrompt(
  manifest: CharacterManifest,
  scene: string,
  seed: number,
): string {
  const parts = [
    "Black and white coloring book page, bold clean outlines, no shading, no color, white background.",
    `A ${manifest.ageRange} year old character named ${manifest.characterName}`,
    `with ${manifest.hair.texture} ${manifest.hair.color} ${manifest.hair.style} hair (${manifest.hair.length}),`,
    `wearing ${manifest.outfit.top} and ${manifest.outfit.bottom}, ${manifest.outfit.shoes}.`,
    manifest.outfit.accessories.length > 0
      ? `Accessories: ${manifest.outfit.accessories.join(", ")}.`
      : "",
    `Scene: ${scene}.`,
    `Style: ${manifest.styleTags.join(", ")}.`,
    `Negative: ${[...manifest.negativeTags, "realistic", "photographic", "color", "gradient"].join(", ")}.`,
    `[seed:${seed}]`,
  ];

  return parts.filter(Boolean).join(" ");
}
