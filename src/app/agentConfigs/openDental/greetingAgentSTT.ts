import { fetchOfficeContext } from '@/app/lib/officeContext';
import { executeOrchestrator } from './orchestratorAgent';
import { dentalOfficeInfo } from './dentalOfficeData';

// Type for callback to play "one moment" audio (client-side only)
export type PlayOneMomentCallback = () => Promise<void>;

/**
 * Generate greeting agent instructions (optimized static version)
 * @param forRealtime - If true, adapts instructions for OpenAI Realtime SDK (which handles first message automatically)
 */
export function generateGreetingAgentInstructions(forRealtime: boolean = false): string {
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

⚠️ IMPORTANT: If user speech is garbled or unclear, DO NOT proceed!
   Example: User says "Let's see if this is..." → NOT a name!
   Response: "I didn't quite catch your name. Could you please repeat that?"

HANDOFF PROTOCOL
1. Say: "Let me look that up for you"
2. Call getNextResponseFromSupervisor with context
3. Return orchestrator response EXACTLY as-is (no modifications)

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
 * Tool definitions for greeting agent (same as Lexi's tools)
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
    description: 'Handles patient operations by calling OpenDental API functions. Use this for finding patients, booking appointments, canceling, checking schedules, etc.',
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
 * @param toolName - Name of the tool to execute
 * @param args - Tool arguments
 * @param conversationHistory - Conversation history
 * @param playOneMomentAudio - Optional callback to play "one moment" audio (client-side only)
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
      console.log('[Greeting Agent STT] 🔵 get_office_context CALLED - Fetching office context...');
      const context = await fetchOfficeContext();
      console.log(`[Greeting Agent STT] ✅ Office context ready: ${context.providers.length} providers, ${context.operatories.length} operatories, ${context.occupiedSlots.length} occupied slots`);
      const contextString = JSON.stringify(context, null, 2);
      console.log(`[Greeting Agent STT] 📦 Office context string length: ${contextString.length} characters`);
      return contextString;
    }

    case 'getNextResponseFromSupervisor': {
      // Play "one moment" audio immediately (don't wait for it to finish)
      if (playOneMomentAudio) {
        console.log('[Greeting Agent STT] Playing "one moment" audio before orchestrator call...');
        playOneMomentAudio().catch((error) => {
          console.warn('[Greeting Agent STT] Failed to play "one moment" audio:', error);
          // Continue even if audio fails
        });
      }

      // Extract office context from conversation history
      // Try multiple strategies to find office context
      let officeContext: any = undefined;
      
      console.log('[Greeting Agent STT] 🔍 Searching for office context in conversation history...');
      console.log('[Greeting Agent STT] Conversation history length:', conversationHistory.length);
      console.log('[Greeting Agent STT] Conversation history items:', conversationHistory.map(item => ({
        type: item.type,
        name: item.name,
        call_id: item.call_id
      })));
      
      for (const item of conversationHistory) {
        // Strategy 1: Direct function_call_output
        if (item.type === 'function_call_output' && item.name === 'get_office_context') {
          try {
            officeContext = typeof item.output === 'string' 
              ? JSON.parse(item.output) 
              : item.output;
            console.log('[Greeting Agent STT] ✅ Found office context via Strategy 1 (function_call_output)');
            break;
          } catch (e) {
            console.error('[Greeting Agent STT] Failed to parse office context:', e);
          }
        }
        
        // Strategy 2: function_call with output property
        if (item.type === 'function_call' && item.name === 'get_office_context' && item.output) {
          try {
            officeContext = typeof item.output === 'string' 
              ? JSON.parse(item.output) 
              : item.output;
            console.log('[Greeting Agent STT] ✅ Found office context via Strategy 2 (function_call.output)');
            break;
          } catch (e) {
            console.error('[Greeting Agent STT] Failed to parse office context:', e);
          }
        }
        
        // Strategy 3: Message content array
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'function_call_output' && 
                contentItem.name === 'get_office_context' && 
                contentItem.output) {
              try {
                officeContext = typeof contentItem.output === 'string' 
                  ? JSON.parse(contentItem.output) 
                  : contentItem.output;
                console.log('[Greeting Agent STT] ✅ Found office context via Strategy 3 (message content)');
                break;
              } catch (e) {
                console.error('[Greeting Agent STT] Failed to parse office context:', e);
              }
            }
          }
          if (officeContext) break;
        }
      }
      
      if (!officeContext) {
        console.log('[Greeting Agent STT] ⚠️ Office context not found in history - orchestrator will need to fetch it');
      } else {
        console.log('[Greeting Agent STT] ✅ Office context extracted:', {
          providers: officeContext.providers?.length || 0,
          operatories: officeContext.operatories?.length || 0,
          occupiedSlots: officeContext.occupiedSlots?.length || 0
        });
      }

      // Call orchestrator directly (not through tool wrapper)
      // Audio will continue playing while orchestrator processes
      const result = await executeOrchestrator(
        args.relevantContextFromLastUserMessage,
        conversationHistory,
        officeContext
      );
      
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Handle greeting agent response iterations (similar to orchestrator)
 * @param body - Request body
 * @param response - Initial response
 * @param conversationHistory - Conversation history
 * @param playOneMomentAudio - Optional callback to play "one moment" audio when orchestrator is called (client-side only)
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
    console.log(`\n========== [Greeting Agent STT] ITERATION ${iterations}/${maxIterations} ==========`);

    if (currentResponse?.error) {
      console.error('[Greeting Agent STT] Response has error:', currentResponse.error);
      return 'I encountered an error processing your request.';
    }

    if (!currentResponse || !currentResponse.output) {
      console.error('[Greeting Agent STT] Invalid response structure:', currentResponse);
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

      // If we have a final text, return it
      if (finalText.trim()) {
        return finalText;
      }

      // If no final text but we have function call outputs, check if getNextResponseFromSupervisor returned a response
      const functionCallOutputs = outputItems.filter((item) => item.type === 'function_call_output');
      for (const output of functionCallOutputs) {
        if (output.name === 'getNextResponseFromSupervisor' && output.output) {
          // The orchestrator's response is the final answer - return it directly
          const orchestratorResponse = typeof output.output === 'string' 
            ? output.output 
            : JSON.stringify(output.output);
          return orchestratorResponse;
        }
      }

      return 'I was unable to process that request.';
    }

    // Execute each function call
    for (const toolCall of functionCalls) {
      const toolName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');

      console.log(`\n========== [Greeting Agent STT] CALLING TOOL ==========`);
      console.log(`Tool: ${toolName}`);
      console.log(`Arguments:`, JSON.stringify(args, null, 2));

      try {
        const result = await executeGreetingAgentTool(toolName, args, conversationHistory, playOneMomentAudio);
        console.log(`\n[Greeting Agent STT] ✅ ${toolName} SUCCESS:`);
        console.log(JSON.stringify(result, null, 2));
        console.log(`================================================\n`);

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
        const functionCallItem = {
          type: 'function_call',
          call_id: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        };
        const functionCallOutputItem = {
          type: 'function_call_output',
          call_id: toolCall.call_id,
          name: toolCall.name,
          output: resultString,
        };
        
        conversationHistory.push(functionCallItem, functionCallOutputItem);
        
        // Debug log for get_office_context
        if (toolName === 'get_office_context') {
          console.log('[Greeting Agent STT] ✅ Added get_office_context to conversation history:');
          console.log('[Greeting Agent STT]   - function_call:', JSON.stringify(functionCallItem, null, 2));
          console.log('[Greeting Agent STT]   - function_call_output:', {
            type: functionCallOutputItem.type,
            call_id: functionCallOutputItem.call_id,
            name: functionCallOutputItem.name,
            output_length: typeof functionCallOutputItem.output === 'string' ? functionCallOutputItem.output.length : 'not string'
          });
        }

        // SPECIAL CASE: If this is getNextResponseFromSupervisor, return the result directly
        // The orchestrator's response is the final answer - no need for another iteration
        if (toolName === 'getNextResponseFromSupervisor') {
          console.log('[Greeting Agent STT] Orchestrator response received - returning directly without follow-up');
          return resultString;
        }
      } catch (error: any) {
        console.error(`\n[Greeting Agent STT] ❌ ${toolName} ERROR:`);
        console.error(error.message || error);
        console.error(`================================================\n`);

        // Preserve errorType for propagation
        const errorOutput: any = {
          error: true,
          message: error.message || 'Unknown error',
        };
        if (error.errorType) {
          errorOutput.errorType = error.errorType;
        }

        // Add error output
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
        
        // Re-throw with errorType preserved so it can be caught by useSTTSession
        if (error.errorType) {
          throw error;
        }
      }
    }

    // Make the follow-up request including the tool outputs
    console.log(`[Greeting Agent STT] Making follow-up request with ${body.input.length} input items...`);
    const fetchResponse = await fetch('/api/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Greeting Agent STT] Error:', fetchResponse.status, errorData);
      const error = new Error(errorData.details || errorData.error || `Responses API error: ${fetchResponse.statusText}`);
      (error as any).errorType = errorData.errorType;
      throw error;
    }

    currentResponse = await fetchResponse.json();
  }

  console.error(`[Greeting Agent STT] ⚠️ MAXIMUM ITERATIONS REACHED (${maxIterations})`);
  return 'I apologize, but I was unable to complete your request. Please try again.';
}

