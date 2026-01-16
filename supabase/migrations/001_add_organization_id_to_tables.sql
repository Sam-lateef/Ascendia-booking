-- ============================================================================
-- MIGRATION 001: Add organization_id to All Existing Tables
-- ============================================================================
-- Adds organization_id foreign key to all tables for multi-tenancy
-- Migrates existing data to default organization
-- ============================================================================

-- Get default organization ID
DO $$
DECLARE
  default_org_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  RAISE NOTICE 'Using default organization: %', default_org_id;
END $$;

-- ============================================================================
-- BOOKING SYSTEM TABLES
-- ============================================================================

-- Providers
ALTER TABLE providers ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE providers SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
ALTER TABLE providers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE providers ADD CONSTRAINT fk_providers_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_providers_org_id ON providers(organization_id);

-- Operatories
ALTER TABLE operatories ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE operatories SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
ALTER TABLE operatories ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE operatories ADD CONSTRAINT fk_operatories_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_operatories_org_id ON operatories(organization_id);

-- Provider Schedules
ALTER TABLE provider_schedules ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE provider_schedules SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
ALTER TABLE provider_schedules ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE provider_schedules ADD CONSTRAINT fk_provider_schedules_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_provider_schedules_org_id ON provider_schedules(organization_id);

-- Patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE patients SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
ALTER TABLE patients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE patients ADD CONSTRAINT fk_patients_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_patients_org_id ON patients(organization_id);

-- Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE appointments SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
ALTER TABLE appointments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_appointments_org_id ON appointments(organization_id);

-- ============================================================================
-- CONVERSATION SYSTEM TABLES
-- ============================================================================

-- Conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE conversations SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
ALTER TABLE conversations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE conversations ADD CONSTRAINT fk_conversations_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON conversations(organization_id);

-- Conversation Messages
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS organization_id UUID;
-- Set from parent conversation
UPDATE conversation_messages cm
SET organization_id = c.organization_id
FROM conversations c
WHERE cm.conversation_id = c.id AND cm.organization_id IS NULL;
ALTER TABLE conversation_messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE conversation_messages ADD CONSTRAINT fk_conversation_messages_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_conversation_messages_org_id ON conversation_messages(organization_id);

-- Function Calls
ALTER TABLE function_calls ADD COLUMN IF NOT EXISTS organization_id UUID;
-- Set from parent conversation
UPDATE function_calls fc
SET organization_id = c.organization_id
FROM conversations c
WHERE fc.conversation_id = c.id AND fc.organization_id IS NULL;
ALTER TABLE function_calls ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE function_calls ADD CONSTRAINT fk_function_calls_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_function_calls_org_id ON function_calls(organization_id);

-- ============================================================================
-- TREATMENT SYSTEM TABLES (if they exist)
-- ============================================================================

-- Treatment Plans
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'treatment_plans') THEN
    ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS organization_id UUID;
    UPDATE treatment_plans SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
    ALTER TABLE treatment_plans ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE treatment_plans ADD CONSTRAINT fk_treatment_plans_organization 
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_treatment_plans_org_id ON treatment_plans(organization_id);
    RAISE NOTICE 'Added organization_id to treatment_plans';
  END IF;
END $$;

-- Treatment Plan Items
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'treatment_plan_items') THEN
    ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS organization_id UUID;
    -- Set from parent treatment_plan
    UPDATE treatment_plan_items tpi
    SET organization_id = tp.organization_id
    FROM treatment_plans tp
    WHERE tpi.treatment_plan_id = tp.id AND tpi.organization_id IS NULL;
    ALTER TABLE treatment_plan_items ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE treatment_plan_items ADD CONSTRAINT fk_treatment_plan_items_organization 
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_org_id ON treatment_plan_items(organization_id);
    RAISE NOTICE 'Added organization_id to treatment_plan_items';
  END IF;
END $$;

-- Treatments Catalog
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'treatments_catalog') THEN
    ALTER TABLE treatments_catalog ADD COLUMN IF NOT EXISTS organization_id UUID;
    UPDATE treatments_catalog SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
    ALTER TABLE treatments_catalog ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE treatments_catalog ADD CONSTRAINT fk_treatments_catalog_organization 
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_treatments_catalog_org_id ON treatments_catalog(organization_id);
    RAISE NOTICE 'Added organization_id to treatments_catalog';
  END IF;
END $$;

-- ============================================================================
-- AGENT CONFIGURATION TABLES (if they exist)
-- ============================================================================

-- Agent Configurations
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_configurations') THEN
    ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS organization_id UUID;
    UPDATE agent_configurations SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
    ALTER TABLE agent_configurations ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE agent_configurations ADD CONSTRAINT fk_agent_configurations_organization 
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_agent_configurations_org_id ON agent_configurations(organization_id);
    RAISE NOTICE 'Added organization_id to agent_configurations';
  END IF;
END $$;

-- Workflows
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workflows') THEN
    ALTER TABLE workflows ADD COLUMN IF NOT EXISTS organization_id UUID;
    UPDATE workflows SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID WHERE organization_id IS NULL;
    ALTER TABLE workflows ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE workflows ADD CONSTRAINT fk_workflows_organization 
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_workflows_org_id ON workflows(organization_id);
    RAISE NOTICE 'Added organization_id to workflows';
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES FOR DATA ISOLATION
-- ============================================================================

