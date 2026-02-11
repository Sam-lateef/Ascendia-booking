# Phone Numbers Setup - Master Template Configuration

**How to use one perfect Vapi assistant config for all new organizations**

---

## 🎯 Concept

Instead of using defaults, we **clone your existing perfect Vapi assistant** configuration for all new orgs.

```
Demo Org Assistant (Perfect Config)
  ↓ Clone everything
New Org 1 Assistant
New Org 2 Assistant
New Org 3 Assistant
  ↓
All have IDENTICAL configuration!
```

---

## 🚀 Setup (One-Time)

### Step 1: Find Your Master Template Assistant ID

Run this script to get the assistant ID from your demo org:

```bash
node scripts/get-vapi-assistant-id.js <your-demo-org-id>
```

**Example:**
```bash
node scripts/get-vapi-assistant-id.js b445a9c7-af93-4b4a-a975-40d3f44178ec
```

**Output:**
```
✅ Found 1 assistant(s):

1. Lexi
   ID: asst_abc123xyz...
   Phone: +18504036622
   Created: Feb 6, 2026
   Active: ✅

═══════════════════════════════════════════════════════
📋 To use the newest assistant as master template:

1. Add to your .env file:
   VAPI_MASTER_TEMPLATE_ASSISTANT_ID=asst_abc123xyz...

2. Or set on Fly.io:
   fly secrets set VAPI_MASTER_TEMPLATE_ASSISTANT_ID=asst_abc123xyz...
```

### Step 2: Set Environment Variable

**Local development (.env):**
```bash
VAPI_MASTER_TEMPLATE_ASSISTANT_ID=asst_abc123xyz...
```

**Production (Fly.io):**
```bash
fly secrets set VAPI_MASTER_TEMPLATE_ASSISTANT_ID=asst_abc123xyz... --app ascendia-booking
```

### Step 3: Deploy

```bash
fly deploy --app ascendia-booking
```

---

## ✨ What Gets Cloned

When you set up a new phone number, the system clones **EVERYTHING** from your master template:

✅ **Voice Settings**
- Provider (11labs, Azure, PlayHT)
- Voice ID
- Model (e.g., eleven_turbo_v2_5)
- Speed, stability, etc.

✅ **Model Settings**
- Provider (OpenAI)
- Model (gpt-4o)
- Temperature (0.5)
- Max tokens (250)
- All advanced parameters

✅ **Transcriber Settings**
- Provider (Deepgram)
- Model (nova-2)
- Language
- Keywords, smart formatting, etc.

✅ **Advanced Features**
- Background sound settings
- Silence detection
- Interruption handling
- End call phrases
- Any other Vapi settings you've configured

### What Gets Customized (Per Org)

❌ Assistant ID (new one generated)
❌ Name (user specifies: "Sarah", "Lexi", etc.)
❌ Organization name (in system prompt and first message)
❌ Phone number (newly purchased)
❌ Server URL/secret (always your webhook)
✅ Functions (always latest version)

---

## 📋 How It Works

### For First Organization (Demo Org)
```
1. Configure assistant PERFECTLY in Vapi Dashboard
2. Set VAPI_MASTER_TEMPLATE_ASSISTANT_ID to that assistant
3. Deploy
```

### For All New Organizations
```
Client signs up
  ↓
Goes to Settings → Phone Numbers
  ↓
Clicks "Setup New Number"
  ↓
Enters: Name, Voice Provider, Area Code
  ↓
System:
  1. Fetches MASTER template config from Vapi API
  2. Clones ALL settings
  3. Updates name, org name, phone number
  4. Creates new assistant with cloned config
  5. Purchases & links phone number
  6. Saves to database
  ↓
New org has IDENTICAL config to demo org! ✅
```

---

## 🎨 Benefits

1. **Consistency** - All orgs get the same perfect experience
2. **Quality Control** - Fine-tune once, apply to all
3. **Easy Updates** - Change master, all new orgs inherit it
4. **Zero Manual Work** - Clients just click and go
5. **Tested Config** - If it works for demo org, works for all

---

## 🔧 Updating the Master Template

When you want to change the default config for all NEW orgs:

1. **Update your demo org's assistant** in Vapi Dashboard
2. **Test it** thoroughly
3. **No redeployment needed** - template is fetched in real-time
4. **Next org that signs up** gets the updated config

---

## 🧪 Testing

### Test Template Fetch

```bash
# Check what assistant ID is set
echo $VAPI_MASTER_TEMPLATE_ASSISTANT_ID

# Or on Fly.io
fly ssh console --app ascendia-booking
echo $VAPI_MASTER_TEMPLATE_ASSISTANT_ID
```

### Test Setup with Template

1. Log in as any org (or create test org)
2. Go to Settings → Phone Numbers
3. Click "Setup New Number"
4. Watch server logs for:
   ```
   [Vapi Setup] Fetching MASTER template config from assistant: asst_...
   [Vapi Setup] ✅ Loaded MASTER template config
   [Vapi Setup] ✅ Template-based payload created
   ```

---

## ⚠️ Important Notes

### If VAPI_MASTER_TEMPLATE_ASSISTANT_ID Not Set
- System uses **built-in defaults** (basic config)
- Still works, but won't have your advanced settings
- **Recommended:** Always set a master template!

### Keeping Master Template Updated
- Master template is fetched **on-demand** (not cached)
- Changes to master assistant take effect immediately
- No need to redeploy when you update settings

### Multiple Master Templates (Future)
Could support per-industry templates:
- Dental master template
- Medical master template
- Salon master template
Store in database instead of env var

---

## 📝 Quick Reference

**Find your assistant ID:**
```bash
node scripts/get-vapi-assistant-id.js <org-id>
```

**Set locally:**
```bash
# .env file
VAPI_MASTER_TEMPLATE_ASSISTANT_ID=asst_abc123xyz...
```

**Set on Fly.io:**
```bash
fly secrets set VAPI_MASTER_TEMPLATE_ASSISTANT_ID=asst_abc123xyz...
```

**Deploy:**
```bash
fly deploy
```

---

**Result:** Every new org gets your perfect Vapi configuration automatically! 🎉
