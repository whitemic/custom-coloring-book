"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createLibraryCheckout,
  redeemCreditsForLibrary,
  fetchCreditBalance,
  sendEmailOtp,
  verifyEmailOtp,
} from "../actions";
import { calcLibraryPriceCents } from "@/lib/utils/library";
import { formatCents } from "@/components/library/mix-match-cart";
import { useRouter } from "next/navigation";

type Step = "email" | "otp" | "payment";

export function LibraryCheckoutForm({ pageIds }: { pageIds: string[] }) {
  const router = useRouter();

  // OTP flow state
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpPending, startOtpTransition] = useTransition();
  const [verifyPending, startVerifyTransition] = useTransition();

  // Payment state
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditLookupPending, startCreditLookup] = useTransition();
  const [payPending, startPay] = useTransition();

  const [error, setError] = useState<string | null>(null);

  const pageCount = pageIds.length;
  const totalCents = calcLibraryPriceCents(pageCount);
  const canUseCredits = creditBalance !== null && creditBalance >= pageCount;

  // ── Step 1 → 2: send OTP ──────────────────────────────────────────────────
  const handleSendCode = () => {
    setError(null);
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    startOtpTransition(async () => {
      const result = await sendEmailOtp(email.trim());
      if ("error" in result) {
        setError(result.error);
      } else {
        setStep("otp");
      }
    });
  };

  // ── Step 2 → 3: verify OTP then load credit balance ───────────────────────
  const handleVerify = () => {
    setError(null);
    if (!otpCode.trim()) {
      setError("Please enter the 6-digit code we sent to your email.");
      return;
    }
    startVerifyTransition(async () => {
      const result = await verifyEmailOtp(email.trim(), otpCode.trim());
      if ("error" in result) {
        setError(result.error);
      } else {
        // Verification succeeded — move to payment step and check credit balance
        setStep("payment");
        startCreditLookup(async () => {
          const balance = await fetchCreditBalance(email.trim());
          setCreditBalance(balance);
        });
      }
    });
  };

  // ── Payment actions ───────────────────────────────────────────────────────
  const handleStripeCheckout = () => {
    setError(null);
    startPay(async () => {
      try {
        await createLibraryCheckout(pageIds, email.trim());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  const handleCreditRedeem = () => {
    setError(null);
    startPay(async () => {
      try {
        const { purchaseId } = await redeemCreditsForLibrary(pageIds, email.trim());
        router.push(`/library/download/${purchaseId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
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
          className="text-3xl font-bold text-gray-800"
          style={{ fontFamily: "var(--font-caveat), cursive" }}
        >
          Checkout
        </h1>
      </div>

      {/* Summary card */}
      <div
        className="bg-white sketch-border p-5 space-y-3"
        style={{ borderRadius: "8px 12px 8px 14px" }}
      >
        <h2
          className="text-lg font-bold text-gray-800"
          style={{ fontFamily: "var(--font-caveat), cursive" }}
        >
          Your Mix
        </h2>
        <div
          className="flex justify-between text-sm text-gray-600"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          <span>{pageCount} coloring {pageCount === 1 ? "page" : "pages"}</span>
          <span className="font-semibold">{formatCents(totalCents)}</span>
        </div>
        {pageCount <= 10 ? (
          <p
            className="text-xs text-gray-400"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            $5 flat for up to 10 pages
          </p>
        ) : (
          <p
            className="text-xs text-gray-400"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            $5 for first 10 pages + $0.50 × {pageCount - 10} extra pages
          </p>
        )}
        <div className="border-t border-amber-100 pt-3 flex justify-between">
          <span
            className="font-bold text-gray-800"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            Total
          </span>
          <span
            className="font-bold text-xl text-gray-800"
            style={{ fontFamily: "var(--font-caveat), cursive" }}
          >
            {formatCents(totalCents)}
          </span>
        </div>
      </div>

      {/* ── Step 1: Email input ─────────────────────────────────────────────── */}
      {step === "email" && (
        <div className="bg-white sketch-border p-5 space-y-4">
          <div>
            <h2
              className="text-lg font-bold text-gray-800 mb-1"
              style={{ fontFamily: "var(--font-caveat), cursive" }}
            >
              Verify your email
            </h2>
            <p
              className="text-xs text-gray-500"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              We&apos;ll send a one-time code to confirm it&apos;s really you before showing your credit balance or taking payment.
            </p>
          </div>
          <div className="space-y-1">
            <label
              className="block text-sm font-semibold text-gray-700"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              Your email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSendCode(); }}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border-2 border-amber-200 bg-amber-50/30 text-sm text-gray-700 focus:outline-none focus:border-amber-400"
              style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
            />
          </div>
          {error && (
            <p
              className="text-sm text-red-600"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleSendCode}
            disabled={otpPending}
            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold py-3 px-8 shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "10px 14px 10px 16px" }}
          >
            {otpPending ? "Sending…" : "Send Verification Code"}
          </button>
        </div>
      )}

      {/* ── Step 2: OTP input ───────────────────────────────────────────────── */}
      {step === "otp" && (
        <div className="bg-white sketch-border p-5 space-y-4">
          <div>
            <h2
              className="text-lg font-bold text-gray-800 mb-1"
              style={{ fontFamily: "var(--font-caveat), cursive" }}
            >
              Check your inbox
            </h2>
            <p
              className="text-xs text-gray-500"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
            </p>
          </div>
          <div className="space-y-1">
            <label
              className="block text-sm font-semibold text-gray-700"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
              placeholder="123456"
              className="w-full px-4 py-3 border-2 border-amber-200 bg-amber-50/30 text-center text-2xl tracking-[0.5em] text-gray-700 focus:outline-none focus:border-amber-400"
              style={{ fontFamily: "var(--font-caveat), cursive", borderRadius: "8px 12px 8px 14px" }}
            />
          </div>
          {error && (
            <p
              className="text-sm text-red-600"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifyPending || otpCode.length < 6}
            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold py-3 px-8 shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "10px 14px 10px 16px" }}
          >
            {verifyPending ? "Verifying…" : "Verify Code"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("email"); setOtpCode(""); setError(null); }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            ← Use a different email
          </button>
        </div>
      )}

      {/* ── Step 3: Payment options (after verification) ────────────────────── */}
      {step === "payment" && (
        <>
          {/* Verified badge + credit balance */}
          <div className="bg-white sketch-border p-5 space-y-3">
            <div
              className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2"
              style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
            >
              <span>✓</span>
              <span><strong>{email}</strong> verified</span>
            </div>

            {/* Credit balance (shown after lookup) */}
            {creditLookupPending && (
              <div
                className="flex items-center gap-2 text-xs text-gray-500 bg-amber-50 border border-amber-200 px-3 py-2"
                style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
              >
                <svg
                  className="h-3.5 w-3.5 animate-spin text-amber-500 shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span>Checking your credit balance…</span>
              </div>
            )}
            {creditBalance !== null && !creditLookupPending && (
              <div
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
                  canUseCredits
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
                style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
              >
                <span>✨</span>
                <span>
                  You have <strong>{creditBalance}</strong> credit{creditBalance !== 1 ? "s" : ""}.{" "}
                  {canUseCredits
                    ? `That's enough to cover all ${pageCount} pages!`
                    : `You need ${pageCount} credits for this mix.`}
                </span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p
              className="text-sm text-red-600 px-1"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {error}
            </p>
          )}

          {/* Pay with credits (if available) */}
          {canUseCredits && (
            <button
              type="button"
              onClick={handleCreditRedeem}
              disabled={payPending}
              className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold py-4 px-8 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "12px 16px 12px 18px" }}
            >
              {payPending ? "Processing…" : `✨ Use ${pageCount} Credits — Free!`}
            </button>
          )}

          {/* Pay with Stripe */}
          <button
            type="button"
            onClick={handleStripeCheckout}
            disabled={payPending}
            className="w-full bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 hover:from-pink-500 hover:via-purple-500 hover:to-blue-500 text-white font-bold py-4 px-8 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "12px 16px 12px 18px" }}
          >
            {payPending
              ? "Redirecting…"
              : canUseCredits
                ? `💳 Pay ${formatCents(totalCents)} Instead`
                : `💳 Pay ${formatCents(totalCents)} — Get My PDF`}
          </button>

          {/* Credits CTA */}
          <div className="text-center">
            <p
              className="text-xs text-gray-400"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              Want free pages? Opt-in your own book to the library and{" "}
              <Link href="/library/credits" className="underline text-amber-600 hover:text-amber-800">
                earn library credits
              </Link>{" "}
              when others download your pages. Library credits can be used to purchase mix-and-match coloring books from the library.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
