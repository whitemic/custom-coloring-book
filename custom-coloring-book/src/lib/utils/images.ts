import { createServerClient } from "@/lib/supabase/server";

const BUCKET = "coloring-books";
const PREVIEW_PREFIX = "character-previews";

/**
 * Download an image from a (possibly ephemeral) URL and upload it to
 * Supabase Storage under `character-previews/{orderId}/{filename}.png`.
 *
 * Returns the permanent public URL from Supabase Storage.
 *
 * This is necessary because Replicate CDN URLs (replicate.delivery/...)
 * expire after ~24 hours. By persisting to Supabase we guarantee the
 * reference image is available throughout the book-generation pipeline.
 */
export async function persistImageToStorage(
  imageUrl: string,
  orderId: string,
  filename: string,
): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(
      `persistImageToStorage: failed to fetch source image (${res.status}): ${imageUrl}`,
    );
  }

  const imageBytes = new Uint8Array(await res.arrayBuffer());
  const supabase = createServerClient();

  const storagePath = `${PREVIEW_PREFIX}/${orderId}/${filename}.png`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, imageBytes, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `persistImageToStorage: failed to upload to storage: ${uploadError.message}`,
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
