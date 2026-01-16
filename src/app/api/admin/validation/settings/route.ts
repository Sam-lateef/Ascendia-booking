import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * GET /api/admin/validation/settings
 * Fetch current validation settings
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('validation_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) throw error;
    
    return NextResponse.json({ settings: data });
  } catch (err: any) {
    console.error('Error fetching validation settings:', err);
    return NextResponse.json({ error: true, message: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/validation/settings
 * Update validation settings
 */
export async function PUT(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    
    const { data, error } = await supabase
      .from('validation_settings')
      .update({
        validation_enabled: body.validation_enabled,
        validate_bookings: body.validate_bookings,
        validate_reschedules: body.validate_reschedules,
        validate_cancellations: body.validate_cancellations,
        validate_patient_creation: body.validate_patient_creation,
        confidence_threshold: body.confidence_threshold,
        max_retries: body.max_retries,
        notes: body.notes
      })
      .eq('is_active', true)
      .select()
      .single();

    if (error) throw error;
    
    // Clear any caches
    console.log('[Validation Settings] Updated:', data);
    
    return NextResponse.json({ settings: data });
  } catch (err: any) {
    console.error('Error updating validation settings:', err);
    return NextResponse.json({ error: true, message: err.message }, { status: 500 });
  }
}

































