-- ============================================
-- Agent Configuration System
-- Makes the entire system domain-agnostic and configurable via UI
-- ============================================

-- ============================================
-- Table 1: COMPANY_INFO
-- Store company/business information
-- ============================================
CREATE TABLE IF NOT EXISTS company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Basic Info
  company_name TEXT NOT NULL,
  persona_name TEXT NOT NULL DEFAULT 'Lexi',
  persona_role TEXT NOT NULL DEFAULT 'receptionist',
  
  -- Contact Details
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  
  -- Hours (JSONB for flexibility)
  -- Example: { "weekdays": "Monday-Friday: 8:00 AM - 5:00 PM", "saturday": "Closed", "sunday": "Closed" }
  hours JSONB DEFAULT '{}'::jsonb,
  
  -- Services/Products (Array)
  services TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Policies (JSONB for flexibility)
  -- Example: { "cancellation": "24-hour notice required", "newCustomers": "New patients welcome" }
  policies JSONB DEFAULT '{}'::jsonb,
  
  -- System Configuration
  system_type TEXT CHECK (system_type IN ('booking', 'crm', 'inventory', 'ecommerce', 'custom')) DEFAULT 'booking',
  api_endpoint TEXT DEFAULT '/api/booking',
  
  -- Voice Settings
  voice TEXT DEFAULT 'sage',
  model TEXT DEFAULT 'gpt-4o-realtime-preview-2024-12-17',
  temperature NUMERIC DEFAULT 0.8,
  
  -- Active Status
  is_active BOOLEAN DEFAULT TRUE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_company_info_active ON company_info(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_company_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_info_updated_at ON company_info;
CREATE TRIGGER company_info_updated_at
  BEFORE UPDATE ON company_info
  FOR EACH ROW
  EXECUTE FUNCTION update_company_info_updated_at();

-- ============================================
-- Table 2: AGENT_TOOLS
-- Dynamic tool/function configuration
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tool Identification
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT, -- 'patients', 'appointments', 'contacts', 'inventory', 'context'
  
  -- Parameters (Zod-compatible JSON schema)
  -- Example: {
  --   "Phone": { "type": "string", "required": false, "nullable": true, "description": "10-digit phone" },
  --   "PatNum": { "type": "number", "required": true, "description": "Patient ID" }
  -- }
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Return Type
  returns_description TEXT,
  
  -- Execution
  api_route TEXT NOT NULL, -- '/api/booking', '/api/crm'
  is_virtual BOOLEAN DEFAULT FALSE, -- Virtual functions (AskUser, PresentOptions, etc.)
  
  -- Display
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_tools_active ON agent_tools(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_agent_tools_category ON agent_tools(category);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS agent_tools_updated_at ON agent_tools;
CREATE TRIGGER agent_tools_updated_at
  BEFORE UPDATE ON agent_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_company_info_updated_at();

-- ============================================
-- Table 3: AGENT_INSTRUCTIONS
-- Store instruction templates and business logic
-- ============================================
CREATE TABLE IF NOT EXISTS agent_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  
  -- Content
  instruction_template TEXT NOT NULL,
  -- Template variables supported:
  -- {company_name}, {persona_name}, {persona_role}
  -- {phone}, {email}, {address}
  -- {hours_weekdays}, {hours_saturday}, {hours_sunday}
  -- {services_list}, {tools_list}
  
  -- Categorization
  instruction_type TEXT CHECK (instruction_type IN ('persona', 'business_logic', 'fallback', 'safety')) DEFAULT 'business_logic',
  system_type TEXT, -- 'booking', 'crm', 'inventory', 'generic', null for all
  
  -- Display
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_by TEXT,
  last_modified_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_instructions_active ON agent_instructions(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_agent_instructions_type ON agent_instructions(instruction_type);
CREATE INDEX IF NOT EXISTS idx_agent_instructions_system ON agent_instructions(system_type);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS agent_instructions_updated_at ON agent_instructions;
CREATE TRIGGER agent_instructions_updated_at
  BEFORE UPDATE ON agent_instructions
  FOR EACH ROW
  EXECUTE FUNCTION update_company_info_updated_at();

-- ============================================
-- Views for Easy Access
-- ============================================

-- View: Active tools by category
CREATE OR REPLACE VIEW active_tools_by_category AS
SELECT 
  category,
  json_agg(
    json_build_object(
      'id', id,
      'name', name,
      'description', description,
      'parameters', parameters,
      'api_route', api_route,
      'is_virtual', is_virtual
    ) ORDER BY display_order
  ) as tools
FROM agent_tools
WHERE is_active = TRUE
GROUP BY category
ORDER BY category;

-- View: Active instructions by type
CREATE OR REPLACE VIEW active_instructions_by_type AS
SELECT 
  instruction_type,
  system_type,
  json_agg(
    json_build_object(
      'id', id,
      'name', name,
      'instruction_template', instruction_template
    ) ORDER BY display_order
  ) as instructions
FROM agent_instructions
WHERE is_active = TRUE
GROUP BY instruction_type, system_type
ORDER BY instruction_type, system_type;



-- ============================================
-- Seed Data: Booking System Configuration
-- Initial setup for dental booking system
-- ============================================

-- ============================================
-- 1. COMPANY INFO
-- ============================================
INSERT INTO company_info (
  company_name,
  persona_name,
  persona_role,
  phone,
  address,
  hours,
  services,
  policies,
  system_type,
  api_endpoint,
  voice,
  is_active
) VALUES (
  'Barton Dental',
  'Lexi',
  'receptionist',
  '(555) 123-4567',
  '123 Main Street, Suite 100, Anytown, ST 12345',
  '{
    "weekdays": "Monday-Friday: 8:00 AM - 5:00 PM",
    "saturday": "Closed",
    "sunday": "Closed"
  }'::jsonb,
  ARRAY[
    'Routine Cleanings & Exams',
    'Digital X-Rays',
    'Fillings & Restorations',
    'Root Canal Therapy',
    'Crowns & Bridges',
    'Teeth Whitening',
    'Dental Implants',
    'Emergency Dental Care',
    'Periodontal Care',
    'Cosmetic Dentistry'
  ],
  '{
    "cancellation": "24-hour notice required for cancellations to avoid a fee",
    "newPatients": "New patients welcome! Please arrive 15 minutes early for paperwork. You will complete full registration on-premise.",
    "insurance": "We accept most major insurance plans",
    "weekends": "Appointments available on weekdays only. No weekend bookings.",
    "emergencies": "For dental emergencies, please call our office or go to the nearest emergency room."
  }'::jsonb,
  'booking',
  '/api/booking',
  'sage',
  TRUE
) ON CONFLICT DO NOTHING;

-- ============================================
-- 2. AGENT TOOLS
-- ============================================

-- Patient Management Tools
INSERT INTO agent_tools (name, description, category, parameters, returns_description, api_route, is_virtual, is_active, display_order) VALUES
(
  'GetMultiplePatients',
  'Find patients by phone number',
  'patients',
  '{
    "Phone": {
      "type": "string",
      "required": false,
      "nullable": true,
      "description": "10-digit phone number (no dashes)"
    },
    "FName": {
      "type": "string",
      "required": false,
      "nullable": true,
      "description": "First name"
    },
    "LName": {
      "type": "string",
      "required": false,
      "nullable": true,
      "description": "Last name"
    },
    "PatNum": {
      "type": "number",
      "required": false,
      "nullable": true,
      "description": "Patient ID"
    }
  }'::jsonb,
  'Array of patient objects with PatNum, FName, LName, Phone',
  '/api/booking',
  FALSE,
  TRUE,
  1
),
(
  'CreatePatient',
  'Create a new patient record',
  'patients',
  '{
    "FName": {
      "type": "string",
      "required": true,
      "description": "First name"
    },
    "LName": {
      "type": "string",
      "required": true,
      "description": "Last name"
    },
    "Birthdate": {
      "type": "string",
      "required": true,
      "description": "Date of birth (YYYY-MM-DD)"
    },
    "WirelessPhone": {
      "type": "string",
      "required": true,
      "description": "10-digit phone number"
    }
  }'::jsonb,
  'Created patient object with PatNum',
  '/api/booking',
  FALSE,
  TRUE,
  2
);

