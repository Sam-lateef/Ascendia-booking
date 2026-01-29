#!/usr/bin/env node
/**
 * Setup First Organization - Simple Version
 * Links your auth user to the default organization
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
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const defaultOrgId = '00000000-0000-0000-0000-000000000001';

async function setupUser(userEmail, orgName, orgSlug) {
  console.log('🚀 Setting up user account...\n');

  try {
    // Step 1: Find auth user
    console.log('1️⃣  Looking for user:', userEmail);
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      throw new Error(`Failed to list users: ${authError.message}`);
    }

    const authUser = authUsers.users.find(u => u.email === userEmail);
    
    if (!authUser) {
      console.log('\n❌ User not found!');
      console.log('\n📝 Please sign up first at: http://localhost:3000/signup');
      console.log('   Then run this script again.\n');
      process.exit(1);
    }

    console.log('   ✅ Found user:', authUser.id);

    // Step 2: Check if organization exists (should exist as default org)
    console.log('\n2️⃣  Checking organization...');
    let { data: org, error: orgError } = await supabase
      .from('organizations')
      .select()
      .eq('id', defaultOrgId)
      .single();

    if (orgError || !org) {
      console.log('   ⚠️  Default organization not found, creating...');
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          id: defaultOrgId,
          name: orgName || 'Default Organization',
          slug: orgSlug || 'default-org',
          plan: 'professional',
          status: 'active'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      org = newOrg;
      console.log('   ✅ Created organization');
    } else {
      console.log('   ✅ Using existing organization:', org.name);
    }

    // Step 3: Create user record
    console.log('\n3️⃣  Creating user record...');
    let user = null;
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUser.id,
        email: userEmail,
        first_name: userEmail.split('@')[0],
        last_name: 'User'
      })
      .select()
      .single();

    if (userError) {
      if (userError.code === '23505') {
        console.log('   ⚠️  User record already exists');
        const { data: existingUser } = await supabase
          .from('users')
          .select()
          .eq('auth_user_id', authUser.id)
          .single();
        user = existingUser;
      } else {
        throw userError;
      }
    } else {
      user = userData;
      console.log('   ✅ User record created');
    }

    // Step 4: Link to organization
    console.log('\n4️⃣  Linking user to organization...');
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .insert({
        user_id: user.id,
        organization_id: org.id,
        role: 'owner'
      })
      .select()
      .single();

    if (memberError) {
      if (memberError.code === '23505') {
        console.log('   ⚠️  Already linked');
      } else {
        throw memberError;
      }
    } else {
      console.log('   ✅ Linked successfully');
    }

    console.log('\n✅ Setup complete!\n');
    console.log('📋 Summary:');
    console.log(`   Email: ${userEmail}`);
    console.log(`   Organization: ${org.name}`);
    console.log(`   Role: owner`);
    console.log(`   Data: 58 patients, 6 providers, 52 appointments`);
    console.log('\n🎉 You can now log in at: http://localhost:3000/login\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.details) console.error('Details:', error.details);
    process.exit(1);
  }
}

// Get email from command line
const userEmail = process.argv[2];
const orgName = process.argv[3];
const orgSlug = process.argv[4];

if (!userEmail) {
  console.log('Usage: node scripts/setup-first-org-simple.js <your-email@example.com> [org-name] [org-slug]');
  console.log('\nExample:');
  console.log('  node scripts/setup-first-org-simple.js admin@clinic.com "My Clinic" "my-clinic"');
  console.log('\nNote: You must sign up at http://localhost:3000/signup FIRST!\n');
  process.exit(1);
}

setupUser(userEmail, orgName, orgSlug);
