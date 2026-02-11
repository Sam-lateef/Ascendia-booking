/**
 * Get Recent Demo Bookings
 * Public endpoint to show live bookings on landing page
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export const dynamic = 'force-dynamic';

interface Booking {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  appointment_date: string;
  appointment_time: string;
  provider_name: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch recent appointments directly from appointments table (last 5 only)
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_datetime,
        patient_id,
        provider_id,
        operatory_id,
        created_at
      `)
      .eq('organization_id', organizationId)
      .not('patient_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[Demo Recent Bookings] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bookings', details: error.message },
        { status: 500 }
      );
    }

    // Get unique patient_ids and provider_ids to fetch details
    const patientIds = [...new Set((appointments || []).map(a => a.patient_id).filter(Boolean))];
    const providerIds = [...new Set((appointments || []).map(a => a.provider_id).filter(Boolean))];

    // Fetch patients
    const { data: patients } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone')
      .in('id', patientIds)
      .eq('organization_id', organizationId);

    // Fetch providers
    const { data: providers } = await supabase
      .from('providers')
      .select('id, first_name, last_name')
      .in('id', providerIds)
      .eq('organization_id', organizationId);

    // Create lookup maps
    const patientsMap = new Map((patients || []).map(p => [p.id, p]));
    const providersMap = new Map((providers || []).map(p => [p.id, p]));

    // Format bookings for display (already limited to 5 in query)
    const bookings: Booking[] = (appointments || []).map(apt => {
      const patient = patientsMap.get(apt.patient_id);
      const provider = providersMap.get(apt.provider_id);
      
      // Parse datetime
      const aptDate = new Date(apt.appointment_datetime);
      const dateStr = aptDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      const timeStr = aptDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });

      return {
        id: String(apt.id),
        first_name: patient?.first_name || 'Unknown',
        last_name: patient?.last_name || '',
        phone: patient?.phone || '',
        appointment_date: dateStr,
        appointment_time: timeStr,
        provider_name: provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'Dr. Smith',
        created_at: apt.created_at
      };
    });

    console.log(`[Demo Recent Bookings] Found ${bookings.length} appointments`);
    return NextResponse.json({ bookings });

  } catch (error: any) {
    console.error('[Demo Recent Bookings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings', details: error.message },
      { status: 500 }
    );
  }
}
