# Retell Agent Instruction Pipeline

## Overview
This document traces the complete flow of how Retell agent instructions are built and where they come from (database vs hardcoded).

---

## 1. ENTRY POINT: Web Call Creation

**File:** `src/app/api/retell/create-web-call/route.ts`

When a Retell call is initiated, the system:
1. Gets organization ID from headers/cookies
2. Loads Retell credentials (API key, agent ID) from database or falls back to `.env`
3. Creates a web call using Retell's REST API

**Database Tables Used:**
- `api_credentials` (for Retell API keys and agent IDs)

**Instructions Source:** None at this stage - just sets up the call connection

---

## 2. WEBSOCKET CONNECTION: Initial Setup

**File:** `src/retell/websocket-handler.ts`

When Retell connects to the WebSocket:

### Lines 379-435: Organization & Channel Config Loading

```typescript
// 1. Parse org slug from WebSocket URL
//    /llm-websocket/:org_slug/:call_id
//    e.g., /llm-websocket/nurai-clinic/abc123

// 2. Get organization ID from slug mapping
const ORG_SLUG_MAP: Record<string, string> = {
  'nurai-clinic': '660d9ca6-b200-4c12-9b8d-af0a470d8b88',
  // ... other orgs
};

// 3. Load channel configuration from database
const channelConfig = await getRetellChannelConfig(orgId);
```

### Lines 32-72: Channel Config Fetch

```typescript
async function getRetellChannelConfig(organizationId: string): Promise<RetellChannelConfig> {
  // Fetches from: /api/admin/channel-configs
  // Returns:
  // - enabled: boolean
  // - ai_backend: 'openai_gpt4o' | 'openai_gpt4o_mini' | 'anthropic_claude'
  // - data_integrations: string[]
  // - instructions?: string (OPTIONAL OVERRIDE)
}
```

**Database Tables Used:**
- `channel_configurations` (per-org channel settings, including optional `instructions` field)

**Instructions Source:** Can have custom instructions per channel, but typically `null` (uses defaults)

---

## 3. MESSAGE PROCESSING: Greeting Agent

**File:** `src/retell/websocket-handler.ts`

### Lines 283-340: Processing with LLM

When user speaks, the system calls:
```typescript
processWithLLMLegacy(userMessage, callId, conversationHistory, organizationId)
```

This imports and calls:
```typescript
import { callGreetingAgent } from '../app/agentConfigs/embeddedBooking/greetingAgentSTT';

await callGreetingAgent(
  userMessage,
  workingHistory,
  isFirstMessage,
  undefined,
  organizationId
);
```

---

## 4. GREETING AGENT: Instruction Generation

**File:** `src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts`

### Lines 9-27: Database Config Preload

```typescript
// ✅ TRIES TO LOAD FROM DATABASE (on server startup)
let lexiPersonaPrompt: string | null = null;
let lexiConfigLoaded = false;

if (typeof window === 'undefined') {
  (async () => {
    const prompts = await loadDomainPrompts();
    if (prompts.persona_prompt && prompts.persona_prompt.trim()) {
      lexiPersonaPrompt = prompts.persona_prompt;
      lexiConfigLoaded = true;
      console.log('[Lexi] ✅ Persona prompt loaded from database');
    }
  })();
}
```

**Database Tables Used:**
- `domains` table (via `loadDomainPrompts()` from `agentConfigLoader.ts`)
  - Column: `system_prompt_template` (persona prompt)
  - Column: `business_rules`

### Lines 37-171: Instruction Generation

```typescript
export function generateGreetingAgentInstructions(forRealtime: boolean = false): string {
  // PRIORITY 1: Use database persona if loaded
  if (lexiConfigLoaded && lexiPersonaPrompt) {
    console.log('[Lexi] Using database-configured persona');
    
    // Inject office info into persona template
    const personalizedPrompt = lexiPersonaPrompt
      .replace(/{persona_name}/g, 'Lexi')
      .replace(/{company_name}/g, dentalOfficeInfo.name)
      // ... more template replacements
      
    return personalizedPrompt;
  }

  // PRIORITY 2: FALLBACK - Use hardcoded instructions
  console.log('[Lexi] Using hardcoded fallback persona');
  
  return `IDENTITY
