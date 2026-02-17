import { CheckoutForm } from "@/components/checkout-form";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; order_id?: string }>;
}) {
  const params = await searchParams;
  const initialCanceledOrderId =
    params.canceled === "1" && params.order_id ? params.order_id : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16 dark:bg-zinc-950">
      <main className="mx-auto max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          A Coloring Book Starring{" "}
          <span className="text-indigo-600 dark:text-indigo-400">
            Your Character
          </span>
        </h1>

        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Describe your main character&apos;s look and pick a theme. Our AI
          illustrator creates a 20-page coloring book PDF with a consistent
          main character &mdash; delivered to your inbox in minutes.
        </p>

        <CheckoutForm initialCanceledOrderId={initialCanceledOrderId} />

        <p className="mt-16 text-xs text-zinc-400 dark:text-zinc-600">
          Powered by Flux.1 &middot; Delivered as a printable PDF
          <br />
          <a
            href="/orders"
            className="mt-1 inline-block text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Already ordered? Look up your order &rarr;
          </a>
        </p>
      </main>
    </div>
  );
}
