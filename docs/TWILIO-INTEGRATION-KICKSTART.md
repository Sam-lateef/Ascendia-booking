# Twilio Integration - Knowledge Transfer & Kickstart Guide

**Created:** 2026-01-28  
**Purpose:** Comprehensive context for implementing Twilio integration, based on lessons learned from Retell integration debugging session.

---

## 🎯 **Current Goal**

Restore and enhance Twilio integration for multi-tenant SaaS after refactoring. The integration was working before:
1. Refactoring to multi-tenant SaaS architecture
2. Moving agent instructions from hardcoded to database-driven

**Key Challenge:** Apply all lessons learned from Retell troubleshooting to prevent similar issues with Twilio.

---

## 📋 **Twilio vs Retell Architecture Comparison**

### **Retell Architecture**
- **Voice Infrastructure:** Retell handles STT (Speech-to-Text), TTS (Text-to-Speech), and telephony
- **Custom LLM Agents:** Connect via WebSocket to our server
- **Regular Agents:** Built-in LLM, webhook-only (no WebSocket)
- **Integration Points:**
  - WebSocket: `/llm-websocket/:org_slug/:call_id` (for custom LLM agents)
  - Webhooks: `call_started`, `call_ended`, `call_analyzed`
  - REST API: Create web calls

### **Twilio Architecture**
- **Voice Infrastructure:** Twilio provides phone numbers and call routing ONLY
- **STT/TTS/LLM:** Handled by OpenAI Realtime API (GPT-4o, GPT-4o-mini)
- **Agent Modes:**
  - **Single Agent:** GPT-4o for both conversation and function calling
  - **Two-Agent (Receptionist + Supervisor):**
    - **Receptionist:** GPT-4o-mini for conversation
    - **Supervisor:** GPT-4o for function calling and complex decisions
- **Integration Points:**
  - WebSocket: `/api/twilio/incoming-call` (for Realtime API)
  - Webhooks: Status callbacks, recording callbacks
  - TwiML: Call control instructions

**Key Difference:** Twilio is just telephony routing; we manage the entire AI stack (STT, TTS, LLM) via OpenAI Realtime API.

---

## 🔥 **Critical Lessons from Retell Troubleshooting**

### **1. Organization Routing is CRITICAL**

**Problem:** Calls were appearing in wrong organization or not appearing at all.

**Root Causes:**
- WebSocket pre-creates conversation with correct org (custom LLM agents)
- Webhook-only agents had no org context
- Fallback logic used wrong "Default Organization"

**Solutions Implemented:**
```typescript
// Agent ID → Organization Mapping (for webhook-only agents)
const AGENT_ORG_MAP: Record<string, string> = {
  'agent_85f372e155080a10353d0ca23b': 'b445a9c7-af93-4b4a-a975-40d3f44178ec',
  'agent_20cb9a557ba2def03b6b34a18b': 'b445a9c7-af93-4b4a-a975-40d3f44178ec',
};

// Priority order for determining org:
// 1. Existing conversation (from WebSocket)
// 2. Agent ID mapping
// 3. Phone number mapping (phone_numbers table)
// 4. Fallback to default org
```

**Twilio Application:**
- Twilio calls ALWAYS use WebSocket (OpenAI Realtime API)
- Must pass `organizationId` when creating WebSocket connection
- Need phone number → organization mapping for incoming calls
- Store Twilio phone numbers in `phone_numbers` table with `channel: 'twilio'`

---

### **2. Supabase Client Usage (RLS Security)**

**Problem:** Queries returning empty arrays despite data existing in database.

**Root Cause:** Using wrong Supabase client:
- `db` (anon key) → Blocked by RLS in server-side code
- `getSupabaseAdmin()` (service key) → Bypasses RLS but no org context
- `getSupabaseWithOrg()` (service key + RLS context) → **CORRECT CHOICE**

**Solution Pattern:**
```typescript
// ❌ WRONG (client-side only)
const db = createBrowserClient(...)

// ❌ WRONG (bypasses RLS, returns all orgs' data)
const supabase = getSupabaseAdmin()

// ✅ CORRECT (service key + org context)
const supabase = await getSupabaseWithOrg(organizationId)
```

