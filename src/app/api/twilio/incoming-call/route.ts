/**
 * Twilio Incoming Call Handler - MULTI-TENANT ORGANIZATION ROUTING
 * 
 * Looks up organization from phone number (To field) for proper multi-tenant routing.
 * Passes organization ID to WebSocket handler via URL parameter.
 * 
 * Based on lessons from Retell integration:
 * - Organization routing is CRITICAL for multi-tenant support
 * - Phone number → organization mapping prevents calls appearing in wrong org
 * - WebSocket needs org context to load correct instructions and create conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationIdFromPhone } from '@/app/lib/callHelpers';
import { getTwilioCredentials } from '@/app/lib/credentialLoader';
import { getChannelConfig } from '@/app/lib/channelConfigLoader';

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

    // CRITICAL: Look up organization from phone number
    // This ensures calls are routed to the correct tenant
    let organizationId: string;
    
    // Special handling for Twilio web client calls (testing)
    // Web client calls show as "client:Anonymous" and don't have a 'To' number
    if (from && from.startsWith('client:') && !to) {
      // Route web client test calls to sam.lateeff's organization
      organizationId = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';
      console.log(`[Twilio Call] 🧪 Web client test call - routing to sam.lateeff's org`);
    } else {
      // Real phone calls: lookup org from phone number
      organizationId = await getOrganizationIdFromPhone(to);
    }
    
    console.log(`[Twilio Call] 🏢 Organization: ${organizationId}`);

    // Get WebSocket URL - try database first, fall back to environment
    // This allows per-organization Twilio configuration
    let baseWsUrl = process.env.TWILIO_WEBSOCKET_URL || 'wss://localhost:8080/twilio-media-stream';
    let credentialSource = 'ENV';
    let agentMode = 'one_agent'; // Default to one-agent mode
    
    try {
      const dbCredentials = await getTwilioCredentials(organizationId);
      if (dbCredentials.websocketUrl && dbCredentials.websocketUrl.trim() !== '') {
        baseWsUrl = dbCredentials.websocketUrl;
        credentialSource = 'DATABASE';
        console.log(`[Twilio Call] ✅ Loaded WebSocket URL from DATABASE for org: ${organizationId}`);
      } else {
        console.log(`[Twilio Call] ℹ️ No DB websocket_url, using ENV fallback`);
      }
    } catch (error) {
      console.log(`[Twilio Call] ⚠️ DB credential lookup failed, using ENV fallback:`, error);
    }
    
    // Check channel config for agent mode (one_agent vs two_agent)
    try {
      const channelConfig = await getChannelConfig(organizationId, 'twilio');
      agentMode = channelConfig.settings?.agent_mode || 'one_agent';
      console.log(`[Twilio Call] 🤖 Agent Mode: ${agentMode}`);
      
      // Route to the correct WebSocket endpoint based on mode
      if (agentMode === 'two_agent') {
        // Two-agent mode uses the standard endpoint (gpt-4o-mini + gpt-4o supervisor)
        baseWsUrl = baseWsUrl.replace('/twilio-media-stream', '/twilio-media-stream-standard');
        console.log(`[Twilio Call] 🔀 Routing to TWO-AGENT mode (standard endpoint)`);
      } else {
        // One-agent mode uses the default endpoint (single gpt-4o-realtime)
        console.log(`[Twilio Call] 🔀 Routing to ONE-AGENT mode (premium endpoint)`);
      }
    } catch (error) {
      console.log(`[Twilio Call] ⚠️ Channel config lookup failed, using one-agent mode:`, error);
    }
    
    console.log(`[Twilio Call] 🔧 Credential Source: ${credentialSource}`);
    
    // Pass organization ID and call metadata to WebSocket via URL parameters
    // This allows WebSocket handler to:
    // 1. Load organization-specific instructions from DB
    // 2. Create conversation record with correct org ID
    // 3. Use proper Supabase client with org context (getSupabaseWithOrg)
    // Build URL with only non-empty parameters to avoid issues with trailing empty params
    const params = new URLSearchParams();
    params.set('orgId', organizationId);
    params.set('callSid', callSid);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const wsUrl = `${baseWsUrl}?${params.toString()}`;
    
    console.log(`[Twilio Call] 🔌 WebSocket URL: ${baseWsUrl}`);
    console.log(`[Twilio Call] 📋 Org ID passed to WebSocket: ${organizationId}`);
    console.log(`[Twilio Call] 🔗 Full WS URL: ${wsUrl}`);

    // Return TwiML that connects to our WebSocket server for bidirectional audio streaming
    // Using Parameter elements to pass metadata (sent in start message)
    // This includes all call info so the WebSocket handler has full context
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${baseWsUrl}">
            <Parameter name="orgId" value="${organizationId}" />
            <Parameter name="callSid" value="${callSid}" />
            <Parameter name="from" value="${from || ''}" />
            <Parameter name="to" value="${to || ''}" />
        </Stream>
    </Connect>
</Response>`;

    console.log(`[Twilio Call] ✅ Returning TwiML to connect audio stream`);
    console.log(`[Twilio Call] 📄 TwiML:\n${twiml}`);
    console.log('='.repeat(70) + '\n');

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[Twilio Call] ❌ Error:', error);
    
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

