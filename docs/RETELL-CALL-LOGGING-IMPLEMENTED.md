# Retell Call Logging - IMPLEMENTED ✅

## What Was Implemented

### ✅ Step 1: Database Migration
**File**: `supabase/migrations/055_retell_call_fields.sql`

Added 21 new columns to `conversations` table:
- Call identifiers: `call_id`, `agent_id`, `call_type`
- Phone numbers: `from_number`, `to_number`, `direction`
- Timing: `start_timestamp`, `end_timestamp`, `duration_ms`
- Status: `call_status`, `disconnection_reason`
- Content: `recording_url`, `transcript`, `transcript_object`, `transcript_with_tool_calls`
- Analysis: `call_analysis`, `retell_metadata`, `retell_llm_dynamic_variables`

**Status**: ✅ Applied to Supabase Cloud

---

### ✅ Step 2: Webhook Handlers Implemented
**File**: `src/app/api/retell/webhook/route.ts`

Implemented three webhook event handlers:

#### 1. `handleCallStarted(call)`
- **Triggers**: When call begins
- **Action**: INSERT new conversation record
- **Maps**: `to_number` → `organization_id` via `phone_numbers` table
- **Creates**: Conversation with `session_id = retell_{call_id}`

#### 2. `handleCallEnded(call)`
- **Triggers**: When call ends
- **Action**: UPDATE conversation with:
  - Three transcript formats (text, structured, with tool calls)
  - Call duration
  - Disconnection reason
  - Recording URL (⚠️ expires in 10 minutes!)
- **Status**: Sets `call_status = 'ended'` and `completed_at`

#### 3. `handleCallAnalyzed(call)`
- **Triggers**: When post-call analysis completes
- **Action**: UPDATE conversation with `call_analysis` JSON
- **Contains**: Custom extraction fields you define in Retell dashboard

---

## 🔧 Configuration Required

### Step 1: Add Phone Number Mappings

Your organizations need phone numbers mapped for routing:

```sql
-- Run in Supabase SQL Editor
INSERT INTO phone_numbers (phone_number, organization_id, channel, friendly_name) VALUES
  -- Replace with your actual Retell phone numbers and org IDs
  ('+15551234567', 'b445a9c7-af93-4b4a-a975-40d3f44178ec', 'retell', 'Sam Lateeff Org Main Line'),
  ('+15559876543', '1c26bf4a-2575-45e3-82eb-9f58c899e2e7', 'retell', 'Test Clinic A Support');
```

**To get your org IDs**:
```sql
SELECT id, name, slug FROM organizations;
```

**To get your Retell phone numbers**:
- Go to Retell Dashboard → Phone Numbers
- Copy the numbers in E.164 format (e.g., `+15551234567`)

---

### Step 2: Configure Retell Webhook URL

In Retell Dashboard:

1. **Account-Level Webhook** (recommended for multi-org):
   - Go to: Retell Dashboard → Settings → Webhooks
   - Set Webhook URL: `https://ascendiaai.fly.dev/api/retell/webhook`
   
2. **OR Agent-Level Webhook** (per agent):
   - Go to: Retell Dashboard → Agents → Your Agent → Settings
   - Set Agent Webhook URL: `https://ascendiaai.fly.dev/api/retell/webhook`

---

### Step 3: Set Up Post-Call Analysis (Optional but Recommended)

Define custom extraction fields in Retell Dashboard:

1. Go to: Retell Dashboard → Agents → Your Agent → Post-Call Analysis
2. Add these fields:

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
    "description": "Brief 1-2 sentence summary of the call"
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

## 🧪 Testing

### Test 1: Make a Test Call

1. Call your Retell phone number
2. Have a brief conversation
3. Hang up

### Test 2: Check Database

```sql
-- View recent calls
SELECT 
  id,
  call_id,
  from_number,
  to_number,
  direction,
  call_status,
  duration_ms,
  disconnection_reason,
  created_at
FROM conversations
WHERE channel = 'voice'
ORDER BY created_at DESC
LIMIT 10;

-- Check if transcript was saved
SELECT 
  call_id,
  LENGTH(transcript) as transcript_length,
  call_analysis
FROM conversations
WHERE call_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

### Test 3: Check Webhook Logs

Watch your deployed app logs for webhook events:

```bash
# For Fly.io deployment
fly logs --app ascendiaai

