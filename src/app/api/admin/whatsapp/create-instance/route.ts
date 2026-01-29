/**
 * Admin API: Create WhatsApp Instance
 * 
 * Creates a new WhatsApp instance via Evolution API and stores in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';
import { getEvolutionClient } from '@/app/lib/evolution/EvolutionClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const evolutionClient = getEvolutionClient();

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Generate unique instance name
    const instanceName = `${org.slug || org.id.substring(0, 8)}-whatsapp`;

    // Check if instance already exists
    const { data: existing } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Organization already has an active WhatsApp instance' },
        { status: 409 }
      );
    }

    // Get webhook URL
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/whatsapp`;

    console.log(`📱 Creating WhatsApp instance: ${instanceName}`);
    console.log(`📍 Webhook URL: ${webhookUrl}`);

    // Step 1: Create instance in Evolution API (without webhook - add it separately)
    const instanceResponse = await evolutionClient.createInstance({
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });

    console.log('✅ Evolution API instance created:', instanceResponse);

    // Step 2: Configure webhook using /webhook/instance endpoint (Evolution API v2)
    try {
      const webhookResult = await evolutionClient.setWebhook(instanceName, {
        url: webhookUrl,
        webhookByEvents: false,
        events: [
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'SEND_MESSAGE',
        ],
      });
      console.log('✅ Webhook configured:', webhookResult);
    } catch (webhookError: any) {
      console.warn('⚠️ Failed to configure webhook:', webhookError.message);
      console.warn('📝 You may need to configure webhook manually in Evolution API panel');
      console.warn('📍 Webhook URL:', webhookUrl);
    }

    // Extract QR code from response
    const qrCode = instanceResponse.qrcode?.base64 || instanceResponse.qrcode?.code;

    // Store in database
    const { data: dbInstance, error: dbError } = await supabase
      .from('whatsapp_instances')
      .insert({
        organization_id: organizationId,
        instance_name: instanceName,
        instance_id: instanceResponse.instance?.instanceId,
        status: qrCode ? 'qr_code' : 'disconnected',
        qr_code: qrCode,
        qr_code_expires_at: qrCode 
          ? new Date(Date.now() + 60000).toISOString() // 1 minute
          : null,
        webhook_url: webhookUrl,
        is_active: true,
        agent_config: {},
        greeting_message: `Hello! I'm the AI assistant for ${org.name}. How can I help you today?`,
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Failed to store instance in database:', dbError);
      
      // Try to clean up Evolution API instance
      try {
        await evolutionClient.deleteInstance(instanceName);
      } catch (cleanupError) {
        console.error('⚠️ Failed to cleanup Evolution API instance:', cleanupError);
      }

      return NextResponse.json(
        { error: 'Failed to store instance in database' },
        { status: 500 }
      );
    }

    console.log('✅ Instance stored in database:', dbInstance.id);

    return NextResponse.json({
      success: true,
      instance: dbInstance,
      qrCode,
      message: 'WhatsApp instance created successfully. Scan the QR code to connect.',
    });
  } catch (error: any) {
    console.error('❌ Create instance error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create WhatsApp instance',
        details: error.response?.data || error.toString(),
      },
      { status: 500 }
    );
  }
}
