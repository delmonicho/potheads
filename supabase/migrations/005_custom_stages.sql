-- 005_custom_stages.sql
-- Adds user-defined custom stages and converts stage columns from enum to text.
-- Apply manually in the Supabase SQL editor.

-- 1. Create custom_stages table
CREATE TABLE IF NOT EXISTS custom_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE custom_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_stages_user_policy" ON custom_stages
  FOR ALL USING (auth.uid() = user_id);

-- 2. Convert stage columns from enum to text so custom stage values can be stored.
-- USING ::text is a safe cast from any enum to its text label.
ALTER TABLE pieces ALTER COLUMN current_stage TYPE text USING current_stage::text;
ALTER TABLE stage_events ALTER COLUMN stage TYPE text USING stage::text;
ALTER TABLE photos ALTER COLUMN stage TYPE text USING stage::text;
