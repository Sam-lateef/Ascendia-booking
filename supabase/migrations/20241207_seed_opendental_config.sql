-- Seed OpenDental configuration for domain-agnostic agent
-- This allows the unified Lexi agent to work with OpenDental API

-- ============================================================================
-- COMPANY INFO (OpenDental Dental Office)
-- ============================================================================

INSERT INTO company_info (key, value, category, description)
VALUES 
  -- Identity
  ('company_name', 'Barton Dental', 'identity', 'Dental office name'),
  ('agent_name', 'Lexi', 'identity', 'AI agent persona name'),
  ('agent_voice', 'sage', 'identity', 'Voice selection for agent'),
  
  -- Business Context
  ('business_type', 'dental_office', 'business', 'Type of business (dental office)'),
  ('services_offered', 'General dentistry, cleanings, exams, fillings, crowns, root canals, extractions', 'business', 'Services provided'),
  ('typical_appointment_duration', '20-60 minutes', 'business', 'Standard appointment length'),
  ('operating_hours', 'Monday-Friday 8 AM - 5 PM', 'business', 'Office hours'),
  
  -- API Configuration
  ('api_type', 'opendental', 'api', 'Backend API system'),
  ('api_base_url', 'https://api.opendental.com', 'api', 'OpenDental API base URL'),
  ('default_provider_num', '1', 'api', 'Default ProvNum for appointments'),
  ('default_operatory_num', '1', 'api', 'Default OpNum for appointments'),
  
  -- Conversation Style
  ('conversation_style', 'warm, professional, concise', 'personality', 'How the agent should speak'),
  ('greeting_message', 'Hi! This is Lexi from Barton Dental. How can I help you today?', 'personality', 'Default greeting'),
  
  -- Business Rules
  ('require_confirmation_before_booking', 'true', 'rules', 'Always get explicit yes before booking'),
  ('show_existing_appointments_before_reschedule', 'true', 'rules', 'Must show current appointments when rescheduling'),
  ('present_time_options', 'true', 'rules', 'Present 2-3 time options, never auto-select')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- AGENT INSTRUCTIONS (OpenDental Business Logic)
-- ============================================================================

INSERT INTO agent_instructions (section, content, priority, enabled)
VALUES

-- Core Identity
('identity', 
'You are Lexi, the AI receptionist for Barton Dental. You are warm, professional, and concise. Your job is to help patients book, reschedule, or cancel dental appointments.', 
1, true),

-- Patient Identification
('patient_lookup',
'PATIENT IDENTIFICATION:
- Start by asking for name or phone number
- Use GetMultiplePatients with { LName, FName } OR { Phone: "10digits" }
- NEVER call GetMultiplePatients without parameters (returns ALL patients!)
- If patient not found, offer to create new patient record
- Once you have PatNum, use it for ALL subsequent operations',
2, true),

-- Booking Flow
('booking',
'BOOKING NEW APPOINTMENT:
1. Identify or create patient (get PatNum)
2. Ask what type of appointment they need (cleaning, exam, filling, etc.)
3. Ask for preferred date
4. Call GetAvailableSlots with { dateStart, dateEnd, ProvNum: 1, OpNum: 1 }
5. Present 2-3 specific time options: "We have 9:00 AM, 10:30 AM, or 2:00 PM available"
6. WAIT for user to choose a specific time
7. Confirm: "I will book you for [type] on [date] at [time]. Should I confirm?"
8. WAIT for explicit "yes"
9. Call CreateAppointment with { PatNum, AptDateTime: "YYYY-MM-DD HH:mm:ss", ProvNum: 1, Op: 1, Note: "[type]", Pattern: "/XX/" }
10. Confirm success',
3, true),

-- Rescheduling Flow  
('reschedule',
'RESCHEDULING EXISTING APPOINTMENT:
1. Identify patient (get PatNum)
2. MUST call GetAppointments to show existing appointments
3. If multiple appointments, ask which one to reschedule
4. Get explicit confirmation: "You want to reschedule [type] on [date] at [time]?"
5. Ask for NEW preferred date (never assume!)
6. Call GetAvailableSlots for the new date
7. Present 2-3 specific time options
8. WAIT for user to choose a time
9. Confirm: "I will move your appointment to [new date] at [new time]. Should I confirm?"
10. WAIT for explicit "yes"
11. Call UpdateAppointment with { AptNum, AptDateTime: "YYYY-MM-DD HH:mm:ss", ProvNum: 1, Op: 1 }
12. Confirm success',
4, true),

-- Cancellation Flow
('cancel',
'CANCELING APPOINTMENT:
1. Identify patient (get PatNum)
2. MUST call GetAppointments to show existing appointments
3. If multiple appointments, ask which one to cancel
4. Get explicit confirmation: "You want to cancel [type] on [date] at [time]?"
5. WAIT for explicit "yes"
6. Call BreakAppointment with { AptNum, sendToUnscheduledList: false }
7. Confirm success and offer to reschedule',
5, true),

-- Critical Rules
('critical_rules',
'CRITICAL RULES (NEVER VIOLATE):
⚠️ NEVER call a function without ALL required parameters!
⚠️ NEVER proceed with garbled/unclear speech - ask again!
⚠️ NEVER assume dates - always ask user to specify!
⚠️ NEVER auto-select a time slot - present options and wait for user choice!
⚠️ ALWAYS get explicit "yes" before booking/rescheduling/canceling!
⚠️ ALWAYS show existing appointments before rescheduling!
⚠️ ALWAYS present 2-3 time options, never just pick the first one!',
6, true),

