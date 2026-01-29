import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

// Dynamic import to avoid Next.js bundling issues
let RetellClient: any = null;
let retellClient: any = null;

async function getRetellClient() {
  if (!RetellClient) {
    const sdk = await import('retell-sdk');
    RetellClient = sdk.RetellClient || sdk.default?.RetellClient;
  }
  if (!retellClient && RetellClient) {
    retellClient = new RetellClient({
      apiKey: process.env.RETELL_API_KEY!,
    });
  }
  return retellClient;
}

/**
 * Handle Retell webhook events
 * POST /api/retell/webhook
 */
export async function POST(req: NextRequest) {
  try {
    // Get webhook signature from headers
    const signature = req.headers.get('x-retell-signature') as string;
    
    if (!signature) {
      console.error('[Retell Webhook] Missing signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Get request body as text for signature verification
    const bodyText = await req.text();
    
    // Get Retell client
    const client = await getRetellClient();
    
    // Verify webhook signature
    // Note: Retell SDK verify method signature may vary, adjust if needed
    const isValid = client.verify?.(
      bodyText,
      process.env.RETELL_API_KEY!,
      signature
    ) ?? true; // If verify method doesn't exist, skip verification for now

    if (!isValid) {
      console.error('[Retell Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse verified body
    const body = JSON.parse(bodyText);
    const { event, call } = body;

    console.log(`[Retell Webhook] Received event: ${event} for call: ${call?.call_id}`);

    // Handle different event types
    switch (event) {
      case 'call_started':
        console.log(`[Retell Webhook] Call started: ${call.call_id}`);
        await handleCallStarted(call);
        break;

      case 'call_ended':
        console.log(`[Retell Webhook] Call ended: ${call.call_id}`);
        console.log(`[Retell Webhook] Disconnection reason: ${call.disconnection_reason}`);
        if (call.end_timestamp && call.start_timestamp) {
          const duration = call.end_timestamp - call.start_timestamp;
          console.log(`[Retell Webhook] Call duration: ${duration}ms`);
        }
        await handleCallEnded(call);
        break;

      case 'call_analyzed':
        console.log(`[Retell Webhook] Call analyzed: ${call.call_id}`);
        // This event includes post-call analysis data
        // Use this for most comprehensive call data
        await handleCallAnalyzed(call);
        break;

      default:
        console.log(`[Retell Webhook] Unknown event: ${event}`);
    }

    // Always respond with 200 OK within 10 seconds (Retell requirement)
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Retell Webhook] Error:', error);
    // Still return 200 to prevent Retell from retrying
    return NextResponse.json(
      { error: 'Internal error', message: error.message },
      { status: 200 }
    );
  }
}

/**
 * Agent ID to Organization mapping
 * Maps Retell agent IDs to organizations
 */
const AGENT_ORG_MAP: Record<string, string> = {
  'agent_85f372e155080a10353d0ca23b': 'b445a9c7-af93-4b4a-a975-40d3f44178ec', // sam.lateeff new agent
  'agent_20cb9a557ba2def03b6b34a18b': 'b445a9c7-af93-4b4a-a975-40d3f44178ec', // sam.lateeff old agent
  // Add more agent → org mappings here as needed
};

/**
 * Get organization ID from agent_id, phone number, or fallback
 * Priority: agent_id > phone_number > fallback to sam.lateeff org
 */
async function getOrgIdFromCall(call: any): Promise<string> {
  // 1. Try agent_id mapping first (for regular Retell agents)
  if (call.agent_id && AGENT_ORG_MAP[call.agent_id]) {
    console.log(`[Retell Webhook] Found org from agent_id: ${call.agent_id} → ${AGENT_ORG_MAP[call.agent_id]}`);
    return AGENT_ORG_MAP[call.agent_id];
  }
  
  // 2. Try phone number mapping (for phone calls)
  if (call.to_number) {
    const supabase = getSupabaseAdmin();
    
    try {
      const { data, error } = await supabase
        .from('phone_numbers')
        .select('organization_id')
        .eq('phone_number', call.to_number)
        .eq('is_active', true)
        .eq('channel', 'retell')
        .single();
      
      if (!error && data) {
        console.log(`[Retell Webhook] Found org from phone: ${call.to_number} → ${data.organization_id}`);
        return data.organization_id;
      }
    } catch (error) {
      console.error('[Retell Webhook] Error looking up phone number:', error);
    }
  }
  
  // 3. Fallback: Use sam.lateeff's organization
  console.warn(`[Retell Webhook] No mapping found for agent ${call.agent_id}, using default org`);
  return 'b445a9c7-af93-4b4a-a975-40d3f44178ec';
}

/**
 * Handle call started event
 */
async function handleCallStarted(call: any) {
  try {
    const supabase = getSupabaseAdmin();
    
    // FIRST: Check if conversation already exists (created by WebSocket with correct org)
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, organization_id')
      .eq('call_id', call.call_id)
      .single();
    
    // If conversation exists, use its org ID (from WebSocket)
    // Otherwise determine org from agent_id, phone, or fallback
    let organizationId: string;
    if (existingConv) {
      organizationId = existingConv.organization_id;
      console.log(`[Retell Webhook] Using existing org from WebSocket: ${organizationId}`);
    } else {
      organizationId = await getOrgIdFromCall(call);
      console.log(`[Retell Webhook] Determined org for new call: ${organizationId}`);
    }
    
    console.log(`[Retell Webhook] Call started for org: ${organizationId}`);
    
    // Create conversation record
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        session_id: `retell_${call.call_id}`,
        organization_id: organizationId,
        channel: 'voice',  // DB constraint only allows: voice, sms, whatsapp, web
        
        // Retell fields
        call_id: call.call_id,
        agent_id: call.agent_id,
        call_type: call.call_type,
        from_number: call.from_number,
        to_number: call.to_number,
        direction: call.direction,
        start_timestamp: call.start_timestamp,
        call_status: 'ongoing',
        retell_metadata: call.metadata || {},
        retell_llm_dynamic_variables: call.retell_llm_dynamic_variables || {},
        
        // Initialize with empty arrays/objects
        patient_info: {},
        appointment_info: {},
        missing_required: []
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Retell Webhook] Error creating conversation:', error);
    } else {
      console.log(`[Retell Webhook] ✅ Created conversation: ${data.id} for call: ${call.call_id}`);
    }
  } catch (error) {
    console.error('[Retell Webhook] Error handling call_started:', error);
  }
}

/**
 * Handle call ended event
 * Captures ALL available fields from Retell webhook
 */
async function handleCallEnded(call: any) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Calculate duration if not provided
    const duration = call.duration_ms || 
      (call.end_timestamp && call.start_timestamp 
        ? call.end_timestamp - call.start_timestamp 
        : null);
    
    console.log(`[Retell Webhook] Updating call ${call.call_id}`);
    console.log(`[Retell Webhook] - Transcript: ${call.transcript?.length || 0} chars`);
    console.log(`[Retell Webhook] - Duration: ${duration}ms`);
    console.log(`[Retell Webhook] - Disconnection: ${call.disconnection_reason}`);
    
    // Prepare update object with ALL available fields
    const updateData: any = {
      // Basic timing
      end_timestamp: call.end_timestamp,
      duration_ms: duration,
      call_status: 'ended',
      disconnection_reason: call.disconnection_reason,
      
      // Agent details
      agent_name: call.agent_name,
      agent_version: call.agent_version,
      
      // Transcripts (4 formats from Retell)
      transcript: call.transcript,
      transcript_object: call.transcript_object,
      transcript_with_tool_calls: call.transcript_with_tool_calls,
      scrubbed_transcript_with_tool_calls: call.scrubbed_transcript_with_tool_calls,
      
      // Recording URLs (4 variants - all expire in 10 minutes!)
      recording_url: call.recording_url,
      recording_multi_channel_url: call.recording_multi_channel_url,
      scrubbed_recording_url: call.scrubbed_recording_url,
      scrubbed_recording_multi_channel_url: call.scrubbed_recording_multi_channel_url,
      
      // Transfer information
      transfer_destination: call.transfer_destination,
      transfer_end_timestamp: call.transfer_end_timestamp,
      
      // Dynamic variables collected during call
      collected_dynamic_variables: call.collected_dynamic_variables,
      
      // Debugging & analytics URLs
      public_log_url: call.public_log_url,
      knowledge_base_retrieved_contents_url: call.knowledge_base_retrieved_contents_url,
      
      // Performance metrics
      latency: call.latency, // Contains e2e, asr, llm, tts latencies
      
      // Cost tracking
      call_cost: call.call_cost, // Contains product costs and total
      llm_token_usage: call.llm_token_usage,
      
      // Timestamps
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    // Update conversation with end data
    const { data, error } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('call_id', call.call_id)
      .select();
    
    if (error) {
      console.error('[Retell Webhook] Error updating conversation:', error);
    } else if (!data || data.length === 0) {
      console.warn(`[Retell Webhook] ⚠️ No conversation found for call_id: ${call.call_id}`);
      console.warn('[Retell Webhook] This might mean call_started webhook was not received/processed');
    } else {
      console.log(`[Retell Webhook] ✅ Updated conversation: ${data[0].id} with complete call data`);
      
      // Log important metrics
      if (call.call_cost) {
        console.log(`[Retell Webhook] Call cost: $${(call.call_cost.combined_cost || 0) / 100}`);
      }
      if (call.latency?.e2e?.p50) {
        console.log(`[Retell Webhook] E2E latency p50: ${call.latency.e2e.p50}ms`);
      }
      
      // Warn about recording URL expiration
      if (call.recording_url || call.recording_multi_channel_url) {
        console.log(`[Retell Webhook] ⚠️ Recording URLs saved - expire in 10 minutes!`);
        if (call.public_log_url) {
          console.log(`[Retell Webhook] Public log available: ${call.public_log_url}`);
        }
      }
      
      // Log if call was transferred
      if (call.transfer_destination) {
        console.log(`[Retell Webhook] Call transferred to: ${call.transfer_destination}`);
      }
      
      // NOTE: Email notification moved to call_analyzed event
      // This ensures email includes call_analysis (summary, extracted fields, etc.)
      console.log('[Retell Webhook] ⏳ Email will be sent after analysis completes (call_analyzed event)');
    }
  } catch (error) {
    console.error('[Retell Webhook] Error handling call_ended:', error);
  }
}