**Twilio Application:**
- All server-side queries MUST use `getSupabaseWithOrg(organizationId)`
- Extract org from phone number FIRST, then use for all DB operations
- Never use anon key client in API routes or WebSocket handlers

---

### **3. Webhook Event Timing & Race Conditions**

**Problem:** Email notifications missing call summary data.

**Root Cause:** Multiple webhooks arrive asynchronously:
- `call_ended` arrives FIRST (has transcript, duration)
- `call_analyzed` arrives LATER (has AI analysis, summary)
- Email triggered too early = missing data

**Solutions:**
1. **Trigger email from `call_analyzed`** (most complete data)
2. **Handle missing fields gracefully** (refetch with delay if needed)
3. **Race condition handling:**
```typescript
// If duration_ms is missing, wait 2s and refetch
if (!callData.duration_ms) {
  console.log('[Email] Duration missing (race condition), waiting 2s...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const { data: refreshedData } = await supabase
    .from('conversations')
    .select('*')
    .eq('call_id', callData.call_id)
    .single();
  
  if (refreshedData) callData = { ...callData, ...refreshedData };
}
```

**Twilio Application:**
- Twilio status callbacks may arrive out of order
- Recording callbacks arrive AFTER call ends
- Transcript may be generated asynchronously
- Use similar pattern: trigger notifications after ALL data available

---

### **4. Email Template CSS Issues**

**Problem:** Email summary text was invisible (white text on white background).

**Root Cause:** Email clients strip `<style>` tags, CSS classes don't work.

**Solution:** Use inline styles everywhere:
```html
<!-- ❌ WRONG -->
<div class="summary-box">Summary text</div>

<!-- ✅ CORRECT -->
<div style="padding: 16px; background: #667eea; color: #ffffff; border-radius: 8px;">
  Summary text
</div>
```

**Twilio Application:**
- Reuse email template structure from Retell
- Ensure all styles are inline
- Test in multiple email clients (Gmail, Outlook, Apple Mail)

---

### **5. Session/Conversation State Management**

**Problem:** Agent losing context mid-call (asking for phone number twice).

**Root Cause:** Inconsistent `sessionId` generation across WebSocket and agent calls.

**Solution:**
```typescript
// ALWAYS use consistent session ID format
const sessionId = `retell_${callId}`;  // For Retell
const sessionId = `twilio_${callSid}`;  // For Twilio

// Pass sessionId EVERYWHERE
await processWithLLM(userMessage, sessionId, history, organizationId);
await callGreetingAgent(sessionId, organizationId);
```

**Twilio Application:**
- Use `twilio_${CallSid}` as session ID
- Pass sessionId to ALL LLM/agent calls
- Store conversation history in `callHistoryMap` keyed by sessionId
- Never regenerate sessionId mid-call

---

### **6. Database Schema Requirements**

**Critical Tables:**

```sql
-- conversations: Main call/conversation log
CREATE TABLE conversations (
  id uuid PRIMARY KEY,
  session_id text UNIQUE,
  organization_id uuid REFERENCES organizations(id),
  channel text CHECK (channel IN ('voice', 'web', 'whatsapp', 'sms')),
  call_id text, -- Retell call_id
  call_sid text, -- Twilio CallSid
  agent_id text, -- Retell agent_id
  from_number text,
  to_number text,
  call_status text,
  transcript text,
  call_analysis jsonb,
  -- ... many more fields
);

-- phone_numbers: Phone → Organization mapping
CREATE TABLE phone_numbers (
  id uuid PRIMARY KEY,
  phone_number text UNIQUE, -- E.164 format (+15551234567)
  organization_id uuid REFERENCES organizations(id),
  channel text CHECK (channel IN ('retell', 'twilio', 'whatsapp')),
  is_active boolean DEFAULT true,
  friendly_name text
);

-- api_credentials: Store Twilio/Retell credentials per org
CREATE TABLE api_credentials (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  service_name text, -- 'twilio', 'retell', 'openai', etc.
  credential_data jsonb -- { account_sid, auth_token, api_key, etc. }
);
```

