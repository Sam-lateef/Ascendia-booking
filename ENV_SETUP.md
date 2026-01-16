# 🔐 Environment Variables Setup

## Overview

Your app uses different environment variables for **local development** vs **production deployment**. This guide ensures everything works in production.

---

## ✅ Quick Setup Checklist

Based on your current `.env` file, you need to **add these missing variables**:

```bash
# Add these to your .env file:
BASE_URL=http://localhost:3000
OPENAI_API_KEY=sk-your-openai-key-here

# Optional - only if using Twilio:
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBSOCKET_URL=ws://localhost:8080/twilio-media-stream
```

---

## 📋 Required Environment Variables

### 1. **Supabase** (Database)

```bash
# Server-side (your current setup - more secure ✅)
SUPABASE_URL=https://vihlqoivkayhvxegytlc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Client-side (alternative - not needed if using server-side)
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**✅ Your Setup:** Using server-side only variables (no `NEXT_PUBLIC_` prefix) - this is more secure!

**📌 How It Works:**
- All code checks `SUPABASE_URL` **first** (server-side)
- Falls back to `NEXT_PUBLIC_SUPABASE_URL` only if server-side missing
- Your `.env` file uses server-side variables exclusively ✅

**📌 For Production (Fly.io):**
```bash
fly secrets set SUPABASE_URL="https://your-project.supabase.co" -a your-app-name
fly secrets set SUPABASE_ANON_KEY="your-anon-key" -a your-app-name
```

---

### 2. **Base URL** (For Internal API Calls)

```bash
# Server-side (recommended for production)
BASE_URL=https://your-app.fly.dev

# OR Client-side (browser will use relative URLs anyway)
NEXT_PUBLIC_BASE_URL=https://your-app.fly.dev
```

**✅ Current Setup:** Supervisor agent checks `BASE_URL` first, then `NEXT_PUBLIC_BASE_URL`, then defaults to `localhost:3000`

**📌 For Production (Fly.io):**
```bash
fly secrets set BASE_URL="https://your-app.fly.dev" -a your-app-name
```

**Why this matters:**
- Supervisor agent makes internal API calls to `/api/booking` and `/api/responses`
- In production, it needs the full URL to call itself
- Without this, supervisor can't execute booking functions

---

### 3. **OpenAI**

```bash
OPENAI_API_KEY=sk-...your-key-here
```

**📌 For Production (Fly.io):**
```bash
fly secrets set OPENAI_API_KEY="sk-your-key" -a your-app-name
```

---

### 4. **Twilio** (If Using Twilio Calls)

```bash
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBSOCKET_URL=wss://your-websocket-server.fly.dev/twilio-media-stream
```

**📌 For Production (Fly.io):**
```bash
fly secrets set TWILIO_ACCOUNT_SID="ACxxxx" -a your-app-name
fly secrets set TWILIO_AUTH_TOKEN="your-token" -a your-app-name
fly secrets set TWILIO_PHONE_NUMBER="+1234567890" -a your-app-name
fly secrets set TWILIO_WEBSOCKET_URL="wss://your-ws.fly.dev/twilio-media-stream" -a your-app-name
```

---

## 🚀 Production Deployment Checklist

### For Main App (`ascendia-booking`)

```bash
# 1. Set Supabase (server-side preferred)
fly secrets set SUPABASE_URL="https://xxxxx.supabase.co" -a ascendia-booking
fly secrets set SUPABASE_ANON_KEY="eyJhbGciOi..." -a ascendia-booking

# 2. Set Base URL (CRITICAL for supervisor agent)
fly secrets set BASE_URL="https://ascendia-booking.fly.dev" -a ascendia-booking

# 3. Set OpenAI
fly secrets set OPENAI_API_KEY="sk-..." -a ascendia-booking

# 4. Verify secrets
fly secrets list -a ascendia-booking
```

### For WebSocket Server (`ascendiaai-websocket`)

```bash
# 1. Set Supabase
fly secrets set SUPABASE_URL="https://xxxxx.supabase.co" -a ascendiaai-websocket
fly secrets set SUPABASE_ANON_KEY="eyJhbGciOi..." -a ascendiaai-websocket

# 2. Set Base URL (points to main app for API calls)
fly secrets set BASE_URL="https://ascendia-booking.fly.dev" -a ascendiaai-websocket

# 3. Set OpenAI
fly secrets set OPENAI_API_KEY="sk-..." -a ascendiaai-websocket

# 4. Set Twilio
fly secrets set TWILIO_WEBSOCKET_URL="wss://ascendiaai-websocket.fly.dev/twilio-media-stream" -a ascendiaai-websocket

