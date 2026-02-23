import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Schema for the LLM scoring step only (no pass/fail — computed programmatically below)
const QualityScoringSchema = z.object({
  lineArtScore: z
    .number()
    .min(1)
    .max(5)
    .describe(
      "1=visible color fills present, 2=gray shading, 3=minor gray only, 4=nearly pure line art, 5=pure black outlines on white only",
    ),
  backgroundScore: z
    .number()
    .min(1)
    .max(5)
    .describe(
      "1=empty or sparse background, 5=full page rich with colorable detail",
    ),
  anatomyScore: z
    .number()
    .min(1)
    .max(5)
    .describe(
      "1=severe deformity/extra limbs/two heads, 5=correct anatomy and proportions",
    ),
  handScore: z
    .number()
    .min(1)
    .max(5)
    .describe(
      "1=hands clearly malformed (wrong finger count, fused/blob fingers, severely distorted), 3=minor hand issues, 5=hands look correct OR hands are not prominently visible in this scene",
    ),
  compositionScore: z
    .number()
    .min(1)
    .max(5)
    .describe(
      "1=uncolorable overlapping chaos or nearly blank, 5=clear coherent layout",
    ),
  feedback: z
    .string()
    .describe(
      "One specific sentence naming the single worst problem. Empty string if all dimensions look good.",
    ),
});

const QualityResultSchema = QualityScoringSchema.extend({
  pass: z.boolean(),
});

export type QualityResult = z.infer<typeof QualityResultSchema>;

const QUALITY_GATE_PROMPT = `You are a quality inspector for children's coloring book pages. Analyze the image across five dimensions and score each 1–5. Do NOT issue a pass/fail verdict — scoring only.

SCORING DIMENSIONS:

1. LINE ART PURITY (lineArtScore):
   - 5: Perfectly pure black outlines on white background only. Zero color, fill, gray, or shading anywhere.
   - 4: Nearly pure — only faint anti-aliasing or very subtle line softness. No color fills anywhere.
   - 3: Some gray tones or minor shading, but no color fills.
   - 2: Gray shading or washes present across multiple areas.
   - 1: Visible color fills, colored areas, gradients, or painted regions present anywhere in the image.

2. BACKGROUND RICHNESS (backgroundScore):
   - 5: The full page is packed with detailed, theme-appropriate, colorable elements — foreground objects, midground environment, background scenery. No large empty areas.
   - 3–4: Background present and detailed enough, though a few areas could be fuller.
   - 1–2: Background is sparse, minimal, or nearly absent. Character floats on white or near-white with little context.

3. ANATOMY (anatomyScore):
   - 5: Correct proportions, natural anatomy, no deformities.
   - 3–4: Minor issues only (slightly awkward pose, small proportion quirk).
   - 1–2: Obvious defects — extra limbs, missing limbs, two heads, fused body parts, melted face, severely distorted anatomy.

4. HAND ANATOMY (handScore):
   Look specifically at any hands, paws, or equivalent appendages in the image.
   - 5: Hands look correct with the right number of fingers, OR hands are not prominently visible / too small to judge clearly.
   - 4: Hands are visible and mostly correct — minor stiffness or very slight proportion quirk only.
   - 3: Hands have a noticeable issue — one clearly extra or missing finger, minor deformity — but not severely wrong.
   - 2: Hands are clearly malformed — obviously wrong finger count, fused fingers, or blob-like hands that would distract a child.
   - 1: Hands are severely distorted — multiple extra fingers, completely unrecognisable hand shape.
   IMPORTANT: If hands are small, far from camera, gripping an object, or simply not clearly visible, score 5. Only penalise hands that are large, prominent, and clearly wrong.

5. COMPOSITION (compositionScore):
   - 5: Clear, well-organized layout. A child can easily identify and color distinct areas.
   - 3–4: Mostly clear with minor overcrowding in one area.
   - 1–2: Severely overlapping elements that make the page uncolorable, OR nearly blank page.

For the feedback field: write one specific sentence naming the single worst problem you observed. If the image looks good across all dimensions, write an empty string.

IMPORTANT: Score strictly and honestly. A colored or shaded image must score 1–2 on lineArtScore even if the outlines are bold.`;

/**
 * Run a GPT-4o vision quality check on a generated page image using
 * the Analyze-then-Judge paradigm. Returns structured scores + pass/fail + feedback.
 *
 * Pass thresholds (programmatic — not delegated to LLM):
 *   lineArtScore >= 4  ← strict: any color fill is unacceptable for a coloring book
 *   backgroundScore >= 3
 *   anatomyScore >= 3
 *   compositionScore >= 3
 */
export async function checkPageQuality(
  imageUrl: string,
): Promise<QualityResult> {
  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: QualityScoringSchema,
      messages: [
        { role: "system", content: QUALITY_GATE_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image",
              image: new URL(imageUrl),
            },
            {
              type: "text",
              text: "Score this coloring book page across all four dimensions.",
            },
          ],
        },
      ],
    });

    // Compute pass deterministically — never trust the LLM to enforce thresholds
    const pass =
      object.lineArtScore >= 4 && // Strict: colored output is unacceptable
      object.backgroundScore >= 3 &&
      object.anatomyScore >= 3 &&
      object.compositionScore >= 3;

    // If the LLM feedback is empty but we're failing, generate a specific message
    let feedback = object.feedback;
    if (!pass && !feedback) {
      if (object.lineArtScore < 4) {
        feedback = `Line art has color fills or shading (score ${object.lineArtScore}/5) — the image must use only bold black outlines on a white background with no color or gray anywhere.`;
      } else if (object.backgroundScore < 3) {
        feedback = `Background is too sparse (score ${object.backgroundScore}/5) — fill the entire page with detailed, theme-appropriate elements.`;
      } else if (object.anatomyScore < 3) {
        feedback = `Anatomy has obvious defects (score ${object.anatomyScore}/5) — correct the character proportions and remove extra limbs or deformities.`;
      } else {
        feedback = `Composition is too cluttered or nearly blank (score ${object.compositionScore}/5) — ensure clear, colorable areas throughout.`;
      }
    }

    const result: QualityResult = { ...object, pass, feedback: pass ? "" : feedback };

    console.log(
      `Quality gate scores — lineArt:${result.lineArtScore} background:${result.backgroundScore} anatomy:${result.anatomyScore} composition:${result.compositionScore} pass:${result.pass}`,
    );
    if (!result.pass) {
      console.warn(`Quality gate FAIL: ${result.feedback}`);
    }

    return result;
  } catch (err) {
    console.warn("Quality gate check failed, defaulting to cautious pass:", err);
    return {
      lineArtScore: 4,
      backgroundScore: 3,
      anatomyScore: 3,
      compositionScore: 3,
      pass: true,
      feedback: "",
    };
  }
}
