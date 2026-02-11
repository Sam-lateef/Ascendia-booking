# Vapi Integration - Complete Implementation Guide

**Date:** 2026-02-04  
**Status:** ✅ Ready for Testing

---

## Overview

Vapi integration enables voice-based appointment booking through phone calls. Unlike Twilio/Retell, Vapi handles:
- ✅ WebSocket/audio streaming
- ✅ LLM conversation management
- ✅ Voice synthesis

**We only handle:** Function execution and response formatting.

---

## Architecture

```
User calls Vapi number
    ↓
Vapi LLM processes conversation
    ↓
LLM calls function (e.g., bookAppointment)
    ↓
POST → https://ascendia-booking.fly.dev/api/vapi/functions
    ↓
Our webhook:
  1. Extract assistantId from call
  2. Lookup organization from vapi_assistants table
  3. Map Vapi function → our booking function
  4. Execute with org context
  5. Format result (JSON or natural language)
    ↓
Return to Vapi → Vapi speaks to user
```

---

## Multi-Tenant Setup

Each organization gets its own Vapi assistant:

```
Organization 1 (Dental Clinic)
├── Assistant ID: asst_abc123
├── Phone: +1-555-0001
└── Instructions: Custom for dental clinic

Organization 2 (Medical Clinic)
├── Assistant ID: asst_def456
├── Phone: +1-555-0002
└── Instructions: Custom for medical clinic
```

---

## Files Created

### Backend
```
src/app/api/vapi/functions/route.ts       # Main webhook handler
src/app/lib/vapi/functionMapper.ts        # Maps Vapi → our functions
src/app/lib/vapi/responseFormatter.ts     # Formats results (JSON/natural)
```

### Database
```
supabase/migrations/060_vapi_assistants.sql  # Multi-tenant assistant mapping
```

### Scripts
```
scripts/create-vapi-assistant.js          # Automate assistant creation
```

---

## Setup Instructions

### Step 1: Apply Database Migration

```bash
# Run migration via Supabase Dashboard SQL Editor
# Or via CLI:
supabase migration up
```

**What it does:**
- Creates `vapi_assistants` table
- Adds RLS policies for multi-tenancy
- Updates `phone_numbers` table to support 'vapi' channel

### Step 2: Set Environment Variables

Add to `.env`:
```bash
# Vapi API credentials
VAPI_API_KEY=your-vapi-private-key-here

# Response format: 'json' or 'natural'
# 'json' = Let Vapi's LLM convert (simpler, default)
# 'natural' = Pre-formatted strings (more control)
VAPI_RESPONSE_FORMAT=json

# Base URL for webhooks (already set)
BASE_URL=https://ascendia-booking.fly.dev
```

Get your Vapi API key from: https://dashboard.vapi.ai/settings

### Step 3: Deploy Backend

```bash
# Deploy to Fly.io
fly deploy

# Or deploy to your hosting platform
# Make sure environment variables are set!
```

### Step 4: Create Vapi Assistant for Each Organization

**Option A: Using Script (Recommended)**

```bash
# Install dependencies
npm install

# Create assistant for organization
node scripts/create-vapi-assistant.js <org-id> --name "Sarah" --voice elevenlabs

# Example:
node scripts/create-vapi-assistant.js b445a9c7-af93-4b4a-a975-40d3f44178ec \
  --name "Sarah the Receptionist" \
  --voice elevenlabs
```

**What the script does:**
1. Fetches org details from database
2. Creates Vapi assistant via API
3. Configures all 5 functions
4. Stores mapping in `vapi_assistants` table
5. Returns assistant ID

**Option B: Manual Setup in Vapi Dashboard**

See section "Manual Vapi Dashboard Setup" below.

### Step 5: Purchase/Assign Phone Number

1. Go to Vapi Dashboard → Phone Numbers
2. Purchase a phone number
3. Assign it to the assistant
4. Update database with phone number:

