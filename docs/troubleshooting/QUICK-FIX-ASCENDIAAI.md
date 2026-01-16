# Quick Fix: Create and Deploy Ascendiaai App

## Step 1: Create the App

Since you deleted `agent0` and `fly.toml` says `app = 'ascendiaai'`, you need to create the new app:

```powershell
fly apps create ascendiaai
```

This will:
- Create a new app named `ascendiaai`
- Set up the domain: `ascendiaai.fly.dev`

## Step 2: Set Secrets

After creating the app, set all your secrets:

```powershell
# Set OpenAI API Key
fly secrets set OPENAI_API_KEY="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" --app ascendiaai

# Set OpenDental Configuration
fly secrets set OPENDENTAL_MOCK_MODE="false" --app ascendiaai
fly secrets set OPENDENTAL_API_BASE_URL="https://api.opendental.com/api/v1" --app ascendiaai
fly secrets set OPENDENTAL_API_KEY="ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z" --app ascendiaai
```

**Verify secrets are set:**
```powershell
fly secrets list --app ascendiaai
```

## Step 3: Deploy

Now deploy to the new app:

```powershell
fly deploy --app ascendiaai
```

This will:
- Build your Docker image
- Push it to Fly.io
- Deploy to `ascendiaai`

## Step 4: Verify

After deployment, test these endpoints:

1. **Debug endpoint:** `https://ascendiaai.fly.dev/api/debug-env`
   - Should show `OPENAI_API_KEY` as "set"

2. **Health endpoint:** `https://ascendiaai.fly.dev/api/health`
   - Should show `"OPENAI_API_KEY": "set"` and `"openai.status": "connected"`

3. **Session endpoint:** `https://ascendiaai.fly.dev/api/session`
   - Should return JSON with `client_secret.value`

## Alternative: Use Fly.io Dashboard

If CLI doesn't work, use the dashboard:

1. **Create app:**
   - Go to https://fly.io/dashboard
   - Click **"New App"**
   - Name it: `ascendiaai`
   - Select region: `iad` (or your preferred region)

2. **Set secrets:**
   - Go to your `ascendiaai` app
   - Click **Settings** → **Secrets**
   - Click **Add Secret** for each:
     - `OPENAI_API_KEY` = `your-key`
     - `OPENDENTAL_MOCK_MODE` = `false`
     - `OPENDENTAL_API_BASE_URL` = `https://api.opendental.com/api/v1`
     - `OPENDENTAL_API_KEY` = `ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z`

3. **Deploy:**
   - Go to **Deployments** tab
   - Click **New Deployment**
   - Or use GitHub Actions if you have it set up

## Troubleshooting

**If you get "app not found" error:**
- Make sure you created the app: `fly apps create ascendiaai`
- Or check if it exists: `fly apps list`

**If deployment fails:**
- Check logs: `fly logs --app ascendiaai`
- Make sure secrets are set before deploying
- Verify `fly.toml` has correct app name: `app = 'ascendiaai'`





















