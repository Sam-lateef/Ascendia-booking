/**
 * SUPERVISOR AGENT - Handles actual booking operations
 * 
 * This is the intelligent backend agent (gpt-4o) that processes requests
 * from the chat agent (Lexi) and executes booking functions.
 * 
 * Flow:
 * 1. Lexi (gpt-4o-mini realtime) handles conversation
 * 2. When action is needed, Lexi calls getNextResponseFromSupervisor
 * 3. Supervisor (gpt-4o text) analyzes context and executes tools
 * 4. Supervisor returns response for Lexi to speak
 */

import { dentalOfficeInfo } from '../openDental/dentalOfficeData';
import { fetchEmbeddedBookingContext } from '@/app/lib/embeddedBookingContext';

// ============================================
// SUPERVISOR INSTRUCTIONS
// ============================================

export const supervisorInstructions = `You are an expert dental receptionist supervisor handling booking operations for Lexi, a voice receptionist. You receive conversation history and context, then execute booking functions and provide responses that Lexi will speak to the patient.

═══════════════════════════════════════════════════════════════════════════════
OFFICE INFORMATION
═══════════════════════════════════════════════════════════════════════════════
${dentalOfficeInfo.name} | ${dentalOfficeInfo.phone} | ${dentalOfficeInfo.address}
Hours: ${dentalOfficeInfo.hours.weekdays} | Weekends: ${dentalOfficeInfo.hours.saturday}
Services: ${dentalOfficeInfo.services.join(', ')}

═══════════════════════════════════════════════════════════════════════════════
CRITICAL - ALWAYS START WITH THESE TOOLS
═══════════════════════════════════════════════════════════════════════════════
1. Call get_datetime() FIRST to know current date/time (needed for all date calculations)
2. Call get_office_context() if you need provider/operatory information

NEVER guess dates - always use get_datetime() to calculate correct year/month/day.

═══════════════════════════════════════════════════════════════════════════════
CRITICAL - CHECK BOOKING STATE FIRST (before any function calls!)
═══════════════════════════════════════════════════════════════════════════════

The context contains "=== BOOKING STATE ===" with data from previous supervisor calls.
**YOU MUST CHECK THIS BEFORE CALLING ANY FUNCTION!**

BOOKING STATE FLAGS:
- [EXISTING PATIENT - PatNum: X] → USE this PatNum, DO NOT call CreatePatient or GetMultiplePatients
- [Patient phone: X] → Phone already known
- [Patient name: X Y] → Name already known
- [AVAILABLE SLOTS already queried] → DO NOT call GetAvailableSlots again unless different date requested
- [Slots: [...]] → Use these slots to book, don't re-query
- [SELECTED SLOT: {...}] → Patient already chose this slot
- [APPOINTMENT CREATED - AptNum: X] → Appointment exists, DO NOT call CreateAppointment again

**BEFORE EVERY FUNCTION CALL, ASK YOURSELF:**
1. Is this data already in the BOOKING STATE? → Don't call the function again
2. Am I about to create something that already exists? → STOP

═══════════════════════════════════════════════════════════════════════════════
EXTRACT FROM CONVERSATION HISTORY
═══════════════════════════════════════════════════════════════════════════════
The conversation history contains text from the call:
- Patient phone number (spoken)
- Patient name (first and last)
- Date of birth
- Requested dates/times
- Provider preferences

**CRITICAL - BOOKING STATE OVERRIDES CONVERSATION:**
If BOOKING STATE has PatNum/AptNum/Slots, USE THOSE VALUES even if conversation
seems to suggest looking them up again. The state is authoritative.

BEFORE calling any function:
1. CHECK BOOKING STATE for existing data - if present, use it directly
2. Review conversation history for NEW information only
3. Extract info that's NOT already in booking state
4. Never re-fetch data that's already in booking state

NEVER CREATE DUPLICATES:
- PatNum in booking state → skip CreatePatient AND GetMultiplePatients
- Slots in booking state → skip GetAvailableSlots (unless different date)
- AptNum in booking state → skip CreateAppointment (booking is done!)
- ONLY call these functions if the data is NOT in booking state

═══════════════════════════════════════════════════════════════════════════════
BOOKING NEW APPOINTMENT - STEP BY STEP
═══════════════════════════════════════════════════════════════════════════════

**STEP 0 - CHECK BOOKING STATE (ALWAYS DO THIS FIRST!):**
- If PatNum exists in booking state → SKIP steps 2-3, go to step 4
- If slots exist in booking state → SKIP step 4, go to step 5
- If AptNum exists in booking state → BOOKING IS DONE, just confirm

STEP 1 - Get Current Date and Context:
- Call get_datetime() to know what "today" is
- Call get_office_context() to get providers/operatories

STEP 2 - Identify Patient BY PHONE NUMBER (SKIP if PatNum in booking state!):
- **FIRST CHECK:** Is PatNum already in booking state? → SKIP this step entirely
- **CRITICAL:** Phone number is the PRIMARY identifier - ALWAYS search by phone first
- Extract phone number from conversation history (Lexi will collect this first)
- Call GetMultiplePatients(Phone: "6195551234") - 10 digits, no dashes
- **NEVER search by name alone** - phone number is required for lookup
- If patient found → PatNum will be stored in booking state for next call
- If NOT found → go to CREATE PATIENT flow (but KEEP the phone number)

STEP 3 - Calculate Requested Date:
- User might say "the 16th", "next Tuesday", "tomorrow"
- Use get_datetime() result to determine actual YYYY-MM-DD date
- If user said "January 16th" and current year is 2026 → use 2026-01-16
- NEVER use wrong year (like 2023 when it's 2026)

STEP 4 - Find Available Slots (SKIP if slots in booking state!):
- **FIRST CHECK:** Are slots already in booking state? → SKIP this step, use existing slots
- Only call GetAvailableSlots if patient wants a DIFFERENT date than what's in state
- Call GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum)
- Use appropriate ProvNum from context or user preference
- If they want "Dr. Sarah Pearl" → find her ProvNum from office context
- **GetAvailableSlots returns an array of EXACT slot objects**
- Each slot has: AptDateTime, ProvNum, Op (operatory ID)

STEP 5 - Present Options to Lexi (DO NOT BOOK YET):
- Review the available slots returned by GetAvailableSlots
- Pick 2-3 time options that match patient's request
- Return a response like: "I have 9 AM, 10:30 AM, or 2 PM with Dr. Pearl. What works best?"
- **WAIT for patient to choose a specific time**
- **DO NOT call CreateAppointment yet** - Lexi needs to get patient confirmation first

STEP 6 - After Patient Chooses and Confirms:
- Lexi will call you again with: "Confirm booking at 10 AM on [date]"
- Find the EXACT slot object from GetAvailableSlots that matches this time
- Extract: AptDateTime, ProvNum, Op from that specific slot object
- **CRITICAL:** Use the EXACT Op (operatory ID) from the slot object - DO NOT guess or use a different operatory

STEP 7 - Create Appointment with EXACT Slot Details (SKIP if AptNum in booking state!):
- **FIRST CHECK:** Is AptNum already in booking state? → BOOKING IS DONE, just confirm to patient
- Call CreateAppointment with:
  * PatNum: from booking state (NOT from conversation - use the stored PatNum!)
  * AptDateTime: EXACT DateTime from the chosen slot object (YYYY-MM-DD HH:mm:ss format)
  * ProvNum: EXACT ProvNum from the chosen slot object
  * Op: EXACT Op from the chosen slot object (this is critical - operatories must match the schedule)
  * Note: appointment type if mentioned

**CRITICAL - OPERATORY HANDLING:**
- If CreateAppointment fails with "Operatory X is not active":
  * Find a DIFFERENT slot from GetAvailableSlots result that has a different Op
  * Try the next available slot with an active operatory
  * DO NOT retry the same operatory - it won't work
  * Tell Lexi: "Let me try another room - one moment..."

STEP 8 - Confirm to Patient:
- "You're all set! I've booked your [type] with Dr. [Name] for [Day], [Date] at [Time]."
- Include doctor name - look it up from ProvNum in office context
- Keep it conversational and concise (this is voice)

═══════════════════════════════════════════════════════════════════════════════
CREATE NEW PATIENT FLOW
═══════════════════════════════════════════════════════════════════════════════

**FIRST CHECK - Do NOT create duplicate patients:**
- If context contains "[EXISTING PATIENT - PatNum: X]" → SKIP CreatePatient, use PatNum X
- Only proceed with CreatePatient if NO PatNum exists in context

When GetMultiplePatients(Phone) returns no results AND no PatNum in context:

**CRITICAL - YOU ALREADY HAVE THE PHONE NUMBER:**
- The phone number was used in GetMultiplePatients lookup
- Extract it from conversation history or the GetMultiplePatients call you just made
- **DO NOT ask for phone again** - you already have it

1. Tell Lexi to collect missing info: "I need their first name, last name, and date of birth to create their account."
2. Wait for Lexi to provide this information in next context
3. Extract from conversation: FName, LName, Birthdate (YYYY-MM-DD), **Phone (already have it!)**
4. Call CreatePatient(FName, LName, Birthdate, WirelessPhone: "[phone from lookup]")
5. CreatePatient returns a PatNum - **SAVE THIS**
6. Use that PatNum for subsequent CreateAppointment call
7. Respond: "[Name] is all set up as a new patient. [Then proceed with booking]"

**EXAMPLE:**
- GetMultiplePatients(Phone: "6195551234") → returns empty (not found)
- You now know phone is "6195551234"
- Request: "I need their first name, last name, and date of birth"
- Lexi collects: "Yousef", "Saddam", "March 7, 2006"
- Call CreatePatient(FName: "Yousef", LName: "Saddam", Birthdate: "2006-03-07", WirelessPhone: "6195551234")
- Extract PatNum from result → use for CreateAppointment

CRITICAL: The newly created patient's PatNum is in the CreatePatient result JSON.
Extract it and use it immediately for booking their appointment.

═══════════════════════════════════════════════════════════════════════════════
RESCHEDULING FLOW
═══════════════════════════════════════════════════════════════════════════════

1. Identify patient (GetMultiplePatients)
2. Get their appointments (GetAppointments)
3. Identify which AptNum they want to reschedule
4. Find new available slot (GetAvailableSlots)
5. Call UpdateAppointment(AptNum, new DateTime, ProvNum, Op from slot)
6. Confirm change clearly

═══════════════════════════════════════════════════════════════════════════════
HANDLING ERRORS
═══════════════════════════════════════════════════════════════════════════════

If operatory is not active:
- Try another operatory from available slots
- Don't tell patient technical details

If time slot conflict:
- "Oh, that slot just got taken. Let me find another..."
- Immediately call GetAvailableSlots again
- Offer alternative times

If missing information:
- Tell Lexi to ask for it: "I need their date of birth to complete registration."
- Or extract it from conversation history if already mentioned

═══════════════════════════════════════════════════════════════════════════════
RESPONSE FORMAT FOR LEXI
═══════════════════════════════════════════════════════════════════════════════

Your response will be spoken word-for-word by Lexi to the patient:
- Natural, conversational tone
- No markdown, bullets, or formatting
- 1-3 sentences typically
- Include specific details (Dr. name, date, time)
- Never mention function names or technical errors

GOOD: "I found Sam Latif at that number. Is that you?"
BAD: "GetMultiplePatients returned 1 result with PatNum 39."

GOOD: "You're all set! I've booked your appointment with Dr. Sarah Pearl for Thursday, January 16th at 10 AM."
BAD: "CreateAppointment executed successfully for PatNum 39 on 2026-01-16 10:00:00."

═══════════════════════════════════════════════════════════════════════════════
REMEMBER:
1. **CHECK BOOKING STATE FIRST** - before every function call!
2. If PatNum in state → DON'T call CreatePatient or GetMultiplePatients
3. If Slots in state → DON'T call GetAvailableSlots (unless different date)
4. If AptNum in state → DON'T call CreateAppointment (booking done!)
5. ALWAYS call get_datetime() for date calculations
6. Use EXACT slot details from GetAvailableSlots or booking state
7. Provide natural, spoken responses for Lexi
═══════════════════════════════════════════════════════════════════════════════
`;

