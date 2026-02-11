# Deployment Checklist

## Pre-Deployment (Database)

### 1. Run Database Migrations (IN ORDER!)

```sql
-- Step 1: Run in Supabase SQL Editor
-- File: d:\Dev\Agent0\supabase\migrations\059_demo_emails.sql
-- This adds demo_emails table and call_analysis column
```

```sql
-- Step 2: Run in Supabase SQL Editor
-- File: d:\Dev\Agent0\scripts\setup-demo-org.sql
-- This renames org to 'Demo', sets slug='demo', and updates demo user
```

## Verification

After running migrations, verify:

```sql
-- Check demo_emails table exists
SELECT * FROM demo_emails LIMIT 1;

-- Check call_analysis column exists
SELECT id, call_analysis FROM conversations LIMIT 1;

-- Check demo org setup
SELECT id, name, slug FROM organizations WHERE id = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';

-- Check demo user
SELECT id, email FROM users WHERE email = 'demo@ascendia.ai';
```

## Deployment Commands

```powershell
# Deploy main app
fly deploy --config fly.toml

# Deploy WebSocket server
fly deploy --config fly-websocket.toml
```

## Post-Deployment Testing

### 1. Landing Page
- Visit https://[your-domain.com]/landing
- Check blue styling is applied
- Verify phone numbers display: +1 (850) 403-6622

### 2. Login Page
- Visit https://[your-domain.com]/login
- Click "Use Demo Credentials" button
- Verify it fills: demo@ascendia.ai / admin1234!
- Test login works

### 3. Demo Booking Flow
1. Visit landing page
2. Enter your email in "Email Notification Demo" section
3. Click "Register"
4. Call +1 (850) 403-6622
5. Complete a booking with AI receptionist
6. Verify:
   - Booking appears in "Recent Live Bookings" widget
   - You receive an email notification
   - Delete button works

### 4. Live Widget Updates
- Keep landing page open
- Make another test booking
- Verify widget auto-updates within 10 seconds

## Features Deployed

✅ Blue styling on landing/login/signup pages
✅ Demo credentials auto-fill button
✅ Live bookings widget with auto-refresh
✅ Email registration for demo notifications
✅ Delete booking functionality
✅ Demo org email routing (last 2 hours of registered emails)
✅ Call analysis tracking for booking display

## Troubleshooting

### Bookings not appearing in widget
- Check `call_analysis` field is populated in conversations table
- Verify org ID matches: `b445a9c7-af93-4b4a-a975-40d3f44178ec`

### Email notifications not received
- Check demo_emails table has your email
- Verify `last_used_at` is within last 2 hours
- Check org slug is 'demo' or name is 'Demo'

### Widget not updating
- Check browser console for API errors
- Verify `/api/demo/recent-bookings` endpoint is accessible
- Check polling interval (10 seconds)

## Environment Variables

Verify these are set in Fly.io:

```bash
# Check secrets
fly secrets list --app agent0

# Required for email notifications
RESEND_API_KEY=...
NEXT_PUBLIC_APP_URL=...
```

## Rollback Plan

If issues occur:

```sql
-- Remove demo_emails table
DROP TABLE IF EXISTS demo_emails CASCADE;

-- Remove call_analysis column
ALTER TABLE conversations DROP COLUMN IF EXISTS call_analysis;

-- Revert org changes
UPDATE organizations 
SET name = 'sam.lateeff', slug = 'sam-lateeff' 
WHERE id = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';
```

Then redeploy previous version:

```powershell
fly deploy --image [previous-image-tag]
```
