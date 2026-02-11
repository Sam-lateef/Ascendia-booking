-- Run this in Supabase SQL Editor to inspect first org and its users
-- Use the output to configure system org owner

-- 1. First org (by created_at)
SELECT 
  o.id as org_id,
  o.name as org_name,
  o.slug,
  o.created_at,
  o.status
FROM organizations o
WHERE o.deleted_at IS NULL
ORDER BY o.created_at ASC
LIMIT 1;

-- 2. All members of the first org with their roles
SELECT 
  om.id as member_id,
  om.role,
  om.status,
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name
FROM organization_members om
JOIN users u ON u.id = om.user_id
WHERE om.organization_id = (
  SELECT id FROM organizations WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1
)
ORDER BY 
  CASE om.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
  u.email;

-- 3. Summary: first org id for use in migration
SELECT id as first_org_id FROM organizations WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;
