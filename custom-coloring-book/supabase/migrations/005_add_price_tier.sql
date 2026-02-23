-- ============================================================
-- Migration: Price tier for model selection (Standard vs Premium)
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS price_tier text NOT NULL DEFAULT 'standard'
    CHECK (price_tier IN ('standard', 'premium'));
