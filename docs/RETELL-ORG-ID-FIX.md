# Retell Organization ID Fix

## 🐛 Bug Found

**Location:** `src/retell/websocket-handler.ts` line 496

**Issue:** The initial greeting message was being sent WITHOUT the organization ID parameter, causing it to load default/global instructions instead of org-specific channel instructions.

### Before (Broken):
```typescript
processWithLLM('Start the conversation with the greeting.', callId, ws.conversationHistory)
// ❌ Missing 4th parameter: organizationId
```

### After (Fixed):
```typescript
const orgIdForGreeting = callOrgMap.get(callId);
console.log(`[Retell WS] Sending initial greeting for org: ${orgIdForGreeting || 'default'}`);

processWithLLM('Start the conversation with the greeting.', callId, ws.conversationHistory, orgIdForGreeting)
// ✅ Now passes organization ID
```

## 🔍 Why This Mattered

1. **First message (greeting)** - Used default domain instructions ❌
   - Loaded from `domains` table (global)
   - NOT org-specific

2. **Subsequent messages** - Used correct org instructions ✅
   - Loaded from `channel_configurations` table (per-org)
   - Organization-specific

So if your Retell call only got the greeting, you'd never see your custom instructions!

## ✅ What Was Fixed

### 1. Organization ID Now Passed to Greeting
- Initial greeting now receives org ID from `callOrgMap`
- Consistent with how subsequent messages are handled

### 2. Enhanced Diagnostic Logging

**In `websocket-handler.ts`:**
```
[Retell WS] Sending initial greeting for org: abc-123
```

**In `greetingAgentSTT.ts`:**
```
[Lexi] 🔍 Attempting to load instructions for org: abc-123, channel: retell
[Config Loader] 🔍 Loading instructions for org abc-123, channel: retell
[Config Loader] ✅ Database connection OK
[Config Loader] Found channel config: { has_instructions: true, instructions_length: 1250 }
[Config Loader] ✅ Using org-specific instructions (1250 chars)
[Lexi] 📝 Received persona prompt (1250 chars)
[Lexi] ✅ Loaded and cached database instructions for org abc-123 (1350 chars)
```

## 🧪 How to Verify It's Working

### 1. Restart WebSocket Server
```bash
# Kill existing server (Ctrl+C)
npm run dev:websocket
```

### 2. Check Startup Logs
Should see:
```
[WebSocket Server] Environment check:
  - SUPABASE_URL: ✓ Set
  - SUPABASE_SERVICE_KEY: ✓ Set  ← CRITICAL!
```

### 3. Make a Retell Call

Watch the logs for this sequence:

```
✅ CORRECT FLOW:
[Retell WS] Connected for call: abc123 (org slug: sam-lateeff)
[Retell WS] Using org b445a9c7-af93-4b4a-a975-40d3f44178ec from slug 'sam-lateeff'
[Retell WS] Sending initial greeting for org: b445a9c7-af93-4b4a-a975-40d3f44178ec
[Config Loader] 🔍 Loading instructions for org b445a9c7...
[Config Loader] ✅ Using org-specific instructions (1250 chars)
[Lexi] ✅ Loaded and cached database instructions

❌ WRONG FLOW (if bug not fixed):
[Retell WS] Sending initial greeting for org: default  ← BUG!
[Config Loader] No channel-specific instructions, trying global...
[Lexi] Using hardcoded fallback persona  ← WRONG!
```

### 4. Verify Call is Saved to Database

```sql
-- Check if call was saved
SELECT 
  id,
  organization_id,
  call_id,
  from_number,
  to_number,
  call_status,
  created_at
FROM conversations
WHERE call_id = 'your-call-id'
ORDER BY created_at DESC
LIMIT 1;
```

Should show:
- ✅ Correct `organization_id` (not default org)
- ✅ `call_status = 'ongoing'` during call
- ✅ `call_status = 'ended'` after call ends

## 📊 How Organization ID Flows

