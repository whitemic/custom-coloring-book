import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-aware Supabase client for use in Server Components, Server Actions,
 * and Route Handlers.
 *
 * Uses the **anon key** and respects RLS -- unlike the admin client in
 * server.ts which uses the service role key and bypasses RLS.
 *
 * This client reads/writes auth cookies so that sessions persist across
 * requests. It must be called inside a request context (not in Inngest
 * functions or standalone scripts).
 */
export async function createAuthClient() {
  const cookieStore = await cookies();

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can throw when called from a Server Component (read-only
            // context). This is safe to ignore -- the middleware handles
            // refreshing the session cookie on the next request.
          }
        },
      },
    },
  );
}
