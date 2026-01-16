import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * GET /api/admin/validation/stats
 * Fetch hallucination prevention statistics
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    // Get overall stats
    const { data: overallStats, error: statsError } = await supabase
      .from('hallucination_stats')
      .select('*')
      .single();
    
    if (statsError && statsError.code !== 'PGRST116') {
      console.error('Error fetching overall stats:', statsError);
    }
    
    // Get top hallucination types
    const { data: topTypes, error: typesError } = await supabase
      .from('top_hallucination_types')
      .select('*')
      .limit(10);
    
    if (typesError) {
      console.error('Error fetching top types:', typesError);
    }
    
    // Get ROI data
    const { data: roiData, error: roiError } = await supabase
      .from('validation_roi')
      .select('*')
      .single();
    
    if (roiError && roiError.code !== 'PGRST116') {
      console.error('Error fetching ROI:', roiError);
    }
    
    // Get daily trend (last N days)
    const { data: dailyMetrics, error: metricsError } = await supabase
      .from('validation_metrics_daily')
      .select('*')
      .gte('metric_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('metric_date', { ascending: true });
    
    if (metricsError) {
      console.error('Error fetching daily metrics:', metricsError);
    }
    
    return NextResponse.json({
      overall: overallStats || {
        total_caught: 0,
        critical_count: 0,
        high_count: 0,
        blocked_count: 0,
        corrected_count: 0,
        sessions_affected: 0,
        total_cost_usd: 0,
        avg_tokens_per_validation: 0
      },
      topTypes: topTypes || [],
      roi: roiData || {
        issues_prevented: 0,
        critical_issues: 0,
        validation_cost: 0,
        estimated_support_cost_saved: 0,
        roi_multiplier: 0
      },
      dailyTrend: dailyMetrics || []
    });
  } catch (err: any) {
    console.error('Error fetching validation stats:', err);
    return NextResponse.json({ error: true, message: err.message }, { status: 500 });
  }
}

































