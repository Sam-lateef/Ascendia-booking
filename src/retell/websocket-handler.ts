import express from 'express';
import expressWs from 'express-ws';
import WebSocket from 'ws';
import http from 'http';

// Base URL for Next.js API routes (defaults to localhost:3000 for local dev)
const NEXTJS_BASE_URL = process.env.NEXTJS_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Flag to control whether to use new workflow engine or legacy callGreetingAgent
// DISABLED: /api/workflow route does not exist yet - using legacy callGreetingAgent
const USE_WORKFLOW_ENGINE = false;

// Channel configuration cache (since we can't use channelConfigLoader directly in standalone server)
interface RetellChannelConfig {
  enabled: boolean;
  ai_backend: string;
  data_integrations: string[];
  instructions?: string;
}

// Default Retell config (GPT-4o since Retell handles TTS/STT)
const DEFAULT_RETELL_CONFIG: RetellChannelConfig = {
  enabled: true,
  ai_backend: 'openai_gpt4o',
  data_integrations: [],
};

// Cache channel configs per organization
const channelConfigCache = new Map<string, { config: RetellChannelConfig; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Fetch channel config from Next.js API
 */
async function getRetellChannelConfig(organizationId: string): Promise<RetellChannelConfig> {
  const cacheKey = organizationId;
  const cached = channelConfigCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.config;
  }
  
  try {
    const response = await fetch(`${NEXTJS_BASE_URL}/api/admin/channel-configs`, {
      headers: {
        'x-organization-id': organizationId,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const retellConfig = data.configs?.find((c: any) => c.channel === 'retell');
      
      if (retellConfig) {
        const config: RetellChannelConfig = {
          enabled: retellConfig.enabled ?? true,
          ai_backend: retellConfig.ai_backend || 'openai_gpt4o',
          data_integrations: retellConfig.data_integrations || [],
          instructions: retellConfig.instructions,
        };
        
        channelConfigCache.set(cacheKey, { config, timestamp: Date.now() });
        console.log(`[Retell WS] Loaded channel config for org ${organizationId}:`, config);
        return config;
      }
    }
  } catch (error) {
    console.error('[Retell WS] Failed to load channel config:', error);
  }
  
  return DEFAULT_RETELL_CONFIG;
}

// Patch global fetch to use absolute URLs when running in Express server
if (typeof global !== 'undefined' && typeof global.fetch === 'function') {
  const originalFetch = global.fetch;
  global.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    if (typeof input === 'string') {
      url = input.startsWith('http') ? input : `${NEXTJS_BASE_URL}${input}`;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = input.url.startsWith('http') ? input.url : `${NEXTJS_BASE_URL}${input.url}`;
    }
    return originalFetch(url, init);
  };
}

// Extend Express Request to include WebSocket
interface RetellWebSocket extends WebSocket {
  callId?: string;
  conversationHistory?: any[];
  isFirstMessage?: boolean;
  pendingTextInput?: string[]; // Store text inputs waiting for reminder_required
}

interface RetellMessage {
  interaction_type: 'update_only' | 'response_required' | 'reminder_required' | 'call_details' | 'ping' | 'ping_pong';
  response_id?: number;
  transcript?: Array<{
    role: 'agent' | 'user';
    content: string;
    timestamp: number;
  }>;
  call_id?: string;
  timestamp?: number; // For ping_pong events
  // ... other fields
}

interface RetellResponse {
  response_type: 'response' | 'config' | 'ping_pong' | 'agent_interrupt';
  response_id?: number;
  content?: string;
  content_complete?: boolean;
  end_call?: boolean;
  stop_current_utterance?: boolean; // For agent_interrupt - stop current speech
  config?: {
    auto_reconnect?: boolean;
    call_details?: boolean;
  };
  timestamp?: number; // For ping_pong responses
}

// Create Express app and HTTP server explicitly
const app = express();
const server = http.createServer(app);

// Initialize express-ws with both app and server
// Cast to any to allow passing server as second argument (TypeScript types are incomplete)
const expressWsInstance: any = (expressWs as any)(app, server);

// Store conversation history per call_id
const callHistoryMap = new Map<string, any[]>();
// Store active WebSocket connections by call_id for text input
const activeConnections = new Map<string, RetellWebSocket>();

/**
 * Get the last user message from transcript
 */
function getLastUserMessage(transcript?: Array<{ role: string; content: string }>): string {
  if (!transcript || transcript.length === 0) return '';
  
  // Find last user message
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i].role === 'user') {
      return transcript[i].content;
    }
  }
  return '';
}

