# Retell AI API Reference

Quick reference for Retell AI API endpoints used in the system.

---

## 🔑 Authentication

All API requests require Bearer token authentication:

```bash
Authorization: Bearer key_your_retell_api_key_here
```

Get your API key from: [Retell Dashboard → Settings → API Keys](https://beta.retellai.com/)

---

## 📞 API Endpoints

### Base URL
```
https://api.retellai.com
```

### List Agents
**Get all agents for your account**

```http
GET /v2/list-agents
Authorization: Bearer {api_key}
```

**Response:**
```json
[
  {
    "agent_id": "agent_20cb9a557ba2def03b6b34a18b",
    "agent_name": "Test Clinic A - Voice Agent",
    "voice_id": "daphne",
    "language": "en-US",
    "llm_websocket_url": "wss://ascendiaai-websocket.fly.dev/llm-websocket/test-a",
    "webhook_url": "https://ascendia-booking.fly.dev/api/retell/webhook"
  }
]
```

### Get Agent Details
**Get specific agent by ID**

```http
GET /v2/get-agent/{agent_id}
Authorization: Bearer {api_key}
```

### Create Phone Call
**Initiate an outbound call**

```http
POST /v2/create-phone-call
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "agent_id": "agent_20cb9a557ba2def03b6b34a18b",
  "to_number": "+1234567890",
  "from_number": "+1987654321"
}
```

### Create Web Call
**Initiate a web/browser call**

```http
POST /v2/create-web-call
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "agent_id": "agent_20cb9a557ba2def03b6b34a18b"
}
```

**Response:**
```json
{
  "call_id": "abc123",
  "access_token": "token_xyz...",
  "sample_rate": 24000
}
```

---

## 🔌 WebSocket Connection

### Connection URL
```
wss://api.retellai.com/llm-websocket/{call_id}
```

**Your Custom LLM WebSocket:**
```
wss://ascendiaai-websocket.fly.dev/llm-websocket/{org_slug}
```

Retell automatically appends the `call_id` parameter.

---

## 📨 Webhook Events

Retell sends webhooks to your configured URL for these events:

### Webhook URL
```
https://ascendia-booking.fly.dev/api/retell/webhook
```

### Event Types

#### 1. call_started
Sent when call begins
```json
{
  "event": "call_started",
  "call": {
    "call_id": "abc123",
    "agent_id": "agent_20cb9a557ba2def03b6b34a18b",
    "from_number": "+1234567890",
    "to_number": "+1987654321",
    "start_timestamp": 1706123456789
  }
}
```

#### 2. call_ended
Sent when call ends (includes transcript)
```json
{
  "event": "call_ended",
  "call": {
    "call_id": "abc123",
    "transcript": "Full conversation transcript...",
    "transcript_object": [...],
    "transcript_with_tool_calls": [...],
    "end_timestamp": 1706123456999,
    "disconnection_reason": "user_hangup"
  }
}
```

#### 3. call_analyzed
Sent after call analysis is complete (most comprehensive data)
```json
{
  "event": "call_analyzed",
  "call": {
    "call_id": "abc123",
    // ... all call data plus analysis
  }
}
```

---

## 🛠️ Your Agent

**Agent ID:** `agent_20cb9a557ba2def03b6b34a18b`

**Configuration:**
- **WebSocket:** Set in Retell dashboard (e.g., `wss://ascendiaai-websocket.fly.dev/llm-websocket/test-a`)
- **Webhook:** `https://ascendia-booking.fly.dev/api/retell/webhook`

---

## 🧪 Testing

### Test API Key
```bash
curl -X GET https://api.retellai.com/v2/list-agents \
  -H "Authorization: Bearer key_your_api_key"
```

### Test from Your UI
1. Go to Admin → Settings → Integrations
2. Configure Retell AI with your API key
3. Click "Test Connection"
4. Should see: "Connected successfully. Found 1 agent."

---

## 🔍 Troubleshooting

### Issue: "Found 0 agents"

**Possible causes:**
1. Wrong API endpoint URL → Fixed to use `/v2/list-agents`
2. Wrong API key format
3. API key doesn't have access to agents

**Solution:**
```bash
# Verify agent exists:
curl -X GET https://api.retellai.com/v2/list-agents \
  -H "Authorization: Bearer YOUR_KEY"
```

### Issue: WebSocket won't connect

**Check:**
1. WebSocket server deployed: `fly status --app ascendiaai-websocket`
2. URL format: `wss://` not `ws://`
3. Org slug in map: Check `src/retell/websocket-handler.ts`

### Issue: Webhook not receiving events

**Check:**
1. Main app deployed: `https://ascendia-booking.fly.dev`
2. Webhook endpoint exists: `/api/retell/webhook`
3. Webhook URL configured in Retell agent settings

---

## 📚 Official Documentation

- **Retell API Docs:** https://docs.retellai.com/api-references/overview
- **WebSocket Protocol:** https://docs.retellai.com/api-references/custom-llm
- **Webhook Events:** https://docs.retellai.com/api-references/webhook

---

Last Updated: January 26, 2026
