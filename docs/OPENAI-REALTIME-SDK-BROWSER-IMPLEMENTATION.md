# OpenAI Realtime SDK: Browser Implementation Guide

## 🔑 The Key Difference

Many developers get confused about OpenAI's two different packages:

### ❌ Server-Side Only (DOES NOT WORK IN BROWSER)
```typescript
import { OpenAI } from 'openai'; // Node.js only
```
This is the **server-side Node.js SDK** and CANNOT run in the browser.

### ✅ Browser-Compatible (WHAT WE USE)
```typescript
import { RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
```
This is the **Realtime Agents SDK** specifically designed for browser use with WebRTC.

---

## 📦 Our Complete Implementation

Here's exactly how we implemented voice AI in **Agent0** using the browser-compatible SDK.

### 1. **Server-Side: Ephemeral Key Endpoint**

We create a secure server endpoint that generates temporary API keys:

```typescript
// src/app/api/session/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY; // Server-side secret
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY environment variable is not set' },
      { status: 500 }
    );
  }

  const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, '');

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2025-06-03",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: response.statusText 
      }));
      
      return NextResponse.json(
        { 
          error: "Failed to create realtime session",
          status: response.status,
          details: errorData
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.client_secret?.value) {
      return NextResponse.json(
        { error: "No ephemeral key in response" },
        { status: 500 }
      );
    }

    return NextResponse.json(data); // Returns ephemeral key
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: "Internal Server Error",
        message: error.message
      },
      { status: 500 }
    );
  }
}
```

**Why?** This keeps your OpenAI API key secret on the server. The browser only gets a temporary key that expires.

---

### 2. **Browser-Side: RealtimeSession Hook**

We use the Realtime SDK **directly in the browser**:

```typescript
// src/app/hooks/useRealtimeSession.ts
'use client'; // Client-side React hook

import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime'; // ✅ Browser-compatible package

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
}

export function useRealtimeSession() {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');

  const connect = useCallback(async ({
    getEphemeralKey,      // Function that fetches ephemeral key
    initialAgents,        // Your agent config
    audioElement,         // HTML audio element for playback
    extraContext,         // Optional context data
    outputGuardrails,     // Optional content moderation
  }: ConnectOptions) => {
    if (sessionRef.current) return; // already connected

    setStatus('CONNECTING');

    // 1. Get ephemeral key from server
    const ephemeralKey = await getEphemeralKey();
    const rootAgent = initialAgents[0];

    // 2. Create RealtimeSession with WebRTC transport
    sessionRef.current = new RealtimeSession(rootAgent, {
      transport: new OpenAIRealtimeWebRTC({
        audioElement,
        changePeerConnection: async (pc: RTCPeerConnection) => {
          // Customize WebRTC peer connection if needed
          return pc;
        },
      }),
      model: 'gpt-4o-realtime-preview-2025-06-03',
      config: {
        inputAudioFormat: 'pcm16',   // Audio format
        outputAudioFormat: 'pcm16',
        inputAudioTranscription: {
          model: 'gpt-4o-mini-transcribe',
          language: 'en', // Explicitly set language
        },
      },
      outputGuardrails: outputGuardrails ?? [],
      context: extraContext ?? {},
    });

    // 3. Connect using ephemeral key
    await sessionRef.current.connect({ apiKey: ephemeralKey });
    setStatus('CONNECTED');
  }, []);

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setStatus('DISCONNECTED');
  }, []);

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);

  const sendUserText = useCallback((text: string) => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
    sessionRef.current.sendMessage(text);
  }, []);

  const mute = useCallback((muted: boolean) => {
    sessionRef.current?.mute(muted);
  }, []);

  return {
    connect,
    disconnect,
    interrupt,
    sendUserText,
    mute,
    status,
    session: sessionRef.current,
  };
}
```

---

### 3. **Browser-Side: UI Component**

The React component uses the hook:

