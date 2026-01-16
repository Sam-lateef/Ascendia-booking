# Retell AI Integration Guide

## Overview

This guide provides a complete technical deep-dive into the Retell AI integration, enabling you to replicate this implementation in new projects. Retell AI handles STT/TTS (Speech-to-Text and Text-to-Speech) while your application provides the custom LLM logic via WebSocket.

**Key Benefits:**
- Cost-effective voice AI (lower than OpenAI Realtime)
- High-quality STT/TTS via Retell's infrastructure
- Full control over LLM logic and business rules
- Supports both voice and text input
- Real-time transcript updates

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  useRetellSession Hook                                   │   │
│  │  - Manages Retell Web SDK client                         │   │
│  │  - Handles transcript updates                            │   │
│  │  - Provides connect/disconnect/sendUserText APIs         │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 │                                                 │
│                 │ Retell Web SDK (retell-client-js-sdk)           │
└─────────────────┼─────────────────────────────────────────────────┘
                  │
                  │ WebSocket Connection
                  │
┌─────────────────▼─────────────────────────────────────────────────┐
│                    Retell Cloud Infrastructure                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  STT Engine     │  │  TTS Engine     │  │  Voice Router   │  │
│  │  (Transcription)│  │  (Speech)       │  │  (Orchestration)│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────┬─────────────────────────────────────────────────┘
                  │
                  │ WebSocket (LLM Protocol)
                  │
┌─────────────────▼─────────────────────────────────────────────────┐
│              Backend WebSocket Server (Express)                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  websocket-handler.ts                                         │  │
│  │  - Receives transcripts from Retell                           │  │
│  │  - Processes with your LLM (callGreetingAgent)                │  │
│  │  - Sends responses back to Retell                             │  │
│  │  - Manages conversation history                               │  │
│  └──────────────┬───────────────────────────────────────────────┘  │
│                 │                                                   │
│                 │ HTTP API Calls                                    │
│                 │                                                   │
│  ┌──────────────▼───────────────────────────────────────────────┐  │
│  │  Next.js API Routes                                          │  │
│  │  - /api/retell/create-web-call (get access token)           │  │
│  │  - /api/retell/webhook (call lifecycle events)              │  │
│  │  - /api/retell/send-text (text input proxy)                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────┬─────────────────────────────────────────────────┘
                  │
                  │ HTTP API
                  │
┌─────────────────▼─────────────────────────────────────────────────┐
│                    Your LLM Logic                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  callGreetingAgent (greetingAgentSTT.ts)                      │  │
│  │  └─> executeOrchestrator (orchestratorAgent.ts)              │  │
│  │      └─> OpenDental API / Business Logic                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Voice Input Flow:**
1. User speaks → Retell Web SDK captures audio
2. Retell Cloud transcribes speech → STT
3. Retell sends `response_required` event to WebSocket server
4. WebSocket server processes with `callGreetingAgent`
5. WebSocket server sends response back to Retell
6. Retell converts text to speech → TTS
7. User hears response

**Text Input Flow:**
1. User types text → Frontend sends to `/api/retell/send-text`
2. API proxies to WebSocket server `/api/send-text`
3. WebSocket server processes with `callGreetingAgent`
4. WebSocket server sends `agent_interrupt` (no `response_id` for text)
5. Retell converts text to speech → TTS
6. User hears response

---

## Complete Implementation Details

### 1. Backend WebSocket Server

**File**: `src/retell/websocket-handler.ts`

This is the core component that handles all communication with Retell.

#### Key Interfaces

```typescript
interface RetellWebSocket extends WebSocket {
  callId?: string;
  conversationHistory?: any[];
  isFirstMessage?: boolean;
  pendingTextInput?: string[];
}

interface RetellMessage {
  interaction_type: 'update_only' | 'response_required' | 'reminder_required' | 
                     'call_details' | 'ping' | 'ping_pong';
  response_id?: number;
  transcript?: Array<{
    role: 'agent' | 'user';
    content: string;
    timestamp: number;
  }>;
  call_id?: string;
  timestamp?: number;
}

interface RetellResponse {
  response_type: 'response' | 'config' | 'ping_pong' | 'agent_interrupt';
  response_id?: number;
  content?: string;
  content_complete?: boolean;
  end_call?: boolean;
  config?: {
    auto_reconnect?: boolean;
    call_details?: boolean;
  };
  timestamp?: number;
}
```