/**
 * Send status update using agent_interrupt
 * This sends a separate, standalone message that does NOT concatenate with other responses
 * CRITICAL: This must be sent IMMEDIATELY and synchronously before any async processing
 */
function sendAgentInterrupt(ws: RetellWebSocket, message: string, callId: string): boolean {
  if (ws.readyState !== WebSocket.OPEN) {
    console.warn(`[Retell WS] ❌ Cannot send agent_interrupt - WebSocket not open (state: ${ws.readyState}) for call ${callId}`);
    return false;
  }
  
  try {
    // According to Retell docs, agent_interrupt format is:
    // { response_type: 'agent_interrupt', content: string, content_complete: true }
    // CRITICAL: Must match Retell's exact format
    // Trying with minimal delay to ensure Retell is ready to receive
    const interruptMessage: RetellResponse = {
      response_type: 'agent_interrupt',
      content: message,
      content_complete: true // agent_interrupt is always complete
    };
    
    const messageStr = JSON.stringify(interruptMessage);
    const beforeSend = Date.now();
    
    // Enhanced logging to debug why agent_interrupt isn't being spoken
    console.log(`[Retell WS] 🔍 About to send agent_interrupt for call ${callId}`);
    console.log(`[Retell WS] 🔍 WebSocket state: ${ws.readyState} (1=OPEN, 0=CONNECTING, 2=CLOSING, 3=CLOSED)`);
    console.log(`[Retell WS] 🔍 Full message payload: ${messageStr}`);
    
    // CRITICAL: Send synchronously - don't await anything here
    ws.send(messageStr);
    const afterSend = Date.now();
    
    // Truncate long messages in logs
    const logMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
    console.log(`[Retell WS] ✅ IMMEDIATELY sent agent_interrupt for call ${callId} at ${beforeSend}: "${logMessage}"`);
    console.log(`[Retell WS] ⏱️  Send took ${afterSend - beforeSend}ms`);
    console.log(`[Retell WS] 📏 Message length: ${message.length} characters`);
    console.log(`[Retell WS] 🔍 WebSocket state after send: ${ws.readyState}`);
    
    // WARNING: If agent_interrupt is not being spoken, this is likely a Retell platform issue
    // Possible causes:
    // 1. Agent configuration in Retell dashboard doesn't allow interrupts
    // 2. Agent is in a state where interrupts are not accepted
    // 3. Retell platform bug or limitation
    // 4. The message format might need additional fields (but docs don't specify)
    
    return true;
  } catch (error) {
    console.error(`[Retell WS] ❌ ERROR sending agent_interrupt for call ${callId}:`, error);
    console.error(`[Retell WS] ❌ Error details:`, error instanceof Error ? error.stack : error);
    return false;
  }
}

/**
 * Process user message via the new Workflow API
 * This uses the deterministic workflow engine server-side
 */
