#!/usr/bin/env node
/**
 * Check Retell instructions in the database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInstructions() {
  const orgId = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';
  
  console.log('\n🔍 Checking instructions for org:', orgId);
  console.log('='.repeat(80));
  
  // 1. Check channel_configurations
  console.log('\n1️⃣ CHANNEL CONFIGURATIONS (retell):');
  const { data: channelConfig, error: channelError } = await supabase
    .from('channel_configurations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('channel', 'retell')
    .single();
  
  if (channelError) {
    console.log('❌ Error or not found:', channelError.message);
  } else {
    console.log('✅ Found channel config:');
    console.log('   - enabled:', channelConfig.enabled);
    console.log('   - ai_backend:', channelConfig.ai_backend);
    console.log('   - instructions (legacy):', channelConfig.instructions ? `${channelConfig.instructions.length} chars` : 'NULL');
    console.log('   - one_agent_instructions:', channelConfig.one_agent_instructions ? `${channelConfig.one_agent_instructions.length} chars` : 'NULL');
    console.log('   - receptionist_instructions:', channelConfig.receptionist_instructions ? `${channelConfig.receptionist_instructions.length} chars` : 'NULL');
    console.log('   - supervisor_instructions:', channelConfig.supervisor_instructions ? `${channelConfig.supervisor_instructions.length} chars` : 'NULL');
    console.log('   - agent_mode:', channelConfig.settings?.agent_mode || 'not set');
    
    if (channelConfig.one_agent_instructions) {
      console.log('\n📝 One-agent instructions preview:');
      console.log(channelConfig.one_agent_instructions.substring(0, 300) + '...');
    }
    if (channelConfig.receptionist_instructions) {
      console.log('\n📝 Receptionist instructions preview:');
      console.log(channelConfig.receptionist_instructions.substring(0, 300) + '...');
    }
  }
  
  // 2. Check agent_configurations (global)
  console.log('\n2️⃣ AGENT CONFIGURATIONS (global fallback):');
  const { data: agentConfig, error: agentError } = await supabase
    .from('agent_configurations')
    .select('*')
    .eq('organization_id', orgId)
    .single();
  
  if (agentError) {
    console.log('❌ Error or not found:', agentError.message);
  } else {
    console.log('✅ Found agent config:');
    console.log('   - manual_ai_instructions:', agentConfig.manual_ai_instructions ? `${agentConfig.manual_ai_instructions.length} chars` : 'NULL');
    console.log('   - booking_functions:', agentConfig.booking_functions ? 'present' : 'NULL');
    
    if (agentConfig.manual_ai_instructions) {
      console.log('\n📝 Manual instructions preview:');
      console.log(agentConfig.manual_ai_instructions.substring(0, 300) + '...');
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 CURRENT STATUS:');
  if (!channelConfig?.one_agent_instructions && !channelConfig?.receptionist_instructions) {
    console.log('   ⚠️  No Retell-specific instructions found!');
    console.log('   Using global fallback from agent_configurations table.');
    console.log('\n💡 TO FIX:');
    console.log('   1. Go to Admin Panel → Booking → Settings');
    console.log('   2. Find "Retell" channel configuration');
    console.log('   3. Add instructions in one_agent_instructions field');
    console.log('   4. Or use the Admin UI to configure channel-specific instructions');
  } else {
    console.log('   ✅ Retell-specific instructions are configured!');
  }
  console.log('\n');
}

checkInstructions().catch(console.error);
