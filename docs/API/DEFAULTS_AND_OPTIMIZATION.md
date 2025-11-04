# OpenDental Defaults & Data Flow Optimization

## Current Documentation Stack

### ✅ Source Chain (Correct!)
```
output.json (28,431 lines)
    ↓ (parsed by parse_opendental_schema.js)
enhanced_schema.json (3,723 lines)
    ↓ (imported by orchestratorAgent.ts)
Orchestrator Instructions
    ↓
GPT-4o-mini model
```

### ✅ Function Catalog Source (Correct!)
```
validated_registry.json (19,295 lines)
    ↓ (imported by apiRegistry.ts)
generateFunctionCatalog()
    ↓ (injected into orchestratorAgent.ts)
Orchestrator Instructions
```

**Line 2 of apiRegistry.ts:**
```typescript
import apiRegistryData from '../../../../docs/API/validated/validated_registry.json';
```

---

## Current Hardcoded Defaults

### 📋 From orchestratorAgent.ts

| Field | Default Value | Used In | Line Reference | Notes |
|-------|---------------|---------|----------------|-------|
| **ProvNum** | `1` | CreateAppointment, UpdateAppointment, CreateProcedure, CreatePayment | 113, 126, 146, 166 | Provider number - assumes provider #1 exists |
| **Op** | `1` | CreateAppointment, UpdateAppointment, GetAvailableSlots | 113, 125, 146, 166 | Operatory number - assumes op #1 exists |
| **ClinicNum** | `null` (NEVER SENT) | All functions | 128, 2713 | Explicitly avoided - causes errors in test DBs |
| **dateStart** | `getTodayDate()` or `getTomorrowDate()` | GetAvailableSlots | 146, 166 | Dynamic - calculated at runtime |
| **dateEnd** | Current year end `${currentYear}-12-31` | GetAvailableSlots | 144, 152 | Dynamic - calculated at runtime |

### 📋 From enhanced_schema.json (Line 2674-2853)

| Function | Field | Default | Use If Missing |
|----------|-------|---------|----------------|
| **CreateAppointment** | ProvNum | 1 | ✅ Yes |
| **CreateAppointment** | Op | 1 | ✅ Yes |
| **UpdateAppointment** | PatNum | null | ✅ Yes |
| **UpdateAppointment** | ProvNum | 1 | ✅ Yes |
| **UpdateAppointment** | Op | 1 | ✅ Yes |
| **CreateClaim** | ClinicNum | null | ✅ Yes |
| **CreatePayment** | ClinicNum | null | ✅ Yes |
| **CreateProcedure** | ProvNum | 1 | ✅ Yes |
| **CreateProcedure** | ClinicNum | null | ✅ Yes |

---

## Problem: Repeated API Calls

### Current Flow (INEFFICIENT) ❌

```
User: "I need an appointment tomorrow"

Lexi (Tier 1):
  → Calls getNextResponseFromSupervisor

Orchestrator (Tier 2):
  → Iteration 1: GetMultiplePatients (find patient)
  → Iteration 2: GetProviders (validate ProvNum=1 exists)
  → Iteration 3: GetOperatories (validate Op=1 exists)
  → Iteration 4: GetAvailableSlots (check availability)
  → Iteration 5: CreateAppointment
  → Returns response

---

User: "What about Friday instead?"

Lexi (Tier 1):
  → Calls getNextResponseFromSupervisor AGAIN

Orchestrator (Tier 2):
  → Iteration 1: GetMultiplePatients (SAME PATIENT - REDUNDANT!)
  → Iteration 2: GetProviders (SAME DATA - REDUNDANT!)
  → Iteration 3: GetAvailableSlots (different date)
  → Iteration 4: CreateAppointment
  → Returns response
```

**Problem:** 5-6 API calls per request, many are redundant in the same conversation.

---

## Proposed Solution: Pre-Fetch at Receptionist Level ✅

### New Optimized Flow

```typescript
// NEW: Lexi's initialization (happens ONCE per call)
Lexi (Tier 1) - On Call Start:
  ↓
  Fetches ONCE:
    1. GetProviders() → [provider list with ProvNum]
    2. GetOperatories() → [operatory list with OpNum]
    3. GetAppointments(dateStart=today, dateEnd=+7days) → [occupied slots]
    4. Office hours from dentalOfficeData.ts
  ↓
  Stores in context as "office_context"
  ↓
  Passes to orchestrator with EVERY request
```

### Context Structure

```typescript
interface OfficeContext {
  providers: {
    provNum: number;
    name: string;
    specialty: string;
    isAvailable: boolean;
  }[];
  operatories: {
    opNum: number;
    name: string;
    isHygiene: boolean;
    isAvailable: boolean;
  }[];
  occupiedSlots: {
    aptDateTime: string;
    patNum: number;
    provNum: number;
    opNum: number;
  }[];
  officeHours: {
    monday: { open: string; close: string; };
    tuesday: { open: string; close: string; };
    // ...
  };
  defaults: {
    defaultProvNum: number;  // First active provider
    defaultOpNum: number;    // First active operatory
    clinicNum: null;         // Always null
  };
  fetchedAt: string;  // ISO timestamp
}
```

