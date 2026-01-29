# Retell Database Instructions Fix

## ✅ What Was Fixed

I've updated the Retell pipeline to properly load instructions from the database per-organization:

### Changes Made:

1. **Added per-organization instruction loading** (`src/app/lib/agentConfigLoader.ts`):
   - New function: `loadOrgInstructions(organizationId, channel)` 
   - Loads instructions from `channel_configurations` table first
   - Falls back to global `domains` table if no channel-specific instructions
   - Caches per-organization (60-second TTL)

2. **Updated greeting agent** (`src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts`):
   - Changed from global cache (loaded once on startup) to per-call loading
   - Now accepts `organizationId` parameter
   - Loads instructions dynamically for each call
   - Caches per-organization to avoid repeated database queries

3. **Added diagnostics** (`src/retell/server.ts`):
   - Now checks for `SUPABASE_SERVICE_KEY` on startup
   - Warns if database credentials are missing
   - Improved logging for database connection status

## 🔍 What We Discovered

Running the test script (`scripts/test-db-instructions.js`) revealed:

1. ✅ **Database connection works** - Credentials are configured correctly
2. ⚠️ **NO Retell channels have instructions** - All channels show "✗ No instructions"
3. ⚠️ **Most Retell channels are disabled** - Only `web` channels are enabled
4. ✅ **Global domain prompt exists** - 831 characters in `dental_booking` domain

### Test Results:

```
Organization: Nurai Clinic
  retell:
    ✗ Disabled | AI: openai_gpt4o
    ✗ No instructions

Organization: sam.lateeff's Organization  
  retell:
    ✓ Enabled | AI: openai_gpt4o
    ✗ No instructions  ← This is the problem!
```

## 🔧 How To Fix (3 Options)

### Option 1: Add Retell-Specific Instructions (Recommended)

Use the interactive setup script:

```bash
node scripts/setup-retell-instructions.js
```

This will:
1. Show all organizations
2. Let you select one
3. Enable Retell channel
4. Add sample or custom instructions

### Option 2: Add Instructions via SQL

```sql
-- Enable Retell and add instructions for your organization
UPDATE channel_configurations
SET 
  enabled = true,
  instructions = 'Your custom instructions here...'
WHERE organization_id = 'your-org-id-here'
AND channel = 'retell';
```

Replace `your-org-id-here` with your actual organization ID (from test output).

### Option 3: Use Admin UI

1. Go to `/admin/settings/channels`
2. Select "Retell" channel
3. Click "Enable"
4. Add instructions in the text area
5. Save

## ⚙️ How It Works Now

### Before (Old System):
```
Server starts
  ↓
Load instructions ONCE globally
  ↓
All calls use same cached instructions
  ↓
❌ No per-organization support
❌ Restart required to update instructions
```

### After (New System):
```
Call received with org ID
  ↓
Load instructions for THIS organization
  ↓  
Check channel_configurations (per-org, per-channel)
  ↓ if null
Check domains (global fallback)
  ↓ if not loaded
Use hardcoded fallback
  ↓
✅ Per-organization support
✅ Instructions cached 60 seconds (auto-refresh)
```

## 🧪 Testing

### 1. Test Database Connection

```bash
node scripts/test-db-instructions.js
```

This will check:
- ✅ Environment variables configured
- ✅ Database connection working
- ✅ Organizations exist
- ✅ Channel configurations present
- ⚠️ Which channels have instructions

### 2. Test a Retell Call

After configuring instructions:

1. Start the WebSocket server:
   ```bash
   npm run dev:websocket
   ```

2. Look for these logs when a call connects:
   ```
   ✅ Expected (instructions from database):
   [Config Loader] 🔍 Loading instructions for org abc-123...
   [Config Loader] ✅ Database connection OK
   [Config Loader] ✅ Using org-specific instructions (1250 chars)
   [Lexi] ✅ Loaded database instructions for org abc-123

   ⚠️ Fallback (using global domain prompt):
   [Config Loader] No channel-specific instructions, trying global...
   [Config Loader] Global prompts loaded: has_persona=true, length=831
   [Lexi] ✅ Loaded database instructions for org abc-123

   ❌ Problem (using hardcoded):
   [Config Loader] ❌ Database connection test failed
   [Lexi] Using hardcoded fallback persona
   ```

## 📊 Current Database State

From test results:

| Organization | Retell Status | Has Instructions | AI Backend |
|--------------|---------------|------------------|------------|
| Test Clinic A | ✗ Disabled | ✗ No | openai_gpt4o |
| Nurai Clinic | ✗ Disabled | ✗ No | openai_gpt4o |
| Default Organization | ✗ Disabled | ✗ No | openai_gpt4o |
| sam.lateeff's Organization | ✓ Enabled | ✗ No | openai_gpt4o |

**Global Fallback Available:**
- Domain: `dental_booking` (831 chars) ✅

## 🚀 Quick Start

1. **Enable Retell and add instructions:**
   ```bash
   node scripts/setup-retell-instructions.js
   ```

2. **Restart WebSocket server:**
   ```bash
   # Kill existing server (Ctrl+C)
   npm run dev:websocket
   ```

3. **Test a call:**
   - Make a Retell call through your org
   - Watch the server logs for `[Lexi]` messages
   - Should see: "✅ Loaded database instructions for org..."

4. **Verify instructions are used:**
   - Agent should follow the instructions you configured
   - No mention of "hardcoded fallback" in logs

## 🐛 Troubleshooting

### Problem: "Using hardcoded fallback persona"

**Cause:** Database instructions not loading

**Fix:**
1. Check `SUPABASE_SERVICE_KEY` is set in `.env`
2. Run test: `node scripts/test-db-instructions.js`
3. Add instructions via setup script
4. Restart server

### Problem: "No org-specific instructions, using global..."

**Cause:** Channel doesn't have custom instructions (this is OK!)

**Effect:** Will use global domain prompt as fallback

**Fix (optional):** Add channel-specific instructions if you want custom behavior per channel

### Problem: "Database connection test failed"

**Cause:** Missing or invalid Supabase credentials

**Fix:**
1. Check `.env` file has:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY` (NOT anon key!)
2. Verify credentials are correct
3. Test connection: `node scripts/test-db-instructions.js`

## 📝 Summary

**What you need to do:**

1. ✅ Run the test script to see current state
2. ✅ Use setup script to add instructions OR do it via admin UI
3. ✅ Restart WebSocket server
4. ✅ Test a call and check logs

**What the code now does automatically:**

1. ✅ Loads instructions per-organization (not globally)
2. ✅ Falls back to global domain if no channel-specific instructions
3. ✅ Caches instructions (60s) to avoid excessive DB queries
4. ✅ Logs detailed diagnostics for troubleshooting

---

**Last Updated:** January 27, 2026  
**Status:** ✅ Fixed - Ready for configuration
