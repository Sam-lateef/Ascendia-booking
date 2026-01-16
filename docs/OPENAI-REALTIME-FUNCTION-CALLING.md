# OpenAI Realtime SDK: Function Calling Guide

## 🎯 The Problem

Your AI says "Let me check that for you..." or "Calling function now..." but **nothing actually happens**. This means your tools aren't properly registered or handled.

---

## ✅ How We Solved It in Agent0

Function calling in the Realtime SDK requires **3 key components**:

1. **Tool Definition** - Define tools in your agent config
2. **Tool Registration** - Pass tools when creating RealtimeSession
3. **Tool Handler** - Execute the actual function logic

---

## 📋 Complete Working Example

### 1. **Define Tools in Agent Config**

```typescript
// src/app/agentConfigs/embeddedBooking/lexiAgent.ts
import { RealtimeAgent } from '@openai/agents/realtime';

export const lexiRealtimeAgent: RealtimeAgent = {
  name: 'Lexi',
  voice: 'shimmer',
  instructions: `You are Lexi, a friendly booking assistant.
    
When helping users:
- Use get_datetime to check the current date and time
- Use get_available_slots to find open appointments
- Use create_appointment to book appointments
- Always confirm details before booking`,

  tools: [
    // ========================================
    // Tool 1: Get Current Date/Time
    // ========================================
    {
      type: 'function' as const,
      name: 'get_datetime',
      description: 'Get the current date, time, and day of the week. Use this to know what day it is today.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          weekday: 'long',
        };
        const localDateTime = now.toLocaleString('en-US', options);
        const [dayName, datePart] = localDateTime.split(', ');
        const [dateStr, timeStr] = datePart.split(', ');
        const [month, day, year] = dateStr.split('/');
        const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        return JSON.stringify({
          date: formattedDate,
          time: timeStr,
          day: dayName,
          formatted: `${formattedDate} ${timeStr} (${dayName})`
        });
      },
    },

    // ========================================
    // Tool 2: Get Available Appointment Slots
    // ========================================
    {
      type: 'function' as const,
      name: 'get_available_slots',
      description: 'Get available appointment slots for a date range. Returns time slots that are open for booking.',
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format (e.g., "2024-12-15")',
          },
          end_date: {
            type: 'string',
            description: 'End date in YYYY-MM-DD format (e.g., "2024-12-20")',
          },
          provider_id: {
            type: 'number',
            description: 'Optional: Specific provider ID to check availability for',
          },
        },
        required: ['start_date', 'end_date'],
      },
      handler: async (params: { start_date: string; end_date: string; provider_id?: number }) => {
        console.log('[Lexi] 🔧 Calling get_available_slots with:', params);

        try {
          // Call your backend API
          const response = await fetch('/api/booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              functionName: 'GetAvailableSlots',
              parameters: params,
              sessionId: `realtime_${Date.now()}`,
              conversationHistory: []
            })
          });

          // ✅ Check for HTTP errors
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({
              error: true,
              message: `Server error: ${response.statusText}`
            }));

            return JSON.stringify({
              error: true,
              message: errorData.message || 'Failed to get available slots',
              status: response.status
            });
          }

          const result = await response.json();

          // ✅ Check if result has error flag
          if (result.error) {
            console.log('[Lexi] ⚠️ get_available_slots returned error:', result.message);
          } else {
            console.log('[Lexi] ✅ get_available_slots success:', result);
          }

          return JSON.stringify(result);
        } catch (error: any) {
          console.error('[Lexi] ❌ get_available_slots error:', error);
          return JSON.stringify({
            error: true,
            message: error.message || 'Unknown error occurred'
          });
        }
      },
    },

    // ========================================
    // Tool 3: Create Appointment
    // ========================================
    {
      type: 'function' as const,
      name: 'create_appointment',
      description: 'Create a new appointment booking. All fields are required.',
      parameters: {
        type: 'object',
        properties: {
          patient_name: {
            type: 'string',
            description: 'Full name of the patient',
          },
          patient_phone: {
            type: 'string',
            description: 'Phone number of the patient (e.g., "555-1234")',
          },
          appointment_date: {
            type: 'string',
            description: 'Appointment date in YYYY-MM-DD format',
          },
          appointment_time: {
            type: 'string',
            description: 'Appointment time in HH:MM format (24-hour)',
          },
          provider_id: {
            type: 'number',
            description: 'ID of the provider',
          },
          appointment_type: {
            type: 'string',
            description: 'Type of appointment (e.g., "cleaning", "checkup", "consultation")',
          },
        },
        required: ['patient_name', 'patient_phone', 'appointment_date', 'appointment_time', 'provider_id', 'appointment_type'],
      },
      handler: async (params: any) => {
        console.log('[Lexi] 🔧 Calling create_appointment with:', params);

        try {
          const response = await fetch('/api/booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              functionName: 'CreateAppointment',
              parameters: params,
              sessionId: `realtime_${Date.now()}`,
              conversationHistory: []
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({
              error: true,
              message: `Server error: ${response.statusText}`
            }));

            return JSON.stringify({
              error: true,
              message: errorData.message || 'Failed to create appointment',
              status: response.status
            });
          }

          const result = await response.json();

          if (result.error) {
            console.log('[Lexi] ⚠️ create_appointment returned error:', result.message);
          } else {
            console.log('[Lexi] ✅ create_appointment success:', result);
          }

          return JSON.stringify(result);
        } catch (error: any) {
          console.error('[Lexi] ❌ create_appointment error:', error);
          return JSON.stringify({
            error: true,
            message: error.message || 'Unknown error occurred'
          });
        }
      },
    },
  ],
};

export default [lexiRealtimeAgent];
```

