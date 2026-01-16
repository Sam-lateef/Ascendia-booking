-- ============================================================================
-- MIGRATION 000: Multi-Tenancy Foundation for Agent0 SaaS
-- ============================================================================
-- Creates organizations, users, and authentication infrastructure
-- Must run BEFORE all other migrations
-- ============================================================================

-- ============================================================================
-- ORGANIZATIONS (TENANTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-safe identifier (e.g., "clinic-abc")
  
  -- Contact & Settings
  email TEXT,
  phone TEXT,
  website TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  
  -- Subscription & Limits
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'professional', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
  trial_ends_at TIMESTAMPTZ,
  
  -- Usage Limits (based on plan)
  max_users INTEGER DEFAULT 5,
  max_providers INTEGER DEFAULT 10,
  max_whatsapp_instances INTEGER DEFAULT 1,
  
  -- Billing
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  
  -- Configuration
  settings JSONB DEFAULT '{}'::JSONB,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan);
CREATE INDEX IF NOT EXISTS idx_organizations_created ON organizations(created_at DESC);

-- ============================================================================
-- USERS (STAFF/ADMINS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Auth0/Supabase Auth ID (links to auth.users)
  auth_user_id UUID UNIQUE, -- References Supabase auth.users(id)
  
  -- Basic Info
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- ============================================================================
-- ORGANIZATION MEMBERS (USER-ORG RELATIONSHIP)
-- ============================================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Get current user's organization from JWT or session
 * Used by RLS policies
 */
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS UUID AS $$
BEGIN
  -- Try to get from session variable (set by API middleware)
  RETURN NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get current user ID from JWT
 */
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  -- Try to get from Supabase auth.uid()
  RETURN auth.uid();
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to session variable
    RETURN NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Check if current user has permission for an action
 */
CREATE OR REPLACE FUNCTION has_permission(
  p_resource TEXT,
  p_action TEXT -- 'read', 'write', 'delete'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_role TEXT;
  v_permissions JSONB;
BEGIN
  v_user_id := get_current_user_id();
  v_org_id := get_current_organization_id();
  
  IF v_user_id IS NULL OR v_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get user's role and permissions
  SELECT role, permissions INTO v_role, v_permissions
  FROM organization_members
  WHERE user_id = v_user_id
    AND organization_id = v_org_id
    AND status = 'active';
  
  -- Owner and admin have all permissions
  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Check specific permission
  RETURN COALESCE(
    (v_permissions -> p_resource ->> p_action)::BOOLEAN,
    FALSE
  );
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get user's organizations
 */
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  role TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    om.role,
    om.status
  FROM organizations o
  INNER JOIN organization_members om ON om.organization_id = o.id
  WHERE om.user_id = p_user_id
    AND o.deleted_at IS NULL
    AND om.status = 'active'
  ORDER BY om.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- RLS POLICIES FOR MULTI-TENANCY
-- ============================================================================

-- Organizations: Users can only see orgs they belong to
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_policy ON organizations;
CREATE POLICY organizations_select_policy ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = get_current_user_id()
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS organizations_update_policy ON organizations;
CREATE POLICY organizations_update_policy ON organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = get_current_user_id()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Users: Can see themselves and members of their organizations
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_policy ON users;
CREATE POLICY users_select_policy ON users
  FOR SELECT
  USING (
    id = get_current_user_id()
    OR id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = get_current_user_id()
          AND status = 'active'
      )
    )
  );

-- Organization Members: Can see members of their organizations
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_select_policy ON organization_members;
CREATE POLICY org_members_select_policy ON organization_members
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = get_current_user_id()
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS org_members_insert_policy ON organization_members;
CREATE POLICY org_members_insert_policy ON organization_members
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = get_current_user_id()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on organizations
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on users
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on organization_members
CREATE TRIGGER org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DEFAULT ORGANIZATION
-- ============================================================================

-- Create default organization for existing data migration
INSERT INTO organizations (id, name, slug, plan, status)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Default Clinic',
  'default',
  'professional',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE organizations IS 'SaaS tenants - each organization is a separate clinic/practice';
COMMENT ON TABLE users IS 'Platform users - staff and admins across all organizations';
COMMENT ON TABLE organization_members IS 'User-organization relationships with roles and permissions';
COMMENT ON FUNCTION get_current_organization_id IS 'Get current org from session for RLS';
COMMENT ON FUNCTION has_permission IS 'Check if user has permission for resource action';
COMMENT ON FUNCTION get_user_organizations IS 'Get all organizations a user belongs to';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 000 complete - Multi-Tenancy Foundation';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - organizations table (SaaS tenants)';
  RAISE NOTICE '  - users table (platform users)';
  RAISE NOTICE '  - organization_members table (user-org relationships)';
  RAISE NOTICE '  - RLS policies for data isolation';
  RAISE NOTICE '  - Helper functions for permissions';
  RAISE NOTICE '  - Default organization (UUID: 00000000-0000-0000-0000-000000000001)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Run migration 001 to add organization_id to existing tables';
  RAISE NOTICE '';
END $$;
