# System Org Setup

## 1. Inspect first org and users (optional)

Run in Supabase SQL Editor to see current state:

```sql
-- From scripts/inspect-first-org-and-users.sql
```

## 2. Apply migration 062

Run `supabase/migrations/062_system_org_and_owner.sql` in Supabase SQL Editor, or:

```bash
supabase db push
```

This migration:
- Adds `is_system_org` to organizations
- Sets the **first org** (by `created_at`) as system org
- Makes the user with email containing `demo` the **only owner** of that org (demotes others to admin)

## 3. Result

- **System org owner** (demo user): sees "System Settings" in Settings nav → Platform config (OpenAI, Anthropic, Google OAuth App)
- **All org members** (all orgs): see Settings → Organization, Integrations, Phone Numbers, Channels, Notifications
- **System Settings** is only visible when logged in as system org owner

## 4. Customize the owner

To use a different email as system org owner, edit the migration before applying:

```sql
WHERE u.email ILIKE '%demo%'
-- Change to e.g.:
WHERE u.email = 'your-email@example.com'
```
