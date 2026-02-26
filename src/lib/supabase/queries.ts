import { createServerClient } from "./server";
import type {
  OrderRow,
  CharacterManifestRow,
  PageRow,
  OrderStatus,
  PageStatus,
  LibraryPurchaseRow,
  LibraryPurchaseStatus,
  UserCreditsRow,
  PendingCreditPurchaseRow,
  ProcessedWebhookEventRow,
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
  // Serialize to plain JSON array so DB sees exact payload; select to confirm write
  const payload = JSON.parse(JSON.stringify(previews));
  const { error } = await db
    .from("orders")
    .update({ previews: payload })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .select("previews")
    .single();
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
      character_props: manifest.characterProps ?? [],
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

/**
 * Set the library_opt_in flag on an order.
 */
export async function updateOrderLibraryOptIn(
  orderId: string,
  optIn: boolean,
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("orders")
    .update({ library_opt_in: optIn })
    .eq("id", orderId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Library Characters (public gallery)
// ---------------------------------------------------------------------------

export interface LibraryCharacter {
  orderId: string;
  previewImageUrl: string;
  characterName: string;
  characterType: string;
  theme: string;
  pageCount: number;
}

/**
 * Fetch opted-in completed characters for the public library.
 * Uses service role client to bypass RLS.
 */
export async function getLibraryCharacters(params: {
  theme?: string;
  characterType?: string;
  q?: string;
  offset?: number;
  limit?: number;
}): Promise<LibraryCharacter[]> {
  const db = createServerClient();
  const { theme, characterType, q, offset = 0, limit = 12 } = params;

  let query = db
    .from("orders")
    .select(
      "id, preview_image_url, character_manifests!inner(character_name, character_type, theme)",
    )
    .eq("status", "complete")
    .eq("library_opt_in", true)
    .not("preview_image_url", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (theme) {
    query = query.ilike("character_manifests.theme", `%${theme}%`);
  }
  if (characterType) {
    query = query.eq("character_manifests.character_type", characterType);
  }
  if (q) {
    query = query.ilike("character_manifests.character_name", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data as unknown as Array<{
    id: string;
    preview_image_url: string;
    character_manifests: {
      character_name: string;
      character_type: string;
      theme: string;
    };
  }>) ?? []).map((row) => ({
    orderId: row.id,
    previewImageUrl: row.preview_image_url,
    characterName: row.character_manifests.character_name,
    characterType: row.character_manifests.character_type,
    theme: row.character_manifests.theme,
    pageCount: 20,
  }));
}

/**
 * Fetch all completed pages for a library character (opted-in order).
 */
export async function getLibraryCharacterPages(orderId: string): Promise<{
  order: { previewImageUrl: string; library_opt_in: boolean };
  manifest: { characterName: string; characterType: string; theme: string } | null;
  pages: PageRow[];
}> {
  const db = createServerClient();

  const [orderResult, manifestResult, pagesResult] = await Promise.all([
    db
      .from("orders")
      .select("preview_image_url, library_opt_in")
      .eq("id", orderId)
      .eq("status", "complete")
      .eq("library_opt_in", true)
      .single(),
    db
      .from("character_manifests")
      .select("character_name, character_type, theme")
      .eq("order_id", orderId)
      .maybeSingle(),
    db
      .from("pages")
      .select("*")
      .eq("order_id", orderId)
      .eq("status", "complete")
      .not("image_url", "is", null)
      .order("page_number", { ascending: true }),
  ]);

  if (orderResult.error) throw orderResult.error;
  if (pagesResult.error) throw pagesResult.error;

  return {
    order: orderResult.data as unknown as {
      previewImageUrl: string;
      library_opt_in: boolean;
    },
    manifest: manifestResult.data as unknown as {
      characterName: string;
      characterType: string;
      theme: string;
    } | null,
    pages: (pagesResult.data as unknown as PageRow[]) ?? [],
  };
}

/**
 * Fetch pages by an explicit list of IDs (used for library PDF assembly).
 * Returns pages in the order of the input IDs.
 */
export async function getPagesByIds(pageIds: string[]): Promise<PageRow[]> {
  if (pageIds.length === 0) return [];
  const db = createServerClient();
  const { data, error } = await db
    .from("pages")
    .select("*")
    .in("id", pageIds);
  if (error) throw error;

  // Return in the original selection order
  const pageMap = new Map((data ?? []).map((p) => [p.id, p]));
  return pageIds
    .map((id) => pageMap.get(id))
    .filter((p): p is PageRow => p !== undefined) as PageRow[];
}

/**
 * Find the creator email for a set of page IDs (for awarding credits).
 * Returns a map of pageId → email.
 */
export async function getCreatorEmailsForPages(
  pageIds: string[],
): Promise<Map<string, string>> {
  if (pageIds.length === 0) return new Map();
  const db = createServerClient();

  const { data, error } = await db
    .from("pages")
    .select("id, orders!inner(stripe_customer_email)")
    .in("id", pageIds);

  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of (data ?? []) as unknown as Array<{
    id: string;
    orders: { stripe_customer_email: string };
  }>) {
    if (row.orders.stripe_customer_email) {
      map.set(row.id, row.orders.stripe_customer_email);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Library Purchases
// ---------------------------------------------------------------------------

/**
 * Insert a new library purchase record (before Stripe checkout or credit spend).
 */
export async function createLibraryPurchase(params: {
  selectedPageIds: string[];
  amountCents?: number;
  creditsUsed?: number;
  stripeCustomerEmail?: string;
  status?: LibraryPurchaseStatus;
}): Promise<LibraryPurchaseRow> {
  const db = createServerClient();
  const { data, error } = await db
    .from("library_purchases")
    .insert({
      selected_page_ids: params.selectedPageIds,
      amount_cents: params.amountCents ?? null,
      credits_used: params.creditsUsed ?? 0,
      stripe_customer_email: params.stripeCustomerEmail ?? null,
      status: params.status ?? "pending_payment",
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as LibraryPurchaseRow;
}

/**
 * Link a Stripe checkout session to a library purchase (called at checkout creation time).
 */
export async function updateLibraryPurchaseSession(
  purchaseId: string,
  sessionId: string,
  email: string,
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("library_purchases")
    .update({
      stripe_checkout_session_id: sessionId,
      stripe_customer_email: email,
    })
    .eq("id", purchaseId);
  if (error) throw error;
}

/**
 * Look up a library purchase by Stripe session ID (used in webhook).
 */
export async function getLibraryPurchaseBySessionId(
  sessionId: string,
): Promise<LibraryPurchaseRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("library_purchases")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as LibraryPurchaseRow) ?? null;
}

/**
 * Fetch a library purchase by ID (used on the download page to poll status).
 */
export async function getLibraryPurchase(
  purchaseId: string,
): Promise<LibraryPurchaseRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("library_purchases")
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as LibraryPurchaseRow) ?? null;
}

/**
 * Update a library purchase's status and optionally its pdf_url.
 */
export async function updateLibraryPurchaseStatus(
  purchaseId: string,
  status: LibraryPurchaseStatus,
  pdfUrl?: string,
): Promise<void> {
  const db = createServerClient();
  const update: Record<string, unknown> = { status };
  if (pdfUrl !== undefined) update.pdf_url = pdfUrl;
  const { error } = await db
    .from("library_purchases")
    .update(update)
    .eq("id", purchaseId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// User Credits
// ---------------------------------------------------------------------------

/**
 * Get the current credit balance for an email address.
 * Returns null if the user has no credit record yet.
 */
export async function getUserCredits(
  email: string,
): Promise<UserCreditsRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("user_credits")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as UserCreditsRow) ?? null;
}

/**
 * Add credits to a user's balance (upserts the record).
 * Also records a transaction for audit purposes.
 */
export async function incrementUserCredits(
  email: string,
  amount: number,
  type: "purchase" | "creator_earn" | "purchase_bonus",
  referenceId?: string,
  description?: string,
): Promise<void> {
  const db = createServerClient();

  // Upsert the balance row atomically via the Postgres function.
  const { error: upsertError } = await db.rpc("increment_user_credits", {
    p_email: email,
    p_amount: amount,
  });

  if (upsertError) {
    console.error("incrementUserCredits RPC error:", upsertError);
    throw upsertError;
  }

  // Record the transaction (type/reference/description vary per call site,
  // so kept in TypeScript rather than inside the Postgres function).
  await db.from("credit_transactions").insert({
    email,
    amount,
    type,
    reference_id: referenceId ?? null,
    description: description ?? null,
  });
}

/**
 * Debit credits from a user's balance atomically.
 * Uses a Postgres function with SELECT ... FOR UPDATE to prevent double-spend
 * under concurrent requests. The credit_transactions audit row is inserted
 * inside the same database transaction by the Postgres function.
 * Returns { success: true } on success, or { success: false, error } when
 * the balance is insufficient (caller is responsible for surfacing the error).
 */
export async function debitUserCredits(
  email: string,
  amount: number,
  description: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const db = createServerClient();

  const { data, error } = await db.rpc("debit_user_credits", {
    p_email: email,
    p_amount: amount,
    p_description: description,
  });

  if (error) {
    console.error("debitUserCredits RPC error:", error);
    return { success: false, error: "Failed to debit credits." };
  }

  if (data === false) {
    return { success: false, error: "Insufficient credit balance." };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Pending Credit Purchases
// ---------------------------------------------------------------------------

/**
 * Insert a pending_credit_purchases record before creating the Stripe session.
 * Stores the authoritative email and credit amount server-side so the webhook
 * never needs to trust session metadata for those values.
 */
export async function createPendingCreditPurchase(params: {
  email: string;
  credits: number;
  stripePriceId: string;
}): Promise<PendingCreditPurchaseRow> {
  const db = createServerClient();
  const { data, error } = await db
    .from("pending_credit_purchases")
    .insert({
      email: params.email,
      credits: params.credits,
      stripe_price_id: params.stripePriceId,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PendingCreditPurchaseRow;
}

/**
 * Attach the Stripe session ID to a pending credit purchase record
 * and mark it complete once credits have been awarded.
 */
export async function completePendingCreditPurchase(
  pendingId: string,
  stripeSessionId: string,
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("pending_credit_purchases")
    .update({ status: "complete", stripe_session_id: stripeSessionId })
    .eq("id", pendingId);
  if (error) throw error;
}

/**
 * Link a Stripe session ID to an existing pending_credit_purchases record
 * immediately after the session is created (before the webhook fires).
 */
export async function linkPendingCreditPurchaseSession(
  pendingId: string,
  stripeSessionId: string,
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("pending_credit_purchases")
    .update({ stripe_session_id: stripeSessionId })
    .eq("id", pendingId);
  if (error) throw error;
}

/**
 * Look up a pending_credit_purchases record by its UUID and the Stripe session ID.
 * The double-key lookup ensures the webhook cannot be replayed with a forged pending_id.
 */
export async function getPendingCreditPurchase(
  pendingId: string,
  stripeSessionId: string,
): Promise<PendingCreditPurchaseRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("pending_credit_purchases")
    .select("*")
    .eq("id", pendingId)
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PendingCreditPurchaseRow) ?? null;
}

/**
 * Look up a pending_credit_purchases record by its UUID only.
 * Used by the Inngest grant-credits function which only has the pendingId.
 */
export async function getPendingCreditPurchaseById(
  pendingId: string,
): Promise<PendingCreditPurchaseRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("pending_credit_purchases")
    .select("*")
    .eq("id", pendingId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PendingCreditPurchaseRow) ?? null;
}

/**
 * Reset a completed page back to pending for regeneration.
 * Clears the existing image so the Inngest regen step starts fresh.
 */
export async function resetPageForRegen(pageId: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("pages")
    .update({
      status: "pending" as PageStatus,
      image_url: null,
      replicate_prediction_id: null,
    })
    .eq("id", pageId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Webhook Event Deduplication
// ---------------------------------------------------------------------------

/**
 * Check whether a Stripe webhook event has already been processed.
 * Returns true if the event ID exists in the processed_webhook_events table.
 */
export async function hasProcessedWebhookEvent(
  stripeEventId: string,
): Promise<boolean> {
  const db = createServerClient();
  const { data } = await db
    .from("processed_webhook_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", stripeEventId)
    .maybeSingle();
  return data != null;
}

/**
 * Record a Stripe webhook event ID as processed.
 * Should be called before processing to prevent concurrent duplicate handling.
 * Uses upsert to safely handle the rare case where two concurrent deliveries
 * both attempt the insert at the same time.
 */
export async function recordWebhookEvent(
  stripeEventId: string,
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("processed_webhook_events")
    .upsert({ stripe_event_id: stripeEventId }, { onConflict: "stripe_event_id", ignoreDuplicates: true });
  if (error) throw error;
}
