/**
 * Admin Phone Number Detail API
 * 
 * GET    - Fetch assistant config from Vapi for editing
 * PATCH  - Update assistant config on Vapi
 * DELETE - Delete phone number and assistant from Vapi + DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_API_URL = 'https://api.vapi.ai';

/**
 * GET - Fetch assistant configuration from Vapi for editing
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentOrganization(req);
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    // Find the record to get the assistant ID
    const { data: phoneRecord } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organizationId)
      .single();

    const { data: vapiRecord } = await supabase
      .from('vapi_assistants')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organizationId)
      .single();

    const record = phoneRecord || vapiRecord;
    const assistantId = record?.metadata?.assistant_id || record?.assistant_id;

    if (!assistantId) {
      return NextResponse.json({ error: 'Assistant ID not found' }, { status: 404 });
    }

    if (!VAPI_API_KEY) {
      return NextResponse.json({ error: 'Vapi API key not configured' }, { status: 500 });
    }

    // Fetch live assistant config from Vapi
    const response = await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch assistant: ${errorText}` },
        { status: response.status }
      );
    }

    const assistant = await response.json();

    return NextResponse.json({
      assistantId,
      phoneNumber: record?.phone_number,
      assistantName: assistant.name || '',
      firstMessage: assistant.firstMessage || '',
      systemPrompt: assistant.model?.messages?.[0]?.content || '',
      voicemailMessage: assistant.voicemailMessage || '',
      endCallMessage: assistant.endCallMessage || '',
      endCallPhrases: assistant.endCallPhrases || [],
      model: {
        provider: assistant.model?.provider || '',
        model: assistant.model?.model || '',
        temperature: assistant.model?.temperature ?? 0.5,
        maxTokens: assistant.model?.maxTokens ?? 250,
      },
      voice: {
        provider: assistant.voice?.provider || '',
        voiceId: assistant.voice?.voiceId || '',
        model: assistant.voice?.model || '',
      },
      transcriber: {
        provider: assistant.transcriber?.provider || '',
        model: assistant.transcriber?.model || '',
        language: assistant.transcriber?.language || 'en',
      },
      firstMessageMode: assistant.firstMessageMode || 'assistant-speaks-first',
      backgroundDenoisingEnabled: assistant.backgroundDenoisingEnabled ?? true,
      serverUrl: assistant.serverUrl || '',
    });
  } catch (error: any) {
    console.error('[Phone Number GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch assistant config' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update assistant configuration on Vapi
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentOrganization(req);
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await req.json();

    console.log('[Phone Number PATCH] Updating:', id);

    // Find the record to get the assistant ID
    const { data: phoneRecord } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organizationId)
      .single();

    const { data: vapiRecord } = await supabase
      .from('vapi_assistants')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organizationId)
      .single();

    const record = phoneRecord || vapiRecord;
    const assistantId = record?.metadata?.assistant_id || record?.assistant_id;

    if (!assistantId) {
      return NextResponse.json({ error: 'Assistant ID not found' }, { status: 404 });
    }

    if (!VAPI_API_KEY) {
      return NextResponse.json({ error: 'Vapi API key not configured' }, { status: 500 });
    }

    // Build the update payload for Vapi PATCH /assistant/:id
    const updatePayload: Record<string, any> = {};

    if (body.assistantName !== undefined) {
      updatePayload.name = body.assistantName;
    }

    if (body.firstMessage !== undefined) {
      updatePayload.firstMessage = body.firstMessage;
    }

    if (body.voicemailMessage !== undefined) {
      updatePayload.voicemailMessage = body.voicemailMessage;
    }

    if (body.endCallMessage !== undefined) {
      updatePayload.endCallMessage = body.endCallMessage;
    }

    if (body.endCallPhrases !== undefined) {
      updatePayload.endCallPhrases = body.endCallPhrases;
    }

    if (body.firstMessageMode !== undefined) {
      updatePayload.firstMessageMode = body.firstMessageMode;
    }

    if (body.backgroundDenoisingEnabled !== undefined) {
      updatePayload.backgroundDenoisingEnabled = body.backgroundDenoisingEnabled;
    }

    // Model update - fetch current to preserve tools, then apply changes
    const needsModelUpdate = body.systemPrompt !== undefined || body.temperature !== undefined || 
                             body.maxTokens !== undefined || body.modelProvider !== undefined || 
                             body.model !== undefined;
    
    if (needsModelUpdate) {
      const currentResponse = await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
        headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
      });
      
      if (currentResponse.ok) {
        const current = await currentResponse.json();
        updatePayload.model = { ...current.model };
        
        if (body.systemPrompt !== undefined) {
          updatePayload.model.messages = [{ role: 'system', content: body.systemPrompt }];
        }
        if (body.temperature !== undefined) {
          updatePayload.model.temperature = parseFloat(body.temperature);
        }
        if (body.maxTokens !== undefined) {
          updatePayload.model.maxTokens = parseInt(body.maxTokens);
        }
        if (body.modelProvider !== undefined) {
          updatePayload.model.provider = body.modelProvider;
        }
        if (body.model !== undefined) {
          updatePayload.model.model = body.model;
        }
        
        // Remove read-only fields
        delete updatePayload.model.id;
      }
    }

    // Voice update
    if (body.voiceProvider !== undefined || body.voiceId !== undefined) {
      const voiceConfig: Record<string, any> = {
        provider: body.voiceProvider,
        voiceId: body.voiceId,
      };
      // Add ElevenLabs model if applicable
      if (body.voiceProvider === '11labs' && body.voiceModel) {
        voiceConfig.model = body.voiceModel;
      }
      updatePayload.voice = voiceConfig;
    }

    // Transcriber update
    if (body.transcriberProvider !== undefined || body.transcriberModel !== undefined || body.language !== undefined) {
      updatePayload.transcriber = {
        provider: body.transcriberProvider,
        model: body.transcriberModel,
        language: body.language,
      };
    }

    console.log('[Phone Number PATCH] Update payload keys:', Object.keys(updatePayload));

    // Send PATCH to Vapi
    const patchResponse = await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!patchResponse.ok) {
      const errorText = await patchResponse.text();
      let errorObj;
      try { errorObj = JSON.parse(errorText); } catch { errorObj = { message: errorText }; }
      console.error('[Phone Number PATCH] Vapi update failed:', errorObj);
      return NextResponse.json(
        { error: `Failed to update assistant: ${errorObj.message || patchResponse.statusText}` },
        { status: patchResponse.status }
      );
    }

    const updatedAssistant = await patchResponse.json();

    // Update local DB if name changed
    if (body.assistantName) {
      await supabase
        .from('vapi_assistants')
        .update({ assistant_name: body.assistantName })
        .eq('assistant_id', assistantId)
        .eq('organization_id', context.organizationId);

      // Update metadata in phone_numbers
      if (phoneRecord) {
        await supabase
          .from('phone_numbers')
          .update({ 
            metadata: { ...phoneRecord.metadata, assistant_name: body.assistantName }
          })
          .eq('id', id)
          .eq('organization_id', context.organizationId);
      }
    }

    console.log('[Phone Number PATCH] Updated successfully');

    return NextResponse.json({ 
      success: true,
      assistantId,
      name: updatedAssistant.name 
    });
  } catch (error: any) {
    console.error('[Phone Number PATCH] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update assistant' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete phone number and assistant from Vapi + DB
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentOrganization(req);
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    console.log('[Phone Number Delete] Deleting phone number:', id);

    const { data: phoneRecord } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organizationId)
      .single();

    const { data: vapiRecord } = await supabase
      .from('vapi_assistants')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organizationId)
      .single();

    const record = phoneRecord || vapiRecord;
    const vapiPhoneNumberId = record?.metadata?.vapi_phone_number_id;
    const assistantId = record?.metadata?.assistant_id || record?.assistant_id;

    if (VAPI_API_KEY) {
      if (vapiPhoneNumberId) {
        console.log('[Phone Number Delete] Deleting Vapi phone number:', vapiPhoneNumberId);
        try {
          await fetch(`${VAPI_API_URL}/phone-number/${vapiPhoneNumberId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
          });
        } catch (e) {
          console.warn('[Phone Number Delete] Failed to delete Vapi phone number:', e);
        }
      }

      if (assistantId) {
        console.log('[Phone Number Delete] Deleting Vapi assistant:', assistantId);
        try {
          await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
          });
        } catch (e) {
          console.warn('[Phone Number Delete] Failed to delete Vapi assistant:', e);
        }
      }
    }

    await supabase
      .from('phone_numbers')
      .delete()
      .eq('id', id)
      .eq('organization_id', context.organizationId);

    await supabase
      .from('vapi_assistants')
      .delete()
      .eq('id', id)
      .eq('organization_id', context.organizationId);

    if (assistantId) {
      await supabase
        .from('vapi_assistants')
        .delete()
        .eq('assistant_id', assistantId)
        .eq('organization_id', context.organizationId);
    }

    console.log('[Phone Number Delete] Done');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Phone Number Delete] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete phone number' },
      { status: 500 }
    );
  }
}