**Twilio Application:**
- Ensure `call_sid` field exists in `conversations` table
- Populate `phone_numbers` table with Twilio numbers
- Store Twilio credentials in `api_credentials` table
- Use `channel: 'voice'` for Twilio calls (same as Retell)

---

## 🏗️ **Current Twilio Implementation Status**

### **Existing Files (To Review/Update):**

1. **WebSocket Handler:**
   - `src/twilio/websocket-handler.ts` (standard mode - single agent)
   - `src/twilio/websocket-handler-standard.ts` (backup?)
   
2. **API Routes:**
   - `src/app/api/twilio/incoming-call.ts` (webhook endpoint)
   - `src/app/api/twilio/incoming-call-standard.ts` (backup?)
   - `src/app/api/twilio/incoming-sms.ts` (SMS handling)
   
3. **Agent Configs:**
   - `src/app/agentConfigs/embeddedBooking/lexiAgentTwilio.ts`
   - `src/app/agentConfigs/embeddedBooking/lexiStandardAgent.ts`

### **What Likely Broke:**

1. **Organization ID not being passed to WebSocket handler**
   - Incoming call webhook receives CallSid
   - Need to map `To` (Twilio phone number) → organization
   - Pass org ID to OpenAI Realtime API WebSocket session

2. **Agent instructions not loading from database**
   - Old code had hardcoded instructions
   - New code should load from `agent_instructions` table
   - Need to query by `organization_id` and `channel: 'twilio'`

3. **Supabase client usage in Twilio handlers**
   - Likely using `db` (anon key) instead of `getSupabaseWithOrg()`
   - Queries returning empty results despite data existing

4. **Session ID inconsistency**
   - May be regenerating session ID between webhook and WebSocket
   - Need consistent `twilio_${CallSid}` format

5. **Missing phone number mappings**
   - `phone_numbers` table may be empty for Twilio numbers
   - Need to seed with existing Twilio phone numbers

---

## 🔧 **Step-by-Step Implementation Plan**

### **Phase 1: Audit & Document Current State**

1. **Review existing Twilio files:**
   - Read all Twilio-related files
   - Document current architecture
   - Identify hardcoded vs. dynamic configurations

2. **Check database schema:**
   - Verify `conversations` has Twilio fields (`call_sid`, etc.)
   - Check if `phone_numbers` table exists and has Twilio numbers
   - Verify `api_credentials` can store Twilio creds

3. **Review agent instructions flow:**
   - How are instructions loaded for Retell? (working)
   - Apply same pattern to Twilio
   - Check `agent_instructions` table structure

### **Phase 2: Organization Routing**

1. **Seed phone_numbers table:**
   ```typescript
   // Add Twilio phone numbers
   INSERT INTO phone_numbers (phone_number, organization_id, channel, friendly_name)
   VALUES 
     ('+15551234567', 'b445a9c7-af93-4b4a-a975-40d3f44178ec', 'twilio', 'Main Support Line');
   ```

2. **Create phone lookup function:**
   ```typescript
   async function getOrgFromTwilioNumber(toNumber: string): Promise<string> {
     const supabase = getSupabaseAdmin();
     const { data } = await supabase
       .from('phone_numbers')
       .select('organization_id')
       .eq('phone_number', toNumber)
       .eq('channel', 'twilio')
       .eq('is_active', true)
       .single();
     
     return data?.organization_id || 'b445a9c7-af93-4b4a-a975-40d3f44178ec'; // fallback
   }
   ```

3. **Update incoming call webhook:**
   - Extract `To` parameter (Twilio number called)
   - Map to organization ID
   - Pass org ID to TwiML response (via URL parameter to WebSocket endpoint)

### **Phase 3: Fix Supabase Client Usage**

