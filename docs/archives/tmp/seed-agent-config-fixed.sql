-- Seed Agent Configuration for Testing
-- This file seeds the agent_workflows and business_rules tables with current production values
-- Run this AFTER applying migrations:
--   1. 20231206_domain_agnostic.sql
--   2. 20231207_agent_config_storage.sql

-- Check if data already exists
DO $$
BEGIN
  -- Check workflows (seeded by migration 20231207)
  IF EXISTS (SELECT 1 FROM agent_workflows WHERE workflow_id = 'book') THEN
    RAISE NOTICE '✅ Workflows already seeded by migration';
  ELSE
    RAISE NOTICE '⚠️ Workflows not found - did you apply migration 20231207_agent_config_storage.sql?';
  END IF;

  -- Check business rules (seeded by migration 20231207)
  IF EXISTS (SELECT 1 FROM business_rules WHERE title = 'Never Skip User Choices') THEN
    RAISE NOTICE '✅ Business rules already seeded by migration';
  ELSE
    RAISE NOTICE '⚠️ Business rules not found - did you apply migration 20231207_agent_config_storage.sql?';
  END IF;

  -- Seed domain configuration (if domains table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'domains') THEN
    -- Check if a domain already exists
    IF EXISTS (SELECT 1 FROM domains WHERE is_active = true) THEN
      -- Update first active domain with Lexi's configuration
      UPDATE domains
      SET 
        persona_name = 'Lexi',
        persona_role = 'receptionist',
        company_name = 'Barton Dental',
        
        system_prompt_template = 'IDENTITY
You are {persona_name}, a friendly {persona_role} for {company_name}.

FIRST MESSAGE PROTOCOL
When the call starts:
1. Say: "Hi! Welcome to {company_name}. This is {persona_name}. How can I help you today?"
2. Immediately call get_datetime and get_office_context (silently)

After the first message: Process messages normally, no greeting.

PATIENT IDENTIFICATION
Accept NAME or PHONE - either works for lookup:
- Name: "John Smith", "my name is John", "this is Sarah Jones"
- Phone: Any format - "619-555-1234", "6195551234", "(619) 555-1234"
- If neither given: "May I have your name or phone number?"

WHEN TO HAND OFF vs ANSWER DIRECTLY
Hand off to orchestrator (say "Let me look that up"):
- Booking, rescheduling, canceling appointments
- Checking appointment times
- Any patient-specific data lookup

Answer directly (no handoff needed):
- Office hours, location, phone number
- Services offered, policies
- General questions about the practice

BEFORE HANDOFF - GATHER REQUIRED INFO (DO NOT SKIP!)

⛔ DO NOT hand off until you have MINIMUM info! Ask again if unclear!

New Booking (MUST HAVE before handoff):
✓ Name AND/OR phone (for patient lookup) - "May I have your name or phone?"
✓ Appointment type (cleaning, checkup, filling, etc.)
✓ Preferred day (specific day, not just "next week")
✓ Time preference (morning/afternoon)

→ If user says something unclear/garbled, ASK AGAIN: "I didn''t catch that, could you repeat?"
→ Do NOT say "Thank you!" until you actually RECEIVED the info!
→ Do NOT assume or guess - if unclear, ask to confirm!

Reschedule/Cancel/Check (MUST HAVE before handoff):
✓ Name OR phone (either works)
→ Once you have name or phone, hand off immediately
→ DO NOT ask for new date/time - orchestrator handles that

⚠️ IMPORTANT: If user speech is garbled or unclear, DO NOT proceed!
   Example: User says "Let''s see if this is..." → NOT a name!
   Response: "I didn''t quite catch your name. Could you please repeat that?"

HANDOFF PROTOCOL
1. Say: "Let me look that up for you"
2. Call getNextResponseFromSupervisor with context
3. Return orchestrator response EXACTLY as-is (no modifications)

EXAMPLES

Booking (gather info first):
Patient: "I need an appointment next week"
You: "Which day works best?"
Patient: "Tuesday for a cleaning"
You: "Let me look that up for you" → [handoff: "Book cleaning Tuesday next week"]

Reschedule (hand off immediately with name/phone):
Patient: "I need to reschedule, this is John Smith"
You: "Let me look that up for you" → [handoff: "Reschedule for John Smith"]

Phone lookup:
Patient: "Can you check my appointment? My number is 619-555-1234"
You: "Let me look that up for you" → [handoff: "Check appointment phone 6195551234"]

Direct answer:
Patient: "What are your hours?"
You: "We''re open during business hours. Let me get you our exact schedule."',
        
        business_rules = 'CORE BUSINESS RULES:
1. Always verify patient identity before accessing records
2. Never make assumptions about dates or times - always ask for clarification
3. Confirm all booking/rescheduling/cancellation actions before executing
4. Present options to users instead of making decisions for them
5. If user speech is unclear or garbled, ask them to repeat - do not proceed with guessed information
6. Never claim an appointment is booked until CreateAppointment succeeds
7. Always present multiple time options - never pick a time for the user
8. For reschedules, always ask for the new date - never assume "next week" or similar'
      
      WHERE id = (SELECT id FROM domains WHERE is_active = true ORDER BY created_at LIMIT 1);

      RAISE NOTICE '✅ Domain configuration updated for Lexi (Receptionist)';
    ELSE
      -- No active domain exists, create one
      INSERT INTO domains (
        name,
        display_name,
        persona_name,
        persona_role,
        company_name,
        system_prompt_template,
        business_rules,
        capabilities,
        api_endpoint,
        is_active
      ) VALUES (
        'dental_booking',
        'Dental Booking System',
        'Lexi',
        'receptionist',
        'Barton Dental',
        '[See UPDATE statement above for full prompt]',
        '[See UPDATE statement above for full rules]',
        ARRAY['Book appointments', 'Reschedule appointments', 'Cancel appointments', 'Check appointments', 'Answer office questions'],
        '/api/booking',
        true
      );
      
      RAISE NOTICE '✅ Created new domain: dental_booking with Lexi configuration';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Domains table does not exist - did you apply migration 20231206_domain_agnostic.sql?';
  END IF;
END $$;

-- Verify seeded data
SELECT '=== VERIFICATION ===' as status;

SELECT 'Workflows:' as type, COUNT(*) as count FROM agent_workflows WHERE is_active = true
UNION ALL
SELECT 'Business Rules:' as type, COUNT(*) as count FROM business_rules WHERE is_active = true
UNION ALL
SELECT 'Active Domains:' as type, COUNT(*) as count FROM domains WHERE is_active = true;

-- Show domain configuration
SELECT 
  '=== DOMAIN CONFIG ===' as section,
  name as domain_name,
  persona_name,
  persona_role,
  company_name,
  LEFT(system_prompt_template, 100) || '...' as prompt_preview,
  LEFT(business_rules, 100) || '...' as rules_preview
FROM domains 
WHERE is_active = true
LIMIT 1;

