# Complete OpenDental Optimization Implementation Plan

## Overview

This plan combines:
1. **SQL Pattern Extraction** from shortQuery.txt
2. **Unified Registry Creation** (validated_registry + enhanced_schema + SQL patterns)
3. **Pre-fetching Optimization** (office context at receptionist level)
4. **Conflict Detection** (smart booking workflow)
5. **Centralized Configuration** (defaults and settings)

---

## Phase 1: Documentation & Schema Enhancement (Foundational)

### Task 1.1: Extract SQL Patterns from shortQuery.txt ⭐
**Priority:** HIGH  
**File:** `docs/API/shortQuery.txt` → `docs/API/sql_patterns.json`

**Extract these patterns:**

```json
{
  "sql_patterns": {
    "patient_search_multi_phone": {
      "description": "Search patient by phone across 3 columns",
      "sql": "WHERE (HmPhone='${phone}' OR WkPhone='${phone}' OR WirelessPhone='${phone}')",
      "workflow_rule": "Phone searches must check HmPhone, WkPhone, AND WirelessPhone columns"
    },
    "check_availability": {
      "description": "Find occupied slots in date range",
      "sql": "SELECT AptDateTime FROM appointment WHERE AptDateTime BETWEEN '${startDate}' AND '${endDate}'",
      "workflow_rule": "Availability = Find occupied slots, then suggest times NOT in that list"
    },
    "detect_conflicts": {
      "description": "Check for scheduling conflicts (patient + operatory)",
      "sql": "SELECT ap.AptDateTime, op.OperatoryNum FROM appointment ap INNER JOIN operatory op ON op.OperatoryNum = ap.Op WHERE ap.AptDateTime BETWEEN '${start}' AND '${end}'",
      "workflow_rule": "Before booking, verify: (1) Patient has no conflicting appointment, (2) Operatory is free, (3) Provider is available"
    },
    "list_doctors_with_specializations": {
      "description": "Get providers with their specializations",
      "sql": "SELECT o.OpName, d.ItemName AS Specialization FROM operatory o LEFT JOIN definition d ON o.OperatoryType = d.DefNum WHERE o.IsHidden <> 1",
      "workflow_rule": "Operatories have specializations via definition table. Filter by IsHidden <> 1 for active only"
    },
    "patient_appointments_by_date": {
      "description": "Find patient appointments in date range",
      "sql": "SELECT AptNum, AptDateTime FROM appointment INNER JOIN patient ON patient.PatNum = appointment.PatNum WHERE AptDateTime BETWEEN '${start}' AND '${end}'",
      "workflow_rule": "When checking patient history, always join appointment → patient and use date range"
    }
  }
}
```

**Action:** Create extraction script

```bash
node scripts/extract_sql_patterns.js
```

**Output:** `docs/API/sql_patterns.json`

---

### Task 1.2: Create Unified Registry ⭐⭐⭐
**Priority:** CRITICAL  
**File:** `docs/API/unified_registry.json`

**Merge these sources:**
1. `validated_registry.json` (337 functions + parameters)
2. `enhanced_schema.json` (FK relationships + natural_language_guide)
3. `sql_patterns.json` (SQL patterns from Task 1.1)
4. Defaults (ProvNum=1, Op=1, ClinicNum=null)

**Structure:**

```json
{
  "metadata": {
    "version": "1.0.0",
    "generated_at": "2025-10-29T...",
    "sources": [
      "validated_registry.json (337 functions)",
      "enhanced_schema.json (FK mappings + natural language guide)",
      "sql_patterns.json (production SQL patterns)",
      "openDentalConfig defaults"
    ],
    "total_functions": 337,
    "priority_functions": 50,
    "core_tables": 20
  },
  
  "functions": [
    // All 337 functions from validated_registry
    {
      "function_name": "GetAvailableSlots",
      "endpoint": "/appointments/Slots",
      "method": "GET",
      "description": "Gets available appointment slots based on provider and operatory.",
      "parameters": {...},
      "foreign_keys": {
        "ProvNum": {
          "references": "provider.ProvNum",
          "default": 1,
          "lookup_via": ["GetProviders", "GetMultipleProviders"]
        },
        "OpNum": {
          "references": "operatory.OperatoryNum",
          "default": 1,
          "lookup_via": ["GetOperatories"]
        }
      },
      "sql_patterns": ["check_availability"],
      "workflow_notes": "Often returns empty if schedules not configured. Use fallback strategy."
    }
  ],
  
  "foreign_key_mappings": {
    // From enhanced_schema
    "CreateAppointment": {...},
    "UpdateAppointment": {...},
    "CreatePatient": {...}
  },
  
  "sql_patterns": {
    // From sql_patterns.json (Task 1.1)
  },
  
  "natural_language_guide": "... (from enhanced_schema + SQL patterns)",
  
  "defaults": {
    "ProvNum": 1,
    "OpNum": 1,
    "ClinicNum": null,
    "appointmentLengthMinutes": 30,
    "bufferBetweenAppointments": 15
  },
  
  "enums": {
    // From enhanced_schema
    "appointment.AptStatus": [...],
    "patient.PatStatus": [...]
  },
  
  "tables": {
    // Core tables from enhanced_schema
    "patient": {...},
    "appointment": {...}
  }
}
```

