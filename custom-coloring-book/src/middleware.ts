import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase Auth session-refresh middleware.
 *
 * On every matched request this middleware:
 * 1. Reads the auth cookies from the incoming request
 * 2. Calls getUser() which refreshes the JWT if it has expired
 * 3. Writes the updated cookies to the response
 *
 * Without this, cookie-based sessions would silently expire after
 * jwt_expiry (1 hour) and never renew.
 *
 * Scoped to /orders and /auth paths only so the landing page,
 * webhooks, and API routes are unaffected.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh the session -- this is the critical call that renews expired JWTs.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/orders/:path*", "/auth/:path*"],
};
