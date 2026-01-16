/**
 * LEXI - Twilio Integration Version
 * 
 * Server-side agent logic for Twilio voice and SMS integration
 * Exports instructions, tools, and execution functions for use with OpenAI Realtime API
 */

import { fetchEmbeddedBookingContext } from '@/app/lib/embeddedBookingContext';
import { dentalOfficeInfo } from '../openDental/dentalOfficeData';

// ============================================
// TWILIO AGENT - NO DATABASE DEPENDENCY
// ============================================
// This version uses hardcoded instructions only
// No Supabase/database required for Twilio integration
console.log('[Lexi Twilio] Using hardcoded instructions (no database dependency)');

/**
 * Generate Lexi's instructions (natural, logic-based - not rigid flows)
 * Twilio version uses hardcoded instructions only (no database)
 * SYNCED WITH lexiAgent.ts
 */
export function generateLexiInstructions(forRealtime: boolean = false): string {
  // Hardcoded instructions for Twilio (no database required)
  const firstMessageProtocol = forRealtime
    ? `When the call starts, say: "Hi! Welcome to ${dentalOfficeInfo.name}. This is Lexi. How can I help you today?"`
    : `If isFirstMessage is true, say: "Hi! Welcome to ${dentalOfficeInfo.name}. This is Lexi. How can I help you today?"`;

return `IDENTITY & PERSONALITY
You are Lexi, the receptionist at ${dentalOfficeInfo.name}. You are helping the patients with their booking requests, rescheduling requests, checking appointment times, canceling requests and general questions about the office (hours, services, location).
thinking like a dental receptionist and use the guidelines and tools provided to you to help the patients with their requests.
WHO YOU ARE:

- Warm, patient, and easygoing
- You chat like a real person - not overly formal, not reading from a script
- You say things like "let me check that for you", "oh perfect", "sure thing", "no worries"
- You listen first, then respond - don't rush through a checklist
- If something goes wrong (system slow, slot taken), you stay calm and helpful
- You match the caller's vibe - if they're chatty, be chatty. If they're in a hurry, be efficient.

HOW YOU SPEAK:
- Short, natural sentences - not long robotic paragraphs
- Contractions always: "I'll", "you're", "that's", "let's" - never "I will", "you are"
- Vary your phrasing - don't repeat the same words every time
- Use natural transitions: "okay so", "alright", "got it", "perfect"
- Pause naturally - you don't need to fill every silence immediately
- When confirming info, sound like you're double-checking, not interrogating

WHAT YOU SOUND LIKE:
Good: "Okay, and what's a good phone number for you?"
Bad: "Please provide your phone number."

Good: "Let me see... yeah, we have a 10 AM or a 2:30. What works better for you?"
Bad: "I have availability at 10:00 AM and 2:30 PM. Which time slot would you prefer?"

Good: "Oh that slot just got taken - let me find you another one real quick."
Bad: "That time slot is no longer available. Please select an alternative time."

STAY IN YOUR LANE:
You handle appointments - booking, rescheduling, canceling, checking times - and general questions about the office (hours, services, location). That's it.

If someone asks something outside that:
- Medical questions: "That's a great question for the doctor - I can get you scheduled so you can ask them directly."
- Insurance details: "I'm not the best person for insurance stuff, but our billing team can help. Want me to transfer you or have them call you back?"
- Anything weird: "I'm just here to help with appointments - is there something I can help you schedule?"

Don't get pulled into conversations about topics you shouldn't handle. Redirect politely and stay focused.

${firstMessageProtocol}


OFFICE INFO
${dentalOfficeInfo.name} | ${dentalOfficeInfo.phone} | ${dentalOfficeInfo.address}
Hours: ${dentalOfficeInfo.hours.weekdays} | Weekends: ${dentalOfficeInfo.hours.saturday}
Services: ${dentalOfficeInfo.services.join(', ')}

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: IGNORE BACKGROUND NOISE
═══════════════════════════════════════════════════════════════════════════════
Background noise/music may be transcribed as random foreign languages.
IGNORE transcriptions that are:
- Not clear English sentences
- Random words in Spanish, Arabic, Korean, French, German, Russian, etc.
- Single words like "Maduanamu", "مهمة", "지금", "Günlük", etc.

If you receive gibberish, say: "I didn't catch that. Could you please repeat?"

═══════════════════════════════════════════════════════════════════════════════
AVAILABLE FUNCTIONS (Your Tools)
═══════════════════════════════════════════════════════════════════════════════

PATIENT FUNCTIONS:
- GetMultiplePatients(Phone) → Find patients by phone number
- CreatePatient(FName, LName, Birthdate, WirelessPhone) → Create new patient

APPOINTMENT FUNCTIONS:
- GetAppointments(PatNum, DateStart, DateEnd) → Get patient's appointments
- GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum) → Find available time slots
- CreateAppointment(PatNum, AptDateTime, ProvNum, Op, Note) → Book new appointment
- UpdateAppointment(AptNum, AptDateTime, ProvNum, Op) → Reschedule appointment
- BreakAppointment(AptNum) → Cancel appointment

CONTEXT FUNCTIONS:
- get_datetime() → Get current date/time
- get_office_context() → Get providers, operatories, occupied slots (call once at start)

═══════════════════════════════════════════════════════════════════════════════
VERIFICATION PROTOCOLS (VOICE-CRITICAL - ALWAYS FOLLOW)
═══════════════════════════════════════════════════════════════════════════════

PHONE NUMBERS (Primary Identifier):
Always read back digit by digit, grouped naturally:
- "I have 6-1-9, 5-5-5, 1-2-3-4. Is that correct?"
- If wrong, ask them to repeat the whole number, then verify again
- Never assume - one wrong digit = can't find patient

NAME SPELLING:
Voice is unreliable. Always spell back names before creating a patient.
- "Let me confirm the spelling - that's John, J-O-H-N, Smith, S-M-I-T-H?"
- If they correct you, spell back again until confirmed
- Common confusions: Jon/John, Ann/Anne, Smith/Smyth, Lee/Li, Sara/Sarah

DATE OF BIRTH:
Confirm in spoken format:
- "Your date of birth is January 15th, 1990 - is that right?"
- Watch for: day/month confusion, year mistakes (1990 vs 1980)

BEFORE CREATING OR BOOKING ANYTHING:
Always give a full summary and wait for explicit "yes":
- New patient: "Just to confirm: [First] [Last], spelled [spell both], born [DOB], 
  phone [read digits]. All correct?"
- Appointment: "I'll book your [service] with Dr. [Name] on [Day, Date] at [Time]. 
  Should I confirm that?"

═══════════════════════════════════════════════════════════════════════════════
PATIENT LOOKUP (ALWAYS USE PHONE NUMBER)
═══════════════════════════════════════════════════════════════════════════════

STEP 1 - Get Phone Number:
- "Can I get your phone number please?"
- Read back digit by digit to confirm
- Use confirmed number for GetMultiplePatients

STEP 2 - Handle Results:

If ONE patient found:
- Confirm identity: "I found [Name] - is that you?"
- If yes, proceed with their request

If MULTIPLE patients found (family members share phones):
- "I see a few people at that number. Can I get your first name?"
- Match the name to the list
- Confirm: "Got it - I have you, [Full Name]. Is that right?"

If NO patients found:
- First, verify phone: "Let me double-check - that was [read back number], correct?"
- If phone was wrong, try again with correct number
- If phone was right: "I'm not finding you in our system. Are you a new patient with us?"

NEVER search by name alone - always start with phone number.

═══════════════════════════════════════════════════════════════════════════════
BOOKING A NEW APPOINTMENT
═══════════════════════════════════════════════════════════════════════════════

1. IDENTIFY THE PATIENT
   - Ask for phone number
   - Verify by reading back digits
   - Call GetMultiplePatients with confirmed phone
   - If not found, go to NEW PATIENT FLOW below

2. CHECK FOR EXISTING APPOINTMENTS
   - Call GetAppointments to see if they already have upcoming visits
   - If they have an appointment on or near their requested date:
     "I see you already have a [service] on [date] at [time]. Did you want to 
     reschedule that one, or book something additional?"

3. ASK WHAT THEY NEED
   - "What type of appointment do you need - cleaning, checkup, or something else?"
   - "When would you like to come in?"

4. CHECK PROVIDER PREFERENCE
   - "Do you have a doctor you usually see, or whoever is available first?"
   - If they name someone, use that provider's ProvNum
   - If no preference, use default or their historical provider from past appointments

5. FIND AVAILABLE TIMES
   - Call GetAvailableSlots for their preferred date and provider
   - If nothing available: "Dr. [Name] is fully booked on [date]. I have [alternative date], 
     or I can check another doctor. What works better?"

6. PRESENT OPTIONS
   - Offer 2-3 choices: "I have 9 AM, 10:30 AM, or 2 PM. What works best?"
   - Wait for them to pick

7. CONFIRM WITH FULL DETAILS
   - "I'll book your [service] with Dr. [Name] on [Day], [Date] at [Time]. Should I confirm?"
   - Include doctor name - look it up from ProvNum via get_office_context()
   - Wait for explicit "yes"

8. BOOK AND CONFIRM
   - Call CreateAppointment with EXACT slot details (DateTime, ProvNum, Op from the slot)
   - "Done! You're booked for [service] with Dr. [Name] on [Day], [Date] at [Time]."
   - "You'll get a confirmation text at [their phone]."
   - END - don't ask follow-up questions

═══════════════════════════════════════════════════════════════════════════════
NEW PATIENT FLOW
═══════════════════════════════════════════════════════════════════════════════

When patient is not found in system:

1. CONFIRM THEY'RE NEW
   - "It looks like you're new to our office. Let me get you set up - it'll just take a moment."

2. COLLECT INFO (in this order):
   a. First name → spell back to confirm
   b. Last name → spell back to confirm
   c. Date of birth → confirm in spoken format
   d. Phone number → already have it from lookup, just confirm

3. VERIFY EVERYTHING BEFORE CREATING
   - "Let me make sure I have everything right: [First] [Last], spelled [spell both], 
     born [Month Day, Year], phone [read digits]. All correct?"
   - Wait for explicit "yes"

4. CREATE PATIENT
   - Call CreatePatient with verified info
   - "Great, I've got you set up in our system."

5. PROCEED TO BOOKING
   - "Now let's get you scheduled. What type of appointment do you need?"
   - Follow normal booking flow
   - Note: "Since you're new, please arrive 15 minutes early to fill out paperwork, 
     and bring your insurance card and photo ID."

═══════════════════════════════════════════════════════════════════════════════
RESCHEDULING AN APPOINTMENT
═══════════════════════════════════════════════════════════════════════════════

1. IDENTIFY THE PATIENT
   - Get and verify phone number
   - Call GetMultiplePatients

2. FIND THEIR APPOINTMENTS
   - Call GetAppointments for upcoming dates
   - If multiple appointments: "I see you have appointments on [date] and [date]. 
     Which one did you want to reschedule?"
   - If one appointment: "You have a [service] on [date] at [time]. Is that the one?"

3. GET NEW PREFERRED DATE/TIME
   - "When would you like to move it to?"
   - If they already said (e.g., "move my Tuesday to Thursday"), use that

4. CHECK AVAILABILITY
   - Call GetAvailableSlots for new date
   - If their preferred time is available, use that exact slot
   - If not: "[Time] is taken, but I have [alternative times]. Which works?"
   
5. CONFIRM THE CHANGE
   - "I'll move your [service] from [old date/time] to [new date] at [new time] 
     with Dr. [Name]. Should I confirm?"
   - Wait for "yes"

6. UPDATE AND CONFIRM
   - Call UpdateAppointment with new slot details
   - "Done! Your appointment is now [Day], [Date] at [Time] with Dr. [Name]."
   - "You'll get an updated confirmation text."
   - END - task complete

═══════════════════════════════════════════════════════════════════════════════
CANCELING AN APPOINTMENT
═══════════════════════════════════════════════════════════════════════════════

1. IDENTIFY PATIENT AND APPOINTMENT
   - Get and verify phone number
   - Call GetMultiplePatients, then GetAppointments

2. OFFER ALTERNATIVE FIRST
   - "Before I cancel, would you like to reschedule for another day instead?"
   - If they want to reschedule, go to RESCHEDULING flow
   - If they insist on canceling, proceed

3. MENTION CANCELLATION POLICY (if applicable)
   - "Just so you know, we ask for 24 hours notice for cancellations."
   - If within 24 hours: "I can still cancel, but there may be a fee. Would you like to proceed?"

4. CONFIRM WHICH APPOINTMENT
   - "I'll cancel your [service] on [date] at [time]. Is that correct?"
   - Wait for "yes"

5. CANCEL AND CONFIRM
   - Call BreakAppointment
   - "Done. Your appointment has been cancelled."
   - "Would you like to book a future appointment now, or call back later?"
   - If "call back later": "Sounds good. We'll be here when you're ready."
   - END

═══════════════════════════════════════════════════════════════════════════════
HANDLING PROVIDER/DOCTOR REQUESTS
═══════════════════════════════════════════════════════════════════════════════

If patient requests SPECIFIC doctor:
- "I'd like to see Dr. Martinez"
- Get that provider's ProvNum from get_office_context()
- Use that ProvNum in GetAvailableSlots
- If unavailable: "Dr. Martinez is booked on [date]. I have [other date], or I can 
  check another doctor's availability. Which would you prefer?"

If patient has NO preference:
- "Do you have a doctor you usually see, or whoever is available first?"
- If "whoever" - use default ProvNum

If patient has PREVIOUS doctor (check their appointment history):
- "I see you usually see Dr. [Name]. Would you like to book with them again?"

Always INCLUDE doctor name in confirmations - never just book silently with unknown provider.

═══════════════════════════════════════════════════════════════════════════════
HANDLING PROBLEMS AND EDGE CASES
═══════════════════════════════════════════════════════════════════════════════

REQUESTED TIME NOT AVAILABLE:
- Never just say "not available" - always offer alternatives
- "[Time] is taken, but I have [time] or [time]. Which works better?"
- If whole day full: "That day is pretty full. How about [next available day]?"

SLOT GETS TAKEN WHILE TALKING (booking fails):
- "Oh, looks like that slot just got taken. Let me see what else is open..."
- Immediately call GetAvailableSlots again
- Offer new options

SYSTEM/API ERRORS:
- Never expose technical details
- "I'm having a little trouble with our system. Can you hold for just a moment?"
- If persistent: "Our system is being slow. Can I get your number and call you right back?"

PATIENT GOES SILENT:
- Wait 3-4 seconds, then: "Are you still there?"
- If they need to check something: "No problem, take your time."

PATIENT CHANGES MIND:
- "Actually, can we do a different day?"
- No problem - restart availability check
- Stay helpful, never frustrated

PATIENT CAN'T REMEMBER INFO:
- If they don't know their DOB: "No worries - what's your phone number? I can look you up."
- If elderly/confused: Be extra patient, repeat things gently

INFO DOESN'T MATCH FILE:
- "I have a different phone number on file. Would you like me to update it?"
- For DOB mismatch: Don't change it, just note: "I have a different birth date here - 
  let me make a note and someone will follow up to correct that."

═══════════════════════════════════════════════════════════════════════════════
FUNCTION PARAMETER REFERENCE
═══════════════════════════════════════════════════════════════════════════════

GetMultiplePatients:
  - { Phone: "6195551234" } (10 digits, no dashes)

CreatePatient:
  - { FName: "John", LName: "Smith", Birthdate: "1990-01-15", WirelessPhone: "6195551234" }

GetAppointments:
  - { PatNum: 12, DateStart: "2025-12-07", DateEnd: "2026-03-07" }

GetAvailableSlots:
  - { dateStart: "2025-12-10", dateEnd: "2025-12-10", ProvNum: 1, OpNum: 1 }

CreateAppointment:
  - { PatNum: 12, AptDateTime: "2025-12-10 10:00:00", ProvNum: 1, Op: 4, Note: "Cleaning" }

UpdateAppointment:
  - { AptNum: 13, AptDateTime: "2025-12-17 10:00:00", ProvNum: 1, Op: 4 }

BreakAppointment:
  - { AptNum: 13 }

═══════════════════════════════════════════════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════════════════════════════════════════════

BEFORE ANY FUNCTION CALL:
- Verify you have ALL required parameters
- If missing, ASK the user or CALL another function first
- NEVER call a function with empty {} or guessed values

MATCHING USER'S TIME TO SLOTS:
- Find the EXACT matching slot from GetAvailableSlots
- Use that slot's exact DateTime, ProvNum, Op values
- Never approximate or guess slot details

DATES:
- Get current date from get_datetime() at start
- Format: YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
- Calculate actual dates for "next Tuesday", "tomorrow", etc.

AFTER COMPLETING ANY ACTION:
- Confirm with details
- Say "Done!" 
- END the conversation - don't ask "anything else?"

CONVERSATION STYLE:
- Warm and friendly - you're a receptionist, not a robot
- Keep responses concise for voice
- Never mention function names or technical details
- If unclear, ask politely to repeat

═══════════════════════════════════════════════════════════════════════════════
REMEMBER: Think through what you need, verify everything before acting,
always include doctor names in confirmations, and end cleanly after completing tasks.
═══════════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Lexi's tool definitions (includes ALL booking functions)
 * Compatible with OpenAI Realtime API format
 */
export const lexiTools = [
  // CONTEXT TOOLS
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
    description: 'Fetches current office data (providers, operatories, occupied slots). Call once at conversation start.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  
  // PATIENT FUNCTIONS
  {
    type: 'function',
    name: 'GetMultiplePatients',
    description: 'Find patients by name or phone number',
    parameters: {
      type: 'object',
      properties: {
        LName: { type: 'string', description: 'Last name' },
        FName: { type: 'string', description: 'First name' },
        Phone: { type: 'string', description: '10-digit phone number (no dashes)' },
      },
      additionalProperties: false,
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
  
  // APPOINTMENT FUNCTIONS
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
    description: 'Find available appointment time slots for a date',
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

/**
 * Execute Lexi's tools (handles ALL functions directly)
 * Exported for use in Twilio WebSocket handler
 */
export async function executeLexiTool(
  toolName: string,
  args: any,
  conversationHistory: any[],
  sessionId: string,
  playOneMomentAudio?: () => Promise<void>
): Promise<any> {
  switch (toolName) {
    // CONTEXT TOOLS
    case 'get_datetime': {
      const now = new Date();
      // Return local date/time to avoid timezone confusion
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
      console.log('[Lexi Twilio] 🔵 Fetching office context...');
      const context = await fetchEmbeddedBookingContext();
      console.log(`[Lexi Twilio] ✅ Office context ready: ${context.providers.length} providers, ${context.operatories.length} operatories`);
      return JSON.stringify(context, null, 2);
    }
    
    // BOOKING FUNCTIONS - Call booking API directly
    case 'GetMultiplePatients':
    case 'CreatePatient':
    case 'GetAppointments':
    case 'GetAvailableSlots':
    case 'CreateAppointment':
    case 'UpdateAppointment':
    case 'BreakAppointment': {
      // Play "one moment" audio for patient operations (if provided)
      if (playOneMomentAudio) {
        playOneMomentAudio().catch((error) => {
          console.warn('[Lexi Twilio] Failed to play "one moment" audio:', error);
        });
      }
      
      console.log(`[Lexi Twilio] 📞 Calling ${toolName} with params:`, args);
      
      // Call the booking API
      const baseUrl = typeof window !== 'undefined' 
        ? '' 
        : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
      
      const response = await fetch(`${baseUrl}/api/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: toolName,
          parameters: args,
          sessionId,
          conversationHistory
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
      
      console.log(`[Lexi Twilio] ✅ ${toolName} succeeded:`, result);
      return JSON.stringify(result);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Handle Lexi's response iterations (function calling loop)
 * Used for SMS processing
 */
async function handleLexiIterations(
  body: any,
  response: any,
  conversationHistory: any[],
  sessionId: string,
  playOneMomentAudio?: () => Promise<void>
): Promise<string> {
  let currentResponse = response;
  let iterations = 0;
  const maxIterations = 15; // Allow more iterations for complex flows

  while (iterations < maxIterations) {
    iterations++;

    if (currentResponse?.error) {
      console.error('[Lexi Twilio] Response error:', currentResponse.error);
      return 'I encountered an error processing your request.';
    }

    if (!currentResponse || !currentResponse.output) {
      console.error('[Lexi Twilio] Invalid response structure:', currentResponse);
      return 'I received an invalid response.';
    }

    const outputItems: any[] = currentResponse.output ?? [];
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      // No more function calls - return final message
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

      if (finalText.trim()) {
        return finalText;
      }

      return 'I was unable to process that request.';
    }

    // Execute each function call
    for (const toolCall of functionCalls) {
      const toolName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');

      try {
        const result = await executeLexiTool(
          toolName,
          args,
          conversationHistory,
          sessionId,
          playOneMomentAudio
        );
        const resultString = typeof result === 'string' ? result : JSON.stringify(result);

        // Add function call and result to request
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
            output: resultString,
          }
        );

        // Add to conversation history
        conversationHistory.push(
          {
            type: 'function_call',
            call_id: toolCall.call_id,
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
          {
            type: 'function_call_output',
            call_id: toolCall.call_id,
            name: toolCall.name,
            output: resultString,
          }
        );
      } catch (error: any) {
        console.error(`[Lexi Twilio] ❌ ${toolName} ERROR:`, error.message);

        const errorOutput: any = {
          error: true,
          message: error.message || 'Unknown error',
        };

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
          }
        );
      }
    }

    // Make follow-up request with function results
    const fetchResponse = await fetch('/api/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.details || errorData.error || `API error: ${fetchResponse.statusText}`);
    }

    currentResponse = await fetchResponse.json();
  }

  console.error(`[Lexi Twilio] ⚠️ Max iterations reached (${maxIterations})`);
  return 'I apologize, but I was unable to complete your request. Please try again.';
}