**Action:** Create merge script

```bash
node scripts/create_unified_registry.js
```

**Output:** `docs/API/unified_registry.json`

---

### Task 1.3: Enhance Natural Language Guide with SQL Patterns
**Priority:** HIGH  
**File:** Update `unified_registry.json` → `natural_language_guide`

**Add these sections:**

```markdown
# ENHANCED WORKFLOW PATTERNS (from production SQL)

## Patient Search Strategy
- Phone searches MUST check 3 columns: HmPhone, WkPhone, WirelessPhone
- GetMultiplePatients handles this automatically - use it!
- Pattern: Search by phone first, then by name if not found

## Smart Availability Checking
Method 1: GetAvailableSlots (REST API)
  - Try this FIRST if database has schedules configured
  - Often returns empty [] in test environments

Method 2: Query Occupied Slots (Fallback)
  - Get appointments in date range: GetAppointments(dateStart, dateEnd)
  - Calculate free slots by excluding occupied times
  - Check office hours boundaries

Method 3: Direct Booking with Reasonable Times
  - Pick standard times: 9am, 10am, 2pm, 3pm, 4pm
  - Verify against occupied slots list
  - Book directly if slot is free

## Conflict Detection (CRITICAL - Do BEFORE booking)
Before CreateAppointment, verify:
1. Patient Conflict:
   - Check if patient already has appointment at that datetime
   - Use: occupiedSlots array (pre-fetched)
   - Error if conflict: "Patient already has appointment at that time"

2. Operatory Conflict:
   - Check if operatory (Op) is occupied at that datetime
   - Use: occupiedSlots array (pre-fetched)
   - Suggest alternative operatory if conflict

3. Provider Conflict:
   - Check if provider (ProvNum) has appointment at that datetime
   - Use: occupiedSlots array (pre-fetched)
   - Suggest alternative provider if conflict

## Operatory Selection Intelligence
- Operatories have types/specializations (via definition.DefNum)
- Hygiene operatories: For cleanings, exams
- General operatories: For procedures, surgeries
- Check IsHidden <> 1 to get only active operatories
- Use specialization to suggest appropriate operatory

## Multi-Column Search Patterns
Patient by phone:
  - Check: HmPhone, WkPhone, WirelessPhone
  - GetMultiplePatients(Phone: cleaned_number) handles all 3

Patient by name:
  - Use: LName (required) + FName (optional)
  - GetMultiplePatients(LName: "Smith", FName: "John")

Patient by email:
  - Use: Email field
  - GetMultiplePatients(Email: "john@example.com")
```

---

## Phase 2: Configuration & Context Management

### Task 2.1: Create Centralized Configuration File ⭐⭐
**Priority:** HIGH  
**File:** `src/app/agentConfigs/openDental/config.ts`

