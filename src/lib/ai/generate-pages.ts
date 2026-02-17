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

CRITICAL RULE: Each scene must feature THE EXACT SAME CHARACTER. Maintain character type/species consistency across all scenes. If the character is a frog, every scene must feature the same frog. If the character is a human child, every scene must feature the same human child.

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
 */
export async function generateSceneDescriptions(
  manifest: CharacterManifest,
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

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: ScenesSchema,
    system: SCENE_SYSTEM_PROMPT,
    prompt: `Character Manifest:\n\n${characterDesc}`,
  });

  return object.scenes
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((s) => s.description);
}

// ---------------------------------------------------------------------------
// Background elements helper
// ---------------------------------------------------------------------------

/**
 * Get theme-appropriate background element suggestions for coloring book pages.
 * Returns a string describing background elements that match the theme.
 */
function getBackgroundElementsForTheme(theme: string): string {
  const themeLower = theme.toLowerCase();
  
  // Water/aquatic themes
  if (themeLower.includes("water") || themeLower.includes("ocean") || 
      themeLower.includes("sea") || themeLower.includes("lily") || 
      themeLower.includes("pond") || themeLower.includes("lake")) {
    return "lily pads, water ripples, reeds, aquatic plants, flowers, dragonflies, decorative borders, bubbles, water patterns";
  }
  
  // Space themes
  if (themeLower.includes("space") || themeLower.includes("cosmic") || 
      themeLower.includes("planet") || themeLower.includes("star") || 
      themeLower.includes("galaxy")) {
    return "stars, planets, asteroids, moons, decorative borders, cosmic patterns, nebula patterns, space clouds";
  }
  
  // Forest/nature themes
  if (themeLower.includes("forest") || themeLower.includes("wood") || 
      themeLower.includes("tree") || themeLower.includes("nature") || 
      themeLower.includes("garden") || themeLower.includes("jungle")) {
    return "trees, leaves, flowers, mushrooms, decorative borders, vines, plants, butterflies, birds, nature patterns";
  }
  
  // Underwater themes
  if (themeLower.includes("underwater") || themeLower.includes("coral") || 
      themeLower.includes("reef")) {
    return "bubbles, coral, seaweed, fish, shells, decorative borders, underwater plants, water patterns";
  }
  
  // Desert themes
  if (themeLower.includes("desert") || themeLower.includes("sand")) {
    return "cacti, sand dunes, decorative borders, desert plants, rocks, sun patterns, geometric patterns";
  }
  
  // Sky/cloud themes
  if (themeLower.includes("sky") || themeLower.includes("cloud")) {
    return "clouds, birds, decorative borders, sun, moon, stars, sky patterns, weather elements";
  }
  
  // Default: general decorative elements
  return "decorative borders, patterns, flowers, stars, clouds, plants, geometric shapes, ornamental details";
}

// ---------------------------------------------------------------------------
// Quality control negative prompts
// ---------------------------------------------------------------------------

/**
 * Get quality control negative prompts to prevent common generation artifacts.
 * These are added to every prompt to reduce issues like two heads, extra limbs, etc.
 */
