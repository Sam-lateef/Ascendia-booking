/**
 * Apply Database Migration Script
 * 
 * This script applies the migration SQL directly to your Supabase database
 * 
 * Usage:
 *   npx tsx scripts/apply-migration.ts
 * 
 * Make sure you have SUPABASE_URL and SUPABASE_ANON_KEY in your .env file
 */

import { getSupabaseClient } from '../src/app/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  console.log('🔄 Applying database migration...\n');

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded\n');
    console.log('Executing SQL statements...\n');

    // Split SQL into individual statements (semicolon-separated)
    // Remove comments and empty lines
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    const db = getSupabaseClient();

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements
      if (!statement || statement.length < 10) continue;

      try {
        // Use Supabase RPC or direct query
        // Note: Supabase client doesn't support raw SQL directly
        // We need to use the REST API or SQL editor
        console.log(`⚠️  Statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
        console.log('   ⚠️  Supabase JS client cannot execute raw SQL directly.');
        console.log('   📝 Please run this migration in Supabase Dashboard SQL Editor\n');
      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }

    console.log('\n❌ Cannot execute raw SQL via Supabase JS client.');
    console.log('\n📋 To apply this migration, please:');
    console.log('   1. Go to your Supabase Dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Copy and paste the contents of:');
    console.log(`      ${migrationPath}`);
    console.log('   4. Click "Run" to execute\n');
    
    console.log('   OR use Supabase CLI:');
    console.log('   supabase db push\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

applyMigration();



