// ============================================
// SUPERVISOR TOOLS (executed via API)
// ============================================

export const supervisorTools = [
  {
    type: 'function',
    name: 'get_datetime',
    description: 'Gets the current date and time in ISO format',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'get_office_context',
    description: 'Fetches current office data (providers, operatories, occupied slots). Call once at start.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'GetMultiplePatients',
    description: 'Find patients by phone number',
    parameters: {
      type: 'object',
      properties: {
        Phone: { type: 'string', description: '10-digit phone number (no dashes)' },
      },
      required: ['Phone'],
    },
  },
  {
    type: 'function',
    name: 'CreatePatient',
    description: 'Create a new patient record',
    parameters: {
      type: 'object',
      properties: {
        FName: { type: 'string', description: 'First name' },
        LName: { type: 'string', description: 'Last name' },
        Birthdate: { type: 'string', description: 'Date of birth (YYYY-MM-DD)' },
        WirelessPhone: { type: 'string', description: '10-digit phone number' },
      },
      required: ['FName', 'LName', 'Birthdate', 'WirelessPhone'],
    },
  },
  {
    type: 'function',
    name: 'GetAppointments',
    description: 'Get all appointments for a patient in a date range',
    parameters: {
      type: 'object',
      properties: {
        PatNum: { type: 'number', description: 'Patient ID' },
        DateStart: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        DateEnd: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['PatNum', 'DateStart', 'DateEnd'],
    },
  },
  {
    type: 'function',
    name: 'GetAvailableSlots',
    description: 'Find available appointment time slots',
    parameters: {
      type: 'object',
      properties: {
        dateStart: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateEnd: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        ProvNum: { type: 'number', description: 'Provider ID (default: 1)' },
        OpNum: { type: 'number', description: 'Operatory ID (default: 1)' },
      },
      required: ['dateStart', 'dateEnd'],
    },
  },
  {
    type: 'function',
    name: 'CreateAppointment',
    description: 'Book a new appointment',
    parameters: {
      type: 'object',
      properties: {
        PatNum: { type: 'number', description: 'Patient ID' },
        AptDateTime: { type: 'string', description: 'Appointment date/time (YYYY-MM-DD HH:mm:ss)' },
        ProvNum: { type: 'number', description: 'Provider ID' },
        Op: { type: 'number', description: 'Operatory ID' },
        Note: { type: 'string', description: 'Appointment type/note' },
      },
      required: ['PatNum', 'AptDateTime', 'ProvNum', 'Op'],
    },
  },
  {
    type: 'function',
    name: 'UpdateAppointment',
    description: 'Reschedule an existing appointment',
    parameters: {
      type: 'object',
      properties: {
        AptNum: { type: 'number', description: 'Appointment ID' },
        AptDateTime: { type: 'string', description: 'New date/time (YYYY-MM-DD HH:mm:ss)' },
        ProvNum: { type: 'number', description: 'Provider ID' },
        Op: { type: 'number', description: 'Operatory ID' },
      },
      required: ['AptNum', 'AptDateTime', 'ProvNum', 'Op'],
    },
  },
  {
    type: 'function',
    name: 'BreakAppointment',
    description: 'Cancel an appointment',
    parameters: {
      type: 'object',
      properties: {
        AptNum: { type: 'number', description: 'Appointment ID to cancel' },
      },
      required: ['AptNum'],
    },
  },
];

// ============================================
// EXECUTE SUPERVISOR TOOL
// ============================================

export async function executeSupervisorTool(
  toolName: string,
  args: Record<string, unknown>,
  sessionId: string
): Promise<string> {
  console.log(`[Supervisor] Executing ${toolName}`);

  switch (toolName) {
    case 'get_datetime': {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (${dayName})`;
    }

    case 'get_office_context': {
      const context = await fetchEmbeddedBookingContext();
      return JSON.stringify(context, null, 2);
    }

    case 'GetMultiplePatients':
    case 'CreatePatient':
    case 'GetAppointments':
    case 'GetAvailableSlots':
    case 'CreateAppointment':
    case 'UpdateAppointment':
    case 'BreakAppointment': {
      // Use server-side BASE_URL for production, fallback to localhost for dev
      const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: toolName,
          parameters: args,
          sessionId,
          conversationHistory: []
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.message || `${toolName} failed`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.message || `${toolName} failed`);
      }
      
      console.log(`[Supervisor] ✅ ${toolName} succeeded`);
      return JSON.stringify(result);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ============================================
// CALL SUPERVISOR (Main entry point)
// ============================================

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SupervisorResult {
  response: string;
  toolsCalled: string[];
  toolResults: Record<string, unknown>; // Results from each tool call for state tracking
  error?: string;
}

/**
 * Call the supervisor agent to handle a request
 * 
 * @param conversationHistory - Array of conversation messages
 * @param contextFromLastMessage - Key context from the last user message
 * @param sessionId - Session ID for tracking
 * @returns Response to speak to the user
 */
export async function callSupervisor(
  conversationHistory: ConversationMessage[],
  contextFromLastMessage: string,
  sessionId: string,
  customSupervisorInstructions?: string
): Promise<SupervisorResult> {
  console.log('[Supervisor] Processing request');

  const toolsCalled: string[] = [];
  const toolResults: Record<string, unknown> = {}; // Track results from each tool
  
  // Use custom instructions if provided, otherwise use default
  const instructionsToUse = customSupervisorInstructions || supervisorInstructions;
  
  if (customSupervisorInstructions) {
    console.log('[Supervisor] Using database instructions');
  }

  try {
    // Build the request body for OpenAI Responses API
    const body: {
      model: string;
      input: Array<{
        type: string;
        role?: string;
        content?: string;
        call_id?: string;
        name?: string;
        arguments?: string;
        output?: string;
      }>;
      tools: typeof supervisorTools;
      parallel_tool_calls: boolean;
    } = {
      model: 'gpt-4o',
      input: [
        {
          type: 'message',
          role: 'system',
          content: instructionsToUse,
        },
        {
          type: 'message',
          role: 'user',
          content: `=== Conversation History ===
${JSON.stringify(conversationHistory, null, 2)}

=== Context From Last User Message ===
${contextFromLastMessage}

Based on this conversation, determine what action to take and provide a response that Lexi can speak to the patient.`,
        },
      ],
      tools: supervisorTools,
      parallel_tool_calls: false, // Sequential for deterministic behavior
    };

    // Call OpenAI Responses API
    const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    let currentResponse = await fetchResponsesAPI(baseUrl, body);

    // Handle tool calls iteratively
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;

      if (currentResponse?.error) {
        console.error('[Supervisor] ❌ API error:', currentResponse.error);
        return { response: "I'm having trouble with our system. Let me try again.", toolsCalled, toolResults, error: currentResponse.error };
      }

      const outputItems: Array<{
        type: string;
        name?: string;
        call_id?: string;
        arguments?: string;
        content?: Array<{ type: string; text?: string }>;
      }> = currentResponse.output ?? [];
      const functionCalls = outputItems.filter((item) => item.type === 'function_call');

      if (functionCalls.length === 0) {
        // No more function calls - extract final text response
        const assistantMessages = outputItems.filter((item) => item.type === 'message');
        
        const finalText = assistantMessages
          .map((msg) => {
            const contentArr = msg.content ?? [];
            return contentArr
              .filter((c) => c.type === 'output_text')
              .map((c) => c.text || '')
              .join('');
          })
          .join('\n')
          .trim();

        if (finalText) {
          console.log('[Supervisor] ✅ Final response:', finalText.substring(0, 100));
          return { response: finalText, toolsCalled, toolResults };
        }

        return { response: "I couldn't process that request. Could you repeat what you need?", toolsCalled, toolResults };
      }

      // Execute each function call
      for (const toolCall of functionCalls) {
        const toolName = toolCall.name!;
        const args = JSON.parse(toolCall.arguments || '{}');
        toolsCalled.push(toolName);

        try {
          const result = await executeSupervisorTool(toolName, args, sessionId);
          
          // Store result for state tracking (especially PatNum from CreatePatient)
          try {
            toolResults[toolName] = JSON.parse(result);
          } catch {
            toolResults[toolName] = result;
          }

          // Add function call and result to body
          body.input.push(
            {
              type: 'function_call',
              call_id: toolCall.call_id!,
              name: toolName,
              arguments: toolCall.arguments!,
            },
            {
              type: 'function_call_output',
              call_id: toolCall.call_id!,
              output: result,
            }
          );
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Supervisor] ❌ Tool error (${toolName}):`, errorMessage);

          body.input.push(
            {
              type: 'function_call',
              call_id: toolCall.call_id!,
              name: toolName,
              arguments: toolCall.arguments!,
            },
            {
              type: 'function_call_output',
              call_id: toolCall.call_id!,
              output: JSON.stringify({ error: errorMessage }),
            }
          );
        }
      }

      // Make follow-up request with tool results
      currentResponse = await fetchResponsesAPI(baseUrl, body);
    }

    console.warn('[Supervisor] ⚠️ Max iterations reached');
    return { response: "I need a moment to process that. Could you try again?", toolsCalled, toolResults };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Supervisor] ❌ Error:', errorMessage);
    return { response: "I'm having trouble right now. Let me try again.", toolsCalled, toolResults: {}, error: errorMessage };
  }
}

// Helper to call Responses API
async function fetchResponsesAPI(baseUrl: string, body: unknown): Promise<{
  error?: string;
  output?: Array<{
    type: string;
    name?: string;
    call_id?: string;
    arguments?: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
}> {
  const response = await fetch(`${baseUrl}/api/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    return { error: errorData.error || `API error: ${response.status}` };
  }

  return response.json();
}

