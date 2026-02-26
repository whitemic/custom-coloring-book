/**
 * Supabase row types -- mirrors the SQL schema in
 * supabase/migrations/001_initial_schema.sql
 */

export type OrderStatus =
  | "pending_payment"
  | "pending"
  | "manifest_generated"
  | "generating"
  | "complete"
  | "failed";

export type PageStatus = "pending" | "generating" | "complete" | "failed";

export type OrderPriceTier = "standard" | "premium";

export interface OrderRow {
  id: string;
  /** Set when payment completes (webhook). Null while status is pending_payment. */
  stripe_checkout_session_id: string | null;
  /** Set when payment completes (webhook). Null while status is pending_payment. */
  stripe_customer_email: string | null;
  status: OrderStatus;
  /** Set when payment completes (webhook). Null while status is pending_payment. */
  amount_cents: number | null;
  currency: string;
  user_input: Record<string, unknown>;
  pdf_url: string | null;
  /** Preview image URL from pre-purchase Flux generation (for img2img pipeline). */
  preview_image_url: string | null;
  /** Seed used for preview generation (for img2img pipeline). */
  preview_seed: number | null;
  /** Multiple preview options before user picks one. [{ imageUrl, seed }, ...] */
  previews?: { imageUrl: string; seed: number }[] | null;
  created_at: string;
  updated_at: string;
  /** Set at checkout or from Stripe; used for model selection. */
  price_tier?: OrderPriceTier;
  /** Whether the user opted in to share their completed book in the public library. */
  library_opt_in: boolean;
}

export interface CharacterManifestRow {
  id: string;
  order_id: string;
  character_name: string;
  character_type: string;
  species: string | null;
  physical_description: string | null;
  character_key_features: string[];
  character_props: string[] | null;
  age_range: string | null;
  hair: {
    style: string;
    color: string;
    length: string;
    texture: string;
  } | null;
  skin_tone: string | null;
  outfit: {
    top: string;
    bottom: string;
    shoes: string;
    accessories: string[];
  } | null;
  theme: string;
  style_tags: string[];
  negative_tags: string[];
  raw_llm_response: Record<string, unknown> | null;
  created_at: string;
}

export interface PageRow {
  id: string;
  order_id: string;
  manifest_id: string;
  page_number: number;
  seed: number;
  scene_description: string;
  full_prompt: string;
  image_url: string | null;
  status: PageStatus;
  replicate_prediction_id: string | null;
  created_at: string;
}

export type LibraryPurchaseStatus =
  | "pending_payment"
  | "generating"
  | "complete"
  | "failed";

export type CreditTransactionType = "purchase" | "creator_earn" | "spend" | "purchase_bonus" | "page_regen";

export interface LibraryPurchaseRow {
  id: string;
  stripe_checkout_session_id: string | null;
  stripe_customer_email: string | null;
  selected_page_ids: string[];
  amount_cents: number | null;
  credits_used: number;
  status: LibraryPurchaseStatus;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreditsRow {
  email: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransactionRow {
  id: string;
  email: string;
  amount: number;
  type: CreditTransactionType;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export type PendingCreditPurchaseStatus = "pending" | "complete" | "expired";

export interface PendingCreditPurchaseRow {
  id: string;
  email: string;
  credits: number;
  /** Filled in after the Stripe session is created. */
  stripe_session_id: string | null;
  stripe_price_id: string;
  status: PendingCreditPurchaseStatus;
  created_at: string;
}

export interface ProcessedWebhookEventRow {
  stripe_event_id: string;
  created_at: string;
}

/**
 * Supabase Database type map used by the typed client.
 */
export interface Database {
  public: {
    Tables: {
      orders: {
        Row: OrderRow;
        Insert: Omit<OrderRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<OrderRow, "id">>;
      };
      character_manifests: {
        Row: CharacterManifestRow;
        Insert: Omit<CharacterManifestRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CharacterManifestRow, "id">>;
      };
      pages: {
        Row: PageRow;
        Insert: Omit<PageRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<PageRow, "id">>;
      };
      library_purchases: {
        Row: LibraryPurchaseRow;
        Insert: Omit<LibraryPurchaseRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<LibraryPurchaseRow, "id">>;
      };
      user_credits: {
        Row: UserCreditsRow;
        Insert: Omit<UserCreditsRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserCreditsRow, "email">>;
      };
      credit_transactions: {
        Row: CreditTransactionRow;
        Insert: Omit<CreditTransactionRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
      };
      pending_credit_purchases: {
        Row: PendingCreditPurchaseRow;
        Insert: Omit<PendingCreditPurchaseRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<PendingCreditPurchaseRow, "id" | "created_at">>;
      };
      processed_webhook_events: {
        Row: ProcessedWebhookEventRow;
        Insert: Omit<ProcessedWebhookEventRow, "created_at"> & {
          created_at?: string;
        };
        Update: never;
      };
    };
  };
}
