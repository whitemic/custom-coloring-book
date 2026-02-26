import Link from "next/link";
import { MixMatchCartProvider } from "@/components/library/mix-match-cart";
import { CartWidget } from "@/components/library/cart-widget";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MixMatchCartProvider>
      <div className="min-h-full w-full flex flex-col paper-bg">
        {/* Nav */}
        <header className="float-anim sticky top-4 z-40 mx-4 mt-4 mb-2">
          <nav className="max-w-5xl mx-auto bg-white/90 backdrop-blur-sm sketch-border px-5 py-3 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
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
              </svg>
              <div>
                <p
                  className="text-lg font-bold text-gray-800 leading-tight"
                  style={{ fontFamily: "var(--font-caveat), cursive" }}
                >
                  Storybook Dreams
                </p>
                <p
                  className="text-xs text-gray-500 leading-tight"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  Character Library
                </p>
              </div>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <Link
                href="/library/credits"
                className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-full border border-amber-200"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                <span>✨</span>
                <span>Credits</span>
              </Link>
              <Link
                href="/"
                className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                Make Your Own →
              </Link>
            </div>
          </nav>
        </header>

        {/* Page content */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="py-4 text-center">
          <p
            className="text-sm text-gray-400"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            Made with 💖 for parents who believe in magic
          </p>
        </footer>

        {/* Floating cart widget — only visible when items are in cart */}
        <CartWidget />
      </div>
    </MixMatchCartProvider>
  );
}
