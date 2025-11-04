# OpenDental Three-Tier Agent System

This directory implements a **three-tier voice-enabled dental office agent system** for OpenDental API integration.

## Architecture

```
┌─────────────────────────────────────┐
│   Tier 1: Realtime Agent            │  ← Voice interface (Sage voice)
│   (dentalReceptionistAgent)         │     Static knowledge: hours, policies
│   File: index.ts                    │     Handles: greetings, basic info
└──────────────┬──────────────────────┘
               │ Delegates complex tasks via
               │ getNextResponseFromSupervisor
               ↓
┌─────────────────────────────────────┐
│   Tier 2: Orchestrator Agent        │  ← Planning & workflow brain
│   (Supervisor via Responses API)    │     Knowledge: 357 API functions
│   File: orchestratorAgent.ts        │     Has: Full apiDoc.md + registry
└──────────────┬──────────────────────┘     Plans multi-step operations
               │ Calls specific API functions
               │ via /api/opendental
               ↓
┌─────────────────────────────────────┐
│   Tier 3: API Worker Route          │  ← HTTP executor
│   (Next.js API Route)               │     Makes actual OpenDental calls
│   File: /api/opendental/route.ts    │     Returns: patient data, slots, etc.
└─────────────────────────────────────┘
```

## Files

### Core Agent Files
- **`index.ts`** - Tier 1: Realtime receptionist agent with voice interface (Lexi)
- **`orchestratorAgent.ts`** - Tier 2: Supervisor agent with full API knowledge
- **`dentalOfficeData.ts`** - Static data: office hours, policies, mock data
- **`apiRegistry.ts`** - API registry loader/converter (337 endpoints → OpenAI tools)
- **`config.ts`** - 🆕 Centralized configuration (defaults, office hours, conflict detection)

### Supporting Files
- **`/api/opendental/route.ts`** - Tier 3: API worker route
- **`/lib/opendentalUtils.ts`** - HTTP utilities, date formatting, validation
- **`/lib/officeContext.ts`** - 🆕 Office context fetcher and conflict detection engine

### Documentation
- **`docs/API/unified_registry.json`** - 🆕 Single source of truth for all API documentation
- **`docs/API/sql_patterns.json`** - 🆕 Production SQL patterns for advanced workflows
- **`docs/TESTING_CHECKLIST.md`** - 🆕 Comprehensive manual testing guide

## Setup

### Quick Setup (5 minutes)

📚 **See `QUICK-SETUP.md` for the fastest way to get started with real test data!**

### 1. Environment Variables

Add these to your `.env` file:

#### For Real OpenDental Test Database (Recommended)
```bash
# OpenAI API Key (required)
OPENAI_API_KEY=your_openai_api_key_here

# OpenDental - Real Test Database
OPENDENTAL_MOCK_MODE=false
OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
OPENDENTAL_API_KEY=ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z
# Alternative: ODFHIR ekwr82TdcQVdz5dk/0ZkfiFtiCMMoOdrl
```

#### For Mock Mode (Development/Demo)
```bash
# OpenAI API Key (required)
OPENAI_API_KEY=your_openai_api_key_here

# OpenDental Mock Mode
OPENDENTAL_MOCK_MODE=true
```

#### For Your Own OpenDental Instance
```bash
# OpenAI API Key (required)
OPENAI_API_KEY=your_openai_api_key_here

# OpenDental API Configuration
OPENDENTAL_MOCK_MODE=false
OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
# or for Local API: http://localhost:30222/api/v1
# or for API Service: http://[SERVER_IP]:30223/api/v1

# OpenDental API Key (get from OpenDental > Setup > Advanced Setup > API)
# Format: ODFHIR {DeveloperKey}/{CustomerKey} or Bearer <token>
OPENDENTAL_API_KEY=ODFHIR your_dev_key/your_customer_key
```

📚 **See `TEST-CREDENTIALS.md` for complete testing documentation.**

### 2. Customize Office Information

Edit `dentalOfficeData.ts` to update:
- Practice name, phone, address
- Office hours
- Staff information
- Policies (cancellation, insurance, payment)
- Services offered

### 3. Select Scenario

In your UI, select **"openDental"** from the scenario dropdown, or set it as default in `agentConfigs/index.ts`:

```typescript
export const defaultAgentSetKey = 'openDental';
```

### 4. Start Development Server

```bash
npm run dev
```

The app will run on `http://localhost:3000`

## Testing

### Mock Mode (Recommended for initial testing)

