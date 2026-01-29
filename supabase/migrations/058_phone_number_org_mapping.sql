-- ============================================================================
-- MIGRATION 058: Phone Number Organization Mapping
-- ============================================================================
-- Creates table to map phone numbers to organizations for multi-tenant support

-- Create phone_numbers table
CREATE TABLE IF NOT EXISTS phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('retell', 'twilio', 'whatsapp')),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one phone number per channel
  UNIQUE (phone_number, channel)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_numbers_lookup 
  ON phone_numbers(phone_number, channel) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_phone_numbers_org 
  ON phone_numbers(organization_id);

-- Add RLS policies
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view phone numbers for their organization
CREATE POLICY "Users can view organization phone numbers"
  ON phone_numbers
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins can manage phone numbers
CREATE POLICY "Admins can manage phone numbers"
  ON phone_numbers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 
      FROM organization_members 
      WHERE user_id = auth.uid() 
        AND organization_id = phone_numbers.organization_id
        AND role IN ('owner', 'admin')
    )
  );

-- Add comments
COMMENT ON TABLE phone_numbers IS 'Maps phone numbers to organizations for multi-tenant routing';
COMMENT ON COLUMN phone_numbers.phone_number IS 'E.164 format phone number (e.g., +18504036622)';
COMMENT ON COLUMN phone_numbers.channel IS 'Communication channel: retell, twilio, or whatsapp';
COMMENT ON COLUMN phone_numbers.is_active IS 'Whether this phone number mapping is active';
COMMENT ON COLUMN phone_numbers.metadata IS 'Additional metadata (provider, type, etc.)';