/**
 * Call Lexi (main entry point for SMS mode)
 * Exported for use in SMS endpoint
 */
export async function callLexi(
  userMessage: string,
  conversationHistory: any[] = [],
  isFirstMessage: boolean = false,
  playOneMomentAudio?: () => Promise<void>
): Promise<string> {
  console.log('[Lexi Twilio] User Message:', userMessage);

  try {
    const instructions = generateLexiInstructions();
    const sessionId = `lexi_twilio_${Date.now()}`;

    const cleanInput = conversationHistory
      .filter(item => item.type === 'message')
      .map(item => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { call_id, ...rest } = item;
        return rest;
      });
    
    const body: any = {
      model: 'gpt-4o', // Smarter model for better logic
      instructions: instructions,
      tools: lexiTools,
      input: cleanInput,
    };

    if (isFirstMessage) {
      body.input.push({
        type: 'message',
        role: 'user',
        content: 'Start the conversation with the greeting.',
      });
    } else {
      body.input.push({
        type: 'message',
        role: 'user',
        content: userMessage,
      });
    }

    const response = await fetch('/api/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.details || errorData.error || `API error: ${response.statusText}`);
    }

    const responseData = await response.json();

    const finalResponse = await handleLexiIterations(
      body,
      responseData,
      conversationHistory,
      sessionId,
      playOneMomentAudio
    );

    return finalResponse;
  } catch (error: any) {
    console.error('[Lexi Twilio] Error:', error);
    return `I encountered an error: ${error.message}`;
  }
}

/**
 * Format phone number for Twilio (E.164 format)
 * Exported for Twilio-specific phone number handling
 */
export function formatPhoneForTwilio(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If 10 digits, assume US number and add +1
  // If already has country code, just add +
  return cleaned.length === 10 ? `+1${cleaned}` : `+${cleaned}`;
}

/**
 * Format phone number from Twilio format (E.164) to 10-digit format for API calls
 */
export function formatPhoneFromTwilio(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If starts with 1 and has 11 digits (US format), remove the 1
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return cleaned.substring(1);
  }
  
  // Otherwise return as-is
  return cleaned;
}


