# Twilio Integration - Quick Test Guide

**Ready in 5 Minutes** 🚀

---

## Step 1: Apply Database Migration (30 seconds)

1. Open: https://supabase.com/dashboard
2. Select project: `vihlqoivkayhvxegytlc`
3. Click: **SQL Editor** → **New Query**
4. Copy/paste: `scripts/create-phone-numbers-table.sql`
5. Click: **Run**

✅ **Success:** See `+18504036622` in results

---

## Step 2: Configure Twilio (1 minute)

1. Open: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click: **+18504036622**
3. **Voice Configuration:**
   - A Call Comes In: `https://ascendiaai.fly.dev/api/twilio/incoming-call`
   - Status Callback URL: `https://ascendiaai.fly.dev/api/twilio/status-callback`
4. Click: **Save**

✅ **Production URLs** (Fly.io deployment) - Use these!

---

## Step 3: Verify Deployment (Already Done!)

Your app is deployed to Fly.io:
- ✅ **Main app:** https://ascendiaai.fly.dev
- ✅ **WebSocket:** wss://ascendiaai.fly.dev (shared with Retell)

**For local testing only:**
```bash
npm run dev:full
```

---

## Step 4: Test Call (2 minutes)

1. **Call:** +18504036622
2. **Say:** "I need to book an appointment"
3. **Watch logs** for:
   ```
   [Twilio Call] 🏢 Organization: 00000000...
   [Twilio WS] ✅ Created conversation: xxx for org: 00000000...
   ```

---

## Step 5: Verify Results (1 minute)

1. Open: http://localhost:3000/admin/booking/calls
2. **Check:**
   - ✅ Call appears immediately
   - ✅ Shows correct organization
   - ✅ Transcript visible
   - ✅ Duration recorded
   - ✅ Status: "completed"

---

## 🐛 Quick Fixes

### "Phone number not mapped"
```bash
node scripts/seed-twilio-phone-numbers.js
```

### "Table doesn't exist"
- Go back to Step 1 (apply migration)

### "WebSocket failed"
- Verify `TWILIO_WEBSOCKET_URL=wss://ascendiaai.fly.dev/twilio-media-stream`
- Check Fly.io deployment is running: `fly status`

---

## 📊 What Changed?

| Before | After |
|--------|-------|
| ❌ Default org always | ✅ Phone → org lookup |
| ❌ No DB records | ✅ Saved conversations |
| ❌ No emails | ✅ Post-call notifications |

---

## 🎉 Success = All Green

- ✅ Call connects
- ✅ Correct organization
- ✅ Transcript saved
- ✅ Duration recorded
- ✅ Email sent

**Need details?** See `TWILIO-INTEGRATION-FIXED.md`