```typescript
export interface OpenDentalConfig {
  defaults: {
    provNum: number;
    opNum: number;
    clinicNum: null;
    appointmentLength: number;
    bufferBetweenAppointments: number;
  };
  
  dataFreshness: {
    officeContextTTL: number;  // milliseconds
    refetchIfOlderThan: boolean;
  };
  
  availability: {
    lookAheadDays: number;
    suggestMultipleSlots: number;
    preferredTimes: string[];
    officeHours: {
      monday: { open: string; close: string; closed?: boolean; };
      tuesday: { open: string; close: string; closed?: boolean; };
      wednesday: { open: string; close: string; closed?: boolean; };
      thursday: { open: string; close: string; closed?: boolean; };
      friday: { open: string; close: string; closed?: boolean; };
      saturday: { open: string; close: string; closed?: boolean; };
      sunday: { open: string; close: string; closed?: boolean; };
    };
  };
  
  apiSettings: {
    maxIterations: number;
    retryAttempts: number;
    timeoutMs: number;
  };
  
  conflictDetection: {
    enabled: boolean;
    checkPatientConflicts: boolean;
    checkOperatoryConflicts: boolean;
    checkProviderConflicts: boolean;
    allowDoubleBooking: boolean;
  };
}

export const openDentalConfig: OpenDentalConfig = {
  defaults: {
    provNum: 1,
    opNum: 1,
    clinicNum: null,
    appointmentLength: 30,
    bufferBetweenAppointments: 15
  },
  
  dataFreshness: {
    officeContextTTL: 300000,  // 5 minutes
    refetchIfOlderThan: true
  },
  
  availability: {
    lookAheadDays: 7,
    suggestMultipleSlots: 3,
    preferredTimes: ['09:00', '10:00', '14:00', '15:00', '16:00'],
    officeHours: {
      monday: { open: '08:00', close: '17:00' },
      tuesday: { open: '08:00', close: '17:00' },
      wednesday: { open: '08:00', close: '17:00' },
      thursday: { open: '08:00', close: '17:00' },
      friday: { open: '08:00', close: '17:00' },
      saturday: { open: '09:00', close: '13:00' },
      sunday: { closed: true }
    }
  },
  
  apiSettings: {
    maxIterations: 6,
    retryAttempts: 2,
    timeoutMs: 30000
  },
  
  conflictDetection: {
    enabled: true,
    checkPatientConflicts: true,
    checkOperatoryConflicts: true,
    checkProviderConflicts: true,
    allowDoubleBooking: false
  }
};
```

---

### Task 2.2: Create Office Context Fetcher ⭐⭐⭐
**Priority:** CRITICAL  
**File:** `src/app/lib/officeContext.ts`