### Modified Orchestrator Instructions

```typescript
function generateOrchestratorInstructions(officeContext: OfficeContext): string {
  return `You are an intelligent dental office operations supervisor.

# OFFICE CONTEXT (PRE-FETCHED)

## Available Providers
${officeContext.providers.map(p => 
  `- ProvNum ${p.provNum}: ${p.name} (${p.specialty}) - ${p.isAvailable ? 'Available' : 'Unavailable'}`
).join('\n')}

## Available Operatories
${officeContext.operatories.map(o => 
  `- OpNum ${o.opNum}: ${o.name} - ${o.isHygiene ? 'Hygiene' : 'General'} - ${o.isAvailable ? 'Available' : 'Unavailable'}`
).join('\n')}

## Occupied Slots (Next 7 Days)
${officeContext.occupiedSlots.map(slot => 
  `- ${slot.aptDateTime}: Provider ${slot.provNum}, Operatory ${slot.opNum}, Patient ${slot.patNum}`
).join('\n')}

## Office Hours
- Monday: ${officeContext.officeHours.monday.open} - ${officeContext.officeHours.monday.close}
- Tuesday: ${officeContext.officeHours.tuesday.open} - ${officeContext.officeHours.tuesday.close}
...

## System Defaults
- Default Provider: ProvNum ${officeContext.defaults.defaultProvNum}
- Default Operatory: OpNum ${officeContext.defaults.defaultOpNum}
- ClinicNum: NEVER SEND (null)

# CRITICAL RULES
1. **USE THE PRE-FETCHED DATA** - Don't call GetProviders, GetOperatories, or GetAppointments again!
2. **CHECK OCCUPIED SLOTS FIRST** - Before suggesting times, verify the slot is not occupied
3. **SMART AVAILABILITY** - Suggest times that:
   - Are during office hours
   - Are NOT in occupiedSlots array
   - Use available providers/operatories
4. **ONLY CALL API FOR**:
   - Patient lookups (GetMultiplePatients)
   - Creating appointments (CreateAppointment)
   - Updating data (UpdatePatient, UpdateAppointment)

...rest of instructions...
`;
}
```

---

## Benefits of Pre-Fetching

### ⚡ Performance
- **Before:** 5-6 API calls per request
- **After:** 2-3 API calls per request
- **Savings:** 40-50% fewer API calls

### 🎯 Accuracy
- Orchestrator can check conflicts BEFORE calling API
- Real-time view of availability
- No double-booking attempts

### 💰 Cost Reduction
- Fewer API calls = less network latency
- Fewer tokens in responses (no redundant provider lists)
- Faster user experience

### 🔄 Context Continuity
- Same conversation uses same office context
- User says "with Dr. Smith" → already know ProvNum
- User changes time → no need to re-fetch providers

---

## Implementation Plan

### Step 1: Create Context Fetcher

```typescript
// File: src/app/lib/officeContext.ts

export interface OfficeContext {
  providers: Provider[];
  operatories: Operatory[];
  occupiedSlots: OccupiedSlot[];
  officeHours: OfficeHours;
  defaults: Defaults;
  fetchedAt: string;
}

export async function fetchOfficeContext(): Promise<OfficeContext> {
  const [providers, operatories, appointments] = await Promise.all([
    fetch('/api/opendental', {
      method: 'POST',
      body: JSON.stringify({ functionName: 'GetProviders', parameters: {} })
    }).then(r => r.json()),
    
    fetch('/api/opendental', {
      method: 'POST',
      body: JSON.stringify({ functionName: 'GetOperatories', parameters: {} })
    }).then(r => r.json()),
    
    fetch('/api/opendental', {
      method: 'POST',
      body: JSON.stringify({ 
        functionName: 'GetAppointments',
        parameters: {
          dateStart: getTodayDate(),
          dateEnd: getDatePlusDays(7)
        }
      })
    }).then(r => r.json())
  ]);
  
  return {
    providers: providers.map(formatProvider),
    operatories: operatories.map(formatOperatory),
    occupiedSlots: appointments.map(formatAppointment),
    officeHours: getOfficeHours(),
    defaults: {
      defaultProvNum: providers[0]?.ProvNum || 1,
      defaultOpNum: operatories[0]?.OperatoryNum || 1,
      clinicNum: null
    },
    fetchedAt: new Date().toISOString()
  };
}
```

### Step 2: Update Lexi to Fetch Context

