#!/usr/bin/env node
/**
 * Seed Twilio Phone Numbers
 * 
 * Adds Twilio phone numbers to phone_numbers table for organization routing.
 * This enables multi-tenant call routing based on the 'To' number.
 * 
 * Usage:
 *   node scripts/seed-twilio-phone-numbers.js
 * 
 * Based on lessons from Retell troubleshooting - phone number mapping is CRITICAL
 * for proper organization routing.
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
        // Remove quotes and comments
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
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

if (!twilioPhoneNumber) {
  console.error('❌ Missing TWILIO_PHONE_NUMBER in .env');
  console.error('   Add: TWILIO_PHONE_NUMBER=+1234567890');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedPhoneNumbers() {
  console.log('🚀 Seeding Twilio Phone Numbers\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Get default organization
    console.log('\n1️⃣  Finding default organization...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    if (orgError || !org) {
      throw new Error('No organizations found! Please create an organization first.');
    }
    
    console.log(`   ✅ Found: ${org.name} (${org.id})`);
    
    // Step 2: Check if phone number already exists
    console.log('\n2️⃣  Checking existing phone numbers...');
    const { data: existing, error: checkError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('phone_number', twilioPhoneNumber)
      .eq('channel', 'twilio')
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    if (existing) {
      console.log(`   ⚠️  Phone number already exists: ${twilioPhoneNumber}`);
      console.log(`   Current org: ${existing.organization_id}`);
      console.log(`   Active: ${existing.is_active}`);
      
      // Update if needed
      if (existing.organization_id !== org.id || !existing.is_active) {
        console.log('\n   🔄 Updating phone number mapping...');
        const { error: updateError } = await supabase
          .from('phone_numbers')
          .update({
            organization_id: org.id,
            is_active: true,
            metadata: {
              friendly_name: 'Main Support Line',
              updated_by: 'seed-script',
              updated_at: new Date().toISOString()
            }
          })
          .eq('id', existing.id);
        
        if (updateError) throw updateError;
        console.log('   ✅ Phone number updated');
      } else {
        console.log('   ✓ Already correctly configured');
      }
    } else {
      // Step 3: Insert new phone number
      console.log('\n3️⃣  Adding phone number to database...');
      const { data: inserted, error: insertError } = await supabase
        .from('phone_numbers')
        .insert({
          phone_number: twilioPhoneNumber,
          organization_id: org.id,
          channel: 'twilio',
          is_active: true,
          metadata: {
            friendly_name: 'Main Support Line',
            provider: 'Twilio',
            added_by: 'seed-script',
            added_at: new Date().toISOString()
          }
        })
        .select()
        .single();
      
      if (insertError) {
        // Handle duplicate key error gracefully
        if (insertError.code === '23505') {
          console.log('   ⚠️  Phone number already exists (race condition)');
        } else {
          throw insertError;
        }
      } else {
        console.log(`   ✅ Added: ${inserted.phone_number}`);
        console.log(`   Organization: ${org.name}`);
        console.log(`   Channel: ${inserted.channel}`);
      }
    }
    
    // Step 4: Verify the mapping
    console.log('\n4️⃣  Verifying phone number lookup...');
    const { data: verification, error: verifyError } = await supabase
      .from('phone_numbers')
      .select('phone_number, organization_id, channel, is_active, metadata')
      .eq('phone_number', twilioPhoneNumber)
      .eq('channel', 'twilio')
      .eq('is_active', true)
      .single();
    
    if (verifyError || !verification) {
      throw new Error('Phone number verification failed!');
    }
    
    console.log('   ✅ Verification passed');
    console.log(`   Lookup: ${verification.phone_number} → ${verification.organization_id}`);
    
    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Phone number seeding complete!\n');
    console.log('📋 Summary:');
    console.log(`   Phone: ${twilioPhoneNumber}`);
    console.log(`   Organization: ${org.name}`);
    console.log(`   Channel: twilio`);
    console.log(`   Status: active`);
    console.log('\n🎯 Next steps:');
    console.log('   1. Update incoming-call handler to lookup org from phone');
    console.log('   2. Pass org ID to WebSocket handler');
    console.log('   3. Test with: node scripts/test-phone-lookup.js\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

// Run the seeder
seedPhoneNumbers();