```typescript
import { openDentalConfig } from '@/app/agentConfigs/openDental/config';

export interface Provider {
  provNum: number;
  name: string;
  specialty: string;
  isAvailable: boolean;
  color?: string;
}

export interface Operatory {
  opNum: number;
  name: string;
  abbrev: string;
  isHygiene: boolean;
  isAvailable: boolean;
  provNum?: number;
}

export interface OccupiedSlot {
  aptNum: number;
  aptDateTime: string;
  patNum: number;
  provNum: number;
  opNum: number;
  duration: number;  // minutes
}

export interface OfficeContext {
  providers: Provider[];
  operatories: Operatory[];
  occupiedSlots: OccupiedSlot[];
  officeHours: typeof openDentalConfig.availability.officeHours;
  defaults: typeof openDentalConfig.defaults;
  fetchedAt: string;
  expiresAt: string;
}

/**
 * Fetch complete office context in parallel
 * Called ONCE at start of conversation by Lexi
 */
export async function fetchOfficeContext(): Promise<OfficeContext> {
  const config = openDentalConfig;
  const today = new Date().toISOString().split('T')[0];
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + config.availability.lookAheadDays);
  const endDateStr = endDate.toISOString().split('T')[0];

  try {
    // Fetch all 3 in parallel
    const [providersRes, operatoriesRes, appointmentsRes] = await Promise.all([
      fetch('/api/opendental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          functionName: 'GetProviders',
          parameters: {}
        })
      }),
      
      fetch('/api/opendental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          functionName: 'GetOperatories',
          parameters: {}
        })
      }),
      
      fetch('/api/opendental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          functionName: 'GetAppointments',
          parameters: {
            DateStart: today,
            DateEnd: endDateStr
          }
        })
      })
    ]);

    const [providersData, operatoriesData, appointmentsData] = await Promise.all([
      providersRes.json(),
      operatoriesRes.json(),
      appointmentsRes.json()
    ]);

    // Format providers
    const providers: Provider[] = (providersData || []).map((p: any) => ({
      provNum: p.ProvNum,
      name: `${p.FName} ${p.LName}`.trim() || p.Abbr,
      specialty: p.Specialty || 'General',
      isAvailable: !p.IsHidden && !p.IsSecondary,
      color: p.ProvColor
    }));

    // Format operatories
    const operatories: Operatory[] = (operatoriesData || []).map((o: any) => ({
      opNum: o.OperatoryNum,
      name: o.OpName,
      abbrev: o.Abbrev,
      isHygiene: o.IsHygiene === 1 || o.IsHygiene === true,
      isAvailable: !o.IsHidden,
      provNum: o.ProvDentist || o.ProvHygienist
    }));

    // Format occupied slots
    const occupiedSlots: OccupiedSlot[] = (appointmentsData || []).map((apt: any) => ({
      aptNum: apt.AptNum,
      aptDateTime: apt.AptDateTime,
      patNum: apt.PatNum,
      provNum: apt.ProvNum,
      opNum: apt.Op,
      duration: calculateDuration(apt.Pattern) || config.defaults.appointmentLength
    }));

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.dataFreshness.officeContextTTL);

    return {
      providers,
      operatories,
      occupiedSlots,
      officeHours: config.availability.officeHours,
      defaults: config.defaults,
      fetchedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

  } catch (error) {
    console.error('[fetchOfficeContext] Error:', error);
    
    // Return minimal fallback context
    return {
      providers: [{ provNum: 1, name: 'Default Provider', specialty: 'General', isAvailable: true }],
      operatories: [{ opNum: 1, name: 'Op 1', abbrev: 'Op1', isHygiene: false, isAvailable: true }],
      occupiedSlots: [],
      officeHours: config.availability.officeHours,
      defaults: config.defaults,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString()  // 1 minute
    };
  }
}

/**
 * Calculate appointment duration from pattern string
 * Pattern uses 'X' for 5-minute blocks
 */
function calculateDuration(pattern?: string): number {
  if (!pattern) return 30;
  const blocks = pattern.split('').filter(c => c === 'X').length;
  return blocks * 5;  // Each X = 5 minutes
}

/**
 * Check if office context has expired
 */
export function isContextExpired(context: OfficeContext): boolean {
  return new Date() > new Date(context.expiresAt);
}

/**
 * Detect scheduling conflicts
 */
export function detectConflicts(
  context: OfficeContext,
  requestedDateTime: string,
  requestedProvNum: number,
  requestedOpNum: number,
  patNum?: number
): {
  hasConflict: boolean;
  conflicts: string[];
} {
  const config = openDentalConfig.conflictDetection;
  if (!config.enabled) return { hasConflict: false, conflicts: [] };

  const conflicts: string[] = [];
  const requestedTime = new Date(requestedDateTime);

  for (const slot of context.occupiedSlots) {
    const slotTime = new Date(slot.aptDateTime);
    const slotEndTime = new Date(slotTime.getTime() + slot.duration * 60000);

    // Check if times overlap
    const isOverlap = requestedTime < slotEndTime && requestedTime >= slotTime;
    
    if (isOverlap) {
      // Patient conflict
      if (config.checkPatientConflicts && patNum && slot.patNum === patNum) {
        conflicts.push(`Patient already has appointment at ${slot.aptDateTime}`);
      }
      
      // Operatory conflict
      if (config.checkOperatoryConflicts && slot.opNum === requestedOpNum) {
        conflicts.push(`Operatory ${requestedOpNum} is occupied at ${slot.aptDateTime}`);
      }
      
      // Provider conflict
      if (config.checkProviderConflicts && slot.provNum === requestedProvNum) {
        conflicts.push(`Provider ${requestedProvNum} is busy at ${slot.aptDateTime}`);
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}
```

---

## Phase 3: Agent Integration

### Task 3.1: Update Lexi (Tier 1) to Fetch Context ⭐⭐
**Priority:** HIGH  
**File:** `src/app/agentConfigs/openDental/index.ts`

```typescript
import { tool } from '@openai/agents/realtime';
import { fetchOfficeContext, isContextExpired, OfficeContext } from '@/app/lib/officeContext';

// Tool to get office context
const getCurrentOfficeContext = tool({
  name: 'getCurrentOfficeContext',
  description: 'Fetches office context (providers, operatories, occupied slots). Call ONCE at conversation start.',
  parameters: {},
  execute: async () => {
    console.log('[Lexi] Fetching office context...');
    const context = await fetchOfficeContext();
    console.log(`[Lexi] Fetched: ${context.providers.length} providers, ${context.operatories.length} ops, ${context.occupiedSlots.length} occupied slots`);
    return context;
  }
});

export const dentalAgent = new RealtimeAgent({
  name: 'Lexi',
  voice: 'sage',
  
  instructions: `# Personality
