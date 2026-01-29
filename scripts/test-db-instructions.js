/**
 * Test Script: Verify Database Instructions Loading
 * Tests if the Retell agent can load instructions from the database
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testDatabaseInstructions() {
  log('\n╔═══════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║  Database Instructions Test                                   ║', colors.cyan);
  log('╚═══════════════════════════════════════════════════════════════╝\n', colors.cyan);

  // Step 1: Check environment variables
  log('1. Checking environment variables...', colors.bright);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    log('   ✗ SUPABASE_URL not found!', colors.red);
    return;
  }
  log(`   ✓ SUPABASE_URL: ${supabaseUrl}`, colors.green);

  if (!supabaseServiceKey) {
    log('   ✗ SUPABASE_SERVICE_KEY not found!', colors.red);
    log('   This is REQUIRED for loading instructions from database!', colors.red);
    return;
  }
  log('   ✓ SUPABASE_SERVICE_KEY: Set', colors.green);

  if (!supabaseAnonKey) {
    log('   ⚠ SUPABASE_ANON_KEY not found (optional)', colors.yellow);
  } else {
    log('   ✓ SUPABASE_ANON_KEY: Set', colors.green);
  }

  // Step 2: Create Supabase client
  log('\n2. Creating Supabase admin client...', colors.bright);
  let supabase;
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    log('   ✓ Admin client created', colors.green);
  } catch (error) {
    log(`   ✗ Failed to create client: ${error.message}`, colors.red);
    return;
  }

  // Step 3: Test database connection
  log('\n3. Testing database connection...', colors.bright);
  try {
    const { error } = await supabase.from('organizations').select('id').limit(1);
    if (error) throw error;
    log('   ✓ Database connection successful', colors.green);
  } catch (error) {
    log(`   ✗ Database connection failed: ${error.message}`, colors.red);
    return;
  }

  // Step 4: Check for organizations
  log('\n4. Checking organizations...', colors.bright);
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .limit(10);
    
    if (error) throw error;
    
    if (!orgs || orgs.length === 0) {
      log('   ⚠ No organizations found in database', colors.yellow);
      return;
    }
    
    log(`   ✓ Found ${orgs.length} organization(s)`, colors.green);
    orgs.forEach(org => {
      log(`     - ${org.name} (${org.slug}) - ID: ${org.id}`, colors.cyan);
    });

    // Step 5: Check for channel configurations
    log('\n5. Checking channel configurations...', colors.bright);
    for (const org of orgs) {
      const { data: configs, error: configError } = await supabase
        .from('channel_configurations')
        .select('channel, enabled, ai_backend, instructions')
        .eq('organization_id', org.id);
      
      if (configError) {
        log(`   ✗ Error loading configs for ${org.name}: ${configError.message}`, colors.red);
        continue;
      }
      
      if (!configs || configs.length === 0) {
        log(`   ⚠ No channel configs for ${org.name}`, colors.yellow);
        continue;
      }
      
      log(`\n   Organization: ${org.name}`, colors.bright);
      configs.forEach(config => {
        const hasInstructions = config.instructions && config.instructions.trim().length > 0;
        const status = config.enabled ? '✓ Enabled' : '✗ Disabled';
        const instrStatus = hasInstructions 
          ? `✓ Has instructions (${config.instructions.length} chars)` 
          : '✗ No instructions';
        
        log(`     ${config.channel}:`, colors.cyan);
        log(`       ${status} | AI: ${config.ai_backend || 'not set'}`, 
            config.enabled ? colors.green : colors.yellow);
        log(`       ${instrStatus}`, 
            hasInstructions ? colors.green : colors.yellow);
      });
    }

    // Step 6: Check for global domain prompts
    log('\n6. Checking global domain prompts...', colors.bright);
    const { data: domains, error: domainError } = await supabase
      .from('domains')
      .select('name, display_name, system_prompt_template, is_active')
      .eq('is_active', true);
    
    if (domainError) {
      log(`   ✗ Error loading domains: ${domainError.message}`, colors.red);
    } else if (!domains || domains.length === 0) {
      log('   ⚠ No active domains found', colors.yellow);
    } else {
      log(`   ✓ Found ${domains.length} active domain(s)`, colors.green);
      domains.forEach(domain => {
        const hasPrompt = domain.system_prompt_template && domain.system_prompt_template.trim().length > 0;
        log(`     - ${domain.display_name} (${domain.name})`, colors.cyan);
        log(`       ${hasPrompt ? '✓' : '✗'} System prompt: ${hasPrompt ? `${domain.system_prompt_template.length} chars` : 'not set'}`,
            hasPrompt ? colors.green : colors.yellow);
      });
    }

    // Step 7: Summary
    log('\n╔═══════════════════════════════════════════════════════════════╗', colors.cyan);
    log('║  Test Summary                                                 ║', colors.cyan);
    log('╚═══════════════════════════════════════════════════════════════╝\n', colors.cyan);

    const retellConfigs = orgs.flatMap(org => {
      return (configs || []).filter(c => c.channel === 'retell');
    });

    const { data: allRetellConfigs } = await supabase
      .from('channel_configurations')
      .select('channel, enabled, instructions, organization_id')
      .eq('channel', 'retell');

    const enabledRetell = allRetellConfigs?.filter(c => c.enabled) || [];
    const withInstructions = enabledRetell.filter(c => c.instructions && c.instructions.trim().length > 0);

    log(`Retell configurations:`, colors.bright);
    log(`  • Total: ${allRetellConfigs?.length || 0}`, colors.cyan);
    log(`  • Enabled: ${enabledRetell.length}`, enabledRetell.length > 0 ? colors.green : colors.yellow);
    log(`  • With instructions: ${withInstructions.length}`, withInstructions.length > 0 ? colors.green : colors.yellow);

    if (withInstructions.length === 0) {
      log('\n⚠️  NO RETELL CHANNELS HAVE CUSTOM INSTRUCTIONS!', colors.yellow);
      log('    Agents will use global domain prompts (if configured) or hardcoded fallback.', colors.yellow);
      log('\n    To add instructions:', colors.cyan);
      log('    1. Go to your app: /admin/settings/channels', colors.cyan);
      log('    2. Select Retell channel', colors.cyan);
      log('    3. Add custom instructions in the Instructions field', colors.cyan);
      log('    4. Save changes\n', colors.cyan);
    } else {
      log('\n✓ Retell instructions are configured!', colors.green);
      log('  Agents should load from database successfully.', colors.green);
    }

  } catch (error) {
    log(`\n✗ Test failed: ${error.message}`, colors.red);
    console.error(error);
  }
}

// Run the test
testDatabaseInstructions()
  .then(() => {
    log('\n✓ Test completed\n', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    log(`\n✗ Test failed: ${error.message}\n`, colors.red);
    console.error(error);
    process.exit(1);
  });
