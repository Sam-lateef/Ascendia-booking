# Manual Testing Checklist for OpenDental Agent

## Pre-Test Setup

- [ ] `.env` file configured with `OPENAI_API_KEY` and `OPENDENTAL_API_KEY`
- [ ] Dependencies installed (`npm install`)
- [ ] Development server running (`npm run dev`)
- [ ] Browser open to `http://localhost:3000`
- [ ] Console logs visible (F12 Developer Tools)

## Phase 1: Office Context Pre-Fetching

### Test 1.1: Initial Context Fetch
- [ ] Start new voice call
- [ ] Wait for Lexi's greeting
- [ ] Check console logs for:
  - `[Lexi] Fetching office context...`
  - `[Lexi] Office context ready: X providers, Y operatories, Z occupied slots`
- [ ] Verify context fetch completes in under 5 seconds

**Expected Result**: Office context should be fetched automatically after greeting, with provider, operatory, and occupied slot counts logged.

**Pass/Fail**: ___________

---

### Test 1.2: Context Available in Orchestrator
- [ ] Continue from Test 1.1
- [ ] Say: "I'd like to book an appointment"
- [ ] Check console logs for:
  - `[ORCHESTRATOR] ✅ Found office context: {...}`
  - Should show non-zero counts for providers, operatories, occupiedSlots

**Expected Result**: Orchestrator should successfully retrieve office context from conversation history.

**Pass/Fail**: ___________

---

## Phase 2: Conflict Detection

### Test 2.1: No Conflict Booking
- [ ] Start new call
- [ ] Say: "I'd like to book an appointment"
- [ ] Provide patient info when asked (name/phone)
- [ ] Request a time far in the future (e.g., "December 20th at 10am")
- [ ] Verify appointment is created successfully
- [ ] Check console logs - should NOT show conflict warnings

**Expected Result**: Appointment booked without conflicts.

**Pass/Fail**: ___________

---

### Test 2.2: Operatory Conflict Detection
- [ ] Start new call
- [ ] Note an occupied slot from console logs (e.g., "2025-10-30 14:00:00, Provider 1, Op 1")
- [ ] Try to book appointment at EXACT same time/operatory
- [ ] Agent should:
  - Detect the conflict
  - Explain "Operatory X is occupied at [time]"
  - Suggest 2-3 alternative times

**Expected Result**: Conflict detected and alternatives suggested.

**Pass/Fail**: ___________

---

### Test 2.3: Provider Conflict Detection
- [ ] Start new call
- [ ] Note an occupied slot with specific provider
- [ ] Try to book with SAME provider at SAME time (but different operatory)
- [ ] Agent should:
  - Detect provider conflict
  - Explain "Provider is busy at [time]"
  - Suggest alternative provider or time

**Expected Result**: Provider conflict detected, alternatives given.

**Pass/Fail**: ___________

---

### Test 2.4: Patient Double-Booking Prevention
- [ ] Start new call
- [ ] Provide existing patient info
- [ ] Check their existing appointments
- [ ] Try to book at exact same time as existing appointment
- [ ] Agent should:
  - Detect patient already has appointment
  - Explain "You already have an appointment at [time]"
  - Offer to reschedule or choose different time

**Expected Result**: Patient double-booking prevented.

**Pass/Fail**: ___________

---

## Phase 3: API Call Reduction

### Test 3.1: Count API Calls (With Context)
- [ ] Start new call (office context pre-fetched)
- [ ] Book an appointment
- [ ] Count API calls in console:
  - Should see: GetMultiplePatients, CreateAppointment
  - Should NOT see: GetProviders, GetOperatories, GetAppointments (for availability)

**Expected Calls**: 2-3 total (patient lookup + booking)

**Actual Calls**: ___________

**Pass/Fail**: ___________

---

### Test 3.2: Performance Comparison
- [ ] Time a booking with office context pre-fetched
- [ ] Note the response time

**Time to Book (With Context)**: ___________ seconds

**Expected**: Under 10 seconds total

**Pass/Fail**: ___________

---

## Phase 4: GetAvailableSlots Integration

### Test 4.1: Available Slots API Call
- [ ] Start new call
- [ ] Say: "I'd like to book an appointment next week"
- [ ] Check console logs for:
  - `callOpenDentalAPI("GetAvailableSlots", ...)`
  - Should use dateStart and dateEnd (not "date" parameter)
- [ ] If slots returned: Agent should present 2-3 options
- [ ] If empty: Agent should fall back to reasonable times

**Expected Result**: GetAvailableSlots called first, fallback works if needed.

**Pass/Fail**: ___________

---

### Test 4.2: Date Range Handling
- [ ] Request appointment "tomorrow"
- [ ] Verify GetAvailableSlots uses:
  - dateStart: tomorrow's date
  - dateEnd: 3-7 days from tomorrow
  - Format: YYYY-MM-DD

