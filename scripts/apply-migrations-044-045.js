#!/usr/bin/env node
/**
 * Apply Migrations 044 & 045 - API Credentials and Dynamic Integrations
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
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('\nRequired variables:');
  console.log('  - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigrations() {
  console.log('\n🚀 Applying migrations 044 & 045...\n');

  const migrations = [
    {
      name: '044_api_credentials.sql',
      path: path.join(__dirname, '..', 'supabase', 'migrations', '044_api_credentials.sql'),
      description: 'API Credentials table for multi-tenant API key management'
    },
    {
      name: '045_dynamic_integrations.sql',
      path: path.join(__dirname, '..', 'supabase', 'migrations', '045_dynamic_integrations.sql'),
      description: 'Dynamic integration system tables'
    }
  ];

  for (const migration of migrations) {
    console.log(`\n📄 Applying ${migration.name}`);
    console.log(`   ${migration.description}`);
    
    if (!fs.existsSync(migration.path)) {
      console.error(`   ❌ Migration file not found: ${migration.path}`);
      continue;
    }

    const sql = fs.readFileSync(migration.path, 'utf8');
    
    console.log('   ⚙️  Executing SQL via Supabase...');
    console.log('   (This may take a moment...)\n');

    try {
      // Execute the full SQL file
      const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
      
      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
        console.log('\n   ℹ️  Manual steps required:');
        console.log(`   1. Go to your Supabase Dashboard → SQL Editor`);
        console.log(`   2. Open: ${migration.path}`);
        console.log(`   3. Copy the contents and run in SQL Editor\n`);
      } else {
        console.log(`   ✅ ${migration.name} applied successfully!`);
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      console.log('\n   ℹ️  Manual steps required:');
      console.log(`   1. Go to your Supabase Dashboard → SQL Editor`);
      console.log(`   2. Open: ${migration.path}`);
      console.log(`   3. Copy the contents and run in SQL Editor\n`);
    }
  }

  console.log('\n✅ Migration process completed!\n');
  console.log('🔄 Please restart your Next.js dev server to see changes.\n');
}

applyMigrations();
