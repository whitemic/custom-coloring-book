import { createHash } from "crypto";
import { generateObject } from "ai";
import { z } from "zod";
import type { CharacterManifest } from "@/types/manifest";
import type { PageContext } from "./generate-context";
import { getModel } from "./models";
import type { PriceTier } from "./config";

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

CRITICAL RULE: Each scene must feature THE EXACT SAME CHARACTER. Maintain character type/species consistency across all scenes. If the character is a frog, every scene must feature the same frog. If the character is a human child, every scene must feature the same human child.

DISTINCT LOCATIONS (CRITICAL): Each of the scenes must be in a clearly DIFFERENT place or setting within the theme — not the same scene repeated. Vary location and focal point: e.g. outside vs inside, different rooms or areas, different vantage points. Example for a fairytale-kingdom theme: (1) a view from outside the kingdom where you can see a castle in the distance, (2) inside the castle in a grand ballroom, (3) the character sitting on a throne. Generate this level of variety for the user's theme: distinctly different locations/settings so each scene is clearly different.

RULES:
1. Each scene must feature THE SAME main character (maintain species/type consistency) in a distinct setting or activity related to the theme.
2. Scenes should tell a loose narrative arc: introduction, adventure, resolution.
3. Descriptions should be 1-2 sentences, focusing on WHAT IS HAPPENING and WHERE -- not appearance (that comes from the manifest).
4. Include varied compositions: close-ups, full-body, landscape-heavy scenes.
5. Keep descriptions child-friendly and joyful.
6. Number scenes 1-3.
7. NEVER change the character's type or species between scenes. The character must be identical across all 3 scenes.
8. BACKGROUND ELEMENTS (CRITICAL FOR COLORING BOOKS):
   - Each scene description MUST include rich background elements related to the theme
   - Specify decorative elements: plants, flowers, clouds, stars, patterns, borders, frames, textures
   - Include environmental details: trees, rocks, water, buildings, furniture, toys, theme-appropriate objects
   - Request patterns and textures: stripes, polka dots, geometric shapes, decorative borders, ornamental details
   - Emphasize that backgrounds should be detailed enough for coloring (NOT empty or minimal)
   - Include multiple layers: foreground decorative elements, midground environmental details, background patterns
   - Match background elements to the theme (e.g., lily pads and reeds for water themes, stars and planets for space themes, trees and flowers for forest themes)
   - Each scene should have plenty of colorable elements beyond just the main character

