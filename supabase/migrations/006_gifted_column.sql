-- Add gifted boolean to pieces (mirrors the existing `lost` pattern)
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS gifted boolean DEFAULT false NOT NULL;
