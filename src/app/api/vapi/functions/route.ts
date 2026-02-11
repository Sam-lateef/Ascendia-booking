/**
 * Vapi Server Webhook
 *
 * Receives ALL server events from Vapi (same Server URL for all events).
 * Handles: tool-calls (function execution), status-update, end-of-call-report.
 * Logs call data to DB for Admin UI parity with Twilio/Retell.
 *
 * Flow:
 * - status-update "in-progress" → Create conversation
 * - tool-calls → Execute functions, log to function_calls table
 * - end-of-call-report → Update transcript, recording, duration
 * - Other events → Acknowledge with 200
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';
import { mapVapiFunction, validateVapiCall, type VapiFunctionCall } from '@/app/lib/vapi/functionMapper';
import { formatVapiResponse, logFormatterConfig } from '@/app/lib/vapi/responseFormatter';
import * as bookingFunctions from '../../booking/functions';

logFormatterConfig();

/** Vapi Call object (subset we use) - webhook/API may use startedAt/endedAt or startTimestamp/endTimestamp */
interface VapiCall {
  id?: string;
  assistantId?: string;
  phoneNumberId?: string;
  type?: string;
  phoneNumber?: { number?: string } | string;
  customer?: { number?: string } | string;
  startTimestamp?: number;
  endTimestamp?: number;
  startedAt?: string;
  endedAt?: string;
}

/** Generic Vapi message envelope */
interface VapiMessage {
  type: string;
  call?: VapiCall;
  status?: string;
  endedReason?: string;
  artifact?: {
    transcript?: string;
    recording?: { url?: string };
    messages?: Array<{ role: string; message?: string }>;
  };
  toolCallList?: VapiFunctionCall[];
  toolWithToolCallList?: Array<{ name: string; toolCall: { id: string; parameters?: Record<string, any> } }>;
}

interface VapiWebhookRequest {
  message: VapiMessage;
}

/**
 * POST /api/vapi/functions - Handle all Vapi server events
 */