function getQualityNegativePrompts(
  manifest: CharacterManifest,
): string[] {
  const baseNegatives = [
    "two heads",
    "multiple heads",
    "extra heads",
    "double head",
    "duplicate head",
    "extra limbs",
    "malformed anatomy",
    "inconsistent character design",
    "different character",
    "wrong character",
    "duplicate features",
    "malformed",
    "deformed",
    "distorted",
    "empty background",
    "minimal background",
    "bare background",
    "plain background",
    "sparse details",
    "color",
    "colored",
    "colored in",
    "filled color",
    "color fill",
    "shading",
    "shaded",
    "gradient",
    "gradients",
    "gray",
    "grey",
    "gray scale",
    "greyscale",
    "tone",
    "tones",
    "fill",
    "filled",
    "painted",
    "paint",
    "texture fill",
    "pattern fill",
  ];

  // Add character-type-specific negatives
  if (manifest.characterType !== "human") {
    baseNegatives.push("human", "human child", "person");
    if (manifest.species) {
      // Add other common species that might be confused
      const commonSpecies = ["cat", "dog", "frog", "dragon", "unicorn", "bear"];
      const speciesLower = manifest.species.toLowerCase();
      const wrongSpecies = commonSpecies.filter((s) => s !== speciesLower);
      baseNegatives.push(...wrongSpecies.slice(0, 3)); // Limit to avoid prompt bloat
    }
  } else if (manifest.species) {
    // If somehow human but has species, add that species to negatives
    baseNegatives.push(manifest.species);
  }

  return baseNegatives;
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
  const parts: string[] = [
    "Pure black and white line art coloring book page. ONLY black lines on white background. NO color, NO shading, NO gradients, NO gray tones, NO fills, NO painted areas. Bold clean outlines only. Detailed coloring book style with rich backgrounds and white spaces for coloring.",
  ];

  // Character consistency header - CRITICAL for maintaining same character
  parts.push(
    `THE EXACT SAME CHARACTER named ${manifest.characterName}. ONE HEAD ONLY. Single character, single head, single body. Maintain IDENTICAL character appearance and consistency with previous pages.`,
  );

  // Character description based on type
  if (manifest.characterType === "human") {
    // Human character description
    if (manifest.ageRange) {
      parts.push(
        `A ${manifest.ageRange} year old character named ${manifest.characterName}. ONE HEAD ONLY. Single character with single head and single body.`,
      );
    } else {
      parts.push(
        `A character named ${manifest.characterName}. ONE HEAD ONLY. Single character with single head and single body.`,
      );
    }

    if (manifest.hair) {
      parts.push(
        `with ${manifest.hair.texture} ${manifest.hair.color} ${manifest.hair.style} hair (${manifest.hair.length}),`,
      );
    }

    if (manifest.outfit) {
      parts.push(
        `wearing ${manifest.outfit.top} and ${manifest.outfit.bottom}, ${manifest.outfit.shoes}.`,
      );

      if (manifest.outfit.accessories.length > 0) {
        parts.push(`Accessories: ${manifest.outfit.accessories.join(", ")}.`);
      }
    }

    if (manifest.skinTone) {
      parts.push(`Skin tone: ${manifest.skinTone}.`);
    }
  } else {
    // Non-human character description
    const characterTypeDesc =
      manifest.species || manifest.characterType || "character";
    parts.push(
      `THE SAME ${characterTypeDesc} character named ${manifest.characterName}. ONE HEAD ONLY. Single character with single head and single body.`,
    );

    if (manifest.physicalDescription) {
      parts.push(`Physical appearance: ${manifest.physicalDescription}.`);
    }

    // Repeat species/type for emphasis
    if (manifest.species) {
      parts.push(`This is a ${manifest.species}, not a human or other species.`);
    }
  }

  // Character key features - CRITICAL for consistency
  if (manifest.characterKeyFeatures && manifest.characterKeyFeatures.length > 0) {
    parts.push(
      `Key features that MUST appear: ${manifest.characterKeyFeatures.join(", ")}.`,
    );
    // Repeat key features in different phrasing for emphasis
    parts.push(
      `Always include these distinctive features: ${manifest.characterKeyFeatures.join(", ")}.`,
    );
  }

  // Scene description (comes after character description)
  parts.push(`Scene: ${scene}.`);

  // Rich background elements - CRITICAL for coloring book quality
  const backgroundElements = getBackgroundElementsForTheme(manifest.theme);
  parts.push(
    `Rich detailed background filled with colorable elements: ${backgroundElements}.`,
  );
  parts.push(
    `Multiple layers: foreground decorative elements (flowers, stars, patterns, borders), midground details (plants, objects, environmental elements), background patterns and textures.`,
  );
  parts.push(
    `Background should be filled with theme-appropriate decorative elements, patterns, borders, and environmental details that children can color.`,
  );

  // Style tags
  parts.push(`Style: ${manifest.styleTags.join(", ")}.`);

  // CRITICAL: Pure black and white line art instructions
  parts.push(
    `IMPORTANT: This is a coloring book page. Generate ONLY pure black lines on pure white background. NO colors, NO shading, NO gray tones, NO gradients, NO fills, NO painted areas. Only black outlines and line art. Children will color this page themselves.`,
  );

  // Negative prompts - combine manifest negatives, quality controls, and defaults
  const qualityNegatives = getQualityNegativePrompts(manifest);
  const allNegatives = [
    ...manifest.negativeTags,
    ...qualityNegatives,
    "realistic",
    "photographic",
    "color",
    "colored",
    "colored in",
    "gradient",
    "shading",
    "shaded",
    "gray",
    "grey",
    "greyscale",
    "fill",
    "filled",
    "painted",
  ];
  parts.push(`Negative: ${allNegatives.join(", ")}.`);

  // Seed for traceability
  parts.push(`[seed:${seed}]`);

  return parts.filter(Boolean).join(" ");
}
