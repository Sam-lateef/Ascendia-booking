# Database-Driven Agent Configuration

**Status**: ✅ Implemented  
**Date**: December 5, 2025  
**Impact**: High - Complete shift from hardcoded to database-driven agent behavior

---

## Overview

The agent system has been refactored to load all configuration from the database instead of hardcoded TypeScript files. This enables:

- **Runtime Configuration**: Change agent behavior without code deployments
- **A/B Testing**: Test different personas, workflows, and rules
- **Multi-Domain Support**: Different configurations per domain/business
- **Version Control**: Track configuration changes in the database
- **Admin UI Management**: Edit agent behavior via web interface

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Supabase DB                         │
├─────────────────────────────────────────────────────────────┤
│  • agent_workflows (book, reschedule, cancel flows)        │
│  • business_rules (critical constraints)                    │
│  • domains (persona, extraction, business rules templates)  │
└─────────────────────────────────────────────────────────────┘
                            ⬇️
┌─────────────────────────────────────────────────────────────┐
│               API Layer (Admin Config Routes)                │
├─────────────────────────────────────────────────────────────┤
│  • /api/admin/config/agent-workflows (CRUD)                 │
│  • /api/admin/config/business-rules (CRUD)                  │
│  • /api/admin/config/domains (CRUD)                         │
└─────────────────────────────────────────────────────────────┘
                            ⬇️
┌─────────────────────────────────────────────────────────────┐
│            Configuration Loader (agentConfigLoader.ts)       │
├─────────────────────────────────────────────────────────────┤
│  • loadAgentWorkflows() - Load workflows from DB            │
│  • loadBusinessRules() - Load rules from DB                 │
│  • loadDomainPrompts() - Load persona/extraction prompts    │
│  • Caching (1 minute TTL)                                   │
│  • Fallback to hardcoded if DB unavailable                  │
└─────────────────────────────────────────────────────────────┘
                            ⬇️
┌──────────────────────┬──────────────────────────────────────┐
│   Lexi Agent         │   Orchestrator Agent                 │
├──────────────────────┼──────────────────────────────────────┤
│ • Loads persona      │ • Loads workflows                    │
│   from domains table │ • Loads business rules               │
│ • Template vars:     │ • Formats as LLM instructions        │
│   {OFFICE_NAME}      │ • Fallback to hardcoded on error     │
│   {OFFICE_HOURS}     │                                      │
│   etc.               │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

---

## Database Schema

### 1. `agent_workflows` Table

Stores deterministic workflow definitions (book, reschedule, cancel).

```sql
CREATE TABLE agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT UNIQUE NOT NULL,  -- 'book', 'reschedule', 'cancel'
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL,  -- Array of {text, isMandatory, isSuccess}
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Example workflow step structure**:
```json
{
  "text": "Identify patient (by name or phone)",
  "isMandatory": false,
  "isSuccess": false
}
```

### 2. `business_rules` Table

Stores operational constraints and validation rules.

```sql
CREATE TABLE business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category TEXT,  -- 'workflow', 'validation', 'safety'
  applies_to TEXT[],  -- ['orchestrator', 'lexi', 'extractor']
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. `domains` Table (Existing)

Enhanced to store agent prompts:
- `persona_prompt_template`: Lexi's personality and behavior
- `extraction_prompt_template`: How to extract intent/entities
- `business_rules_template`: High-level business constraints

**Template Variables**:
- `{OFFICE_NAME}`: Practice name
- `{OFFICE_PHONE}`: Practice phone
- `{OFFICE_ADDRESS}`: Practice address
- `{OFFICE_HOURS_WEEKDAYS}`: Hours Mon-Fri
- `{OFFICE_HOURS_SATURDAY}`: Saturday hours
- `{OFFICE_SERVICES}`: Comma-separated services list

---

## Implementation Details

### Configuration Loader (`src/app/lib/agentConfigLoader.ts`)

**Key Functions**:

