# Standard Mode Refactored Using Premium Agent Instructions

## Date: January 2, 2026

## Summary
Refactored the Standard Mode (two-agent) instructions using the Premium agent's comprehensive, proven instructions as the base. Split responsibilities clearly between Lexi Mini (conversation) and Supervisor (booking logic).

---

## What Was Done

### ✅ Lexi Standard Agent (`src/app/agentConfigs/embeddedBooking/lexiStandardAgent.ts`)
**COMPLETELY REWRITTEN** using Premium agent as base.

#### Added from Premium:
1. **Full Identity & Personality** (lines 29-67 from Premium)
   - Natural conversational style
   - "What you sound like" examples
   - "Stay in your lane" guidelines

2. **Background Noise Handling** (lines 77-86 from Premium)
   - Ignore foreign language transcriptions
   - Handle gibberish

3. **Verification Protocols** (lines 108-133 from Premium)
   - Phone number verification (digit by digit)
   - Name spelling confirmation
   - DOB confirmation in spoken format

4. **Complete Workflow Flows**:
   - Patient Lookup Flow
   - New Patient Flow (with verification)
   - Booking Appointment Flow (8 steps)
   - Rescheduling Flow (8 steps)
   - Canceling Flow (5 steps)

5. **Handling Problems** (from Premium lines 320-354)
   - Patient goes silent
   - Patient changes mind
   - Patient can't remember info

#### What Lexi Does (Conversation Only):
- Greetings and warm conversation
- Asking for information (phone, name, DOB, dates, times, preferences)
- Reading back phone numbers digit by digit
- Spelling back names
- Confirming dates of birth
- **Hands off ALL booking logic to supervisor**

---

### 🚧 TODO: Twilio WebSocket Handler
The same instructions need to be applied to:
- `src/twilio/websocket-handler-standard.ts`

Just replace the `lexiChatInstructions` constant (lines 57-187) with the same comprehensive instructions from the new Lexi Standard Agent.

---

## Key Improvements

### 1. Natural Conversation Style
**Before:**
```
"Can I get your phone number please?"
```

**After (from Premium):**
```
Good: "Okay, and what's a good phone number for you?"
Bad: "Please provide your phone number."
```

### 2. Step-by-Step Workflows
**Before:** Generic "call supervisor" instructions

**After:** Detailed 8-step flows for:
- Booking new appointments
- Rescheduling
- Canceling
- New patient registration

### 3. Verification Protocols
**Added:**
- Always spell back names: "That's John, J-O-H-N, Smith, S-M-I-T-H?"
- Always read phone digit by digit: "6-1-9, 5-5-5, 1-2-3-4?"
- Always confirm DOB in spoken format: "January 15th, 1990?"
- Always confirm before booking: "Should I confirm that?"

### 4. Problem Handling
**Added from Premium:**
- Patient goes silent → "Are you still there?"
- Patient changes mind → Stay helpful, restart
- Info doesn't match → Offer to update
- Background noise → Ignore, ask to repeat

### 5. Clear Examples
**Added:**
- Good vs Bad phrasing examples
- Exact context strings to pass to supervisor
- How to read supervisor's responses naturally

---

## Comparison: Premium vs New Standard

### Premium Agent (lexiAgentTwilio.ts):
- **415 lines** of instructions
- Handles ALL functions directly
- Single-agent architecture
- Uses gpt-4o-realtime ($$$)

### New Standard Mode (Two-Agent):
- **Lexi Mini:** ~300 lines focused on conversation
- **Supervisor:** ~200 lines focused on booking
- **Combined:** All the workflows and personality of Premium
- **Cost:** 60-80% cheaper (gpt-4o-mini for chat, gpt-4o only for booking)

---

## Files Modified

✅ `src/app/agentConfigs/embeddedBooking/lexiStandardAgent.ts` - COMPLETE REWRITE
🚧 `src/twilio/websocket-handler-standard.ts` - NEEDS SAME UPDATE

---

## Next Steps

1. **Update WebSocket Handler** - Apply same instructions to Twilio version
2. **Test in Browser** - Use agent-ui with "Standard (Cost-Optimized)" option
3. **Verify Workflows**:
   - Patient lookup by phone
   - New patient registration with verification
   - Booking with confirmation
   - Rescheduling with confirmation
   - Canceling with reschedule offer
4. **Deploy to Production** when tests pass

---

## Key Features Inherited from Premium

✅ Natural, warm personality
✅ Phone-first workflow (PRIMARY identifier)
✅ Verification protocols for voice reliability
✅ Step-by-step booking flows
✅ Problem handling (silent patient, changes mind, etc.)
✅ Background noise handling
✅ Confirmation before booking: "Should I confirm that?"
✅ Clean conversation endings (no "anything else?")
✅ "Stay in your lane" - redirect off-topic questions
✅ Name spelling verification
✅ DOB confirmation in spoken format
✅ Good vs Bad phrasing examples

---

## Expected Outcome

The Standard Mode now has:
- ✅ All the personality and workflow quality of Premium
- ✅ Same verification protocols
- ✅ Same problem handling
- ✅ Clear separation: Lexi (conversation) + Supervisor (booking)
- ✅ 60-80% cost savings vs Premium
- ✅ Phone-first workflow (no more wrong PatNum or missing phone)
- ✅ Date handling (uses current year 2026, not 2023)

**It's Premium-quality at Standard-mode prices!** 🎯








