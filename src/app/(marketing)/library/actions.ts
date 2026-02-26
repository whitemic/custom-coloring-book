"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getStripe } from "@/lib/stripe/client";
import {
  createLibraryPurchase,
  updateLibraryPurchaseSession,
  debitUserCredits,
  getUserCredits,
  createPendingCreditPurchase,
  linkPendingCreditPurchaseSession,
} from "@/lib/supabase/queries";
import { inngest } from "@/lib/inngest/client";
import { calcLibraryPriceCents } from "@/lib/utils/library";
import { Resend } from "resend";
import {
  canSendOtp,
  generateOtp,
  verifyOtp,
  markEmailVerified,
  isEmailVerified,
} from "@/lib/otp";

// ---------------------------------------------------------------------------
// OTP / email-verification server actions
// ---------------------------------------------------------------------------

/**
 * Send a 6-digit OTP to the given email address.
 * Rate limited to 1 send per email per minute.
 */
export async function sendEmailOtp(
  email: string,
): Promise<{ sent: true } | { error: string }> {
  if (!email?.trim() || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  const allowed = await canSendOtp(email.trim());
  if (!allowed) {
    return { error: "Please wait before requesting another code." };
  }

  const code = await generateOtp(email.trim());

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Storybook Dreams <noreply@storybookdreams.com>",
      to: email.trim(),
      subject: "Your Storybook Dreams verification code",
      text: `Your Storybook Dreams verification code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can safely ignore it.`,
    });
  } catch (err) {
    // If Resend is not configured (e.g. local dev without RESEND_API_KEY),
    // the code has already been printed to console by generateOtp's dev fallback,
    // so we swallow the error and continue.
    if (process.env.RESEND_API_KEY) {
      console.error("[sendEmailOtp] Failed to send email:", err);
      return { error: "Failed to send verification email. Please try again." };
    }
  }

  return { sent: true };
}

/**
 * Verify a 6-digit OTP for the given email. On success, marks the email as
 * verified in Redis for 30 minutes.
 */
export async function verifyEmailOtp(
  email: string,
  code: string,
): Promise<{ verified: true } | { error: string }> {
  if (!email?.trim() || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }
  if (!code?.trim()) {
    return { error: "Please enter the verification code." };
  }

  const valid = await verifyOtp(email.trim(), code.trim());
  if (!valid) {
    return { error: "Invalid or expired code. Please try again." };
  }

  await markEmailVerified(email.trim());

  // Persist the verified email in an HTTP-only cookie so the marketing page
  // can fetch and display a real credit balance without a separate OTP step.
  const cookieStore = await cookies();
  cookieStore.set("verified_email", email.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30, // 30 minutes — matches Redis verified TTL
    sameSite: "lax",
    path: "/",
  });

  return { verified: true };
}

// ---------------------------------------------------------------------------

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Create a Stripe checkout session for a library mix-and-match purchase.
 * Called from the /library/checkout page.
 */
export async function createLibraryCheckout(
  selectedPageIds: string[],
  email: string,
): Promise<void> {
  if (selectedPageIds.length === 0) {
    throw new Error("No pages selected.");
  }
  if (!email?.trim()) {
    throw new Error("Email is required to receive your download.");
  }

  const amountCents = calcLibraryPriceCents(selectedPageIds.length);

  // Create the purchase record first so we have an ID for metadata
  const purchase = await createLibraryPurchase({
    selectedPageIds,
    amountCents,
    stripeCustomerEmail: email.trim(),
    status: "pending_payment",
  });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: email.trim(),
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name:
              selectedPageIds.length <= 10
                ? `Custom Mix — ${selectedPageIds.length} Coloring Pages`
                : `Custom Mix — ${selectedPageIds.length} Coloring Pages`,
            description: `${selectedPageIds.length} hand-picked coloring pages assembled into a custom PDF`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "library_purchase",
      purchase_id: purchase.id,
    },
    success_url: `${getBaseUrl()}/library/download/${purchase.id}`,
    cancel_url: `${getBaseUrl()}/library`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  // Link the session to the purchase
  await updateLibraryPurchaseSession(purchase.id, session.id, email.trim());

  redirect(session.url);
}

/**
 * Redeem credits for a library purchase (bypasses Stripe).
 * Immediately triggers PDF assembly.
 */
export async function redeemCreditsForLibrary(
  selectedPageIds: string[],
  email: string,
): Promise<{ purchaseId: string }> {
  if (selectedPageIds.length === 0) {
    throw new Error("No pages selected.");
  }
  if (!email?.trim()) {
    throw new Error("Email is required.");
  }

  const verified = await isEmailVerified(email.trim());
  if (!verified) {
    throw new Error("Please verify your email first.");
  }

  const pageCount = selectedPageIds.length;
  const credits = await getUserCredits(email.trim());

  if (!credits || credits.balance < pageCount) {
    throw new Error(
      `Insufficient credits: need ${pageCount}, have ${credits?.balance ?? 0}`,
    );
  }

  // Create purchase record in generating state (skip Stripe)
  const purchase = await createLibraryPurchase({
    selectedPageIds,
    creditsUsed: pageCount,
    stripeCustomerEmail: email.trim(),
    status: "generating",
  });

  // Debit credits atomically (pessimistic lock in Postgres prevents double-spend)
  const debitResult = await debitUserCredits(email.trim(), pageCount, `Spent ${pageCount} credits for library purchase ${purchase.id}`);
  if (!debitResult.success) {
    throw new Error(debitResult.error);
  }

  // Trigger PDF assembly directly
  await inngest.send({
    name: "library/book.assemble",
    data: { purchaseId: purchase.id },
  });

  return { purchaseId: purchase.id };
}

/**
 * Look up a user's current credit balance.
 * Requires the email to have been verified via OTP first.
 */
export async function fetchCreditBalance(
  email: string,
): Promise<number> {
  if (!email?.trim()) return 0;
  const verified = await isEmailVerified(email.trim());
  if (!verified) return 0;
  const credits = await getUserCredits(email.trim());
  return credits?.balance ?? 0;
}

/**
 * Create a Stripe checkout session to purchase a credit pack.
 *
 * Security: email and credits are written to pending_credit_purchases before the
 * Stripe session is created. Only the DB record UUID is stored in session metadata
 * so the webhook looks up authoritative values from the DB, never from metadata.
 */
export async function createCreditPurchaseSession(
  email: string,
  credits: number,
  amountCents: number,
): Promise<void> {
  if (!email?.trim()) {
    throw new Error("Email is required.");
  }

  // Derive a human-readable pack identifier for auditing (not used as a Stripe Price ID).
  const stripePriceId = `pack_${credits}`;

  // 1. Write purchase intent to DB first — this is the authoritative source for
  //    email and credit amount. The webhook will read from here, not from metadata.
  const pending = await createPendingCreditPurchase({
    email: email.trim(),
    credits,
    stripePriceId,
  });

  // 2. Create the Stripe session with only the DB record UUID in metadata.
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: email.trim(),
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `${credits} Storybook Credits`,
            description: `Spend credits to download pages from the Character Library`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "credit_purchase",
      pending_id: pending.id,   // UUID reference only — no amounts or emails
    },
    success_url: `${getBaseUrl()}/library?credits_purchased=true`,
    cancel_url: `${getBaseUrl()}/library/credits`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Failed to create credit purchase session");
  }

  // 3. Link the Stripe session ID back to the pending record for cross-reference.
  await linkPendingCreditPurchaseSession(pending.id, session.id);

  redirect(session.url);
}
