# Cloudflare Tunnel Setup for Retell Integration

This guide explains how to use Cloudflare Tunnel (cloudflared) to expose your local development servers for Retell integration.

## Prerequisites

1. **Install Cloudflare Tunnel**: Download from [cloudflare.com/products/tunnel](https://cloudflare.com/products/tunnel)
   - Or use: `winget install --id Cloudflare.cloudflared` (Windows)
   - Or use: `brew install cloudflared` (macOS)

2. **Verify installation**:
   ```bash
   cloudflared --version
   ```

## Quick Start

### Option 1: Use the Scripts (Recommended)

**Windows (PowerShell):**
```powershell
.\scripts\start-cloudflare-tunnel.ps1
```

**Linux/macOS:**
```bash
chmod +x scripts/start-cloudflare-tunnel.sh
./scripts/start-cloudflare-tunnel.sh
```

### Option 2: Manual Setup

#### Step 1: Start Next.js Development Server
```bash
npm run dev
```
This runs on `http://localhost:3000`

#### Step 2: Start WebSocket Server
In a separate terminal:
```bash
npm run dev:websocket
```
This runs on `http://localhost:8080`

#### Step 3: Start Cloudflare Tunnels

**Terminal 1 - Next.js Tunnel (for webhooks):**
```bash
cloudflared tunnel --url http://localhost:3000
```
Copy the HTTPS URL (e.g., `https://abc123.trycloudflare.com`)

**Terminal 2 - WebSocket Tunnel (for Retell LLM):**
```bash
cloudflared tunnel --url http://localhost:8080
```
Copy the HTTPS URL (e.g., `https://xyz789.trycloudflare.com`)

## Configure Retell Dashboard

1. Go to your Retell agent settings
2. Set **Custom LLM WebSocket URL**: 
   - Take the WebSocket tunnel URL (port 8080)
   - Convert `https://` to `wss://`
   - Add `/llm-websocket` at the end
   - Example: `wss://xyz789.trycloudflare.com/llm-websocket`

3. Set **Agent Level Webhook URL**:
   - Take the Next.js tunnel URL (port 3000)
   - Add `/api/retell/webhook` at the end
   - Example: `https://abc123.trycloudflare.com/api/retell/webhook`

## Important Notes

- **Tunnel URLs change each time**: Cloudflare Tunnel generates new URLs each time you restart. You'll need to update Retell dashboard each time.
- **WebSocket Protocol**: Make sure to use `wss://` (secure WebSocket) not `ws://` for the WebSocket URL.
- **Keep tunnels running**: Both tunnels must stay running while testing. Use separate terminals or the provided scripts.

## Troubleshooting

### Tunnel not connecting
- Make sure both servers (Next.js and WebSocket) are running
- Check that ports 3000 and 8080 are not blocked by firewall
- Verify cloudflared is up to date: `cloudflared update`

### WebSocket connection fails
- Ensure you're using `wss://` not `ws://`
- Check that the WebSocket server is running on port 8080
- Verify the path is correct: `/llm-websocket`

### Webhook not receiving events
- Verify the webhook URL in Retell dashboard matches your Next.js tunnel URL
- Check that `/api/retell/webhook` route exists
- Ensure Next.js server is running on port 3000

## Alternative: Named Tunnels (Persistent URLs)

For persistent URLs that don't change, you can set up named tunnels:

1. **Login to Cloudflare**:
   ```bash
   cloudflared tunnel login
   ```

2. **Create a tunnel**:
   ```bash
   cloudflared tunnel create retell-dev
   ```

3. **Configure tunnel** (create `config.yml`):
   ```yaml
   tunnel: <tunnel-id>
   ingress:
     - hostname: retell-ws.yourdomain.com
       service: http://localhost:8080
     - hostname: retell-api.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

4. **Run tunnel**:
   ```bash
   cloudflared tunnel run retell-dev
   ```

This requires a domain managed by Cloudflare but provides persistent URLs.

