# Twilio Integration - Deployment Checklist

**Date:** 2026-01-29  
**Target:** ascendiaai.fly.dev

---

## ✅ Pre-Deployment Checklist

### 1. Database Migration (REQUIRED)
- [ ] Applied `scripts/create-phone-numbers-table.sql` in Supabase Dashboard
- [ ] Verified phone number mapping: `+18504036622` → sam.lateeff's Organization
- [ ] Confirmed `phone_numbers` table exists

**How to verify:**
```bash
node scripts/find-organizations.js
# Should show: +18504036622 → sam.lateeff's Organization
```

### 2. Code Changes Ready
- [x] incoming-call handler - Organization lookup from phone number
- [x] WebSocket handler - Creates conversation with org context
- [x] Status callback handler - Call lifecycle tracking
- [x] Async/await syntax fix
- [x] Documentation updated for Fly.io URLs

### 3. Environment Variables (Production)
Check these are set in Fly.io:
- [ ] `OPENAI_API_KEY` - For Realtime API
- [ ] `TWILIO_ACCOUNT_SID` - Your Twilio account
- [ ] `TWILIO_AUTH_TOKEN` - Twilio auth token
- [ ] `TWILIO_PHONE_NUMBER` - +18504036622
- [ ] `SUPABASE_URL` - Database URL
- [ ] `SUPABASE_SERVICE_KEY` - For RLS bypass
- [ ] `RESEND_API_KEY` - For email notifications

**How to check:**
```bash
fly secrets list -a ascendiaai
```

### 4. Twilio Console Configuration
- [ ] Updated webhook URLs to production:
  - Voice: `https://ascendiaai.fly.dev/api/twilio/incoming-call`
  - Status: `https://ascendiaai.fly.dev/api/twilio/status-callback`

---

## 🚀 Deployment Steps

### Step 1: Commit Changes (Optional)
```bash
git add src/app/api/twilio/
git add src/twilio/
git add docs/TWILIO-*.md
git commit -m "feat: Add Twilio multi-tenant integration

- Add organization routing from phone numbers
- Create conversation records in database
- Add status callback webhooks
- Add email notifications
- Update documentation for Fly.io"
```

### Step 2: Deploy to Fly.io
```bash
# Deploy main app + WebSocket server
fly deploy -a ascendiaai

# Check deployment status
fly status -a ascendiaai

# View logs
fly logs -a ascendiaai
```

### Step 3: Verify Deployment
```bash
# Check health
curl https://ascendiaai.fly.dev/health

# Check WebSocket is responding
curl -I https://ascendiaai.fly.dev/
```

---

## 🧪 Post-Deployment Testing

### Test 1: Make a Call
1. **Call:** +18504036622
2. **Expected:** Lexi answers with greeting
3. **Watch logs:** `fly logs -a ascendiaai`
4. **Look for:**
   ```
   [Twilio Call] 🏢 Organization: b445a9c7-af93-4b4a-a975-40d3f44178ec
   [Twilio WS] ✅ Created conversation: xxx
   ```

### Test 2: Check Admin UI
1. **Go to:** https://ascendiaai.fly.dev/admin/booking/calls
2. **Switch org:** sam.lateeff's Organization
3. **Verify:** Call appears with transcript
4. **Check:** Duration, status, metadata all populated

### Test 3: Verify Email
1. **After call ends:** Check your email
2. **Should receive:** Call summary with transcript
3. **Verify:** All details present (duration, summary, etc.)

### Test 4: Multi-Tenant Isolation
1. **Switch org** in dropdown
2. **Verify:** Call ONLY appears in sam.lateeff's org
3. **Check:** Other orgs don't see the call

---

## 🐛 Troubleshooting

### "Phone number not mapped"
**Logs show:** `using default org`  
**Fix:** Apply database migration (Step 1 above)

### "WebSocket connection failed"
**Symptom:** Call connects but no audio  
**Check:**
```bash
fly logs -a ascendiaai | grep "Twilio WS"
# Should see: "Handler registered on /twilio-media-stream"
```

### "No conversation found"
**Symptom:** Status callback can't update  
**Cause:** WebSocket didn't create conversation  
**Check:** WebSocket logs for errors

### "Calls appearing in wrong org"
**Symptom:** Call shows in Default Organization  
**Fix:** Verify phone mapping with `node scripts/find-organizations.js`

---

## 📊 Success Criteria

All of these should be ✅:
- [ ] Call connects and Lexi responds
- [ ] Call appears in correct organization (sam.lateeff's)
- [ ] Transcript is saved and visible
- [ ] Duration and metadata recorded
- [ ] Email notification sent
- [ ] Multi-tenant isolation working
- [ ] No errors in Fly.io logs

---

## 🔄 Rollback Plan (If Needed)

If deployment has issues:

```bash
# Get previous version
fly releases -a ascendiaai

# Rollback to previous release
fly releases rollback <version-number> -a ascendiaai

# Example: fly releases rollback v47 -a ascendiaai
```

---

## 📝 Notes

- **WebSocket Server:** Same deployment as main app
- **Database:** Migration must be applied BEFORE deployment
- **Phone Mapping:** Already updated to sam.lateeff's org
- **Two Deployments:**
  - Retell: `ascendia-websocket.fly.dev`
  - Twilio: `ascendiaai.fly.dev` (this deployment)

---

**Ready to deploy?** 
1. Apply migration ✅ (Already done via update-phone-org script)
2. Deploy: `fly deploy -a ascendiaai`
3. Test with a call
