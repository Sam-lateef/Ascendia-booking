# Agent0 - Voice AI Dental Office Assistant

## 🎯 Project Overview

Agent0 is a sophisticated voice AI assistant for dental offices, built with OpenAI's Realtime API and a custom STT/TTS implementation. It provides natural language interaction for managing appointments, patients, and office operations through deep integration with OpenDental API.

## 🏗️ Architecture

### Two-Tier Agent System

1. **Greeting Agent (Tier 1)**
   - Handles initial user interaction
   - Provides greeting and context priming
   - Routes complex requests to orchestrator
   - Files: `src/app/agentConfigs/openDental/greetingAgentSTT.ts`, `src/app/agentConfigs/openDental/index.ts`

2. **Orchestrator Agent (Tier 2)**
   - Core business logic and API operations
   - 49 OpenDental API functions
   - Multi-step workflows (booking, rescheduling, canceling)
   - File: `src/app/agentConfigs/openDental/orchestratorAgent.ts`

### Three Engine Options

1. **Premium (Realtime)**
   - Uses OpenAI Realtime SDK
   - Real-time bidirectional audio via WebRTC
   - Automatic conversation history management
   - Higher cost, lowest latency (<500ms)
   - Hook: `src/app/hooks/useRealtimeSession.ts`
   - **Integration Guide**: [docs/OpenAI/INTEGRATION-GUIDE.md](./OpenAI/INTEGRATION-GUIDE.md)

2. **Retell (Realtime)**
   - Uses Retell AI for STT/TTS
   - Custom LLM via WebSocket
   - Cost-effective alternative (~$0.085-0.095/min)
   - Manual conversation history management
   - Hook: `src/app/hooks/useRetellSession.ts`
   - **Integration Guide**: [docs/Retell/INTEGRATION-GUIDE.md](./Retell/INTEGRATION-GUIDE.md)

3. **Whisper (STT/TTS)**
   - Custom STT/TTS using OpenAI Whisper + TTS
   - Most cost-effective option
   - Cached audio for performance
   - Manual conversation history management
   - Hook: `src/app/hooks/useSTTSession.ts`

## 🚀 Recent Optimizations (Latest Session)

### Performance Improvements
- ✅ **Cached greeting audio** - Instant first impression (`public/greeting.wav`)
- ✅ **Immediate "one moment" audio** - Plays right after user question (`public/oneMoment.wav`)
- ✅ **Faster TTS** - Switched from `tts-1-hd` to `tts-1` for quicker generation
- ✅ **Pre-created audio elements** - Saves milliseconds on playback
- ✅ **Optimized function calls** - Fixed repeated calls to fetch all patients/appointments

### Orchestrator Enhancements
- ✅ **Better parameter extraction** - Always extracts patient name from user message
- ✅ **Explicit instructions** - Clear rules about never calling functions without parameters
- ✅ **Efficient API usage** - `GetMultiplePatients(LName, FName)` instead of fetching all
- ✅ **Office context caching** - Pre-fetched and passed to orchestrator

### Error Handling
- ✅ **Error notifications** - Visual feedback for quota and connection errors
- ✅ **Graceful degradation** - Continues even if cached audio fails
- ✅ **Detailed logging** - Performance timing and debugging info

## 📁 Key Files & Directories

### Core Agent Logic
```
src/app/agentConfigs/openDental/
├── orchestratorAgent.ts      # Main orchestrator with 49 API functions
├── greetingAgentSTT.ts        # STT/TTS greeting agent
├── index.ts                   # Realtime greeting agent (Lexi)
└── apiRegistry.ts            # API function catalog and registry
```

### Hooks
```
src/app/hooks/
├── useRealtimeSession.ts      # OpenAI Realtime SDK session management
├── useRetellSession.ts        # Retell Web SDK session management
├── useSTTSession.ts           # Whisper STT/TTS session management
├── useTranscript.ts           # Transcript display management
└── useHandleSessionHistory.ts # Realtime session history tracking
```

### API Routes
```
src/app/api/
├── session/route.ts          # OpenAI Realtime session creation
├── responses/route.ts        # OpenAI Responses API proxy
├── stt/route.ts              # Whisper STT proxy
├── tts/route.ts              # TTS API proxy
├── opendental/route.ts       # OpenDental API proxy
└── retell/
    ├── create-web-call/route.ts  # Retell web call creation
    ├── webhook/route.ts           # Retell webhook handler
    └── send-text/route.ts         # Retell text input proxy
```

### UI Components
```
src/app/agent-ui/
├── AgentUIApp.tsx            # Main UI with engine toggle
├── OfficeContextModal.tsx    # Office status display
└── ErrorNotification.tsx    # Error display component
```

