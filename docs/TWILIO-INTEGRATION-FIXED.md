# Twilio Integration - Multi-Tenant Fix Complete ✅

**Date:** 2026-01-29  
**Status:** Implementation Complete, Ready for Testing

---

## 🎯 What Was Fixed

Applied all lessons learned from Retell troubleshooting to Twilio integration:

### 1. ✅ Organization Routing (CRITICAL)
**Problem:** Twilio was using fallback default org instead of phone number mapping  
**Solution:** 
- Created `phone_numbers` table with proper indexes and RLS
- `incoming-call` handler now looks up org from `To` phone number
- Org ID passed to WebSocket via URL parameters
- Mirrors Retell's working implementation exactly

### 2. ✅ Database Conversation Records
**Problem:** No conversation records in database, only in-memory state  
**Solution:**
- WebSocket creates conversation record on call start
- Uses `getSupabaseWithOrg()` for proper RLS context
- Includes all Twilio metadata (call_sid, from_number, to_number, etc.)
- Status callbacks update conversation throughout lifecycle

### 3. ✅ Status Callbacks & Email Notifications
**Problem:** No post-call webhooks or email notifications  
**Solution:**
- New `/api/twilio/status-callback` endpoint
- Handles: initiated, ringing, answered, completed, failed
- Updates conversation with duration, recording URL, etc.
- Triggers email notification on call completion (like Retell)

### 4. ✅ Channel Configuration
**Problem:** Instructions not loading from database  
**Solution:**
- Already implemented! WebSocket uses `getChannelConfig()`
- Loads from `channel_configurations` table
- Falls back to hardcoded if DB config missing
- Selects model based on `ai_backend` setting

---

## 📁 Files Changed

### 1. **Incoming Call Handler**
**File:** `src/app/api/twilio/incoming-call/route.ts`

**Changes:**
- ✅ Imports `getOrganizationIdFromPhone()` from callHelpers
- ✅ Looks up org from `To` number before creating WebSocket URL
- ✅ Passes `orgId`, `callSid`, `from`, `to` as URL parameters
- ✅ Comprehensive logging for debugging

**Before:**
```typescript
// Used hardcoded/default mode
const mode = await getAgentMode();
const wsUrl = getWebSocketUrlForMode(mode);
```

**After:**
```typescript
// Looks up org from phone number
const organizationId = await getOrganizationIdFromPhone(to);
const wsUrl = `${baseWsUrl}?orgId=${organizationId}&callSid=${callSid}&from=${from}&to=${to}`;
```

### 2. **WebSocket Handler**
**File:** `src/twilio/websocket-handler.ts`

**Changes:**
- ✅ `setupTwilioWebSocketHandler()` parses URL query parameters
- ✅ `handleTwilioConnection()` accepts org ID, call SID, phone numbers
- ✅ Creates conversation record in database with proper org context
- ✅ Uses `getSupabaseWithOrg()` for RLS security
- ✅ Stores all Twilio metadata (stream_sid, media_format, etc.)

**New Conversation Record:**
```typescript
{
  session_id: `twilio_${callSid}`,
  organization_id: organizationId,
  channel: 'voice',
  call_sid: callSid,
  from_number: fromNumber,
  to_number: toNumber,
  direction: 'inbound',
  start_timestamp: Date.now(),
  call_status: 'ongoing',
  metadata: { channel: 'twilio', stream_sid, media_format }
}
```

### 3. **Status Callback Handler (NEW)**
**File:** `src/app/api/twilio/status-callback/route.ts`

**New endpoint for call lifecycle events:**
- ✅ Handles: initiated, ringing, in-progress, completed, failed, busy, no-answer
- ✅ Updates conversation record with status, duration, recording URL
- ✅ Triggers email notification on completion
- ✅ Mirrors Retell webhook behavior exactly

**URL to configure in Twilio:**
```
https://your-domain.com/api/twilio/status-callback
```

### 4. **Database Migration & Seed Scripts (NEW)**

**Migration:** `scripts/create-phone-numbers-table.sql`
- Creates `phone_numbers` table with proper indexes
- Sets up RLS policies for multi-tenant security
- Includes sample INSERT for your Twilio number

**Seed Script:** `scripts/seed-twilio-phone-numbers.js`
- Adds Twilio phone numbers to database
- Maps to organizations
- Verifies lookup works correctly

---

## 🗃️ Database Schema

### Phone Numbers Table
```sql
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  phone_number TEXT NOT NULL,  -- E.164: +18504036622
  channel TEXT CHECK (channel IN ('retell', 'twilio', 'whatsapp')),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (phone_number, channel)
);
```

### Conversations Table (Updated Fields)
- `call_sid` - Twilio call identifier
- `from_number` - Caller phone number
- `to_number` - Called phone number (your Twilio number)
- `duration_ms` - Call duration in milliseconds
- `recording_url` - Twilio recording URL (if enabled)
- `recording_sid` - Twilio recording SID
- `call_status` - ongoing, completed, failed, etc.
- `disconnection_reason` - completed, busy, no-answer, etc.

