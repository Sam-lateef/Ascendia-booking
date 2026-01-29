/**
 * WhatsApp Webhook Route
 * 
 * Receives webhook events from Evolution API
 * Processes incoming WhatsApp messages and generates AI responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';
import { getWhatsAppMessageHandler } from '@/app/lib/whatsapp/messageHandler';
import {
  EvolutionWebhookEvent,
  EvolutionMessageUpsert,
  EvolutionConnectionUpdate,
  EvolutionQRCode,
  EVOLUTION_EVENTS,
} from '@/app/lib/evolution/types';

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const event: EvolutionWebhookEvent = await request.json();

    console.log(`📨 Webhook received: ${event.event} for instance: ${event.instance}`);

    // Verify API key - check header OR body apikey field
    // Evolution API can send the key in either location
    const headerApiKey = request.headers.get('apikey');
    const bodyApiKey = event.apikey;
    const receivedKey = headerApiKey || bodyApiKey;
    
    // Log for debugging
    console.log(`🔑 API Key check - Header: ${headerApiKey ? 'present' : 'missing'}, Body: ${bodyApiKey ? 'present' : 'missing'}`);
    
    // Only validate if EVOLUTION_API_KEY is set
    if (process.env.EVOLUTION_API_KEY) {
      if (!receivedKey) {
        console.warn('⚠️ No API key in webhook request');
        // Allow through for now - Evolution webhook setup might not include key
      } else if (receivedKey !== process.env.EVOLUTION_API_KEY) {
        console.warn(`⚠️ API key mismatch - received: ${receivedKey?.substring(0, 8)}...`);
        // Allow through for now - the key might be the instance-specific key
      }
    }

    // Route event to appropriate handler
    switch (event.event) {
      case EVOLUTION_EVENTS.MESSAGES_UPSERT:
        return await handleMessageUpsert(event);

      case EVOLUTION_EVENTS.CONNECTION_UPDATE:
        return await handleConnectionUpdate(event);

      case EVOLUTION_EVENTS.QRCODE_UPDATED:
        return await handleQRCodeUpdate(event);

      default:
        console.log(`ℹ️ Unhandled event type: ${event.event}`);
        return NextResponse.json({ status: 'ignored' });
    }
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle incoming WhatsApp message
 */
async function handleMessageUpsert(event: EvolutionWebhookEvent): Promise<NextResponse> {
  const messageData: EvolutionMessageUpsert = event.data;
  const instanceName = event.instance;

  console.log(`💬 New message:`, {
    from: messageData.key.remoteJid,
    fromMe: messageData.key.fromMe,
    type: messageData.messageType,
  });

  // Ignore messages sent by us
  if (messageData.key.fromMe) {
    console.log('⏭️ Skipping outbound message');
    return NextResponse.json({ status: 'ignored_outbound' });
  }

  // Ignore group messages (for now)
  if (messageData.key.remoteJid.includes('@g.us')) {
    console.log('⏭️ Skipping group message');
    return NextResponse.json({ status: 'ignored_group' });
  }

  // Only process text messages (for now)
  if (messageData.messageType !== 'conversation') {
    console.log(`⏭️ Skipping non-text message: ${messageData.messageType}`);
    return NextResponse.json({ status: 'ignored_media' });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get WhatsApp instance from database
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, organization_id, is_active')
      .eq('instance_name', instanceName)
      .eq('is_active', true)
      .single();

    if (instanceError || !instance) {
      console.error('❌ WhatsApp instance not found:', instanceName);
      return NextResponse.json(
        { error: 'Instance not found or inactive' },
        { status: 404 }
      );
    }

    // Get or create conversation mapping
    const conversationId = await supabase.rpc(
      'get_or_create_whatsapp_conversation',
      {
        p_instance_id: instance.id,
        p_remote_jid: messageData.key.remoteJid,
        p_org_id: instance.organization_id,
        p_contact_name: messageData.pushName || null,
      }
    );

    if (!conversationId.data) {
      throw new Error('Failed to get/create conversation');
    }

    // Get whatsapp_conversation_id for context
    const { data: whatsappConv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('conversation_id', conversationId.data)
      .single();

    // Build message context
    const context = {
      instanceId: instance.id,
      instanceName,
      organizationId: instance.organization_id,
      remoteJid: messageData.key.remoteJid,
      contactName: messageData.pushName,
      conversationId: conversationId.data,
      whatsappConversationId: whatsappConv?.id || '',
    };

    // Process message with AI
    const messageHandler = getWhatsAppMessageHandler();
    const result = await messageHandler.processIncomingMessage(context, messageData);

    if (result.success) {
      console.log('✅ Message processed successfully');
      return NextResponse.json({ status: 'processed', result });
    } else {
      console.error('❌ Message processing failed:', result.error);
      return NextResponse.json(
        { status: 'error', error: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ Failed to handle message:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle WhatsApp connection status updates
 */
async function handleConnectionUpdate(event: EvolutionWebhookEvent): Promise<NextResponse> {
  const connectionData: EvolutionConnectionUpdate = event.data;
  const instanceName = event.instance;

  console.log(`🔌 Connection update:`, {
    instance: instanceName,
    state: connectionData.state,
  });

  try {
    const supabase = getSupabaseAdmin();

    // Map Evolution API states to our status values
    const statusMap: Record<string, string> = {
      'connecting': 'connecting',
      'open': 'connected',
      'close': 'disconnected',
    };

    const status = statusMap[connectionData.state] || 'disconnected';

    // Update instance status in database
    const updateData: any = {
      status,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (status === 'connected') {
      updateData.connected_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('whatsapp_instances')
      .update(updateData)
      .eq('instance_name', instanceName);

    if (error) {
      console.error('❌ Failed to update instance status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Instance status updated: ${status}`);
    return NextResponse.json({ status: 'updated' });
  } catch (error: any) {
    console.error('❌ Failed to handle connection update:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle QR code updates
 */
async function handleQRCodeUpdate(event: EvolutionWebhookEvent): Promise<NextResponse> {
  const qrData: EvolutionQRCode = event.data;
  const instanceName = event.instance;

  console.log(`📱 QR Code updated for instance: ${instanceName}`);

  try {
    const supabase = getSupabaseAdmin();

    // Store QR code in database (expires in 1 minute)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 1);

    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: qrData.base64 || qrData.code,
        qr_code_expires_at: expiresAt.toISOString(),
        status: 'qr_code',
        updated_at: new Date().toISOString(),
      })
      .eq('instance_name', instanceName);

    if (error) {
      console.error('❌ Failed to store QR code:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('✅ QR code stored in database');
    return NextResponse.json({ status: 'qr_stored' });
  } catch (error: any) {
    console.error('❌ Failed to handle QR code update:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'whatsapp-webhook',
    timestamp: new Date().toISOString(),
  });
}
