"use server";

import { createAuthClient } from "@/lib/supabase/auth-server";
import { getOrderBySessionId } from "@/lib/supabase/queries";
import { verificationLimiter } from "@/lib/rate-limit";
import type { OrderStatus } from "@/types/database";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  createdAt: string;
  amountCents: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Session-based order lookup (for returning users with a valid cookie)
// ---------------------------------------------------------------------------

/**
 * Check for an existing Supabase Auth session and, if present, return the
 * user's orders. Uses the cookie-aware auth client so RLS enforces that
 * only orders matching the session email are returned.
 */
export async function getSessionOrders(): Promise<{
  orders: OrderSummary[];
  email: string | null;
}> {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return { orders: [], email: null };
    }

    const { data, error } = await supabase
      .from("orders")
      .select("id, status, created_at, amount_cents, currency")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const orders: OrderSummary[] = (data ?? []).map((r) => ({
      id: r.id as string,
      status: r.status as OrderStatus,
      createdAt: r.created_at as string,
      amountCents: r.amount_cents as number,
      currency: r.currency as string,
    }));

    return { orders, email: user.email };
  } catch {
    return { orders: [], email: null };
  }
}

// ---------------------------------------------------------------------------
// Step 1: Send verification code
// ---------------------------------------------------------------------------

/**
 * Send a magic link + 6-digit OTP to the given email via Supabase Auth.
 * Supabase handles generation, hashing, rate limiting, and email delivery.
 */
export async function sendVerificationCode(
  email: string,
): Promise<{ success: boolean; error: string | null }> {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { success: false, error: "Please enter an email address." };
  }

  try {
    const supabase = await createAuthClient();

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback?next=/orders",
        shouldCreateUser: true,
      },
    });

    if (error) {
      if (error.status === 429) {
        return {
          success: false,
          error: "Too many requests. Please wait a few minutes and try again.",
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Step 2: Verify code and return orders
// ---------------------------------------------------------------------------

/**
 * Verify a 6-digit OTP code. On success, creates a session and returns
 * the user's orders.
 *
 * Rate-limited via Upstash (5 attempts per 15min per email) on top of
 * Supabase Auth's built-in limits.
 */
export async function verifyCodeAndLookup(
  email: string,
  code: string,
): Promise<{
  orders: OrderSummary[];
  error: string | null;
}> {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed || !code) {
    return { orders: [], error: "Please enter your email and code." };
  }

  // Upstash rate limit check (defense-in-depth)
  const { success: allowed } = await verificationLimiter.limit(trimmed);
  if (!allowed) {
    return {
      orders: [],
      error: "Too many verification attempts. Please wait 15 minutes.",
    };
  }

  try {
    const supabase = await createAuthClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: trimmed,
      token: code,
      type: "email",
    });

    if (verifyError) {
      return {
        orders: [],
        error: "Invalid or expired code. Please check and try again.",
      };
    }

    // Session is now set. Query orders -- RLS enforces email match.
    const { data, error: queryError } = await supabase
      .from("orders")
      .select("id, status, created_at, amount_cents, currency")
      .order("created_at", { ascending: false });

    if (queryError) throw queryError;

    const orders: OrderSummary[] = (data ?? []).map((r) => ({
      id: r.id as string,
      status: r.status as OrderStatus,
      createdAt: r.created_at as string,
      amountCents: r.amount_cents as number,
      currency: r.currency as string,
    }));

    return { orders, error: null };
  } catch {
    return { orders: [], error: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Post-checkout session redirect (unchanged from previous implementation)
// ---------------------------------------------------------------------------

/**
 * Resolve a Stripe checkout session ID to an order UUID.
 * Uses the service-role query since the user may not be authenticated yet.
 * Returns null if the order hasn't been created yet (webhook pending).
 */
export async function resolveSessionToOrder(
  sessionId: string,
): Promise<string | null> {
  try {
    const order = await getOrderBySessionId(sessionId);
    return order?.id ?? null;
  } catch {
    return null;
  }
}
