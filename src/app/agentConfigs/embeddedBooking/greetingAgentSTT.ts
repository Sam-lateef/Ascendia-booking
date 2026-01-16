import { fetchEmbeddedBookingContext } from '@/app/lib/embeddedBookingContext';
import { dentalOfficeInfo } from '../openDental/dentalOfficeData';
import { loadDomainPrompts } from '@/app/lib/agentConfigLoader';
import { executeOrchestrator } from './orchestratorAgent';

// ============================================
// DATABASE CONFIGURATION CACHE (Lexi)
// ============================================
let lexiPersonaPrompt: string | null = null;
let lexiConfigLoaded = false;

// Preload Lexi's persona from database (async, runs in background)
// Only run on server-side (not in browser)
if (typeof window === 'undefined') {
  (async () => {
    try {
      const prompts = await loadDomainPrompts();
      if (prompts.persona_prompt && prompts.persona_prompt.trim()) {
        lexiPersonaPrompt = prompts.persona_prompt;
        lexiConfigLoaded = true;
        console.log('[Lexi] ✅ Persona prompt loaded from database');
      }
    } catch (error) {
      console.warn('[Lexi] ⚠️ Could not load persona from database, using hardcoded fallback');
    }
  })();
}


// Type for callback to play "one moment" audio (client-side only)
export type PlayOneMomentCallback = () => Promise<void>;

/**
 * Generate greeting agent instructions (optimized static version)
 * @param forRealtime - If true, adapts instructions for OpenAI Realtime SDK (which handles first message automatically)
 */
