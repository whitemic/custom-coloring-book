-- ============================================================
-- Migration: AI metadata tracking for manifests and pages
-- ============================================================

ALTER TABLE character_manifests
  ADD COLUMN IF NOT EXISTS model_used text;

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS original_prompt text,
  ADD COLUMN IF NOT EXISTS prompt_optimized boolean DEFAULT false;
