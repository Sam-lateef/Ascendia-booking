-- Fix RLS policies for api_credentials table to use organization_members instead of organization_users

-- Drop old policies
DROP POLICY IF EXISTS api_credentials_select_policy ON api_credentials;
DROP POLICY IF EXISTS api_credentials_insert_policy ON api_credentials;
DROP POLICY IF EXISTS api_credentials_update_policy ON api_credentials;
DROP POLICY IF EXISTS api_credentials_delete_policy ON api_credentials;

-- Users can only see credentials for their organization
CREATE POLICY api_credentials_select_policy ON api_credentials
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE u.auth_user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- Only owners and admins can insert credentials
CREATE POLICY api_credentials_insert_policy ON api_credentials
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE u.auth_user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
    )
  );

-- Only owners and admins can update credentials
CREATE POLICY api_credentials_update_policy ON api_credentials
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE u.auth_user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
    )
  );

-- Only owners can delete credentials
CREATE POLICY api_credentials_delete_policy ON api_credentials
  FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE u.auth_user_id = auth.uid()
      AND om.role = 'owner'
      AND om.status = 'active'
    )
  );

COMMENT ON POLICY api_credentials_select_policy ON api_credentials IS 'Users can view credentials for organizations they belong to';
COMMENT ON POLICY api_credentials_insert_policy ON api_credentials IS 'Only owners and admins can create credentials';
COMMENT ON POLICY api_credentials_update_policy ON api_credentials IS 'Only owners and admins can update credentials';
COMMENT ON POLICY api_credentials_delete_policy ON api_credentials IS 'Only owners can delete credentials';
