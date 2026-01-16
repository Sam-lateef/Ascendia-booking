-- Migration: Entity Extraction Optimization
-- Add workflow tagging and core entity flagging for context-aware extraction

-- ============================================
-- Update entity_definitions table
-- ============================================

-- Add workflow tagging (which workflows use this entity)
ALTER TABLE entity_definitions
ADD COLUMN IF NOT EXISTS used_in_workflows TEXT[] DEFAULT '{}';

-- Add core entity flag (always extracted regardless of workflow)
ALTER TABLE entity_definitions
ADD COLUMN IF NOT EXISTS is_core BOOLEAN DEFAULT FALSE;

-- Add extraction priority (lower = extract first)
ALTER TABLE entity_definitions
ADD COLUMN IF NOT EXISTS extraction_priority INTEGER DEFAULT 50;

-- ============================================
-- Seed Core Entities
-- ============================================

-- Mark core entities (always needed)
UPDATE entity_definitions
SET 
  is_core = TRUE,
  extraction_priority = 1,
  used_in_workflows = ARRAY['book', 'reschedule', 'cancel', 'check']
WHERE name IN ('patient_name', 'phone_number', 'confirmation');

-- Tag workflow-specific entities
-- Booking entities
UPDATE entity_definitions
SET 
  used_in_workflows = ARRAY['book'],
  extraction_priority = 10
WHERE name IN ('appointment_type', 'preferred_date', 'time_preference');

-- Reschedule entities
UPDATE entity_definitions
SET 
  used_in_workflows = ARRAY['reschedule'],
  extraction_priority = 10
WHERE name IN ('new_date', 'new_time', 'appointment_to_change');

-- Cancel entities
UPDATE entity_definitions
SET 
  used_in_workflows = ARRAY['cancel'],
  extraction_priority = 10
WHERE name IN ('appointment_to_cancel', 'cancellation_reason');

-- Check appointment entities
UPDATE entity_definitions
SET 
  used_in_workflows = ARRAY['check'],
  extraction_priority = 10
WHERE name IN ('check_date_range');

-- ============================================
-- Create helper view
-- ============================================

-- View: Entities grouped by workflow
CREATE OR REPLACE VIEW entities_by_workflow AS
SELECT 
  workflow,
  array_agg(name ORDER BY extraction_priority, name) as entity_names,
  COUNT(*) as entity_count
FROM entity_definitions,
LATERAL unnest(used_in_workflows) AS workflow
WHERE is_active = true
GROUP BY workflow
ORDER BY workflow;

-- View: Core entities (always extracted)
CREATE OR REPLACE VIEW core_entities AS
SELECT 
  id,
  name,
  display_name,
  data_type,
  extraction_hint,
  extraction_priority
FROM entity_definitions
WHERE is_core = true AND is_active = true
ORDER BY extraction_priority, name;

-- ============================================
-- Helper function: Get entities for workflow
-- ============================================

CREATE OR REPLACE FUNCTION get_entities_for_workflow(
  p_domain_id UUID,
  p_workflow_id TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  display_name TEXT,
  data_type TEXT,
  extraction_hint TEXT,
  validation_type TEXT,
  extraction_priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.display_name,
    e.data_type,
    e.extraction_hint,
    e.validation_type,
    e.extraction_priority
  FROM entity_definitions e
  WHERE e.domain_id = p_domain_id
    AND e.is_active = true
    AND (
      e.is_core = true  -- Always include core entities
      OR p_workflow_id = ANY(e.used_in_workflows)  -- Or workflow-specific
    )
  ORDER BY e.extraction_priority, e.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Verify migration
-- ============================================

-- Show core entities
SELECT '=== CORE ENTITIES (Always Extracted) ===' as info;
SELECT name, extraction_priority FROM core_entities;

-- Show entities by workflow
SELECT '=== ENTITIES BY WORKFLOW ===' as info;
SELECT * FROM entities_by_workflow;

-- Test helper function (if domain exists)
DO $$
DECLARE
  test_domain_id UUID;
BEGIN
  SELECT id INTO test_domain_id FROM domains WHERE is_active = true LIMIT 1;
  
  IF test_domain_id IS NOT NULL THEN
    RAISE NOTICE '=== TEST: Entities for "book" workflow ===';
    PERFORM name FROM get_entities_for_workflow(test_domain_id, 'book');
  END IF;
END $$;