1. **Replace all anon key clients:**
   ```typescript
   // ❌ OLD
   const { db } = await import('@/app/lib/db');
   
   // ✅ NEW
   const { getSupabaseWithOrg } = await import('@/app/lib/supabaseClient');
   const supabase = await getSupabaseWithOrg(organizationId);
   ```

2. **Update WebSocket handler:**
   - Accept `organizationId` as parameter
   - Use `getSupabaseWithOrg()` for all queries
   - Store org ID in `callOrgMap` for session

3. **Update conversation creation:**
   - Pre-create conversation record with correct org
   - Use consistent `twilio_${CallSid}` session ID
   - Include all Twilio metadata (CallSid, From, To, Direction)

### **Phase 4: Agent Instructions Loading**

1. **Review Retell instruction loading:**
   - Check `src/app/lib/agentConfigLoader.ts`
   - Check `src/app/lib/agentMode.ts`
   - Document the working pattern

2. **Apply same pattern to Twilio:**
   ```typescript
   // Load instructions from database
   async function getTwilioInstructions(organizationId: string): Promise<string> {
     const supabase = await getSupabaseWithOrg(organizationId);
     
     const { data } = await supabase
       .from('agent_instructions')
       .select('instructions')
       .eq('organization_id', organizationId)
       .eq('channel', 'twilio')
       .eq('scope', 'base')
       .single();
     
     return data?.instructions || FALLBACK_INSTRUCTIONS;
   }
   ```

3. **Update agent config files:**
   - Remove hardcoded instructions
   - Load from database using org ID
   - Cache for performance (1-minute TTL)

### **Phase 5: Session State Management**

1. **Consistent session ID:**
   ```typescript
   const sessionId = `twilio_${CallSid}`;
   ```

2. **Store conversation history:**
   ```typescript
   const callHistoryMap = new Map<string, ConversationMessage[]>();
   
   // On each message
   const history = callHistoryMap.get(sessionId) || [];
   history.push({ role: 'user', content: userMessage });
   callHistoryMap.set(sessionId, history);
   ```

3. **Pass sessionId everywhere:**
   - OpenAI Realtime API calls
   - Function execution
   - Database queries
   - Agent mode switches (receptionist ↔ supervisor)

### **Phase 6: Testing & Validation**

1. **Local testing:**
   - Use ngrok to expose local server
   - Configure Twilio webhook to ngrok URL
   - Make test call, verify:
     - Call appears in admin UI
     - Correct organization
     - Agent instructions loaded from DB
     - Context maintained throughout call
     - Transcript saved

2. **Production deployment:**
   - Deploy to Fly.io (main app + WebSocket server if separate)
   - Update Twilio webhook URLs
   - Test with production credentials
   - Monitor logs for errors

3. **Email notifications:**
   - Trigger email after call ends
   - Include transcript, analysis, duration
   - Use inline styles for compatibility
   - Test in multiple email clients

---

## 📁 **Key Files Reference**

### **Working Retell Implementation (Reference):**

```
src/app/api/retell/webhook/route.ts
├── AGENT_ORG_MAP: Agent ID → Org mapping
├── getOrgIdFromCall(): Org determination logic
├── handleCallStarted(): Create conversation record
├── handleCallEnded(): Update with call data
└── handleCallAnalyzed(): Trigger email notification

src/retell/websocket-handler.ts
├── ORG_SLUG_MAP: Slug → Org ID mapping
├── getRetellChannelConfig(): Load config from DB
├── callOrgMap: Track call → org associations
└── processWithLLM(): Consistent sessionId usage

src/app/lib/agentConfigLoader.ts
└── Load agent instructions from database

src/app/lib/email/sendCallEndedEmail.ts
├── Race condition handling (refetch if needed)
└── Email template with inline styles
```

### **Twilio Files to Update:**

```
src/app/api/twilio/incoming-call.ts
└── TODO: Add org mapping from phone number

src/twilio/websocket-handler.ts
├── TODO: Accept organizationId parameter
├── TODO: Use getSupabaseWithOrg()
├── TODO: Load instructions from DB
└── TODO: Consistent twilio_${CallSid} sessionId

src/app/agentConfigs/embeddedBooking/lexiAgentTwilio.ts
└── TODO: Load instructions from DB (remove hardcoded)
```

