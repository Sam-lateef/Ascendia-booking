-- Phone Number to Organization Mapping
-- Maps phone numbers (Retell, Twilio, WhatsApp) to organizations

CREATE TABLE IF NOT EXISTS phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text UNIQUE NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('retell', 'twilio', 'whatsapp')),
  is_active boolean DEFAULT true,
  friendly_name text, -- e.g. "Main Support Line", "Spanish Support"
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone ON phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_org ON phone_numbers(organization_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_active ON phone_numbers(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- Users can view phone numbers for their organizations
CREATE POLICY "Users can view org phone numbers"
  ON phone_numbers
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Only admins/owners can manage phone numbers
CREATE POLICY "Admins can manage phone numbers"
  ON phone_numbers
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_phone_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER phone_numbers_updated_at
  BEFORE UPDATE ON phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_phone_numbers_updated_at();

-- Example data (replace with your actual phone numbers and org IDs)
-- INSERT INTO phone_numbers (phone_number, organization_id, channel, friendly_name) VALUES
--   ('+15551234567', 'your-org-id-here', 'retell', 'Main Support Line'),
--   ('+15559876543', 'another-org-id', 'twilio', 'After Hours Line');

COMMENT ON TABLE phone_numbers IS 'Maps phone numbers to organizations for multi-tenant call routing';
COMMENT ON COLUMN phone_numbers.phone_number IS 'Phone number in E.164 format (+15551234567)';
COMMENT ON COLUMN phone_numbers.channel IS 'Channel this number is used for: retell, twilio, or whatsapp';
COMMENT ON COLUMN phone_numbers.friendly_name IS 'Human-readable name for this number';
COMMENT ON COLUMN phone_numbers.metadata IS 'Additional metadata like business hours, routing rules, etc.';