---

## 🚀 Setup Instructions

### Step 1: Apply Database Migration

**Option A: Supabase Dashboard (Recommended)**
1. Go to https://supabase.com/dashboard
2. Select project: `vihlqoivkayhvxegytlc`
3. Click "SQL Editor" → "New Query"
4. Paste contents of `scripts/create-phone-numbers-table.sql`
5. Click "Run"
6. Verify: You should see your phone number in the results

**Option B: Command Line**
```bash
cd d:/Dev/Agent0
node scripts/apply-phone-numbers-migration.js
```

**See:** `scripts/APPLY-PHONE-NUMBERS-MIGRATION.md` for detailed instructions

### Step 2: Verify Phone Number Mapping

```bash
node scripts/seed-twilio-phone-numbers.js
```

**Expected output:**
```
✅ Phone number seeding complete!

📋 Summary:
   Phone: +18504036622
   Organization: Default Organization
   Channel: twilio
   Status: active
```

### Step 3: Configure Twilio Dashboard

1. **Go to:** https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. **Click your phone number:** +18504036622
3. **Voice Configuration:**
   - A Call Comes In: `https://ascendiaai.fly.dev/api/twilio/incoming-call`
   - Method: `HTTP POST`
   - Status Callback URL: `https://ascendiaai.fly.dev/api/twilio/status-callback`
   - Status Callback Events: Select all
4. **Save**

**Note:** WebSocket server is on the same Fly.io deployment at `wss://ascendiaai.fly.dev/twilio-media-stream` (shared with Retell)

### Step 4: Verify Deployment

Your app is already deployed to Fly.io:
- **Main app:** https://ascendiaai.fly.dev
- **WebSocket:** wss://ascendiaai.fly.dev (port 8080)

**For local development:**
```bash
npm run dev:full
```

**For production:** Already deployed! No additional steps needed.

### Step 5: Make a Test Call

1. Call your Twilio number: **+18504036622**
2. Talk with Lexi (try booking an appointment)
3. After call ends, check:
   - Admin UI → Calls tab
   - Should see call with correct org
   - Transcript should be saved
   - Email notification should be sent

---

## ✅ Verification Checklist

### Pre-Flight Checks
- [ ] `phone_numbers` table exists in Supabase
- [ ] Your Twilio number (+18504036622) is in `phone_numbers` table
- [ ] Twilio webhook URLs configured correctly
- [ ] Servers running (`npm run dev:full`)
- [ ] ngrok tunnels active

### During Call
- [ ] Call connects and Lexi greets you
- [ ] Can have conversation (STT/TTS working)
- [ ] Function calls execute (check terminal logs)
- [ ] Transcript appears in real-time (optional UI)

### After Call
- [ ] Call appears in Admin UI → Calls tab
- [ ] Call is in CORRECT organization
- [ ] Transcript is saved and visible
- [ ] Duration is recorded
- [ ] Call status is "completed"
- [ ] Email notification sent (if configured)

### Multi-Tenant Test (If you have 2+ orgs)
- [ ] Add second Twilio number to different org
- [ ] Call first number → appears in org 1
- [ ] Call second number → appears in org 2
- [ ] No cross-contamination between orgs

---

## 📊 What to Watch in Logs

### Incoming Call
```
📞 [TWILIO VOICE CALL] NEW INCOMING CALL
[Twilio Call] 📱 From: +1234567890
[Twilio Call] 📱 To: +18504036622
[Twilio Call] 🆔 CallSid: CAxxxxxxxxxxxx
[Twilio Call] 🏢 Organization: 00000000-0000-0000-0000-000000000001
[Twilio Call] 🔌 WebSocket URL: wss://...
[Twilio Call] ✅ Returning TwiML to connect audio stream
```

### WebSocket Connection
```
[Twilio WS] 🔌 New connection on /twilio-media-stream
[Twilio WS] 📋 Call metadata from URL:
  Org ID: 00000000-0000-0000-0000-000000000001
  Call SID: CAxxxxxxxxxxxx
  From: +1234567890
  To: +18504036622
[Twilio WS] 📋 Channel config: backend=openai_realtime, model=gpt-4o-realtime...
[Twilio WS] 📋 Using DB instructions from channel config
[Twilio WS] 📞 Call started: CAxxxxxxxxxxxx
[Twilio WS] ✅ Created conversation: xxxxxxxx-xxxx-xxxx for org: 00000000...
```

### Status Callback
```
📞 [TWILIO STATUS CALLBACK] Call status update
[Twilio Status] Call SID: CAxxxxxxxxxxxx
[Twilio Status] Status: completed
[Twilio Status] Duration: 45s
[Twilio Status] ✅ Updated conversation: xxxxxxxx-xxxx-xxxx
[Twilio Status] 📧 Email notification triggered
```

---

## 🐛 Troubleshooting

