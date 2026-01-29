-- ============================================================================
-- Link All Existing Data to Default Organization
-- ============================================================================
-- This migration:
-- 1. Creates a default organization (if not exists)
-- 2. Updates ALL existing records to reference this organization
-- 3. Ensures you don't lose any data during the multi-tenancy migration
-- ============================================================================

BEGIN;

-- Step 1: Create default organization
INSERT INTO organizations (id, name, slug, plan, status, created_at, updated_at)
VALUES (
  'default-org-00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default-org',
  'professional',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Store the default org ID for reference
DO $$
DECLARE
  default_org_id UUID := 'default-org-00000000-0000-0000-0000-000000000001';
BEGIN
  RAISE NOTICE 'Default Organization ID: %', default_org_id;
  
  -- Step 2: Update all existing data to reference the default organization
  
  -- Update patients
  UPDATE patients
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % patients', (SELECT COUNT(*) FROM patients WHERE organization_id = default_org_id);
  
  -- Update providers
  UPDATE providers
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % providers', (SELECT COUNT(*) FROM providers WHERE organization_id = default_org_id);
  
  -- Update operatories
  UPDATE operatories
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % operatories', (SELECT COUNT(*) FROM operatories WHERE organization_id = default_org_id);
  
  -- Update schedules
  UPDATE schedules
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % schedules', (SELECT COUNT(*) FROM schedules WHERE organization_id = default_org_id);
  
  -- Update appointments
  UPDATE appointments
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % appointments', (SELECT COUNT(*) FROM appointments WHERE organization_id = default_org_id);
  
  -- Update treatment_plans
  UPDATE treatment_plans
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % treatment_plans', (SELECT COUNT(*) FROM treatment_plans WHERE organization_id = default_org_id);
  
  -- Update treatment_plan_items
  UPDATE treatment_plan_items
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % treatment_plan_items', (SELECT COUNT(*) FROM treatment_plan_items WHERE organization_id = default_org_id);
  
  -- Update treatments_catalog
  UPDATE treatments_catalog
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % treatments_catalog', (SELECT COUNT(*) FROM treatments_catalog WHERE organization_id = default_org_id);
  
  -- Update agent_instructions
  UPDATE agent_instructions
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % agent_instructions', (SELECT COUNT(*) FROM agent_instructions WHERE organization_id = default_org_id);
  
  -- Update agent_modes
  UPDATE agent_modes
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % agent_modes', (SELECT COUNT(*) FROM agent_modes WHERE organization_id = default_org_id);
  
  -- Update whatsapp_instances
  UPDATE whatsapp_instances
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % whatsapp_instances', (SELECT COUNT(*) FROM whatsapp_instances WHERE organization_id = default_org_id);
  
  -- Update whatsapp_conversations
  UPDATE whatsapp_conversations
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % whatsapp_conversations', (SELECT COUNT(*) FROM whatsapp_conversations WHERE organization_id = default_org_id);
  
  -- Update whatsapp_messages
  UPDATE whatsapp_messages
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % whatsapp_messages', (SELECT COUNT(*) FROM whatsapp_messages WHERE organization_id = default_org_id);
  
END $$;

-- Step 3: Verify the migration
SELECT 
  'organizations' as table_name,
  COUNT(*) as total_records
FROM organizations
WHERE id = 'default-org-00000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 
  'patients' as table_name,
  COUNT(*) as total_records
FROM patients
WHERE organization_id = 'default-org-00000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 
  'providers' as table_name,
  COUNT(*) as total_records
FROM providers
WHERE organization_id = 'default-org-00000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 
  'appointments' as table_name,
  COUNT(*) as total_records
FROM appointments
WHERE organization_id = 'default-org-00000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 
  'treatment_plans' as table_name,
  COUNT(*) as total_records
FROM treatment_plans
WHERE organization_id = 'default-org-00000000-0000-0000-0000-000000000001';

COMMIT;

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- All your existing data is now linked to the "Default Organization"
-- 
-- Next steps:
-- 1. Sign up at http://localhost:3000/signup with your email
-- 2. Run: node scripts/setup-first-org.js your@email.com
--    OR manually link your auth user to the default org
-- 3. Log in and you'll see all your existing data!
-- ============================================================================
