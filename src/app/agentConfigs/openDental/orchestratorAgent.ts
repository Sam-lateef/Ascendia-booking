import { tool } from '@openai/agents/realtime';
import { generateFunctionCatalog } from './apiRegistry';
import unifiedRegistry from '../../../../docs/API/unified_registry.json';
import type { OfficeContext } from '@/app/lib/officeContext';

/**
 * Tier 2: Orchestrator Supervisor Agent
 * 
 * This agent has:
 * - Full knowledge of ALL OpenDental API functions (from api_registry.json)
 * - Business logic and dependencies (from apiDoc.md)
 * - Ability to plan multi-step workflows
 * - Calls API worker (/api/opendental) to execute functions
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
 * Generate static instruction parts (workflows, rules, patterns)
 * These are static (don't change between calls), so OpenAI will auto-cache them
 * OpenAI's Responses API automatically caches identical instructions (50% discount)
 * We don't need manual caching - just build them fresh each time
 */
function getStaticInstructions(): string {
  // Generate function catalog and relationship rules (these are static)
  const functionCatalog = generateFunctionCatalog(true);
  const relationshipRules = (unifiedRegistry as any).natural_language_guide;
  
  // Build static instruction template with consolidated flowchart format
  const instructions = `═══════════════════════════════════════════════════════════════════════════════
OPENDENTAL BOOKING SYSTEM - WORKFLOW GUIDE
═══════════════════════════════════════════════════════════════════════════════

You are a dental office operations supervisor with access to 26 OpenDental API functions.

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
   - Save the AptNum being rescheduled
   - ⚠️ YOU MUST ASK: "What date would you like to move it to?"
   - ⚠️ WAIT for user to tell you the date! DO NOT assume "next week" or any date!
   - ⚠️ DO NOT proceed until user provides a specific date!
   - Once user provides date, ask: "Morning or afternoon?"
   - GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum) - ALL 4 required!

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

3. GATHER DETAILS
   - Ask for: appointment type (cleaning, checkup, etc.), preferred date, time preference

4. CHECK AVAILABILITY
   - GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum) - ALL 4 required!
   - If no slots: "Nothing available that day. Let me check [next day]..."

5. PRESENT TIME OPTIONS (MANDATORY - do NOT skip!)
   - Say: "We have [time1], [time2], or [time3] available. Which time works for you?"
   - ⚠️ WAIT for user to choose a specific time!
   - ⚠️ DO NOT just pick a time for them!
   - ⚠️ DO NOT proceed until user says "9", "10am", "the first one", etc.

6. CONFIRM AND BOOK
   - After user selects specific time:
   - Say: "Booking [type] on [day], [date] at [time] with Dr. [provider]. Shall I confirm?"
   - WAIT for explicit "yes"
   - CreateAppointment(PatNum, AptDateTime, ProvNum, Op, Note, Pattern="/XX/")
   - NEVER send ClinicNum!
   - Say: "Perfect! Your [type] is confirmed for [date] at [time]."

═══════════════════════════════════════════════════════════════════════════════
FLOW 3: CANCEL APPOINTMENT
═══════════════════════════════════════════════════════════════════════════════

1. Identify patient (same as above)
2. GetAppointments → Show appointments
3. User selects which to cancel (only "Scheduled" status can be cancelled)
4. Confirm: "Cancel your [date] at [time] appointment?"
5. >24hrs away: UpdateAppointment(AptNum, AptStatus="UnschedList")
   <24hrs away: BreakAppointment(AptNum, sendToUnscheduledList=true)
6. Say: "Done. Your appointment has been cancelled."

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
- Never call GetMultiplePatients() without parameters (returns ALL patients!)
- Name OR phone required - either works
- If name fails, try phone before creating new patient
- Once you have PatNum, use it for ALL subsequent calls

APPOINTMENTS:
- Only offer times from GetAvailableSlots results - never guess
- Always confirm before CreateAppointment or UpdateAppointment
- For reschedules: ALWAYS show existing appointments BEFORE asking for new date
- Include provider name in all confirmations

DATES:
- Use YYYY-MM-DD format for API calls
- DateTime format: YYYY-MM-DD HH:mm:ss
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

OPENDENTAL SPECIFIC:
- Pattern format: "/XX/" for 20 min, "//XXXX//" for 30 min
- Op parameter (not OpNum) for CreateAppointment
- NEVER send ClinicNum - causes errors
- AptStatus values: Scheduled, Complete, UnschedList, ASAP, Broken, Planned

{catalog}

{relationshipRules}

PARAMETER QUICK REFERENCE (MUST pass as JSON objects, not in function name):
- GetMultiplePatients: { LName, FName } OR { Phone: "10digits" }
- CreatePatient: { FName, LName, Birthdate: "YYYY-MM-DD", WirelessPhone: "10digits" }
- GetAppointments: { PatNum, DateStart, DateEnd }
- GetAvailableSlots: { dateStart, dateEnd, ProvNum, OpNum } ← ALL 4 REQUIRED!
- CreateAppointment: { PatNum, AptDateTime, ProvNum, Op, Note, Pattern } ← NO ClinicNum!
- UpdateAppointment: { AptNum, AptDateTime, ProvNum, Op }
- BreakAppointment: { AptNum, sendToUnscheduledList }

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
□ Pattern - "/XX/" for 20 min
→ If ANY is missing: DON'T CALL!

NEVER call a function with empty parameters {}!
════════════════════════════════════════════════════`;
  
  const finalInstructions = instructions
    .replace(/{catalog}/g, functionCatalog || '')
    .replace(/{relationshipRules}/g, relationshipRules || '');
  
  return finalInstructions;
}

