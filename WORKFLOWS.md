# 📝 Agent Instructions Editor Workflow

## What's New

You can now **edit agent instructions from the admin dashboard** without redeploying! Changes take effect immediately for new calls.

### Features ✨

1. **Password-Protected Editor** - Hardcoded password prevents accidental changes
2. **Database-Backed** - Instructions stored in your existing `agent_configurations` table
3. **Live Updates** - Changes apply immediately to new calls
4. **Dual Mode Support**:
   - **Premium Mode**: Single agent instructions (gpt-4o)
   - **Standard Mode**: Receptionist (Lexi) + Supervisor instructions (two-agent system)

---

## 🔧 Setup Instructions

### Step 1: Run SQL Migration (Create Table Record)

Run this SQL in your Supabase dashboard to create the system agent record:

```sql
-- Insert system agent configuration for Twilio
INSERT INTO agent_configurations (
  agent_id,
  name,
  description,
  scope,
  llm_provider,
  llm_model,
  use_two_agent_mode,
  use_manual_instructions,
  voice,
  created_by,
  created_at,
  updated_at
)
VALUES (
  'lexi-twilio',
  'Lexi - Twilio Voice Agent',
  'System agent for handling Twilio voice calls',
  'SYSTEM',
  'openai',
  'gpt-4o-mini-realtime-preview-2024-12-17',
  true,  -- Start with Standard mode (cost-effective)
  false, -- Start with hardcoded instructions
  'sage',
  '00000000-0000-0000-0000-000000000000',  -- System user UUID
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

### Step 2: Unlock and Sync Current Instructions to Database

1. Navigate to: `http://localhost:3000/admin/booking/settings`
2. Scroll down to **"Workflows"** section
3. Enter password: `lexi2026`
4. Click **"Unlock"**
5. Click **"Sync Instructions"** button in the blue box
6. This will copy all current hardcoded instructions to the database
7. You only need to do this once!

### Step 3: Change the Password (Optional)

Edit `src/app/admin/booking/settings/page.tsx` line 17:

```typescript
const HARDCODED_PASSWORD = 'lexi2026'; // Change this to your preferred password
```

### Step 4: Edit Instructions

1. After syncing, you should see all the current instructions loaded in the textareas
2. Make any changes you want
3. Click **"Save Changes"**
4. Changes apply immediately to new calls!

---

## 📋 How to Use

### Editing Premium Mode Instructions

1. Unlock the editor with your password
2. Edit the **"Premium Mode Instructions"** textarea
3. Click **"Save Instructions"**
4. Changes apply immediately to new Premium calls

### Editing Standard Mode Instructions (Two-Agent)

1. Unlock the editor
2. Edit **two** sections:
   - **Receptionist (Lexi) Instructions** - How Lexi handles conversation
   - **Supervisor Instructions** - How the supervisor executes booking operations
3. Click **"Save Instructions"**
4. Changes apply immediately to new Standard calls

### Locking the Editor

Click **"Lock Editor"** to re-enable password protection.

---

## 🔄 How It Works

### Premium Mode Flow
```
Twilio Call → Premium WebSocket Handler
    ↓
Check agent_configurations table
    ↓
use_manual_instructions = true?
    ├─ Yes → Use manual_ai_instructions from DB
    └─ No  → Use hardcoded default instructions
    ↓
Configure OpenAI Realtime session
```

### Standard Mode Flow
```
Twilio Call → Standard WebSocket Handler
    ↓
Check agent_configurations table
    ↓
use_manual_instructions = true?
    ├─ Yes → Load receptionist_instructions & supervisor_instructions from DB
    └─ No  → Use hardcoded defaults
    ↓
Configure Lexi (gpt-4o-mini) with receptionist_instructions
    ↓
When tool execution needed → Call Supervisor with supervisor_instructions
```

---

## 🗄️ Database Schema

The instructions are stored in the `agent_configurations` table:

| Field | Type | Purpose |
|-------|------|---------|
| `manual_ai_instructions` | text | Premium mode instructions |
| `use_manual_instructions` | boolean | Enable/disable manual instructions |
| `receptionist_instructions` | text | Standard mode - Lexi instructions |
| `supervisor_instructions` | text | Standard mode - Supervisor instructions |
| `use_two_agent_mode` | boolean | Enable Standard (true) or Premium (false) |

---

## 🎨 UI Screenshots

