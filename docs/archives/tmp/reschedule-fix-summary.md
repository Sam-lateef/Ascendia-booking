# Reschedule Workflow Fix Summary

## Root Causes Identified

### 1. Missing Date Context in Workflow Creator
**Problem:** The workflow creator was not receiving current date information, so dynamically generated workflows could contain incorrect date assumptions (like using 2023 instead of 2025).

**Fix:** Added current date context to the workflow creation prompt in `workflowCreator.ts`:
- Current date (TODAY'S DATE: 2025-12-05)
- Current year
- Safe date range (90 days)
- Critical date rules warning against past dates

### 2. Entity Configuration Mismatch
**Problem:** The entity optimization migration was trying to update entities named `phone_number`, but the actual database has entities named `phone`. This caused only 1 entity (confirmation) to be loaded for reschedule instead of the needed entities (phone, firstName, lastName).

**Result:** The workflow kept asking for phone number because it wasn't being extracted and passed to the workflow engine.

**Fix:** Created:
- Migration fix: `supabase/migrations/20231209_entity_optimization_fix.sql`
- Admin API endpoint: `/api/admin/fix-entities` (POST)
- Cleanup script: `scripts/fix-entity-optimization.ts`

## Steps to Apply Fixes

### Step 1: Fix Entity Configuration
Visit this URL in your browser (while dev server is running):
```
http://localhost:3000/api/admin/fix-entities
```
Method: POST (you can use a tool like Postman, or create a button in the admin UI)

This will:
- Tag `phone` entity with `used_in_workflows: ['book', 'reschedule', 'cancel', 'check']`
- Mark `phone` as `is_core: true` with `extraction_priority: 1`
- Add `firstName` and `lastName` to reschedule workflow
- Clear the entity cache

### Step 2: Delete Bad Workflow
The dynamically created workflow (ID: `b0dadfae-66ca-4d7f-ba84-e3e3e09a2f24`) has:
- Incorrect date assumptions (might use 2023 dates)
- Missing entity support (created before phone was properly tagged)

**Option A - Via Supabase UI:**
Go to Supabase → SQL Editor → Run:
```sql
DELETE FROM dynamic_workflows WHERE id = 'b0dadfae-66ca-4d7f-ba84-e3e3e09a2f24';
```

**Option B - Via Admin UI:**
1. Go to `/admin/config/workflows`
2. Find the workflow for "reschedule"
3. Delete or mark as inactive

### Step 3: Test
1. Start a new conversation
2. Say "I need to reschedule for Saddam Lateef"
3. Provide phone number when asked: "6194563962"

**Expected behavior:**
- System should extract phone number entity
- System should create a NEW workflow with:
  - Correct 2025 dates
  - Proper phone number entity support
- System should find the patient and their appointments
- Should search with `DateStart: '2025-12-05'` not `2023-10-01`

## Files Changed

### Modified:
- `src/app/lib/workflows/workflowCreator.ts` - Added date context to workflow creation prompt

### Created:
- `supabase/migrations/20231209_entity_optimization_fix.sql` - SQL migration to fix entity tagging
- `src/app/api/admin/fix-entities/route.ts` - API endpoint to apply the fix
- `scripts/fix-entity-optimization.ts` - Standalone script (alternative method)
- `tmp/reschedule-fix-summary.md` - This file

## Verification

After applying fixes, verify in logs:
```
[2-Stage Extractor] Loaded 3+ entities for workflow: reschedule
```
(Should be 3-4 entities, not just 1)

And verify appointments are searched with current year:
```
[Orchestrator] Calling GetAppointments: { PatNum: 12, DateStart: '2025-12-05', DateEnd: '2025-03-05' }
```
(Should be 2025, not 2023)

## Why This Happened

1. **Entity Optimization Migration** (20231209) used entity name `phone_number`, but actual entity in DB is `phone`
2. **Workflow Creator** had no date awareness, so LLMs could assume any year
3. **Cascading failure:** Missing entities → workflow asks for phone → entities not extracted properly → loop

## Prevention

- Entity names in migrations should match actual schema
- Always include temporal context (date/year) when generating time-sensitive code
- Log entity counts to catch configuration mismatches early


















