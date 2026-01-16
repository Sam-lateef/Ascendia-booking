/**
 * Conversation State API
 * 
 * Manages conversation state independently of the LLM.
 * This allows:
 * - Tracking extracted parameters
 * - Auto-filling function calls
 * - Debugging conversations
 * - Model-agnostic state management
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateState,
  processMessage,
  recordFunctionCall,
  getAutoFilledParameters,
  clearState,
  getStateSummary,
  ConversationState,
} from '@/app/lib/conversationState';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, sessionId, ...data } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: true, message: 'sessionId is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'get':
        // Get current state
        const state = getOrCreateState(sessionId);
        return NextResponse.json({ 
          success: true, 
          state,
          summary: getStateSummary(sessionId)
        });

      case 'process_message':
        // Process a message and extract parameters
        if (!data.message || !data.role) {
          return NextResponse.json(
            { error: true, message: 'message and role are required' },
            { status: 400 }
          );
        }
        const updatedState = processMessage(sessionId, data.message, data.role);
        console.log(`[Conversation] Processed message for ${sessionId}:`, getStateSummary(sessionId));
        return NextResponse.json({ 
          success: true, 
          state: updatedState,
          extracted: {
            patient: updatedState.patient,
            appointment: updatedState.appointment,
            intent: updatedState.intent,
            missingRequired: updatedState.missingRequired,
          }
        });

      case 'record_function_call':
        // Record a function call
        recordFunctionCall(
          sessionId,
          data.functionName,
          data.parameters,
          data.result,
          data.error
        );
        return NextResponse.json({ success: true });

      case 'get_auto_params':
        // Get auto-filled parameters for a function
        if (!data.functionName) {
          return NextResponse.json(
            { error: true, message: 'functionName is required' },
            { status: 400 }
          );
        }
        const autoParams = getAutoFilledParameters(sessionId, data.functionName);
        return NextResponse.json({ 
          success: true, 
          functionName: data.functionName,
          autoFilledParameters: autoParams,
          hint: Object.keys(autoParams).length === 0 
            ? 'No parameters could be auto-filled. Need more info from conversation.'
            : `Auto-filled ${Object.keys(autoParams).length} parameters from conversation state.`
        });

      case 'clear':
        // Clear conversation state
        clearState(sessionId);
        return NextResponse.json({ success: true, message: 'State cleared' });

      default:
        return NextResponse.json(
          { error: true, message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('[Conversation API] Error:', error);
    return NextResponse.json(
      { error: true, message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json(
      { error: true, message: 'sessionId query parameter is required' },
      { status: 400 }
    );
  }
  
  const state = getOrCreateState(sessionId);
  const summary = getStateSummary(sessionId);
  
  return NextResponse.json({
    success: true,
    state,
    summary
  });
}