async function processWithWorkflowAPI(
  userMessage: string,
  callId: string,
  conversationHistory: any[]
): Promise<{ text: string; shouldEndCall: boolean }> {
  try {
    console.log(`[Retell WS] 🔄 Processing via Workflow API for call ${callId}:`, userMessage);
    
    // Normalize conversation history for the workflow API
    const normalizedHistory = conversationHistory.map((msg: any) => ({
      role: msg.role || 'user',
      content: msg.content || '',
    }));
    
    // Add current user message
    normalizedHistory.push({
      role: 'user',
      content: userMessage,
    });
    
    // Call the workflow API
    const response = await fetch(`${NEXTJS_BASE_URL}/api/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: `retell_${callId}`, // Use Retell's call_id as session ID
        conversationHistory: normalizedHistory,
        userMessage: userMessage,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Workflow API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`[Retell WS] ✅ Workflow API response for ${callId}:`, result.response?.substring(0, 100) + '...');
    
    // Update conversation history with the new messages
    const workingHistory = [...conversationHistory];
    workingHistory.push({
      type: 'message',
      role: 'user',
      content: userMessage,
    });
    workingHistory.push({
      type: 'message',
      role: 'assistant',
      content: result.response,
    });
    callHistoryMap.set(callId, workingHistory);
    
    return {
      text: result.response,
      shouldEndCall: false,
    };
  } catch (error: any) {
    console.error(`[Retell WS] ❌ Workflow API error for call ${callId}:`, error);
    return {
      text: "I'm sorry, I encountered an error processing your request. Please try again.",
      shouldEndCall: false,
    };
  }
}

/**
 * Process user message with our LLM (greeting agent) - LEGACY
 * Kept for fallback/comparison purposes
 */
async function processWithLLMLegacy(
  userMessage: string,
  callId: string,
  conversationHistory: any[],
  organizationId?: string
): Promise<{ text: string; shouldEndCall: boolean }> {
  try {
    // Dynamic import to avoid bundling issues when USE_WORKFLOW_ENGINE is true
    // Use embeddedBooking config (internal database) - same as web chat and Twilio
    const { callGreetingAgent } = await import('../app/agentConfigs/embeddedBooking/greetingAgentSTT');
    
    console.log(`[Retell WS] Processing message for call ${callId} (org: ${organizationId || 'default'}):`, userMessage);
    
    // Create a working copy that will be modified by callGreetingAgent
    const workingHistory = [...conversationHistory];
    
    // Add user message to working history
    const userMessageItem = {
      type: 'message',
      role: 'user',
      content: userMessage,
    };
    workingHistory.push(userMessageItem);
    
    const isFirstMessage = conversationHistory.length === 0;
    
    // Call our existing greeting agent with organization context and sessionId
    const sessionId = `retell_${callId}`;
    const response = await callGreetingAgent(
      userMessage,
      workingHistory,
      isFirstMessage,
      undefined,
      organizationId,
      sessionId
    );
    
    // Add assistant response to working history
    const assistantMessageItem = {
      type: 'message',
      role: 'assistant',
      content: response,
    };
    workingHistory.push(assistantMessageItem);
    
    // Store FULL history including function calls
    callHistoryMap.set(callId, workingHistory);
    
    return {
      text: response,
      shouldEndCall: false,
    };
  } catch (error: any) {
    console.error(`[Retell WS] Error processing message for call ${callId}:`, error);
    
    return {
      text: "I'm sorry, I encountered an error processing your request. Please try again.",
      shouldEndCall: false,
    };
  }
}

/**
 * Process user message - routes to workflow API or legacy based on flag
 */
async function processWithLLM(
  userMessage: string,
  callId: string,
  conversationHistory: any[],
  organizationId?: string
): Promise<{ text: string; shouldEndCall: boolean }> {
  if (USE_WORKFLOW_ENGINE) {
    return processWithWorkflowAPI(userMessage, callId, conversationHistory);
  } else {
    return processWithLLMLegacy(userMessage, callId, conversationHistory, organizationId);
  }
}

// Store organization ID per call for channel config lookup
const callOrgMap = new Map<string, string>();

// Organization slug to ID mapping
// TODO: Move this to database or environment variables for production
const ORG_SLUG_MAP: Record<string, string> = {
  'default': '', // Will use getCachedDefaultOrganizationId()
  
  // Your organizations (synced from database):
  'test-a': '1c26bf4a-2575-45e3-82eb-9f58c899e2e7',
  'nurai-clinic': '660d9ca6-b200-4c12-9b8d-af0a470d8b88',
  'default-org': '00000000-0000-0000-0000-000000000001',
  'admin': '9aa626ad-9a3e-4a79-a959-dda0a0b8b983',
  'sam-lateeff': 'b445a9c7-af93-4b4a-a975-40d3f44178ec',
};

// WebSocket endpoint that Retell connects to
// Supports both formats:
// - /llm-websocket/:call_id (uses default org)
// - /llm-websocket/:org_slug/:call_id (uses specified org)
expressWsInstance.app.ws('/llm-websocket/:org_slug_or_call_id/:call_id?', async (ws: RetellWebSocket, req: any) => {
  // Parse parameters - support both old and new format
  let orgSlug: string;
  let callId: string;
  
  if (req.params.call_id) {
    // New format: /llm-websocket/:org_slug/:call_id
    orgSlug = req.params.org_slug_or_call_id;
    callId = req.params.call_id;
    console.log(`[Retell WS] Connected for call: ${callId} (org slug: ${orgSlug})`);
  } else {
    // Old format: /llm-websocket/:call_id (backward compatible)
    orgSlug = 'default';
    callId = req.params.org_slug_or_call_id;
    console.log(`[Retell WS] Connected for call: ${callId} (using default org)`);
  }
  
  // Initialize WebSocket properties
  ws.callId = callId;
  ws.conversationHistory = callHistoryMap.get(callId) || [];
  ws.isFirstMessage = ws.conversationHistory.length === 0;
  
  // Store this connection for text input API
  activeConnections.set(callId, ws);
  
  // Load channel configuration
  let channelConfig = DEFAULT_RETELL_CONFIG;
  try {
    // Get organization ID from slug or use default
    const { getCachedDefaultOrganizationId } = await import('../app/lib/callHelpers');
    let orgId: string;
    
    if (orgSlug === 'default' || !ORG_SLUG_MAP[orgSlug]) {
      orgId = await getCachedDefaultOrganizationId();
      if (orgSlug !== 'default') {
        console.warn(`[Retell WS] Unknown org slug '${orgSlug}', using default org`);
      }
    } else {
      orgId = ORG_SLUG_MAP[orgSlug];
      console.log(`[Retell WS] Using org ${orgId} from slug '${orgSlug}'`);
    }
    
    if (orgId) {
      callOrgMap.set(callId, orgId);
      channelConfig = await getRetellChannelConfig(orgId);
      
      console.log(`[Retell WS] Channel config loaded for call ${callId}:`, {
        enabled: channelConfig.enabled,
        ai_backend: channelConfig.ai_backend,
        data_integrations: channelConfig.data_integrations,
      });
      
      // Check if channel is enabled
      if (!channelConfig.enabled) {
        console.log(`[Retell WS] ⚠️ Retell channel is disabled for org ${orgId}`);
        // Continue anyway but log the warning
      }
      
      // Create initial conversation record in database with correct org
      // This ensures the webhook can find it and won't create a duplicate with wrong org
      try {
        const { getSupabaseAdmin } = await import('../app/lib/supabaseClient');
        const supabase = getSupabaseAdmin();
        
        // Check if conversation already exists
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('call_id', callId)
          .single();
        
        if (!existing) {
          // Create new conversation with correct org
          const { data, error } = await supabase
            .from('conversations')
            .insert({
              session_id: `retell_${callId}`,
              organization_id: orgId,
              channel: 'voice',  // DB constraint only allows: voice, sms, whatsapp, web
              call_id: callId,
              call_status: 'ongoing',
              start_timestamp: Date.now(),
              patient_info: {},
              appointment_info: {},
              missing_required: []
            })
            .select()
            .single();
          
          if (error) {
            console.error(`[Retell WS] Error creating conversation for call ${callId}:`, error);
          } else {
            console.log(`[Retell WS] ✅ Created conversation ${data.id} for call ${callId} in org ${orgId}`);
          }
        } else {
          console.log(`[Retell WS] Conversation already exists for call ${callId}`);
        }
      } catch (error) {
        console.error(`[Retell WS] Failed to create conversation for call ${callId}:`, error);
      }
    }
  } catch (error) {
    console.error('[Retell WS] Failed to load channel config:', error);
  }
  
  // Send optional config on connection
  ws.send(JSON.stringify({
    response_type: 'config',
    config: {
      auto_reconnect: true,
      call_details: true
    }
  } as RetellResponse));

  // Send initial greeting (or empty string to let user speak first)
  // We'll send the greeting through our LLM to maintain consistency
  if (ws.isFirstMessage) {
    // Get org ID from callOrgMap for this call
    const orgIdForGreeting = callOrgMap.get(callId);
    console.log(`[Retell WS] Sending initial greeting for call ${callId}, org: ${orgIdForGreeting || 'default'}`);
    
    processWithLLM('Start the conversation with the greeting.', callId, ws.conversationHistory, orgIdForGreeting)
      .then((result) => {
        // Update ws.conversationHistory to sync with callHistoryMap
        // This ensures isFirstMessage is calculated correctly for subsequent messages
        ws.conversationHistory = callHistoryMap.get(callId) || [];
        ws.isFirstMessage = false;
        
        ws.send(JSON.stringify({
          response_type: 'response',
          response_id: 0,
          content: result.text,
          content_complete: true
        } as RetellResponse));
      })
      .catch((error) => {
        console.error(`[Retell WS] Error sending initial greeting for call ${callId}:`, error);
        // Fallback greeting - add to conversation history manually
        const fallbackGreeting = "Hi! Welcome to Barton Dental. This is Lexi. How can I help you today?";
        const fallbackHistory = [
          {
            type: 'message',
            role: 'assistant',
            content: fallbackGreeting,
          }
        ];
        callHistoryMap.set(callId, fallbackHistory);
        ws.conversationHistory = fallbackHistory;
        ws.isFirstMessage = false;
        
        ws.send(JSON.stringify({
          response_type: 'response',
          response_id: 0,
          content: fallbackGreeting,
          content_complete: true
        } as RetellResponse));
      });
  }

  ws.on('message', async (data: string) => {
    try {
      const message: RetellMessage = JSON.parse(data);
      
      // Only log important message types (not update_only or ping_pong)
      if (message.interaction_type !== 'update_only' && message.interaction_type !== 'ping_pong') {
        console.log(`[Retell WS] Received message for call ${callId}:`, message.interaction_type);
      }

      // Handle different message types
      switch (message.interaction_type) {
        case 'ping_pong':
          // CRITICAL: Must respond to pings to keep connection alive
          // Retell sends ping every 2 seconds when auto_reconnect is enabled
          ws.send(JSON.stringify({
            response_type: 'ping_pong',
            timestamp: message.timestamp
          } as RetellResponse));
          // Logging removed to reduce noise - focus on API calls
          break;

        case 'ping':
          // Handle legacy ping format (if any)
          ws.send(JSON.stringify({
            response_type: 'ping_pong',
            timestamp: message.timestamp || Date.now()
          } as RetellResponse));
          // Logging removed to reduce noise
          break;

        case 'call_details':
          console.log(`[Retell WS] Call details received for call ${callId}:`, message);
          break;

        case 'update_only':
          // Just transcript updates, no response needed
          // Logging removed to reduce noise - focus on API calls
          break;

        case 'response_required':
        case 'reminder_required':
          // Retell is asking for a response - must respond quickly to prevent timeout
          const responseId = message.response_id!;
          const userMessage = getLastUserMessage(message.transcript);
          
          // Processing user message - logging removed to reduce noise
          
          if (!userMessage) {
            console.warn(`[Retell WS] No user message found in transcript for call ${callId}`);
            // Send empty response to acknowledge
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                response_type: 'response',
                response_id: responseId,
                content: '',
                content_complete: true
              } as RetellResponse));
            }
            break;
          }
          
          // Track processing start time for logging only
          const startTime = Date.now();
          
          // NOTE: We do NOT send status updates here because:
          // 1. The greeting agent already says "One moment please, let me look that up for you" before calling orchestrator
          // 2. Sending duplicate status messages adds latency and noise
          // 3. OpenAI Realtime doesn't send status updates - it just processes and responds
          // 4. If processing takes >10 seconds, we'll send a status update (see below)
          
          // Set up a single status update ONLY if processing takes very long (>10 seconds)
          let longProcessingStatusSent = false;
          let statusInterval: NodeJS.Timeout | null = null;
          
          statusInterval = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) {
              if (statusInterval) clearInterval(statusInterval);
              return;
            }
            
            const elapsed = Date.now() - startTime;
            
            // Only send status if processing takes >10 seconds (unusual case)
            if (elapsed >= 10000 && !longProcessingStatusSent) {
              sendAgentInterrupt(ws, 'Still working on it, just a moment longer.', callId);
              longProcessingStatusSent = true;
            }
          }, 1000); // Check every 1 second
          
          // STEP 2: Process with our LLM in background
          // Get organization ID for this call
          const orgIdForCall = callOrgMap.get(callId);
          
          Promise.race([
            processWithLLM(
              userMessage,
              callId,
              ws.conversationHistory || [],
              orgIdForCall
            ),
            new Promise<{ text: string; shouldEndCall: boolean }>((_, reject) => 
              setTimeout(() => reject(new Error('LLM processing timeout')), 25000) // 25s max timeout
            )
          ])
          .then(async (aiResponse) => {
            // Clear status update interval
            if (statusInterval) {
              clearInterval(statusInterval);
              statusInterval = null;
            }
            
            // Update ws.conversationHistory to sync with callHistoryMap
            // This ensures isFirstMessage is calculated correctly for subsequent messages
            ws.conversationHistory = callHistoryMap.get(callId) || [];
            
            const processingTime = Date.now() - startTime;
            console.log(`[Retell WS] ✅ LLM processing completed in ${processingTime}ms for call ${callId}`);
            
            // STEP 3: Send final response immediately (no artificial delays)
            // The greeting agent already handles status messages, so we don't need to wait
            // This matches OpenAI Realtime behavior - process and respond immediately
            if (ws.readyState === WebSocket.OPEN) {
              const response: RetellResponse = {
                response_type: 'response',
                response_id: responseId,
                content: aiResponse.text,
                content_complete: true, // Final response is complete
                end_call: aiResponse.shouldEndCall || false
              };
              
              ws.send(JSON.stringify(response));
              console.log(`[Retell WS] ✅ Sent final response for call ${callId}, response_id: ${responseId}`);
            } else {
              console.warn(`[Retell WS] ❌ WebSocket closed (state: ${ws.readyState}) after processing, cannot send final response for call ${callId}, response_id: ${responseId}`);
            }
          })
          .catch((error: any) => {
            // Clear status update interval on error
            if (statusInterval) {
              clearInterval(statusInterval);
              statusInterval = null;
            }
            
            console.error(`[Retell WS] Error processing LLM for call ${callId}:`, error);
            // Try to send error response if connection is still open
            if (ws.readyState === WebSocket.OPEN) {
              const errorMessage = error.message?.includes('timeout') 
                ? "I'm sorry, I'm having trouble processing that right now. Could you please try again?"
                : "I'm sorry, I'm having trouble processing that. Could you please repeat?";
              
              ws.send(JSON.stringify({
                response_type: 'response',
                response_id: responseId,
                content: errorMessage,
                content_complete: true
              } as RetellResponse));
              console.log(`[Retell WS] Sent error response for call ${callId}, response_id: ${responseId}`);
            } else {
              console.warn(`[Retell WS] WebSocket closed, cannot send error response for call ${callId}`);
            }
          });
          break;

        default:
          console.log(`[Retell WS] Unknown interaction_type for call ${callId}:`, message.interaction_type);
      }
    } catch (error) {
      console.error(`[Retell WS] Error processing message for call ${callId}:`, error);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[Retell WS] Disconnected for call: ${callId}, code: ${code}, reason: ${reason?.toString() || 'none'}`);
    // Clean up active connection
    activeConnections.delete(callId);
    // Optionally clean up conversation history after some time
    // For now, we keep it in case of reconnection
  });

  ws.on('error', (error) => {
    console.error(`[Retell WS] Error for call ${callId}:`, error);
    // Don't close the connection on error - let Retell handle reconnection
  });

  // Handle pong responses to keep connection alive
  ws.on('pong', () => {
    // Connection is alive
  });
});

