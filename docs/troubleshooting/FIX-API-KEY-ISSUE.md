# Fix Invalid API Key Issue

## The Problem

The error shows: `"Incorrect API key provided: sk-ant-a************************************************************************************************-gAA"`

**Key observations:**
- The API key is being received (length ~8000 characters)
- But OpenAI API keys are typically **51-60 characters** long
- The key ends with `-gAA` which matches your key
- This suggests the secret is corrupted or has extra characters

## The Issue

Your secret in Fly.io likely has:
- Quotes around the value (`"sk-ant-..."`)
- Extra whitespace
- Or the secret was set incorrectly

## Step 1: Check Current Secret Format

**Via Fly.io Dashboard:**
1. Go to https://fly.io/dashboard
2. Select app: `ascendiaai`
3. Click **Settings** → **Secrets**
4. Check the `OPENAI_API_KEY` value
   - **It should NOT have quotes**
   - **It should NOT have extra spaces**
   - **It should be exactly:** `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`

## Step 2: Fix the Secret

**Delete the old secret and set it again correctly:**

**Via Dashboard:**
1. Go to **Settings** → **Secrets**
2. Click **Delete** on `OPENAI_API_KEY`
3. Click **Add Secret**
4. **Key:** `OPENAI_API_KEY`
5. **Value:** `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`
   - **NO quotes**
   - **NO extra spaces**
   - **Just paste the key directly**

**Via CLI:**
```powershell
# Remove the old secret
fly secrets unset OPENAI_API_KEY --app ascendiaai

# Set it again (without quotes in the value)
fly secrets set OPENAI_API_KEY=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 --app ascendiaai
```

**Important:** In CLI, the format is `KEY=value` (no quotes around value)

## Step 3: Restart the App

After fixing the secret, restart:

**Via Dashboard:**
- Click **Restart** button

**Via CLI:**
```powershell
fly apps restart --app ascendiaai
```

## Step 4: Verify the Fix

**Test the debug endpoint:**
Visit: `https://ascendiaai.fly.dev/api/debug-env`

**Check:**
- `"OPENAI_API_KEY": "set (length: XX, ...)"`
- **Length should be ~51-60 characters** (NOT 8000+)

**Test the health endpoint:**
Visit: `https://ascendiaai.fly.dev/api/health`

**Should show:**
- `"OPENAI_API_KEY": "set"`
- `"openai.status": "connected"` (NOT "error")

**Test the session endpoint:**
Visit: `https://ascendiaai.fly.dev/api/session`

**Should return:**
- JSON with `client_secret.value` (NOT an error)

## Common Mistakes

### ❌ Wrong:
```
OPENAI_API_KEY = "sk-ant-..."
```
(Quotes included in the value)

### ❌ Wrong:
```
OPENAI_API_KEY = sk-ant-... 
```
(Extra space before the key)

### ✅ Correct:
```
OPENAI_API_KEY = sk-ant-...
```
(No quotes, no extra spaces)

## Why This Happened

Fly.io secrets might have been set with quotes if you used:
```powershell
fly secrets set OPENAI_API_KEY='"sk-ant-..."'
```

The quotes became part of the value, making it invalid.

## Still Not Working?

1. **Check the actual secret value:**
   - Use the debug endpoint to see the first/last 10 characters
   - Verify it matches your key

2. **Try a different API key:**
   - Generate a new key at https://platform.openai.com/account/api-keys
   - Set it as the secret
   - Test again

3. **Check for extra characters:**
   - The debug endpoint will show if there are quotes or whitespace
   - Look for `hasQuotes: true` or `hasWhitespace: true` in logs





















