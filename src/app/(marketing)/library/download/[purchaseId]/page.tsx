import Link from "next/link";
import { notFound } from "next/navigation";
import { getLibraryPurchase } from "@/lib/supabase/queries";
import { DownloadAutoRefresh } from "./auto-refresh";

export const revalidate = 0; // always fetch fresh on each request

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const { purchaseId } = await params;

  const purchase = await getLibraryPurchase(purchaseId);

  if (!purchase) {
    notFound();
  }

  const isComplete = purchase.status === "complete";
  const isFailed = purchase.status === "failed";
  const isGenerating = !isComplete && !isFailed;

  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-12">
      {/* Header */}
      {isComplete ? (
        <>
          <div className="text-6xl">🎉</div>
          <h1
            className="text-4xl font-bold text-gray-800"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            Your coloring book is ready!
          </h1>
          <p
            className="text-gray-500"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            Your custom mix of {purchase.selected_page_ids.length} pages has been assembled into a PDF.
          </p>
        </>
      ) : isFailed ? (
        <>
          <div className="text-6xl">😔</div>
          <h1
            className="text-4xl font-bold text-gray-800"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            Something went wrong
          </h1>
          <p
            className="text-gray-500"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            We weren&apos;t able to assemble your coloring book. Your credits have not been charged.
          </p>
          <p
            className="text-gray-500 text-sm"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            Please{" "}
            <a
              href="mailto:support@storybookdreams.com"
              className="underline text-amber-600 hover:text-amber-700"
            >
              contact support
            </a>{" "}
            with your order reference:{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
              {purchaseId}
            </code>
          </p>
        </>
      ) : (
        <>
          <div className="text-6xl animate-bounce">📄</div>
          <h1
            className="text-4xl font-bold text-gray-800"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            Assembling your book…
          </h1>
          <p
            className="text-gray-500"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            We&apos;re stitching together {purchase.selected_page_ids.length} pages into your custom PDF.
            This usually takes less than a minute.
          </p>
        </>
      )}

      {/* Download button */}
      {isComplete && purchase.pdf_url && (
        <a
          href={purchase.pdf_url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 hover:from-amber-500 hover:via-pink-500 hover:to-purple-500 text-white font-bold py-4 px-10 shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
          style={{
            fontFamily: "var(--font-nunito), sans-serif",
            borderRadius: "14px 18px 14px 20px",
          }}
        >
          ⬇️ Download My Coloring Book
        </a>
      )}

      {/* Auto-refresh while generating */}
      {isGenerating && <DownloadAutoRefresh purchaseId={purchaseId} />}

      {/* Progress info */}
      {isGenerating && (
        <div
          className="text-xs text-gray-400 mt-2"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          Status: {purchase.status === "generating" ? "Assembling pages…" : "Queued for assembly…"}
        </div>
      )}

      {/* Back link */}
      <div>
        <Link
          href="/library"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline"
          style={{ fontFamily: "var(--font-caveat), cursive" }}
        >
          ← Back to Library
        </Link>
      </div>
    </div>
  );
}