// HTTP API endpoint to send text messages (for text input from frontend)
app.use(express.json());
app.post('/api/send-text', (req, res) => {
  try {
    const { call_id, text } = req.body;
    
    if (!call_id || !text) {
      console.warn(`[Retell API] ❌ Missing call_id or text in request`);
      return res.status(400).json({ error: 'call_id and text are required' });
    }
    
    const ws = activeConnections.get(call_id);
    
    if (!ws) {
      console.warn(`[Retell API] ❌ No active WebSocket connection found for call ${call_id}`);
      return res.status(404).json({ error: 'Call not found or not connected' });
    }
    
    if (ws.readyState !== WebSocket.OPEN) {
      console.warn(`[Retell API] ❌ WebSocket not open for call ${call_id} (state: ${ws.readyState})`);
      return res.status(503).json({ error: 'WebSocket connection not open' });
    }
    
    // Store the text input for this call so we can respond when Retell sends reminder_required
    if (!ws.pendingTextInput) {
      ws.pendingTextInput = [];
    }
    ws.pendingTextInput.push(text);
    
    // Use response_id: 1 (Retell's reminder_required ID) as a workaround
    const responseId = 1;
    const userMessage = text;
    
    // Track processing start time for logging only
    const startTime = Date.now();
    
    // NOTE: We do NOT send status updates here because:
    // 1. The greeting agent already says "One moment please, let me look that up for you" before calling orchestrator
    // 2. Sending duplicate status messages adds latency and noise
    // 3. OpenAI Realtime doesn't send status updates - it just processes and responds
    
    // Set up a single status update ONLY if processing takes very long (>10 seconds)
    let longProcessingStatusSent = false;
    let statusInterval: NodeJS.Timeout | null = null;
    
    statusInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        if (statusInterval) clearInterval(statusInterval);
        return;
      }
      
      const elapsed = Date.now() - startTime;
      
      // Only send status if processing takes >10 seconds (unusual case)
      if (elapsed >= 10000 && !longProcessingStatusSent) {
        sendAgentInterrupt(ws, 'Still working on it, just a moment longer.', call_id);
        longProcessingStatusSent = true;
      }
    }, 1000); // Check every 1 second
    
    // STEP 2: Process with our LLM in background
    Promise.race([
      processWithLLM(userMessage, call_id, ws.conversationHistory || []),
      new Promise<{ text: string; shouldEndCall: boolean }>((_, reject) =>
        setTimeout(() => reject(new Error('LLM processing timeout')), 25000)
      )
    ])
    .then(async (aiResponse) => {
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`[Retell API] ✅ LLM processing completed in ${processingTime}ms for call ${call_id}`);
      
      // STEP 3: Send final response immediately (no artificial delays)
      // The greeting agent already handles status messages, so we don't need to wait
      // This matches OpenAI Realtime behavior - process and respond immediately
      // WORKAROUND: Since agent_interrupt isn't working, try using regular response with response_id: 1
      // This might work if Retell accepts responses to reminder_required even for text input
      if (ws.readyState === WebSocket.OPEN) {
        // Send final response for text input
        try {
          ws.send(JSON.stringify({
            response_type: 'response',
            response_id: responseId,
            content: aiResponse.text,
            content_complete: true
          } as RetellResponse));
        } catch (error) {
          console.error(`[Retell API] ❌ Error sending response:`, error);
          // Fallback: try agent_interrupt anyway
          sendAgentInterrupt(ws, aiResponse.text, call_id);
        }
      } else {
        console.warn(`[Retell API] ❌ TEXT INPUT: WebSocket not open (state: ${ws.readyState}) - cannot send final response for call ${call_id}`);
      }
    })
    .catch((error: any) => {
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }
      console.error(`[Retell API] Error processing text input for call ${call_id}:`, error);
      
      if (ws.readyState === WebSocket.OPEN) {
        const errorMessage = error.message?.includes('timeout')
          ? "I'm sorry, I'm having trouble processing that right now. Could you please try again?"
          : "I'm sorry, I'm having trouble processing that. Could you please repeat?";
        
        ws.send(JSON.stringify({
          response_type: 'response',
          response_id: responseId,
          content: errorMessage,
          content_complete: true
        } as RetellResponse));
      }
    });
    
    // Return immediately - processing happens in background
    res.json({ success: true, message: 'Text message received, processing...' });
  } catch (error: any) {
    console.error('[Retell API] Error sending text:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default app;
export { server, expressWsInstance };

