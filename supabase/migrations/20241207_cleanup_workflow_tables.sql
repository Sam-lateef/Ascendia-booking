-- Migration: Remove Workflow System Tables
-- Created: 2024-12-07
-- Description: Drop all workflow-related tables to restore original orchestrator-only architecture

-- Drop workflow execution and generation tables
DROP TABLE IF EXISTS workflow_execution_logs CASCADE;
DROP TABLE IF EXISTS dynamic_workflows CASCADE;
DROP TABLE IF EXISTS workflow_entities CASCADE;

-- Drop agent configuration tables (workflows, business rules)
DROP TABLE IF EXISTS agent_workflows CASCADE;
DROP TABLE IF EXISTS business_rules CASCADE;

-- Drop domain and entity management tables
DROP TABLE IF EXISTS extracted_entities CASCADE;
DROP TABLE IF EXISTS domains CASCADE;

-- Keep essential booking tables:
-- - appointments
-- - patients
-- - providers
-- - operatories
-- - provider_schedules
-- - conversation_state (for session management)
-- - hallucination_prevention_patterns (for validation)
-- - agent_prompts (for Lexi persona and orchestrator instructions)

-- Note: This migration removes all workflow-related functionality
-- The system will now use the LLM-based orchestrator with hardcoded instructions





