```typescript
// src/app/agent-ui/AgentUIApp.tsx
'use client';

import React, { useRef } from 'react';
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';
import type { RealtimeAgent } from '@openai/agents/realtime';

// Your agent configuration
const myAgentConfig: RealtimeAgent = {
  name: 'Assistant',
  instructions: 'You are a helpful voice assistant.',
  voice: 'alloy',
  // Add tools/functions if needed
  tools: [],
};

function AgentUI() {
  const { connect, disconnect, interrupt, mute, status } = useRealtimeSession();
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.style.display = 'none';
    document.body.appendChild(audio);
    audioElementRef.current = audio;

    return () => {
      audio.remove();
    };
  }, []);

  // Fetch ephemeral key from server
  const fetchEphemeralKey = async (): Promise<string> => {
    const response = await fetch('/api/session');
    const data = await response.json();
    
    if (!data.client_secret?.value) {
      throw new Error('No ephemeral key provided by the server');
    }
    
    return data.client_secret.value;
  };

  const handleConnect = async () => {
    try {
      await connect({
        getEphemeralKey: fetchEphemeralKey,
        initialAgents: [myAgentConfig],
        audioElement: audioElementRef.current!,
      });
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  return (
    <div>
      <h1>Voice Agent</h1>
      <p>Status: {status}</p>
      
      <button onClick={handleConnect} disabled={status !== 'DISCONNECTED'}>
        Connect
      </button>
      <button onClick={disconnect} disabled={status === 'DISCONNECTED'}>
        Disconnect
      </button>
      <button onClick={interrupt} disabled={status !== 'CONNECTED'}>
        Interrupt
      </button>
      <button onClick={() => mute(true)} disabled={status !== 'CONNECTED'}>
        Mute
      </button>
      <button onClick={() => mute(false)} disabled={status !== 'CONNECTED'}>
        Unmute
      </button>
    </div>
  );
}

export default AgentUI;
```

---

### 4. **Agent Configuration with Tools**

Here's how to define an agent with function calling:

```typescript
// src/app/agentConfigs/myAgent.ts
import { RealtimeAgent } from '@openai/agents/realtime';

export const myAgent: RealtimeAgent = {
  name: 'BookingAssistant',
  instructions: `You are a helpful booking assistant. 
    Help users book appointments by collecting:
    - Patient name
    - Phone number
    - Preferred date and time
    
    Use the available tools to check availability and create bookings.`,
  voice: 'alloy',
  tools: [
    {
      type: 'function' as const,
      name: 'check_availability',
      description: 'Check available appointment slots for a given date range',
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format',
          },
          end_date: {
            type: 'string',
            description: 'End date in YYYY-MM-DD format',
          },
        },
        required: ['start_date', 'end_date'],
      },
      handler: async (params: { start_date: string; end_date: string }) => {
        // Call your API
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionName: 'check_availability',
            parameters: params,
          }),
        });

        if (!response.ok) {
          return JSON.stringify({
            error: true,
            message: `Failed to check availability: ${response.statusText}`,
          });
        }

        const result = await response.json();
        return JSON.stringify(result);
      },
    },
    {
      type: 'function' as const,
      name: 'create_booking',
      description: 'Create a new appointment booking',
      parameters: {
        type: 'object',
        properties: {
          patient_name: { type: 'string' },
          phone: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          time: { type: 'string', description: 'HH:MM' },
        },
        required: ['patient_name', 'phone', 'date', 'time'],
      },
      handler: async (params: any) => {
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            functionName: 'create_booking',
            parameters: params,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: true,
            message: `Server error: ${response.statusText}`,
          }));

          return JSON.stringify({
            error: true,
            message: errorData.message || 'Failed to create booking',
            status: response.status,
          });
        }

        const result = await response.json();
        return JSON.stringify(result);
      },
    },
  ],
};

export default [myAgent]; // Export as array for agent sets
```

---

## 🎯 Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│            BROWSER (Client-Side)                │
├─────────────────────────────────────────────────┤
│                                                 │
│  User clicks "Connect"                          │
│       ↓                                         │
│  fetch('/api/session')  ─────────────────┐     │
│       ↓                                   │     │
│  Receive ephemeral key                    │     │
│       ↓                                   │     │
│  RealtimeSession.connect({ apiKey })      │     │
│       ↓                                   │     │
│  OpenAIRealtimeWebRTC establishes         │     │
│  WebRTC connection                        │     │
│       ↓                                   │     │
│  Bidirectional audio streaming ←─────┐   │     │
│                                       │   │     │
└───────────────────────────────────────┼───┼─────┘
                                        │   │
                    WebRTC Audio Stream │   │ HTTPS
                                        │   │
┌───────────────────────────────────────┼───┼─────┐
│        OPENAI REALTIME API            │   │     │
│                                       │   │     │
│  ← Audio streaming via WebRTC ────────┘   │     │
│  → AI responses via WebRTC                │     │
│                                            │     │
└────────────────────────────────────────────┼─────┘
                                             │
┌────────────────────────────────────────────┼─────┐
│       YOUR NEXT.JS SERVER                  │     │
│                                            │     │
│  /api/session endpoint                     │     │
│       ↓                                    │     │
│  Uses OPENAI_API_KEY (secret) ─────────────┘     │
│       ↓                                          │
│  Calls OpenAI API to create session              │
│       ↓                                          │
│  Returns ephemeral key to browser                │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 📦 Required Dependencies

