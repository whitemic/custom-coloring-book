"use client";

import { useActionState, useState, useEffect } from "react";
import {
  createCheckoutSession,
  generatePreview,
  selectPreview,
  getOrderPreviewForReturn,
  type PreviewOption,
} from "@/app/actions";

type PreviewState = {
  orderId: string;
  previews: PreviewOption[];
  selectedIndex: number | null;
  selectedImageUrl: string | null;
  selectedSeed: number | null;
  characterName: string;
  description: string;
  theme: string;
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

  if (preview) {
    const canCheckout = preview.selectedIndex !== null;
    return (
      <div className="mx-auto mt-10 w-full max-w-md text-left">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Pick your favorite character preview
          </p>
          <div className="grid grid-cols-3 gap-2">
            {preview.previews.map((p, i) => (
              <button
                key={p.seed}
                type="button"
                onClick={() => handleSelectPreview(i)}
                disabled={selectPending}
                className={`relative aspect-square w-full overflow-hidden rounded-lg border-2 object-cover transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                  preview.selectedIndex === i
                    ? "border-indigo-600 ring-2 ring-indigo-600"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <img
                  src={p.imageUrl}
                  alt={`Preview ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                {preview.selectedIndex === i && (
                  <span className="absolute bottom-1 right-1 rounded bg-indigo-600 px-1.5 py-0.5 text-xs font-medium text-white">
                    Selected
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="orderId" value={preview.orderId} />
          <input type="hidden" name="characterName" value={preview.characterName} />
          <input type="hidden" name="description" value={preview.description} />
          <input type="hidden" name="theme" value={preview.theme} />
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Choose your tier
            </label>
            <div className="mt-2 space-y-2">
              <label className="flex cursor-pointer flex-col gap-1 rounded-lg border border-zinc-300 p-3 dark:border-zinc-600">
                <div className="flex items-center gap-3">
                  <input type="radio" name="priceTier" value="standard" defaultChecked className="h-4 w-4" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {TIER_DESCRIPTIONS.standard.title}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {TIER_DESCRIPTIONS.standard.desc}
                </p>
              </label>
              <label className="flex cursor-pointer flex-col gap-1 rounded-lg border border-zinc-300 p-3 dark:border-zinc-600">
                <div className="flex items-center gap-3">
                  <input type="radio" name="priceTier" value="premium" className="h-4 w-4" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {TIER_DESCRIPTIONS.premium.title}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {TIER_DESCRIPTIONS.premium.desc}
                </p>
              </label>
            </div>
          </div>
          {checkoutError && (
            <p className="text-sm text-red-600 dark:text-red-400">{checkoutError}</p>
          )}
          <button
            type="submit"
            disabled={isCheckoutPending || !canCheckout}
            className="mt-4 w-full rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCheckoutPending
              ? "Redirecting to checkout..."
              : !canCheckout
                ? "Select a preview above"
                : "Continue to checkout"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setPreview(null)}
          className="mt-4 w-full text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          ← Back to edit character
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleGeneratePreview} className="mx-auto mt-10 w-full max-w-md text-left">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="characterName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Character Name
          </label>
          <input
            type="text"
            id="characterName"
            name="characterName"
            placeholder="e.g. Emma"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Describe Your Main Character <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={3}
            placeholder="e.g. A young girl with curly hair in pigtails, wearing overalls with rain boots and a big floppy hat"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="theme"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Theme / Adventure
          </label>
          <input
            type="text"
            id="theme"
            name="theme"
            placeholder="e.g. dinosaur adventure, underwater kingdom, space explorer"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {previewError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{previewError}</p>
      )}

      <button
        type="submit"
        disabled={previewPending}
        className="mt-6 w-full rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {previewPending ? "Generating 3 previews..." : "Generate previews"}
      </button>
    </form>
  );
}
