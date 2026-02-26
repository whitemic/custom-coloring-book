import Link from "next/link";
import { notFound } from "next/navigation";
import { getLibraryCharacterPages } from "@/lib/supabase/queries";
import { PageSelector } from "./page-selector";

export const revalidate = 300;

const TYPE_LABEL: Record<string, string> = {
  human: "👤 Human",
  animal: "🐾 Animal",
  fantasy: "✨ Fantasy creature",
  other: "🌀 Other",
};

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  let data;
  try {
    data = await getLibraryCharacterPages(orderId);
  } catch {
    notFound();
  }

  if (!data.order.library_opt_in) {
    notFound();
  }

  const { manifest, pages, order } = data;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/library"
        className="inline-block text-sm text-gray-500 hover:text-gray-700 transition-colors"
        style={{ fontFamily: "var(--font-caveat), cursive" }}
      >
        ← Back to Library
      </Link>

      {/* Character header */}
      <div className="bg-white sketch-border p-6 flex gap-6 items-start">
        {order.previewImageUrl && (
          <div
            className="flex-shrink-0 w-28 h-28 overflow-hidden"
            style={{ borderRadius: "6px 10px 6px 12px" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.previewImageUrl}
              alt={manifest?.characterName ?? "Character"}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="space-y-2">
          <h1
            className="text-3xl font-bold text-gray-800"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            {manifest?.characterName ?? "Mystery Character"}
          </h1>
          <div className="flex flex-wrap gap-2">
            {manifest?.theme && (
              <span
                className="px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded-full border border-amber-200"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                {manifest.theme}
              </span>
            )}
            {manifest?.characterType && (
              <span
                className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full border border-purple-200"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                {TYPE_LABEL[manifest.characterType] ?? manifest.characterType}
              </span>
            )}
            <span
              className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {pages.length} pages
            </span>
          </div>
          <p
            className="text-sm text-gray-500"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            Click pages below to add them to your mix. You can combine pages from multiple characters.
          </p>
        </div>
      </div>

      {/* Page selection grid */}
      {pages.length === 0 ? (
        <div
          className="sketch-border rounded-3xl bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 py-16 text-center"
        >
          <p
            className="text-3xl font-bold text-amber-700 mb-2"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            Pages coming soon!
          </p>
          <p
            className="text-sm text-stone-500"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            This character&apos;s coloring pages aren&apos;t ready yet. Check back soon!
          </p>
        </div>
      ) : (
        <PageSelector
          pages={pages.map((p) => ({
            pageId: p.id,
            orderId,
            imageUrl: p.image_url!,
            pageNumber: p.page_number,
            characterName: manifest?.characterName ?? "Character",
          }))}
        />
      )}

      {/* Help text */}
      <div
        className="text-center text-sm text-gray-400"
        style={{ fontFamily: "var(--font-nunito), sans-serif" }}
      >
        ✨ Pricing: $5 for up to 10 pages · +$0.50 per page after that
        <br />
        Mix pages from multiple characters — your cart saves across the library!
      </div>
    </div>
  );
}
