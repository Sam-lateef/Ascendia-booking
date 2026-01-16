/**
 * WhatsApp Webhook Handler (Evolution API)
 * 
 * Receives messages from Evolution API and processes them with Lexi
 * Similar to Twilio SMS handler but with WhatsApp-specific payload format
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLexiWhatsApp, extractPhoneFromWhatsAppJid } from '@/app/agentConfigs/embeddedBooking/lexiAgentWhatsApp';
import { getEvolutionClient } from '@/whatsapp/evolution-client';
import { processMessage, addMessage, getOrCreateState } from '@/app/lib/conversationState';

// Store conversation history per WhatsApp user (in-memory with 24hr TTL)
const whatsappHistoryMap = new Map<string, any[]>();
const conversationTimestamps = new Map<string, number>();
const CONVERSATION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Periodic cleanup of old conversations
setInterval(() => {
  const now = Date.now();
  for (const [whatsappId, timestamp] of conversationTimestamps.entries()) {
    if (now - timestamp > CONVERSATION_TIMEOUT) {
      whatsappHistoryMap.delete(whatsappId);
      conversationTimestamps.delete(whatsappId);
      console.log(`[WhatsApp] Cleaned up old conversation for ${whatsappId}`);
    }
  }
}, 60 * 60 * 1000); // Check every hour

/**
 * Extract text content from Evolution API message object
 */
function extractTextFromMessage(message: any): string {
  if (!message) return '';
  
  // Text message
  if (message.conversation) {
    return message.conversation;
  }
  
  // Extended text message (with formatting, links, etc.)
  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text;
  }
  
  // Image with caption
  if (message.imageMessage?.caption) {
    return message.imageMessage.caption;
  }
  
  // Document with caption
  if (message.documentMessage?.caption) {
    return message.documentMessage.caption;
  }
  
  // Video with caption
  if (message.videoMessage?.caption) {
    return message.videoMessage.caption;
  }
  
  return '';
}

/**
 * Main webhook handler
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('[WhatsApp] Webhook received:', body.event);
    
    // Only process incoming messages (not sent messages)
    if (body.event !== 'MESSAGES_UPSERT') {
      return NextResponse.json({ success: true, message: 'Event ignored - not MESSAGES_UPSERT' });
    }
    
    const data = body.data;
    
    // Ignore messages sent by us
    if (data?.key?.fromMe) {
      return NextResponse.json({ success: true, message: 'Event ignored - message from us' });
    }
    
    // Extract message details
    const from = data?.key?.remoteJid; // e.g., "1234567890@s.whatsapp.net"
    const messageData = data?.message;
    const messageText = extractTextFromMessage(messageData);
    
    if (!from) {
      console.log('[WhatsApp] No sender ID found');
      return NextResponse.json({ success: true, message: 'No sender ID' });
    }
    
    if (!messageText || !messageText.trim()) {
      console.log('[WhatsApp] No text content found (might be media-only message)');
      return NextResponse.json({ success: true, message: 'No text content' });
    }
    
    console.log(`[WhatsApp] Message from ${from}: "${messageText}"`);
    
    // Get or create conversation history
    let history = whatsappHistoryMap.get(from) || [];
    const isFirstMessage = history.length === 0;
    
    // Update timestamp
    conversationTimestamps.set(from, Date.now());
    
    // Create session ID for Supabase storage
    const phoneNumber = extractPhoneFromWhatsAppJid(from);
    const sessionId = `whatsapp_${phoneNumber}`;
    
    // Initialize conversation state in Supabase (if first message)
    if (isFirstMessage) {
      const state = getOrCreateState(sessionId);
      console.log(`[WhatsApp] Initialized conversation state: ${sessionId}`);
    }
    
    // Process with Lexi
    console.log(`[WhatsApp] Processing with Lexi (${isFirstMessage ? 'first' : 'continuing'} message)...`);
    const response = await callLexiWhatsApp(messageText, history, isFirstMessage);
    
    // Update in-memory history
    history.push(
      { type: 'message', role: 'user', content: messageText },
      { type: 'message', role: 'assistant', content: response }
    );
    whatsappHistoryMap.set(from, history);
    
    // Store in Supabase (for admin dashboard)
    processMessage(sessionId, messageText, 'user');
    addMessage(sessionId, 'assistant', response);
    
    // Send response via Evolution API
    console.log(`[WhatsApp] Sending response to ${from}: "${response}"`);
    const client = getEvolutionClient();
    await client.sendTextMessage(from, response);
    
    console.log('[WhatsApp] Response sent successfully');
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[WhatsApp] Error processing webhook:', error);
    
    // Return 200 to prevent Evolution API from retrying
    // (We don't want to spam the user with error messages)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 200 }
    );
  }
}

/**
 * GET handler for webhook verification (if needed by Evolution API)
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    status: 'ok',
    message: 'WhatsApp webhook endpoint is active'
  });
}


