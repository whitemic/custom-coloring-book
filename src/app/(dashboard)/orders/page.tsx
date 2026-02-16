"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import {
  getSessionOrders,
  sendVerificationCode,
  verifyCodeAndLookup,
  resolveSessionToOrder,
} from "./actions";
import type { OrderSummary } from "./actions";

// ---------------------------------------------------------------------------
// Status badge display names
// ---------------------------------------------------------------------------

const STATUS_DISPLAY: Record<string, string> = {
  pending: "Processing",
  manifest_generated: "Designing",
  generating: "Generating",
  complete: "Complete",
  failed: "Failed",
};

// ---------------------------------------------------------------------------
// Post-checkout session redirect (unchanged)
// ---------------------------------------------------------------------------

function SessionRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const [retries, setRetries] = useState(0);
  const [waiting, setWaiting] = useState(!!sessionId);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function resolve() {
      const orderId = await resolveSessionToOrder(sessionId!);
      if (cancelled) return;

      if (orderId) {
        router.replace(`/orders/${orderId}`);
      } else if (retries < 10) {
        setTimeout(() => {
          if (!cancelled) setRetries((r) => r + 1);
        }, 2000);
      } else {
        setWaiting(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [sessionId, retries, router]);

  if (!sessionId) return null;

  if (waiting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 dark:bg-zinc-950">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Locating your order&hellip;
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Your payment was successful! We&apos;re setting up your coloring
            book now. This usually takes just a few seconds.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Multi-step order lookup with email verification
// ---------------------------------------------------------------------------

type Step = "loading" | "email" | "code" | "results";

function OrderLookup() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const errorParam = searchParams.get("error");

  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // On mount, check for an existing session
  useEffect(() => {
    if (sessionId) {
      // Let the SessionRedirect component handle this
      setStep("loading");
      const timer = setTimeout(() => setStep("email"), 22000);
      return () => clearTimeout(timer);
    }

    async function checkSession() {
      const result = await getSessionOrders();
      if (result.email && result.orders.length > 0) {
        setOrders(result.orders);
        setSessionEmail(result.email);
        setStep("results");
      } else if (result.email) {
        setSessionEmail(result.email);
        setStep("results");
      } else {
        setStep("email");
      }
    }

    checkSession();
  }, [sessionId]);

  // Handle magic link error from callback redirect
  useEffect(() => {
    if (errorParam === "verification_failed") {
      setError(
        "Verification link expired or invalid. Please request a new code.",
      );
      setStep("email");
    }
  }, [errorParam]);

  const handleSendCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      const result = await sendVerificationCode(email);

      setLoading(false);

      if (result.success) {
        setStep("code");
      } else {
        setError(result.error);
      }
    },
    [email],
  );

  const handleVerifyCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      const result = await verifyCodeAndLookup(email, code);

      setLoading(false);

      if (result.error) {
        setError(result.error);
      } else {
        setOrders(result.orders);
        setSessionEmail(email);
        setStep("results");
      }
    },
    [email, code],
  );

  const handleResendCode = useCallback(async () => {
    setError(null);
    setLoading(true);
    const result = await sendVerificationCode(email);
    setLoading(false);
    if (result.success) {
      setError(null);
      setCode("");
    } else {
      setError(result.error);
    }
  }, [email]);

  // Loading state (checking session or waiting for session_id redirect)
  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-lg text-center">
        {/* Step 1: Email input */}
        {step === "email" && (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Find Your Orders
            </h1>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">
              Enter the email address you used at checkout. We&apos;ll send a
              verification code to confirm it&apos;s you.
            </p>

            <form onSubmit={handleSendCode} className="mt-8">
              <div className="flex gap-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send code"}
                </button>
              </div>
            </form>

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </>
        )}

        {/* Step 2: Code input */}
        {step === "code" && (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Check Your Email
            </h1>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {email}
              </span>
              . Enter it below, or click the magic link in the email.
            </p>

            <form onSubmit={handleVerifyCode} className="mt-8">
              <div className="flex gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-center font-mono text-lg tracking-widest text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>
              </div>
            </form>

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <button
                onClick={handleResendCode}
                disabled={loading}
                className="text-indigo-600 hover:text-indigo-500 disabled:opacity-50 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Resend code
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <button
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="text-zinc-500 hover:text-zinc-400"
              >
                Change email
              </button>
            </div>
          </>
        )}

        {/* Step 3: Results */}
        {step === "results" && (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Your Orders
            </h1>
            {sessionEmail && (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
                Showing orders for {sessionEmail}
              </p>
            )}

            {orders.length === 0 ? (
              <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-8 dark:border-zinc-700">
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  No orders found for this email address.
                </p>
              </div>
            ) : (
              <OrderList orders={orders} />
            )}
          </>
        )}

        {/* Footer link */}
        <div className="mt-12">
          <a
            href="/"
            className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            &larr; Create a new coloring book
          </a>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order list component
// ---------------------------------------------------------------------------

function OrderList({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="mt-8 space-y-3 text-left">
      {orders.map((order) => (
        <a
          key={order.id}
          href={`/orders/${order.id}`}
          className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20"
        >
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Order {order.id.slice(0, 8)}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
              {new Date(order.createdAt).toLocaleDateString()} &middot; $
              {(order.amountCents / 100).toFixed(2)}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              order.status === "complete"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : order.status === "failed"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
            }`}
          >
            {STATUS_DISPLAY[order.status] ?? order.status}
          </span>
        </a>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <SessionRedirect />
      <OrderLookup />
    </Suspense>
  );
}
