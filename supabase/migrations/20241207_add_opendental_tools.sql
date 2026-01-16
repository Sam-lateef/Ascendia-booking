-- ============================================
-- Add OpenDental-Specific Tools
-- Adds tools that work with OpenDental API
-- Company info already exists from embedded booking seed
-- ============================================

-- Note: Both embedded booking and OpenDental are for "Barton Dental"
-- They share the same company_info row, just use different API endpoints

-- ============================================
-- OPENDENTAL-SPECIFIC TOOLS
-- ============================================

-- These tools call /api/opendental (OpenDental API)
-- while embedded booking tools call /api/booking (Supabase)

INSERT INTO agent_tools (name, description, category, parameters, returns_description, api_route, is_virtual, is_active, display_order) VALUES

-- Available Slots (OpenDental-specific endpoint)
(
  'GetAvailableSlots',
  'Find available appointment time slots (OpenDental). Requires dateStart, dateEnd, ProvNum, OpNum.',
  'appointments',
  '{
    "dateStart": {
      "type": "string",
      "required": true,
      "description": "Start date in YYYY-MM-DD format"
    },
    "dateEnd": {
      "type": "string",
      "required": true,
      "description": "End date in YYYY-MM-DD format"
    },
    "ProvNum": {
      "type": "number",
      "required": true,
      "description": "Provider number (default: 1)"
    },
    "OpNum": {
      "type": "number",
      "required": true,
      "description": "Operatory number (default: 1)"
    }
  }'::jsonb,
  'List of available time slots with provider and operatory details',
  '/api/opendental',
  FALSE,
  TRUE,
  100
),

-- Update Appointment (OpenDental-specific)
(
  'UpdateAppointment',
  'Reschedule an existing appointment to a new date/time (OpenDental)',
  'appointments',
  '{
    "AptNum": {
      "type": "number",
      "required": true,
      "description": "Appointment number to update"
    },
    "AptDateTime": {
      "type": "string",
      "required": true,
      "description": "New appointment date and time in YYYY-MM-DD HH:mm:ss format"
    },
    "ProvNum": {
      "type": "number",
      "required": true,
      "description": "Provider number"
    },
    "Op": {
      "type": "number",
      "required": true,
      "description": "Operatory number"
    }
  }'::jsonb,
  'Updated appointment details',
  '/api/opendental',
  FALSE,
  TRUE,
  101
),

-- Break Appointment (Cancel - OpenDental-specific)
(
  'BreakAppointment',
  'Cancel/break an appointment (OpenDental)',
  'appointments',
  '{
    "AptNum": {
      "type": "number",
      "required": true,
      "description": "Appointment number to cancel"
    },
    "sendToUnscheduledList": {
      "type": "boolean",
      "required": false,
      "nullable": true,
      "description": "Send to unscheduled list (default: false)"
    }
  }'::jsonb,
  'Cancellation confirmation',
  '/api/opendental',
  FALSE,
  TRUE,
  102
),

-- Get Providers (OpenDental)
(
  'GetProviders',
  'Get list of all dental providers (OpenDental)',
  'context',
  '{}'::jsonb,
  'List of providers with their details',
  '/api/opendental',
  FALSE,
  TRUE,
  103
),

-- Get Operatories (OpenDental)
(
  'GetOperatories',
  'Get list of all operatories/treatment rooms (OpenDental)',
  'context',
  '{}'::jsonb,
  'List of operatories with their details',
  '/api/opendental',
  FALSE,
  TRUE,
  104
),

-- Get Office Context (OpenDental)
(
  'get_office_context',
  'Fetch current office context: providers, operatories, occupied slots (OpenDental). Call ONCE at start.',
  'context',
  '{}'::jsonb,
  'Complete office context with providers, operatories, and current schedule',
  '/api/opendental',
  FALSE,
  TRUE,
  105
),

-- Get Date/Time
(
  'get_datetime',
  'Get current date and time in ISO format',
  'context',
  '{}'::jsonb,
  'Current date and time',
  '/api/opendental',
  FALSE,
  TRUE,
  106
)

ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  parameters = EXCLUDED.parameters,
  returns_description = EXCLUDED.returns_description,
  api_route = EXCLUDED.api_route,
  is_virtual = EXCLUDED.is_virtual,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ OpenDental tools added successfully!';
  RAISE NOTICE '   Added 7 OpenDental-specific tools';
  RAISE NOTICE '   All tools route to /api/opendental';
  RAISE NOTICE '   Company info (Barton Dental) already exists - shared between both systems';
  RAISE NOTICE '   Embedded booking tools route to /api/booking';
  RAISE NOTICE '   OpenDental tools route to /api/opendental';
END $$;



























