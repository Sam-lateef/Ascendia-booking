-- Seed OpenDental configuration (SAFE - only adds if not exists)
-- This version uses ON CONFLICT to avoid duplicates

-- ============================================================================
-- COMPANY INFO (OpenDental Dental Office) - Add only new keys
-- ============================================================================

INSERT INTO company_info (key, value, category, description)
VALUES 
  -- OpenDental-specific settings (won't conflict with embedded booking)
  ('opendental_api_base_url', 'https://api.opendental.com', 'api', 'OpenDental API base URL'),
  ('opendental_default_provider_num', '1', 'api', 'Default ProvNum for appointments'),
  ('opendental_default_operatory_num', '1', 'api', 'Default OpNum for appointments'),
  ('opendental_company_name', 'Barton Dental', 'identity', 'OpenDental office name'),
  ('opendental_greeting', 'Hi! This is Lexi from Barton Dental. How can I help you today?', 'personality', 'OpenDental greeting')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- AGENT INSTRUCTIONS (OpenDental-Specific)
-- ============================================================================

INSERT INTO agent_instructions (section, content, priority, enabled)
VALUES

-- OpenDental Identity (priority 100+ to not conflict with embedded booking)
('opendental_identity', 
'You are Lexi, the AI receptionist for Barton Dental. You are warm, professional, and concise. Your job is to help patients book, reschedule, or cancel dental appointments.', 
100, true),

-- OpenDental Specifics
('opendental_specifics',
'OPENDENTAL TECHNICAL DETAILS:
- Pattern format: "/XX/" for 20 min, "//XXXX//" for 30 min, "///XXXXXX///" for 40 min
- Use "Op" parameter (not "OpNum") in CreateAppointment
- NEVER send ClinicNum parameter (causes errors)
- AptStatus values: Scheduled, Complete, UnschedList, ASAP, Broken, Planned
- Default ProvNum: 1 (Dr. Pearl)
- Default OpNum: 1 (Main operatory)',
101, true),

-- OpenDental Date Formats
('opendental_datetime_formats',
'DATE AND TIME FORMATS FOR OPENDENTAL:
- API dates: YYYY-MM-DD (e.g., "2025-12-08")
- API datetime: YYYY-MM-DD HH:mm:ss (e.g., "2025-12-08 10:00:00")
- Birthdate conversion:
  * "August 12, 1988" → "1988-08-12"
  * "12/15/1990" → "1990-12-15"
  * NEVER use "0000-00-00"
- Avoid Feb 29 in non-leap years (2025, 2026, 2027 are NOT leap years)',
102, true)

ON CONFLICT (section) DO UPDATE SET
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- ============================================================================
-- AGENT TOOLS (OpenDental-Specific Functions Only)
-- These use the /api/opendental endpoint which is different from /api/booking
-- ============================================================================

-- Note: GetMultiplePatients, CreatePatient, GetAppointments, CreateAppointment
-- already exist from embedded booking seed. We only add OpenDental-specific ones:

INSERT INTO agent_tools (name, description, parameters_schema, endpoint, http_method, enabled)
VALUES

-- OpenDental-specific appointment functions
('GetAvailableSlots',
'Find available appointment time slots for a date range. ALL 4 parameters are required! OpenDental-specific.',
'{
  "type": "object",
  "properties": {
    "dateStart": {
      "type": "string",
      "description": "Start date in YYYY-MM-DD format"
    },
    "dateEnd": {
      "type": "string",
      "description": "End date in YYYY-MM-DD format (can be same as dateStart)"
    },
    "ProvNum": {
      "type": "number",
      "description": "Provider number (default: 1 for Dr. Pearl)"
    },
    "OpNum": {
      "type": "number",
      "description": "Operatory number (default: 1)"
    }
  },
  "required": ["dateStart", "dateEnd", "ProvNum", "OpNum"]
}',
'/api/opendental',
'POST',
true),

('UpdateAppointment',
'Reschedule an existing appointment to a new date/time. OpenDental-specific.',
'{
  "type": "object",
  "properties": {
    "AptNum": {
      "type": "number",
      "description": "Appointment number (from GetAppointments)"
    },
    "AptDateTime": {
      "type": "string",
      "description": "New appointment date and time in YYYY-MM-DD HH:mm:ss format"
    },
    "ProvNum": {
      "type": "number",
      "description": "Provider number (default 1)"
    },
    "Op": {
      "type": "number",
      "description": "Operatory number (default 1)"
    }
  },
  "required": ["AptNum", "AptDateTime", "ProvNum", "Op"]
}',
'/api/opendental',
'POST',
true),

('BreakAppointment',
'Cancel/break an existing appointment. OpenDental-specific.',
'{
  "type": "object",
  "properties": {
    "AptNum": {
      "type": "number",
      "description": "Appointment number to cancel"
    },
    "sendToUnscheduledList": {
      "type": "boolean",
      "description": "Whether to add to unscheduled list (usually false)"
    }
  },
  "required": ["AptNum"]
}',
'/api/opendental',
'POST',
true),

-- OpenDental office data functions
('GetProviders',
'Get list of all providers (dentists). OpenDental-specific.',
'{
  "type": "object",
  "properties": {}
}',
'/api/opendental',
'POST',
true),

('GetOperatories',
'Get list of all operatories (treatment rooms). OpenDental-specific.',
'{
  "type": "object",
  "properties": {}
}',
'/api/opendental',
'POST',
true),

-- OpenDental utility functions
('get_office_context',
'Fetch current office context (providers, operatories, occupied slots). Call this ONCE at start of conversation. OpenDental-specific.',
'{
  "type": "object",
  "properties": {}
}',
'/api/opendental',
'POST',
true)

ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parameters_schema = EXCLUDED.parameters_schema,
  endpoint = EXCLUDED.endpoint,
  http_method = EXCLUDED.http_method,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- ============================================================================
-- UPDATE SHARED TOOLS FOR OPENDENTAL
-- Update existing tools to also work with OpenDental endpoint
-- ============================================================================

-- Update GetPatient to support OpenDental
INSERT INTO agent_tools (name, description, parameters_schema, endpoint, http_method, enabled)
VALUES
('GetPatient',
'Get details of a specific patient by PatNum.',
'{
  "type": "object",
  "properties": {
    "PatNum": {
      "type": "number",
      "description": "Patient number"
    }
  },
  "required": ["PatNum"]
}',
'/api/opendental',
'POST',
true)
ON CONFLICT (name) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ OpenDental configuration seeded successfully!';
  RAISE NOTICE '   - Added OpenDental-specific company settings';
  RAISE NOTICE '   - Added 3 OpenDental instruction sections';
  RAISE NOTICE '   - Added 6 OpenDental-specific tools';
  RAISE NOTICE '   - Shared tools (GetMultiplePatients, CreatePatient, etc.) already exist from embedded booking';
END $$;



























