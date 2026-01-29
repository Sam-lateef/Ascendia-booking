/**
 * Admin API: WhatsApp Instances Management
 * 
 * Get list of all WhatsApp instances with stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Fetch instances from table directly (not view) to avoid migration issues
    const { data: instances, error } = await supabase
      .from('whatsapp_instances')
      .select(`
        *,
        organizations!inner(name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch WhatsApp instances:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Format the response to match expected structure
    const formattedInstances = instances?.map((instance: any) => ({
      ...instance,
      organization_name: instance.organizations?.name,
      active_conversations: 0, // We'll calculate this later if needed
      messages_last_24h: 0,
    })) || [];

    return NextResponse.json({ instances: formattedInstances });
  } catch (error: any) {
    console.error('❌ Admin WhatsApp instances API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
