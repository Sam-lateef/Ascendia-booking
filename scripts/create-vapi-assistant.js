/**
 * Create Vapi Assistant for Organization
 * 
 * This script creates a Vapi assistant via the Vapi API and stores the mapping
 * in the vapi_assistants table.
 * 
 * Usage:
 *   node scripts/create-vapi-assistant.js <org-id> [options]
 * 
 * Options:
 *   --name "Assistant Name"
 *   --voice elevenlabs|azure
 *   --voice-id "voice-id"
 * 
 * Example:
 *   node scripts/create-vapi-assistant.js b445a9c7-af93-4b4a-a975-40d3f44178ec \
 *     --name "Sarah" \
 *     --voice elevenlabs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuration
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_API_URL = 'https://api.vapi.ai';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Base server URL for webhooks
const BASE_SERVER_URL = process.env.BASE_URL || 'https://ascendia-booking.fly.dev';

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_API_KEY not set in .env');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase credentials not set in .env');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const orgId = args[0];

if (!orgId) {
  console.error('❌ Usage: node create-vapi-assistant.js <org-id> [--name "Name"] [--voice provider]');
  process.exit(1);
}

// Parse options
const options = {
  name: null,
  voice: '11labs', // Vapi uses '11labs' not 'elevenlabs'
  voiceId: null
};

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--name' && args[i + 1]) {
    options.name = args[i + 1];
    i++;
  } else if (args[i] === '--voice' && args[i + 1]) {
    options.voice = args[i + 1];
    i++;
  } else if (args[i] === '--voice-id' && args[i + 1]) {
    options.voiceId = args[i + 1];
    i++;
  }
}

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Vapi function definitions - EXACT MATCH with booking API (same for all assistants)
const VAPI_TOOLS = [
  {
    type: 'function',
    async: false,
    function: {
      name: 'GetAvailableSlots',
      strict: true,
      description: 'Get available appointment slots. Returns slots with ProvNum, OpNum, DateTimeStart, ProviderName.',
      parameters: {
        type: 'object',
        properties: {
          dateStart: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format (e.g., 2026-02-10). REQUIRED.'
          },
          dateEnd: {
            type: 'string',
            description: 'End date in YYYY-MM-DD format (e.g., 2026-02-10). REQUIRED.'
          },
          ProvNum: {
            type: 'number',
            description: 'Provider/Doctor ID to filter by. Optional - leave empty to search all providers.'
          },
          OpNum: {
            type: 'number',
            description: 'Operatory/Room ID. Optional - leave empty to search all rooms.'
          }
        },
        required: ['dateStart', 'dateEnd']
      }
    },
    server: {
      url: `${BASE_SERVER_URL}/api/vapi/functions`
    }
  },
  {
    type: 'function',
    async: false,
    function: {
      name: 'GetMultiplePatients',
      strict: true,
      description: 'Search for patients by phone number. Returns array of patients with PatNum, FName, LName.',
      parameters: {
        type: 'object',
        properties: {
          Phone: {
            type: 'string',
            description: "Patient's 10-digit phone number (e.g., 6195551234). REQUIRED."
          }
        },
        required: ['Phone']
      }
    },
    server: {
      url: `${BASE_SERVER_URL}/api/vapi/functions`
    }
  },
  {
    type: 'function',
    async: false,
    function: {
      name: 'CreatePatient',
      strict: true,
      description: 'Create new patient profile. Returns patient with PatNum.',
      parameters: {
        type: 'object',
        properties: {
          FName: { type: 'string', description: "Patient's first name. REQUIRED." },
          LName: { type: 'string', description: "Patient's last name. REQUIRED." },
          WirelessPhone: { type: 'string', description: "Patient's 10-digit phone number (e.g., 6195551234). REQUIRED." },
          Birthdate: { type: 'string', description: 'Date of birth in YYYY-MM-DD format (e.g., 1990-05-15). REQUIRED.' },
          Email: { type: 'string', description: "Patient's email address. Optional." }
        },
        required: ['FName', 'LName', 'WirelessPhone', 'Birthdate']
      }
    },
    server: {
      url: `${BASE_SERVER_URL}/api/vapi/functions`
    }
  },
  {
    type: 'function',
    async: false,
    function: {
      name: 'CreateAppointment',
      strict: true,
      description: 'Book an appointment. Use PatNum from patient lookup, ProvNum and OpNum from the slot returned by GetAvailableSlots.',
      parameters: {
        type: 'object',
        properties: {
          PatNum: { type: 'number', description: 'Patient ID from GetMultiplePatients or CreatePatient. REQUIRED.' },
          AptDateTime: { type: 'string', description: 'Appointment datetime in YYYY-MM-DD HH:mm:ss format (e.g., 2026-02-10 14:30:00). REQUIRED.' },
          ProvNum: { type: 'number', description: 'Provider ID from the slot returned by GetAvailableSlots. REQUIRED.' },
          Op: { type: 'number', description: 'Operatory/Room ID from the slot (OpNum field). Optional - will auto-assign if not provided.' },
          Note: { type: 'string', description: 'Appointment type or notes (e.g., "Cleaning", "Checkup"). Optional.' }
        },
        required: ['PatNum', 'AptDateTime', 'ProvNum']
      }
    },
    server: {
      url: `${BASE_SERVER_URL}/api/vapi/functions`
    }
  },
  {
    type: 'function',
    async: false,
    function: {
      name: 'BreakAppointment',
      strict: true,
      description: 'Cancel an appointment.',
      parameters: {
        type: 'object',
        properties: {
          AptNum: { type: 'number', description: 'Appointment ID to cancel. REQUIRED.' }
        },
        required: ['AptNum']
      }
    },
    server: {
      url: `${BASE_SERVER_URL}/api/vapi/functions`
    }
  }
];

async function main() {
  console.log('\n📞 Creating Vapi Assistant');
  console.log('='.repeat(60));
  console.log(`Organization ID: ${orgId}`);
  console.log(`Assistant Name: ${options.name || 'Auto-generated'}`);
  console.log(`Voice Provider: ${options.voice}`);
  console.log(`Server URL: ${BASE_SERVER_URL}/api/vapi/functions`);
  console.log('='.repeat(60) + '\n');

  try {
    // 1. Get organization details
    console.log('📋 Fetching organization details...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      throw new Error(`Organization not found: ${orgId}`);
    }

    console.log(`✓ Organization: ${org.name} (${org.slug})`);

    // 2. Generate assistant name
    const assistantName = options.name || `${org.name} Booking Agent`;

    // 3. Build system prompt
    const systemPrompt = `You are a friendly and professional receptionist at ${org.name}. Your job is to help patients book, reschedule, and cancel appointments over the phone.

CURRENT DATE & TIME:
Today: {{now | date: "%Y-%m-%d"}}
Day: {{now | date: "%A, %B %d, %Y"}}
Time: {{now | date: "%I:%M %p"}}

BOOKING WORKFLOW:
1. Greet the patient warmly
2. Ask if they're a new or existing patient
3. For existing patients: 
   - Get phone number (10 digits, no dashes)
   - Call GetMultiplePatients({ "Phone": "6195551234" })
   - Save PatNum from result
4. For new patients: 
   - Collect FName, LName, WirelessPhone (10 digits), Birthdate (YYYY-MM-DD)
   - Call CreatePatient({ "FName": "John", "LName": "Smith", "WirelessPhone": "6195551234", "Birthdate": "1990-05-15" })
   - Save PatNum from result
5. Ask what type of appointment they need (cleaning, checkup, emergency, etc.)
6. Ask for preferred date
7. Call GetAvailableSlots({ "dateStart": "2026-02-10", "dateEnd": "2026-02-10" })
   - This searches ALL doctors
   - Results include: DateTimeStart, ProvNum, OpNum, ProviderName
8. Present 2-3 available times with doctor names
9. Once patient chooses a slot:
   - Extract the EXACT values from that slot
   - Call CreateAppointment({
       "PatNum": (from patient lookup),
       "AptDateTime": "2026-02-10 14:30:00",
       "ProvNum": (from the slot),
       "Op": (OpNum from the slot),
       "Note": "Cleaning"
     })
10. Confirm all details: date, time, doctor name

CRITICAL - PARAMETER NAMES (use EXACTLY as shown):
- PatNum (not patientId)
- ProvNum (not doctorId)
- OpNum or Op (not roomId)
- FName, LName (not firstName, lastName)
- WirelessPhone (not phone)
- AptDateTime (not separate date + time)

IMPORTANT RULES:
- Always collect ALL required information before calling functions
- Phone numbers: 10 digits, no dashes (e.g., 6195551234)
- Birthdates: YYYY-MM-DD format (e.g., 1990-05-15)
- DateTime: YYYY-MM-DD HH:mm:ss (e.g., 2026-02-10 14:30:00)
- When showing times, always specify AM/PM
- Save PatNum from patient lookup - you'll need it for CreateAppointment
- Save ProvNum and OpNum from the slot - use them EXACTLY in CreateAppointment
- Speak naturally - don't mention function names or technical terms

CANCELLATIONS:
- Call BreakAppointment({ "AptNum": 123 })
- Confirm cancellation and ask if they want to reschedule

MULTI-LANGUAGE SUPPORT:
- Respond in the language the patient uses
- Support English, Arabic, and Turkish`;

    // 4. Create Vapi assistant via API
    console.log('\n🤖 Creating assistant in Vapi...');
    
    // Build voice config
    const voiceConfig = {
      provider: options.voice
    };
    
    // Set voiceId - use provided one, or default to 'tara' for 11labs
    if (options.voiceId) {
      voiceConfig.voiceId = options.voiceId;
    } else if (options.voice === '11labs') {
      voiceConfig.voiceId = 'tara'; // Vapi's default friendly female voice
    }
    
    const vapiPayload = {
      name: assistantName,
      model: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          }
        ],
        tools: VAPI_TOOLS
      },
      voice: voiceConfig,
      firstMessage: `Hello! Thank you for calling ${org.name}. How can I help you today?`,
      serverUrl: `${BASE_SERVER_URL}/api/vapi/functions`,
      serverMessages: ['status-update', 'end-of-call-report', 'tool-calls']
    };

    const vapiResponse = await fetch(`${VAPI_API_URL}/assistant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(vapiPayload)
    });

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      throw new Error(`Vapi API error (${vapiResponse.status}): ${errorText}`);
    }

    const assistant = await vapiResponse.json();
    console.log(`✓ Assistant created: ${assistant.id}`);
    console.log(`  Name: ${assistant.name}`);

    // 5. Store mapping in database
    console.log('\n💾 Storing assistant mapping in database...');
    
    const { data: mapping, error: mappingError } = await supabase
      .from('vapi_assistants')
      .insert({
        organization_id: orgId,
        assistant_id: assistant.id,
        assistant_name: assistantName,
        voice_provider: options.voice,
        voice_id: options.voiceId,
        is_active: true,
        metadata: {
          created_via: 'script',
          vapi_object: assistant
        }
      })
      .select()
      .single();

    if (mappingError) {
      throw new Error(`Failed to store mapping: ${mappingError.message}`);
    }

    console.log(`✓ Mapping stored in vapi_assistants table`);

    // 6. Success summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS! Assistant created and configured');
    console.log('='.repeat(60));
    console.log(`\nAssistant ID: ${assistant.id}`);
    console.log(`Organization: ${org.name}`);
    console.log(`Webhook URL: ${BASE_SERVER_URL}/api/vapi/functions`);
    console.log('\nNext Steps:');
    console.log('1. Go to Vapi Dashboard');
    console.log('2. Purchase/assign a phone number to this assistant');
    console.log('3. Test by calling the number');
    console.log('4. Update vapi_assistants table with phone number:');
    console.log(`   UPDATE vapi_assistants SET phone_number = '+1234567890' WHERE assistant_id = '${assistant.id}';`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
