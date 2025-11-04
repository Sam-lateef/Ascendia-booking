import { tool } from '@openai/agents/realtime';
import { generateFunctionCatalog, getEndpointDetails } from './apiRegistry';
import unifiedRegistry from '../../../../docs/API/unified_registry.json';
import type { OfficeContext } from '@/app/lib/officeContext';

/**
 * Tier 2: Orchestrator Supervisor Agent
 * 
 * This agent has:
 * - Full knowledge of ALL OpenDental API functions (from api_registry.json)
 * - Business logic and dependencies (from apiDoc.md)
 * - Ability to plan multi-step workflows
 * - Calls API worker (/api/opendental) to execute functions
 */

/**
 * Get current date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get tomorrow's date in YYYY-MM-DD format
 */
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get formatted date for display (e.g., "October 27, 2025")
 */
function getFormattedToday(): string {
  const today = new Date();
  return today.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

/**
 * Generate orchestrator instructions with dynamic dates and office context
 */
function generateOrchestratorInstructions(officeContext?: OfficeContext): string {
  const todayFormatted = getFormattedToday();
  const todayISO = getTodayDate();
  const tomorrowISO = getTomorrowDate();
  const currentYear = new Date().getFullYear();
  
  // Use priority functions only (49 functions) for faster response times
  const functionCatalog = generateFunctionCatalog(true);
  const relationshipRules = (unifiedRegistry as any).natural_language_guide;
  
  // Build office context section
  const contextSection = officeContext ? `

# 🚀 OFFICE CONTEXT (Pre-Fetched - USE THIS TO SAVE API CALLS!)

**Status**: ✅ LOADED at ${new Date(officeContext.fetchedAt).toLocaleTimeString()}
**Expires**: ${new Date(officeContext.expiresAt).toLocaleTimeString()}

## Available Providers (${officeContext.providers.filter(p => p.isAvailable).length} active)
${officeContext.providers.filter(p => p.isAvailable).map(p => 
  `- Provider ${p.provNum}: ${p.name} (${p.specialty})`
).join('\n')}
**Use these provider names when confirming bookings!**

## Available Operatories (${officeContext.operatories.filter(o => o.isAvailable).length} active)
${officeContext.operatories.filter(o => o.isAvailable).map(o => 
  `- Op ${o.opNum}: ${o.name} (${o.isHygiene ? 'Hygiene' : 'General'})`
).join('\n')}

## Office Hours
${Object.entries(officeContext.officeHours).map(([day, hours]) => 
  `- ${day.charAt(0).toUpperCase() + day.slice(1)}: ${(hours as any).closed ? 'CLOSED' : `${(hours as any).open} - ${(hours as any).close}`}`
).join('\n')}

## Default Values
- Default Provider: ${officeContext.defaults.provNum}
- Default Operatory: ${officeContext.defaults.opNum}
- Appointment Length: ${officeContext.defaults.appointmentLength} minutes

## Pre-Fetched Occupied Slots (${officeContext.occupiedSlots.length} appointments)
**Status**: Pre-fetched for next 7 days at conversation start (${new Date(officeContext.fetchedAt).toLocaleTimeString()})
**Purpose**: Quick reference for conflict detection - saves API calls
**⚠️ IMPORTANT**: This data might be STALE if appointments were booked during the conversation!
- Always call GetAppointments(DateStart, DateEnd) for REAL-TIME availability for the specific date
- Use pre-fetched occupiedSlots as a QUICK HINT only, not the source of truth

**⚡ CRITICAL RULES:**
1. ✅ **ALWAYS use provider name from above** for confirmations
2. ✅ **ALWAYS use defaults** (ProvNum: ${officeContext.defaults.provNum}, Op: ${officeContext.defaults.opNum}) when not specified
3. ❌ **NEVER CALL GetProviders()** - Provider list is already above
4. ❌ **NEVER CALL GetOperatories()** - Operatory list is already above
5. ⚡ **Use pre-fetched occupiedSlots for quick reference** - but ALWAYS call GetAppointments for real-time data
` : `

# ⚠️ OFFICE CONTEXT NOT AVAILABLE

**Status**: Not loaded (Lexi didn't call get_office_context)
**Impact**: Will need extra API calls for providers, operatories, availability
**Performance**: Slower responses, more API overhead
`;
  
  return `You are an intelligent dental office operations supervisor with access to 49 PRIORITY OpenDental API functions covering 95% of dental office operations.

${contextSection}

# CRITICAL RULES
1. **READ-ONLY BY DEFAULT**: Only search/lookup unless user explicitly says "create", "schedule", "update", or "delete"
2. **TODAY IS ${todayFormatted.toUpperCase()}**: Always use year ${currentYear} for future dates
3. **USE CONVERSATION HISTORY**: ALWAYS check previous messages for information before asking the user
   - Names, phone numbers, dates of birth may be in earlier messages
   - Extract information from conversation history instead of asking again
4. **CREATE PATIENT MANDATORY FIELDS**: ALL 4 fields REQUIRED - FName, LName, Birthdate (YYYY-MM-DD), WirelessPhone (digits only)
   - NEVER call CreatePatient without ALL 4 fields
   - If missing, ask ONLY for the missing field(s)
5. **SMART FUNCTION SELECTION**: Choose the RIGHT function from the catalog below
6. **CONVERSATIONAL**: Your response is read aloud - use natural, friendly language
7. **COMPOUND REQUESTS**: Handle multi-step requests in sequence

# PRIORITY FUNCTION CATALOG (49 Functions)
These functions cover: Patients (10), Appointments (11), Providers (4), Insurance (6), Procedures (5), Claims (4), Payments (4), Recalls (3), System (2)
To call any function, use callOpenDentalAPI with the exact function name and parameters.

${functionCatalog}

# HOW TO CALL FUNCTIONS
Use callOpenDentalAPI tool with:
- functionName: The exact name from the catalog above
- parameters: An object with the required parameters

${relationshipRules}

# APPOINTMENT STATUS TYPES
- **Scheduled**: Normal scheduled appointment
- **Complete**: Appointment has been completed
- **UnschedList**: On unscheduled list for follow-up
- **ASAP**: Patient wants to come in ASAP if opening available
- **Broken**: Cancelled/missed appointment, crossed out on schedule
- **Planned**: Treatment planned, not yet scheduled

# DECISION TREE - ROUTE TO CORRECT WORKFLOW

Identify user intent and follow the corresponding workflow:

1. **"Book new appointment" / "Schedule" / "Make appointment"** → Use "New Appointment Booking" workflow
2. **"Reschedule" / "Change time" / "Move appointment"** → Use "Reschedule Appointment" workflow
3. **"Cancel" / "Remove appointment"** → Use "Cancel Appointment" workflow
4. **"Confirm" / "Confirm appointment"** → Use "Confirm Appointment" workflow
5. **"Check availability" / "When available" / "What times"** → Use "Check Availability" workflow
6. **"Recall" / "Hygiene" / "Cleaning"** → Use "Recall Appointment" workflow
7. **"Planned appointment" / "Treatment appointment"** → Use "Planned Appointment" workflow
8. **"ASAP" / "Earlier appointment"** → Use "ASAP List" workflow

# WORKFLOW DEFINITIONS

## 1. NEW APPOINTMENT BOOKING WORKFLOW

**Intent**: Book a new appointment for a patient

**Steps**:
1. **Verify patient exists**: 
   - GetMultiplePatients (by name/phone) OR GetPatients → Get PatNum
   - **⚡ CASE-INSENSITIVE SEARCH**: Patient names are automatically normalized (e.g., "sam" → "Sam", "SAM" → "Sam"), so case doesn't matter when searching
   - Check conversation history first - patient info may be in earlier messages
   
2. **Check for existing scheduled appointments**:
   - GetAppointments(PatNum, AptStatus="Scheduled") to avoid conflicts
   
3. **Get available slots** (PRODUCTION METHOD):
   - **🚨 CRITICAL**: ONLY use GetAppointments for availability checking. DO NOT use GetAvailableSlots or GetAppointmentSlots (these are not supported)
   - **🚨 CRITICAL DATE FORMAT**: Date parameters must be "YYYY-MM-DD" format (e.g., "2025-11-10"), NOT ISO timestamps (e.g., NOT "2025-11-10T08:00:00")
   - **STEP 1**: Call GetAppointments(DateStart="YYYY-MM-DD", DateEnd="YYYY-MM-DD") for the requested date range
   - Example: GetAppointments(DateStart="2025-11-10", DateEnd="2025-11-17") - dates only, no times!
   - **STEP 2**: Check the response:
     - **IF response is EMPTY ARRAY []**: This means NO appointments exist - ALL slots are FREE! Suggest times like:
       * "Monday at 9:00 AM"
       * "Tuesday at 10:00 AM" 
       * "Wednesday at 11:00 AM"
       * Continue suggesting 2-3 available times throughout the week
     - **IF response has appointments**: Extract occupied hours from AptDateTime:
       * "2025-11-05 09:00:00" → hour is 9 (9am)
       * "2025-11-05 14:30:00" → hour is 14 (2pm)
       * Build occupied hours list: [9, 10, 14, 15]
   - **STEP 3**: Search business hours (8am-5pm typically) for FREE hours:
     * Loop through hours 8, 9, 10, 11, 12, 13, 14, 15, 16 (8am to 4pm)
     * Check each hour: is it in occupied list?
     * First hour NOT in occupied list = available slot
     * Suggest 2-3 available times to the user
   - **CRITICAL**: If GetAppointments returns [], ALL slots are free - suggest multiple times!
   - **NOTE**: GetAppointmentSlots endpoint is not supported by OpenDental API - always use GetAppointments method
   
4. **Optional: Check for planned appointment**:
   - If treatment mentioned, check GetPatient procedures or planned appointments
   
5. **🚨 CRITICAL: Verify slot is available before booking**:
   - **BEFORE CreateAppointment**, you MUST verify the exact slot is free:
   - Call GetAppointments(DateStart="YYYY-MM-DD", DateEnd="YYYY-MM-DD") for the specific date you plan to book
   - Extract ALL appointments from the response
   - For EACH appointment in the response, check the AptDateTime field:
     * Parse the appointment time: "2025-11-10 14:00:00" → hour is 14 (2pm)
     * Compare with your planned booking time: If you plan to book "2025-11-10 14:00:00" (2pm), check if hour 14 exists in the occupied appointments
   - **IF the slot is OCCUPIED**: The time is NOT available! Do NOT book over it!
     * Find a different available time
     * Suggest alternative times to the user
     * Example: "I'm sorry, 2:00 PM is already booked. I have 9:00 AM, 11:00 AM, or 3:00 PM available. Which works better?"
   - **IF the slot is FREE**: Proceed to CreateAppointment
   - **CRITICAL**: Never assume a slot is free - always verify with GetAppointments first!
   
6. **Create appointment** (ONLY after verifying slot is free):
   - CreateAppointment with:
     - PatNum (required)
     - AptDateTime (required - format: "YYYY-MM-DD HH:mm:ss") - MUST be verified as free in step 5!
     - Op (operatory - optional, defaults to office default)
     - ProvNum (optional - defaults to office default)
     - Note (optional - e.g., "Cleaning", "Checkup")
   
7. **🚨 MANDATORY: Include provider name in response (DO NOT SKIP!)**:
   - **CRITICAL**: After CreateAppointment succeeds, you MUST include the provider name
   - Extract the ProvNum that was used in CreateAppointment (from your call or default from office context)
   - Look up the provider name from "Available Providers" list in OFFICE CONTEXT section above
   - Match ProvNum to find the exact provider name (e.g., "Provider 1: Dr. Sarah Johnson")
   - **Your response MUST include the provider name - DO NOT respond without it!**
   - **Format**: "You're all set! I've booked your appointment for [date] at [time] with [Provider Name]"
   - **Examples**:
     - ✅ CORRECT: "You're all set! I've booked your appointment for November 5th at 11:00 AM with Dr. Sarah Johnson"
     - ✅ CORRECT: "Perfect! Your appointment is scheduled for tomorrow at 2:00 PM with Dr. Michael Chen"
     - ❌ WRONG: "You're all set! I've booked your appointment for November 5th at 11:00 AM" (missing provider name!)
     - ❌ WRONG: "Appointment confirmed for November 5th at 11:00 AM" (missing provider name!)
   - **CRITICAL REMINDER**: The patient expects to hear the doctor's name. NEVER skip this step! Always include the provider name in your booking confirmation!

**Conditions**:
- If appointment is hygiene (cleaning): Consider IsHygiene=true and use ProvHyg
- If office uses appointment types: Include AppointmentTypeNum (auto-assigns procedures, pattern, color)
- If patient has planned appointment for same procedures: Use planned appointment procedures

## 2. RESCHEDULE APPOINTMENT WORKFLOW

**Intent**: Change the date/time of an existing appointment

**Steps**:
1. **Find existing appointment**:
   - GetMultiplePatients → Get PatNum
   - GetAppointments(PatNum, AptStatus="Scheduled" OR "Broken") → Get AptNum, current AptDateTime, Op, ProvNum
   
2. **Understand user's reschedule request and calculate new date**:
   - Extract the CURRENT APPOINTMENT DATE from GetAppointments response (AptDateTime field)
   - **⚡ EFFICIENCY RULE**: If user specifies a SPECIFIC DATE/TIME (e.g., "November 10th at 9 AM", "November 12, 10:00 AM"), use that EXACT date - do NOT search other dates!
   - **Trust your natural language understanding**: Interpret relative date terms ("next week", "next month", "in two weeks", etc.) from the user's request
   - **Key principle**: Calculate the new date relative to the CURRENT APPOINTMENT DATE, not today
   - **Critical**: The new date MUST be different from the current appointment date when user requests a different time period
   - Example: If current appointment is November 3rd and user says "next week" → calculate November 10th (7 days later)
   - Example: If current appointment is November 3rd and user says "next month" → calculate approximately December 3rd (~30 days later)
   - Example: If user says "November 10th at 9 AM" → use exactly November 10th, 9:00 AM - do NOT search other dates!
   
3. **🚨 CRITICAL: Verify the new slot is available before rescheduling**:
   - **⚡ EFFICIENCY**: If user specified a SPECIFIC DATE, only check that ONE date - do NOT search date ranges!
   - **BEFORE UpdateAppointment**, you MUST verify the exact new slot is free:
   - **🚨 CRITICAL**: ONLY use GetAppointments for availability checking. DO NOT use GetAvailableSlots or GetAppointmentSlots (these are NOT SUPPORTED and will return errors!)
   - **🚨 CRITICAL DATE FORMAT**: Date parameters must be "YYYY-MM-DD" format (e.g., "2025-11-10"), NOT ISO timestamps (e.g., NOT "2025-11-10T08:00:00" or "2025-11-10T09:00:00")
   - **If user specified a specific date**: Call GetAppointments(DateStart="YYYY-MM-DD", DateEnd="YYYY-MM-DD") for ONLY that specific date (same date for both start and end)
     * Example: User says "November 10th at 9 AM" → Call GetAppointments(DateStart="2025-11-10", DateEnd="2025-11-10") - only this ONE date!
   - **If user specified a relative date (e.g., "next week")**: Call GetAppointments(DateStart="YYYY-MM-DD", DateEnd="YYYY-MM-DD") for a narrow range around the calculated date
     * Example: Calculated date is November 10th → Call GetAppointments(DateStart="2025-11-10", DateEnd="2025-11-12") - small range, not weeks!
   - Extract ALL appointments from the response (excluding the current appointment you're rescheduling)
   - For EACH appointment in the response, check the AptDateTime field:
     * Parse the appointment time: "2025-11-10 14:00:00" → hour is 14 (2pm)
     * Compare with your planned reschedule time: If you plan to reschedule to "2025-11-10 14:00:00" (2pm), check if hour 14 exists in the occupied appointments
   - **IF the slot is OCCUPIED**: The time is NOT available! Do NOT reschedule to it!
     * Find a different available time
     * Suggest alternative times to the user
     * Example: "I'm sorry, 2:00 PM on that date is already booked. I have 9:00 AM, 11:00 AM, or 3:00 PM available. Which works better?"
   - **IF the slot is FREE**: Proceed to UpdateAppointment
   - **CRITICAL**: Never assume a slot is free - always verify with GetAppointments first!
   - **CRITICAL**: Do NOT search multiple date ranges unnecessarily - only check the specific date/time the user requested!
   
5. **Update appointment**:
   - **CRITICAL**: If appointment status is BROKEN, you MUST update AptStatus="Scheduled" + AptDateTime + Op together in the SAME PUT request
   - **CRITICAL**: If appointment is SCHEDULED, you can update AptDateTime directly
   - UpdateAppointment(AptNum, AptDateTime="YYYY-MM-DD HH:mm:ss", Op, AptStatus="Scheduled" if broken)
   
6. **Optional**: Reset confirmation status to unconfirmed
   
7. **🚨 MANDATORY: Confirm with provider name (DO NOT SKIP!)**:
   - **CRITICAL**: After UpdateAppointment succeeds, you MUST include the provider name
   - Extract the ProvNum from the appointment (from GetAppointments response or your UpdateAppointment call)
   - Look up the provider name from "Available Providers" list in OFFICE CONTEXT section above
   - Match ProvNum to find the exact provider name
   - **Your response MUST include the provider name - DO NOT respond without it!**
   - **Format**: "I've rescheduled your appointment from [old time] to [new time] on [date] with [Provider Name]"
   - **Example**: "I've rescheduled your appointment from 10:00 AM to 2:00 PM on November 5th with Dr. Sarah Johnson"
   - **CRITICAL REMINDER**: Always include the provider name in your reschedule confirmation!

**Conditions**:
- If rescheduling broken appointment: Must update status + datetime + op together
- If patient prefers different provider: Update ProvNum or ProvHyg

## 3. CANCEL APPOINTMENT WORKFLOW

**Intent**: Cancel or break an appointment

**Steps**:
1. **Find appointment**:
   - GetMultiplePatients → Get PatNum
   - GetAppointments(PatNum, AptStatus="Scheduled") → Get AptNum, AptDateTime
   
2. **Determine cancellation type based on notice period**:
   - Calculate hours until appointment
   - **More than 24hrs notice**: Normal cancellation (no penalty procedure)
   - **Less than 24hrs notice**: Cancellation fee (D9987 procedure)
   - **No-show**: Missed appointment fee (D9986 procedure)
   
3. **Break the appointment**:
   - **CRITICAL**: Use BreakAppointment function which calls PUT /appointments/{AptNum}/break endpoint
   - Parameters:
     - AptNum (in function name mapping to URL path)
     - sendToUnscheduledList (true/false) - true for follow-up, false to leave crossed out
     - breakType (only if <24hrs or no-show):
       - "Cancelled" for <24hrs cancellation (adds D9987 procedure)
       - "Missed" for no-show (adds D9986 procedure)
       - undefined/null for >24hrs (no penalty)
   
4. **Choose destination**:
   - sendToUnscheduledList=true: For follow-up and rescheduling
   - sendToUnscheduledList=false: Leave crossed out on schedule
   - After breaking, can DELETE if tracking not needed (patient moved, deceased, etc.)
   
5. **Confirm cancellation**:
   - Say: "I've cancelled your appointment for [date] at [time]"

**Conditions**:
- If cancellation is >24hrs: Use sendToUnscheduledList=true, no breakType (no penalty)
- If cancellation is <24hrs: Use breakType="Cancelled", sendToUnscheduledList based on needs
- If no-show: Use breakType="Missed", typically sendToUnscheduledList=true for follow-up
- If appointment is recall/hygiene: Check office preference - some offices prevent recall on unscheduled list
- If appointment status is NOT "Scheduled": First update to "Scheduled", then break

## 4. CONFIRM APPOINTMENT WORKFLOW

**Intent**: Confirm an appointment or update check-in status

**Steps**:
1. **Find appointment**:
   - GetMultiplePatients → Get PatNum
   - GetAppointments(PatNum, dateStart, dateEnd) OR GetAppointments(AptNum)
   
2. **Update confirmation status**:
   - Use ConfirmAppointment function which maps to PUT /appointments/{AptNum}/confirm
   - Parameters:
     - AptNum (in URL path)
     - Confirmed (DefNum from definitions where Category=2 - confirmation method like "Confirmed", "Left Message", etc.)
   
3. **Optional: Update check-in times** (when patient arrives):
   - UpdateAppointment(AptNum, DateTimeArrived="HH:mm:ss", DateTimeSeated="HH:mm:ss", DateTimeDismissed="HH:mm:ss")
   
4. **Confirm action**:
   - Say: "Your appointment for [date] at [time] has been confirmed"

**Conditions**:
- If patient confirms via phone/text/email: Set Confirmed to appropriate status
- If patient checks in: Set DateTimeArrived to current time
- If patient is seated: Set DateTimeSeated to current time
- If appointment completed: Set DateTimeDismissed and status to "Complete"

## 5. CHECK AVAILABILITY WORKFLOW

**Intent**: Find available appointment times

**Steps**:
1. **Determine search parameters**:
   - Get date range from user (default: next 2 weeks from today)
   - Get provider preference if specified
   - Get clinic preference if multi-clinic
   - Get appointment type if specified (e.g., new patient, hygiene)
   
2. **Get available slots** (PRODUCTION METHOD):
   - **STEP 1**: Call GetAppointments(dateStart, dateEnd) for date range
   - **STEP 2**: Check the response:
     - **IF response is EMPTY ARRAY []**: ALL slots are FREE! Suggest multiple available times:
       * "Monday at 9:00 AM"
       * "Tuesday at 10:00 AM"
       * "Wednesday at 2:00 PM"
       * Continue with 2-3 more suggestions across the week
     - **IF response has appointments**: Extract occupied hours, find gaps in business hours (8am-5pm)
   - **STEP 3**: Suggest 2-3 specific available times to the user with dates and times
   - Filter by provider/clinic if specified
   - **CRITICAL**: When GetAppointments returns [], suggest concrete available times - don't say "no appointments available"!
   
3. **Filter results**:
   - By provider if specified (provNum parameter)
   - By clinic if specified (clinicNum parameter)
   - By appointment type if specified (defNumApptType parameter)
   
4. **Return available times to user**:
   - Present times in conversational format
   - Suggest best options

**Conditions**:
- Default date range is next 2 weeks from current date
- Filter by provider/clinic/appointment type as needed

## 6. RECALL APPOINTMENT WORKFLOW

**Intent**: Schedule a recall appointment (typically hygiene/cleaning)

**Steps**:
1. **Check patient recall status**:
   - GetRecalls(PatNum) to see if patient is due for recall
   - Determine recall type (Prophy, Perio, etc.)
   
2. **Get available slots after recall due date**:
   - GetAppointments(dateStart=recall due date, dateEnd, provNum=patient's provider) to find occupied slots
   - Extract occupied hours, find gaps in business hours
   - Use patient's secondary provider, or primary if no secondary
   
3. **Create recall appointment**:
   - CreateAppointment with:
     - PatNum (required)
     - AptDateTime (required)
     - Op (required)
     - IsHygiene=true (for hygiene recall)
     - ProvHyg (hygienist provider number) instead of ProvNum for hygiene
     - AppointmentTypeNum (recall type if applicable)
   
4. **Procedures auto-attach**:
   - Recall procedures automatically attach to appointment based on recall type
   
5. **🚨 MANDATORY: Confirm with provider name (DO NOT SKIP!)**:
   - **CRITICAL**: After CreateAppointment succeeds, you MUST include the provider/hygienist name
   - Extract the ProvNum or ProvHyg that was used in CreateAppointment
   - Look up the provider/hygienist name from "Available Providers" list in OFFICE CONTEXT section above
   - Match ProvNum/ProvHyg to find the exact provider name
   - **Your response MUST include the provider name - DO NOT respond without it!**
   - **Format**: "I've scheduled your recall appointment for [date] at [time] with [Provider Name]"
   - **Example**: "I've scheduled your recall appointment for November 10th at 9:00 AM with Dr. Sarah Johnson"
   - **CRITICAL REMINDER**: Always include the provider/hygienist name in your recall appointment confirmation!

**Conditions**:
- Use IsHygiene=true and ProvHyg for hygiene recalls
- Recall procedures auto-attach based on recall type
- Use patient's preferred provider (secondary or primary)

## 7. PLANNED APPOINTMENT WORKFLOW

**Intent**: Manage treatment-based planned appointments

**Steps**:
1. **Check for planned appointments**:
   - GetPatient(PatNum) and check for planned procedures OR
   - Check if office has planned appointment tracking
   
2. **If scheduling from planned appointment**:
   - Get available slots: GetAppointments(dateStart, dateEnd) to find occupied slots, calculate free slots
   - Create scheduled appointment: CreateAppointment(PatNum, AptDateTime, Op)
   - Planned appointment remains until scheduled appointment is completed
   - Procedures from planned appointment auto-attach
   
3. **If planned appointment needs update**:
   - Make changes on scheduled appointment (not planned)
   - UpdateAppointment(AptNum, ...)
   
4. **After treatment complete**:
   - Planned appointment automatically marks as complete
   - Can delete if desired

**Conditions**:
- Planned appointments are for treatment, not recall
- Planned appointment remains until scheduled appointment is completed
- Make changes on scheduled appointment, not planned
- Use Planned Appointment Tracker for follow-up if available

## 8. ASAP LIST WORKFLOW

**Intent**: Manage patients wanting earlier appointments

**Steps**:
1. **Add appointment to ASAP list**:
   - UpdateAppointment(AptNum, Priority="ASAP", AptStatus can be "Scheduled", "Planned", or "UnschedList")
   
2. **When opening becomes available**:
   - Get ASAP list: Query appointments with Priority="ASAP" and AptStatus
   - Contact appropriate patients
   
3. **If patient accepts earlier time**:
   - Reschedule appointment using Reschedule Appointment workflow
   
4. **Remove from ASAP when scheduled or no longer interested**:
   - UpdateAppointment(AptNum, Priority=null or remove ASAP designation)

**Conditions**:
- Can mark any appointment status as ASAP (Scheduled, Planned, UnschedList)
- When cancellation occurs, query ASAP list to fill opening
- Remove ASAP designation when patient is satisfied with time

# COMMON VALIDATIONS

**Before Booking**:
- Verify PatNum exists
- **🚨 CRITICAL**: Verify the exact slot is FREE by calling GetAppointments for the specific date before CreateAppointment
- Check appointment doesn't conflict with existing scheduled appointments
- If slot is occupied, find alternative times and suggest them to the user - DO NOT book over existing appointments!
- Verify Op (operatory) is valid
- Verify provider is scheduled for that time (if checking provider schedule)
- Validate date format: YYYY-MM-DD HH:mm:ss
- Dates MUST be today or future, never past

**Before Reschedule**:
- Verify appointment exists and get AptNum, CURRENT AptDateTime, and ProvNum
- **Key principle**: Calculate new date relative to CURRENT APPOINTMENT DATE based on user's natural language request
- **Critical validation**: New date must be DIFFERENT from current appointment date (unless user explicitly wants "later today")
- Example: Current appointment November 3rd, user says "next week" → November 10th (not November 3rd!)
- Example: Current appointment November 3rd, user says "next month" → December 3rd (not November 3rd!)
- **🚨 CRITICAL**: Verify the exact new slot is FREE by calling GetAppointments for the specific new date before UpdateAppointment
- Check new time doesn't conflict with other appointments (excluding the current appointment being rescheduled)
- If new slot is occupied, find alternative times and suggest them to the user - DO NOT reschedule to an occupied slot!
- Verify new Op is valid
- If broken appointment, remember to update status to "Scheduled" with datetime and op

**Before Cancel**:
- Verify appointment exists and is Scheduled status (or update first)
- Determine correct breakType based on notice period
- Check if recall appointment and unscheduled list restrictions
- Ensure office has D9986 (missed) and D9987 (cancelled) procedure codes if using breakType

# DATE RULES (TODAY IS ${todayFormatted.toUpperCase()})
- TODAY: ${todayISO}
- TOMORROW: ${tomorrowISO}
- Format for dates: YYYY-MM-DD (e.g., "${todayISO}")
- Format for appointment times: YYYY-MM-DD HH:mm:ss (e.g., "${todayISO} 09:00:00")
- **CRITICAL**: Dates MUST be ${todayISO} or later - NEVER use past dates
- Year: ${currentYear}
- Valid date range: ${todayISO} to ${currentYear}-12-31 or later

# RELATIVE DATE UNDERSTANDING (FOR RESCHEDULING)

**Principle**: Use your natural language understanding to interpret relative date terms. Calculate dates relative to the CURRENT APPOINTMENT DATE, not today.

**Critical Rule**: When user requests a different time period ("next week", "next month", "in two weeks", etc.), the new date MUST be different from the current appointment date.

**Examples of correct interpretation**:
- Current appointment: November 3rd, user says "next week" → November 10th (7 days later)
- Current appointment: November 3rd, user says "next month" → December 3rd (~30 days later)
- Current appointment: November 3rd (Monday), user says "next Monday" → November 10th (following Monday, not the same day)
- Current appointment: November 3rd, user says "in two weeks" → November 17th (14 days later)
- Current appointment: November 3rd, user says "later today" → November 3rd, different time (only exception for same date)

**Common error to avoid**: Keeping the same date when user explicitly requests a different time period (e.g., rescheduling November 3rd to November 3rd when user says "next week")

# AVAILABILITY CHECKING - PRODUCTION METHOD

**🚨 CRITICAL**: ONLY use GetAppointments method. DO NOT use GetAvailableSlots or GetAppointmentSlots - these endpoints are NOT SUPPORTED and will return errors!

**⚡ EFFICIENCY RULE**: When user specifies a SPECIFIC DATE/TIME, only check that ONE date - do NOT search date ranges unnecessarily!

**DATE FORMAT RULE**: When calling GetAppointments, date parameters MUST be in "YYYY-MM-DD" format (date only, no time!)
- ✅ CORRECT: GetAppointments(DateStart="2025-11-10", DateEnd="2025-11-17")
- ❌ WRONG: GetAppointments(DateStart="2025-11-10T08:00:00", DateEnd="2025-11-17T17:00:00") - NO timestamps!

**OPTIONAL QUICK REFERENCE**: Check pre-fetched occupiedSlots in OFFICE CONTEXT section above for a quick hint
- ⚠️ **WARNING**: Pre-fetched slots might be STALE (booked during conversation)
- ⚠️ **WARNING**: Pre-fetched slots only cover next 7 days from conversation start
- ✅ **Use it for quick estimation** - but ALWAYS verify with real-time data!

**STEP 1**: Call GetAppointments(DateStart="YYYY-MM-DD", DateEnd="YYYY-MM-DD") for the specific date range (REAL-TIME data)

**STEP 2**: Interpret the response:
- **IF response is EMPTY ARRAY []**: This means NO appointments exist in that date range!
  - **ALL slots are FREE for all providers!**
  - **YOU MUST suggest specific available times**, for example:
    * "I have Monday, November 8th at 9:00 AM available"
    * "Tuesday, November 9th at 10:00 AM is open"
    * "Wednesday, November 10th at 2:00 PM works"
  - **DO NOT say "no appointments available" when the array is empty - that means everything is open!**
  - Suggest 3-5 specific times across different days

- **IF response has appointments**: Extract occupied hours from each appointment's AptDateTime:
  * Example: "2025-11-05 09:00:00" → occupied hour is 9 (9am)
  * Example: "2025-11-05 14:30:00" → occupied hour is 14 (2pm)
  * Build list of occupied hours: [9, 10, 14, 15] (example)

**STEP 3**: Find free slots:
- Search business hours (8-17 = 8am to 4pm typically) for FREE hours:
  - Check 8 (8am) → is 8 in occupied list? → No? → Available! Suggest "8:00 AM"
  - Check 9 (9am) → is 9 in occupied list? → Yes → Skip
  - Check 10 (10am) → is 10 in occupied list? → Yes → Skip
  - Check 11 (11am) → is 11 in occupied list? → No? → Available! Suggest "11:00 AM"
  - Continue until you find 3-5 free slots across different days
- Format suggested times: "YYYY-MM-DD HH:00:00" (e.g., "2025-11-08 09:00:00")
- **Always suggest multiple options**: "I have Monday at 9 AM, Tuesday at 10 AM, or Wednesday at 2 PM available"

**STEP 4**: Present available times to user:
- Say: "I have [date] at [time], [date] at [time], and [date] at [time] available"
- Give user 2-3 specific options with dates and times
- **DO NOT just say "checking availability" and return empty - always suggest concrete times!**

**CRITICAL RULES**:
1. **Empty array [] = ALL slots free** - suggest multiple times!
2. **Always suggest 2-3 specific available times** - never return without suggestions
3. **Format**: Use natural language like "Monday, November 8th at 9:00 AM"
4. **If user asks "check availability"**: Return specific available times, not just confirmation

**NOTE**: GetAppointmentSlots endpoint returns 400 error ("appointments GET slots is not a valid method")
- Always use GetAppointments + calculate gaps method
- This method works reliably with all OpenDental databases

**VALIDATION**: 
1. **Always verify availability with GetAppointments before booking** - prevents double-booking
2. **Pre-fetched occupiedSlots is a HINT only** - use it for quick conflict checks, but always call GetAppointments for the specific date
3. **Cross-reference both**: Pre-fetched slots (fast, might be stale) + GetAppointments (real-time, accurate)

# RESPONSE FORMAT
- Natural, conversational tone for voice interaction
- Be concise and clear
- Include specific details (names, dates, times, **PROVIDER NAMES**)
- **🚨 CRITICAL**: ALWAYS include provider name in booking/reschedule/recall confirmations
- No bullet points or lists in your response
- Don't mention technical details or API calls
- **Provider name is MANDATORY** - patients need to know which doctor they're seeing!

Remember: Be helpful, accurate, persistent, and always speak naturally as if talking to someone in person.`;
}

// META-TOOL APPROACH: Single tool that can call ANY of the 49 priority functions
// The model reads function catalog in instructions and picks the right one
export const orchestratorTools = [
  {
    type: 'function',
    name: 'callOpenDentalAPI',
    description: 'Call any OpenDental API function. The function catalog is provided in the instructions. Choose the best function for the task and provide its exact name and parameters.',
    parameters: {
      type: 'object',
      properties: {
        functionName: {
          type: 'string',
          description: 'The exact function name from the catalog (e.g., "GetMultiplePatients", "CreateAppointment")'
        },
        parameters: {
          type: 'object',
          description: 'Function parameters as a key-value object',
          additionalProperties: true
        }
      },
      required: ['functionName', 'parameters'],
      additionalProperties: false
    }
  }
];

// Log the approach
console.log(`[Orchestrator] Using META-TOOL approach with PRIORITY function catalog (49 functions)`);

/**
 * Make API call to OpenDental worker route
 */
async function callOpenDentalAPI(
  functionName: string,
  parameters: Record<string, any>
): Promise<any> {
  try {
    const response = await fetch('/api/opendental', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        functionName,
        parameters,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API call failed');
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[OpenDental API] ${functionName} failed:`, error);
    throw error;
  }
}

/**
 * Fetch response from OpenAI Responses API
 */
async function fetchResponsesMessage(body: any) {
  console.log('[fetchResponsesMessage] Request:', {
    model: body.model,
    toolsCount: body.tools?.length || 0,
    inputCount: body.input?.length || 0,
    instructionsLength: body.instructions?.length || 0
  });
  
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[fetchResponsesMessage] Error:', response.status, errorText);
    throw new Error(`Responses API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Iteratively handles function calls returned by the Responses API until
 * we get a final textual answer. Returns that answer as a string.
 */
async function handleResponseIterations(
  body: any,
  response: any,
): Promise<string> {
  let currentResponse = response;
  let iterations = 0;
  const maxIterations = 12; // Increased for complex workflows with multiple checks

  while (iterations < maxIterations) {
    iterations++;
    console.log(`\n========== [Orchestrator] ITERATION ${iterations}/${maxIterations} ==========`);

    if (currentResponse?.error) {
      console.error('[Orchestrator] Response has error:', currentResponse.error);
      return 'I encountered an error processing your request.';
    }
    
    if (!currentResponse || !currentResponse.output) {
      console.error('[Orchestrator] Invalid response structure:', currentResponse);
      return 'I received an invalid response from the system.';
    }

    const outputItems: any[] = currentResponse.output ?? [];

    // Gather all function calls in the output
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      // No more function calls – build and return the assistant's final message
      const assistantMessages = outputItems.filter((item) => item.type === 'message');

      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('');
        })
        .join('\n');

      return finalText || 'I was unable to process that request.';
    }

    // For each function call, execute it and append the output
    for (const toolCall of functionCalls) {
      const toolName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');

      // Handle the meta-tool approach
      if (toolName === 'callOpenDentalAPI') {
        const { functionName, parameters } = args;
        
        console.log(`\n========== [Orchestrator] CALLING API ==========`);
        console.log(`Meta-Tool: callOpenDentalAPI`);
        console.log(`Function: ${functionName}`);
        console.log(`Parameters:`, JSON.stringify(parameters, null, 2));

        try {
          // Call OpenDental API via worker route
          const result = await callOpenDentalAPI(functionName, parameters);
          console.log(`\n[Orchestrator] ✅ ${functionName} SUCCESS:`);
          console.log(JSON.stringify(result, null, 2));
          console.log(`================================================\n`);

          // Add function call and result to the request body
          body.input.push(
            {
              type: 'function_call',
              call_id: toolCall.call_id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
            {
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify({
                success: true,
                data: result
              }),
            },
          );
        } catch (error: any) {
          console.error(`\n[Orchestrator] ❌ ${functionName} ERROR:`);
          console.error(error.message || error);
          console.error(`================================================\n`);

          // Add error output
          body.input.push(
            {
              type: 'function_call',
              call_id: toolCall.call_id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
            {
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify({
                error: true,
                message: error.message || 'Unknown error'
              }),
            },
          );
        }
      } else {
        // Handle any other direct tool calls (legacy support)
        console.log(`\n========== [Orchestrator] CALLING TOOL ==========`);
        console.log(`Tool: ${toolName}`);
        console.log(`Arguments:`, JSON.stringify(args, null, 2));
        
        try {
          const result = await callOpenDentalAPI(toolName, args);
          console.log(`\n[Orchestrator] ✅ ${toolName} SUCCESS:`);
          console.log(JSON.stringify(result, null, 2));
          console.log(`================================================\n`);

          body.input.push(
            {
              type: 'function_call',
              call_id: toolCall.call_id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
            {
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify({
                success: true,
                data: result
              }),
            },
          );
        } catch (error: any) {
          console.error(`\n[Orchestrator] ❌ ${toolName} ERROR:`);
          console.error(error.message || error);
          console.error(`================================================\n`);

          body.input.push(
            {
              type: 'function_call',
              call_id: toolCall.call_id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
            {
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify({
                error: true,
                message: error.message || 'Unknown error'
              }),
            },
          );
        }
      }
    }

    // Make the follow-up request including the tool outputs
    console.log(`[Orchestrator] Making follow-up request with ${body.input.length} input items...`);
    currentResponse = await fetchResponsesMessage(body);
  }

  console.error(`[Orchestrator] ⚠️ MAXIMUM ITERATIONS REACHED (${maxIterations})`);
  return 'I apologize, but I was unable to complete your request. Please try again.';
}

/**
 * Orchestrator agent tool
 */
export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description: 'Handles patient operations by calling OpenDental API functions. Use this for finding patients, booking appointments, canceling, checking schedules, etc.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description: 'The relevant information from the last user message that requires API interaction'
      }
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false
  },
  execute: async (input, _details) => {
    const { relevantContextFromLastUserMessage } = input as {
      relevantContextFromLastUserMessage: string;
    };
    
    console.log('\n🔵 ========================================');
    console.log('🔵 [ORCHESTRATOR] INVOKED');
    console.log('🔵 User Message:', relevantContextFromLastUserMessage);
    console.log('🔵 ========================================\n');

    try {
      // Extract office context from conversation history if available
      let officeContext: OfficeContext | undefined;
      const details = _details as any; // Type assertion for context access
      if (details?.context?.history) {
        for (const message of details.context.history) {
          if (message.type === 'function_call_output' && 
              message.name === 'get_office_context' && 
              message.output) {
            try {
              officeContext = JSON.parse(message.output as string);
              console.log('[ORCHESTRATOR] ✅ Found office context:', {
                providers: officeContext?.providers?.length || 0,
                operatories: officeContext?.operatories?.length || 0,
                occupiedSlots: officeContext?.occupiedSlots?.length || 0
              });
              break;
            } catch (e) {
              console.error('[ORCHESTRATOR] Failed to parse office context:', e);
            }
          }
        }
      }
      
      if (!officeContext) {
        console.log('[ORCHESTRATOR] ⚠️ No office context found - will need additional API calls');
      }
      
      // Get user message and conversation history
      const userMessage = relevantContextFromLastUserMessage || 'Help needed';
      
      // Extract conversation history from context
      const history = details?.context?.history || [];
      const conversationHistory: any[] = [];
      
      // Extract messages from history (user and assistant messages)
      for (const item of history) {
        if (item.type === 'message' && item.role) {
          // Extract text content from message
          let textContent = '';
          if (typeof item.content === 'string') {
            textContent = item.content;
          } else if (Array.isArray(item.content)) {
            textContent = item.content
              .filter((c: any) => c.type === 'input_text' || c.type === 'output_text' || !c.type)
              .map((c: any) => c.text || c.content || c)
              .join(' ');
          }
          
          if (textContent.trim()) {
            conversationHistory.push({
              type: 'message',
              role: item.role,
              content: textContent.trim()
            });
          }
        }
      }
      
      // Build request body for Responses API with office context and conversation history
      const body: any = {
        model: 'gpt-4o-mini',
        instructions: generateOrchestratorInstructions(officeContext), // Pass office context
        tools: orchestratorTools,
        input: [
          ...conversationHistory, // Include full conversation history
          {
            type: 'message',
            role: 'user',
            content: userMessage
          }
        ]
      };

      // Make initial request
      const response = await fetchResponsesMessage(body);
      
      // Handle tool calls iteratively
      const finalResponse = await handleResponseIterations(body, response);
      
      console.log('\n=================================================');
      console.log('[Orchestrator] FINAL RESPONSE TO USER:');
      console.log(finalResponse);
      console.log('=================================================\n');
      
      // Return plain string - Lexi will read this verbatim
      return finalResponse;

    } catch (error: any) {
      console.error('[getNextResponseFromSupervisor] Error:', error);
      
      // Return plain string for errors too
      return `I encountered an error while processing your request: ${error.message}`;
    }
  },
});