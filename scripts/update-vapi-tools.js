/**
 * Update Vapi Assistant Tools to EXACT API Names
 * 
 * This script updates an existing Vapi assistant's tools to use EXACT function names
 * that match your booking API (GetAvailableSlots, ProvNum, etc.)
 * 
 * Usage:
 *   node scripts/update-vapi-tools.js <assistant-id>
 * 
 * Example:
 *   node scripts/update-vapi-tools.js asst_abc123xyz
 */

require('dotenv').config();

// Configuration
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_API_URL = 'https://api.vapi.ai';
const BASE_SERVER_URL = process.env.BASE_URL || 'https://ascendia-booking.fly.dev';

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_API_KEY not set in .env');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const assistantId = args[0];

if (!assistantId) {
  console.error('❌ Usage: node update-vapi-tools.js <assistant-id>');
  console.error('   Example: node update-vapi-tools.js asst_abc123xyz');
  process.exit(1);
}

// Vapi function definitions - EXACT MATCH with booking API
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
  console.log('\n🔧 Updating Vapi Assistant Tools');
  console.log('='.repeat(60));
  console.log(`Assistant ID: ${assistantId}`);
  console.log(`Server URL: ${BASE_SERVER_URL}/api/vapi/functions`);
  console.log('='.repeat(60) + '\n');

  try {
    // 1. Get current assistant
    console.log('📋 Fetching current assistant...');
    const getResponse = await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`
      }
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      throw new Error(`Failed to fetch assistant (${getResponse.status}): ${errorText}`);
    }

    const assistant = await getResponse.json();
    console.log(`✓ Found: ${assistant.name}`);
    console.log(`  Current tools: ${assistant.model?.tools?.length || 0}`);

    // 2. Update assistant with new tools
    console.log('\n🔄 Updating tools to EXACT API names...');
    
    const updatePayload = {
      model: {
        ...assistant.model,
        tools: VAPI_TOOLS
      }
    };

    const updateResponse = await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update assistant (${updateResponse.status}): ${errorText}`);
    }

    const updatedAssistant = await updateResponse.json();
    console.log(`✓ Tools updated successfully`);

    // 3. Success summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS! Tools updated with EXACT API names');
    console.log('='.repeat(60));
    console.log(`\nAssistant: ${updatedAssistant.name}`);
    console.log(`Tools (${VAPI_TOOLS.length}):`);
    VAPI_TOOLS.forEach((tool, i) => {
      console.log(`  ${i + 1}. ${tool.function.name}`);
    });
    console.log('\nNext Steps:');
    console.log('1. Update system prompt in Vapi Dashboard with: tmp/vapi-instructions-EXACT-names.txt');
    console.log('2. Test by calling your phone number');
    console.log('3. Check logs: fly logs -f');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
