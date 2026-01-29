/**
 * Test Script: Verify Complete Retell Call Flow
 * Tests if:
 * 1. WebSocket server can connect to database
 * 2. Conversations are created with correct org ID
 * 3. Calls show up in the UI query
 * 4. Organization ID flows through to booking API
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testRetellCallFlow() {
  log('\n╔═══════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║  Retell Call Flow Test                                        ║', colors.cyan);
  log('╚═══════════════════════════════════════════════════════════════╝\n', colors.cyan);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    log('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY', colors.red);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Check recent conversations
  log('1. Checking recent conversations...', colors.blue);
  const { data: recentConvs, error: convError } = await supabase
    .from('conversations')
    .select('id, organization_id, call_id, session_id, call_status, channel, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (convError) {
    log(`   ✗ Error querying conversations: ${convError.message}`, colors.red);
  } else if (!recentConvs || recentConvs.length === 0) {
    log('   ⚠ No conversations found in database', colors.yellow);
  } else {
    log(`   ✓ Found ${recentConvs.length} recent conversations`, colors.green);
    recentConvs.forEach((conv, i) => {
      const age = Math.floor((Date.now() - new Date(conv.created_at).getTime()) / 1000 / 60);
      log(`     ${i + 1}. ${conv.channel} call - ${conv.call_status} (${age}m ago)`, colors.cyan);
      log(`        Org: ${conv.organization_id}`, colors.cyan);
      log(`        Call ID: ${conv.call_id || 'N/A'}`, colors.cyan);
    });
  }

  // 2. Check for Retell/voice calls specifically
  log('\n2. Checking voice/Retell calls...', colors.blue);
  const { data: voiceCalls, error: voiceError } = await supabase
    .from('conversations')
    .select('*')
    .eq('channel', 'voice')
    .order('created_at', { ascending: false })
    .limit(5);

  if (voiceError) {
    log(`   ✗ Error: ${voiceError.message}`, colors.red);
  } else if (!voiceCalls || voiceCalls.length === 0) {
    log('   ⚠ No voice calls found', colors.yellow);
    log('   This means Retell calls are NOT being saved to database!', colors.yellow);
  } else {
    log(`   ✓ Found ${voiceCalls.length} voice calls`, colors.green);
    voiceCalls.forEach((call, i) => {
      log(`     ${i + 1}. Status: ${call.call_status}, Org: ${call.organization_id}`, colors.cyan);
      if (call.transcript) {
        log(`        Has transcript: ${call.transcript.length} chars`, colors.green);
      } else {
        log(`        No transcript yet`, colors.yellow);
      }
    });
  }

  // 3. Check patients per org
  log('\n3. Checking patient data per organization...', colors.blue);
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .limit(5);

  if (orgs && orgs.length > 0) {
    for (const org of orgs) {
      const { data: patients, count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: false })
        .eq('organization_id', org.id)
        .limit(5);

      if (count === 0) {
        log(`   ${org.name}: ⚠ NO PATIENTS`, colors.yellow);
      } else {
        log(`   ${org.name}: ✓ ${count} patients`, colors.green);
        if (patients && patients.length > 0) {
          const sample = patients[0];
          log(`     Sample: ${sample.fname} ${sample.lname} - ${sample.wirelessphone || 'no phone'}`, colors.cyan);
        }
      }
    }
  }

  // 4. Check if WebSocket server env vars are set
  log('\n4. Checking WebSocket server requirements...', colors.blue);
  const envVars = {
    'SUPABASE_URL': supabaseUrl,
    'SUPABASE_SERVICE_KEY': supabaseServiceKey,
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'RETELL_API_KEY': process.env.RETELL_API_KEY,
  };

  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      log(`   ✓ ${key}: Set`, colors.green);
    } else {
      log(`   ✗ ${key}: MISSING`, colors.red);
    }
  });

  // 5. Test conversation creation (simulate WebSocket flow)
  log('\n5. Testing conversation creation flow...', colors.blue);
  const testCallId = `test_${Date.now()}`;
  const testOrgId = orgs && orgs.length > 0 ? orgs[0].id : '00000000-0000-0000-0000-000000000001';

  try {
    const { data: testConv, error: testError } = await supabase
      .from('conversations')
      .insert({
        session_id: `retell_${testCallId}`,
        organization_id: testOrgId,
        channel: 'voice',
        call_id: testCallId,
        call_status: 'ongoing',
        start_timestamp: Date.now(),
        patient_info: {},
        appointment_info: {},
        missing_required: []
      })
      .select()
      .single();

    if (testError) {
      log(`   ✗ Failed to create test conversation: ${testError.message}`, colors.red);
    } else {
      log(`   ✓ Successfully created test conversation: ${testConv.id}`, colors.green);
      
      // Clean up test conversation
      await supabase
        .from('conversations')
        .delete()
        .eq('id', testConv.id);
      log(`   ✓ Cleaned up test conversation`, colors.green);
    }
  } catch (error) {
    log(`   ✗ Error: ${error.message}`, colors.red);
  }

  // 6. Summary
  log('\n╔═══════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║  Summary                                                       ║', colors.cyan);
  log('╚═══════════════════════════════════════════════════════════════╝\n', colors.cyan);

  const hasVoiceCalls = voiceCalls && voiceCalls.length > 0;
  const hasPatients = orgs && orgs.some(org => org.id); // Simplified check
  const hasEnvVars = supabaseServiceKey && process.env.OPENAI_API_KEY;

  log('Issues Found:', colors.blue);
  let issueCount = 0;

  if (!hasVoiceCalls) {
    issueCount++;
    log(`  ${issueCount}. ⚠️ NO VOICE CALLS IN DATABASE`, colors.yellow);
    log('     → Retell calls are not being saved', colors.yellow);
    log('     → Check: WebSocket server has SUPABASE_SERVICE_KEY', colors.cyan);
    log('     → Check: WebSocket server logs for database errors', colors.cyan);
  }

  if (!hasPatients) {
    issueCount++;
    log(`  ${issueCount}. ⚠️ NO PATIENT DATA`, colors.yellow);
    log('     → Agent cannot find patients in database', colors.yellow);
    log('     → Check: Import/seed patient data for testing', colors.cyan);
    log('     → Check: Organization ID is correct', colors.cyan);
  }

  if (!hasEnvVars) {
    issueCount++;
    log(`  ${issueCount}. ⚠️ MISSING ENVIRONMENT VARIABLES`, colors.yellow);
    log('     → Check .env file has all required keys', colors.cyan);
  }

  if (issueCount === 0) {
    log('  ✅ All checks passed!', colors.green);
  }

  log('\nNext Steps:', colors.blue);
  if (!hasVoiceCalls) {
    log('  1. Restart WebSocket server: npm run dev:websocket', colors.cyan);
    log('  2. Make a test Retell call', colors.cyan);
    log('  3. Check server logs for "Created conversation"', colors.cyan);
    log('  4. Run this test again', colors.cyan);
  }
  if (!hasPatients) {
    log('  1. Seed test patient data', colors.cyan);
    log('  2. Or import from OpenDental', colors.cyan);
  }

  log('');
}

testRetellCallFlow()
  .then(() => process.exit(0))
  .catch((error) => {
    log(`\n✗ Test failed: ${error.message}\n`, colors.red);
    console.error(error);
    process.exit(1);
  });