OUTPUT: Return exactly 3 scene objects in the provided JSON schema.`;

/**
 * Generate 3 unique scene descriptions for a coloring book based on the manifest.
 * Uses getModel('low', priceTier) for cost-efficient generation.
 */
export async function generateSceneDescriptions(
  manifest: CharacterManifest,
  priceTier: PriceTier,
): Promise<string[]> {
  // Build character description based on type
  let characterDesc = `Name: ${manifest.characterName}\n`;
  characterDesc += `Character Type: ${manifest.characterType}\n`;

  if (manifest.species) {
    characterDesc += `Species: ${manifest.species}\n`;
  }

  if (manifest.characterType === "human") {
    if (manifest.ageRange) {
      characterDesc += `Age: ${manifest.ageRange}\n`;
    }
    if (manifest.hair) {
      characterDesc += `Hair: ${manifest.hair.texture} ${manifest.hair.color} ${manifest.hair.style} (${manifest.hair.length})\n`;
    }
    if (manifest.outfit) {
      characterDesc += `Outfit: ${manifest.outfit.top}, ${manifest.outfit.bottom}, ${manifest.outfit.shoes}\n`;
      if (manifest.outfit.accessories.length > 0) {
        characterDesc += `Accessories: ${manifest.outfit.accessories.join(", ")}\n`;
      }
    }
  } else {
    if (manifest.physicalDescription) {
      characterDesc += `Physical Description: ${manifest.physicalDescription}\n`;
    }
  }

  if (manifest.characterKeyFeatures && manifest.characterKeyFeatures.length > 0) {
    characterDesc += `Key Features: ${manifest.characterKeyFeatures.join(", ")}\n`;
  }

  characterDesc += `Theme: ${manifest.theme}\n`;
  characterDesc += `Style: ${manifest.styleTags.join(", ")}`;

  const model = getModel("low", priceTier);
  const { object } = await generateObject({
    model,
    schema: ScenesSchema,
    system: SCENE_SYSTEM_PROMPT,
    prompt: `Character Manifest:\n\n${characterDesc}`,
  });

  return object.scenes
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((s) => s.description);
}

/** Universal quality negatives always included in every page prompt. */
const QUALITY_NEGATIVES = [
  "two heads",
  "multiple heads",
  "extra heads",
  "extra limbs",
  "malformed anatomy",
  "inconsistent character design",
  "different character",
  "wrong character",
  "empty background",
  "minimal background",
  "color",
  "colored",
  "shading",
  "shaded",
  "gradient",
  "gray",
  "grey",
  "greyscale",
  "fill",
  "filled",
  "painted",
];

// ---------------------------------------------------------------------------
// Prompt composition
// ---------------------------------------------------------------------------

/**
 * Format background elements from PageContext into a single string for the prompt.
 */
function formatBackgroundElements(context: PageContext): string {
  const { foreground, midground, background } = context.backgroundElements;
  return [
    ...foreground,
    ...midground,
    ...background,
  ].join(", ");
}

/**
 * Compose the full Replicate prompt for a single page.
 * Re-states the character description from the manifest in every prompt
 * to ensure Flux.1 renders a visually coherent character across all pages.
 * Uses dynamic pageContext for background elements and scene-specific negatives.
 *
 * The seed is logged in the prompt text for traceability but is passed
 * as a separate Replicate parameter (not parsed from the text).
 */
export function composePagePrompt(
  manifest: CharacterManifest,
  scene: string,
  seed: number,
  pageContext: PageContext,
): string {
  const parts: string[] = [
    "Pure black and white line art coloring book page. ONLY black lines on white background. NO color, NO shading, NO gradients, NO gray tones, NO fills, NO painted areas. Bold clean outlines only. Detailed coloring book style with rich backgrounds and white spaces for coloring.",
  ];

  // Explicit theme so the image model respects it
  parts.push(
    `Theme: ${manifest.theme}. Scene and all background elements must match this theme.`,
  );

  // Character consistency: one clear statement (no repetition)
  parts.push(
    `THE EXACT SAME CHARACTER named ${manifest.characterName}. ONE HEAD ONLY. Single character, single body. Maintain IDENTICAL character appearance and consistency with previous pages.`,
  );

  // Character description based on type
  if (manifest.characterType === "human") {
    if (manifest.ageRange) {
      parts.push(
        `A ${manifest.ageRange} year old named ${manifest.characterName}.`,
      );
    } else {
      parts.push(`A character named ${manifest.characterName}.`);
    }

    if (manifest.hair) {
      parts.push(
        `with ${manifest.hair.texture} ${manifest.hair.color} ${manifest.hair.style} hair (${manifest.hair.length}),`,
      );
    }

    if (manifest.outfit) {
      const top = manifest.outfit.top || "";
      const bottom = manifest.outfit.bottom || "";
      const clothes =
        [top, bottom].filter(Boolean).length > 0
          ? [top, bottom].filter(Boolean).join(" and ")
          : "clothes";
      parts.push(`wearing ${clothes}, ${manifest.outfit.shoes}.`);

      if (manifest.outfit.accessories.length > 0) {
        parts.push(`Accessories: ${manifest.outfit.accessories.join(", ")}.`);
      }
    }

    if (manifest.skinTone) {
      parts.push(`Skin tone: ${manifest.skinTone}.`);
    }
  } else {
    const characterTypeDesc =
      manifest.species || manifest.characterType || "character";
    parts.push(
      `THE SAME ${characterTypeDesc} named ${manifest.characterName}. ONE HEAD ONLY. Single character, single body.`,
    );

    if (manifest.physicalDescription) {
      parts.push(`Physical appearance: ${manifest.physicalDescription}.`);
    }

    if (manifest.species) {
      parts.push(`This is a ${manifest.species}, not a human or other species.`);
    }
  }

  // Key features: state once
  if (manifest.characterKeyFeatures && manifest.characterKeyFeatures.length > 0) {
    parts.push(
      `Key features that MUST appear: ${manifest.characterKeyFeatures.join(", ")}.`,
    );
  }

  // Scene description
  parts.push(`Scene: ${scene}.`);

  // Rich background from context (no redundant "multiple layers" line)
  const backgroundStr = formatBackgroundElements(pageContext);
  if (backgroundStr) {
    parts.push(
      `Rich detailed background filled with colorable elements: ${backgroundStr}.`,
    );
  }

  // Style
  parts.push(`Style: ${manifest.styleTags.join(", ")}.`);

  // Negatives: deduplicate so we don't repeat the same phrase
  const negativeSet = new Set([
    ...manifest.negativeTags,
    ...QUALITY_NEGATIVES,
    ...pageContext.sceneSpecificNegatives,
    "realistic",
    "photographic",
    "colored in",
  ]);
  const allNegatives = [...negativeSet];
  parts.push(`Negative: ${allNegatives.join(", ")}.`);

  // Seed for traceability
  parts.push(`[seed:${seed}]`);

  return parts.filter(Boolean).join(" ");
}
