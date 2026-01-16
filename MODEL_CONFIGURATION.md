# Model Configuration - Browser vs Twilio

## Where the Model is Configured

### 🔵 **Twilio (Phone Calls) - ✅ Correct**

**File:** `src/twilio/websocket-handler-standard.ts`
**Line:** 462-463

```typescript
state.openaiWs = new WebSocket(
  'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17',
  {
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  }
);
```

✅ **Model in the WebSocket URL**
✅ **Uses gpt-4o-mini-realtime-preview-2024-12-17**

---

### 🌐 **Browser (Agent-UI) - ⚠️ HARDCODED**

**File:** `src/app/hooks/useRealtimeSession.ts`
**Line:** 146

```typescript
sessionRef.current = new RealtimeSession(rootAgent, {
  transport: new OpenAIRealtimeWebRTC({
    audioElement,
    changePeerConnection: async (pc: RTCPeerConnection) => {
      applyCodec(pc);
      return pc;
    },
  }),
  model: 'gpt-4o-realtime-preview-2025-06-03', // ⚠️ HARDCODED TO gpt-4o
  config: {
    inputAudioFormat: audioFormat,
    outputAudioFormat: audioFormat,
    inputAudioTranscription: {
      model: 'gpt-4o-mini-transcribe',
      language: 'en',
    },
  },
  outputGuardrails: outputGuardrails ?? [],
  context: extraContext ?? {},
});
```

⚠️ **Model in the RealtimeSession config**
⚠️ **Currently HARDCODED to gpt-4o (even for Standard mode!)**

---

## The Problem

When you select **"Standard (Cost-Optimized)"** in the browser agent-ui dropdown, the instructions change but the **model stays as gpt-4o**!

This means:
- ✅ Twilio calls: Use `gpt-4o-mini-realtime` (cost-optimized)
- ❌ Browser testing: Still uses `gpt-4o-realtime` (expensive)

---

## The Fix Needed

The `useRealtimeSession` hook needs to detect which agent is being used and set the model accordingly:

```typescript
// Detect if using Standard mode
const isStandardMode = rootAgent.name === 'lexiChat'; // or check agent config key

sessionRef.current = new RealtimeSession(rootAgent, {
  transport: new OpenAIRealtimeWebRTC({
    audioElement,
    changePeerConnection: async (pc: RTCPeerConnection) => {
      applyCodec(pc);
      return pc;
    },
  }),
  model: isStandardMode 
    ? 'gpt-4o-mini-realtime-preview-2024-12-17'  // Standard mode
    : 'gpt-4o-realtime-preview-2025-06-03',      // Premium mode
  config: {
    inputAudioFormat: audioFormat,
    outputAudioFormat: audioFormat,
    inputAudioTranscription: {
      model: 'gpt-4o-mini-transcribe',
      language: 'en',
    },
  },
  outputGuardrails: outputGuardrails ?? [],
  context: extraContext ?? {},
});
```

---

## Summary

| Location | Where Model is Set | Current Value | Should Be (Standard) |
|----------|-------------------|---------------|---------------------|
| **Twilio** | WebSocket URL (line 463) | ✅ `gpt-4o-mini-realtime-preview-2024-12-17` | ✅ Correct |
| **Browser** | RealtimeSession config (line 146) | ⚠️ `gpt-4o-realtime-preview-2025-06-03` | ❌ Should be `gpt-4o-mini` for Standard |

---

## Impact

**Currently:**
- Twilio Standard mode: ✅ Cost-optimized (`gpt-4o-mini`)
- Browser Standard mode: ❌ Still expensive (`gpt-4o`)

**After fix:**
- Both will use `gpt-4o-mini` for cost optimization! 💰








