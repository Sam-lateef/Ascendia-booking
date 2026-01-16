/**
 * STANDARD MODE - Two-Agent Twilio WebSocket Handler
 * 
 * Cost-optimized version using:
 * - Lexi (gpt-4o-mini-realtime) - handles conversation naturally
 * - Supervisor (gpt-4o via Responses API) - handles actual tool execution
 * 
 * This approach reduces costs significantly compared to Premium mode:
 * - gpt-4o-mini for realtime conversation (60-80% cheaper than gpt-4o)
 * - gpt-4o supervisor only called when actions are needed
 * - Maintains quality for complex booking operations
 */

import WebSocket from 'ws';
import { callSupervisor } from '@/app/agentConfigs/embeddedBooking/supervisorAgent';
import { dentalOfficeInfo } from '@/app/agentConfigs/openDental/dentalOfficeData';
import { 
  processMessage, 
  addMessage, 
  recordFunctionCall,
  getOrCreateState 
} from '@/app/lib/conversationState';
import { getAgentInstructions } from '@/app/lib/agentMode';

interface TwilioMessage {
  event: string;
  sequenceNumber?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  mark?: {
    name: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

// ============================================
// LEXI CHAT AGENT INSTRUCTIONS (gpt-4o-mini)
// ============================================
// COMPREHENSIVE PREMIUM-QUALITY INSTRUCTIONS
// Synced with lexiStandardAgent.ts

const lexiChatInstructions = `IDENTITY & PERSONALITY
You are Lexi, the receptionist at ${dentalOfficeInfo.name}. You are helping patients with their booking requests, rescheduling requests, checking appointment times, canceling requests and general questions about the office (hours, services, location).

thinking like a dental receptionist and use the guidelines and tools provided to you to help the patients with their requests. 

you handle the talking and the supervisor handles the booking logic. so your job is to extract patient intent and info, phone, first name, last name, date of birth, etc. and pass it to the supervisor to handle all booking logic using its tools and functions and return a response to you to speak to the patient.

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

When the call starts, say: "Hi! Welcome to ${dentalOfficeInfo.name}. This is Lexi. How can I help you today?"

OFFICE INFO:
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
YOUR JOB - COLLECT INFO AND HAND OFF TO SUPERVISOR
═══════════════════════════════════════════════════════════════════════════════

YOU handle:
- Greetings and warm conversation
- Asking for information (phone number, name, DOB, dates, times, preferences)
- Reading back phone numbers digit by digit for verification
- Spelling back names to confirm
- Confirming dates of birth in spoken format

SUPERVISOR handles (via getNextResponseFromSupervisor tool):
- Looking up patients by phone
- Checking existing appointments
- Finding available time slots
- Booking new appointments
- Rescheduling appointments
- Canceling appointments

═══════════════════════════════════════════════════════════════════════════════
VERIFICATION PROTOCOLS (VOICE-CRITICAL - ALWAYS FOLLOW)
═══════════════════════════════════════════════════════════════════════════════

PHONE NUMBERS (Primary Identifier):
Always read back digit by digit, grouped naturally:
- "I have 6-1-9, 5-5-5, 1-2-3-4. Is that correct?"
- If wrong, ask them to repeat the whole number, then verify again
- Never assume - one wrong digit = can't find patient

NAME SPELLING:
Voice is unreliable. Always spell back names before passing to supervisor.
- "Let me confirm the spelling - that's John, J-O-H-N, Smith, S-M-I-T-H?"
- If they correct you, spell back again until confirmed
- Common confusions: Jon/John, Ann/Anne, Smith/Smyth, Lee/Li, Sara/Sarah

DATE OF BIRTH:
Confirm in spoken format:
- "Your date of birth is January 15th, 1990 - is that right?"
- Watch for: day/month confusion, year mistakes (1990 vs 1980)

═══════════════════════════════════════════════════════════════════════════════
PATIENT LOOKUP (ALWAYS START WITH PHONE NUMBER)
═══════════════════════════════════════════════════════════════════════════════

**CRITICAL - PHONE NUMBER IS REQUIRED FIRST:**
Every booking operation starts with phone number. This is the PRIMARY identifier.

STEP 1 - Get Phone Number:
- "Can I get your phone number please?"
- Read back digit by digit to confirm: "6-1-9, 5-5-5, 1-2-3-4?"
- **DO NOT proceed without confirmed phone number**

STEP 2 - Call Supervisor to Look Up:
- Say: "Let me look that up."
- Call getNextResponseFromSupervisor with: "Phone number: 6195551234"
- Pass 10 digits, no dashes

STEP 3 - Handle Supervisor's Response:

If ONE patient found:
- Supervisor will say: "I found [Name] - is that you?"
- Read this naturally to patient
- If patient confirms, proceed with their request

If MULTIPLE patients found (family members share phones):
- Supervisor will say: "I see a few people at that number..."
- Read options to patient
- Get first name to identify them
- Call supervisor with: "Patient is [First Name]"

If NO patients found:
- Supervisor will say: "I'm not finding anyone at that number. Are you a new patient?"
- Read this to patient
- If new patient, go to NEW PATIENT FLOW

═══════════════════════════════════════════════════════════════════════════════
NEW PATIENT FLOW
═══════════════════════════════════════════════════════════════════════════════

When supervisor says patient not found:

1. CONFIRM THEY'RE NEW:
   - "It looks like you're new to our office. Let me get you set up - it'll just take a moment."

2. COLLECT INFO (in this order):
   a. First name → spell back: "That's John, J-O-H-N?"
   b. Last name → spell back: "Smith, S-M-I-T-H?"
   c. Date of birth → confirm: "January 15th, 1990?"
   d. Phone number → already have it from step 1!

3. VERIFY EVERYTHING:
   - "Let me make sure I have everything right: John Smith, spelled J-O-H-N S-M-I-T-H, 
     born January 15th 1990, phone 6-1-9, 5-5-5, 1-2-3-4. All correct?"
   - Wait for explicit "yes"

4. CALL SUPERVISOR:
   - Say: "Perfect, let me get you set up."
   - Call with: "New patient: John Smith (J-O-H-N S-M-I-T-H), DOB: January 15 1990, phone: 6195551234"
   - **Include the phone number from step 1**

5. PROCEED TO BOOKING:
   - Supervisor will confirm creation
   - "Now let's get you scheduled. What type of appointment do you need?"

═══════════════════════════════════════════════════════════════════════════════
BOOKING APPOINTMENT FLOW
═══════════════════════════════════════════════════════════════════════════════

1. ASK WHAT THEY NEED:
   - "What type of appointment do you need - cleaning, checkup, or something else?"
   - "When would you like to come in?"

2. ASK FOR PREFERENCES:
   - "Do you have a doctor you usually see, or whoever is available first?"
   - Note any specific preferences

3. CALL SUPERVISOR:
   - Say: "Let me see what's available."
   - Call with: "Book appointment on [date], service: [type], prefers: [doctor if mentioned], time: [if mentioned]"

4. SUPERVISOR RETURNS OPTIONS:
   - Supervisor will say: "I have 9 AM, 10:30 AM, or 2 PM with Dr. Pearl. What works best?"
   - Read this naturally: "Let me see... yeah, we have a 9, 10:30, or 2. What works better for you?"

5. PATIENT CHOOSES TIME:
   - Patient says: "10 AM works"
   - **CRITICAL - YOU MUST CONFIRM BEFORE BOOKING:**
   - Say: "Perfect! I'll book your [service] with Dr. [Name] on [Day], [Date] at [Time]. Should I confirm that?"
   - **WAIT for explicit "yes" or "that's fine" or "sure"**
   - **DO NOT proceed without confirmation**
   - If they say anything else, ask again or adjust the appointment

6. CALL SUPERVISOR TO BOOK:
   - Say filler: "Perfect, let me book that."
   - Call with: "Confirm booking at 10 AM on [date] with Dr. Pearl"

7. SUPERVISOR CONFIRMS:
   - Read confirmation warmly: "You're all set! You're booked for [service] with Dr. [Name] on [Day], [Date] at [Time]."
   - "You'll get a confirmation text at [phone]."
   - END - don't ask follow-up questions

═══════════════════════════════════════════════════════════════════════════════
RESCHEDULING FLOW
═══════════════════════════════════════════════════════════════════════════════

1. GET PHONE NUMBER (as always):
   - "Can I get your phone number please?"
   - Verify digit by digit

2. CALL SUPERVISOR:
   - Say: "Let me pull up your appointments."
   - Call with: "Get appointments for patient at phone [number]"

3. SUPERVISOR RETURNS APPOINTMENTS:
   - If multiple: "I see you have appointments on [date] and [date]. Which one did you want to reschedule?"
   - If one: "You have a [service] on [date] at [time]. Is that the one?"

4. GET NEW PREFERRED DATE:
   - "When would you like to move it to?"

5. CALL SUPERVISOR:
   - Say: "Let me see what's available."
   - Call with: "Reschedule appointment to [new date], prefers [time if mentioned]"

6. SUPERVISOR RETURNS OPTIONS:
   - Present naturally to patient

7. CONFIRM AND BOOK:
   - "I'll move your [service] from [old date/time] to [new date/time] with Dr. [Name]. Should I confirm?"
   - Wait for "yes"
   - Call supervisor to confirm

8. DONE:
   - "Done! Your appointment is now [Day], [Date] at [Time]."
   - END

═══════════════════════════════════════════════════════════════════════════════
CANCELING FLOW
═══════════════════════════════════════════════════════════════════════════════

1. GET PHONE NUMBER (as always)

2. CALL SUPERVISOR:
   - "Get appointments for patient at phone [number]"

3. OFFER RESCHEDULE FIRST:
   - "Before I cancel, would you like to reschedule for another day instead?"
   - If they want to reschedule, go to RESCHEDULING flow

4. IF THEY INSIST ON CANCELING:
   - Confirm which appointment
   - "I'll cancel your [service] on [date] at [time]. Is that correct?"
   - Wait for "yes"
   - Call supervisor: "Cancel appointment on [date]"

5. CONFIRM:
   - "Done. Your appointment has been cancelled."
   - "Would you like to book a future appointment now, or call back later?"
   - If "call back later": "Sounds good. We'll be here when you're ready."
   - END

═══════════════════════════════════════════════════════════════════════════════
HOW TO CALL SUPERVISOR
═══════════════════════════════════════════════════════════════════════════════

**CRITICAL - ALWAYS SAY FILLER PHRASE FIRST:**
Before EVERY call to getNextResponseFromSupervisor, you MUST say one of these:
- "Let me check that for you."
- "Let me look that up."
- "Just a moment."
- "Let me see what's available."
- "Let me pull up your appointments."

Then call getNextResponseFromSupervisor with clear, detailed context.

**NEVER call the supervisor without saying a filler phrase first!**

WHAT TO PUT IN relevantContextFromLastUserMessage:
- Phone numbers (10 digits, no dashes)
- Names (with spelling if you collected it: "John Smith (J-O-H-N S-M-I-T-H)")
- Dates/times mentioned
- What they want to do (book, reschedule, cancel)
- Any preferences (doctor, time of day, service type)
- Which appointment (if rescheduling/canceling multiple)

GOOD EXAMPLES:
"Phone number: 6195551234"
"New patient: Yousef Saddam (Y-O-U-S-E-F S-A-D-D-A-M), DOB: March 7 2006, phone: 6195551234"
"Book appointment on January 16th, service: cleaning, prefers: morning, phone: 6195551234"
"Patient wants 10 AM with Dr. Pearl on January 16th"
"Reschedule appointment from Tuesday to Thursday"
"Cancel appointment on January 10th at 2 PM"
"Patient is John (from the list of family members)"

BAD EXAMPLES:
"help with appointment" (too vague - no details)
"user wants to book" (missing phone, date, preferences)
"appointment stuff" (completely useless)

═══════════════════════════════════════════════════════════════════════════════
WHEN SUPERVISOR RESPONDS
═══════════════════════════════════════════════════════════════════════════════

Read supervisor's response NATURALLY to the patient:
- Don't say "my supervisor said" or "the system says"
- Speak it as if it's your own words
- Keep your warm, conversational tone
- Make it sound natural

Examples:
Supervisor: "I found Sam Latif at that number. Is that you?"
You: "I found Sam Latif at that number. Is that you?"

Supervisor: "I have openings at 9 AM, 10:30 AM, or 2 PM with Dr. Pearl. What works best?"
You: "Let me see... yeah, we have a 9, 10:30, or 2. What works better for you?"

Supervisor: "Oh, that slot just got taken. Let me find another time..."
You: "Oh darn, that slot just got taken. Let me see what else is open..."

═══════════════════════════════════════════════════════════════════════════════
HANDLING PROBLEMS
═══════════════════════════════════════════════════════════════════════════════

PATIENT GOES SILENT:
- Wait 3-4 seconds, then: "Are you still there?"
- If they need to check something: "No problem, take your time."

PATIENT CHANGES MIND:
- "Actually, can we do a different day?"
- No problem - restart availability check
- Stay helpful, never frustrated

PATIENT CAN'T REMEMBER INFO:
- If they don't know their DOB: "No worries - I can look you up by phone number."

INFO DOESN'T MATCH:
- "I have a different phone number on file. Would you like me to update it?"

═══════════════════════════════════════════════════════════════════════════════
REMEMBER:
1. YOU collect info warmly and naturally - SUPERVISOR does booking logic
2. Always verify phone numbers digit by digit
3. Always spell back names for new patients
4. Confirm DOB in spoken format
5. Pass clear, detailed context to supervisor
6. Say filler phrase before calling supervisor
7. Read supervisor's response in your own natural style
8. Confirm before booking: "Should I confirm that?"
9. Stay in your lane - redirect off-topic questions politely
10. END conversations after completing tasks - don't ask "anything else?"
═══════════════════════════════════════════════════════════════════════════════
`;

// ============================================
// LEXI CHAT AGENT TOOL
// ============================================

const lexiTools = [
  {
    type: 'function',
    name: 'getNextResponseFromSupervisor',
    description: 'Ask the supervisor agent to handle complex requests like patient lookup, scheduling, rescheduling, or canceling. Returns a response to speak to the patient.',
    parameters: {
      type: 'object',
      properties: {
        relevantContextFromLastUserMessage: {
          type: 'string',
          description: 'Key information from the user (phone number, dates, times, preferences). Be concise.',
        },
      },
      required: ['relevantContextFromLastUserMessage'],
    },
  },
];

// ============================================
// CONNECTION STATE
// ============================================

interface ConnectionState {
  streamSid: string | null;
  callSid: string | null;
  openaiWs: WebSocket | null;
  openaiReady: boolean;
  audioQueue: string[];
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  // Track booking state to avoid duplicate operations across supervisor calls
  bookingState: {
    // Patient info
    patNum?: number;
    phone?: string;
    firstName?: string;
    lastName?: string;
    // Appointment info
    aptNum?: number;  // Created or existing appointment
    // Slot selection
    availableSlots?: Array<{ AptDateTime: string; ProvNum: number; Op: number }>;
    selectedSlot?: { AptDateTime: string; ProvNum: number; Op: number };
    // Track what's been done
    patientLookedUp?: boolean;
    slotsQueried?: boolean;
    appointmentCreated?: boolean;
  };
}

/**
 * Handle a Twilio Media Stream WebSocket connection (Standard Mode)
 */
function handleTwilioConnectionStandard(twilioWs: WebSocket) {
  console.log('[Standard WS] 🟢 Client connected');

  // Use hardcoded instructions for reliability (DB loading was causing async issues)
  const receptionistInstructionsToUse = lexiChatInstructions;
  const supervisorInstructionsToUse: string | undefined = undefined; // undefined = use default in supervisorAgent

  const state: ConnectionState = {
    streamSid: null,
    callSid: null,
    openaiWs: null,
    openaiReady: false,
    audioQueue: [],
    conversationHistory: [],
    bookingState: {},
  };

  // Create OpenAI Realtime WebSocket (gpt-4o-mini for chat)
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('[Standard WS] ❌ OPENAI_API_KEY not configured');
    twilioWs.close();
    return;
  }

  try {
    // Use gpt-4o-mini-realtime for cost optimization
    // Model: gpt-4o-mini-realtime-preview-2024-12-17 (verified December 2024)
    const modelName = 'gpt-4o-mini-realtime-preview-2024-12-17';
    console.log(`[Standard WS] 🔌 Connecting to OpenAI Realtime with model: ${modelName}`);
    
    state.openaiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${modelName}`,
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      }
    );

    state.openaiWs.on('open', () => {
      console.log('[Standard WS] ✅ Connected to OpenAI Realtime (gpt-4o-mini)');
      
      // Configure session
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: receptionistInstructionsToUse,
          voice: 'sage',
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: {
            model: 'gpt-4o-mini-transcribe',
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,           // How loud to detect speech (0.0-1.0)
            prefix_padding_ms: 300,   // Audio to include before speech
            silence_duration_ms: 700, // Wait 700ms of silence before ending turn (increased from 200ms)
          },
          tools: lexiTools.map(tool => ({
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      };

      state.openaiWs!.send(JSON.stringify(sessionUpdate));
      console.log('[Standard WS] 📤 Session configured (two-agent mode)');

      // Mark OpenAI as ready and process queued audio
      state.openaiReady = true;
      if (state.audioQueue.length > 0) {
        console.log(`[Standard WS] 📦 Processing ${state.audioQueue.length} queued audio packets`);
        for (const audioPayload of state.audioQueue) {
          state.openaiWs!.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: audioPayload,
          }));
        }
        state.audioQueue.length = 0;
      }

      // CRITICAL: Trigger the initial greeting immediately after session is configured
      // The instructions tell the model to greet when the call starts, but we need to 
      // explicitly trigger a response for the model to start speaking
      console.log('[Standard WS] 🎤 Triggering initial greeting...');
      state.openaiWs!.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: 'Start the conversation by greeting the caller warmly.',
        },
      }));
    });

    state.openaiWs.on('message', async (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString());

        // Log key events for debugging (skip only the most verbose ones)
        const skipLogEvents = [
          'response.audio.delta',
          'response.audio_transcript.delta',
          'conversation.item.input_audio_transcription.delta',
          'response.function_call_arguments.delta',
          'input_audio_buffer.speech_started',
          'input_audio_buffer.speech_stopped',
          'input_audio_buffer.committed',
          'rate_limits.updated',
        ];
        if (!skipLogEvents.includes(response.type)) {
          console.log('[Standard WS] 📨 OpenAI event:', response.type);
        }

        if (response.type === 'session.updated') {
          console.log('[Standard WS] ✅ Session updated successfully');
        }

        // Audio from OpenAI → Twilio
        if (response.type === 'response.audio.delta' && response.delta) {
          // Audio delta logging removed - too verbose
          if (twilioWs.readyState === WebSocket.OPEN && state.streamSid) {
            twilioWs.send(JSON.stringify({
              event: 'media',
              streamSid: state.streamSid,
              media: { payload: response.delta }
            }));
          } else {
            console.log('[Standard WS] ⚠️ Cannot send audio - Twilio not ready or no streamSid');
          }
        }

        // Handle getNextResponseFromSupervisor tool call
        if (response.type === 'response.function_call_arguments.done') {
          if (response.name === 'getNextResponseFromSupervisor') {
            console.log('[Standard WS] Calling supervisor...');
            
            try {
              const args = JSON.parse(response.arguments);
              let context = args.relevantContextFromLastUserMessage || '';

              // CRITICAL: Build booking state context to avoid duplicate operations
              const stateContext: string[] = [];
              
              if (state.bookingState.patNum) {
                stateContext.push(`[EXISTING PATIENT - PatNum: ${state.bookingState.patNum}] - DO NOT call CreatePatient or GetMultiplePatients again`);
              }
              if (state.bookingState.phone) {
                stateContext.push(`[Patient phone: ${state.bookingState.phone}]`);
              }
              if (state.bookingState.firstName || state.bookingState.lastName) {
                stateContext.push(`[Patient name: ${state.bookingState.firstName || ''} ${state.bookingState.lastName || ''}]`);
              }
              if (state.bookingState.availableSlots && state.bookingState.availableSlots.length > 0) {
                stateContext.push(`[AVAILABLE SLOTS already queried - DO NOT call GetAvailableSlots again unless patient wants different date]`);
                stateContext.push(`[Slots: ${JSON.stringify(state.bookingState.availableSlots.slice(0, 5))}]`);
              }
              if (state.bookingState.selectedSlot) {
                stateContext.push(`[SELECTED SLOT: ${JSON.stringify(state.bookingState.selectedSlot)}]`);
              }
              if (state.bookingState.aptNum) {
                stateContext.push(`[APPOINTMENT CREATED - AptNum: ${state.bookingState.aptNum}] - DO NOT call CreateAppointment again`);
              }
              
              if (stateContext.length > 0) {
                context = `=== BOOKING STATE (from previous calls) ===\n${stateContext.join('\n')}\n\n=== NEW REQUEST ===\n${context}`;
                console.log('[Standard WS] 📋 Including booking state:', stateContext.length, 'items');
              }

              // Call supervisor agent (gpt-4o)
              const result = await callSupervisor(
                state.conversationHistory,
                context,
                `standard_${state.callSid}`,
                supervisorInstructionsToUse
              );

              console.log('[Standard WS] Supervisor response received');

              // Extract and store all relevant tool results for state tracking
              
              // CreatePatient - store PatNum
              if (result.toolResults?.CreatePatient) {
                const createResult = result.toolResults.CreatePatient as { PatNum?: number; FName?: string; LName?: string };
                if (createResult?.PatNum) {
                  state.bookingState.patNum = createResult.PatNum;
                  state.bookingState.firstName = createResult.FName;
                  state.bookingState.lastName = createResult.LName;
                  console.log('[Standard WS] 📋 Stored PatNum from CreatePatient:', state.bookingState.patNum);
                }
              }
              
              // GetMultiplePatients - store PatNum if found
              if (result.toolResults?.GetMultiplePatients) {
                const patients = result.toolResults.GetMultiplePatients as Array<{ PatNum?: number; FName?: string; LName?: string; WirelessPhone?: string }>;
                if (Array.isArray(patients) && patients.length > 0 && patients[0]?.PatNum) {
                  state.bookingState.patNum = patients[0].PatNum;
                  state.bookingState.firstName = patients[0].FName;
                  state.bookingState.lastName = patients[0].LName;
                  state.bookingState.phone = patients[0].WirelessPhone;
                  state.bookingState.patientLookedUp = true;
                  console.log('[Standard WS] 📋 Stored PatNum from GetMultiplePatients:', state.bookingState.patNum);
                }
              }
              
              // GetAvailableSlots - store available slots
              if (result.toolResults?.GetAvailableSlots) {
                const slots = result.toolResults.GetAvailableSlots as Array<{ AptDateTime: string; ProvNum: number; Op: number }>;
                if (Array.isArray(slots) && slots.length > 0) {
                  state.bookingState.availableSlots = slots;
                  state.bookingState.slotsQueried = true;
                  console.log('[Standard WS] 📋 Stored', slots.length, 'available slots');
                }
              }
              
              // CreateAppointment - store AptNum
              if (result.toolResults?.CreateAppointment) {
                const aptResult = result.toolResults.CreateAppointment as { AptNum?: number; AptDateTime?: string };
                if (aptResult?.AptNum) {
                  state.bookingState.aptNum = aptResult.AptNum;
                  state.bookingState.appointmentCreated = true;
                  // Store the slot that was used
                  if (aptResult.AptDateTime) {
                    state.bookingState.selectedSlot = state.bookingState.availableSlots?.find(
                      s => s.AptDateTime === aptResult.AptDateTime
                    );
                  }
                  console.log('[Standard WS] 📋 Stored AptNum from CreateAppointment:', state.bookingState.aptNum);
                }
              }
              
              // GetAppointments - store existing appointment info for reschedule/cancel
              if (result.toolResults?.GetAppointments) {
                const appointments = result.toolResults.GetAppointments as Array<{ AptNum?: number }>;
                if (Array.isArray(appointments) && appointments.length > 0 && appointments[0]?.AptNum) {
                  state.bookingState.aptNum = appointments[0].AptNum;
                  console.log('[Standard WS] 📋 Stored AptNum from GetAppointments:', state.bookingState.aptNum);
                }
              }

              // Record the supervisor call
              if (state.callSid) {
                recordFunctionCall(
                  `standard_${state.callSid}`,
                  'getNextResponseFromSupervisor',
                  args,
                  { response: result.response, toolsCalled: result.toolsCalled, toolResults: result.toolResults },
                  result.error,
                  {}
                );
              }

              // Send response back to OpenAI Realtime
              state.openaiWs!.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: response.call_id,
                  output: JSON.stringify({ nextResponse: result.response }),
                },
              }));

              // Trigger response generation
              state.openaiWs!.send(JSON.stringify({ type: 'response.create' }));

            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error('[Standard WS] ❌ Supervisor error:', errorMessage);

              if (state.callSid) {
                recordFunctionCall(
                  `standard_${state.callSid}`,
                  'getNextResponseFromSupervisor',
                  JSON.parse(response.arguments || '{}'),
                  undefined,
                  errorMessage,
                  {}
                );
              }

              state.openaiWs!.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: response.call_id,
                  output: JSON.stringify({ 
                    nextResponse: "I'm having a little trouble with our system. Could you hold on just a moment?" 
                  }),
                },
              }));

              state.openaiWs!.send(JSON.stringify({ type: 'response.create' }));
            }
          }
        }

        // User speech transcription
        if (response.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = response.transcript;
          if (transcript && transcript.trim() && state.callSid) {
            // Transcript logging removed - too verbose
            processMessage(`standard_${state.callSid}`, transcript.trim(), 'user');
            state.conversationHistory.push({ role: 'user', content: transcript.trim() });
          }
        }

        // Assistant speech transcription
        if (response.type === 'response.audio_transcript.done') {
          const transcript = response.transcript;
          if (transcript && transcript.trim() && state.callSid) {
            // Transcript logging removed - too verbose
            addMessage(`standard_${state.callSid}`, 'assistant', transcript.trim());
            state.conversationHistory.push({ role: 'assistant', content: transcript.trim() });
          }
        }

        // Speech start/stop logging removed - too verbose

        if (response.type === 'error') {
          console.error('[Standard WS] ❌ OpenAI error:', response.error);
        }

      } catch (error) {
        console.error('[Standard WS] ❌ Error processing OpenAI message:', error);
      }
    });

    state.openaiWs.on('error', (error: Error) => {
      console.error('[Standard WS] ❌ OpenAI WebSocket error:', error.message);
      console.error('[Standard WS] ❌ Error details:', error);
      // Mark as not ready to prevent audio forwarding to broken connection
      state.openaiReady = false;
    });

    state.openaiWs.on('close', (code: number, reason: Buffer) => {
      console.log(`[Standard WS] 🔴 OpenAI connection closed - Code: ${code}, Reason: ${reason?.toString() || 'none'}`);
      state.openaiReady = false;
    });

  } catch (error) {
    console.error('[Standard WS] ❌ Failed to create OpenAI connection:', error);
    twilioWs.close();
    return;
  }

  // Keep-alive
  const keepAlive = setInterval(() => {
    if (twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({ event: 'mark', streamSid: state.streamSid }));
    }
  }, 20000);

  // Handle Twilio messages
  twilioWs.on('message', (message: WebSocket.Data) => {
    try {
      const msg: TwilioMessage = JSON.parse(message.toString());
      
      // Log connection events for debugging
      if (msg.event === 'start' || msg.event === 'stop' || msg.event === 'connected') {
        console.log('[Standard WS] 📩 Twilio event:', msg.event);
      }

      switch (msg.event) {
        case 'start':
          state.streamSid = msg.start!.streamSid;
          state.callSid = msg.start!.callSid;
          console.log('[Standard WS] 📞 Call started:', state.callSid);
          console.log('[Standard WS] 🎵 Mode: Two-Agent (gpt-4o-mini + gpt-4o supervisor)');
          console.log('[Standard WS] 📡 Media format:', JSON.stringify(msg.start!.mediaFormat));
          console.log('[Standard WS] 🔗 OpenAI connection ready:', state.openaiReady);
          
          // Initialize conversation state
          if (state.callSid) {
            const convState = getOrCreateState(`standard_${state.callSid}`);
            convState.intent = 'unknown';
            console.log('[Standard WS] 📊 Conversation state initialized');
          }
          
          // If OpenAI is already connected but greeting hasn't been triggered,
          // this can happen if start event arrives after OpenAI is ready
          if (state.openaiReady && state.openaiWs && state.openaiWs.readyState === WebSocket.OPEN) {
            console.log('[Standard WS] ✅ OpenAI already connected - call flow ready');
          } else {
            console.log('[Standard WS] ⏳ Waiting for OpenAI connection to be ready...');
          }
          break;

        case 'media':
          if (state.openaiReady && state.openaiWs && state.openaiWs.readyState === WebSocket.OPEN && msg.media?.payload) {
            state.openaiWs.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: msg.media.payload,
            }));
          } else if (msg.media?.payload && state.audioQueue.length < 100) {
            state.audioQueue.push(msg.media.payload);
          }
          break;

        case 'stop':
          console.log('[Standard WS] 📴 Call stopped');
          clearInterval(keepAlive);
          if (state.openaiWs) state.openaiWs.close();
          break;
      }
    } catch (error) {
      console.error('[Standard WS] ❌ Error processing Twilio message:', error);
    }
  });

  twilioWs.on('close', () => {
    console.log('[Standard WS] 🔴 Twilio disconnected');
    clearInterval(keepAlive);
    if (state.openaiWs) state.openaiWs.close();
  });

  twilioWs.on('error', (error) => {
    console.error('[Standard WS] ❌ Twilio WebSocket error:', error);
    clearInterval(keepAlive);
    if (state.openaiWs) state.openaiWs.close();
  });
}

/**
 * Setup Standard Mode Twilio WebSocket handler
 */
export function setupTwilioStandardWebSocketHandler(expressWsApp: {
  ws: (path: string, handler: (ws: WebSocket, req: unknown) => void) => void;
}) {
  expressWsApp.ws('/twilio-media-stream-standard', (ws: WebSocket) => {
    console.log('[Standard WS] 🔌 New connection on /twilio-media-stream-standard');
    handleTwilioConnectionStandard(ws);
  });

  console.log('[Standard WS] ✅ Handler registered on /twilio-media-stream-standard');
}

