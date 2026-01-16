// @ts-nocheck
/**
 * Seed Data Script for Embedded Booking System
 * 
 * Creates sample data: providers, operatories, schedules, patients, and appointments
 * 
 * Usage:
 *   npx tsx scripts/seed-booking-data.ts
 */

// Load environment variables from .env file FIRST, before any other imports
// This ensures env vars are available when db.ts module loads
import { config } from 'dotenv';
import { resolve } from 'path';

// Explicitly load .env from project root
const envPath = resolve(process.cwd(), '.env');
const envResult = config({ path: envPath });

if (envResult.error) {
  console.error('⚠️  Warning: Could not load .env file:', envResult.error.message);
  console.log('   Trying to use environment variables directly...\n');
} else {
  console.log('✅ Loaded environment variables from .env file\n');
}

// Verify required env vars are present
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗ MISSING');
  console.error('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓' : '✗ MISSING');
  console.error('\nPlease ensure your .env file contains:');
  console.error('   SUPABASE_URL=https://xxxxx.supabase.co');
  console.error('   SUPABASE_ANON_KEY=eyJhbGc...\n');
  process.exit(1);
}

async function seedBookingData() {
  console.log('🌱 Starting seed data creation...\n');

  // Dynamically import db module after env vars are loaded
  const { getSupabaseClient } = await import('../src/app/lib/db');
  const db = getSupabaseClient();

  try {
    // 1. Create Providers
    console.log('📋 Creating providers...');
    const { data: providers, error: providersError } = await db
      .from('providers')
      .insert([
        {
          first_name: 'Sarah',
          last_name: 'Pearl',
          specialty_tags: ['General', 'Cosmetic'],
          is_active: true,
        },
        {
          first_name: 'Michael',
          last_name: 'Chen',
          specialty_tags: ['Orthodontics'],
          is_active: true,
        },
        {
          first_name: 'Emily',
          last_name: 'Rodriguez',
          specialty_tags: ['General', 'Hygiene'],
          is_active: true,
        },
        {
          first_name: 'David',
          last_name: 'Johnson',
          specialty_tags: ['Oral Surgery'],
          is_active: true,
        },
      ])
      .select();

    if (providersError) {
      throw new Error(`Failed to create providers: ${providersError.message}`);
    }

    console.log(`✅ Created ${providers.length} providers\n`);

    // 2. Create Operatories
    console.log('🏥 Creating operatories...');
    const { data: operatories, error: operatoriesError } = await db
      .from('operatories')
      .insert([
        {
          name: 'Room 1',
          tags: ['General', 'Hygiene'],
          is_active: true,
        },
        {
          name: 'Room 2',
          tags: ['General'],
          is_active: true,
        },
        {
          name: 'Room 3',
          tags: ['Hygiene'],
          is_active: true,
        },
        {
          name: 'Room 4',
          tags: ['General', 'Surgical'],
          is_active: true,
        },
        {
          name: 'Ortho Room',
          tags: ['Orthodontics'],
          is_active: true,
        },
        {
          name: 'Room 5',
          tags: ['General', 'Hygiene'],
          is_active: true,
        },
      ])
      .select();

    if (operatoriesError) {
      throw new Error(`Failed to create operatories: ${operatoriesError.message}`);
    }

    console.log(`✅ Created ${operatories.length} operatories\n`);

    // 3. Create Provider Schedules
    console.log('📅 Creating provider schedules...');
    
    // Helper to create schedules for a provider
    const createScheduleForProvider = async (providerId: number, operatoryIds: number[]) => {
      const schedules = [
        { day_of_week: 1, start_time: '09:00:00', end_time: '17:00:00' }, // Monday
        { day_of_week: 2, start_time: '09:00:00', end_time: '17:00:00' }, // Tuesday
        { day_of_week: 3, start_time: '09:00:00', end_time: '17:00:00' }, // Wednesday
        { day_of_week: 4, start_time: '09:00:00', end_time: '17:00:00' }, // Thursday
        { day_of_week: 5, start_time: '09:00:00', end_time: '17:00:00' }, // Friday
      ];

      const scheduleData = schedules.map(schedule => ({
        provider_id: providerId,
        ...schedule,
        operatory_ids: operatoryIds,
        is_active: true,
      }));

      const { error } = await db.from('provider_schedules').insert(scheduleData);
      if (error) {
        throw new Error(`Failed to create schedules for provider ${providerId}: ${error.message}`);
      }
    };

    // Create schedules for each provider
    if (providers && providers.length > 0 && operatories && operatories.length > 0) {
      await createScheduleForProvider(providers[0].id, [operatories[0].id, operatories[1].id]); // Dr. Pearl - Rooms 1, 2
      await createScheduleForProvider(providers[1].id, [operatories[4].id]); // Dr. Chen - Ortho Room
      await createScheduleForProvider(providers[2].id, [operatories[2].id, operatories[5].id]); // Dr. Rodriguez - Rooms 3, 5
      await createScheduleForProvider(providers[3].id, [operatories[3].id]); // Dr. Johnson - Room 4
    }

    console.log(`✅ Created provider schedules\n`);

    // 4. Create Patients
    console.log('👥 Creating patients...');
    const { data: patients, error: patientsError } = await db
      .from('patients')
      .insert([
        {
          first_name: 'John',
          last_name: 'Smith',
          phone: '5551234567',
          email: 'john.smith@example.com',
          date_of_birth: '1985-05-15',
        },
        {
          first_name: 'Jane',
          last_name: 'Doe',
          phone: '5552345678',
          email: 'jane.doe@example.com',
          date_of_birth: '1990-08-22',
        },
        {
          first_name: 'Robert',
          last_name: 'Johnson',
          phone: '5553456789',
          email: 'robert.j@example.com',
          date_of_birth: '1978-12-03',
        },
        {
          first_name: 'Maria',
          last_name: 'Garcia',
          phone: '5554567890',
          email: 'maria.garcia@example.com',
          date_of_birth: '1992-03-18',
        },
      ])
      .select();

    if (patientsError) {
      throw new Error(`Failed to create patients: ${patientsError.message}`);
    }

    console.log(`✅ Created ${patients.length} patients\n`);

    // 5. Create Sample Appointments
    console.log('📆 Creating sample appointments...');
    
    if (providers && providers.length > 0 && patients && patients.length > 0 && operatories && operatories.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      dayAfterTomorrow.setHours(14, 30, 0, 0);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0);

      const appointments = [
        {
          patient_id: patients[0].id,
          provider_id: providers[0].id,
          operatory_id: operatories[0].id,
          appointment_datetime: tomorrow.toISOString().slice(0, 19).replace('T', ' '),
          duration_minutes: 30,
          appointment_type: 'Cleaning',
          status: 'Scheduled' as const,
          notes: 'Regular cleaning appointment',
        },
        {
          patient_id: patients[1].id,
          provider_id: providers[0].id,
          operatory_id: operatories[1].id,
          appointment_datetime: dayAfterTomorrow.toISOString().slice(0, 19).replace('T', ' '),
          duration_minutes: 30,
          appointment_type: 'Checkup',
          status: 'Scheduled' as const,
          notes: 'Annual checkup',
        },
        {
          patient_id: patients[2].id,
          provider_id: providers[1].id,
          operatory_id: operatories[4].id,
          appointment_datetime: nextWeek.toISOString().slice(0, 19).replace('T', ' '),
          duration_minutes: 30,
          appointment_type: 'Consultation',
          status: 'Scheduled' as const,
          notes: 'Braces consultation',
        },
      ];

      const { data: createdAppointments, error: appointmentsError } = await db
        .from('appointments')
        .insert(appointments)
        .select();

      if (appointmentsError) {
        throw new Error(`Failed to create appointments: ${appointmentsError.message}`);
      }

      console.log(`✅ Created ${createdAppointments.length} appointments\n`);
    }

    console.log('✅ Seed data creation completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - ${providers?.length || 0} providers`);
    console.log(`   - ${operatories?.length || 0} operatories`);
    console.log(`   - ${patients?.length || 0} patients`);
    console.log(`   - Sample appointments created`);
    console.log('\n🎉 You can now test the embedded booking system!');

  } catch (error: any) {
    console.error('\n❌ Error seeding data:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the seed function
seedBookingData()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