```sql
UPDATE vapi_assistants 
SET phone_number = '+18504036622' 
WHERE assistant_id = 'asst_your_id_here';
```

### Step 6: Test

1. Call the Vapi phone number
2. Try booking an appointment
3. Check admin UI for conversation record
4. Verify appointment created in database

---

## Function Definitions

### 1. checkAvailability

**Purpose:** Check available appointment slots  
**Maps to:** `GetAvailableSlots`

```json
{
  "type": "function",
  "async": false,
  "function": {
    "name": "checkAvailability",
    "description": "Check available appointment slots for a specific date and optionally a specific doctor",
    "parameters": {
      "type": "object",
      "properties": {
        "date": {
          "type": "string",
          "description": "Appointment date in YYYY-MM-DD format (e.g., 2026-02-10)"
        },
        "doctorId": {
          "type": "string",
          "description": "Provider/Doctor ID if patient requests specific doctor. Optional."
        }
      },
      "required": ["date"]
    }
  },
  "server": {
    "url": "https://ascendia-booking.fly.dev/api/vapi/functions"
  }
}
```

### 2. findPatient

**Purpose:** Find existing patient by phone  
**Maps to:** `GetMultiplePatients`

```json
{
  "type": "function",
  "async": false,
  "function": {
    "name": "findPatient",
    "description": "Search for an existing patient using their phone number",
    "parameters": {
      "type": "object",
      "properties": {
        "phone": {
          "type": "string",
          "description": "Patient's 10-digit phone number (e.g., 6195551234)"
        }
      },
      "required": ["phone"]
    }
  },
  "server": {
    "url": "https://ascendia-booking.fly.dev/api/vapi/functions"
  }
}
```

### 3. createPatient

**Purpose:** Create new patient profile  
**Maps to:** `CreatePatient`

```json
{
  "type": "function",
  "async": false,
  "function": {
    "name": "createPatient",
    "description": "Create a new patient profile. Collect ALL required information before calling.",
    "parameters": {
      "type": "object",
      "properties": {
        "firstName": {
          "type": "string",
          "description": "Patient's first name"
        },
        "lastName": {
          "type": "string",
          "description": "Patient's last name"
        },
        "phone": {
          "type": "string",
          "description": "Patient's 10-digit phone number"
        },
        "birthdate": {
          "type": "string",
          "description": "Date of birth in YYYY-MM-DD format (e.g., 1990-05-15)"
        },
        "email": {
          "type": "string",
          "description": "Patient's email address. Optional."
        }
      },
      "required": ["firstName", "lastName", "phone", "birthdate"]
    }
  },
  "server": {
    "url": "https://ascendia-booking.fly.dev/api/vapi/functions"
  }
}
```

### 4. bookAppointment

**Purpose:** Book an appointment  
**Maps to:** `CreateAppointment`

```json
{
  "type": "function",
  "async": false,
  "function": {
    "name": "bookAppointment",
    "description": "Book an appointment. ONLY call after patient is found/created and time is selected.",
    "parameters": {
      "type": "object",
      "properties": {
        "patientId": {
          "type": "string",
          "description": "Patient ID from findPatient or createPatient result"
        },
        "date": {
          "type": "string",
          "description": "Appointment date in YYYY-MM-DD format"
        },
        "time": {
          "type": "string",
          "description": "Appointment time in HH:mm:ss format (24-hour, e.g., 14:30:00)"
        },
        "doctorId": {
          "type": "string",
          "description": "Doctor/Provider ID. Optional."
        },
        "appointmentType": {
          "type": "string",
          "description": "Type of appointment (Cleaning, Checkup, Emergency, etc). Optional."
        }
      },
      "required": ["patientId", "date", "time"]
    }
  },
  "server": {
    "url": "https://ascendia-booking.fly.dev/api/vapi/functions"
  }
}
```

### 5. cancelAppointment