```typescript
// Load workflows from database
await loadAgentWorkflows(): Promise<AgentWorkflow[]>

// Load business rules (filtered by agent)
await loadBusinessRules(appliesTo?: string): Promise<BusinessRule[]>

// Load persona/extraction prompts from domain
await loadDomainPrompts(): Promise<DomainPrompts>

// Format workflows as LLM instruction text
formatWorkflowsAsInstructions(workflows: AgentWorkflow[]): string

// Format business rules as LLM instruction text
formatBusinessRulesAsInstructions(rules: BusinessRule[]): string

// Clear cache (call after updating config)
clearConfigCache(): void
```

**Caching Strategy**:
- 1-minute TTL for all config
- Module-level cache (shared across requests)
- Auto-refresh on cache expiry

**Error Handling**:
- Graceful fallback to hardcoded config if DB fails
- Console warnings for visibility
- Never blocks agent from starting

### Orchestrator Agent Integration

**File**: `src/app/agentConfigs/embeddedBooking/orchestratorAgent.ts`

**How it works**:
1. Background preload on module init
2. `getStaticInstructions()` checks if DB config loaded
3. If loaded: Uses `dbWorkflows` and `dbBusinessRules`
4. If not loaded: Falls back to hardcoded instructions

**Code Pattern**:
```typescript
// Module-level preload
let dbWorkflows: AgentWorkflow[] | null = null;
let dbBusinessRules: BusinessRule[] | null = null;
let dbConfigLoaded = false;

(async () => {
  const [workflows, rules] = await Promise.all([
    loadAgentWorkflows(),
    loadBusinessRules('orchestrator')
  ]);
  dbWorkflows = workflows;
  dbBusinessRules = rules;
  dbConfigLoaded = true;
})();

// Use in instructions
function getStaticInstructions(): string {
  if (dbConfigLoaded && dbWorkflows && dbBusinessRules) {
    return formatWorkflowsAsInstructions(dbWorkflows) + 
           formatBusinessRulesAsInstructions(dbBusinessRules);
  }
  return hardcodedFallback();
}
```

### Lexi Agent Integration

**File**: `src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts`

**How it works**:
1. Background preload on module init
2. `generateGreetingAgentInstructions()` checks if persona loaded
3. If loaded: Replaces template variables (e.g., `{OFFICE_NAME}`)
4. If not loaded: Falls back to hardcoded persona

**Template Variable Replacement**:
```typescript
const personalizedPrompt = lexiPersonaPrompt
  .replace(/{OFFICE_NAME}/g, dentalOfficeInfo.name)
  .replace(/{OFFICE_PHONE}/g, dentalOfficeInfo.phone)
  .replace(/{OFFICE_HOURS_WEEKDAYS}/g, dentalOfficeInfo.hours.weekdays);
```

---

## Admin UI

### Orchestrator Configuration Page

**Route**: `/admin/config/orchestrator`

**Features**:
- Lists all active workflows (from database)
- Expandable steps for each workflow
- Shows business rules filtered for orchestrator
- Real-time refresh button
- Error handling with retry

### API Endpoints

**Workflows API**: `/api/admin/config/agent-workflows`
- `GET`: List all active workflows
- `POST`: Create new workflow
- `PUT`: Update existing workflow
- `DELETE`: Delete workflow

**Business Rules API**: `/api/admin/config/business-rules`
- `GET`: List all active rules
- `POST`: Create new rule
- `PUT`: Update existing rule
- `DELETE`: Delete rule

---

## Migration Guide

### 1. Apply Database Migration

```bash
# Run in Supabase SQL Editor
supabase/migrations/20231207_agent_config_storage.sql
```

This creates:
- `agent_workflows` table
- `business_rules` table
- Seed data with current production workflows
- Views for easy querying

### 2. Update Environment Variables

Ensure these are set in `.env.local`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### 3. Verify Seed Data

