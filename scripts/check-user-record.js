#!/usr/bin/env node
/**
 * Check if user record exists for sam.lateef@outlook.com
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserRecord() {
  try {
    const targetEmail = 'sam.lateef@outlook.com';
    
    console.log(`🔍 Checking user record for: ${targetEmail}\n`);
    
    // Get auth user
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;
    
    const authUser = authUsers.users.find(u => u.email === targetEmail);
    if (!authUser) {
      console.log('❌ Auth user not found');
      return;
    }
    
    console.log('✅ Auth user exists:');
    console.log(`   ID: ${authUser.id}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}\n`);
    
    // Check users table
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();
    
    if (userError || !userRecord) {
      console.log('❌ User record NOT found in users table');
      console.log('   This is the problem! User needs to be created in users table.\n');
      return { authUser, userRecord: null };
    }
    
    console.log('✅ User record exists:');
    console.log(`   ID: ${userRecord.id}`);
    console.log(`   Name: ${userRecord.name || 'N/A'}`);
    console.log(`   Email: ${userRecord.email}\n`);
    
    // Check organization memberships
    const { data: memberships, error: membershipsError } = await supabase
      .from('organization_members')
      .select(`
        id,
        role,
        status,
        organization:organizations (
          id,
          name,
          slug
        )
      `)
      .eq('user_id', userRecord.id);
    
    if (membershipsError) throw membershipsError;
    
    if (!memberships || memberships.length === 0) {
      console.log('❌ No organization memberships found');
      console.log('   User needs to be linked to an organization.\n');
      return { authUser, userRecord, memberships: [] };
    }
    
    console.log(`✅ Organization memberships: ${memberships.length}`);
    memberships.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.organization.name} (${m.role}, ${m.status})`);
    });
    
    return { authUser, userRecord, memberships };
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUserRecord().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
});
