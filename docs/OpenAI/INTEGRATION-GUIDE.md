# OpenAI Realtime API Integration Guide

## Overview

This guide provides a complete technical deep-dive into the OpenAI Realtime API integration, enabling you to replicate this implementation in new projects. The OpenAI Realtime API provides bidirectional audio streaming, real-time transcription, and agent-based conversation management.

**Key Benefits:**
- Ultra-low latency (<500ms typically)
- Automatic conversation history management via SDK
- Built-in transcription (input and output)
- Agent handoff support
- Guardrails and moderation
- WebRTC-based audio streaming

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  useRealtimeSession Hook                                   │   │
│  │  - Manages RealtimeSession instance                        │   │
│  │  - Handles WebRTC connection                                │   │
│  │  - Provides connect/disconnect/sendUserText APIs           │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 │                                                 │
│                 │ OpenAI Realtime SDK                             │
└─────────────────┼─────────────────────────────────────────────────┘
                  │
                  │ WebRTC Connection (SDP Offer/Answer)
                  │
┌─────────────────▼─────────────────────────────────────────────────┐
│              OpenAI Realtime API (Cloud)                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Voice Agent     │  │  Agent Manager  │  │  Transcription  │  │
│  │  (gpt-4o-rt)     │  │  (Handoffs)     │  │  (Whisper)      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────┬─────────────────────────────────────────────────┘
                  │
                  │ Tool Calls / Function Execution
                  │
┌─────────────────▼─────────────────────────────────────────────────┐
│              Next.js API Routes                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  /api/session (GET) - Create session, get ephemeral key      │  │
│  │  /api/responses (POST) - OpenAI Responses API proxy          │  │
│  │  /api/opendental (POST) - Business logic API                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────┬─────────────────────────────────────────────────┘
                  │
                  │ Function Execution
                  │
┌─────────────────▼─────────────────────────────────────────────────┐
│                    Your Business Logic                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Agent System (Two-Tier)                                      │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │  │
│  │  │  Greeting Agent  │─▶│  Orchestrator    │                  │  │
│  │  │  (Lexi)          │  │  (Supervisor)    │                  │  │
│  │  │  - Simple Q&A    │  │  - Complex ops   │                  │  │
│  │  │  - Routes to     │  │  - API calls     │                  │  │
│  │  │    orchestrator  │  │  - Multi-step    │                  │  │
│  │  └──────────────────┘  └──────────────────┘                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Voice Input Flow:**
1. User speaks → Browser captures audio via WebRTC
2. Audio streamed to OpenAI Realtime API
3. OpenAI transcribes speech → `input_audio_transcription.completed` event
4. SDK triggers `handleTranscriptionCompleted` → UI shows transcript
5. Agent processes message → May call tools
6. Agent response streamed back as audio
7. SDK triggers `response.audio_transcript.delta` → UI shows streaming response
8. User hears response via WebRTC audio stream

**Tool Call Flow:**
1. Agent decides to call tool → `agent_tool_start` event
2. Tool executed (e.g., `getNextResponseFromSupervisor`)
3. Tool result returned → `agent_tool_end` event
4. Agent continues with tool result in context
5. Final response streamed back

---

## Complete Implementation Details

### 1. Frontend Hook

**File**: `src/app/hooks/useRealtimeSession.ts`

This React hook manages the OpenAI Realtime Session and provides a clean API for the UI.

#### Key Features

1. **Session Management**: Creates and manages `RealtimeSession` instance
2. **Event Handling**: Listens to SDK events (history, transcription, tools, etc.)
3. **WebRTC Transport**: Handles audio streaming via WebRTC
4. **Codec Configuration**: Supports codec selection for audio quality

#### Complete Hook Structure