/**
 * Call greeting agent with user message
 * @param userMessage - User's message
 * @param conversationHistory - Previous conversation history
 * @param isFirstMessage - Whether this is the first message (to trigger greeting)
 * @param playOneMomentAudio - Optional callback to play "one moment" audio when orchestrator is called (client-side only)
 * @returns Agent's text response
 */
export async function callGreetingAgent(
  userMessage: string,
  conversationHistory: any[] = [],
  isFirstMessage: boolean = false,
  playOneMomentAudio?: () => Promise<void>
): Promise<string> {
  console.log('\n🟢 ========================================');
  console.log('🟢 [GREETING AGENT STT] INVOKED');
  console.log('🟢 User Message:', userMessage);
  console.log('🟢 Is First Message:', isFirstMessage);
  console.log('🟢 ========================================\n');

  try {
    const instructions = generateGreetingAgentInstructions();

    // Build request body
    // Responses API only accepts 'message' and 'function_call'/'function_call_output' pairs
    // We cannot include standalone function_call_output items in the input
    // Extract office context separately and pass it to orchestrator
    const cleanInput = conversationHistory
      .filter(item => item.type === 'message')
      .map(item => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { call_id, ...rest } = item;
        return rest;
      });
    
    const body: any = {
      model: 'gpt-4o-mini',
      instructions: instructions,
      tools: greetingAgentTools,
      input: cleanInput,
    };

    // For first message, add greeting trigger
    // Otherwise, just add the user's message
    if (isFirstMessage) {
      // Only add greeting trigger if this is truly the first message
      body.input.push({
        type: 'message',
        role: 'user',
        content: 'Start the conversation with the greeting.',
      });
    } else {
      // Normal user message - do NOT trigger greeting
      body.input.push({
        type: 'message',
        role: 'user',
        content: userMessage,
      });
    }
    
    // Add explicit instruction to NOT greet if isFirstMessage is false
    if (!isFirstMessage && body.input.length > 0) {
      // Prepend a system-like instruction to the last message
      const lastMessage = body.input[body.input.length - 1];
      if (lastMessage.type === 'message' && lastMessage.role === 'user') {
        lastMessage.content = `[IMPORTANT: isFirstMessage=false, do NOT repeat the greeting. The greeting has already been played. Just process this user message normally: "${userMessage}"]`;
      }
    }

    // Make initial request
    const response = await fetch('/api/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Greeting Agent STT] Error:', response.status, errorData);
      const error = new Error(errorData.details || errorData.error || `Responses API error: ${response.statusText}`);
      (error as any).errorType = errorData.errorType;
      throw error;
    }

    const responseData = await response.json();

    // Handle tool calls iteratively
    const finalResponse = await handleGreetingAgentIterations(
      body,
      responseData,
      conversationHistory,
      playOneMomentAudio
    );

    console.log('\n=================================================');
    console.log('[Greeting Agent STT] FINAL RESPONSE TO USER:');
    console.log(finalResponse);
    console.log('=================================================\n');

    return finalResponse;
  } catch (error: any) {
    console.error('[callGreetingAgent] Error:', error);
    return `I encountered an error while processing your request: ${error.message}`;
  }
}