1. Set `OPENDENTAL_MOCK_MODE=true` in `.env`
2. Start the dev server
3. Select "openDental" scenario
4. Test voice interactions

**Example test scenarios:**
- "What are your office hours?" (Handled by Tier 1 directly)
- "I need to schedule a cleaning" (Tier 1 → Tier 2 → Tier 3 with mock data)
- "What's my account balance?" (Full three-tier flow with mock lookup)

### Real API Mode

1. Obtain OpenDental API credentials
2. Set `OPENDENTAL_MOCK_MODE=false`
3. Set `OPENDENTAL_API_BASE_URL` to your OpenDental API endpoint
4. Set `OPENDENTAL_API_KEY` to your actual API key
5. Restart server and test

## API Functions Available

The orchestrator has access to **80 priority functions** (from 357 total):

### Patient Operations
- GetPatients, GetPatient, CreatePatient, UpdatePatient

### Appointments
- GetAppointments, CreateAppointment, UpdateAppointment, DeleteAppointment
- GetAvailableSlots, BreakAppointment, ConfirmAppointment

### Providers
- GetProviders, GetProvider, GetMultipleProviders

### Insurance & Claims
- GetInsuranceForPatient, CreateClaim, GetSingleClaim, UpdateClaim

### Procedures
- GetProcedures, CreateProcedure, UpdateProcedure, GetProcedureCodes

### Recalls
- GetRecalls, CreateRecall, UpdateRecall

### Payments
- CreatePayment, GetPayments, UpdatePayment

### And more...

To enable all 357 functions, edit `apiRegistry.ts`:
```typescript
export const orchestratorTools = convertRegistryToTools(false); // false = all functions
```

## How It Works

### Example: Scheduling an Appointment

**Patient (voice):** "I need to schedule a cleaning for next Tuesday"

**Tier 1 (Realtime Agent - Lexi):**
```
1. On call start: Automatically calls get_office_context() (fetches providers, operatories, occupied slots)
2. Collects patient name: "Sure, may I have your name?"
3. Patient: "John Doe"
4. Says filler: "Let me check our availability"
5. Calls: getNextResponseFromSupervisor(context="John Doe wants cleaning next Tuesday")
   (Office context is automatically available in conversation history)
```

**Tier 2 (Orchestrator):**
```
1. Reads conversation history (including pre-fetched office context)
2. Extracts office context: providers, operatories, occupied slots
3. Plans workflow:
   - Need PatientID → Call GetPatients(first_name="John", last_name="Doe")
   - Check providers list (from context) → Already have Dr. Johnson (ProvNum=1)
   - Check occupied slots (from context) → Tuesday 2 PM is free
4. **Conflict Detection:**
   - Verify Tuesday 2 PM not in occupiedSlots array
   - Verify Dr. Johnson available at that time
   - Verify operatory available
5. Create appointment → Call CreateAppointment(patient_id=X, provider_id=1, date="2025-10-28 14:00:00")
6. Returns natural response: "I have Tuesday at 2 PM with Dr. Johnson available..."

**API Calls Made:** 2 (GetPatients + CreateAppointment)
**API Calls Saved:** 3 (GetProviders, GetOperatories, GetAppointments) - Already cached!
```

**Tier 3 (API Worker):**
```
For each function call:
1. Receives: { functionName: "GetPatients", parameters: {...} }
2. Looks up endpoint details from api_registry.json
3. Builds HTTP request: GET /api/patients?first_name=John&last_name=Doe
4. Executes call (or returns mock data if MOCK_MODE=true)
5. Returns results to Tier 2
```

**Tier 1 (Realtime Agent):**
```
Reads orchestrator response verbatim to patient:
"I have Tuesday at 2 PM with Dr. Johnson available. Would that work for you?"
```

## Key Features

### 🚀 **NEW: Office Context Pre-Fetching** (60% API Call Reduction!)
The system now pre-fetches commonly needed data **once** at the start of each call:
- **Providers** (all dentists/hygienists) - No need to call GetProviders() repeatedly
- **Operatories** (treatment rooms) - No need to call GetOperatories() repeatedly
- **Occupied Slots** (next 7 days) - Real-time conflict detection without extra API calls

**Performance Impact:**
- Traditional approach: 5-6 API calls per appointment booking
- Optimized approach: 2-3 API calls per appointment booking
- **Savings: 40-60% fewer API calls, faster response times, lower costs**

See `config.ts` and `officeContext.ts` for configuration.