```typescript
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  
  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
    }: ConnectOptions) => {
      if (sessionRef.current) return; // Already connected
      
      updateStatus('CONNECTING');
      
      // 1. Get ephemeral key from backend
      const ek = await getEphemeralKey();
      const rootAgent = initialAgents[0];
      
      // 2. Configure audio format (codec selection)
      const codecParam = codecParamRef.current;
      const audioFormat = audioFormatForCodec(codecParam);
      
      // 3. Create RealtimeSession
      sessionRef.current = new RealtimeSession(rootAgent, {
        transport: new OpenAIRealtimeWebRTC({
          audioElement,
          changePeerConnection: async (pc: RTCPeerConnection) => {
            applyCodec(pc); // Apply codec preferences
            return pc;
          },
        }),
        model: 'gpt-4o-realtime-preview-2025-06-03',
        config: {
          inputAudioFormat: audioFormat,
          outputAudioFormat: audioFormat,
          inputAudioTranscription: {
            model: 'gpt-4o-mini-transcribe',
            language: 'en', // Explicitly set to English
          },
        },
        outputGuardrails: outputGuardrails ?? [],
        context: extraContext ?? {},
      });
      
      // 4. Setup event listeners
      setupEventListeners(sessionRef.current);
      
      // 5. Connect
      await sessionRef.current.connect({ apiKey: ek });
      updateStatus('CONNECTED');
    },
    [callbacks, updateStatus],
  );
  
  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('DISCONNECTED');
  }, [updateStatus]);
  
  const sendUserText = useCallback((text: string) => {
    if (!sessionRef.current) throw new Error('Not connected');
    sessionRef.current.sendMessage(text);
  }, []);
  
  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);
  
  return {
    status,
    connect,
    disconnect,
    sendUserText,
    interrupt,
    // ... other methods
  };
}
```

#### Event Listeners Setup

```typescript
function setupEventListeners(session: RealtimeSession) {
  // History events (automatic conversation management)
  session.on('history_updated', (items) => {
    // SDK automatically manages conversation history
    // This event fires when history changes
    historyHandlers.handleHistoryUpdated(items);
  });
  
  session.on('history_added', (item) => {
    // New item added to history
    historyHandlers.handleHistoryAdded(item);
  });
  
  // Tool execution events
  session.on('agent_tool_start', (details, agent, functionCall) => {
    historyHandlers.handleAgentToolStart(details, agent, functionCall);
  });
  
  session.on('agent_tool_end', (details, agent, functionCall, result) => {
    historyHandlers.handleAgentToolEnd(details, agent, functionCall, result);
  });
  
  // Transcription events
  session.on('transport_event', (event) => {
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed':
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      case 'conversation.item.input_audio_transcription.delta':
        historyHandlers.handleTranscriptionDelta(event);
        break;
      case 'response.audio_transcript.done':
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      case 'response.audio_transcript.delta':
        historyHandlers.handleTranscriptionDelta(event);
        break;
    }
  });
  
  // Agent handoff (if using multiple agents)
  session.on('agent_handoff', (item) => {
    const history = item.context.history;
    const lastMessage = history[history.length - 1];
    const agentName = lastMessage.name.split("transfer_to_")[1];
    callbacks.onAgentHandoff?.(agentName);
  });
  
  // Guardrails
  session.on('guardrail_tripped', (details, agent, guardrail) => {
    historyHandlers.handleGuardrailTripped(details, agent, guardrail);
  });
  
  // Errors
  session.on('error', (error) => {
    logServerEvent({ type: 'error', message: error });
  });
}
```

### 2. Session API Route

**File**: `src/app/api/session/route.ts`

Creates a Realtime session and returns an ephemeral key for secure connection.

```typescript
export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY environment variable is not set' },
      { status: 500 }
    );
  }
  
  // Clean API key (remove quotes/whitespace if present)
  const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, '');
  
  // Create Realtime session
  const response = await fetch(
    'https://api.openai.com/v1/realtime/sessions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2025-06-03',
      }),
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    return NextResponse.json(
      { error: 'Failed to create realtime session', details: errorData },
      { status: response.status }
    );
  }
  
  const data = await response.json();
  
  // Return ephemeral key (client_secret.value)
  return NextResponse.json(data);
}
```

**Key Points:**
- Ephemeral keys expire after use (one-time use)
- Each connection requires a new session
- Keys are short-lived for security
- Never expose full API key to client

### 3. Agent Configuration

