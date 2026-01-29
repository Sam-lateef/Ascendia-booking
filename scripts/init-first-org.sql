-- ============================================================================
-- Initialize First Organization and Admin User
-- ============================================================================
-- After signup, update the variables below and run this script
-- ============================================================================

-- STEP 1: Sign up at http://localhost:3000/signup first!
-- STEP 2: Check your Supabase dashboard -> Authentication -> Users -> Copy your user UUID
-- STEP 3: Replace 'YOUR-AUTH-USER-UUID-HERE' below with your actual UUID
-- STEP 4: Run this script

BEGIN;

-- Create organization
INSERT INTO organizations (name, slug, plan, status)
VALUES ('Demo Clinic', 'demo-clinic', 'professional', 'active')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
RETURNING id;
-- Copy the returned organization ID

-- Create user record (replace YOUR-AUTH-USER-UUID-HERE and YOUR-EMAIL-HERE)
INSERT INTO users (auth_user_id, email, first_name, last_name)
VALUES (
  'YOUR-AUTH-USER-UUID-HERE',  -- Replace with your Supabase auth user ID
  'YOUR-EMAIL-HERE',            -- Replace with your email
  'Admin',
  'User'
)
ON CONFLICT (auth_user_id) DO UPDATE SET email = EXCLUDED.email
RETURNING id;
-- Copy the returned user ID

-- Link user to organization (replace IDs from above)
INSERT INTO organization_members (user_id, organization_id, role)
VALUES (
  'USER-ID-FROM-ABOVE',         -- Replace with user ID from above
  'ORG-ID-FROM-ABOVE',          -- Replace with organization ID from above
  'owner'
)
ON CONFLICT (user_id, organization_id) DO NOTHING;

COMMIT;

-- ============================================================================
-- Verify setup
-- ============================================================================
SELECT 
  o.name as organization,
  u.email as user_email,
  om.role
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
JOIN users u ON om.user_id = u.id;
