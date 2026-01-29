# Production Debugging Guide

## 🎯 Overview

This guide explains how to debug Retell call issues in production using logs, debug endpoints, and admin UI.

---

## 🔍 **Method 1: Real-Time Logs (Fastest)**

### View Logs from All Services

```bash
# Main app logs
fly logs -a ascendia-booking

# WebSocket server logs
fly logs -a ascendia-websocket

# Follow logs in real-time
fly logs -a ascendia-booking -f

# Filter by specific text
fly logs -a ascendia-booking | grep "Booking API"
fly logs -a ascendia-booking | grep "CreateAppointment"
```

### Key Log Patterns to Search For

#### 1. Appointment Booking Success
```bash
fly logs -a ascendia-booking | grep "APPOINTMENT CREATED SUCCESSFULLY"
```

**What to look for:**
```
[Booking API] ✅ APPOINTMENT CREATED SUCCESSFULLY: {
  sessionId: "retell_call_abc123",
  patientNum: 123,
  dateTime: "2026-01-29 10:00:00",
  provider: 1,
  operatory: 2,
  result: { ... }
}
```

#### 2. Appointment Booking Failures
```bash
fly logs -a ascendia-booking | grep "APPOINTMENT BOOKING FAILED"
```

**What to look for:**
```
[Booking API] ❌ APPOINTMENT BOOKING FAILED: {
  sessionId: "retell_call_abc123",
  error: "Missing required parameter: PatNum",
  parameters: { AptDateTime: "...", ... },
  autoFilled: { ... },
  stack: "..."
}
```

#### 3. Context Loss Issues
```bash
fly logs -a ascendia-websocket | grep "sessionId"
```

**What to look for:**
- Verify sessionId is consistent: `retell_call_abc123` (good)
- If you see `stt_1234567890` (bad - means context will be lost)

#### 4. Conversation State
```bash
fly logs -a ascendia-booking | grep "ConversationState"
```

**What to look for:**
```
[ConversationState] Query returned X conversations
[ConversationState] Querying for date=2026-01-28, org=...
```

---

## 🛠️ **Method 2: Debug API Endpoint**

### Access Call Details via API

**Endpoint:**
```
GET https://ascendia-booking.fly.dev/api/debug/conversation-state?callId=call_xxx
```

**Or by sessionId:**
```
GET https://ascendia-booking.fly.dev/api/debug/conversation-state?sessionId=retell_call_xxx
```

**Authentication:**
You need to be logged in to the admin panel (cookie-based auth).

### Using cURL

```bash
# Replace YOUR_SESSION_COOKIE with actual cookie from browser
curl -H "Cookie: your-session-cookie-here" \
  "https://ascendia-booking.fly.dev/api/debug/conversation-state?callId=call_fc08d45c1f24e9a87c2aa07453e"
```

### Response Structure

```json
{
  "debug_info": {
    "session_id": "retell_call_fc08d45c1f24e9a87c2aa07453e",
    "call_id": "call_fc08d45c1f24e9a87c2aa07453e",
    "created_at": "2026-01-28T08:51:15.959692Z",
    "channel": "voice",
    "call_status": "ended"
  },
  "conversation": {
    "duration_sec": "91.9350000000000000",
    "disconnection_reason": "user_hangup",
    "transcript": "...",
    "recording_url": "https://..."
  },
  "call_analysis": {
    "call_summary": "...",
    "user_sentiment": "Neutral",
    "call_successful": true,
    "custom_analysis_data": {
      "Phone Number": 6194563960,
      "patient_name": "John Doe",
      "appointment date": "January 29th",
      "appointment type": "Cleaning"
    }
  },
  "conversation_state": {
    "patientInfo": {
      "PatNum": 123,
      "FName": "John",
      "LName": "Doe",
      "WirelessPhone": "6194563960"
    },
    "appointmentInfo": {
      "AptDateTime": "2026-01-29 10:00:00",
      "ProvNum": 1,
      "Op": 2
    }
  },
  "messages": [
    {
      "role": "agent",
      "content": "Hi! Welcome to...",
      "created_at": "..."
    }
  ],
  "function_calls": [
    {
      "function_name": "GetMultiplePatients",
      "parameters": { "Phone": "6194563960" },
      "result": { "success": true, "data": [...] },
      "success": true,
      "created_at": "..."
    },
    {
      "function_name": "CreateAppointment",
      "parameters": {
        "PatNum": 123,
        "AptDateTime": "2026-01-29 10:00:00",
        "ProvNum": 1,
        "Op": 2
      },
      "result": { "error": "..." },
      "success": false,
      "created_at": "..."
    }
  ],
  "stats": {
    "total_messages": 15,
    "total_function_calls": 3,
    "booking_attempts": 1,
    "patient_searches": 1
  }
}
```

