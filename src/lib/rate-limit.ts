import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter for OTP verification attempts.
 *
 * Sliding window: 5 attempts per 15 minutes per identifier (email).
 * This sits on top of Supabase Auth's built-in rate limits
 * (token_verifications = 30 per 5min per IP) as defense-in-depth,
 * protecting against distributed attacks from multiple IPs targeting
 * a single email.
 *
 * Falls back to a permissive no-op when Upstash env vars are missing
 * so local development works without a Redis instance.
 */

let verificationLimiter: {
  limit: (identifier: string) => Promise<{ success: boolean }>;
};

if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  verificationLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "otp-verify",
  });
} else {
  verificationLimiter = {
    async limit() {
      return { success: true };
    },
  };
}

export { verificationLimiter };