/**
 * Generate static system prompt (workflows, rules, function catalog)
 * This prompt is IDENTICAL across all calls, so OpenAI will auto-cache it (50% discount)
 * IMPORTANT: No dynamic content here - dates and office context go in input array as system message
 * 
 * How OpenAI Caching Works:
 * - OpenAI's Responses API automatically detects when instructions are identical
 * - If instructions match previous call, OpenAI uses cached version (50% cost discount)
 * - We don't need manual caching - just build instructions fresh each time
 * - OpenAI handles all caching automatically
 */
function getStaticSystemPrompt(): { type: string; text: string } {
  // Build static instructions fresh each time (they're static anyway)
  // OpenAI will automatically cache them if they're identical to previous calls
  const staticInstructions = getStaticInstructions();

  return {
    type: "input_text", // Responses API requires "input_text" for content items
    text: staticInstructions
  };
}

/**
 * Generate orchestrator instructions with dynamic dates and office context
 * Returns a string for the instructions field with:
 * - Current date information (changes daily)
 * - Office context (changes per call)
 * This is separate from the static system prompt for auto-caching
 */
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

function generateOrchestratorInstructions(officeContext?: OfficeContext): string {
  // Get current date information (dynamic - changes daily)
  // IMPORTANT: Always generate fresh dates - never cache these!
  const now = new Date();
  const todayISO = getTodayDate();
  const tomorrowISO = getTomorrowDate();
  const currentYear = now.getFullYear();
  const todayDayName = getDayOfWeek(now);
  const safeDateEnd = getSafeDateEnd(now);
  
  // Pre-calculate next occurrences of each day
  const nextDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map(day => `"next ${day}" = ${getNextDayOfWeek(day, now)} (${day})`)
    .join('\n');

  // Build date info with pre-calculated next [day] references
  const dateInfo = `
TODAY'S DATE INFO (USE THIS FOR ALL DATE CALCULATIONS):
- Today: ${todayISO} (${todayDayName})
- Tomorrow: ${tomorrowISO} (${getDayOfWeek(new Date(now.getTime() + 86400000))})
- Safe DateEnd (90 days): ${safeDateEnd}
- Current year: ${currentYear}
- Valid dates: ${todayISO} or later
- ⚠️ NEVER use Feb 29 in years 2025, 2026, 2027 (not leap years) - use Feb 28 instead!

NEXT [DAY] CALCULATIONS (pre-calculated):
${nextDays}

CRITICAL: When user says "next [day]", use the exact date from above. VERIFY the day name matches!`;
  
  // Build office context section (dynamic, changes per call - not cacheable)
  const contextSection = officeContext ? `
OFFICE CONTEXT

Status: Loaded at ${new Date(officeContext.fetchedAt).toLocaleTimeString()}
Expires: ${new Date(officeContext.expiresAt).toLocaleTimeString()}

Available Providers (${officeContext.providers.filter(p => p.isAvailable).length} active)
${officeContext.providers.filter(p => p.isAvailable).map(p =>
  `- Provider ${p.provNum}: ${p.name} (${p.specialty})`
).join('\n')}
Use these provider names when confirming bookings.

Available Operatories (${officeContext.operatories.filter(o => o.isAvailable).length} active)
${officeContext.operatories.filter(o => o.isAvailable).map(o =>
  `- Op ${o.opNum}: ${o.name} (${o.isHygiene ? 'Hygiene' : 'General'})`
).join('\n')}

Office Hours
${Object.entries(officeContext.officeHours).map(([day, hours]) =>
  `- ${day.charAt(0).toUpperCase() + day.slice(1)}: ${(hours as any).closed ? 'CLOSED' : `${(hours as any).open} - ${(hours as any).close}`}`
).join('\n')}

Default Values
- Default Provider: ${officeContext.defaults.provNum}
- Default Operatory: ${officeContext.defaults.opNum}
- Appointment Length: ${officeContext.defaults.appointmentLength} minutes

Pre-Fetched Occupied Slots (${officeContext.occupiedSlots.length} appointments)
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

  // Combine date info and office context
  // Both are dynamic, so they go in the instructions field
  // The static system prompt (workflows, rules, catalog) goes in input array
  return (dateInfo + '\n\n' + contextSection.trim()).trim();
}

// META-TOOL APPROACH: Single tool that can call ANY of the 49 priority functions
// The model reads function catalog in instructions and picks the right one
export const orchestratorTools = [
  {
    type: 'function',
    name: 'callOpenDentalAPI',
    description: 'Call any OpenDental API function. The function catalog is provided in the instructions. Choose the best function for the task and provide its exact name and parameters.',
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

// Log the approach

/**
 * Make API call to OpenDental worker route
 */
async function callOpenDentalAPI(
  functionName: string,
  parameters: Record<string, any>
): Promise<any> {
  try {
    const response = await fetch('/api/opendental', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        functionName,
        parameters,
      }),
    });

    const responseData = await response.json();
    
    // Check if response contains an error (even if status is 200)
    if (!response.ok || responseData.error === true) {
      const errorMessage = responseData.message || responseData.error || 'API call failed';
      const conflictDetails = responseData.conflictDetails;
      const error = new Error(errorMessage) as any;
      error.conflictDetails = conflictDetails;
      error.errorType = responseData.errorType; // Preserve error type (e.g., 'opendental_connection')
      throw error;
    }

    return responseData;
  } catch (error: any) {
    // Preserve error type if it exists
    if (error.errorType) {
      throw error;
    }
    throw new Error(`OpenDental API call failed: ${error.message}`);
  }
}

/**
 * Fetch response from OpenAI Responses API
 */
async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[fetchResponsesMessage] Error:', response.status, errorData);
    
    // Preserve errorType if present
    const error = new Error(errorData.details || errorData.error || `Responses API error: ${response.statusText}`);
    (error as any).errorType = errorData.errorType;
    throw error;
  }

  return await response.json();
}

// REACT-STYLE PRE-VALIDATION
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
  
  let patientFromHistory: any = null;
  for (const item of inputHistory) {
    if (item.type === 'function_call_output' && item.output) {
      try {
        const parsed = JSON.parse(item.output || '{}');
        const data = parsed.data || parsed.success?.data;
        if (Array.isArray(data) && data.length > 0 && data[0]?.PatNum) {
          patientFromHistory = data[0];
        } else if (data?.PatNum) {
          patientFromHistory = data;
        }
      } catch { /* Continue */ }
    }
  }
  
  switch (functionName) {
    case 'CreatePatient':
      if (params.FName) have.FName = params.FName; else missing.push('first name');
      if (params.LName) have.LName = params.LName; else missing.push('last name');
      if (params.Birthdate) have.Birthdate = params.Birthdate; else missing.push('date of birth');
      if (params.WirelessPhone) have.WirelessPhone = params.WirelessPhone; else missing.push('phone number');
      if (missing.length > 0) {
        return { valid: false, have, missing, errorMessage: `STOP! I need to ask the user for their ${missing.join(', ')}.` };
      }
      break;
    case 'CreateAppointment':
      if (params.PatNum || patientFromHistory?.PatNum) have.PatNum = params.PatNum || patientFromHistory?.PatNum; 
      else missing.push('PatNum (need patient first)');
      if (params.AptDateTime) have.AptDateTime = params.AptDateTime; else missing.push('AptDateTime');
      if (missing.length > 0) {
        return { valid: false, have, missing, errorMessage: missing.includes('PatNum') 
          ? 'STOP! Need to find or create patient first.' : 'STOP! Need time slot selection.' };
      }
      break;
    case 'GetMultiplePatients':
      if (params.LName) have.LName = params.LName;
      if (params.FName) have.FName = params.FName;
      if (params.Phone) have.Phone = params.Phone;
      if (!params.LName && !params.FName && !params.Phone) {
        return { valid: false, have, missing: ['name or phone'], errorMessage: 'STOP! Need name or phone to look up patient.' };
      }
      break;
    case 'UpdateAppointment':
      if (params.AptNum) have.AptNum = params.AptNum; else missing.push('AptNum');
      if (missing.length > 0) {
        return { valid: false, have, missing, errorMessage: 'STOP! Need to find appointment first.' };
      }
      break;
  }
  return { valid: true, have, missing: [], errorMessage: '' };
}

/**
 * Iteratively handles function calls returned by the Responses API until
 * we get a final textual answer. Returns that answer as a string.
 */
async function handleResponseIterations(
  body: any,
  response: any,
): Promise<string> {
  let currentResponse = response;
  let iterations = 0;
  const maxIterations = 12; // Increased for complex workflows with multiple checks

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

    // Gather all function calls in the output
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

      return finalText || 'I was unable to process that request.';
    }

    // For each function call, execute it and append the output
    for (const toolCall of functionCalls) {
      const toolName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');

      // Handle the meta-tool approach
      if (toolName === 'callOpenDentalAPI') {
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
        
        // Helpful validation: Try to auto-inject PatNum from history if missing (non-breaking)
        if ((functionName === 'CreateAppointment' || functionName === 'UpdateAppointment')) {
          // Check if we have GetMultiplePatients result in history that we can use
          const getMultiplePatientsResult = body.input.find((item: any) => 
            item.type === 'function_call_output' && 
            item.output && 
            (() => {
              try {
                const parsed = JSON.parse(item.output || '{}');
                return parsed.data?.[0]?.PatNum || parsed.success?.data?.[0]?.PatNum;
              } catch {
                return false;
              }
            })()
          );
          
          if (getMultiplePatientsResult) {
            try {
              const parsed = JSON.parse(getMultiplePatientsResult.output);
              const patientData = parsed.data?.[0] || parsed.success?.data?.[0];
              if (patientData?.PatNum) {
                // Auto-inject PatNum if missing (helpful, non-breaking)
                if (!parameters) {
                  console.warn(`[Orchestrator] ⚠️ ${functionName} called without parameters, auto-injecting PatNum=${patientData.PatNum} from history`);
                  args.parameters = { PatNum: patientData.PatNum };
                } else if (!parameters.PatNum) {
                  console.warn(`[Orchestrator] ⚠️ ${functionName} missing PatNum, auto-injecting PatNum=${patientData.PatNum} from history`);
                  args.parameters = { ...parameters, PatNum: patientData.PatNum };
                }
              }
            } catch {
              // Silent fail - don't break the flow
            }
          }
        }
        
        // Use args.parameters in case it was modified by validation
        const finalParameters = args.parameters || parameters;
        

        try {
          // Call OpenDental API via worker route
          const result = await callOpenDentalAPI(functionName, finalParameters);

          // Add function call and result to the request body
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
            nextAction = 'MUST_ASK_USER_BEFORE_PROCEEDING';
          } else if (functionName === 'CreatePatient' && errorMessage.includes('Phone number')) {
            errorMessage = `STOP! Phone number validation failed. ASK THE USER: "Could you please provide your full 10-digit phone number including area code?"`;
          }

          // Add error output with clear instructions
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
      } else {
        // Handle any other direct tool calls (legacy support)
        
        try {
          const result = await callOpenDentalAPI(toolName, args);

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
          console.error(`\n[Orchestrator] ❌ ${toolName} ERROR:`);
          console.error(error.message || error);
          console.error(`================================================\n`);

          // Preserve errorType for propagation
          const errorOutput: any = {
            error: true,
            message: error.message || 'Unknown error'
          };
          if (error.errorType) {
            errorOutput.errorType = error.errorType;
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
              output: JSON.stringify(errorOutput),
            },
          );
          
          // Re-throw with errorType preserved so it can be caught by greeting agent
          if (error.errorType) {
            throw error;
          }
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
 */
export async function executeOrchestrator(
  relevantContextFromLastUserMessage: string,
  conversationHistory: any[] = [],
  officeContext?: OfficeContext
): Promise<string> {

  try {
    // Use provided office context or try to extract from history
    let finalOfficeContext: OfficeContext | undefined = officeContext;
    
    if (!finalOfficeContext && conversationHistory) {
      // Try multiple search strategies to find office context in history
      for (const item of conversationHistory) {
        // Strategy 1: function_call with output property
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
        
        // Strategy 2: Direct function_call_output item
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
            // Silent fail, try next strategy
          }
        }
        
        // Strategy 3: Function call within message content array
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'function_call_output' && 
                contentItem.name === 'get_office_context' && 
                contentItem.output) {
              try {
                const parsed = typeof contentItem.output === 'string' 
                  ? JSON.parse(contentItem.output) 
                  : contentItem.output;
                finalOfficeContext = parsed;
                break;
              } catch {
                // Silent fail
              }
            }
          }
          if (finalOfficeContext) break;
        }
        
        // Strategy 4: Check if item has a result property
        if (item.type === 'function_call' && 
            item.name === 'get_office_context' && 
            item.result) {
          try {
            const parsed = typeof item.result === 'string' 
              ? JSON.parse(item.result) 
              : item.result;
            finalOfficeContext = parsed;
            break;
          } catch {
            // Silent fail
          }
        }
      }
    }
    
    // Get user message
    const userMessage = relevantContextFromLastUserMessage || 'Help needed';
    
    // Extract messages AND function_call/function_call_output pairs from conversation history
    // NOTE: Responses API accepts function_call/function_call_output PAIRS, but not standalone function_call_output
    // This allows the LLM to see previous GetMultiplePatients results and extract PatNum
    // Office context is extracted separately above and passed via instructions
    const extractedHistory: any[] = [];
    
    // Track pending function calls to pair with their outputs
    const pendingFunctionCalls = new Map<string, any>();
    
    // Extract messages and function call pairs from history
    for (let i = 0; i < conversationHistory.length; i++) {
      const item = conversationHistory[i];
      
      if (item.type === 'message' && item.role) {
        // Extract text content from message
        let textContent = '';
        if (typeof item.content === 'string') {
          textContent = item.content;
        } else if (Array.isArray(item.content)) {
          textContent = item.content
            .filter((c: any) => c.type === 'input_text' || c.type === 'output_text' || !c.type)
            .map((c: any) => c.text || c.content || c)
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
        // Store function call to pair with its output
        pendingFunctionCalls.set(item.call_id, item);
      } else if (item.type === 'function_call_output') {
        // Check if we have a matching function_call
        const matchingCall = pendingFunctionCalls.get(item.call_id);
        if (matchingCall) {
          // Include function_call + function_call_output pairs (Responses API accepts these)
          // This allows the LLM to see previous GetMultiplePatients results and extract PatNum
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
          pendingFunctionCalls.delete(item.call_id); // Remove from pending
        }
        // Skip standalone function_call_output items (without preceding function_call)
      }
    }
  
  // Build request body for Responses API
  // Strategy: Separate static (cached) from dynamic (per-call)
  // - Static instructions: workflows, rules, function catalog (IDENTICAL across calls → auto-cached by OpenAI)
  // - Dynamic instructions: dates and office context (changes per call) → goes in input array as system message
  const staticSystemPrompt = getStaticSystemPrompt();
  const dynamicInstructions = generateOrchestratorInstructions(finalOfficeContext);
  
  const body: any = {
    model: 'gpt-4o',
    instructions: staticSystemPrompt.text, // Static only here (gets cached)
    tools: orchestratorTools,
    input: [
      // Dynamic context as first message
      {
        type: 'message',
        role: 'system',
        content: dynamicInstructions || ''
      },
      ...extractedHistory, // Include full conversation history
      {
        type: 'message',
        role: 'user',
        content: userMessage
      }
    ]
  };

  // Make initial request
  const response = await fetchResponsesMessage(body);
  
  // Handle tool calls iteratively
  const finalResponse = await handleResponseIterations(body, response);
  
  
  // Return plain string - Lexi will read this verbatim
  return finalResponse;

  } catch (error: any) {
    console.error('[executeOrchestrator] Error:', error);
    
    // Return plain string for errors too
    return `I encountered an error while processing your request: ${error.message}`;
  }
}

/**
 * Orchestrator agent tool (wraps executeOrchestrator for Realtime SDK)
 */
export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description: 'Handles patient operations by calling OpenDental API functions. Use this for finding patients, booking appointments, canceling, checking schedules, etc.',
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
    const officeContext = details?.context?.officeContext;
    
    return await executeOrchestrator(relevantContextFromLastUserMessage, history, officeContext);
  },
});