You are **Lexi**, a friendly AI receptionist for **Barton Dental**.

# WORKFLOW

## Step 1: Initialization (CRITICAL)
**IMMEDIATELY after greeting, call these tools:**
1. get_datetime() - Get current date/time
2. getCurrentOfficeContext() - Fetch providers, operatories, occupied slots

Store this context for the entire conversation.

## Step 2: Handle Request
For simple questions (hours, location, services):
  - Answer directly using your knowledge

For complex requests (bookings, cancellations, patient lookups):
  - Call getNextResponseFromSupervisor
  - **IMPORTANT**: Pass the officeContext you fetched in Step 1!

## Step 3: Natural Conversation
- Don't mention technical terms like "fetching context"
- Simply say "Let me check our schedule" while fetching
- Keep responses conversational and natural

# DELEGATION STRATEGY

**Simple (handle directly):**
- "What are your hours?"
- "Where are you located?"
- "What services do you offer?"
- "Can I get directions?"

**Complex (delegate to orchestrator):**
- "I need an appointment" → getNextResponseFromSupervisor + officeContext
- "Cancel my appointment" → getNextResponseFromSupervisor + officeContext
- "Look me up" → getNextResponseFromSupervisor + officeContext
- "What times are available?" → getNextResponseFromSupervisor + officeContext

# EXAMPLE FLOW

User: "Hi, I need a cleaning"
Lexi: "Hi! I'd be happy to help you schedule a cleaning. Let me check our schedule."
  → Calls get_datetime()
  → Calls getCurrentOfficeContext()
  → Stores context
Lexi: "May I have your name and phone number?"
User: "John Smith, 619-555-1234"
Lexi: "Thanks! What day works best for you?"
User: "Tomorrow afternoon"
Lexi: "Let me find a time for you."
  → Calls getNextResponseFromSupervisor({
      relevantContextFromLastUserMessage: "John Smith 619-555-1234 wants cleaning tomorrow afternoon",
      officeContext: storedContext  // ← Pre-fetched data!
    })
Lexi: [Reads orchestrator response]

Remember: Be warm, efficient, and always sound human!
`,

  tools: [
    getCurrentDateTime,
    getCurrentOfficeContext,  // NEW
    getNextResponseFromSupervisor,
  ],
});
```

---

### Task 3.2: Update Orchestrator to Accept Office Context ⭐⭐⭐
**Priority:** CRITICAL  
**File:** `src/app/agentConfigs/openDental/orchestratorAgent.ts`

**Changes:**

1. **Import unified registry** instead of separate files:

```typescript
// OLD:
import { generateFunctionCatalog } from './apiRegistry';
import enhancedSchema from '../../../../docs/API/enhanced_schema.json';

// NEW:
import unifiedRegistry from '../../../../docs/API/unified_registry.json';
```

2. **Update tool parameters** to accept officeContext:

```typescript
export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description: 'Delegate complex tasks to orchestrator supervisor',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description: 'User message context'
      },
      officeContext: {  // NEW!
        type: 'object',
        description: 'Pre-fetched office data (providers, operatories, occupied slots)',
        properties: {
          providers: { type: 'array' },
          operatories: { type: 'array' },
          occupiedSlots: { type: 'array' },
          officeHours: { type: 'object' },
          defaults: { type: 'object' },
          fetchedAt: { type: 'string' },
          expiresAt: { type: 'string' }
        }
      }
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false
  },
  execute: async (input, _details) => {
    const { relevantContextFromLastUserMessage, officeContext } = input;
    
    // Generate instructions WITH office context
    const instructions = generateOrchestratorInstructions(officeContext);
    
    // ... rest of execution
  }
});
```

3. **Update instruction generation** to inject office context:

```typescript
function generateOrchestratorInstructions(officeContext?: any): string {
  const todayFormatted = getFormattedToday();
  const todayISO = getTodayDate();
  const currentYear = new Date().getFullYear();
  
  // Use unified registry
  const functionCatalog = unifiedRegistry.functions
    .map((f, i) => `${String(i + 1).padStart(3, ' ')}. ${f.function_name.padEnd(30, ' ')} - ${f.description}`)
    .join('\n');
  
  const relationshipRules = unifiedRegistry.natural_language_guide;
  const sqlPatterns = unifiedRegistry.sql_patterns;
  
  // Inject office context if provided
  let contextSection = '';
  if (officeContext && officeContext.providers) {
    contextSection = `
