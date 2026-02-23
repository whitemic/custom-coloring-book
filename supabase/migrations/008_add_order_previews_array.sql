-- Store multiple preview options (user picks one). Array of { imageUrl, seed }.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS previews jsonb;
