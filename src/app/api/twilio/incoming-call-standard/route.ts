/**
 * Twilio Incoming Call Handler - STANDARD MODE
 * Uses the two-agent approach (gpt-4o-mini chat + gpt-4o supervisor)
 * Returns TwiML that connects the call to the Standard WebSocket endpoint
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('📞 [TWILIO STANDARD] NEW INCOMING CALL');
  console.log('='.repeat(70));
  
  try {
    // Parse Twilio form data
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callSid = formData.get('CallSid') as string;

    console.log(`[Standard Call] 📱 From: ${from}`);
    console.log(`[Standard Call] 📱 To: ${to}`);
    console.log(`[Standard Call] 🆔 CallSid: ${callSid}`);
    console.log(`[Standard Call] 💰 Mode: Standard (cost-optimized, two-agent)`);

    // Get WebSocket URL - use standard endpoint
    const baseWsUrl = process.env.TWILIO_WEBSOCKET_URL || 'wss://ascendia-ws.ngrok.io/twilio-media-stream';
    // Replace the endpoint path for standard mode
    const wsUrl = baseWsUrl.replace('/twilio-media-stream', '/twilio-media-stream-standard');

    // Return TwiML that connects to Standard WebSocket endpoint
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${wsUrl}" />
    </Connect>
</Response>`;

    console.log(`[Standard Call] 🔌 WebSocket URL: ${wsUrl}`);
    console.log(`[Standard Call] ✅ Returning TwiML for standard mode`);
    console.log('='.repeat(70) + '\n');

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Standard Call] Error:', errorMessage);
    
    // Return error TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Sorry, we encountered an error. Please try again later.</Say>
</Response>`;
    
    return new NextResponse(errorTwiml, {
      headers: { 'Content-Type': 'text/xml' },
      status: 500,
    });
  }
}