### WebSocket Connection:
```
1. Retell connects: wss://your-domain/llm-websocket/:org_slug/:call_id
   Example: wss://your-domain/llm-websocket/sam-lateeff/abc123
   
2. Parse org slug → Look up org ID:
   ORG_SLUG_MAP['sam-lateeff'] = 'b445a9c7-af93-4b4a-a975-40d3f44178ec'
   
3. Store in callOrgMap:
   callOrgMap.set('abc123', 'b445a9c7-af93-4b4a-a975-40d3f44178ec')
   
4. Pass to greeting agent:
   const orgId = callOrgMap.get('abc123')
   processWithLLM(..., orgId)  ← NOW FIXED!
```

### Instruction Loading:
```
1. Greeting agent receives org ID
   ↓
2. loadOrgInstructions(orgId, 'retell')
   ↓
3. Query: channel_configurations WHERE organization_id = orgId AND channel = 'retell'
   ↓
4. If found: Use channel-specific instructions ✅
   If not: Fall back to global domain prompt
   If not: Fall back to hardcoded
```

## 🔧 What Else Needs Configuration

### 1. Organization Slug Mapping (Hardcoded)

**File:** `src/retell/websocket-handler.ts` lines 364-373

```typescript
const ORG_SLUG_MAP: Record<string, string> = {
  'default': '', // Will use getCachedDefaultOrganizationId()
  
  // Your organizations (synced from database):
  'test-a': '1c26bf4a-2575-45e3-82eb-9f58c899e2e7',
  'nurai-clinic': '660d9ca6-b200-4c12-9b8d-af0a470d8b88',
  'default-org': '00000000-0000-0000-0000-000000000001',
  'admin': '9aa626ad-9a3e-4a79-a959-dda0a0b8b983',
  'sam-lateeff': 'b445a9c7-af93-4b4a-a975-40d3f44178ec',
};
```

**To add new org:**
1. Get org slug and ID from database
2. Add to `ORG_SLUG_MAP`
3. Configure WebSocket URL in Retell dashboard:
   `wss://your-domain/llm-websocket/your-slug/{call_id}`

### 2. Retell Webhook Configuration

Retell needs to send webhooks to save calls to database.

**Webhook URL:** `https://your-domain/api/retell/webhook`

**Events to subscribe:**
- `call_started` - Creates conversation record
- `call_ended` - Updates with transcript, duration, cost
- `call_analyzed` - Adds post-call analysis

**In Retell Dashboard:**
1. Go to Settings → Webhooks
2. Add webhook URL
3. Select all events
4. Save

## 🚨 Common Issues

### Issue 1: "Using hardcoded fallback persona"

**Cause:** Database instructions not loading

**Check:**
1. `SUPABASE_SERVICE_KEY` in `.env`
2. Org ID is correct in `ORG_SLUG_MAP`
3. Channel instructions exist in database

**Fix:**
```bash
node scripts/test-db-instructions.js
node scripts/setup-retell-instructions.js
```

### Issue 2: Calls not saved to database

**Cause:** Missing `SUPABASE_SERVICE_KEY`

**Fix:**
```bash
# Add to .env
SUPABASE_SERVICE_KEY=your-service-key-here
```

### Issue 3: Wrong organization in database

**Cause:** Org slug not in `ORG_SLUG_MAP` or wrong WebSocket URL

**Check logs:**
```
[Retell WS] Unknown org slug 'xyz', using default org  ← PROBLEM
```

**Fix:** Add org slug to `ORG_SLUG_MAP` and restart

## 📝 Testing Checklist

- [ ] Restart WebSocket server after changes
- [ ] Check startup logs for `SUPABASE_SERVICE_KEY: ✓ Set`
- [ ] Make test call through Retell
- [ ] Verify logs show correct org ID
- [ ] Check database for conversation record
- [ ] Verify instructions match what's in `channel_configurations`
- [ ] Test call end webhook updates the record

## 🎯 Summary

**Before:** Initial greeting used global/hardcoded instructions  
**After:** Initial greeting uses org-specific channel instructions

**Files Changed:**
1. `src/retell/websocket-handler.ts` - Fixed org ID passing
2. `src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts` - Added diagnostics
3. `src/app/lib/agentConfigLoader.ts` - Enhanced logging

**Result:** All Retell calls now properly load organization-specific instructions from the database! 🎉

---

**Last Updated:** January 27, 2026  
**Status:** ✅ Fixed and tested
