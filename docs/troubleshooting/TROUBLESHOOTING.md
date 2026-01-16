# Troubleshooting Fly.io Deployment

## App Doesn't Connect After Setting Secrets - "No ephemeral key provided by the server"

### Step 1: Check the Session API Endpoint

The error "No ephemeral key provided by the server" means the `/api/session` endpoint is failing.

**Test the endpoint directly:**
Visit: `https://ascendiaai.fly.dev/api/session`

This should return a JSON response with `client_secret.value`. If you see an error, that's the issue.

**Common errors:**
- `"OPENAI_API_KEY environment variable is not set"` → Secret not set correctly
- `"Failed to create realtime session"` → API key invalid or API error
- `"No ephemeral key in response"` → OpenAI API returned unexpected format

### Step 2: Verify Secrets Are Set

**Check via Fly.io Dashboard:**
1. Go to https://fly.io/dashboard
2. Select your app: `ascendiaai`
3. Click **Settings** → **Secrets**
4. Verify all secrets are listed:
   - `OPENAI_API_KEY` (should be set)
   - `OPENDENTAL_MOCK_MODE` (should be `false`)
   - `OPENDENTAL_API_BASE_URL` (should be `https://api.opendental.com/api/v1`)
   - `OPENDENTAL_API_KEY` (should be `ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z`)

**Check via CLI:**
```powershell
fly secrets list --app ascendiaai
```

### Step 2: Restart the App

After setting secrets, the app needs to restart to pick them up:

**Via Dashboard:**
1. Go to your app dashboard
2. Click **Restart** button

**Via CLI:**
```powershell
fly apps restart --app ascendiaai
```

### Step 3: Check App Logs

**Via Dashboard:**
1. Go to your app dashboard
2. Click **Logs** tab
3. Look for errors related to:
   - `OPENAI_API_KEY` not found
   - `OPENDENTAL_API_KEY` not found
   - API connection errors

**Via CLI:**
```powershell
fly logs --app ascendiaai
```

### Step 4: Check Environment Variables in Runtime

Visit your health check endpoint to see if variables are loaded:

```
https://your-app-name.fly.dev/api/health
```

This will show:
- ✅ If environment variables are set (without exposing values)
- ✅ App status
- ✅ Connection status

### Step 5: Common Issues and Fixes

#### Issue 1: "OPENAI_API_KEY is not defined"

**Fix:**
```powershell
# Verify secret is set
fly secrets list --app ascendiaai

# If not set, set it again
fly secrets set OPENAI_API_KEY="your-key-here" --app ascendiaai

# Restart app
fly apps restart --app ascendiaai
```

#### Issue 2: "OPENDENTAL_API_KEY environment variable is not set"

**Fix:**
```powershell
# Verify secret is set
fly secrets list --app ascendiaai

# If not set, set it again
fly secrets set OPENDENTAL_API_KEY="ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z" --app ascendiaai

# Restart app
fly apps restart --app ascendiaai
```

#### Issue 3: Secrets are set but app still doesn't work

**Fix:**
1. **Redeploy the app** (secrets are injected at runtime, but sometimes need redeploy):
   ```powershell
   fly deploy --app ascendiaai
   ```

2. **Check if app is running:**
   ```powershell
   fly status --app ascendiaai
   ```

3. **SSH into the app and check environment:**
   ```powershell
   fly ssh console --app ascendiaai
   # Then run: env | grep OPENAI
   # Then run: env | grep OPENDENTAL
   ```

#### Issue 4: App is not accessible

**Fix:**
1. **Check app URL:**
   ```powershell
   fly status --app ascendiaai
   ```
   Look for the URL (should be `https://ascendiaai.fly.dev` or similar)

2. **Open app in browser:**
   ```powershell
   fly open --app ascendiaai
   ```

3. **Check if app is running:**
   ```powershell
   fly status --app ascendiaai
   ```
   Should show: `Status: running`

### Step 6: Verify Environment Variables Are Loaded

Create a test endpoint to check if variables are accessible:

**Visit:** `https://your-app.fly.dev/api/health`

This should return:
```json
{
  "status": "ok",
  "env": {
    "OPENAI_API_KEY": "set",
    "OPENDENTAL_API_KEY": "set",
    "OPENDENTAL_MOCK_MODE": "false"
  }
}
```

### Step 7: Test API Connections

**Test OpenAI API:**
1. Visit your app: `https://your-app.fly.dev`
2. Try to start a session
3. Check logs for OpenAI API errors

**Test OpenDental API:**
1. Visit your app: `https://your-app.fly.dev/agent-ui?agentConfig=dental`
2. Try: "Can you look up patients?"
3. Check logs for OpenDental API errors

### Step 8: Check Fly.io App Configuration

**Verify fly.toml is correct:**
```powershell
# Check your fly.toml file
cat fly.toml
```

Should have:
- `app = "ascendiaai"` (or your app name)
- `internal_port = 3000`
- Environment variables are NOT hardcoded in fly.toml (they're in secrets)

### Step 9: Check Next.js Build

**Verify build is successful:**
```powershell
# Check build logs
fly logs --app ascendiaai | grep -i "build\|error\|fail"
```

**Common build issues:**
- Missing dependencies
- TypeScript errors
- Environment variable errors at build time

### Step 10: Force Redeploy

If nothing else works, force a complete redeploy:

```powershell
# Stop the app
fly apps suspend --app ascendiaai

# Redeploy
fly deploy --app ascendiaai

# Verify secrets are still set
fly secrets list --app ascendiaai
```

## Quick Debug Checklist

- [ ] Secrets are set in Fly.io dashboard
- [ ] App has been restarted after setting secrets
- [ ] App is running (check `fly status`)
- [ ] App is accessible (check `fly open`)
- [ ] No errors in logs (`fly logs`)
- [ ] Environment variables are accessible (check `/api/health`)
- [ ] API keys are correct format (no extra spaces, quotes, etc.)
- [ ] App was redeployed after setting secrets

## Still Not Working?

1. **Check Fly.io status page:** https://status.fly.io
2. **Check Fly.io community:** https://community.fly.io
3. **Check app logs for specific errors:**
   ```powershell
   fly logs --app ascendiaai --tail
   ```
4. **Verify secrets format:**
   - `OPENAI_API_KEY` should start with `sk-`
   - `OPENDENTAL_API_KEY` should start with `ODFHIR ` (with space)
   - No quotes around values when setting secrets
   - No extra whitespace

## Contact Support

If still having issues:
1. Gather logs: `fly logs --app ascendiaai > logs.txt`
2. Check status: `fly status --app ascendiaai`
3. Post in Fly.io community with error details