# Look for these logs:
# [Retell Webhook] Received event: call_started for call: xxx
# [Retell Webhook] ✅ Created conversation: xxx for call: xxx
# [Retell Webhook] ✅ Updated conversation: xxx with call end data
# [Retell Webhook] ✅ Updated conversation with post-call analysis
```

---

## 📊 Viewing Call Data in Admin UI

Current Status: Calls UI exists but needs updates to show Retell fields.

**File to update**: `src/app/admin/booking/calls/page.tsx`

**What to add**:
1. Display `from_number` / `to_number`
2. Show call duration (formatted)
3. Display `call_status` badge
4. Show `disconnection_reason`
5. Add audio player for `recording_url` (if not expired)
6. Display `call_analysis` fields in a card
7. Filter by channel (voice/sms/web/whatsapp)

---

## 📋 Data Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. Call Starts                                      │
│    Retell → webhook: call_started                   │
│    ↓                                                │
│    handleCallStarted()                              │
│    - Maps to_number → organization_id               │
│    - INSERT conversations table                     │
│    - session_id = retell_{call_id}                  │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. During Call                                      │
│    WebSocket handler processes messages             │
│    - Links to same session_id                       │
│    - Stores messages in conversation_messages       │
│    - Tracks function calls                          │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. Call Ends                                        │
│    Retell → webhook: call_ended                     │
│    ↓                                                │
│    handleCallEnded()                                │
│    - UPDATE conversations                           │
│    - Add transcript (3 formats)                     │
│    - Add recording_url (10min expiry!)              │
│    - Set call_status = 'ended'                      │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 4. Analysis Complete (few seconds later)            │
│    Retell → webhook: call_analyzed                  │
│    ↓                                                │
│    handleCallAnalyzed()                             │
│    - UPDATE conversations                           │
│    - Add call_analysis JSON                         │
│    - Contains custom extraction fields              │
└─────────────────────────────────────────────────────┘
                    ↓
                View in Calls UI
```

---

## ⚠️ Important Notes

### Recording URL Expiration
- Recording URLs from Retell expire after **10 minutes**
- Options:
  1. **Download and store**: Implement recording download in `handleCallEnded()`
  2. **Use Retell storage**: Keep recordings in Retell (accessible via API)
  3. **Ignore recordings**: Just use transcripts

### Organization Routing
- Uses `phone_numbers` table to map calls to organizations
- If no mapping found, falls back to first active organization
- **Critical**: Add your phone numbers to `phone_numbers` table!

### Webhook Security
- Webhook signature verification implemented via Retell SDK
- Only processes requests with valid `x-retell-signature` header
- Always returns 200 OK (prevents Retell retries)

---

## 🎯 Next Steps

### Immediate (Required):
- [ ] Add phone number mappings to `phone_numbers` table
- [ ] Configure webhook URL in Retell Dashboard
- [ ] Make a test call
- [ ] Verify data appears in `conversations` table

### Soon (Recommended):
- [ ] Set up post-call analysis fields in Retell
- [ ] Update Calls UI to display Retell data
- [ ] Decide on recording storage strategy
- [ ] Add call statistics/analytics to dashboard

### Future (Nice to Have):
- [ ] Automated recording downloads
- [ ] Call quality monitoring
- [ ] Real-time call status notifications
- [ ] Integration with CRM/notification systems

---

## 🔗 Related Documentation

- **Setup Guide**: `docs/RETELL-CALL-LOGGING-GUIDE.md` (Complete reference)
- **Retell Docs**: https://docs.retellai.com/features/webhook
- **Migration File**: `supabase/migrations/055_retell_call_fields.sql`
- **Webhook Handler**: `src/app/api/retell/webhook/route.ts`

---

**Status**: ✅ **READY FOR TESTING**  
**Date**: 2026-01-27  
**Implementation**: Complete - Awaiting configuration & testing
