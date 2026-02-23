import { createHash } from "crypto";
import { generateObject, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
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
// Preview prompt (character-only, no manifest)
// ---------------------------------------------------------------------------

const PREVIEW_STYLE =
  "bold outlines, no shading, pure black and white line art, whimsical, detailed coloring book style";
const PREVIEW_NEGATIVES =
  "realistic, photographic, color, coloured, shading, gradient, gray, grey, greyscale, fill, filled, painted, 3D render";

/**
 * Build a Flux prompt for the pre-purchase character preview (txt2img).
 * Character-only, no scene; same line-art style as full pages.
 */
export function composePreviewPrompt(
  description: string,
  characterName?: string,
  theme?: string,
): string {
  const parts: string[] = [
    "Pure black and white line art coloring book. ONLY black lines on white background. NO color, NO shading, NO gradients, NO gray tones, NO fills. Bold clean outlines only.",
    "Include the main character. If the description mentions a pet or companion animal (e.g. dog, cat), include them together in the same image so both are visible. Any dog must have clear, correct dog anatomy: four legs, canine muzzle, dog ears (floppy or perky). Any cat must have correct cat anatomy. Do not draw a different animal or distorted anatomy.",
    "If the description mentions any props or items the character has (e.g. magnifying glass, balloon, teddy bear, wand), include them with the character so they appear in the reference.",
    `Character: ${description.trim()}.`,
  ];
  if (characterName?.trim()) {
    parts.push(`Name: ${characterName.trim()}.`);
  }
  if (theme?.trim()) {
    parts.push(`Theme hint: ${theme.trim()}.`);
  }
  parts.push(`Style: ${PREVIEW_STYLE}.`);
  parts.push(`Negative: ${PREVIEW_NEGATIVES}.`);
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Scene generation (LLM)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step 1 — Pose palette generation
//
// A dedicated LLM call generates 3 visually distinct body poses tailored
// to the character's specific anatomy. This replaces the hardcoded humanoid
// pose palette so that any character type (seahorse, dragon, living cupcake,
// human child, etc.) gets poses that actually create different silhouettes.
// ---------------------------------------------------------------------------

const PosePaletteSchema = z.object({
  poses: z
    .array(z.string().min(10))
    .length(3)
    .describe(
      "Three body pose descriptions: index 0 = arriving, 1 = doing, 2 = reacting",
    ),
});

const POSE_GENERATION_PROMPT = `You are an expert children's book illustrator specialising in dynamic character poses.

Your task: given a character's species and description, generate exactly 3 body pose descriptions for 3 coloring book pages.

NARRATIVE ARC — one pose per role:
- Pose 0 (ARRIVING): the character is in energetic motion, entering or approaching a new place with excitement
- Pose 1 (DOING): the character is actively engaged in a hands-on activity — working, building, playing, digging
- Pose 2 (REACTING): the character has a vivid emotional reaction — surprise, wonder, delight, or triumph

CRITICAL — SPECIES-AUTHENTIC SILHOUETTES:
Think carefully about what dramatic visual contrast actually looks like for THIS creature's anatomy.
Do NOT default to a humanoid vocabulary for non-human characters.

Examples of species-authentic thinking:
- Seahorse: vertical vs horizontal body axis; tail coiled tight vs stretched straight; nose pointing up vs down
- Fish/aquatic: darting forward horizontally; curling into a tight C-shape; floating upright at the surface
- Bird/winged: wings fully spread soaring; wings folded tight while perching; one wing fanned out to balance
- Dragon: low body coiled around something; neck stretched long peering forward; rearing up with wings open
- Quadruped (dog, cat): body flat and low stalking; full gallop with body extended; sitting upright attentive
- Human/humanoid: sprinting; crouching; leaping; reaching overhead; stumbling backward
- Object/food character (living cupcake, toy): tilted forward eagerly; rocking back on its base; spinning

REQUIREMENTS:
1. All 3 poses must create CLEARLY DIFFERENT SILHOUETTES — an illustrator must tell them apart at a glance
2. Each pose is 1–2 sentences describing OVERALL BODY SHAPE and MOVEMENT ENERGY
3. NEVER describe specific joint angles, exact limb positions, or anatomical measurements
4. All poses must be joyful and child-friendly
5. Poses must be physically plausible for this specific species

OUTPUT: Return exactly 3 pose strings.`;

/**
 * Generate 3 species-authentic, visually distinct body pose descriptions
 * via LLM. Poses are tailored to the character's actual anatomy so that
 * non-humanoid characters get vocabulary that creates real visual variety.
 */
export async function generatePosePalette(
  manifest: CharacterManifest,
  priceTier: PriceTier,
): Promise<[string, string, string]> {
  const species =
    manifest.species ??
    (manifest.characterType === "human" ? "human child" : manifest.characterType);

  let charSummary = `Name: ${manifest.characterName}\nSpecies / type: ${species}\n`;
  if (manifest.physicalDescription) {
    charSummary += `Physical description: ${manifest.physicalDescription}\n`;
  }
  if (manifest.characterKeyFeatures && manifest.characterKeyFeatures.length > 0) {
    charSummary += `Key features: ${manifest.characterKeyFeatures.join(", ")}\n`;
  }
  if (manifest.characterType === "human") {
    if (manifest.ageRange) charSummary += `Age: ${manifest.ageRange}\n`;
    if (manifest.hair) {
      charSummary += `Hair: ${manifest.hair.texture} ${manifest.hair.color} ${manifest.hair.style}\n`;
    }
  }

  const model = getModel("low", priceTier);
  const { object } = await generateObject({
    model,
    schema: PosePaletteSchema,
    system: POSE_GENERATION_PROMPT,
    prompt: `Character:\n${charSummary}\nGenerate 3 body poses with maximum visual contrast for this specific character type.`,
  });

  return object.poses as [string, string, string];
}

// ---------------------------------------------------------------------------
// Step 2 — Scene description generation
//
// The generated poses are injected directly into the scene system prompt so
// the LLM uses species-appropriate language rather than the hardcoded palette.
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

function buildSceneSystemPrompt(poses: [string, string, string]): string {
  return `You are a children's coloring book story designer and illustrator. Given a Character Manifest, generate exactly 3 scene descriptions for a coloring book — one per page.

CRITICAL CHARACTER RULE: The same character appears in all 3 scenes — same species, same face, same outfit — but in a COMPLETELY DIFFERENT BODY POSE and doing a COMPLETELY DIFFERENT ACTIVITY each time.

LANGUAGE RULE: These scenes will be rendered as BLACK AND WHITE LINE ART. Describe shapes, structures, and textures — not colors. Write "striped candy canes" not "red-and-white candy canes". Write "patterned gumdrops" not "colorful gumdrops". Write "fluffy clouds" not "pink clouds". Never use color adjectives.

SAFETY RULE — POSE LANGUAGE: Describe poses using OVERALL BODY ENERGY and MOVEMENT, not precise joint or limb positions. NEVER use phrases like "foot lifted", "mid-stride", "legs tucked", "shin exposed", "knee raised", or specific joint angles — these phrases cause technical failures in the rendering system.

EACH SCENE DESCRIPTION MUST INCLUDE ALL OF THE FOLLOWING:
1. COMPOSITION — one of: "establishing shot" / "medium action shot" / "close-up detail shot". Use each once across the 3 scenes.
2. BODY POSE — use EXACTLY the pose specified for each scene below. Do not substitute or invent a different pose:
   - Scene 1 (arriving): ${poses[0]}
   - Scene 2 (doing): ${poses[1]}
   - Scene 3 (reacting): ${poses[2]}
3. ACTIVITY — a specific, vivid action the character is doing RIGHT NOW. Each scene must use a different verb of action. Never repeat an activity.
4. LOCATION — a specific, distinct setting described in terms of shapes and structures (not colors).
5. BACKGROUND DEPTH — explicitly name what fills the foreground, midground, AND background using shape/texture language.

SCENE NARRATIVE ARC:
- Scene 1 (establishing shot): Character ARRIVES at the adventure — in motion, entering a new world. Energy and movement in the pose.
- Scene 2 (medium action shot): Character is DOING the main activity — actively engaged, body working or playing.
- Scene 3 (close-up detail shot): Character has a REACTION MOMENT — surprise, wonder, joy, or satisfaction. Expressive face, expressive pose.

POSE RULE — NON-NEGOTIABLE: An illustrator looking at the 3 descriptions must immediately see three completely different body positions.

LOCATION RULE: Each scene must be in a clearly different setting. Do not repeat locations.

Keep all scenes child-friendly and joyful. Never change the character's type or species.

OUTPUT: Return exactly 3 scene objects in the provided JSON schema.`;
}

/**
 * Generate 3 unique scene descriptions for a coloring book based on the manifest.
 * First generates species-appropriate poses via LLM, then injects them into
 * the scene prompt so the resulting descriptions use anatomy-authentic language.
 */
export async function generateSceneDescriptions(
  manifest: CharacterManifest,
  priceTier: PriceTier,
): Promise<string[]> {
  // Step 1: generate species-authentic poses via LLM
  const poses = await generatePosePalette(manifest, priceTier);

  // Step 2: build character description for the scene generation prompt
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

  const model = getModel("low", priceTier);
  const { object } = await generateObject({
    model,
    schema: ScenesSchema,
    system: buildSceneSystemPrompt(poses),
    prompt: `Character Manifest:\n\n${characterDesc}`,
  });

  return object.scenes
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((s) => s.description);
}

// ---------------------------------------------------------------------------
// Style anchor — professional coloring book aesthetic
// ---------------------------------------------------------------------------

// Style anchor and line art mandate are written as natural art-direction prose.
// Flux Kontext Pro responds to descriptive briefs, not imperative commands.
// Aggressive "CONVERT / STRIP / REMOVE ALL" language looks like prompt injection
// to the safety filter — use calm, professional illustrator language instead.

const STYLE_ANCHOR =
  "A page from a children's coloring book, illustrated in bold pen-and-ink style. " +
  "The artwork uses only black ink lines on a white background — no shading, no gray tones, no color fills of any kind. " +
  "Every shape is outlined with a clean contour line so a child can color the page with crayons.";

const LINE_ART_MANDATE =
  "Illustration style: black ink outlines on white paper only. " +
  "The image should look like a printed coloring book page — clean black lines, white background, nothing colored in.";

// ---------------------------------------------------------------------------
// Background narrativizer
// ---------------------------------------------------------------------------

/**
 * Converts structured background element arrays into flowing narrative prose.
 * Flux.1 responds much better to descriptive sentences than comma-separated nouns.
 */
function narrativizeBackground(context: PageContext): string {
  const { foreground, midground, background } = context.backgroundElements;

  const parts: string[] = [];

  if (foreground.length > 0) {
    parts.push(`In the foreground: ${foreground.join(", ")}.`);
  }
  if (midground.length > 0) {
    parts.push(`The middle ground features ${midground.join(", ")}.`);
  }
  if (background.length > 0) {
    parts.push(`Behind everything: ${background.join(", ")}.`);
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Anatomy constraint (prose — NOT an SD-style negative prompt list)
// Flux Kontext Pro is a prose-instruction model; negative prompt lists
// are a Stable Diffusion concept and do not work here. Keep constraints
// brief and expressed as natural sentences.
// ---------------------------------------------------------------------------

const ANATOMY_CONSTRAINT =
  "The character has correct anatomy: one head, one body, the right number of limbs for their species.";

// ---------------------------------------------------------------------------
// Kontext page prompt (narrative style)
// ---------------------------------------------------------------------------

/**
 * Compose the Flux Kontext prompt for a single coloring book page.
 *
 * Uses natural, paragraph-style language — Flux.1 responds far better to
 * flowing descriptive prose than keyword/tag lists. Includes a professional
 * style anchor to prevent generic "AI stylization" drift.
 */
export function composeKontextPagePrompt(
  manifest: CharacterManifest,
  scene: string,
  pageContext: PageContext,
): string {
  const backgroundNarrative = narrativizeBackground(pageContext);

  // Extract the sentence describing the character's specific action from the scene.
  // Scene descriptions follow the pattern:
  //   "Composition of [setting]. [CharName] is [action+pose]. [Background details]."
  // We want the action sentence front-loaded so Flux's attention mechanism gives
  // it maximum weight — overriding the reference image's neutral/standing pose.
  const charNameLower = manifest.characterName.toLowerCase();
  const sceneSentences = scene
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  const actionSentence =
    sceneSentences.find((s) => s.toLowerCase().includes(charNameLower)) ??
    sceneSentences[1] ??
    "";

  // --- Line art mandate FIRST — Flux front-weights attention ---
  // This must appear before everything else to override the colored reference image signal.
  const parts: string[] = [LINE_ART_MANDATE];

  // --- Pose override SECOND — front-loaded so Flux prioritises it over the reference pose.
  // Kontext Pro anchors heavily to the reference image; without an early explicit override
  // the model tends to reproduce the reference's neutral pose on every page.
  // We tell it: reference = face + costume only; body pose must be redrawn.
  if (actionSentence) {
    parts.push(
      `BODY POSE FOR THIS PAGE: ${actionSentence.trim()} ` +
        `The reference image supplies the character's face and costume details ONLY — ` +
        `the body must be completely redrawn to show this action.`,
    );
  }

  // --- Style anchor (locks aesthetic, prevents AI drift) ---
  parts.push(STYLE_ANCHOR);

  // --- Theme ---
  parts.push(`Theme: ${manifest.theme}.`);

  // --- Scene + background as a unified narrative paragraph ---
  parts.push(
    `Scene: ${scene} ${backgroundNarrative} The entire page — background, midground, and foreground — must be filled with detailed, theme-appropriate line-drawn elements that invite coloring. No area should be left empty or white.`,
  );

  // --- Character anchor (compact prose, not a keyword list) ---
  const charName = manifest.characterName;
  const keyFeatures =
    manifest.characterKeyFeatures && manifest.characterKeyFeatures.length > 0
      ? manifest.characterKeyFeatures.join(", ")
      : null;
  const props =
    manifest.characterProps && manifest.characterProps.length > 0
      ? manifest.characterProps.join(", ")
      : null;

  let characterBlock: string;
  // Explicitly separates what the reference provides (face/costume) from what must
  // be generated new (the body pose for this scene's action).
  const poseNote =
    `Copy ${charName}'s face and costume from the reference image. ` +
    `The body position is completely redrawn to show the action above — ` +
    `do not replicate the neutral or standing pose from the reference.`;

  if (manifest.characterType === "human") {
    const hairDesc = manifest.hair
      ? `${manifest.hair.texture} ${manifest.hair.color} ${manifest.hair.style} hair`
      : null;
    const outfitDesc = manifest.outfit
      ? [manifest.outfit.top, manifest.outfit.bottom, manifest.outfit.shoes]
          .filter(Boolean)
          .join(", ")
      : null;
    const parts2 = [
      manifest.ageRange ? `a ${manifest.ageRange}-year-old` : "a child",
      hairDesc,
      outfitDesc ? `wearing ${outfitDesc}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    characterBlock = `The character is ${charName} — ${parts2}. one head, one body. ${poseNote}`;
  } else {
    const species = manifest.species || manifest.characterType;
    characterBlock = `The character is ${charName}, a ${species}${manifest.physicalDescription ? ` — ${manifest.physicalDescription}` : ""}. one head, one body, correct ${species} anatomy. ${poseNote}`;
  }
  parts.push(characterBlock);

  // --- Key features and props ---
  if (keyFeatures || props) {
    const elements = [keyFeatures, props].filter(Boolean).join("; props: ");
    parts.push(
      `Key visual elements that must appear: ${elements}.`,
    );
  }

  // --- Anatomy constraint (prose — no SD-style negative list) ---
  parts.push(ANATOMY_CONSTRAINT);

  // Animal-specific anatomy reminders
  const allFeatures = [
    ...(manifest.characterKeyFeatures ?? []),
    ...(manifest.characterProps ?? []),
  ];
  const hasDog = allFeatures.some((f) => f.toLowerCase().includes("dog"));
  const hasCat = allFeatures.some((f) => f.toLowerCase().includes("cat"));
  if (hasDog) {
    parts.push(
      "Any dog must have correct canine anatomy: four legs, canine muzzle, dog ears.",
    );
  }
  if (hasCat) {
    parts.push(
      "Any cat must have correct feline anatomy: four legs, feline face, cat ears.",
    );
  }

  // --- Closing style reinforcement ---
  parts.push(
    "The finished illustration should look like a coloring book page fresh from the printer — bold black outlines, white background, ready for a child to color.",
  );

  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Prompt refiner (Critic → Refiner loop)
// ---------------------------------------------------------------------------

/**
 * Given a prompt that failed quality review and the critic's specific feedback,
 * produces a refined prompt that addresses the identified issue while preserving
 * all other content (character, scene, style, negatives).
 *
 * Uses gpt-4o-mini (cheap, text-only) for fast turnaround.
 */
export async function refinePromptFromFeedback(
  originalPrompt: string,
  feedback: string,
): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: `You are a Flux.1 prompt engineer specializing in children's coloring book pages.
A generated image failed quality review. Your job: rewrite the prompt to fix the specific failure while preserving everything else — the character description, scene, theme, style anchor, and negatives.

RULES:
- Fix ONLY what the feedback identifies. Do not remove content that is working.
- If feedback is about an empty background: strengthen the background description with more specific, detailed elements.
- If feedback is about color/fill violations: add stronger, more explicit line art mandates.
- If feedback is about anatomy: add clearer anatomical constraints and reinforce the reference image anchor.
- If feedback is about composition: adjust the scene description to improve clarity and balance.
- Keep the prompt roughly the same length. Return ONLY the revised prompt text, no explanation.`,
    prompt: `ORIGINAL PROMPT:\n${originalPrompt}\n\nCRITIC FEEDBACK:\n${feedback}\n\nRevised prompt:`,
  });

  return text.trim();
}
