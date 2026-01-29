#!/usr/bin/env node
/**
 * Apply Phone Numbers Migration
 * 
 * Applies the phone_numbers table migration directly to Supabase.
 * This is needed for Twilio organization routing.
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

// SQL for creating phone_numbers table
const migrationSQL = `
-- Create phone_numbers table
CREATE TABLE IF NOT EXISTS phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('retell', 'twilio', 'whatsapp')),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one phone number per channel
  UNIQUE (phone_number, channel)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_numbers_lookup 
  ON phone_numbers(phone_number, channel) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_phone_numbers_org 
  ON phone_numbers(organization_id);

-- Add RLS policies
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view organization phone numbers" ON phone_numbers;
DROP POLICY IF EXISTS "Admins can manage phone numbers" ON phone_numbers;

-- Policy: Users can view phone numbers for their organization
CREATE POLICY "Users can view organization phone numbers"
  ON phone_numbers
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins can manage phone numbers
CREATE POLICY "Admins can manage phone numbers"
  ON phone_numbers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 
      FROM organization_members 
      WHERE user_id = auth.uid() 
        AND organization_id = phone_numbers.organization_id
        AND role IN ('owner', 'admin')
    )
  );
`;

async function applyMigration() {
  console.log('🚀 Applying phone_numbers migration\n');
  
  try {
    console.log('1️⃣  Executing SQL...');
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // Try direct query if RPC doesn't work
      console.log('   ⚠️  RPC method not available, trying direct query...');
      
      // Split SQL into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        try {
          const { error: stmtError } = await supabase.rpc('query', { 
            sql: statement 
          });
          if (stmtError && !stmtError.message.includes('already exists')) {
            console.error(`   Error in statement: ${statement.substring(0, 50)}...`);
            console.error(`   ${stmtError.message}`);
          }
        } catch (e) {
          // Ignore errors for CREATE IF NOT EXISTS
          if (!e.message.includes('already exists')) {
            console.warn(`   Warning: ${e.message}`);
          }
        }
      }
    }
    
    // Verify table exists
    console.log('\n2️⃣  Verifying table...');
    const { data, error: verifyError } = await supabase
      .from('phone_numbers')
      .select('count')
      .limit(0);
    
    if (verifyError) {
      throw new Error(`Table verification failed: ${verifyError.message}`);
    }
    
    console.log('   ✅ Table exists and is accessible');
    
    console.log('\n✅ Migration applied successfully!\n');
    console.log('Next step: Run seed script');
    console.log('  node scripts/seed-twilio-phone-numbers.js\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n💡 Manual migration required:');
    console.error('   1. Go to Supabase Dashboard → SQL Editor');
    console.error('   2. Run: supabase/migrations/058_phone_number_org_mapping.sql');
    console.error('   3. Then run: node scripts/seed-twilio-phone-numbers.js\n');
    process.exit(1);
  }
}

applyMigration();