### What to Check

#### ✅ Successful Booking Indicators
- `function_calls` array contains `CreateAppointment` with `success: true`
- `conversation_state` has complete `patientInfo` and `appointmentInfo`
- `call_analysis.call_successful: true`
- No error messages in function call results

#### ❌ Booking Failure Indicators
- `function_calls` has `CreateAppointment` with `success: false`
- `result.error` field explains why it failed
- `conversation_state` is missing required fields (PatNum, AptDateTime, etc.)
- Multiple `GetMultiplePatients` calls (agent can't find patient)
- `stats.booking_attempts > 1` (multiple failed attempts)

---

## 📊 **Method 3: Admin UI**

### View Call Details in Dashboard

1. Go to: `https://ascendia-booking.fly.dev/admin/booking/calls`
2. Find the call (default shows today's calls)
3. Click "View" to see full details

### What the UI Shows

**Call Summary Card:**
- Call duration
- Sentiment badge (Positive/Neutral/Negative)
- Success badge (✓ Successful / ✗ Failed)
- Call summary (prominent section)
- Disconnection reason
- Voicemail status

**Call Details:**
- Full transcript
- Audio player for recording
- Link to Retell public log
- Custom analysis data (extracted fields)

**Missing Information:**
- If call doesn't appear: Check RLS/database issues
- If transcript is empty: Check webhook data capture
- If analysis is missing: Check `call_analyzed` webhook event

---

## 🚨 **Common Issues & Solutions**

### Issue 1: Agent Forgets Patient Information

**Symptoms:**
- Agent asks for phone number again after finding patient
- Agent forgets appointment date/time
- Conversation history not maintained

**Debug Steps:**
1. Check WebSocket logs for sessionId:
   ```bash
   fly logs -a ascendia-websocket | grep "retell_call"
   ```
2. Verify sessionId is consistent (not changing to `stt_*` format)
3. Check conversation_state via debug API

**Root Cause:**
- New sessionId generated per turn (fixed in latest deployment)

**Solution:**
- ✅ Already fixed in `websocket-handler.ts` and `greetingAgentSTT.ts`

---

### Issue 2: Appointment Booking Fails

**Symptoms:**
- Agent says "I've booked your appointment" but nothing created
- Error in logs but agent doesn't tell user
- Multiple booking attempts with same data

**Debug Steps:**
1. Find call in logs:
   ```bash
   fly logs -a ascendia-booking | grep "APPOINTMENT BOOKING FAILED"
   ```
2. Check error message in logs
3. Use debug API to see function_calls array
4. Check conversation_state for missing fields

**Common Causes:**
- Missing required parameter (PatNum, AptDateTime, ProvNum, Op)
- Invalid date format (must be `YYYY-MM-DD HH:MM:SS`)
- Patient not found in database
- Operatory not active
- Provider not available

**Solutions:**
- Check parameter extraction in conversation_state
- Verify patient exists: `GetMultiplePatients` call succeeded
- Check if operatory auto-fill worked (logs show "Auto-filled Op=...")
- Review LLM extraction fallback logs

---

### Issue 3: Call Not Appearing in Admin UI

**Symptoms:**
- Made a call, got email, but call doesn't show in `/admin/booking/calls`
- Empty conversations array from API

**Debug Steps:**
1. Verify call exists in database:
   ```bash
   # SSH into main app
   fly ssh console -a ascendia-booking
   
   # Run SQL query (you'll need to connect to Supabase directly)
   ```
   
2. Check API response:
   ```bash
   # Get today's calls
   curl "https://ascendia-booking.fly.dev/api/conversations?date=2026-01-28"
   ```

3. Check RLS (Row Level Security):
   ```bash
   fly logs -a ascendia-booking | grep "ConversationState"
   ```

**Root Cause:**
- Using wrong Supabase client (anon vs. admin)
- RLS blocking server-side queries

**Solution:**
- ✅ Fixed in `conversationState.ts` - now uses `getSupabaseWithOrg()`

---

### Issue 4: Email Not Received

**Symptoms:**
- Call completed but no email notification

**Debug Steps:**
1. Check webhook received:
   ```bash
   fly logs -a ascendia-booking | grep "call_ended"
   ```

2. Check email sending logs:
   ```bash
   fly logs -a ascendia-booking | grep "sendCallEndedEmail"
   ```

3. Verify Resend API key is set:
   ```bash
   fly secrets list -a ascendia-booking | grep RESEND
   ```

**Root Cause:**
- Missing RESEND_API_KEY or RESEND_FROM_EMAIL in Fly.io secrets

**Solution:**
```bash
fly secrets set RESEND_API_KEY="re_xxx" -a ascendia-booking
fly secrets set RESEND_FROM_EMAIL="noreply@yourdomain.com" -a ascendia-booking
```

---

## 📝 **Best Practices for Debugging**

### 1. Start with Logs (Fastest)
Always check logs first - they're real-time and show exactly what happened.

```bash
# Terminal 1: Main app logs
fly logs -a ascendia-booking -f

# Terminal 2: WebSocket logs
fly logs -a ascendia-websocket -f

# Terminal 3: Make test call
```

### 2. Use Debug Endpoint for Details
When logs show an issue, use the debug endpoint to get the full picture:
- All messages in conversation
- All function calls with parameters and results
- Conversation state (extracted fields)

### 3. Cross-Reference with Admin UI
Verify what the user sees matches what the database has.

### 4. Check Retell Public Log
Every call has a public log URL in the database:
```
https://dxc03zgurdly9.cloudfront.net/{hash}/public.log
```

This shows:
- All LLM requests/responses
- Function call invocations
- Latency for each step
- Errors from LLM or tools

### 5. Test Locally First
Before deploying, test the exact scenario locally:
```bash
# Start dev server
npm run dev

# Start WebSocket server
cd src/retell && npx tsx server.ts

# Make test call and watch logs
```

---

## 🔧 **Advanced Debugging**

### SSH into Production

```bash
# Main app
fly ssh console -a ascendia-booking

# WebSocket server
fly ssh console -a ascendia-websocket
```

### Check Environment Variables

```bash
fly secrets list -a ascendia-booking
```

### Monitor Resource Usage

```bash
fly status -a ascendia-booking
fly status -a ascendia-websocket
```

### View Metrics

```bash
fly dashboard ascendia-booking
```

---

## 📞 **Quick Debugging Checklist**

When a booking fails in production:

1. [ ] Check logs for "APPOINTMENT BOOKING FAILED"
2. [ ] Get call_id or session_id from user/email
3. [ ] Use debug API endpoint to get full call data
4. [ ] Review function_calls array for errors
5. [ ] Check conversation_state for missing fields
6. [ ] Verify patient exists (GetMultiplePatients succeeded)
7. [ ] Check if sessionId was consistent throughout call
8. [ ] Review Retell public log for LLM/tool errors
9. [ ] Check admin UI to verify what user sees
10. [ ] Test same scenario locally if reproducible

---

## 🚀 **Next Steps**

After identifying the issue:

1. **Fix in code** - Update agent configs, tools, or API handlers
2. **Test locally** - Reproduce issue and verify fix
3. **Deploy** - `fly deploy -a ascendia-booking`
4. **Verify** - Make test call and check logs
5. **Document** - Add findings to this guide or decision records

---

## 📚 **Related Documentation**

- `RETELL-CALL-LOGGING-GUIDE.md` - Database schema for call data
- `SUPABASE-CLIENT-PATTERNS.md` - Security patterns for database access
- `EMAIL-NOTIFICATIONS-TEST-NOW.md` - Email configuration
- `MULTI-TENANCY-COMPLETE.md` - Organization context handling

---

**Last Updated:** 2026-01-28  
**Status:** ✅ All debugging tools deployed and tested
