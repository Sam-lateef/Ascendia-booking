# Testing Guide: Database-Driven Agent Configuration

This guide walks through testing the complete database-driven configuration system from A to Z.

---

## Prerequisites

Before testing, ensure:

1. ✅ `.env.local` has correct Supabase credentials:
   ```env
   SUPABASE_URL=your_project_url
   SUPABASE_SERVICE_KEY=your_service_role_key
   SUPABASE_ANON_KEY=your_anon_key
   ```

2. ✅ Migration applied: `20231207_agent_config_storage.sql`

3. ✅ Development server running: `npm run dev`

---

## Phase 1: Database Verification

### Step 1: Check Tables Exist

Run in Supabase SQL Editor:

```sql
-- Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('agent_workflows', 'business_rules')
ORDER BY table_name;
```

**Expected Output:**
```
agent_workflows
business_rules
```

### Step 2: Verify Seed Data

```sql
-- Check workflows
SELECT workflow_id, name, jsonb_array_length(steps) as step_count, is_active
FROM agent_workflows
ORDER BY display_order;

-- Expected: 3 workflows (book, reschedule, cancel)
```

**Expected Output:**
| workflow_id | name | step_count | is_active |
|------------|------|------------|-----------|
| book | Book New Appointment | 10 | true |
| reschedule | Reschedule Existing Appointment | 11 | true |
| cancel | Cancel Appointment | 6 | true |

```sql
-- Check business rules
SELECT title, severity, applies_to, is_active
FROM business_rules
WHERE 'orchestrator' = ANY(applies_to)
ORDER BY display_order;

-- Expected: 6+ rules
```

**Expected Output:**
| title | severity | applies_to |
|-------|----------|------------|
| Never Skip User Choices | critical | {orchestrator} |
| Always Ask for New Date | critical | {orchestrator} |
| Show Existing Appointments | high | {orchestrator} |
| ... | ... | ... |

### Step 3: Check Domain Prompts (Optional)

```sql
SELECT 
  domain_name,
  LEFT(persona_prompt_template, 50) as persona_preview,
  is_active
FROM domains
WHERE is_active = true
LIMIT 1;
```

**Expected:** At least one active domain with a persona prompt.

---

## Phase 2: API Testing

### Test 1: Workflows API

**GET Request:**
```bash
curl http://localhost:3000/api/admin/config/agent-workflows
```

**Expected Response:**
```json
{
  "workflows": [
    {
      "id": "uuid-here",
      "workflow_id": "book",
      "name": "Book New Appointment",
      "steps": [...],
      "display_order": 1
    },
    ...
  ]
}
```

**Verification:**
- ✅ Status 200
- ✅ Returns array of workflows
- ✅ Each workflow has `steps` as JSON array

### Test 2: Business Rules API

**GET Request:**
```bash
curl http://localhost:3000/api/admin/config/business-rules
```

**Expected Response:**
```json
{
  "rules": [
    {
      "id": "uuid-here",
      "title": "Never Skip User Choices",
      "rule_text": "ALWAYS present time options...",
      "severity": "critical",
      "applies_to": ["orchestrator"]
    },
    ...
  ]
}
```

**Verification:**
- ✅ Status 200
- ✅ Returns array of rules
- ✅ Rules have `applies_to` array field

---

## Phase 3: Admin UI Testing

### Test 1: Orchestrator Config Page

**Steps:**
1. Navigate to: `http://localhost:3000/admin/config/orchestrator`
2. Wait for page to load

**Expected Behavior:**
- ✅ Page displays "Orchestrator Agent" header
- ✅ "Workflows" section shows 3 workflows
- ✅ Clicking a workflow expands its steps
- ✅ "Business Rules" section shows rules with color coding:
  - Red border: Critical
  - Amber border: High
  - Blue border: Medium
- ✅ Bottom note says: "✅ Configuration loaded from database!"
- ✅ NO error messages or "Supabase not configured" warnings

**Browser Console Check:**
```
[Orchestrator] ✅ Configuration loaded from database
Loaded 3 workflows and 6 business rules from database
```

### Test 2: Refresh Functionality

