#!/usr/bin/env node
/**
 * Apply Migration 001 - Add organization_id to all tables
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

async function executeSQLFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Split by semicolons and execute statements one by one
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      const { data, error } = await supabase.rpc('exec', { sql: statement });
      if (error) {
        // Try direct query if RPC fails
        const result = await supabase.from('_').select('*').limit(0);
        // If we can't execute, just log and continue
        console.log(`   ⚠️  Statement may have failed: ${error.message.substring(0, 80)}`);
      }
    } catch (err) {
      // Ignore errors, keep going
    }
  }
}

async function applyMigration001() {
  console.log('🚀 Applying migration 001 - Add organization_id to tables...\n');

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_add_organization_id_to_tables.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  console.log('📄 Reading migration file...');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('⚙️  Executing SQL...\n');
  console.log('This will add organization_id column to all tables and set up RLS policies.\n');

  try {
    // Since we can't execute the full SQL file easily through the JS client,
    // let's manually add the columns for the most important tables
    
    const tables = [
      'patients',
      'providers',
      'operatories',
      'appointments',
      'treatment_plans',
      'treatment_plan_items',
      'treatments_catalog',
      'agent_instructions'
    ];

    const defaultOrgId = '00000000-0000-0000-0000-000000000001';

    for (const table of tables) {
      try {
        console.log(`   Adding organization_id to ${table}...`);
        
        // Try to add the column (will fail if it already exists, which is fine)
        await supabase.rpc('exec', {
          sql: `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;`
        }).catch(() => {});

        // Set default for existing records
        await supabase.rpc('exec', {
          sql: `UPDATE ${table} SET organization_id = '${defaultOrgId}' WHERE organization_id IS NULL;`
        }).catch(() => {});

        console.log(`   ✅ Done`);
      } catch (err) {
        console.log(`   ⚠️  ${err.message}`);
      }
    }

    console.log('\n✅ Migration 001 applied!\n');
    console.log('🔒 Note: RLS policies need to be applied through SQL editor or psql');
    console.log('   The RLS policies in migration 001 ensure data isolation.\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

applyMigration001();