### Utilities
```
src/app/lib/
├── sttTtsUtils.ts            # STT/TTS helper functions
├── officeContext.ts          # Office context fetching
└── envSetup.ts               # Environment variable setup
```

### Deterministic Workflow Engine
```
src/app/lib/workflows/
├── index.ts                  # Main exports
├── types.ts                  # TypeScript interfaces
├── definitions.ts            # Workflow definitions (book, reschedule, cancel, check)
├── engine.ts                 # Deterministic execution engine
├── router.ts                 # Routes between new engine and old orchestrator
├── reactExtractor.ts         # Intent & entity extraction (GPT-4o-mini)
├── normalizer.ts             # Entity normalization (dates, phones, names)
├── responseTemplates.ts      # Template-based responses
└── validator.ts              # Sonnet validation layer for risky operations
```

## 🛡️ Sonnet Validation Layer

The system uses Claude Sonnet as a **validation layer** before executing risky operations. This prevents LLM hallucinations and incorrect parameter passing.

### How It Works

1. **Workflow Engine** or **Booking API** receives a function call
2. If it's a **risky operation** (CreateAppointment, UpdateAppointment, etc.), it invokes Sonnet
3. Sonnet validates:
   - Does the action match user intent?
   - Are parameters correct based on conversation?
   - Is the date/time what the user requested?
4. If validation **passes** → execute the operation
5. If validation **fails** → return suggested response to user

### Risky Operations (Validated by Sonnet)
- `CreateAppointment` - Booking new appointments
- `UpdateAppointment` - Rescheduling appointments
- `DeleteAppointment` / `BreakAppointment` - Canceling appointments
- `CreatePatient` - Creating new patient records
- `UpdatePatient` - Modifying patient information

### Cost Impact
- ~$0.005 per validation call (Sonnet is efficient)
- Only called for data-modifying operations
- Significantly reduces error correction costs

## 🔧 Setup & Development

### Prerequisites
- Node.js (via nvm4w on Windows)
- OpenAI API key
- OpenDental API access

### Environment Variables
```env
# OpenAI (for Realtime and Whisper STT/TTS)
OPENAI_API_KEY=your_openai_key

# Anthropic (for Sonnet validation layer)
ANTHROPIC_API_KEY=your_anthropic_key
# Set to 'false' to disable Sonnet validation
ENABLE_SONNET_VALIDATION=true

# Retell (for Retell integration)
RETELL_API_KEY=your_retell_api_key
RETELL_AGENT_ID=your_retell_agent_id
RETELL_WEBSOCKET_PORT=8080
WEBSOCKET_SERVER_URL=http://localhost:8080

# OpenDental
OPENDENTAL_API_KEY=your_opendental_key
OPENDENTAL_API_URL=your_opendental_url
```

### Run Development Server

**For OpenAI Realtime or Whisper STT/TTS:**
```bash
npm run dev
```

**For Retell integration:**
```bash
npm run dev:retell  # Runs both Next.js and WebSocket server
# Or separately:
npm run dev         # Next.js (port 3000)
npm run dev:websocket  # WebSocket server (port 8080)
```

### Deploy to Fly.io
```bash
fly deploy
```

### Set Secrets on Fly.io
```bash
fly secrets set OPENAI_API_KEY="your_key"
fly secrets set OPENDENTAL_API_KEY="your_key"

# For Retell integration (if using separate WebSocket server):
fly secrets set RETELL_API_KEY="your_key" --app your-websocket-app
fly secrets set RETELL_AGENT_ID="your_agent_id" --app your-websocket-app
```

## 🎨 Key Features

### Appointment Management
- **Book appointments** - Full workflow with provider/operatory selection
- **Reschedule** - Smart date calculation relative to current appointment
- **Cancel** - Status-aware cancellation with proper break types
- **Check availability** - Uses `GetAvailableSlots` for accurate results

### Patient Operations
- **Patient lookup** - By name or phone number
- **Appointment history** - View past and upcoming appointments
- **Patient information** - Access patient records

### Office Context
- Pre-fetched providers, operatories, and schedules
- Occupied slots for conflict detection
- Default values for quick booking
- Real-time updates when needed

## 🔄 Workflow Examples

### Booking Flow
1. User: "Book appointment for Sam Lateef tomorrow at 2pm"
2. Greeting agent extracts context
3. Orchestrator:
   - `GetMultiplePatients(LName="Lateef", FName="Sam")` → Get PatNum
   - `GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum)` → Check availability
   - `CreateAppointment(PatNum, AptDateTime, Op, ProvNum)` → Book
4. Response with provider name confirmation

### Finding Appointments
1. User: "Get my appointments"
2. Orchestrator:
   - `GetMultiplePatients(LName, FName)` → Get PatNum
   - `GetAppointments(PatNum)` → Get appointments
