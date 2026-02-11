-- Migration 060: Vapi Assistants Multi-Tenant Support
-- Created: 2026-02-04
-- Purpose: Store Vapi assistant mappings for multi-tenant SaaS

-- Create vapi_assistants table
CREATE TABLE IF NOT EXISTS vapi_assistants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL UNIQUE,  -- Vapi's assistant ID (e.g., "asst_abc123")
  phone_number TEXT,                   -- Vapi phone number assigned to this assistant
  assistant_name TEXT,                 -- Display name (e.g., "Sarah the Receptionist")
  voice_provider TEXT,                 -- e.g., "elevenlabs", "azure"
  voice_id TEXT,                       -- Voice identifier from provider
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,  -- Store custom config (voice settings, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one active assistant per organization (optional constraint)
  CONSTRAINT unique_org_assistant UNIQUE(organization_id, assistant_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_vapi_assistants_assistant_id ON vapi_assistants(assistant_id);
CREATE INDEX idx_vapi_assistants_org_id ON vapi_assistants(organization_id);
CREATE INDEX idx_vapi_assistants_phone ON vapi_assistants(phone_number);
CREATE INDEX idx_vapi_assistants_active ON vapi_assistants(is_active) WHERE is_active = true;

-- Update phone_numbers table to support Vapi channel
ALTER TABLE phone_numbers 
  DROP CONSTRAINT IF EXISTS phone_numbers_channel_check;

ALTER TABLE phone_numbers
  ADD CONSTRAINT phone_numbers_channel_check 
  CHECK (channel IN ('retell', 'twilio', 'whatsapp', 'vapi'));

-- Add updated_at trigger
CREATE TRIGGER update_vapi_assistants_updated_at
  BEFORE UPDATE ON vapi_assistants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE vapi_assistants ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all assistants (needed for multi-org admin)
-- In production, you may want to restrict this further based on your auth setup
CREATE POLICY vapi_assistants_read_all ON vapi_assistants
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to insert/update their org's assistants
-- You can add more specific checks here based on your user roles
CREATE POLICY vapi_assistants_write_authenticated ON vapi_assistants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY vapi_assistants_update_authenticated ON vapi_assistants
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Service role can access all (for webhook handler - CRITICAL)
CREATE POLICY vapi_assistants_service_role ON vapi_assistants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE vapi_assistants IS 'Maps Vapi assistant IDs to organizations for multi-tenant support';
COMMENT ON COLUMN vapi_assistants.assistant_id IS 'Vapi assistant ID from Vapi Dashboard (e.g., asst_abc123)';
COMMENT ON COLUMN vapi_assistants.phone_number IS 'Vapi phone number in E.164 format (e.g., +18504036622)';
COMMENT ON COLUMN vapi_assistants.metadata IS 'Additional configuration: voice settings, custom prompts, etc.';
