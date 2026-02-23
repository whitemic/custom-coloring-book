import { generateObject } from "ai";
import { z } from "zod";
import type { CharacterManifest } from "@/types/manifest";
import { getModel } from "./models";
import type { PriceTier } from "./config";

// ---------------------------------------------------------------------------
// Global Theme Context (called once per book)
// ---------------------------------------------------------------------------

const GlobalThemeContextSchema = z.object({
  themeDescription: z
    .string()
    .describe("Short description of the theme for use in background generation"),
  defaultBackgroundHints: z
    .array(z.string())
    .describe(
      "Theme-appropriate background element phrases (3–6 words each, visually specific). E.g. 'ancient oak trees with gnarled roots', 'glowing control panels with blinking dials'.",
    ),
  defaultNegatives: z
    .array(z.string())
    .describe("Theme/character-appropriate default negative prompts"),
});

export type GlobalThemeContext = z.infer<typeof GlobalThemeContextSchema>;

const GLOBAL_CONTEXT_SYSTEM = `You are a children's coloring book art director. Given a Character Manifest, output a brief global theme context reused across all pages.

CRITICAL — defaultBackgroundHints must be visually specific, pattern-rich phrases of 3–6 words each (NOT bare nouns).
Good: "mossy stone steps with carved runes", "glowing lanterns on twisted iron hooks", "star charts pinned to a wooden wall"
Bad: "steps", "lanterns", "charts"

IMPORTANT — These descriptions will be rendered as BLACK AND WHITE LINE ART. Describe shapes, patterns, and textures ONLY. Do not mention colors or colorfulness. Write "striped candy canes" not "red-and-white candy canes". Write "patterned gumdrops" not "colorful gumdrops". Write "fluffy clouds" not "pink clouds".

Output themeDescription (one sentence), defaultBackgroundHints (8–12 visually rich, color-free phrases), and defaultNegatives (5–8 items). Keep arrays focused on this specific theme — no generic filler.`;

export async function generateGlobalThemeContext(
  manifest: CharacterManifest,
  priceTier: PriceTier,
): Promise<GlobalThemeContext> {
  const model = getModel("low", priceTier);
  const themeInput = `Character: ${manifest.characterName}, Type: ${manifest.characterType}, Theme: ${manifest.theme}${manifest.species ? `, Species: ${manifest.species}` : ""}`;
  const { object } = await generateObject({
    model,
    schema: GlobalThemeContextSchema,
    system: GLOBAL_CONTEXT_SYSTEM,
    prompt: themeInput,
  });
  return object;
}

// ---------------------------------------------------------------------------
// Page context (background elements + scene-specific negatives)
// ---------------------------------------------------------------------------

const BackgroundElementsSchema = z.object({
  foreground: z
    .array(z.string())
    .describe(
      "Foreground decorative element phrases, 3–6 words each, visually specific and pattern-rich",
    ),
  midground: z
    .array(z.string())
    .describe(
      "Midground environmental detail phrases, 3–6 words each, visually specific",
    ),
  background: z
    .array(z.string())
    .describe(
      "Background scenery/texture phrases, 3–6 words each, visually specific",
    ),
});

const PageContextSchema = z.object({
  backgroundElements: BackgroundElementsSchema,
  sceneSpecificNegatives: z.array(z.string()),
});

export type PageContext = z.infer<typeof PageContextSchema>;

const PAGE_CONTEXT_SYSTEM = `You are a children's coloring book art director. Given a Character Manifest, scene description, and global theme context, produce detailed background elements and scene-specific negatives.

CRITICAL RULES FOR BACKGROUND ELEMENTS:
1. Every item in foreground, midground, and background must be a DESCRIPTIVE PHRASE of 3–6 words — never a bare noun.
   Good: "towering pine trees with hanging moss", "cracked stone fountain with ivy", "scattered autumn leaves and acorns"
   Bad: "trees", "fountain", "leaves"
2. Each phrase must describe something VISUALLY DISTINCT and PATTERN/TEXTURE-RICH — things a child would enjoy coloring.
3. Produce 5–7 items per layer (foreground, midground, background).
4. All elements must be strictly consistent with the theme and scene — no generic filler.
5. sceneSpecificNegatives: 3–6 items describing things to exclude from this specific scene.

COLOR RULE — CRITICAL: These descriptions will be used in BLACK AND WHITE LINE ART prompts. Describe shapes, patterns, and textures ONLY — never mention colors. Write "striped candy canes" not "red-and-white candy canes". Write "spiral-patterned lollipops" not "colorful lollipops". Write "dotted gumdrop path" not "rainbow gumdrop path".

Output ONLY valid JSON matching the schema.`;

export async function generatePageContext(
  manifest: CharacterManifest,
  scene: string,
  globalContext: GlobalThemeContext,
  priceTier: PriceTier,
): Promise<PageContext> {
  const model = getModel("low", priceTier);
  const prompt = `Theme: ${manifest.theme}
Global hints: ${globalContext.defaultBackgroundHints.join(", ")}
Scene: ${scene}

Produce backgroundElements (foreground, midground, background — 5–7 descriptive phrases each) and sceneSpecificNegatives for this scene.`;
  const { object } = await generateObject({
    model,
    schema: PageContextSchema,
    system: PAGE_CONTEXT_SYSTEM,
    prompt,
  });
  return object;
}

/**
 * Generate page contexts for multiple scenes in one batch to reduce LLM calls.
 * Returns an array of PageContext in the same order as the scenes array.
 */
export async function generatePageContextsBatch(
  manifest: CharacterManifest,
  scenes: string[],
  globalContext: GlobalThemeContext,
  priceTier: PriceTier,
): Promise<PageContext[]> {
  if (scenes.length === 0) return [];
  const model = getModel("low", priceTier);
  const BatchPageContextsSchema = z.object({
    pages: z.array(PageContextSchema).length(scenes.length),
  });
  const sceneList = scenes
    .map((s, i) => `Scene ${i + 1}: ${s}`)
    .join("\n\n");
  const prompt = `Theme: ${manifest.theme}
Global hints: ${globalContext.defaultBackgroundHints.join(", ")}

Scenes:
${sceneList}

For each scene, produce backgroundElements (foreground, midground, background — 5–7 descriptive phrases each, NOT bare nouns) and sceneSpecificNegatives. Output a "pages" array with one object per scene in order.`;
  const { object } = await generateObject({
    model,
    schema: BatchPageContextsSchema,
    system: PAGE_CONTEXT_SYSTEM,
    prompt,
  });
  return object.pages;
}
