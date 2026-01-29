-- ============================================================================
-- MIGRATION 002: RLS Configuration Helper
-- ============================================================================
-- Creates helper function for setting session variables from API
-- ============================================================================

-- Function to set RLS organization context (used by middleware)
CREATE OR REPLACE FUNCTION set_rls_organization_id(org_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_organization_id', org_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION set_rls_organization_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_rls_organization_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION set_rls_organization_id(UUID) TO service_role;

COMMENT ON FUNCTION set_rls_organization_id IS 'Sets the current organization ID for RLS policies';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 002 complete - RLS config helper';
  RAISE NOTICE '';
END $$;
