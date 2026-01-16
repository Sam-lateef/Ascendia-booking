-- Run this in Supabase SQL Editor to see what's actually in dynamic_workflows

-- Check table structure
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'dynamic_workflows'
ORDER BY ordinal_position;

-- Check all workflows
SELECT 
    id,
    workflow_name,
    intent_triggers,
    domain_id,
    is_active,
    times_used,
    created_at
FROM dynamic_workflows
ORDER BY created_at DESC;

-- Check if domain_id column exists
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'dynamic_workflows' 
    AND column_name = 'domain_id'
) as domain_id_exists;

-- Count workflows
SELECT COUNT(*) as total_workflows FROM dynamic_workflows;





















