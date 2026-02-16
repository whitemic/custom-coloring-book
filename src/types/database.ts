/**
 * Supabase row types -- mirrors the SQL schema in
 * supabase/migrations/001_initial_schema.sql
 */

export type OrderStatus =
  | "pending"
  | "manifest_generated"
  | "generating"
  | "complete"
  | "failed";

export type PageStatus = "pending" | "generating" | "complete" | "failed";

export interface OrderRow {
  id: string;
  stripe_checkout_session_id: string;
  stripe_customer_email: string;
  status: OrderStatus;
  amount_cents: number;
  currency: string;
  user_input: Record<string, unknown>;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterManifestRow {
  id: string;
  order_id: string;
  character_name: string;
  age_range: string;
  hair: {
    style: string;
    color: string;
    length: string;
    texture: string;
  };
  skin_tone: string;
  outfit: {
    top: string;
    bottom: string;
    shoes: string;
    accessories: string[];
  };
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
    };
  };
}
