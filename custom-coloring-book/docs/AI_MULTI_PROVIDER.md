# Multi-provider AI fallback (planned)

The Generative Manifest Enhancement plan (see repo notes / Cursor plan) planned **optional multi-provider fallback** for Premium tier: if the primary model (e.g. OpenAI) fails for manifest generation, retry with Anthropic (or Google).

## Current state

- **Config is ready**: `AI_PROVIDER_FALLBACK` and `getProviderFallbackList()` in `src/lib/ai/config.ts` are in place. Env still defaults to `openai,anthropic`.
- **models.ts** currently uses only `@ai-sdk/openai`. No fallback chain is implemented yet (that work was deferred).
- **Packages**: `@ai-sdk/anthropic` and `@ai-sdk/google` were **removed from package.json** (Feb 2025) because they declare a peer dependency on **zod ^3**, while this project uses **zod 4**. Installing them caused `npm install` to fail (e.g. on Vercel) without `legacy-peer-deps`.

## How to implement fallback later

1. **Option A – Re-add when SDKs support zod 4**  
   Check if `@ai-sdk/anthropic` and/or `@ai-sdk/google` have released versions that accept zod 4. If yes, add them back to `package.json` and implement the fallback in `src/lib/ai/models.ts` (e.g. try primary provider, on failure call next in `getProviderFallbackList()`).

2. **Option B – Pin zod to 3.x**  
   If you need fallback before the SDKs support zod 4, downgrade the project to zod 3 (e.g. `zod@^3.25.x`) so the Anthropic/Google SDKs’ peer deps are satisfied. Then add the packages back and implement the fallback.

3. **Option C – Use legacy-peer-deps**  
   Add `.npmrc` with `legacy-peer-deps=true` and re-add the packages. Builds will succeed; the SDKs generally work at runtime with zod 4, but peer dependency warnings remain.

The plan’s cost/quality logic (Standard = gpt-4o-mini only, Premium = optional gpt-4o with fallback) is unchanged; only the optional provider packages were removed to fix the build.