-- Providers
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS providers_isolation_policy ON providers;
CREATE POLICY providers_isolation_policy ON providers
  FOR ALL
  USING (organization_id = get_current_organization_id());

-- Operatories
ALTER TABLE operatories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operatories_isolation_policy ON operatories;
CREATE POLICY operatories_isolation_policy ON operatories
  FOR ALL
  USING (organization_id = get_current_organization_id());

-- Provider Schedules
ALTER TABLE provider_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_schedules_isolation_policy ON provider_schedules;
CREATE POLICY provider_schedules_isolation_policy ON provider_schedules
  FOR ALL
  USING (organization_id = get_current_organization_id());

-- Patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_isolation_policy ON patients;
CREATE POLICY patients_isolation_policy ON patients
  FOR ALL
  USING (organization_id = get_current_organization_id());

-- Appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_isolation_policy ON appointments;
CREATE POLICY appointments_isolation_policy ON appointments
  FOR ALL
  USING (organization_id = get_current_organization_id());

-- Conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_isolation_policy ON conversations;
CREATE POLICY conversations_isolation_policy ON conversations
  FOR ALL
  USING (organization_id = get_current_organization_id());

-- Conversation Messages
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_messages_isolation_policy ON conversation_messages;
CREATE POLICY conversation_messages_isolation_policy ON conversation_messages
  FOR ALL
  USING (organization_id = get_current_organization_id());

-- Function Calls
ALTER TABLE function_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS function_calls_isolation_policy ON function_calls;
CREATE POLICY function_calls_isolation_policy ON function_calls
  FOR ALL
  USING (organization_id = get_current_organization_id());

-- Treatment Plans (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'treatment_plans') THEN
    ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS treatment_plans_isolation_policy ON treatment_plans;
    CREATE POLICY treatment_plans_isolation_policy ON treatment_plans
      FOR ALL
      USING (organization_id = get_current_organization_id());
  END IF;
END $$;

-- Treatment Plan Items (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'treatment_plan_items') THEN
    ALTER TABLE treatment_plan_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS treatment_plan_items_isolation_policy ON treatment_plan_items;
    CREATE POLICY treatment_plan_items_isolation_policy ON treatment_plan_items
      FOR ALL
      USING (organization_id = get_current_organization_id());
  END IF;
END $$;

-- Treatments Catalog (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'treatments_catalog') THEN
    ALTER TABLE treatments_catalog ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS treatments_catalog_isolation_policy ON treatments_catalog;
    CREATE POLICY treatments_catalog_isolation_policy ON treatments_catalog
      FOR ALL
      USING (organization_id = get_current_organization_id());
  END IF;
END $$;

-- Agent Configurations (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_configurations') THEN
    ALTER TABLE agent_configurations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS agent_configurations_isolation_policy ON agent_configurations;
    CREATE POLICY agent_configurations_isolation_policy ON agent_configurations
      FOR ALL
      USING (organization_id = get_current_organization_id());
  END IF;
END $$;

-- Workflows (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workflows') THEN
    ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS workflows_isolation_policy ON workflows;
    CREATE POLICY workflows_isolation_policy ON workflows
      FOR ALL
      USING (organization_id = get_current_organization_id());
  END IF;
END $$;

-- ============================================================================
-- SERVICE ROLE BYPASS POLICIES
-- ============================================================================
-- Service role can bypass RLS for admin operations

DO $$ 
DECLARE
  tables_to_update TEXT[] := ARRAY[
    'providers', 'operatories', 'provider_schedules', 'patients', 'appointments',
    'conversations', 'conversation_messages', 'function_calls'
  ];
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY tables_to_update
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I_service_role_policy ON %I;
      CREATE POLICY %I_service_role_policy ON %I
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    ', table_name, table_name, table_name, table_name);
  END LOOP;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN providers.organization_id IS 'Multi-tenant isolation - links provider to organization';
COMMENT ON COLUMN patients.organization_id IS 'Multi-tenant isolation - links patient to organization';
COMMENT ON COLUMN appointments.organization_id IS 'Multi-tenant isolation - links appointment to organization';
COMMENT ON COLUMN conversations.organization_id IS 'Multi-tenant isolation - links conversation to organization';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 001 complete - organization_id added to all tables';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated tables:';
  RAISE NOTICE '  - providers, operatories, provider_schedules';
  RAISE NOTICE '  - patients, appointments';
  RAISE NOTICE '  - conversations, conversation_messages, function_calls';
  RAISE NOTICE '  - treatment_plans, treatment_plan_items, treatments_catalog (if exist)';
  RAISE NOTICE '  - agent_configurations, workflows (if exist)';
  RAISE NOTICE '';
  RAISE NOTICE 'All existing data migrated to default organization';
  RAISE NOTICE 'RLS policies enabled for data isolation';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Update WhatsApp migration (042) to work with organizations';
  RAISE NOTICE '';
END $$;
