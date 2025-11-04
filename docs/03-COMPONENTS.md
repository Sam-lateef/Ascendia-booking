# Components & File Structure

## Core Components

### App.tsx
**Purpose:** Main application orchestrator

**Responsibilities:**
- Manages WebRTC connection lifecycle
- Handles agent selection and scenario switching
- Coordinates between contexts and hooks
- Manages UI state (PTT, audio playback, connection status)

**Key Functions:**
```typescript
connectToRealtime()      // Establishes WebRTC connection
disconnectFromRealtime() // Closes connection
updateSession()          // Updates VAD/PTT settings
handleAgentChange()      // Switches scenarios
sendSimulatedUserMessage() // Sends text as if user spoke
```

**State:**
- `sessionStatus`: "DISCONNECTED" | "CONNECTING" | "CONNECTED"
- `selectedAgentName`: Current active agent
- `selectedAgentConfigSet`: Array of agents in scenario
- `isPTTActive`: Push-to-talk mode enabled
- `isAudioPlaybackEnabled`: Audio output enabled

### components/Transcript.tsx
**Purpose:** Displays conversation history with messages and breadcrumbs

**Features:**
- User and assistant messages with timestamps
- Expandable breadcrumbs for tool calls and agent changes
- Guardrail status indicators (green checkmark / red warning)
- Text input for sending messages
- Audio download button

**Message Types:**
```typescript
// Regular message
{
  type: "MESSAGE",
  role: "user" | "assistant",
  title: "message text",
  guardrailResult: { status, category, rationale }
}

// Breadcrumb (tool call, agent change, etc.)
{
  type: "BREADCRUMB",
  title: "function call: authenticate_user",
  data: { args, results },
  expanded: false
}
```

### components/Events.tsx
**Purpose:** Debug event log showing all client/server events

**Features:**
- Expandable event list with JSON payloads
- Client events (sent to API) vs Server events (received)
- Timestamps and event names
- Collapsible sidebar

**Event Types:**
- `conversation.item.create`
- `response.create`
- `agent_handoff`
- `agent_tool_start` / `agent_tool_end`
- `guardrail_tripped`
- Custom events

### components/BottomToolbar.tsx
**Purpose:** Control panel for connection, audio, and settings

**Controls:**
- **Connect/Disconnect** button
- **PTT toggle:** Switches between VAD and Push-to-Talk
- **Talk button:** Hold to speak (PTT mode only)
- **Audio playback toggle:** Mute/unmute agent responses
- **Codec selector:** opus/pcmu/pcma
- **Logs toggle:** Show/hide event panel

## Hooks

### hooks/useRealtimeSession.ts
**Purpose:** Core SDK integration and WebRTC management

**Exports:**
```typescript
{
  status: SessionStatus,           // Connection state
  connect: (options) => Promise<void>,  // Establish connection
  disconnect: () => void,          // Close connection
  sendUserText: (text: string) => void, // Send text message
  sendEvent: (event) => void,      // Send raw event
  mute: (muted: boolean) => void,  // Mute audio output
  interrupt: () => void,           // Interrupt agent speech
}
```

**Event Handling:**
```typescript
// Transport events (raw from Realtime API)
session.on("transport_event", handleTransportEvent);

// SDK events
session.on("agent_handoff", handleAgentHandoff);
session.on("agent_tool_start", handleAgentToolStart);
session.on("agent_tool_end", handleAgentToolEnd);
session.on("history_updated", handleHistoryUpdated);
session.on("guardrail_tripped", handleGuardrailTripped);
```

### hooks/useHandleSessionHistory.ts
**Purpose:** Processes SDK events into UI updates

**Event Handlers:**
- `handleHistoryAdded`: New message or item added to conversation
- `handleHistoryUpdated`: Existing item updated (e.g., transcription completed)
- `handleTranscriptionDelta`: Real-time transcription updates
- `handleTranscriptionCompleted`: Final transcription received
- `handleAgentToolStart`: Tool call initiated
- `handleAgentToolEnd`: Tool call completed
- `handleGuardrailTripped`: Moderation violation detected