#### Critical Implementation Details

**1. Conversation History Management**

The conversation history is stored in two places:
- `callHistoryMap`: Global Map storing full history per call_id
- `ws.conversationHistory`: WebSocket instance property (must be synced)

**Why this matters:**
- History must persist across WebSocket reconnections
- History must include `function_call` + `function_call_output` pairs
- History must be synced after each LLM call to ensure `isFirstMessage` is calculated correctly

```typescript
// Store conversation history per call_id
const callHistoryMap = new Map<string, any[]>();

// In WebSocket connection handler:
ws.conversationHistory = callHistoryMap.get(callId) || [];
ws.isFirstMessage = ws.conversationHistory.length === 0;

// After processing, sync back:
ws.conversationHistory = callHistoryMap.get(callId) || [];
```

**2. isFirstMessage Logic**

**CRITICAL**: `isFirstMessage` must check `conversationHistory.length === 0`, NOT `workingHistory.length === 1`.

**Why:**
- `workingHistory` includes the current user message, so `length === 1` would be true for every first user message
- `conversationHistory` is the history BEFORE adding the current message
- After the initial greeting is sent, `conversationHistory` will have messages, so `isFirstMessage` should be false

```typescript
// ✅ CORRECT
const isFirstMessage = conversationHistory.length === 0;

// ❌ WRONG - This would be true for every first user message
const isFirstMessage = workingHistory.length === 1;
```

**3. Function Call/Output Pairs in Orchestrator Input**

**CRITICAL**: The orchestrator must receive `function_call` + `function_call_output` pairs from previous turns.

**Why:**
- The LLM needs to see previous API call results (like `PatNum` from `GetMultiplePatients`)
- Without these pairs, the LLM can't extract information from earlier in the conversation
- This enables multi-turn conversations where later calls depend on earlier results

**Implementation:**
```typescript
// In orchestratorAgent.ts - extractHistory building:
const pendingFunctionCalls = new Map<string, any>();

for (let i = 0; i < conversationHistory.length; i++) {
  const item = conversationHistory[i];
  
  if (item.type === 'function_call') {
    pendingFunctionCalls.set(item.call_id, item);
  } else if (item.type === 'function_call_output') {
    const matchingCall = pendingFunctionCalls.get(item.call_id);
    if (matchingCall) {
      // Include the pair
      extractedHistory.push(
        { type: 'function_call', ...matchingCall },
        { type: 'function_call_output', ...item }
      );
      pendingFunctionCalls.delete(item.call_id);
    }
  }
}
```

**4. Status Updates with agent_interrupt**

**CRITICAL**: Use `agent_interrupt` for status updates, NOT streaming responses with same `response_id`.

**Why:**
- Multiple `response` messages with same `response_id` and `content_complete: false` → `true` get **concatenated**
- `agent_interrupt` sends **separate, standalone messages** that don't concatenate
- Perfect for status updates during long processing

**Implementation:**
```typescript
// ✅ CORRECT - Separate messages
ws.send(JSON.stringify({
  response_type: 'agent_interrupt',
  content: "Let me look that up for you.",
  content_complete: true
}));

// ... processing ...

ws.send(JSON.stringify({
  response_type: 'response',
  response_id: responseId,
  content: finalAnswer,
  content_complete: true
}));

// ❌ WRONG - These get concatenated
ws.send(JSON.stringify({
  response_type: 'response',
  response_id: responseId,
  content: "Let me look...",
  content_complete: false
}));
// User hears: "Let me look... Here's your answer..." (concatenated)
```

**5. Text Input Handling**

**CRITICAL**: Text input requires `agent_interrupt`, NOT `response` with `response_id`.

**Why:**
- Voice input triggers `response_required` event → provides `response_id`
- Text input does NOT trigger `response_required` → no `response_id` available
- `agent_interrupt` doesn't require `response_id` → works for text input

**Implementation:**
```typescript
// For text input (no response_id):
ws.send(JSON.stringify({
  response_type: 'agent_interrupt',
  content: aiResponse.text,
  content_complete: true
}));

// For voice input (has response_id):
ws.send(JSON.stringify({
  response_type: 'response',
  response_id: responseId,
  content: aiResponse.text,
  content_complete: true
}));
```

**6. Ping/Pong Keepalive**

