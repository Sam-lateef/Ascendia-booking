/**
 * Twilio Incoming Call Handler - DYNAMIC MODE ROUTING
 * Automatically routes to Premium or Standard based on saved setting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentMode, getWebSocketUrlForMode } from '@/app/lib/agentMode';

export async function POST(req: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('📞 [TWILIO VOICE CALL] NEW INCOMING CALL');
  console.log('='.repeat(70));
  
  try {
    // Parse Twilio form data
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callSid = formData.get('CallSid') as string;

    console.log(`[Twilio Call] 📱 From: ${from}`);
    console.log(`[Twilio Call] 📱 To: ${to}`);
    console.log(`[Twilio Call] 🆔 CallSid: ${callSid}`);

    // Get current agent mode (Premium or Standard)
    const mode = await getAgentMode();
    const wsUrl = getWebSocketUrlForMode(mode);
    
    console.log(`[Twilio Call] 🎯 Mode: ${mode.toUpperCase()} (${mode === 'standard' ? 'cost-optimized' : 'full power'})`);

    // Return TwiML that connects to our WebSocket server for bidirectional audio streaming
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${wsUrl}" />
    </Connect>
</Response>`;

    console.log(`[Twilio Call] 🔌 WebSocket URL: ${wsUrl}`);
    console.log(`[Twilio Call] ✅ Returning TwiML to connect audio stream`);
    console.log('='.repeat(70) + '\n');

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[Twilio Call] Error:', error);
    
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

