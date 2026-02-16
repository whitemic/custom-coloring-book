"use server";

import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe/client";
import { headers } from "next/headers";

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function createCheckoutSession(formData: FormData) {
  const characterName = formData.get("characterName") as string;
  const description = formData.get("description") as string;
  const theme = formData.get("theme") as string;

  if (!description?.trim()) {
    throw new Error("Please describe your main character.");
  }

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: 999,
          product_data: {
            name: "Custom Coloring Book",
            description: `A personalized 20-page coloring book featuring ${characterName || "your character"}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_input: description,
      character_name: characterName || "",
      theme: theme || "",
    },
    success_url: `${getBaseUrl()}/orders?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getBaseUrl()}/?canceled=true`,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  redirect(session.url);
}
