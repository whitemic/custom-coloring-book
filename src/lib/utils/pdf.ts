import { PDFDocument } from "pdf-lib";
import { createServerClient } from "@/lib/supabase/server";

const BUCKET = "coloring-books";

// US Letter: 8.5 × 11 inches at 72 DPI
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36; // 0.5 inch margin

/**
 * Download all page images, stitch them into a single PDF,
 * upload to Supabase Storage, and return a public download URL.
 */
export async function assemblePdf(
  orderId: string,
  imageUrls: string[],
): Promise<string> {
  const pdf = await PDFDocument.create();

  for (const url of imageUrls) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${url} (${res.status})`);
    }

    const imageBytes = new Uint8Array(await res.arrayBuffer());

    // Detect format from URL or content-type and embed accordingly
    const contentType = res.headers.get("content-type") ?? "";
    let image;
    if (contentType.includes("png") || url.endsWith(".png")) {
      image = await pdf.embedPng(imageBytes);
    } else {
      // Default to JPEG (Replicate typically returns PNG, but fall back)
      try {
        image = await pdf.embedPng(imageBytes);
      } catch {
        image = await pdf.embedJpg(imageBytes);
      }
    }

    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    // Scale image to fit within margins while preserving aspect ratio
    const maxW = PAGE_WIDTH - MARGIN * 2;
    const maxH = PAGE_HEIGHT - MARGIN * 2;
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;

    // Center the image on the page
    const x = (PAGE_WIDTH - drawW) / 2;
    const y = (PAGE_HEIGHT - drawH) / 2;

    page.drawImage(image, { x, y, width: drawW, height: drawH });
  }

  const pdfBytes = await pdf.save();

  // Upload to Supabase Storage
  const supabase = createServerClient();

  // Ensure the bucket exists (idempotent)
  const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 52_428_800, // 50 MB
  });
  if (bucketError && !bucketError.message.includes("already exists")) {
    throw new Error(`Failed to create storage bucket: ${bucketError.message}`);
  }

  const fileName = `${orderId}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload PDF: ${uploadError.message}`);
  }

  // Get the public URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

  return data.publicUrl;
}
