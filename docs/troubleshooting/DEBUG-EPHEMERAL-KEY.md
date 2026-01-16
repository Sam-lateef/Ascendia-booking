# Debugging Ephemeral Key Issue

## Step 1: Verify Which App You're Deploying To

**Check your current app:**
```powershell
fly status
```

**Check what app name is in fly.toml:**
```powershell
cat fly.toml | grep "app ="
```

**Important:** If `fly.toml` says `app = 'ascendiaai'` but you deployed to `agent0`, the secrets are on the wrong app!

## Step 2: Check Secrets on the Correct App

**If your app is `ascendiaai`:**
```powershell
fly secrets list --app ascendiaai
```

**If your app is `agent0`:**
```powershell
fly secrets list --app agent0
```

**Make sure secrets are set on the SAME app you're deploying to!**

## Step 3: Test the Debug Endpoint

Visit: `https://your-app-name.fly.dev/api/debug-env`

This will show:
- If `OPENAI_API_KEY` is accessible
- The length and first few characters (to verify it's set)
- All environment variables

## Step 4: Test the Health Endpoint

Visit: `https://your-app-name.fly.dev/api/health`

Check:
- `"OPENAI_API_KEY": "set"` (should be "set", not "missing")
- `"openai.status": "connected"` (should be "connected", not "error")

## Step 5: Test the Session Endpoint

Visit: `https://your-app-name.fly.dev/api/session`

**If you see:**
- `"OPENAI_API_KEY environment variable is not set"` → Secret not accessible
- `"Failed to create realtime session"` → API key might be invalid
- `"No ephemeral key in response"` → OpenAI API issue

## Step 6: Check Fly.io Logs

**Via Dashboard:**
1. Go to https://fly.io/dashboard
2. Select your app (make sure it's the right one!)
3. Click **Logs** tab
4. Look for: `[Session API] OPENAI_API_KEY is not set`

**Via CLI:**
```powershell
fly logs --app your-app-name
```

## Step 7: Common Issues and Fixes

### Issue 1: Wrong App Name

**Problem:** `fly.toml` says `app = 'ascendiaai'` but secrets are on `agent0`

**Fix:**
1. **Option A:** Set secrets on the correct app:
   ```powershell
   fly secrets set OPENAI_API_KEY="your-key" --app ascendiaai
   ```

2. **Option B:** Change fly.toml back to the existing app:
   ```toml
   app = 'agent0'
   ```

### Issue 2: Secrets Not Accessible at Runtime

**Problem:** Secrets are set but not accessible in the app

**Fix:**
1. **Force restart after setting secrets:**
   ```powershell
   fly apps restart --app your-app-name
   ```

2. **Redeploy completely:**
   ```powershell
   fly deploy --app your-app-name
   ```

3. **Check if secrets are in the right format** (no quotes, no extra spaces)

### Issue 3: Next.js Standalone Build Issue

**Problem:** Next.js standalone build might not pick up runtime env vars

**Fix:** 
1. Make sure you're not using `NEXT_PUBLIC_` prefix for server-only secrets
2. Verify secrets are set as Fly.io secrets (not in fly.toml `[env]` section)
3. Try redeploying after setting secrets

## Step 8: Verify App Name Match

**Critical Check:**

1. **What app is in fly.toml?**
   ```powershell
   cat fly.toml | grep "app ="
   ```

2. **What app did you set secrets on?**
   - Check Fly.io dashboard
   - Or: `fly secrets list --app ascendiaai` vs `fly secrets list --app agent0`

3. **Make sure they match!**

If they don't match:
- Either change `fly.toml` to match the existing app
- Or set secrets on the app specified in `fly.toml`

## Step 9: Test After Fix

1. Visit `/api/debug-env` - should show `OPENAI_API_KEY` as "set"
2. Visit `/api/health` - should show `"OPENAI_API_KEY": "set"`
3. Visit `/api/session` - should return JSON with `client_secret.value`
4. Try connecting in the app - should work!

## Still Not Working?

1. **Check Fly.io status:** https://status.fly.io
2. **Verify API key format:**
   - Should start with `sk-`
   - No quotes around it
   - No extra spaces
3. **Try setting secret again:**
   ```powershell
   fly secrets set OPENAI_API_KEY="your-actual-key-here" --app your-app-name
   fly apps restart --app your-app-name
   ```
4. **Check logs for specific error:**
   ```powershell
   fly logs --app your-app-name | grep -i "session\|openai\|error"
   ```





















