-- Migration: Split instructions into separate fields
-- 
-- Problem: Currently storing all instructions in one TEXT field with string concatenation
-- Solution: Use separate columns for each instruction type
--
-- Run after: 052_performance_optimizations.sql

-- Add new instruction columns
ALTER TABLE channel_configurations 
ADD COLUMN IF NOT EXISTS one_agent_instructions TEXT,
ADD COLUMN IF NOT EXISTS receptionist_instructions TEXT,
ADD COLUMN IF NOT EXISTS supervisor_instructions TEXT;

-- Migrate existing data from old 'instructions' field
UPDATE channel_configurations
SET 
  one_agent_instructions = CASE 
    WHEN (settings->>'agent_mode' = 'one_agent' OR settings->>'agent_mode' IS NULL) 
         AND (instructions IS NOT NULL AND instructions NOT LIKE '%---SUPERVISOR---%')
    THEN instructions 
    ELSE NULL 
  END,
  receptionist_instructions = CASE 
    WHEN instructions IS NOT NULL AND instructions LIKE '%---SUPERVISOR---%'
    THEN TRIM(split_part(instructions, '---SUPERVISOR---', 1))
    ELSE NULL 
  END,
  supervisor_instructions = CASE 
    WHEN instructions IS NOT NULL AND instructions LIKE '%---SUPERVISOR---%'
    THEN TRIM(split_part(instructions, '---SUPERVISOR---', 2))
    ELSE NULL 
  END
WHERE instructions IS NOT NULL;

-- Keep old 'instructions' column for now (for backward compatibility during transition)
-- We'll drop it in a future migration after verifying everything works

-- Add comments
COMMENT ON COLUMN channel_configurations.one_agent_instructions IS 'Instructions for single-agent mode (GPT-4o or GPT-4o-mini)';
COMMENT ON COLUMN channel_configurations.receptionist_instructions IS 'Instructions for two-agent mode receptionist (GPT-4o-mini)';
COMMENT ON COLUMN channel_configurations.supervisor_instructions IS 'Instructions for two-agent mode supervisor (GPT-4o)';

-- Log migration
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM channel_configurations
  WHERE one_agent_instructions IS NOT NULL 
     OR receptionist_instructions IS NOT NULL 
     OR supervisor_instructions IS NOT NULL;
  
  RAISE NOTICE 'Migration complete: Migrated % channel configurations', migrated_count;
END $$;
