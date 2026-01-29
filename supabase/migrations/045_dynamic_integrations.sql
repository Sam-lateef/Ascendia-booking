-- ============================================
-- Dynamic External Integration System
-- ============================================
-- Database-driven integration framework for OpenDental, Dentrix, Google Calendar, etc.
-- Zero code changes required for new integrations
--
-- Run after: 044_api_credentials.sql

-- ============================================
-- Table 1: external_integrations
-- Provider configurations per organization
-- ============================================
CREATE TABLE IF NOT EXISTS external_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Provider identification
  provider_key TEXT NOT NULL,         -- 'opendental', 'dentrix', 'google_calendar'
  provider_name TEXT NOT NULL,        -- 'OpenDental', 'Dentrix Ascend', 'Google Calendar'
  provider_type TEXT NOT NULL,        -- 'dental_pms', 'calendar', 'crm', 'billing'
  
  -- Base configuration
  api_base_url TEXT NOT NULL,         -- 'https://api.opendental.com/api/v1'
  api_version TEXT,                   -- 'v1', '2.0', etc.
  
  -- Authentication
  auth_type TEXT NOT NULL,            -- 'bearer', 'api_key', 'oauth2', 'basic', 'custom'
  auth_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Examples:
  -- bearer: { "credential_type": "opendental", "credential_key": "api_key" }
  -- api_key: { "header_name": "Authorization", "prefix": "ODFHIR ", "credential_type": "opendental", "credential_key": "api_key" }
  -- oauth2: { "token_url": "...", "credential_type": "...", "client_id_key": "client_id", "client_secret_key": "client_secret" }
  
  -- Request configuration
  default_headers JSONB DEFAULT '{}'::JSONB,  -- { "Content-Type": "application/json" }
  timeout_ms INTEGER DEFAULT 30000,
  retry_config JSONB DEFAULT '{"max_retries": 3, "backoff": "exponential"}'::JSONB,
  
  -- Status
  is_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,   -- Only one default per type per org
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, provider_key)
);

-- Indexes for external_integrations
CREATE INDEX idx_external_integrations_org ON external_integrations(organization_id);
CREATE INDEX idx_external_integrations_provider ON external_integrations(provider_key);
CREATE INDEX idx_external_integrations_type ON external_integrations(provider_type);
CREATE INDEX idx_external_integrations_enabled ON external_integrations(is_enabled) WHERE is_enabled = true;

-- ============================================
-- Table 2: integration_endpoints
-- Function registry per integration
-- ============================================
CREATE TABLE IF NOT EXISTS integration_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES external_integrations(id) ON DELETE CASCADE,
  
  -- Function identification
  function_name TEXT NOT NULL,        -- 'GetPatients', 'CreateAppointment'
  category TEXT,                      -- 'patients', 'appointments', 'calendar_events'
  description TEXT,
  
  -- HTTP configuration
  endpoint_path TEXT NOT NULL,        -- '/patients', '/appointments/{AptNum}'
  http_method TEXT NOT NULL,          -- 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'
  
  -- Parameter handling
  path_params TEXT[] DEFAULT '{}',    -- ['AptNum', 'PatNum']
  query_params TEXT[] DEFAULT '{}',   -- ['dateStart', 'dateEnd']
  body_params TEXT[] DEFAULT '{}',    -- ['FName', 'LName']
  required_params TEXT[] DEFAULT '{}', -- ['PatNum']
  
  -- Request/response configuration
  request_format TEXT DEFAULT 'json', -- 'json', 'form', 'xml'
  response_format TEXT DEFAULT 'json', -- 'json', 'xml'
  
  -- Transformation (optional - for complex transforms)
  request_transform JSONB,            -- Custom transformation rules
  response_transform JSONB,           -- Response normalization rules
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(integration_id, function_name)
);

-- Indexes for integration_endpoints
CREATE INDEX idx_integration_endpoints_integration ON integration_endpoints(integration_id);
CREATE INDEX idx_integration_endpoints_function ON integration_endpoints(function_name);
CREATE INDEX idx_integration_endpoints_category ON integration_endpoints(category);
CREATE INDEX idx_integration_endpoints_active ON integration_endpoints(is_active) WHERE is_active = true;

-- ============================================
-- Table 3: integration_parameter_maps
-- Dynamic parameter name mapping
-- ============================================
CREATE TABLE IF NOT EXISTS integration_parameter_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES integration_endpoints(id) ON DELETE CASCADE,
  
  -- Mapping
  internal_name TEXT NOT NULL,        -- 'patient_id', 'first_name', 'appointment_date'
  external_name TEXT NOT NULL,        -- 'PatNum', 'FName', 'AptDateTime'
  
  -- Transformation rules
  transform_type TEXT DEFAULT 'rename', -- 'rename', 'format_date', 'clean_phone', 'custom'
  transform_config JSONB DEFAULT '{}'::JSONB,
  -- Examples:
  -- { "type": "date_format", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD HH:mm:ss" }
  -- { "type": "phone_format", "remove_formatting": true }
  -- { "type": "case_transform", "to": "title_case" }
  -- { "type": "default_value", "value": 1 }
  
  -- Direction
  direction TEXT DEFAULT 'request',   -- 'request', 'response', 'both'
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(endpoint_id, internal_name, direction)
);