---

### 2. **Register Tools with RealtimeSession**

```typescript
// src/app/hooks/useRealtimeSession.ts
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

export function useRealtimeSession() {
  const sessionRef = useRef<RealtimeSession | null>(null);

  const connect = useCallback(async ({
    getEphemeralKey,
    initialAgents,  // ✅ This contains your agent with tools
    audioElement,
  }: ConnectOptions) => {
    const ephemeralKey = await getEphemeralKey();
    const rootAgent = initialAgents[0]; // ✅ Agent with tools defined

    // ✅ Create session - tools are automatically registered from the agent
    sessionRef.current = new RealtimeSession(rootAgent, {
      transport: new OpenAIRealtimeWebRTC({
        audioElement,
      }),
      model: 'gpt-4o-realtime-preview-2025-06-03',
      config: {
        inputAudioFormat: 'pcm16',
        outputAudioFormat: 'pcm16',
        inputAudioTranscription: {
          model: 'gpt-4o-mini-transcribe',
          language: 'en',
        },
      },
    });

    // ✅ Connect - OpenAI now knows about your tools
    await sessionRef.current.connect({ apiKey: ephemeralKey });

    console.log('✅ Session connected with tools:', rootAgent.tools?.map(t => t.name));
  }, []);

  return { connect, disconnect, session: sessionRef.current };
}
```

---

### 3. **Listen for Function Call Events**

```typescript
// src/app/hooks/useHandleSessionHistory.ts
export function useHandleSessionHistory() {
  const { addTranscriptMessage } = useTranscript();

  const handlers = {
    // ✅ When agent STARTS calling a tool
    handleAgentToolStart: (item: any) => {
      const toolName = item.name;
      const params = item.arguments;
      
      console.log(`[Agent] 🔧 Calling tool: ${toolName}`, params);
      
      addTranscriptMessage({
        type: 'function_call',
        name: toolName,
        arguments: params,
        timestamp: new Date().toISOString(),
      });
    },

    // ✅ When tool execution COMPLETES
    handleAgentToolEnd: (item: any) => {
      const toolName = item.name;
      const result = item.output;
      
      console.log(`[Agent] ✅ Tool completed: ${toolName}`, result);
      
      addTranscriptMessage({
        type: 'function_result',
        name: toolName,
        result: result,
        timestamp: new Date().toISOString(),
      });
    },
  };

  return { current: handlers };
}
```

