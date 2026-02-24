"use client";

import { useActionState, useState, useEffect } from "react";
import {
  createCheckoutSession,
  generatePreview,
  selectPreview,
  getOrderPreviewForReturn,
  type PreviewOption,
} from "@/app/actions";

const ADVENTURES = {
  space: {
    name: "Space Adventure",
    emoji: "🚀",
    prompt: "A magical journey through outer space with planets, stars, and friendly aliens",
    pagePrompt: "A magical journey through outer space with planets, stars, and friendly aliens. Scenes include: launching a rocket, meeting alien friends, walking on the moon, floating past Saturn's rings, and discovering a new planet.",
    scenes: ["Launching a rocket 🚀", "Meeting alien friends 👽", "Walking on the moon 🌕", "Floating past Saturn 🪐", "Discovering a new planet ⭐"],
    bg: "from-blue-50 to-purple-50",
    border: "border-blue-200",
    icon: (
      <svg className="w-10 h-10 mb-1" viewBox="0 0 40 40" fill="none">
        <path
          d="M20 4C20 4 28 12 28 24C28 28 24 32 20 36C16 32 12 28 12 24C12 12 20 4 20 4Z"
          fill="#e8f4fc"
          stroke="#5c4a3d"
          strokeWidth="2"
        />
        <circle cx="20" cy="18" r="4" fill="#7eb5c9" stroke="#5c4a3d" strokeWidth="1.5" />
        <path d="M12 24C8 26 6 30 6 30L12 28" fill="#f0a5b8" stroke="#5c4a3d" strokeWidth="1.5" />
        <path d="M28 24C32 26 34 30 34 30L28 28" fill="#f0a5b8" stroke="#5c4a3d" strokeWidth="1.5" />
        <path d="M17 34L20 40L23 34" fill="#ffd93d" stroke="#5c4a3d" strokeWidth="1.5" />
      </svg>
    ),
  },
  fantasy: {
    name: "Fantasy Quest",
    emoji: "🧙",
    prompt: "An epic adventure with friendly dragons, wizards, and magical creatures",
    pagePrompt: "An epic magical fantasy adventure with wizards, dragons, and enchanted creatures. Scenes include: taming a baby dragon, casting a magic spell, exploring an enchanted castle, finding a wizard's wand, and befriending a unicorn.",
    scenes: ["Taming a baby dragon 🐉", "Casting a magic spell ✨", "Exploring an enchanted castle 🏰", "Finding a wizard's wand 🪄", "Befriending a unicorn 🦄"],
    bg: "from-orange-50 to-red-50",
    border: "border-orange-200",
    icon: (
      <svg className="w-10 h-10 mb-1" viewBox="0 0 40 40" fill="none">
        {/* Wizard hat */}
        <path
          d="M20 4L10 28H30L20 4Z"
          fill="#a78bfa"
          stroke="#5c4a3d"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M7 28H33"
          stroke="#5c4a3d"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <ellipse cx="20" cy="28" rx="13" ry="3" fill="#c4b5fd" stroke="#5c4a3d" strokeWidth="1.5" />
        {/* Hat band */}
        <path
          d="M13 22H27"
          stroke="#ffd93d"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Stars */}
        <path
          d="M15 14L15.8 16.5L18 17L15.8 17.5L15 20L14.2 17.5L12 17L14.2 16.5L15 14Z"
          fill="#ffd93d"
          stroke="#5c4a3d"
          strokeWidth="0.8"
        />
        <circle cx="25" cy="16" r="1.5" fill="#f0a5b8" stroke="#5c4a3d" strokeWidth="0.8" />
        <circle cx="10" cy="18" r="1" fill="#7eb5c9" />
        <circle cx="30" cy="24" r="1" fill="#ffd93d" />
      </svg>
    ),
  },
  forest: {
    name: "Enchanted Forest",
    emoji: "🌲",
    prompt: "Exploring a magical forest with talking animals and fairy friends",
    pagePrompt: "Exploring a magical enchanted forest with talking animals, fairies, and woodland wonders. Scenes include: meeting a talking fox, finding a hidden fairy door, crossing a mossy bridge, picking magic mushrooms, and dancing with fireflies.",
    scenes: ["Meeting a talking fox 🦊", "Finding a fairy door 🚪", "Crossing a mossy bridge 🌿", "Picking magic mushrooms 🍄", "Dancing with fireflies 🌟"],
    bg: "from-green-50 to-emerald-50",
    border: "border-green-200",
    icon: (
      <svg className="w-10 h-10 mb-1" viewBox="0 0 40 40" fill="none">
        <path
          d="M20 4L28 18H24L30 28H10L16 18H12L20 4Z"
          fill="#e8f8ec"
          stroke="#5c4a3d"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect x="18" y="28" width="4" height="8" fill="#d4c4b0" stroke="#5c4a3d" strokeWidth="1.5" />
        <circle cx="16" cy="14" r="1" fill="#f0a5b8" />
        <circle cx="24" cy="16" r="1.5" fill="#7eb5c9" />
        <circle cx="18" cy="22" r="1" fill="#ffd93d" />
      </svg>
    ),
  },
  kingdom: {
    name: "Royal Kingdom",
    emoji: "🏰",
    prompt: "A royal adventure in a beautiful castle with knights and princesses",
    pagePrompt: "A royal castle adventure with knights, royalty, and hidden treasures. Scenes include: wearing the royal crown at a coronation, training with a brave knight, exploring the castle dungeon, attending a grand royal feast, and searching for buried treasure.",
    scenes: ["Wearing the royal crown 👑", "Training with a knight ⚔️", "Exploring the dungeon 🗝️", "Attending a royal feast 🍰", "Searching for treasure 💎"],
    bg: "from-purple-50 to-pink-50",
    border: "border-purple-200",
    icon: (
      <svg className="w-10 h-10 mb-1" viewBox="0 0 40 40" fill="none">
        <rect x="10" y="16" width="20" height="20" fill="#f8f0fc" stroke="#5c4a3d" strokeWidth="2" />
        <rect x="6" y="20" width="6" height="16" fill="#f8f0fc" stroke="#5c4a3d" strokeWidth="2" />
        <rect x="28" y="20" width="6" height="16" fill="#f8f0fc" stroke="#5c4a3d" strokeWidth="2" />
        <path d="M8 20L6 16H12L10 20" fill="#f0a5b8" stroke="#5c4a3d" strokeWidth="1.5" />
        <path d="M30 20L28 16H34L32 20" fill="#f0a5b8" stroke="#5c4a3d" strokeWidth="1.5" />
        <path d="M20 16L16 8H24L20 16Z" fill="#ffd93d" stroke="#5c4a3d" strokeWidth="1.5" />
        <rect x="17" y="26" width="6" height="10" rx="3" fill="#7eb5c9" stroke="#5c4a3d" strokeWidth="1.5" />
        <rect x="13" y="20" width="3" height="4" fill="#a8d4e6" />
        <rect x="24" y="20" width="3" height="4" fill="#a8d4e6" />
      </svg>
    ),
  },
} as const;