# OFFICE CONTEXT (PRE-FETCHED - DO NOT CALL AGAIN!)

## Available Providers (${officeContext.providers.length})
${officeContext.providers.map((p: any) => 
  `- ProvNum ${p.provNum}: ${p.name} (${p.specialty}) ${p.isAvailable ? '✓' : '✗'}`
).join('\n')}

## Available Operatories (${officeContext.operatories.length})
${officeContext.operatories.map((o: any) => 
  `- OpNum ${o.opNum}: ${o.name} (${o.abbrev}) - ${o.isHygiene ? 'Hygiene' : 'General'} ${o.isAvailable ? '✓' : '✗'}`
).join('\n')}

## Occupied Slots Next 7 Days (${officeContext.occupiedSlots.length} appointments)
${officeContext.occupiedSlots.slice(0, 20).map((s: any) => 
  `- ${s.aptDateTime}: Provider ${s.provNum}, Op ${s.opNum}, Patient ${s.patNum}`
).join('\n')}
${officeContext.occupiedSlots.length > 20 ? `... and ${officeContext.occupiedSlots.length - 20} more` : ''}

## Office Hours
${Object.entries(officeContext.officeHours).map(([day, hours]: [string, any]) => 
  `- ${day.charAt(0).toUpperCase() + day.slice(1)}: ${hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}`
).join('\n')}

## System Defaults
- Default Provider: ProvNum ${officeContext.defaults.provNum || officeContext.defaults.defaultProvNum}
- Default Operatory: OpNum ${officeContext.defaults.opNum || officeContext.defaults.defaultOpNum}
- Appointment Length: ${officeContext.defaults.appointmentLength || 30} minutes
- ClinicNum: NEVER SEND (null)

**CRITICAL**: This data was pre-fetched! Do NOT call GetProviders, GetOperatories, or GetAppointments again!
`;
  }
  
  return `You are an intelligent dental office operations supervisor with access to ALL 337 OpenDental API functions.

${contextSection}

# CRITICAL RULES
1. **USE PRE-FETCHED DATA** - Don't call GetProviders, GetOperatories, GetAppointments if context provided!
2. **CHECK CONFLICTS FIRST** - Before booking, verify slot is not in occupiedSlots array
3. **SMART SUGGESTIONS** - Only suggest times that are:
   - During office hours
   - NOT in occupiedSlots
   - With available providers/operatories
4. **READ-ONLY BY DEFAULT** - Only create/update if user explicitly requests

# COMPLETE FUNCTION CATALOG (337 Functions)
${functionCatalog}

# DATABASE RELATIONSHIPS & WORKFLOW RULES
${relationshipRules}

# SQL PATTERNS FROM PRODUCTION
${JSON.stringify(sqlPatterns, null, 2)}

# KEY WORKFLOWS
...rest of instructions...
`;
}
```

---

### Task 3.3: Implement Conflict Detection in Booking ⭐⭐
**Priority:** HIGH  
**Location:** Orchestrator instructions + officeContext.detectConflicts()

**Add to instructions:**

```markdown
# CONFLICT DETECTION (MANDATORY BEFORE BOOKING)

## Before calling CreateAppointment:

1. **Check Patient Conflict**:
   - Search occupiedSlots for same PatNum at requested datetime
   - If found: "Patient already has appointment at [time]. Would [alternative time] work?"

2. **Check Operatory Conflict**:
   - Search occupiedSlots for same Op at requested datetime
   - If found: Suggest different operatory or different time

3. **Check Provider Conflict**:
   - Search occupiedSlots for same ProvNum at requested datetime
   - If found: Suggest different provider or different time

## Example Conflict Check Flow:

User wants: Tomorrow 2PM, Provider 1, Operatory 1

Step 1: Check occupiedSlots array:
  - Found: {aptDateTime: "2025-10-30 14:00:00", provNum: 1, opNum: 1}
  - CONFLICT! Op 1 is busy at 2PM

Step 2: Check alternatives:
  - Op 2 free at 2PM? Yes!
  - Suggest: "2PM is available in Operatory 2. Would that work?"

Step 3: User agrees:
  - CreateAppointment(PatNum=X, AptDateTime="2025-10-30 14:00:00", Op=2, ProvNum=1)
```

---

