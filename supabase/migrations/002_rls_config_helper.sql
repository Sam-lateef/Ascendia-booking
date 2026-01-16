-- ============================================================================
-- MIGRATION 002: RLS Configuration Helper
-- ============================================================================
-- Creates helper function for setting session variables from API
-- ============================================================================

-- Function to set configuration (used by middleware)
CREATE OR REPLACE FUNCTION set_config(key TEXT, value TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config(key, value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION set_config(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_config(TEXT, TEXT) TO anon;

COMMENT ON FUNCTION set_config IS 'Allows API to set session variables for RLS context';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 002 complete - RLS config helper';
  RAISE NOTICE '';
END $$;