-- Indexes for integration_parameter_maps
CREATE INDEX idx_integration_parameter_maps_endpoint ON integration_parameter_maps(endpoint_id);
CREATE INDEX idx_integration_parameter_maps_internal ON integration_parameter_maps(internal_name);

-- ============================================
-- Table 4: integration_sync_configs
-- Per-organization sync settings
-- ============================================
CREATE TABLE IF NOT EXISTS integration_sync_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES external_integrations(id) ON DELETE CASCADE,
  
  -- Sync configuration
  sync_enabled BOOLEAN DEFAULT true,
  sync_direction TEXT NOT NULL DEFAULT 'local_only',
  -- 'local_only': Write only to local DB, no external sync
  -- 'to_external': Sync from local to external (one-way push)
  -- 'from_external': Sync from external to local (one-way pull)
  -- 'bidirectional': Two-way sync
  
  -- Operation toggles
  sync_on_create BOOLEAN DEFAULT true,
  sync_on_update BOOLEAN DEFAULT true,
  sync_on_delete BOOLEAN DEFAULT false,
  
  -- Local copy policy
  always_keep_local_copy BOOLEAN DEFAULT true,
  -- true: Dual-write (create local copy AND sync to external)
  -- false: External only (write directly to external, no local copy)
  
  -- Conflict resolution
  conflict_resolution TEXT DEFAULT 'external_wins',
  -- 'external_wins': External data takes precedence
  -- 'local_wins': Local data takes precedence
  -- 'manual': Require manual resolution
  -- 'latest_timestamp': Most recent update wins
  
  -- Webhooks/callbacks
  webhook_url TEXT,
  webhook_events TEXT[] DEFAULT '{}',
  webhook_secret TEXT,
  
  -- Status tracking
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,              -- 'success', 'error', 'partial'
  last_sync_error TEXT,
  sync_statistics JSONB DEFAULT '{}'::JSONB,
  -- Example: { "total_synced": 100, "failed": 2, "last_30_days": 95 }
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, integration_id)
);

-- Indexes for integration_sync_configs
CREATE INDEX idx_integration_sync_configs_org ON integration_sync_configs(organization_id);
CREATE INDEX idx_integration_sync_configs_integration ON integration_sync_configs(integration_id);
CREATE INDEX idx_integration_sync_configs_enabled ON integration_sync_configs(sync_enabled) WHERE sync_enabled = true;

-- ============================================
-- Functions and Triggers
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trg_external_integrations_updated_at
  BEFORE UPDATE ON external_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();

CREATE TRIGGER trg_integration_endpoints_updated_at
  BEFORE UPDATE ON integration_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();

CREATE TRIGGER trg_integration_sync_configs_updated_at
  BEFORE UPDATE ON integration_sync_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();

-- Ensure only one default integration per type per org
CREATE OR REPLACE FUNCTION ensure_single_default_integration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other defaults for this org + type
    UPDATE external_integrations
    SET is_default = false
    WHERE organization_id = NEW.organization_id
      AND provider_type = NEW.provider_type
      AND id != NEW.id
      AND is_default = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ensure_single_default_integration
  BEFORE INSERT OR UPDATE ON external_integrations
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_integration();

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_parameter_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_configs ENABLE ROW LEVEL SECURITY;

-- external_integrations policies
CREATE POLICY external_integrations_select_policy ON external_integrations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY external_integrations_insert_policy ON external_integrations
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY external_integrations_update_policy ON external_integrations
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY external_integrations_delete_policy ON external_integrations
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role = 'owner'
    )
  );

