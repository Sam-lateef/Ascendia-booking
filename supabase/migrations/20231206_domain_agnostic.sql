-- ============================================
-- Domain-Agnostic Core Engine Schema
-- 
-- This migration makes the workflow engine completely domain-agnostic.
-- All configuration comes from these tables - no hardcoded logic.
-- ============================================

-- ============================================
-- Table 1: DOMAINS
-- Configuration for each domain (booking, crm, inventory, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Identification
  name TEXT UNIQUE NOT NULL,              -- 'dental_booking', 'crm', 'inventory'
  display_name TEXT NOT NULL,             -- 'Dental Booking System'
  
  -- Persona configuration
  persona_name TEXT,                      -- 'Lexi', 'Alex', etc.
  persona_role TEXT,                      -- 'receptionist', 'sales assistant'
  company_name TEXT,                      -- 'Barton Dental', 'Acme Corp'
  
  -- System prompt template (use {persona_name}, {company_name}, {capabilities}, etc.)
  system_prompt_template TEXT NOT NULL,
  
  -- Business rules (used by workflow creator)
  business_rules TEXT,
  
  -- Available capabilities (shown to user)
  capabilities TEXT[] NOT NULL,           -- ['Book appointments', 'Reschedule', 'Cancel']
  
  -- API endpoint for this domain's functions
  api_endpoint TEXT NOT NULL,             -- '/api/booking', '/api/crm'
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_domains_name ON domains(name);
CREATE INDEX IF NOT EXISTS idx_domains_active ON domains(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS domains_updated_at ON domains;
CREATE TRIGGER domains_updated_at
  BEFORE UPDATE ON domains
  FOR EACH ROW
  EXECUTE FUNCTION update_domains_updated_at();

-- ============================================
-- Table 2: FUNCTION REGISTRY
-- All available functions per domain
-- ============================================
CREATE TABLE IF NOT EXISTS function_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Domain association
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  
  -- Function identification
  name TEXT NOT NULL,                     -- 'GetPatient', 'CreateLead'
  description TEXT NOT NULL,              -- 'Get a patient by ID'
  
  -- Parameter schema (JSON Schema format for Zod generation)
  parameters JSONB NOT NULL,              -- { "PatNum": { "type": "number", "required": true } }
  
  -- Return type description
  returns TEXT,                           -- 'Patient object', 'Array of leads'
  
  -- Categorization
  category TEXT,                          -- 'patients', 'appointments', 'contacts'
  
  -- Execution
  is_virtual BOOLEAN DEFAULT FALSE,       -- Virtual functions handled by engine
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Unique per domain
  UNIQUE(domain_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_function_registry_domain ON function_registry(domain_id);
CREATE INDEX IF NOT EXISTS idx_function_registry_name ON function_registry(name);
CREATE INDEX IF NOT EXISTS idx_function_registry_category ON function_registry(category);
CREATE INDEX IF NOT EXISTS idx_function_registry_active ON function_registry(is_active);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS function_registry_updated_at ON function_registry;
CREATE TRIGGER function_registry_updated_at
  BEFORE UPDATE ON function_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_domains_updated_at();

-- ============================================
-- Table 3: ENTITY DEFINITIONS
-- What entities can be extracted per domain
-- ============================================
CREATE TABLE IF NOT EXISTS entity_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Domain association
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  
  -- Entity identification
  name TEXT NOT NULL,                     -- 'phone', 'preferredDate', 'product_sku'
  display_name TEXT NOT NULL,             -- 'Phone Number', 'Preferred Date'
  
  -- Type and validation
  data_type TEXT NOT NULL,                -- 'string', 'number', 'date', 'boolean'
  validation_type TEXT,                   -- 'phone', 'futureDate', 'email', null for no special validation
  
  -- LLM extraction hint
  extraction_hint TEXT,                   -- 'Extract 10-digit phone number'
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Unique per domain
  UNIQUE(domain_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entity_definitions_domain ON entity_definitions(domain_id);
CREATE INDEX IF NOT EXISTS idx_entity_definitions_name ON entity_definitions(name);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS entity_definitions_updated_at ON entity_definitions;
CREATE TRIGGER entity_definitions_updated_at
  BEFORE UPDATE ON entity_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_domains_updated_at();

-- ============================================
-- Modify existing tables: Add domain_id
-- ============================================

-- Add domain_id to intent_triggers
ALTER TABLE intent_triggers 
  ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES domains(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_intent_triggers_domain ON intent_triggers(domain_id);

-- Add domain_id to dynamic_workflows
ALTER TABLE dynamic_workflows 
  ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES domains(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_dynamic_workflows_domain ON dynamic_workflows(domain_id);

-- Add domain_id to workflow_patterns (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_patterns') THEN
    ALTER TABLE workflow_patterns 
      ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES domains(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- SEED DATA: Dental Booking Domain
-- ============================================

-- Insert dental booking domain
INSERT INTO domains (
  name, 
  display_name, 
  persona_name, 
  persona_role, 
  company_name,
  system_prompt_template,
  business_rules,
  capabilities,
  api_endpoint
) VALUES (
  'dental_booking',
  'Dental Booking System',
  'Lexi',
  'receptionist',
  'Barton Dental',
  'You are {persona_name}, a friendly {persona_role} at {company_name}. Today is {today}.

CAPABILITIES:
{capabilities_list}

WORKFLOW GUIDELINES:
1. Always identify the patient first (by phone number is most reliable)
2. Confirm phone number before lookup
3. For new patients, collect: first name, last name, birthdate, phone
4. For appointments, collect: preferred date and time
5. Always confirm before making changes

CONVERSATION STYLE:
- Be warm, professional, and helpful
- Keep responses concise but friendly
- Ask one question at a time
- Confirm important details before proceeding

FORMATS:
- Phone: 10 digits (e.g., 6195551234)
- Date: YYYY-MM-DD
- DateTime: YYYY-MM-DD HH:mm:ss

When you have enough information, use the appropriate function.
When you need more information, ask the user politely.',
  '1. PATIENT IDENTIFICATION
   - Always identify patient before any appointment action
   - Prefer phone number lookup (more reliable)
   - If patient not found by phone, can create new patient

2. APPOINTMENT BOOKING
   - Need: PatNum, preferred date, preferred time
   - Search available slots, present options
   - User confirms selection
   - Then create appointment

3. APPOINTMENT RESCHEDULING
   - Need: PatNum, identify which appointment, new date/time
   - Get patient''s existing appointments
   - User selects which to reschedule
   - Get available slots for new date
   - User confirms new time
   - Update appointment

4. APPOINTMENT CANCELLATION
   - Need: PatNum, identify which appointment
   - Get patient''s existing appointments
   - User selects which to cancel
   - User confirms cancellation
   - Break (cancel) appointment

5. CHECK APPOINTMENTS
   - Need: PatNum
   - Get patient''s appointments
   - Present list to user

6. CONFIRMATIONS
   - Always confirm phone number before lookup
   - Always confirm before creating new patient
   - Always confirm before booking/rescheduling/canceling',
  ARRAY['Book new appointments', 'Reschedule existing appointments', 'Cancel appointments', 'Check upcoming appointments', 'Look up patient information'],
  '/api/booking'
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  system_prompt_template = EXCLUDED.system_prompt_template,
  business_rules = EXCLUDED.business_rules,
  capabilities = EXCLUDED.capabilities,
  updated_at = NOW();

-- Get the domain ID for seeding
DO $$
DECLARE
  v_domain_id UUID;
BEGIN
  SELECT id INTO v_domain_id FROM domains WHERE name = 'dental_booking';
  
  -- ============================================
  -- Seed Function Registry for Dental Booking
  -- ============================================
  
  -- Patient functions
  INSERT INTO function_registry (domain_id, name, description, parameters, returns, category)
  VALUES 
    (v_domain_id, 'GetMultiplePatients', 'Search for patients by name or phone number', 
     '{"Phone": {"type": "string", "description": "10-digit phone number"}, "FName": {"type": "string", "description": "First name"}, "LName": {"type": "string", "description": "Last name"}, "PatNum": {"type": "number", "description": "Patient ID"}}'::jsonb,
     'Array of patient objects', 'patients'),
    
    (v_domain_id, 'GetPatient', 'Get a single patient by ID',
     '{"PatNum": {"type": "number", "required": true, "description": "Patient ID"}}'::jsonb,
     'Patient object', 'patients'),
    
    (v_domain_id, 'CreatePatient', 'Create a new patient record',
     '{"FName": {"type": "string", "required": true, "description": "First name"}, "LName": {"type": "string", "required": true, "description": "Last name"}, "Birthdate": {"type": "string", "required": true, "description": "Date of birth (YYYY-MM-DD)"}, "WirelessPhone": {"type": "string", "required": true, "description": "10-digit phone"}, "Email": {"type": "string", "description": "Email address"}}'::jsonb,
     'Created patient with PatNum', 'patients')
  ON CONFLICT (domain_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    parameters = EXCLUDED.parameters;
  
  -- Appointment functions
  INSERT INTO function_registry (domain_id, name, description, parameters, returns, category)
  VALUES 
    (v_domain_id, 'GetAppointments', 'Get appointments for a patient within a date range',
     '{"PatNum": {"type": "number", "description": "Patient ID"}, "DateStart": {"type": "string", "required": true, "description": "Start date (YYYY-MM-DD)"}, "DateEnd": {"type": "string", "required": true, "description": "End date (YYYY-MM-DD)"}}'::jsonb,
     'Array of appointments', 'appointments'),
    
    (v_domain_id, 'GetAvailableSlots', 'Find available appointment slots',
     '{"dateStart": {"type": "string", "required": true, "description": "Start date (YYYY-MM-DD)"}, "dateEnd": {"type": "string", "required": true, "description": "End date (YYYY-MM-DD)"}, "ProvNum": {"type": "number", "description": "Provider ID"}, "OpNum": {"type": "number", "description": "Operatory ID"}, "lengthMinutes": {"type": "number", "description": "Appointment length"}}'::jsonb,
     'Array of available time slots', 'appointments'),
    
    (v_domain_id, 'CreateAppointment', 'Book a new appointment',
     '{"PatNum": {"type": "number", "required": true, "description": "Patient ID"}, "AptDateTime": {"type": "string", "required": true, "description": "Date/time (YYYY-MM-DD HH:mm:ss)"}, "ProvNum": {"type": "number", "required": true, "description": "Provider ID"}, "Op": {"type": "number", "required": true, "description": "Operatory ID"}, "Note": {"type": "string", "description": "Appointment note"}}'::jsonb,
     'Created appointment with AptNum', 'appointments'),
    
    (v_domain_id, 'UpdateAppointment', 'Reschedule or update an existing appointment',
     '{"AptNum": {"type": "number", "required": true, "description": "Appointment ID"}, "AptDateTime": {"type": "string", "description": "New date/time"}, "ProvNum": {"type": "number", "description": "New provider ID"}, "Op": {"type": "number", "description": "New operatory ID"}, "Note": {"type": "string", "description": "Updated note"}}'::jsonb,
     'Updated appointment', 'appointments'),
    
    (v_domain_id, 'BreakAppointment', 'Cancel an appointment',
     '{"AptNum": {"type": "number", "required": true, "description": "Appointment ID to cancel"}}'::jsonb,
     'Cancellation result', 'appointments')
  ON CONFLICT (domain_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    parameters = EXCLUDED.parameters;
  
  -- Provider/Operatory functions
  INSERT INTO function_registry (domain_id, name, description, parameters, returns, category)
  VALUES 
    (v_domain_id, 'GetProviders', 'Get all available providers',
     '{}'::jsonb,
     'Array of providers', 'providers'),
    
    (v_domain_id, 'GetOperatories', 'Get all available operatories (rooms)',
     '{}'::jsonb,
     'Array of operatories', 'operatories')
  ON CONFLICT (domain_id, name) DO UPDATE SET
    description = EXCLUDED.description;
  
  -- Virtual functions (handled by engine)
  INSERT INTO function_registry (domain_id, name, description, parameters, returns, category, is_virtual)
  VALUES 
    (v_domain_id, 'ConfirmWithUser', 'Pause and ask user for confirmation',
     '{"prompt": {"type": "string", "required": true}, "field": {"type": "string", "required": true}}'::jsonb,
     'Boolean confirmation', 'virtual', true),
    
    (v_domain_id, 'AskUser', 'Pause and ask user for input',
     '{"prompt": {"type": "string", "required": true}, "field": {"type": "string", "required": true}}'::jsonb,
     'User input value', 'virtual', true),
    
    (v_domain_id, 'ExtractEntityId', 'Extract ID from a data source',
     '{"from": {"type": "string", "required": true}, "idField": {"type": "string", "required": true}}'::jsonb,
     'Extracted ID', 'virtual', true),
    
    (v_domain_id, 'PresentOptions', 'Present options to user for selection',
     '{"data": {"type": "string", "required": true}, "field": {"type": "string", "required": true}}'::jsonb,
     'Selected option', 'virtual', true)
  ON CONFLICT (domain_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    is_virtual = EXCLUDED.is_virtual;
  
  -- ============================================
  -- Seed Entity Definitions for Dental Booking
  -- ============================================
  INSERT INTO entity_definitions (domain_id, name, display_name, data_type, validation_type, extraction_hint)
  VALUES 
    (v_domain_id, 'phone', 'Phone Number', 'string', 'phone', 'Extract 10-digit phone number, remove formatting'),
    (v_domain_id, 'firstName', 'First Name', 'string', 'name', 'Extract first/given name'),
    (v_domain_id, 'lastName', 'Last Name', 'string', 'name', 'Extract last/family name'),
    (v_domain_id, 'birthdate', 'Date of Birth', 'string', 'pastDate', 'Extract date of birth in YYYY-MM-DD format'),
    (v_domain_id, 'preferredDate', 'Preferred Date', 'string', 'futureDate', 'Extract preferred appointment date in YYYY-MM-DD'),
    (v_domain_id, 'preferredTime', 'Preferred Time', 'string', 'time', 'Extract preferred time (morning, afternoon, or HH:mm)'),
    (v_domain_id, 'appointmentType', 'Appointment Type', 'string', NULL, 'Extract type: cleaning, checkup, filling, etc.'),
    (v_domain_id, 'selectedSlotIndex', 'Selected Slot', 'number', NULL, 'Zero-based index of selected time slot'),
    (v_domain_id, 'appointmentToActOn', 'Appointment Selection', 'number', NULL, 'Zero-based index of appointment to reschedule/cancel'),
    (v_domain_id, 'confirmation', 'Confirmation', 'boolean', NULL, 'Yes/no confirmation from user')
  ON CONFLICT (domain_id, name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    extraction_hint = EXCLUDED.extraction_hint;
  
  -- ============================================
  -- Seed Intent Triggers for Dental Booking
  -- ============================================
  INSERT INTO intent_triggers (domain_id, phrase, intent, source, is_active, times_matched)
  VALUES 
    -- Book intent
    (v_domain_id, 'book', 'book', 'seeded', true, 0),
    (v_domain_id, 'schedule', 'book', 'seeded', true, 0),
    (v_domain_id, 'new appointment', 'book', 'seeded', true, 0),
    (v_domain_id, 'make an appointment', 'book', 'seeded', true, 0),
    (v_domain_id, 'set up an appointment', 'book', 'seeded', true, 0),
    (v_domain_id, 'i need an appointment', 'book', 'seeded', true, 0),
    (v_domain_id, 'i want to book', 'book', 'seeded', true, 0),
    (v_domain_id, 'i want to schedule', 'book', 'seeded', true, 0),
    (v_domain_id, 'i''d like to book', 'book', 'seeded', true, 0),
    (v_domain_id, 'can i book', 'book', 'seeded', true, 0),
    (v_domain_id, 'need to come in', 'book', 'seeded', true, 0),
    -- Reschedule intent  
    (v_domain_id, 'reschedule', 'reschedule', 'seeded', true, 0),
    (v_domain_id, 'change my appointment', 'reschedule', 'seeded', true, 0),
    (v_domain_id, 'move my appointment', 'reschedule', 'seeded', true, 0),
    (v_domain_id, 'change the time', 'reschedule', 'seeded', true, 0),
    (v_domain_id, 'change the date', 'reschedule', 'seeded', true, 0),
    (v_domain_id, 'different time', 'reschedule', 'seeded', true, 0),
    (v_domain_id, 'different day', 'reschedule', 'seeded', true, 0),
    (v_domain_id, 'need to move', 'reschedule', 'seeded', true, 0),
    -- Cancel intent
    (v_domain_id, 'cancel', 'cancel', 'seeded', true, 0),
    (v_domain_id, 'cancel my appointment', 'cancel', 'seeded', true, 0),
    (v_domain_id, 'cancel the appointment', 'cancel', 'seeded', true, 0),
    (v_domain_id, 'i can''t make it', 'cancel', 'seeded', true, 0),
    (v_domain_id, 'won''t be able to come', 'cancel', 'seeded', true, 0),
    (v_domain_id, 'need to cancel', 'cancel', 'seeded', true, 0),
    (v_domain_id, 'want to cancel', 'cancel', 'seeded', true, 0),
    -- Check intent
    (v_domain_id, 'check my appointment', 'check', 'seeded', true, 0),
    (v_domain_id, 'check on my appointment', 'check', 'seeded', true, 0),
    (v_domain_id, 'when is my appointment', 'check', 'seeded', true, 0),
    (v_domain_id, 'my appointments', 'check', 'seeded', true, 0),
    (v_domain_id, 'do i have an appointment', 'check', 'seeded', true, 0),
    (v_domain_id, 'upcoming appointment', 'check', 'seeded', true, 0)
  ON CONFLICT DO NOTHING;
  
  -- ============================================
  -- Update existing intent_triggers with domain_id
  -- ============================================
  UPDATE intent_triggers 
  SET domain_id = v_domain_id 
  WHERE domain_id IS NULL;
  
  -- ============================================
  -- Update existing dynamic_workflows with domain_id
  -- ============================================
  UPDATE dynamic_workflows 
  SET domain_id = v_domain_id 
  WHERE domain_id IS NULL;

END $$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to increment trigger usage
CREATE OR REPLACE FUNCTION increment_trigger_usage(trigger_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE intent_triggers 
  SET 
    times_matched = times_matched + 1,
    last_matched_at = NOW()
  WHERE id = trigger_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment workflow usage
CREATE OR REPLACE FUNCTION increment_workflow_usage(workflow_id UUID, was_successful BOOLEAN)
RETURNS void AS $$
BEGIN
  UPDATE dynamic_workflows 
  SET 
    usage_count = usage_count + 1,
    success_count = success_count + CASE WHEN was_successful THEN 1 ELSE 0 END,
    last_used_at = NOW()
  WHERE id = workflow_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Views for easier querying
-- ============================================

-- View: Domain with function count
CREATE OR REPLACE VIEW domain_summary AS
SELECT 
  d.id,
  d.name,
  d.display_name,
  d.persona_name,
  d.is_active,
  COUNT(DISTINCT f.id) as function_count,
  COUNT(DISTINCT e.id) as entity_count,
  COUNT(DISTINCT it.id) as trigger_count,
  COUNT(DISTINCT dw.id) as workflow_count
FROM domains d
LEFT JOIN function_registry f ON f.domain_id = d.id AND f.is_active = TRUE
LEFT JOIN entity_definitions e ON e.domain_id = d.id AND e.is_active = TRUE
LEFT JOIN intent_triggers it ON it.domain_id = d.id AND it.is_active = TRUE
LEFT JOIN dynamic_workflows dw ON dw.domain_id = d.id AND dw.is_active = TRUE
GROUP BY d.id, d.name, d.display_name, d.persona_name, d.is_active;

-- View: Functions by domain
CREATE OR REPLACE VIEW domain_functions AS
SELECT 
  d.name as domain_name,
  f.name as function_name,
  f.description,
  f.category,
  f.is_virtual,
  f.parameters
FROM domains d
JOIN function_registry f ON f.domain_id = d.id
WHERE d.is_active = TRUE AND f.is_active = TRUE
ORDER BY d.name, f.category, f.name;

