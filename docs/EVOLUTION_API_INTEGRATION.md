# Evolution API WhatsApp Integration - Complete Guide

## Overview

This guide provides complete instructions for integrating Evolution API to enable WhatsApp as a communication channel for your AI booking agent.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Communication                       │
│                                                             │
│  WhatsApp User  →  Evolution API  →  Next.js App  →  Lexi  │
│                        (Port 8081)      (Port 3000)         │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **Evolution API** - Self-hosted WhatsApp Business API (separate service)
2. **Next.js App** - Your main application with webhook handlers
3. **Lexi Agent** - AI booking assistant (reuses Twilio SMS logic)
4. **Supabase** - Conversation storage and persistence

## Evolution API Deployment

### Option 1: Docker (Local Development)

```bash
# Run Evolution API in Docker
docker run -d \
  --name evolution_api \
  -p 8081:8080 \
  -e AUTHENTICATION_API_KEY=your_secure_random_key \
  -v evolution_data:/evolution/instances \
  atendai/evolution-api:latest
```

### Option 2: Fly.io (Production)

Create a separate Fly.io app for Evolution API:

1. **Create fly.toml for Evolution API**:

```toml
# fly-evolution.toml
app = "your-app-evolution-api"
primary_region = "iad"

[build]
  image = "atendai/evolution-api:latest"

[env]
  AUTHENTICATION_API_KEY = "your_secure_random_key"

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

2. **Deploy**:

```bash
fly deploy --config fly-evolution.toml
```

3. **Get the URL**:
```bash
fly status -a your-app-evolution-api
# Note the URL: https://your-app-evolution-api.fly.dev
```

## Environment Configuration

### Main App (.env.local or Fly.io Secrets)

```bash
# Evolution API Configuration
EVOLUTION_API_URL=https://your-app-evolution-api.fly.dev
EVOLUTION_API_KEY=your_secure_random_key
EVOLUTION_INSTANCE_NAME=BookingAgent
EVOLUTION_WEBHOOK_URL=https://your-main-app.fly.dev/api/whatsapp/webhook
```

### Set Fly.io Secrets

```bash
# For main app
fly secrets set EVOLUTION_API_URL="https://your-app-evolution-api.fly.dev"
fly secrets set EVOLUTION_API_KEY="your_secure_random_key"
fly secrets set EVOLUTION_INSTANCE_NAME="BookingAgent"
fly secrets set EVOLUTION_WEBHOOK_URL="https://your-main-app.fly.dev/api/whatsapp/webhook"
```

## Initial Setup

### 1. Database Migration

Apply the WhatsApp channel migration:

```bash
# If using Supabase CLI
supabase db push

# Or apply manually via Supabase dashboard
# Run the SQL from: supabase/migrations/20250106_whatsapp_channel.sql
```

### 2. Create WhatsApp Instance

Access your setup wizard:

```
https://your-main-app.fly.dev/setup/whatsapp
```

Or create via API:

```bash
curl -X POST https://your-app-evolution-api.fly.dev/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: your_secure_random_key" \
  -d '{
    "instanceName": "BookingAgent",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

### 3. Configure Webhook

Set webhook URL (automatically done via setup wizard, or manually):

```bash
curl -X POST https://your-app-evolution-api.fly.dev/webhook/set/BookingAgent \
  -H "Content-Type: application/json" \
  -H "apikey: your_secure_random_key" \
  -d '{
    "url": "https://your-main-app.fly.dev/api/whatsapp/webhook",
    "webhook_by_events": true,
    "events": ["MESSAGES_UPSERT"]
  }'
```

### 4. Scan QR Code

1. Go to `/setup/whatsapp` on your app
2. Click "Connect WhatsApp"
3. Scan QR code with WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Tap Menu (⋮) or Settings
   - Tap "Linked Devices"
   - Tap "Link a Device"
   - Scan the QR code

### 5. Verify Connection

Check status in admin panel:

```
https://your-main-app.fly.dev/admin/settings/whatsapp
```

## Testing

### Local Testing

1. **Start Evolution API**:
```bash
docker run -d -p 8081:8080 \
  -e AUTHENTICATION_API_KEY=test_key \
  atendai/evolution-api:latest
```

2. **Start your app**:
```bash
npm run dev:full
```

