-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS birthday_pass_registrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_library_identifier text NOT NULL,
  push_token text NOT NULL,
  pass_type_identifier text NOT NULL,
  serial_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(device_library_identifier, serial_number)
);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER birthday_pass_updated_at
  BEFORE UPDATE ON birthday_pass_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Service key bypasses RLS, so keep it simple
ALTER TABLE birthday_pass_registrations ENABLE ROW LEVEL SECURITY;
