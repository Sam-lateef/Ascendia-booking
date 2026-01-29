# Retell Call Logging & Email Notifications - FIXED ✅

## 🐛 Issues Found & Fixed

### Issue #1: Conversations Not Showing in UI
**Root Cause:** Organization mismatch between WebSocket and webhook

- **WebSocket** correctly identified org from URL slug (`/llm-websocket/sam-lateeff/{call_id}`)
- **Webhook** tried to map org by phone number, which wasn't configured
- Webhook fell back to "first org" (wrong org) when creating conversation

**Fix Applied:**
1. ✅ WebSocket now creates conversation in database with correct org when call connects
2. ✅ Webhook now checks for existing conversation before creating new one
3. ✅ Both now use the same organization ID from the URL slug

### Issue #2: Email Notifications Not Sent
**Root Cause:** No email recipients configured for the organization

**Fix Required:**
- Configure email recipients in admin settings

### Issue #3: OpenDental API Calls Failed During Call
**Root Cause:** WebSocket server lacked authentication to call booking API

**Fix Applied:**
- ✅ Added `SUPABASE_SERVICE_KEY` to WebSocket server environment

---

## 📝 Changes Made

### 1. WebSocket Handler (`src/retell/websocket-handler.ts`)
- Added conversation creation when WebSocket connects
- Ensures conversation is created with correct org ID from URL slug
- Prevents webhook from creating duplicate with wrong org

### 2. Webhook Handler (`src/app/api/retell/webhook/route.ts`)
- Modified `handleCallStarted()` to check for existing conversation first
- Uses existing org ID instead of phone number mapping fallback

### 3. Environment Variables
- Added `SUPABASE_SERVICE_KEY` to ascendiaai-websocket app

---

## 🧪 Testing After Deployment

### Step 1: Verify Deployments

```bash
# Check WebSocket server
fly status --app ascendiaai-websocket

# Check main app
fly status --app ascendia-booking

# Test WebSocket health
curl https://ascendiaai-websocket.fly.dev/health
```

### Step 2: Configure Email Recipients

**Go to:** https://ascendia-booking.fly.dev/admin/settings/notifications

1. ✅ Enable Email Notifications (toggle ON)
2. ➕ Add your email address (e.g., `sam.lateeff@gmail.com`)
3. 💾 Click **Save Settings**

### Step 3: Make Test Call

1. Call your Retell phone number
2. Have a conversation (try booking an appointment)
3. Hang up

### Step 4: Verify Results

**Check Conversation in UI:**
- Go to: https://ascendia-booking.fly.dev/admin/booking/calls
- You should see the call listed with:
  - Correct organization (sam-lateeff's Organization)
  - Transcript
  - Duration
  - Call status

**Check Email:**
- Email should arrive within 5-10 seconds
- Subject: `✅ Call Summary: [phone] → [duration]`
- Contains: transcript, duration, cost, performance metrics

**Check Database:**
```sql
-- Verify conversation was saved correctly
SELECT 
  c.call_id,
  o.name as org_name,
  o.slug as org_slug,
  c.from_number,
  c.duration_ms / 1000.0 as duration_sec,
  c.call_successful,
  c.email_sent,
  c.created_at
FROM conversations c
LEFT JOIN organizations o ON c.organization_id = o.id
WHERE c.channel = 'voice'
ORDER BY c.created_at DESC
LIMIT 5;
```

---

## 🔍 How It Works Now

### Call Flow:

1. **User calls Retell number** → Retell receives call
2. **Retell connects to WebSocket** → `wss://ascendiaai-websocket.fly.dev/llm-websocket/sam-lateeff/{call_id}`
3. **WebSocket extracts org slug** → `sam-lateeff` → Maps to org ID: `b445a9c7-af93-4b4a-a975-40d3f44178ec`
4. **WebSocket creates conversation** → Saves to database with correct org ID
5. **User talks with AI** → Conversation happens, tools are called (GetPatient, BookAppointment, etc.)
6. **User hangs up** → Call ends
7. **Retell sends webhook** → `POST /api/retell/webhook` (call_ended event)
8. **Webhook finds existing conversation** → Updates it (doesn't create new one)
9. **Webhook triggers email** → Sends email to org's configured recipients
10. **User sees call in UI** → Listed under correct organization

---

## 📊 Organization Mapping

Your organization is configured in the WebSocket server at:

`src/retell/websocket-handler.ts` (line 372):
```typescript
const ORG_SLUG_MAP: Record<string, string> = {
  'sam-lateeff': 'b445a9c7-af93-4b4a-a975-40d3f44178ec',
  // ... other orgs
};
```

### Retell Agent Configuration

**LLM WebSocket URL:**
```
wss://ascendiaai-websocket.fly.dev/llm-websocket/sam-lateeff/{call_id}
```

**Webhook URL:**
```
https://ascendia-booking.fly.dev/api/retell/webhook
```

---

## 🐛 Troubleshooting

### Calls Not Appearing in UI

```sql
-- Check if call was saved
SELECT * FROM conversations 
WHERE call_id = 'call_XXXXXXXXX';

-- Check organization mapping
SELECT 
  c.call_id,
  c.organization_id,
  o.slug as org_slug,
  o.name as org_name
FROM conversations c
LEFT JOIN organizations o ON c.organization_id = o.id
WHERE c.call_id = 'call_XXXXXXXXX';
```

### Email Not Sent

1. Check if notifications are enabled:
   ```sql
   SELECT 
     name,
     slug,
     notification_settings->'call_ended_email_enabled' as email_enabled,
     notification_settings->'call_ended_recipients' as recipients
   FROM organizations
   WHERE slug = 'sam-lateeff';
   ```

2. Check conversation email status:
   ```sql
   SELECT 
     call_id,
     email_sent,
     email_sent_at,
     email_recipients,
     email_error
   FROM conversations
   WHERE call_id = 'call_XXXXXXXXX';
   ```

3. Check logs:
   ```bash
   fly logs --app ascendia-booking | grep -i email
   ```

### Booking API Errors

If you see "Unauthorized: No token provided" errors during calls:

1. Verify WebSocket has Supabase credentials:
   ```bash
   fly secrets list --app ascendiaai-websocket
   ```

2. Should show:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY` ✅ (newly added)

---

## ✅ Success Criteria

After deployment, you should see:

- [ ] Calls appear in UI under correct organization
- [ ] Transcript is captured and displayed
- [ ] Call duration and cost are recorded
- [ ] Booking API calls work (GetPatient, BookAppointment)
- [ ] Email sent after call ends (if configured)
- [ ] Recording URLs are saved (expire in 10 minutes)

---

**Deployment in progress... Will be ready in ~3-5 minutes!** 🚀
