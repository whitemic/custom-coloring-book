"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL = 4; // seconds between refresh checks
const TIMEOUT_MINUTES = 5;

interface DownloadAutoRefreshProps {
  purchaseId: string;
}

export function DownloadAutoRefresh({ purchaseId }: DownloadAutoRefreshProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(INTERVAL);
  // Track elapsed minutes of polling
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    let count = INTERVAL;
    const tick = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        router.refresh();
        count = INTERVAL;
      }
      setCountdown(count);
    }, 1000);

    return () => clearInterval(tick);
  }, [router]);

  // Separate interval to track elapsed minutes
  useEffect(() => {
    const minuteTimer = setInterval(() => {
      setElapsedMinutes((prev) => prev + 1);
    }, 60_000);

    return () => clearInterval(minuteTimer);
  }, []);

  const isTimedOut = elapsedMinutes >= TIMEOUT_MINUTES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/60 px-4 py-3 mx-auto max-w-xs">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        <p
          className="text-sm text-amber-700"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          Checking in{" "}
          <span className="font-bold tabular-nums">{countdown}s</span>
          …
        </p>
      </div>

      {/* Timeout warning — shown after 5 minutes of polling */}
      {isTimedOut && (
        <div
          className="mx-auto max-w-sm sketch-border rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 text-sm"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          <p
            className="font-bold text-amber-800 mb-1"
            style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.1rem" }}
          >
            Taking longer than expected…
          </p>
          <p className="text-amber-700">
            If this doesn&apos;t complete soon, please{" "}
            <a
              href="mailto:support@storybookdreams.com"
              className="underline font-semibold hover:text-amber-900"
            >
              contact support
            </a>{" "}
            and include your reference:
          </p>
          <code
            className="mt-2 inline-block rounded bg-white/70 border border-amber-200 px-2 py-1 font-mono text-xs text-amber-900"
          >
            {purchaseId}
          </code>
        </div>
      )}
    </div>
  );
}
