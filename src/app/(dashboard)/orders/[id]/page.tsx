import { notFound, redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { getOrderBySessionId, getPagesByOrderId } from "@/lib/supabase/queries";
import type { OrderStatus, OrderRow, PageRow } from "@/types/database";
import { AutoRefresh } from "./auto-refresh";
import { PendingOrderView } from "./PendingOrderView";

const STATUS_LABELS: Record<
  OrderStatus,
  { label: string; description: string; emoji: string; bg: string; border: string }
> = {
  pending_payment: {
    emoji: "💳",
    label: "Awaiting payment",
    description: "Complete checkout to start your coloring book.",
    bg: "from-gray-50 to-slate-50",
    border: "border-gray-200",
  },
  pending: {
    emoji: "⏳",
    label: "Getting things ready…",
    description:
      "Your order has been received and we're preparing to generate your coloring book.",
    bg: "from-amber-50 to-yellow-50",
    border: "border-amber-200",
  },
  manifest_generated: {
    emoji: "✏️",
    label: "Designing your character",
    description:
      "Your character has been designed. Page generation is about to begin.",
    bg: "from-blue-50 to-sky-50",
    border: "border-blue-200",
  },
  generating: {
    emoji: "🖌️",
    label: "Drawing your pages",
    description:
      "Our AI illustrator is drawing each page of your coloring book. This can take a few minutes.",
    bg: "from-purple-50 to-fuchsia-50",
    border: "border-purple-200",
  },
  complete: {
    emoji: "🎉",
    label: "Ready to download!",
    description: "Your coloring book is finished and ready to print.",
    bg: "from-green-50 to-emerald-50",
    border: "border-green-200",
  },
  failed: {
    emoji: "😢",
    label: "Something went wrong",
    description:
      "We ran into a problem generating your book. Please contact support.",
    bg: "from-red-50 to-rose-50",
    border: "border-red-200",
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

  // Post-checkout: show pending view and poll for order creation
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
  const progress =
    totalPages > 0 ? Math.round((completedPages.length / totalPages) * 100) : 0;

  const status = order.status as OrderStatus;
  const statusInfo = STATUS_LABELS[status];
  const isProcessing = ["pending", "manifest_generated", "generating"].includes(
    status,
  );

  // Extract the buyer's original request from the stored metadata
  const userInput = order.user_input as Record<string, string> | null;
  const characterName = userInput?.character_name || null;
  const characterDescription = userInput?.user_input || null;
  const theme = userInput?.theme || null;

  return (
    <div className="flex min-h-screen flex-col paper-bg">
      <main className="mx-auto w-full max-w-3xl px-6 pb-20 pt-4">
        {/* Status header */}
        <div className={`sketch-border rounded-3xl bg-gradient-to-br ${statusInfo.bg} border-2 ${statusInfo.border} p-7`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="text-5xl leading-none">{statusInfo.emoji}</span>
              <div>
                <h1
                  className="text-4xl font-bold leading-tight"
                  style={{
                    fontFamily: "var(--font-caveat), cursive",
                    color: "#92400e",
                  }}
                >
                  {statusInfo.label}
                </h1>
                <p
                  className="mt-1.5 text-sm text-zinc-600"
                  style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                >
                  {statusInfo.description}
                </p>
              </div>
            </div>
            <span
              className={`mt-1 inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                status === "complete"
                  ? "bg-green-100 text-green-700"
                  : status === "failed"
                    ? "bg-red-100 text-red-700"
                    : "bg-white/70 text-amber-700"
              }`}
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {status.replace("_", " ")}
            </span>
          </div>
          {/* Auto-refresh lives inside the status card when in-progress */}
          {isProcessing && <AutoRefresh />}
        </div>

        {/* Order info grid */}
        <dl
          className="mt-5 sketch-border grid grid-cols-2 gap-4 rounded-3xl bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 p-5 text-sm sm:grid-cols-4"
        >
          <div>
            <dt
              className="text-xs font-semibold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-nunito), sans-serif",
                color: "#a8856b",
              }}
            >
              Order ID
            </dt>
            <dd className="mt-1 font-mono text-xs text-zinc-900">
              {(order.id as string).slice(0, 8)}
            </dd>
          </div>
          <div>
            <dt
              className="text-xs font-semibold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-nunito), sans-serif",
                color: "#a8856b",
              }}
            >
              Date
            </dt>
            <dd
              className="mt-1 text-zinc-900"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {new Date(order.created_at as string).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt
              className="text-xs font-semibold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-nunito), sans-serif",
                color: "#a8856b",
              }}
            >
              Amount
            </dt>
            <dd
              className="mt-1 text-zinc-900"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              ${((order.amount_cents ?? 0) / 100).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt
              className="text-xs font-semibold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-nunito), sans-serif",
                color: "#a8856b",
              }}
            >
              Email
            </dt>
            <dd
              className="mt-1 truncate text-zinc-900"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {order.stripe_customer_email ?? "—"}
            </dd>
          </div>
        </dl>

        {/* What you ordered */}
        {characterDescription && (
          <div className="mt-5 sketch-border rounded-3xl bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-200 p-5">
            <h2
              className="text-xl font-bold"
              style={{
                fontFamily: "var(--font-caveat), cursive",
                color: "#92400e",
              }}
            >
              📖 Your Request
            </h2>
            <div
              className="mt-3 space-y-2 text-sm"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {characterName && (
                <div className="flex gap-2">
                  <span className="shrink-0 font-bold text-amber-700">
                    Character:
                  </span>
                  <span className="text-zinc-800">{characterName}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="shrink-0 font-bold text-amber-700">
                  Description:
                </span>
                <span className="text-zinc-800">{characterDescription}</span>
              </div>
              {theme && (
                <div className="flex gap-2">
                  <span className="shrink-0 font-bold text-amber-700">
                    Theme:
                  </span>
                  <span className="text-zinc-800">{theme}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {totalPages > 0 && (
          <div className="mt-5 sketch-border rounded-3xl bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 p-5">
            <div className="flex items-center justify-between text-sm">
              <span
                className="font-bold"
                style={{
                  fontFamily: "var(--font-caveat), cursive",
                  color: "#92400e",
                  fontSize: "1.15rem",
                }}
              >
                🎨 Pages completed
              </span>
              <span
                className="text-zinc-500"
                style={{ fontFamily: "var(--font-nunito), sans-serif" }}
              >
                {completedPages.length} of {totalPages}
              </span>
            </div>
            {/* Track: neutral so an empty bar doesn't look "done" */}
            <div
              className="mt-3 h-5 w-full overflow-hidden rounded-full bg-white/70"
              style={{ border: "2px solid #ddd6fe" }}
            >
              {progress > 0 ? (
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #fbbf24 0%, #f0a5b8 50%, #c4b5fd 100%)",
                  }}
                />
              ) : (
                <div className="progress-shimmer h-full w-full rounded-full opacity-60" />
              )}
            </div>
            <p
              className="mt-1.5 text-right text-xs text-violet-400"
              style={{ fontFamily: "var(--font-nunito), sans-serif" }}
            >
              {progress > 0 ? `${progress}% done` : "Starting up…"}
            </p>
          </div>
        )}

        {/* Download button */}
        {status === "complete" && order.pdf_url && (
          <a
            href={order.pdf_url as string}
            target="_blank"
            rel="noopener noreferrer"
            className="adventure-btn mt-6 flex w-full items-center justify-center rounded-2xl px-6 py-4 text-lg font-bold text-white shadow-md"
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: "1.4rem",
              background: "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
              border: "3px solid #db2777",
            }}
          >
            ✨ Download Your Coloring Book (PDF) ✨
          </a>
        )}

        {/* Page thumbnails */}
        {completedPages.length > 0 && (
          <div className="mt-8 sketch-border rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-5">
            <h2
              className="mb-4 text-3xl font-bold"
              style={{
                fontFamily: "var(--font-caveat), cursive",
                color: "#92400e",
              }}
            >
              🖼️ Your Pages
            </h2>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
              {completedPages.map((page) => (
                <div
                  key={page.id as string}
                  className="sketch-border overflow-hidden rounded-xl bg-white"
                >
                  {page.image_url ? (
                    <img
                      src={page.image_url as string}
                      alt={`Page ${page.page_number}`}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex aspect-[3/4] items-center justify-center text-xs"
                      style={{
                        fontFamily: "var(--font-caveat), cursive",
                        color: "#a8856b",
                        backgroundColor: "#faf8f5",
                      }}
                    >
                      Page {page.page_number as number}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create another book CTA */}
        <a
          href="/"
          className="adventure-btn mt-8 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 font-bold text-white shadow-md"
          style={{
            fontFamily: "var(--font-caveat), cursive",
            fontSize: "1.4rem",
            background: "linear-gradient(135deg, #fbbf24 0%, #f0a5b8 50%, #a78bfa 100%)",
            border: "3px solid #d4c4f0",
          }}
        >
          ✏️ Create Another Book
        </a>

        {/* Back link */}
        <div className="mt-6 text-center">
          <a
            href="/orders"
            className="transition-opacity hover:opacity-70"
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: "1.2rem",
              color: "#d97706",
            }}
          >
            ← Back to all orders
          </a>
        </div>
      </main>
    </div>
  );
}