type AdventureKey = keyof typeof ADVENTURES;

type PreviewState = {
  orderId: string;
  previews: PreviewOption[];
  selectedIndex: number | null;
  selectedImageUrl: string | null;
  selectedSeed: number | null;
  characterName: string;
  description: string;
  theme: string;
  /** Full theme sent to createCheckoutSession for page generation (includes scene hints) */
  pageTheme: string;
};

const TIER_DESCRIPTIONS = {
  standard: {
    title: "Standard — $12",
    desc: "Your character and scenes are designed with our standard AI. Great for most characters and themes.",
  },
  premium: {
    title: "Premium — $25",
    desc: "Upgraded AI designs your character and scenes with stronger consistency and a richer storybook feel across every page.",
  },
} as const;

export function CheckoutForm({
  initialCanceledOrderId = null,
}: {
  initialCanceledOrderId?: string | null;
}) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [selectPending, setSelectPending] = useState(false);
  const [theme, setTheme] = useState("");
  const [pageTheme, setPageTheme] = useState("");
  const [selectedAdventure, setSelectedAdventure] = useState<AdventureKey | null>(null);

  useEffect(() => {
    if (!initialCanceledOrderId) return;
    let cancelled = false;
    getOrderPreviewForReturn(initialCanceledOrderId).then((data) => {
      if (cancelled || !data) return;
      const idx =
        data.previews.length && data.selectedImageUrl
          ? data.previews.findIndex(
              (p) =>
                p.imageUrl === data.selectedImageUrl || p.seed === data.selectedSeed
            )
          : -1;
      setPreview({
        orderId: data.orderId,
        previews: data.previews,
        selectedIndex: idx >= 0 ? idx : null,
        selectedImageUrl: data.selectedImageUrl,
        selectedSeed: data.selectedSeed,
        characterName: data.characterName,
        description: data.description,
        theme: data.theme,
        pageTheme: data.theme, // canceled order: reuse stored theme as-is
      });
    });
    return () => {
      cancelled = true;
    };
  }, [initialCanceledOrderId]);

  const [checkoutError, formAction, isCheckoutPending] = useActionState(
    async (_prevState: string | null, formData: FormData) => {
      try {
        await createCheckoutSession(formData);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "Something went wrong";
      }
    },
    null,
  );

  const handleGeneratePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPreviewError(null);
    setPreviewPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const result = await generatePreview(formData);
      setPreview({
        orderId: result.orderId,
        previews: result.previews,
        selectedIndex: null,
        selectedImageUrl: null,
        selectedSeed: null,
        characterName: result.characterName,
        description: result.description,
        theme: result.theme,
        // Use the detailed pagePrompt (with scene hints) for book generation;
        // fall back to the plain theme if no adventure was selected
        pageTheme: pageTheme || result.theme,
      });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to generate preview.");
    } finally {
      setPreviewPending(false);
    }
  };

  const handleSelectPreview = async (index: number) => {
    if (!preview) return;
    setSelectPending(true);
    try {
      await selectPreview(preview.orderId, index);
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              selectedIndex: index,
              selectedImageUrl: prev.previews[index]?.imageUrl ?? null,
              selectedSeed: prev.previews[index]?.seed ?? null,
            }
          : null
      );
    } finally {
      setSelectPending(false);
    }
  };

  const handleSelectAdventure = (key: AdventureKey) => {
    if (selectedAdventure === key) {
      setSelectedAdventure(null);
      setTheme("");
      setPageTheme("");
    } else {
      setSelectedAdventure(key);
      setTheme(ADVENTURES[key].prompt);
      setPageTheme(ADVENTURES[key].pagePrompt);
    }
  };

  // ── Step 2: Preview picker + tier + checkout ─────────────────────────────
  if (preview) {
    const canCheckout = preview.selectedIndex !== null;
    return (
      <div className="px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Preview picker */}
          <div className="bg-white sketch-border p-6">
            <h2
              className="text-2xl font-bold text-gray-800 mb-1"
              style={{ fontFamily: "var(--font-caveat), cursive" }}
            >
              🎨 Pick Your Character
            </h2>
            <p
              className="text-sm text-gray-500 mb-4"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              Choose the style you love most — we&apos;ll use it throughout your entire book.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {preview.previews.map((p: PreviewOption, i: number) => (
                <button
                  key={p.seed}
                  type="button"
                  onClick={() => handleSelectPreview(i)}
                  disabled={selectPending}
                  className={`character-option relative aspect-square w-full overflow-hidden bg-white border-2 border-amber-200 rounded-lg p-1 transition-all focus:outline-none disabled:opacity-50 ${
                    preview.selectedIndex === i ? "selected" : ""
                  }`}
                  style={{ borderRadius: "6px 10px 6px 12px" }}
                >
                  <img
                    src={p.imageUrl}
                    alt={`Preview ${i + 1}`}
                    className="h-full w-full object-cover rounded"
                  />
                  {preview.selectedIndex === i && (
                    <span
                      className="absolute bottom-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-white"
                      style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                    >
                      ✓ Chosen!
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tier + checkout */}
          <div className="bg-white sketch-border p-6">
            <h3
              className="text-xl font-bold text-gray-800 mb-3"
              style={{ fontFamily: "var(--font-caveat), cursive" }}
            >
              📖 Choose Your Book
            </h3>
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="orderId" value={preview.orderId} />
              <input type="hidden" name="characterName" value={preview.characterName} />
              <input type="hidden" name="description" value={preview.description} />
              <input type="hidden" name="theme" value={preview.pageTheme || preview.theme} />

              <div className="space-y-3">
                {(["standard", "premium"] as const).map((tier) => {
                  const t = TIER_DESCRIPTIONS[tier];
                  return (
                    <label
                      key={tier}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-amber-200 bg-amber-50/40 p-4 transition-all hover:bg-amber-50"
                      style={{ borderRadius: "8px 12px 8px 14px" }}
                    >
                      <input
                        type="radio"
                        name="priceTier"
                        value={tier}
                        defaultChecked={tier === "standard"}
                        className="mt-0.5 h-4 w-4 accent-amber-500"
                      />
                      <div>
                        <span
                          className="font-bold text-gray-800"
                          style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.1rem" }}
                        >
                          {t.title}
                        </span>
                        <p
                          className="mt-0.5 text-xs text-gray-500"
                          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                        >
                          {t.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {checkoutError && (
                <p
                  className="text-sm text-red-600"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  {checkoutError}
                </p>
              )}

              <button
                type="submit"
                disabled={isCheckoutPending || !canCheckout}
                className="w-full bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 hover:from-amber-500 hover:via-pink-500 hover:to-purple-500 text-white font-bold py-4 px-8 shadow-lg hover:shadow-xl transition-all duration-300 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  fontFamily: "var(--font-nunito), sans-serif",
                  borderRadius: "12px 16px 12px 18px",
                }}
              >
                {isCheckoutPending
                  ? "Redirecting to checkout..."
                  : !canCheckout
                    ? "⬆️ Pick a character first"
                    : "✨ Create My Coloring Book ✨"}
              </button>
            </form>
          </div>

          <button
            type="button"
            onClick={() => setPreview(null)}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-opacity"
            style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1rem" }}
          >
            ← Back to edit character
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Sketchbook input form ────────────────────────────────────────
  return (
    <form onSubmit={handleGeneratePreview} className="px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Sketchbook card */}
        <div className="relative bg-amber-50/50 sketch-border p-1">
          {/* Binding spine */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 sketchbook-binding z-10 pointer-events-none hidden md:block" />

          <div className="grid md:grid-cols-2 gap-1">
            {/* Left page — Who is the Star? */}
            <div className="bg-white p-6 rounded-l-lg relative overflow-hidden">
              <div
                className="absolute inset-x-6 top-20 bottom-6 opacity-20 pointer-events-none"
                style={{
                  background:
                    "repeating-linear-gradient(transparent, transparent 27px, #b8a99a 28px)",
                }}
              />
              <div className="relative z-10">
                <h2
                  className="text-2xl font-bold text-gray-800 mb-1"
                  style={{ fontFamily: "var(--font-caveat), cursive" }}
                >
                  Who is the Star?
                </h2>
                <p
                  className="text-sm text-gray-500 mb-4"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  Describe your little one&apos;s character
                </p>

                {/* Character name */}
                <div className="mb-3">
                  <input
                    type="text"
                    name="characterName"
                    placeholder="Character name (e.g. Emma)"
                    className="w-full sketch-input px-4 py-2.5 text-gray-700 text-sm"
                    style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                  />
                </div>

                {/* Description textarea */}
                <div className="mb-4">
                  <textarea
                    name="description"
                    required
                    rows={3}
                    placeholder="A brave little girl with curly red hair and freckles..."
                    className="w-full sketch-input px-4 py-3 text-gray-700 resize-none"
                    style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                  />
                </div>

                {/* Character preview frame */}
                <div className="relative">
                  <div
                    className="border-4 border-dashed border-amber-300 bg-amber-50/30 p-4 min-h-[160px]"
                    style={{ borderRadius: "12px 16px 10px 18px" }}
                  >
                    {/* Corner decorations */}
                    <svg
                      className="absolute -top-2 -left-2 w-6 h-6 text-amber-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 20C4 12 12 4 20 4" />
                    </svg>
                    <svg
                      className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 rotate-90"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 20C4 12 12 4 20 4" />
                    </svg>
                    <svg
                      className="absolute -bottom-2 -left-2 w-6 h-6 text-amber-400 -rotate-90"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 20C4 12 12 4 20 4" />
                    </svg>
                    <svg
                      className="absolute -bottom-2 -right-2 w-6 h-6 text-amber-400 rotate-180"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 20C4 12 12 4 20 4" />
                    </svg>

                    <div className="flex items-center justify-center min-h-[128px]">
                      {previewPending ? (
                        <div className="text-center">
                          <div className="inline-block animate-spin w-12 h-12 border-4 border-pink-200 border-t-pink-500 rounded-full mb-2" />
                          <p
                            className="text-sm text-gray-500"
                            style={{ fontFamily: "var(--font-caveat), cursive" }}
                          >
                            Creating your hero...
                          </p>
                        </div>
                      ) : (
                        <div className="text-center text-gray-400">
                          <svg
                            className="w-16 h-16 mx-auto mb-2 opacity-40"
                            viewBox="0 0 64 64"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <circle cx="32" cy="20" r="12" />
                            <path d="M16 52C16 40 24 32 32 32C40 32 48 40 48 52" />
                            <path
                              d="M24 18C24 18 28 22 32 22C36 22 40 18 40 18"
                              strokeLinecap="round"
                            />
                            <circle cx="27" cy="18" r="1.5" fill="currentColor" />
                            <circle cx="37" cy="18" r="1.5" fill="currentColor" />
                          </svg>
                          <p
                            className="text-sm"
                            style={{ fontFamily: "var(--font-caveat), cursive" }}
                          >
                            Your character will appear here!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right page — Where are we going? */}
            <div className="bg-white p-6 rounded-r-lg relative overflow-hidden">
              <div
                className="absolute inset-x-6 top-20 bottom-6 opacity-20 pointer-events-none"
                style={{
                  background:
                    "repeating-linear-gradient(transparent, transparent 27px, #b8a99a 28px)",
                }}
              />
              <div className="relative z-10">
                <h2
                  className="text-2xl font-bold text-gray-800 mb-1"
                  style={{ fontFamily: "var(--font-caveat), cursive" }}
                >
                  Where are we going?
                </h2>
                <p
                  className="text-sm text-gray-500 mb-4"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  Choose an adventure or describe your own
                </p>

                {/* Theme input with clear button */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    name="theme"
                    value={theme}
                    onChange={(e) => {
                      setTheme(e.target.value);
                      setPageTheme(e.target.value);
                      setSelectedAdventure(null);
                    }}
                    placeholder="A magical journey through an enchanted forest..."
                    className="w-full sketch-input px-4 py-3 pr-9 text-gray-700"
                    style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                  />
                  {theme && (
                    <button
                      type="button"
                      onClick={() => {
                        setTheme("");
                        setPageTheme("");
                        setSelectedAdventure(null);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Clear theme"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Adventure shortcuts */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {(
                    Object.entries(ADVENTURES) as [
                      AdventureKey,
                      (typeof ADVENTURES)[AdventureKey],
                    ][]
                  ).map(([key, adv]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectAdventure(key)}
                      className={`adventure-btn flex flex-col items-center p-3 bg-gradient-to-b ${adv.bg} border-2 ${adv.border} rounded-xl${selectedAdventure === key ? " selected" : ""}`}
                      style={{ borderRadius: "8px 12px 8px 14px" }}
                    >
                      {adv.icon}
                      <span
                        className="text-xs font-semibold text-gray-600"
                        style={{ fontFamily: "var(--font-caveat), cursive" }}
                      >
                        {adv.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Adventure / custom theme overview */}
                {selectedAdventure ? (
                  <div
                    className={`bg-gradient-to-br ${ADVENTURES[selectedAdventure].bg} border-2 ${ADVENTURES[selectedAdventure].border} p-4`}
                    style={{ borderRadius: "10px 14px 10px 16px" }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 opacity-90">
                        {ADVENTURES[selectedAdventure].icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-bold text-gray-800 text-lg leading-tight"
                          style={{ fontFamily: "var(--font-caveat), cursive" }}
                        >
                          {ADVENTURES[selectedAdventure].emoji}{" "}
                          {ADVENTURES[selectedAdventure].name}
                        </p>
                        <p
                          className="text-xs text-gray-500 mt-0.5 mb-2"
                          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                        >
                          Your book could include scenes like…
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {ADVENTURES[selectedAdventure].scenes.map((scene) => (
                            <span
                              key={scene}
                              className="inline-block bg-white/70 border border-white/80 rounded-full px-2 py-0.5 text-xs text-gray-700"
                              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                            >
                              {scene}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : theme.trim() ? (
                  <div
                    className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-4"
                    style={{ borderRadius: "10px 14px 10px 16px" }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl shrink-0">✏️</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-bold text-gray-800 text-lg leading-tight"
                          style={{ fontFamily: "var(--font-caveat), cursive" }}
                        >
                          Your Adventure
                        </p>
                        <p
                          className="text-xs text-gray-600 mt-1 leading-relaxed"
                          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                        >
                          {theme}
                        </p>
                        <p
                          className="text-xs text-gray-400 mt-2"
                          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                        >
                          We'll craft 20 unique scenes around this theme ✨
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="bg-white sketch-border p-6">
          {previewError && (
            <p
              className="mb-4 text-sm text-red-600"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {previewError}
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <p
              className="text-sm text-gray-500 max-w-xs text-center sm:text-left"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              20 hand-crafted scenes · consistent character · printable PDF
            </p>
            <div className="text-right shrink-0">
              <div className="flex items-baseline gap-2 justify-end">
                <span
                  className="text-3xl font-bold text-gray-800"
                  style={{ fontFamily: "var(--font-caveat), cursive" }}
                >
                  from $12
                </span>
              </div>
              <p
                className="text-xs text-gray-400"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                Instant download
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={previewPending}
            className="w-full bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 hover:from-amber-500 hover:via-pink-500 hover:to-purple-500 text-white font-bold py-4 px-8 shadow-lg hover:shadow-xl transition-all duration-300 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              fontFamily: "var(--font-nunito), sans-serif",
              borderRadius: "12px 16px 12px 18px",
            }}
          >
            {previewPending
              ? "✨ Generating your character… (takes ~30s)"
              : "✨ Preview My Character →"}
          </button>

          <p
            className="mt-4 text-center text-xs text-gray-400"
            style={{ fontFamily: "var(--font-nunito), sans-serif" }}
          >
            Powered by Flux.1 &middot; Delivered as a printable PDF &middot;{" "}
            <a href="/orders" className="text-pink-400 hover:text-pink-500">
              Already ordered? Look up your order →
            </a>
          </p>
        </div>
      </div>
    </form>
  );
}
