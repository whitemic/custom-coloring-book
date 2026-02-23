import Replicate from "replicate";

let _replicate: Replicate | null = null;

function getReplicate(): Replicate {
  if (!_replicate) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("Missing REPLICATE_API_TOKEN");

    _replicate = new Replicate({ auth: token });
  }
  return _replicate;
}

export interface ReplicateResult {
  imageUrl: string;
  predictionId: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a single Flux Dev prediction on Replicate with automatic retry
 * on 429 rate-limit errors. Waits for the Retry-After header value
 * (or 10s default) before retrying, up to 3 attempts.
 */
export async function runReplicatePrediction(
  prompt: string,
  seed: number,
  maxRetries = 6,
): Promise<ReplicateResult> {
  const replicate = getReplicate();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const output = await replicate.run("black-forest-labs/flux-dev", {
        input: {
          prompt,
          seed,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "png",
          output_quality: 100,
          guidance: 3.5,
          num_inference_steps: 28,
        },
      });

      // Replicate SDK returns FileOutput objects (extends ReadableStream)
      // which have a .toString() that returns the URL string.
      // We call String() on the first element to handle both FileOutput and plain strings.
      const outputArr = Array.isArray(output) ? output : [output];
      const imageUrl = String(outputArr[0]);

      const predictionId =
        imageUrl.match(/predictions\/([a-z0-9]+)\//)?.[1] ?? "";

      return { imageUrl, predictionId };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);

      const isPaymentRequired =
        errMsg.includes("402") || errMsg.includes("Payment Required");
      if (isPaymentRequired) {
        throw new Error(
          "Replicate returned 402 Payment Required. Your free tier credits " +
            "are exhausted. Add billing at https://replicate.com/account/billing " +
            "to continue.",
        );
      }

      const isRateLimit =
        errMsg.includes("429") ||
        errMsg.includes("Too Many Requests") ||
        errMsg.includes("rate") ||
        errMsg.includes("Request was throttled");

      if (isRateLimit && attempt < maxRetries) {
        const waitSec = 15 * (attempt + 1); // 15s, 30s, 45s, 60s, 75s, 90s
        console.log(
          `Replicate rate limited (attempt ${attempt + 1}/${maxRetries + 1}), waiting ${waitSec}s...`,
        );
        await sleep(waitSec * 1000);
        continue;
      }

      throw err;
    }
  }

  throw new Error("Replicate prediction failed after all retries");
}
