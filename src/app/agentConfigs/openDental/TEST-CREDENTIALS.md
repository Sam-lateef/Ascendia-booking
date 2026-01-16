# OpenDental Test Credentials

## Real Testing Database Access

You have access to a real OpenDental testing database with the following credentials:

### Authentication Format
```
Authorization: ODFHIR {DeveloperKey}/{CustomerKey}
```

### Available Test Credentials

#### Credential Set 1 (Primary)
```bash
ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z
```

#### Credential Set 2 (StreamLineIQ)
```bash
ODFHIR ekwr82TdcQVdz5dk/0ZkfiFtiCMMoOdrl
```

---

## Quick Setup for Testing

### Option 1: Use Test Credentials Directly

**1. Update your `.env` file:**

```bash
# OpenAI API Key
OPENAI_API_KEY=your-openai-key-here

# Switch to real API mode
OPENDENTAL_MOCK_MODE=false

# OpenDental Test API
OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1

# Use test credentials (include "ODFHIR " prefix)
OPENDENTAL_API_KEY=ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z
```

**2. Restart your server:**
```bash
npm run dev
```

**3. Select "openDental" scenario and test!**

---

### Option 2: Switch Between Mock and Real

Create a `.env.local` file for real testing while keeping `.env` with mock mode:

**`.env` (mock mode for development):**
```bash
OPENAI_API_KEY=your-key-here
OPENDENTAL_MOCK_MODE=true
```

**`.env.local` (real API testing):**
```bash
OPENAI_API_KEY=your-key-here
OPENDENTAL_MOCK_MODE=false
OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
OPENDENTAL_API_KEY=ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z
```

---

## Testing Workflow

### Step 1: Verify Connection
Start with a simple patient lookup:

**Voice command:** "Can you look up patient information?"

**Expected flow:**
1. Agent asks for patient name
2. Orchestrator calls `GetPatients` with real API
3. Returns actual patient data from test database
4. Agent reads results

### Step 2: Test Appointment Scheduling
**Voice command:** "I need to schedule an appointment"

**Expected flow:**
1. Agent collects patient info
2. Orchestrator:
   - Calls `GetPatients` → finds patient
   - Calls `GetProviders` → gets available providers
   - Calls `GetAvailableSlots` → finds open times
   - Calls `CreateAppointment` → books appointment
3. Confirms with patient

### Step 3: Test Other Operations

**Patient lookups:**
- "What's the balance for patient [name]?"
- "When is [patient name]'s next appointment?"

**Insurance:**
- "What insurance does [patient] have?"
- "Can you verify insurance benefits?"

**Claims:**
- "I need to submit a claim for [patient]"
- "What's the status of claim [number]?"

---

## API Endpoints Available

With these credentials, you have access to the **full OpenDental API** including:

### Patient Management
- GET /api/patients - List all patients
- GET /api/patients/{PatNum} - Get specific patient
- POST /api/patients - Create new patient
- PUT /api/patients/{PatNum} - Update patient

### Appointments
- GET /api/appointments - List appointments
- POST /api/appointments - Create appointment
- PUT /api/appointments/{AptNum} - Update appointment
- DELETE /api/appointments/{AptNum} - Delete appointment

### Providers
- GET /api/providers - List providers
- GET /api/providers/{ProvNum} - Get specific provider

### Insurance
- GET /api/familymodules/{PatNum}/insurance - Get patient insurance
- GET /api/insplans - List insurance plans

### Claims
- POST /api/claims - Create claim
- GET /api/claims - List claims
- PUT /api/claims/{ClaimNum} - Update claim

### And 300+ more endpoints...

---

## Troubleshooting

### "401 Unauthorized" Error
✅ Verify you included "ODFHIR " prefix in the API key  
✅ Check there are no extra spaces or line breaks  
✅ Ensure `.env` file is in the project root  
✅ Restart the dev server after changing `.env`

### "Cannot read properties" Error
✅ Make sure `OPENDENTAL_MOCK_MODE=false`  
✅ Verify `OPENDENTAL_API_BASE_URL` is set  
✅ Check the API key format is correct

### "Unknown function" Error  
✅ Function might not be in priority list - check `apiRegistry.ts`  
✅ Try enabling all 357 functions (see README)

### No Response from API
✅ Check internet connection  
✅ Verify OpenDental Remote API is accessible  
✅ Try the other credential set (StreamLineIQ)

---

## Comparing Credentials

You have two credential sets available. They may have different permissions or access to different databases:

### Testing Both:

**Test Credential 1:**
```bash
OPENDENTAL_API_KEY=ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z
```

**Test Credential 2 (StreamLineIQ):**
```bash
OPENDENTAL_API_KEY=ODFHIR ekwr82TdcQVdz5dk/0ZkfiFtiCMMoOdrl
```

Try both to see which database has the data you need for testing.

---

## Real Data vs Mock Data

### Mock Mode (OPENDENTAL_MOCK_MODE=true)
- Uses `dentalOfficeData.ts` mock data
- No real API calls
- Instant responses
- Limited test scenarios
- Good for: UI testing, demos, development

### Real API Mode (OPENDENTAL_MOCK_MODE=false)
- Uses actual OpenDental test database
- Real API calls with credentials
- Actual patient data
- All 357 endpoints available
- Good for: Integration testing, validation, production prep

---

## Security Notes

⚠️ **Important:**
- These are **test credentials** for a test database
- Do NOT use in production
- Do NOT commit `.env` files with real credentials to git
- `.env` is already in `.gitignore`
- For production, obtain your own API keys from OpenDental

---

## Next Steps

1. ✅ Add test credentials to `.env`
2. ✅ Set `OPENDENTAL_MOCK_MODE=false`
3. ✅ Restart server
4. ✅ Test patient lookups first
5. ✅ Try appointment scheduling
6. ✅ Test other operations
7. ✅ Compare results between two credential sets
8. ✅ Document any issues or differences

---

## Support

If you encounter issues with the test credentials:

1. Verify authentication format is correct: `ODFHIR {DeveloperKey}/{CustomerKey}`
2. Check OpenDental API status: https://api.opendental.com
3. Try the alternate credential set
4. Check server logs for detailed error messages
5. Review `src/app/api/opendental/route.ts` for debugging

---

## Example `.env` File (Complete)

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-key-here

# OpenDental Configuration - REAL API MODE
OPENDENTAL_MOCK_MODE=false
OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
OPENDENTAL_API_KEY=ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z

# Alternative credential (uncomment to test):
# OPENDENTAL_API_KEY=ODFHIR ekwr82TdcQVdz5dk/0ZkfiFtiCMMoOdrl
```

**Now you're ready to test with real OpenDental data!** 🎉











