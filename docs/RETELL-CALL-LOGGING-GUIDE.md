# Retell Call Logging Implementation Guide

## Current Database Structure

### 📊 Existing Tables for Call Logging

#### 1. **conversations** table
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  organization_id UUID NOT NULL,
  
  -- Intent & Stage tracking
  intent TEXT CHECK (intent IN ('book', 'reschedule', 'cancel', 'check', 'unknown')),
  stage TEXT CHECK (stage IN ('greeting', 'identifying', 'gathering', 'checking_slots', 'confirming', 'completed')),
  
  -- Extracted info (JSON)
  patient_info JSONB DEFAULT '{}',
  appointment_info JSONB DEFAULT '{}',
  missing_required TEXT[] DEFAULT '{}',
  
  -- Channel tracking
  channel TEXT CHECK (channel IN ('voice', 'sms', 'whatsapp', 'web')),
  
  -- Metadata
  agent_config TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

#### 2. **conversation_messages** table
```sql
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  organization_id UUID NOT NULL,
  
  role TEXT CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  extracted_data JSONB DEFAULT '{}',
  
  sequence_num INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. **function_calls** table
```sql
CREATE TABLE function_calls (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  organization_id UUID NOT NULL,
  
  function_name TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  result JSONB,
  error TEXT,
  duration_ms INTEGER,
  auto_filled_params JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔴 Missing Fields for Retell Calls

### What We Need to Add:

| Field | Purpose | Source |
|-------|---------|--------|
| `call_id` | Retell's unique call identifier | Webhook |
| `agent_id` | Retell agent used for the call | Webhook |
| `from_number` | Caller's phone number | Webhook |
| `to_number` | Called number (your org's number) | Webhook |
| `direction` | 'inbound' or 'outbound' | Webhook |
| `start_timestamp` | Unix timestamp (ms) when call started | Webhook |
| `end_timestamp` | Unix timestamp (ms) when call ended | Webhook |
| `duration_ms` | Call duration in milliseconds | Calculated |
| `disconnection_reason` | Why call ended (user_hangup, etc.) | Webhook |
| `recording_url` | Audio recording URL (10min expiry) | Webhook |
| `transcript` | Full text transcript | Webhook |
| `transcript_object` | Structured transcript with timestamps | Webhook |
| `transcript_with_tool_calls` | Transcript showing function calls | Webhook |
| `call_analysis` | Post-call analysis data (custom) | Webhook `call_analyzed` |
| `call_status` | 'registered', 'ongoing', 'ended', 'error' | Webhook |
| `metadata` | Custom metadata passed to Retell | Webhook |
| `retell_llm_dynamic_variables` | Dynamic variables used in call | Webhook |

---

## 📋 Recommended Migration

### Option 1: Add Retell Fields to `conversations` Table (Recommended)

```sql
-- Migration: 055_retell_call_fields.sql

-- Add Retell-specific fields to conversations table
ALTER TABLE conversations

  -- Retell identifiers
  ADD COLUMN IF NOT EXISTS call_id TEXT,
  ADD COLUMN IF NOT EXISTS agent_id TEXT,
  ADD COLUMN IF NOT EXISTS call_type TEXT CHECK (call_type IN ('phone_call', 'web_call', NULL)),
  
  -- Call participant info
  ADD COLUMN IF NOT EXISTS from_number TEXT,
  ADD COLUMN IF NOT EXISTS to_number TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound', NULL)),
  
  -- Call timing
  ADD COLUMN IF NOT EXISTS start_timestamp BIGINT,
  ADD COLUMN IF NOT EXISTS end_timestamp BIGINT,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  
  -- Call outcome
  ADD COLUMN IF NOT EXISTS call_status TEXT CHECK (call_status IN ('registered', 'ongoing', 'ended', 'error', NULL)),
  ADD COLUMN IF NOT EXISTS disconnection_reason TEXT,
  
  -- Call content (stored for 30 days, then archived)
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS transcript_object JSONB,
  ADD COLUMN IF NOT EXISTS transcript_with_tool_calls JSONB,
  
  -- Analysis & metadata
  ADD COLUMN IF NOT EXISTS call_analysis JSONB,
  ADD COLUMN IF NOT EXISTS retell_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS retell_llm_dynamic_variables JSONB DEFAULT '{}';

-- Indexes for filtering/searching
CREATE INDEX IF NOT EXISTS idx_conversations_call_id ON conversations(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_from_number ON conversations(from_number) WHERE from_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_start_timestamp ON conversations(start_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_channel_status ON conversations(channel, call_status);

-- Comments
COMMENT ON COLUMN conversations.call_id IS 'Retell call ID - unique identifier from Retell AI';
COMMENT ON COLUMN conversations.transcript IS 'Full text transcript from Retell (stored for 30 days)';
COMMENT ON COLUMN conversations.call_analysis IS 'Post-call analysis from Retell (custom extraction fields)';
```

### Option 2: Create Separate `retell_calls` Table (Alternative)

If you want to keep Retell-specific data separate:

```sql
CREATE TABLE retell_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  call_id TEXT UNIQUE NOT NULL,
  agent_id TEXT,
  
  from_number TEXT,
  to_number TEXT,
  direction TEXT,
  
  start_timestamp BIGINT,
  end_timestamp BIGINT,
  duration_ms INTEGER,
  
  call_status TEXT,
  disconnection_reason TEXT,
  
  recording_url TEXT,
  transcript TEXT,
  transcript_object JSONB,
  transcript_with_tool_calls JSONB,
  
  call_analysis JSONB,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Recommendation**: Use Option 1 (add to conversations) because:
- ✅ Unified view of all calls regardless of channel
- ✅ Easier queries in Calls UI
- ✅ Consistent with existing multi-channel design
- ✅ Retell fields are NULL for non-voice channels

---

## 🔌 Webhook Implementation

### Current Webhook Handler Status

**File**: `src/app/api/retell/webhook/route.ts`

**Current Status**: ✅ Structure exists, ❌ Not saving to database

**What Needs Implementation**:

```typescript
// ❌ Current: Just logs
async function handleCallStarted(call: any) {
  console.log('[Retell Webhook] Call started:', call.call_id);
}

// ✅ Needed: Save to database
async function handleCallStarted(call: any) {
  const { db } = await import('@/app/lib/db');
  
  // Create conversation record
  await db
    .from('conversations')
    .insert({
      session_id: `retell_${call.call_id}`,
      organization_id: await getOrgIdFromPhoneNumber(call.to_number),
      channel: 'voice',
      
      // Retell fields
      call_id: call.call_id,
      agent_id: call.agent_id,
      call_type: call.call_type,
      from_number: call.from_number,
      to_number: call.to_number,
      direction: call.direction,
      start_timestamp: call.start_timestamp,
      call_status: 'ongoing',
      retell_metadata: call.metadata,
      retell_llm_dynamic_variables: call.retell_llm_dynamic_variables
    });
}

async function handleCallEnded(call: any) {
  const { db } = await import('@/app/lib/db');
  
  // Update conversation with end data
  await db
    .from('conversations')
    .update({
      end_timestamp: call.end_timestamp,
      duration_ms: call.end_timestamp - call.start_timestamp,
      call_status: 'ended',
      disconnection_reason: call.disconnection_reason,
      
      // Transcripts
      transcript: call.transcript,
      transcript_object: call.transcript_object,
      transcript_with_tool_calls: call.transcript_with_tool_calls,
      
      // Recording (expires in 10 minutes!)
      recording_url: call.recording_url,
      
      completed_at: new Date().toISOString()
    })
    .eq('call_id', call.call_id);
    
  // TODO: Download and store recording before it expires!
  if (call.recording_url) {
    await downloadAndStoreRecording(call.call_id, call.recording_url);
  }
}

async function handleCallAnalyzed(call: any) {
  const { db } = await import('@/app/lib/db');
  
  // Update with post-call analysis
  await db
    .from('conversations')
    .update({
      call_analysis: call.call_analysis
    })
    .eq('call_id', call.call_id);
}
```

---

## 🎯 Retell Webhook Event Fields

### `call_started` Event

```typescript
{
  event: "call_started",
  call: {
    call_id: "Jabr9TXYYJHfvl6Syypi88rdAHYHmcq6",
    agent_id: "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
    call_type: "phone_call",
    from_number: "+12137771234",
    to_number: "+12137771235",
    direction: "inbound",
    call_status: "registered",
    metadata: {},
    retell_llm_dynamic_variables: { customer_name: "John Doe" },
    start_timestamp: 1714608475945
  }
}
```

### `call_ended` Event

```typescript
{
  event: "call_ended",
  call: {
    // ... all fields from call_started, plus:
    end_timestamp: 1714608491736,
    disconnection_reason: "user_hangup", // or "agent_hangup", "error", "transferred"
    
    // Transcripts (3 formats)
    transcript: "Full text transcript...",
    transcript_object: [
      { role: "agent", content: "Hello, how can I help?" },
      { role: "user", content: "I need an appointment" }
    ],
    transcript_with_tool_calls: [
      { role: "agent", content: "Let me check availability" },
      { role: "tool_call", tool_name: "GetAvailableSlots", ... },
      { role: "tool_result", content: "[slots data]" }
    ],
    
    // Recording (EXPIRES IN 10 MINUTES!)
    recording_url: "https://...",
    
    opt_out_sensitive_data_storage: false
  }
}
```

### `call_analyzed` Event (Most Comprehensive)

```typescript
{
  event: "call_analyzed",
  call: {
    // ... all fields from call_ended, plus:
    call_analysis: {
      // Your custom analysis fields defined in Retell dashboard
      // Example:
      appointment_booked: true,
      appointment_date: "2024-01-15",
      patient_name: "John Doe",
      call_summary: "Patient scheduled teeth cleaning",
      sentiment: "positive",
      // ... any custom fields you define
    }
  }
}
```

---

## 🚀 Implementation Steps

### Step 1: Create Migration
```bash
# Create the SQL migration file
touch supabase/migrations/055_retell_call_fields.sql
```

Add the ALTER TABLE statements from Option 1 above.

### Step 2: Apply Migration
```bash
# Apply locally
supabase db reset

# Or apply to production
supabase db push
```

### Step 3: Update Webhook Handler

Modify `src/app/api/retell/webhook/route.ts`:

1. Add database imports
2. Implement `handleCallStarted()` to INSERT
3. Implement `handleCallEnded()` to UPDATE
4. Implement `handleCallAnalyzed()` to UPDATE
5. Add organization routing logic (use phone number mapping)

### Step 4: Handle Recording URLs

**CRITICAL**: Recording URLs expire after 10 minutes!

Options:
- **Download and store**: Fetch recording, upload to your storage (S3, Supabase Storage)
- **Stream directly**: Let users play from Retell URL if accessed within 10 min
- **Ignore recordings**: Just store transcripts (saves storage)

### Step 5: Update Calls UI

Modify `src/app/admin/booking/calls/page.tsx`:

1. Show Retell call fields (phone numbers, duration, status)
2. Add filters for channel (voice/web/sms/whatsapp)
3. Add recording playback (if stored)
4. Display call analysis data
5. Show disconnection reason

### Step 6: Sync Conversation Messages

The WebSocket handler already stores messages via `conversationState.ts`.
Ensure these are linked to the conversation record:

```typescript
// In WebSocket handler, after getting orgId
const conversationId = await createOrGetConversation(callId, orgId);

// Store in callOrgMap for later reference
conversationRecordMap.set(callId, conversationId);
```

---

## 📊 Calls UI Enhancement Ideas

### Current UI Features (from page.tsx)
- ✅ Shows function calls (CreatePatient, CreateAppointment, etc.)
- ✅ Displays patient info and appointment details
- ✅ Conversation transcript
- ✅ Filters and search
- ✅ Statistics

### What to Add:
1. **Call Details Card**:
   - From/To phone numbers
   - Call duration
   - Direction (Inbound/Outbound)
   - Disconnection reason
   
2. **Recording Player**:
   - Audio player for call recordings
   - Download option
   
3. **Post-Call Analysis Section**:
   - Display `call_analysis` fields
   - Visual indicators (appointment_booked: ✅/❌)
   - Sentiment analysis display
   
4. **Channel Badges**:
   - 📞 Voice (Retell)
   - 💬 SMS (Twilio)
   - 📱 WhatsApp
   - 🌐 Web Chat
   
5. **Multi-Org Filtering**:
   - Filter by organization phone number
   - Show which org received the call

---

## 🎯 Quick Start Checklist

- [ ] Run migration 055 to add Retell fields
- [ ] Update webhook handler to save `call_started`
- [ ] Update webhook handler to save `call_ended`
- [ ] Update webhook handler to save `call_analyzed`
- [ ] Add organization routing logic (phone → org mapping)
- [ ] Decide on recording storage strategy
- [ ] Update Calls UI to show Retell data
- [ ] Test with a live Retell call
- [ ] Verify data appears in Calls section
- [ ] Set up post-call analysis fields in Retell dashboard

---

## 📝 Example Post-Call Analysis Fields

Define these in Retell Dashboard → Your Agent → Post-Call Analysis:

```json
{
  "appointment_booked": {
    "type": "boolean",
    "description": "Was an appointment successfully booked?"
  },
  "appointment_date": {
    "type": "string",
    "description": "Date of the booked appointment (YYYY-MM-DD)"
  },
  "patient_name": {
    "type": "string",
    "description": "Patient's full name"
  },
  "call_summary": {
    "type": "string",
    "description": "Brief summary of the call in 1-2 sentences"
  },
  "call_outcome": {
    "type": "enum",
    "options": ["booked", "rescheduled", "canceled", "inquiry_only", "no_action"],
    "description": "Primary outcome of the call"
  },
  "sentiment": {
    "type": "enum",
    "options": ["positive", "neutral", "negative"],
    "description": "Overall patient sentiment"
  },
  "follow_up_needed": {
    "type": "boolean",
    "description": "Does this call require human follow-up?"
  }
}
```

---

## 🔗 Useful Links

- [Retell Webhook Docs](https://docs.retellai.com/features/webhook)
- [Retell Get Call API](https://docs.retellai.com/api-references/get-call)
- [Retell Post-Call Analysis](https://docs.retellai.com/features/post-call-analysis-overview)

---

**Status**: 📝 **IMPLEMENTATION READY**  
**Next Step**: Create migration and update webhook handler