**Helper Functions:**
```typescript
extractMessageText(content)       // Extracts text from message content
extractFunctionCallByName(name)   // Finds specific function call
maybeParseJson(val)              // Safely parses JSON strings
extractLastAssistantMessage()     // Gets most recent assistant message
```

### hooks/useAudioDownload.ts
**Purpose:** Records conversation audio for download

**Features:**
- Records remote audio stream using MediaRecorder API
- Saves as WebM audio file
- Triggered when session is connected
- Download button in Transcript component

## Contexts

### contexts/TranscriptContext.tsx
**Purpose:** Global state for conversation history

**State:**
```typescript
transcriptItems: TranscriptItem[] // Array of messages and breadcrumbs
```

**Methods:**
```typescript
addTranscriptMessage(itemId, role, text, isHidden)
  // Adds new user/assistant message

updateTranscriptMessage(itemId, text, isDelta)
  // Updates message text (delta or replace)

addTranscriptBreadcrumb(title, data)
  // Adds non-message item (tool call, agent change)

toggleTranscriptItemExpand(itemId)
  // Expands/collapses breadcrumb details

updateTranscriptItem(itemId, properties)
  // Updates any properties of an item
```

### contexts/EventContext.tsx
**Purpose:** Global state for event logging

**State:**
```typescript
loggedEvents: LoggedEvent[] // Array of all client/server events
```

**Methods:**
```typescript
logClientEvent(eventObj, eventNameSuffix)
  // Logs event sent from client

logServerEvent(eventObj, eventNameSuffix)
  // Logs event received from server

toggleExpand(id)
  // Expands/collapses event details
```

## Agent Configuration Files

### agentConfigs/index.ts
**Purpose:** Registry of all agent scenarios

```typescript
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
};

export const defaultAgentSetKey = 'chatSupervisor';
```

### agentConfigs/simpleHandoff.ts
**Purpose:** Basic example of agent handoff pattern

```typescript
// Greeter agent
const greeterAgent = new RealtimeAgent({
  name: 'greeter',
  voice: 'sage',
  instructions: "Greet user and ask if they'd like a haiku",
  handoffs: [haikuWriterAgent],
  tools: [],
});

// Haiku writer agent
const haikuWriterAgent = new RealtimeAgent({
  name: 'haikuWriter',
  voice: 'sage',
  instructions: 'Ask for topic, write haiku',
  handoffs: [],
  tools: [],
});
```

### agentConfigs/chatSupervisor/index.ts
**Purpose:** Chat-Supervisor pattern implementation

**Chat Agent:**
- Handles greetings, basic chitchat, information collection
- Has strict "allow list" of permitted actions
- Calls `getNextResponseFromSupervisor` for everything else
- Must say filler phrase before calling supervisor

**Supervisor Agent (supervisorAgent.ts):**
- GPT-4.1 model with full business logic
- Has access to all tools (lookupPolicyDocument, getUserAccountInfo, etc.)
- Iteratively calls tools until it has enough information
- Returns formatted response for chat agent to read

### agentConfigs/customerServiceRetail/
**Purpose:** Complex multi-agent customer service flow

**Agents:**
1. **authentication.ts** - Collects and verifies user information
2. **returns.ts** - Handles product returns
3. **sales.ts** - Handles sales inquiries
4. **simulatedHuman.ts** - Escalation agent

**Features:**
- State machine pattern for structured data collection
- Character-by-character confirmation for phone numbers
- Long disclosure reading (speeded up)
- Cross-agent handoffs (any agent can transfer to any other)

### agentConfigs/guardrails.ts
**Purpose:** Output moderation system