3. Response with formatted appointment list

## 🎯 Model Configuration

- **Orchestrator**: `gpt-4o` (line 1227 in orchestratorAgent.ts)
- **Greeting Agent**: `gpt-4o-mini` (line 464 in greetingAgentSTT.ts)
- **STT**: `whisper-1`
- **TTS**: `tts-1` (optimized for speed)
- **Realtime**: `gpt-4o-realtime-preview-2025-06-03`

## 📊 Performance Metrics

### STT/TTS Agent
- **Greeting**: Instant (cached audio)
- **"One moment"**: Immediate after user question
- **TTS generation**: ~600-1000ms (with tts-1)
- **Total response time**: ~2-4 seconds end-to-end

### OpenAI Realtime Agent
- **Latency**: <500ms typically
- **Cost**: Higher (real-time streaming)
- **History Management**: Automatic (SDK handles)

### Retell Agent
- **Latency**: ~800ms typically
- **Cost**: Lower (~$0.085-0.095/min)
- **History Management**: Manual (must track and sync)

### Whisper STT/TTS Agent
- **Latency**: ~2-4 seconds end-to-end
- **Cost**: Lowest (pay per API call)
- **History Management**: Manual (must track and sync)

## 🐛 Known Issues & Solutions

### React DevTools Error
- **Issue**: `Invalid argument not valid semver` error in console
- **Cause**: React DevTools extension compatibility with React 19
- **Solution**: Harmless, can be ignored. Suppression attempted in `SuppressDevToolsError.tsx`

### Office Context "0 schedules"
- **Fixed**: Parameter casing (`dateStart` vs `DateStart`)
- **Fixed**: Provider filtering fallback logic
- **Fixed**: Date range extension (1 day before to 14 days forward)

### Function Call Repetition
- **Fixed**: Added explicit instructions to always extract patient info
- **Fixed**: Never call `GetMultiplePatients()` or `GetAppointments()` without parameters

## 🔐 Security Notes

- API keys stored as environment variables
- OpenDental API proxied through Next.js API routes
- Client-side never sees API keys directly
- Secrets managed via Fly.io secrets

## 📝 Important Notes

### Instruction Caching
- Static system prompt is auto-cached by OpenAI (50% discount)
- Dynamic content (dates, office context) goes in `instructions` field
- See `getStaticSystemPrompt()` and `generateOrchestratorInstructions()` in orchestratorAgent.ts

### Office Context Extraction
- Multiple strategies to find office context in conversation history
- Extracted from `function_call_output` items
- Passed directly to orchestrator to avoid API calls

### Audio Playback
- Cached files in `public/` directory
- `greeting.wav` - Initial greeting
- `oneMoment.wav` - "One moment please" feedback
- Graceful fallback if files missing

## 🚦 Getting Started After Break

1. **Check environment variables** - Ensure all API keys are set
2. **Review recent changes** - Check git log for latest commits
3. **Test all three engines** - Verify Premium (Realtime), Retell, and Whisper STT/TTS work
4. **Check console** - Look for any new errors or warnings
5. **Test appointment flow** - Try booking/rescheduling to verify OpenDental integration
6. **Review integration guides** - See [Retell](./Retell/INTEGRATION-GUIDE.md) and [OpenAI Realtime](./OpenAI/INTEGRATION-GUIDE.md) guides for replication

## 🎓 Key Concepts

### Meta-Tool Pattern
- All OpenDental API calls go through `callOpenDentalAPI` meta-tool
- Single entry point for all 49 functions
- Consistent error handling and logging

### Conversation History Management

**OpenAI Realtime:**
- Automatic history management via SDK
- Includes messages, tool calls, and tool outputs automatically
- No manual tracking needed

**Retell & Whisper STT/TTS:**
- Manual history management required
- Must include `function_call` + `function_call_output` pairs in orchestrator input
- History must be synced between storage and WebSocket instance (Retell)
- Critical for multi-turn conversations (e.g., extracting PatNum from GetMultiplePatients)

### Two-Tier Architecture Benefits
- Greeting agent handles simple interactions
- Orchestrator handles complex multi-step operations
- Clear separation of concerns
- Reusable orchestrator logic

## 🆕 Deterministic Workflow Engine (Latest)

A new workflow engine has been implemented to reduce LLM hallucinations and provide deterministic execution of booking workflows.

### Architecture
```
User Speech → [ReAct Extractor (LLM)] → {intent, variables}
                        ↓
              [State Manager] → tracks slots across turns
                        ↓
              [Workflow Router] → selects workflow by intent
                        ↓
              [Workflow Engine (CODE)] → executes functions
                        ↓
              [Response Generator] → templates + LLM fallback
```

