# Standard Mode (Two-Agent) Improvements

## Date: January 2, 2026

## Problem Identified
Testing revealed that Yousef's appointment was created with **wrong year (2023 instead of 2026)** and potentially **wrong PatNum**, causing the appointment to not show in the dashboard.

### Root Causes:
1. **Supervisor didn't call `get_datetime()` first** - so it didn't know current year
2. **No instructions to extract PatNum from CreatePatient results**
3. **Supervisor had minimal, generic instructions** (unlike premium agent)
4. **Lexi mini wasn't guiding supervisor with enough context**

---

## Changes Made

### 1. Supervisor Agent Instructions (`src/app/agentConfigs/embeddedBooking/supervisorAgent.ts`)

**Before:** 79 lines of basic instructions
**After:** 200+ lines of comprehensive, step-by-step workflow

#### Key Additions:
```markdown
CRITICAL - ALWAYS START WITH THESE TOOLS:
1. Call get_datetime() FIRST to know current date/time
2. Call get_office_context() if you need provider/operatory information
```

#### Step-by-Step Booking Flow:
```
STEP 1 - Get Current Date and Context
STEP 2 - Identify Patient
STEP 3 - Calculate Requested Date (using get_datetime() result)
STEP 4 - Find Available Slots
STEP 5 - Match User's Requested Time to Slot
STEP 6 - Create Appointment (with exact slot details)
STEP 7 - Confirm to Patient
```

#### PatNum Tracking:
```markdown
CRITICAL - TRACK PATIENT IDs:
- When CreatePatient succeeds, it returns a PatNum
- SAVE that PatNum and use it for CreateAppointment
- If booking for a newly created patient, use the PatNum from CreatePatient result
```

#### Date Calculation:
```markdown
STEP 3 - Calculate Requested Date:
- User might say "the 16th", "next Tuesday", "tomorrow"
- Use get_datetime() result to determine actual YYYY-MM-DD date
- If user said "January 16th" and current year is 2026 → use 2026-01-16
- NEVER use wrong year (like 2023 when it's 2026)
```

---

### 2. Lexi Mini Agent Instructions

**Updated in:**
- `src/app/agentConfigs/embeddedBooking/lexiStandardAgent.ts`
- `src/twilio/websocket-handler-standard.ts`

#### Key Additions:
```markdown
YOUR JOB - COLLECT INFO AND HAND OFF TO SUPERVISOR

YOU handle:
- Greetings and chitchat
- Asking for information (phone number, name, DOB, dates, times)
- Confirming details back to patient
- Reading back phone numbers digit by digit

SUPERVISOR handles:
- Looking up patients
- Checking appointments
- Finding available times
- Booking appointments
```

#### Better Context Passing:
```markdown
WHAT TO PUT IN relevantContextFromLastUserMessage:
- Phone numbers
- Names
- Dates/times mentioned
- What they want to do (book, reschedule, cancel)
- Any preferences (doctor, time of day)

GOOD EXAMPLES:
"Phone number: 6195551234"
"Book appointment on January 16th"
"Patient said they want 10 AM"
"New patient: Yousef Saddam, DOB: March 7, 2006"
```

---

## How This Fixes the Issues

### Issue 1: Wrong Year (2023 instead of 2026)
**Before:** Supervisor had no instructions about dates
**After:** Supervisor **MUST** call `get_datetime()` first and use current year for calculations

### Issue 2: Wrong PatNum
**Before:** Supervisor didn't know to extract PatNum from CreatePatient results
**After:** Explicit instructions to **SAVE PatNum from CreatePatient and use it immediately**

### Issue 3: Minimal Workflow
**Before:** Generic instructions with no step-by-step flow
**After:** Comprehensive 7-step booking flow matching the working premium agent

### Issue 4: Unclear Context
**Before:** Lexi passed vague context to supervisor
**After:** Lexi has clear examples of what to pass (phone numbers, dates, names)

---

## Testing Checklist

- [ ] Test patient lookup by phone
- [ ] Test new patient registration
- [ ] Test booking appointment for existing patient
- [ ] Test booking appointment for NEW patient (PatNum tracking)
- [ ] Verify dates use correct year (2026, not 2023)
- [ ] Check appointments show in dashboard
- [ ] Test error recovery (slot taken, invalid operatory)
- [ ] Test rescheduling flow
- [ ] Test cancellation flow

---

## Comparison: Premium vs Standard Instructions

### Premium Agent (lexiAgentTwilio.ts):
- **415 lines** of detailed instructions
- Handles ALL functions directly
- Step-by-step workflows for each scenario
- Comprehensive error handling

### Standard Mode (Two-Agent):
- **Lexi Mini:** 90 lines - focused on conversation and info gathering
- **Supervisor:** 200 lines - focused on booking logic and tool execution
- **Combined cost:** Much lower than Premium (gpt-4o-mini for chat, gpt-4o only for booking)

---

## Next Steps

1. **Test in browser** with agent-ui dropdown "Standard (Cost-Optimized)"
2. **Deploy to Twilio** via WebSocket handler
3. **Monitor logs** for correct date/PatNum usage
4. **Compare costs** Premium vs Standard over 1 week
5. **Update Agent Settings page** to allow switching modes

---

## Files Modified

1. `src/app/agentConfigs/embeddedBooking/supervisorAgent.ts` - Comprehensive workflow
2. `src/app/agentConfigs/embeddedBooking/lexiStandardAgent.ts` - Better context guidance
3. `src/twilio/websocket-handler-standard.ts` - Updated instructions
4. `src/app/types.ts` - Already had Zod fix (`.nullable().optional()`)

---

## Expected Outcome

✅ Appointments created with **correct year (2026)**
✅ New patients use **correct PatNum** from CreatePatient result
✅ Supervisor follows **step-by-step workflow** like Premium agent
✅ Lexi passes **clear, detailed context** to supervisor
✅ All appointments **visible in dashboard**
✅ **60-80% cost savings** vs Premium mode








