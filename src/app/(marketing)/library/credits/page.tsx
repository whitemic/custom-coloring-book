import Link from "next/link";
import { CreditPacksForm } from "./credit-packs-form";

export default function CreditsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/library"
          className="inline-block text-sm text-gray-500 hover:text-gray-700 mb-4"
          style={{ fontFamily: "var(--font-caveat), cursive" }}
        >
          ← Back to Library
        </Link>
        <h1
          className="text-4xl font-bold text-gray-800"
          style={{ fontFamily: "var(--font-caveat), cursive" }}
        >
          ✨ Credits
        </h1>
        <p
          className="text-gray-500 mt-1"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          Use credits to download pages from the library — 1 credit = 1 page. Buy packs below or{" "}
          <Link href="/" className="underline text-amber-600 hover:text-amber-800">
            create a character
          </Link>{" "}
          and opt-in to earn library credits when others download yours. Library credits can be used to purchase mix-and-match coloring books from the library.
        </p>
      </div>

      {/* How credits work */}
      <div className="bg-white sketch-border p-5 grid sm:grid-cols-3 gap-4">
        {[
          {
            icon: "💳",
            title: "Buy a pack",
            desc: "Purchase credits below and get a discount on larger packs.",
          },
          {
            icon: "📚",
            title: "Share your book",
            desc: "Create a coloring book, check 'add to library' at checkout.",
          },
          {
            icon: "✨",
            title: "Earn library credits",
            desc: "Every time someone downloads one of your pages, you earn 1 library credit to spend on future purchases.",
          },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="text-center space-y-1">
            <div className="text-3xl">{icon}</div>
            <p
              className="font-bold text-gray-800"
              style={{ fontFamily: "var(--font-caveat), cursive" }}
            >
              {title}
            </p>
            <p
              className="text-xs text-gray-500"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {desc}
            </p>
          </div>
        ))}
      </div>

      {/* Credit packs */}
      <CreditPacksForm />
    </div>
  );
}
