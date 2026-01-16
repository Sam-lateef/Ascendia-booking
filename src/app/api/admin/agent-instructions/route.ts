/**
 * Agent Instructions API
 * GET: Get current agent instructions (premium, receptionist, supervisor)
 * POST: Update agent instructions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SYSTEM_AGENT_ID = 'lexi-twilio';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    await getCurrentOrganization(request);
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ 
        error: 'Supabase not configured',
        success: false 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data, error } = await supabase
      .from('agent_configurations')
      .select('manual_ai_instructions, receptionist_instructions, supervisor_instructions')
      .eq('agent_id', SYSTEM_AGENT_ID)
      .eq('scope', 'SYSTEM')
      .single();

    if (error) {
      console.error('[Instructions API] Error fetching instructions:', error);
      return NextResponse.json({ 
        error: error.message,
        success: false 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      premiumInstructions: data?.manual_ai_instructions || '',
      receptionistInstructions: data?.receptionist_instructions || '',
      supervisorInstructions: data?.supervisor_instructions || '',
      success: true 
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Instructions API] Error:', errorMessage);
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
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ 
        error: 'Supabase not configured',
        success: false 
      }, { status: 500 });
    }

    const body = await req.json();
    const { premiumInstructions, receptionistInstructions, supervisorInstructions } = body;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Update instructions
    const { error } = await supabase
      .from('agent_configurations')
      .update({ 
        manual_ai_instructions: premiumInstructions,
        use_manual_instructions: true, // Enable manual instructions
        receptionist_instructions: receptionistInstructions,
        supervisor_instructions: supervisorInstructions,
        updated_at: new Date().toISOString()
      })
      .eq('agent_id', SYSTEM_AGENT_ID)
      .eq('scope', 'SYSTEM');

    if (error) {
      console.error('[Instructions API] Failed to update instructions:', error);
      return NextResponse.json({ 
        error: error.message,
        success: false 
      }, { status: 500 });
    }

    console.log('[Instructions API] ✅ Instructions updated successfully');
    return NextResponse.json({ 
      success: true,
      message: 'Instructions updated successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Instructions API] Error:', errorMessage);
    return NextResponse.json({ 
      error: errorMessage,
      success: false 
    }, { status: 500 });
  }
}








