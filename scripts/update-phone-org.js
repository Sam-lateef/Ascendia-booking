#!/usr/bin/env node
/**
 * Update Phone Number Organization
 * 
 * Changes which organization a phone number is assigned to.
 * 
 * Usage:
 *   node scripts/update-phone-org.js <organization-id> [phone-number] [channel]
 * 
 * Examples:
 *   node scripts/update-phone-org.js b445a9c7-af93-4b4a-a975-40d3f44178ec
 *   node scripts/update-phone-org.js b445a9c7-af93-4b4a-a975-40d3f44178ec +18504036622 twilio
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
const twilioPhoneNumber = env.TWILIO_PHONE_NUMBER;

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

// Get command line arguments
const newOrgId = process.argv[2];
const phoneNumber = process.argv[3] || twilioPhoneNumber;
const channel = process.argv[4] || 'twilio';

if (!newOrgId) {
  console.log('Usage: node scripts/update-phone-org.js <organization-id> [phone-number] [channel]\n');
  console.log('Examples:');
  console.log('  node scripts/update-phone-org.js b445a9c7-af93-4b4a-a975-40d3f44178ec');
  console.log('  node scripts/update-phone-org.js b445a9c7-af93-4b4a-a975-40d3f44178ec +18504036622 twilio\n');
  console.log('💡 Run this first to see available organizations:');
  console.log('  node scripts/find-organizations.js\n');
  process.exit(1);
}

if (!phoneNumber) {
  console.error('❌ No phone number specified and TWILIO_PHONE_NUMBER not in .env');
  console.error('   Usage: node scripts/update-phone-org.js <org-id> <phone-number> <channel>');
  process.exit(1);
}

async function updatePhoneOrg() {
  console.log('🔄 Updating phone number organization...\n');
  console.log('='.repeat(70));
  
  try {
    // Step 1: Verify new organization exists
    console.log('\n1️⃣  Verifying organization...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', newOrgId)
      .single();
    
    if (orgError || !org) {
      throw new Error(`Organization not found: ${newOrgId}\n   Run: node scripts/find-organizations.js`);
    }
    
    console.log(`   ✅ Found: ${org.name} (${org.slug})`);
    
    // Step 2: Check if phone number exists
    console.log('\n2️⃣  Checking phone number...');
    const { data: existingPhone, error: checkError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('channel', channel)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    if (existingPhone) {
      // Update existing
      console.log(`   ⚠️  Phone number exists: ${phoneNumber}`);
      console.log(`   Current org: ${existingPhone.organization_id}`);
      console.log(`   New org: ${newOrgId}`);
      
      if (existingPhone.organization_id === newOrgId) {
        console.log('\n   ℹ️  Phone number already assigned to this organization');
        console.log('   No changes needed.');
        return;
      }
      
      console.log('\n3️⃣  Updating organization assignment...');
      const { error: updateError } = await supabase
        .from('phone_numbers')
        .update({
          organization_id: newOrgId,
          updated_at: new Date().toISOString(),
          metadata: {
            ...existingPhone.metadata,
            previous_org_id: existingPhone.organization_id,
            updated_by: 'update-phone-org-script',
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', existingPhone.id);
      
      if (updateError) throw updateError;
      
      console.log('   ✅ Organization updated');
      
    } else {
      // Insert new
      console.log(`   ℹ️  Phone number not found, creating new entry`);
      
      console.log('\n3️⃣  Creating phone number entry...');
      const { error: insertError } = await supabase
        .from('phone_numbers')
        .insert({
          phone_number: phoneNumber,
          organization_id: newOrgId,
          channel: channel,
          is_active: true,
          metadata: {
            friendly_name: 'Main Support Line',
            provider: channel === 'twilio' ? 'Twilio' : channel,
            created_by: 'update-phone-org-script',
            created_at: new Date().toISOString()
          }
        });
      
      if (insertError) throw insertError;
      
      console.log('   ✅ Phone number created');
    }
    
    // Step 4: Verify the update
    console.log('\n4️⃣  Verifying update...');
    const { data: verification, error: verifyError } = await supabase
      .from('phone_numbers')
      .select('phone_number, organization_id, channel, is_active')
      .eq('phone_number', phoneNumber)
      .eq('channel', channel)
      .single();
    
    if (verifyError || !verification) {
      throw new Error('Verification failed - phone number not found after update');
    }
    
    if (verification.organization_id !== newOrgId) {
      throw new Error('Verification failed - organization ID mismatch');
    }
    
    console.log('   ✅ Verified successfully');
    
    // Success summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ Phone number organization updated!\n');
    console.log('📋 Summary:');
    console.log(`   Phone: ${phoneNumber}`);
    console.log(`   Channel: ${channel}`);
    console.log(`   Organization: ${org.name}`);
    console.log(`   Org ID: ${newOrgId}`);
    console.log(`   Status: active`);
    console.log('\n🎯 Incoming calls to this number will now route to:');
    console.log(`   Organization: ${org.name}`);
    console.log(`   Org ID: ${newOrgId}`);
    console.log('\n💡 Test it:');
    console.log(`   1. Call ${phoneNumber}`);
    console.log(`   2. Check Admin UI → Calls tab`);
    console.log(`   3. Verify call appears in "${org.name}"\n`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

updatePhoneOrg();