-- integration_endpoints policies (access via integration's organization)
CREATE POLICY integration_endpoints_select_policy ON integration_endpoints
  FOR SELECT
  USING (
    integration_id IN (
      SELECT id FROM external_integrations 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY integration_endpoints_insert_policy ON integration_endpoints
  FOR INSERT
  WITH CHECK (
    integration_id IN (
      SELECT id FROM external_integrations 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY integration_endpoints_update_policy ON integration_endpoints
  FOR UPDATE
  USING (
    integration_id IN (
      SELECT id FROM external_integrations 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY integration_endpoints_delete_policy ON integration_endpoints
  FOR DELETE
  USING (
    integration_id IN (
      SELECT id FROM external_integrations 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

-- integration_parameter_maps policies (access via endpoint's integration's organization)
CREATE POLICY integration_parameter_maps_select_policy ON integration_parameter_maps
  FOR SELECT
  USING (
    endpoint_id IN (
      SELECT ie.id FROM integration_endpoints ie
      JOIN external_integrations ei ON ie.integration_id = ei.id
      WHERE ei.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY integration_parameter_maps_insert_policy ON integration_parameter_maps
  FOR INSERT
  WITH CHECK (
    endpoint_id IN (
      SELECT ie.id FROM integration_endpoints ie
      JOIN external_integrations ei ON ie.integration_id = ei.id
      WHERE ei.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY integration_parameter_maps_update_policy ON integration_parameter_maps
  FOR UPDATE
  USING (
    endpoint_id IN (
      SELECT ie.id FROM integration_endpoints ie
      JOIN external_integrations ei ON ie.integration_id = ei.id
      WHERE ei.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY integration_parameter_maps_delete_policy ON integration_parameter_maps
  FOR DELETE
  USING (
    endpoint_id IN (
      SELECT ie.id FROM integration_endpoints ie
      JOIN external_integrations ei ON ie.integration_id = ei.id
      WHERE ei.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

-- integration_sync_configs policies
CREATE POLICY integration_sync_configs_select_policy ON integration_sync_configs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY integration_sync_configs_insert_policy ON integration_sync_configs
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY integration_sync_configs_update_policy ON integration_sync_configs
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY integration_sync_configs_delete_policy ON integration_sync_configs
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role = 'owner'
    )
  );

-- ============================================
-- Helper Views
-- ============================================

-- View: Integration summary with endpoint count
CREATE OR REPLACE VIEW integration_summary AS
SELECT 
  ei.id,
  ei.organization_id,
  ei.provider_key,
  ei.provider_name,
  ei.provider_type,
  ei.is_enabled,
  ei.is_default,
  COUNT(DISTINCT ie.id) as endpoint_count,
  COUNT(DISTINCT isc.id) as has_sync_config,
  isc.sync_enabled,
  isc.sync_direction,
  ei.created_at,
  ei.updated_at
FROM external_integrations ei
LEFT JOIN integration_endpoints ie ON ie.integration_id = ei.id AND ie.is_active = TRUE
LEFT JOIN integration_sync_configs isc ON isc.integration_id = ei.id
GROUP BY ei.id, ei.organization_id, ei.provider_key, ei.provider_name, 
         ei.provider_type, ei.is_enabled, ei.is_default, isc.sync_enabled, 
         isc.sync_direction, ei.created_at, ei.updated_at;

-- View: Endpoint details with parameter counts
CREATE OR REPLACE VIEW endpoint_details AS
SELECT 
  ie.id,
  ie.integration_id,
  ei.provider_key,
  ie.function_name,
  ie.category,
  ie.http_method,
  ie.endpoint_path,
  array_length(ie.path_params, 1) as path_param_count,
  array_length(ie.query_params, 1) as query_param_count,
  array_length(ie.body_params, 1) as body_param_count,
  COUNT(ipm.id) as parameter_map_count,
  ie.is_active
FROM integration_endpoints ie
JOIN external_integrations ei ON ie.integration_id = ei.id
LEFT JOIN integration_parameter_maps ipm ON ipm.endpoint_id = ie.id
GROUP BY ie.id, ie.integration_id, ei.provider_key, ie.function_name, 
         ie.category, ie.http_method, ie.endpoint_path, ie.path_params, 
         ie.query_params, ie.body_params, ie.is_active;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE external_integrations IS 'External API integration configurations per organization';
COMMENT ON TABLE integration_endpoints IS 'Function registry for each integration - defines available API calls';
COMMENT ON TABLE integration_parameter_maps IS 'Parameter name mappings and transformations between internal and external formats';
COMMENT ON TABLE integration_sync_configs IS 'Per-organization sync settings - controls dual-write and sync behavior';

COMMENT ON COLUMN external_integrations.auth_config IS 'JSONB configuration for authentication - references api_credentials table';
COMMENT ON COLUMN integration_endpoints.path_params IS 'Array of parameter names that go in the URL path (e.g., {AptNum})';
COMMENT ON COLUMN integration_endpoints.query_params IS 'Array of parameter names that go in the query string';
COMMENT ON COLUMN integration_endpoints.body_params IS 'Array of parameter names that go in the request body';
COMMENT ON COLUMN integration_parameter_maps.transform_type IS 'Type of transformation: rename, format_date, clean_phone, custom';
COMMENT ON COLUMN integration_sync_configs.sync_direction IS 'local_only, to_external, from_external, or bidirectional';
COMMENT ON COLUMN integration_sync_configs.always_keep_local_copy IS 'If true, always create local copy even when syncing to external';