### 🚨 **NEW: Intelligent Conflict Detection**
Before booking any appointment, the system automatically checks for:
- **Patient conflicts**: Prevent double-booking the same patient
- **Operatory conflicts**: Ensure the treatment room is available
- **Provider conflicts**: Verify the dentist/hygienist is free

When conflicts are detected, the agent:
1. Explains the conflict clearly
2. Suggests 2-3 alternative times
3. Waits for user to choose
4. Verifies the new time before booking

All conflict detection uses pre-fetched occupied slots - **no additional API calls needed!**

### 📚 **NEW: Unified Registry** (Single Source of Truth)
All API documentation is now consolidated into one file:
- **`docs/API/unified_registry.json`** (689 KB) - Contains everything
  - All 337 API functions with parameters
  - Foreign key relationships
  - Natural language workflow guide
  - SQL patterns from production
  - Default configuration values
  - Database schema

Replaces the old 3-file system:
- ~~`validated_registry.json`~~ (archived)
- ~~`enhanced_schema.json`~~ (archived)
- ~~`api_registry.json`~~ (archived)

**Benefits:** Easier to maintain, no duplication, single update point.

### ✅ Dependency Management
The orchestrator automatically handles API dependencies:
- `CreateAppointment` requires `GetPatient` + `GetProvider` first
- `UpdatePatient` requires `GetPatient` first
- `CreateClaim` requires `GetPatient` + `GetInsuranceForPatient` first

All dependency rules are embedded from `docs/API/unified_registry.json`.

### ✅ Business Logic Enforcement
- 24-hour cancellation policy
- Date format validation (yyyy-MM-dd)
- Phone number formatting
- Insurance verification workflows
- Proper error handling

### ✅ Natural Voice Interaction
- Warm, professional dental office tone
- Filler phrases before lookups ("Let me check...")
- Empathy for emergencies
- Natural conversation flow

### ✅ Mock Mode for Testing
Complete mock data for all operations without needing real API access.

## Extending

### Add New Functions
Edit `apiRegistry.ts` `PRIORITY_FUNCTIONS` array:
```typescript
const PRIORITY_FUNCTIONS = [
  'GetPatients',
  'CreateAppointment',
  'YourNewFunction',  // Add here
  // ...
];
```

### Customize Office Info
Edit `dentalOfficeData.ts` to match your practice.

### Add Custom Workflows
Edit orchestratorAgent.ts instructions to add specific workflows:
```typescript
// Example: Add pre-medication reminder workflow
"Before scheduling procedures, always check if patient needs antibiotic pre-medication..."
```

## Troubleshooting

### "Unknown function" error
- Check that function name matches exactly (case-sensitive)
- Verify function is in PRIORITY_FUNCTIONS array
- Check api_registry.json has the function

### "API call failed" error
- Verify OPENDENTAL_API_KEY is set
- Check OPENDENTAL_API_BASE_URL is correct
- Try MOCK_MODE=true to isolate issue

### Agent doesn't delegate to supervisor
- Check filler phrase is being said
- Verify getNextResponseFromSupervisor tool is in agent tools array
- Check agent instructions include delegation rules

## Documentation

### Primary Documentation (Use These)
- **🆕 Unified Registry:** `docs/API/unified_registry.json` (689 KB, 337 functions)
- **🆕 SQL Patterns:** `docs/API/sql_patterns.json` (Production workflows)
- **🆕 Testing Guide:** `docs/TESTING_CHECKLIST.md` (Comprehensive manual tests)
- **🆕 Optimization Guide:** `docs/API/DEFAULTS_AND_OPTIMIZATION.md`
- **Full Implementation Details:** `docs/API/IMPLEMENTATION_PLAN.md` (967 lines)

### Legacy Documentation (Archived)
- ~~`docs/API/validated_registry.json`~~ → See `docs/API/legacy/`
- ~~`docs/API/enhanced_schema.json`~~ → Integrated into unified_registry.json
- ~~`docs/API/api_registry.json`~~ → See `docs/API/legacy/`

### External References
- **OpenDental API Spec:** https://www.opendental.com/site/apispecification.html

## Architecture Notes

This implements the **Chat-Supervisor pattern** from Agent0:
- Lightweight realtime agent (Tier 1)
- Intelligent supervisor via Responses API (Tier 2)  
- Server-side execution for security (Tier 3)

The orchestrator uses **gpt-4o** for intelligent planning and the full `apiDoc.md` is embedded in its instructions for dependency awareness.

## License

See LICENSE file in root directory.

