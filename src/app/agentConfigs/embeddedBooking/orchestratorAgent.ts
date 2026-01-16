import { tool } from '@openai/agents/realtime';
import type { EmbeddedBookingOfficeContext } from '@/app/lib/embeddedBookingContext';
import { 
  loadAgentWorkflows, 
  loadBusinessRules, 
  formatWorkflowsAsInstructions,
  formatBusinessRulesAsInstructions,
  type AgentWorkflow,
  type BusinessRule
} from '@/app/lib/agentConfigLoader';

// ============================================
// DATABASE CONFIGURATION CACHE
// ============================================
let dbWorkflows: AgentWorkflow[] | null = null;
let dbBusinessRules: BusinessRule[] | null = null;
let dbConfigLoaded = false;

// Preload configuration from database (async, runs in background)
// Only run on server-side (not in browser)
if (typeof window === 'undefined') {
  (async () => {
    try {
      const [workflows, rules] = await Promise.all([
        loadAgentWorkflows(),
        loadBusinessRules('orchestrator')
      ]);
      dbWorkflows = workflows;
      dbBusinessRules = rules;
      dbConfigLoaded = true;
      console.log('[Orchestrator] ✅ Configuration loaded from database');
    } catch (error) {
      console.warn('[Orchestrator] ⚠️ Could not load config from database, using hardcoded fallback');
    }
  })();
}

/**
 * Tier 2: Orchestrator Supervisor Agent for Embedded Booking System
 * 
 * This agent has:
 * - Full knowledge of embedded booking API functions
 * - Business logic and workflows for appointment booking
 * - Ability to plan multi-step workflows
 * - Calls API worker (/api/booking) to execute functions
 */

/**
 * Get current date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get tomorrow's date in YYYY-MM-DD format
 */
