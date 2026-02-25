"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL = 15;

export function AutoRefresh() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(INTERVAL);

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

  return (
    <div
      className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/60 px-4 py-3"
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
      </span>
      <p
        className="text-sm text-purple-700"
        style={{ fontFamily: "var(--font-nunito), sans-serif" }}
      >
        Checking for updates in{" "}
        <span className="font-bold tabular-nums">{countdown}s</span>
        …
      </p>
    </div>
  );
}