-- Appointment Management Tools
INSERT INTO agent_tools (name, description, category, parameters, returns_description, api_route, is_virtual, is_active, display_order) VALUES
(
  'GetAppointments',
  'Get patient appointments within a date range',
  'appointments',
  '{
    "PatNum": {
      "type": "number",
      "required": true,
      "description": "Patient ID"
    },
    "DateStart": {
      "type": "string",
      "required": true,
      "description": "Start date (YYYY-MM-DD)"
    },
    "DateEnd": {
      "type": "string",
      "required": true,
      "description": "End date (YYYY-MM-DD)"
    }
  }'::jsonb,
  'Array of appointment objects with AptNum, AptDateTime, ProvNum, Op, Note',
  '/api/booking',
  FALSE,
  TRUE,
  3
),
(
  'GetAvailableSlots',
  'Find available appointment time slots',
  'appointments',
  '{
    "dateStart": {
      "type": "string",
      "required": true,
      "description": "Start date (YYYY-MM-DD)"
    },
    "dateEnd": {
      "type": "string",
      "required": true,
      "description": "End date (YYYY-MM-DD)"
    },
    "ProvNum": {
      "type": "number",
      "required": false,
      "nullable": true,
      "description": "Provider ID (defaults to 1)"
    },
    "OpNum": {
      "type": "number",
      "required": false,
      "nullable": true,
      "description": "Operatory ID (defaults to 1)"
    },
    "lengthMinutes": {
      "type": "number",
      "required": false,
      "nullable": true,
      "description": "Appointment length in minutes (default 60)"
    }
  }'::jsonb,
  'Array of available time slots with DateTime, ProvNum, Op, Provider name',
  '/api/booking',
  FALSE,
  TRUE,
  4
),
(
  'CreateAppointment',
  'Book a new appointment',
  'appointments',
  '{
    "PatNum": {
      "type": "number",
      "required": true,
      "description": "Patient ID"
    },
    "AptDateTime": {
      "type": "string",
      "required": true,
      "description": "Appointment date and time (YYYY-MM-DD HH:mm:ss)"
    },
    "ProvNum": {
      "type": "number",
      "required": true,
      "description": "Provider ID"
    },
    "Op": {
      "type": "number",
      "required": true,
      "description": "Operatory number"
    },
    "Note": {
      "type": "string",
      "required": false,
      "nullable": true,
      "description": "Appointment note/type"
    }
  }'::jsonb,
  'Created appointment object with AptNum',
  '/api/booking',
  FALSE,
  TRUE,
  5
),
(
  'UpdateAppointment',
  'Reschedule an existing appointment',
  'appointments',
  '{
    "AptNum": {
      "type": "number",
      "required": true,
      "description": "Appointment ID to update"
    },
    "AptDateTime": {
      "type": "string",
      "required": true,
      "description": "New appointment date and time (YYYY-MM-DD HH:mm:ss)"
    },
    "ProvNum": {
      "type": "number",
      "required": true,
      "description": "Provider ID"
    },
    "Op": {
      "type": "number",
      "required": true,
      "description": "Operatory number"
    }
  }'::jsonb,
  'Updated appointment object',
  '/api/booking',
  FALSE,
  TRUE,
  6
),
(
  'BreakAppointment',
  'Cancel an appointment',
  'appointments',
  '{
    "AptNum": {
      "type": "number",
      "required": true,
      "description": "Appointment ID to cancel"
    }
  }'::jsonb,
  'Confirmation of cancellation',
  '/api/booking',
  FALSE,
  TRUE,
  7
);

