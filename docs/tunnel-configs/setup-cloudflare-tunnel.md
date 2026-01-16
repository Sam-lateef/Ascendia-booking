# Cloudflare Tunnel Setup Guide

## Option 1: Quick Tunnel (Easiest - Temporary URL)
```powershell
$env:PATH += ";$env:USERPROFILE\bin"
cloudflared tunnel --url http://localhost:3001
```
- No authentication needed
- Get a URL like: `https://random-words.trycloudflare.com`
- Add `/agent-ui?agentConfig=dental` to the end
- URL changes each time you restart

## Option 2: Named Tunnel via Dashboard (Recommended - Permanent URL)

### Step 1: Go to Cloudflare Dashboard
1. Visit: https://dash.cloudflare.com/
2. Go to **Zero Trust** → **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Select **Cloudflared** and click **Next**
5. Give it a name like `agent-ui` and click **Save tunnel**

### Step 2: Install and Run Tunnel
After creating in dashboard, you'll get a command to run. It will look like:
```powershell
cloudflared service install [token-here]
```

### Step 3: Configure Route
In the Cloudflare dashboard:
1. Go to your tunnel → **Public Hostnames**
2. Click **Add a public hostname**
3. Set:
   - **Subdomain**: `agent-ui` (or whatever you want)
   - **Domain**: Choose one of your Cloudflare domains
   - **Service**: `http://localhost:3001`
   - Click **Save hostname**

### Step 4: Access Your App
You'll now have a permanent URL like:
`https://agent-ui.yourdomain.com/agent-ui?agentConfig=dental`

## Option 3: Quick Tunnel with Better Output
Use the script: `.\start-tunnel-with-url.ps1`