```json
{
  "dependencies": {
    "@openai/agents": "^0.0.1-alpha.42",  // ✅ Browser-compatible Realtime SDK
    "openai": "^4.75.0",                  // For server-side operations (optional)
    "react": "^18",
    "next": "^14"
  }
}
```

**Installation:**
```bash
npm install @openai/agents
```

---

## 🔐 Security: Why This Approach Works

1. **API Key Never Exposed**: Your `OPENAI_API_KEY` stays on the server
2. **Ephemeral Keys**: Browser gets temporary keys that expire after the session
3. **WebRTC**: Audio streams directly between browser and OpenAI (not through your server)
4. **Scalable**: Your server only creates sessions, doesn't handle audio processing

---

## 🆚 Common Misconceptions

| ❌ Wrong Approach | ✅ Correct Approach |
|------------------|---------------------|
| Using `openai` package in browser | Using `@openai/agents/realtime` |
| Server-side only | Browser-compatible |
| Need custom WebRTC proxy | Built-in WebRTC support |
| Complex implementation | Simple, official SDK |
| Audio routed through your server | Direct WebRTC to OpenAI |

---

## ⚙️ Environment Variables

```bash
# .env.local
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
```

**Important:** This should ONLY be set on your server, never exposed to the browser.

---

## 🧪 Testing the Implementation

### 1. Test the Session Endpoint
Visit: `http://localhost:3000/api/session`

**Expected response:**
```json
{
  "id": "sess_xxxxxxxxxxxxx",
  "object": "realtime.session",
  "model": "gpt-4o-realtime-preview-2025-06-03",
  "expires_at": 1234567890,
  "client_secret": {
    "value": "ek_xxxxxxxxxxxxx",
    "expires_at": 1234567890
  }
}
```

### 2. Test the Voice Connection
1. Open your app in the browser
2. Click "Connect"
3. Allow microphone access
4. Start speaking
5. You should hear the AI respond

---

## 🐛 Common Issues and Solutions

### Issue 1: "No ephemeral key provided by the server"
**Cause:** Session endpoint is failing

**Fix:**
1. Check if `OPENAI_API_KEY` is set in `.env.local`
2. Restart your dev server after adding environment variables
3. Test the `/api/session` endpoint directly

### Issue 2: "RealtimeSession is not defined"
**Cause:** Wrong package or incorrect import

**Fix:**
```typescript
// ❌ Wrong
import { RealtimeSession } from 'openai';

// ✅ Correct
import { RealtimeSession } from '@openai/agents/realtime';
```

### Issue 3: Audio not playing
**Cause:** Audio element not properly configured

**Fix:**
```typescript
const audio = document.createElement('audio');
audio.autoplay = true; // ✅ Required for automatic playback
document.body.appendChild(audio); // ✅ Must be in DOM
```

### Issue 4: "Operation not supported in browser"
**Cause:** Using server-side `openai` package

**Fix:** Install and use `@openai/agents` package instead

---

## 🚀 Advanced Features

### Adding Content Moderation
```typescript
import { createModerationGuardrail } from '@openai/agents/realtime';

await connect({
  getEphemeralKey: fetchEphemeralKey,
  initialAgents: [myAgent],
  audioElement: audioElement,
  outputGuardrails: [
    createModerationGuardrail({
      blockCategories: ['hate', 'self-harm', 'sexual/minors'],
    }),
  ],
});
```

### Handling Agent Handoffs
```typescript
const { connect } = useRealtimeSession({
  onAgentHandoff: (newAgentName: string) => {
    console.log('Switching to agent:', newAgentName);
    // Update UI or load new agent config
  },
});
```

### Accessing Transcripts
```typescript
useEffect(() => {
  if (!session) return;

  session.on('response.audio_transcript.delta', (event) => {
    console.log('AI speaking:', event.delta);
  });

  session.on('conversation.item.input_audio_transcription.completed', (event) => {
    console.log('User said:', event.transcript);
  });
}, [session]);
```

---

## 📚 Additional Resources

- **OpenAI Realtime API Docs**: https://platform.openai.com/docs/guides/realtime
- **Agent SDK GitHub**: https://github.com/openai/openai-realtime-agents
- **WebRTC API**: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

---

## ✅ Summary

**The correct way to use OpenAI Realtime API in the browser:**

1. ✅ Use `@openai/agents/realtime` package (not `openai`)
2. ✅ Create server endpoint for ephemeral keys
3. ✅ Use `RealtimeSession` with `OpenAIRealtimeWebRTC` in browser
4. ✅ WebRTC handles audio streaming automatically
5. ✅ No proxy or complex setup required

This is the **officially supported** approach by OpenAI and works perfectly in production! 🎉





















