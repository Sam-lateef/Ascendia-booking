/**
 * Admin API: Disconnect (Logout) WhatsApp Instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabase';
import { getEvolutionClient } from '@/app/lib/evolution/EvolutionClient';

export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const { instanceId } = params;
    const supabase = getSupabaseAdmin();
    const evolutionClient = getEvolutionClient();

    // Get instance from database
    const { data: instance, error } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (error || !instance) {
      return NextResponse.json(
        { error: 'Instance not found' },
        { status: 404 }
      );
    }

    console.log(`🔌 Disconnecting instance: ${instance.instance_name}`);

    // Logout instance in Evolution API
    await evolutionClient.logoutInstance(instance.instance_name);

    // Update status
    await supabase
      .from('whatsapp_instances')
      .update({
        status: 'disconnected',
        phone_number: null,
        connected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instanceId);

    console.log('✅ Instance disconnected');

    return NextResponse.json({
      success: true,
      message: 'Instance disconnected successfully. You can scan a new QR code to reconnect.',
    });
  } catch (error: any) {
    console.error('❌ Disconnect instance error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