**Purpose:** Cancel an appointment  
**Maps to:** `BreakAppointment`

```json
{
  "type": "function",
  "async": false,
  "function": {
    "name": "cancelAppointment",
    "description": "Cancel an existing appointment",
    "parameters": {
      "type": "object",
      "properties": {
        "appointmentId": {
          "type": "string",
          "description": "The appointment ID to cancel"
        },
        "patientPhone": {
          "type": "string",
          "description": "Patient's phone number for verification"
        }
      },
      "required": ["appointmentId", "patientPhone"]
    }
  },
  "server": {
    "url": "https://ascendia-booking.fly.dev/api/vapi/functions"
  }
}
```

---

## Manual Vapi Dashboard Setup

If you prefer to create assistants manually:

### Step 1: Create Assistant

1. Go to https://dashboard.vapi.ai/assistants
2. Click "Create Assistant"
3. Name: "{Organization Name} Booking Agent"
4. Model: GPT-4
5. Voice: ElevenLabs (Rachel recommended)

### Step 2: System Prompt

Paste this into the system prompt field (customize for your org):

```
You are a friendly and professional receptionist at [ORGANIZATION NAME]. Your job is to help patients book, reschedule, and cancel appointments over the phone.

BOOKING WORKFLOW:
1. Greet the patient warmly
2. Ask if they're a new or existing patient
3. For existing patients: Get their phone number and use findPatient function
4. For new patients: Collect first name, last name, phone (10 digits), and birthdate (YYYY-MM-DD format)
   - Then use createPatient function
5. Ask what type of appointment they need
6. Ask for preferred date
7. Use checkAvailability function to get available slots
8. Present 2-3 available times clearly
9. Once patient chooses, use bookAppointment function
10. Confirm all details

IMPORTANT RULES:
- Always collect ALL required information before calling functions
- Phone numbers must be exactly 10 digits
- Birthdates must be in YYYY-MM-DD format
- When showing times, always specify AM/PM
- Be empathetic about emergencies
- If a slot is unavailable, offer alternatives
- Speak naturally - don't mention function names
- After booking, always confirm details back to the patient

CANCELLATIONS:
- Ask for appointment ID and phone number
- Use cancelAppointment function
- Confirm cancellation

MULTI-LANGUAGE:
- Respond in the language the patient uses
- Support English, Arabic, and Turkish
```

### Step 3: Add Functions

Click "Add Tool" for each function and paste the JSON from the "Function Definitions" section above.

### Step 4: Configure Server URL

In Assistant settings → Server URL:
```
https://ascendia-booking.fly.dev/api/vapi/functions
```

### Step 5: Add to Database

After creating the assistant, add the mapping manually:

```sql
INSERT INTO vapi_assistants (
  organization_id,
  assistant_id,
  assistant_name,
  voice_provider,
  is_active
) VALUES (
  'your-org-id-here',
  'asst_id_from_vapi',
  'Sarah the Receptionist',
  'elevenlabs',
  true
);
```

---

## Response Format Configuration

You can toggle between two response modes:

### Mode 1: JSON (Default)
**Set:** `VAPI_RESPONSE_FORMAT=json`

**How it works:** Return raw JSON, let Vapi's LLM convert to speech

**Example response:**
```json
{
  "slots": 3,
  "times": ["10:00 AM", "2:30 PM", "4:00 PM"]
}
```

**Pros:** Simpler, faster, less code  
**Cons:** Less control over what agent says

### Mode 2: Natural Language
**Set:** `VAPI_RESPONSE_FORMAT=natural`

**How it works:** Pre-format as natural language strings

**Example response:**
```
"I found 3 available appointments: 10:00 AM with Dr. Smith, 2:30 PM with Dr. Jones, and 4:00 PM with Dr. Smith. Which time works best for you?"
```

**Pros:** Full control over agent speech  
**Cons:** Requires more formatting code