```sql
-- Check workflows
SELECT workflow_id, name, jsonb_array_length(steps) as step_count
FROM agent_workflows
WHERE is_active = true;

-- Check business rules
SELECT title, severity, applies_to
FROM business_rules
WHERE is_active = true
ORDER BY display_order;
```

### 4. Test Agents

1. Navigate to `/admin/config/orchestrator`
2. Verify workflows and rules load from database
3. Check browser console for: `✅ Configuration loaded from database`
4. Test a booking conversation to verify agent uses DB config

---

## Benefits

### Before (Hardcoded)
❌ Required code deployment to change agent behavior  
❌ No version control for configuration changes  
❌ Difficult to A/B test different approaches  
❌ Single configuration for all domains  
❌ No UI for non-technical users  

### After (Database-Driven)
✅ Change agent behavior via admin UI  
✅ Full audit trail in database  
✅ Easy A/B testing with multiple configs  
✅ Multi-domain support ready  
✅ Non-technical users can edit safely  

---

## Future Enhancements

### Phase 2 (Planned)
- [ ] UI editor for workflows (drag-and-drop steps)
- [ ] UI editor for business rules (form-based)
- [ ] UI editor for persona prompts (rich text editor)
- [ ] Version history and rollback
- [ ] A/B testing framework
- [ ] Multi-domain configuration selector

### Phase 3 (Planned)
- [ ] AI-suggested workflow improvements
- [ ] Performance metrics per configuration
- [ ] Auto-optimization based on success rates
- [ ] Configuration import/export

---

## Troubleshooting

### Issue: Agents still using hardcoded config

**Symptoms**: Console shows `Using hardcoded fallback configuration`

**Causes**:
1. Database migration not applied
2. Supabase environment variables missing
3. Database connection error

**Fix**:
```bash
# Check env vars
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY

# Test database connection
curl -X GET "http://localhost:3000/api/admin/config/agent-workflows"

# Apply migration if needed
# (Run 20231207_agent_config_storage.sql in Supabase)
```

### Issue: Template variables not replaced in Lexi

**Symptoms**: Agent says `{OFFICE_NAME}` instead of actual name

**Causes**:
1. Domain prompts not seeded
2. Template variables misspelled

**Fix**:
```sql
-- Update domain prompts
UPDATE domains
SET persona_prompt_template = '...{OFFICE_NAME}...'
WHERE is_active = true;

-- Clear cache (restart server)
```

---

## Related Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20231207_agent_config_storage.sql` | Database schema + seed data |
| `src/app/lib/agentConfigLoader.ts` | Configuration loader with caching |
| `src/app/api/admin/config/agent-workflows/route.ts` | Workflows CRUD API |
| `src/app/api/admin/config/business-rules/route.ts` | Business rules CRUD API |
| `src/app/admin/config/orchestrator/page.tsx` | Orchestrator config UI |
| `src/app/agentConfigs/embeddedBooking/orchestratorAgent.ts` | Orchestrator agent implementation |
| `src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts` | Lexi agent implementation |
| `tmp/seed-agent-config.sql` | Optional: Re-seed script for testing |

---

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Seed data visible in Supabase tables
- [ ] `/admin/config/orchestrator` page loads workflows from DB
- [ ] Console shows: `✅ Configuration loaded from database`
- [ ] Booking conversation follows DB-defined workflow
- [ ] Business rules enforced (e.g., "present options to user")
- [ ] Lexi uses persona from database (check greeting)
- [ ] Template variables replaced correctly
- [ ] Fallback works if DB unavailable
- [ ] Cache refreshes after 1 minute

---

## Summary

The agent system is now **fully database-driven**. All workflows, business rules, and persona prompts load from Supabase tables, with graceful fallback to hardcoded values if the database is unavailable. This enables runtime configuration changes, A/B testing, and multi-domain support—all while maintaining backward compatibility.

**Next Steps**: Apply the migration, verify the admin UI, and test a booking conversation to see the database-driven configuration in action!

































