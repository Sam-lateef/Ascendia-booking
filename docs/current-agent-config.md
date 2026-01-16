# Current Agent Configuration

**Status**: ✅ **NOW DATABASE-DRIVEN** (as of Dec 5, 2025)  
**See also**: [Database-Driven Agents Documentation](./database-driven-agents.md)

---

## System Architecture: 2-Tier Agent System

### **Tier 1: Lexi (Receptionist Agent / Greeting Agent)**
**File:** `src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts`  
**Configuration Source:** `domains.persona_prompt_template` (Database) ✅

**Identity:**
```
You are Lexi, a friendly dental receptionist for [Office Name].
```
_(Now loaded from database and templated with actual office info)_

**Responsibilities:**
1. Greet callers warmly
2. Gather basic information (name, phone, appointment type, preferred date/time)
3. Answer simple questions directly (hours, location, services)
4. Validate user input is clear before handoff
5. Hand off complex requests to Orchestrator

**Tools:**
- `get_datetime()` - Get current date/time
- `get_office_context()` - Fetch providers, operatories, occupied slots
- `getNextResponseFromSupervisor()` - Hand off to Orchestrator

**Model:** GPT-4o-mini

**Key Rules:**
- DO NOT hand off until minimum info is gathered
- If speech is garbled/unclear, ASK AGAIN
- DO NOT assume or guess
- Answer office info questions directly (no handoff)
- For booking/rescheduling, hand off with context

---

### **Tier 2: Orchestrator Agent (Workflow Supervisor)**
**File:** `src/app/agentConfigs/embeddedBooking/orchestratorAgent.ts`  
**Configuration Source:** `agent_workflows` + `business_rules` (Database) ✅

**Identity:**
```
[No explicit persona - pure business logic/workflow engine]
```
_(Workflows and rules now loaded from database tables)_

**Responsibilities:**
1. Execute deterministic booking workflows
2. Call embedded booking API functions
3. Plan multi-step appointment operations
4. Handle edge cases and errors
5. Confirm actions with users

**Function Catalog (12 Functions):**

**Patients (3):**
- `GetMultiplePatients(LName?, FName?, Phone?)`
- `GetPatient(PatNum)`
- `CreatePatient(FName, LName, Birthdate, WirelessPhone, Email?)`

**Providers (2):**
- `GetProviders()`
- `GetProvider(ProvNum)`

**Operatories (1):**
- `GetOperatories()`

**Appointments (6):**
- `GetAppointments(...)`
- `GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum, lengthMinutes?)`
- `CreateAppointment(PatNum, ProvNum, Op, AptDateTime, Note?, duration?)`
- `UpdateAppointment(AptNum, ...)`
- `BreakAppointment(AptNum)`
- `DeleteAppointment(AptNum)`

**Tools:**
- `callBookingAPI(functionName, parameters)` - Meta-tool that calls any booking function

**Model:** GPT-4o (via Realtime API)

---

## Workflow Definitions (3 Main Flows)

### **FLOW 1: RESCHEDULE**
1. Identify patient (by name or phone)
2. **MANDATORY:** Show existing appointments
3. **MANDATORY:** Ask for new date (DO NOT assume!)
4. **MANDATORY:** Present time options (DO NOT pick for them!)
5. Confirm and update with `UpdateAppointment()`

### **FLOW 2: NEW BOOKING**
1. Identify patient (create if new)
2. Check for existing appointments
3. Gather details (type, date, time preference)
4. Check availability with `GetAvailableSlots()`
5. **MANDATORY:** Present time options
6. Confirm and book with `CreateAppointment()`

### **FLOW 3: CANCEL**
1. Identify patient
2. Show appointments
3. User selects which to cancel
4. Confirm cancellation
5. Update with `BreakAppointment()` or `UpdateAppointment()`

---

## Critical Rules (Orchestrator)

⚠️ **NEVER skip these steps:**
- ALWAYS ask for new date when rescheduling (don't assume)
- ALWAYS present time options (don't pick for user)
- ALWAYS wait for explicit confirmation before booking
- ALWAYS show existing appointments before changes
- NEVER use Feb 29 in non-leap years (2025, 2026, 2027)

---

## Current Limitations

### ❌ **Not Configurable via UI:**
- Persona prompt (hardcoded)
- Business rules (hardcoded)
- Workflow steps (hardcoded)
- Function catalog (hardcoded)
- Model selection (hardcoded)
- Temperature, max_tokens (hardcoded)

### ✅ **What IS Configurable:**
- Domain configuration (via database - but UI shows it as abstract "engine config")
- Entity definitions
- Intent triggers
- Function registry
- Workflow patterns

---

## Proposed: Agent Configuration UI

### **New Structure:**

```
/admin/agents/
  - overview (show both Lexi & Orchestrator)
  - lexi (Receptionist Agent)
    - persona
    - business-rules
    - handoff-rules
    - model-settings
  - orchestrator
    - workflows
    - function-catalog
    - business-rules
    - model-settings
```

### **Configurable Parameters:**

**Both Agents:**
- Model (gpt-4o, gpt-4o-mini, claude-sonnet, etc.)
- Temperature
- Max tokens
- System prompt/persona
- Voice settings (speed, voice ID)

**Lexi (Receptionist):**
- Greeting message
- Office information
- When to hand off vs answer directly
- Required info before handoff
- Validation rules (how strict to be with unclear input)

**Orchestrator:**
- Workflow steps (editable!)
- Business rules (editable!)
- Function availability
- Confirmation requirements
- Error handling behavior
- Fallback to LLM orchestrator settings

---

## Next Steps

1. ✅ Document current state (THIS FILE)
2. ✅ Rename "Engine Config" → "Agent Configuration"
3. ✅ Create Agent overview page
4. ✅ Create Lexi config page
5. ✅ Create Orchestrator config page
6. ✅ Connect agents to database configuration
7. ⏳ Add model settings UI (temperature, max_tokens)
8. ⏳ Make prompts/workflows editable via UI (drag-and-drop, forms)

