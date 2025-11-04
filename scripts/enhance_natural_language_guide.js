#!/usr/bin/env node

/**
 * Enhance Natural Language Guide
 * 
 * Adds SQL patterns and conflict detection rules to the natural_language_guide
 * in unified_registry.json
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Enhancing natural language guide...\n');

const registryPath = path.join(__dirname, '../docs/API/unified_registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

// Enhanced natural language guide with SQL patterns and conflict detection
const enhancedGuide = registry.natural_language_guide + `

# ENHANCED WORKFLOW PATTERNS (from production SQL)

## Patient Search Strategy (Multi-Column)
- Phone searches MUST check 3 columns: HmPhone, WkPhone, WirelessPhone
- GetMultiplePatients handles this automatically - ALWAYS use it for phone searches
- Pattern: Try phone first, then name, then email
- SQL Pattern: \`patient_search_multi_phone\`
- Example: GetMultiplePatients(Phone: "6195551234") checks all 3 phone columns

## Smart Availability Checking (3-Strategy Approach)

### Strategy 1: GetAvailableSlots API (Try First)
- REST API endpoint: /appointments/Slots
- Parameters: dateStart, dateEnd, ProvNum, OpNum (all optional)
- Returns: Array of available time slots
- If returns data: Present 2-3 options to user
- If returns []: Fall back to Strategy 2
- SQL Pattern: N/A (uses schedule configuration)

### Strategy 2: Occupied Slots Analysis (Primary Fallback)
- Get occupied appointments: GetAppointments(DateStart, DateEnd)
- Calculate free slots by excluding occupied times
- Check against office hours (8am-5pm weekdays, 9am-1pm Saturday)
- SQL Pattern: \`check_occupied_slots\`
- Logic: Free slots = Office hours - Occupied slots
- Example: If appointment at 2pm, suggest 9am, 10am, 3pm, 4pm

### Strategy 3: Reasonable Times (Last Resort)
- Pick standard times: 9am, 10am, 2pm, 3pm, 4pm
- Based on user's request (morning/afternoon/evening)
- Verify against occupiedSlots array (if available)
- Always within office hours
- SQL Pattern: N/A (business logic)

## Conflict Detection (CRITICAL - ALWAYS CHECK BEFORE BOOKING)

### Pre-Booking Validation (Mandatory)
Before calling CreateAppointment, verify NO conflicts exist:

1. **Patient Conflict Check**:
   - Search: occupiedSlots for same PatNum at requested datetime
   - SQL Pattern: \`detect_scheduling_conflicts\`
   - Error Message: "You already have an appointment at [time]"
   - Action: Suggest alternative time or ask to reschedule existing

2. **Operatory Conflict Check**:
   - Search: occupiedSlots for same Op at requested datetime
   - SQL Pattern: \`detect_scheduling_conflicts\`
   - Error Message: "Operatory [X] is occupied at [time]"
   - Action: Suggest different operatory OR different time

3. **Provider Conflict Check**:
   - Search: occupiedSlots for same ProvNum at requested datetime
   - SQL Pattern: \`detect_scheduling_conflicts\`
   - Error Message: "Provider [name] is busy at [time]"
   - Action: Suggest different provider OR different time

### Conflict Detection Window
- Check 30-minute window: requested_time to requested_time + 30 minutes
- Accounts for: appointment duration + buffer time
- Formula: conflict if (new_start < existing_end) AND (new_end > existing_start)

### Example Conflict Resolution:
\`\`\`
User Request: Tomorrow 2pm, Provider 1, Operatory 1, Patient 46
  
Step 1: Check occupiedSlots array
  Found: {aptDateTime: "2025-10-30 14:00:00", provNum: 1, opNum: 1, patNum: 52}
  
Step 2: Identify conflict
  - Patient 46: No conflict (different patient)
  - Provider 1: CONFLICT! (same provider)
  - Operatory 1: CONFLICT! (same operatory)
  
Step 3: Suggest alternatives
  Option A: "2pm is available with Provider 2 in Operatory 2"
  Option B: "Provider 1 is free at 3pm in Operatory 1"
  Option C: "How about tomorrow at 10am instead?"
  
Step 4: User chooses Option B
  CreateAppointment(PatNum=46, AptDateTime="2025-10-30 15:00:00", ProvNum=1, Op=1)
\`\`\`

## Operatory Selection Intelligence

### Match Procedure to Operatory Type
- **Hygiene Operatories** (IsHygiene = true):
  * Cleanings (D1110, D1120)
  * Exams (D0120, D0150)
  * X-rays (D0210, D0270, D0330)
  * Fluoride treatments (D1206)
  
- **General Operatories** (IsHygiene = false):
  * Fillings (D2140, D2160, D2391)
  * Crowns (D2740, D2750)
  * Root Canals (D3310, D3320)
  * Extractions (D7140, D7210)
  * Implants (D6010)

### Operatory Availability Check
- SQL Pattern: \`list_providers_with_specializations\`
- Filter: IsHidden <> 1 (active operatories only)
- Join: operatory → definition (for specialization names)
- Example: GetOperatories() returns all active ops with types

## Multi-Step Workflow Patterns

### Complete Booking Workflow:
\`\`\`
1. Find Patient:
   - SQL Pattern: \`patient_search_multi_phone\` or \`patient_search_by_name\`
   - API: GetMultiplePatients(Phone: "..." or LName: "...", FName: "...")
   - If not found: Ask to create new patient

2. Check Occupied Slots:
   - SQL Pattern: \`check_occupied_slots\`
   - API: GetAppointments(DateStart: today, DateEnd: today+7days)
   - Store: occupiedSlots array for conflict checking

3. Detect Conflicts (MANDATORY):
   - SQL Pattern: \`detect_scheduling_conflicts\`
   - Check: Patient, Operatory, Provider conflicts
   - Result: Pass = proceed, Fail = suggest alternatives

4. Book Appointment:
   - API: CreateAppointment(PatNum, AptDateTime, Op, ProvNum, Note)
   - Parameters: ONLY these 5 (nothing else!)
   - Success: Confirm naturally to user
\`\`\`

### Complete Cancellation Workflow:
\`\`\`
1. Find Patient:
   - SQL Pattern: \`patient_search_multi_phone\`
   - API: GetMultiplePatients(Phone: "...")

2. Find Appointment:
   - SQL Pattern: \`get_patient_appointments_list\`
   - API: GetAppointments(PatNum: result.PatNum)
   - Filter: Match date/time if user specified

3. Cancel Appointment:
   - Try First: BreakAppointment(AptNum, sendToUnscheduledList: true)
   - If Fails: Try BreakAppointment(AptNum, breakType: 'Missed')
   - Last Resort: DeleteAppointment(AptNum)
   - Note: BreakAppointment preserves history, DeleteAppointment removes permanently
\`\`\`

### Rescheduling Workflow:
\`\`\`
1. Find existing appointment (cancellation workflow steps 1-2)
2. Cancel old appointment (BreakAppointment or DeleteAppointment)
3. Book new appointment (booking workflow steps 2-4)
4. Alternative: UpdateAppointment(AptNum, AptDateTime: new_time)
\`\`\`

## Date/Time Handling Best Practices

### Date Formats
- Date Only: YYYY-MM-DD (e.g., "2025-10-30")
- DateTime: YYYY-MM-DD HH:MM:SS (e.g., "2025-10-30 14:00:00")
- Time Only: HH:MM (e.g., "14:00")
- Timezone: Use local timezone, NOT UTC

### Dynamic Date Calculation
- Today: getTodayDate() → "2025-10-29"
- Tomorrow: getTomorrowDate() → "2025-10-30"
- Next Week: today + 7 days → "2025-11-05"
- Next Monday: Calculate next occurrence of Monday
- End of Year: "\${currentYear}-12-31" (current year December 31st)

### User Input Interpretation
- "tomorrow" → tomorrow at 2:00 PM (default afternoon)
- "tomorrow morning" → tomorrow at 10:00 AM
- "tomorrow afternoon" → tomorrow at 2:00 PM
- "next week" → Next Monday at 10:00 AM
- "Friday" → This Friday at 3:00 PM
- "3pm" → Today at 3:00 PM (if still business hours) or tomorrow at 3:00 PM

## Phone Number Handling

### Cleaning Rules
- Input: Any format (e.g., "(619) 555-1234", "619-555-1234", "619.555.1234")
- Output: 10 digits only (e.g., "6195551234")
- Remove: (), -, ., spaces, and any other non-digit characters
- Validate: Must be exactly 10 digits after cleaning
- SQL Pattern: \`patient_search_multi_phone\`

### Multi-Column Search
- Check 3 columns: HmPhone, WkPhone, WirelessPhone
- GetMultiplePatients(Phone: cleaned_number) handles all 3 automatically
- DO NOT manually query each column - let the API handle it

## Error Recovery Strategy (Enhanced)

### When Foreign Key Missing:
1. Check if it mentions missing FK (e.g., "PatNum is required")
2. Try automatic lookup ONCE using appropriate function
3. If lookup fails, STOP and ASK user clearly
4. DO NOT retry the same failed call multiple times
5. DO NOT guess or use 0 for foreign keys

### When Conflict Detected:
1. Identify conflict type (patient/operatory/provider)
2. Explain conflict clearly: "Dr. Smith is busy at that time"
3. Suggest 2-3 specific alternatives with exact times
4. Wait for user to choose
5. Verify new choice has no conflicts before booking

### When GetAvailableSlots Returns Empty:
1. Don't say "no slots available"
2. Fall back to occupied slots analysis (Strategy 2)
3. If that also fails, use reasonable times (Strategy 3)
4. ALWAYS suggest specific times with confidence
5. Example: "I have 10am, 2pm, or 4pm available tomorrow"

## Performance Optimization Rules

### Use Pre-Fetched Data When Available
If officeContext provided with occupiedSlots:
- DO NOT call GetProviders again
- DO NOT call GetOperatories again  
- DO NOT call GetAppointments again
- USE the pre-fetched arrays for conflict detection
- SAVE API calls and reduce latency

### Minimize API Calls
- GetMultiplePatients: 1 call per patient search
- GetAppointments: 1 call per date range (use 7-day window)
- CreateAppointment: 1 call after all validation complete
- Total: 2-3 API calls per booking (down from 5-6)

### Cache Strategy
- Office context: Valid for 5 minutes (300,000ms)
- Occupied slots: Valid for current conversation
- Provider list: Valid for current conversation
- Operatory list: Valid for current conversation

## SQL Pattern Reference

Available patterns with API mappings:
- \`patient_search_multi_phone\` → GetMultiplePatients(Phone)
- \`patient_search_by_name\` → GetMultiplePatients(LName, FName)
- \`check_occupied_slots\` → GetAppointments(DateStart, DateEnd)
- \`detect_scheduling_conflicts\` → Check occupiedSlots array
- \`list_providers_with_specializations\` → GetOperatories()
- \`get_patient_appointments_list\` → GetMultiplePatients + GetAppointments
- \`check_appointment_by_date\` → GetAppointments(30-min window)
- \`get_patient_info_by_phone\` → GetMultiplePatients(Phone)

For complete SQL patterns and workflow details, see: unified_registry.sql_patterns
`;

// Update registry
registry.natural_language_guide = enhancedGuide;

// Write back
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

console.log('✅ Natural language guide enhanced successfully!\n');
console.log('Added sections:');
console.log('  - Multi-column patient search strategy');
console.log('  - 3-strategy availability checking');
console.log('  - Conflict detection (patient/operatory/provider)');
console.log('  - Operatory selection intelligence');
console.log('  - Complete workflow patterns');
console.log('  - Date/time handling best practices');
console.log('  - Phone number cleaning rules');
console.log('  - Error recovery strategies');
console.log('  - Performance optimization rules');
console.log('  - SQL pattern reference\n');

const fileSizeKB = Math.round(fs.statSync(registryPath).size / 1024);
console.log(`📊 Updated unified_registry.json (${fileSizeKB} KB)\n`);

