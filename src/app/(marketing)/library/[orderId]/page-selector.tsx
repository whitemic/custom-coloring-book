"use client";

import { useMixMatchCart } from "@/components/library/mix-match-cart";

interface PageItem {
  pageId: string;
  orderId: string;
  imageUrl: string;
  pageNumber: number;
  characterName: string;
}

export function PageSelector({ pages }: { pages: PageItem[] }) {
  const { addPage, removePage, isInCart } = useMixMatchCart();

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      {pages.map((page) => {
        const inCart = isInCart(page.pageId);
        return (
          <button
            key={page.pageId}
            type="button"
            onClick={() =>
              inCart ? removePage(page.pageId) : addPage(page)
            }
            className={`relative group aspect-square overflow-hidden border-2 transition-all duration-200 focus:outline-none ${
              inCart
                ? "border-amber-400 shadow-md shadow-amber-200"
                : "border-amber-100 hover:border-amber-300"
            }`}
            style={{ borderRadius: "6px 10px 6px 12px" }}
          >
            {/* Page image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.imageUrl}
              alt={`Page ${page.pageNumber}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Hover/selected overlay */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                inCart
                  ? "bg-amber-400/20 opacity-100"
                  : "bg-black/0 group-hover:bg-black/10 opacity-0 group-hover:opacity-100"
              }`}
            >
              <span
                className={`text-2xl transition-transform duration-200 ${
                  inCart ? "scale-100" : "scale-75 group-hover:scale-100"
                }`}
              >
                {inCart ? "✓" : "+"}
              </span>
            </div>

            {/* Page number badge */}
            <span
              className="absolute top-1.5 left-1.5 bg-white/80 backdrop-blur-sm text-gray-600 text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {page.pageNumber}
            </span>

            {/* Selected checkmark badge */}
            {inCart && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-white text-xs font-bold leading-none">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