**CRITICAL**: Must respond to `ping_pong` events to keep connection alive.

**Why:**
- Retell sends ping every 2 seconds when `auto_reconnect: true`
- If you don't respond, connection dies after ~6 seconds
- This is especially important during long LLM processing

**Implementation:**
```typescript
case 'ping_pong':
  ws.send(JSON.stringify({
    response_type: 'ping_pong',
    timestamp: message.timestamp
  }));
  break;
```

#### Complete WebSocket Handler Structure

```typescript
// 1. Setup Express with WebSocket support
const app = express();
const expressWsInstance = expressWs(app);

// 2. Storage
const callHistoryMap = new Map<string, any[]>();
const activeConnections = new Map<string, RetellWebSocket>();

// 3. WebSocket endpoint
expressWsInstance.app.ws('/llm-websocket/:call_id', (ws, req) => {
  const callId = req.params.call_id;
  
  // Initialize
  ws.callId = callId;
  ws.conversationHistory = callHistoryMap.get(callId) || [];
  ws.isFirstMessage = ws.conversationHistory.length === 0;
  activeConnections.set(callId, ws);
  
  // Send config
  ws.send(JSON.stringify({
    response_type: 'config',
    config: { auto_reconnect: true, call_details: true }
  }));
  
  // Send initial greeting if first message
  if (ws.isFirstMessage) {
    processWithLLM('Start the conversation with the greeting.', callId, ws.conversationHistory)
      .then((result) => {
        ws.conversationHistory = callHistoryMap.get(callId) || [];
        ws.isFirstMessage = false;
        ws.send(JSON.stringify({
          response_type: 'response',
          response_id: 0,
          content: result.text,
          content_complete: true
        }));
      });
  }
  
  // Handle messages
  ws.on('message', async (data: string) => {
    const message: RetellMessage = JSON.parse(data);
    
    switch (message.interaction_type) {
      case 'ping_pong':
        // Respond to keep connection alive
        ws.send(JSON.stringify({
          response_type: 'ping_pong',
          timestamp: message.timestamp
        }));
        break;
        
      case 'response_required':
      case 'reminder_required':
        // Process user message
        const responseId = message.response_id!;
        const userMessage = getLastUserMessage(message.transcript);
        
        // Send immediate status update
        sendAgentInterrupt(ws, 'Let me look that up for you.', callId);
        
        // Process with LLM
        const aiResponse = await processWithLLM(
          userMessage,
          callId,
          ws.conversationHistory || []
        );
        
        // Sync history
        ws.conversationHistory = callHistoryMap.get(callId) || [];
        
        // Send final response
        ws.send(JSON.stringify({
          response_type: 'response',
          response_id: responseId,
          content: aiResponse.text,
          content_complete: true
        }));
        break;
        
      case 'update_only':
        // Just transcript updates, no action needed
        break;
        
      case 'call_details':
        // Call metadata
        break;
    }
  });
});

// 4. HTTP endpoint for text input
app.post('/api/send-text', express.json(), (req, res) => {
  const { call_id, text } = req.body;
  const ws = activeConnections.get(call_id);
  
  // Send status
  sendAgentInterrupt(ws, 'Let me look that up for you.', call_id);
  
  // Process
  processWithLLM(text, call_id, ws.conversationHistory || [])
    .then((aiResponse) => {
      // Use agent_interrupt for text input (no response_id)
      ws.send(JSON.stringify({
        response_type: 'agent_interrupt',
        content: aiResponse.text,
        content_complete: true
      }));
      res.json({ success: true });
    });
});
```

#### Helper Functions

