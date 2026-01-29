# Unified Booking Architecture - All Channels

## ✅ Channel Configuration (Updated Jan 2026)

All channels now use the **same booking logic** through `/api/booking` with internal database.

| Channel | Agent Config | API Route | Database | Status |
|---------|-------------|-----------|----------|--------|
| **Web Chat** | `embeddedBooking/lexiAgent.ts` | `/api/booking` | Internal Supabase | ✅ Working |
| **Twilio Standard** | `embeddedBooking/lexiAgentTwilio.ts` | `/api/booking` | Internal Supabase | ✅ Working |
| **Twilio Two-Agent** | `embeddedBooking/supervisorAgent.ts` | `/api/booking` | Internal Supabase | ✅ Working |
| **Retell** | `embeddedBooking/greetingAgentSTT.ts` | `/api/booking` | Internal Supabase | ✅ **Fixed** |
| **WhatsApp** | `embeddedBooking/lexiAgentWhatsApp.ts` | `/api/booking` | Internal Supabase | ✅ Working |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     ALL CHANNELS                             │
│  (Web Chat, Twilio, Retell, WhatsApp, etc.)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ All call same API
                      ↓
          ┌───────────────────────┐
          │   /api/booking        │  ← CENTRAL BOOKING API
          │   route.ts            │
          └───────────┬───────────┘
                      │
          ┌───────────┴──────────────────────────────┐
          │                                           │
          ↓                                           ↓
    [Validation]                              [Execution]
    - Auto-fill parameters                    - Org-scoped database
    - LLM extraction fallback                 - Multi-tenancy support
    - Dynamic operatory assignment            - Function handlers
    - Conversation state tracking             - External sync (optional)
