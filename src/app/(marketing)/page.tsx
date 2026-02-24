import { CheckoutForm } from "@/components/checkout-form";
import { GalleryOfDreams } from "@/components/gallery-of-dreams";

// Revalidate the gallery every 60 seconds so new completed pages appear
// without requiring a full redeploy.
export const revalidate = 60;

export default function MarketingPage() {
  return (
    <div className="min-h-full w-full flex flex-col paper-bg overflow-auto">
      {/* Floating sticky header */}
      <header className="float-anim sticky top-4 z-50 mx-4 mt-4 mb-2">
        <nav className="max-w-5xl mx-auto bg-white/90 backdrop-blur-sm sketch-border px-5 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
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
            <div>
              <h1
                className="text-xl font-bold text-gray-800"
                style={{ fontFamily: "var(--font-caveat), cursive" }}
              >
                Storybook Dreams
              </h1>
              <p
                className="text-xs text-gray-500"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                AI-Powered Coloring Magic
              </p>
            </div>
          </div>

          {/* Right side: credits + orders link */}
          <div className="flex items-center gap-3">
            {/* Credits badge */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-pink-100 to-blue-100 px-4 py-2 rounded-full border-2 border-dashed border-pink-200">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 8C6 8 5 8 5 10V20C5 21 6 22 7 22H17C18 22 19 21 19 20V10C19 8 18 8 18 8"
                  stroke="#5c4a3d"
                  strokeWidth="1.5"
                  fill="#fff"
                />
                <path
                  d="M6 8H18V6C18 5 17 4 16 4H8C7 4 6 5 6 6V8Z"
                  fill="#d4c4b0"
                  stroke="#5c4a3d"
                  strokeWidth="1.5"
                />
                <rect x="8" y="10" width="2" height="8" rx="1" fill="#f0a5b8" />
                <rect x="11" y="12" width="2" height="6" rx="1" fill="#7eb5c9" />
                <rect x="14" y="11" width="2" height="7" rx="1" fill="#ffd93d" />
              </svg>
              <span
                className="text-sm font-semibold text-gray-700"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                12 Credits
              </span>
            </div>

            {/* Orders link */}
            <a
              href="/orders"
              className="hidden sm:inline-block text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              My Orders →
            </a>
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <CheckoutForm />
      </main>

      {/* Gallery of Dreams — real completed pages, hidden if none exist yet */}
      <GalleryOfDreams />

      {/* Footer */}
      <footer className="py-4 text-center">
        <p
          className="text-sm text-gray-400"
          style={{ fontFamily: "var(--font-caveat), cursive" }}
        >
          Made with 💖 for parents who believe in magic
        </p>
      </footer>
    </div>
  );
}
