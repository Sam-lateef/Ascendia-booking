#!/usr/bin/env node
/**
 * Link Existing Data to Default Organization
 * Simpler version that loads .env manually
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        value = value.replace(/^["']|["']$/g, '');
        env[key] = value;
      }
    }
  });
  
  return env;
}

const env = loadEnv();

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

console.log('🔍 Checking credentials...');
console.log('URL:', supabaseUrl ? '✅ Found' : '❌ Not found');
console.log('Service Key:', supabaseServiceKey ? '✅ Found' : '❌ Not found');
console.log('');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERROR: Missing Supabase credentials in .env file');
  console.error('\nExpected one of these in .env:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co');
  console.error('  SUPABASE_URL=https://xxx.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function linkDataToDefaultOrg() {
  console.log('🚀 Linking existing data to default organization...\n');

  const defaultOrgId = '00000000-0000-0000-0000-000000000001'; // Proper UUID format

  try {
    // Step 1: Create default organization
    console.log('1️⃣  Creating default organization...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .upsert({
        id: defaultOrgId,
        name: 'Default Organization',
        slug: 'default-org',
        plan: 'professional',
        status: 'active'
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (orgError && orgError.code !== '23505') {
      console.error('   ❌ Error:', orgError.message);
      throw orgError;
    }
    console.log('   ✅ Default organization ready\n');

    // Step 2: Update all tables
    const tables = [
      'patients',
      'providers',
      'operatories',
      'schedules',
      'appointments',
      'treatment_plans',
      'treatment_plan_items',
      'treatments_catalog',
      'agent_instructions',
      'agent_modes',
      'whatsapp_instances',
      'whatsapp_conversations',
      'whatsapp_messages'
    ];

    console.log('2️⃣  Linking existing data...\n');
    
    for (const table of tables) {
      try {
        process.stdout.write(`   ${table}... `);
        
        const { error: updateError } = await supabase
          .from(table)
          .update({ organization_id: defaultOrgId })
          .is('organization_id', null);

        if (updateError) {
          console.log(`⚠️  ${updateError.message}`);
        } else {
          const { count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', defaultOrgId);
          console.log(`✅ ${count || 0} records`);
        }
      } catch (err) {
        console.log(`⚠️  Skipped (${err.message})`);
      }
    }

    console.log('\n3️⃣  Verifying...');
    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', defaultOrgId)
      .single();

    if (orgData) {
      console.log(`   ✅ Organization: ${orgData.name}`);
      console.log(`   ✅ Slug: ${orgData.slug}`);
      console.log(`   ✅ Status: ${orgData.status}\n`);
    }

    console.log('🎉 SUCCESS! All existing data is now linked to the default organization!\n');
    console.log('📋 Next steps:');
    console.log('   1. Go to http://localhost:3000/signup');
    console.log('   2. Create your account');
    console.log('   3. Run: node scripts/setup-first-org.js your@email.com');
    console.log('   4. Log in and see all your data!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

// Run
linkDataToDefaultOrg();