**Expected Result**: Correct date format and range used.

**Pass/Fail**: ___________

---

## Phase 5: Workflow Completeness

### Test 5.1: Complete Booking Flow (New Patient)
- [ ] Start new call
- [ ] Provide name/phone not in system
- [ ] Agent offers to register
- [ ] Provide: First name, Last name, DOB, Phone, Address
- [ ] Agent creates patient record
- [ ] Agent books appointment
- [ ] Confirm appointment details

**Expected Result**: New patient registered and appointment booked in one call.

**Pass/Fail**: ___________

---

### Test 5.2: Complete Booking Flow (Existing Patient)
- [ ] Start new call
- [ ] Provide existing patient name/phone
- [ ] Agent finds patient
- [ ] Request specific date/time
- [ ] Agent checks availability (using pre-fetched context)
- [ ] Agent detects any conflicts (if applicable)
- [ ] Agent books appointment
- [ ] Confirm details

**Expected Result**: Existing patient found, appointment booked with conflict detection.

**Pass/Fail**: ___________

---

### Test 5.3: Cancellation Flow
- [ ] Start new call
- [ ] Say: "I need to cancel my appointment"
- [ ] Provide patient info
- [ ] Agent finds appointment
- [ ] Agent cancels using BreakAppointment (not DeleteAppointment)
- [ ] Confirm cancellation

**Expected Result**: Appointment cancelled, history preserved.

**Pass/Fail**: ___________

---

### Test 5.4: Rescheduling Flow
- [ ] Start new call
- [ ] Say: "I need to reschedule my appointment"
- [ ] Provide patient info and current appointment details
- [ ] Provide new desired time
- [ ] Agent checks conflicts for new time
- [ ] Agent reschedules
- [ ] Confirm new appointment

**Expected Result**: Old appointment cancelled/moved, new time booked.

**Pass/Fail**: ___________

---

## Phase 6: Error Handling & Edge Cases

### Test 6.1: Context Not Available Fallback
- [ ] Modify Lexi's instructions to NOT call get_office_context
- [ ] Start new call
- [ ] Book appointment
- [ ] Check console: Should see `⚠️ No office context found`
- [ ] Agent should still complete booking (makes additional API calls)

**Expected Result**: System works without context, just slower.

**Pass/Fail**: ___________

---

### Test 6.2: Expired Context Handling
- [ ] Start call
- [ ] Wait 6+ minutes (context TTL = 5 minutes)
- [ ] Try to book appointment
- [ ] System should either:
  - Re-fetch context automatically, OR
  - Still use stale context (occupied slots may be outdated)

**Expected Result**: System handles expiration gracefully.

**Pass/Fail**: ___________

---

### Test 6.3: Invalid Date Handling
- [ ] Try to book appointment "yesterday"
- [ ] Agent should refuse
- [ ] Agent should explain "cannot book in the past"

**Expected Result**: Past dates rejected politely.

**Pass/Fail**: ___________

---

### Test 6.4: Missing Patient Info
- [ ] Try to book without providing full patient info
- [ ] Agent should ask for required fields
- [ ] Agent should NOT make API call until info complete

**Expected Result**: Agent collects all required info before API call.

**Pass/Fail**: ___________

---

## Phase 7: Unified Registry Verification

### Test 7.1: Function Catalog Loading
- [ ] Start new call
- [ ] Trigger orchestrator (request any operation)
- [ ] Check console for errors related to:
  - `unified_registry.json` loading
  - `generateFunctionCatalog()` execution
- [ ] Should see 337 functions loaded

**Expected Result**: Unified registry loads without errors, all 337 functions available.

**Pass/Fail**: ___________

---

### Test 7.2: Natural Language Guide Usage
- [ ] Request patient lookup by phone
- [ ] Orchestrator should use GetMultiplePatients (not GetPatients)
- [ ] Check console logs for function selection reasoning
- [ ] Verify it follows relationship rules from unified registry

**Expected Result**: Correct function selected based on enhanced guide.

**Pass/Fail**: ___________

---

## Summary

**Total Tests**: 23  
**Passed**: ___________  
**Failed**: ___________  
**Skipped**: ___________  

**Critical Issues Found**:
- 
- 
- 

**Minor Issues Found**:
- 
- 
- 

**Performance Metrics**:
- Average time to fetch office context: ___________ ms
- Average time to complete booking: ___________ seconds
- Average API calls per booking: ___________

**Recommendations**:
- 
- 
- 

---

## Notes

**Tester Name**: ___________  
**Date**: ___________  
**Environment**: Dev / Staging / Production  
**OpenDental API Version**: ___________  

**Additional Comments**:







---

*This checklist ensures comprehensive testing of the new office context pre-fetching, conflict detection, and unified registry features.*




