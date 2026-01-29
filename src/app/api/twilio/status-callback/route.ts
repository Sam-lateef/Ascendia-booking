/**
 * Twilio Status Callback Handler
 * 
 * Receives status updates from Twilio about call lifecycle:
 * - initiated: Call is being set up
 * - ringing: Phone is ringing
 * - answered: Call was answered
 * - completed: Call ended normally
 * - failed: Call failed
 * - busy: Called party was busy
 * - no-answer: No one answered
 * 
 * Similar to Retell's call_ended webhook - updates conversation with final call data.
 * 
 * Configuration in Twilio Console:
 * Voice Configuration → Status Callback URL
 * https://your-domain.com/api/twilio/status-callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('📞 [TWILIO STATUS CALLBACK] Call status update');
    console.log('='.repeat(70));
    
    // Parse Twilio form data
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const direction = formData.get('Direction') as string;
    const duration = formData.get('CallDuration') as string;
    const timestamp = formData.get('Timestamp') as string;
    
    // Additional metadata
    const forwardedFrom = formData.get('ForwardedFrom') as string;
    const callerName = formData.get('CallerName') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingSid = formData.get('RecordingSid') as string;
    
    console.log(`[Twilio Status] Call SID: ${callSid}`);
    console.log(`[Twilio Status] Status: ${callStatus}`);
    console.log(`[Twilio Status] Duration: ${duration}s`);
    console.log(`[Twilio Status] From: ${from} → To: ${to}`);
    
    // Handle different status events
    switch (callStatus) {
      case 'initiated':
      case 'ringing':
        await handleCallInProgress(callSid, callStatus);
        break;
        
      case 'in-progress':
        await handleCallAnswered(callSid, timestamp);
        break;
        
      case 'completed':
        await handleCallCompleted(callSid, {
          duration: parseInt(duration) || 0,
          from,
          to,
          direction,
          timestamp,
          callerName,
          recordingUrl,
          recordingSid,
        });
        break;
        
      case 'failed':
      case 'busy':
      case 'no-answer':
      case 'canceled':
        await handleCallFailed(callSid, callStatus);
        break;
        
      default:
        console.log(`[Twilio Status] Unknown status: ${callStatus}`);
    }
    
    console.log('='.repeat(70) + '\n');
    
    // Always return 200 OK to Twilio
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Twilio Status] ❌ Error:', error);
    // Still return 200 to prevent Twilio from retrying
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}

/**
 * Handle call in progress (initiated, ringing)
 */
async function handleCallInProgress(callSid: string, status: string) {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('conversations')
    .update({
      call_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('call_id', callSid);
  
  if (error) {
    console.error('[Twilio Status] Error updating call status:', error);
  } else {
    console.log(`[Twilio Status] ✅ Updated status to: ${status}`);
  }
}

/**
 * Handle call answered
 */
async function handleCallAnswered(callSid: string, timestamp: string) {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('conversations')
    .update({
      call_status: 'in-progress',
      answered_at: timestamp,
      updated_at: new Date().toISOString()
    })
    .eq('call_id', callSid);
  
  if (error) {
    console.error('[Twilio Status] Error updating answered status:', error);
  } else {
    console.log('[Twilio Status] ✅ Call answered');
  }
}

/**
 * Handle call completed
 * Mirrors Retell's call_ended webhook behavior
 */
async function handleCallCompleted(
  callSid: string,
  metadata: {
    duration: number;
    from: string;
    to: string;
    direction: string;
    timestamp: string;
    callerName?: string;
    recordingUrl?: string;
    recordingSid?: string;
  }
) {
  const supabase = getSupabaseAdmin();
  
  console.log(`[Twilio Status] Call completed: ${callSid}`);
  console.log(`[Twilio Status] Duration: ${metadata.duration}s`);
  
  // Update conversation with end data
  const updateData: any = {
    call_status: 'completed',
    end_timestamp: Date.now(),
    duration_ms: metadata.duration * 1000, // Convert to ms
    disconnection_reason: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Add recording URL if available
  if (metadata.recordingUrl) {
    updateData.recording_url = metadata.recordingUrl;
    updateData.recording_sid = metadata.recordingSid;
    console.log('[Twilio Status] 🎙️ Recording available:', metadata.recordingUrl);
  }
  
  // Add caller name if available
  if (metadata.callerName) {
    updateData.caller_name = metadata.callerName;
  }
  
  let { data, error } = await supabase
    .from('conversations')
    .update(updateData)
    .eq('call_id', callSid)
    .select();
  
  if (error) {
    console.error('[Twilio Status] ❌ Error updating conversation:', error);
  } else if (!data || data.length === 0) {
    console.warn(`[Twilio Status] ⚠️ No conversation found for call_id: ${callSid}, creating one...`);
    
    // Fallback: Create conversation if it wasn't created by WebSocket handler
    // Look up organization from phone number
    const { getOrganizationIdFromPhone } = await import('@/app/lib/callHelpers');
    let organizationId = await getOrganizationIdFromPhone(metadata.to);
    
    // Special handling for Twilio web client test calls
    if (metadata.from?.startsWith('client:') && !metadata.to) {
      organizationId = 'b445a9c7-af93-4b4a-a975-40d3f44178ec'; // Test org
    }
    
    const insertResult = await supabase
      .from('conversations')
      .insert({
        session_id: `twilio_${callSid}`,
        organization_id: organizationId,
        channel: 'voice',  // DB constraint only allows: voice, sms, whatsapp, web
        call_id: callSid,
        from_number: metadata.from,
        to_number: metadata.to,
        direction: metadata.direction || 'inbound',
        start_timestamp: Date.now() - (metadata.duration * 1000),
        ...updateData
      })
      .select();
    
    if (insertResult.error) {
      console.error('[Twilio Status] ❌ Error creating conversation:', insertResult.error);
    } else {
      data = insertResult.data;
      console.log(`[Twilio Status] ✅ Created conversation: ${data?.[0]?.id}`);
    }
  } else {
    console.log(`[Twilio Status] ✅ Updated conversation: ${data[0].id}`);
    
    // Trigger email notification (async, don't block response)
    try {
      const { sendCallEndedEmail } = await import('@/app/lib/email/sendCallEndedEmail');
      
      sendCallEndedEmail(data[0]).catch(err => {
        console.error('[Twilio Status] Email notification failed:', err);
      });
      
      console.log('[Twilio Status] 📧 Email notification triggered');
    } catch (emailError) {
      console.error('[Twilio Status] Failed to trigger email:', emailError);
    }
  }
}

/**
 * Handle call failed/busy/no-answer
 */
async function handleCallFailed(callSid: string, status: string) {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('conversations')
    .update({
      call_status: status,
      disconnection_reason: status,
      end_timestamp: Date.now(),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('call_id', callSid);
  
  if (error) {
    console.error('[Twilio Status] Error updating failed call:', error);
  } else {
    console.log(`[Twilio Status] ✅ Call ${status}: ${callSid}`);
  }
}