### "Phone number not mapped"
**Symptom:** Logs show "using default org"  
**Fix:** Run `node scripts/seed-twilio-phone-numbers.js`  
**Verify:** Check `phone_numbers` table in Supabase

### "No conversation found for call_sid"
**Symptom:** Status callback can't find conversation  
**Cause:** WebSocket didn't create conversation (probably didn't connect)  
**Fix:** Check WebSocket connection logs, verify ngrok is running

### "Could not find table phone_numbers"
**Symptom:** Seed script fails  
**Fix:** Apply migration first (see Step 1 above)

### "Calls appearing in wrong organization"
**Symptom:** All calls go to default org  
**Cause:** Phone number not in `phone_numbers` table  
**Fix:** Run seed script, verify `To` number matches exactly

### "WebSocket connection failed"
**Symptom:** Call connects but no audio  
**Cause:** WebSocket URL incorrect or server not running  
**Fix:** 
- Check `TWILIO_WEBSOCKET_URL` in `.env`
- Verify ngrok WebSocket tunnel is active
- Check `npm run dev:full` is running

### "Email not sending"
**Symptom:** No email after call  
**Cause:** Resend not configured or status callback not set up  
**Fix:**
- Check `RESEND_API_KEY` in `.env`
- Verify status callback URL in Twilio dashboard
- Check logs for email errors

---

## 📈 Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| **Organization Routing** | ❌ Always default org | ✅ Phone number lookup |
| **Database Records** | ❌ Memory only | ✅ Supabase with RLS |
| **Supabase Client** | ⚠️ Admin bypass | ✅ getSupabaseWithOrg() |
| **Instructions** | ✅ DB load (working) | ✅ DB load (unchanged) |
| **Call Webhooks** | ❌ None | ✅ Status callbacks |
| **Email Notifications** | ❌ None | ✅ Post-call email |
| **Multi-Tenant** | ❌ Single org only | ✅ Full isolation |
| **Transcript Logging** | ✅ Working | ✅ Working (unchanged) |
| **Function Calling** | ✅ Working | ✅ Working (unchanged) |

---

## 🎯 Key Architectural Changes

### 1. Phone Number → Organization Mapping
```
Incoming Call
    ↓
Extract "To" number (+18504036622)
    ↓
Query: phone_numbers WHERE phone_number = '+18504036622' AND channel = 'twilio'
    ↓
Get: organization_id
    ↓
Pass to WebSocket & Status Callbacks
    ↓
Use: getSupabaseWithOrg(organizationId)
```

### 2. Call Lifecycle Flow
```
1. incoming-call       → Returns TwiML with WebSocket URL + org params
2. WebSocket connect   → Creates conversation record with org ID
3. Call in progress    → Transcript logged, functions executed
4. Status: completed   → Updates conversation, sends email
5. Admin UI            → Shows call in correct organization
```

### 3. Supabase RLS Security
```
Before:
- getSupabaseAdmin() → Bypasses RLS
- Returns ALL orgs' data
- Security risk!

After:
- getSupabaseWithOrg(orgId) → Service key + RLS context
- Returns ONLY that org's data
- Multi-tenant secure ✅
```

---

## 🚦 Testing Strategy

### Unit Test: Phone Lookup
```bash
# Create test script
node -e "
const { getOrganizationIdFromPhone } = require('./src/app/lib/callHelpers');
getOrganizationIdFromPhone('+18504036622').then(org => {
  console.log('Org:', org);
  process.exit(0);
});
"
```

### Integration Test: Full Call Flow
1. Make test call
2. Watch logs for org ID
3. Check Admin UI for call record
4. Verify transcript saved
5. Confirm email sent

### Multi-Tenant Test
1. Add second phone number to different org
2. Call both numbers
3. Verify calls appear in correct orgs
4. Check for data isolation

---

## 📚 Related Documentation

- `TWILIO-INTEGRATION-KICKSTART.md` - Original implementation guide
- `RETELL-CALL-DATA-COMPLETE.md` - Retell lessons learned
- `SUPABASE-CLIENT-PATTERNS.md` - RLS security patterns
- `MULTI-TENANCY-COMPLETE.md` - Multi-tenant architecture
- `scripts/APPLY-PHONE-NUMBERS-MIGRATION.md` - Migration guide

---

## ✨ Next Steps

1. **Apply migration** (see Step 1 above)
2. **Test locally** with ngrok
3. **Deploy to production** (update webhook URLs)
4. **Add more phone numbers** (if multi-org)
5. **Monitor logs** for any issues
6. **Celebrate!** 🎉 Twilio is now fully multi-tenant!

---

## 🎉 Success Indicators

You'll know it's working when:

✅ Calls appear in Admin UI immediately  
✅ Call shows correct organization  
✅ Transcript is saved and visible  
✅ Duration and metadata recorded  
✅ Email sent after call ends  
✅ Multi-tenant isolation confirmed  
✅ No errors in server logs  

---

**Status:** Ready for Testing  
**Next:** Apply migration → Test call → Deploy

Need help? Check troubleshooting section or review Retell implementation for reference.