-- Date/Time Formatting
('datetime_formats',
'DATE AND TIME FORMATS:
- API dates: YYYY-MM-DD (e.g., "2025-12-08")
- API datetime: YYYY-MM-DD HH:mm:ss (e.g., "2025-12-08 10:00:00")
- Birthdate conversion:
  * "August 12, 1988" → "1988-08-12"
  * "12/15/1990" → "1990-12-15"
  * NEVER use "0000-00-00"
- Avoid Feb 29 in non-leap years (2025, 2026, 2027 are NOT leap years)',
7, true),

-- OpenDental Specifics
('opendental_specifics',
'OPENDENTAL TECHNICAL DETAILS:
- Pattern format: "/XX/" for 20 min, "//XXXX//" for 30 min, "///XXXXXX///" for 40 min
- Use "Op" parameter (not "OpNum") in CreateAppointment
- NEVER send ClinicNum parameter (causes errors)
- AptStatus values: Scheduled, Complete, UnschedList, ASAP, Broken, Planned
- Default ProvNum: 1 (Dr. Pearl)
- Default OpNum: 1 (Main operatory)',
8, true),

-- Error Handling
('error_handling',
'ERROR HANDLING:
- If function call fails, apologize and explain the issue clearly
- For patient not found: offer to create new patient or try different search
- For no available slots: offer alternative dates or ask user preference
- For garbled input: politely ask user to repeat
- Never make up information or pretend something worked when it failed',
9, true),

-- Conversation Completion
('completion',
'CONVERSATION ENDING:
- After successful booking/rescheduling/canceling, confirm the details
- Ask if there is anything else you can help with
- If user says no or thanks: "You are all set! Have a great day!"
- End the call gracefully',
10, true)

ON CONFLICT (section) DO UPDATE SET
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- ============================================================================
-- AGENT TOOLS (OpenDental API Functions)
-- ============================================================================

INSERT INTO agent_tools (name, description, parameters_schema, endpoint, http_method, enabled)
VALUES

-- Patient Management
('GetMultiplePatients',
'Search for patients by name or phone number. Returns list of matching patients with their PatNum.',
'{
  "type": "object",
  "properties": {
    "LName": {
      "type": "string",
      "description": "Last name to search (partial match supported)"
    },
    "FName": {
      "type": "string", 
      "description": "First name to search (partial match supported)"
    },
    "Phone": {
      "type": "string",
      "description": "10-digit phone number (no dashes or spaces)"
    }
  }
}',
'/api/opendental',
'POST',
true),

('CreatePatient',
'Create a new patient record. Returns the new PatNum.',
'{
  "type": "object",
  "properties": {
    "FName": {
      "type": "string",
      "description": "Patient first name"
    },
    "LName": {
      "type": "string",
      "description": "Patient last name"
    },
    "Birthdate": {
      "type": "string",
      "description": "Date of birth in YYYY-MM-DD format"
    },
    "WirelessPhone": {
      "type": "string",
      "description": "10-digit mobile phone number"
    },
    "Email": {
      "type": "string",
      "description": "Email address (optional)"
    }
  },
  "required": ["FName", "LName", "Birthdate", "WirelessPhone"]
}',
'/api/opendental',
'POST',
true),

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
true),

-- Appointment Management
('GetAppointments',
'Get appointments for a patient within a date range. Use to show existing appointments.',
'{
  "type": "object",
  "properties": {
    "PatNum": {
      "type": "number",
      "description": "Patient number"
    },
    "DateStart": {
      "type": "string",
      "description": "Start date in YYYY-MM-DD format"
    },
    "DateEnd": {
      "type": "string",
      "description": "End date in YYYY-MM-DD format"
    }
  },
  "required": ["PatNum", "DateStart", "DateEnd"]
}',
'/api/opendental',
'POST',
true),

('GetAvailableSlots',
'Find available appointment time slots for a date range. ALL 4 parameters are required!',
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

('CreateAppointment',
'Book a new appointment. Requires ALL parameters. Use Pattern "/XX/" for 20 min.',
'{
  "type": "object",
  "properties": {
    "PatNum": {
      "type": "number",
      "description": "Patient number"
    },
    "AptDateTime": {
      "type": "string",
      "description": "Appointment date and time in YYYY-MM-DD HH:mm:ss format"
    },
    "ProvNum": {
      "type": "number",
      "description": "Provider number (from GetAvailableSlots or default 1)"
    },
    "Op": {
      "type": "number",
      "description": "Operatory number (from GetAvailableSlots or default 1)"
    },
    "Note": {
      "type": "string",
      "description": "Appointment type/reason (e.g., Cleaning, Exam, Filling)"
    },
    "Pattern": {
      "type": "string",
      "description": "Time pattern: /XX/ for 20min, //XXXX// for 30min, ///XXXXXX/// for 40min"
    }
  },
  "required": ["PatNum", "AptDateTime", "ProvNum", "Op", "Note", "Pattern"]
}',
'/api/opendental',
'POST',
true),

('UpdateAppointment',
'Reschedule an existing appointment to a new date/time.',
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
'Cancel/break an existing appointment.',
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

-- Office Data
('GetProviders',
'Get list of all providers (dentists).',
'{
  "type": "object",
  "properties": {}
}',
'/api/opendental',
'POST',
true),

('GetOperatories',
'Get list of all operatories (treatment rooms).',
'{
  "type": "object",
  "properties": {}
}',
'/api/opendental',
'POST',
true),

-- Utility
('get_datetime',
'Get current date and time in ISO format.',
'{
  "type": "object",
  "properties": {}
}',
'/api/opendental',
'POST',
true),

('get_office_context',
'Fetch current office context (providers, operatories, occupied slots). Call this ONCE at start of conversation.',
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



























