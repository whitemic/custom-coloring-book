"use client";

import { useState } from "react";
import { useMixMatchCart, formatCents } from "./mix-match-cart";

export function CartWidget() {
  const { items, pageCount, totalCents, removePage, clearCart, firstAddNotification } = useMixMatchCart();
  const [open, setOpen] = useState(false);

  // When nothing in cart and no notification, render nothing
  if (pageCount === 0 && !firstAddNotification) return null;

  return (
    <>
      {/* First-add hint banner — fades in for 3 seconds when first page added */}
      {firstAddNotification && (
        <div
          className="fixed bottom-20 right-6 z-50 sketch-border rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm shadow-lg max-w-xs"
          style={{
            fontFamily: "var(--font-nunito), sans-serif",
            animation: "fadeInUp 0.3s ease-out",
          }}
        >
          <p className="font-semibold text-amber-800">
            Page added to your mix! 🎉
          </p>
          <p className="text-amber-700 text-xs mt-0.5">
            Your cart is in the bottom-right corner.
          </p>
        </div>
      )}

      {/* Floating cart button — only visible when there are pages */}
      {pageCount > 0 && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 text-white font-bold px-5 py-3 shadow-xl hover:shadow-2xl transition-all duration-300"
          style={{
            fontFamily: "var(--font-nunito), sans-serif",
            borderRadius: "14px 18px 14px 20px",
          }}
        >
          <span className="text-lg">📄</span>
          <span>{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
          <span className="mx-1 opacity-60">·</span>
          <span>{formatCents(totalCents)}</span>
        </button>
      )}

      {/* Slide-over panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-sm bg-amber-50/95 backdrop-blur-sm h-full flex flex-col shadow-2xl"
            style={{ borderLeft: "2px solid #d4c4b0" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200">
              <h2
                className="text-xl font-bold text-gray-800"
                style={{ fontFamily: "var(--font-caveat), cursive" }}
              >
                🎨 Your Mix ({pageCount} {pageCount === 1 ? "page" : "pages"})
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Pricing info */}
            <div
              className="mx-5 mt-3 mb-2 px-3 py-2 rounded-lg bg-amber-100 border border-amber-200 text-xs text-gray-600"
              style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "6px 10px 6px 12px" }}
            >
              {pageCount <= 10
                ? `$5 flat for up to 10 pages — add ${10 - pageCount} more for the same price!`
                : `$5 for first 10 pages + $0.50 × ${pageCount - 10} extra = ${formatCents(totalCents)}`}
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {items.map((item) => (
                <div
                  key={item.pageId}
                  className="flex items-center gap-3 bg-white rounded-lg p-2 sketch-border"
                  style={{ borderRadius: "6px 10px 6px 12px" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={`Page ${item.pageNumber}`}
                    className="w-12 h-12 object-cover rounded flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold text-gray-800 truncate"
                      style={{ fontFamily: "var(--font-caveat), cursive" }}
                    >
                      {item.characterName}
                    </p>
                    <p
                      className="text-xs text-gray-500"
                      style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                    >
                      Page {item.pageNumber}
                    </p>
                  </div>
                  <button
                    onClick={() => removePage(item.pageId)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 border-t border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="text-sm text-gray-600"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  Total
                </span>
                <span
                  className="text-xl font-bold text-gray-800"
                  style={{ fontFamily: "var(--font-caveat), cursive" }}
                >
                  {formatCents(totalCents)}
                </span>
              </div>

              <a
                href={`/library/checkout?pages=${items.map((i) => i.pageId).join(",")}`}
                className="block w-full text-center bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 hover:from-amber-500 hover:via-pink-500 hover:to-purple-500 text-white font-bold py-3 px-6 shadow-lg hover:shadow-xl transition-all duration-300"
                style={{
                  fontFamily: "var(--font-nunito), sans-serif",
                  borderRadius: "10px 14px 10px 16px",
                }}
              >
                ✨ Checkout — {formatCents(totalCents)}
              </a>

              <button
                onClick={() => { clearCart(); setOpen(false); }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
                style={{ fontFamily: "var(--font-caveat), cursive" }}
              >
                Clear all pages
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
