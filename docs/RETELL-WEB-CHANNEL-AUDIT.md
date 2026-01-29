# Retell vs Web Channel Audit

## Executive Summary

**Status**: ✅ **FIXED - Organization context now passed for all channels**

Both channels use the same agent logic, and now **organization ID is properly passed** through the call chain for server-side requests (Retell/Twilio).

**Implementation**: See `docs/ORG-CONTEXT-FIX-IMPLEMENTED.md` for details.

---

## ✅ What's IDENTICAL (Good!)

### 1. Agent Configuration
- ✅ Both use `embeddedBooking` agent configs
- ✅ Both call `executeOrchestrator` for booking logic
- ✅ Both route to `/api/booking` for database operations

### 2. Booking Logic
- ✅ No hardcoded `ProvNum=1` or `OpNum=1` in orchestrator
- ✅ Op auto-fill logic in `/api/booking/route.ts` (lines 593-620, 687-714)
- ✅ Conversation state tracking via `conversationState.ts`
- ✅ LLM extraction for missing parameters

### 3. API Route
- ✅ Same `/api/booking` endpoint
- ✅ Same validation logic
- ✅ Same database operations
- ✅ Same multi-tenancy support

---

## ❌ What's BROKEN (The Critical Issue!)

### Authentication Flow Comparison

#### Web Chat (WORKS ✅):
```
User Browser
  → Has cookies (Supabase auth + org_id)
  → POST /api/responses
  → orchestrator calls fetch('/api/booking')
    → credentials: 'include' (sends cookies)
    → getCurrentOrganization(req) reads cookies ✅
    → organizationId extracted ✅
```

#### Retell (BROKEN ❌):
```
Retell Phone Call
  → WebSocket Server (standalone Node.js, NO cookies)
  → callGreetingAgent()
  → POST /api/responses (NO cookies!)
  → orchestrator calls fetch('/api/booking')
    → credentials: 'include' (but NO cookies to send!)
    → getCurrentOrganization(req) fails ❌
    → Uses default/wrong organizationId ❌
    → RLS Error: "new row violates row-level security policy"
```

### The Root Cause

**File**: `d:\Dev\Agent0\src\app\agentConfigs\embeddedBooking\orchestratorAgent.ts`
**Line**: 868-875

```typescript
const response = await fetch(`${baseUrl}/api/booking`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // ⚠️ Only works in browser context!
  body: JSON.stringify(requestBody),
});
```

**Problem**: 
- `credentials: 'include'` relies on browser cookies
- WebSocket server runs server-side (Node.js) with NO cookies
- No authentication headers are sent
- `/api/booking` can't determine organization ID

---

## 🔧 Required Fixes

### Fix #1: Pass Organization ID Through Call Chain

**Option A: Modify `callGreetingAgent` signature** (Recommended)

1. Update WebSocket handler to pass orgId:
```typescript
// src/retell/websocket-handler.ts
const response = await callGreetingAgent(
  userMessage,
  workingHistory,
  isFirstMessage,
  undefined,
  orgId // ⬅️ NEW: Pass org ID
);
```

2. Update `greetingAgentSTT.ts`:
```typescript
export async function callGreetingAgent(
  userMessage: string,
  conversationHistory: any[] = [],
  isFirstMessage: boolean = false,
  playOneMomentAudio?: () => Promise<void>,
  organizationId?: string // ⬅️ NEW parameter
): Promise<string>
```

3. Pass to `/api/responses`:
```typescript
const body: any = {
  model: 'gpt-4o-mini',
  instructions: instructions,
  tools: greetingAgentTools,
  input: cleanInput,
  organizationId: organizationId // ⬅️ NEW: Pass to API
};
```

4. Update `/api/responses` to accept and forward orgId
5. Update orchestrator to include orgId in headers:
```typescript
const response = await fetch(`${baseUrl}/api/booking`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Organization-Id': organizationId, // ⬅️ NEW header
  },
  credentials: 'include',
  body: JSON.stringify(requestBody),
});
```

6. Update `/api/booking` to read from header:
```typescript
// In getCurrentOrganization or directly in POST handler
const orgIdHeader = request.headers.get('X-Organization-Id');
if (orgIdHeader) {
  // Use this for server-side calls (Retell, Twilio)
  context.organizationId = orgIdHeader;
}
```

**Option B: Service Account Tokens** (More complex)
- Create service accounts per organization
- Generate JWT tokens
- Pass tokens through Authorization header

---

## 📋 Testing Checklist

After implementing fixes:

- [ ] Web Chat still works (don't break existing functionality)
- [ ] Retell calls route to correct organization
- [ ] CreatePatient succeeds (no RLS error)
- [ ] CreateAppointment has correct Op (auto-filled)
- [ ] GetAvailableSlots searches all providers/operatories
- [ ] Multi-org: Test with `sam-lateeff` and other orgs
- [ ] Logs show correct org ID:
  ```
  [Booking API] Request from org: b445a9c7-af93-4b4a-a975-40d3f44178ec
  ```

---

## 🎯 Summary

| Feature | Web Chat | Retell |
|---------|----------|--------|
| Agent Logic | ✅ Same | ✅ Same |
| Booking API | ✅ Same | ✅ Same |
| Op Auto-fill | ✅ Works | ✅ Works |
| No Hardcoded IDs | ✅ Fixed | ✅ Fixed |
| **Org Context** | ✅ **Cookies** | ❌ **MISSING** |
| **Status** | ✅ **WORKING** | ❌ **RLS ERRORS** |

**Next Step**: Implement Fix #1 (Option A) to pass organizationId through the call chain.
