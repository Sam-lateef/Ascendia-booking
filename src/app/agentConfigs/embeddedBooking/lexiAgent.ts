/**
 * LEXI - Single Unified Booking Agent
 * 
 * Handles everything: conversation, business logic, and function calling
 * No orchestrator handoff - direct function execution
 */

import { fetchEmbeddedBookingContext } from '@/app/lib/embeddedBookingContext';
import { dentalOfficeInfo } from '../openDental/dentalOfficeData';
import { loadDomainPrompts } from '@/app/lib/agentConfigLoader';

// ============================================
// DATABASE CONFIGURATION CACHE
// ============================================
let lexiPersonaPrompt: string | null = null;
let lexiConfigLoaded = false;

if (typeof window === 'undefined') {
  (async () => {
    try {
      const prompts = await loadDomainPrompts();
      if (prompts.persona_prompt && prompts.persona_prompt.trim()) {
        lexiPersonaPrompt = prompts.persona_prompt;
        lexiConfigLoaded = true;
        console.log('[Lexi] ✅ Persona prompt loaded from database');
      }
      } catch {
        console.warn('[Lexi] ⚠️ Could not load persona from database, using hardcoded fallback');
      }
  })();
}

/**
 * Generate Lexi's instructions (natural, logic-based - not rigid flows)
 */
export function generateLexiInstructions(forRealtime: boolean = false): string {
  // Use database persona if loaded
  if (lexiConfigLoaded && lexiPersonaPrompt) {
    console.log('[Lexi] Using database-configured persona');
    
    const officeInfoTemplate = `OFFICE INFO
${dentalOfficeInfo.name} | ${dentalOfficeInfo.phone} | ${dentalOfficeInfo.address}
Hours: ${dentalOfficeInfo.hours.weekdays} | Weekends: ${dentalOfficeInfo.hours.saturday}
Services: ${dentalOfficeInfo.services.join(', ')}`;

    const personalizedPrompt = lexiPersonaPrompt
      .replace(/{persona_name}/g, 'Lexi')
      .replace(/{persona_role}/g, 'receptionist')
      .replace(/{company_name}/g, dentalOfficeInfo.name)
      .replace(/{OFFICE_NAME}/g, dentalOfficeInfo.name)
      .replace(/{OFFICE_PHONE}/g, dentalOfficeInfo.phone)
      .replace(/{OFFICE_ADDRESS}/g, dentalOfficeInfo.address)
      .replace(/{OFFICE_HOURS_WEEKDAYS}/g, dentalOfficeInfo.hours.weekdays)
      .replace(/{OFFICE_HOURS_SATURDAY}/g, dentalOfficeInfo.hours.saturday)
      .replace(/{OFFICE_SERVICES}/g, dentalOfficeInfo.services.join(', '));
    
    return `${personalizedPrompt}\n\n${officeInfoTemplate}`;
  }

  // Fallback: Natural, logic-based instructions
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
        FName: { type: 'string', description: 'First name', required: true },
        LName: { type: 'string', description: 'Last name', required: true },
        Birthdate: { type: 'string', description: 'Date of birth (YYYY-MM-DD)', required: true },
        WirelessPhone: { type: 'string', description: '10-digit phone number', required: true },
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
        PatNum: { type: 'number', description: 'Patient ID', required: true },
        DateStart: { type: 'string', description: 'Start date (YYYY-MM-DD)', required: true },
        DateEnd: { type: 'string', description: 'End date (YYYY-MM-DD)', required: true },
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
        dateStart: { type: 'string', description: 'Start date (YYYY-MM-DD)', required: true },
        dateEnd: { type: 'string', description: 'End date (YYYY-MM-DD)', required: true },
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
        PatNum: { type: 'number', description: 'Patient ID', required: true },
        AptDateTime: { type: 'string', description: 'Appointment date/time (YYYY-MM-DD HH:mm:ss)', required: true },
        ProvNum: { type: 'number', description: 'Provider ID', required: true },
        Op: { type: 'number', description: 'Operatory ID', required: true },
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
        AptNum: { type: 'number', description: 'Appointment ID', required: true },
        AptDateTime: { type: 'string', description: 'New date/time (YYYY-MM-DD HH:mm:ss)', required: true },
        ProvNum: { type: 'number', description: 'Provider ID', required: true },
        Op: { type: 'number', description: 'Operatory ID', required: true },
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
        AptNum: { type: 'number', description: 'Appointment ID to cancel', required: true },
      },
      required: ['AptNum'],
    },
  },
];

// Type for callback to play "one moment" audio
export type PlayOneMomentCallback = () => Promise<void>;

/**
 * Execute Lexi's tools (handles ALL functions directly)
 */
