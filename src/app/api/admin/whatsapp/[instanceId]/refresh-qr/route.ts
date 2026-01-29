/**
 * Admin API: Refresh QR Code for WhatsApp Instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';
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

    console.log(`🔄 Refreshing QR code for: ${instance.instance_name}`);

    // Use /instance/connect endpoint to get fresh QR code
    // This endpoint initiates connection and returns QR code or pairing code
    const qrResponse = await evolutionClient.fetchQRCode(instance.instance_name);

    console.log('📱 QR Response:', qrResponse);

    // Evolution API v2 returns: { pairingCode, code, count, base64 }
    // Cast to any to access top-level fields that may vary between API versions
    const qrData = qrResponse as any;
    const qrCode = qrData.base64 || qrResponse.qrcode?.base64 || qrData.code;

    if (!qrCode) {
      // If already connected, return helpful message
      if (qrData.pairingCode || qrResponse.qrcode?.pairingCode) {
        return NextResponse.json({
          success: false,
          error: 'Instance may already be connected. Try disconnecting first.',
          pairingCode: qrData.pairingCode || qrResponse.qrcode?.pairingCode,
        }, { status: 400 });
      }
      
      return NextResponse.json(
        { error: 'No QR code available. Instance may already be connected.' },
        { status: 400 }
      );
    }

    // Update database
    const { error: updateError } = await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: qrCode,
        qr_code_expires_at: new Date(Date.now() + 60000).toISOString(),
        status: 'qr_code',
        updated_at: new Date().toISOString(),
      })
      .eq('id', instanceId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update QR code' },
        { status: 500 }
      );
    }

    console.log('✅ QR code refreshed');

    return NextResponse.json({
      success: true,
      qrCode,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Refresh QR code error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
