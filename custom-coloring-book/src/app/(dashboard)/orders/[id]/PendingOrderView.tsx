"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveSessionToOrder } from "../actions";

const POLL_INTERVAL_MS = 2000;
const MAX_RETRIES = 60;

export function PendingOrderView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function poll() {
      const orderId = await resolveSessionToOrder(sessionId);
      if (cancelled) return;

      if (orderId) {
        router.replace(`/orders/${orderId}?session_id=${encodeURIComponent(sessionId)}`);
        return;
      }
      if (retries < MAX_RETRIES) {
        setTimeout(() => {
          if (!cancelled) setRetries((r) => r + 1);
        }, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId, retries, router]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-white px-6 py-16 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Setting things up
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Your order has been received and we&apos;re preparing to generate
              your coloring book.
            </p>
          </div>
          <span className="mt-1 inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
            pending
          </span>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>Creating your order…</span>
            <span>This can take up to a minute</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-600 animate-[pulse_1.5s_ease-in-out_infinite]"
              style={{ width: "40%" }}
            />
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
          Generation can take a few minutes. This page will update when your
          order is ready.
        </p>

        <div className="mt-12 text-center">
          <a
            href="/orders"
            className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            &larr; Back to all orders
          </a>
        </div>
      </main>
    </div>
  );
}