```typescript
export function createModerationGuardrail(companyName: string) {
  return {
    name: 'moderation_guardrail',
    async execute({ agentOutput }) {
      const result = await runGuardrailClassifier(agentOutput, companyName);
      return {
        tripwireTriggered: result.moderationCategory !== 'NONE',
        outputInfo: result,
      };
    },
  };
}
```

**Categories:**
- `OFFENSIVE`: Hate speech, discriminatory language
- `OFF_BRAND`: Disparaging competitors
- `VIOLENCE`: Threats, graphic content
- `NONE`: No violation

## API Routes

### api/session/route.ts
**Purpose:** Generate ephemeral keys for WebRTC

```typescript
export async function GET() {
  const response = await fetch(
    "https://api.openai.com/v1/realtime/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2025-06-03",
      }),
    }
  );
  return NextResponse.json(await response.json());
}
```

### api/responses/route.ts
**Purpose:** Proxy for OpenAI Responses API (used by supervisor)

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Supports both text and structured responses
  if (body.text?.format?.type === 'json_schema') {
    return structuredResponse(openai, body);
  } else {
    return textResponse(openai, body);
  }
}
```

## Utility Libraries

### lib/codecUtils.ts
**Purpose:** Audio codec management

```typescript
// Convert codec name to audio format
audioFormatForCodec(codec: string): 'pcm16' | 'g711_ulaw' | 'g711_alaw'

// Apply codec preference to peer connection
applyCodecPreferences(pc: RTCPeerConnection, codec: string): void
```

### lib/audioUtils.ts
**Purpose:** Audio processing utilities (if exists)

### lib/envSetup.ts
**Purpose:** Environment variable validation

## File Organization Summary

```
src/app/
├── App.tsx                      # Main orchestrator (550 lines)
├── page.tsx                     # Next.js wrapper (16 lines)
├── types.ts                     # TypeScript definitions (149 lines)
├── agentConfigs/
│   ├── index.ts                 # Agent registry (15 lines)
│   ├── types.ts                 # Agent types (58 lines)
│   ├── guardrails.ts            # Moderation system (100 lines)
│   ├── simpleHandoff.ts         # Basic example (26 lines)
│   ├── chatSupervisor/
│   │   ├── index.ts             # Chat agent (121 lines)
│   │   ├── supervisorAgent.ts   # Supervisor logic (319 lines)
│   │   └── sampleData.ts        # Mock data (50 lines)
│   └── customerServiceRetail/
│       ├── index.ts             # Multi-agent setup (23 lines)
│       ├── authentication.ts    # Auth agent (330 lines)
│       ├── returns.ts           # Returns agent (~400 lines)
│       ├── sales.ts             # Sales agent (~200 lines)
│       └── simulatedHuman.ts    # Escalation agent (50 lines)
├── api/
│   ├── session/route.ts         # Ephemeral keys (28 lines)
│   ├── responses/route.ts       # Supervisor proxy (44 lines)
│   └── health/route.ts          # Health check (7 lines)
├── components/
│   ├── Transcript.tsx           # Conversation UI (~300 lines)
│   ├── Events.tsx               # Event log (~200 lines)
│   ├── BottomToolbar.tsx        # Controls (~300 lines)
│   └── GuardrailChip.tsx        # Status indicator (50 lines)
├── contexts/
│   ├── TranscriptContext.tsx    # Conversation state (136 lines)
│   └── EventContext.tsx         # Event state (83 lines)
├── hooks/
│   ├── useRealtimeSession.ts    # SDK integration (210 lines)
│   ├── useHandleSessionHistory.ts # Event processing (198 lines)
│   └── useAudioDownload.ts      # Recording (50 lines)
└── lib/
    ├── codecUtils.ts            # Codec management (33 lines)
    ├── audioUtils.ts            # Audio utilities
    └── envSetup.ts              # Environment setup
```

## Next Steps

- [Extending Guide](./04-EXTENDING.md) - How to add custom features
- [Best Practices](./05-BEST-PRACTICES.md) - Tips and troubleshooting

