# WhatsApp Integration - Quick Start Guide

Get WhatsApp working with your AI booking agent in 15 minutes.

## Prerequisites

- Your app deployed on Fly.io (or running locally)
- Docker installed (for Evolution API)
- WhatsApp account with phone number
- Access to admin panel

## Step 1: Deploy Evolution API (5 minutes)

### Option A: Local Development

```bash
# Run Evolution API in Docker
docker run -d \
  --name evolution_api \
  -p 8081:8080 \
  -e AUTHENTICATION_API_KEY=dev_key_12345 \
  -v evolution_data:/evolution/instances \
  atendai/evolution-api:latest

# Verify it's running
curl http://localhost:8081
```

### Option B: Fly.io Production

1. Create `fly-evolution.toml`:

```toml
app = "your-company-evolution-api"
primary_region = "iad"

[build]
  image = "atendai/evolution-api:latest"

[env]
  AUTHENTICATION_API_KEY = "your_secure_random_key_here"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[mounts]
  source = "evolution_data"
  destination = "/evolution/instances"
```

2. Deploy:

```bash
fly deploy --config fly-evolution.toml
```

3. Note your Evolution API URL:
```bash
fly status -a your-company-evolution-api
# Output: https://your-company-evolution-api.fly.dev
```

## Step 2: Configure Environment Variables (2 minutes)

### Local (.env.local)

```bash
EVOLUTION_API_URL=http://localhost:8081
EVOLUTION_API_KEY=dev_key_12345
EVOLUTION_INSTANCE_NAME=BookingAgent
EVOLUTION_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/whatsapp/webhook
```

### Production (Fly.io)

```bash
fly secrets set EVOLUTION_API_URL="https://your-company-evolution-api.fly.dev" -a your-main-app
fly secrets set EVOLUTION_API_KEY="your_secure_random_key_here" -a your-main-app
fly secrets set EVOLUTION_INSTANCE_NAME="BookingAgent" -a your-main-app
fly secrets set EVOLUTION_WEBHOOK_URL="https://your-main-app.fly.dev/api/whatsapp/webhook" -a your-main-app
```

## Step 3: Apply Database Migration (1 minute)

```bash
# Using Supabase CLI
supabase db push

# Or via Supabase Dashboard
# Copy and run SQL from: supabase/migrations/20250106_whatsapp_channel.sql
```

## Step 4: Connect WhatsApp (5 minutes)

### Via Setup Wizard (Recommended)

1. Go to: `https://your-app.fly.dev/setup/whatsapp`
2. Click "Connect WhatsApp"
3. Scan QR code with WhatsApp:
   - Open WhatsApp on your phone
   - Tap Menu (⋮) or Settings
   - Tap "Linked Devices"
   - Tap "Link a Device"
   - Scan the QR code displayed
4. Wait for "✅ Connected Successfully!"

### Via API (Alternative)

```bash
# Create instance
curl -X POST https://your-evolution-api.fly.dev/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: your_api_key" \
  -d '{
    "instanceName": "BookingAgent",
    "qrcode": true
  }'

# Set webhook
curl -X POST https://your-evolution-api.fly.dev/webhook/set/BookingAgent \
  -H "Content-Type: application/json" \
  -H "apikey: your_api_key" \
  -d '{
    "url": "https://your-app.fly.dev/api/whatsapp/webhook",
    "webhook_by_events": true,
    "events": ["MESSAGES_UPSERT"]
  }'
```

## Step 5: Test It! (2 minutes)

1. Send a WhatsApp message to your connected number:
   ```
   Hi, I need to book an appointment
   ```

2. Lexi should respond with:
   ```
   Hi! Welcome to [Your Office]. This is Lexi. How can I help you today?
   ```

3. Check admin dashboard:
   ```
   https://your-app.fly.dev/admin/booking/calls
   ```
   You should see your conversation with a 📱 WhatsApp badge!

## Verification Checklist

