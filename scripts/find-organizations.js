#!/usr/bin/env node
/**
 * Find All Organizations
 * 
 * Lists all organizations in your database so you can choose which one
 * to assign your Twilio phone number to.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env
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
        value = value.split('#')[0].trim();
        value = value.replace(/^["']|["']$/g, '');
        env[key] = value;
      }
    }
  });
  
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

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

async function findOrganizations() {
  console.log('🔍 Finding all organizations...\n');
  console.log('='.repeat(70));
  
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, slug, status, created_at')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    if (!orgs || orgs.length === 0) {
      console.log('⚠️  No organizations found!');
      console.log('   Create one first at: http://localhost:3000/admin/settings');
      return;
    }
    
    console.log(`\nFound ${orgs.length} organization(s):\n`);
    
    orgs.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name}`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Slug: ${org.slug}`);
      console.log(`   Status: ${org.status}`);
      console.log(`   Created: ${new Date(org.created_at).toLocaleDateString()}`);
      console.log('');
    });
    
    console.log('='.repeat(70));
    console.log('\n📋 To assign Twilio number to an organization:\n');
    console.log('Option A - Update SQL file:');
    console.log('  1. Copy the org ID from above');
    console.log('  2. Edit: scripts/create-phone-numbers-table.sql');
    console.log('  3. Replace: 00000000-0000-0000-0000-000000000001');
    console.log('  4. With your org ID');
    console.log('  5. Run in Supabase Dashboard\n');
    
    console.log('Option B - Run update script:');
    console.log('  node scripts/update-phone-org.js YOUR_ORG_ID\n');
    
    // Check current phone number assignments
    console.log('📞 Current phone number assignments:\n');
    
    const { data: phones, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('phone_number, organization_id, channel, is_active')
      .order('created_at', { ascending: true });
    
    if (phoneError) {
      console.log('   No phone numbers assigned yet');
    } else if (!phones || phones.length === 0) {
      console.log('   No phone numbers assigned yet');
    } else {
      phones.forEach(phone => {
        const org = orgs.find(o => o.id === phone.organization_id);
        console.log(`   ${phone.phone_number} (${phone.channel})`);
        console.log(`   → ${org ? org.name : 'Unknown Org'} (${phone.organization_id})`);
        console.log(`   Status: ${phone.is_active ? 'active' : 'inactive'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

findOrganizations();
