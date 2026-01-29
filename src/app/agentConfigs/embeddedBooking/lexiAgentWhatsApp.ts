/**
 * LEXI - WhatsApp Integration Version
 * 
 * Reuses Twilio agent logic for WhatsApp via Evolution API
 * WhatsApp messages are text-based (like SMS), so we can reuse the same agent logic
 */

import { 
  generateLexiInstructions, 
  lexiTools, 
  executeLexiTool,
  callLexi,
  type ToolChannelContext
} from './lexiAgentTwilio';

// ============================================
// RE-EXPORT TWILIO AGENT LOGIC
// ============================================
// WhatsApp and SMS are both text-based, so we reuse the same agent

export { generateLexiInstructions, lexiTools, executeLexiTool, type ToolChannelContext };

/**
 * Call Lexi for WhatsApp message processing
 * Supports custom instructions for organization-specific behavior
 * 
 * @param userMessage - User's message text
 * @param conversationHistory - Previous messages in conversation
 * @param isFirstMessage - Whether this is the first message (triggers greeting)
 * @param customInstructions - Optional custom instructions (uses default if not provided)
 * @param model - AI model to use (from channel config, defaults to gpt-4o)
 * @param dataIntegrations - Enabled data integrations for this channel
 * @returns AI response text
 */
export async function callLexiWhatsApp(
  userMessage: string,
  conversationHistory: any[] = [],
  isFirstMessage: boolean = false,
  customInstructions?: string,
  model: string = 'gpt-4o',
  dataIntegrations: string[] = []
): Promise<string> {
  console.log('[Lexi WhatsApp] User Message:', userMessage);
  console.log('[Lexi WhatsApp] Using model:', model);
  console.log('[Lexi WhatsApp] Data integrations:', dataIntegrations.join(', ') || 'none');

  try {
    // Use custom instructions if provided, otherwise generate default
    const instructions = customInstructions || generateLexiInstructions(false); // false = not realtime
    const sessionId = `whatsapp_${Date.now()}`;

    const cleanInput = conversationHistory
      .filter((item: any) => item.type === 'message')
      .map((item: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { call_id, ...rest } = item;
        return rest;
      });
    
    const body: any = {
      model: model, // Use configured model
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

    // Import handleLexiIterations from Twilio agent
    const { handleLexiIterations } = await import('./lexiAgentTwilio');
    
    // Create channel context for WhatsApp
    const channelContext: ToolChannelContext = {
      channel: 'whatsapp',
      dataIntegrations
    };
    
    const finalResponse = await handleLexiIterations(
      body,
      responseData,
      conversationHistory,
      sessionId,
      undefined, // No audio playback for WhatsApp
      channelContext
    );

    return finalResponse;
  } catch (error: any) {
    console.error('[Lexi WhatsApp] Error:', error);
    return `I encountered an error: ${error.message}`;
  }
}

/**
 * Format phone number for WhatsApp
 * WhatsApp format: 1234567890@s.whatsapp.net
 * 
 * @param phone - Phone number (can be with/without country code)
 * @returns WhatsApp JID format
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If 10 digits, assume US number and add country code 1
  if (cleaned.length === 10) {
    return `1${cleaned}@s.whatsapp.net`;
  }
  
  // Otherwise use as-is (already has country code)
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Extract phone number from WhatsApp JID
 * Converts 1234567890@s.whatsapp.net → 1234567890
 * 
 * @param whatsappJid - WhatsApp JID (e.g., "1234567890@s.whatsapp.net")
 * @returns Clean phone number
 */
export function extractPhoneFromWhatsAppJid(whatsappJid: string): string {
  return whatsappJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

/**
 * Check if a string is a valid WhatsApp JID
 */
export function isWhatsAppJid(jid: string): boolean {
  return jid.includes('@s.whatsapp.net') || jid.includes('@c.us');
}