**File**: `src/app/agentConfigs/openDental/index.ts`

Defines the Realtime Agent with tools and instructions.

#### Agent Definition

```typescript
import { RealtimeAgent, tool } from '@openai/agents/realtime';

export const dentalAgent = new RealtimeAgent({
  name: 'Lexi',
  voice: 'sage',
  
  instructions: `You are **Lexi**, a friendly dental receptionist for **Barton Dental**.

# MANDATORY First Message
When the call starts, you MUST say:
"Hi! Welcome to Barton Dental. This is Lexi. How can I help you today?"

Then immediately call \`get_datetime\` and \`get_office_context\` (silently - don't tell the caller).

# MANDATORY Before Every Lookup
Before calling \`getNextResponseFromSupervisor\`, you MUST say:
"One moment please, let me look that up for you."

# How to Handle Requests
For ANY patient operation (finding, booking, canceling, checking appointments, etc.):
1. Say: "One moment please, let me look that up for you"
2. Call \`getNextResponseFromSupervisor\` with the user's request
3. **IMPORTANT**: After the tool returns a response, you MUST speak it out loud to the caller exactly as it is.

# Office Information
${JSON.stringify(dentalOfficeInfo, null, 2)}

# Key Reminders
- No medical advice
- No past-date bookings
- Weekdays only
- If emergency/abusive/non-English: transfer call`,
  
  tools: [
    getCurrentDateTime,
    getCurrentOfficeContext,
    getNextResponseFromSupervisor,
  ],
});
```

#### Tool Definitions

**1. Get Current DateTime**

```typescript
const getCurrentDateTime = tool({
  name: 'get_datetime',
  description: 'Gets the current date and time in ISO format to ensure accurate appointment handling',
  parameters: z.object({}),
  execute: async () => {
    const now = new Date();
    return now.toISOString();
  },
});
```

**2. Get Office Context**

```typescript
const getCurrentOfficeContext = tool({
  name: 'get_office_context',
  description: 'Fetches current office data (providers, operatories, occupied appointment slots). Call this ONCE at the start of the conversation after get_datetime.',
  parameters: z.object({}),
  execute: async () => {
    const context = await fetchOfficeContext();
    return JSON.stringify(context, null, 2);
  },
});
```

**3. Get Next Response From Supervisor (Orchestrator)**

```typescript
const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description: 'Routes complex requests to the orchestrator supervisor agent which has access to 49 OpenDental API functions. Use this for: patient lookups, appointment booking/rescheduling/canceling, availability checks, and any multi-step operations.',
  parameters: z.object({
    relevantContextFromLastUserMessage: z.string().describe('The user\'s request or question that needs to be processed by the orchestrator'),
  }),
  execute: async ({ relevantContextFromLastUserMessage }) => {
    // Extract office context from conversation history
    const officeContext = extractOfficeContextFromHistory();
    
    // Call orchestrator
    const response = await executeOrchestrator(
      relevantContextFromLastUserMessage,
      [], // Conversation history managed automatically by SDK
      officeContext
    );
    
    return response;
  },
});
```

**Key Points:**
- Tools are defined using `tool()` helper from SDK
- Parameters use Zod schemas for validation
- `execute` function is async and returns the result
- Tool results are automatically added to conversation history by SDK

### 4. History Management

**File**: `src/app/hooks/useHandleSessionHistory.ts`

Handles SDK events and updates the UI transcript.

#### Key Functions

**1. Handle Transcription Completed**

```typescript
function handleTranscriptionCompleted(item: any) {
  const itemId = item.item_id;
  const finalTranscript = item.transcript || '[inaudible]';
  
  // Update transcript message with final text
  updateTranscriptMessage(itemId, finalTranscript, false);
  updateTranscriptItem(itemId, { status: 'DONE' });
}
```

**2. Handle Transcription Delta (Streaming)**

```typescript
function handleTranscriptionDelta(item: any) {
  const itemId = item.item_id;
  const deltaText = item.delta || '';
  
  // Append delta to existing message (streaming update)
  updateTranscriptMessage(itemId, deltaText, true);
}
```

**3. Handle History Updated**

```typescript
function handleHistoryUpdated(items: any[]) {
  items.forEach((item: any) => {
    if (item.type === 'message') {
      const text = extractMessageText(item.content);
      if (text) {
        updateTranscriptMessage(item.itemId, text, false);
      }
    }
  });
}
```

**4. Handle Tool Execution**

```typescript
function handleAgentToolStart(details: any, agent: any, functionCall: any) {
  const function_name = functionCall.name;
  const function_args = functionCall.arguments;
  
  // Add breadcrumb to transcript
  addTranscriptBreadcrumb(
    `function call: ${function_name}`,
    function_args
  );
}

