"use client";

import Link from "next/link";
import type { LibraryCharacter } from "@/lib/supabase/queries";

const TYPE_BADGE: Record<string, string> = {
  human: "👤 Human",
  animal: "🐾 Animal",
  fantasy: "✨ Fantasy",
  other: "🌀 Other",
};

export function LibraryGrid({ characters }: { characters: LibraryCharacter[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {characters.map((char) => (
        <Link
          key={char.orderId}
          href={`/library/${char.orderId}`}
          className="group block bg-white sketch-border overflow-hidden hover:shadow-lg transition-shadow duration-200"
          style={{ borderRadius: "6px 10px 6px 12px" }}
        >
          {/* Preview image */}
          <div className="aspect-square overflow-hidden bg-amber-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={char.previewImageUrl}
              alt={char.characterName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>

          {/* Info */}
          <div className="p-3 space-y-1">
            <p
              className="font-bold text-gray-800 truncate text-base"
              style={{ fontFamily: "var(--font-caveat), cursive" }}
            >
              {char.characterName}
            </p>

            {/* Theme badge */}
            <p
              className="text-xs text-amber-700 truncate"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {char.theme}
            </p>

            {/* Type + page count row */}
            <div className="flex items-center justify-between gap-1">
              <span
                className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full truncate"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                {TYPE_BADGE[char.characterType] ?? char.characterType}
              </span>
              <span
                className="text-xs text-gray-400 flex-shrink-0"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                {char.pageCount}p
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
