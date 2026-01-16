-- Run this in Supabase SQL Editor to see what tables exist
-- This will tell you which migrations have been applied

SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('conversations', 'messages') THEN '✅ 001_initial_schema.sql'
    WHEN table_name = 'orchestrator_executions' THEN '✅ 20231203_learning_system.sql'
    WHEN table_name = 'workflow_patterns' THEN '✅ 20231203_learning_system.sql'
    WHEN table_name = 'conversation_feedback' THEN '✅ 20231203_learning_system.sql'
    WHEN table_name = 'dynamic_workflows' THEN '✅ 20231203_learning_system.sql'
    WHEN table_name = 'intent_triggers' THEN '✅ 20231205_intent_triggers.sql'
    WHEN table_name = 'domains' THEN '✅ 20231206_domain_agnostic.sql'
    WHEN table_name = 'function_registry' THEN '✅ 20231206_domain_agnostic.sql'
    WHEN table_name = 'entity_definitions' THEN '✅ 20231206_domain_agnostic.sql'
    ELSE 'Other table'
  END as migration_file
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check for specific columns to verify 20231201_conversation_state.sql
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

