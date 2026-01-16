/**
 * Admin API: Restart WhatsApp Instance
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

    console.log(`🔄 Restarting instance: ${instance.instance_name}`);

    try {
      // Try to restart instance in Evolution API
      // Note: This endpoint may not be available in all Evolution API versions
      await evolutionClient.restartInstance(instance.instance_name);
      
      console.log('✅ Instance restart initiated');
    } catch (restartError: any) {
      // If restart endpoint is not available, try reconnecting instead
      console.warn('⚠️ Restart endpoint not available, trying connect instead:', restartError.message);
      
      try {
        await evolutionClient.connectInstance(instance.instance_name);
        console.log('✅ Instance reconnect initiated');
      } catch (connectError: any) {
        console.error('❌ Both restart and connect failed:', connectError.message);
        return NextResponse.json(
          { error: 'Failed to restart instance. Try disconnecting and reconnecting instead.' },
          { status: 500 }
        );
      }
    }

    // Update status
    await supabase
      .from('whatsapp_instances')
      .update({
        status: 'connecting',
        updated_at: new Date().toISOString(),
      })
      .eq('id', instanceId);

    return NextResponse.json({
      success: true,
      message: 'Instance restart initiated. Please wait a moment and refresh the page.',
    });
  } catch (error: any) {
    console.error('❌ Restart instance error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
