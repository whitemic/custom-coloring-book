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
  ageRange: z.string(),
  hair: HairSchema,
  skinTone: z.string(),
  outfit: OutfitSchema,
  theme: z.string(),
  styleTags: z.array(z.string()).min(3),
  negativeTags: z.array(z.string()),
});

export type CharacterManifest = z.infer<typeof CharacterManifestSchema>;
export type Hair = z.infer<typeof HairSchema>;
export type Outfit = z.infer<typeof OutfitSchema>;
