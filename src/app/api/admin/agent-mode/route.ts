/**
 * Agent Mode API
 * GET: Get current agent mode (premium or standard)
 * POST: Set agent mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getAgentMode, setAgentMode, type AgentMode } from '@/app/lib/agentMode';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    await getCurrentOrganization(request);
    
    const mode = await getAgentMode();
    return NextResponse.json({ 
      mode,
      success: true 
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: errorMessage,
      success: false 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const context = await getCurrentOrganization(req);
    if (!['owner', 'admin'].includes(context.role)) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }
    
    const body = await req.json();
    const { mode } = body;

    if (!mode || (mode !== 'premium' && mode !== 'standard')) {
      return NextResponse.json({ 
        error: 'Invalid mode. Must be "premium" or "standard"',
        success: false 
      }, { status: 400 });
    }

    const result = await setAgentMode(mode as AgentMode);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error,
        success: false 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      mode,
      success: true,
      message: `Agent mode switched to ${mode}`
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: errorMessage,
      success: false 
    }, { status: 500 });
  }
}








