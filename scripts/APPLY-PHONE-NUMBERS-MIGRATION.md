# Apply Phone Numbers Migration

## Quick Start

The `phone_numbers` table needs to be created in your Supabase database for Twilio organization routing to work.

## Option 1: Supabase Dashboard (Recommended - 30 seconds)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `vihlqoivkayhvxegytlc`

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Paste and Run SQL**
   - Open: `scripts/create-phone-numbers-table.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

4. **Verify Success**
   - You should see: "Success. No rows returned"
   - At the bottom, you'll see your phone number in the results:
     ```
     phone_number      | organization_id                      | channel | is_active | friendly_name
     +18504036622      | 00000000-0000-0000-0000-000000000001 | twilio  | true      | Main Support Line
     ```

## Option 2: Command Line (if psql is installed)

```bash
# Set your database URL (from Supabase Dashboard → Settings → Database)
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]/postgres"

# Run migration
psql $DATABASE_URL < scripts/create-phone-numbers-table.sql
```

## Option 3: Supabase CLI

```bash
cd supabase
npx supabase db push
```

## What This Does

1. **Creates `phone_numbers` table** - Maps phone numbers to organizations
2. **Adds indexes** - Fast lookups for incoming calls
3. **Sets up RLS policies** - Security for multi-tenant access
4. **Seeds your Twilio number** - `+18504036622` → Default Organization

## After Migration

Once applied, continue with:

```bash
# Verify the table exists
node scripts/seed-twilio-phone-numbers.js
```

## Troubleshooting

### "Table already exists"
- ✅ Good! The migration was already applied
- Skip to: `node scripts/seed-twilio-phone-numbers.js`

### "Organization not found"
- Run: `node scripts/setup-first-org-simple.js your-email@example.com`
- Then rerun migration

### "RLS policy already exists"
- ✅ Normal! The script handles this with `DROP POLICY IF EXISTS`
- Migration completed successfully

## Next Steps

After successful migration:
1. ✅ Phone number mapping → DONE
2. ⏭️ Update incoming-call handler (automatic)
3. ⏭️ Update WebSocket handler (automatic)
4. ⏭️ Test Twilio integration

---

**Note:** This is a one-time setup. You only need to do this once per Supabase project.
