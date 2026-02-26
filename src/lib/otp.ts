import { Redis } from "@upstash/redis";

/**
 * OTP utility for email verification in the library credit flows.
 *
 * Falls back to a dev mode when UPSTASH_REDIS_REST_URL is not set:
 *  - generateOtp prints the code to console instead of storing it in Redis
 *  - isEmailVerified always returns true so the flow is not blocked locally
 */

const OTP_TTL = 60 * 10; // 10 minutes
const VERIFIED_TTL = 60 * 30; // 30 minutes

// Lazily initialise the Redis client only when env vars are present.
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

/**
 * Generate a 6-digit OTP for the given email and store it in Redis with a
 * 10-minute TTL. In dev mode (no Redis), the code is printed to the console
 * and the function still returns the code so it can be sent via email.
 */
export async function generateOtp(email: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const r = getRedis();
  if (!r) {
    console.log(`[DEV OTP] ${email}: ${code}`);
    return code;
  }
  await r.set(`otp:${email}`, code, { ex: OTP_TTL });
  return code;
}

/**
 * Verify an OTP for the given email. Returns true if valid and deletes it
 * immediately (single-use). Returns false if the code is wrong or expired.
 *
 * In dev mode (no Redis) always returns true.
 */
export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const r = getRedis();
  if (!r) {
    // Dev fallback: accept any 6-digit code
    return /^\d{6}$/.test(code);
  }
  const stored = await r.get<string>(`otp:${email}`);
  if (!stored || stored !== code) return false;
  await r.del(`otp:${email}`); // single-use
  return true;
}

/**
 * Mark an email as verified for 30 minutes so the user does not have to
 * re-verify within the same session window.
 */
export async function markEmailVerified(email: string): Promise<void> {
  const r = getRedis();
  if (!r) return; // dev mode: no-op, isEmailVerified returns true unconditionally
  await r.set(`verified:${email}`, "1", { ex: VERIFIED_TTL });
}

/**
 * Check whether the given email has been verified within the past 30 minutes.
 * Always returns true in dev mode (no Redis configured).
 */
export async function isEmailVerified(email: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return true; // dev fallback: skip verification gate
  const val = await r.get<string>(`verified:${email}`);
  return val === "1";
}

/**
 * Rate-limit OTP sends: allow at most 1 send per email per minute.
 * Returns true if the send is allowed, false if the caller should be throttled.
 *
 * Always returns true in dev mode (no Redis configured).
 */
export async function canSendOtp(email: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return true; // dev fallback: always allow
  const key = `otp-rate:${email}`;
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, 60); // reset after 1 minute
  return count <= 1;
}
