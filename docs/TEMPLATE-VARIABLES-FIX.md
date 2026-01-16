# Template Variables Fix - Dynamic Dates in Workflows

## Issue Found

Workflows were using **hardcoded dates** in `inputMapping`:

```json
{
  "inputMapping": {
    "DateStart": "2025-12-05",  // ❌ Hardcoded - becomes stale
    "DateEnd": "2026-03-05"     // ❌ Hardcoded - becomes stale
  }
}
```

**Problems:**
1. **Staleness:** On Dec 6, 2025, this searches from yesterday!
2. **Not reusable:** Every user gets the same fixed date range
3. **Maintenance:** Workflows need manual updates

## Solution: Template Variables

### Workflow Creation

LLM uses template variable syntax:

```json
{
  "inputMapping": {
    "DateStart": "${todayISO}",    // ✅ Template - updates daily
    "DateEnd": "${safeDateEnd}"    // ✅ Template - always 90 days ahead
  }
}
```

### Runtime Substitution

**File:** `src/app/lib/workflows/dynamicRouter.ts` (Lines 495-512)

```typescript
// Initialize state with dynamic date values
state.data.todayISO = today.toISOString().split('T')[0];
state.data.safeDateEnd = threeMonths.toISOString().split('T')[0];

// Legacy names for backwards compatibility
state.data.today = state.data.todayISO;
state.data.threeMonthsFromNow = state.data.safeDateEnd;
```

**File:** `src/app/lib/workflows/dynamicEngine.ts` (Lines 579-626)

The `buildParams` function looks up values from `state.data`:

```typescript
function buildParams(inputMapping, data) {
  for (const [paramName, dataField] of Object.entries(inputMapping)) {
    // Lookup: dataField = "todayISO"
    let value = getNestedValue(data, dataField);
    // → value = data.todayISO = "2025-12-06"
    
    params[paramName] = value;
    // → params.DateStart = "2025-12-06"
  }
}
```

### Available Template Variables

| Variable | Value | Usage |
|----------|-------|-------|
| `todayISO` | Current date (YYYY-MM-DD) | `"DateStart": "${todayISO}"` |
| `safeDateEnd` | 90 days from now (YYYY-MM-DD) | `"DateEnd": "${safeDateEnd}"` |
| `today` | Same as `todayISO` (legacy) | For backwards compatibility |
| `threeMonthsFromNow` | Same as `safeDateEnd` (legacy) | For backwards compatibility |

### System Fields (Not Entities)

These are automatically available in workflows but are NOT entities:
- `todayISO`, `safeDateEnd` - Dynamic dates
- `domainId`, `apiEndpoint` - System configuration

They're excluded from entity extraction (see `entityCreation.ts`).

## LLM Instructions Added

**File:** `src/app/lib/workflows/workflowCreator.ts`

Added clear examples in the WORKFLOW GENERALIZATION RULES section:

```markdown
**For Date Ranges in inputMapping:**
- **ALWAYS use these template variables:**
  - "${todayISO}" - Today's date (updates daily)
  - "${safeDateEnd}" - 90 days from today (updates daily)

**Example:**
{
  "function": "GetAppointments",
  "inputMapping": {
    "PatNum": "selectedPatient.PatNum",
    "DateStart": "${todayISO}",      // ✅ Dynamic
    "DateEnd": "${safeDateEnd}"      // ✅ Dynamic
  }
}
```

## Examples

### Wrong vs. Right

**❌ WRONG - Hardcoded dates:**
```json
{
  "steps": [{
    "function": "GetAppointments",
    "inputMapping": {
      "PatNum": "patientId",
      "DateStart": "2025-12-05",
      "DateEnd": "2026-03-05"
    }
  }]
}
```

Problems:
- Dec 6, 2025: Searches from yesterday
- Jan 1, 2026: Searches from a month ago
- Feb 1, 2026: Searches from 2 months ago
- Gets worse every day!

**✅ CORRECT - Template variables:**
```json
{
  "steps": [{
    "function": "GetAppointments",
    "inputMapping": {
      "PatNum": "patientId",
      "DateStart": "${todayISO}",
      "DateEnd": "${safeDateEnd}"
    }
  }]
}
```

Benefits:
- Always searches from TODAY forward
- Always covers next 90 days
- Never stale
- Works forever without updates

### Special Cases

**User-specified dates:**
If user says "show appointments for next week", extract the specific date:

```json
{
  "steps": [{
    "function": "AskUser",
    "outputAs": "specificDate",
    "waitForUser": {
      "field": "specificDate",
      "prompt": "What date would you like to check?"
    }
  }, {
    "function": "GetAppointments",
    "inputMapping": {
      "PatNum": "patientId",
      "DateStart": "specificDate",     // ✅ User's specific date
      "DateEnd": "specificDate"        // ✅ Same day
    }
  }]
}
```

**Default ranges:**
For "show all appointments" (no specific date):

```json
{
  "inputMapping": {
    "DateStart": "${todayISO}",       // ✅ From today
    "DateEnd": "${safeDateEnd}"       // ✅ To 90 days ahead
  }
}
```

## Testing

### 1. Check Old Workflow (Before Fix)

Query database:
```sql
SELECT workflow_name, definition->'steps'->3->'inputMapping' as date_mapping
FROM dynamic_workflows
WHERE workflow_name LIKE '%check%'
LIMIT 1;
```

Might show:
```json
{
  "DateStart": "2025-12-05",
  "DateEnd": "2026-03-05"
}
```

### 2. Create New Workflow (After Fix)

After restarting server, test:
```
User: "Show me my appointments"
```

Check created workflow should have:
```json
{
  "DateStart": "${todayISO}",
  "DateEnd": "${safeDateEnd}"
}
```

### 3. Verify Runtime Substitution

Check logs during execution:
```
[DynamicEngine] Executing GetAppointments with params: {
  PatNum: 12,
  DateStart: "2025-12-06",    // ← Substituted!
  DateEnd: "2026-03-06"       // ← Substituted!
}
```

## Verification Script

The `check-workflow-generalization.ts` script now detects hardcoded dates:

```bash
npx tsx scripts/check-workflow-generalization.ts
```

Output will show:
```
⚠️  check_12345
   - step_4.inputMapping.DateStart: Hardcoded date "2025-12-05"
   - step_4.inputMapping.DateEnd: Hardcoded date "2026-03-05"
```

## Migration

### Existing Workflows with Hardcoded Dates

**Option 1:** Leave them (they'll work but with stale dates)  
**Option 2:** Delete and let system recreate:
```sql
DELETE FROM dynamic_workflows 
WHERE definition::text LIKE '%"DateStart": "202%';
```

**Option 3:** Update manually:
```sql
UPDATE dynamic_workflows
SET definition = jsonb_set(
  jsonb_set(
    definition,
    '{steps,3,inputMapping,DateStart}',
    '"${todayISO}"'
  ),
  '{steps,3,inputMapping,DateEnd}',
  '"${safeDateEnd}"'
)
WHERE id = 'workflow-id';
```

## Summary

| Before | After | Result |
|--------|-------|--------|
| "2025-12-05" | "${todayISO}" | Always current date |
| "2026-03-05" | "${safeDateEnd}" | Always 90 days ahead |
| Stale over time | Fresh daily | Never breaks |
| Manual updates | Self-updating | Zero maintenance |






























