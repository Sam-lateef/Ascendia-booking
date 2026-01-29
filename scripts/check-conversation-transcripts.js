#!/usr/bin/env node
/**
 * Check conversation transcripts in the database
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

async function checkTranscripts() {
  const orgId = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';
  
  console.log('\n🔍 Checking recent conversations for org:', orgId);
  console.log('='.repeat(80));
  
  // Get last 5 conversations
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (!conversations || conversations.length === 0) {
    console.log('⚠️  No conversations found');
    return;
  }
  
  console.log(`\n✅ Found ${conversations.length} recent conversation(s):\n`);
  
  conversations.forEach((conv, i) => {
    console.log(`${i + 1}. Conversation ID: ${conv.id}`);
    console.log(`   Session ID: ${conv.session_id}`);
    console.log(`   Channel: ${conv.channel || 'N/A'}`);
    console.log(`   Created: ${new Date(conv.created_at).toLocaleString()}`);
    console.log(`   Patient Name: ${conv.patient_name || 'N/A'}`);
    console.log(`   Patient ID: ${conv.patient_id || 'N/A'}`);
    console.log(`   Status: ${conv.call_status || 'N/A'}`);
    
    // Check transcript-related fields
    console.log('\n   📝 TRANSCRIPT DATA:');
    console.log(`   - transcript: ${conv.transcript ? `${conv.transcript.length} chars` : 'NULL'}`);
    console.log(`   - messages: ${conv.messages ? `${JSON.stringify(conv.messages).length} chars (${Array.isArray(conv.messages) ? conv.messages.length : 'not array'} messages)` : 'NULL'}`);
    console.log(`   - conversation_history: ${conv.conversation_history ? `${JSON.stringify(conv.conversation_history).length} chars` : 'NULL'}`);
    console.log(`   - call_transcript: ${conv.call_transcript ? `${conv.call_transcript.length} chars` : 'NULL'}`);
    
    // Show transcript preview if available
    if (conv.transcript) {
      console.log(`\n   📄 Transcript preview:`);
      console.log(`   ${conv.transcript.substring(0, 200)}...`);
    } else if (conv.call_transcript) {
      console.log(`\n   📄 Call transcript preview:`);
      console.log(`   ${conv.call_transcript.substring(0, 200)}...`);
    } else if (conv.messages && Array.isArray(conv.messages) && conv.messages.length > 0) {
      console.log(`\n   📄 Messages preview:`);
      console.log(`   ${JSON.stringify(conv.messages.slice(0, 2), null, 2)}...`);
    } else {
      console.log(`\n   ⚠️  NO TRANSCRIPT DATA FOUND!`);
    }
    
    // Check other fields
    console.log(`\n   📊 OTHER DATA:`);
    console.log(`   - duration_ms: ${conv.duration_ms || 'NULL'}`);
    console.log(`   - disconnection_reason: ${conv.disconnection_reason || 'NULL'}`);
    console.log(`   - call_analysis: ${conv.call_analysis ? 'present' : 'NULL'}`);
    console.log(`   - recording_url: ${conv.recording_url || 'NULL'}`);
    console.log(`   - public_log_url: ${conv.public_log_url || 'NULL'}`);
    
    console.log('\n' + '-'.repeat(80) + '\n');
  });
}

checkTranscripts().catch(console.error);
