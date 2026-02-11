-- ============================================
-- System org: first org = platform admin org
-- ============================================
-- The first org (by created_at) becomes the "system org".
-- Only the owner of the system org sees System Settings (Platform integrations, etc.).
-- All other org members across all orgs see their org-specific settings only.
--
-- Run after: 061_system_credentials.sql

-- Add is_system_org flag
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_system_org BOOLEAN DEFAULT false;

-- Set first org as system org (by created_at)
WITH first_org AS (
  SELECT id FROM organizations
  WHERE deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE organizations
SET is_system_org = true, updated_at = NOW()
WHERE id = (SELECT id FROM first_org);

-- Ensure only ONE owner in system org: prefer user with email containing 'demo'
DO $$
DECLARE
  sys_org_id UUID;
  demo_user_id UUID;
BEGIN
  SELECT id INTO sys_org_id FROM organizations WHERE is_system_org = true LIMIT 1;
  IF sys_org_id IS NULL THEN RETURN; END IF;

  -- Find demo user (email contains 'demo' or is demo@ascendia.ai)
  SELECT u.id INTO demo_user_id
  FROM users u
  JOIN organization_members om ON om.user_id = u.id AND om.organization_id = sys_org_id
  WHERE u.email ILIKE '%demo%'
  ORDER BY CASE WHEN u.email = 'demo@ascendia.ai' THEN 0 ELSE 1 END
  LIMIT 1;

  -- If no demo user in org, use first owner
  IF demo_user_id IS NULL THEN
    SELECT user_id INTO demo_user_id
    FROM organization_members
    WHERE organization_id = sys_org_id AND role = 'owner' AND status = 'active'
    LIMIT 1;
  END IF;

  -- Demote all owners to admin
  UPDATE organization_members SET role = 'admin', updated_at = NOW()
  WHERE organization_id = sys_org_id AND role = 'owner';

  -- Promote selected user to owner
  IF demo_user_id IS NOT NULL THEN
    UPDATE organization_members SET role = 'owner', updated_at = NOW()
    WHERE organization_id = sys_org_id AND user_id = demo_user_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_is_system_org ON organizations(is_system_org) WHERE is_system_org = true;

COMMENT ON COLUMN organizations.is_system_org IS 'True for the platform admin org. Only its owner sees System Settings.';
