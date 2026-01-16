# Database Migration Guide

## How to Apply the Migration

The migration file `supabase/migrations/001_initial_schema.sql` contains the SQL to create all tables for the embedded booking system. You need to apply it to your Supabase database.

### Option 1: Supabase Dashboard (Recommended - Easiest)

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
6. Paste it into the SQL editor
7. Click **Run** (or press Ctrl+Enter)
8. You should see "Success. No rows returned" - this means it worked!

### Option 2: Supabase CLI (If Installed)

If you have Supabase CLI installed:

```bash
# Link to your project (first time only)
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### Option 3: Direct PostgreSQL Connection

If you have the database connection string:

```bash
# Using psql
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f supabase/migrations/001_initial_schema.sql
```

## Verify Migration Applied

After running the migration, verify the tables were created:

1. In Supabase Dashboard, go to **Table Editor**
2. You should see these tables:
   - `providers`
   - `operatories`
   - `provider_schedules`
   - `patients`
   - `appointments`

## Troubleshooting

### "relation already exists" errors
- Tables already exist - this is OK, the migration uses `CREATE TABLE IF NOT EXISTS`
- You can safely re-run the migration

### Permission errors
- Make sure you're using the correct database credentials
- For Supabase Dashboard, you should have project owner/editor access

### Connection errors
- Verify your `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct in `.env`
- Check that your Supabase project is active

## Next Steps

After applying the migration:

1. Run the seed script to populate sample data:
   ```bash
   npm run seed:booking
   ```

2. Test the admin UI:
   - Visit `/admin/booking`
   - Login with password (default: `admin123` or set `NEXT_PUBLIC_ADMIN_PASSWORD`)

3. Test the agent:
   - Go to Agent UI
   - Select "Embedded Booking" from the scenario dropdown
   - Connect and try booking an appointment



































