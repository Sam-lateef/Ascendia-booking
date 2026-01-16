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
  callLexi 
} from './lexiAgentTwilio';

// ============================================
// RE-EXPORT TWILIO AGENT LOGIC
// ============================================
// WhatsApp and SMS are both text-based, so we reuse the same agent

export { generateLexiInstructions, lexiTools, executeLexiTool };

/**
 * Call Lexi for WhatsApp message processing
 * Identical to SMS but with WhatsApp-specific session ID prefix
 */
export async function callLexiWhatsApp(
  userMessage: string,
  conversationHistory: any[] = [],
  isFirstMessage: boolean = false
): Promise<string> {
  // Reuse Twilio's callLexi - works perfectly for WhatsApp text messages
  return callLexi(userMessage, conversationHistory, isFirstMessage);
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