3. **Use ngrok for webhooks**:
```bash
ngrok http 3000
# Copy the HTTPS URL for webhook configuration
```

4. **Test the flow**:
   - Access `/setup/whatsapp`
   - Scan QR code with WhatsApp
   - Send a test message to your connected number
   - Check admin dashboard for conversation

### Production Testing

1. Deploy both apps to Fly.io
2. Configure webhook URL with production domain
3. Test full booking flow via WhatsApp
4. Monitor logs: `fly logs -a your-app-name`

## API Endpoints

### Webhook Handler

**Endpoint**: `POST /api/whatsapp/webhook`

Receives messages from Evolution API and processes with Lexi.

**Payload Format**:
```json
{
  "event": "MESSAGES_UPSERT",
  "data": {
    "key": {
      "remoteJid": "1234567890@s.whatsapp.net",
      "fromMe": false,
      "id": "message_id"
    },
    "message": {
      "conversation": "I need to book an appointment"
    }
  }
}
```

### Setup API

**Endpoint**: `GET /api/whatsapp/setup?action=check_status`

Check WhatsApp connection status.

**Endpoint**: `POST /api/whatsapp/setup`

Actions: `get_qr_code`, `disconnect`, `set_webhook`

## Evolution API Client

### Usage

```typescript
import { getEvolutionClient } from '@/whatsapp/evolution-client';

const client = getEvolutionClient();

// Send message
await client.sendTextMessage('1234567890@s.whatsapp.net', 'Hello!');

// Check status
const status = await client.getInstanceStatus();

// Get QR code
const qr = await client.getQRCode();
```

### Methods

- `sendTextMessage(to, text)` - Send WhatsApp message
- `getInstanceStatus()` - Check connection status
- `getQRCode()` - Get authentication QR code
- `createInstance(name)` - Create new instance
- `disconnectInstance()` - Disconnect WhatsApp
- `setWebhook(url, events)` - Configure webhook

## Admin Dashboard

### View Conversations

Conversations from all channels (voice, SMS, WhatsApp, web) appear in:

```
/admin/booking/calls
```

Each conversation shows a channel badge:
- 📞 Phone
- 💬 SMS
- 📱 WhatsApp
- 🌐 Web

### Manage Connection

Manage WhatsApp connection at:

```
/admin/settings/whatsapp
```

Features:
- Check connection status
- Reconnect WhatsApp
- Disconnect WhatsApp
- View troubleshooting tips

## Conversation Storage

### Database Schema

WhatsApp conversations are stored in Supabase:

```sql
-- conversations table
{
  session_id: 'whatsapp_1234567890',
  channel: 'whatsapp',
  intent: 'book',
  stage: 'gathering',
  patient_info: {...},
  appointment_info: {...},
  created_at: timestamp,
  updated_at: timestamp
}

-- conversation_messages table
{
  conversation_id: uuid,
  role: 'user' | 'assistant',
  content: 'message text',
  sequence_num: int
}

-- function_calls table
{
  conversation_id: uuid,
  function_name: 'GetAvailableSlots',
  parameters: {...},
  result: {...}
}
```

### Session ID Format

WhatsApp sessions use format: `whatsapp_{phone_number}`

Example: `whatsapp_1234567890`

## Troubleshooting

### Connection Issues

**Problem**: Evolution API not accessible

**Solutions**:
- Check if Evolution API container is running
- Verify EVOLUTION_API_URL is correct
- Test connection: `curl https://your-evolution-api.fly.dev`

**Problem**: QR code not generating

**Solutions**:
- Check Evolution API logs
- Verify API key is correct
- Try recreating instance

### Webhook Issues

**Problem**: Messages not being received

**Solutions**:
- Verify webhook URL is accessible from internet
- Check Evolution API webhook configuration
- Monitor `/api/whatsapp/webhook` logs
- Ensure messages are not from yourself (fromMe: true)

**Problem**: Webhook returns 500 error

**Solutions**:
- Check Supabase connection
- Verify Lexi agent configuration
- Review application logs

### Message Processing Issues

**Problem**: Agent not responding

**Solutions**:
- Check OpenAI API key
- Verify booking API is accessible
- Review function call logs
- Check conversation state in Supabase

**Problem**: Wrong responses