### Key Components

**Location:** `src/app/lib/workflows/`

- **types.ts** - TypeScript interfaces for workflow engine
- **definitions.ts** - Declarative workflow definitions (book, reschedule, cancel, check)
- **engine.ts** - Deterministic workflow execution engine
- **reactExtractor.ts** - ReAct-style LLM extraction with structured outputs
- **normalizer.ts** - Entity normalization (dates, phones, names, etc.)
- **responseTemplates.ts** - Template-based responses for fast, consistent output
- **router.ts** - Routes between new engine and old orchestrator (confidence-based)
- **index.ts** - Main exports

### Features

- **Confidence-based Routing**: High confidence (>0.8) routes to new engine, low confidence falls back to old orchestrator
- **Deterministic Execution**: Code executes workflows step-by-step, no LLM decisions during execution
- **Structured Output Extraction**: Uses OpenAI JSON schema enforcement for reliable extraction
- **Template-based Responses**: Fast, consistent responses without LLM generation
- **Entity Normalization**: Pure code normalization of dates, times, phones, names
- **State Persistence**: Workflow state synced with conversation state in Supabase

### Integration Points

- **Greeting Agent (STT)**: `src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts`
- **Realtime Agent**: `src/app/agentConfigs/embeddedBooking/orchestratorAgent.ts`
- **Conversation State**: `src/app/lib/conversationState.ts`

### Rollout Strategy

Currently in parallel migration mode:
- 100% of requests routed through new engine when confidence > 0.8
- Automatic fallback to old orchestrator on errors or low confidence
- Feature flags in `router.ts` allow gradual rollout

## 🔮 Future Enhancements

- Streaming TTS responses (partial audio playback)
- Voice activity detection improvements
- Multi-language support
- Appointment reminders
- Patient portal integration
- Analytics and usage tracking

## 📚 Related Documentation

### Integration Guides
- **[Retell Integration Guide](./Retell/INTEGRATION-GUIDE.md)** - Complete Retell AI integration documentation
- **[OpenAI Realtime Integration Guide](./OpenAI/INTEGRATION-GUIDE.md)** - Complete OpenAI Realtime API integration documentation

### Additional Documentation
- `docs/02-ARCHITECTURE.md` - Detailed architecture
- `docs/API/` - OpenDental API documentation
- `docs/openDental-orchestrator.md` - Orchestrator details
- `docs/Retell/PRODUCTION_DEPLOYMENT.md` - Retell production deployment
- `docs/Retell/NGROK_SETUP.md` - Local development tunneling with ngrok
- `docs/Retell/CLOUDFLARE_TUNNEL_SETUP.md` - Alternative tunneling with Cloudflare

---

## 📅 Session Summary - December 2, 2025

### Retell + Workflow Engine Integration
- ✅ **Added voice engine dropdown** in AgentUIApp - Users can now switch between "Premium (Realtime)" and "Retell AI"
- ✅ **Integrated Retell WebSocket handler** with the new Workflow Engine via `/api/workflow`
- ✅ **Persistent ngrok domains** configured: `wss://ascendia-ws.ngrok.io/llm-websocket` & `https://ascendia-api.ngrok.io`
- ✅ **Initial greeting handling** - Workflow API now properly handles Retell's "Start the conversation with the greeting" message
- ✅ **Response templates** - Added `greeting`, `welcome_back`, `patient_not_found` templates

### Bug Fixes
- ✅ **Fixed error message formatting** - Error messages now show actual text instead of `true`
  - Updated `callBookingAPI` in `engine.ts` to use `result.message` instead of `result.error`
  - Updated `route.ts` to include `errorMessage` field in error responses

### Running Retell Locally
```bash
# Terminal 1 - Start servers
npm run dev:retell

# Terminal 2 - WebSocket tunnel (paid account)
ngrok http 8080 --domain=ascendia-ws.ngrok.io

# Terminal 3 - API tunnel (paid account)  
ngrok http 3000 --domain=ascendia-api.ngrok.io
```

---

**Last Updated**: December 2025
**Status**: ✅ Shipped and Production Ready

## 🔄 Replicating Integrations

To replicate the Retell or OpenAI Realtime integrations in a new project, see the comprehensive integration guides:

- **[Retell Integration Guide](./Retell/INTEGRATION-GUIDE.md)** - Step-by-step guide with complete code examples
- **[OpenAI Realtime Integration Guide](./OpenAI/INTEGRATION-GUIDE.md)** - Step-by-step guide with complete code examples

Both guides include:
- Complete architecture overview
- Full implementation details with code examples
- Step-by-step setup instructions
- Troubleshooting guides
- Replication checklists


