import Link from "next/link";
import { Suspense } from "react";
import { getLibraryCharacters } from "@/lib/supabase/queries";
import { LibraryGrid } from "./library-grid";

export const revalidate = 60;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; type?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const offset = params.page ? (parseInt(params.page, 10) - 1) * 12 : 0;

  const characters = await getLibraryCharacters({
    theme: params.theme,
    characterType: params.type,
    q: params.q,
    offset,
    limit: 13, // fetch 1 extra to detect if there are more
  });

  const hasMore = characters.length === 13;
  const displayChars = characters.slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-4xl font-bold text-gray-800"
          style={{ fontFamily: "var(--font-caveat), cursive" }}
        >
          📚 Character Library
        </h1>
        <p
          className="text-gray-500 mt-1"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          Browse characters shared by our community. Pick any pages you love and build your own custom coloring book!
        </p>
      </div>

      {/* Filter bar */}
      <Suspense>
        <LibraryFilters
          currentTheme={params.theme}
          currentType={params.type}
          currentQ={params.q}
        />
      </Suspense>

      {/* Grid */}
      {displayChars.length === 0 ? (
        <div className="sketch-border rounded-3xl bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 py-16 text-center space-y-3">
          <p
            className="text-3xl font-bold text-amber-700"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            {params.theme || params.type || params.q
              ? "No characters match your search"
              : "No characters yet"}
          </p>
          <p
            className="text-sm text-stone-500"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            {params.theme || params.type || params.q
              ? "Try a different search term or remove your filters."
              : "Characters shared by the community will appear here."}
          </p>
          {(params.theme || params.type || params.q) ? (
            <Link
              href="/library"
              className="inline-block mt-2 px-5 py-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
              style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
            >
              Clear filters
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-block mt-2 text-sm underline text-amber-600 hover:text-amber-800"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              Create the first one!
            </Link>
          )}
        </div>
      ) : (
        <LibraryGrid characters={displayChars} />
      )}

      {/* Pagination */}
      {(hasMore || offset > 0) && (
        <div className="flex justify-center gap-4 pt-4">
          {offset > 0 && (
            <a
              href={buildPageUrl(params, Math.max(1, offset / 12))}
              className="px-5 py-2 bg-white sketch-border text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
            >
              ← Previous
            </a>
          )}
          {hasMore && (
            <a
              href={buildPageUrl(params, offset / 12 + 2)}
              className="px-5 py-2 bg-white sketch-border text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function buildPageUrl(
  params: { theme?: string; type?: string; q?: string },
  page: number,
): string {
  const p = new URLSearchParams();
  if (params.theme) p.set("theme", params.theme);
  if (params.type) p.set("type", params.type);
  if (params.q) p.set("q", params.q);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `/library${qs ? `?${qs}` : ""}`;
}

// ---------------------------------------------------------------------------
// Filter bar — rendered server-side but uses client navigation via links
// ---------------------------------------------------------------------------

const THEMES = [
  { key: "space", label: "🚀 Space" },
  { key: "fantasy", label: "🧙 Fantasy" },
  { key: "forest", label: "🌲 Forest" },
  { key: "kingdom", label: "🏰 Kingdom" },
] as const;

const CHAR_TYPES = [
  { key: "human", label: "👤 Human" },
  { key: "animal", label: "🐾 Animal" },
  { key: "fantasy", label: "✨ Fantasy creature" },
] as const;

function LibraryFilters({
  currentTheme,
  currentType,
  currentQ,
}: {
  currentTheme?: string;
  currentType?: string;
  currentQ?: string;
}) {
  return (
    <div className="bg-white sketch-border p-4 space-y-3">
      {/* Search */}
      <form method="GET" action="/library" className="flex gap-2">
        {currentTheme && <input type="hidden" name="theme" value={currentTheme} />}
        {currentType && <input type="hidden" name="type" value={currentType} />}
        <input
          type="text"
          name="q"
          defaultValue={currentQ}
          placeholder="Search by character name…"
          className="flex-1 px-4 py-2 border-2 border-amber-200 bg-amber-50/30 text-sm text-gray-700 focus:outline-none focus:border-amber-400"
          style={{
            fontFamily: "var(--font-nunito), sans-serif",
            borderRadius: "8px 12px 8px 14px",
          }}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
          style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
        >
          Search
        </button>
        {(currentQ || currentTheme || currentType) && (
          <Link
            href="/library"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold transition-colors"
            style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
          >
            Clear
          </Link>
        )}
      </form>

      {/* Theme filter chips */}
      <div className="flex flex-wrap gap-2">
        <span
          className="text-xs text-gray-500 self-center pr-1"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          Theme:
        </span>
        {THEMES.map(({ key, label }) => {
          const active = currentTheme === key;
          const href = active
            ? buildPageUrl({ type: currentType, q: currentQ }, 1)
            : buildPageUrl({ theme: key, type: currentType, q: currentQ }, 1);
          return (
            <a
              key={key}
              href={href}
              className={`px-3 py-1 text-xs font-semibold transition-all border ${
                active
                  ? "bg-amber-400 text-white border-amber-400"
                  : "bg-white text-gray-600 border-amber-200 hover:border-amber-400"
              }`}
              style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "12px" }}
            >
              {label}
            </a>
          );
        })}
      </div>

      {/* Character type filter chips */}
      <div className="flex flex-wrap gap-2">
        <span
          className="text-xs text-gray-500 self-center pr-1"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          Type:
        </span>
        {CHAR_TYPES.map(({ key, label }) => {
          const active = currentType === key;
          const href = active
            ? buildPageUrl({ theme: currentTheme, q: currentQ }, 1)
            : buildPageUrl({ theme: currentTheme, type: key, q: currentQ }, 1);
          return (
            <a
              key={key}
              href={href}
              className={`px-3 py-1 text-xs font-semibold transition-all border ${
                active
                  ? "bg-purple-400 text-white border-purple-400"
                  : "bg-white text-gray-600 border-purple-200 hover:border-purple-400"
              }`}
              style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "12px" }}
            >
              {label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
