import Link from "next/link";
import { Suspense } from "react";
import { LibraryCheckoutForm } from "./checkout-form";

export default function LibraryCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ pages?: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Loading...</div>}>
      <CheckoutInner searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckoutInner({
  searchParams,
}: {
  searchParams: Promise<{ pages?: string }>;
}) {
  const params = await searchParams;
  const pageIds = params.pages
    ? params.pages.split(",").filter(Boolean)
    : [];

  if (pageIds.length === 0) {
    return (
      <div className="text-center py-16">
        <p
          className="text-2xl text-gray-400"
          style={{ fontFamily: "var(--font-caveat), cursive" }}
        >
          No pages selected
        </p>
        <Link
          href="/library"
          className="inline-block mt-4 text-sm text-amber-600 hover:text-amber-800 underline"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          ← Browse the library
        </Link>
      </div>
    );
  }

  return <LibraryCheckoutForm pageIds={pageIds} />;
}