function handleAgentToolEnd(details: any, agent: any, functionCall: any, result: any) {
  const function_name = functionCall.name;
  
  // Add result breadcrumb
  addTranscriptBreadcrumb(
    `function call result: ${function_name}`,
    maybeParseJson(result)
  );
}
```

**Key Points:**
- SDK automatically manages conversation history
- History includes: messages, tool calls, tool outputs
- UI updates are triggered by SDK events
- No manual history management needed (unlike Retell integration)

### 5. Transcript Context

**File**: `src/app/contexts/TranscriptContext.tsx`

Manages transcript display in the UI.

```typescript
export const TranscriptProvider: FC<PropsWithChildren> = ({ children }) => {
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  
  const addTranscriptMessage = (itemId: string, role: 'user' | 'assistant', text: string) => {
    setTranscriptItems((prev) => [
      ...prev,
      {
        itemId,
        type: 'MESSAGE',
        role,
        title: text,
        timestamp: newTimestampPretty(),
        status: 'IN_PROGRESS',
      },
    ]);
  };
  
  const updateTranscriptMessage = (itemId: string, newText: string, append: boolean) => {
    setTranscriptItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId && item.type === 'MESSAGE') {
          return {
            ...item,
            title: append ? (item.title ?? '') + newText : newText,
          };
        }
        return item;
      })
    );
  };
  
  // ... other methods
};
```

---

## Key Features Explained

### 1. Automatic Conversation History Management

**CRITICAL**: Unlike Retell integration, OpenAI Realtime SDK automatically manages conversation history.

**How it works:**
- SDK maintains full conversation history internally
- History includes: messages, tool calls, tool outputs
- History is passed to agent on each turn automatically
- No manual history tracking needed

**Benefits:**
- Simpler implementation
- No history sync issues
- Automatic context preservation
- Function call results automatically available

### 2. Two-Tier Agent System

**Greeting Agent (Lexi):**
- Handles simple interactions
- Provides greeting and context priming
- Routes complex requests to orchestrator

**Orchestrator (Supervisor):**
- Handles complex multi-step operations
- Has access to 49 OpenDental API functions
- Executes business logic
- Returns formatted responses

**Flow:**
```
User: "Book appointment for Sam Latif tomorrow at 2pm"
  ↓
Lexi (Greeting Agent): "One moment please, let me look that up for you"
  ↓
Lexi calls getNextResponseFromSupervisor tool
  ↓
Orchestrator processes:
  - GetMultiplePatients(LName="Latif", FName="Sam") → PatNum=22
  - GetAvailableSlots(...) → Available times
  - CreateAppointment(PatNum=22, ...) → Book appointment
  ↓
Orchestrator returns: "I've booked your appointment for tomorrow at 2pm with Dr. Smith"
  ↓
Lexi speaks response to user
```

### 3. Tool Calling and Execution

**How tools work:**
1. Agent decides to call tool based on user request
2. SDK triggers `agent_tool_start` event
3. Tool `execute` function is called
4. Tool result returned
5. SDK triggers `agent_tool_end` event
6. Tool result added to conversation history automatically
7. Agent continues with tool result in context

**Tool Result Format:**
- Return value from `execute` function
- Automatically serialized to string if needed
- Added to history as `function_call_output`
- Available to agent in next turn

### 4. WebRTC Audio Streaming

**How it works:**
1. Browser captures microphone audio
2. Audio encoded using selected codec (Opus, PCM, etc.)
3. Encoded audio streamed to OpenAI via WebRTC
4. OpenAI processes audio and streams response back
5. Response audio decoded and played through speakers

**Codec Configuration:**
```typescript
const audioFormat = audioFormatForCodec('opus'); // or 'pcm', 'g711_ulaw', etc.

