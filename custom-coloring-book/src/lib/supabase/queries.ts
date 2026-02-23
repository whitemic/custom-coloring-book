import { createServerClient } from "./server";
import type {
  OrderRow,
  CharacterManifestRow,
  PageRow,
  OrderStatus,
  PageStatus,
} from "@/types/database";
import type { CharacterManifest } from "@/types/manifest";

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * Create an order before redirecting to Stripe (order-first flow).
 * Order is stored with form data and status 'pending_payment'.
 * Webhook fills in session id, email, amount and sets status to 'pending'.
 */
export async function insertOrder(params: {
  userInput: Record<string, unknown>;
  priceTier?: "standard" | "premium";
  previewImageUrl?: string | null;
  previewSeed?: number | null;
}): Promise<OrderRow> {
  const db = createServerClient();
  const row: Record<string, unknown> = {
    user_input: params.userInput,
    status: "pending_payment",
    currency: "usd",
  };
  if (params.priceTier !== undefined) {
    row.price_tier = params.priceTier;
  }
  if (params.previewImageUrl !== undefined) {
    row.preview_image_url = params.previewImageUrl;
  }
  if (params.previewSeed !== undefined) {
    row.preview_seed = params.previewSeed;
  }
  const { data, error } = await db
    .from("orders")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as OrderRow;
}

/**
 * Update an order's preview image and seed (after pre-purchase Flux generation).
 */
export async function updateOrderPreview(
  orderId: string,
  previewImageUrl: string,
  previewSeed: number,
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("orders")
    .update({
      preview_image_url: previewImageUrl,
      preview_seed: previewSeed,
    })
    .eq("id", orderId)
    .eq("status", "pending_payment");
  if (error) throw error;
}

/**
 * Store multiple preview options on an order (before user picks one).
 */
export async function updateOrderPreviews(
  orderId: string,
  previews: { imageUrl: string; seed: number }[],
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("orders")
    .update({ previews })
    .eq("id", orderId)
    .eq("status", "pending_payment");
  if (error) throw error;
}

/**
 * Set the chosen preview (from previews[index]) as the order's preview_image_url and preview_seed.
 */
export async function selectOrderPreview(
  orderId: string,
  index: number,
): Promise<void> {
  const db = createServerClient();
  const { data: order, error: fetchError } = await db
    .from("orders")
    .select("previews")
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .single();
  if (fetchError || !order) throw new Error("Order not found or already paid");
  const previews = order.previews as { imageUrl: string; seed: number }[] | null;
  if (!previews?.[index]) throw new Error("Invalid preview selection");
  const chosen = previews[index];
  const { error } = await db
    .from("orders")
    .update({
      preview_image_url: chosen.imageUrl,
      preview_seed: chosen.seed,
    })
    .eq("id", orderId)
    .eq("status", "pending_payment");
  if (error) throw error;
}

/**
 * Update an order after successful Stripe checkout (webhook).
 * Only updates rows with status 'pending_payment' so duplicate webhooks
 * don't overwrite or trigger Inngest twice.
 * Returns the updated order, or null if order was already processed.
 */
export async function updateOrderAfterPayment(params: {
  orderId: string;
  stripeCheckoutSessionId: string;
  stripeCustomerEmail: string;
  amountCents: number;
  currency: string;
  priceTier?: "standard" | "premium";
}): Promise<OrderRow | null> {
  const db = createServerClient();
  const update: Record<string, unknown> = {
    stripe_checkout_session_id: params.stripeCheckoutSessionId,
    stripe_customer_email: params.stripeCustomerEmail,
    amount_cents: params.amountCents,
    currency: params.currency,
    status: "pending",
  };
  if (params.priceTier !== undefined) {
    update.price_tier = params.priceTier;
  }
  const { data, error } = await db
    .from("orders")
    .update(update)
    .eq("id", params.orderId)
    .eq("status", "pending_payment")
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as OrderRow) ?? null;
}

export async function getOrder(orderId: string): Promise<OrderRow> {
  const db = createServerClient();
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error) throw error;
  return data as unknown as OrderRow;
}

/**
 * Look up an order by Stripe checkout session ID.
 * Used after checkout redirect to resolve the session to an order UUID.
 */
export async function getOrderBySessionId(
  sessionId: string,
): Promise<OrderRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as OrderRow) ?? null;
}

/**
 * Check whether any order exists for the given email.
 * Used to avoid sending verification emails to non-customers.
 */
