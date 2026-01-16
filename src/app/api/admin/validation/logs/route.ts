import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * GET /api/admin/validation/logs
 * Fetch hallucination prevention logs with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const severity = searchParams.get('severity');
    const operation = searchParams.get('operation');
    const days = parseInt(searchParams.get('days') || '7');
    
    let query = supabase
      .from('hallucination_logs')
      .select('*', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
    
    if (severity) {
      query = query.eq('severity', severity);
    }
    
    if (operation) {
      query = query.eq('operation_type', operation);
    }
    
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    
    return NextResponse.json({ 
      logs: data || [], 
      total: count || 0,
      offset,
      limit
    });
  } catch (err: any) {
    console.error('Error fetching hallucination logs:', err);
    return NextResponse.json({ error: true, message: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/validation/logs
 * Create a new hallucination log entry (called by validation system)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    
    const { data, error } = await supabase
      .from('hallucination_logs')
      .insert([{
        session_id: body.session_id,
        conversation_id: body.conversation_id,
        operation_type: body.operation_type,
        function_name: body.function_name,
        hallucination_type: body.hallucination_type,
        severity: body.severity,
        original_request: body.original_request,
        validation_error: body.validation_error,
        validator_reasoning: body.validator_reasoning,
        corrected_request: body.corrected_request,
        action_taken: body.action_taken,
        primary_agent_model: body.primary_agent_model,
        validator_model: body.validator_model,
        validation_cost_usd: body.validation_cost_usd,
        tokens_used: body.tokens_used,
        prevented_error: body.prevented_error !== false,
        user_impact: body.user_impact
      }])
      .select()
      .single();

    if (error) throw error;
    
    console.log('[Hallucination Log] Created:', data.id);
    
    return NextResponse.json({ log: data });
  } catch (err: any) {
    console.error('Error creating hallucination log:', err);
    return NextResponse.json({ error: true, message: err.message }, { status: 500 });
  }
}

































