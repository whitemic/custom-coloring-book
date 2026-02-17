"use server";

import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe/client";
import { insertOrder, getOrder, updateOrderPreview, updateOrderPreviews, selectOrderPreview } from "@/lib/supabase/queries";
import { runReplicatePrediction } from "@/lib/ai/client";
import { composePreviewPrompt } from "@/lib/ai/generate-pages";

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Price in cents: Standard $12, Premium $25 */
const STANDARD_CENTS = 1200;
const PREMIUM_CENTS = 2500;

export type PreviewOption = { imageUrl: string; seed: number };

/**
 * Generate 3 Flux preview images for the character, create an order, store all 3 on it.
 * User picks one later via selectPreview; that choice is stored as preview_image_url/preview_seed.
 */
export async function generatePreview(formData: FormData): Promise<{
  orderId: string;
  previews: PreviewOption[];
  characterName: string;
  description: string;
  theme: string;
}> {
  const description = (formData.get("description") as string)?.trim() ?? "";
  const characterName = (formData.get("characterName") as string)?.trim() ?? "";
  const theme = (formData.get("theme") as string)?.trim() ?? "";

  if (!description) {
    throw new Error("Please describe your main character.");
  }

  const order = await insertOrder({
    userInput: {
      user_input: description,
      character_name: characterName,
      theme,
    },
    priceTier: "standard",
  });

  const prompt = composePreviewPrompt(description, characterName || undefined, theme || undefined);
  const previews: PreviewOption[] = [];

  for (let i = 0; i < 3; i++) {
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const { imageUrl } = await runReplicatePrediction(prompt, seed);
    previews.push({ imageUrl, seed });
  }

  await updateOrderPreviews(order.id, previews);

  return { orderId: order.id, previews, characterName, description, theme };
}

/**
 * Set the chosen preview (by index) as the order's preview for the pipeline.
 */
export async function selectPreview(orderId: string, index: number): Promise<void> {
  await selectOrderPreview(orderId, index);
}

/**
 * Load preview state for an order (e.g. after user cancels Stripe and we show preview again).
 */
export async function getOrderPreviewForReturn(orderId: string): Promise<{
  orderId: string;
  previews: PreviewOption[];
  selectedImageUrl: string | null;
  selectedSeed: number | null;
  characterName: string;
  description: string;
  theme: string;
} | null> {
  try {
    const order = await getOrder(orderId);
    if (order.status !== "pending_payment") return null;

  const userInput = order.user_input as { user_input?: string; character_name?: string; theme?: string } | null;
  const previews = (order.previews as PreviewOption[] | null) ?? [];
  if (previews.length === 0 && order.preview_image_url && order.preview_seed != null) {
    previews.push({ imageUrl: order.preview_image_url, seed: order.preview_seed });
  }

    return {
      orderId: order.id,
      previews,
      selectedImageUrl: order.preview_image_url ?? null,
      selectedSeed: order.preview_seed ?? null,
      characterName: userInput?.character_name ?? "",
      description: userInput?.user_input ?? "",
      theme: userInput?.theme ?? "",
    };
  } catch {
    return null;
  }
}

export async function createCheckoutSession(formData: FormData) {
  const orderId = formData.get("orderId") as string | null;
  const characterName = formData.get("characterName") as string;
  const description = formData.get("description") as string;
  const theme = formData.get("theme") as string;
  const priceTier = (formData.get("priceTier") as string) || "standard";

  const tier = priceTier === "premium" ? "premium" : "standard";
  const amountCents = tier === "premium" ? PREMIUM_CENTS : STANDARD_CENTS;

  let order;
  if (orderId?.trim()) {
    order = await getOrder(orderId.trim());
  } else {
    if (!description?.trim()) {
      throw new Error("Please describe your main character.");
    }
    order = await insertOrder({
      userInput: {
        user_input: description,
        character_name: characterName ?? "",
        theme: theme ?? "",
      },
      priceTier: tier,
    });
  }

  const userInput = order.user_input as { character_name?: string } | null;
  const displayName = characterName || userInput?.character_name || "your character";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: tier === "premium" ? "Custom Coloring Book — Premium" : "Custom Coloring Book — Standard",
            description: `A personalized coloring book featuring ${displayName}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      order_id: order.id,
      price_tier: tier,
    },
    success_url: `${getBaseUrl()}/orders/pending?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getBaseUrl()}/?canceled=1&order_id=${order.id}`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  redirect(session.url);
}
