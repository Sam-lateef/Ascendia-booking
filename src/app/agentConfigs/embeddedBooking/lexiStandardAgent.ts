/**
 * LEXI STANDARD MODE - Two-Agent Architecture (Cost-Optimized)
 * 
 * Uses two models for cost savings:
 * - Lexi Chat Agent: gpt-4o-mini-realtime (handles voice/conversation)
 * - Supervisor Agent: gpt-4o (handles booking logic via /api/responses)
 * 
 * This is ~60-70% cheaper than Premium mode while maintaining quality
 * for booking operations through the supervisor.
 * 
 * Now supports loading instructions from database for local testing!
 */

import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';
import { callSupervisor } from './supervisorAgent';
import { dentalOfficeInfo } from '../openDental/dentalOfficeData';

// Flag to track if we've loaded DB instructions
let dbInstructionsLoaded = false;
let dbReceptionistInstructions: string | null = null;
let dbSupervisorInstructions: string | null = null;

// ============================================
// LEXI CHAT AGENT (gpt-4o-mini)
// ============================================

export const lexiChatAgent = new RealtimeAgent({
  name: 'lexiChat',
  voice: 'sage',
  instructions: `You are Lexi, a friendly receptionist at ${dentalOfficeInfo.name}. You help patients book, reschedule, or cancel appointments.

CRITICAL RULE: You MUST call the getNextResponseFromSupervisor tool for ANY booking-related request. You cannot look up patients, check appointments, or book anything yourself - only the supervisor can do that.

OFFICE INFO:
${dentalOfficeInfo.name} | ${dentalOfficeInfo.phone} | ${dentalOfficeInfo.address}
Hours: ${dentalOfficeInfo.hours.weekdays} | Saturdays: ${dentalOfficeInfo.hours.saturday}

HOW TO SPEAK:
- Warm and natural, like a real receptionist
- Use contractions: "I'll", "you're", "let's"
- Say things like "let me check", "perfect", "sure thing"

GREETING: "Hi! Welcome to ${dentalOfficeInfo.name}. This is Lexi. How can I help you today?"

═══════════════════════════════════════════════════════════════════════════════
WHEN TO CALL THE SUPERVISOR (getNextResponseFromSupervisor)
═══════════════════════════════════════════════════════════════════════════════

Call the supervisor IMMEDIATELY when the patient wants to:
- Look up their record → "Phone number: 6195551234"
- Book an appointment → "Book cleaning on Monday for phone 6195551234"
- Check their appointments → "Get appointments for phone 6195551234"
- Reschedule → "Reschedule appointment to Thursday"
- Cancel → "Cancel appointment on Friday"
- Create new patient → "New patient: John Smith, DOB: 1990-01-15, phone: 6195551234"

BEFORE calling supervisor, say a filler phrase:
- "Let me check that for you."
- "Let me look that up."
- "One moment please."

═══════════════════════════════════════════════════════════════════════════════
BASIC FLOW
═══════════════════════════════════════════════════════════════════════════════

1. ALWAYS get phone number first: "Can I get your phone number?"
2. Confirm it digit by digit: "I have 6-1-9, 5-5-5, 1-2-3-4. Is that right?"
3. Say "Let me look that up" then call supervisor with: "Phone number: 6195551234"
4. Read the supervisor's response naturally to the patient
5. Continue the conversation based on what they need

═══════════════════════════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

Patient: "I'd like to book an appointment"
You: "Sure thing! Can I get your phone number?"
Patient: "858-456-3960"
You: "Got it - 8-5-8, 4-5-6, 3-9-6-0. Is that correct?"
Patient: "Yes"
You: "Let me look that up."
→ CALL SUPERVISOR: "Phone number: 8584563960"
→ Then read supervisor's response naturally

Patient: "I need to reschedule my appointment"
You: "No problem! What's your phone number?"
... get and verify phone...
You: "Let me pull up your appointments."
→ CALL SUPERVISOR: "Get appointments for phone 8584563960"

═══════════════════════════════════════════════════════════════════════════════
IMPORTANT REMINDERS
═══════════════════════════════════════════════════════════════════════════════

- ALWAYS call supervisor for any booking action - you cannot do it yourself
- Get phone number FIRST before anything else
- Verify phone number digit by digit
- Say filler phrase BEFORE calling supervisor
- Read supervisor responses naturally as your own words
- If you receive gibberish/foreign words, say "I didn't catch that, could you repeat?"
`,
  tools: [
    tool({
      name: 'getNextResponseFromSupervisor',
      description: 'ALWAYS call this tool when the patient wants to: look up their record, book an appointment, reschedule, cancel, or check appointment times. Pass the relevant context from the conversation.',
      parameters: z.object({
        relevantContextFromLastUserMessage: z.string().describe('Key information from the user: phone number (10 digits), names, dates, times, preferences. Example: "Phone: 6195551234" or "Book cleaning on Monday"'),
      }),
      execute: async (input) => {
        const { relevantContextFromLastUserMessage } = input;

        // Get consistent session ID
        const sessionId = `standard_browser_${Date.now()}`;
        
        console.log('[Lexi Standard] 📞 Calling supervisor with:', relevantContextFromLastUserMessage);

        // Call supervisor - auth is handled automatically by FetchInterceptor
        const result = await callSupervisor(
          [], // Conversation history not available in this context
          relevantContextFromLastUserMessage,
          sessionId,
          getSupervisorInstructions()
        );

        console.log('[Lexi Standard] ✅ Supervisor response:', result.response.substring(0, 100) + '...');

        return result.response;
      },
    }),
  ],
  handoffs: [],
  handoffDescription: 'Standard mode Lexi (cost-optimized with supervisor)',
});