export async function POST(req: NextRequest) {
  try {
    const payload: VapiWebhookRequest = await req.json();
    const msg = payload?.message;

    if (!msg) {
      console.warn('[Vapi Webhook] No message in payload');
      return NextResponse.json({ error: 'No message' }, { status: 400 });
    }

    const msgType = msg.type;
    const callId = msg.call?.id;
    const assistantId = msg.call?.assistantId;

    console.log(`[Vapi Webhook] Event: ${msgType}, Call: ${callId}`);

    // Route by message type
    switch (msgType) {
      case 'tool-calls':
        return await handleToolCalls(msg);

      case 'status-update':
        await handleStatusUpdate(msg);
        return NextResponse.json({ received: true });

      case 'end-of-call-report':
        await handleEndOfCallReport(msg);
        return NextResponse.json({ received: true });

      case 'transcript':
      case 'conversation-update':
      case 'hang':
      default:
        // Acknowledge informational events
        return NextResponse.json({ received: true });
    }
  } catch (error: any) {
    console.error('[Vapi Webhook] Fatal error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle tool-calls: execute functions and return results
 */
async function handleToolCalls(msg: VapiMessage) {
  const { toolCallList, call } = msg;

  if (!toolCallList || toolCallList.length === 0) {
    return NextResponse.json({ error: 'No tool calls provided' }, { status: 400 });
  }

  const organizationId = await getOrganizationFromAssistant(call?.assistantId);
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const results: Array<{ toolCallId: string; result: string }> = [];

  for (const toolCall of toolCallList) {
    const funcName = toolCall.function?.name ?? (toolCall as any).name;
    const args = toolCall.function?.arguments ?? (toolCall as any).parameters ?? {};

    console.log(`[Vapi Webhook] Tool: ${funcName}`);

    try {
      const validation = validateVapiCall({ ...toolCall, function: { name: funcName, arguments: args } });
      if (!validation.valid) {
        results.push({
          toolCallId: toolCall.id,
          result: formatVapiResponse(funcName, null, new Error(validation.error))
        });
        continue;
      }

      const mapped = mapVapiFunction({ ...toolCall, function: { name: funcName, arguments: args } });
      const handler = (bookingFunctions as any)[mapped.ourFunctionName];

      if (!handler || typeof handler !== 'function') {
        throw new Error(`Function not found: ${mapped.ourFunctionName}`);
      }

      const result = await executeFunction(handler, mapped.parameters, organizationId);
      const formattedResult = formatVapiResponse(funcName, result);
      results.push({ toolCallId: toolCall.id, result: formattedResult });

      await logFunctionCall(call?.id, { ...toolCall, function: { name: funcName, arguments: args } }, result, organizationId);
    } catch (error: any) {
      console.error(`[Vapi Webhook] Error ${funcName}:`, error);
      results.push({
        toolCallId: toolCall.id,
        result: formatVapiResponse(funcName, null, error)
      });
    }
  }

  return NextResponse.json({ results });
}

/**
 * Handle status-update: create conversation on in-progress
 */
async function handleStatusUpdate(msg: VapiMessage) {
  const { call, status } = msg;
  const callId = call?.id;
  const assistantId = call?.assistantId;

  if (!callId) return;

  const organizationId = await getOrganizationFromAssistant(assistantId);
  if (!organizationId) return;

  const supabase = getSupabaseAdmin();

  if (status === 'in-progress') {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('call_id', callId)
      .maybeSingle();

    if (!existing) {
      const fromNumber = call?.customer && typeof call.customer === 'object'
        ? call.customer.number
        : typeof call?.customer === 'string' ? call.customer : undefined;
      const toNumber = call?.phoneNumber && typeof call.phoneNumber === 'object'
        ? call.phoneNumber.number
        : typeof call?.phoneNumber === 'string' ? call.phoneNumber : undefined;

      const startTs = call?.startTimestamp ?? (call?.startedAt ? new Date(call.startedAt).getTime() : Date.now());

      const { error: insertError } = await supabase.from('conversations').insert({
        session_id: `vapi_${callId}`,
        organization_id: organizationId,
        channel: 'voice',
        call_id: callId,
        agent_id: assistantId,
        from_number: fromNumber,
        to_number: toNumber,
        direction: 'inbound',
        start_timestamp: startTs,
        call_status: 'ongoing',
        call_type: 'vapi'
      });
      if (insertError) {
        console.error(`[Vapi Webhook] Failed to create conversation for call ${callId}:`, insertError);
      } else {
        console.log(`[Vapi Webhook] Created conversation for call ${callId}, org: ${organizationId}`);
      }
    }
  } else if (status === 'ended') {
    const endTs = call?.endTimestamp ?? (call?.endedAt ? new Date(call.endedAt).getTime() : Date.now());
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        call_status: 'ended',
        end_timestamp: endTs
      })
      .eq('call_id', callId);
    if (updateError) {
      console.error(`[Vapi Webhook] Failed to update call ${callId} as ended:`, updateError);
    } else {
      console.log(`[Vapi Webhook] Marked call ${callId} as ended`);
    }
  }
}

/**
 * Handle end-of-call-report: transcript, recording, duration
 */
async function handleEndOfCallReport(msg: VapiMessage) {
  const { call, endedReason, artifact } = msg;
  const callId = call?.id;

  if (!callId) return;

  const supabase = getSupabaseAdmin();

  let startTs = call?.startTimestamp ?? (call?.startedAt ? new Date(call.startedAt).getTime() : undefined);
  const endTs = call?.endTimestamp ?? (call?.endedAt ? new Date(call.endedAt).getTime() : Date.now());

  // If no startTs from Vapi payload, try to get it from the existing conversation record
  if (!startTs) {
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('start_timestamp, created_at')
      .eq('call_id', callId)
      .maybeSingle();
    if (existingConv?.start_timestamp) {
      startTs = existingConv.start_timestamp;
    } else if (existingConv?.created_at) {
      startTs = new Date(existingConv.created_at).getTime();
    }
  }

  const durationMs = startTs && endTs ? endTs - startTs : null;

  const updateData: Record<string, any> = {
    call_status: 'ended',
    end_timestamp: endTs,
    disconnection_reason: endedReason ?? 'ended',
    transcript: artifact?.transcript ?? undefined,
    recording_url: artifact?.recording?.url ?? undefined,
    duration_ms: durationMs ?? undefined,
    completed_at: new Date().toISOString()
  };

  if (artifact?.messages && Array.isArray(artifact.messages)) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, organization_id')
      .eq('call_id', callId)
      .single();

    if (conv) {
      let seq = 0;
      for (const m of artifact.messages) {
        const content = m.message ?? (typeof m === 'object' ? JSON.stringify(m) : String(m));
        if (!content || typeof content !== 'string') continue;
        const role = m.role === 'user' ? 'user' : 'assistant';
        await supabase.from('conversation_messages').insert({
          conversation_id: conv.id,
          organization_id: conv.organization_id,
          role,
          content,
          sequence_num: seq++
        }).then(() => {}).catch((err) => console.warn('[Vapi Webhook] Message insert skip:', err?.message));
      }
    }
  }

  const { error, data: updatedRows } = await supabase
    .from('conversations')
    .update(updateData)
    .eq('call_id', callId)
    .select('*')
    .single();

  if (error) {
    console.error('[Vapi Webhook] Error updating end-of-call:', error);
  } else {
    console.log(`[Vapi Webhook] Updated call ${callId}: transcript=${!!artifact?.transcript}, recording=${!!artifact?.recording?.url}`);
    
    // Send email notification (same as Retell/Twilio)
    if (updatedRows) {
      try {
        const { sendCallEndedEmail } = await import('@/app/lib/email/sendCallEndedEmail');
        const callDataForEmail = {
          ...updatedRows,
          call_id: callId
        };
        sendCallEndedEmail(callDataForEmail).catch(err => {
          console.error('[Vapi Webhook] Email notification failed:', err);
        });
        console.log('[Vapi Webhook] Email notification triggered');
      } catch (emailError) {
        console.error('[Vapi Webhook] Failed to trigger email:', emailError);
      }
    }
  }
}

