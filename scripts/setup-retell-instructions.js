/**
 * Setup Script: Enable Retell and Add Instructions
 * Configures Retell channel with custom instructions for an organization
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

const SAMPLE_INSTRUCTIONS = `IDENTITY
You are Lexi, a friendly AI receptionist at {company_name}.

FIRST MESSAGE
When the call starts, greet the patient:
"Hi! Welcome to {company_name}. This is Lexi. How can I help you today?"

PATIENT LOOKUP
Accept NAME or PHONE for patient lookup:
- Name: "John Smith", "my name is John"
- Phone: "619-555-1234" (any format)
- If neither: Ask "May I have your name or phone number?"

WHEN TO HAND OFF
Hand off to orchestrator for:
- Booking/rescheduling/canceling appointments
- Checking appointment times
- Patient-specific data lookup

Answer directly for:
- Office hours, location, services
- General practice questions

Say "Let me look that up for you" before handing off.

OFFICE INFO
{company_name} | {office_phone} | {office_address}
Hours: Monday-Friday 8am-5pm
Services: Dental checkups, cleanings, fillings, crowns, root canals`;

async function setupRetellInstructions() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Setup Retell Instructions                                    ║');
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
    process.exit(1);
  }

  console.log(`\n✓ Selected: ${selectedOrg.name}\n`);

  // Check current Retell configuration
  const { data: currentConfig } = await supabase
    .from('channel_configurations')
    .select('*')
    .eq('organization_id', selectedOrg.id)
    .eq('channel', 'retell')
    .single();

  if (currentConfig) {
    console.log('Current Retell configuration:');
    console.log(`  • Enabled: ${currentConfig.enabled ? '✓ Yes' : '✗ No'}`);
    console.log(`  • AI Backend: ${currentConfig.ai_backend || 'not set'}`);
    console.log(`  • Has instructions: ${currentConfig.instructions ? `✓ Yes (${currentConfig.instructions.length} chars)` : '✗ No'}`);
    console.log('');
  }

  const action = await question('What would you like to do?\n  1. Enable Retell\n  2. Add sample instructions\n  3. Add custom instructions\n  4. Exit\nChoice: ');

  switch (action) {
    case '1':
      await supabase
        .from('channel_configurations')
        .update({ enabled: true })
        .eq('organization_id', selectedOrg.id)
        .eq('channel', 'retell');
      console.log('\n✓ Retell enabled!');
      break;

    case '2':
      await supabase
        .from('channel_configurations')
        .update({ 
          enabled: true,
          instructions: SAMPLE_INSTRUCTIONS
        })
        .eq('organization_id', selectedOrg.id)
        .eq('channel', 'retell');
      console.log('\n✓ Sample instructions added and Retell enabled!');
      console.log(`   Instructions length: ${SAMPLE_INSTRUCTIONS.length} characters`);
      break;

    case '3':
      console.log('\n📝 Enter your instructions (type END on a new line when done):');
      let customInstructions = '';
      while (true) {
        const line = await question('');
        if (line.trim() === 'END') break;
        customInstructions += line + '\n';
      }
      
      await supabase
        .from('channel_configurations')
        .update({ 
          enabled: true,
          instructions: customInstructions.trim()
        })
        .eq('organization_id', selectedOrg.id)
        .eq('channel', 'retell');
      console.log('\n✓ Custom instructions added and Retell enabled!');
      console.log(`   Instructions length: ${customInstructions.length} characters`);
      break;

    case '4':
      console.log('\n👋 Bye!');
      process.exit(0);

    default:
      console.log('\n❌ Invalid choice');
      process.exit(1);
  }

  console.log('\n✓ Configuration updated successfully!');
  console.log('\n📝 Next steps:');
  console.log('  1. Restart your WebSocket server to load new instructions');
  console.log('  2. Test a Retell call to verify');
  console.log('');

  rl.close();
}

setupRetellInstructions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  });