```typescript
function getLastUserMessage(transcript?: Array<{ role: string; content: string }>): string {
  if (!transcript || transcript.length === 0) return '';
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i].role === 'user') {
      return transcript[i].content;
    }
  }
  return '';
}

function sendAgentInterrupt(ws: RetellWebSocket, message: string, callId: string): boolean {
  if (ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify({
      response_type: 'agent_interrupt',
      content: message,
      content_complete: true
    }));
    return true;
  } catch (error) {
    console.error(`[Retell WS] Error sending agent_interrupt:`, error);
    return false;
  }
}

async function processWithLLM(
  userMessage: string,
  callId: string,
  conversationHistory: any[]
): Promise<{ text: string; shouldEndCall: boolean }> {
  // Create working copy (will be modified by callGreetingAgent)
  const workingHistory = [...conversationHistory];
  
  // Add user message
  workingHistory.push({
    type: 'message',
    role: 'user',
    content: userMessage,
  });
  
  // Check if first message (CRITICAL: use conversationHistory, not workingHistory)
  const isFirstMessage = conversationHistory.length === 0;
  
  // Call your existing LLM
  const response = await callGreetingAgent(
    userMessage,
    workingHistory, // Modified in place with function calls
    isFirstMessage,
    undefined // No audio callback needed (Retell handles audio)
  );
  
  // Add assistant response
  workingHistory.push({
    type: 'message',
    role: 'assistant',
    content: response,
  });
  
  // Store full history (including function calls)
  callHistoryMap.set(callId, workingHistory);
  
  return {
    text: response,
    shouldEndCall: false,
  };
}
```

### 2. Frontend Hook

**File**: `src/app/hooks/useRetellSession.ts`

This React hook manages the Retell Web SDK client and provides a clean API for the UI.

#### Key Features

1. **Dynamic SDK Loading**: Loads `retell-client-js-sdk` only on client-side
2. **Version Compatibility**: Handles both SDK v1.x and v2.x APIs
3. **Transcript Management**: Handles streaming updates and deduplication
4. **Text Input Support**: Sends text messages via API proxy

#### Complete Hook Structure

```typescript
export function useRetellSession(callbacks: RetellSessionCallbacks = {}) {
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const clientRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(null);
  
  // Track transcript message IDs to prevent duplicates
  const addedTranscriptIds = useRef<Set<string>>(new Set());
  const lastAgentMessageIdRef = useRef<string | null>(null);
  const lastUserMessageIdRef = useRef<string | null>(null);
  
  const connect = useCallback(async () => {
    // 1. Load SDK
    await loadRetellSDK();
    
    // 2. Create web call (get access token)
    const response = await fetch('/api/retell/create-web-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { user_id: 'web_user' } })
    });
    
    const { access_token, call_id } = await response.json();
    callIdRef.current = call_id;
    
    // 3. Create client
    const client = new RetellWebClient();
    clientRef.current = client;
    
    // 4. Setup event listeners
    setupEventListeners(client);
    
    // 5. Start call (handle v1/v2 API differences)
    if (typeof client.startCall === 'function') {
      // v2.x
      await client.startCall({
        accessToken: access_token,
        sampleRate: 24000,
        enableUpdate: true,
      });
    } else {
      // v1.x
      await client.startConversation({
        callId: call_id,
        sampleRate: 24000,
        enableUpdate: true,
      });
    }
    
    updateStatus('CONNECTED');
  }, []);
  
  const disconnect = useCallback(() => {
    clientRef.current?.stopCall();
    clientRef.current = null;
    callIdRef.current = null;
    updateStatus('DISCONNECTED');
  }, []);
  
  const sendUserText = useCallback(async (text: string) => {
    if (!callIdRef.current) return;
    
    // Add to transcript immediately
    const userMessageId = `user-${Date.now()}`;
    addTranscriptMessage(userMessageId, "user", text, false);
    lastUserMessageIdRef.current = userMessageId;
    
    // Send to WebSocket server via API proxy
    await fetch('/api/retell/send-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call_id: callIdRef.current,
        text: text
      })
    });
  }, []);
  
  return {
    status,
    connect,
    disconnect,
    sendUserText,
    conversationHistory,
  };
}
```

#### Event Listeners Setup

```typescript
function setupEventListeners(client: any) {
  // SDK v2 events
  client.on('call_started', () => {
    setIsRecording(true);
  });
  
  client.on('call_ended', () => {
    setIsRecording(false);
    updateStatus('DISCONNECTED');
  });
  
  client.on('agent_start_talking', () => {
    // Reset last agent message ID (new response starting)
    lastAgentMessageIdRef.current = null;
  });
  
  client.on('update', (update: any) => {
    // Handle transcript updates
    const transcriptArray = update.transcript_array || update.messages || [];
    
    transcriptArray.forEach((msg: any) => {
      const role = msg.role === 'agent' ? 'assistant' : msg.role;
      const content = msg.content || msg.text || '';
      
      // Update existing message if streaming, or create new
      if (role === 'assistant' && lastAgentMessageIdRef.current) {
        updateTranscriptMessage(lastAgentMessageIdRef.current, content, false);
      } else if (role === 'user' && lastUserMessageIdRef.current) {
        updateTranscriptMessage(lastUserMessageIdRef.current, content, false);
      } else {
        // Create new message
        const msgId = msg.id || `${role}-${Date.now()}`;
        if (!addedTranscriptIds.current.has(msgId)) {
          addTranscriptMessage(msgId, role, content, false);
          addedTranscriptIds.current.add(msgId);
          if (role === 'assistant') {
            lastAgentMessageIdRef.current = msgId;
          } else if (role === 'user') {
            lastUserMessageIdRef.current = msgId;
          }
        }
      }
    });
  });
}
```

