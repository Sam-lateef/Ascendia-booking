/**
 * WhatsApp Setup API
 * 
 * Handles QR code generation and status checks for Evolution API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEvolutionClient } from '@/whatsapp/evolution-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    const client = getEvolutionClient();

    if (action === 'check_status') {
      // Check instance connection status
      const status = await client.getInstanceStatus();
      return NextResponse.json(status);
    }

    // Default: return instance info
    const info = await client.getInstanceInfo();
    return NextResponse.json(info);
  } catch (error: any) {
    console.error('[WhatsApp Setup] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get WhatsApp status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const client = getEvolutionClient();

    if (action === 'get_qr_code') {
      // Generate QR code for authentication
      console.log('[WhatsApp Setup] Requesting QR code...');
      const qrData = await client.getQRCode();
      console.log('[WhatsApp Setup] QR code response:', JSON.stringify(qrData, null, 2));
      return NextResponse.json(qrData);
    }

    if (action === 'create_instance') {
      // Create new instance
      const instanceName = body.instanceName;
      const result = await client.createInstance(instanceName);
      
      // Automatically set webhook after creating instance
      try {
        const webhookUrl = process.env.EVOLUTION_WEBHOOK_URL;
        if (webhookUrl) {
          await client.setWebhook(webhookUrl);
          console.log('[WhatsApp Setup] Webhook configured:', webhookUrl);
        }
      } catch (webhookError) {
        console.warn('[WhatsApp Setup] Failed to set webhook, can be configured later:', webhookError);
      }
      
      return NextResponse.json(result);
    }

    if (action === 'disconnect') {
      // Disconnect instance
      await client.disconnectInstance();
      return NextResponse.json({ success: true });
    }

    if (action === 'set_webhook') {
      // Configure webhook URL
      const webhookUrl = body.webhookUrl || process.env.EVOLUTION_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
      }
      const result = await client.setWebhook(webhookUrl);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[WhatsApp Setup] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute action' },
      { status: 500 }
    );
  }
}


