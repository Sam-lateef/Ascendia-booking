# Fix Secrets on Ascendiaai App

## The Problem

The app `ascendiaai` is deployed and accessible, but you're getting "key not provided" error. This means:
- ✅ App exists and is deployed
- ❌ Secrets are either not set, or not accessible

## Step 1: Verify Secrets Are Set

**Check if secrets are set on `ascendiaai`:**

**Via Dashboard:**
1. Go to https://fly.io/dashboard
2. Select app: `ascendiaai`
3. Click **Settings** → **Secrets**
4. Verify all secrets are listed:
   - `OPENAI_API_KEY` (should be set)
   - `OPENDENTAL_MOCK_MODE` (should be `false`)
   - `OPENDENTAL_API_BASE_URL` (should be `https://api.opendental.com/api/v1`)
   - `OPENDENTAL_API_KEY` (should be `ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z`)

**Via CLI:**
```powershell
fly secrets list --app ascendiaai
```

## Step 2: Test Debug Endpoint

Visit: `https://ascendiaai.fly.dev/api/debug-env`

This will show:
- If `OPENAI_API_KEY` is accessible
- The length and first few characters (without exposing the full key)
- All environment variables

**If you see `"OPENAI_API_KEY": "missing"`** → Secrets are not set or not accessible

## Step 3: Set Secrets on Ascendiaai

**If secrets are NOT set on `ascendiaai`, set them now:**

**Via Dashboard:**
1. Go to https://fly.io/dashboard
2. Select app: `ascendiaai`
3. Click **Settings** → **Secrets**
4. Click **Add Secret** for each:
   - `OPENAI_API_KEY` = `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`
   - `OPENDENTAL_MOCK_MODE` = `false`
   - `OPENDENTAL_API_BASE_URL` = `https://api.opendental.com/api/v1`
   - `OPENDENTAL_API_KEY` = `ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z`

**Via CLI:**
```powershell
fly secrets set OPENAI_API_KEY="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" --app ascendiaai

fly secrets set OPENDENTAL_MOCK_MODE="false" --app ascendiaai

fly secrets set OPENDENTAL_API_BASE_URL="https://api.opendental.com/api/v1" --app ascendiaai

fly secrets set OPENDENTAL_API_KEY="ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z" --app ascendiaai
```

## Step 4: Restart the App

**After setting secrets, you MUST restart the app:**

**Via Dashboard:**
1. Go to your `ascendiaai` app
2. Click **Restart** button

**Via CLI:**
```powershell
fly apps restart --app ascendiaai
```

## Step 5: Verify Secrets Are Working

**Test the endpoints:**

1. **Debug endpoint:** `https://ascendiaai.fly.dev/api/debug-env`
   - Should show `"OPENAI_API_KEY": "set (length: XX, starts with: sk-ant-...)"`

2. **Health endpoint:** `https://ascendiaai.fly.dev/api/health`
   - Should show `"OPENAI_API_KEY": "set"` and `"openai.status": "connected"`

3. **Session endpoint:** `https://ascendiaai.fly.dev/api/session`
   - Should return JSON with `client_secret.value` (not an error)

## Step 6: Check Logs

**If still not working, check logs:**

**Via Dashboard:**
1. Go to your `ascendiaai` app
2. Click **Logs** tab
3. Look for: `[Session API] OPENAI_API_KEY is not set`

**Via CLI:**
```powershell
fly logs --app ascendiaai
```

## Common Issues

### Issue 1: Secrets Set on Wrong App

**Problem:** Secrets are set on `agent0` but app is `ascendiaai`

**Fix:** Set secrets on `ascendiaai`:
```powershell
fly secrets set OPENAI_API_KEY="your-key" --app ascendiaai
```

### Issue 2: App Not Restarted After Setting Secrets

**Problem:** Secrets are set but app hasn't restarted

**Fix:** Restart the app:
```powershell
fly apps restart --app ascendiaai
```

### Issue 3: Secrets Format Issue

**Problem:** Secrets have quotes or extra spaces

**Fix:** 
- In Dashboard: No quotes around values
- In CLI: Use quotes but don't include them in the value
- Example: `fly secrets set KEY="value"` (value is `value`, not `"value"`)

### Issue 4: Next.js Standalone Build Issue

**Problem:** Secrets might not be accessible at runtime

**Fix:** 
1. Redeploy after setting secrets:
   ```powershell
   fly deploy --app ascendiaai
   ```
2. Or ensure secrets are set before deployment

## Quick Checklist

- [ ] Secrets are set on `ascendiaai` app (not `agent0`)
- [ ] `OPENAI_API_KEY` is set correctly (starts with `sk-`)
- [ ] App has been restarted after setting secrets
- [ ] `/api/debug-env` shows `OPENAI_API_KEY` as "set"
- [ ] `/api/health` shows `"OPENAI_API_KEY": "set"`
- [ ] `/api/session` returns JSON with `client_secret.value`

## Still Not Working?

1. **Verify app name in fly.toml:**
   ```powershell
   cat fly.toml | grep "app ="
   ```
   Should be: `app = 'ascendiaai'`

2. **Check which app you're deploying to:**
   ```powershell
   fly status
   ```

3. **Try redeploying:**
   ```powershell
   fly deploy --app ascendiaai
   ```

4. **Check Fly.io status:** https://status.fly.io





















