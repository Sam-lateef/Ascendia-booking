# API Registry Validation Scripts

**🚀 NEW: Unified Script - One Script Does Everything!**

Use `validate_and_correct_registry.js` - it combines validation + auto-correction in one command!

---

## ⭐ Recommended: Unified Validator (`validate_and_correct_registry.js`)

**Does EVERYTHING in one pass:**
- ✅ Finds duplicates
- ✅ Analyzes parameter issues  
- ✅ Tests endpoints against real API
- ✅ Auto-corrects errors by learning
- ✅ Iterates up to 5 times per endpoint
- ✅ Generates comprehensive reports
- ✅ Saves clean, validated registry

**Usage:**
```bash
# Quick start (test priority functions)
node scripts/validate_and_correct_registry.js

# Dry run (test without saving)
node scripts/validate_and_correct_registry.js --dry-run

# Test ALL endpoints (takes longer)
node scripts/validate_and_correct_registry.js --all

# Custom max attempts
node scripts/validate_and_correct_registry.js --max-attempts=3
```

**Output:**
- `validated_registry.json` - Clean registry with all corrections
- `full_report.json` - Complete validation details
- `summary.json` - Quick overview of results

---

## Legacy Scripts (Still Available)

Two separate scripts if you want more control:

## 1. Basic Validator (`validate_api_registry.js`)

**Purpose:** Tests endpoints and reports issues (read-only, no corrections)

**What it does:**
- ✅ Finds duplicate function names
- ✅ Tests READ endpoints against real API
- ✅ Detects parameter naming issues
- ✅ Generates detailed validation report
- ✅ Creates clean registry with validation status

**Usage:**
```bash
# Set environment variables
export OPENDENTAL_API_KEY="ODFHIR xxx"
export OPENDENTAL_API_BASE_URL="https://api.opendental.com/api/v1"

# Run validator
node scripts/validate_api_registry.js
```

**Output:**
- `docs/API/validated/validation_report.json` - Full report
- `docs/API/validated/validated_registry.json` - Clean registry with validation status
- `docs/API/validated/issues.json` - Summary of all issues found

---

## 2. Auto-Correcting Validator (`auto_correct_registry.js`) ⭐

**Purpose:** Automatically fixes endpoint definitions by learning from errors

**What it does:**
- ✅ Tests each endpoint
- ✅ Analyzes error messages
- ✅ Applies corrections automatically
- ✅ Retests with corrections
- ✅ Iterates up to 5 times per endpoint
- ✅ Saves corrected definitions

**How it learns:**

```
1. Test: GetPatients → ❌ "PatientId is required"
2. Learn: "PatientId should be PatNum"
3. Correct: Rename PatientId → PatNum
4. Retest: GetPatients → ✅ SUCCESS!
5. Save: Corrected definition
```

**Usage:**
```bash
# Dry run (test without saving)
export DRY_RUN=true
node scripts/auto_correct_registry.js

# Actual run (saves corrections)
unset DRY_RUN
node scripts/auto_correct_registry.js
```

**Output:**
- `docs/API/validated/auto_corrected_registry.json` - Fixed registry
- `docs/API/validated/corrections_log.json` - Detailed correction history

---

## Common Error Patterns & Auto-Fixes

### Pattern 1: Parameter Name Mismatch
```
❌ Error: "LName is required"
🔧 Fix: Rename "last_name" → "LName"
✅ Retest: Success
```

### Pattern 2: URL Path Issues
```
❌ Error: "v1 is not a valid resource"
🔧 Fix: Strip "/api/v1/" prefix
✅ Retest: Success
```

### Pattern 3: Invalid Enum Values
```
❌ Error: "breakType is invalid. Cancelled is not enabled"
🔧 Fix: Mark as optional, try "Missed" instead
✅ Retest: Success or document as limitation
```

### Pattern 4: Path Parameter Mismatch
```
❌ Error: 404 with "{AppointmentId}" in URL
🔧 Fix: Replace "{AppointmentId}" → "{AptNum}"
✅ Retest: Success
```

---

## Configuration

Create `.env` in project root:

```env
# Required
OPENDENTAL_API_KEY=ODFHIR your_dev_key/your_customer_key

# Optional
OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
DRY_RUN=false  # Set to 'true' to test without saving
```

---

## Test Data

Scripts use these test IDs (update in scripts if yours differ):

```javascript
const TEST_DATA = {
  existingPatNum: 22,      // Existing patient (Sam Lateef)
  existingAptNum: 53,      // Existing appointment
  testDate: '2025-10-27',
  testDateTime: '2025-10-27 15:00:00',
};
```

---

## Known Corrections

The auto-corrector knows these common mappings:

| Registry Name | OpenDental Name | Type |
|--------------|-----------------|------|
| `PatientId` | `PatNum` | Parameter |
| `Date` | `AptDateTime` | Parameter |
| `Notes` | `Note` | Parameter |
| `AppointmentId` | `AptNum` | Parameter |
| `{AppointmentId}` | `{AptNum}` | Path Param |
| `/api/v1/` | `/` | URL Prefix |

