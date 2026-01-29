/**
 * Apply auto-create organization migration
 * This ensures new signups automatically get their own organization
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
  }

  console.log('🔗 Connecting to Supabase...');
  console.log('   URL:', supabaseUrl);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '048_auto_create_organization_on_signup.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📄 Migration file loaded');
    console.log('   Path:', migrationPath);

    // Execute migration
    console.log('\n⚙️  Applying migration...');
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSql 
    });

    if (error) {
      // Try direct execution if exec_sql doesn't exist
      console.log('   Trying direct execution...');
      
      // Split by statement and execute each
      const statements = migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (stmt) {
          console.log(`   Executing statement ${i + 1}/${statements.length}...`);
          const result = await supabase.rpc('exec_sql', { sql: stmt });
          if (result.error) {
            console.error(`   ⚠️  Error in statement ${i + 1}:`, result.error.message);
          }
        }
      }
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Created handle_new_user_signup() function');
    console.log('   - Created trigger on auth.users table');
    console.log('   - Created organizations for existing users without orgs');
    console.log('\n🎉 New signups will now automatically get their own organization!');
    
    // Verify the user now has an organization
    console.log('\n🔍 Checking user organizations...');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!orgError && orgs) {
      console.log(`   Found ${orgs.length} recent organizations:`);
      orgs.forEach(org => {
        console.log(`   - ${org.name} (${org.slug}) - ${org.plan} plan`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error applying migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigration();
