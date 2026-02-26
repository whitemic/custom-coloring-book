import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generateBook } from "@/lib/inngest/functions/generate-book";
import { assembleLibraryBook } from "@/lib/inngest/functions/assemble-library-book";
import { grantCredits } from "@/lib/inngest/functions/grant-credits";
import { regeneratePage } from "@/lib/inngest/functions/regenerate-page";

/**
 * Inngest serve endpoint.
 * Inngest calls this route to invoke registered functions.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateBook, assembleLibraryBook, grantCredits, regeneratePage],
});
