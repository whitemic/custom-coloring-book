"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function QuickNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isOrders = pathname?.startsWith("/orders");

  // Marketing page has its own full-page header — don't double up
  if (isHome) return null;

  return (
    <header className="sticky top-0 z-50 mx-4 mt-4 mb-2">
      <nav
        className="max-w-5xl mx-auto bg-white/90 backdrop-blur-sm sketch-border px-5 py-3 flex items-center justify-between"
        aria-label="Quick navigation"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="relative">
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <path
                d="M8 32L28 12L32 16L12 36L6 38L8 32Z"
                fill="#f8c9d4"
                stroke="#5c4a3d"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M28 12L32 8L36 12L32 16L28 12Z"
                fill="#ffd93d"
                stroke="#5c4a3d"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M6 38L8 32L12 36L6 38Z" fill="#5c4a3d" />
              <circle cx="20" cy="6" r="2" fill="#7eb5c9" className="sparkle" />
              <circle cx="34" cy="4" r="1.5" fill="#f0a5b8" className="sparkle sparkle-delay-1" />
              <circle cx="38" cy="18" r="1.5" fill="#a8d4e6" className="sparkle sparkle-delay-2" />
              <path
                d="M24 2L25 5L28 6L25 7L24 10L23 7L20 6L23 5L24 2Z"
                fill="#ffd93d"
                className="sparkle"
              />
            </svg>
          </div>
          <span
            className="text-lg font-bold text-gray-800"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            Storybook Dreams
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/"
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              fontFamily: "var(--font-nunito), sans-serif",
              ...(isHome
                ? {
                    background: "linear-gradient(135deg, #fbbf24 0%, #f0a5b8 100%)",
                    color: "#fff",
                    border: "2px solid #f0a5b8",
                  }
                : { color: "#92400e" }),
            }}
          >
            ✏️ New Book
          </Link>
          <Link
            href="/orders"
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              fontFamily: "var(--font-nunito), sans-serif",
              ...(isOrders
                ? {
                    background: "linear-gradient(135deg, #fbbf24 0%, #f0a5b8 100%)",
                    color: "#fff",
                    border: "2px solid #f0a5b8",
                  }
                : { color: "#92400e" }),
            }}
          >
            📚 My Orders
          </Link>
        </div>
      </nav>
    </header>
  );
}
