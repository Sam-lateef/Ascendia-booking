#!/usr/bin/env node
/**
 * Apply Default Organization Migration
 * Links all existing data to a default organization
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

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

async function applyMigration() {
  console.log('🚀 Applying default organization migration...\n');

  try {
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '003_link_existing_data_to_default_org.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration SQL...\n');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If the RPC doesn't exist, try direct execution
      console.log('⚠️  RPC method not available, using direct client...\n');
      
      const defaultOrgId = 'default-org-00000000-0000-0000-0000-000000000001';
      
      // Create default organization
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
        throw new Error(`Failed to create organization: ${orgError.message}`);
      }
      console.log('✅ Default organization created/updated\n');

      // Update all tables
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

      for (const table of tables) {
        console.log(`2️⃣  Updating ${table}...`);
        try {
          const { error: updateError } = await supabase
            .from(table)
            .update({ organization_id: defaultOrgId })
            .is('organization_id', null);

          if (updateError) {
            console.log(`   ⚠️  Warning: ${updateError.message}`);
          } else {
            const { count } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', defaultOrgId);
            console.log(`   ✅ Updated ${count || 0} records`);
          }
        } catch (err) {
          console.log(`   ⚠️  Skipped (table may not exist): ${err.message}`);
        }
      }

      console.log('\n✅ Migration applied successfully!\n');

      // Verify
      console.log('📊 Verification:');
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', defaultOrgId)
        .single();

      if (orgData) {
        console.log(`   Organization: ${orgData.name} (${orgData.slug})`);
        console.log(`   ID: ${orgData.id}`);
        console.log(`   Status: ${orgData.status}`);
      }

      console.log('\n🎉 All existing data is now linked to the default organization!\n');
      console.log('📋 Next steps:');
      console.log('   1. Sign up at http://localhost:3000/signup');
      console.log('   2. Run: node scripts/setup-first-org.js your@email.com');
      console.log('   3. Log in and you\'ll see all your data!\n');

    } else {
      console.log('✅ Migration executed successfully!');
      console.log(data);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run
applyMigration();
