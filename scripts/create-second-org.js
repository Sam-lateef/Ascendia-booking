const fs = require('fs');
const path = require('path');

// Manual .env parsing
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
  
  return env;
}

const env = loadEnv();

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

async function createSecondOrg() {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🚀 Creating second test organization...\n');

  // Step 1: Create the second organization
  console.log('1️⃣ Creating organization "Nurai Clinic"...');
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: 'Nurai Clinic',
      slug: 'nurai-clinic',
      status: 'active',
      plan: 'professional',
      settings: {
        timezone: 'UTC',
        language: 'en'
      }
    })
    .select()
    .single();

  if (orgError) {
    if (orgError.code === '23505') {
      console.log('⚠️ Organization "Nurai Clinic" already exists, fetching it...');
      const { data: existingOrg, error: fetchError } = await supabase
        .from('organizations')
        .select()
        .eq('slug', 'nurai-clinic')
        .single();
      
      if (fetchError) {
        console.error('❌ Failed to fetch existing organization:', fetchError);
        process.exit(1);
      }
      
      console.log('✅ Using existing organization:', existingOrg.name);
      await linkUserToOrg(supabase, existingOrg.id);
      return;
    }
    
    console.error('❌ Failed to create organization:', orgError);
    process.exit(1);
  }

  console.log(`✅ Organization created: ${org.name} (${org.id})\n`);

  await linkUserToOrg(supabase, org.id);
}

async function linkUserToOrg(supabase, orgId) {
  // Step 2: Get the current user (assumes admin@ascendia.app exists)
  console.log('2️⃣ Finding user admin@ascendia.app...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Failed to list users:', authError);
    process.exit(1);
  }

  const adminAuthUser = authUsers.users.find(u => u.email === 'admin@ascendia.app');
  if (!adminAuthUser) {
    console.error('❌ User admin@ascendia.app not found');
    console.log('💡 Create the user first with: node scripts/setup-first-org-simple.js');
    process.exit(1);
  }

  console.log(`✅ Found auth user: ${adminAuthUser.email} (${adminAuthUser.id})\n`);

  // Step 3: Get the internal user record
  console.log('3️⃣ Finding internal user record...');
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', adminAuthUser.id)
    .single();

  if (userError || !userRecord) {
    console.error('❌ User record not found:', userError);
    process.exit(1);
  }

  console.log(`✅ Found user record: ${userRecord.id}\n`);

  // Step 4: Add user to the organization
  console.log('4️⃣ Adding user to organization...');
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: orgId,
      user_id: userRecord.id,
      role: 'owner',
      status: 'active'
    })
    .select()
    .single();

  if (membershipError) {
    if (membershipError.code === '23505') {
      console.log('⚠️ User already belongs to this organization');
      console.log('✅ All done!\n');
      return;
    }
    console.error('❌ Failed to add user to organization:', membershipError);
    process.exit(1);
  }

  console.log('✅ User added to organization as owner\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SUCCESS! Second organization created!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 Organization Details:');
  console.log(`   Name: Nurai Clinic`);
  console.log(`   Slug: nurai-clinic`);
  console.log(`   ID: ${orgId}`);
  console.log(`\n👤 User: admin@ascendia.app`);
  console.log(`   Role: owner`);
  console.log(`   Status: active\n`);
  console.log('🎯 Next Steps:');
  console.log('   1. Refresh your browser');
  console.log('   2. You should now see an organization switcher');
  console.log('   3. Click it to switch between "Default Organization" and "Nurai Clinic"');
  console.log('   4. Each organization will have completely isolated data\n');
}

createSecondOrg().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
