/**
 * Startup environment variable validation.
 *
 * Imported by src/lib/stripe/client.ts so it runs the first time the Stripe
 * client is initialised (i.e. on the first server request that touches Stripe,
 * which happens early in the order flow).  If any required variable is absent
 * the process throws immediately with a clear diagnostic message rather than
 * surfacing a cryptic runtime error deep inside a request handler.
 *
 * Add every variable that the application cannot function without to the
 * `REQUIRED` array below.  Optional / feature-flagged vars (e.g. Upstash,
 * Anthropic, Inngest keys) should not be listed here.
 */

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "REPLICATE_API_TOKEN",
  "OPENAI_API_KEY",
] as const;

const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `[env] Missing required environment variable(s):\n` +
      missing.map((k) => `  - ${k}`).join("\n") +
      `\n\nCopy .env.example to .env.local and fill in the missing values.`,
  );
}

/**
 * Typed, validated environment object.  Use this instead of process.env
 * directly so TypeScript knows the values are non-nullable.
 */
export const env = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY as string,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET as string,

  // AI
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN as string,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY as string,

  // AI model overrides (optional — fall back to sensible defaults)
  AI_MODEL_MANIFEST: process.env.AI_MODEL_MANIFEST ?? "gpt-4o-mini",
  AI_MODEL_COMPLEX: process.env.AI_MODEL_COMPLEX ?? "gpt-4o",

  // Inngest (empty string in local dev is fine — Dev Server injects them)
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY ?? "",
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY ?? "",

  // Optional extras
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  PREMIUM_PRICE_CENTS: Number(process.env.PREMIUM_PRICE_CENTS ?? "1499"),
} as const;