function getTomorrowDate(): string {
  const tomorrow = new Date();
  // Use milliseconds to avoid Feb 28/29 bugs
  tomorrow.setTime(tomorrow.getTime() + 24 * 60 * 60 * 1000);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate simplified function catalog for embedded booking system
 */
function generateFunctionCatalog(): string {
  return `
PRIORITY FUNCTION CATALOG (12 Functions)

PATIENTS (3 functions):
1. GetMultiplePatients(LName?, FName?, Phone?)
   - Search for patients by last name, first name, or phone
   - Returns array of matching patients
   - CRITICAL: Must provide at least one search parameter

2. GetPatient(PatNum)
   - Get single patient by ID
   - Returns patient details

3. CreatePatient(FName, LName, Birthdate, WirelessPhone, Email?)
   - Create new patient record
   - All fields except Email are required
   - Returns created patient with PatNum

PROVIDERS (2 functions):
4. GetProviders()
   - Get all active providers
   - Returns array of providers with ProvNum, name, specialty

5. GetProvider(ProvNum)
   - Get single provider by ID
   - Returns provider details

OPERATORIES (1 function):
6. GetOperatories()
   - Get all active operatories
   - Returns array with OperatoryNum, OpName, IsHygiene

APPOINTMENTS (6 functions):
7. GetAppointments(PatNum?, DateStart?, DateEnd?, ProvNum?, Op?, AptStatus?)
   - Get appointments matching filters
   - At least one filter should be provided
   - Returns array of appointments

8. GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum, lengthMinutes?)
   - Get available appointment slots
   - REQUIRED: dateStart, dateEnd, ProvNum, OpNum
   - dateStart and dateEnd must be in YYYY-MM-DD format
   - Returns array of available slots with DateTimeStart, DateTimeEnd

9. CreateAppointment(PatNum, ProvNum, Op, AptDateTime, Note?, duration?)
   - Create new appointment
   - REQUIRED: PatNum, ProvNum, Op, AptDateTime
   - AptDateTime format: YYYY-MM-DD HH:mm:ss
   - duration defaults to 30 minutes
   - Returns created appointment

10. UpdateAppointment(AptNum, PatNum?, ProvNum?, Op?, AptDateTime?, Note?, AptStatus?, duration?)
    - Update existing appointment
    - REQUIRED: AptNum
    - Only provide fields to update
    - Returns updated appointment

11. BreakAppointment(AptNum, sendToUnscheduledList?)
    - Cancel/break appointment
    - REQUIRED: AptNum
    - Sets status to 'Broken' or 'UnschedList'

12. DeleteAppointment(AptNum)
    - Permanently delete appointment (soft delete)
    - REQUIRED: AptNum
    - Returns confirmation
`;
}

/**
 * Generate static instruction parts (workflows, rules, patterns)
 * These are static (don't change between calls), so OpenAI will auto-cache them
 * 
 * NEW: Now loads workflows and business rules from database!
 */

/**
 * Build instructions from database-loaded configuration
 * Falls back to hardcoded instructions if database load fails
 */
async function getStaticInstructionsFromDatabase(): Promise<string> {
  try {
    // Load configuration from database
    const [workflows, rules] = await Promise.all([
      loadAgentWorkflows(),
      loadBusinessRules('orchestrator')
    ]);

    console.log(`[Orchestrator] Loaded ${workflows.length} workflows and ${rules.length} business rules from database`);

    const functionCatalog = generateFunctionCatalog();
    
    // Generate date info
    const now = new Date();
    const todayISO = getTodayDate();
    const tomorrowISO = getTomorrowDate();
    const todayDayName = getDayOfWeek(now);
    const safeDateEnd = getSafeDateEnd(now);
    const nextDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      .map(day => `"next ${day}" = ${getNextDayOfWeek(day, now)} (${day})`)
      .join('\n');
    
    const dateInfo = `Today: ${todayISO} (${todayDayName})
Tomorrow: ${tomorrowISO}
Safe DateEnd (90 days): ${safeDateEnd}
${nextDays}
⚠️ NEVER use Feb 29 in years 2025, 2026, 2027 (not leap years) - use Feb 28 instead!`;

    // Format workflows and rules from database
    const workflowInstructions = formatWorkflowsAsInstructions(workflows);
    const businessRulesInstructions = formatBusinessRulesAsInstructions(rules);

    // Build complete instructions
    const instructions = `═══════════════════════════════════════════════════════════════════════════════
BOOKING SYSTEM WORKFLOWS
═══════════════════════════════════════════════════════════════════════════════

TODAY'S DATE INFO (Use for all date calculations)
${dateInfo}

${workflowInstructions}

${businessRulesInstructions}

${functionCatalog}

PARAMETER QUICK REFERENCE (MUST pass as JSON objects, not in function name):
- GetMultiplePatients: { LName, FName } OR { Phone: "10digits" }
- CreatePatient: { FName, LName, Birthdate: "YYYY-MM-DD", WirelessPhone: "10digits" }
- GetAppointments: { PatNum, DateStart, DateEnd }
- GetAvailableSlots: { dateStart, dateEnd, ProvNum, OpNum } ← ALL 4 REQUIRED!
- CreateAppointment: { PatNum, AptDateTime: "YYYY-MM-DD HH:mm:ss", ProvNum, Op, Note }
- UpdateAppointment: { AptNum, AptDateTime, ProvNum, Op }

⚠️ WRONG: GetAvailableSlots(dateStart='2025-12-08', ...)
✓ RIGHT: function=GetAvailableSlots, parameters={dateStart:'2025-12-08', dateEnd:'2025-12-08', ProvNum:1, OpNum:1}
`;

    return instructions;
  } catch (error) {
    console.error('[Orchestrator] Failed to load config from database, using fallback:', error);
    return getStaticInstructions(); // Fall back to hardcoded version
  }
}

/**
 * Calculate safe DateEnd (90 days from now, avoiding Feb 29 in non-leap years)
 */
function getSafeDateEnd(fromDate: Date): string {
  const futureDate = new Date(fromDate);
  // Use milliseconds to avoid Feb 28/29 bugs
  futureDate.setTime(fromDate.getTime() + 90 * 24 * 60 * 60 * 1000);
  
  const year = futureDate.getFullYear();
  const month = futureDate.getMonth() + 1; // 1-indexed
  const day = futureDate.getDate();
  
  // Check if this is Feb 29 in a non-leap year
  if (month === 2 && day === 29) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (!isLeapYear) {
      // Use Feb 28 instead
      return `${year}-02-28`;
    }
  }
  
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getStaticInstructions(): string {
  // ✅ NEW: Use database config if loaded
  if (dbConfigLoaded && dbWorkflows && dbBusinessRules) {
    console.log('[Orchestrator] Using database configuration');
    
    const functionCatalog = generateFunctionCatalog();
    
    // Generate date info
    const now = new Date();
    const todayISO = getTodayDate();
    const tomorrowISO = getTomorrowDate();
    const todayDayName = getDayOfWeek(now);
    const safeDateEnd = getSafeDateEnd(now);
    const nextDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      .map(day => `"next ${day}" = ${getNextDayOfWeek(day, now)} (${day})`)
      .join('\n');
    
    const dateInfo = `Today: ${todayISO} (${todayDayName})
Tomorrow: ${tomorrowISO}
Safe DateEnd (90 days): ${safeDateEnd}
${nextDays}
⚠️ NEVER use Feb 29 in years 2025, 2026, 2027 (not leap years) - use Feb 28 instead!`;

    // Use database-loaded workflows and rules
    const workflowInstructions = formatWorkflowsAsInstructions(dbWorkflows);
    const businessRulesInstructions = formatBusinessRulesAsInstructions(dbBusinessRules);

    return `═══════════════════════════════════════════════════════════════════════════════
BOOKING SYSTEM WORKFLOWS (Loaded from Database)
═══════════════════════════════════════════════════════════════════════════════

TODAY'S DATE INFO (Use for all date calculations)
${dateInfo}

${workflowInstructions}

${businessRulesInstructions}

${functionCatalog}

PARAMETER QUICK REFERENCE:
- GetMultiplePatients: { LName, FName } OR { Phone: "10digits" }
- CreatePatient: { FName, LName, Birthdate: "YYYY-MM-DD", WirelessPhone: "10digits" }
- GetAppointments: { PatNum, DateStart, DateEnd }
- GetAvailableSlots: { dateStart, dateEnd, ProvNum, OpNum } ← ALL 4 REQUIRED!
- CreateAppointment: { PatNum, AptDateTime: "YYYY-MM-DD HH:mm:ss", ProvNum, Op, Note }
- UpdateAppointment: { AptNum, AptDateTime, ProvNum, Op }
`;
  }

  // ⚠️ FALLBACK: Use hardcoded instructions if database not loaded
  console.log('[Orchestrator] Using hardcoded fallback configuration');
  
  const functionCatalog = generateFunctionCatalog();
  
  // Generate date info
  const now = new Date();
  const todayISO = getTodayDate();
  const tomorrowISO = getTomorrowDate();
  const todayDayName = getDayOfWeek(now);
  const safeDateEnd = getSafeDateEnd(now);
  const nextDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    .map(day => `"next ${day}" = ${getNextDayOfWeek(day, now)} (${day})`)
    .join('\n');
  
  const dateInfo = `Today: ${todayISO} (${todayDayName})
Tomorrow: ${tomorrowISO}
Safe DateEnd (90 days): ${safeDateEnd}
${nextDays}
⚠️ NEVER use Feb 29 in years 2025, 2026, 2027 (not leap years) - use Feb 28 instead!`;
  
  const instructions = `═══════════════════════════════════════════════════════════════════════════════
BOOKING SYSTEM WORKFLOW - FOLLOW THESE FLOWS (Hardcoded Fallback)
═══════════════════════════════════════════════════════════════════════════════

TODAY'S DATE INFO (Use for all date calculations)
${dateInfo}

═══════════════════════════════════════════════════════════════════════════════
FLOW 1: RESCHEDULE (When user says "reschedule", "change", "move" appointment)
═══════════════════════════════════════════════════════════════════════════════

1. IDENTIFY PATIENT
   - Name given → GetMultiplePatients(LName, FName)
   - Phone given → GetMultiplePatients(Phone="10digits")
   - Neither → Ask: "May I have your name or phone number?"

2. SHOW EXISTING APPOINTMENTS (MANDATORY)
   - Say: "Welcome back, [FName]! Let me pull up your appointments."
   - GetAppointments(PatNum, DateStart=today, DateEnd=<see Safe DateEnd above>)
   - Use the pre-calculated "Safe DateEnd" from TODAY'S DATE INFO section!
   - Multiple found → List all, ask "Which one would you like to reschedule?"
   - One found → "I see you have [type] on [date] at [time]. Is this the one?"
   - None found → "No upcoming appointments. Would you like to book one?"

3. ASK FOR NEW DATE (MANDATORY - do NOT assume or skip!)
   - After user selects which appointment to reschedule:
   - ⚠️ YOU MUST ASK: "What date would you like to move it to?"
   - ⚠️ WAIT for user to tell you the date! DO NOT assume "next week" or any date!
   - ⚠️ DO NOT proceed until user provides a specific date!
   - Once user provides date, ask: "Morning or afternoon?"
   - GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum) - ALL 4 PARAMS REQUIRED!

4. PRESENT TIME OPTIONS (MANDATORY - do NOT skip!)
   - Say: "We have [time1], [time2], or [time3] available. Which works best?"
   - ⚠️ WAIT for user to choose a specific time!
   - ⚠️ DO NOT just pick a time for them!

5. CONFIRM AND UPDATE
   - After user selects specific time (e.g., "10" or "9:30"):
   - Say: "I'll move it to [date] at [time]. Shall I confirm?"
   - WAIT for explicit "yes"
   - UpdateAppointment(AptNum, AptDateTime, ProvNum, Op)
   - Say: "Done! Your appointment is now [date] at [time]."
   - ⚠️ STOP HERE - DO NOT ask follow-up questions or continue the conversation
   - ⚠️ The task is COMPLETE - end your response

═══════════════════════════════════════════════════════════════════════════════
FLOW 2: NEW BOOKING (When user says "book", "schedule", "appointment")
═══════════════════════════════════════════════════════════════════════════════

1. IDENTIFY PATIENT
   - Name given → GetMultiplePatients(LName, FName)
   - Phone given → GetMultiplePatients(Phone="10digits")
   - Neither → Ask: "May I have your name or phone number?"

2A. PATIENT NOT FOUND
   - Try phone search if available
   - Still not found → "Are you a new patient?"
   - Collect: DOB, phone number
   - CreatePatient(FName, LName, Birthdate, WirelessPhone)

2B. PATIENT FOUND
   - Say: "Welcome back, [FName]!"
   - GetAppointments to show existing appointments
   - If appointments exist: "I see you have [type] on [date]. Would you like to make changes or book something else?"
   - Ask: "Would you like to make changes, or is there something else I can help with?"

3. GATHER DETAILS
   - Ask for: appointment type (cleaning, checkup, etc.), preferred date, time preference

4. CHECK AVAILABILITY
   - GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum) - ALL 4 PARAMS REQUIRED!
   - If no slots: "Nothing available that day. Let me check [next day]..."

5. PRESENT TIME OPTIONS (MANDATORY - do NOT skip!)
   - Say: "We have [time1], [time2], or [time3] available. Which time works for you?"
   - ⚠️ WAIT for user to choose a specific time!
   - ⚠️ DO NOT just pick a time for them!
   - ⚠️ DO NOT proceed until user says "9", "10am", "the first one", etc.

6. CONFIRM AND BOOK
   - After user selects specific time:
   - Say: "Booking [type] on [day], [date] at [time]. Shall I confirm?"
   - WAIT for explicit "yes"
   - CreateAppointment(PatNum, AptDateTime, ProvNum, Op, Note)
   - Say: "Perfect! Your [type] is confirmed for [date] at [time]."
   - ⚠️ STOP HERE - DO NOT ask follow-up questions or continue the conversation
   - ⚠️ The task is COMPLETE - end your response

═══════════════════════════════════════════════════════════════════════════════
FLOW 3: CANCEL APPOINTMENT
═══════════════════════════════════════════════════════════════════════════════

1. Identify patient (same as above)
2. GetAppointments → Show appointments
3. User selects which to cancel
4. Confirm: "Cancel your [date] at [time] appointment?"
5. UpdateAppointment(AptNum, AptStatus="Cancelled") or BreakAppointment(AptNum)
6. Say: "Done. Your appointment has been cancelled."
7. ⚠️ STOP HERE - DO NOT ask follow-up questions or continue the conversation
8. ⚠️ The task is COMPLETE - end your response

═══════════════════════════════════════════════════════════════════════════════
🛑 STOP! MANDATORY PRE-CALL CHECKLIST (READ BEFORE ANY FUNCTION CALL!)
═══════════════════════════════════════════════════════════════════════════════

⛔ NEVER CALL CreatePatient UNLESS YOU HAVE ALL 4 FROM THE USER:
   □ First name - USER MUST HAVE SAID IT (e.g., "my name is Sam", "I'm John")
   □ Last name - USER MUST HAVE SAID IT (e.g., "Smith", "Lateef")
   □ Birthdate - USER MUST HAVE SAID IT (e.g., "January 5, 1990", "1/5/90")
   □ Phone - USER MUST HAVE SAID IT (e.g., "619-555-1234")
   
   → If ANY is missing: ASK "I'll need your [missing info] to create your profile"
   → Do NOT proceed until user ACTUALLY PROVIDES the info!
   → Do NOT hallucinate or assume - VERIFY user said it!

⛔ NEVER CALL CreateAppointment UNLESS YOU HAVE:
   □ PatNum - from GetMultiplePatients or CreatePatient RESULT (not guessed!)
   □ AptDateTime - exact slot from GetAvailableSlots result
   □ ProvNum - from GetAvailableSlots result
   □ Op - from GetAvailableSlots result
   □ User EXPLICITLY confirmed time selection!
   
   → If ANY is missing: DO NOT call CreateAppointment!

⛔ COMMON MISTAKES TO AVOID:
   - Saying "Thank you!" before user provides requested info
   - Proceeding after garbled/unclear speech - ASK AGAIN
   - Calling CreatePatient with empty {} parameters
   - Assuming name from context instead of user explicitly saying it

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════════

RESCHEDULE - MUST ASK FOR NEW DATE:
⚠️ After user says which appointment to reschedule, you MUST ask:
   "What date would you like to move it to?"
⚠️ DO NOT assume "next week", "tomorrow", or any date!
⚠️ DO NOT proceed to GetAvailableSlots until user provides a date!
⚠️ WAIT for user to specify the new date before checking availability!

PATIENT LOOKUP:
- Never call GetMultiplePatients() without parameters
- Name OR phone required - either works
- If name fails, try phone before creating new patient
- Once you have PatNum, use it for ALL subsequent calls

APPOINTMENTS:
- Only offer times from GetAvailableSlots results - never guess
- Always confirm before CreateAppointment or UpdateAppointment
- For reschedules: ALWAYS show existing appointments BEFORE asking for new date

DATES:
- Use YYYY-MM-DD format for API calls
- Use pre-calculated dates above for "next Monday", etc.
- Avoid Feb 29 in non-leap years (2025, 2026, 2027 are NOT leap years)

CONFIRMATIONS:
- Always get explicit "yes" before booking/updating/canceling
- Never claim "booked" until CreateAppointment succeeds

TIME SLOT SELECTION (CRITICAL - DO NOT SKIP):
⚠️ After calling GetAvailableSlots, you MUST:
1. Present 2-3 specific time options to the user: "We have 9:00 AM, 9:30 AM, or 10:00 AM available"
2. WAIT for user to say which time they want: "10" or "9:30" etc.
3. CONFIRM the specific time: "I'll book 10:00 AM on December 16th. Shall I confirm?"
4. WAIT for "yes" before calling CreateAppointment/UpdateAppointment

⚠️ DO NOT just pick the first available slot without asking!
⚠️ DO NOT book without getting user's specific time selection!

${functionCatalog}

PARAMETER QUICK REFERENCE (MUST pass as JSON objects, not in function name):
- GetMultiplePatients: { LName, FName } OR { Phone: "10digits" }
- CreatePatient: { FName, LName, Birthdate: "YYYY-MM-DD", WirelessPhone: "10digits" }
- GetAppointments: { PatNum, DateStart, DateEnd }
- GetAvailableSlots: { dateStart, dateEnd, ProvNum, OpNum } ← ALL 4 REQUIRED!
- CreateAppointment: { PatNum, AptDateTime: "YYYY-MM-DD HH:mm:ss", ProvNum, Op, Note }
- UpdateAppointment: { AptNum, AptDateTime, ProvNum, Op }

⚠️ WRONG: GetAvailableSlots(dateStart='2025-12-08', ...)
✓ RIGHT: function=GetAvailableSlots, parameters={dateStart:'2025-12-08', dateEnd:'2025-12-08', ProvNum:1, OpNum:1}

BIRTHDATE CONVERSION (CRITICAL):
- Convert spoken dates to YYYY-MM-DD format
- "12 August 1988" → "1988-08-12"
- "January 15, 1990" → "1990-01-15"  
- "August 12th, 1988" → "1988-08-12"
- NEVER use "0000-00-00" - always parse the actual date!
- If unclear, ask user to confirm: "Just to confirm, your date of birth is August 12, 1988?"

⚠️ STOP! BEFORE CALLING ANY FUNCTION - CHECK THIS:
════════════════════════════════════════════════════
DO NOT call a function until you have ALL required parameters!
If you're missing ANY parameter, ASK THE USER - don't call with empty {}!

CreatePatient - Do you have ALL of these?
□ FName (first name) - from conversation
□ LName (last name) - from conversation  
□ Birthdate - converted to YYYY-MM-DD
□ WirelessPhone - 10 digits
→ If ANY is missing: ASK USER, don't call!

GetAvailableSlots - Do you have ALL of these?
□ dateStart - YYYY-MM-DD format
□ dateEnd - YYYY-MM-DD format
□ ProvNum - provider ID (default: 1)
□ OpNum - operatory ID (default: 1)
→ If ANY is missing: DON'T CALL! Use defaults 1 for ProvNum/OpNum

CreateAppointment - Do you have ALL of these?
□ PatNum - from GetMultiplePatients or CreatePatient result
□ AptDateTime - YYYY-MM-DD HH:mm:ss format
□ ProvNum - from GetAvailableSlots result
□ Op - from GetAvailableSlots result
□ Note - appointment type
→ If ANY is missing: DON'T CALL!

NEVER call a function with empty parameters {}!
════════════════════════════════════════════════════

VALIDATIONS

Before Booking:
- Verify PatNum exists from GetMultiplePatients or CreatePatient
- Verify slot free with GetAvailableSlots
- Validate date format: YYYY-MM-DD HH:mm:ss
- Dates must be today or future, never past

After User Confirms Time:
- MUST call CreateAppointment immediately after confirmation
- Extract PatNum from conversation history
- Extract slot data (DateTimeStart, ProvNum, OpNum) from GetAvailableSlots result
- Match user's time selection to exact slot:
  * "first", "earlier", "morning" → first slot in array
  * "second", "later", "afternoon" → second slot in array
  * Specific time "2:30", "9am" → match to slot with that time
- Use EXACT values from selected slot
- Don't end conversation without calling CreateAppointment if user confirmed
- Don't assume booked - explicit CreateAppointment call required

Before Reschedule:
- Verify appointment exists with GetAppointments
- Calculate new date relative to TODAY
- New date must differ from current appointment date
- Verify new slot free with GetAvailableSlots

Before Cancel:
- Verify appointment exists, status is "Scheduled"
- Only "Scheduled" appointments can be broken/cancelled

PERFORMANCE OPTIMIZATION

Use Pre-Fetched Data:
- If office context has occupiedSlots: Don't re-call functions
- Use for conflict detection
- Saves API calls, reduces latency

Minimize Function Calls:
- GetMultiplePatients: 1 per patient search
- GetAvailableSlots: 1 per date (don't search entire weeks)
- CreateAppointment: 1 after all validation complete

RESPONSE FORMAT

Natural conversational tone for voice:
- Concise and clear
- Include specific details: names, dates, times, provider names
- ALWAYS include provider name in booking/reschedule confirmations
- No bullet points or lists in spoken responses
- Don't mention technical details or API function names
- Be helpful, accurate, persistent, speak naturally

CRITICAL TRUTHFULNESS RULE

NEVER claim appointment created unless CreateAppointment was actually called and succeeded:
- NEVER say "I've booked" without calling CreateAppointment function
- NEVER say "Your appointment is confirmed" before CreateAppointment succeeds
- If you only presented slots (GetAvailableSlots), appointment is NOT booked yet
- ONLY way to book: call CreateAppointment function and receive success with AptNum
- "I'll book that for you" is fine BEFORE calling function
- "I've booked your appointment" ONLY allowed AFTER CreateAppointment succeeds
- Before claiming appointment is booked, verify CreateAppointment is in your function call history

CONVERSATION COMPLETION RULE (CRITICAL!)

AFTER SUCCESSFUL OPERATION (CreateAppointment, UpdateAppointment, BreakAppointment):
- ✅ Say final confirmation: "Done! Your appointment is now [date] at [time]."
- ✅ STOP - Do NOT ask "Is there anything else?"
- ✅ STOP - Do NOT ask "Would you like to make changes?"
- ✅ STOP - Do NOT continue the conversation
- ✅ The user will start a new conversation if they need something else
- ❌ NEVER say "Let me finalize..." repeatedly
- ❌ NEVER loop after successful completion

EDGE CASE HANDLING

Vague Dates:
- User: "Next week sometime"
- Don't search entire week
- Ask: "What specific day next week works best?"
- Then search only that day

Time Selection Ambiguity:
- Present: "I have 9 AM or 2:30 PM"
- User: "2:30"
- Don't immediately book
- Confirm first: "Just to confirm, booking 2:30 PM on <date>. Shall I book?"
- Then call CreateAppointment after "yes"

Incomplete Phone:
- User provides 7 digits only
- CreatePatient fails with phone error
- Say: "I need complete 10-digit number including area code"
- Get complete number, retry CreatePatient

Wrong Time Request:
- Presented: "9 AM or 2:30 PM available"
- User: "Can I do 10 AM?"
- Don't default to 9 AM
- Say: "I don't have 10 AM. Would 9 AM or 2:30 PM work?"

Multiple Empty Slots:
- After 3 attempts with no availability
- Say: "I'm having trouble finding openings this week. Would you like next week, or shall I have someone call you?"
- Don't retry indefinitely

Provider Unavailable:
- User wants specific doctor
- GetAvailableSlots returns empty for that doctor
- Offer alternative: "Dr. <name> isn't available that day. Dr. <other> is available at <times>. Would that work?"

Duplicate Patient Error:
- CreatePatient returns "already exists" error
- Say: "You might already be in our system. Let me search with your phone number."
- Retry GetMultiplePatients with phone
- Continue with found PatNum

User Changes Mind:
- Started booking for Friday
- User: "Actually, can we do Monday?"
- Don't continue with Friday
- Reset to new date, start availability check for Monday

═══════════════════════════════════════════════════════════════════════════════
WORKFLOW FLOWCHART REMINDER
═══════════════════════════════════════════════════════════════════════════════

Remember: Every booking follows this sequence:
1. Identify patient (GetMultiplePatients or CreatePatient)
2. Check existing appointments (GetAppointments)
3. Gather appointment details (type, date)
4. Check availability (GetAvailableSlots)
5. Present options to user
6. User selects time
7. CONFIRM with user
8. CREATE/UPDATE appointment (MANDATORY function call)
9. ONLY THEN confirm to user

NEVER skip patient identification.
NEVER skip calling CreateAppointment after user confirms.
NEVER claim appointment is booked without calling CreateAppointment.`;
  
  return instructions;
}

/**
 * Generate static system prompt (workflows, rules, function catalog)
 * This prompt is IDENTICAL across all calls, so OpenAI will auto-cache it
 */
function getStaticSystemPrompt(): { type: string; text: string } {
  const staticInstructions = getStaticInstructions();

  return {
    type: "input_text",
    text: staticInstructions
  };
}

/**
 * Get day of week name from date
 */
function getDayOfWeek(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Calculate the next occurrence of a specific day of week
 */
function getNextDayOfWeek(dayName: string, fromDate: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName.toLowerCase());
  if (targetDay === -1) return '';
  
  const currentDay = fromDate.getDay();
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) daysToAdd += 7; // If same day or past, go to next week
  
  const nextDate = new Date(fromDate);
  // Use milliseconds to avoid Feb 28/29 bugs
  nextDate.setTime(fromDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, '0');
  const day = String(nextDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate orchestrator instructions with dynamic dates and office context
 */
function generateOrchestratorInstructions(officeContext?: EmbeddedBookingOfficeContext): string {
  const now = new Date();
  const todayISO = getTodayDate();
  const tomorrowISO = getTomorrowDate();
  const currentYear = now.getFullYear();
  const todayDayName = getDayOfWeek(now);
  
  // Pre-calculate next occurrences of each day
  const nextDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map(day => `"next ${day}" = ${getNextDayOfWeek(day, now)} (${day})`)
    .join('\n');
  
  const dateInfo = `
TODAY'S DATE INFO (USE THIS FOR ALL DATE CALCULATIONS):
- Today: ${todayISO} (${todayDayName})
- Tomorrow: ${tomorrowISO} (${getDayOfWeek(new Date(now.getTime() + 86400000))})
- Current year: ${currentYear}
- Valid dates: ${todayISO} or later

NEXT [DAY] CALCULATIONS (pre-calculated):
${nextDays}

CRITICAL: When user says "next [day]", use the exact date from above. VERIFY the day name matches!`;
  
  // Safely access office context properties with fallbacks
  const hasValidOfficeContext = officeContext && 
    officeContext.providers && 
    officeContext.operatories && 
    officeContext.defaults;
  
  const contextSection = hasValidOfficeContext ? `
OFFICE CONTEXT

Status: Loaded at ${new Date(officeContext.fetchedAt).toLocaleTimeString()}
Expires: ${new Date(officeContext.expiresAt).toLocaleTimeString()}

Available Providers (${officeContext.providers.filter((p: any) => p.isAvailable).length} active)
${officeContext.providers.filter((p: any) => p.isAvailable).map((p: any) =>
  `- Provider ${p.provNum}: ${p.name} (${p.specialty})`
).join('\n')}
Use these provider names when confirming bookings.

Available Operatories (${officeContext.operatories.filter((o: any) => o.isAvailable).length} active)
${officeContext.operatories.filter((o: any) => o.isAvailable).map((o: any) =>
  `- Op ${o.opNum}: ${o.name} (${o.isHygiene ? 'Hygiene' : 'General'})`
).join('\n')}

Office Hours
${officeContext.officeHours ? Object.entries(officeContext.officeHours).map(([day, hours]) =>
  `- ${day.charAt(0).toUpperCase() + day.slice(1)}: ${(hours as any).closed ? 'CLOSED' : `${(hours as any).open} - ${(hours as any).close}`}`
).join('\n') : 'Not available'}

Default Values
- Default Provider: ${officeContext.defaults.provNum}
- Default Operatory: ${officeContext.defaults.opNum}
- Appointment Length: ${officeContext.defaults.appointmentLength} minutes

Pre-Fetched Occupied Slots (${officeContext.occupiedSlots?.length || 0} appointments)
Pre-fetched for next 7 days. This data might be stale if appointments were booked during the conversation.
- Always call GetAppointments(DateStart, DateEnd) for real-time availability
- Use pre-fetched occupiedSlots as a quick hint only, not the source of truth

Rules:
1. Always use provider name from above for confirmations
2. Always use defaults (ProvNum: ${officeContext.defaults.provNum}, Op: ${officeContext.defaults.opNum}) when not specified
3. Never call GetProviders() - Provider list is already above
4. Never call GetOperatories() - Operatory list is already above
5. Use pre-fetched occupiedSlots for quick reference, but always call GetAppointments for real-time data
` : `
OFFICE CONTEXT NOT AVAILABLE

Status: Not loaded (Lexi didn't call get_office_context)
Impact: Will need extra API calls for providers, operatories, availability
Performance: Slower responses, more API overhead
`;

  return (dateInfo + '\n\n' + contextSection.trim()).trim();
}

// META-TOOL APPROACH: Single tool that can call ANY booking function
export const orchestratorTools = [
  {
    type: 'function',
    name: 'callBookingAPI',
    description: 'Call any embedded booking API function. The function catalog is provided in the instructions. Choose the best function for the task and provide its exact name and parameters.',
    parameters: {
      type: 'object',
      properties: {
        functionName: {
          type: 'string',
          description: 'The exact function name from the catalog (e.g., "GetMultiplePatients", "CreateAppointment")'
        },
        parameters: {
          type: 'object',
          description: 'Function parameters as a key-value object',
          additionalProperties: true
        }
      },
      required: ['functionName', 'parameters'],
      additionalProperties: false
    }
  }
];

/**
 * Make API call to embedded booking worker route
 * 
 * @param functionName - The booking function to call
 * @param parameters - Function parameters
 * @param sessionId - Optional session ID for conversation state tracking
 * @param conversationHistory - Optional conversation history for LLM extraction fallback
 */
async function callBookingAPI(
  functionName: string,
  parameters: Record<string, any>,
  sessionId?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<any> {
  try {
    const requestBody: any = {
      functionName,
      parameters,
    };
    
    // Include sessionId for conversation state auto-fill
    if (sessionId) {
      requestBody.sessionId = sessionId;
    }
    
    // Include conversation history for LLM extraction fallback
    if (conversationHistory && conversationHistory.length > 0) {
      requestBody.conversationHistory = conversationHistory;
    }
    
    // Use absolute URL when running server-side (relative URLs don't work in Node.js fetch)
    const baseUrl = typeof window !== 'undefined' 
      ? '' 
      : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
    
    const response = await fetch(`${baseUrl}/api/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();
    
    // Check if response contains an error (even if status is 200)
    if (!response.ok || responseData.error === true) {
      const errorMessage = responseData.message || responseData.error || 'API call failed';
      const error = new Error(errorMessage) as any;
      // Attach validation info if present
      if (responseData.validationError) {
        error.validationError = true;
        error.hint = responseData.hint;
        error.example = responseData.example;
        error.llmExtractionAttempted = responseData.llmExtractionAttempted;
      }
      throw error;
    }

    return responseData;
  } catch (error: any) {
    throw new Error(`Booking API call failed: ${error.message}`);
  }
}

/**
 * Fetch response from OpenAI Responses API
 */
async function fetchResponsesMessage(body: any) {
  // Use absolute URL when running server-side (relative URLs don't work in Node.js fetch)
  const baseUrl = typeof window !== 'undefined' 
    ? '' 
    : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
  
  const response = await fetch(`${baseUrl}/api/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[fetchResponsesMessage] Error:', response.status, errorData);
    
    const error = new Error(errorData.details || errorData.error || `Responses API error: ${response.statusText}`);
    throw error;
  }

  return await response.json();
}

/**
 * REACT-STYLE PRE-VALIDATION
 * Checks if we have all required parameters BEFORE making API call
 * Returns what we have and what's missing
 */
interface PreValidationResult {
  valid: boolean;
  have: Record<string, any>;
  missing: string[];
  errorMessage: string;
}

function preValidateFunctionCall(
  functionName: string,
  parameters: Record<string, any> | undefined,
  inputHistory: any[]
): PreValidationResult {
  const params = parameters || {};
  const have: Record<string, any> = {};
  const missing: string[] = [];
  
  // Extract what we might have from previous API results
  let patientFromHistory: any = null;
  let slotsFromHistory: any[] = [];
  
  for (const item of inputHistory) {
    if (item.type === 'function_call_output' && item.output) {
      try {
        const parsed = JSON.parse(item.output || '{}');
        const data = parsed.data || parsed.success?.data;
        
        // Check for patient data
        if (Array.isArray(data) && data.length > 0 && data[0]?.PatNum) {
          patientFromHistory = data[0];
        } else if (data?.PatNum) {
          patientFromHistory = data;
        }
        
        // Check for slots data
        if (Array.isArray(data) && data.length > 0 && data[0]?.DateTimeStart) {
          slotsFromHistory = data;
        }
      } catch {
        // Continue
      }
    }
  }
  
  // Validate based on function type
  switch (functionName) {
    case 'CreatePatient': {
      // Required: FName, LName, Birthdate, WirelessPhone
      if (params.FName) have.FName = params.FName; else missing.push('first name');
      if (params.LName) have.LName = params.LName; else missing.push('last name');
      if (params.Birthdate) have.Birthdate = params.Birthdate; else missing.push('date of birth');
      if (params.WirelessPhone) have.WirelessPhone = params.WirelessPhone; else missing.push('phone number');
      
      if (missing.length > 0) {
        return {
          valid: false,
          have,
          missing,
          errorMessage: `STOP! I need to ask the user for their ${missing.join(', ')}. I cannot create a patient profile without this information.`
        };
      }
      break;
    }
    
    case 'CreateAppointment': {
      // Required: PatNum, AptDateTime, ProvNum, Op
      const effectivePatNum = params.PatNum || patientFromHistory?.PatNum;
      
      if (effectivePatNum) have.PatNum = effectivePatNum; else missing.push('PatNum (no patient found - need to search or create patient first)');
      if (params.AptDateTime) have.AptDateTime = params.AptDateTime; else missing.push('AptDateTime (user needs to select a time slot)');
      if (params.ProvNum || slotsFromHistory[0]?.ProvNum) have.ProvNum = params.ProvNum || slotsFromHistory[0]?.ProvNum; else missing.push('ProvNum');
      if (params.Op || slotsFromHistory[0]?.OpNum) have.Op = params.Op || slotsFromHistory[0]?.OpNum; else missing.push('Op');
      
      if (missing.length > 0) {
        return {
          valid: false,
          have,
          missing,
          errorMessage: missing.includes('PatNum') 
            ? 'STOP! I need to find or create the patient first before booking an appointment.'
            : 'STOP! I need to get the user\'s time slot selection before booking. Ask them which time they prefer.'
        };
      }
      break;
    }
    
    case 'GetMultiplePatients': {
      // Need at least one of: LName+FName, Phone
      const hasName = params.LName || params.FName;
      const hasPhone = params.Phone;
      
      if (params.LName) have.LName = params.LName;
      if (params.FName) have.FName = params.FName;
      if (params.Phone) have.Phone = params.Phone;
      
      if (!hasName && !hasPhone) {
        return {
          valid: false,
          have,
          missing: ['name or phone number'],
          errorMessage: 'STOP! I need to ask the user for their name or phone number to look them up.'
        };
      }
      break;
    }
    
    case 'GetAvailableSlots': {
      // Required: dateStart, dateEnd, ProvNum, OpNum
      if (params.dateStart) have.dateStart = params.dateStart; else missing.push('dateStart');
      if (params.dateEnd) have.dateEnd = params.dateEnd; else missing.push('dateEnd');
      // ProvNum and OpNum have defaults, so less critical
      have.ProvNum = params.ProvNum || 1;
      have.OpNum = params.OpNum || 1;
      
      if (missing.length > 0) {
        return {
          valid: false,
          have,
          missing,
          errorMessage: 'STOP! I need to know which date to check for available slots. Ask the user for their preferred date.'
        };
      }
      break;
    }
    
    case 'UpdateAppointment': {
      // Required: AptNum
      if (params.AptNum) have.AptNum = params.AptNum; else missing.push('AptNum (need to find the appointment first)');
      
      if (missing.length > 0) {
        return {
          valid: false,
          have,
          missing,
          errorMessage: 'STOP! I need to find the patient\'s existing appointment first before I can update it.'
        };
      }
      break;
    }
  }
  
  return { valid: true, have, missing: [], errorMessage: '' };
}

/**
 * Iteratively handles function calls returned by the Responses API until
 * we get a final textual answer. Returns that answer as a string.
 * 
 * @param body - Request body for Responses API
 * @param response - Current response
 * @param sessionId - Session ID for conversation state
 * @param conversationHistory - Conversation history for LLM extraction fallback
 */
async function handleResponseIterations(
  body: any,
  response: any,
  sessionId?: string,
  conversationHistory?: any[]
): Promise<string> {
  let currentResponse = response;
  let iterations = 0;
  const maxIterations = 12;

  while (iterations < maxIterations) {
    iterations++;

    if (currentResponse?.error) {
      console.error('[Orchestrator] Response has error:', currentResponse.error);
      return 'I encountered an error processing your request.';
    }
    
    if (!currentResponse || !currentResponse.output) {
      console.error('[Orchestrator] Invalid response structure:', currentResponse);
      return 'I received an invalid response from the system.';
    }

    const outputItems: any[] = currentResponse.output ?? [];
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      // No more function calls – build and return the assistant's final message
      const assistantMessages = outputItems.filter((item) => item.type === 'message');

      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('');
        })
        .join('\n');

      // CRITICAL VALIDATION: Check if agent presented slots but never called CreateAppointment
      const hasGetAvailableSlots = body.input.some((item: any) => {
        if (item.type === 'function_call') {
          try {
            const args = JSON.parse(item.arguments || '{}');
            return args.functionName === 'GetAvailableSlots';
          } catch {
            return false;
          }
        }
        return false;
      });

      const hasCreateAppointment = body.input.some((item: any) => {
        if (item.type === 'function_call') {
          try {
            const args = JSON.parse(item.arguments || '{}');
            return args.functionName === 'CreateAppointment';
          } catch {
            return false;
          }
        }
        return false;
      });

      // Check if UpdateAppointment was already called (reschedule scenario)
      const hasUpdateAppointment = body.input.some((item: any) => {
        if (item.type === 'function_call') {
          try {
            const args = JSON.parse(item.arguments || '{}');
            return args.functionName === 'UpdateAppointment';
          } catch {
            return false;
          }
        }
        return false;
      });

      // Check if user confirmed a slot (common confirmation phrases)
      const userMessages = body.input.filter((item: any) => 
        item.type === 'message' && item.role === 'user'
      );
      const lastUserMessage = userMessages[userMessages.length - 1];
      const userConfirmed = lastUserMessage && /(yes|yeah|sounds good|that works|book it|confirm|go ahead|perfect|okay|ok)/i.test(
        typeof lastUserMessage.content === 'string' 
          ? lastUserMessage.content 
          : JSON.stringify(lastUserMessage.content)
      );

      // CRITICAL VALIDATION: Check if agent claimed booking/rescheduling but never called the API
      const claimsBooking = /(i've booked|your appointment is|appointment is confirmed|booking is complete|appointment confirmed)/i.test(finalText);
      const claimsRescheduled = /(rescheduled|moved|changed|updated).*(appointment|to)/i.test(finalText);
      
      // Check if this is a RESCHEDULE scenario (GetAppointments was called with results)
      const hasExistingAppointment = body.input.some((item: any) => {
        if (item.type === 'function_call_output' && item.output) {
          try {
            const parsed = typeof item.output === 'string' ? JSON.parse(item.output) : item.output;
            const data = parsed.data || parsed.success?.data;
            // Check if this is GetAppointments result with AptNum
            if (Array.isArray(data) && data.length > 0 && data[0]?.AptNum && data[0]?.AptDateTime) {
              return true;
            }
          } catch {}
        }
        return false;
      });
      
      // If slots were presented, user confirmed, but CreateAppointment wasn't called, force it
      // IMPORTANT: Skip this if UpdateAppointment was already called (reschedule scenario)
      if (hasUpdateAppointment) {
        console.log('[Orchestrator] ✅ UpdateAppointment was already called (reschedule) - skipping auto-booking');
      }
      
      // NEW: Auto-RESCHEDULE if agent claimed reschedule but didn't call UpdateAppointment
      if (hasGetAvailableSlots && hasExistingAppointment && !hasUpdateAppointment && (userConfirmed || claimsRescheduled) && finalText) {
        console.warn('[Orchestrator] ⚠️ RESCHEDULE VALIDATION: Slots presented, existing appointment found, user confirmed, but UpdateAppointment not called!');
        
        // Get existing appointment AptNum
        let existingAptNum: number | null = null;
        let slots: any[] = [];
        
        for (const item of body.input) {
          if (item.type === 'function_call_output' && item.output) {
            try {
              const parsed = typeof item.output === 'string' ? JSON.parse(item.output) : item.output;
              const data = parsed.data || parsed.success?.data;
              
              if (Array.isArray(data) && data.length > 0) {
                if (data[0].AptNum && data[0].AptDateTime && !data[0].DateTimeStart) {
                  // This is GetAppointments result
                  const scheduled = data.find((a: any) => a.AptStatus === 'Scheduled' || a.AptStatus === 'scheduled');
                  existingAptNum = scheduled?.AptNum || data[0].AptNum;
                } else if (data[0].DateTimeStart) {
                  // This is GetAvailableSlots result
                  slots = data;
                }
              }
            } catch {}
          }
        }
        
        // Also check conversation state for stored AptNum
        if (!existingAptNum && sessionId) {
          const { getOrCreateState } = await import('@/app/lib/conversationState');
          const state = getOrCreateState(sessionId);
          existingAptNum = state.appointment.existingAptNum || null;
          console.log('[Orchestrator] Got AptNum from conversation state:', existingAptNum);
        }
        
        if (existingAptNum && slots.length > 0) {
          // Try to match user's time selection
          const userContent = typeof lastUserMessage.content === 'string' 
            ? lastUserMessage.content.toLowerCase()
            : JSON.stringify(lastUserMessage.content).toLowerCase();
          
          let selectedSlot = null;
          
          // Time matching logic (same as for new bookings)
          let timeMatch = userContent.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
          if (!timeMatch) {
            timeMatch = userContent.match(/\b(\d{1,2}):(\d{2})\b/) || userContent.match(/\bat\s+(\d{1,2})\b/i);
          }
          if (timeMatch) {
            let hour = parseInt(timeMatch[1], 10);
            const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const ampm = timeMatch[3]?.toLowerCase();
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            
            selectedSlot = slots.find((slot: any) => {
              const slotTime = new Date(slot.DateTimeStart);
              return slotTime.getHours() === hour && slotTime.getMinutes() === minute;
            }) || slots.find((slot: any) => {
              const slotTime = new Date(slot.DateTimeStart);
              return slotTime.getHours() === hour;
            });
          }
          
          // Check agent's message for the time they mentioned
          if (!selectedSlot) {
            const agentTimeMatch = finalText.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
            if (agentTimeMatch) {
              let hour = parseInt(agentTimeMatch[1], 10);
              const minute = parseInt(agentTimeMatch[2], 10);
              const ampm = agentTimeMatch[3].toLowerCase();
              if (ampm === 'pm' && hour < 12) hour += 12;
              if (ampm === 'am' && hour === 12) hour = 0;
              
              selectedSlot = slots.find((slot: any) => {
                const slotTime = new Date(slot.DateTimeStart);
                return slotTime.getHours() === hour && slotTime.getMinutes() === minute;
              });
            }
          }
          
          if (selectedSlot) {
            try {
              console.log('[Orchestrator] 🔧 Auto-RESCHEDULING appointment:', {
                AptNum: existingAptNum,
                NewDateTime: selectedSlot.DateTimeStart,
                ProvNum: selectedSlot.ProvNum,
                Op: selectedSlot.OpNum
              });
              
              const updateResult = await callBookingAPI('UpdateAppointment', {
                AptNum: existingAptNum,
                AptDateTime: selectedSlot.DateTimeStart,
                ProvNum: selectedSlot.ProvNum,
                Op: selectedSlot.OpNum
              }, sessionId);
              
              console.log('[Orchestrator] ✅ Auto-RESCHEDULED successfully:', updateResult);
              return finalText; // Return the agent's confirmation message
            } catch (error: any) {
              console.error('[Orchestrator] ❌ Auto-RESCHEDULE failed:', error.message);
              return `I apologize, but there was an issue updating your appointment: ${error.message}. Would you like me to try again?`;
            }
          } else {
            console.warn('[Orchestrator] ⚠️ Could not match time for reschedule. Available slots:', slots.map((s: any) => s.DateTimeStart));
          }
        } else {
          console.warn('[Orchestrator] ⚠️ Missing data for auto-reschedule:', { existingAptNum, slotsCount: slots.length });
        }
      }
      
      if (hasGetAvailableSlots && !hasCreateAppointment && !hasUpdateAppointment && !hasExistingAppointment && (userConfirmed || claimsBooking) && finalText) {
        console.warn('[Orchestrator] ⚠️ VALIDATION: Slots presented and user confirmed/agent claimed booking, but CreateAppointment not called. Attempting to extract slot data...');
        
        // Try to find GetAvailableSlots result
        let slots: any[] = [];
        let patientData: any = null;
        
        // Search through all function outputs for slot data and patient data
        for (const item of body.input) {
          if (item.type === 'function_call_output' && item.output) {
            try {
              const parsed = typeof item.output === 'string' ? JSON.parse(item.output) : item.output;
              const data = parsed.data || parsed.success?.data;
              
              if (Array.isArray(data) && data.length > 0) {
                // Check if this is slot data (has DateTimeStart)
                if (data[0].DateTimeStart) {
                  slots = data;
                } 
                // Check if this is patient data (has PatNum)
                else if (data[0].PatNum && !patientData) {
                  patientData = data[0];
                }
              }
            } catch {
              // Continue searching
            }
          }
        }

        // If we have slots and patient, try to match the user's selected time
        if (slots.length > 0 && patientData?.PatNum) {
          // Try to extract user's time selection from their message
          const userContent = typeof lastUserMessage.content === 'string' 
            ? lastUserMessage.content.toLowerCase()
            : JSON.stringify(lastUserMessage.content).toLowerCase();
          
          let selectedSlot = null;
          
          // Try to match user's time selection
          // IMPORTANT: First try to match time with am/pm (more specific), then fallback to bare numbers
          let timeMatch = userContent.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i); // Require am/pm first
          if (!timeMatch) {
            // Fallback: match bare time format like "2:30" or single digit at word boundary
            timeMatch = userContent.match(/\b(\d{1,2}):(\d{2})\b/) || // "2:30" format
                        userContent.match(/\bat\s+(\d{1,2})\b/i);     // "at 2" format
          }
          if (timeMatch) {
            let hour = parseInt(timeMatch[1], 10);
            const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const ampm = timeMatch[3]?.toLowerCase();
            
            // Convert to 24-hour format
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            
            // Find matching slot
            selectedSlot = slots.find((slot: any) => {
              const slotTime = new Date(slot.DateTimeStart);
              return slotTime.getHours() === hour && slotTime.getMinutes() === minute;
            });
            
            if (!selectedSlot) {
              // Try matching just the hour
              selectedSlot = slots.find((slot: any) => {
                const slotTime = new Date(slot.DateTimeStart);
                return slotTime.getHours() === hour;
              });
            }
          }
          
          // If no time match, check for ordinal selection (first, second, etc.)
          if (!selectedSlot) {
            if (/(first|earlier|1st|first one)/i.test(userContent)) {
              selectedSlot = slots[0];
            } else if (/(second|later|2nd|second one)/i.test(userContent)) {
              selectedSlot = slots[1] || slots[0];
            }
          }
          
          // CRITICAL: Do NOT auto-book if we can't match the user's selection
          if (!selectedSlot) {
            console.warn('[Orchestrator] ⚠️ Could not match user time selection to available slots. User said:', userContent);
            console.warn('[Orchestrator] Available slots:', slots.map((s: any) => s.DateTimeStart));
            // Remove false booking claims and ask for clarification
            const cleanedText = finalText.replace(/(i've booked|your appointment is confirmed|appointment confirmed|booking is complete)/gi, 'I need to confirm your appointment');
            return `${cleanedText} I want to make sure I book the correct time. Could you please confirm which time slot you'd like - ${slots.map((s: any) => {
              const t = new Date(s.DateTimeStart);
              return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }).join(' or ')}?`;
          }
          
          try {
            console.log('[Orchestrator] 🔧 Auto-booking appointment with matched slot:', {
              PatNum: patientData.PatNum,
              AptDateTime: selectedSlot.DateTimeStart,
              Op: selectedSlot.OpNum,
              ProvNum: selectedSlot.ProvNum,
              userSelection: userContent
            });
            
            // Format conversation history for LLM extraction fallback
            const formattedHistoryForAutoBook: Array<{ role: string; content: string }> = [];
            if (conversationHistory) {
              for (const item of conversationHistory) {
                if (item.type === 'message' && item.role) {
                  let content = '';
                  if (typeof item.content === 'string') {
                    content = item.content;
                  } else if (Array.isArray(item.content)) {
                    content = item.content
                      .map((c: any) => c.text || c.transcript || c.content || (typeof c === 'string' ? c : ''))
                      .filter(Boolean)
                      .join(' ');
                  }
                  if (content.trim()) {
                    formattedHistoryForAutoBook.push({ role: item.role, content: content.trim() });
                  }
                }
              }
            }
            
            const bookingResult = await callBookingAPI('CreateAppointment', {
              PatNum: patientData.PatNum,
              AptDateTime: selectedSlot.DateTimeStart,
              Op: selectedSlot.OpNum,
              ProvNum: selectedSlot.ProvNum,
              Note: 'Automated booking after slot confirmation'
            }, sessionId, formattedHistoryForAutoBook);
            
            console.log('[Orchestrator] ✅ Auto-booked appointment after validation:', bookingResult);
            
            // If agent already claimed it was booked, just confirm
            if (claimsBooking) {
              return finalText; // Keep the original message
            } else {
              const slotTime = new Date(selectedSlot.DateTimeStart);
              return `${finalText} I've now confirmed your appointment for ${slotTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${slotTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}. Your booking is complete!`;
            }
          } catch (error: any) {
            console.error('[Orchestrator] ❌ Auto-booking failed:', error.message);
            // Remove false claims from response
            const cleanedText = finalText.replace(/(i've booked|your appointment is confirmed|appointment confirmed)/gi, 'I attempted to book');
            return `${cleanedText} However, I encountered an error: ${error.message}. Please let me try again or contact support.`;
          }
        } else {
          console.warn('[Orchestrator] ⚠️ Could not extract slot or patient data for auto-booking. Missing:', {
            hasSlots: slots.length > 0,
            hasPatient: !!patientData?.PatNum
          });
        }
      }

      return finalText || 'I was unable to process that request.';
    }

    // For each function call, execute it and append the output
    for (const toolCall of functionCalls) {
      const toolName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');

      // Handle the meta-tool approach
      if (toolName === 'callBookingAPI') {
        const { functionName, parameters } = args;
        
        // ══════════════════════════════════════════════════════════════════
        // REACT-STYLE PRE-VALIDATION: Think before calling!
        // ══════════════════════════════════════════════════════════════════
        const preValidation = preValidateFunctionCall(functionName, parameters, body.input);
        if (!preValidation.valid) {
          console.log(`\n[Orchestrator] 🤔 REACT PRE-CHECK for ${functionName}:`);
          console.log(`  Have: ${JSON.stringify(preValidation.have)}`);
          console.log(`  Missing: ${preValidation.missing.join(', ')}`);
          console.log(`  Action: ASK USER for missing info\n`);
          
          // Return error immediately without calling API
          body.input.push(
            {
              type: 'function_call',
              call_id: toolCall.call_id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
            {
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify({
                error: true,
                reactThinking: `I checked what I have: ${JSON.stringify(preValidation.have)}. I'm missing: ${preValidation.missing.join(', ')}`,
                message: preValidation.errorMessage,
                action: 'MUST_ASK_USER',
                missing: preValidation.missing,
                have: preValidation.have,
                doNotCallOtherFunctions: true,
                instruction: `You MUST ask the user for: ${preValidation.missing.join(', ')}. Do NOT call any other functions until the user provides this information.`
              }),
            },
          );
          continue; // Skip to next tool call
        }
        
        // Helpful validation: Try to auto-inject missing parameters from history
        if ((functionName === 'CreateAppointment' || functionName === 'UpdateAppointment')) {
          // Try to find PatNum from GetMultiplePatients or CreatePatient results
          let patientData: any = null;
          for (const item of body.input) {
            if (item.type === 'function_call_output' && item.output) {
              try {
                const parsed = JSON.parse(item.output || '{}');
                const data = parsed.data || parsed.success?.data;
                if (Array.isArray(data) && data.length > 0) {
                  if (data[0].PatNum) {
                    patientData = data[0];
                    break;
                  }
                } else if (data?.PatNum) {
                  patientData = data;
                  break;
                }
              } catch {
                // Continue searching
              }
            }
          }
          
          if (patientData?.PatNum) {
            if (!parameters) {
              args.parameters = { PatNum: patientData.PatNum };
            } else if (!parameters.PatNum) {
              args.parameters = { ...parameters, PatNum: patientData.PatNum };
            }
          }
          
          // Try to find slot data from GetAvailableSlots if CreateAppointment is missing slot info
          if (functionName === 'CreateAppointment' && (!parameters?.AptDateTime || !parameters?.Op || !parameters?.ProvNum)) {
            // Search for GetAvailableSlots results in history
            let slots: any[] = [];
            for (const item of body.input) {
              if (item.type === 'function_call_output' && item.output) {
                try {
                  const parsed = JSON.parse(item.output || '{}');
                  const data = parsed.data || parsed.success?.data;
                  if (Array.isArray(data) && data.length > 0 && data[0]?.DateTimeStart) {
                    slots = data;
                    break;
                  }
                } catch {
                  // Continue searching
                }
              }
            }
            
            if (slots.length > 0) {
              // Try to find the user's selection from recent messages
              let selectedSlot = null;
              const userMessages = body.input.filter((item: any) => 
                item.type === 'message' && item.role === 'user'
              );
              const lastUserMsg = userMessages[userMessages.length - 1];
              if (lastUserMsg) {
                const userContent = typeof lastUserMsg.content === 'string' 
                  ? lastUserMsg.content.toLowerCase()
                  : '';
                
                // Try to match time from user message
                // IMPORTANT: First try to match time with am/pm (more specific), then fallback
                let timeMatch = userContent.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i); // Require am/pm first
                if (!timeMatch) {
                  // Fallback: match bare time format like "2:30" or single digit at word boundary
                  timeMatch = userContent.match(/\b(\d{1,2}):(\d{2})\b/) || // "2:30" format
                              userContent.match(/\bat\s+(\d{1,2})\b/i);     // "at 2" format
                }
                if (timeMatch) {
                  let hour = parseInt(timeMatch[1], 10);
                  const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
                  const ampm = timeMatch[3]?.toLowerCase();
                  
                  if (ampm === 'pm' && hour < 12) hour += 12;
                  if (ampm === 'am' && hour === 12) hour = 0;
                  
                  selectedSlot = slots.find((slot: any) => {
                    const slotTime = new Date(slot.DateTimeStart);
                    return slotTime.getHours() === hour && slotTime.getMinutes() === minute;
                  });
                  
                  if (!selectedSlot) {
                    // Try matching just the hour
                    selectedSlot = slots.find((slot: any) => {
                      const slotTime = new Date(slot.DateTimeStart);
                      return slotTime.getHours() === hour;
                    });
                  }
                }
                
                // Check for ordinal selection
                if (!selectedSlot) {
                  if (/(first|earlier|1st)/i.test(userContent)) {
                    selectedSlot = slots[0];
                  } else if (/(second|later|2nd)/i.test(userContent)) {
                    selectedSlot = slots[1] || slots[0];
                  }
                }
              }
              
              // Only use matched slot, don't default to first
                    if (selectedSlot?.DateTimeStart) {
                      if (!args.parameters) args.parameters = {};
                      if (!args.parameters.AptDateTime && !parameters?.AptDateTime) {
                        args.parameters.AptDateTime = selectedSlot.DateTimeStart;
                      }
                      if (!args.parameters.Op && !parameters?.Op && selectedSlot.OpNum) {
                        args.parameters.Op = selectedSlot.OpNum;
                      }
                      if (!args.parameters.ProvNum && !parameters?.ProvNum && selectedSlot.ProvNum) {
                        args.parameters.ProvNum = selectedSlot.ProvNum;
                      }
                console.log('[Orchestrator] 🎯 Matched user time selection to slot:', selectedSlot.DateTimeStart);
              } else {
                console.warn('[Orchestrator] ⚠️ Could not match user selection to slot, not auto-injecting');
              }
            }
          }
        }
        
        const finalParameters = args.parameters || parameters;

        // Convert conversation history for LLM extraction fallback
        const formattedHistory: Array<{ role: string; content: string }> = [];
        if (conversationHistory) {
          for (const item of conversationHistory) {
            if (item.type === 'message' && item.role) {
              let content = '';
              if (typeof item.content === 'string') {
                content = item.content;
              } else if (Array.isArray(item.content)) {
                // Handle multiple content array formats
                content = item.content
                  .map((c: any) => c.text || c.transcript || c.content || (typeof c === 'string' ? c : ''))
                  .filter(Boolean)
                  .join(' ');
              }
              // Only push if we have actual content
              if (content.trim()) {
                formattedHistory.push({ role: item.role, content: content.trim() });
              }
            }
          }
        }

        try {
          const result = await callBookingAPI(functionName, finalParameters, sessionId, formattedHistory);

          body.input.push(
            {
              type: 'function_call',
              call_id: toolCall.call_id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
            {
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify({
                success: true,
                data: result
              }),
            },
          );
        } catch (error: any) {
          console.error(`\n[Orchestrator] ❌ ${functionName} ERROR:`, error.message);

          // Enhance error message to clearly tell agent what to do
          let errorMessage = error.message || 'Unknown error';
          let nextAction = 'ASK_USER_FOR_MISSING_INFO';
          
          // Check if this is a validation error with missing params
          if (error.validationError || errorMessage.includes('STOP!') || errorMessage.includes('missing required')) {
            // Already has clear instructions from validation layer
            nextAction = 'MUST_ASK_USER_BEFORE_PROCEEDING';
          } else if (functionName === 'CreatePatient' && errorMessage.includes('Phone number')) {
            const digitsMatch = errorMessage.match(/Received (\d+) digit/);
            if (digitsMatch) {
              errorMessage = `STOP! Phone number validation failed: You provided ${digitsMatch[1]} digits, but 10 digits are required. ASK THE USER: "Could you please provide your full 10-digit phone number including area code?"`;
            } else {
              errorMessage = `STOP! Phone number validation failed. ASK THE USER: "Could you please provide your full 10-digit phone number including area code?"`;
            }
          }

          body.input.push(
            {
              type: 'function_call',
              call_id: toolCall.call_id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
            {
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify({
                error: true,
                message: errorMessage,
                action: nextAction,
                doNotCallOtherFunctions: true,
                instruction: 'You MUST speak to the user and ask for the missing information. Do NOT call any other API functions until the user provides the required data.'
              }),
            },
          );
        }
      }
    }

    // Make the follow-up request including the tool outputs
    currentResponse = await fetchResponsesMessage(body);
  }

  console.error(`[Orchestrator] ⚠️ MAXIMUM ITERATIONS REACHED (${maxIterations})`);
  return 'I apologize, but I was unable to complete your request. Please try again.';
}

/**
 * Core orchestrator function (can be called directly or via tool)
 * 
 * @param relevantContextFromLastUserMessage - Context from the user's message
 * @param conversationHistory - Full conversation history
 * @param officeContext - Office context (providers, operatories, etc.)
 * @param sessionId - Session ID for conversation state tracking (enables LLM extraction fallback)
 */
export async function executeOrchestrator(
  relevantContextFromLastUserMessage: string,
  conversationHistory: any[] = [],
  officeContext?: EmbeddedBookingOfficeContext,
  sessionId?: string
): Promise<string> {
  // Generate sessionId if not provided
  const effectiveSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Use provided office context or try to extract from history
    let finalOfficeContext: EmbeddedBookingOfficeContext | undefined = officeContext;
    
    if (!finalOfficeContext && conversationHistory) {
      // Try multiple search strategies to find office context in history
      for (const item of conversationHistory) {
        if (item.type === 'function_call' && 
            item.name === 'get_office_context' && 
            item.output) {
          try {
            const parsed = typeof item.output === 'string' 
              ? JSON.parse(item.output) 
              : item.output;
            finalOfficeContext = parsed;
            break;
          } catch {
            // Silent fail, try next strategy
          }
        }
        
        if (item.type === 'function_call_output' && 
            item.name === 'get_office_context' && 
            item.output) {
          try {
            const parsed = typeof item.output === 'string' 
              ? JSON.parse(item.output) 
              : item.output;
            finalOfficeContext = parsed;
            break;
          } catch {
            // Silent fail
          }
        }
      }
    }
    
    const userMessage = relevantContextFromLastUserMessage || 'Help needed';
    
    // Extract messages AND function_call/function_call_output pairs from conversation history
    const extractedHistory: any[] = [];
    const pendingFunctionCalls = new Map<string, any>();
    
    for (let i = 0; i < conversationHistory.length; i++) {
      const item = conversationHistory[i];
      
      if (item.type === 'message' && item.role) {
        let textContent = '';
        if (typeof item.content === 'string') {
          textContent = item.content;
        } else if (Array.isArray(item.content)) {
          // Handle various content array formats from realtime API
          textContent = item.content
            .map((c: any) => {
              // Try multiple ways to extract text
              if (typeof c === 'string') return c;
              return c.text || c.transcript || c.content || '';
            })
            .filter(Boolean)
            .join(' ');
        }
        
        if (textContent.trim()) {
          extractedHistory.push({
            type: 'message',
            role: item.role,
            content: textContent.trim()
          });
        }
      } else if (item.type === 'function_call') {
        pendingFunctionCalls.set(item.call_id, item);
      } else if (item.type === 'function_call_output') {
        const matchingCall = pendingFunctionCalls.get(item.call_id);
        if (matchingCall) {
          extractedHistory.push(
            {
              type: 'function_call',
              call_id: matchingCall.call_id,
              name: matchingCall.name,
              arguments: matchingCall.arguments,
            },
            {
              type: 'function_call_output',
              call_id: item.call_id,
              output: item.output,
            }
          );
          pendingFunctionCalls.delete(item.call_id);
        }
      }
    }
  
  const staticSystemPrompt = getStaticSystemPrompt();
  const dynamicInstructions = generateOrchestratorInstructions(finalOfficeContext);
  
  const body: any = {
    model: 'gpt-4o',
    instructions: staticSystemPrompt.text,
    tools: orchestratorTools,
    input: [
      {
        type: 'message',
        role: 'system',
        content: dynamicInstructions || ''
      },
      ...extractedHistory,
      {
        type: 'message',
        role: 'user',
        content: userMessage
      }
    ]
  };

  const response = await fetchResponsesMessage(body);
  const finalResponse = await handleResponseIterations(body, response, effectiveSessionId, conversationHistory);
  
  return finalResponse;

  } catch (error: any) {
    console.error('[executeOrchestrator] Error:', error);
    
    return `I encountered an error while processing your request: ${error.message}`;
  }
}

/**
 * Orchestrator agent tool (for Realtime SDK)
 * Uses LLM-based orchestrator with hardcoded instructions and function calling
 */
export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description: 'Handles patient operations by calling embedded booking API functions. Use this for finding patients, booking appointments, canceling, checking schedules, etc.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description: 'The relevant information from the last user message that requires API interaction'
      }
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false
  },
  execute: async (input, _details) => {
    const { relevantContextFromLastUserMessage } = input as {
      relevantContextFromLastUserMessage: string;
    };
    
    const details = _details as any;
    const history = details?.context?.history || [];
    
    // Log conversation history for debugging
    console.log('\n[Orchestrator] 📜 CONVERSATION HISTORY RECEIVED:');
    const userMessages = history.filter((h: any) => h.role === 'user' || (h.type === 'message' && h.role === 'user'));
    userMessages.forEach((msg: any, idx: number) => {
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : (Array.isArray(msg.content) ? msg.content.map((c: any) => c.text || c.transcript || '').join(' ') : '');
      console.log(`  [${idx}] User: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
    });
    console.log(`  Total items in history: ${history.length}\n`);
    
    // Extract and normalize conversation history
    const normalizedHistory = history
      .filter((h: any) => h.type === 'message' || h.role)
      .map((h: any) => {
        const role = h.role || 'user';
        let content = '';
        if (typeof h.content === 'string') {
          content = h.content;
        } else if (Array.isArray(h.content)) {
          content = h.content.map((c: any) => c.text || c.transcript || '').join(' ');
        } else if (h.text) {
          content = h.text;
        } else if (h.transcript) {
          content = h.transcript;
        }
        return { role, content };
      })
      .filter((h: { role: string; content: string }) => h.content.trim());
    
    // Generate a STABLE session ID based on conversation content
    // This ensures the same conversation always gets the same session ID
    // Using first user message hash + rough timestamp (rounded to minute)
    const firstUserMsg = normalizedHistory.find((h: { role: string }) => h.role === 'user')?.content || '';
    const conversationHash = firstUserMsg.substring(0, 50).replace(/\s+/g, '_').toLowerCase();
    const sessionId = `realtime_${conversationHash}_${Math.floor(Date.now() / 60000)}`; // Stable for ~1 minute
    console.log(`[Orchestrator] Using session ID: ${sessionId}`);
    
    // Extract office context from conversation history
    let officeContext;
    for (const item of history) {
      if (item.type === 'function_call_output' && item.name === 'get_office_context' && item.output) {
        try {
          officeContext = typeof item.output === 'string' ? JSON.parse(item.output) : item.output;
          break;
        } catch {
          // Silent fail, continue
        }
      }
    }
    
    // Call orchestrator directly (no workflow engine)
    console.log('[Orchestrator] 🚀 Calling Orchestrator with LLM + function calling...');
    const response = await executeOrchestrator(
      relevantContextFromLastUserMessage,
      normalizedHistory,
      officeContext,
      sessionId
    );
    
    console.log(`[Orchestrator] ✅ Response: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
    
    return response;
  },
});

