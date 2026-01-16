# Retell Production Deployment on Fly.io

## Architecture Options

### Option 1: Separate Fly.io Apps (Recommended - Simpler)

Deploy WebSocket server as a **separate Fly.io app**. This is simpler and keeps concerns separated.

**Apps:**
- `ascendiaai` - Next.js app (port 3000) - handles webhooks
- `ascendiaai-websocket` - WebSocket server (port 8080) - handles Retell LLM

**Pros:**
- ✅ Simpler code (no custom server needed)
- ✅ Independent scaling
- ✅ Easier debugging
- ✅ Can reuse existing WebSocket server code

**Cons:**
- ❌ Two deployments to manage
- ❌ Two Fly.io apps (slightly more cost)

### Option 2: Integrated Custom Server (Advanced)

Integrate WebSocket server into Next.js using a custom server. Everything runs on one port.

**Pros:**
- ✅ Single deployment
- ✅ One port
- ✅ Simpler infrastructure

**Cons:**
- ❌ More complex setup
- ❌ Requires custom server code
- ❌ TypeScript/JavaScript interop complexity

## Recommended: Option 1 (Separate Apps)

### Step 1: Deploy Next.js App (Existing)

Your existing `ascendiaai` app already handles:
- Next.js frontend
- API routes (including `/api/retell/webhook`)
- Port 3000

**No changes needed!**

### Step 2: Create WebSocket Server App

Create a new Fly.io app for the WebSocket server:

**File: `fly-websocket.toml`**
```toml
app = 'ascendiaai-websocket'
primary_region = 'iad'

[build]

[env]
  NODE_ENV = 'production'

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 1
  processes = ['app']

[[services]]
  protocol = 'tcp'
  internal_port = 8080

  [[services.ports]]
    port = 80
    handlers = ['http']
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ['tls', 'http']

[[vm]]
  cpu_kind = 'shared'
  cpus = 1
  memory_mb = 512
```

**File: `Dockerfile.websocket`**
```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:websocket || true  # Build if needed

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/src/retell ./src/retell
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

CMD ["node", "-r", "tsx/register", "src/retell/server.ts"]
```

### Step 3: Deploy WebSocket Server

```bash
# Create new Fly.io app
fly apps create ascendiaai-websocket

# Set secrets
fly secrets set RETELL_API_KEY="your_key" -a ascendiaai-websocket
fly secrets set RETELL_AGENT_ID="your_agent_id" -a ascendiaai-websocket
fly secrets set NEXTJS_BASE_URL="https://ascendiaai.fly.dev" -a ascendiaai-websocket

# Deploy
fly deploy -c fly-websocket.toml -a ascendiaai-websocket
```

### Step 4: Configure Retell Dashboard

Once both apps are deployed:

1. **WebSocket URL**: `wss://ascendiaai-websocket.fly.dev/llm-websocket`
2. **Webhook URL**: `https://ascendiaai.fly.dev/api/retell/webhook`

## Alternative: Option 2 (Integrated Server)

If you prefer a single deployment, see the custom server approach in the codebase. However, this requires:
- Custom `server.js` that combines Next.js + WebSocket
- TypeScript compilation setup
- More complex deployment

**We recommend Option 1 for simplicity.**

## Environment Variables

### Next.js App (`ascendiaai`)
```bash
fly secrets set RETELL_API_KEY="your_key" -a ascendiaai
fly secrets set RETELL_AGENT_ID="your_agent_id" -a ascendiaai
```

### WebSocket App (`ascendiaai-websocket`)
```bash
fly secrets set RETELL_API_KEY="your_key" -a ascendiaai-websocket
fly secrets set RETELL_AGENT_ID="your_agent_id" -a ascendiaai-websocket
fly secrets set NEXTJS_BASE_URL="https://ascendiaai.fly.dev" -a ascendiaai-websocket
```

## Cost

- **Option 1**: 2 apps × ~$2-5/month = $4-10/month
- **Option 2**: 1 app × ~$2-5/month = $2-5/month

The difference is minimal, and Option 1 is much simpler to maintain.
