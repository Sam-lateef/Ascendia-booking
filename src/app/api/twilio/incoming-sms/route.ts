/**
 * Twilio Incoming SMS Handler
 * Processes SMS messages and returns TwiML with Lexi's response
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLexi } from '@/app/agentConfigs/embeddedBooking/lexiAgentTwilio';

// Store conversation history per phone number
// In production, this should use a database (Redis, etc.)
const smsHistoryMap = new Map<string, any[]>();

// Clean up old conversations after 24 hours
const conversationTimestamps = new Map<string, number>();
const CONVERSATION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [phone, timestamp] of conversationTimestamps.entries()) {
    if (now - timestamp > CONVERSATION_TIMEOUT) {
      smsHistoryMap.delete(phone);
      conversationTimestamps.delete(phone);
      console.log(`[Twilio SMS] Cleaned up old conversation for ${phone}`);
    }
  }
}, 60 * 60 * 1000); // Check every hour

export async function POST(req: NextRequest) {
  try {
    // Parse Twilio form data
    const formData = await req.formData();
    const body = formData.get('Body') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const messageSid = formData.get('MessageSid') as string;

    console.log(`[Twilio SMS] Message from ${from}: "${body}"`);

    if (!body || !from) {
      throw new Error('Missing required fields: Body or From');
    }

    // Get or create conversation history for this phone number
    let history = smsHistoryMap.get(from) || [];
    const isFirstMessage = history.length === 0;

    // Update conversation timestamp
    conversationTimestamps.set(from, Date.now());

    // Process message with Lexi
    console.log(`[Twilio SMS] Processing with Lexi (${isFirstMessage ? 'first' : 'continuing'} message)...`);
    const response = await callLexi(body, history, isFirstMessage);

    // Update history with user message and assistant response
    history.push(
      { type: 'message', role: 'user', content: body },
      { type: 'message', role: 'assistant', content: response }
    );
    smsHistoryMap.set(from, history);

    console.log(`[Twilio SMS] Response: "${response}"`);

    // Return TwiML with response
    // Escape XML special characters in response
    const escapedResponse = response
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${escapedResponse}</Message>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[Twilio SMS] Error:', error);
    
    // Return error TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Sorry, I encountered an error processing your message. Please try again.</Message>
</Response>`;
    
    return new NextResponse(errorTwiml, {
      headers: { 'Content-Type': 'text/xml' },
      status: 200, // Return 200 to prevent Twilio retries
    });
  }
}


