### 3. Next.js API Routes

#### Create Web Call Route

**File**: `src/app/api/retell/create-web-call/route.ts`

Creates a Retell web call and returns access token + call_id.

```typescript
export async function POST(req: NextRequest) {
  const agentId = process.env.RETELL_AGENT_ID;
  const apiKey = process.env.RETELL_API_KEY;
  
  if (!agentId || !apiKey) {
    return NextResponse.json(
      { error: 'RETELL_AGENT_ID and RETELL_API_KEY must be set' },
      { status: 400 }
    );
  }
  
  // Use REST API directly (SDK's createWebCall is WebSocket-based)
  const response = await fetch('https://api.retellai.com/v2/create-web-call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      agent_id: agentId,
      metadata: metadata || {},
    })
  });
  
  const webCallResponse = await response.json();
  
  return NextResponse.json({
    access_token: webCallResponse.access_token,
    call_id: webCallResponse.call_id
  });
}
```

#### Webhook Route

**File**: `src/app/api/retell/webhook/route.ts`

Handles call lifecycle events from Retell.

```typescript
export async function POST(req: NextRequest) {
  // Verify signature
  const signature = req.headers.get('x-retell-signature');
  const bodyText = await req.text();
  
  const client = await getRetellClient();
  const isValid = client.verify?.(bodyText, process.env.RETELL_API_KEY!, signature) ?? true;
  
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const body = JSON.parse(bodyText);
  const { event, call } = body;
  
  switch (event) {
    case 'call_started':
      // Store call start, initialize session
      break;
      
    case 'call_ended':
      // Store transcript, analyze call
      // call.transcript, call.transcript_object, call.transcript_with_tool_calls
      break;
      
    case 'call_analyzed':
      // Most comprehensive event - use for final processing
      break;
  }
  
  // Always respond within 10 seconds
  return NextResponse.json({ success: true });
}
```

#### Send Text Proxy Route

**File**: `src/app/api/retell/send-text/route.ts`

Proxies text messages from frontend to WebSocket server.

```typescript
export async function POST(req: NextRequest) {
  const { call_id, text } = await req.json();
  
  const websocketServerUrl = process.env.WEBSOCKET_SERVER_URL || 'http://localhost:8080';
  
  const response = await fetch(`${websocketServerUrl}/api/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id, text })
  });
  
  return NextResponse.json(await response.json());
}
```

### 4. Server Setup

**File**: `src/retell/server.ts`

Standalone Express server for WebSocket handler.

```typescript
import dotenv from 'dotenv';
import websocketHandler from './websocket-handler';
import { setupHealthCheck } from './health';

dotenv.config();

const PORT = process.env.RETELL_WEBSOCKET_PORT || 8080;
const app = websocketHandler;

setupHealthCheck(app);

app.listen(PORT, () => {
  console.log(`[Retell WebSocket Server] Running on port ${PORT}`);
  console.log(`[Retell WebSocket Server] WebSocket endpoint: ws://localhost:${PORT}/llm-websocket/:call_id`);
});
```

**File**: `src/retell/health.ts`

Simple health check endpoint.

```typescript
export function setupHealthCheck(app: express.Application) {
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'retell-websocket',
      timestamp: new Date().toISOString()
    });
  });
}
```

---

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install retell-client-js-sdk@^2.0.7 retell-sdk@^1.0.0 express@^4.21.1 express-ws@^5.0.2 ws@^8.18.0
npm install --save-dev @types/express @types/ws tsx@^4.19.2
```

### 2. Environment Variables

Create `.env` file:

