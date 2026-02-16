"use client";

import { useActionState } from "react";
import { createCheckoutSession } from "@/app/actions";

export function CheckoutForm() {
  const [error, formAction, isPending] = useActionState(
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

  return (
    <form action={formAction} className="mx-auto mt-10 w-full max-w-md text-left">
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

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 w-full rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Redirecting to checkout..." : "Create Your Book — $9.99"}
      </button>
    </form>
  );
}
