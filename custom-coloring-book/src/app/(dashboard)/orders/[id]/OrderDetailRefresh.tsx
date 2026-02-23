"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 15_000;

export function OrderDetailRefresh({ isProcessing }: { isProcessing: boolean }) {
  const router = useRouter();

  useEffect(() => {
    // Only poll when order is still processing
    if (!isProcessing) {
      return;
    }

    const id = setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);

    // Cleanup: stop polling when component unmounts or isProcessing becomes false
    return () => {
      clearInterval(id);
    };
  }, [isProcessing, router]);

  return null;
}
