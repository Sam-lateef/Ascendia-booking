/**
 * Delete Demo Booking
 * Allows users to remove their booking from the public display
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('id');
    const organizationId = searchParams.get('organizationId');

    if (!bookingId || !organizationId) {
      return NextResponse.json(
        { error: 'Booking ID and organization ID required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Delete the appointment from appointments table
    // Only delete if it belongs to the specified organization
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', parseInt(bookingId))
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[Demo Delete Booking] Error:', error);
      return NextResponse.json(
        { error: 'Failed to delete booking', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[Demo Delete Booking] Deleted appointment ${bookingId}`);
    return NextResponse.json({ 
      success: true,
      message: 'Booking deleted successfully'
    });

  } catch (error: any) {
    console.error('[Demo Delete Booking] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete booking', details: error.message },
      { status: 500 }
    );
  }
}