async function executeLexiTool(
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
      console.log('[Lexi] 🔵 Fetching office context...');
      const context = await fetchEmbeddedBookingContext();
      console.log(`[Lexi] ✅ Office context ready: ${context.providers.length} providers, ${context.operatories.length} operatories`);
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
      // Play "one moment" audio for patient operations
      if (playOneMomentAudio) {
        playOneMomentAudio().catch((error) => {
          console.warn('[Lexi] Failed to play "one moment" audio:', error);
        });
      }
      
      console.log(`[Lexi] 📞 Calling ${toolName} with params:`, args);
      
      // Call the booking API
      const baseUrl = typeof window !== 'undefined' 
        ? '' 
        : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
      
      const response = await fetch(`${baseUrl}/api/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important: Send cookies with request for authentication
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
      
      console.log(`[Lexi] ✅ ${toolName} succeeded:`, result);
      return JSON.stringify(result);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Handle Lexi's response iterations (function calling loop)
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
      console.error('[Lexi] Response error:', currentResponse.error);
      return 'I encountered an error processing your request.';
    }

    if (!currentResponse || !currentResponse.output) {
      console.error('[Lexi] Invalid response structure:', currentResponse);
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
        console.error(`[Lexi] ❌ ${toolName} ERROR:`, error.message);

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

  console.error(`[Lexi] ⚠️ Max iterations reached (${maxIterations})`);
  return 'I apologize, but I was unable to complete your request. Please try again.';
}

/**
 * Call Lexi (main entry point for STT/TTS mode)
 */
export async function callLexi(
  userMessage: string,
  conversationHistory: any[] = [],
  isFirstMessage: boolean = false,
  playOneMomentAudio?: () => Promise<void>
): Promise<string> {
  console.log('[Lexi] User Message:', userMessage);

  try {
    const instructions = generateLexiInstructions();
    const sessionId = `lexi_${Date.now()}`;

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
      temperature: LEXI_CONFIG.temperature, // Controls response creativity/variety
      max_tokens: LEXI_CONFIG.maxTokens, // Max response length
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
    console.error('[Lexi] Error:', error);
    return `I encountered an error: ${error.message}`;
  }
}

// ============================================
// REALTIME SDK SUPPORT (Premium Mode)
// ============================================

import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';

// Convert lexiTools to Realtime SDK format
const getCurrentDateTime = tool({
  name: 'get_datetime',
  description: 'Gets the current date and time with day name in user local timezone',
  parameters: z.object({}),
  execute: async () => {
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
  },
});

const getCurrentOfficeContext = tool({
  name: 'get_office_context',
  description: 'Fetches current office data (providers, operatories, occupied slots). Call once at conversation start.',
  parameters: z.object({}),
  execute: async () => {
    console.log('[Lexi Realtime] 🔵 Fetching office context...');
    const context = await fetchEmbeddedBookingContext();
    console.log(`[Lexi Realtime] ✅ Office context ready: ${context.providers.length} providers, ${context.operatories.length} operatories`);
    return JSON.stringify(context, null, 2);
  },
});

// Patient functions
const getMultiplePatientsRealtime = tool({
  name: 'GetMultiplePatients',
  description: 'Find patients by name or phone number',
  parameters: z.object({
    LName: z.string().nullable().optional().describe('Last name'),
    FName: z.string().nullable().optional().describe('First name'),
    Phone: z.string().nullable().optional().describe('10-digit phone number (no dashes)'),
  }),
  execute: async (params) => {
    console.log('[Lexi Realtime] 📞 GetMultiplePatients:', params);
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: Send cookies with request for authentication
      body: JSON.stringify({
        functionName: 'GetMultiplePatients',
        parameters: params,
        sessionId: `realtime_${Date.now()}`,
        conversationHistory: []
      })
    });
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: true, 
        message: `Server error: ${response.statusText}` 
      }));
      console.log('[Lexi Realtime] ❌ GetMultiplePatients HTTP error:', errorData);
      return JSON.stringify({
        error: true,
        message: errorData.message || 'Failed to search for patients',
        status: response.status
      });
    }
    
    const result = await response.json();
    
    // Log if result has error flag
    if (result.error) {
      console.log('[Lexi Realtime] ⚠️ GetMultiplePatients returned error:', result.message);
    } else {
      console.log('[Lexi Realtime] ✅ GetMultiplePatients result:', result);
    }
    
    return JSON.stringify(result);
  },
});

const createPatientRealtime = tool({
  name: 'CreatePatient',
  description: 'Create a new patient record',
  parameters: z.object({
    FName: z.string().describe('First name'),
    LName: z.string().describe('Last name'),
    Birthdate: z.string().describe('Date of birth (YYYY-MM-DD)'),
    WirelessPhone: z.string().describe('10-digit phone number'),
  }),
  execute: async (params) => {
    console.log('[Lexi Realtime] 📞 CreatePatient:', params);
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: Send cookies with request for authentication
      body: JSON.stringify({
        functionName: 'CreatePatient',
        parameters: params,
        sessionId: `realtime_${Date.now()}`,
        conversationHistory: []
      })
    });
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: true, 
        message: `Server error: ${response.statusText}` 
      }));
      console.log('[Lexi Realtime] ❌ CreatePatient HTTP error:', errorData);
      return JSON.stringify({
        error: true,
        message: errorData.message || 'Failed to create patient',
        status: response.status
      });
    }
    
    const result = await response.json();
    
    // Log if result has error flag
    if (result.error) {
      console.log('[Lexi Realtime] ⚠️ CreatePatient returned error:', result.message);
    } else {
      console.log('[Lexi Realtime] ✅ CreatePatient result:', result);
    }
    
    return JSON.stringify(result);
  },
});

const getAppointmentsRealtime = tool({
  name: 'GetAppointments',
  description: 'Get all appointments for a patient in a date range',
  parameters: z.object({
    PatNum: z.number().describe('Patient ID'),
    DateStart: z.string().describe('Start date (YYYY-MM-DD)'),
    DateEnd: z.string().describe('End date (YYYY-MM-DD)'),
  }),
  execute: async (params) => {
    console.log('[Lexi Realtime] 📞 GetAppointments:', params);
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: Send cookies with request for authentication
      body: JSON.stringify({
        functionName: 'GetAppointments',
        parameters: params,
        sessionId: `realtime_${Date.now()}`,
        conversationHistory: []
      })
    });
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: true, 
        message: `Server error: ${response.statusText}` 
      }));
      console.log('[Lexi Realtime] ❌ GetAppointments HTTP error:', errorData);
      return JSON.stringify({
        error: true,
        message: errorData.message || 'Failed to get appointments',
        status: response.status
      });
    }
    
    const result = await response.json();
    
    // Log if result has error flag
    if (result.error) {
      console.log('[Lexi Realtime] ⚠️ GetAppointments returned error:', result.message);
    } else {
      console.log('[Lexi Realtime] ✅ GetAppointments result:', result);
    }
    
    return JSON.stringify(result);
  },
});

const getAvailableSlotsRealtime = tool({
  name: 'GetAvailableSlots',
  description: 'Find available appointment time slots for a date',
  parameters: z.object({
    dateStart: z.string().describe('Start date (YYYY-MM-DD)'),
    dateEnd: z.string().describe('End date (YYYY-MM-DD)'),
    ProvNum: z.number().nullable().optional().describe('Provider ID (default: 1)'),
    OpNum: z.number().nullable().optional().describe('Operatory ID (default: 1)'),
  }),
  execute: async (params) => {
    console.log('[Lexi Realtime] 📞 GetAvailableSlots:', params);
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: Send cookies with request for authentication
      body: JSON.stringify({
        functionName: 'GetAvailableSlots',
        parameters: params,
        sessionId: `realtime_${Date.now()}`,
        conversationHistory: []
      })
    });
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: true, 
        message: `Server error: ${response.statusText}` 
      }));
      console.log('[Lexi Realtime] ❌ GetAvailableSlots HTTP error:', errorData);
      return JSON.stringify({
        error: true,
        message: errorData.message || 'Failed to get available slots',
        status: response.status
      });
    }
    
    const result = await response.json();
    
    // Log if result has error flag
    if (result.error) {
      console.log('[Lexi Realtime] ⚠️ GetAvailableSlots returned error:', result.message);
    } else {
      console.log('[Lexi Realtime] ✅ GetAvailableSlots result:', result);
    }
    
    return JSON.stringify(result);
  },
});

const createAppointmentRealtime = tool({
  name: 'CreateAppointment',
  description: 'Book a new appointment',
  parameters: z.object({
    PatNum: z.number().describe('Patient ID'),
    AptDateTime: z.string().describe('Appointment date/time (YYYY-MM-DD HH:mm:ss)'),
    ProvNum: z.number().describe('Provider ID'),
    Op: z.number().describe('Operatory ID'),
    Note: z.string().nullable().optional().describe('Appointment type/note'),
  }),
  execute: async (params) => {
    console.log('[Lexi Realtime] 📞 CreateAppointment:', params);
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: Send cookies with request for authentication
      body: JSON.stringify({
        functionName: 'CreateAppointment',
        parameters: params,
        sessionId: `realtime_${Date.now()}`,
        conversationHistory: []
      })
    });
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: true, 
        message: `Server error: ${response.statusText}` 
      }));
      console.log('[Lexi Realtime] ❌ CreateAppointment HTTP error:', errorData);
      return JSON.stringify({
        error: true,
        message: errorData.message || 'Failed to create appointment',
        status: response.status
      });
    }
    
    const result = await response.json();
    
    // Log if result has error flag
    if (result.error) {
      console.log('[Lexi Realtime] ⚠️ CreateAppointment returned error:', result.message);
    } else {
      console.log('[Lexi Realtime] ✅ CreateAppointment result:', result);
    }
    
    return JSON.stringify(result);
  },
});

const updateAppointmentRealtime = tool({
  name: 'UpdateAppointment',
  description: 'Reschedule an existing appointment',
  parameters: z.object({
    AptNum: z.number().describe('Appointment ID'),
    AptDateTime: z.string().describe('New date/time (YYYY-MM-DD HH:mm:ss)'),
    ProvNum: z.number().describe('Provider ID'),
    Op: z.number().describe('Operatory ID'),
  }),
  execute: async (params) => {
    console.log('[Lexi Realtime] 📞 UpdateAppointment:', params);
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: Send cookies with request for authentication
      body: JSON.stringify({
        functionName: 'UpdateAppointment',
        parameters: params,
        sessionId: `realtime_${Date.now()}`,
        conversationHistory: []
      })
    });
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: true, 
        message: `Server error: ${response.statusText}` 
      }));
      console.log('[Lexi Realtime] ❌ UpdateAppointment HTTP error:', errorData);
      return JSON.stringify({
        error: true,
        message: errorData.message || 'Failed to update appointment',
        status: response.status
      });
    }
    
    const result = await response.json();
    
    // Log if result has error flag
    if (result.error) {
      console.log('[Lexi Realtime] ⚠️ UpdateAppointment returned error:', result.message);
    } else {
      console.log('[Lexi Realtime] ✅ UpdateAppointment result:', result);
    }
    
    return JSON.stringify(result);
  },
});

const breakAppointmentRealtime = tool({
  name: 'BreakAppointment',
  description: 'Cancel an appointment',
  parameters: z.object({
    AptNum: z.number().describe('Appointment ID to cancel'),
  }),
  execute: async (params) => {
    console.log('[Lexi Realtime] 📞 BreakAppointment:', params);
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: Send cookies with request for authentication
      body: JSON.stringify({
        functionName: 'BreakAppointment',
        parameters: params,
        sessionId: `realtime_${Date.now()}`,
        conversationHistory: []
      })
    });
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: true, 
        message: `Server error: ${response.statusText}` 
      }));
      console.log('[Lexi Realtime] ❌ BreakAppointment HTTP error:', errorData);
      return JSON.stringify({
        error: true,
        message: errorData.message || 'Failed to cancel appointment',
        status: response.status
      });
    }
    
    const result = await response.json();
    
    // Log if result has error flag
    if (result.error) {
      console.log('[Lexi Realtime] ⚠️ BreakAppointment returned error:', result.message);
    } else {
      console.log('[Lexi Realtime] ✅ BreakAppointment result:', result);
    }
    
    return JSON.stringify(result);
  },
});

/**
 * Lexi as a Realtime Agent (for Premium mode)
 * Note: Model is set at session level (gpt-4o-realtime-preview-2025-06-03)
 */
/**
 * Voice & Personality Configuration
 */
export const LEXI_CONFIG = {
  // Voice Selection (Realtime API voices)
  // Options: 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'
  // NOTE: 'nova' is NOT available for Realtime - use 'sage' or 'coral' instead
  voice: 'coral', // ⚠️ Changed back from 'nova' (not available in Realtime API)
  
  // Temperature: Controls randomness/creativity (0.0 - 2.0)
  // 0.6 = Natural conversation with some variety
  // 0.8 = More creative/varied (default for chat)
  // 1.0 = Balanced creativity and consistency
  temperature: 1.0,
  
  // Max Response Tokens (controls OUTPUT response length, NOT input instructions length)
  // Instructions can be 10,000+ tokens - this only limits how long Lexi's responses are
  maxResponseOutputTokens: 4096, // Realtime API parameter
  maxTokens: 1000, // Non-Realtime API parameter (1000 tokens ≈ 750 words ≈ concise voice response)
};

export const lexiRealtimeAgent = new RealtimeAgent({
  name: 'Lexi',
  voice: LEXI_CONFIG.voice,
  
  instructions: generateLexiInstructions(true), // forRealtime=true
  
  // Temperature and other session config will be set at session.update level
  // (not in agent definition - see session configuration in agent-ui/page.tsx or twilio handler)
  
  tools: [
    getCurrentDateTime,
    getCurrentOfficeContext,
    getMultiplePatientsRealtime,
    createPatientRealtime,
    getAppointmentsRealtime,
    getAvailableSlotsRealtime,
    createAppointmentRealtime,
    updateAppointmentRealtime,
    breakAppointmentRealtime,
  ],
});

export const lexiRealtimeScenario = [lexiRealtimeAgent];

