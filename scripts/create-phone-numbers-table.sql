-- ============================================================================
-- CREATE PHONE_NUMBERS TABLE FOR TWILIO ORGANIZATION ROUTING
-- ============================================================================
-- Apply this SQL in Supabase Dashboard → SQL Editor
-- Or run: psql $DATABASE_URL < scripts/create-phone-numbers-table.sql

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

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_numbers_lookup 
  ON phone_numbers(phone_number, channel) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_phone_numbers_org 
  ON phone_numbers(organization_id);

-- Enable RLS
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view organization phone numbers" ON phone_numbers;
DROP POLICY IF EXISTS "Admins can manage phone numbers" ON phone_numbers;

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

-- Insert your Twilio phone number
-- 
-- 💡 TO ASSIGN TO A DIFFERENT ORGANIZATION:
-- 1. Run: node scripts/find-organizations.js
-- 2. Copy the org ID you want
-- 3. Replace '00000000-0000-0000-0000-000000000001' below
-- 4. Then run this SQL in Supabase Dashboard
--
-- OR just run: node scripts/update-phone-org.js YOUR_ORG_ID
--
INSERT INTO phone_numbers (phone_number, organization_id, channel, is_active, metadata)
VALUES (
  '+18504036622',
  'b445a9c7-af93-4b4a-a975-40d3f44178ec',  -- sam.lateeff's Organization
  'twilio',
  true,
  '{"friendly_name": "Main Support Line", "provider": "Twilio"}'::jsonb
)
ON CONFLICT (phone_number, channel) DO UPDATE
SET 
  organization_id = EXCLUDED.organization_id,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Verify the insertion
SELECT 
  phone_number,
  organization_id,
  channel,
  is_active,
  metadata->>'friendly_name' as friendly_name
FROM phone_numbers
WHERE channel = 'twilio';
