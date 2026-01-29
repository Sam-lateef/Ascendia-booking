# 🚀 Production Debugging - Quick Start

## ⚡ **Fastest Way to Debug a Failed Booking**

### Step 1: Get the Call ID
- From email notification
- From admin UI: `/admin/booking/calls`
- From user: "It was my last call"

### Step 2: Check Logs
```bash
fly logs -a ascendia-booking | grep "call_xxx"
```

Look for:
- ✅ `APPOINTMENT CREATED SUCCESSFULLY`
- ❌ `APPOINTMENT BOOKING FAILED`

### Step 3: Get Full Call Details
```
GET https://ascendia-booking.fly.dev/api/debug/conversation-state?callId=call_xxx
```

Check:
- `function_calls` array - look for errors
- `conversation_state` - verify all fields are populated
- `stats.booking_attempts` - should be 1 if successful

### Step 4: Identify the Issue

**Missing PatNum?**
→ Patient search failed. Check `GetMultiplePatients` call.

**Missing AptDateTime?**
→ Agent didn't extract date/time. Check conversation_state.

**Missing ProvNum or Op?**
→ Provider/operatory not selected. Check auto-fill logs.

**Error message in result?**
→ OpenDental API rejected the request. Check error details.

---

## 🔥 **Common Issues & Quick Fixes**

### Context Loss (Agent Forgets Info)
**Symptom:** Agent asks for phone again after finding patient

**Quick Check:**
```bash
fly logs -a ascendia-websocket | grep "sessionId"
```

**Expected:** `retell_call_xxx` (consistent)  
**Problem:** `stt_1234567890` (new ID each time)

**Status:** ✅ Fixed in latest deployment

---

### Booking Fails Silently
**Symptom:** Agent says "booked" but nothing created

**Quick Check:**
```bash
fly logs -a ascendia-booking | grep "APPOINTMENT BOOKING FAILED"
```

**Look for:** Error message explaining why

**Common causes:**
- Patient not found (wrong phone number)
- Invalid date format
- No available operatory

---

### Call Not Showing in UI
**Symptom:** Call exists but not in admin dashboard

**Quick Check:**
```bash
# Check if call is in database
fly logs -a ascendia-booking | grep "ConversationState"
```

**Look for:** "Query returned 0 conversations"

**Status:** ✅ Fixed - now uses admin client to bypass RLS

---

## 📊 **What Each Tool Shows**

| Tool | What It Shows | When to Use |
|------|---------------|-------------|
| **Fly Logs** | Real-time events, errors | First step, fastest |
| **Debug API** | Full call data, function calls | Need complete picture |
| **Admin UI** | User-facing view, call summary | Verify what user sees |
| **Retell Log** | LLM requests, latency | Deep dive into AI behavior |

---

## 🎯 **Your Workflow**

1. **User reports issue** → Get call_id from email or UI
2. **Check logs** → See if error was logged
3. **Debug API** → Get full conversation data
4. **Identify issue** → Missing field? Wrong format? API error?
5. **Fix & deploy** → Update code and redeploy
6. **Verify** → Make test call and check logs

---

## 🆘 **Emergency Commands**

### View Last 100 Lines of Logs
```bash
fly logs -a ascendia-booking | head -100
```

### Follow Logs in Real-Time
```bash
fly logs -a ascendia-booking -f
```

### Check App Status
```bash
fly status -a ascendia-booking
```

### Restart App (Last Resort)
```bash
fly apps restart ascendia-booking
```

---

## ✅ **Deployed Features**

- ✅ Enhanced booking failure logging
- ✅ Session context fix (no more memory loss)
- ✅ Debug API endpoint for call inspection
- ✅ RLS fix for conversation queries
- ✅ Simplified email notifications
- ✅ Call summary in admin UI

---

## 📚 **Full Documentation**

See `PRODUCTION-DEBUGGING-GUIDE.md` for:
- Complete log patterns
- Debug API response structure
- All common issues & solutions
- Advanced debugging techniques
- Best practices

---

**Quick Links:**
- Main App: https://ascendia-booking.fly.dev
- Admin UI: https://ascendia-booking.fly.dev/admin/booking/calls
- WebSocket: https://ascendia-websocket.fly.dev
- Logs: `fly logs -a ascendia-booking`
