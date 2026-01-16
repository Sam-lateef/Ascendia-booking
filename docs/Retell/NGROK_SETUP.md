# ngrok Setup for Retell Integration

## Why ngrok?

- **Free tier**: Works well for development, but URLs change on restart
- **Paid plans**: Offer persistent domains (e.g., `yourname.ngrok.io`) - **Recommended for development**
- **Simple**: Easy to use, good documentation

## Installation

### Windows
```powershell
# Using winget
winget install ngrok

# Or download from https://ngrok.com/download
```

### macOS
```bash
brew install ngrok/ngrok/ngrok
```

### Linux
```bash
# Download and install from https://ngrok.com/download
# Or use package manager
```

## Authentication Setup (Required First!)

ngrok requires a free account and authtoken:

1. **Sign up**: https://dashboard.ngrok.com/signup
2. **Get authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Configure ngrok**:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

Once configured, you can use ngrok without authentication.

## Quick Start

### Step 1: Start Your Servers

**Terminal 1 - Next.js + WebSocket:**
```bash
npm run dev:retell
```

### Step 2: Start ngrok Tunnels

**Terminal 2 - Next.js (for webhooks):**
```bash
ngrok http 3000
```

**Terminal 3 - WebSocket (for Retell LLM):**
```bash
ngrok http 8080
```

### Step 3: Configure Retell Dashboard

Copy the URLs from ngrok output:

- **WebSocket URL**: `wss://<ngrok-url-8080>/llm-websocket`
  - Example: `wss://abc123.ngrok-free.app/llm-websocket`
  
- **Webhook URL**: `https://<ngrok-url-3000>/api/retell/webhook`
  - Example: `https://xyz789.ngrok-free.app/api/retell/webhook`

## Persistent Domains (Paid Plans)

If you have an ngrok paid plan, you can use persistent domains:

### Setup Persistent Domain

1. **Login to ngrok**:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

2. **Start with domain**:
   ```bash
   # Terminal 1 - Next.js
   ngrok http 3000 --domain=yourname-api.ngrok.io
   
   # Terminal 2 - WebSocket
   ngrok http 8080 --domain=yourname-ws.ngrok.io
   ```

3. **Configure Retell Dashboard** (one-time setup):
   - WebSocket: `wss://yourname-ws.ngrok.io/llm-websocket`
   - Webhook: `https://yourname-api.ngrok.io/api/retell/webhook`

These URLs **never change**, so you only configure Retell once!

## ngrok Configuration File

Create `ngrok.yml` for easier management:

```yaml
version: "2"
authtoken: YOUR_AUTH_TOKEN

tunnels:
  nextjs:
    addr: 3000
    proto: http
    domain: yourname-api.ngrok.io  # Only if you have paid plan
    
  websocket:
    addr: 8080
    proto: http
    domain: yourname-ws.ngrok.io  # Only if you have paid plan
```

Then start both:
```bash
ngrok start --all
```

## Comparison: ngrok vs Cloudflare Tunnel

| Feature | ngrok Free | ngrok Paid | Cloudflare Free |
|---------|-----------|------------|-----------------|
| Persistent URLs | ❌ | ✅ | ❌ |
| Setup Complexity | Easy | Easy | Medium |
| Cost | Free | $8/month | Free |
| WebSocket Support | ✅ | ✅ | ✅ |
| **Recommendation** | Dev testing | **Best for dev** | Alternative |

## Troubleshooting

### "ngrok: command not found"
- Make sure ngrok is in your PATH
- Or use full path: `C:\path\to\ngrok.exe http 3000`

### WebSocket connection fails
- Ensure you're using `wss://` not `ws://`
- Check that ngrok is forwarding to correct port (8080)
- Verify path: `/llm-websocket`

### URLs change on restart
- This is normal for free tier
- Use paid plan for persistent domains
- Or update Retell dashboard each time (annoying but free)