```typescript
// src/app/hooks/useRealtimeSession.ts (continued)
export function useRealtimeSession() {
  const historyHandlers = useHandleSessionHistory().current;

  useEffect(() => {
    if (!sessionRef.current) return;

    // ✅ Listen for tool execution events
    sessionRef.current.on('agent_tool_start', historyHandlers.handleAgentToolStart);
    sessionRef.current.on('agent_tool_end', historyHandlers.handleAgentToolEnd);

    return () => {
      // Cleanup listeners
      sessionRef.current?.off('agent_tool_start', historyHandlers.handleAgentToolStart);
      sessionRef.current?.off('agent_tool_end', historyHandlers.handleAgentToolEnd);
    };
  }, [sessionRef.current]);

  // ... rest of hook
}
```

---

### 4. **Connect Everything in Your UI**

```typescript
// src/app/agent-ui/AgentUIApp.tsx
'use client';

import React from 'react';
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';
import lexiAgent from '@/app/agentConfigs/embeddedBooking/lexiAgent';

function AgentUI() {
  const { connect, disconnect, status } = useRealtimeSession();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleConnect = async () => {
    await connect({
      getEphemeralKey: async () => {
        const res = await fetch('/api/session');
        const data = await res.json();
        return data.client_secret.value;
      },
      initialAgents: lexiAgent, // ✅ Pass agent with tools
      audioElement: audioRef.current!,
    });
  };

  return (
    <div>
      <button onClick={handleConnect}>Connect</button>
      <p>Status: {status}</p>
    </div>
  );
}
```

---

## 🔍 How Tool Execution Works

```
1. User speaks: "Check availability for tomorrow"
   ↓
2. AI decides: "I need to call get_available_slots"
   ↓
3. RealtimeSession fires: 'agent_tool_start' event
   ↓
4. Your handler executes: tool.handler(params)
   ↓
5. Handler returns: JSON.stringify(result)
   ↓
6. RealtimeSession fires: 'agent_tool_end' event
   ↓
7. AI receives result and speaks: "I found 5 available slots..."
```

---

## 🐛 Common Issues & Solutions

### Issue 1: AI Says It's Calling But Nothing Happens

**Symptom:**
```
AI: "Let me check that for you..."
(Nothing happens)
```

**Cause:** Tools not properly defined or handler missing

**Fix:**
```typescript
// ❌ Wrong - Missing handler
{
  type: 'function',
  name: 'check_slots',
  description: 'Check availability',
  parameters: { /* ... */ },
  // Missing handler!
}

// ✅ Correct - Include handler
{
  type: 'function' as const,
  name: 'check_slots',
  description: 'Check availability',
  parameters: { /* ... */ },
  handler: async (params) => {
    // Your logic here
    return JSON.stringify({ success: true });
  },
}
```

---

### Issue 2: Handler Runs But AI Doesn't Get Response

**Symptom:**
```
Console: "[Tool] Handler executed"
(AI waits indefinitely or says "I couldn't get that information")
```

**Cause:** Handler not returning JSON string

**Fix:**
```typescript
// ❌ Wrong - Returning object
handler: async (params) => {
  const result = await fetchData(params);
  return result; // Wrong!
}

// ✅ Correct - Return JSON string
handler: async (params) => {
  const result = await fetchData(params);
  return JSON.stringify(result); // Correct!
}
```

---

### Issue 3: AI Never Calls Tools

**Symptom:**
```
AI just talks but never uses tools
```

**Cause:** Instructions don't mention tools or tools not passed to session

