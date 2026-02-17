import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generateBook } from "@/lib/inngest/functions/generate-book";

/**
 * Inngest serve endpoint.
 * Inngest calls this route to invoke registered functions.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateBook],
});
