import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase admin client.
 * Uses the service role key -- bypasses RLS.
 * Safe to use in API routes, Inngest functions, and server actions.
 *
 * Note: We intentionally omit the Database generic here because we
 * don't yet have Supabase-generated types (run `supabase gen types`
 * after the local instance is running). Row types are cast manually
 * in queries.ts using the types from @/types/database.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