**Fix:**
```typescript
// ✅ Good instructions that encourage tool use
instructions: `You are a booking assistant.

IMPORTANT: Use these tools to help users:
- get_datetime: Get current date and time before checking availability
- get_available_slots: Check open appointment slots
- create_appointment: Book appointments

ALWAYS use tools instead of making up information.
NEVER guess availability - always call get_available_slots first.`,
```

---

### Issue 4: Tool Errors Not Handled

**Symptom:**
```
Console: "TypeError: Cannot read property 'x' of undefined"
(AI gets confused or stops working)
```

**Fix:**
```typescript
// ✅ Always wrap in try-catch and return structured errors
handler: async (params) => {
  try {
    const response = await fetch('/api/booking', {
      method: 'POST',
      body: JSON.stringify({ functionName: 'GetSlots', parameters: params }),
    });

    if (!response.ok) {
      return JSON.stringify({
        error: true,
        message: `API error: ${response.statusText}`,
      });
    }

    const result = await response.json();
    return JSON.stringify(result);

  } catch (error: any) {
    return JSON.stringify({
      error: true,
      message: error.message || 'Unknown error',
    });
  }
},
```

---

## 📊 Debugging Function Calls

### Add Logging to See What's Happening

```typescript
handler: async (params) => {
  console.log('🔧 TOOL CALLED:', toolName);
  console.log('📥 Parameters:', params);
  
  const result = await yourLogic(params);
  
  console.log('📤 Returning result:', result);
  return JSON.stringify(result);
}
```

### Listen for All Events

```typescript
useEffect(() => {
  if (!session) return;

  // Log everything
  session.on('agent_tool_start', (item) => {
    console.log('🟢 Tool Start:', item.name, item.arguments);
  });

  session.on('agent_tool_end', (item) => {
    console.log('🔵 Tool End:', item.name, item.output);
  });

  session.on('error', (error) => {
    console.error('🔴 Session Error:', error);
  });
}, [session]);
```

---

## ✅ Checklist for Working Function Calls

- [ ] Tool has `type: 'function' as const`
- [ ] Tool has descriptive `name` (no spaces, use snake_case)
- [ ] Tool has clear `description` explaining when to use it
- [ ] Parameters have proper schema with types and descriptions
- [ ] `handler` function is async
- [ ] Handler returns `JSON.stringify(result)`
- [ ] Handler has try-catch for error handling
- [ ] Agent instructions mention the tools
- [ ] Tools array passed to RealtimeSession
- [ ] Event listeners set up for `agent_tool_start` and `agent_tool_end`

---

## 🎯 Quick Test Template

Use this minimal example to test if function calling works:

```typescript
const testAgent: RealtimeAgent = {
  name: 'TestBot',
  voice: 'alloy',
  instructions: 'You are a test bot. When user says "test", call the test_function tool.',
  tools: [
    {
      type: 'function' as const,
      name: 'test_function',
      description: 'A simple test function that returns hello',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'A name' },
        },
        required: ['name'],
      },
      handler: async (params: { name: string }) => {
        console.log('✅ TEST FUNCTION CALLED!', params);
        return JSON.stringify({ 
          message: `Hello ${params.name}!`,
          success: true 
        });
      },
    },
  ],
};
```

**Test it:**
1. Connect to the agent
2. Say: "Run a test with name John"
3. Check console for "✅ TEST FUNCTION CALLED!"
4. AI should respond with the result

If this works, your function calling is set up correctly! 🎉

---

## 📚 Key Takeaways

1. **Tools = Array of objects** with `type`, `name`, `description`, `parameters`, and `handler`
2. **Handler must return JSON string** - always use `JSON.stringify()`
3. **Pass tools via agent config** to RealtimeSession
4. **Listen for events** to track tool execution
5. **Instructions should mention tools** to encourage usage
6. **Always handle errors** in your handlers

This is exactly how we built Lexi's function calling in Agent0! 🚀



















