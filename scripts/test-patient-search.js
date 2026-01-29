/**
 * Test Patient Search Flow
 * Simulates exactly what happens when Retell agent searches for a patient
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

async function testPatientSearch() {
  console.log('\n🔍 Testing Patient Search Flow\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const orgId = 'b445a9c7-af93-4b4a-a975-40d3f44178ec'; // sam-lateeff org

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Set RLS context (like getSupabaseWithOrg does)
  console.log(`1. Setting RLS organization context to: ${orgId}`);
  try {
    await supabase.rpc('set_rls_organization_id', { org_id: orgId });
    console.log('   ✓ RLS context set\n');
  } catch (error) {
    console.error('   ✗ Failed to set RLS context:', error.message);
    console.log('   Continuing without RLS...\n');
  }

  // 2. Query all patients (like GetAllPatients)
  console.log('2. GetAllPatients (like the UI does):');
  const { data: allPatients, error: allError } = await supabase
    .from('patients')
    .select('*')
    .eq('organization_id', orgId)
    .order('last_name')
    .order('first_name');

  if (allError) {
    console.error('   ✗ Error:', allError.message);
  } else {
    console.log(`   ✓ Found ${allPatients?.length || 0} patients`);
    if (allPatients && allPatients.length > 0) {
      allPatients.forEach(p => {
        console.log(`     - ID: ${p.id}, Name: ${p.first_name} ${p.last_name}, Phone: ${p.phone}, Org: ${p.organization_id}`);
      });
    }
  }

  // 3. Search by last name (like GetMultiplePatients)
  console.log('\n3. GetMultiplePatients with LName="Lateef":');
  const { data: byName, error: nameError } = await supabase
    .from('patients')
    .select('*')
    .eq('organization_id', orgId)
    .ilike('last_name', '%Lateef%')
    .order('last_name')
    .order('first_name');

  if (nameError) {
    console.error('   ✗ Error:', nameError.message);
  } else {
    console.log(`   ✓ Found ${byName?.length || 0} patients`);
    if (byName && byName.length > 0) {
      byName.forEach(p => {
        console.log(`     - ${p.first_name} ${p.last_name}, Phone: ${p.phone}`);
      });
    }
  }

  // 4. Search by phone (like GetMultiplePatients)
  console.log('\n4. GetMultiplePatients with Phone="6194563960":');
  const { data: byPhone, error: phoneError } = await supabase
    .from('patients')
    .select('*')
    .eq('organization_id', orgId)
    .eq('phone', '6194563960')
    .order('last_name')
    .order('first_name');

  if (phoneError) {
    console.error('   ✗ Error:', phoneError.message);
  } else {
    console.log(`   ✓ Found ${byPhone?.length || 0} patients`);
    if (byPhone && byPhone.length > 0) {
      byPhone.forEach(p => {
        console.log(`     - ${p.first_name} ${p.last_name}, Phone: ${p.phone}`);
      });
    }
  }

  // 5. Check if RLS is blocking
  console.log('\n5. Testing RLS (query WITHOUT org filter):');
  const { data: noOrgFilter, error: noOrgError } = await supabase
    .from('patients')
    .select('*')
    .ilike('last_name', '%Lateef%')
    .limit(10);

  if (noOrgError) {
    console.error('   ✗ Error:', noOrgError.message);
  } else {
    console.log(`   ✓ Found ${noOrgFilter?.length || 0} patients (RLS ${noOrgFilter?.length === 0 ? 'BLOCKING' : 'NOT BLOCKING'})`);
  }

  // 6. Summary
  console.log('\n📊 Summary:');
  if (allPatients && allPatients.length > 0) {
    console.log('  ✅ Patients exist in the database');
    console.log('  ✅ Can query with organization_id filter');
    
    if (byName && byName.length > 0) {
      console.log('  ✅ Search by name works');
    } else {
      console.log('  ⚠️  Search by name NOT working (but GetAllPatients works)');
      console.log('  Possible issue: Column name mismatch or case sensitivity');
    }
    
    if (byPhone && byPhone.length > 0) {
      console.log('  ✅ Search by phone works');
    } else {
      console.log('  ⚠️  Search by phone NOT working');
      console.log('  Possible issue: Phone format mismatch');
    }
  } else {
    console.log('  ❌ NO PATIENTS FOUND');
    console.log('  Possible issues:');
    console.log('    - Wrong organization ID');
    console.log('    - RLS blocking service role');
    console.log('    - Data not migrated to this org');
  }

  console.log('');
}

testPatientSearch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  });
