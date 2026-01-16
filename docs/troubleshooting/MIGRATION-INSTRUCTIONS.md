# 🗄️ Database Migration Instructions

## Quick Start: Apply the Migration

The migration file `supabase/migrations/001_initial_schema.sql` needs to be applied to your Supabase database. **It won't run automatically** - you need to execute it manually.

### ✅ Easiest Method: Supabase Dashboard

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query** button

3. **Copy & Paste Migration**
   - Open `supabase/migrations/001_initial_schema.sql` in your editor
   - Copy **ALL** the contents (Ctrl+A, Ctrl+C)
   - Paste into the SQL Editor (Ctrl+V)

4. **Run the Migration**
   - Click the **Run** button (or press Ctrl+Enter)
   - Wait for "Success. No rows returned" message

5. **Verify Tables Created**
   - Go to **Table Editor** in left sidebar
   - You should see 5 tables:
     - ✅ `providers`
     - ✅ `operatories`
     - ✅ `provider_schedules`
     - ✅ `patients`
     - ✅ `appointments`

### 🔧 Alternative: Supabase CLI

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### 📋 What the Migration Creates

- **5 Tables**: providers, operatories, provider_schedules, patients, appointments
- **Indexes**: For fast queries on dates, patient IDs, provider IDs, etc.
- **Constraints**: Prevents double-booking, validates data
- **Triggers**: Auto-updates `updated_at` timestamps
- **Functions**: Helper function for timestamp updates

### ⚠️ Troubleshooting

**"relation already exists"**
- ✅ This is OK! The migration uses `CREATE TABLE IF NOT EXISTS`
- You can safely re-run the migration

**"permission denied"**
- Make sure you're logged into Supabase Dashboard with project owner/editor access
- Check that your database user has CREATE permissions

**"syntax error"**
- Make sure you copied the ENTIRE file, including all semicolons
- Check that there are no extra characters added

### 🎯 After Migration

Once the migration is applied:

1. **Seed Sample Data**:
   ```bash
   npm run seed:booking
   ```

2. **Test Admin UI**:
   - Visit http://localhost:3000/admin/booking
   - Login with password (default: `admin123`)

3. **Test Agent**:
   - Go to Agent UI
   - Select "Embedded Booking" scenario
   - Connect and try: "I need to book an appointment"

### 📝 Migration File Location

The migration file is located at:
```
supabase/migrations/001_initial_schema.sql
```

You can view it in your code editor or copy it directly from there.