export function generateGreetingAgentInstructions(forRealtime: boolean = false): string {
  // ✅ NEW: Use database persona if loaded
  if (lexiConfigLoaded && lexiPersonaPrompt) {
    console.log('[Lexi] Using database-configured persona');
    
    const officeInfoTemplate = `OFFICE INFO
${dentalOfficeInfo.name} | ${dentalOfficeInfo.phone} | ${dentalOfficeInfo.address}
Hours: ${dentalOfficeInfo.hours.weekdays} | Weekends: ${dentalOfficeInfo.hours.saturday}
Services: ${dentalOfficeInfo.services.join(', ')}`;

    // Inject office info into the persona prompt
    // Template variables from domains table: {persona_name}, {persona_role}, {company_name}
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

  // ⚠️ FALLBACK: Use hardcoded instructions if database not loaded
  console.log('[Lexi] Using hardcoded fallback persona');
  
  const firstMessageProtocol = forRealtime
    ? `FIRST MESSAGE PROTOCOL
When the call starts:
1. Say: "Hi! Welcome to ${dentalOfficeInfo.name}. This is Lexi. How can I help you today?"
2. Immediately call get_datetime and get_office_context (silently)

After the first message: Process messages normally, no greeting.`
    : `FIRST MESSAGE PROTOCOL
If isFirstMessage is true:
1. Say: "Hi! Welcome to ${dentalOfficeInfo.name}. This is Lexi. How can I help you today?"
2. Immediately call get_datetime and get_office_context (silently)

If isFirstMessage is false: Process message normally, no greeting.`;

  return `IDENTITY
You are Lexi, a friendly dental receptionist for ${dentalOfficeInfo.name}.

${firstMessageProtocol}

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

→ If user says something unclear/garbled, ASK AGAIN: "I didn't catch that, could you repeat?"
→ Do NOT say "Thank you!" until you actually RECEIVED the info!
→ Do NOT assume or guess - if unclear, ask to confirm!

Reschedule/Cancel/Check (MUST HAVE before handoff):
✓ Name OR phone (either works)
→ Once you have name or phone, hand off immediately
→ DO NOT ask for new date/time - orchestrator handles that

⚠️ CRITICAL: IGNORE NON-ENGLISH TRANSCRIPTIONS!
   - Background noise/music may be transcribed as random foreign languages
   - IGNORE: Spanish, Arabic, Korean, French, German, Russian, Indonesian, Portuguese, Turkish, etc.
   - Only respond to clear, complete English sentences
   - If transcription is gibberish or mixed languages, say: "I didn't catch that. Could you please repeat?"
   - Example of noise: "Maduanamu", "مهمة", "지금 다른가?", "Die Kuh ist ein Rind" → IGNORE these!

⚠️ IMPORTANT: If user speech is garbled or unclear, DO NOT proceed!
   Example: User says "Let's see if this is..." → NOT a name!
   Response: "I didn't quite catch your name. Could you please repeat that?"

HANDOFF PROTOCOL (CRITICAL - FOLLOW EXACTLY!)
1. Say: "Let me look that up for you"
2. Call getNextResponseFromSupervisor with context
3. Return orchestrator response EXACTLY as-is

🚨 CRITICAL RULES FOR WORKFLOW RESPONSES:
- NEVER modify, rephrase, or "improve" the orchestrator's response
- NEVER add your own questions after the orchestrator responds
- NEVER ask for date/time/details that the orchestrator will ask for
- The orchestrator handles ALL workflow steps (finding patients, showing options, asking for dates, etc.)
- Your ONLY job: Hand off, then return the orchestrator's exact response
- If orchestrator says "Which appointment would you like to reschedule?", say EXACTLY that
- If orchestrator says "I couldn't find that phone number", say EXACTLY that
- DO NOT try to be helpful by asking additional questions - the workflow handles everything!

OFFICE INFO
${dentalOfficeInfo.name} | ${dentalOfficeInfo.phone} | ${dentalOfficeInfo.address}
Hours: ${dentalOfficeInfo.hours.weekdays} | Weekends: ${dentalOfficeInfo.hours.saturday}
Services: ${dentalOfficeInfo.services.join(', ')}

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
You: "We're open ${dentalOfficeInfo.hours.weekdays.toLowerCase()}. Closed on weekends."`;
}

/**
 * Tool definitions for greeting agent
 */
export const greetingAgentTools = [
  {
    type: 'function',
    name: 'get_datetime',
    description: 'Gets the current date and time in ISO format to ensure accurate appointment handling',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'get_office_context',
    description: 'Fetches current office data (providers, operatories, occupied appointment slots). Call this ONCE at the start of the conversation after get_datetime. This data is then passed to the orchestrator to eliminate redundant API calls.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'getNextResponseFromSupervisor',
    description: 'Handles patient operations by calling embedded booking API functions. Use this for finding patients, booking appointments, canceling, checking schedules, etc.',
    parameters: {
      type: 'object',
      properties: {
        relevantContextFromLastUserMessage: {
          type: 'string',
          description: 'The relevant information from the last user message that requires API interaction',
        },
      },
      required: ['relevantContextFromLastUserMessage'],
      additionalProperties: false,
    },
  },
];

/**
 * Execute greeting agent tool
 */
async function executeGreetingAgentTool(
  toolName: string,
  args: any,
  conversationHistory: any[],
  playOneMomentAudio?: () => Promise<void>
): Promise<any> {
  switch (toolName) {
    case 'get_datetime': {
      const now = new Date();
      return now.toISOString();
    }

    case 'get_office_context': {
      console.log('[Embedded Booking Greeting Agent] 🔵 get_office_context CALLED - Fetching office context...');
      const context = await fetchEmbeddedBookingContext();
      console.log(`[Embedded Booking Greeting Agent] ✅ Office context ready: ${context.providers.length} providers, ${context.operatories.length} operatories, ${context.occupiedSlots.length} occupied slots`);
      const contextString = JSON.stringify(context, null, 2);
      return contextString;
    }

    case 'getNextResponseFromSupervisor': {
      // Play "one moment" audio immediately if provided
      if (playOneMomentAudio) {
        playOneMomentAudio().catch((error) => {
          console.warn('[Embedded Booking Greeting Agent] Failed to play "one moment" audio:', error);
        });
      }

      // Normalize conversation history for orchestrator
      const normalizedHistory = conversationHistory
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

      // Extract office context from conversation history
      let officeContext;
      for (const item of conversationHistory) {
        if (item.type === 'function_call_output' && item.name === 'get_office_context' && item.output) {
          try {
            officeContext = typeof item.output === 'string' ? JSON.parse(item.output) : item.output;
            break;
          } catch {
            // Silent fail, continue
          }
        }
      }

      // Generate session ID
      const sessionId = `stt_${Date.now()}`;

      console.log('[Embedded Booking Greeting Agent] 🚀 Calling Orchestrator directly...');
      
      // Call orchestrator directly (no workflow engine)
      const result = await executeOrchestrator(
        args.relevantContextFromLastUserMessage,
        normalizedHistory,
        officeContext,
        sessionId
      );
      
      console.log(`[Embedded Booking Greeting Agent] ✅ Orchestrator response: "${result.substring(0, 100)}${result.length > 100 ? '...' : ''}"`);
      
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Handle greeting agent response iterations
 */
async function handleGreetingAgentIterations(
  body: any,
  response: any,
  conversationHistory: any[],
  playOneMomentAudio?: () => Promise<void>
): Promise<string> {
  let currentResponse = response;
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    iterations++;

    if (currentResponse?.error) {
      console.error('[Embedded Booking Greeting Agent] Response has error:', currentResponse.error);
      return 'I encountered an error processing your request.';
    }

    if (!currentResponse || !currentResponse.output) {
      console.error('[Embedded Booking Greeting Agent] Invalid response structure:', currentResponse);
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

      if (finalText.trim()) {
        return finalText;
      }

      // Check if getNextResponseFromSupervisor returned a response
      // CRITICAL: Return workflow response immediately, don't let LLM iterate further
      const functionCallOutputs = outputItems.filter((item) => item.type === 'function_call_output');
      for (const output of functionCallOutputs) {
        if (output.name === 'getNextResponseFromSupervisor' && output.output) {
          const orchestratorResponse = typeof output.output === 'string' 
            ? output.output 
            : JSON.stringify(output.output);
          
          console.log(`[Greeting Agent] 🎯 RETURNING WORKFLOW RESPONSE (no further iterations): "${orchestratorResponse.substring(0, 100)}..."`);
          return orchestratorResponse;  // RETURN IMMEDIATELY - don't iterate further!
        }
      }

      return 'I was unable to process that request.';
    }

    // Execute each function call
    for (const toolCall of functionCalls) {
      const toolName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');

      try {
        const result = await executeGreetingAgentTool(toolName, args, conversationHistory, playOneMomentAudio);
        const resultString = typeof result === 'string' ? result : JSON.stringify(result);

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
            output: resultString,
          },
        );

        // Also add to conversation history for context
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

        // SPECIAL CASE: If this is getNextResponseFromSupervisor, return the result directly
        if (toolName === 'getNextResponseFromSupervisor') {
          return resultString;
        }
      } catch (error: any) {
        console.error(`[Embedded Booking Greeting Agent] ❌ ${toolName} ERROR:`, error.message);

        const errorOutput: any = {
          error: true,
          message: error.message || 'Unknown error',
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
        
        if (error.errorType) {
          throw error;
        }
      }
    }

    // Make the follow-up request including the tool outputs
    const fetchResponse = await fetch('/api/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json().catch(() => ({ error: 'Unknown error' }));
      const error = new Error(errorData.details || errorData.error || `Responses API error: ${fetchResponse.statusText}`);
      (error as any).errorType = errorData.errorType;
      throw error;
    }

    currentResponse = await fetchResponse.json();
  }

  console.error(`[Embedded Booking Greeting Agent] ⚠️ MAXIMUM ITERATIONS REACHED (${maxIterations})`);
  return 'I apologize, but I was unable to complete your request. Please try again.';
}

/**
 * Call greeting agent with user message (for STT/TTS mode)
 */
export async function callGreetingAgent(
  userMessage: string,
  conversationHistory: any[] = [],
  isFirstMessage: boolean = false,
  playOneMomentAudio?: () => Promise<void>
): Promise<string> {
  console.log('[Embedded Booking Greeting Agent] INVOKED - User Message:', userMessage);

  try {
    const instructions = generateGreetingAgentInstructions();

    const cleanInput = conversationHistory
      .filter(item => item.type === 'message')
      .map(item => {
        const { call_id, ...rest } = item;
        return rest;
      });
    
    const body: any = {
      model: 'gpt-4o-mini',
      instructions: instructions,
      tools: greetingAgentTools,
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
    
    if (!isFirstMessage && body.input.length > 0) {
      const lastMessage = body.input[body.input.length - 1];
      if (lastMessage.type === 'message' && lastMessage.role === 'user') {
        lastMessage.content = `[IMPORTANT: isFirstMessage=false, do NOT repeat the greeting. The greeting has already been played. Just process this user message normally: "${userMessage}"]`;
      }
    }

    const response = await fetch('/api/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const error = new Error(errorData.details || errorData.error || `Responses API error: ${response.statusText}`);
      (error as any).errorType = errorData.errorType;
      throw error;
    }

    const responseData = await response.json();

    const finalResponse = await handleGreetingAgentIterations(
      body,
      responseData,
      conversationHistory,
      playOneMomentAudio
    );

    return finalResponse;
  } catch (error: any) {
    console.error('[Embedded Booking callGreetingAgent] Error:', error);
    return `I encountered an error while processing your request: ${error.message}`;
  }
}