### Settings Page - Agent Mode
```
┌─────────────────────────────────────────┐
│ Agent Mode Configuration                │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Standard (Recommended)              │ │
│ │ Cost Effective                      │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ [ Save Mode ]                            │
└─────────────────────────────────────────┘
```

### Settings Page - Instructions Editor (Locked)
```
┌─────────────────────────────────────────┐
│ 🔒 Agent Instructions Editor            │
│                                          │
│ ⚠️ Password Required                    │
│                                          │
│ ┌─────────────────┐                     │
│ │ [password]      │ [ Unlock ]          │
│ └─────────────────┘                     │
└─────────────────────────────────────────┘
```

### Settings Page - Instructions Editor (Unlocked)
```
┌─────────────────────────────────────────┐
│ 🔓 Agent Instructions Editor            │
│                                          │
│ Premium Mode Instructions                │
│ ┌─────────────────────────────────────┐ │
│ │ [Large textarea for instructions]   │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ Standard Mode Instructions               │
│ ┌─────────────────────────────────────┐ │
│ │ Receptionist (Lexi) Instructions    │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Supervisor Instructions             │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ [ Save Instructions ] [ Lock Editor ]   │
└─────────────────────────────────────────┘
```

---

## 🚀 Quick Start Checklist

- [ ] Run SQL migration in Supabase dashboard
- [ ] (Optional) Change password in `page.tsx`
- [ ] Start dev server: `npm run dev:full`
- [ ] Navigate to Settings: http://localhost:3000/admin/booking/settings
- [ ] Scroll to "Workflows" section
- [ ] Unlock with password: `lexi2026`
- [ ] Click "Sync Instructions" (first time only)
- [ ] Edit instructions if needed
- [ ] Save and test with a call!

---

## 🧪 Testing

### Test Premium Mode Instructions
1. Switch to **Premium** mode
2. Edit **Premium Mode Instructions**
3. Save
4. Make a test call via Twilio
5. Check logs for: `[Twilio WS] 📝 Using database instructions for premium mode`

### Test Standard Mode Instructions
1. Switch to **Standard** mode
2. Edit **Receptionist Instructions** and **Supervisor Instructions**
3. Save
4. Make a test call via Twilio
5. Check logs for:
   - `[Standard WS] 📝 Using database instructions for receptionist`
   - `[Supervisor] 📝 Using custom database instructions`

---

## ⚙️ Technical Details

### Files Modified

1. **`src/app/admin/booking/settings/page.tsx`** - UI with password protection
2. **`src/app/api/admin/agent-instructions/route.ts`** - API for getting/setting instructions
3. **`src/app/lib/agentMode.ts`** - Added `getAgentInstructions()` function
4. **`src/app/agentConfigs/embeddedBooking/supervisorAgent.ts`** - Accept custom instructions
5. **`src/twilio/websocket-handler-standard.ts`** - Load and use DB instructions
6. **`src/twilio/websocket-handler.ts`** - Load and use DB instructions (Premium)

### API Endpoints

**GET `/api/admin/agent-instructions`**
- Returns current instructions from database

**POST `/api/admin/agent-instructions`**
```json
{
  "premiumInstructions": "...",
  "receptionistInstructions": "...",
  "supervisorInstructions": "..."
}
```

### Fallback Behavior

If instructions **cannot be loaded** from the database:
- System automatically falls back to **hardcoded default instructions**
- A warning is logged: `⚠️ Could not load instructions from database, using defaults`
- **Calls will still work** - no downtime!

---

## 💡 Pro Tips

1. **Test instructions in browser first** - Use the embedded agent UI to test changes before deploying
2. **Keep backups** - Copy your instructions to a text file before major edits
3. **Use clear language** - The agents respond better to natural, conversational instructions
4. **Iterate gradually** - Make small changes and test after each one
5. **Check logs** - Monitor console for `📝 Using database instructions` to confirm DB instructions are loaded

---

## 🐛 Troubleshooting

### Instructions not updating?
- Check that `use_manual_instructions = true` in the database
- Verify you clicked "Save Instructions"
- Clear browser cache and refresh

### Password not working?
- Check the password in `src/app/admin/booking/settings/page.tsx` line 17
- Password is case-sensitive!

### Still using default instructions?
- Check logs for warnings
- Verify `agent_configurations` table has the `lexi-twilio` record
- Check Supabase environment variables are set correctly

---

## 🎉 Success!

You now have a **live-editable agent system**! No more deployments for instruction tweaks. Happy optimizing! 🚀

