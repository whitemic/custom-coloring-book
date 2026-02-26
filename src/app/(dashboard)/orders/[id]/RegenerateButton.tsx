"use client";

import { useState } from "react";
import { regeneratePage } from "@/app/actions";

export function RegenerateButton({
  pageId,
  orderId,
  pageNumber,
}: {
  pageId: string;
  orderId: string;
  pageNumber: number;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setPending(true);
    setError(null);
    try {
      await regeneratePage(pageId, orderId);
      // Reload so the page shows the pending thumbnail and AutoRefresh kicks in
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to regenerate page.");
      setPending(false);
    }
  };

  return (
    <div className="p-1.5 pt-0">
      <button
        onClick={handleClick}
        disabled={pending}
        title={`Regenerate page ${pageNumber} (1 credit)`}
        className="w-full text-xs font-semibold py-1 px-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: "var(--font-nunito), sans-serif" }}
      >
        {pending ? "…" : "↺ Regen (1 credit)"}
      </button>
      {error && (
        <p
          className="mt-1 text-xs text-red-500 text-center leading-tight"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
