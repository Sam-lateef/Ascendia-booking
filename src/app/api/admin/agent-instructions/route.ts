/**
 * Agent Instructions API
 * GET: Get current agent instructions (premium, receptionist, supervisor)
 * POST: Update agent instructions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

const SYSTEM_AGENT_ID = 'lexi-twilio';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const context = await getCurrentOrganization(request);
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ 
        error: 'Supabase not configured',
        success: false 
      }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();
    
    // Get org-specific config first, fallback to system
    const { data, error } = await supabase
      .from('agent_configurations')
      .select('manual_ai_instructions, receptionist_instructions, supervisor_instructions, whatsapp_instructions, organization_id')
      .or(`organization_id.eq.${context.organizationId},organization_id.is.null`)
      .eq('scope', 'SYSTEM')
      .order('organization_id', { ascending: false, nullsLast: true })
      .limit(1)
      .maybeSingle();

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
      whatsappInstructions: data?.whatsapp_instructions || '',
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
    const { premiumInstructions, receptionistInstructions, supervisorInstructions, whatsappInstructions } = body;

    const supabase = getSupabaseAdmin();
    
    // Check if org-specific config exists
    const { data: existing } = await supabase
      .from('agent_configurations')
      .select('id')
      .eq('organization_id', context.organizationId)
      .eq('scope', 'SYSTEM')
      .maybeSingle();

    if (existing) {
      // Update existing org-specific config
      const { error } = await supabase
        .from('agent_configurations')
        .update({ 
          manual_ai_instructions: premiumInstructions,
          use_manual_instructions: true,
          receptionist_instructions: receptionistInstructions,
          supervisor_instructions: supervisorInstructions,
          whatsapp_instructions: whatsappInstructions,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        console.error('[Instructions API] Failed to update instructions:', error);
        return NextResponse.json({ 
          error: error.message,
          success: false 
        }, { status: 500 });
      }
    } else {
      // Create new org-specific config
      const { error } = await supabase
        .from('agent_configurations')
        .insert({
          agent_id: SYSTEM_AGENT_ID,
          organization_id: context.organizationId,
          name: 'Organization Agent Configuration',
          scope: 'SYSTEM',
          channel: 'system',
          llm_provider: 'openai',
          manual_ai_instructions: premiumInstructions,
          use_manual_instructions: true,
          receptionist_instructions: receptionistInstructions,
          supervisor_instructions: supervisorInstructions,
          whatsapp_instructions: whatsappInstructions,
          created_by: context.userId,
        });

      if (error) {
        console.error('[Instructions API] Failed to create instructions:', error);
        return NextResponse.json({ 
          error: error.message,
          success: false 
        }, { status: 500 });
      }
    }

    console.log('[Instructions API] ✅ Instructions updated successfully for org:', context.organizationId);
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








