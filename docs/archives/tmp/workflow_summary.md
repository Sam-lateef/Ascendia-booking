# Orchestrator Workflow Summary & Gap Analysis

## Current Workflow Summary

### 1. General Office Information Questions
**Current Flow:**
- Lines 417-433: "HANDLE PATIENT QUESTIONS"
- Can answer: office hours, location, services, policies, provider info
- Uses office context or preferences
- **Gap**: Doesn't explicitly state "NO patient information required"

### 2. BOOK NEW APPOINTMENT Workflow
**Current Flow (Lines 196-266):**
1. Get PatNum via GetMultiplePatients (search by name/phone)
2. Ask appointment type (if not specified)
3. Ask provider preference (if not specified)
4. Determine requested date
5-9. Search availability using GetAvailableSlots
10-13. Book appointment and confirm

**Gaps Identified:**
- ❌ No explicit check: "Is patient new or returning?"
- ❌ If patient NOT found → Should offer to create new patient record
- ❌ If patient found (returning) → Should summarize existing/upcoming appointments first
- ❌ Missing final confirmation step: "This is the booking I will submit, all good?" before CreateAppointment

### 3. RESCHEDULE APPOINTMENT Workflow
**Current Flow (Lines 267-327):**
1. Get PatNum via GetMultiplePatients
2. Get appointment with GetAppointments(PatNum)
3. If multiple appointments: Present options
4-6. Gather new preferences
7-10. Search availability
11-14. Reschedule and confirm

**Gaps Identified:**
- ❌ Doesn't summarize ALL upcoming appointments when patient is identified
- ❌ Missing final confirmation step: "This is the change I will submit, all good?" before UpdateAppointment

### 4. CREATE NEW PATIENT Workflow
**Current Flow (Lines 394-408):**
- Separate workflow exists
- Collects: FName, LName, Birthdate, WirelessPhone
- Creates patient record

**Note**: This should be integrated into BOOK NEW APPOINTMENT flow when patient not found

## Required Workflow Improvements

### Priority 1: General Questions
- ✅ Answer directly without asking for patient info
- ✅ Use office context for hours, location, services, policies

### Priority 2: Patient Identification & Context
**For Appointment Requests:**
1. Extract name/phone from message
2. Call GetMultiplePatients
3. **If NOT found:**
   - "I don't see you in our system. Would you like me to create a new patient record?"
   - If yes → Collect required fields (FName, LName, Birthdate, WirelessPhone)
   - Create patient record
   - Continue with booking
4. **If found (returning patient):**
   - Get ALL upcoming appointments: GetAppointments(PatNum, dateStart=today, dateEnd=future)
   - Summarize: "I see you have [X] upcoming appointment(s): [list dates/times/types]"
   - Then continue with booking/rescheduling

### Priority 3: Final Confirmation Before Submission
**Before CreateAppointment:**
- "Just to confirm, I'm booking: [appointment_type] with Dr. [ProviderName] on [day], [date] at [time]. Does that work for you?"
- Wait for explicit confirmation
- Then call CreateAppointment

**Before UpdateAppointment (Reschedule):**
- "Just to confirm, I'm moving your appointment from [old_date/time] to [new_date/time] with Dr. [ProviderName]. Is that correct?"
- Wait for explicit confirmation
- Then call UpdateAppointment

## Proposed Updated Workflow Order

### BOOK NEW APPOINTMENT (Updated)
1. **Intent Detection**: User wants to book
2. **Patient Identification:**
   - Extract name/phone from message
   - Call GetMultiplePatients
   - **If NOT found:**
     - Offer to create new patient
     - Collect required fields
     - CreatePatient
     - PatNum now available
   - **If found:**
     - Get PatNum
     - Call GetAppointments(PatNum, today, future) to get upcoming appointments
     - Summarize: "I see you have [X] upcoming appointment(s): [list]"
3. **Gather Booking Details:**
   - Appointment type (if not specified)
   - Provider preference (if not specified)
   - Date preference
4. **Find Availability:**
   - Call GetAvailableSlots
   - Present options (2 best slots)
5. **Final Confirmation:**
   - Patient selects time
   - **CRITICAL**: "Just to confirm, I'm booking: [details]. Does that work for you?"
   - Wait for confirmation
6. **Submit Booking:**
   - Call CreateAppointment
   - Confirm success

### RESCHEDULE APPOINTMENT (Updated)
1. **Patient Identification:**
   - Get PatNum via GetMultiplePatients
   - Call GetAppointments(PatNum, today, future)
   - **Summarize ALL upcoming appointments first**
2. **Identify Which to Reschedule:**
   - If multiple: Ask which one
   - If one: Confirm it's the right one
3. **Gather New Preferences:**
   - New date/time
   - Provider preference (if changing)
4. **Find Availability:**
   - Call GetAvailableSlots
   - Present options
5. **Final Confirmation:**
   - Patient selects new time
   - **CRITICAL**: "Just to confirm, I'm moving your appointment from [old] to [new]. Is that correct?"
   - Wait for confirmation
6. **Submit Change:**
   - Call UpdateAppointment
   - Confirm success

























