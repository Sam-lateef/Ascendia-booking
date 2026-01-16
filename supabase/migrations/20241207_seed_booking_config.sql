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





























