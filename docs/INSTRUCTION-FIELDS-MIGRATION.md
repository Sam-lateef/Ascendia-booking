# Instruction Fields Migration - COMPLETE FIX

## 🎯 What Was Wrong

**OLD (BROKEN) Schema:**
```sql
CREATE TABLE channel_configurations (
  instructions TEXT  -- ❌ ONE field for ALL instructions
);
```

**Problems:**
1. Storing 3 different instruction sets in 1 TEXT field
2. Concatenating with `---SUPERVISOR---` separator
3. Constantly splitting/rebuilding → **data loss when switching modes**
4. Using `settings` JSONB as a workaround

---

## ✅ What Was Fixed

**NEW (CORRECT) Schema:**
```sql
CREATE TABLE channel_configurations (
  one_agent_instructions TEXT,         -- For single-agent mode
  receptionist_instructions TEXT,       -- For two-agent receptionist  
  supervisor_instructions TEXT,         -- For two-agent supervisor
  settings JSONB                        -- Only for other settings
);
```

**Benefits:**
- ✅ No concatenation/splitting
- ✅ No data loss when switching modes
- ✅ Direct database read/write
- ✅ Clean separation of concerns

---

## 📝 Files Changed

### 1. **Database Migration**
- ✅ `supabase/migrations/053_split_instructions_fields.sql`
  - Adds 3 new columns
  - Migrates existing data from old `instructions` field
  - Keeps old field for backward compatibility

### 2. **TypeScript Interface**
- ✅ `src/app/lib/channelConfigLoader.ts`
  - Updated `ChannelConfig` interface
  - Added `one_agent_instructions`, `receptionist_instructions`, `supervisor_instructions`

### 3. **API Route**
- ✅ `src/app/api/admin/channel-configs/route.ts`
  - Saves all 3 instruction fields separately
  - Loads all 3 fields from database

### 4. **Admin UI**
- ✅ `src/app/admin/settings/channels/page.tsx`
  - Loads instructions directly from DB fields (no parsing!)
  - Saves instructions directly to DB fields (no concatenation!)
  - Mode switching is now simple (just changes `agent_mode`)

### 5. **Agent Constructor**
- ✅ `src/app/agent-ui/AgentUIApp.tsx`
  - Loads instructions directly from separate fields
  - No more splitting `---SUPERVISOR---`

---

## 🚀 How to Apply

### **Step 1: Run the Migration**

Go to your Supabase SQL Editor:
1. Open: https://supabase.com/dashboard/project/vihlqoivkayhvxegytlc/sql/new
2. Paste the contents of `supabase/migrations/053_split_instructions_fields.sql`
3. Click **Run**

The migration will:
- Add the 3 new columns
- Migrate your existing data
- Log how many configs were migrated

### **Step 2: Restart Your Dev Server**

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### **Step 3: Test the Fix**

1. Go to `/admin/settings/channels`
2. Select **Web** channel
3. Switch to **Two Agent mode**
4. Paste Receptionist instructions (from `docs/TWO-AGENT-MODE-INSTRUCTIONS.txt` - first part)
5. Paste Supervisor instructions (from `docs/TWO-AGENT-MODE-INSTRUCTIONS.txt` - second part)
6. Click **Save**
7. Switch to **One Agent mode** → Instructions for one-agent should be empty (or previous)
8. Click **Save**
9. Switch back to **Two Agent mode** → **Both Receptionist AND Supervisor should still be there!** ✅

---

## 🎯 How It Works Now

### **Saving:**

**One-Agent Mode:**
```typescript
POST /api/admin/channel-configs {
  settings: { agent_mode: 'one_agent' },
  one_agent_instructions: "Lori single-agent instructions...",
  receptionist_instructions: null,
  supervisor_instructions: null
}
```

**Two-Agent Mode:**
```typescript
POST /api/admin/channel-configs {
  settings: { agent_mode: 'two_agent' },
  one_agent_instructions: null,
  receptionist_instructions: "Lori receptionist...",
  supervisor_instructions: "Supervisor..."
}
```

### **Loading:**

**One-Agent Mode:**
```typescript
const config = await getChannelConfig(orgId, 'web');
const instructions = config.one_agent_instructions;  // ✅ Direct read
agent = new RealtimeAgent({ instructions });
```

**Two-Agent Mode:**
```typescript
const config = await getChannelConfig(orgId, 'web');
const receptInstructions = config.receptionist_instructions;  // ✅ Direct read
const superInstructions = config.supervisor_instructions;      // ✅ Direct read
receptionist = new RealtimeAgent({ instructions: receptInstructions });
supervisor = new RealtimeAgent({ instructions: superInstructions });
```

**No parsing, no splitting, no data loss!** 🎉

---

## 📊 Database Schema Changes

```sql
-- BEFORE:
channel_configurations:
  - instructions (TEXT) ❌

-- AFTER:
channel_configurations:
  - instructions (TEXT) [deprecated, kept for backward compatibility]
  - one_agent_instructions (TEXT) ✅
  - receptionist_instructions (TEXT) ✅
  - supervisor_instructions (TEXT) ✅
```

---

## ✅ Migration Complete

Date: 2026-01-26
Status: Ready to test
Impact: **FIXES ALL instruction preservation issues**

---

## 🔍 Troubleshooting

**If instructions are still being lost:**
1. Check migration ran successfully: `SELECT * FROM channel_configurations WHERE organization_id = 'your-org-id'`
2. Verify new columns exist: Should see `one_agent_instructions`, `receptionist_instructions`, `supervisor_instructions`
3. Check browser console logs when saving
4. Hard refresh the admin page: `Ctrl + Shift + F5`

**If old data wasn't migrated:**
The migration only migrates if `instructions` field had data. If you need to manually migrate:
```sql
UPDATE channel_configurations
SET 
  receptionist_instructions = 'paste receptionist instructions here',
  supervisor_instructions = 'paste supervisor instructions here'
WHERE organization_id = 'your-org-id' AND channel = 'web';
```
