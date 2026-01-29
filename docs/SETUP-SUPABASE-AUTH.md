# Supabase Authentication Setup Guide

**Status:** Required to run the application  
**Time Required:** 5-10 minutes

---

## 🚨 Current Error

You're seeing this error because Supabase authentication is not configured:

```
Supabase not configured. Set either:
  - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and
  - NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)
in your .env file
```

This is **expected** after implementing multi-tenancy. Let's fix it!

---

## ✅ Quick Setup (5 minutes)

### **Step 1: Create `.env.local` File**

Create a file named `.env.local` in the project root (`D:\Dev\Agent0\.env.local`) with this content:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database URL (for migrations)
DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# OpenAI (if using AI features)
OPENAI_API_KEY=sk-...
```

### **Step 2: Get Supabase Credentials**

#### **If you already have a Supabase project:**

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy these values to your `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → **anon/public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project API keys** → **service_role** → `SUPABASE_SERVICE_ROLE_KEY`
5. For **DATABASE_URL**:
   - Go to **Settings** → **Database**
   - Copy the **Connection string** → **URI** format
   - Replace `[YOUR-PASSWORD]` with your database password

#### **If you DON'T have a Supabase project yet:**

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Choose:
   - **Organization:** Create or select one
   - **Name:** "Agent0" or "YourClinic"
   - **Database Password:** Choose a strong password (save it!)
   - **Region:** Closest to you
4. Click **"Create new project"**
5. Wait 2-3 minutes for project setup
6. Follow the steps above to get your credentials

### **Step 3: Enable Email Authentication**

1. In your Supabase project dashboard
2. Go to **Authentication** → **Providers**
3. Find **Email** provider
4. Enable it (toggle switch)
5. Configure:
   - **Site URL:** `http://localhost:3000` (or your domain)
   - **Redirect URLs:** Add `http://localhost:3000/auth/callback`
6. Click **"Save"**

### **Step 4: Restart Development Server**

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

---

## 🗄️ Apply Database Migrations

Once Supabase is configured, you need to apply the multi-tenancy migrations:

### **Option 1: Using PowerShell Script**
```powershell
.\scripts\apply-multi-tenancy-migrations.ps1
```

### **Option 2: Manual with psql**
```bash
# Make sure you have the DATABASE_URL in your .env.local
psql $env:DATABASE_URL -f supabase\migrations\000_multi_tenancy_foundation.sql
psql $env:DATABASE_URL -f supabase\migrations\001_add_organization_id_to_tables.sql
psql $env:DATABASE_URL -f supabase\migrations\002_rls_config_helper.sql
psql $env:DATABASE_URL -f supabase\migrations\042_whatsapp_integration.sql
```

### **Option 3: Using Supabase CLI**
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-id

# Push migrations
supabase db push
```

---

## 🏥 Create Your First Organization

After migrations are applied, create your organization:

```sql
-- Run this in Supabase SQL Editor or psql

-- 1. Create your organization
INSERT INTO organizations (name, slug, plan, status)
VALUES ('Your Clinic', 'your-clinic', 'professional', 'active')
RETURNING id;
-- Copy the returned ID

-- 2. Sign up via the app at http://localhost:3000/signup
-- Use your email and create a password

-- 3. After signup, get your user ID from Supabase Dashboard:
-- Authentication → Users → Find your email → Copy UUID

-- 4. Create user record
INSERT INTO users (auth_user_id, email, first_name, last_name)
VALUES (
  'your-supabase-auth-uuid-here',
  'your@email.com',
  'Your',
  'Name'
)
RETURNING id;
-- Copy the returned ID

-- 5. Link user to organization as owner
INSERT INTO organization_members (user_id, organization_id, role)
VALUES (
  'your-user-id-from-step-4',
  'your-org-id-from-step-1',
  'owner'
);
```

---

## 🧪 Test It Works

1. Visit `http://localhost:3000`
2. You should be redirected to `/login`
3. Try logging in with your credentials
4. You should see your organization in the header
5. Try switching organizations (if you have multiple)
6. Test creating a provider or patient

---

## 🔧 Troubleshooting

### **Error: "Invalid API key"**
- Check that you copied the **full** key (they're very long!)
- Make sure you copied **anon/public** key, not service_role for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart the dev server after adding keys

### **Error: "Failed to connect to database"**
- Check your `DATABASE_URL` has the correct password
- Make sure you're not behind a firewall blocking port 5432
- Try connecting from Supabase Dashboard's SQL Editor first

### **Error: "Email provider not configured"**
- Go to Authentication → Providers
- Enable Email provider
- Add redirect URLs
- Save and wait 30 seconds

### **Error: "No organization found"**
- Make sure you ran the migrations
- Check if organizations table exists: `SELECT * FROM organizations;`
- Create an organization using the SQL above
- Link your user to the organization

### **Can't log in after signup**
- Check email for verification link
- Click the verification link
- Then try logging in

### **Still having issues?**
Check these:
1. `.env.local` is in the project root (same directory as `package.json`)
2. Variable names are spelled exactly as shown (case-sensitive)
3. No extra spaces or quotes around values
4. Restart dev server after ANY changes to `.env.local`
5. Clear browser cache and try again

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Multi-Tenancy Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## ✅ Checklist

- [ ] Created `.env.local` file
- [ ] Added Supabase credentials
- [ ] Enabled email auth in Supabase dashboard
- [ ] Added redirect URLs
- [ ] Restarted dev server
- [ ] Applied database migrations
- [ ] Created first organization
- [ ] Signed up and verified email
- [ ] Linked user to organization
- [ ] Successfully logged in
- [ ] Can see organization in header

---

**Once complete, you'll have a fully functional SaaS platform with multi-tenancy! 🎉**
