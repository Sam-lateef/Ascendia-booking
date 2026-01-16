# Lexi Agent Voice & Personality Configuration Guide

## Overview

This guide shows you where to configure Lexi's voice, temperature, and other personality parameters across different modes.

---

## 📍 Configuration Locations

### 1. **Main Configuration File** 
`src/app/agentConfigs/embeddedBooking/lexiAgent.ts`

This is where all voice and personality settings are centralized:

```typescript
export const LEXI_CONFIG = {
  // Voice Selection (Realtime API voices)
  // Options: 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'
  voice: 'sage', // ← Change voice here
  
  // Temperature: Controls randomness/creativity (0.0 - 2.0)
  // 0.6 = Natural conversation with some variety
  // 0.8 = More creative/varied (default for chat)
  // 1.0 = Balanced creativity and consistency
  temperature: 0.8, // ← Change temperature here
  
  // Max Response Tokens (controls response length)
  maxResponseOutputTokens: 4096, // Realtime API parameter
  maxTokens: 1000, // Non-Realtime API parameter
};
```

---

## 🎤 Available Voices

OpenAI Realtime API voices (use in `LEXI_CONFIG.voice`):

| Voice | Gender | Characteristics |
|-------|--------|-----------------|
| **sage** | Female | Warm, friendly, professional (current) |
| **alloy** | Neutral | Balanced, clear, professional |
| **ash** | Female | Soft, gentle, calming |
| **ballad** | Male | Deep, smooth, authoritative |
| **coral** | Female | Bright, energetic, upbeat |
| **echo** | Male | Clear, measured, confident |
| **shimmer** | Female | Bright, cheerful, enthusiastic |
| **verse** | Male | Warm, conversational, approachable |

### ⚠️ Important: Realtime vs TTS Voices

**These voices are ONLY for Text-to-Speech (TTS), NOT Realtime API:**
- `nova`, `onyx`, `fable`

If you try to use `nova`, `onyx`, or `fable` in Realtime mode, it will fail. Use the voices listed above instead.

### Recommended for Receptionist Role:
- **sage** (current) - Warm and professional ✅
- **coral** - Friendly and energetic
- **shimmer** - Cheerful and welcoming
- **ash** - Gentle and calming

---

## 📏 Response Length vs Instructions Length

### ⚠️ Common Confusion: What does `maxTokens` control?

| Parameter | What It Controls | Length Limit |
|-----------|------------------|--------------|
| **Instructions** | Input prompt/system message | ✅ **No limit** - can be 10,000+ tokens |
| **maxTokens** | OUTPUT response length | ✅ **Should be limited** (1000 tokens ≈ 750 words) |

**Example:**
```
Instructions (10,000 tokens)  →  [Lexi processes]  →  Response (max 1000 tokens)
      ↑                                                        ↑
Long, detailed rules                                   Short, conversational answer
"You are Lexi, you handle                             "Sure! I have 10 AM or 2 PM 
appointments by..."                                    available. Which works for you?"
```

**Why limit response length for voice?**
- Voice responses should be **concise and conversational**
- 1000 tokens ≈ 750 words ≈ 2-3 minutes of speech
- Long responses lose caller attention
- Lexi's instructions already tell her to be brief

**You can make instructions as long as you want** - they don't count toward the response limit.

---

## 🌡️ Temperature Settings

Temperature controls how creative/varied the responses are:

| Temperature | Behavior | Best For |
|-------------|----------|----------|
| **0.3 - 0.5** | Very consistent, predictable | Strict scripts, formal settings |
| **0.6 - 0.7** | Natural with slight variety | Professional conversations (good balance) |
| **0.8** | More creative/varied | Friendly, conversational ✅ **(current)** |
| **1.0** | Balanced creativity | General purpose |
| **1.2 - 2.0** | Very creative, unpredictable | Creative tasks (not recommended for receptionist) |

### Current Setting: `0.8`
- Allows natural conversation variety
- Prevents robotic repetition
- Still maintains professional consistency

---

## 🔧 Where Settings Are Applied

### A. **Realtime Mode** (Browser/WebRTC - Agent UI)

**Configuration File:** `src/app/agent-ui/AgentUIApp.tsx`

Current session configuration (Line ~343):
```typescript
sendEvent({
  type: 'session.update',
  session: {
    turn_detection: { ... },
    input_audio_transcription: { ... },
    // ⚠️ ADD THESE:
    // temperature: LEXI_CONFIG.temperature,
    // max_response_output_tokens: LEXI_CONFIG.maxResponseOutputTokens,
    // voice: LEXI_CONFIG.voice
  },
});
```

**TO APPLY LEXI_CONFIG TO REALTIME MODE:**

