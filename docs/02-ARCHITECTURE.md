# System Architecture

## Three-Layer Architecture

The application follows a clean three-layer architecture:

```
┌────────────────────────────────────────────────────────────────┐
│  Layer 1: Frontend (Next.js Client)                            │
│  - React components & UI state management                      │
│  - WebRTC connection management                                │
│  - Event processing and display                                │
└────────────┬───────────────────────────────────────────────────┘
             │
             │ HTTP (ephemeral keys)
             │ WebRTC (audio + events)
             │
┌────────────▼───────────────────────────────────────────────────┐
│  Layer 2: Next.js API Routes (Server-side)                     │
│  - /api/session: Generates ephemeral keys                      │
│  - /api/responses: Proxies to OpenAI Responses API             │
└────────────┬───────────────────────────────────────────────────┘
             │
             │ HTTPS to OpenAI
             │
┌────────────▼───────────────────────────────────────────────────┐
│  Layer 3: OpenAI Services                                      │
│  - Realtime API (voice agents, WebRTC)                         │
│  - Responses API (supervisor model)                            │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow: Complete User Interaction

### 1. Initial Connection Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant API as /api/session
    participant OpenAI as OpenAI Realtime API
    
    User->>App: Opens browser
    App->>API: GET /api/session
    API->>OpenAI: POST /v1/realtime/sessions
    OpenAI->>API: Returns ephemeral key
    API->>App: Returns key
    App->>App: Creates RealtimeSession with SDK
    App->>OpenAI: WebRTC connection (SDP offer)
    OpenAI->>App: WebRTC answer
    App->>App: Audio stream established
    App->>OpenAI: Send "hi" message
    OpenAI->>App: Agent greets user (audio)
```

**Key Files:**
- `App.tsx` (`connectToRealtime` function)
- `api/session/route.ts`
- `hooks/useRealtimeSession.ts` (`connect` function)

### 2. Message Flow (User Speaks)

```mermaid
sequenceDiagram
    participant User
    participant WebRTC
    participant Realtime as Realtime API
    participant SDK as Agents SDK
    participant UI as Transcript UI
    
    User->>WebRTC: Speaks into microphone
    WebRTC->>Realtime: Audio stream (PCM16)
    Realtime->>Realtime: Voice Activity Detection
    Realtime->>Realtime: Transcribe with Whisper
    Realtime->>SDK: conversation.item.input_audio_transcription.completed
    SDK->>UI: Event triggers handleTranscriptionCompleted
    UI->>UI: Display "[Transcribing...]" → final text
    Realtime->>SDK: Agent processes message
    SDK->>UI: Response audio streams back
```

**Key Files:**
- `hooks/useHandleSessionHistory.ts` (`handleTranscriptionCompleted`)
- `contexts/TranscriptContext.tsx` (`addTranscriptMessage`)

### 3. Tool Call Flow

```mermaid
sequenceDiagram
    participant Agent
    participant SDK as Agents SDK
    participant Tool
    participant History as useHandleSessionHistory
    participant UI as Transcript
    
    Agent->>Agent: Decides to call tool
    Agent->>SDK: Initiates function call
    SDK->>History: Emits 'agent_tool_start' event
    History->>UI: Adds breadcrumb: "function call: toolName"
    SDK->>Tool: Calls tool.execute(args, details)
    Tool->>Tool: Executes logic (sync or async)
    Tool->>SDK: Returns result
    SDK->>History: Emits 'agent_tool_end' event
    History->>UI: Adds breadcrumb: "function call result: toolName"
    SDK->>Agent: Provides result
    Agent->>Agent: Continues with response
```

**Key Files:**
- `agentConfigs/customerServiceRetail/authentication.ts` (tool definitions)
- `hooks/useHandleSessionHistory.ts` (`handleAgentToolStart`, `handleAgentToolEnd`)

### 4. Agent Handoff Flow

```mermaid
sequenceDiagram
    participant User
    participant CurrentAgent
    participant SDK as Agents SDK
    participant App
    participant NewAgent
    
    User->>CurrentAgent: "I want to return my board"
    CurrentAgent->>CurrentAgent: Analyzes intent
    CurrentAgent->>SDK: Calls transfer_to_returns
    SDK->>SDK: Emits 'agent_handoff' event
    SDK->>App: onAgentHandoff("returns")
    App->>App: setSelectedAgentName("returns")
    App->>App: Disconnects & reconnects with new root
    SDK->>NewAgent: Session updated with new instructions
    NewAgent->>User: "Hi, I'm handling returns today..."
```

**Key Files:**
- `App.tsx` (`handleSelectedAgentChange`, `onAgentHandoff` callback)
- `hooks/useRealtimeSession.ts` (`handleAgentHandoff`)
- `agentConfigs/customerServiceRetail/index.ts` (handoff configuration)

### 5. Chat-Supervisor Pattern Flow

