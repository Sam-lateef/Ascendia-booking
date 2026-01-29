# Retell Quick Start - TL;DR

Get Retell working in 5 steps!

---

## 1️⃣ Deploy WebSocket Server

```powershell
# Windows PowerShell
.\scripts\deploy-websocket.ps1

# Or manually:
fly apps create ascendia-websocket
fly deploy --config fly-websocket.toml --dockerfile Dockerfile.websocket --app ascendia-websocket
```

**Result:** `wss://ascendia-websocket.fly.dev`

---

## 2️⃣ Set Environment Variables

```bash
fly secrets set \
  OPENAI_API_KEY="sk-proj-..." \
  RETELL_API_KEY="your-retell-key" \
  SUPABASE_URL="https://xxx.supabase.co" \
  SUPABASE_ANON_KEY="eyJ..." \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  NEXTJS_BASE_URL="https://your-main-app.fly.dev" \
  --app ascendia-websocket
```

---

## 3️⃣ Configure Retell Dashboard

Login to [Retell AI Dashboard](https://beta.retellai.com/)

### Create Agent:
- **Name**: Ascendia Booking Agent
- **Voice**: Daphne (or your choice)
- **LLM Type**: Custom LLM (WebSocket)
- **WebSocket URL**: `wss://ascendia-websocket.fly.dev/llm-websocket`
  
  ⚠️ **Important**: Don't add `:call_id` - Retell adds it automatically!

### Response Settings:
- Latency: Low
- Interruption: Medium
- Backchannel: Yes

---

## 4️⃣ Get Phone Number (Optional)

In Retell dashboard:
1. **Phone Numbers** → **Add Phone Number**
2. Choose country/area code
3. Select your agent
4. Save

---

## 5️⃣ Test It!

### Option A: Call the Phone Number
Just call it! The agent will answer.

### Option B: Use Retell Dashboard
Click "Test Call" in your agent settings.

### Option C: Monitor Logs
```bash
fly logs --app ascendia-websocket -f
```

---

## ✅ Expected Behavior

When you say: **"I want to book an appointment tomorrow at 9 AM"**

You should see in logs:
```
[Retell WS] Connected for call: abc123
[Retell WS] Processing message: "I want to book an appointment tomorrow at 9 AM"
[Booking API] Request from org: b445a9c7-...
🏥 Auto-filled Op=14 (first active operatory)
✅ CreateAppointment successful
```

And hear: **"Done! You're booked for [service] with Dr. [Name] on [Date] at 9 AM."**

---

## 🔧 Quick Fixes

### WebSocket won't connect
```bash
# Check if running
fly status --app ascendia-websocket

# Restart if needed
fly apps restart ascendia-websocket
```

### Agent doesn't respond
```bash
# Check secrets are set
fly secrets list --app ascendia-websocket

# Should see: OPENAI_API_KEY, RETELL_API_KEY, SUPABASE_URL, etc.
```

### Booking fails
```bash
# Check org has providers/operatories
# In your admin dashboard → Settings → Providers/Operatories
# Make sure is_active = true
```

---

## 📞 URLs You Need

| What | URL | Where to Use |
|------|-----|--------------|
| **WebSocket** | `wss://ascendia-websocket.fly.dev/llm-websocket` | Retell Dashboard → Agent Settings → LLM Configuration |
| **Health Check** | `https://ascendia-websocket.fly.dev/health` | For monitoring |
| **Main App** | `https://your-main-app.fly.dev` | Set as NEXTJS_BASE_URL in Fly secrets |

---

## 🎯 What Changed (No More Hardcoded Values!)

✅ **Before this fix:**
- Retell used external OpenDental API
- Hardcoded `Op=1` and `ProvNum=1`
- Only worked for one org

✅ **Now:**
- Retell uses internal database (same as web chat)
- Dynamic operatory assignment per org
- Multi-org ready
- All channels unified!

---

## 📚 Full Docs

For detailed setup, troubleshooting, and architecture:
👉 See `docs/RETELL-SETUP-GUIDE.md`

---

Need help? Check the logs and the full setup guide!