async function getOrganizationFromAssistant(assistantId: string | undefined): Promise<string | null> {
  if (!assistantId) {
    const { getDefaultOrganizationId } = await import('@/app/lib/callHelpers');
    return getDefaultOrganizationId();
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('vapi_assistants')
      .select('organization_id')
      .eq('assistant_id', assistantId)
      .eq('is_active', true)
      .maybeSingle();

    if (data?.organization_id) return data.organization_id;

    const { getDefaultOrganizationId } = await import('@/app/lib/callHelpers');
    return getDefaultOrganizationId();
  } catch {
    const { getDefaultOrganizationId } = await import('@/app/lib/callHelpers');
    return getDefaultOrganizationId();
  }
}

async function executeFunction(
  handler: Function,
  parameters: Record<string, any>,
  organizationId: string
): Promise<any> {
  const { getSupabaseWithOrg } = await import('@/app/lib/supabaseClient');
  const orgDb = await getSupabaseWithOrg(organizationId);
  const paramsWithOrg = { ...parameters, organization_id: organizationId };
  return handler(paramsWithOrg, orgDb, organizationId);
}

/**
 * Log function call: create/update conversation + insert into function_calls table
 */
async function logFunctionCall(
  callId: string | undefined,
  toolCall: VapiFunctionCall,
  result: any,
  organizationId: string
): Promise<void> {
  if (!callId) return;

  try {
    const supabase = getSupabaseAdmin();
    const funcName = toolCall.function?.name ?? (toolCall as any).name;
    const params = toolCall.function?.arguments ?? (toolCall as any).parameters ?? {};

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('call_id', callId)
      .maybeSingle();

    let conversationId = existing?.id;

    if (!existing) {
      const { data: inserted } = await supabase
        .from('conversations')
        .insert({
          session_id: `vapi_${callId}`,
          organization_id: organizationId,
          channel: 'voice',
          call_id: callId,
          start_timestamp: Date.now(),
          call_status: 'ongoing',
          call_type: 'vapi'
        })
        .select('id')
        .single();
      conversationId = inserted?.id;
    }

    if (conversationId) {
      await supabase.from('function_calls').insert({
        conversation_id: conversationId,
        organization_id: organizationId,
        function_name: funcName,
        parameters: params,
        result: result ? JSON.stringify(result).substring(0, 10000) : null
      });

      // Update retell_metadata to track function calls (reusing existing JSON column)
      const { data: conv } = await supabase
        .from('conversations')
        .select('retell_metadata')
        .eq('id', conversationId)
        .single();

      const existingMeta = (conv?.retell_metadata as Record<string, any>) || {};
      const existingCalls = existingMeta?.function_calls ?? [];
      const updatedCalls = [...existingCalls, {
        function: funcName,
        timestamp: new Date().toISOString(),
        result
      }];

      await supabase
        .from('conversations')
        .update({
          retell_metadata: {
            ...existingMeta,
            channel: 'vapi',
            function_calls: updatedCalls
          }
        })
        .eq('id', conversationId);
    }
  } catch (error) {
    console.error('[Vapi Webhook] Error logging function call:', error);
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Vapi Server Webhook',
    timestamp: new Date().toISOString(),
    supportedEvents: ['tool-calls', 'status-update', 'end-of-call-report'],
    supportedFunctions: [
      'checkAvailability',
      'findPatient',
      'createPatient',
      'bookAppointment',
      'cancelAppointment'
    ]
  });
}
