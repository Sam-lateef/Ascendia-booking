-- ============================================
-- System-level credentials (organization_id = NULL)
-- ============================================
-- Platform-wide credentials used by all orgs (e.g. Google OAuth Client ID/Secret, OpenAI).
-- Stored once, shared. Per-org credentials (refresh_token, etc.) stay in org rows.
--
-- Run after: 060_vapi_assistants.sql

-- Ensure get_user_organizations() exists (0-arg, uses auth.uid) - may be from 052
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

-- Allow NULL organization_id for system credentials
ALTER TABLE api_credentials
  ALTER COLUMN organization_id DROP NOT NULL;

-- Drop FK for NULL - actually FK allows NULL by default (no action on NULL)
-- Add partial unique index: only one system credential per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_credentials_system_unique
  ON api_credentials (credential_type)
  WHERE organization_id IS NULL;

-- Update RLS: allow read/write of system credentials for org owners/admins
DROP POLICY IF EXISTS api_credentials_select_policy ON api_credentials;
DROP POLICY IF EXISTS api_credentials_insert_policy ON api_credentials;
DROP POLICY IF EXISTS api_credentials_update_policy ON api_credentials;
DROP POLICY IF EXISTS api_credentials_delete_policy ON api_credentials;

-- SELECT: org creds for user's orgs OR system creds (system creds visible to system org owners only via app logic)
CREATE POLICY api_credentials_select_policy ON api_credentials
  FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM get_user_organizations())
    OR organization_id IS NULL
  );

-- INSERT: org creds for owner/admin OR system creds (any org owner/admin can create)
CREATE POLICY api_credentials_insert_policy ON api_credentials
  FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND organization_id IN (
      SELECT organization_id FROM get_user_organizations() WHERE role IN ('owner', 'admin')
    ))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM get_user_organizations() WHERE role IN ('owner', 'admin')
    ))
  );

-- UPDATE: same pattern
CREATE POLICY api_credentials_update_policy ON api_credentials
  FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND organization_id IN (
      SELECT organization_id FROM get_user_organizations() WHERE role IN ('owner', 'admin')
    ))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM get_user_organizations() WHERE role IN ('owner', 'admin')
    ))
  );

-- DELETE: org owners can delete org creds; owners can delete system creds
CREATE POLICY api_credentials_delete_policy ON api_credentials
  FOR DELETE
  USING (
    (organization_id IS NOT NULL AND organization_id IN (
      SELECT organization_id FROM get_user_organizations() WHERE role = 'owner'
    ))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM get_user_organizations() WHERE role IN ('owner', 'admin')
    ))
  );

-- Update trigger: ensure_single_default_credential - handle NULL org_id
-- The trigger runs per-row; for organization_id NULL, "other defaults" = other rows with org_id NULL
-- Check existing trigger logic
CREATE OR REPLACE FUNCTION ensure_single_default_credential()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    IF NEW.organization_id IS NULL THEN
      -- System cred: unset other system defaults for this type
      UPDATE api_credentials
      SET is_default = false
      WHERE organization_id IS NULL
        AND credential_type = NEW.credential_type
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    ELSE
      -- Org cred: existing logic
      UPDATE api_credentials
      SET is_default = false
      WHERE organization_id = NEW.organization_id
        AND credential_type = NEW.credential_type
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON INDEX idx_api_credentials_system_unique IS 'Only one system credential per type (org_id NULL)';