export async function hasOrdersForEmail(email: string): Promise<boolean> {
  const db = createServerClient();
  const { data, error } = await db
    .from("orders")
    .select("id")
    .eq("stripe_customer_email", email)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data != null;
}

/**
 * Fetch all orders for a given email address, most recent first.
 * Used for the email-based order lookup page.
 */
export async function getOrdersByEmail(email: string): Promise<OrderRow[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("stripe_customer_email", email)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as OrderRow[]) ?? [];
}

/**
 * Fetch all pages for an order, sorted by page number.
 * Used on the order detail page to show progress and thumbnails.
 */
export async function getPagesByOrderId(orderId: string): Promise<PageRow[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("pages")
    .select("*")
    .eq("order_id", orderId)
    .order("page_number", { ascending: true });

  if (error) throw error;
  return (data as unknown as PageRow[]) ?? [];
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) throw error;
}

export async function updateOrderPdfUrl(
  orderId: string,
  pdfUrl: string,
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("orders")
    .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Character Manifests
// ---------------------------------------------------------------------------

/**
 * Returns the existing manifest for an order, or null if none exists.
 * Used to make Step 1 idempotent on retry.
 */
export async function getManifestByOrderId(
  orderId: string,
): Promise<CharacterManifestRow | null> {
  const db = createServerClient();

  const { data, error } = await db
    .from("character_manifests")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as CharacterManifestRow) ?? null;
}

/**
 * Idempotent manifest insert. If a manifest already exists for this order,
 * returns the existing row instead of inserting a duplicate.
 */
export async function insertManifest(
  orderId: string,
  manifest: CharacterManifest,
  rawLlmResponse?: Record<string, unknown>,
): Promise<CharacterManifestRow> {
  // Check for existing manifest first (idempotency guard)
  const existing = await getManifestByOrderId(orderId);
  if (existing) return existing;

  const db = createServerClient();

  const { data, error } = await db
    .from("character_manifests")
    .insert({
      order_id: orderId,
      character_name: manifest.characterName,
      character_type: manifest.characterType,
      species: manifest.species,
      physical_description: manifest.physicalDescription,
      character_key_features: manifest.characterKeyFeatures ?? [],
      age_range: manifest.ageRange,
      hair: manifest.hair,
      skin_tone: manifest.skinTone,
      outfit: manifest.outfit,
      theme: manifest.theme,
      style_tags: manifest.styleTags,
      negative_tags: manifest.negativeTags,
      raw_llm_response: rawLlmResponse ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CharacterManifestRow;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export interface PageInsert {
  pageNumber: number;
  seed: number;
  sceneDescription: string;
  fullPrompt: string;
}

/**
 * Idempotent page insert. If pages already exist for this order,
 * returns the existing rows instead of inserting duplicates.
 */
export async function insertPages(
  orderId: string,
  manifestId: string,
  pages: PageInsert[],
): Promise<PageRow[]> {
  const db = createServerClient();

  // Check if pages already exist for this order (idempotency guard)
  const { data: existing } = await db
    .from("pages")
    .select("*")
    .eq("order_id", orderId)
    .order("page_number", { ascending: true });

  if (existing && existing.length > 0) {
    return existing as unknown as PageRow[];
  }

  const rows = pages.map((p) => ({
    order_id: orderId,
    manifest_id: manifestId,
    page_number: p.pageNumber,
    seed: p.seed,
    scene_description: p.sceneDescription,
    full_prompt: p.fullPrompt,
    status: "pending",
  }));

  const { data, error } = await db.from("pages").insert(rows).select();

  if (error) throw error;
  return data as unknown as PageRow[];
}

export async function getPendingPages(orderId: string): Promise<PageRow[]> {
  const db = createServerClient();

  const { data, error } = await db
    .from("pages")
    .select("*")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .order("page_number", { ascending: true });

  if (error) throw error;
  return data as unknown as PageRow[];
}

export async function updatePageImage(
  pageId: string,
  imageUrl: string,
  predictionId: string,
): Promise<void> {
  const db = createServerClient();

  const { error } = await db
    .from("pages")
    .update({
      image_url: imageUrl,
      replicate_prediction_id: predictionId,
      status: "complete" as PageStatus,
    })
    .eq("id", pageId);

  if (error) throw error;
}

export async function updatePageStatus(
  pageId: string,
  status: PageStatus,
): Promise<void> {
  const db = createServerClient();

  const { error } = await db
    .from("pages")
    .update({ status })
    .eq("id", pageId);

  if (error) throw error;
}