sessionRef.current = new RealtimeSession(rootAgent, {
  config: {
    inputAudioFormat: audioFormat,
    outputAudioFormat: audioFormat,
  },
});
```

**Benefits:**
- Low latency (<500ms typically)
- High quality audio
- Real-time bidirectional streaming
- No buffering delays

### 5. Guardrails and Moderation

**Output Guardrails:**
- Prevent harmful or inappropriate responses
- Custom guardrail functions
- Triggers `guardrail_tripped` event if violated

**Implementation:**
```typescript
const guardrail = createModerationGuardrail(companyName);

sessionRef.current = new RealtimeSession(rootAgent, {
  outputGuardrails: [guardrail],
});
```

**Guardrail Function:**
```typescript
function createModerationGuardrail(companyName: string) {
  return {
    type: 'moderation',
    threshold: 0.5,
    // Custom logic to check response
  };
}
```

---

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install @openai/agents@^0.0.5 openai@^4.77.3
```

### 2. Environment Variables

Create `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Create Session API Route

Create `src/app/api/session/route.ts` (see implementation above).

### 4. Create Agent Configuration

Create `src/app/agentConfigs/openDental/index.ts` (see implementation above).

### 5. Create Frontend Hook

Create `src/app/hooks/useRealtimeSession.ts` (see implementation above).

### 6. Create History Handler

Create `src/app/hooks/useHandleSessionHistory.ts` (see implementation above).

### 7. Create Transcript Context

Create `src/app/contexts/TranscriptContext.tsx` (see implementation above).

### 8. Integrate in UI

```typescript
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';
import { openDentalScenario } from '@/app/agentConfigs/openDental';

function MyComponent() {
  const realtimeSession = useRealtimeSession({
    onConnectionChange: (status) => {
      console.log('Status:', status);
    },
  });
  
  const connect = async () => {
    const fetchEphemeralKey = async () => {
      const response = await fetch('/api/session');
      const data = await response.json();
      return data.client_secret.value;
    };
    
    await realtimeSession.connect({
      getEphemeralKey: fetchEphemeralKey,
      initialAgents: openDentalScenario,
      audioElement: audioElementRef.current,
      outputGuardrails: [guardrail],
    });
  };
  
  return (
    <button onClick={connect}>Connect</button>
  );
}
```

---

## Integration with Existing LLM

The OpenAI Realtime integration uses your existing orchestrator via the `getNextResponseFromSupervisor` tool.

**Key Difference from Retell:**
- **Retell**: Manual conversation history management, must include function_call pairs
- **OpenAI Realtime**: Automatic history management, SDK handles everything

**Orchestrator Integration:**

```typescript
const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  execute: async ({ relevantContextFromLastUserMessage }) => {
    // SDK automatically provides conversation history
    // No need to manually track or pass history
    const response = await executeOrchestrator(
      relevantContextFromLastUserMessage,
      [], // Empty array - SDK manages history automatically
      officeContext
    );
    
    return response;
  },
});
```

**Important**: The orchestrator still needs to extract function_call pairs from history, but the SDK ensures they're always present in the correct format.

---

## Troubleshooting

### Common Issues

**1. Connection fails**
- Check `OPENAI_API_KEY` is set correctly
- Verify API key has Realtime API access
- Check network connectivity
- Review browser console for WebRTC errors

**2. No audio**
- Check microphone permissions
- Verify audio element is created and attached
- Check browser audio settings
- Test with different codec

**3. Transcription not working**
- Verify `inputAudioTranscription` is configured
- Check language setting (should be 'en' for English)
- Review transcription events in console

**4. Tool calls not executing**
- Verify tool is defined correctly
- Check tool parameters match Zod schema
- Review tool execution events
- Check for errors in tool `execute` function

**5. Agent not responding**
- Check agent instructions are clear
- Verify tools are available
- Review agent handoff events (if using multiple agents)
- Check for guardrail violations

**6. High latency**
- Check network connection quality
- Try different codec (Opus is usually best)
- Review WebRTC connection stats
- Check OpenAI API status

### Debugging Tips

**Enable verbose logging:**
```typescript
session.on('history_updated', (items) => {
  console.log('[Realtime] History updated:', items);
});

