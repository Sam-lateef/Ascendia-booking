import WebSocket from 'ws';
// Audio conversion removed - OpenAI supports g711_ulaw natively!
import { generateLexiInstructions, lexiTools, executeLexiTool } from '@/app/agentConfigs/embeddedBooking/lexiAgentTwilio';
// Conversation state for transcript logging
import { 
  processMessage, 
  addMessage, 
  recordFunctionCall,
  getOrCreateState 
} from '@/app/lib/conversationState';
// Organization-specific instructions
import { getOrganizationInstructions } from '@/app/lib/agentMode';
import { getCachedDefaultOrganizationId } from '@/app/lib/callHelpers';
// Channel configuration
import { getChannelConfig, isRealtimeBackend } from '@/app/lib/channelConfigLoader';

interface TwilioMessage {
  event: string;
  sequenceNumber?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  mark?: {
    name: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

/**
 * Handle a Twilio Media Stream WebSocket connection
 * This is called by express-ws when a connection is established
 * 
 * @param twilioWs - WebSocket connection to Twilio
 * @param orgId - Organization ID from URL parameters
 * @param initialCallSid - Call SID from URL parameters
 * @param fromNumber - Caller phone number
 * @param toNumber - Called phone number (Twilio number)
 */
async function handleTwilioConnection(
  twilioWs: WebSocket,
  orgId?: string | null,
  initialCallSid?: string | null,
  fromNumber?: string | null,
  toNumber?: string | null
) {
  console.log('[Twilio WS] 🟢 Client connected');

  let streamSid: string | null = null;
  let callSid: string | null = initialCallSid || null;
  let openaiWs: WebSocket | null = null;
  let openaiReady = false;
  const audioQueue: string[] = [];

  // These will be loaded after receiving start message with customParameters
  let instructions = generateLexiInstructions(true); // Default hardcoded fallback
  let organizationId: string = orgId || '';
  let realtimeModel = 'gpt-4o-realtime-preview-2024-12-17'; // Default
  let dataIntegrations: string[] = [];
  let configLoaded = false;

  // Check OpenAI API key early
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('[Twilio WS] ❌ OPENAI_API_KEY not configured');
    twilioWs.close();
    return;
  }

  // Function to load channel config and connect to OpenAI
  // This is called AFTER we have the organization ID from customParameters
  async function initializeOpenAIConnection() {
    console.log('[Twilio WS] 🔧 initializeOpenAIConnection called, configLoaded:', configLoaded);
    if (configLoaded) {
      console.log('[Twilio WS] ⚠️ Config already loaded, skipping');
      return;
    }
    configLoaded = true;
    console.log('[Twilio WS] 🔧 Loading config for org:', organizationId);

    try {
      // Use provided org ID or fall back to default
      if (!organizationId) {
        console.log('[Twilio WS] 🔧 No org ID, getting default...');
        organizationId = await getCachedDefaultOrganizationId();
        console.warn('[Twilio WS] ⚠️ No org ID provided, using default:', organizationId);
      } else {
        console.log('[Twilio WS] 📋 Using org ID:', organizationId);
      }
      
      if (organizationId) {
        // Check if Twilio channel is enabled
        const channelConfig = await getChannelConfig(organizationId, 'twilio');
        
        if (!channelConfig.enabled) {
          console.log('[Twilio WS] ⚠️ Twilio channel is disabled for this organization');
        }
        
        // Store data integrations for tool execution
        dataIntegrations = channelConfig.data_integrations || [];
        
        // Select realtime model based on channel config
        if (channelConfig.ai_backend === 'openai_gpt4o_mini') {
          realtimeModel = 'gpt-4o-mini-realtime-preview-2024-12-17';
        } else {
          realtimeModel = 'gpt-4o-realtime-preview-2024-12-17';
        }
        
        console.log(`[Twilio WS] 📋 Channel config: backend=${channelConfig.ai_backend}, model=${realtimeModel}, integrations=${dataIntegrations.join(',') || 'none'}`);
        
        // Use channel-specific instructions from database
        // Priority: one_agent_instructions > instructions (deprecated) > hardcoded
        if (channelConfig.one_agent_instructions) {
          instructions = channelConfig.one_agent_instructions;
          console.log('[Twilio WS] 📋 Using one_agent_instructions from DB');
        } else if (channelConfig.instructions) {
          instructions = channelConfig.instructions;
          console.log('[Twilio WS] 📋 Using deprecated instructions field from DB');
        } else {
          console.log('[Twilio WS] 📋 Using hardcoded instructions (no DB config found)');
        }
      }
    } catch (error) {
      console.warn('[Twilio WS] ⚠️ Failed to load config, using hardcoded:', error);
    }

    // NOW connect to OpenAI with correct config
    try {
      openaiWs = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${realtimeModel}`,
        {
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        }
      );

      setupOpenAIHandlers();
    } catch (error) {
      console.error('[Twilio WS] ❌ Failed to create OpenAI connection:', error);
      twilioWs.close();
    }
  }

  // Setup OpenAI WebSocket event handlers
  function setupOpenAIHandlers() {
    if (!openaiWs) return;

    openaiWs.on('open', () => {
      console.log('[Twilio WS] ✅ Connected to OpenAI Realtime');
      
      // Configure session with g711_ulaw (no conversion needed!)
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: instructions,
          voice: 'sage',
          input_audio_format: 'g711_ulaw',  // ✅ Native Twilio format - NO CONVERSION!
          output_audio_format: 'g711_ulaw', // ✅ Native Twilio format - NO CONVERSION!
          input_audio_transcription: {
            model: 'gpt-4o-mini-transcribe',
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500, // Increased from 200ms to let user finish speaking
          },
          tools: lexiTools.map(tool => ({
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      };

      openaiWs!.send(JSON.stringify(sessionUpdate));
      console.log('[Twilio WS] 📤 Session configured with g711_ulaw (no audio conversion needed)');

      // Mark OpenAI as ready and process queued audio
      openaiReady = true;
      if (audioQueue.length > 0) {
        console.log(`[Twilio WS] 📦 Processing ${audioQueue.length} queued audio packets`);
        for (const audioPayload of audioQueue) {
          // Pass μ-law audio directly - no conversion needed!
          openaiWs!.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: audioPayload,
          }));
        }
        audioQueue.length = 0; // Clear queue
      }
    });

    openaiWs.on('message', async (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString());

        // Only log important events (skip noisy ones for cleaner logs)
        const skipLogEvents = [
          'response.audio.delta',
          'response.audio_transcript.delta',
          'conversation.item.input_audio_transcription.delta',
          'response.function_call_arguments.delta',
          'input_audio_buffer.speech_started',
          'input_audio_buffer.speech_stopped',
          'input_audio_buffer.committed',
          'conversation.item.created',
          'response.created',
          'response.output_item.added',
          'response.content_part.added',
          'response.content_part.done',
          'response.output_item.done',
          'rate_limits.updated',
        ];
        if (!skipLogEvents.includes(response.type)) {
          console.log('[Premium WS] 📨 OpenAI event:', response.type);
        }

        if (response.type === 'session.updated') {
          console.log('[Premium WS] ✅ Session updated successfully');
        }

        if (response.type === 'response.audio.delta' && response.delta) {
          // Audio from OpenAI → send directly to Twilio (NO CONVERSION - both use g711_ulaw!)
          if (twilioWs.readyState === WebSocket.OPEN && streamSid) {
            twilioWs.send(JSON.stringify({
              event: 'media',
              streamSid: streamSid,
              media: {
                payload: response.delta  // ✅ Direct passthrough!
              }
            }));
          }
        }

        if (response.type === 'response.function_call_arguments.done') {
          console.log('[Twilio WS] 🔧 Function call:', response.name);
          
          try {
            const args = JSON.parse(response.arguments);
            const result = await executeLexiTool(
              response.name,
              args,
              [],
              `twilio_${callSid}`,
              undefined, // playOneMomentAudio
              { 
                channel: 'twilio',
                organizationId: organizationId,
                dataIntegrations: dataIntegrations 
              }
            );

            // Record function call to conversation state (auto-persists to Supabase)
            if (callSid) {
              recordFunctionCall(
                `twilio_${callSid}`,
                response.name,
                args,
                result,
                undefined, // no error
                {} // auto-filled params
              );
            }

            openaiWs!.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: response.call_id,
                output: JSON.stringify(result),
              },
            }));

            openaiWs!.send(JSON.stringify({ type: 'response.create' }));
          } catch (error: any) {
            console.error('[Twilio WS] ❌ Function error:', error);
            
            // Record failed function call to conversation state
            if (callSid) {
              recordFunctionCall(
                `twilio_${callSid}`,
                response.name,
                JSON.parse(response.arguments || '{}'),
                undefined, // no result
                error.message, // error message
                {}
              );
            }
            
            openaiWs!.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: response.call_id,
                output: JSON.stringify({ error: error.message }),
              },
            }));
          }
        }

        // Speech start/stop logging removed - too verbose

        // ============================================
        // TRANSCRIPT CAPTURE FOR ADMIN CALLS TAB
        // ============================================
        
        // User speech transcription completed
        if (response.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = response.transcript;
          if (transcript && transcript.trim() && callSid) {
            // Transcript logging removed - too verbose
            processMessage(`twilio_${callSid}`, transcript.trim(), 'user');
          }
        }

        // Assistant speech transcription completed
        if (response.type === 'response.audio_transcript.done') {
          const transcript = response.transcript;
          if (transcript && transcript.trim() && callSid) {
            // Transcript logging removed - too verbose
            addMessage(`twilio_${callSid}`, 'assistant', transcript.trim());
          }
        }

        if (response.type === 'error') {
          console.error('[Twilio WS] ❌ OpenAI error:', response.error);
        }

      } catch (error) {
        console.error('[Twilio WS] ❌ Error processing OpenAI message:', error);
      }
    });

    openaiWs.on('error', (error) => {
      console.error('[Twilio WS] ❌ OpenAI WebSocket error:', error);
    });

    openaiWs.on('close', () => {
      console.log('[Twilio WS] 🔴 OpenAI connection closed');
    });
  } // End of setupOpenAIHandlers

  // Keep-alive for Twilio (send mark every 20s)
  const keepAlive = setInterval(() => {
    if (twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({ event: 'mark', streamSid }));
    }
  }, 20000);

  // Handle Twilio messages
  twilioWs.on('message', async (message: WebSocket.Data) => {
    try {
      const msg: TwilioMessage = JSON.parse(message.toString());
      // Only log start/stop events (keep logs minimal)
      if (msg.event === 'start' || msg.event === 'stop') {
        console.log('[Premium WS] 📩 Twilio event:', msg.event);
      }

      switch (msg.event) {
        case 'start':
          streamSid = msg.start!.streamSid;
          callSid = msg.start!.callSid || initialCallSid;
          console.log('[Twilio WS] 📞 Call started:', callSid);
          console.log('[Twilio WS] 🎵 Media format:', msg.start!.mediaFormat);
          
          // Extract custom parameters from TwiML <Parameter> elements
          // These are sent in the start message's customParameters field
          const customParams = (msg.start as any)?.customParameters || {};
          console.log('[Twilio WS] 📋 Custom parameters:', JSON.stringify(customParams));
          
          // Use custom parameters - THESE ARE CRITICAL for multi-tenancy
          if (customParams.orgId) {
            organizationId = customParams.orgId;
            console.log('[Twilio WS] 📋 Using orgId from customParameters:', organizationId);
          }
          if (customParams.callSid && !callSid) {
            callSid = customParams.callSid;
          }
          if (customParams.from) {
            fromNumber = customParams.from;
            console.log('[Twilio WS] 📋 Caller number from customParameters:', fromNumber);
          }
          if (customParams.to) {
            toNumber = customParams.to;
            console.log('[Twilio WS] 📋 Called number from customParameters:', toNumber);
          }
          
          // NOW initialize OpenAI connection with correct org context
          // This loads channel config from DB and connects to OpenAI
          console.log('[Twilio WS] 🔄 About to initialize OpenAI connection...');
          try {
            await initializeOpenAIConnection();
            console.log('[Twilio WS] ✅ OpenAI connection initialized');
          } catch (initError) {
            console.error('[Twilio WS] ❌ Error initializing OpenAI:', initError);
          }
          
          // Initialize conversation state for this call (creates DB entry)
          if (callSid) {
            const state = getOrCreateState(`twilio_${callSid}`);
            state.intent = 'unknown'; // Will be detected from conversation
            console.log('[Twilio WS] 📊 Conversation state initialized:', `twilio_${callSid}`);
            
            // Create conversation record in database with admin client
            // Admin client bypasses RLS for server-side WebSocket operations
            try {
              const { getSupabaseAdmin } = await import('@/app/lib/supabaseClient');
              const supabase = getSupabaseAdmin();
              
              const { data, error } = await supabase
                .from('conversations')
                .insert({
                  session_id: `twilio_${callSid}`,
                  organization_id: organizationId,
                  channel: 'voice',  // DB constraint only allows: voice, sms, whatsapp, web
                  
                  // Twilio fields
                  call_id: callSid,
                  from_number: fromNumber,
                  to_number: toNumber,
                  direction: 'inbound',
                  start_timestamp: Date.now(),
                  call_status: 'ongoing',
                  
                  // Initialize with empty structures
                  patient_info: {},
                  appointment_info: {},
                  missing_required: []
                })
                .select()
                .single();
              
              if (error) {
                console.error('[Twilio WS] ❌ Error creating conversation:', error);
              } else {
                console.log(`[Twilio WS] ✅ Created conversation: ${data.id} for org: ${organizationId}`);
                // Set the dbId in conversationState so messages can be persisted
                const { setSessionDbId } = await import('@/app/lib/conversationState');
                setSessionDbId(`twilio_${callSid}`, data.id);
              }
            } catch (dbError) {
              console.error('[Twilio WS] ❌ Database error:', dbError);
              // Continue anyway - conversation state will still work in memory
            }
          }
          break;

        case 'media':
          // Audio from Twilio → send directly to OpenAI (NO CONVERSION - both use g711_ulaw!)
          if (openaiReady && openaiWs && openaiWs.readyState === WebSocket.OPEN && msg.media?.payload) {
            openaiWs.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: msg.media.payload,  // ✅ Direct passthrough!
            }));
          } else {
            // Queue audio until OpenAI is ready
            if (msg.media?.payload && audioQueue.length < 100) {
              audioQueue.push(msg.media.payload);
            }
          }
          break;

        case 'stop':
          console.log('[Twilio WS] 📴 Call stopped');
          clearInterval(keepAlive);
          if (openaiWs) openaiWs.close();
          break;
      }
    } catch (error) {
      console.error('[Twilio WS] ❌ Error processing Twilio message:', error);
    }
  });

  twilioWs.on('close', () => {
    console.log('[Twilio WS] 🔴 Twilio disconnected');
    clearInterval(keepAlive);
    if (openaiWs) openaiWs.close();
  });

  twilioWs.on('error', (error) => {
    console.error('[Twilio WS] ❌ Twilio WebSocket error:', error);
    clearInterval(keepAlive);
    if (openaiWs) openaiWs.close();
  });
}

/**
 * Setup Twilio WebSocket handler using express-ws
 * This registers the /twilio-media-stream route with express-ws
 */
export function setupTwilioWebSocketHandler(expressWsApp: any) {
  // Register the websocket route using express-ws
  expressWsApp.ws('/twilio-media-stream', (ws: WebSocket, req: any) => {
    console.log('[Twilio WS] 🔌 New connection on /twilio-media-stream');
    
    // Extract query parameters from URL
    // Format: /twilio-media-stream?orgId=xxx&callSid=xxx&from=xxx&to=xxx
    const url = new URL(req.url, 'http://localhost');
    const orgId = url.searchParams.get('orgId');
    const callSid = url.searchParams.get('callSid');
    const fromNumber = url.searchParams.get('from');
    const toNumber = url.searchParams.get('to');
    
    console.log('[Twilio WS] 📋 Call metadata from URL:');
    console.log(`  Org ID: ${orgId || 'NOT PROVIDED'}`);
    console.log(`  Call SID: ${callSid || 'NOT PROVIDED'}`);
    console.log(`  From: ${fromNumber || 'NOT PROVIDED'}`);
    console.log(`  To: ${toNumber || 'NOT PROVIDED'}`);
    
    if (!orgId) {
      console.error('[Twilio WS] ❌ No organization ID provided in URL parameters');
      console.error('[Twilio WS] ❌ This will cause incorrect org routing!');
      // Continue anyway with fallback, but log warning
    }
    
    handleTwilioConnection(ws, orgId, callSid, fromNumber, toNumber);
  });

  console.log('[Twilio WS] ✅ Handler registered on /twilio-media-stream');
}
