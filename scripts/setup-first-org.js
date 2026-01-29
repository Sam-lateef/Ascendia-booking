#!/usr/bin/env node
/**
 * Setup Script: Create First Organization
 * 
 * This script creates:
 * 1. Your first organization
 * 2. Links it to your Supabase auth user
 * 
 * Usage:
 *   node scripts/setup-first-org.js <your-email@example.com>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERROR: Missing Supabase credentials');
  console.error('Please ensure these are set in your .env file:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupFirstOrganization(userEmail, orgName, orgSlug) {
  console.log('🚀 Setting up first organization...\n');

  try {
    // Step 1: Find the auth user
    console.log('1️⃣  Looking for auth user:', userEmail);
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      throw new Error(`Failed to list users: ${authError.message}`);
    }

    const authUser = authUsers.users.find(u => u.email === userEmail);
    
    if (!authUser) {
      console.log('❌ Auth user not found. Please sign up first at: http://localhost:3000/signup');
      console.log('\nAfter signing up, run this script again.');
      process.exit(1);
    }

    console.log('✅ Found auth user:', authUser.id);

    // Step 2: Create organization
    console.log('\n2️⃣  Creating organization:', orgName);
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        slug: orgSlug,
        plan: 'professional',
        status: 'active'
      })
      .select()
      .single();

    if (orgError) {
      if (orgError.code === '23505') {
        // Organization already exists, fetch it
        console.log('⚠️  Organization already exists, fetching...');
        const { data: existingOrg, error: fetchError } = await supabase
          .from('organizations')
          .select()
          .eq('slug', orgSlug)
          .single();
        
        if (fetchError) throw fetchError;
        console.log('✅ Using existing organization:', existingOrg.id);
        org = existingOrg;
      } else {
        throw new Error(`Failed to create organization: ${orgError.message}`);
      }
    } else {
      console.log('✅ Created organization:', org.id);
    }

    // Step 3: Create user record
    console.log('\n3️⃣  Creating user record...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUser.id,
        email: userEmail,
        first_name: userEmail.split('@')[0],
        last_name: 'Admin'
      })
      .select()
      .single();

    if (userError) {
      if (userError.code === '23505') {
        // User already exists, fetch it
        console.log('⚠️  User already exists, fetching...');
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select()
          .eq('auth_user_id', authUser.id)
          .single();
        
        if (fetchError) throw fetchError;
        console.log('✅ Using existing user:', existingUser.id);
        user = existingUser;
      } else {
        throw new Error(`Failed to create user: ${userError.message}`);
      }
    } else {
      console.log('✅ Created user:', user.id);
    }

    // Step 4: Link user to organization
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
        console.log('⚠️  User already linked to organization');
      } else {
        throw new Error(`Failed to link user to organization: ${memberError.message}`);
      }
    } else {
      console.log('✅ Linked user to organization');
    }

    // Success!
    console.log('\n✅ Setup complete!\n');
    console.log('📋 Summary:');
    console.log(`   Organization: ${org.name} (${org.slug})`);
    console.log(`   User: ${userEmail}`);
    console.log(`   Role: owner`);
    console.log('\n🎉 You can now log in at: http://localhost:3000/login\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

// Main
const userEmail = process.argv[2];
const orgName = process.argv[3] || 'Your Clinic';
const orgSlug = process.argv[4] || 'your-clinic';

if (!userEmail) {
  console.log('Usage: node scripts/setup-first-org.js <email> [org-name] [org-slug]');
  console.log('Example: node scripts/setup-first-org.js admin@clinic.com "My Dental Clinic" "my-clinic"');
  process.exit(1);
}

setupFirstOrganization(userEmail, orgName, orgSlug);
