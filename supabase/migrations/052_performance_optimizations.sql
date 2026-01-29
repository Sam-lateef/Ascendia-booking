-- Performance Optimizations for Multi-Tenancy Queries
-- This migration adds indexes and optimizes RLS policies

-- ============================================================================
-- PART 1: Add Missing Indexes
-- ============================================================================

-- Index for organization_members lookups (critical for RLS)
CREATE INDEX IF NOT EXISTS idx_organization_members_user_status 
  ON organization_members(user_id, status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_organization_members_org_user 
  ON organization_members(organization_id, user_id, status);

-- Index for users auth lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id 
  ON users(auth_user_id) 
  WHERE auth_user_id IS NOT NULL;

-- Index for channel_configurations
CREATE INDEX IF NOT EXISTS idx_channel_configurations_org_channel 
  ON channel_configurations(organization_id, channel);

-- Index for agent_configurations  
CREATE INDEX IF NOT EXISTS idx_agent_configurations_org_channel 
  ON agent_configurations(organization_id, channel);

-- Index for api_credentials active lookups
CREATE INDEX IF NOT EXISTS idx_api_credentials_org_type_active 
  ON api_credentials(organization_id, credential_type, is_active) 
  WHERE is_active = true;

-- ============================================================================
-- PART 2: Create Helper Function for RLS (much faster than subqueries)
-- ============================================================================

-- Function to get user's organization memberships
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE (organization_id UUID, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT om.organization_id, om.role
  FROM organization_members om
  JOIN users u ON u.id = om.user_id
  WHERE u.auth_user_id = auth.uid()
    AND om.status = 'active';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- PART 3: Optimize RLS Policies to use helper function
-- ============================================================================

-- Drop old slow policies
DROP POLICY IF EXISTS api_credentials_select_policy ON api_credentials;
DROP POLICY IF EXISTS api_credentials_insert_policy ON api_credentials;
DROP POLICY IF EXISTS api_credentials_update_policy ON api_credentials;
DROP POLICY IF EXISTS api_credentials_delete_policy ON api_credentials;

-- Optimized SELECT policy (no subquery!)
CREATE POLICY api_credentials_select_policy ON api_credentials
  FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM get_user_organizations())
  );

-- Optimized INSERT policy
CREATE POLICY api_credentials_insert_policy ON api_credentials
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations() 
      WHERE role IN ('owner', 'admin')
    )
  );

-- Optimized UPDATE policy
CREATE POLICY api_credentials_update_policy ON api_credentials
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations() 
      WHERE role IN ('owner', 'admin')
    )
  );

-- Optimized DELETE policy
CREATE POLICY api_credentials_delete_policy ON api_credentials
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations() 
      WHERE role = 'owner'
    )
  );

-- ============================================================================
-- PART 4: Optimize Other RLS Policies
-- ============================================================================

-- Channel configurations
DROP POLICY IF EXISTS channel_configurations_select_policy ON channel_configurations;
DROP POLICY IF EXISTS channel_configurations_insert_policy ON channel_configurations;
DROP POLICY IF EXISTS channel_configurations_update_policy ON channel_configurations;
DROP POLICY IF EXISTS channel_configurations_delete_policy ON channel_configurations;

CREATE POLICY channel_configurations_select_policy ON channel_configurations
  FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM get_user_organizations()));

CREATE POLICY channel_configurations_insert_policy ON channel_configurations
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations() 
      WHERE role IN ('owner', 'admin')
    )
  );

CREATE POLICY channel_configurations_update_policy ON channel_configurations
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations() 
      WHERE role IN ('owner', 'admin')
    )
  );

CREATE POLICY channel_configurations_delete_policy ON channel_configurations
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations() 
      WHERE role = 'owner'
    )
  );

-- Agent configurations
DROP POLICY IF EXISTS agent_configurations_select_policy ON agent_configurations;
DROP POLICY IF EXISTS agent_configurations_insert_policy ON agent_configurations;
DROP POLICY IF EXISTS agent_configurations_update_policy ON agent_configurations;
DROP POLICY IF EXISTS agent_configurations_delete_policy ON agent_configurations;

CREATE POLICY agent_configurations_select_policy ON agent_configurations
  FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM get_user_organizations()));

CREATE POLICY agent_configurations_insert_policy ON agent_configurations
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations() 
      WHERE role IN ('owner', 'admin')
    )
  );

CREATE POLICY agent_configurations_update_policy ON agent_configurations
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations() 
      WHERE role IN ('owner', 'admin')
    )
  );

CREATE POLICY agent_configurations_delete_policy ON agent_configurations
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM get_user_organizations() 
      WHERE role = 'owner'
    )
  );

-- ============================================================================
-- PART 5: Add Comments
-- ============================================================================

COMMENT ON FUNCTION get_user_organizations() IS 'Fast helper function for RLS policies - returns user''s organization memberships';
COMMENT ON INDEX idx_organization_members_user_status IS 'Speeds up RLS checks by user_id and status';
COMMENT ON INDEX idx_users_auth_user_id IS 'Speeds up user lookups by auth.uid()';
COMMENT ON INDEX idx_channel_configurations_org_channel IS 'Speeds up channel config lookups';
COMMENT ON INDEX idx_agent_configurations_org_channel IS 'Speeds up agent config lookups';
