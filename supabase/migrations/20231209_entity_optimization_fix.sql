-- Fix: Update entity names to match actual database schema
-- The original migration used 'phone_number' but the entity is actually named 'phone'

-- First, check if 'phone_number' exists or if it's 'phone'
DO $$
BEGIN
  -- Update phone entity (use whichever name exists)
  UPDATE entity_definitions
  SET 
    is_core = TRUE,
    extraction_priority = 1,
    used_in_workflows = ARRAY['book', 'reschedule', 'cancel', 'check']
  WHERE name = 'phone' OR name = 'phone_number';
  
  -- Ensure firstName and lastName are also in reschedule
  UPDATE entity_definitions
  SET 
    used_in_workflows = array_append(
      COALESCE(used_in_workflows, ARRAY[]::TEXT[]), 
      'reschedule'
    )
  WHERE name IN ('firstName', 'lastName')
    AND NOT ('reschedule' = ANY(COALESCE(used_in_workflows, ARRAY[]::TEXT[])));
END $$;

-- Verify the fix
SELECT '=== ENTITIES FOR RESCHEDULE WORKFLOW ===' as info;
SELECT 
  name, 
  display_name,
  is_core,
  extraction_priority,
  used_in_workflows
FROM entity_definitions
WHERE 'reschedule' = ANY(used_in_workflows)
ORDER BY extraction_priority, name;

