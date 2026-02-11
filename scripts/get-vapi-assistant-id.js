/**
 * Get Vapi Assistant ID from Organization
 * 
 * This helps you find the assistant ID to use as master template
 * 
 * Usage:
 *   node scripts/get-vapi-assistant-id.js <org-id>
 * 
 * Example:
 *   node scripts/get-vapi-assistant-id.js b445a9c7-af93-4b4a-a975-40d3f44178ec
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const orgId = process.argv[2];

if (!orgId) {
  console.error('❌ Usage: node get-vapi-assistant-id.js <org-id>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getAssistantId() {
  console.log('🔍 Looking for Vapi assistants in org:', orgId);
  console.log('');
  
  const { data, error } = await supabase
    .from('vapi_assistants')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️  No Vapi assistants found for this organization');
    console.log('');
    console.log('💡 Create one first in Vapi Dashboard, then run this script again');
    process.exit(0);
  }
  
  console.log(`✅ Found ${data.length} assistant(s):`);
  console.log('');
  
  data.forEach((assistant, index) => {
    console.log(`${index + 1}. ${assistant.assistant_name || 'Unnamed'}`);
    console.log(`   ID: ${assistant.assistant_id}`);
    console.log(`   Phone: ${assistant.phone_number || 'None'}`);
    console.log(`   Created: ${new Date(assistant.created_at).toLocaleString()}`);
    console.log(`   Active: ${assistant.is_active ? '✅' : '❌'}`);
    console.log('');
  });
  
  const newestAssistant = data[0];
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('📋 To use the newest assistant as master template:');
  console.log('');
  console.log('1. Add to your .env file:');
  console.log(`   VAPI_MASTER_TEMPLATE_ASSISTANT_ID=${newestAssistant.assistant_id}`);
  console.log('');
  console.log('2. Or set on Fly.io:');
  console.log(`   fly secrets set VAPI_MASTER_TEMPLATE_ASSISTANT_ID=${newestAssistant.assistant_id}`);
  console.log('');
  console.log('3. Deploy:');
  console.log('   fly deploy');
  console.log('═══════════════════════════════════════════════════════');
}

getAssistantId();
