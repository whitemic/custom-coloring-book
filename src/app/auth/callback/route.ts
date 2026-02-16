import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth-server";

/**
 * GET /auth/callback
 *
 * Handles the redirect from a Supabase magic link email.
 * The URL contains a `code` query param that we exchange for a session.
 * After successful exchange the user is redirected to /orders.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/orders";

  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // If code is missing or exchange failed, redirect to orders with an error hint
  return NextResponse.redirect(
    new URL("/orders?error=verification_failed", origin),
  );
}