```mermaid
sequenceDiagram
    participant User
    participant ChatAgent
    participant Tool as getNextResponseFromSupervisor
    participant API as /api/responses
    participant Supervisor as GPT-4.1
    
    User->>ChatAgent: "What's on my bill?"
    ChatAgent->>User: "Let me check" (filler phrase)
    ChatAgent->>Tool: getNextResponseFromSupervisor(context)
    Tool->>Tool: Extracts conversation history
    Tool->>API: POST with history + supervisor instructions
    API->>Supervisor: Forwards to OpenAI Responses API
    Supervisor->>Supervisor: Analyzes conversation
    Supervisor->>Supervisor: Calls getUserAccountInfo tool
    Supervisor->>Supervisor: Formulates response
    Supervisor->>API: Returns final text
    API->>Tool: Returns response
    Tool->>ChatAgent: Returns { nextResponse: "..." }
    ChatAgent->>User: Reads supervisor's response verbatim
```

**Key Files:**
- `agentConfigs/chatSupervisor/index.ts` (chat agent definition)
- `agentConfigs/chatSupervisor/supervisorAgent.ts` (`getNextResponseFromSupervisor` tool)
- `api/responses/route.ts` (API proxy)

### 6. Guardrail Flow

```mermaid
sequenceDiagram
    participant Agent
    participant SDK
    participant Guardrail
    participant Classifier as GPT-4o-mini
    participant UI
    
    Agent->>Agent: Generates response text
    SDK->>Guardrail: Intercepts before TTS
    Guardrail->>Classifier: Classify text (moderation)
    Classifier->>Guardrail: Returns category + rationale
    alt Violation Detected
        Guardrail->>SDK: { tripwireTriggered: true }
        SDK->>SDK: Emits 'guardrail_tripped' event
        SDK->>Agent: Sends correction message
        Agent->>Agent: Rephrases response
        UI->>UI: Shows red warning badge
    else No Violation
        Guardrail->>SDK: { tripwireTriggered: false }
        SDK->>SDK: Proceeds with TTS
        UI->>UI: Shows green checkmark
    end
```

**Key Files:**
- `agentConfigs/guardrails.ts` (`createModerationGuardrail`)
- `App.tsx` (guardrail setup in `connectToRealtime`)
- `hooks/useHandleSessionHistory.ts` (`handleGuardrailTripped`)

## WebRTC Connection Details

### Audio Stream Setup

```typescript
// 1. Create audio element for playback
const audioElement = document.createElement('audio');
audioElement.autoplay = true;

// 2. Create RealtimeSession with WebRTC transport
const session = new RealtimeSession(rootAgent, {
  transport: new OpenAIRealtimeWebRTC({
    audioElement,
    changePeerConnection: async (pc) => {
      // Apply codec preferences (opus/pcmu/pcma)
      applyCodecPreferences(pc, selectedCodec);
      return pc;
    },
  }),
  config: {
    inputAudioFormat: 'pcm16',   // or g711_ulaw/g711_alaw
    outputAudioFormat: 'pcm16',
    inputAudioTranscription: {
      model: 'gpt-4o-mini-transcribe',
      language: 'en', // Explicitly set to English to prevent language mixing
    },
  },
});

// 3. Connect with ephemeral key
await session.connect({ apiKey: ephemeralKey });
```

### Audio Formats

| Codec | Sample Rate | Use Case |
|-------|-------------|----------|
| **opus** (pcm16) | 48 kHz | High quality, default |
| **pcmu** (g711_ulaw) | 8 kHz | Phone line simulation |
| **pcma** (g711_alaw) | 8 kHz | Phone line simulation |

### Push-to-Talk (PTT) vs Voice Activity Detection (VAD)

**VAD Mode (Default):**
```typescript
session.transport.sendEvent({
  type: 'session.update',
  session: {
    turn_detection: {
      type: 'server_vad',
      threshold: 0.92, // Higher threshold to prevent echo/feedback
      prefix_padding_ms: 300,
      silence_duration_ms: 1200, // Longer silence to prevent picking up agent's voice
      create_response: true,
    },
  },
});
```

**PTT Mode:**
```typescript
// Disable VAD
session.transport.sendEvent({
  type: 'session.update',
  session: { turn_detection: null },
});

// When button pressed
session.transport.sendEvent({ type: 'input_audio_buffer.clear' });

// When button released
session.transport.sendEvent({ type: 'input_audio_buffer.commit' });
session.transport.sendEvent({ type: 'response.create' });
```

## State Management

### Context Providers

**TranscriptContext:**
- Manages conversation history (messages + breadcrumbs)
- Methods: `addTranscriptMessage`, `updateTranscriptMessage`, `addTranscriptBreadcrumb`
- Used by: All components displaying conversation

**EventContext:**
- Manages event log for debugging
- Methods: `logClientEvent`, `logServerEvent`
- Used by: Events component, debugging

### Local Storage Persistence

```typescript
// Persisted settings
localStorage.setItem('pushToTalkUI', isPTTActive.toString());
localStorage.setItem('audioPlaybackEnabled', isAudioPlaybackEnabled.toString());
localStorage.setItem('logsExpanded', isEventsPaneExpanded.toString());
```

## Next Steps

- [Components Guide](./03-COMPONENTS.md) - Detailed component documentation
- [Extending Guide](./04-EXTENDING.md) - How to add features
- [Best Practices](./05-BEST-PRACTICES.md) - Tips and troubleshooting