```bash
# Retell Configuration
RETELL_API_KEY=your_retell_api_key_here
RETELL_AGENT_ID=your_agent_id_here

# Server Configuration
RETELL_WEBSOCKET_PORT=8080
NEXTJS_BASE_URL=http://localhost:3000
WEBSOCKET_SERVER_URL=http://localhost:8080

# For production
# WEBSOCKET_SERVER_URL=https://your-websocket-server.fly.dev
```

### 3. Retell Dashboard Configuration

1. Go to [Retell Dashboard](https://dashboard.retellai.com)
2. Navigate to your agent settings
3. Set **Custom LLM WebSocket URL**:
   - Local: `wss://your-ngrok-url.ngrok-free.app/llm-websocket`
   - Production: `wss://your-websocket-server.fly.dev/llm-websocket`
   - **Important**: Use `wss://` (secure WebSocket), not `ws://`
4. Set **Agent Level Webhook URL**:
   - Local: `https://your-ngrok-url.ngrok-free.app/api/retell/webhook`
   - Production: `https://your-app.fly.dev/api/retell/webhook`
5. Configure voice settings (language, voice provider, etc.)

### 4. Local Development Setup

#### Option A: Using ngrok (Recommended)

See [NGROK_SETUP.md](./NGROK_SETUP.md) for detailed instructions.

**Quick Start:**
```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start WebSocket server
npm run dev:websocket

# Terminal 3: Start ngrok tunnels
ngrok start --all  # If using ngrok.yml config
# Or separately:
ngrok http 3000  # Next.js
ngrok http 8080  # WebSocket server
```

#### Option B: Using Cloudflare Tunnel

See [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md) for detailed instructions.

**Quick Start:**
```bash
npm run tunnel  # Runs both tunnels
```

### 5. Production Deployment

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for detailed Fly.io deployment.

**Quick Summary:**
- Deploy WebSocket server as separate Fly.io app
- Configure Retell dashboard with production URLs
- Set Fly.io secrets: `RETELL_API_KEY`, `RETELL_AGENT_ID`

---

## Integration with Existing LLM

The Retell integration uses your existing `callGreetingAgent` function. No changes needed to your LLM logic!

```typescript
// In websocket-handler.ts
const response = await callGreetingAgent(
  userMessage,
  workingHistory, // Pass conversation history
  isFirstMessage, // First message flag
  undefined // No audio callback (Retell handles audio)
);
```

The `callGreetingAgent` function:
- Receives user message and conversation history
- Calls orchestrator if needed
- Returns text response
- Modifies `workingHistory` in place with function calls

**Important**: The conversation history passed to `callGreetingAgent` is modified in place. After calling it, the history includes:
- Original messages
- User message
- Function calls (from orchestrator)
- Function call outputs (from orchestrator)
- Assistant response

This full history is then stored in `callHistoryMap` for the next turn.

---

## Troubleshooting

### Common Issues

**1. WebSocket won't connect**
- Check ngrok/Cloudflare tunnel is running
- Verify WebSocket URL format in Retell dashboard (`wss://`, not `ws://`)
- Check server logs for connection errors
- Ensure port 8080 is accessible

**2. Agent repeats greeting**
- Check `isFirstMessage` logic: should use `conversationHistory.length === 0`
- Verify `ws.conversationHistory` is synced after initial greeting
- Check that `callHistoryMap` is being updated

**3. Status messages not spoken**
- Verify `agent_interrupt` format: `{ response_type: 'agent_interrupt', content: "...", content_complete: true }`
- Check WebSocket is still open when sending
- Ensure message is sent synchronously (not awaited)

**4. Text input doesn't work**
- Verify using `agent_interrupt` for text input (not `response`)
- Check `/api/retell/send-text` is proxying correctly
- Verify WebSocket connection exists in `activeConnections` map

**5. Conversation history not persisting**
- Check `callHistoryMap.set(callId, workingHistory)` is called after processing
- Verify `ws.conversationHistory` is synced: `ws.conversationHistory = callHistoryMap.get(callId) || []`
- Ensure function calls are included in history

**6. PatNum missing from CreateAppointment**
- Verify function_call + function_call_output pairs are included in orchestrator input
- Check `pendingFunctionCalls` Map is correctly pairing calls with outputs
- Ensure `GetMultiplePatients` result is in conversation history

**7. High latency**
- Check LLM processing time
- Optimize database queries
- Consider caching frequently accessed data
- Check network latency to Retell servers

### Debugging Tips

**Enable verbose logging:**
```typescript
// In websocket-handler.ts
console.log(`[Retell WS] Processing message:`, message);
console.log(`[Retell WS] Conversation history length:`, conversationHistory.length);
console.log(`[Retell WS] isFirstMessage:`, isFirstMessage);
```

**Check WebSocket state:**
```typescript
console.log(`[Retell WS] WebSocket state:`, ws.readyState); // 1 = OPEN
```

**Monitor conversation history:**
```typescript
console.log(`[Retell WS] Full history:`, JSON.stringify(callHistoryMap.get(callId), null, 2));
```

---

## Replication Checklist

### File Structure

```
your-project/
├── src/
│   ├── retell/
│   │   ├── websocket-handler.ts    # Core WebSocket handler
│   │   ├── server.ts                # Standalone server
│   │   └── health.ts                # Health check
│   ├── app/
│   │   ├── hooks/
│   │   │   └── useRetellSession.ts  # Frontend hook
│   │   └── api/
│   │       └── retell/
│   │           ├── create-web-call/
│   │           │   └── route.ts     # Create web call
│   │           ├── webhook/
│   │           │   └── route.ts     # Webhook handler
│   │           └── send-text/
│   │               └── route.ts     # Text input proxy
└── package.json
```

### Required Dependencies

```json
{
  "dependencies": {
    "retell-client-js-sdk": "^2.0.7",
    "retell-sdk": "^1.0.0",
    "express": "^4.21.1",
    "express-ws": "^5.0.2",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/ws": "^8.5.10",
    "tsx": "^4.19.2"
  }
}
```

### Environment Variables

```bash
RETELL_API_KEY=your_key
RETELL_AGENT_ID=your_agent_id
RETELL_WEBSOCKET_PORT=8080
WEBSOCKET_SERVER_URL=http://localhost:8080
NEXTJS_BASE_URL=http://localhost:3000
```

### Configuration Steps

1. ✅ Install dependencies
2. ✅ Set environment variables
3. ✅ Create WebSocket handler (`websocket-handler.ts`)
4. ✅ Create server file (`server.ts`)
5. ✅ Create frontend hook (`useRetellSession.ts`)
6. ✅ Create API routes (create-web-call, webhook, send-text)
7. ✅ Configure Retell dashboard (WebSocket URL, Webhook URL)
8. ✅ Set up local tunneling (ngrok/Cloudflare)
9. ✅ Test connection
10. ✅ Test voice input
11. ✅ Test text input
12. ✅ Test conversation history persistence
13. ✅ Deploy to production

### Testing Checklist

- [ ] WebSocket connects successfully
- [ ] Initial greeting plays
- [ ] Voice input is transcribed correctly
- [ ] LLM responses are sent back
- [ ] Agent speech plays smoothly
- [ ] Text input works
- [ ] Status updates are spoken separately
- [ ] Conversation history persists across turns
- [ ] Function calls are included in history
- [ ] PatNum extraction works (if applicable)
- [ ] Call ends properly
- [ ] Webhooks receive all events
- [ ] Webhook signatures verify correctly
- [ ] Error handling works
- [ ] Reconnection works (if connection drops)

---

## Key Takeaways

1. **Conversation History**: Must be synced between `callHistoryMap` and `ws.conversationHistory` after each LLM call
2. **isFirstMessage**: Check `conversationHistory.length === 0`, not `workingHistory.length === 1`
3. **Function Call Pairs**: Include `function_call` + `function_call_output` pairs in orchestrator input
4. **Status Updates**: Use `agent_interrupt` for separate messages, not streaming responses
5. **Text Input**: Use `agent_interrupt` (no `response_id`), voice input uses `response` (with `response_id`)
6. **Ping/Pong**: Always respond to keep connection alive during long processing
7. **History Modification**: `callGreetingAgent` modifies history in place - use this modified history

---

## References

- [Retell LLM WebSocket Protocol](https://docs.retellai.com/api-references/llm-websocket)
- [Retell Web Call Integration](https://docs.retellai.com/make-calls/web-call)
- [Retell Webhook Overview](https://docs.retellai.com/features/webhook-overview)
- [NGROK_SETUP.md](./NGROK_SETUP.md) - Local development tunneling
- [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md) - Alternative tunneling
- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Production deployment guide

---

**Last Updated**: January 2025  
**Status**: ✅ Production Ready