# 5. Verify secrets
fly secrets list -a ascendiaai-websocket
```

---

## 🧪 Testing Environment Variables

### Local Testing

1. Your `.env` file should have (variables you already have + new ones):
```bash
# Already have these ✅
SUPABASE_URL=https://vihlqoivkayhvxegytlc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_KEY=eyJhbGciOi...
NEXT_PUBLIC_ADMIN_PASSWORD=your-password

# Add these (if missing):
BASE_URL=http://localhost:3000
OPENAI_API_KEY=sk-...

# Optional - only if using Twilio:
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBSOCKET_URL=ws://localhost:8080/twilio-media-stream
```

2. Run dev server:
```bash
npm run dev:full
```

3. Test supervisor calls:
- Make a test booking via browser UI
- Check console logs for: `[Supervisor] 🔧 Executing CreateAppointment`
- Should work without errors

### Production Testing

After deploying with correct env vars:

1. **Test Admin Dashboard:**
   - Navigate to `/admin/booking/settings`
   - Unlock workflows
   - Click "Sync Instructions"
   - Should succeed ✅

2. **Test Supervisor Agent:**
   - Make a test call via Twilio
   - Check Fly.io logs: `fly logs -a ascendiaai-websocket`
   - Look for: `[Supervisor] ✅ CreateAppointment succeeded`

3. **Test Database Connection:**
   - Switch agent mode in settings
   - Should save successfully ✅

---

## 🔍 Troubleshooting

### Issue: "Supabase not configured"

**Cause:** Missing `SUPABASE_URL` or `SUPABASE_ANON_KEY`

**Fix:**
```bash
fly secrets set SUPABASE_URL="https://xxxxx.supabase.co" -a your-app
fly secrets set SUPABASE_ANON_KEY="eyJhbGciOi..." -a your-app
```

### Issue: "Could not find the table 'public.agent_configurations'"

**Cause:** Database migration not run

**Fix:** Run SQL in Supabase dashboard (see `WORKFLOWS.md` Step 1)

### Issue: Supervisor can't execute booking functions

**Symptoms:** 
- Logs show: `[Supervisor] ❌ Tool error`
- Fetch errors to `/api/booking`

**Cause:** Missing or incorrect `BASE_URL`

**Fix:**
```bash
fly secrets set BASE_URL="https://your-app.fly.dev" -a your-app
fly deploy -a your-app  # Redeploy after setting
```

### Issue: Instructions not loading from database

**Cause:** 
1. Instructions not synced yet
2. `use_manual_instructions` is false

**Fix:**
1. Go to `/admin/booking/settings`
2. Unlock workflows
3. Click "Sync Instructions"
4. Edit and save (this sets `use_manual_instructions = true`)

---

## 📝 Your Current `.env` Structure

Your actual `.env` file (NOT `.env.local`):

```bash
# .env (for development and production)
SUPABASE_URL=https://vihlqoivkayhvxegytlc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_KEY=eyJhbGciOi...
NEXT_PUBLIC_ADMIN_PASSWORD=your-password
BASE_URL=http://localhost:3000  # Add this
OPENAI_API_KEY=sk-...  # Make sure this is set
TWILIO_ACCOUNT_SID=ACxxxx  # If using Twilio
TWILIO_AUTH_TOKEN=your-token  # If using Twilio
TWILIO_PHONE_NUMBER=+1234567890  # If using Twilio
TWILIO_WEBSOCKET_URL=ws://localhost:8080/twilio-media-stream  # If using Twilio
```

**✅ Your setup uses server-side variables** (no `NEXT_PUBLIC_` prefix except for admin password)

**⚠️ Important:** 
- `.env` file is used for both dev and prod
- Make sure `.env` is in `.gitignore` (don't commit secrets!)
- For Fly.io production, use `fly secrets set` instead of `.env`

---

## 🎯 Quick Reference

| Variable | Where Used | Required? | Default |
|----------|-----------|-----------|---------|
| `SUPABASE_URL` | All API routes | ✅ Yes | - |
| `SUPABASE_ANON_KEY` | All API routes | ✅ Yes | - |
| `BASE_URL` | Supervisor agent | ✅ Yes (prod) | `localhost:3000` |
| `OPENAI_API_KEY` | Realtime, Supervisor | ✅ Yes | - |
| `TWILIO_ACCOUNT_SID` | Twilio integration | If using Twilio | - |
| `TWILIO_AUTH_TOKEN` | Twilio integration | If using Twilio | - |
| `TWILIO_PHONE_NUMBER` | Twilio integration | If using Twilio | - |
| `TWILIO_WEBSOCKET_URL` | Twilio webhook | If using Twilio | - |

---

## ✅ Success!

Your environment is now correctly configured for production! 🚀