/**
 * Load instructions from database
 * Call this when the session starts to use latest DB instructions
 */
export async function loadInstructionsFromDB(): Promise<{
  receptionist: string | null;
  supervisor: string | null;
  useManual: boolean;
}> {
  // Only load once per session
  if (dbInstructionsLoaded) {
    return {
      receptionist: dbReceptionistInstructions,
      supervisor: dbSupervisorInstructions,
      useManual: dbReceptionistInstructions !== null,
    };
  }

  try {
    const response = await fetch('/api/admin/agent-instructions');
    const data = await response.json();

    if (data.success && data.receptionistInstructions && data.supervisorInstructions) {
      dbReceptionistInstructions = data.receptionistInstructions;
      dbSupervisorInstructions = data.supervisorInstructions;
      dbInstructionsLoaded = true;
      
      console.log('[Lexi Standard] Database instructions loaded');
      
      return {
        receptionist: dbReceptionistInstructions,
        supervisor: dbSupervisorInstructions,
        useManual: true,
      };
    }
  } catch (error) {
    console.warn('[Lexi Standard Browser] ⚠️ Could not load DB instructions, using hardcoded:', error);
  }

  console.log('%c[Lexi Standard Browser] 📝 USING HARDCODED INSTRUCTIONS', 'color: #f59e0b; font-weight: bold');
  console.log('[Lexi Standard Browser] ℹ️ To use database instructions:');
  console.log('  1. Go to /admin/booking/settings');
  console.log('  2. Unlock Workflows (password: lexi2026)');
  console.log('  3. Click "Sync Instructions"');
  
  return {
    receptionist: null,
    supervisor: null,
    useManual: false,
  };
}

/**
 * Get supervisor instructions (DB or default)
 */
export function getSupervisorInstructions(): string | undefined {
  return dbSupervisorInstructions || undefined;
}

// Export scenario for agent UI
export const lexiStandardScenario = [lexiChatAgent];

// Company name for guardrails
export const lexiStandardCompanyName = dentalOfficeInfo.name;

export default lexiStandardScenario;

