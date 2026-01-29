-- ============================================
-- API Credentials Management
-- ============================================
-- Store encrypted API keys and credentials per organization
-- Supports multi-tenant configurations for all integrations
--
-- Run after: 043_multi_channel_agent_config.sql

-- Create enum for credential types
CREATE TYPE credential_type AS ENUM (
  'openai',
  'anthropic',
  'twilio',
  'evolution_api',
  'opendental',
  'retell',
  'other'
);

-- API Credentials table
CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Credential identification
  credential_type credential_type NOT NULL,
  credential_name TEXT NOT NULL, -- e.g., "OpenAI API Key", "Twilio Production"
  description TEXT,
  
  -- Credentials (stored as JSONB for flexibility)
  -- Structure varies by type:
  -- openai: { api_key: string }
  -- twilio: { account_sid: string, auth_token: string, phone_number: string, websocket_url: string }
  -- evolution_api: { api_url: string, api_key: string }
  -- opendental: { api_url: string, api_key: string }
  credentials JSONB NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Only one default per type per org
  
  -- Security
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure credential_name is unique per organization
  UNIQUE(organization_id, credential_name)
);

-- Create index for fast lookups
CREATE INDEX idx_api_credentials_org_type ON api_credentials(organization_id, credential_type);
CREATE INDEX idx_api_credentials_org_active ON api_credentials(organization_id, is_active);
CREATE INDEX idx_api_credentials_org_default ON api_credentials(organization_id, credential_type, is_default) WHERE is_default = true;

-- Function to ensure only one default per type per org
CREATE OR REPLACE FUNCTION ensure_single_default_credential()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other defaults for this org + type
    UPDATE api_credentials
    SET is_default = false
    WHERE organization_id = NEW.organization_id
      AND credential_type = NEW.credential_type
      AND id != NEW.id
      AND is_default = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ensure_single_default_credential
  BEFORE INSERT OR UPDATE ON api_credentials
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_credential();

-- Auto-update updated_at timestamp
CREATE TRIGGER trg_api_credentials_updated_at
  BEFORE UPDATE ON api_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only see credentials for their organization
CREATE POLICY api_credentials_select_policy ON api_credentials
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid()
    )
  );

-- Only owners and admins can insert credentials
CREATE POLICY api_credentials_insert_policy ON api_credentials
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Only owners and admins can update credentials
CREATE POLICY api_credentials_update_policy ON api_credentials
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Only owners can delete credentials
CREATE POLICY api_credentials_delete_policy ON api_credentials
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid() 
      AND role = 'owner'
    )
  );

-- Helper view for masked credentials (for UI display)
CREATE OR REPLACE VIEW api_credentials_masked AS
SELECT 
  id,
  organization_id,
  credential_type,
  credential_name,
  description,
  -- Mask sensitive data
  jsonb_object_agg(
    key,
    CASE 
      WHEN key IN ('api_key', 'auth_token', 'password', 'secret') THEN 
        '***' || right(value::text, 4)
      ELSE value
    END
  ) as credentials_masked,
  is_active,
  is_default,
  last_used_at,
  expires_at,
  created_at,
  updated_at
FROM api_credentials,
LATERAL jsonb_each(credentials)
GROUP BY id, organization_id, credential_type, credential_name, description, 
         is_active, is_default, last_used_at, expires_at, created_at, updated_at;

COMMENT ON TABLE api_credentials IS 'Stores API credentials per organization for multi-tenant support';
COMMENT ON COLUMN api_credentials.credentials IS 'JSONB structure varies by type. Contains encrypted/sensitive data.';
COMMENT ON VIEW api_credentials_masked IS 'Masked version of credentials for safe UI display';

-- Function to get active credentials by type
CREATE OR REPLACE FUNCTION get_active_credentials(
  p_org_id UUID,
  p_type credential_type
)
RETURNS TABLE (
  id UUID,
  credential_name TEXT,
  credentials JSONB,
  is_default BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.credential_name,
    c.credentials,
    c.is_default
  FROM api_credentials c
  WHERE c.organization_id = p_org_id
    AND c.credential_type = p_type
    AND c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > NOW())
  ORDER BY c.is_default DESC, c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_active_credentials IS 'Get active credentials for an organization by type';
