# Fly.io Deployment Guide

This guide will help you deploy Ascendia AI to Fly.io.

## Prerequisites

1. ✅ GitHub account (you have this)
2. ✅ Fly.io account (created via GitHub)
3. ✅ GitHub repository set up: `https://github.com/Sam-lateef/OpenDental.git`

## Step 1: Install Fly.io CLI

### Windows (PowerShell)
```powershell
# Using PowerShell
iwr https://fly.io/install.ps1 -useb | iex
```

### macOS
```bash
brew install flyctl
```

### Linux
```bash
curl -L https://fly.io/install.sh | sh
```

## Step 2: Login to Fly.io

```bash
fly auth login
```

This will open your browser to authenticate with Fly.io.

## Step 3: Initialize Your App

From your project directory:

```bash
fly launch
```

This command will:
- Ask you to name your app (or use the suggested name)
- Ask which region to deploy to (choose closest to your users)
- Detect your Dockerfile and create `fly.toml` if it doesn't exist
- Optionally deploy immediately (you can skip this with `--no-deploy`)

**Important:** If you already have a `fly.toml` file, it will ask if you want to use it. Say **yes**.

## Step 4: Set Environment Variables

You need to set your secrets on Fly.io (these are sensitive and should NOT be in your code):

### Method 1: Set Secrets via Fly.io Dashboard (Recommended - No CLI Bug)

1. Go to your Fly.io dashboard: https://fly.io/dashboard
2. Select your app: `ascendiaai`
3. Click on **Settings** → **Secrets**
4. Click **Add Secret** for each variable:
   - `OPENAI_API_KEY` = `your-openai-api-key-here`
   - `OPENDENTAL_MOCK_MODE` = `false`
   - `OPENDENTAL_API_BASE_URL` = `https://api.opendental.com/api/v1`
   - `OPENDENTAL_API_KEY` = `ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z`

### Method 2: Set Secrets via CLI (If Dashboard Doesn't Work)

**Note:** If you get a "max goroutines in a pool must be greater than zero" error, try these workarounds:

**Option A: Set secrets without restart (if app is already deployed):**
```bash
# Set all secrets at once (workaround for the bug)
fly secrets set OPENAI_API_KEY="your-key" OPENDENTAL_MOCK_MODE="false" OPENDENTAL_API_BASE_URL="https://api.opendental.com/api/v1" OPENDENTAL_API_KEY="ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z" --no-restart
```

**Option B: Set secrets one at a time:**
```bash
# Required: OpenAI API Key
fly secrets set OPENAI_API_KEY="your-openai-api-key-here" --no-restart

# Optional: OpenDental Configuration
fly secrets set OPENDENTAL_MOCK_MODE="false" --no-restart
fly secrets set OPENDENTAL_API_BASE_URL="https://api.opendental.com/api/v1" --no-restart
fly secrets set OPENDENTAL_API_KEY="ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z" --no-restart

# Then manually restart the app
fly apps restart
```

**Option C: Use environment variables (workaround):**
```bash
# Set via environment variable format
fly secrets set --env OPENAI_API_KEY="your-key"
fly secrets set --env OPENDENTAL_MOCK_MODE="false"
```

**View your secrets:**
```bash
fly secrets list
```

**⚠️ IMPORTANT: After setting secrets, you MUST restart the app:**
```bash
fly apps restart --app ascendiaai
```

**Verify secrets are working:**
Visit your health check endpoint:
```
https://ascendiaai.fly.dev/api/health
```

This will show:
- ✅ If environment variables are set (without exposing values)
- ✅ App status
- ✅ OpenAI API connection status

## Step 5: Verify App Name Match ⚠️ CRITICAL

**Before deploying, make sure the app name in `fly.toml` matches the app where you set secrets!**

**Check your app name:**
```powershell
# Check what app name is in fly.toml
cat fly.toml | grep "app ="
```

**Check which app has secrets:**
```powershell
# Check secrets on ascendiaai
fly secrets list --app ascendiaai

# Check secrets on agent0 (if you still have the old app)
fly secrets list --app agent0
```

**Important:** If `fly.toml` says `app = 'ascendiaai'` but you set secrets on `agent0`, they won't match!

**Fix:**
- Either set secrets on `ascendiaai`: `fly secrets set OPENAI_API_KEY="..." --app ascendiaai`
- Or change `fly.toml` back: `app = 'agent0'`

## Step 6: Deploy Your App

### First Deployment
```bash
fly deploy
```

This will:
- Build your Docker image
- Push it to Fly.io
- Deploy your app

### Subsequent Deployments
After pushing to GitHub, you can deploy via:
1. **GitHub Actions** (automatic - see Step 6)
2. **Manual:** `fly deploy`

## Step 6: Set Up GitHub Actions (Optional but Recommended)

### Create Fly.io API Token

```bash
fly tokens create deploy -x 999999h
```

Copy the entire token (starts with `FlyV1`).

### Add Token to GitHub Secrets

1. Go to your GitHub repository: `https://github.com/Sam-lateef/OpenDental`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FLY_API_TOKEN`
5. Value: Paste your token (including `FlyV1` prefix)
6. Click **Add secret**

### Push to GitHub

```bash
# Make sure you're on main branch
git checkout main

# Add all files
git add .

# Commit
git commit -m "Add Fly.io deployment configuration"

# Push to GitHub
git push origin main
```

The GitHub Action will automatically deploy when you push to `main` branch.

## Step 7: Verify Deployment

```bash
# Check app status
fly status

# View logs
fly logs

# Open your app in browser
fly open
```

## Useful Fly.io Commands

```bash
# View app info
fly info

# View logs (live)
fly logs

# SSH into your app
fly ssh console

# Scale your app
fly scale count 2  # Run 2 instances

# View regions
fly regions list

# Add a region
fly regions add lax

# Remove a region
fly regions remove ord
```

## Troubleshooting

### Build Fails
```bash
# Check build logs
fly logs

# Try building locally first
npm run build
```

### Environment Variables Not Working
```bash
# List your secrets
fly secrets list

# Set a secret again
fly secrets set KEY="value"

# Restart app after setting secrets
fly apps restart
```

### App Not Starting
```bash
# Check logs
fly logs

# Check status
fly status

# Restart app
fly apps restart
```

### Port Issues
Make sure your `fly.toml` has `internal_port = 3000` (Next.js default port).

## Next Steps

1. ✅ Set up custom domain (optional):
   ```bash
   fly certs add yourdomain.com
   ```

2. ✅ Set up monitoring:
   - Fly.io dashboard shows metrics automatically
   - Set up alerts in Fly.io dashboard

3. ✅ Enable auto-scaling:
   ```bash
   fly scale vm shared-cpu-1x --memory 1024
   ```

## Environment Variables Reference

### Required
- `OPENAI_API_KEY` - Your OpenAI API key

### Optional (OpenDental)
- `OPENDENTAL_MOCK_MODE` - Set to `"true"` for mock mode, `"false"` for real API
- `OPENDENTAL_API_BASE_URL` - OpenDental API base URL (default: `https://api.opendental.com/api/v1`)
- `OPENDENTAL_API_KEY` - OpenDental API key (format: `ODFHIR DeveloperKey/CustomerKey`)

## Cost Estimates

Fly.io has a generous free tier:
- **3 shared-cpu-1x VMs** with **256MB RAM** each
- **3GB persistent volume storage**
- **160GB outbound data transfer**

For this Next.js app, you'll likely use:
- **1 VM** with **512MB RAM** ≈ **$0.0000004639/second** ≈ **~$1.20/month**

See [Fly.io Pricing](https://fly.io/docs/about/pricing/) for details.