- [ ] Evolution API is running and accessible
- [ ] Environment variables are configured
- [ ] Database migration applied
- [ ] WhatsApp QR code scanned successfully
- [ ] Connection status shows "Connected" in admin panel
- [ ] Test message received a response
- [ ] Conversation appears in admin dashboard

## Common Issues & Quick Fixes

### Issue: QR Code Won't Generate

**Fix**:
```bash
# Check Evolution API is running
docker ps | grep evolution
# or
fly status -a your-company-evolution-api
```

### Issue: Webhook Not Receiving Messages

**Fix**:
```bash
# Verify webhook URL is set
curl https://your-evolution-api.fly.dev/instance/fetchInstances?instanceName=BookingAgent \
  -H "apikey: your_api_key"

# Check webhook logs
fly logs -a your-main-app
```

### Issue: Messages Sent But No Response

**Fix**:
1. Check OpenAI API key is valid
2. Verify Supabase connection
3. Check logs: `fly logs -a your-main-app | grep WhatsApp`

## What's Next?

✅ **You're done!** Your WhatsApp channel is live.

### Recommended Next Steps:

1. **Test booking flow**:
   - "Book appointment for tomorrow at 2pm"
   - "Reschedule my appointment to next week"
   - "Cancel my appointment"

2. **Share with team**:
   - Admin panel: `/admin/settings/whatsapp`
   - View conversations: `/admin/booking/calls`

3. **Announce to users**:
   - Add WhatsApp number to website
   - Include in email signature
   - Post on social media

4. **Monitor usage**:
   - Check dashboard daily
   - Review conversation quality
   - Gather feedback

## Advanced Configuration

### Multiple Phone Numbers

To add more WhatsApp numbers, create additional instances:

```bash
curl -X POST https://your-evolution-api.fly.dev/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: your_api_key" \
  -d '{
    "instanceName": "BookingAgent2",
    "qrcode": true
  }'
```

### Custom Greeting

Edit `/src/app/agentConfigs/embeddedBooking/lexiAgentTwilio.ts`:

```typescript
const firstMessageProtocol = `If isFirstMessage is true, say: "Hi! Welcome to ${dentalOfficeInfo.name}. This is Lexi..."`;
```

### Webhook Events

Subscribe to more events:

```bash
curl -X POST https://your-evolution-api.fly.dev/webhook/set/BookingAgent \
  -H "Content-Type: application/json" \
  -H "apikey: your_api_key" \
  -d '{
    "url": "https://your-app.fly.dev/api/whatsapp/webhook",
    "webhook_by_events": true,
    "events": ["MESSAGES_UPSERT", "QRCODE_UPDATED", "CONNECTION_UPDATE"]
  }'
```

## Support

### Need Help?

1. Check full documentation: [`/docs/EVOLUTION_API_INTEGRATION.md`](./EVOLUTION_API_INTEGRATION.md)
2. Evolution API docs: https://doc.evolution-api.com
3. Check admin panel: `/admin/settings/whatsapp`
4. Review logs: `fly logs -a your-app-name`

### Useful Commands

```bash
# Check Evolution API status
curl https://your-evolution-api.fly.dev/instance/connectionState/BookingAgent \
  -H "apikey: your_api_key"

# View app logs
fly logs -a your-main-app

# Restart Evolution API
fly restart -a your-company-evolution-api

# Test webhook manually
curl -X POST https://your-app.fly.dev/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "MESSAGES_UPSERT",
    "data": {
      "key": {"remoteJid": "1234567890@s.whatsapp.net", "fromMe": false},
      "message": {"conversation": "test message"}
    }
  }'
```

## Cost Estimate

| Component | Local | Production |
|-----------|-------|-----------|
| Evolution API | Free | ~$5-10/month (Fly.io) |
| Main App | Free | Your existing cost |
| WhatsApp Messages | Free | Free |
| **Total Added Cost** | **$0** | **~$5-10/month** |

---

**Setup Time**: ~15 minutes  
**Difficulty**: Easy  
**Status**: Production Ready

🎉 **Congratulations!** You now have WhatsApp integrated with your AI booking agent.