-- Context Tools
INSERT INTO agent_tools (name, description, category, parameters, returns_description, api_route, is_virtual, is_active, display_order) VALUES
(
  'get_datetime',
  'Get current date and time',
  'context',
  '{}'::jsonb,
  'Current date and time in various formats',
  '/api/booking',
  FALSE,
  TRUE,
  8
),
(
  'get_office_context',
  'Get office context (providers, operatories, occupied slots)',
  'context',
  '{}'::jsonb,
  'Office context with providers, operatories, and current bookings',
  '/api/booking',
  FALSE,
  TRUE,
  9
);

-- ============================================
-- 3. AGENT INSTRUCTIONS
-- ============================================

-- Persona Instructions
INSERT INTO agent_instructions (name, description, instruction_template, instruction_type, system_type, is_active, display_order) VALUES
(
  'Lexi Persona - Booking System',
  'Core persona and identity for dental booking receptionist',
  'IDENTITY
You are {persona_name}, the friendly {persona_role} for {company_name}.

When the call starts, say: "Hi! Welcome to {company_name}. This is {persona_name}. How can I help you today?"

OFFICE INFO
{company_name} | {phone} | {address}
Hours: {hours_weekdays} | Weekends: {hours_saturday}
Services: {services_list}

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: IGNORE BACKGROUND NOISE
═══════════════════════════════════════════════════════════════════════════════
Background noise/music may be transcribed as random foreign languages.
IGNORE transcriptions that are:
- Not clear English sentences
- Random words in Spanish, Arabic, Korean, French, German, Russian, etc.
- Single words like "Maduanamu", "مهمة", "지금", "Günlük", etc.

If you receive gibberish, say: "I didn''t catch that. Could you please repeat?"',
  'persona',
  'booking',
  TRUE,
  1
);

