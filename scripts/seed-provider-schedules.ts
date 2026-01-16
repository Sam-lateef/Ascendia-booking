/**
 * Seed Provider Schedules
 * 
 * Creates default schedules for providers for the next 2 weeks.
 * Now uses specific dates (schedule_date) instead of recurring day_of_week.
 * 
 * Run with: npx tsx scripts/seed-provider-schedules.ts
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function seedSchedules() {
  console.log('🗓️  Seeding Provider Schedules (Date-Based)...\n');

  // Get all providers
  const { data: providers, error: providerError } = await db
    .from('providers')
    .select('id, first_name, last_name, is_active')
    .eq('is_active', true);

  if (providerError) {
    console.error('Error fetching providers:', providerError.message);
    return;
  }

  if (!providers || providers.length === 0) {
    console.log('No providers found. Please create providers first.');
    return;
  }

  console.log(`Found ${providers.length} active providers`);

  // Get operatories
  const { data: operatories, error: opError } = await db
    .from('operatories')
    .select('id, op_name')
    .eq('is_active', true);

  if (opError || !operatories || operatories.length === 0) {
    console.log('No operatories found. Please create operatories first.');
    return;
  }

  console.log(`Found ${operatories.length} active operatories\n`);

  // Delete existing schedules (optional - comment out to preserve existing)
  console.log('🗑️  Clearing existing schedules...');
  await db.from('provider_schedules').delete().neq('id', 0);

  // Create schedules for the next 14 days
  const today = new Date();
  const daysToCreate = 14;
  
  let created = 0;
  let skipped = 0;

  // Assign each provider to a different operatory (round-robin)
  for (let providerIdx = 0; providerIdx < providers.length; providerIdx++) {
    const provider = providers[providerIdx];
    const operatory = operatories[providerIdx % operatories.length];
    
    console.log(`\n📋 Provider: Dr. ${provider.first_name} ${provider.last_name} → ${operatory.op_name}`);

    for (let dayOffset = 0; dayOffset < daysToCreate; dayOffset++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(today.getDate() + dayOffset);
      
      const dayOfWeek = scheduleDate.getDay();
      
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }
      
      const dateStr = scheduleDate.toISOString().split('T')[0];

      const { error } = await db
        .from('provider_schedules')
        .insert({
          provider_id: provider.id,
          operatory_id: operatory.id,
          schedule_date: dateStr,
          start_time: '09:00:00',
          end_time: '17:00:00',
          is_active: true
        });

      if (error) {
        console.log(`   ❌ ${dateStr} (${DAY_NAMES[dayOfWeek]}): Error - ${error.message}`);
        skipped++;
      } else {
        console.log(`   ✅ ${dateStr} (${DAY_NAMES[dayOfWeek]}): 9:00 AM - 5:00 PM in ${operatory.op_name}`);
        created++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   Created: ${created} schedules`);
  console.log(`   Skipped: ${skipped} (errors)`);
  console.log(`   Providers: ${providers.length}`);
  console.log(`   Date range: Next ${daysToCreate} days (weekdays only)`);
  console.log('='.repeat(50));
}

seedSchedules()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