```

---

## 🔧 Booking Functions (Identical Across All Channels)

All channels have access to the same booking functions:

### Patient Management
- `GetMultiplePatients(FName?, LName?, Phone?)` - Search patients
- `CreatePatient(FName, LName, Birthdate, WirelessPhone)` - Create new patient
- `UpdatePatient(PatNum, ...)` - Update patient info

### Appointment Management
- `GetAppointments(PatNum?, DateStart?, DateEnd?)` - List appointments
- `GetAvailableSlots(dateStart, dateEnd, ProvNum?, OpNum?)` - Check availability
- `CreateAppointment(PatNum, AptDateTime, ProvNum, Op, Note?)` - Book appointment
- `UpdateAppointment(AptNum, ...)` - Reschedule appointment
- `BreakAppointment(AptNum, Note?)` - Cancel appointment

### Office Management
- `GetProviders()` - List providers/doctors
- `GetOperatories()` - List rooms/operatories
- `GetProviderSchedules(ProvNum?, DateStart?, DateEnd?)` - Get provider availability

---

## 🎯 Dynamic Operatory Assignment (Multi-Org Support)

**Problem Solved:** No more hardcoded `Op=1` or `ProvNum=1`!

### How It Works:

1. **GetAvailableSlots** - Searches **ALL** providers and operatories
   ```typescript
   // Before (WRONG):
   GetAvailableSlots(dateStart, dateEnd, ProvNum: 1, OpNum: 1)
   
   // After (CORRECT):
   GetAvailableSlots(dateStart, dateEnd)
   // Searches ALL providers and ALL operatories for the organization
   ```

2. **CreateAppointment** - Auto-assigns operatory if missing
   ```typescript
   // If Op is missing, /api/booking automatically:
   SELECT id FROM operatories 
   WHERE organization_id = 'current_org' 
   AND is_active = true 
   ORDER BY id LIMIT 1
   
   // Each org gets their first active operatory
   // Org A → Op=14 (room1)
   // Org B → Op=22 (exam1)
   // Org C → Op=5 (hygiene1)
   ```

3. **ProvNum from Selected Slot**
   ```typescript
   // User selects: "9 AM with Dr. Smith"
   // System automatically uses:
   // - ProvNum from the selected slot
   // - Op auto-assigned per org
   ```

---

## 🔄 Conversation State Tracking

All channels benefit from unified conversation state management:

```typescript
// Stored in-memory per session
{
  patient: {
    patNum?: number;        // Set after CreatePatient or GetMultiplePatients
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthdate?: string;
  },
  appointment: {
    type?: string;          // "cleaning", "checkup", etc.
    preferredDate?: string; // "2026-01-27"
    preferredTime?: string; // "morning", "9 AM"
    selectedSlot?: {        // Set after user confirms a time
      dateTime: string;     // "2026-01-27 09:00:00"
      provNum: number;      // Provider ID
      opNum: number;        // Operatory ID
    }
  }
}
```

**Auto-fills subsequent function calls:**
- `CreateAppointment` auto-fills `PatNum`, `AptDateTime`, `ProvNum`, `Op`
- `GetAvailableSlots` auto-fills `dateStart`/`dateEnd` from preferred date
- `CreatePatient` auto-fills `FName`, `LName`, `Phone`, `Birthdate`

---

## 🚨 What Was Fixed

### Before (Jan 25, 2026):
- ❌ Retell used `/api/opendental` (external OpenDental API)
- ❌ Hardcoded `ProvNum=1` and `OpNum=1` in multiple files
- ❌ Op parameter missing from CreateAppointment
- ❌ Each org couldn't use their own providers/operatories

### After (Jan 26, 2026):
- ✅ **All channels use `/api/booking`** (internal database)
- ✅ **Dynamic operatory assignment** per organization
- ✅ **No hardcoded IDs** - searches all providers/operatories
- ✅ **Multi-org support** - each org uses their own data
- ✅ **Consistent logic** - one fix applies to all channels

---

## 📁 Key Files

### Channel Handlers
- `src/app/agentConfigs/embeddedBooking/lexiAgent.ts` - Web chat (realtime)
- `src/app/agentConfigs/embeddedBooking/lexiAgentTwilio.ts` - Twilio one-agent
- `src/app/agentConfigs/embeddedBooking/supervisorAgent.ts` - Twilio two-agent
- `src/app/agentConfigs/embeddedBooking/greetingAgentSTT.ts` - Retell/Twilio STT
- `src/app/agentConfigs/embeddedBooking/lexiAgentWhatsApp.ts` - WhatsApp

### Core Booking API
- `src/app/api/booking/route.ts` - Central booking API (all channels)
- `src/app/api/booking/functions/` - Individual function handlers
- `src/app/lib/conversationState.ts` - Conversation state management
- `src/app/lib/llmExtractor.ts` - LLM parameter extraction

### WebSocket Handlers
- `src/twilio/websocket-handler-standard.ts` - Twilio two-agent mode
- `src/twilio/websocket-handler.ts` - Twilio one-agent mode
- `src/retell/websocket-handler.ts` - Retell voice calls
- `src/app/lib/whatsapp/messageHandler.ts` - WhatsApp messages

---

## 🧪 Testing Multi-Org

Each organization should now work independently:

### Org A (sam.lateeff's Organization)
- ID: `b445a9c7-af93-4b4a-a975-40d3f44178ec`
- Providers: Mike Lee (ID=11), Sarah J (ID=12)
- Operatories: room1 (ID=14), room2 (ID=15)
- Auto-assigned Op: **14**

### Org B (Test Organization)
- ID: `different-uuid`
- Providers: (their own providers)
- Operatories: (their own operatories)
- Auto-assigned Op: **(their first active operatory ID)**

**Test:** Switch between orgs and book appointments - each should use their own providers/rooms!

---

## ⚠️ Deprecated API Route

**DO NOT USE:** `src/app/api/opendental/route.ts`

This route was for external OpenDental API integration and is now deprecated. All channels use `/api/booking` instead.

If you need to add external OpenDental support in the future, it should be an optional integration plugin, not the default booking system.

---

## 🎉 Benefits

1. **Single Source of Truth** - One API handles all channels
2. **Multi-Tenancy Ready** - Each org uses their own data
3. **Easy Maintenance** - Fix once, applies everywhere
4. **Consistent Behavior** - Same logic for web, phone, WhatsApp
5. **No Hardcoded Values** - Dynamic provider/operatory assignment
6. **Scalable** - Add new channels without duplicating logic

---

Last Updated: January 26, 2026
