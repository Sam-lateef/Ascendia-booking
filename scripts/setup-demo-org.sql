-- Setup Demo Organization and User
-- Run this on your Supabase database

-- 1. Rename organization from sam.lateeff to Demo and set slug
UPDATE organizations
SET name = 'Demo',
    slug = 'demo',
    updated_at = NOW()
WHERE id = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';

-- 2. Get the auth user ID for sam.lateeff@gmail.com (we'll update this user)
-- First, let's check if demo@ascendia.ai already exists
-- If not, we'll update sam.lateeff@gmail.com to demo@ascendia.ai

-- Update the email and password in auth.users (Supabase auth table)
-- NOTE: Run this carefully - you may need to do this via Supabase Dashboard > Authentication
UPDATE auth.users
SET email = 'demo@ascendia.ai',
    encrypted_password = crypt('admin1234!', gen_salt('bf')),
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{email}',
      '"demo@ascendia.ai"'
    ),
    email_confirmed_at = NOW()
WHERE email = 'sam.lateeff@gmail.com';

-- Update the corresponding user record in our users table
UPDATE users
SET email = 'demo@ascendia.ai'
WHERE email = 'sam.lateeff@gmail.com';

-- Verify the changes
SELECT 
  id as org_id,
  name as org_name,
  updated_at
FROM organizations
WHERE id = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';

SELECT 
  id as user_id,
  email as user_email,
  updated_at
FROM users
WHERE email = 'demo@ascendia.ai';
