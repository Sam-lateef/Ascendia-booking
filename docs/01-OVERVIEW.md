# Multi-Agent Realtime Voice Application - Overview

## What This Application Does

This is an advanced voice agent application built on OpenAI's Realtime API and Agents SDK. It demonstrates two powerful agentic patterns for creating intelligent, conversational voice interfaces that can handle complex tasks through agent collaboration.

**Key Capabilities:**
- Real-time voice conversations with sub-second latency
- Multi-agent collaboration with seamless handoffs
- Tool calling for dynamic actions and data retrieval
- Output guardrails for safety and brand compliance
- Push-to-talk and voice activity detection modes
- Audio transcription and conversation history

## Technology Stack

### Core Technologies
- **Next.js 15.3** - React framework for the frontend
- **TypeScript** - Type-safe development
- **OpenAI Realtime API** - Low-latency voice interaction (`gpt-4o-realtime-preview-2025-06-03`)
- **OpenAI Agents SDK** (`@openai/agents`) - Agent orchestration and management
- **WebRTC** - Real-time audio streaming
- **Tailwind CSS** - UI styling

### OpenAI Models Used
- `gpt-4o-realtime-preview-2025-06-03` - Primary voice agent model
- `gpt-4.1` - Supervisor model for complex reasoning (Chat-Supervisor pattern)
- `gpt-4o-mini` - Guardrail classification
- `gpt-4o-mini-transcribe` - Audio transcription

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Client                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   App.tsx    │  │  Transcript  │  │    Events    │          │
│  │ (Orchestrator)│  │   Context    │  │   Context    │          │
│  └──────┬───────┘  └──────────────┘  └──────────────┘          │
│         │                                                        │
│  ┌──────▼────────────────────────────────────────┐              │
│  │      useRealtimeSession Hook                  │              │
│  │   (SDK Integration & Event Handling)          │              │
│  └──────┬────────────────────────────────────────┘              │
└─────────┼────────────────────────────────────────────────────────┘
          │ WebRTC Audio Stream
          │ + Events via Data Channel
┌─────────▼────────────────────────────────────────────────────────┐
│                    OpenAI Realtime API                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Voice Agent    │  │  Agent Manager  │  │   Transcription │  │
│  │  (gpt-4o-rt)    │  │   (Handoffs)    │  │   (Whisper)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
          │
          │ (Chat-Supervisor pattern only)
          │
┌─────────▼────────────────────────────────────────────────────────┐
│              Next.js API Routes (/api/responses)                 │
└─────────┬────────────────────────────────────────────────────────┘
          │
┌─────────▼────────────────────────────────────────────────────────┐
│           OpenAI Responses API (gpt-4.1 supervisor)              │
└──────────────────────────────────────────────────────────────────┘
```

## Two Main Agentic Patterns

### Pattern 1: Chat-Supervisor
**Use Case:** Migrate existing text-based chatbots to voice with minimal changes

**How It Works:**
1. A lightweight realtime chat agent handles greetings and simple interactions
2. For complex queries, it calls a `getNextResponseFromSupervisor` tool
3. The supervisor (GPT-4.1) analyzes the conversation and performs tool calls
4. Chat agent reads the supervisor's response verbatim to the user

**Benefits:**
- Lower latency for simple interactions (immediate response)
- High intelligence for complex tasks (GPT-4.1 reasoning)
- Easy migration path (reuse existing chatbot prompts)
- Cost-effective (use mini model for chat, full model only when needed)

### Pattern 2: Sequential Handoffs
**Use Case:** Customer service with specialized departments/agents

**How It Works:**
1. Agents are defined with specific expertise (authentication, returns, sales, etc.)
2. Each agent can transfer to other agents via `transfer_to_*` tools
3. Handoffs update the session with new instructions and tools
4. User seamlessly continues conversation with the new agent

**Benefits:**
- Domain expertise (each agent is specialized)
- Avoid prompt overload (smaller, focused instructions)
- Natural conversation flow (like being transferred to a department)
- Scalable (add new specialist agents easily)

## Project Structure

```
AscendiaAIRT/
├── src/app/
│   ├── App.tsx                    # Main orchestrator
│   ├── page.tsx                   # Next.js page wrapper
│   ├── agentConfigs/              # Agent scenarios
│   │   ├── index.ts               # Agent registry
│   │   ├── simpleHandoff.ts       # Basic handoff example
│   │   ├── chatSupervisor/        # Chat-Supervisor pattern
│   │   └── customerServiceRetail/ # Complex multi-agent flow
│   ├── api/
│   │   ├── session/route.ts       # Ephemeral key generation
│   │   └── responses/route.ts     # Supervisor API proxy
│   ├── components/                # UI components
│   ├── contexts/                  # State management
│   ├── hooks/                     # Custom React hooks
│   └── lib/                       # Utilities
└── docs/                          # This documentation
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.sample .env
   # Add your OPENAI_API_KEY to .env
   ```

3. **Run the application:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   ```
   http://localhost:3000
   ```

5. **Try the scenarios:**
   - Chat-Supervisor: Default landing page
   - Sequential Handoffs: Select "customerServiceRetail" from dropdown
   - Simple Example: Select "simpleHandoff" from dropdown

## Next Steps

- [Architecture Details](./02-ARCHITECTURE.md) - Deep dive into system architecture
- [Components Guide](./03-COMPONENTS.md) - Detailed component documentation
- [Extending Guide](./04-EXTENDING.md) - How to customize and add features
- [Best Practices](./05-BEST-PRACTICES.md) - Tips and troubleshooting

## References

- [Official OpenAI Realtime Agents Repo](https://github.com/openai/openai-realtime-agents)
- [OpenAI Agents SDK Documentation](https://github.com/openai/openai-agents-js)
- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)

