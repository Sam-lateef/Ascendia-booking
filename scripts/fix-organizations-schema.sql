-- Fix organizations table schema to match multi-tenancy migration
-- This adds missing columns to the existing organizations table

BEGIN;

-- Add missing columns to organizations table
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS website TEXT;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS max_providers INTEGER DEFAULT 10;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS max_whatsapp_instances INTEGER DEFAULT 1;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#3b82f6';

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::JSONB;

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

-- Add constraints if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organizations_plan_check'
  ) THEN
    ALTER TABLE organizations 
      ADD CONSTRAINT organizations_plan_check 
      CHECK (plan IN ('free', 'starter', 'professional', 'enterprise'));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organizations_status_check'
  ) THEN
    ALTER TABLE organizations 
      ADD CONSTRAINT organizations_status_check 
      CHECK (status IN ('active', 'suspended', 'cancelled', 'trial'));
  END IF;
END $$;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan);
CREATE INDEX IF NOT EXISTS idx_organizations_created ON organizations(created_at DESC);

-- Now create the organization_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role & Permissions
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'member')),
  
  -- Permissions (JSONB for flexibility)
  permissions JSONB DEFAULT '{
    "appointments": {"read": true, "write": false, "delete": false},
    "patients": {"read": true, "write": false, "delete": false},
    "providers": {"read": true, "write": false, "delete": false},
    "settings": {"read": false, "write": false, "delete": false},
    "whatsapp": {"read": false, "write": false, "delete": false},
    "billing": {"read": false, "write": false, "delete": false}
  }'::JSONB,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, user_id)
);

-- Create indexes for organization_members
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);

-- Create a membership record for existing users
-- Find the user associated with the sam.lateeff org and create the membership
INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
SELECT 
  'b445a9c7-af93-4b4a-a975-40d3f44178ec'::UUID,
  u.id,
  'owner',
  'active',
  NOW()
FROM users u
WHERE u.email LIKE '%sam.lateeff%' OR u.email LIKE '%samlateeff%'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Verify the schema
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
  AND table_schema = 'public'
ORDER BY ordinal_position;

COMMIT;