---

## Workflow Recommendation

### For New API Projects:

1. **Build initial registry** (from API docs/scraping)
2. **Run auto-corrector** (first pass)
   ```bash
   node scripts/auto_correct_registry.js
   ```
3. **Review corrections** (`corrections_log.json`)
4. **Test manually** (endpoints that still failed)
5. **Update TEST_DATA and PARAMETER_CORRECTIONS** in script
6. **Re-run auto-corrector** (second pass)
7. **Use corrected registry** for your agent

### For Existing Registry:

1. **Run basic validator** (assessment)
   ```bash
   node scripts/validate_api_registry.js
   ```
2. **Review `issues.json`**
3. **Run auto-corrector**
   ```bash
   node scripts/auto_correct_registry.js
   ```
4. **Compare before/after** in `corrections_log.json`

---

## Adding New Corrections

When you discover new patterns, add them to `auto_correct_registry.js`:

```javascript
// Add to PARAMETER_CORRECTIONS
const PARAMETER_CORRECTIONS = {
  'your_param': 'correct_name',
  // ... existing mappings
};

// Add to PATH_CORRECTIONS
const PATH_CORRECTIONS = [
  { from: '/old/path', to: '/new/path' },
  // ... existing corrections
];
```

---

## Handling Write Operations

### ⚠️ Write Operations Are Skipped By Default

POST/PUT/DELETE endpoints are **automatically skipped** to prevent:
- Creating test patients/appointments in your database
- Modifying existing records
- Deleting production data

**Output:** These are marked as `validation_status: 'skipped_write'`

### 📋 What Gets Validated vs Skipped

**✅ TESTED (READ operations):**
- `GetPatients`, `GetAppointments`, `GetAvailableSlots`
- `GetProviders`, `GetInsuranceForPatient`
- All other GET endpoints

**⏭️ SKIPPED (WRITE operations):**
- `CreatePatient`, `UpdatePatient`
- `CreateAppointment`, `UpdateAppointment`, `BreakAppointment`
- `DeleteAppointment`
- All POST/PUT/DELETE endpoints

### 🧪 How to Validate Write Operations

**Option 1: Use the validated parameters (recommended)**
```bash
# After validation, use the corrected parameter names
curl -X POST "https://api.opendental.com/api/v1/appointments" \
  -H "Authorization: ODFHIR xxx" \
  -d '{
    "PatNum": 22,
    "Op": 1,
    "AptDateTime": "2025-10-27 15:00:00",
    "ProvNum": 1
  }'
```

**Option 2: Enable write testing (CAREFUL!)**
```bash
# Only use in TEST environment!
TEST_WRITES=true node scripts/validate_and_correct_registry.js
```
⚠️ **Currently still skips writes for safety** - you'd need to add test data in `buildTestBody()`

**Option 3: Your Agent Tests Them!**
The best validation is your agent **actually using them** in production:
- Agent calls `CreateAppointment` → Works ✅ or Fails ❌
- You see the error → Script learns from it next time

### ⚠️ Complex Business Logic
- Scripts can't fix business rule violations
- Example: "Cancelled breakType not enabled" requires admin action
- These are documented as `known_issues` in registry

### ⚠️ Rate Limiting
- Scripts include 200-500ms delays between requests
- Adjust if you hit rate limits

---

## Example Output

```
🤖 Self-Correcting API Registry Validator
============================================================

📖 Loaded 357 endpoints

   🔍 Testing: CreateAppointment
      ❌ Attempt 1 failed: 400
         Error: "PatientId is required"
      🔧 Attempt 2: Applying corrections...
         → Renaming parameter: PatientId → PatNum
         → Renaming parameter: Date → AptDateTime
      ✅ SUCCESS on attempt 2

   🔍 Testing: GetPatients
      ✅ SUCCESS on attempt 1

============================================================
🤖 AUTO-CORRECTION SUMMARY
============================================================

✅ Validated: 12
❌ Failed: 2
⏭️  Skipped: 5
🔧 Auto-corrected: 8

🎉 Successfully fixed 8 endpoints automatically!
```

---

## For Your Other Projects

**Copy these scripts** to any API integration project:

1. Update `TEST_DATA` with your API's test IDs
2. Update `PARAMETER_CORRECTIONS` with your API's naming conventions
3. Update `parseErrorMessage()` with your API's error patterns
4. Run and watch it learn! 🚀

---

## Next Steps

1. **Add more error patterns** as you discover them
2. **Share `PARAMETER_CORRECTIONS`** with your team
3. **Version control** the corrected registry
4. **Re-run periodically** as API evolves
5. **Contribute patterns** back to this script for reuse

---

## Questions?

The scripts are heavily commented. Read through them to understand the correction logic!

