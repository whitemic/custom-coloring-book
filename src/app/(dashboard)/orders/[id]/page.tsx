import { notFound, redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { getOrderBySessionId, getPagesByOrderId } from "@/lib/supabase/queries";
import type { OrderStatus, OrderRow, PageRow } from "@/types/database";
import { OrderDetailRefresh } from "./OrderDetailRefresh";
import { PendingOrderView } from "./PendingOrderView";

const STATUS_LABELS: Record<OrderStatus, { label: string; description: string }> = {
  pending_payment: {
    label: "Awaiting payment",
    description: "Complete checkout to start your coloring book.",
  },
  pending: {
    label: "Setting things up",
    description: "Your order has been received and we're preparing to generate your coloring book.",
  },
  manifest_generated: {
    label: "Designing your character",
    description: "Your character has been designed. Page generation is about to begin.",
  },
  generating: {
    label: "Generating your book",
    description: "Our AI illustrator is drawing each page of your coloring book. This can take a few minutes.",
  },
  complete: {
    label: "Ready to download!",
    description: "Your coloring book is finished and ready to print.",
  },
  failed: {
    label: "Something went wrong",
    description: "We ran into a problem generating your book. Please contact support.",
  },
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { id } = await params;
  const { session_id: sessionId } = await searchParams;

  // Post-checkout: show order-detail-style pending view and poll for order
  if (id === "pending" && sessionId) {
    return <PendingOrderView sessionId={sessionId} />;
  }
  if (id === "pending") {
    redirect("/orders");
  }

  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let order: OrderRow | null = null;
  let pages: PageRow[] = [];

  if (user) {
    // Authenticated: use RLS-protected queries
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError || !orderData) {
      notFound();
    }
    order = orderData as OrderRow;

    const { data: pagesData } = await supabase
      .from("pages")
      .select("*")
      .eq("order_id", id)
      .order("page_number", { ascending: true });
    pages = (pagesData ?? []) as PageRow[];
  } else if (sessionId) {
    // Post-checkout: allow access if session_id matches this order
    const sessionOrder = await getOrderBySessionId(sessionId);
    if (!sessionOrder || (sessionOrder.id as string) !== id) {
      redirect("/orders");
    }
    order = sessionOrder;
    pages = await getPagesByOrderId(id);
  } else {
    redirect("/orders");
  }

  if (!order) {
    notFound();
  }
  const completedPages = pages.filter((p) => p.status === "complete");
  const totalPages = pages.length;
  const progress = totalPages > 0 ? Math.round((completedPages.length / totalPages) * 100) : 0;

  const status = order.status as OrderStatus;
  const statusInfo = STATUS_LABELS[status];
  const isProcessing = ["pending", "manifest_generated", "generating"].includes(status);

  // Extract the buyer's original request from the stored metadata
  const userInput = order.user_input as Record<string, string> | null;
  const characterName = userInput?.character_name || null;
  const characterDescription = userInput?.user_input || null;
  const theme = userInput?.theme || null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-white px-6 py-16 dark:bg-zinc-950">
      <OrderDetailRefresh isProcessing={isProcessing} />
      <main className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {statusInfo.label}
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {statusInfo.description}
            </p>
          </div>
          <span
            className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              status === "complete"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : status === "failed"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
            }`}
          >
            {status.replace("_", " ")}
          </span>
        </div>

        {/* Order info */}
        <dl className="mt-8 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-500">Order ID</dt>
            <dd className="mt-1 font-mono text-xs text-zinc-900 dark:text-zinc-100">
              {(order.id as string).slice(0, 8)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-500">Date</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
              {new Date(order.created_at as string).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-500">Amount</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
              ${((order.amount_cents ?? 0) / 100).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-500">Email</dt>
            <dd className="mt-1 truncate text-zinc-900 dark:text-zinc-100">
              {order.stripe_customer_email ?? "—"}
            </dd>
          </div>
        </dl>

        {/* What you ordered */}
        {characterDescription && (
          <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-500">
              Your Request
            </h2>
            <div className="mt-3 space-y-2 text-sm">
              {characterName && (
                <div className="flex gap-2">
                  <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">
                    Character:
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {characterName}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">
                  Description:
                </span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {characterDescription}
                </span>
              </div>
              {theme && (
                <div className="flex gap-2">
                  <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">
                    Theme:
                  </span>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {theme}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {totalPages > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Pages completed
              </span>
              <span className="text-zinc-500 dark:text-zinc-500">
                {completedPages.length} of {totalPages}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Download button */}
        {status === "complete" && order.pdf_url && (
          <a
            href={order.pdf_url as string}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Download Your Coloring Book (PDF)
          </a>
        )}

        {/* Hint for in-progress orders (page auto-updates every 15s) */}
        {isProcessing && (
          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
            Generation can take a few minutes. This page updates automatically
            every 15 seconds.
          </p>
        )}

        {/* Page thumbnails */}
        {completedPages.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Preview
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
              {completedPages.map((page) => (
                <div
                  key={page.id as string}
                  className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {page.image_url ? (
                    <img
                      src={page.image_url as string}
                      alt={`Page ${page.page_number}`}
                      className="aspect-3/4 w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-3/4 items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600">
                      Page {page.page_number as number}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back link */}
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
