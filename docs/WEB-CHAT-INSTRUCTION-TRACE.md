# Web Chat Instruction Routing - Complete Trace

## Date: 2026-01-26

---

## ✅ **Fixed Issues:**

1. **Old hardcoded agent configs were overriding database config**
2. **Model selection (mini vs 4o) was not respected**
3. **UI badge showed wrong model name**

---

## 🔄 **Instruction Flow (NOW):**

### **Step 1: Admin Saves Instructions** 
```
Location: /admin/settings/channels
File: src/app/admin/settings/channels/page.tsx

User Action:
1. Expands "Web" channel
2. Selects Agent Mode (One Agent or Two Agent)
3. For One Agent: Selects model (GPT-4o or GPT-4o-mini)
4. Pastes instructions into textarea
5. Clicks "Save"

What Happens:
- handleSaveChannel() → POST /api/admin/channel-configs
- Saves to DB table: channel_configurations.instructions
- For two-agent: Stores as "receptionist\n\n---SUPERVISOR---\n\nsupervisor"
- For single-agent: Stores directly
```

---

### **Step 2: Testing Lab Loads Config**
```
Location: /agent-ui
File: src/app/agent-ui/AgentUIApp.tsx

On Page Load (useEffect):
1. Fetches GET /api/admin/channel-configs
2. Loads all channel configs from database
3. Filters for testable channels (web, twilio, retell, whatsapp)
4. Sets selectedChannel = 'web'
5. Extracts config: channelConfigs['web']
6. Sets agentEngine based on config.settings.agent_mode

Console Logs:
✅ [Testing Lab] Loading channel configurations...
✅ [Testing Lab] Loaded configs: [{channel: 'web', instructions: '...', ...}]
✅ [Testing Lab] Selected channel: web, mode: single
```

---

### **Step 3: User Clicks "Connect"**
```
Function: connectToSession()

1. Validates channelConfig exists
2. Logs: "[AgentUI] Using database channel config"
3. Calls: fetchEphemeralKey()
   - Determines correct model from one_agent_model setting
   - Calls: GET /api/session?mode=premium (or standard for mini)
   - Returns OpenAI ephemeral key
   
4. Dynamically imports RealtimeAgent and creates tools inline

5. Creates agents from DB:
   
   IF SINGLE-AGENT:
   - Model: channelConfig.settings.one_agent_model
     * 'gpt-4o-realtime' → 'gpt-4o-realtime-preview-2024-12-17'
     * 'gpt-4o-mini-realtime' → 'gpt-4o-mini-realtime-preview-2024-12-17'
   - Voice: channelConfig.settings.voice || 'sage'
   - Instructions: channelConfig.instructions ← FROM DATABASE!
   - Tools: 9 booking tools (created inline)
   
   IF TWO-AGENT:
   - Split instructions on '---SUPERVISOR---'
   - Receptionist:
     * Model: 'gpt-4o-mini-realtime-preview-2024-12-17'
     * Instructions: receptionistInstructions ← FROM DATABASE!
   - Supervisor:
     * Model: 'gpt-4o'
     * Instructions: supervisorInstructions ← FROM DATABASE!

6. Calls realtimeSession.connect() with dynamically created agents

Console Logs:
✅ [AgentUI] Using database channel config: {hasInstructions: true, instructionsLength: 5432}
✅ [AgentUI] 💎 Premium mode (single-agent): gpt-4o-mini-realtime-preview-2024-12-17
✅ [AgentUI] 📝 Single-agent instructions (length: 5432)
✅ [AgentUI] Preview: "IDENTITY & PERSONALITY\nYou are Lexi..."
✅ [AgentUI] Is using database instructions? true
✅ [AgentUI] ✅ Created agents from DB config: [
     {name: 'lexi', model: 'gpt-4o-mini-realtime...', instructionsLength: 5432}
   ]
```

---

## 🚫 **What Was REMOVED (Old System):**

