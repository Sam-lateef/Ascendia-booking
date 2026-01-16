# Workflow Validator Simplification

## Date: 2025-12-05

## Problem
The workflow validator (LLM D) was trying to merge workflows B and C, causing complex JSON schema validation errors with OpenAI's strict mode. The schema couldn't handle dynamic properties like `inputMapping` with `additionalProperties: true`.

## Solution Implemented

### 1. Simplified Validator Decision
- **Before**: LLM D could return `preferredWorkflow: 'B' | 'C' | 'merged'` with optional `mergedWorkflow`
- **After**: LLM D only returns `preferredWorkflow: 'B' | 'C'` (no merge option)

### 2. Enhanced Evaluation
Added detailed evaluation fields to the validator response:

```typescript
interface SemanticComparisonResult {
  aligned: boolean;
  confidence: number;
  reasoning: string;
  preferredWorkflow: 'B' | 'C';
  bothCorrect: boolean;           // NEW: Are both workflows correct?
  workflowBCorrect: boolean;      // NEW: Is B correct?
  workflowCCorrect: boolean;      // NEW: Is C correct?
  reasonForChoice: string;        // NEW: Detailed explanation for choice
  issues: string[];               // Problems found in either workflow
}
```

### 3. Improved Validation Prompt
The validator now:
1. **Evaluates each workflow independently** against 5 criteria:
   - Correctness (achieves goal?)
   - Logic (sound function sequence?)
   - Completeness (collects all necessary info?)
   - Safety (no errors/data loss?)
   - Efficiency (right functions, right order?)

2. **Determines correctness** for each workflow separately

3. **Picks the better one** with clear reasoning

### 4. Transparency Logging
All workflow validations are now logged to the `hallucination_logs` table with:
- Both/one/none correct status
- Preferred workflow (B or C)
- Detailed reasoning
- Issues found
- Confidence score
- Attempt number

### 5. Admin UI Enhancement
Added filter buttons to the Hallucination Prevention page:
- **All Logs**: Shows everything
- **API Validation**: Only API call validation (bookings, cancellations, etc.)
- **Workflow Creation**: Only workflow creation validation logs

## Files Modified

1. **src/app/lib/workflows/workflowValidator.ts**
   - Removed `mergedWorkflow` from schema and interface
   - Added evaluation fields: `bothCorrect`, `workflowBCorrect`, `workflowCCorrect`, `reasonForChoice`
   - Updated validation prompt for thorough evaluation
   - Added `logWorkflowValidation()` function
   - Logs validation results to `hallucination_logs` table

2. **src/app/admin/config/hallucination-prevention/page.tsx**
   - Added `logFilter` state for filtering logs
   - Added filter buttons (All / API Validation / Workflow Creation)
   - Updated logs display to filter by operation type

## How It Works

### Workflow Creation Flow
1. **LLM B (GPT-4o)** and **LLM C (Sonnet)** create workflows in parallel
2. **Function validation**: Check if all functions exist in domain registry
3. **LLM D (GPT-4o Validator)** evaluates both:
   - "Is B correct?" → true/false
   - "Is C correct?" → true/false
   - "Are both correct?" → true/false
   - "Which is better?" → B or C
   - "Why?" → Detailed reasoning
4. **Logging**: Save evaluation to `hallucination_logs` for transparency
5. **Selection**: Use the preferred workflow

### Validation Outcomes
- **Both correct + aligned**: High confidence, use preferred
- **One correct**: Use the correct one (auto-select)
- **Both incorrect**: Retry (up to 3 attempts)
- **Both correct but not aligned**: Log as "medium" severity, use preferred

## Benefits

✅ **No more schema errors**: Removed complex nested schema with dynamic properties
✅ **Better transparency**: Clear evaluation of each workflow's correctness
✅ **Easier debugging**: See exactly why B or C was chosen
✅ **Admin visibility**: Filter and view workflow validations separately from API validations
✅ **Quality tracking**: Monitor workflow creation quality over time

## Testing

To test, trigger a workflow creation:
1. Call the agent with a new intent (not in existing workflows)
2. Check terminal logs for validation evaluation
3. Go to `/admin/config/hallucination-prevention`
4. Click "Workflow Creation" filter
5. View the validation log with full evaluation details

### ✅ Test Results (2025-12-05)

**Test case**: Reschedule appointment
```
[WorkflowValidator] Evaluation:
  - Both correct: true
  - B correct: true, C correct: true
  - Aligned: true, Confidence: 0.95
  - Preferred: C
  - Reason: Workflow C is preferred because it explicitly includes 
    a step to extract the patient ID, which adds clarity and ensures 
    that the correct patient is being handled...
```

**Status**: ✅ Working perfectly!
- No more schema validation errors
- Detailed evaluation logs showing both workflows correct
- Clear reasoning for choosing C over B
- Validation logged to database successfully

## Notes

- This is **NOT** the same as "Hallucination Prevention" (API call validation)
- Workflow creation validation runs during **workflow generation**, not during execution
- API validation happens during **conversation runtime** to validate risky operations
- Both use the same `hallucination_logs` table for unified tracking
- Filter by `operation_type`:
  - `workflow_creation_validation` = Workflow creation
  - Everything else = API validation

