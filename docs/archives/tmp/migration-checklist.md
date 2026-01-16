# Migration Checklist - What's Applied?

Run the `check-migrations.sql` in Supabase SQL Editor, or manually check:

## ✅ 001_initial_schema.sql
**Check:** Do these tables exist?
- `conversations` (with columns: session_id, intent, stage, etc.)
- `messages` (with columns: session_id, role, content, etc.)

## ✅/❌ 20231201_conversation_state.sql
**Check:** Does `conversations` table have these columns?
- `appointment_info` (JSONB)
- `patient_info` (JSONB)
- `last_function_call` (TEXT)
- `last_function_result` (JSONB)

If YES → Applied ✅  
If NO → Need to apply ❌

## ✅/❌ 20231203_learning_system.sql
**Check:** Do these tables exist?
- `orchestrator_executions`
- `workflow_patterns`
- `conversation_feedback`
- `dynamic_workflows`

If ALL exist → Applied ✅  
If NONE exist → Need to apply ❌

## ✅/❌ 20231204_seed_workflows.sql
**Check:** Does `dynamic_workflows` table have any rows?
```sql
SELECT COUNT(*) FROM dynamic_workflows;
```
If > 0 → Probably applied ✅  
If 0 → Either not applied or no seed data ❌

## ✅/❌ 20231205_intent_triggers.sql
**Check:** Does this table exist?
- `intent_triggers`

If YES → Applied ✅  
If NO → Need to apply ❌

## ✅/❌ 20231206_domain_agnostic.sql
**Check:** Do these tables exist?
- `domains`
- `function_registry`
- `entity_definitions`

If ALL exist → Applied ✅  
If NONE exist → Need to apply ❌

---

## Quick Check Query

Run this in Supabase SQL Editor:

```sql
-- List all your tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables if ALL migrations applied:
- conversations
- conversation_feedback
- domains
- dynamic_workflows
- entity_definitions
- function_registry
- intent_triggers
- messages
- orchestrator_executions
- workflow_patterns

---

## What to Apply Next?

Based on what you find, apply the missing migrations **in order**:

1. If missing `appointment_info` column → Apply `20231201_conversation_state.sql`
2. If missing `orchestrator_executions` → Apply `20231203_learning_system.sql`
3. If missing seed data → Apply `20231204_seed_workflows.sql`
4. If missing `intent_triggers` → Apply `20231205_intent_triggers.sql`
5. If missing `domains` → Apply `20231206_domain_agnostic.sql`

