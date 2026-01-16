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
 */
function handleTwilioConnection(twilioWs: WebSocket) {
  console.log('[Twilio WS] 🟢 Client connected');

  let streamSid: string | null = null;
  let callSid: string | null = null;
  let openaiWs: WebSocket | null = null;
  let openaiReady = false;
  const audioQueue: string[] = [];

  // Create OpenAI Realtime WebSocket
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('[Twilio WS] ❌ OPENAI_API_KEY not configured');
    twilioWs.close();
    return;
  }

  try {
    openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      }
    );

    openaiWs.on('open', () => {
      console.log('[Twilio WS] ✅ Connected to OpenAI Realtime');
      
      // Configure session with g711_ulaw (no conversion needed!)
      const instructions = generateLexiInstructions(true);
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: instructions,
          voice: 'sage',
          input_audio_format: 'g711_ulaw',  // ✅ Native Twilio format - NO CONVERSION!
          output_audio_format: 'g711_ulaw', // ✅ Native Twilio format - NO CONVERSION!
          input_audio_transcription: {
            model: 'gpt-4o-mini-transcribe',  // Updated to match official OpenAI implementation
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200,
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
              `twilio_${callSid}`
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

  } catch (error) {
    console.error('[Twilio WS] ❌ Failed to create OpenAI connection:', error);
    twilioWs.close();
    return;
  }

  // Keep-alive for Twilio (send mark every 20s)
  const keepAlive = setInterval(() => {
    if (twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({ event: 'mark', streamSid }));
    }
  }, 20000);

  // Handle Twilio messages
  twilioWs.on('message', (message: WebSocket.Data) => {
    try {
      const msg: TwilioMessage = JSON.parse(message.toString());
      // Only log start/stop events (keep logs minimal)
      if (msg.event === 'start' || msg.event === 'stop') {
        console.log('[Premium WS] 📩 Twilio event:', msg.event);
      }

      switch (msg.event) {
        case 'start':
          streamSid = msg.start!.streamSid;
          callSid = msg.start!.callSid;
          console.log('[Twilio WS] 📞 Call started:', callSid);
          console.log('[Twilio WS] 🎵 Media format:', msg.start!.mediaFormat);
          
          // Initialize conversation state for this call (creates DB entry)
          if (callSid) {
            const state = getOrCreateState(`twilio_${callSid}`);
            state.intent = 'unknown'; // Will be detected from conversation
            console.log('[Twilio WS] 📊 Conversation state initialized:', `twilio_${callSid}`);
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
    handleTwilioConnection(ws);
  });

  console.log('[Twilio WS] ✅ Handler registered on /twilio-media-stream');
}