session.on('agent_tool_start', (details, agent, functionCall) => {
  console.log('[Realtime] Tool start:', functionCall.name, functionCall.arguments);
});
```

**Check WebRTC stats:**
```typescript
const pc = session.transport.peerConnection;
const stats = await pc.getStats();
console.log('[Realtime] WebRTC stats:', stats);
```

**Monitor events:**
```typescript
session.on('transport_event', (event) => {
  console.log('[Realtime] Transport event:', event.type, event);
});
```

---

## Replication Checklist

### File Structure

```
your-project/
├── src/
│   ├── app/
│   │   ├── hooks/
│   │   │   ├── useRealtimeSession.ts      # Main hook
│   │   │   └── useHandleSessionHistory.ts # History handler
│   │   ├── api/
│   │   │   └── session/
│   │   │       └── route.ts               # Session creation
│   │   ├── agentConfigs/
│   │   │   └── openDental/
│   │   │       └── index.ts               # Agent definition
│   │   └── contexts/
│   │       └── TranscriptContext.tsx      # Transcript UI
└── package.json
```

### Required Dependencies

```json
{
  "dependencies": {
    "@openai/agents": "^0.0.5",
    "openai": "^4.77.3"
  }
}
```

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### Configuration Steps

1. ✅ Install dependencies
2. ✅ Set environment variables
3. ✅ Create session API route
4. ✅ Create agent configuration
5. ✅ Create frontend hook
6. ✅ Create history handler
7. ✅ Create transcript context
8. ✅ Integrate in UI
9. ✅ Test connection
10. ✅ Test voice input
11. ✅ Test tool calls
12. ✅ Test agent responses

### Testing Checklist

- [ ] Session creates successfully
- [ ] WebRTC connection established
- [ ] Audio input captured
- [ ] Transcription works
- [ ] Agent responds to voice
- [ ] Tool calls execute correctly
- [ ] Tool results available to agent
- [ ] Conversation history persists
- [ ] Agent handoff works (if applicable)
- [ ] Guardrails trigger correctly
- [ ] Error handling works
- [ ] Reconnection works (if connection drops)

---

## Key Takeaways

1. **Automatic History Management**: SDK handles conversation history automatically - no manual tracking needed
2. **Tool Integration**: Tools are defined with `tool()` helper and automatically integrated into agent
3. **Event-Driven**: UI updates via SDK events (history_updated, transcription, tool calls, etc.)
4. **WebRTC Streaming**: Low-latency bidirectional audio via WebRTC
5. **Two-Tier System**: Greeting agent routes to orchestrator for complex operations
6. **Ephemeral Keys**: Each session requires new ephemeral key for security

---

## Comparison: Retell vs OpenAI Realtime

| Feature | Retell | OpenAI Realtime |
|---------|--------|-----------------|
| **History Management** | Manual (must track and sync) | Automatic (SDK handles) |
| **Function Call Pairs** | Must manually include in orchestrator input | Automatically included by SDK |
| **Cost** | Lower (~$0.085-0.095/min) | Higher (real-time streaming) |
| **Latency** | ~800ms | <500ms typically |
| **Setup Complexity** | Higher (WebSocket server, tunneling) | Lower (just SDK integration) |
| **Text Input** | Requires `agent_interrupt` | Native support via `sendMessage` |
| **Status Updates** | Manual `agent_interrupt` | Built-in streaming |
| **Deployment** | Separate WebSocket server needed | Integrated with Next.js |

---

## References

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Agents SDK](https://github.com/openai/agents)
- [WebRTC Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)

---

**Last Updated**: January 2025  
**Status**: ✅ Production Ready


