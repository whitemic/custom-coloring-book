-- ============================================================
-- Migration: Add character type support for non-human characters
-- ============================================================

-- Add new columns for character type and non-human character support
ALTER TABLE character_manifests
  ADD COLUMN character_type text,
  ADD COLUMN species text,
  ADD COLUMN physical_description text,
  ADD COLUMN character_key_features text[] DEFAULT '{}';

-- Set default character_type to 'human' for existing rows (backward compatibility)
UPDATE character_manifests
SET character_type = 'human'
WHERE character_type IS NULL;

-- Make human-specific fields nullable (they're only required for human characters)
ALTER TABLE character_manifests
  ALTER COLUMN age_range DROP NOT NULL,
  ALTER COLUMN hair DROP NOT NULL,
  ALTER COLUMN skin_tone DROP NOT NULL,
  ALTER COLUMN outfit DROP NOT NULL;

-- Add constraint to ensure character_type is set for new rows
ALTER TABLE character_manifests
  ALTER COLUMN character_type SET DEFAULT 'human',
  ALTER COLUMN character_type SET NOT NULL;

-- Add constraint to validate character_type values
ALTER TABLE character_manifests
  ADD CONSTRAINT character_type_check
  CHECK (character_type IN ('human', 'animal', 'fantasy', 'other'));