**Steps:**
1. On Orchestrator page, click "Refresh" button
2. Watch browser console

**Expected:**
- ✅ Page reloads data from API
- ✅ No errors in console
- ✅ Console shows: `Loaded X workflows and Y business rules`

---

## Phase 4: Agent Runtime Testing

### Test 1: Orchestrator Agent Startup

**Steps:**
1. Restart dev server: `Ctrl+C` then `npm run dev`
2. Watch terminal output

**Expected Terminal Output:**
```
[Orchestrator] ✅ Configuration loaded from database
```

**If you see this instead (PROBLEM):**
```
[Orchestrator] ⚠️ Could not load config from database, using hardcoded fallback
```

**Troubleshooting:**
- Check `.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Verify migration was applied
- Check Supabase project is not paused

### Test 2: Lexi Agent Startup

**Expected Terminal Output:**
```
[Lexi] ✅ Persona prompt loaded from database
```

**If you see this instead (PROBLEM):**
```
[Lexi] ⚠️ Could not load persona from database, using hardcoded fallback
```

**Troubleshooting:**
- Check if `domains` table has data
- Verify `persona_prompt_template` field is populated
- Run seed script: `tmp/seed-agent-config.sql`

### Test 3: Agent Uses Database Config

**Steps:**
1. Make a change to a workflow in Supabase:

```sql
-- Update first step of booking workflow
UPDATE agent_workflows
SET steps = jsonb_set(
  steps,
  '{0,text}',
  '"TEST: Identify patient by name or phone"'
)
WHERE workflow_id = 'book';
```

2. Wait 60 seconds (cache TTL)
3. Restart dev server to force reload

**Expected Behavior:**
- ✅ Orchestrator loads the modified workflow
- ✅ When you inspect instructions, you see "TEST: Identify patient..."

**Verification Query:**
```sql
-- Verify your change
SELECT steps->0->>'text' as first_step
FROM agent_workflows
WHERE workflow_id = 'book';
```

### Test 4: Fallback to Hardcoded Config

**Steps:**
1. Stop Supabase (or temporarily set invalid `SUPABASE_URL`)
2. Restart dev server

**Expected Terminal Output:**
```
[Orchestrator] ⚠️ Could not load config from database, using hardcoded fallback
[Orchestrator] Using hardcoded fallback configuration
```

**Expected Behavior:**
- ✅ Agent still starts successfully
- ✅ Uses hardcoded workflows and rules
- ✅ No crashes or blocking errors

---

## Phase 5: End-to-End Conversation Test

### Test 1: Booking Flow (Orchestrator)

**Method:** Use the agent UI or embed test page

**Steps:**
1. Start a conversation
2. Say: "I need to book an appointment"
3. Agent should follow database-loaded workflow

**What to Observe:**
- ✅ Agent follows steps from `agent_workflows.steps`
- ✅ Agent enforces rules from `business_rules` (e.g., "present options, don't pick for user")
- ✅ Agent behavior matches what's in the database

**How to Verify Agent is Using DB Config:**
```sql
-- Add a unique phrase to a rule
UPDATE business_rules
SET rule_text = 'TEST PHRASE: ' || rule_text
WHERE title = 'Never Skip User Choices';
```

Then test booking and check if agent instructions include "TEST PHRASE".

### Test 2: Lexi Persona

**Steps:**
1. Start a conversation
2. Agent greets you

**Expected:**
- ✅ Agent says office name from template: "Welcome to [OFFICE_NAME]"
- ✅ Agent identifies as "Lexi"
- ✅ Greeting matches `persona_prompt_template` from database

**How to Verify Agent is Using DB Persona:**
```sql
-- Update persona greeting
UPDATE domains
SET persona_prompt_template = REPLACE(
  persona_prompt_template,
  'Hi! Welcome to',
  'TEST: Hello! Welcome to'
)
WHERE is_active = true;
```

Restart server, start conversation, and verify agent says "TEST: Hello!".

---

## Phase 6: Performance Testing

### Test 1: Cache Performance

**Steps:**
1. Make 5 API requests to `/api/admin/config/agent-workflows` within 1 minute
2. Check server logs

**Expected:**
- ✅ First request queries database
- ✅ Next 4 requests use cache (faster response)
- ✅ No "429 Too Many Requests" errors

### Test 2: Cache Expiry

**Steps:**
1. Request workflows (cache miss)
2. Wait 61 seconds
3. Request workflows again

**Expected:**
- ✅ Second request queries database (cache expired)
- ✅ Console shows: `Loaded X workflows and Y business rules from database`

---

## Success Criteria Checklist

### Database Layer
- [ ] Tables `agent_workflows` and `business_rules` exist
- [ ] Seed data present (3 workflows, 6+ rules)
- [ ] Domain prompts populated (if using)

### API Layer
- [ ] `/api/admin/config/agent-workflows` returns 200 with data
- [ ] `/api/admin/config/business-rules` returns 200 with data
- [ ] No "Supabase not configured" errors

### Admin UI
- [ ] Orchestrator page loads workflows from API
- [ ] Workflows are expandable and show steps
- [ ] Business rules display with correct severity colors
- [ ] Refresh button works
- [ ] No errors in browser console

### Agent Runtime
- [ ] Console shows: `✅ Configuration loaded from database`
- [ ] Orchestrator uses database workflows
- [ ] Lexi uses database persona
- [ ] Template variables replaced correctly
- [ ] Fallback works if database unavailable

### End-to-End
- [ ] Agent follows database-defined workflow steps
- [ ] Agent enforces database-defined business rules
- [ ] Changes to database reflect in agent behavior (after cache refresh)
- [ ] No crashes or blocking errors

---

## Common Issues & Fixes

### Issue: "Supabase not configured"

**Cause:** Environment variables missing or incorrect

**Fix:**
```bash
# Check if vars are set
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY

# Add to .env.local if missing
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...

# Restart server
```

### Issue: Agent still uses hardcoded config

**Cause:** Cache not refreshed or database query failed

**Fix:**
1. Check database connection
2. Wait 60 seconds for cache to expire
3. Restart server to force reload

### Issue: Workflows empty in admin UI

**Cause:** Migration not applied or seed data missing

**Fix:**
```sql
-- Re-run seed from migration
-- Or run tmp/seed-agent-config.sql
```

### Issue: Template variables not replaced in Lexi

**Cause:** Domain prompts not seeded

**Fix:**
```sql
-- Update domain prompts
UPDATE domains
SET persona_prompt_template = '[your prompt with {OFFICE_NAME} etc.]'
WHERE is_active = true;
```

---

## Rollback Plan

If database-driven config causes issues:

### Option 1: Disable Database Loading (Temporary)

**Edit:** `src/app/lib/agentConfigLoader.ts`

```typescript
// Force fallback by setting cache TTL to 0
const CACHE_TTL = 0; // Disables database loading
```

### Option 2: Revert to Hardcoded (Permanent)

**Edit:** `src/app/agentConfigs/embeddedBooking/orchestratorAgent.ts`

```typescript
// Comment out database preload
/*
(async () => {
  const [workflows, rules] = await Promise.all([...]);
})();
*/
```

Agents will use hardcoded instructions only.

---

## Next Steps After Testing

Once all tests pass:

1. **Deploy to Production**
   - Apply migration to production database
   - Verify environment variables
   - Monitor agent behavior

2. **Enable Configuration Editing**
   - Build UI for editing workflows
   - Add form for business rules
   - Create persona prompt editor

3. **Add Version Control**
   - Track configuration changes
   - Enable rollback to previous versions
   - Show change history in admin UI

4. **Optimize Performance**
   - Increase cache TTL if stability is high
   - Add Redis for distributed caching
   - Pre-warm cache on server start

---

## Support

If you encounter issues not covered here:

1. Check console logs (browser + server)
2. Verify database tables and data
3. Test API endpoints directly with curl
4. Review `docs/database-driven-agents.md` for detailed architecture

**Logs to Share When Reporting Issues:**
- Server terminal output (especially lines with `[Orchestrator]` or `[Lexi]`)
- Browser console errors
- API response (from curl or Network tab)
- Database query results (workflows/rules count)





