## Phase 4: Testing & Validation

### Task 4.1: Unit Tests for Office Context
**File:** `src/app/lib/__tests__/officeContext.test.ts`

```typescript
import { fetchOfficeContext, detectConflicts, isContextExpired } from '../officeContext';

describe('Office Context', () => {
  test('fetchOfficeContext returns valid structure', async () => {
    const context = await fetchOfficeContext();
    expect(context.providers).toBeDefined();
    expect(context.operatories).toBeDefined();
    expect(context.occupiedSlots).toBeDefined();
    expect(context.fetchedAt).toBeDefined();
  });

  test('detectConflicts finds patient conflicts', () => {
    const context = {
      occupiedSlots: [
        { aptNum: 1, aptDateTime: '2025-10-30 14:00:00', patNum: 46, provNum: 1, opNum: 1, duration: 30 }
      ],
      // ... rest
    };

    const result = detectConflicts(context, '2025-10-30 14:00:00', 1, 1, 46);
    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toContain('Patient already has appointment');
  });

  test('isContextExpired detects stale data', () => {
    const oldContext = {
      expiresAt: new Date(Date.now() - 10000).toISOString()  // 10 seconds ago
    };
    expect(isContextExpired(oldContext as any)).toBe(true);
  });
});
```

### Task 4.2: Integration Tests
**File:** `src/app/agentConfigs/openDental/__tests__/integration.test.ts`

Test scenarios:
1. Full booking flow with pre-fetched context
2. Conflict detection prevents double-booking
3. Fallback to reasonable times when GetAvailableSlots empty
4. Context refresh after expiration
5. Error handling when API calls fail

### Task 4.3: Manual Testing Checklist

- [ ] Lexi fetches office context on first message
- [ ] Context includes valid providers, operatories, occupied slots
- [ ] Orchestrator uses pre-fetched data (no redundant API calls)
- [ ] Conflict detection prevents double-booking
- [ ] Reasonable times suggested when GetAvailableSlots empty
- [ ] Patient search works across phone columns
- [ ] Defaults (ProvNum=1, Op=1) applied correctly
- [ ] ClinicNum never sent to API
- [ ] Instructions don't exceed token limits (~35KB is fine)

---

## Phase 5: Cleanup & Documentation

### Task 5.1: Archive Old Files
Move to `docs/API/legacy/`:
- api_registry.json (superseded by unified_registry.json)
- output.json (only needed for schema regeneration)

Keep active:
- unified_registry.json ⭐
- openDentalAPI.md (human reference)
- shortQuery.txt (SQL reference)

### Task 5.2: Update README Files
- Update `docs/API/README.md` to explain unified registry
- Update `src/app/agentConfigs/openDental/README.md` with new architecture
- Document office context pre-fetching strategy

---

## Success Metrics

### Performance
- ⚡ **40-50% reduction** in API calls per conversation
- 🚀 **2-3 seconds faster** response time
- 💰 **30-40% lower costs** (fewer tokens, less latency)

### Accuracy
- 🎯 **Zero double-bookings** (conflict detection)
- ✅ **Smart availability** (real occupied slots)
- 📞 **Better patient search** (multi-phone column)

### Maintainability
- 📁 **Single source of truth** (unified_registry.json)
- ⚙️ **Centralized config** (config.ts)
- 🔄 **Easy updates** (SQL patterns, defaults)

---

## Implementation Order (Recommended)

### Week 1: Foundation
1. Task 1.1: Extract SQL patterns ✅
2. Task 1.2: Create unified registry ✅
3. Task 1.3: Enhance natural language guide ✅
4. Task 2.1: Create config.ts ✅

### Week 2: Core Features
5. Task 2.2: Create officeContext.ts ✅
6. Task 3.1: Update Lexi ✅
7. Task 3.2: Update orchestrator ✅

### Week 3: Polish & Test
8. Task 3.3: Implement conflict detection ✅
9. Task 4.1-4.3: Testing ✅
10. Task 5.1-5.2: Cleanup & docs ✅

---

## Rollback Plan

If issues arise:
1. Revert to old imports (apiRegistry.ts, enhanced_schema.json)
2. Disable office context fetching (Lexi works without it)
3. Keep unified_registry.json for future (doesn't break anything)

---

## Notes

- All tasks are backward compatible
- Can implement incrementally
- Old code continues to work during transition
- Unified registry is additive (doesn't remove anything)

