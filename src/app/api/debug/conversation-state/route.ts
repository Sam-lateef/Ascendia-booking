import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';

/**
 * Debug endpoint to inspect conversation state
 * GET /api/debug/conversation-state?sessionId=retell_xxx&callId=call_xxx
 * 
 * Returns:
 * - Conversation record from database
 * - All messages
 * - All function calls
 * - Conversation state (extracted fields)
 */
export async function GET(req: NextRequest) {
  try {
    const context = await getCurrentOrganization(req);
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const callId = searchParams.get('callId');

    if (!sessionId && !callId) {
      return NextResponse.json(
        { error: 'Either sessionId or callId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Find conversation
    let conversationQuery = supabase
      .from('conversations')
      .select('*')
      .eq('organization_id', context.organizationId);

    if (sessionId) {
      conversationQuery = conversationQuery.eq('session_id', sessionId);
    } else if (callId) {
      conversationQuery = conversationQuery.eq('call_id', callId);
    }

    const { data: conversation, error: convError } = await conversationQuery.single();

    if (convError || !conversation) {
      return NextResponse.json(
        { 
          error: 'Conversation not found', 
          details: convError,
          searched: { sessionId, callId, organizationId: context.organizationId }
        },
        { status: 404 }
      );
    }

    // Get all messages
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    // Get all function calls
    const { data: functionCalls } = await supabase
      .from('function_calls')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    // Parse conversation state
    const conversationState = typeof conversation.conversation_state === 'string' 
      ? JSON.parse(conversation.conversation_state || '{}')
      : conversation.conversation_state || {};

    // Parse call analysis
    const callAnalysis = typeof conversation.call_analysis === 'string'
      ? JSON.parse(conversation.call_analysis || '{}')
      : conversation.call_analysis || {};

    return NextResponse.json({
      debug_info: {
        session_id: conversation.session_id,
        call_id: conversation.call_id,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        channel: conversation.channel,
        call_status: conversation.call_status,
      },
      conversation: {
        id: conversation.id,
        duration_sec: conversation.duration_sec,
        disconnection_reason: conversation.disconnection_reason,
        transcript: conversation.transcript,
        recording_url: conversation.recording_url,
        public_log_url: conversation.public_log_url,
      },
      call_analysis: callAnalysis,
      conversation_state: conversationState,
      messages: messages || [],
      function_calls: (functionCalls || []).map(fc => ({
        function_name: fc.function_name,
        parameters: typeof fc.parameters === 'string' ? JSON.parse(fc.parameters) : fc.parameters,
        result: typeof fc.result === 'string' ? JSON.parse(fc.result) : fc.result,
        success: fc.success,
        created_at: fc.created_at,
      })),
      stats: {
        total_messages: messages?.length || 0,
        total_function_calls: functionCalls?.length || 0,
        booking_attempts: functionCalls?.filter(fc => 
          fc.function_name === 'CreateAppointment'
        ).length || 0,
        patient_searches: functionCalls?.filter(fc => 
          fc.function_name === 'GetMultiplePatients'
        ).length || 0,
      }
    });

  } catch (error: any) {
    console.error('[Debug API] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500 }
    );
  }
}
