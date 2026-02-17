-- Add preview image and seed to orders for pre-purchase hook and img2img pipeline.
-- Nullable for existing orders and for orders created without a preview step.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS preview_image_url text,
  ADD COLUMN IF NOT EXISTS preview_seed integer;
