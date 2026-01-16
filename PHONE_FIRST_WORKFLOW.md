# Phone-First Workflow - Critical Requirement

## Date: January 2, 2026

## Core Principle
**Phone number is the PRIMARY identifier for ALL patient operations.**

---

## 🔴 CRITICAL RULES

### 1. **Patient Lookup - ALWAYS By Phone**
```
✅ CORRECT: GetMultiplePatients(Phone: "6195551234")
❌ WRONG:   GetMultiplePatients(FName: "John", LName: "Smith")
```

**Never search by name alone. Phone number is REQUIRED for lookup.**

---

### 2. **Creating New Patient - Phone Already Known**
```
WORKFLOW:
1. User calls → Lexi asks for phone
2. Lexi calls supervisor: "Phone number: 6195551234"
3. Supervisor calls GetMultiplePatients(Phone: "6195551234") → not found
4. Supervisor already has phone "6195551234" from step 2!
5. Supervisor asks Lexi to collect: first name, last name, DOB
6. Lexi collects info
7. Supervisor calls CreatePatient with THE SAME PHONE from step 2
```

**DO NOT ask for phone again - we already have it from the lookup!**

---

## 📋 Updated Instructions

### Lexi Mini (Receptionist)
```markdown
**CRITICAL - PHONE NUMBER IS REQUIRED FIRST:**
Every booking operation starts with phone number. This is the PRIMARY identifier.

1. ASK FOR PHONE NUMBER FIRST (ALWAYS)
2. CALL SUPERVISOR with: "Phone number: 6195551234"
3. IF NEW PATIENT:
   - Collect: first name, last name, DOB
   - Call supervisor with: "New patient: [First] [Last], DOB: [date], phone: [same number]"
   - Include the phone number again so supervisor knows which phone to use
```

### Supervisor Agent
```markdown
STEP 2 - Identify Patient BY PHONE NUMBER (REQUIRED):
- CRITICAL: Phone number is the PRIMARY identifier - ALWAYS search by phone first
- Extract phone number from conversation history
- Call GetMultiplePatients(Phone: "6195551234") - 10 digits, no dashes
- NEVER search by name alone - phone number is required for lookup
- If NOT found → go to CREATE PATIENT flow (but KEEP the phone number)

CREATE NEW PATIENT FLOW:
When GetMultiplePatients(Phone) returns no results:

CRITICAL - YOU ALREADY HAVE THE PHONE NUMBER:
- The phone number was used in GetMultiplePatients lookup
- Extract it from conversation history or the GetMultiplePatients call you just made
- DO NOT ask for phone again - you already have it
```

---

## 🎯 Example Flow (Correct)

```
User: "Hi, I need to book an appointment"
Lexi: "Can I get your phone number please?"
User: "619-456-3960"
Lexi: "6-1-9, 4-5-6, 3-9-6-0. Let me look that up."

[Lexi → Supervisor: "Phone number: 6194563960"]

Supervisor:
  1. Calls get_datetime() → knows it's 2026-01-02
  2. Calls GetMultiplePatients(Phone: "6194563960") → not found
  3. Saves phone: "6194563960"
  4. Returns: "I'm not finding anyone at that number. Are you a new patient?"

Lexi: "I'm not finding anyone at that number. Are you a new patient?"
User: "Yes, I'm new"
Lexi: "What's your first name?"
User: "Yousef"
Lexi: "And your last name?"
User: "Saddam"
Lexi: "What's your date of birth?"
User: "March 7, 2006"
Lexi: "Let me get you set up."

[Lexi → Supervisor: "New patient: Yousef Saddam, DOB: March 7, 2006, phone: 6194563960"]

Supervisor:
  1. Extracts: FName="Yousef", LName="Saddam", Birthdate="2006-03-07"
  2. Phone="6194563960" (from original lookup OR from Lexi's context)
  3. Calls CreatePatient(FName: "Yousef", LName: "Saddam", 
                        Birthdate: "2006-03-07", WirelessPhone: "6194563960")
  4. Gets result with PatNum: 40
  5. SAVES PatNum: 40 for next step
  6. Returns: "Yousef is all set up. When would you like to come in?"
```

---

## ❌ Common Mistakes (Now Fixed)

### Mistake 1: Searching by Name
```
❌ GetMultiplePatients(FName: "Yousef", LName: "Saddam")
✅ GetMultiplePatients(Phone: "6194563960")
```

### Mistake 2: Asking for Phone Twice
```
❌ GetMultiplePatients(Phone: "6194563960") → not found
   → "What's your phone number?" (asking again!)
   
✅ GetMultiplePatients(Phone: "6194563960") → not found
   → Use same phone "6194563960" for CreatePatient
```

### Mistake 3: Creating Patient Without Phone
```
❌ CreatePatient(FName: "Yousef", LName: "Saddam", Birthdate: "2006-03-07")
   (Missing WirelessPhone!)
   
✅ CreatePatient(FName: "Yousef", LName: "Saddam", 
                Birthdate: "2006-03-07", WirelessPhone: "6194563960")
```

---

## 📊 Verification Checklist

- [ ] Patient lookup uses `GetMultiplePatients(Phone: "...")`
- [ ] Phone number is collected FIRST before any other operation
- [ ] When patient not found, SAME phone is used for CreatePatient
- [ ] Phone number is NOT asked twice
- [ ] CreatePatient includes WirelessPhone parameter
- [ ] Supervisor extracts phone from GetMultiplePatients call or context

---

## 🔧 Files Updated

1. **src/app/agentConfigs/embeddedBooking/supervisorAgent.ts**
   - Added: "CRITICAL - YOU ALREADY HAVE THE PHONE NUMBER"
   - Added: Example workflow showing phone reuse
   - Added: "NEVER search by name alone"

2. **src/app/agentConfigs/embeddedBooking/lexiStandardAgent.ts**
   - Added: "CRITICAL - PHONE NUMBER IS REQUIRED FIRST"
   - Added: "Include the phone number again so supervisor knows which phone to use"

3. **src/twilio/websocket-handler-standard.ts**
   - Same updates as lexiStandardAgent.ts

---

## ✅ Expected Behavior Now

1. **Every conversation starts with phone collection**
2. **Phone is used for GetMultiplePatients lookup**
3. **If new patient, same phone is reused for CreatePatient**
4. **Supervisor tracks phone throughout conversation**
5. **No duplicate phone requests**
6. **All patients have valid phone numbers**

---

## 🚀 Ready to Test!

The phone-first workflow is now crystal clear in all instructions. The system will:
- Always ask for phone first
- Always use phone for patient lookup
- Reuse the same phone for new patient creation
- Never ask for phone twice
- Ensure every patient has a phone number








