-- ============================================================
-- Personalized Coloring Book Engine -- Initial Schema
-- ============================================================

-- Enable pgcrypto for gen_random_uuid() if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------
-- 1. orders
-- -----------------------------------------------------------
CREATE TABLE orders (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_checkout_session_id  text UNIQUE NOT NULL,
  stripe_customer_email       text NOT NULL,
  status                      text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'manifest_generated', 'generating', 'complete', 'failed')),
  amount_cents                integer NOT NULL,
  currency                    text NOT NULL DEFAULT 'usd',
  user_input                  jsonb NOT NULL,
  pdf_url                     text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups by Stripe session (also enforced by UNIQUE)
CREATE INDEX idx_orders_stripe_session ON orders (stripe_checkout_session_id);

-- Auto-update the updated_at timestamp on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------
-- 2. character_manifests
-- -----------------------------------------------------------
CREATE TABLE character_manifests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  character_name    text NOT NULL,
  age_range         text NOT NULL,
  hair              jsonb NOT NULL,
  skin_tone         text NOT NULL,
  outfit            jsonb NOT NULL,
  theme             text NOT NULL,
  style_tags        text[] NOT NULL,
  negative_tags     text[] NOT NULL DEFAULT '{}',
  raw_llm_response  jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manifests_order ON character_manifests (order_id);

-- -----------------------------------------------------------
-- 3. pages
-- -----------------------------------------------------------
CREATE TABLE pages (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  manifest_id               uuid NOT NULL REFERENCES character_manifests(id) ON DELETE CASCADE,
  page_number               integer NOT NULL,
  seed                      integer NOT NULL,
  scene_description         text NOT NULL,
  full_prompt               text NOT NULL,
  image_url                 text,
  status                    text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'complete', 'failed')),
  replicate_prediction_id   text,
  created_at                timestamptz NOT NULL DEFAULT now(),

  UNIQUE (order_id, page_number)
);

CREATE INDEX idx_pages_order ON pages (order_id);
CREATE INDEX idx_pages_status ON pages (order_id, status);