```typescript
// ❌ REMOVED: Hardcoded agent imports
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import openDentalScenario from "@/app/agentConfigs/openDental";
import embeddedBookingScenario from "@/app/agentConfigs/embeddedBooking";

// ❌ REMOVED: URL-based agent config system
const sdkScenarioMap = { dental: [...], 'embedded-booking': [...] };
useEffect(() => {
  let finalAgentConfig = searchParams.get("agentConfig");
  const agents = allAgentSets[finalAgentConfig]; // ← Was using hardcoded!
  setSelectedAgentConfigSet(agents);
}, [searchParams]);

// ❌ REMOVED: Agent switching state (no longer needed)
const [selectedAgentName, setSelectedAgentName] = useState<string>("");
const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<RealtimeAgent[] | null>(null);
```

---

## ✅ **What's NOW ACTIVE (Database System):**

```typescript
// ✅ Load configs from database
useEffect(() => {
  const response = await fetch('/api/admin/channel-configs');
  const configs = await response.json();
  setChannelConfigs(configMap); // ← Stores DB configs
}, []);

// ✅ Build agents dynamically from DB
const connectToSession = async () => {
  const channelConfig = channelConfigs[selectedChannel]; // ← From database!
  
  const agent = new RealtimeAgent({
    instructions: channelConfig.instructions, // ← From database!
    model: oneAgentModel, // ← From channelConfig.settings!
    voice: channelConfig.settings?.voice, // ← From database!
    tools: bookingTools
  });
  
  await realtimeSession.connect({
    initialAgents: [agent] // ← Dynamically created from DB!
  });
};
```

---

## 🧪 **How to Verify:**

### **1. Clear Browser Cache**
```
Hard refresh: Ctrl + Shift + R
```

### **2. Check Console When Connecting**
You should see:
```
[Testing Lab] Loaded configs: [{channel: 'web', instructions: '...5432 chars...'}]
[AgentUI] Using database channel config: {hasInstructions: true, instructionsLength: 5432}
[AgentUI] 📝 Single-agent instructions (length: 5432)
[AgentUI] Preview: "IDENTITY & PERSONALITY..."  ← Should match what you pasted in admin!
[AgentUI] Is using database instructions? true
[AgentUI] ✅ Created agents from DB config: [{
  name: 'lexi',
  model: 'gpt-4o-mini-realtime-preview-2024-12-17',  ← Correct model!
  instructionsLength: 5432  ← From database!
}]
```

### **3. Check UI Badge**
Should now show:
- **"1 Agent (GPT-4o-mini)"** if you selected mini
- **"1 Agent (GPT-4o)"** if you selected gpt-4o

---

## 📁 **Database Schema:**

```sql
-- Instructions stored here:
SELECT 
  channel, 
  enabled,
  settings->>'agent_mode' as agent_mode,
  settings->>'one_agent_model' as model,
  LENGTH(instructions) as instruction_length,
  LEFT(instructions, 100) as preview
FROM channel_configurations
WHERE organization_id = 'your-org-id'
  AND channel = 'web';
```

---

## 🔍 **Troubleshooting:**

### **If you still see old instructions:**

1. **Check database has your instructions:**
```sql
SELECT instructions FROM channel_configurations 
WHERE channel = 'web' AND organization_id = 'your-org-id';
```

2. **Clear channel config cache:**
```typescript
// In browser console:
fetch('/api/admin/channel-configs', { 
  method: 'DELETE' // if you add this route
});
```

3. **Check console logs show:**
```
Is using database instructions? true
instructionsLength: >1000 (not just "You are Lexi, a helpful assistant" fallback)
```

---

## 🎯 **Summary:**

| Before | After |
|--------|-------|
| Hardcoded in TypeScript files | Loaded from `channel_configurations` table |
| URL param `?agentConfig=dental` | Channel selector dropdown |
| Fixed agent configs | Dynamic agent creation per channel |
| Mode from URL | Mode from `settings.agent_mode` |
| Always GPT-4o | Respects `settings.one_agent_model` |

---

**All instructions now come from database - no more hardcoded fallbacks!** ✅
