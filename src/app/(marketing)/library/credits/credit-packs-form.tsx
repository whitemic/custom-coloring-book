"use client";

import { useState, useTransition } from "react";
import { createCreditPurchaseSession, sendEmailOtp, verifyEmailOtp } from "../actions";

const PACKS = [
  {
    credits: 10,
    amountCents: 500,
    label: "Starter",
    highlight: false,
    perCredit: "$0.50/credit",
    badge: null,
  },
  {
    credits: 20,
    amountCents: 800,
    label: "Popular",
    highlight: true,
    perCredit: "$0.40/credit",
    badge: "20% off",
  },
  {
    credits: 50,
    amountCents: 1800,
    label: "Value Pack",
    highlight: false,
    perCredit: "$0.36/credit",
    badge: "28% off",
  },
] as const;

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type Step = "email" | "otp" | "payment";

export function CreditPacksForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [selectedPack, setSelectedPack] = useState<(typeof PACKS)[number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otpPending, startOtpTransition] = useTransition();
  const [verifyPending, startVerifyTransition] = useTransition();
  const [buyPending, startBuyTransition] = useTransition();

  // ── Step 1 → 2: send OTP ─────────────────────────────────────────────────
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

  // ── Step 2 → 3: verify OTP ───────────────────────────────────────────────
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
        setStep("payment");
      }
    });
  };

  // ── Step 3: buy the pack ─────────────────────────────────────────────────
  const handleBuy = () => {
    setError(null);
    if (!selectedPack) {
      setError("Please select a credit pack.");
      return;
    }
    startBuyTransition(async () => {
      try {
        await createCreditPurchaseSession(
          email.trim(),
          selectedPack.credits,
          selectedPack.amountCents,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="bg-white sketch-border p-5 space-y-5">
      <h2
        className="text-xl font-bold text-gray-800"
        style={{ fontFamily: "var(--font-caveat), cursive" }}
      >
        Buy Credits
      </h2>

      {/* Pack selector — always visible so users can browse before verifying */}
      <div className="grid sm:grid-cols-3 gap-3">
        {PACKS.map((pack) => {
          const selected = selectedPack?.credits === pack.credits;
          return (
            <button
              key={pack.credits}
              type="button"
              onClick={() => setSelectedPack(pack)}
              className={`relative flex flex-col items-center gap-1 p-4 border-2 transition-all focus:outline-none ${
                selected
                  ? "border-amber-400 bg-amber-50 shadow-md shadow-amber-100"
                  : pack.highlight
                    ? "border-pink-200 bg-pink-50/30 hover:border-pink-400"
                    : "border-amber-100 bg-white hover:border-amber-300"
              }`}
              style={{ borderRadius: "8px 12px 8px 14px" }}
            >
              {pack.badge && (
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-pink-400 text-white text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  {pack.badge}
                </span>
              )}
              <span
                className="text-3xl font-bold text-gray-800"
                style={{ fontFamily: "var(--font-caveat), cursive" }}
              >
                {pack.credits}
              </span>
              <span
                className="text-xs text-gray-500"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                credits
              </span>
              <span
                className="text-lg font-bold text-gray-700 mt-1"
                style={{ fontFamily: "var(--font-caveat), cursive" }}
              >
                {formatCents(pack.amountCents)}
              </span>
              <span
                className="text-xs text-gray-400"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                {pack.perCredit}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Step 1: Email input ─────────────────────────────────────────────── */}
      {step === "email" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label
              className="block text-sm font-semibold text-gray-700"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              Your email — credits will be linked to this address
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
        <div className="space-y-3">
          <div>
            <p
              className="text-sm font-semibold text-gray-700 mb-1"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              Check your inbox
            </p>
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

      {/* ── Step 3: Buy button (after verification) ──────────────────────────── */}
      {step === "payment" && (
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2"
            style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "8px 12px 8px 14px" }}
          >
            <span>✓</span>
            <span><strong>{email}</strong> verified</span>
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
            onClick={handleBuy}
            disabled={buyPending || !selectedPack}
            className="w-full bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 hover:from-amber-500 hover:via-pink-500 hover:to-purple-500 text-white font-bold py-4 px-8 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-nunito), sans-serif", borderRadius: "12px 16px 12px 18px" }}
          >
            {buyPending
              ? "Redirecting to checkout…"
              : selectedPack
                ? `✨ Buy ${selectedPack.credits} Credits — ${formatCents(selectedPack.amountCents)}`
                : "Select a pack above"}
          </button>
        </div>
      )}
    </div>
  );
}