**Solutions**:
- Verify Lexi agent instructions
- Check entity extraction
- Review conversation history
- Test with simpler messages first

## Security

### API Key Protection

- Never commit API keys to repository
- Use Fly.io secrets for production
- Rotate keys periodically
- Use strong random keys (32+ characters)

### Webhook Verification

Consider adding webhook signature verification:

```typescript
// In /api/whatsapp/webhook/route.ts
const signature = req.headers.get('x-evolution-signature');
// Verify signature matches expected value
```

### Phone Number Privacy

- Store phone numbers securely
- Comply with privacy regulations (GDPR, CCPA)
- Provide opt-out mechanism
- Clear conversation history upon request

## Monitoring

### Metrics to Track

- WhatsApp connection uptime
- Message delivery rate
- Response time
- Error rate
- Conversation completion rate

### Logs

Monitor Evolution API logs:
```bash
docker logs evolution_api -f
# or
fly logs -a your-app-evolution-api
```

Monitor main app logs:
```bash
fly logs -a your-app-name
```

### Health Checks

Add health check endpoint:

```typescript
// /api/whatsapp/health/route.ts
export async function GET() {
  const client = getEvolutionClient();
  const status = await client.getInstanceStatus();
  
  return NextResponse.json({
    whatsapp_status: status.instance.status,
    timestamp: new Date().toISOString()
  });
}
```

## Scaling

### Multiple Instances

For multiple WhatsApp numbers, create separate instances:

```typescript
const client1 = new EvolutionAPIClient({
  instanceName: 'BookingAgent1'
});

const client2 = new EvolutionAPIClient({
  instanceName: 'BookingAgent2'
});
```

### Load Balancing

Evolution API can handle multiple webhooks simultaneously. Ensure your Fly.io app has sufficient resources.

### Data Retention

Configure conversation cleanup:

```typescript
// Clean up old WhatsApp conversations after 90 days
// Add to scheduled job
```

## Cost Considerations

### Evolution API

- Self-hosted: Free (pay only for hosting)
- Fly.io: ~$5-10/month for basic setup
- Storage: Minimal (conversation data only)

### WhatsApp

- Using personal number: Free
- WhatsApp Business API: Not required for Evolution API
- No per-message costs

### Comparison

| Channel | Cost per 1000 messages |
|---------|----------------------|
| WhatsApp (Evolution API) | $0 (hosting only) |
| Twilio SMS | ~$7.50 |
| Twilio Voice | ~$20-40 |

## Best Practices

1. **Keep Evolution API Updated**
   - Pull latest Docker image regularly
   - Monitor for security updates

2. **Backup Instance Data**
   - Backup Evolution API volume
   - Store QR code backup securely

3. **Monitor Connection**
   - Set up alerts for disconnection
   - Auto-reconnect mechanism

4. **Test Thoroughly**
   - Test all booking flows via WhatsApp
   - Verify edge cases
   - Test with different phone formats

5. **Provide User Guidance**
   - Include WhatsApp number in website
   - Provide example messages
   - Set expectations for response time

## Migration from Existing System

If migrating from another WhatsApp solution:

1. Export existing conversations
2. Import to Supabase format
3. Update session IDs to `whatsapp_` prefix
4. Test webhook connectivity
5. Gradually switch over

## Support

### Resources

- Evolution API Docs: https://doc.evolution-api.com
- Evolution API GitHub: https://github.com/EvolutionAPI/evolution-api
- Your internal docs: `/docs/README.md`

### Common Questions

**Q: Can I use WhatsApp Business account?**
A: Yes, Evolution API works with both personal and Business accounts.

**Q: How many devices can connect?**
A: WhatsApp supports one primary device + up to 4 linked devices.

**Q: What happens if phone loses internet?**
A: Messages will queue and deliver when reconnected.

**Q: Can I use same number for multiple instances?**
A: No, each WhatsApp number can only link to one instance.

## Next Steps

1. ✅ Complete Evolution API setup
2. ✅ Test end-to-end flow
3. Configure monitoring and alerts
4. Train team on admin dashboard
5. Announce WhatsApp channel to users
6. Monitor initial usage
7. Optimize based on feedback

---

**Last Updated**: January 2025  
**Status**: Production Ready  
**Maintainer**: Your Team