```typescript
// File: src/app/agentConfigs/openDental/index.ts

import { fetchOfficeContext, OfficeContext } from '@/app/lib/officeContext';

// Add to Lexi's tool
const getCurrentOfficeContext = tool({
  name: 'getCurrentOfficeContext',
  description: 'Fetches current office context (providers, operatories, occupied slots). Call this ONCE at the start of the conversation.',
  parameters: {},
  execute: async () => {
    const context = await fetchOfficeContext();
    return context;
  }
});

export const dentalAgent = new RealtimeAgent({
  name: 'Lexi',
  voice: 'sage',
  instructions: `...
  
  **IMPORTANT**: At the START of each call, use getCurrentOfficeContext to get office data.
  Then pass this data to getNextResponseFromSupervisor in the context field.
  
  ...`,
  tools: [
    getCurrentDateTime,
    getCurrentOfficeContext,  // NEW
    getNextResponseFromSupervisor,
  ],
});
```

### Step 3: Update Orchestrator to Accept Context

```typescript
// File: src/app/agentConfigs/openDental/orchestratorAgent.ts

export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description: 'Delegate complex tasks to the orchestrator supervisor',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description: 'The relevant information from the last user message'
      },
      officeContext: {  // NEW
        type: 'object',
        description: 'Pre-fetched office context (providers, operatories, occupied slots)',
        properties: {
          providers: { type: 'array' },
          operatories: { type: 'array' },
          occupiedSlots: { type: 'array' },
          officeHours: { type: 'object' },
          defaults: { type: 'object' }
        }
      }
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false
  },
  execute: async (input, _details) => {
    const { relevantContextFromLastUserMessage, officeContext } = input;
    
    // Generate instructions with office context
    const instructions = generateOrchestratorInstructions(officeContext);
    
    const body: any = {
      model: 'gpt-4o-mini',
      instructions: instructions,  // Now includes pre-fetched data!
      tools: orchestratorTools,
      input: [...]
    };
    
    // ... rest of execution
  }
});
```

---

## Configuration File for Defaults

### Create Centralized Config

```typescript
// File: src/app/agentConfigs/openDental/config.ts

export const openDentalConfig = {
  defaults: {
    provNum: 1,
    opNum: 1,
    clinicNum: null,
    appointmentLength: 30,  // minutes
    bufferBetweenAppointments: 15  // minutes
  },
  
  dataFreshness: {
    officeContextTTL: 300000,  // 5 minutes (in ms)
    refetchIfOlderThan: true
  },
  
  availability: {
    lookAheadDays: 7,
    suggestMultipleSlots: 3,
    preferredTimes: ['10:00', '14:00', '16:00']
  },
  
  apiSettings: {
    maxIterations: 6,
    retryAttempts: 2,
    timeoutMs: 30000
  }
};
```

### Use Config in Instructions

```typescript
import { openDentalConfig } from './config';

function generateOrchestratorInstructions(officeContext: OfficeContext): string {
  const cfg = openDentalConfig;
  
  return `...
  
  ## System Configuration
  - Default Provider: ProvNum ${officeContext.defaults.defaultProvNum} (from config: ${cfg.defaults.provNum})
  - Default Operatory: OpNum ${officeContext.defaults.defaultOpNum} (from config: ${cfg.defaults.opNum})
  - Appointment Length: ${cfg.defaults.appointmentLength} minutes
  - Look-ahead Window: ${cfg.availability.lookAheadDays} days
  - Suggested Times: ${cfg.availability.preferredTimes.join(', ')}
  
  ...`;
}
```

---

## Summary

### ✅ What You Were Right About

1. **YES** - `generateFunctionCatalog()` uses `validated_registry.json`
2. **YES** - `enhanced_schema.json` created from `output.json`
3. **YES** - Defaults should be in a separate config file
4. **YES** - Pre-fetching data at receptionist level is MUCH better!

### 📋 Defaults Currently Used

| Field | Default | Source |
|-------|---------|--------|
| ProvNum | 1 | Hardcoded in instructions + enhanced_schema |
| Op | 1 | Hardcoded in instructions + enhanced_schema |
| ClinicNum | null (never sent) | Hardcoded in instructions + enhanced_schema |

### 🚀 Next Steps

1. Create `officeContext.ts` - Context fetcher
2. Create `config.ts` - Centralized defaults
3. Update Lexi to call `getCurrentOfficeContext()` once per call
4. Update orchestrator to accept and use `officeContext`
5. Remove redundant GetProviders/GetOperatories calls
6. Test with real OpenDental API

**Estimated Impact:**
- 40-50% reduction in API calls
- 2-3 seconds faster response time
- Better availability checking
- Smarter conflict detection

---

## File Cleanup After Implementation

### Keep:
- ✅ `validated_registry.json` (source of truth for 337 functions)
- ✅ `enhanced_schema.json` (FK relationships + natural language guide)
- ✅ `openDentalAPI.md` (human-readable reference)
- ✅ `shortQuery.txt` (SQL patterns for reference)

### Archive to `legacy/`:
- 📦 `api_registry.json` (superseded by validated_registry.json)
- 📦 `output.json` (raw schema - only needed for regeneration)

### New Files:
- 🆕 `config.ts` - Centralized defaults
- 🆕 `officeContext.ts` - Context fetcher
- 🆕 `DEFAULTS_AND_OPTIMIZATION.md` - This document