You are Lexi, a friendly dental receptionist...
[500+ lines of hardcoded instructions]`;
}
```

**Current Status:** 🟡 **HYBRID**
- **Tries database first** (via `domains.system_prompt_template`)
- **Falls back to hardcoded** if database not loaded or empty

---

## 5. ORCHESTRATOR: Workflow Instructions

**File:** `src/app/agentConfigs/embeddedBooking/orchestratorAgent.ts`

When greeting agent hands off to orchestrator (via `getNextResponseFromSupervisor` tool):

### Lines 156-218: Database Config Loading

```typescript
async function getStaticInstructionsFromDatabase(): Promise<string> {
  try {
    // 1. Load workflows from database
    const [workflows, rules] = await Promise.all([
      loadAgentWorkflows(),      // From agent_workflows table
      loadBusinessRules('orchestrator')  // From business_rules table
    ]);

    // 2. Format as instructions
    const workflowInstructions = formatWorkflowsAsInstructions(workflows);
    const businessRulesInstructions = formatBusinessRulesAsInstructions(rules);

    // 3. Combine with function catalog
    const instructions = `
BOOKING SYSTEM WORKFLOWS
${workflowInstructions}

${businessRulesInstructions}

${functionCatalog}
`;
    
    return instructions;
  } catch (error) {
    // FALLBACK: Use hardcoded version
    return getStaticInstructions();
  }
}
```

**Database Tables Used:**
- `agent_workflows` (booking/reschedule/cancel flows)
  - Columns: `name`, `description`, `steps[]`, `display_order`
- `business_rules` (critical constraints)
  - Columns: `title`, `rule_text`, `severity`, `applies_to[]`

**Current Status:** 🟡 **HYBRID**
- **Tries database first** (workflows + business rules)
- **Falls back to hardcoded** if database fails

---

## 6. INSTRUCTION SOURCES SUMMARY

### Database-Driven (✅ Configurable)

1. **Greeting Agent Persona**
   - Table: `domains`
   - Column: `system_prompt_template`
   - Used by: `greetingAgentSTT.ts`
   - Template variables: `{persona_name}`, `{company_name}`, etc.

2. **Orchestrator Workflows**
   - Table: `agent_workflows`
   - Columns: `name`, `description`, `steps[]`
   - Used by: `orchestratorAgent.ts`

3. **Business Rules**
   - Table: `business_rules`
   - Columns: `title`, `rule_text`, `severity`, `applies_to[]`
   - Used by: `orchestratorAgent.ts`

4. **Channel-Specific Overrides** (Optional)
   - Table: `channel_configurations`
   - Column: `instructions` (TEXT, nullable)
   - Used by: `websocket-handler.ts` (via `getRetellChannelConfig`)
   - Falls back to `domains.system_prompt_template` if null

### Hardcoded Fallbacks (⚠️ Static)

1. **Office Information**
   - File: `src/app/agentConfigs/openDental/dentalOfficeData.ts`
   - Contains: Name, phone, address, hours, services
   - **Status:** Always hardcoded (injected into database templates)

2. **Tool Definitions**
   - File: `greetingAgentSTT.ts` - Lines 176-215
   - Contains: `get_datetime`, `get_office_context`, `getNextResponseFromSupervisor`
   - **Status:** Always hardcoded (required for function calling)

3. **API Function Catalog**
   - File: `src/app/agentConfigs/openDental/apiRegistry.ts`
   - Contains: 49 prioritized OpenDental API functions
   - **Status:** Always hardcoded (generated from JSON registry)

4. **Fallback Instructions** (when database fails)
   - Files: `greetingAgentSTT.ts`, `orchestratorAgent.ts`
   - Contains: Complete hardcoded instruction sets
   - **Status:** Used only when database load fails

---

## 7. INSTRUCTION PRIORITY HIERARCHY

For **Retell** channel, instructions are built in this order:

```
1. Channel Config Override (channel_configurations.instructions)
   ↓ (if null)
2. Domain Persona Template (domains.system_prompt_template)
   ↓ (if not loaded or empty)
3. Hardcoded Fallback (greetingAgentSTT.ts default)

PLUS (always appended):
   + Office Info (dentalOfficeData.ts - hardcoded)
   + Tool Definitions (hardcoded)
   + Orchestrator Workflows (agent_workflows table → fallback)
   + Business Rules (business_rules table → fallback)
   + Function Catalog (apiRegistry.ts - hardcoded)
```

---

## 8. HOW TO CUSTOMIZE RETELL INSTRUCTIONS

### Option 1: Channel-Specific Override (Highest Priority)
```sql
UPDATE channel_configurations
SET instructions = 'Your custom instructions here'
WHERE organization_id = 'your-org-id'
AND channel = 'retell';
```

### Option 2: Organization-Wide Persona (Database)
```sql
UPDATE domains
SET system_prompt_template = 'You are {persona_name}...'
WHERE organization_id = 'your-org-id';
```

### Option 3: Workflow Customization
```sql
-- Add/edit workflows
INSERT INTO agent_workflows (
  organization_id,
  workflow_id,
  name,
  description,
  steps
) VALUES (
  'your-org-id',
  'custom_flow',
  'Custom Flow',
  'Your workflow',
  '[{"text": "Step 1", "isMandatory": true}]'::jsonb
);
```

### Option 4: Business Rule Customization
```sql
-- Add critical rules
INSERT INTO business_rules (
  organization_id,
  title,
  rule_text,
  severity,
  applies_to
) VALUES (
  'your-org-id',
  'Never Double-Book',
  'ALWAYS check for conflicts before booking',
  'critical',
  ARRAY['orchestrator']
);
```

---

## 9. CACHE BEHAVIOR

**Greeting Agent Persona:**
- Loaded once on server startup (async background)
- No automatic refresh
- Restart server to reload

**Orchestrator Workflows/Rules:**
- Cached for 60 seconds (TTL)
- Auto-refreshes on next call after expiry
- Call `clearConfigCache()` to force refresh

**Channel Configuration:**
- Cached for 60 seconds (TTL)
- Auto-refreshes on next call after expiry

---

## 10. TESTING WHICH SOURCE IS ACTIVE

Check the logs when a call starts:

```
✅ Database is being used:
[Lexi] ✅ Persona prompt loaded from database
[Lexi] Using database-configured persona
[Orchestrator] Loaded 5 workflows and 8 business rules from database

⚠️ Fallback is being used:
[Lexi] Using hardcoded fallback persona
[Orchestrator] Using hardcoded fallback configuration
```

---

## 11. CURRENT STATUS (January 2026)

| Component | Source | Status |
|-----------|--------|--------|
| Greeting Agent Persona | Database (`domains.system_prompt_template`) | 🟢 Configurable |
| Orchestrator Workflows | Database (`agent_workflows`) | 🟢 Configurable |
| Business Rules | Database (`business_rules`) | 🟢 Configurable |
| Channel Override | Database (`channel_configurations.instructions`) | 🟢 Configurable |
| Office Info | Hardcoded (`dentalOfficeData.ts`) | 🔴 Static |
| Tool Definitions | Hardcoded | 🔴 Static (required) |
| Function Catalog | Hardcoded (`apiRegistry.ts`) | 🔴 Static (required) |

**Recommendation:** System is mostly database-driven with appropriate fallbacks. The hardcoded components are either required (tools, functions) or could be moved to database (office info).

---

## 12. RELATED FILES

- **Pipeline Entry:** `src/app/api/retell/create-web-call/route.ts`
- **WebSocket Handler:** `src/retell/websocket-handler.ts`
- **Greeting Agent:** `src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts`
- **Orchestrator:** `src/app/agentConfigs/embeddedBooking/orchestratorAgent.ts`
- **Config Loader:** `src/app/lib/agentConfigLoader.ts`
- **Database Schema:** 
  - `supabase/migrations/047_channel_configurations.sql`
  - `supabase/migrations/053_split_instructions_fields.sql`
- **Office Data:** `src/app/agentConfigs/openDental/dentalOfficeData.ts`

---

**Last Updated:** January 27, 2026  
**Latest Fix:** Organization ID bug fixed - see [RETELL-ORG-ID-FIX.md](./RETELL-ORG-ID-FIX.md)