1. Import the config at the top of `AgentUIApp.tsx`:
```typescript
import { LEXI_CONFIG } from '@/app/agentConfigs/embeddedBooking/lexiAgent';
```

2. Update the `session.update` event:
```typescript
sendEvent({
  type: 'session.update',
  session: {
    turn_detection: turnDetection,
    input_audio_transcription: {
      model: 'gpt-4o-mini-transcribe',
      language: 'en',
    },
    temperature: LEXI_CONFIG.temperature, // ← ADD THIS
    max_response_output_tokens: LEXI_CONFIG.maxResponseOutputTokens, // ← ADD THIS
    voice: LEXI_CONFIG.voice, // ← ADD THIS
  },
});
```

---

### B. **Non-Realtime Mode** (STT/TTS - Chat/Text)

**Configuration File:** `src/app/agentConfigs/embeddedBooking/lexiAgent.ts`

Already configured automatically in `callLexi()` function (Line ~842):
```typescript
const body: any = {
  model: 'gpt-4o',
  instructions: instructions,
  tools: lexiTools,
  input: cleanInput,
  temperature: LEXI_CONFIG.temperature, // ✅ Already applied
  max_tokens: LEXI_CONFIG.maxTokens, // ✅ Already applied
};
```

---

### C. **Twilio Phone Mode** (if using)

**Configuration File:** `src/twilio/websocket-handler.ts`

Similar to Realtime mode - you'll need to set temperature and voice in the session.update event when initializing the OpenAI Realtime connection.

---

## 🎯 Quick Configuration Changes

### Change Voice Only:
```typescript
// In src/app/agentConfigs/embeddedBooking/lexiAgent.ts
export const LEXI_CONFIG = {
  voice: 'coral', // ← Change from 'sage' to 'coral'
  temperature: 0.8,
  maxResponseOutputTokens: 4096,
  maxTokens: 1000,
};
```

### Make More Predictable (Lower Temperature):
```typescript
export const LEXI_CONFIG = {
  voice: 'sage',
  temperature: 0.6, // ← Lower = more consistent
  maxResponseOutputTokens: 4096,
  maxTokens: 1000,
};
```

### Make More Creative (Higher Temperature):
```typescript
export const LEXI_CONFIG = {
  voice: 'sage',
  temperature: 1.0, // ← Higher = more varied
  maxResponseOutputTokens: 4096,
  maxTokens: 1000,
};
```

### Change Response Length:
```typescript
export const LEXI_CONFIG = {
  voice: 'sage',
  temperature: 0.8,
  maxResponseOutputTokens: 2048, // ← Shorter responses
  maxTokens: 500, // ← Shorter responses (non-Realtime)
};
```

---

## ⚙️ Additional Session Parameters

You can also configure these in the session.update:

```typescript
session: {
  // Voice settings
  voice: LEXI_CONFIG.voice,
  temperature: LEXI_CONFIG.temperature,
  max_response_output_tokens: LEXI_CONFIG.maxResponseOutputTokens,
  
  // Audio format (already optimized for Twilio)
  input_audio_format: 'g711_ulaw',
  output_audio_format: 'g711_ulaw',
  
  // Turn detection (VAD settings)
  turn_detection: {
    type: 'server_vad',
    threshold: 0.97, // Higher = less sensitive to noise
    prefix_padding_ms: 400,
    silence_duration_ms: 1500,
  },
  
  // Transcription
  input_audio_transcription: {
    model: 'gpt-4o-mini-transcribe',
    language: 'en',
  },
}
```

---

## 🧪 Testing Voice Changes

After changing `LEXI_CONFIG.voice`:

1. **Restart your dev server:**
   ```bash
   npm run dev:full
   ```

2. **Test in Agent UI:**
   - Navigate to `/agent-ui`
   - Click "Connect"
   - Speak to hear the new voice

3. **Test different voices:**
   Try each voice and listen for the tone that fits your brand:
   - Professional + Warm → `sage`, `ash`
   - Energetic + Friendly → `coral`, `shimmer`
   - Authoritative + Clear → `ballad`, `echo`

---

## 📝 Summary

**Main Config Location:**
```
src/app/agentConfigs/embeddedBooking/lexiAgent.ts
→ LEXI_CONFIG object
```

**What to Change:**
- **voice**: Voice character ('sage', 'coral', etc.)
- **temperature**: Response creativity (0.6 - 1.0 recommended)
- **maxResponseOutputTokens**: Response length (Realtime)
- **maxTokens**: Response length (Non-Realtime)

**Where It's Applied:**
- ✅ Non-Realtime mode: Automatically applied
- ⚠️ Realtime mode (Agent UI): Needs manual import in `AgentUIApp.tsx`
- ⚠️ Twilio mode: Needs configuration in `websocket-handler.ts`

---

**Last Updated:** December 19, 2025

