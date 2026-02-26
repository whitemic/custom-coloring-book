"use server";

import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe/client";
import { insertOrder, getOrder, updateOrderPreview, updateOrderPreviews, selectOrderPreview, updateOrderLibraryOptIn, debitUserCredits, resetPageForRegen, getPagesByOrderId } from "@/lib/supabase/queries";
import { inngest } from "@/lib/inngest/client";
import { runReplicatePrediction } from "@/lib/ai/client";
import { composePreviewPrompt } from "@/lib/ai/generate-pages";
import { persistImageToStorage } from "@/lib/utils/images";

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Price in cents: $12 */
const PRICE_CENTS = 1200;

export type PreviewOption = { imageUrl: string; seed: number };

/**
 * Create an order for preview generation and return the orderId immediately.
 * This allows the client to start polling for progress while previews are generated.
 */
export async function createOrderForPreview(formData: FormData): Promise<{
  orderId: string;
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

  return { orderId: order.id, characterName, description, theme };
}

/**
 * Generate 3 Flux preview images for an existing order, store all 3 on it.
 * User picks one later via selectPreview; that choice is stored as preview_image_url/preview_seed.
 */
export async function generatePreviewsForOrder(orderId: string): Promise<{
  previews: PreviewOption[];
}> {
  const order = await getOrder(orderId);
  const userInput = order.user_input as {
    user_input?: string;
    character_name?: string;
    theme?: string;
  } | null;

  if (!userInput?.user_input) {
    throw new Error("Order not found or missing description.");
  }

  const prompt = composePreviewPrompt(
    userInput.user_input,
    userInput.character_name || undefined,
    userInput.theme || undefined
  );
  const previews: PreviewOption[] = [];

  for (let i = 0; i < 3; i++) {
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const { imageUrl: replicateUrl } = await runReplicatePrediction(prompt, seed);
    // Persist immediately to Supabase Storage — Replicate CDN URLs expire in ~24h.
    const imageUrl = await persistImageToStorage(replicateUrl, order.id, `preview-${i}`);
    previews.push({ imageUrl, seed });
    // Update previews incrementally so client can track progress
    await updateOrderPreviews(orderId, previews);
  }

  return { previews };
}

/**
 * Generate 3 Flux preview images for the character, create an order, store all 3 on it.
 * User picks one later via selectPreview; that choice is stored as preview_image_url/preview_seed.
 * This is a convenience function that combines createOrderForPreview and generatePreviewsForOrder.
 */
export async function generatePreview(formData: FormData): Promise<{
  orderId: string;
  previews: PreviewOption[];
  characterName: string;
  description: string;
  theme: string;
}> {
  const orderData = await createOrderForPreview(formData);
  const { previews } = await generatePreviewsForOrder(orderData.orderId);

  const order = await getOrder(orderData.orderId);
  const userInput = order.user_input as {
    user_input?: string;
    character_name?: string;
    theme?: string;
  } | null;

  return {
    orderId: orderData.orderId,
    previews,
    characterName: orderData.characterName,
    description: orderData.description,
    theme: orderData.theme,
  };
}

/**
 * Set the chosen preview (by index) as the order's preview for the pipeline.
 */
export async function selectPreview(orderId: string, index: number): Promise<void> {
  await selectOrderPreview(orderId, index);
}

/**
 * Get preview generation progress for an order.
 * Returns the number of previews that have been generated so far (0-3).
 */
export async function getPreviewProgress(orderId: string): Promise<{
  completed: number;
  total: number;
  previews: PreviewOption[];
}> {
  try {
    const order = await getOrder(orderId);
    const previews = (order.previews as PreviewOption[] | null) ?? [];
    return {
      completed: previews.length,
      total: 3,
      previews,
    };
  } catch {
    return { completed: 0, total: 3, previews: [] };
  }
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
  const libraryOptIn = formData.get("libraryOptIn") === "true";

  let order;
  if (orderId?.trim()) {
    order = await getOrder(orderId.trim());
    if (!order.preview_image_url) {
      throw new Error(
        "Please select a character preview before checkout. Book generation requires your chosen character image.",
      );
    }
    // Persist the library opt-in choice before redirecting to Stripe
    if (libraryOptIn !== order.library_opt_in) {
      await updateOrderLibraryOptIn(orderId.trim(), libraryOptIn);
    }
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
      priceTier: "standard",
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
          unit_amount: PRICE_CENTS,
          product_data: {
            name: "Custom Coloring Book",
            description: `A personalized 20-page coloring book featuring ${displayName}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      order_id: order.id,
      price_tier: "standard",
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

/**
 * Spend 1 credit to regenerate a single completed page.
 *
 * Guards:
 * - Page must belong to the given order
 * - Page must currently be "complete" (not mid-generation)
 * - Order must have a customer email (set after payment)
 * - Buyer must have ≥ 1 credit
 */
export async function regeneratePage(
  pageId: string,
  orderId: string,
): Promise<void> {
  const order = await getOrder(orderId);

  const email = order.stripe_customer_email;
  if (!email) {
    throw new Error("Order email not found. Cannot verify credit balance.");
  }

  const pages = await getPagesByOrderId(orderId);
  const page = pages.find((p) => p.id === pageId);
  if (!page) {
    throw new Error("Page not found on this order.");
  }
  if (page.status !== "complete") {
    throw new Error("This page is already being regenerated.");
  }

  const debitResult = await debitUserCredits(
    email,
    1,
    `1 credit spent to regenerate page ${page.page_number} on order ${orderId}`,
  );
  if (!debitResult.success) {
    throw new Error(debitResult.error);
  }

  await resetPageForRegen(pageId);

  await inngest.send({
    name: "page/regenerate",
    data: { pageId, orderId, email },
  });
}