---

## 🎯 **Twilio-Specific Considerations**

### **Two-Agent Mode (Receptionist + Supervisor)**

**Architecture:**
```
Incoming Call
    ↓
Receptionist (GPT-4o-mini)
├── Handles conversation
├── Collects information
└── Escalates to Supervisor when needed
    ↓
Supervisor (GPT-4o)
├── Makes function calls (search patient, book appointment)
├── Handles complex decisions
└── Returns control to Receptionist
```

**Key Challenges:**
1. **Context Transfer:** Pass full conversation history when switching agents
2. **Session Continuity:** Maintain same sessionId across agents
3. **State Persistence:** Store extracted info (patient, appointment) in conversation state
4. **Agent Instructions:** Both agents need access to organization-specific instructions

**Implementation Pattern:**
```typescript
// In WebSocket handler
async function switchToSupervisor(sessionId: string, reason: string) {
  const history = callHistoryMap.get(sessionId) || [];
  const orgId = callOrgMap.get(sessionId);
  
  // Load supervisor instructions
  const instructions = await getSupervisorInstructions(orgId);
  
  // Call supervisor with full history
  const response = await callSupervisorAgent(sessionId, history, instructions, orgId);
  
  // Return to receptionist
  return response;
}
```

### **OpenAI Realtime API Integration**

**WebSocket Flow:**
```
Twilio Call → Twilio MediaStream
    ↓ (audio chunks)
OpenAI Realtime API WebSocket
    ↓ (transcription + LLM response)
Our Server (function calling)
    ↓ (audio response)
Twilio MediaStream → Caller
```

**Key Points:**
- Audio format: `audio/pcm` (8000 Hz, 16-bit, mono)
- Use `session.update` to change instructions
- Function calls handled by our server
- Response streamed back as audio

---

## 🚨 **Common Pitfalls to Avoid**

1. **❌ Don't hardcode organization IDs anywhere**
   - Always derive from phone number, agent ID, or session
   
2. **❌ Don't use anon key client in server-side code**
   - RLS will block queries
   
3. **❌ Don't regenerate sessionId mid-call**
   - Causes context loss
   
4. **❌ Don't trigger emails before all data available**
   - Handle async webhook timing
   
5. **❌ Don't use CSS classes in email templates**
   - Email clients strip them, use inline styles
   
6. **❌ Don't bypass RLS with getSupabaseAdmin()**
   - Use getSupabaseWithOrg() for proper org isolation

---

## 📊 **Success Criteria**

**Twilio integration is working when:**

- ✅ Incoming call → Correct organization
- ✅ Agent instructions loaded from database
- ✅ Context maintained throughout call
- ✅ Patient lookup/booking functions work
- ✅ Two-agent mode switches correctly (if used)
- ✅ Call appears in admin UI immediately
- ✅ Transcript and analysis saved to database
- ✅ Email notification sent with complete data
- ✅ Multi-tenant isolation working (org A can't see org B's calls)
- ✅ No errors in logs related to RLS or missing org context

---

## 🔗 **Related Documentation**

- `RETELL-CALL-DATA-COMPLETE.md` - Retell field mapping reference
- `SUPABASE-CLIENT-PATTERNS.md` - Correct Supabase client usage
- `MULTI-TENANCY-COMPLETE.md` - Multi-tenant architecture overview
- `CHANNEL-AGENT-PIPELINE-AUDIT.md` - Channel configuration system

---

## 💡 **Next Steps**

**To start Twilio integration work:**

1. Read this document in full
2. Audit existing Twilio code
3. Compare with working Retell implementation
4. Create detailed implementation plan
5. Start with Phase 1 (documentation)
6. Test incrementally after each phase

**Expected timeline:** Similar to Retell debugging (several hours to full day), but faster because we know the patterns now.

---

**This document should be your starting point for the next chat session. Include this entire file in your context.**
