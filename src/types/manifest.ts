import { z } from "zod";

export const HairSchema = z.object({
  style: z.string().describe("e.g. pigtails, bob, ponytail, afro"),
  color: z.string().describe("e.g. auburn red, jet black"),
  length: z.enum(["short", "medium", "long"]),
  texture: z.enum(["straight", "wavy", "curly", "coily"]),
});

export const OutfitSchema = z.object({
  top: z.string().describe("e.g. striped t-shirt, overalls"),
  bottom: z.string().describe("e.g. denim shorts, tutu"),
  shoes: z.string().describe("e.g. rain boots, sneakers"),
  accessories: z
    .array(z.string())
    .describe('e.g. ["crown","backpack"]'),
});

export const CharacterManifestSchema = z.object({
  characterName: z.string(),
  characterType: z
    .enum(["human", "animal", "fantasy", "other"])
    .describe("The type of character: human, animal, fantasy creature, or other"),
  species: z
    .string()
    .nullable()
    .describe("Specific species if non-human (e.g. 'frog', 'dragon', 'cat'), or null if not applicable"),
  physicalDescription: z
    .string()
    .nullable()
    .describe("Detailed physical description for non-human characters (key features, body shape, distinctive markings), or null if not applicable"),
  ageRange: z
    .string()
    .nullable()
    .describe("Age range for human characters (e.g. '5-7', '4-6'), or null if not applicable"),
  hair: HairSchema.nullable().describe("Hair details for human characters, or null if not applicable"),
  skinTone: z.string().nullable().describe("Skin tone for human characters, or null if not applicable"),
  outfit: OutfitSchema.nullable().describe("Outfit details for human characters, or null if not applicable"),
  characterKeyFeatures: z
    .array(z.string())
    .describe("Distinct visual features that must appear consistently across all pages (e.g. 'top hat', 'groovy pattern', 'large eyes', 'striped shirt')"),
  characterProps: z
    .array(z.string())
    .describe(
      "Props or items the character carries, holds, or is associated with (e.g. 'magnifying glass', 'red balloon', 'teddy bear', 'wizard wand'). These appear with the character on every page for consistency. Use an empty array [] if none are mentioned.",
    ),
  theme: z
    .string()
    .describe(
      "The book's theme/setting from the user (e.g. 'space explorer visiting different planets'). Must match user's chosen theme when provided; drives scenes and backgrounds.",
    ),
  styleTags: z.array(z.string()).min(3),
  negativeTags: z.array(z.string()),
});

export type CharacterManifest = z.infer<typeof CharacterManifestSchema>;
export type Hair = z.infer<typeof HairSchema>;
export type Outfit = z.infer<typeof OutfitSchema>;