-- Business Logic Instructions
INSERT INTO agent_instructions (name, description, instruction_template, instruction_type, system_type, is_active, display_order) VALUES
(
  'Booking Flow Logic',
  'How to handle new appointment bookings',
  '═══════════════════════════════════════════════════════════════════════════════
BOOKING A NEW APPOINTMENT
═══════════════════════════════════════════════════════════════════════════════

Think through the logic:
1. Who is the patient? 
   - If they gave you a name or phone, use GetMultiplePatients to find them
   - If not found, ask if they''re new. Then use CreatePatient (need: name, DOB, phone)
   
2. What do they want?
   - Ask what type of appointment (cleaning, checkup, etc.)
   - Ask when they prefer (specific date, morning/afternoon)

3. What''s available?
   - Use GetAvailableSlots for their preferred date
   - If nothing available, suggest nearby dates
   
4. Let them choose
   - Present 2-3 time options: "I have 9 AM, 10 AM, or 2 PM available"
   - Wait for them to pick one
   
5. Confirm and book
   - Confirm: "Booking [type] on [date] at [time]. Shall I confirm?"
   - After "yes", use CreateAppointment with the EXACT slot details
   - Say: "Done! Your [type] is booked for [date] at [time]."
   - END the conversation - don''t ask follow-up questions',
  'business_logic',
  'booking',
  TRUE,
  2
),
(
  'Rescheduling Flow Logic',
  'How to handle appointment rescheduling',
  '═══════════════════════════════════════════════════════════════════════════════
RESCHEDULING AN APPOINTMENT
═══════════════════════════════════════════════════════════════════════════════

Think through the logic:
1. Who is the patient?
   - Use GetMultiplePatients with their name or phone
   
2. Which appointment do they want to reschedule?
   - Use GetAppointments to show all their upcoming appointments
   - Let them pick which one
   
3. When do they want to move it?
   - Ask what new date they prefer
   - If they already told you (e.g., "move dec 10 to dec 17"), use that
   
4. What times are available?
   - Use GetAvailableSlots for the new date
   - If they specified a time (e.g., "10 AM"), check if it''s in the results
   - If yes, use that exact slot
   - If no, tell them and present what IS available
   
5. Confirm and update
   - Confirm: "Moving your [date] appointment to [new date] at [time]. Shall I confirm?"
   - After "yes", use UpdateAppointment with the selected slot
   - Say: "Done! Your appointment is now [date] at [time]."
   - END the conversation - task complete',
  'business_logic',
  'booking',
  TRUE,
  3
),
(
  'Cancellation Flow Logic',
  'How to handle appointment cancellations',
  '═══════════════════════════════════════════════════════════════════════════════
CANCELING AN APPOINTMENT
═══════════════════════════════════════════════════════════════════════════════

Think through the logic:
1. Who is the patient? (GetMultiplePatients)
2. Which appointment? (GetAppointments to show options)
3. Confirm: "Cancel your [date] at [time] appointment?"
4. After "yes", use BreakAppointment
5. Say: "Done. Your appointment has been cancelled."
6. END - task complete',
  'business_logic',
  'booking',
  TRUE,
  4
);

-- Safety Instructions
INSERT INTO agent_instructions (name, description, instruction_template, instruction_type, system_type, is_active, display_order) VALUES
(
  'Function Parameter Validation',
  'Rules for calling functions correctly',
  '═══════════════════════════════════════════════════════════════════════════════
IMPORTANT RULES (Not Flows - Just Logic)
═══════════════════════════════════════════════════════════════════════════════

BEFORE CALLING ANY FUNCTION:
- Check you have ALL required parameters
- If something is missing, either ASK the user or CALL another function to get it
- NEVER call a function with empty {} parameters

Examples:
- Want to call CreateAppointment? You need: PatNum, AptDateTime, ProvNum, Op
  - No PatNum? Call GetMultiplePatients first
  - No slot details? Call GetAvailableSlots first and let user pick
  
- Want to call UpdateAppointment? You need: AptNum, AptDateTime, ProvNum, Op
  - No AptNum? Call GetAppointments first and let user pick
  - No new time? Call GetAvailableSlots and let user choose

MATCHING USER''S TIME TO SLOTS:
When user says a time like "10 AM" or "2:30 PM":
- Find the matching slot in GetAvailableSlots results
- Use that slot''s EXACT values: DateTime, ProvNum, Op
- Don''t guess or approximate - use the exact slot data

DATES:
- Current date: Use get_datetime() at the start
- Format for functions: YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
- If user says "next Tuesday", calculate the actual date

WHEN TO END:
After completing an action (CreateAppointment, UpdateAppointment, BreakAppointment):
- Say "Done!" with the details
- STOP - don''t ask "Anything else?"
- The conversation is complete
- User will start new conversation if needed',
  'safety',
  NULL,
  TRUE,
  5
);



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

