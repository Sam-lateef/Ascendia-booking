-- Migration: Fix RLS organization variable mismatch
-- The setter and getter were using different variable names!

-- Fix the get function to use the correct variable name
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS UUID AS $$
BEGIN
  -- Fix: Use the same variable name as set_rls_organization_id
  -- Was: app.current_org_id
  -- Now: app.current_organization_id
  RETURN NULLIF(current_setting('app.current_organization_id', TRUE), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_organization_id IS 'Gets the current organization ID from session variable (set by set_rls_organization_id)';
