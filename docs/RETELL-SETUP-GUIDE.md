# Retell AI Setup Guide

Complete guide for setting up Retell AI voice calls with your booking system.

---

## 📋 Overview

Retell AI provides voice call capabilities. Your system has a WebSocket server that handles Retell connections and routes them through your unified booking API.

### Architecture

```
Retell AI Platform → WebSocket (Fly.io) → /api/booking → Supabase
```

All channels (Retell, Twilio, Web Chat, WhatsApp) use the **same booking logic** now!

---

## 🚀 Quick Setup

### 1. Get Retell API Credentials

1. Sign up at [Retell AI](https://www.retellai.com/)
2. Create a new agent in the Retell dashboard
3. Get your credentials:
   - **Retell API Key** - Found in Settings → API Keys
   - **Retell Agent ID** - Found in your agent's settings

### 2. Deploy WebSocket Server to Fly.io

Your WebSocket server needs to be publicly accessible. Deploy it to Fly.io:

#### Create Fly.io App for WebSocket

```bash
# Install flyctl if not already installed
# Windows: winget install flyctl
# Mac: brew install flyctl
# Linux: curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login

# Create a new app for the WebSocket server
fly apps create ascendia-websocket

# Set secrets (environment variables)
fly secrets set \
  OPENAI_API_KEY="your-openai-api-key" \
  RETELL_API_KEY="your-retell-api-key" \
  SUPABASE_URL="your-supabase-url" \
  SUPABASE_ANON_KEY="your-supabase-anon-key" \
  SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-key" \
  NEXTJS_BASE_URL="https://your-main-app.fly.dev" \
  --app ascendia-websocket

# Deploy the WebSocket server
fly deploy \
  --config fly-websocket.toml \
  --dockerfile Dockerfile.websocket \
  --app ascendia-websocket
```

#### Create `fly-websocket.toml`

Create this file in your project root:

```toml
# fly-websocket.toml - Fly.io configuration for WebSocket server
app = 'ascendia-websocket'
primary_region = 'iad'

[build]
  dockerfile = "Dockerfile.websocket"

[deploy]
  strategy = 'immediate'
  max_unavailable = 1

[env]
  NODE_ENV = 'production'
  PORT = '8080'
  HOSTNAME = '0.0.0.0'

# WebSocket service configuration
[[services]]
  protocol = 'tcp'
  internal_port = 8080

  [[services.ports]]
    port = 80
    handlers = ['http']

  [[services.ports]]
    port = 443
    handlers = ['tls', 'http']

  # Health check for the WebSocket server
  [[services.http_checks]]
    interval = '30s'
    timeout = '5s'
    grace_period = '10s'
    method = 'GET'
    path = '/health'

[[vm]]
  cpu_kind = 'shared'
  cpus = 1
  memory_mb = 512
```

After deployment, you'll get a URL like: `wss://ascendia-websocket.fly.dev`

### 3. Configure Retell Agent

In the Retell dashboard, configure your agent:

#### General Settings
- **Name**: Ascendia Booking Agent
- **Voice**: Choose your preferred voice (e.g., "Daphne" for friendly receptionist)
- **Language**: English (US)

#### LLM Configuration
- **LLM Type**: Custom LLM (WebSocket)
- **WebSocket URL**: `wss://ascendia-websocket.fly.dev/llm-websocket`
  
  **Important**: The `:call_id` parameter is automatically added by Retell!
  Your server expects: `/llm-websocket/:call_id`
  
  Retell will connect to: `wss://ascendia-websocket.fly.dev/llm-websocket/abc123`

#### Response Settings
- **Response Latency**: Low (for faster responses)
- **Interruption Sensitivity**: Medium
- **Enable Backchannel**: Yes (for natural conversation)

#### Advanced Settings
- **Auto Reconnect**: Enabled
- **Enable Call Details**: Enabled

### 4. Create Retell Phone Number (Optional)

If you want inbound calls:

1. Go to **Phone Numbers** in Retell dashboard
2. Click **Add Phone Number**
3. Choose your country/area code
4. Select your agent from the dropdown
5. Save

Now people can call that number to reach your booking agent!

---

## 🔧 Environment Variables

### Required for WebSocket Server

Add these to your `.env` file for local development:

```env
# ================================
# RETELL CONFIGURATION
# ================================
RETELL_API_KEY=your_retell_api_key_here
RETELL_WEBSOCKET_PORT=8080

# ================================
# OPENAI (Required for agent)
# ================================
OPENAI_API_KEY=sk-proj-...

# ================================
# SUPABASE (For call logging and multi-tenancy)
# ================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ================================
# NEXT.JS API BASE URL
# ================================
# Local development
NEXTJS_BASE_URL=http://localhost:3000

# Production (after deploying main app)
# NEXTJS_BASE_URL=https://your-main-app.fly.dev
```

### For Fly.io Deployment

Set these as Fly secrets (shown in step 2 above):
- `OPENAI_API_KEY`
- `RETELL_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTJS_BASE_URL` (your main Next.js app URL)

---

## 🧪 Testing Locally

### 1. Start Both Servers

```bash
# Terminal 1: Start main Next.js app
npm run dev

# Terminal 2: Start WebSocket server
npm run dev:websocket

# Or use one command:
npm run dev:full
```

Your servers will run at:
- **Next.js App**: http://localhost:3000
- **WebSocket**: ws://localhost:8080

### 2. Use Ngrok for Testing (Temporary)

Retell needs a public URL. Use ngrok for local testing:

```bash
# Install ngrok: https://ngrok.com/download

# Expose your local WebSocket server
ngrok http 8080

# You'll get a URL like: https://abc123.ngrok.io
```

**Configure Retell Dashboard:**
- WebSocket URL: `wss://abc123.ngrok.io/llm-websocket`

**Note**: Ngrok URLs change on each restart. For permanent solution, deploy to Fly.io!

### 3. Test a Call

1. Call your Retell phone number (if configured)
2. Or use the Retell dashboard's "Test Call" feature
3. Watch your terminal for logs:
   ```
   [Retell WS] Connected for call: abc123
   [Retell WS] Processing message for call abc123: "I want to book an appointment"
   [Booking API] Request from org: b445a9c7-...
   🏥 Auto-filled Op=14 (first active operatory)
   ```

---

## 📞 Making Outbound Calls

You can also make outbound calls programmatically:

```typescript
// Example API call to start an outbound Retell call
const response = await fetch('https://api.retellai.com/v1/create-phone-call', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    agent_id: 'your-agent-id',
    to_number: '+1234567890',
    from_number: 'your-retell-number',
  }),
});
```

See: `src/app/api/retell/create-web-call/route.ts` for web call examples.

---

## 🔄 How It Works

### Call Flow

1. **User calls** your Retell number
2. **Retell AI** handles:
   - Speech-to-Text (STT)
   - Text-to-Speech (TTS)
   - Voice activity detection
3. **Your WebSocket** receives text transcripts
4. **Your agent** (`embeddedBooking/greetingAgentSTT.ts`) processes the request
5. **Booking API** (`/api/booking`) executes functions
6. **Response** sent back to Retell → User hears it

### Multi-Tenancy Support

Each call is automatically routed to the correct organization:

```typescript
// In websocket-handler.ts
const { getCachedDefaultOrganizationId } = await import('../app/lib/callHelpers');
const orgId = await getCachedDefaultOrganizationId();

// Load org-specific channel config
const channelConfig = await getRetellChannelConfig(orgId);
```

Each organization can have different:
- Providers/doctors
- Operatories/rooms
- Business rules
- Custom instructions

---

## 🛠️ Troubleshooting

### Issue: Retell says "Unable to connect"

**Solution:**
1. Check WebSocket server is running: `curl https://ascendia-websocket.fly.dev/health`
2. Verify URL in Retell dashboard ends with `/llm-websocket` (no `:call_id`)
3. Check Fly.io logs: `fly logs --app ascendia-websocket`

### Issue: Calls connect but agent doesn't respond

**Solution:**
1. Check OPENAI_API_KEY is set: `fly secrets list --app ascendia-websocket`
2. Check NEXTJS_BASE_URL points to your main app
3. Look for errors in logs: `fly logs --app ascendia-websocket --region iad`

### Issue: Booking functions fail

**Solution:**
1. Verify SUPABASE_URL and keys are set correctly
2. Check organization has active providers/operatories
3. Monitor `/api/booking` logs in main app

### Issue: "Op parameter missing"

**Solution:**
- This should be auto-fixed now! The system auto-assigns the first active operatory.
- If still seeing this, check your operatories table has `is_active = true` records.

### Issue: Ngrok URL stops working

**Solution:**
- Ngrok free URLs expire after session ends
- For permanent solution: Deploy to Fly.io
- Or get ngrok paid plan for static URLs

---

## 📊 Monitoring

### Check WebSocket Server Status

```bash
# View logs
fly logs --app ascendia-websocket

# Check health
curl https://ascendia-websocket.fly.dev/health

# Monitor real-time
fly logs --app ascendia-websocket -f
```

### Check Call Logs in Dashboard

All calls are logged to Supabase `conversations` table:
1. Go to your admin dashboard
2. Navigate to **Calls** section
3. View transcripts, durations, and outcomes

---

## 🔐 Security

### API Keys
- **Never commit** API keys to git
- Use Fly secrets for production
- Use `.env` file for local (add to `.gitignore`)

### WebSocket Security
- Always use `wss://` (secure WebSocket)
- Fly.io handles TLS certificates automatically
- Retell authenticates via their platform

### Organization Isolation
- Multi-tenancy ensures org data separation
- Each call automatically scoped to correct org
- RLS (Row Level Security) enforced in Supabase

---

## 📈 Scaling

### Current Limits
- Fly.io free tier: 3 shared VMs
- Retell free tier: Check their pricing

### To Scale Up
```bash
# Increase VM memory
fly scale memory 1024 --app ascendia-websocket

# Add more VMs
fly scale count 2 --app ascendia-websocket

# Use larger VM
fly scale vm shared-cpu-2x --app ascendia-websocket
```

---

## 📝 Additional Resources

- **Retell AI Docs**: https://docs.retellai.com/
- **Fly.io Docs**: https://fly.io/docs/
- **Your WebSocket Code**: `src/retell/websocket-handler.ts`
- **Agent Config**: `src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts`
- **Booking API**: `src/app/api/booking/route.ts`

---

## ✅ Checklist

Before going live:

- [ ] Retell API key obtained
- [ ] Retell agent created and configured
- [ ] WebSocket server deployed to Fly.io
- [ ] All environment variables set in Fly secrets
- [ ] WebSocket URL configured in Retell dashboard
- [ ] Test call successful
- [ ] Booking functions working (check logs)
- [ ] Phone number purchased (if needed)
- [ ] Call logging verified in Supabase
- [ ] Multi-org tested (if applicable)

---

Last Updated: January 26, 2026

Need help? Check the troubleshooting section or review the logs!
