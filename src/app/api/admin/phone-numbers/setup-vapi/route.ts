/**
 * Automated Vapi Phone Number Setup
 * 
 * POST - Create Vapi assistant, purchase phone number, and link everything
 * 
 * Steps:
 * 1. Create Vapi assistant with booking functions
 * 2. Purchase Vapi phone number in specified area code
 * 3. Assign phone number to assistant
 * 4. Store mapping in vapi_assistants table
 * 5. Store phone number in phone_numbers table
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_API_URL = 'https://api.vapi.ai';
const BASE_SERVER_URL = process.env.BASE_URL || 'https://ascendia-booking.fly.dev';

// Master template assistant ID - this is the reference assistant with your perfect config
// Set this to your demo org's assistant ID to clone its configuration for all new orgs
const MASTER_TEMPLATE_ASSISTANT_ID = process.env.VAPI_MASTER_TEMPLATE_ASSISTANT_ID || null;

interface SetupRequest {
  // Basic
  assistantName: string;
  areaCode: string;
  country: string;
  
  // Model settings
  modelProvider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  
  // Voice settings
  voiceProvider?: string;
  voiceId?: string;
  voiceModel?: string;
  
  // Transcriber settings
  transcriberProvider?: string;
  transcriberModel?: string;
  language?: string;
  
  // Message settings
  firstMessage?: string;
  firstMessageMode?: string;
  systemPrompt?: string;
  
  // Advanced settings
  backgroundDenoising?: boolean;
  endCallMessage?: string;
  endCallPhrases?: string[];
}

export async function POST(req: NextRequest) {
  try {
    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY not configured');
    }

    const context = await getCurrentOrganization(req);
    const { getSupabaseAdmin } = await import('@/app/lib/supabaseClient');
    const supabase = getSupabaseAdmin();
    
    const body: SetupRequest = await req.json();
    const { assistantName, areaCode, country } = body;

    console.log('[Vapi Setup] Starting automated setup for org:', context.organizationId);
    console.log('[Vapi Setup] Request config:', JSON.stringify(body, null, 2));

    // Validate inputs
    if (!assistantName || !areaCode) {
      throw new Error('Missing required fields');
    }

    // Get organization details
    console.log('[Vapi Setup] Context organization ID:', context.organizationId);
    console.log('[Vapi Setup] Context user:', context.user.email);
    
    // Use admin client to bypass RLS
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, status')
      .eq('id', context.organizationId)
      .single();

    if (orgError) {
      console.error('[Vapi Setup] Organization query failed:', {
        error: orgError.message,
        code: orgError.code,
        details: orgError.details,
        hint: orgError.hint
      });
      throw new Error(`Failed to load organization: ${orgError.message}`);
    }

    if (!org) {
      console.error('[Vapi Setup] Organization not found for ID:', context.organizationId);
      throw new Error('Organization not found. Please contact support.');
    }
    
    console.log('[Vapi Setup] Organization loaded:', {
      id: org.id,
      name: org.name,
      status: org.status
    });

    // Fetch master template config from reference assistant
    let templateConfig = null;
    
    if (MASTER_TEMPLATE_ASSISTANT_ID) {
      console.log('[Vapi Setup] Fetching MASTER template config from assistant:', MASTER_TEMPLATE_ASSISTANT_ID);
      
      try {
        const assistantResponse = await fetch(`${VAPI_API_URL}/assistant/${MASTER_TEMPLATE_ASSISTANT_ID}`, {
          headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
        });
        
        if (assistantResponse.ok) {
          templateConfig = await assistantResponse.json();
          console.log('[Vapi Setup] ✅ Loaded MASTER template config');
          console.log('[Vapi Setup] Template has:', {
            transcriber: !!templateConfig.transcriber,
            model: !!templateConfig.model,
            voice: !!templateConfig.voice,
            firstMessage: !!templateConfig.firstMessage,
            serverUrl: !!templateConfig.serverUrl,
            additionalSettings: Object.keys(templateConfig).filter(k => 
              !['id', 'name', 'transcriber', 'model', 'voice', 'firstMessage', 'serverUrl'].includes(k)
            )
          });
        } else {
          console.warn('[Vapi Setup] Could not fetch master template (status:', assistantResponse.status, '), using defaults');
        }
      } catch (e) {
        console.warn('[Vapi Setup] Error fetching master template:', e);
        console.log('[Vapi Setup] Using default config');
      }
    } else {
      console.log('[Vapi Setup] No MASTER_TEMPLATE_ASSISTANT_ID set, using defaults');
      console.log('[Vapi Setup] Tip: Set VAPI_MASTER_TEMPLATE_ASSISTANT_ID env var to clone a reference assistant');
    }

    // Step 1: Create Vapi Assistant
    console.log('[Vapi Setup] Step 1: Creating Vapi assistant...');
    
    // Build assistant payload - use template as base, apply user overrides
    let assistantPayload: any;
    
    if (templateConfig) {
      console.log('[Vapi Setup] Using MASTER template config as base');
      
      // Clone template and remove ALL read-only/internal fields
      // Per OpenAPI spec: these are response-only fields not accepted in CreateAssistantDTO
      const cleanedTemplate = { ...templateConfig };
      const fieldsToRemove = [
        'id', 'orgId', 'createdAt', 'updatedAt',
        'phoneNumberId', 'squad', 'squadId',
        'isServerUrlSecretSet',
        'status', 'org', 'orgName',
        // Any other internal fields Vapi might return
      ];
      for (const field of fieldsToRemove) {
        delete cleanedTemplate[field];
      }
      
      // Build model configuration - use user settings or template defaults
      const modelConfig: any = {
        ...(cleanedTemplate.model || {}),
        provider: body.modelProvider || cleanedTemplate.model?.provider || 'openai',
        model: body.model || cleanedTemplate.model?.model || 'gpt-4o',
        temperature: body.temperature !== undefined ? body.temperature : (cleanedTemplate.model?.temperature ?? 0.5),
        maxTokens: body.maxTokens || cleanedTemplate.model?.maxTokens || 250,
        messages: [],
        functions: getVapiFunctions() // Always use our latest functions
      };
      
      // Handle system prompt
      const systemPromptContent = body.systemPrompt || 
        cleanedTemplate.model?.messages?.find((m: any) => m.role === 'system')?.content ||
        `You are ${assistantName}, a friendly and professional receptionist at ${org.name}. Your role is to help patients book appointments, check availability, and manage their scheduling needs. Be warm, efficient, and helpful.`;
      
      modelConfig.messages = [
        {
          role: 'system',
          content: systemPromptContent
        }
      ];
      
      // Build voice configuration - use user settings or template defaults
      const voiceConfig: any = {
        provider: body.voiceProvider || cleanedTemplate.voice?.provider || 'vapi',
      };
      
      if (body.voiceId) {
        voiceConfig.voiceId = body.voiceId;
      } else if (cleanedTemplate.voice?.voiceId) {
        voiceConfig.voiceId = cleanedTemplate.voice.voiceId;
      }
      
      if (body.voiceProvider === '11labs' || (voiceConfig.provider === '11labs' && body.voiceModel)) {
        voiceConfig.model = body.voiceModel || cleanedTemplate.voice?.model || 'eleven_turbo_v2_5';
      } else if (cleanedTemplate.voice?.model) {
        voiceConfig.model = cleanedTemplate.voice.model;
      }
      
      // Copy other voice settings from template
      if (cleanedTemplate.voice) {
        const { provider, voiceId, model, ...otherVoiceSettings } = cleanedTemplate.voice;
        Object.assign(voiceConfig, otherVoiceSettings);
      }
      
      // Build transcriber configuration - use user settings or template defaults
      const transcriberConfig: any = {
        ...(cleanedTemplate.transcriber || {}),
        provider: body.transcriberProvider || cleanedTemplate.transcriber?.provider || 'deepgram',
        model: body.transcriberModel || cleanedTemplate.transcriber?.model || 'nova-3',
        language: body.language || cleanedTemplate.transcriber?.language || 'en'
      };
      
      // Build first message - use user setting or template with org replacement
      let firstMessage = body.firstMessage;
      if (!firstMessage) {
        firstMessage = cleanedTemplate.firstMessage || `Hi! Welcome to ${org.name}. This is ${assistantName}. How can I help you today?`;
        firstMessage = firstMessage
          .replace(/This is \w+/i, `This is ${assistantName}`)
          .replace(/Welcome to [^.]+\./i, `Welcome to ${org.name}.`);
      }
      
      // Assemble final payload
      assistantPayload = {
        ...cleanedTemplate,
        name: assistantName,
        model: modelConfig,
        voice: voiceConfig,
        transcriber: transcriberConfig,
        firstMessage: firstMessage,
        firstMessageMode: body.firstMessageMode || cleanedTemplate.firstMessageMode || 'assistant-speaks-first',
        // Always use our server URL and new secret
        serverUrl: `${BASE_SERVER_URL}/api/vapi/functions`,
        serverUrlSecret: generateServerSecret(),
        // Request events for call logging (transcript, recording, status)
        serverMessages: ['status-update', 'end-of-call-report', 'tool-calls']
      };
      
      // Apply advanced settings if provided
      if (body.backgroundDenoising !== undefined) {
        assistantPayload.backgroundDenoisingEnabled = body.backgroundDenoising;
      } else if (cleanedTemplate.backgroundDenoisingEnabled !== undefined) {
        assistantPayload.backgroundDenoisingEnabled = cleanedTemplate.backgroundDenoisingEnabled;
      }
      
      if (body.endCallMessage) {
        assistantPayload.endCallMessage = body.endCallMessage;
      } else if (cleanedTemplate.endCallMessage) {
        assistantPayload.endCallMessage = cleanedTemplate.endCallMessage;
      }
      
      if (body.endCallPhrases && body.endCallPhrases.length > 0) {
        assistantPayload.endCallPhrases = body.endCallPhrases;
      } else if (cleanedTemplate.endCallPhrases) {
        assistantPayload.endCallPhrases = cleanedTemplate.endCallPhrases;
      }
      
      console.log('[Vapi Setup] ✅ Template-based payload with user overrides created');
      console.log('[Vapi Setup] Applied config:', {
        model: `${modelConfig.provider}/${modelConfig.model}`,
        voice: `${voiceConfig.provider}/${voiceConfig.voiceId || 'default'}`,
        transcriber: `${transcriberConfig.provider}/${transcriberConfig.model}`,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
        language: transcriberConfig.language
      });
    } else {
      console.log('[Vapi Setup] Using user config (no template available)');
      
      // Build configuration from user inputs
      assistantPayload = {
        name: assistantName,
        transcriber: {
          provider: body.transcriberProvider || 'deepgram',
          model: body.transcriberModel || 'nova-3',
          language: body.language || 'en'
        },
        model: {
          provider: body.modelProvider || 'openai',
          model: body.model || 'gpt-4o',
          maxTokens: body.maxTokens || 250,
          temperature: body.temperature ?? 0.5,
          messages: [
            {
              role: 'system',
              content: body.systemPrompt || `You are ${assistantName}, a friendly and professional receptionist at ${org.name}. Your role is to help patients book appointments, check availability, and manage their scheduling needs. Be warm, efficient, and helpful.`
            }
          ],
          functions: getVapiFunctions()
        },
        voice: {
          provider: body.voiceProvider || 'vapi',
          ...(body.voiceId && { voiceId: body.voiceId }),
          ...(body.voiceProvider === '11labs' && body.voiceModel && { model: body.voiceModel })
        },
        firstMessage: body.firstMessage || `Hi! Welcome to ${org.name}. This is ${assistantName}. How can I help you today?`,
        firstMessageMode: body.firstMessageMode || 'assistant-speaks-first',
        serverUrl: `${BASE_SERVER_URL}/api/vapi/functions`,
        serverUrlSecret: generateServerSecret(),
        serverMessages: ['status-update', 'end-of-call-report', 'tool-calls']
      };
      
      if (body.backgroundDenoising !== undefined) {
        assistantPayload.backgroundDenoisingEnabled = body.backgroundDenoising;
      }
      
      if (body.endCallMessage) {
        assistantPayload.endCallMessage = body.endCallMessage;
      }
      
      if (body.endCallPhrases && body.endCallPhrases.length > 0) {
        assistantPayload.endCallPhrases = body.endCallPhrases;
      }
    }

    // Final safety: remove any remaining read-only fields that Vapi API rejects
    const readOnlyFields = ['id', 'orgId', 'createdAt', 'updatedAt', 'isServerUrlSecretSet', 
                            'phoneNumberId', 'squadId', 'status'];
    for (const field of readOnlyFields) {
      delete assistantPayload[field];
    }

    console.log('[Vapi Setup] Final payload keys:', Object.keys(assistantPayload));
    console.log('[Vapi Setup] Voice config:', JSON.stringify(assistantPayload.voice));

    const assistantResponse = await fetch(`${VAPI_API_URL}/assistant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assistantPayload)
    });

    if (!assistantResponse.ok) {
      const errorText = await assistantResponse.text();
      let errorMsg: string;
      try {
        const errorObj = JSON.parse(errorText);
        errorMsg = errorObj.message || errorText;
      } catch {
        errorMsg = errorText;
      }
      throw new Error(`Failed to create assistant: ${errorMsg}`);
    }

    const assistant = await assistantResponse.json();
    const assistantId = assistant.id;
    console.log('[Vapi Setup] ✅ Assistant created:', assistantId);

    // Step 2: Purchase Phone Number from Vapi
    // Per Vapi API docs: POST /phone-number with CreateVapiPhoneNumberDTO
    // CRITICAL: numberDesiredAreaCode triggers actual PSTN number purchase (without it, only a SIP endpoint is created)
    console.log('[Vapi Setup] Step 2: Creating Vapi phone number...');
    
    const phoneNumberPayload: any = {
      provider: 'vapi',
      name: `${org.name} - ${assistantName}`,
      numberDesiredAreaCode: areaCode || '619',
      assistantId: assistantId,
      server: {
        url: `${BASE_SERVER_URL}/api/vapi/functions`,
        timeoutSeconds: 20
      }
    };

    console.log('[Vapi Setup] Phone number creation payload:', JSON.stringify(phoneNumberPayload, null, 2));

    const phoneNumberResponse = await fetch(`${VAPI_API_URL}/phone-number`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(phoneNumberPayload)
    });

    if (!phoneNumberResponse.ok) {
      const errorText = await phoneNumberResponse.text();
      let errorObj;
      try {
        errorObj = JSON.parse(errorText);
      } catch {
        errorObj = { message: errorText };
      }
      console.error('[Vapi Setup] Phone number creation failed:', errorObj);
      
      // Clean up: delete assistant if phone purchase failed
      await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
      });
      throw new Error(`Failed to purchase phone number: ${errorObj.message || phoneNumberResponse.statusText}`);
    }

    const phoneNumberResult = await phoneNumberResponse.json();
    console.log('[Vapi Setup] Phone number API response:', JSON.stringify(phoneNumberResult, null, 2));
    
    const vapiPhoneNumberId = phoneNumberResult.id;
    let vapiPhoneNumber = phoneNumberResult.number || '';
    const phoneNumberStatus = phoneNumberResult.status || 'unknown';
    
    // Phone number is provisioned asynchronously by Vapi
    // Poll the API to wait for the actual number to be assigned
    if (!vapiPhoneNumber && vapiPhoneNumberId) {
      console.log('[Vapi Setup] Phone number not yet assigned, polling Vapi...');
      
      const maxAttempts = 10;
      const pollIntervalMs = 3000; // 3 seconds between polls
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        
        console.log(`[Vapi Setup] Poll attempt ${attempt}/${maxAttempts}...`);
        
        const pollResponse = await fetch(`${VAPI_API_URL}/phone-number/${vapiPhoneNumberId}`, {
          headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
        });
        
        if (pollResponse.ok) {
          const pollResult = await pollResponse.json();
          if (pollResult.number) {
            vapiPhoneNumber = pollResult.number;
            console.log(`[Vapi Setup] ✅ Phone number assigned on attempt ${attempt}: ${vapiPhoneNumber}`);
            break;
          }
          console.log(`[Vapi Setup] Attempt ${attempt}: still no number (status: ${pollResult.status})`);
        }
      }
      
      if (!vapiPhoneNumber) {
        console.log('[Vapi Setup] Phone number not yet assigned after polling. Storing ID for later retrieval.');
      }
    }
    
    console.log('[Vapi Setup] ✅ Phone number result:', vapiPhoneNumber || '(pending)', 'status:', phoneNumberStatus);

    // Step 4: Store in vapi_assistants table
    console.log('[Vapi Setup] Step 4: Storing assistant mapping...');
    
    const { error: assistantDbError } = await supabase
      .from('vapi_assistants')
      .insert({
        organization_id: context.organizationId,
        assistant_id: assistantId,
        phone_number: vapiPhoneNumber,
        assistant_name: assistantName,
        voice_provider: body.voiceProvider || 'vapi',
        is_active: true,
        metadata: {
          vapi_phone_number_id: vapiPhoneNumberId,
          vapi_status: phoneNumberStatus,
          area_code: areaCode,
          country: country,
          model: body.model || assistantPayload.model?.model,
          voice_id: body.voiceId || assistantPayload.voice?.voiceId
        }
      });

    if (assistantDbError) {
      console.error('[Vapi Setup] Failed to save assistant to DB:', assistantDbError);
      // Continue anyway - assistant and phone are created
    }

    // Step 5: Store in phone_numbers table
    console.log('[Vapi Setup] Step 5: Storing phone number...');
    
    const { error: phoneDbError } = await supabase
      .from('phone_numbers')
      .insert({
        organization_id: context.organizationId,
        phone_number: vapiPhoneNumber,
        channel: 'vapi',
        is_active: true,
        metadata: {
          assistant_id: assistantId,
          assistant_name: assistantName,
          voice_provider: body.voiceProvider || 'vapi',
          vapi_phone_number_id: vapiPhoneNumberId,
          vapi_status: phoneNumberStatus,
          area_code: areaCode,
          country: country,
          model: body.model || assistantPayload.model?.model,
          voice_id: body.voiceId || assistantPayload.voice?.voiceId
        }
      });

    if (phoneDbError) {
      console.error('[Vapi Setup] Failed to save phone to DB:', phoneDbError);
      // Continue anyway
    }

    console.log('[Vapi Setup] ✅ Setup complete!');

    return NextResponse.json({
      success: true,
      assistantId,
      phoneNumber: vapiPhoneNumber,
      vapiPhoneNumberId,
      status: phoneNumberStatus,
      note: phoneNumberStatus !== 'active' 
        ? 'Phone number is being activated. It may take 2-4 minutes before calls work.' 
        : undefined
    });

  } catch (error: any) {
    console.error('[Vapi Setup] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Setup failed' },
      { status: 500 }
    );
  }
}

// Helper: Get Vapi function definitions
function getVapiFunctions() {
  return [
    {
      name: 'GetAvailableSlots',
      description: 'Get available appointment slots. Returns slots with ProvNum, OpNum, DateTimeStart, ProviderName.',
      parameters: {
        type: 'object',
        properties: {
          dateStart: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format (e.g., 2026-02-10). REQUIRED.'
          },
          dateEnd: {
            type: 'string',
            description: 'End date in YYYY-MM-DD format (e.g., 2026-02-10). REQUIRED.'
          },
          ProvNum: {
            type: 'number',
            description: 'Provider/Doctor ID to filter by. Optional.'
          },
          OpNum: {
            type: 'number',
            description: 'Operatory/Room ID. Optional.'
          }
        },
        required: ['dateStart', 'dateEnd']
      }
    },
    {
      name: 'GetMultiplePatients',
      description: 'Search for patients by phone number. Returns array of patients with PatNum, FName, LName.',
      parameters: {
        type: 'object',
        properties: {
          Phone: {
            type: 'string',
            description: "Patient's 10-digit phone number (e.g., 6195551234). REQUIRED."
          }
        },
        required: ['Phone']
      }
    },
    {
      name: 'CreatePatient',
      description: 'Create new patient profile. Returns patient with PatNum.',
      parameters: {
        type: 'object',
        properties: {
          FName: { type: 'string', description: "Patient's first name. REQUIRED." },
          LName: { type: 'string', description: "Patient's last name. REQUIRED." },
          WirelessPhone: { type: 'string', description: "Patient's 10-digit phone number. REQUIRED." },
          Birthdate: { type: 'string', description: 'Date of birth in YYYY-MM-DD format. REQUIRED.' },
          Email: { type: 'string', description: "Patient's email address. Optional." }
        },
        required: ['FName', 'LName', 'WirelessPhone', 'Birthdate']
      }
    },
    {
      name: 'CreateAppointment',
      description: 'Book a new appointment. Returns appointment with AptNum.',
      parameters: {
        type: 'object',
        properties: {
          PatNum: { type: 'number', description: 'Patient ID from GetMultiplePatients or CreatePatient. REQUIRED.' },
          AptDateTime: { type: 'string', description: 'Appointment date and time from GetAvailableSlots. REQUIRED.' },
          ProvNum: { type: 'number', description: 'Provider ID from GetAvailableSlots. REQUIRED.' },
          Op: { type: 'number', description: 'Operatory ID from GetAvailableSlots. REQUIRED.' },
          Note: { type: 'string', description: 'Appointment notes. Optional.' }
        },
        required: ['PatNum', 'AptDateTime', 'ProvNum', 'Op']
      }
    },
    {
      name: 'BreakAppointment',
      description: 'Cancel an existing appointment.',
      parameters: {
        type: 'object',
        properties: {
          AptNum: { type: 'number', description: 'Appointment ID to cancel. REQUIRED.' }
        },
        required: ['AptNum']
      }
    }
  ];
}

// Helper: Get voice ID for provider (using Vapi's built-in voices)
function getVoiceIdForProvider(provider: string): string {
  const voiceMap: Record<string, string> = {
    '11labs': 'sarah', // ElevenLabs Sarah voice
    'azure': 'en-US-JennyNeural',
    'playht': 'jennifer'
  };
  return voiceMap[provider] || 'sarah';
}

// Helper: Generate server secret
function generateServerSecret(): string {
  return `vapi_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}
