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
      "Theme-appropriate background element hints (e.g. lily pads, stars, trees)",
    ),
  defaultNegatives: z
    .array(z.string())
    .describe("Theme/character-appropriate default negative prompts"),
});

export type GlobalThemeContext = z.infer<typeof GlobalThemeContextSchema>;

const GLOBAL_CONTEXT_SYSTEM = `You are a children's coloring book art director. Given a Character Manifest, output a brief global theme context that will be reused across all pages of the book.
Output themeDescription (one sentence), defaultBackgroundHints (array of theme-appropriate background elements, e.g. lily pads, stars, vines), and defaultNegatives (array of negative prompts to avoid, e.g. wrong species, realistic). Keep arrays concise (5-10 items each).`;

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
  foreground: z.array(z.string()).describe("Foreground decorative elements"),
  midground: z.array(z.string()).describe("Midground environmental details"),
  background: z.array(z.string()).describe("Background patterns and textures"),
});

const PageContextSchema = z.object({
  backgroundElements: BackgroundElementsSchema,
  sceneSpecificNegatives: z.array(z.string()),
});

export type PageContext = z.infer<typeof PageContextSchema>;

const PAGE_CONTEXT_SYSTEM = `You are a children's coloring book art director. Given a Character Manifest, a scene description, and the global theme context, output:
1. backgroundElements: foreground (array of strings), midground (array), background (array). Each array should have 3-6 items. Elements must be theme-appropriate and suitable for black-and-white line art coloring pages.
2. sceneSpecificNegatives: array of negative prompts specific to this scene (e.g. things to avoid in this setting). Include 3-8 items.
Use the global context's defaultBackgroundHints to inspire background elements. Output ONLY valid JSON matching the schema.`;

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

Produce backgroundElements (foreground, midground, background) and sceneSpecificNegatives for this scene.`;
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

For each scene, produce backgroundElements (foreground, midground, background) and sceneSpecificNegatives. Output a "pages" array with one object per scene in order.`;
  const { object } = await generateObject({
    model,
    schema: BatchPageContextsSchema,
    system: PAGE_CONTEXT_SYSTEM,
    prompt,
  });
  return object.pages;
}
