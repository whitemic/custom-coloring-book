"use server";

import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe/client";
import { insertOrder, getOrder } from "@/lib/supabase/queries";

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Price in cents: Standard $12, Premium $25 */
const STANDARD_CENTS = 1200;
const PREMIUM_CENTS = 2500;

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
    cancel_url: `${getBaseUrl()}/?canceled=true`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  redirect(session.url);
}
