/**
 * Quick Script: Add Test Patient Data
 * Adds a test patient you can find in Retell calls
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function addTestPatient() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Add Test Patient                                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get organizations
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .order('created_at');

  if (orgError || !orgs || orgs.length === 0) {
    console.error('❌ No organizations found');
    process.exit(1);
  }

  console.log('Available organizations:');
  orgs.forEach((org, i) => {
    console.log(`  ${i + 1}. ${org.name} (${org.slug})`);
  });

  const orgChoice = await question('\nSelect organization (enter number): ');
  const selectedOrg = orgs[parseInt(orgChoice) - 1];

  if (!selectedOrg) {
    console.error('❌ Invalid selection');
    rl.close();
    process.exit(1);
  }

  console.log(`\n✓ Selected: ${selectedOrg.name}\n`);

  // Get patient details
  console.log('Enter patient details (or press Enter for defaults):');
  const fname = await question('First name [Test]: ') || 'Test';
  const lname = await question('Last name [Patient]: ') || 'Patient';
  const phone = await question('Phone (10 digits) [6195551234]: ') || '6195551234';
  const birthdate = await question('Birthdate (YYYY-MM-DD) [1990-01-01]: ') || '1990-01-01';
  const email = await question('Email [test@example.com]: ') || 'test@example.com';

  console.log('\nCreating patient...');

  try {
    const { data, error } = await supabase
      .from('patients')
      .insert({
        organization_id: selectedOrg.id,
        fname: fname,
        lname: lname,
        wirelessphone: phone.replace(/\D/g, ''), // Remove non-digits
        email: email,
        birthdate: birthdate,
        // Optional fields with defaults
        hmphone: phone.replace(/\D/g, ''),
        address: '123 Test Street',
        city: 'San Diego',
        state: 'CA',
        zip: '92101',
        preferredname: fname,
        preferconfirm_method: 'Text',
        texting_ok: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating patient:', error.message);
      console.error('Details:', error);
      rl.close();
      process.exit(1);
    }

    console.log('\n✅ Patient created successfully!');
    console.log(`   ID: ${data.patnum || data.id}`);
    console.log(`   Name: ${data.fname} ${data.lname}`);
    console.log(`   Phone: ${data.wirelessphone}`);
    console.log(`   Organization: ${selectedOrg.name}`);

    console.log('\n📱 Test with Retell:');
    console.log(`   Say: "Hi, this is ${fname} ${lname}"`);
    console.log(`   Or: "My phone number is ${phone}"`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }

  rl.close();
}

addTestPatient()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  });