**Recommendation:** Start with JSON, switch to natural if needed.

---

## Testing

### Local Testing (ngrok required)

```bash
# Start local server
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Update Vapi assistant webhook URL to ngrok URL
# Test by calling Vapi number
```

### Production Testing

1. Deploy to Fly.io
2. Call Vapi phone number
3. Try booking workflow
4. Check logs: `fly logs`
5. Check admin UI for conversation

---

## Troubleshooting

### Functions not being called

**Check:**
1. Webhook URL is correct in Vapi dashboard
2. Server is deployed and running
3. VAPI_API_KEY is set
4. Assistant exists in database

**Debug:**
```bash
# Check webhook endpoint
curl https://ascendia-booking.fly.dev/api/vapi/functions

# Should return: {"status": "ok", ...}
```

### Wrong organization

**Check:**
1. Assistant ID exists in `vapi_assistants` table
2. Organization ID is correct
3. Assistant is marked as `is_active = true`

**Query:**
```sql
SELECT * FROM vapi_assistants WHERE assistant_id = 'asst_your_id';
```

### Agent not speaking results well (JSON mode)

**Solution:** Switch to natural language mode:
```bash
# Set in .env
VAPI_RESPONSE_FORMAT=natural

# Redeploy
fly deploy
```

### Logs

```bash
# View Fly.io logs
fly logs

# Filter for Vapi
fly logs | grep "VAPI"

# Follow in real-time
fly logs -f
```

---

## Database Schema

### vapi_assistants table

```sql
CREATE TABLE vapi_assistants (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  assistant_id TEXT UNIQUE,        -- Vapi's assistant ID
  phone_number TEXT,                -- Vapi phone number
  assistant_name TEXT,              -- Display name
  voice_provider TEXT,              -- elevenlabs, azure
  voice_id TEXT,                    -- Voice identifier
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## API Endpoints

### POST /api/vapi/functions
**Purpose:** Webhook for Vapi function calls

**Request:**
```json
{
  "message": {
    "type": "tool-calls",
    "toolCallList": [{
      "id": "call-123",
      "function": {
        "name": "checkAvailability",
        "arguments": {"date": "2026-02-10"}
      }
    }],
    "call": {
      "id": "call-456",
      "assistantId": "asst_abc123"
    }
  }
}
```

**Response:**
```json
{
  "results": [{
    "toolCallId": "call-123",
    "result": "I found 3 available slots..."
  }]
}
```

### GET /api/vapi/functions
**Purpose:** Health check

**Response:**
```json
{
  "status": "ok",
  "service": "Vapi Function Webhook",
  "supportedFunctions": ["checkAvailability", "findPatient", ...]
}
```

---

## Success Criteria

- ✅ User can call Vapi number
- ✅ Agent greets and asks for patient info
- ✅ Agent finds/creates patient
- ✅ Agent checks availability
- ✅ Agent books appointment
- ✅ Conversation logged in admin UI
- ✅ Multi-tenant isolation working
- ✅ No errors in logs

---

## Next Steps

1. ✅ Apply migration: `060_vapi_assistants.sql`
2. ✅ Set `VAPI_API_KEY` in environment
3. ✅ Deploy backend to Fly.io
4. 🔲 Create first Vapi assistant (run script)
5. 🔲 Purchase phone number in Vapi
6. 🔲 Test end-to-end booking
7. 🔲 Create assistants for other organizations
8. 🔲 Monitor and optimize

---

## Resources

- **Vapi Dashboard:** https://dashboard.vapi.ai
- **Vapi Docs:** https://docs.vapi.ai
- **Vapi API Reference:** https://docs.vapi.ai/api-reference

---

## Support

For issues:
1. Check logs: `fly logs`
2. Test webhook: `curl https://your-domain.com/api/vapi/functions`
3. Verify database: Check `vapi_assistants` table
4. Check Vapi dashboard for call logs
