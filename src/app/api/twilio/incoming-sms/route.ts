/**
 * Twilio Incoming SMS Handler - MULTI-TENANT VERSION
 * 
 * Processes SMS messages with proper multi-tenant organization routing.
 * Mirrors the voice integration architecture:
 * - Organization routing via phone number lookup
 * - Database conversation records with RLS
 * - Message logging to conversation_messages table
 * - Proper Supabase client usage (getSupabaseWithOrg)
 * 
 * Based on lessons from voice integration (incoming-call/route.ts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLexi } from '@/app/agentConfigs/embeddedBooking/lexiAgentTwilio';
import { getOrganizationIdFromPhone } from '@/app/lib/callHelpers';
import { getSupabaseWithOrg } from '@/app/lib/supabaseClient';

export async function POST(req: NextRequest) {
  console.log('\n' + '='.repeat(70));
  console.log('💬 [TWILIO SMS] NEW INCOMING MESSAGE');
  console.log('='.repeat(70));
  
  try {
    // Parse Twilio form data
    const formData = await req.formData();
    const body = formData.get('Body') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const messageSid = formData.get('MessageSid') as string;

    console.log(`[Twilio SMS] 📱 From: ${from}`);
    console.log(`[Twilio SMS] 📱 To: ${to}`);
    console.log(`[Twilio SMS] 🆔 MessageSid: ${messageSid}`);
    console.log(`[Twilio SMS] 💬 Body: "${body}"`);

    if (!body || !from) {
      throw new Error('Missing required fields: Body or From');
    }

    // CRITICAL: Look up organization from phone number
    // This ensures SMS are routed to the correct tenant
    const organizationId = await getOrganizationIdFromPhone(to);
    console.log(`[Twilio SMS] 🏢 Organization: ${organizationId}`);

    // Get Supabase client with organization context for RLS
    const supabase = getSupabaseWithOrg(organizationId);

    // Create unique session ID for SMS conversation
    // Format: sms_<from_number>_<to_number>
    const sessionId = `sms_${from.replace(/\D/g, '')}_${to.replace(/\D/g, '')}`;
    
    // Get or create conversation record
    let { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, organization_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    const isFirstMessage = !conversation;

    if (!conversation) {
      // Create new conversation for this SMS thread
      console.log(`[Twilio SMS] 📝 Creating new conversation: ${sessionId}`);
      
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          session_id: sessionId,
          organization_id: organizationId,
          channel: 'sms',
          from_number: from,
          to_number: to,
          direction: 'inbound',
          start_timestamp: Date.now(),
          call_status: 'ongoing',
          metadata: {
            channel: 'twilio_sms',
            last_message_sid: messageSid,
          }
        })
        .select('id, organization_id')
        .single();

      if (createError || !newConversation) {
        console.error('[Twilio SMS] ❌ Failed to create conversation:', createError);
        throw new Error('Failed to create conversation record');
      }

      conversation = newConversation;
      console.log(`[Twilio SMS] ✅ Created conversation: ${conversation.id}`);
    } else {
      // Update existing conversation timestamp
      await supabase
        .from('conversations')
        .update({
          updated_at: new Date().toISOString(),
          metadata: {
            channel: 'twilio_sms',
            last_message_sid: messageSid,
          }
        })
        .eq('id', conversation.id);
    }

    // Log incoming user message to database
    await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        organization_id: organizationId,
        role: 'user',
        content: body,
        timestamp: new Date().toISOString(),
        metadata: {
          message_sid: messageSid,
          from: from,
          to: to,
        }
      });

    console.log(`[Twilio SMS] 📥 Logged user message to database`);

    // Load conversation history from database
    const { data: messages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('role, content, timestamp')
      .eq('conversation_id', conversation.id)
      .order('timestamp', { ascending: true })
      .limit(50); // Last 50 messages for context

    // Convert to format expected by callLexi
    const history = messages?.map((msg: any) => ({
      type: 'message',
      role: msg.role,
      content: msg.content,
    })) || [];

    // Process message with Lexi
    console.log(`[Twilio SMS] 🤖 Processing with Lexi (${isFirstMessage ? 'first' : 'continuing'} message)...`);
    const response = await callLexi(body, history, isFirstMessage);

    // Log assistant response to database
    await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        organization_id: organizationId,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        metadata: {
          channel: 'twilio_sms',
        }
      });

    console.log(`[Twilio SMS] 📤 Logged assistant response to database`);
    console.log(`[Twilio SMS] ✅ Response: "${response}"`);

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

    console.log('='.repeat(70) + '\n');

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[Twilio SMS] ❌ Error:', error);
    console.log('='.repeat(70) + '\n');
    
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


















