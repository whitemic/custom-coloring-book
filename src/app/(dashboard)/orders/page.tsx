"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import {
  getSessionOrders,
  sendVerificationCode,
  verifyCodeAndLookup,
} from "./actions";
import type { OrderSummary } from "./actions";

// ---------------------------------------------------------------------------
// Status badge display names
// ---------------------------------------------------------------------------

const STATUS_DISPLAY: Record<string, string> = {
  pending_payment: "Awaiting payment",
  pending: "Processing",
  manifest_generated: "Designing",
  generating: "Generating",
  complete: "Complete",
  failed: "Failed",
};

// ---------------------------------------------------------------------------
// Post-checkout: send to order detail (pending) so there's no separate loading page
// ---------------------------------------------------------------------------

function SessionRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!sessionId) return;
    router.replace(`/orders/pending?session_id=${encodeURIComponent(sessionId)}`);
  }, [sessionId, router]);

  if (!sessionId) return null;
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
  const [orderIdHint, setOrderIdHint] = useState("");
  const [code, setCode] = useState("");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const router = useRouter();

  // On mount, check for an existing session (session_id is handled by redirect to /orders/pending)
  useEffect(() => {
    if (sessionId) return;

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

      const result = await verifyCodeAndLookup(email, code, orderIdHint || undefined);

      setLoading(false);

      if (result.error) {
        setError(result.error);
      } else if (result.redirectOrderId) {
        router.push(`/orders/${result.redirectOrderId}`);
      } else {
        setOrders(result.orders);
        setSessionEmail(email);
        setStep("results");
      }
    },
    [email, code, orderIdHint, router],
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
      <div className="flex min-h-screen items-center justify-center paper-bg">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: "#fbbf24", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col paper-bg">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
        <main className="w-full max-w-lg">
          {/* Step 1: Email input */}
          {step === "email" && (
            <div className="sketch-border rounded-3xl bg-white/80 p-8 text-center">
              <div className="mb-3 text-5xl">📚</div>
              <h1
                className="text-4xl font-bold"
                style={{
                  fontFamily: "var(--font-caveat), cursive",
                  color: "#92400e",
                }}
              >
                Find Your Orders
              </h1>
              <p
                className="mt-3 text-sm text-zinc-600"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                Enter the email address you used at checkout. We&apos;ll send a
                verification code to confirm it&apos;s you.
              </p>

              <form onSubmit={handleSendCode} className="mt-7">
                <div className="flex gap-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="sketch-input flex-1 px-4 py-2.5 text-sm text-zinc-800"
                    style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="adventure-btn shrink-0 rounded-xl border-2 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      fontFamily: "var(--font-caveat), cursive",
                      fontSize: "1rem",
                      background:
                        "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
                      borderColor: "#db2777",
                    }}
                  >
                    {loading ? "Sending…" : "Send Code ✉️"}
                  </button>
                </div>
              </form>

              {error && (
                <p
                  className="mt-4 text-sm text-red-600"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  {error}
                </p>
              )}
            </div>
          )}

          {/* Step 2: Code input */}
          {step === "code" && (
            <div className="sketch-border rounded-3xl bg-white/80 p-8 text-center">
              <div className="mb-3 text-5xl">✉️</div>
              <h1
                className="text-4xl font-bold"
                style={{
                  fontFamily: "var(--font-caveat), cursive",
                  color: "#92400e",
                }}
              >
                Check Your Email
              </h1>
              <p
                className="mt-3 text-sm text-zinc-600"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                We sent a 6-digit code to{" "}
                <span className="font-semibold text-zinc-900">{email}</span>.
                Enter it below, or click the magic link in the email.
              </p>

              <form onSubmit={handleVerifyCode} className="mt-7">
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
                    className="sketch-input flex-1 px-4 py-2.5 text-center font-mono text-2xl tracking-[0.5em] text-zinc-800"
                  />
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="adventure-btn shrink-0 rounded-xl border-2 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      fontFamily: "var(--font-caveat), cursive",
                      fontSize: "1rem",
                      background:
                        "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
                      borderColor: "#db2777",
                    }}
                  >
                    {loading ? "Checking…" : "Verify ✓"}
                  </button>
                </div>
              </form>

              {error && (
                <p
                  className="mt-4 text-sm text-red-600"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  {error}
                </p>
              )}

              <div
                className="mt-6 flex items-center justify-center gap-4 text-sm"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                <button
                  onClick={handleResendCode}
                  disabled={loading}
                  className="font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{ color: "#d97706" }}
                >
                  Resend code
                </button>
                <span className="text-zinc-300">|</span>
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
            </div>
          )}

          {/* Step 3: Results */}
          {step === "results" && (
            <div className="sketch-border rounded-3xl bg-white/80 p-8 text-center">
              <div className="mb-3 text-5xl">🎨</div>
              <h1
                className="text-4xl font-bold"
                style={{
                  fontFamily: "var(--font-caveat), cursive",
                  color: "#92400e",
                }}
              >
                Your Orders
              </h1>
              {sessionEmail && (
                <p
                  className="mt-2 text-sm text-zinc-500"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  Showing orders for {sessionEmail}
                </p>
              )}

              {orders.length === 0 ? (
                <div className="mt-6 rounded-2xl border-2 border-dashed border-amber-200 px-6 py-10">
                  <p className="text-2xl" style={{ fontFamily: "var(--font-caveat), cursive", color: "#78716c" }}>
                    No orders found for this email address.
                  </p>
                </div>
              ) : (
                <OrderList orders={orders} />
              )}
            </div>
          )}

          {/* Footer link */}
          <div className="mt-8 text-center">
            <a
              href="/"
              className="transition-opacity hover:opacity-70"
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontSize: "1.2rem",
                color: "#d97706",
              }}
            >
              ← Create a new coloring book
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order list component
// ---------------------------------------------------------------------------

function OrderList({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="mt-6 space-y-3 text-left">
      {orders.map((order) => (
        <a
          key={order.id}
          href={`/orders/${order.id}`}
          className="flex items-center justify-between rounded-2xl border-2 p-4 transition-all hover:scale-[1.01]"
          style={{
            borderColor: "#f5deb3",
            backgroundColor: "rgba(255, 251, 235, 0.6)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "#fbbf24";
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
              "rgba(255, 251, 235, 0.9)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "#f5deb3";
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
              "rgba(255, 251, 235, 0.6)";
          }}
        >
          <div>
            <p
              className="text-lg font-bold text-zinc-800"
              style={{ fontFamily: "var(--font-caveat), cursive" }}
            >
              Order {order.id.slice(0, 8)}
            </p>
            <p
              className="mt-0.5 text-xs text-zinc-500"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {new Date(order.createdAt).toLocaleDateString()} &middot; $
              {(order.amountCents / 100).toFixed(2)}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              order.status === "complete"
                ? "bg-green-100 text-green-700"
                : order.status === "failed"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
            }`}
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
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
        <div className="flex min-h-screen items-center justify-center paper-bg">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: "#fbbf24", borderTopColor: "transparent" }}
          />
        </div>
      }
    >
      <SessionRedirect />
      <OrderLookup />
    </Suspense>
  );
}