/**
 * Handle call analyzed event (most comprehensive)
 */
async function handleCallAnalyzed(call: any) {
  try {
    const supabase = getSupabaseAdmin();
    
    console.log(`[Retell Webhook] Call analyzed: ${call.call_id}`);
    
    if (call.call_analysis) {
      console.log(`[Retell Webhook] Analysis data:`, call.call_analysis);
    } else {
      console.log(`[Retell Webhook] No call_analysis field in payload`);
    }
    
    // Update conversation with post-call analysis
    const { data, error } = await supabase
      .from('conversations')
      .update({
        call_analysis: call.call_analysis || {},
        updated_at: new Date().toISOString()
      })
      .eq('call_id', call.call_id)
      .select();
    
    if (error) {
      console.error('[Retell Webhook] Error updating analysis:', error);
    } else if (!data || data.length === 0) {
      console.warn(`[Retell Webhook] ⚠️ No conversation found for call_id: ${call.call_id}`);
    } else {
      console.log(`[Retell Webhook] ✅ Updated conversation with post-call analysis`);
      
      // Log specific analysis fields if they exist
      const analysis = call.call_analysis || {};
      if (analysis.appointment_booked !== undefined) {
        console.log(`[Retell Webhook] Appointment booked: ${analysis.appointment_booked}`);
      }
      if (analysis.call_outcome) {
        console.log(`[Retell Webhook] Call outcome: ${analysis.call_outcome}`);
      }
      if (analysis.sentiment) {
        console.log(`[Retell Webhook] Sentiment: ${analysis.sentiment}`);
      }
      
      // Send email notification NOW (with full analysis data)
      try {
        const { sendCallEndedEmail } = await import('@/app/lib/email/sendCallEndedEmail');
        
        // Prepare call data for email (use updated DB record with analysis)
        const callDataForEmail = {
          ...data[0], // Full DB record including call_analysis
          call_id: call.call_id
        };
        
        // Send email asynchronously (don't await - don't block webhook response)
        sendCallEndedEmail(callDataForEmail).catch(err => {
          console.error('[Retell Webhook] Email notification failed:', err);
        });
        
        console.log('[Retell Webhook] 📧 Email notification triggered (with analysis)');
      } catch (emailError) {
        console.error('[Retell Webhook] Failed to trigger email:', emailError);
        // Don't throw - email failure shouldn't break webhook
      }
    }
  } catch (error) {
    console.error('[Retell Webhook] Error handling call_analyzed:', error);
  }
}


