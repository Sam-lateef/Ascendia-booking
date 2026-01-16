/**
 * Add sample appointments for today
 */
import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function addTodayAppointments() {
  console.log('Adding appointments for today...\n');

  // Get existing data
  const { data: patients } = await db.from('patients').select('id, first_name, last_name').limit(2);
  const { data: providers } = await db.from('providers').select('id, first_name, last_name').limit(1);
  const { data: operatories } = await db.from('operatories').select('id, name').limit(1);

  console.log('Found:');
  console.log('  Patients:', patients?.length || 0);
  console.log('  Providers:', providers?.length || 0);
  console.log('  Operatories:', operatories?.length || 0);

  if (!patients?.length || !providers?.length || !operatories?.length) {
    console.log('\n❌ Missing data! Run seed script first.');
    return;
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const apt1Time = new Date(today);
  apt1Time.setHours(9, 30, 0, 0);
  
  const apt2Time = new Date(today);
  apt2Time.setHours(14, 0, 0, 0);

  const appointments = [
    {
      patient_id: patients[0].id,
      provider_id: providers[0].id,
      operatory_id: operatories[0].id,
      appointment_datetime: `${todayStr} 09:30:00`,
      duration_minutes: 30,
      appointment_type: 'Cleaning',
      status: 'Scheduled',
      notes: 'Morning cleaning'
    },
    {
      patient_id: patients[1]?.id || patients[0].id,
      provider_id: providers[0].id,
      operatory_id: operatories[0].id,
      appointment_datetime: `${todayStr} 14:00:00`,
      duration_minutes: 30,
      appointment_type: 'Checkup',
      status: 'Scheduled',
      notes: 'Afternoon checkup'
    }
  ];

  console.log('\nCreating appointments for:', todayStr);

  const { data, error } = await db.from('appointments').insert(appointments).select();

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log(`✅ Created ${data.length} appointments for today!`);
    data.forEach((apt: any) => {
      console.log(`   - ${apt.appointment_type} at ${apt.appointment_datetime}`);
    });
  }
}

addTodayAppointments().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});

