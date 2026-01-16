# Multi-Tenancy Implementation Plan for Agent0

**Status:** Foundation Complete ✅  
**Database:** Ready  
**Application:** Pending 🟡  
**Last Updated:** 2026-01-16

---

## 🎯 Overview

Agent0 is now a **full SaaS platform** with multi-tenancy support via:
- Shared database with Row-Level Security (RLS)
- Organizations as tenants
- User authentication with Supabase Auth
- Role-based permissions

---

## ✅ Completed

### **Database Layer** (Migrations 000, 001)

1. ✅ **Organizations table** - Tenants with plans, billing, settings
2. ✅ **Users table** - Platform users across all organizations
3. ✅ **Organization_members table** - User-org relationships with roles
4. ✅ **organization_id added to ALL tables** (13+ tables)
5. ✅ **RLS policies** on all tables for data isolation
6. ✅ **Helper functions**: `get_current_organization_id()`, `has_permission()`
7. ✅ **Default organization** created for data migration
8. ✅ **Existing data migrated** to default organization

---

## 🚧 Pending Implementation

### **Phase 1: Authentication Setup** (4-6 hours)

#### 1.1 Enable Supabase Auth
```bash
# In Supabase Dashboard:
1. Go to Authentication → Settings
2. Enable Email provider
3. Configure Site URL: https://your-app-domain.com
4. Add Redirect URLs
```

#### 1.2 Create Auth Context
**File:** `src/app/contexts/AuthContext.tsx`
```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/app/lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Get initial session
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

#### 1.3 Create Organization Context
**File:** `src/app/contexts/OrganizationContext.tsx`
```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  setCurrentOrganization: (org: Organization) => void;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserOrganizations();
    } else {
      setOrganizations([]);
      setCurrentOrganization(null);
      setLoading(false);
    }
  }, [user]);

  const loadUserOrganizations = async () => {
    try {
      const response = await fetch('/api/user/organizations');
      const data = await response.json();
      setOrganizations(data.organizations || []);
      
      // Set first org as current (or load from localStorage)
      const savedOrgId = localStorage.getItem('currentOrgId');
      const currentOrg = data.organizations.find((o: Organization) => o.id === savedOrgId) 
                         || data.organizations[0];
      setCurrentOrganization(currentOrg || null);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrentOrganization = (org: Organization) => {
    setCurrentOrganization(org);
    localStorage.setItem('currentOrgId', org.id);
  };

  return (
    <OrganizationContext.Provider value={{
      currentOrganization,
      organizations,
      setCurrentOrganization: handleSetCurrentOrganization,
      loading,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider');
  return context;
}
```

#### 1.4 Create Login/Signup Pages
**Files:**
- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`
- `src/app/auth/callback/page.tsx`

---

### **Phase 2: API Middleware** (3-4 hours)

#### 2.1 Create Organization Middleware
**File:** `src/middleware.ts`
```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession();

  // Protected routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Get user's current organization
    const orgId = request.cookies.get('currentOrgId')?.value;
    
    if (orgId) {
      // Set organization context for RLS
      await supabase.rpc('set_config', {
        key: 'app.current_org_id',
        value: orgId,
      });
    }
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
```

#### 2.2 Update Supabase Client
**File:** `src/app/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

// Client for browser use
export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Admin client for API routes
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Client with organization context
export async function getSupabaseWithOrg(organizationId: string) {
  const supabase = getSupabaseAdmin();
  
  // Set organization context for RLS
  await supabase.rpc('set_config', {
    key: 'app.current_org_id',
    value: organizationId,
  });
  
  return supabase;
}
```

---

### **Phase 3: Update API Routes** (8-12 hours)

#### 3.1 Create Helper Function
**File:** `src/app/lib/apiHelpers.ts`
```typescript
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabase';

export async function getCurrentOrganization(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  
  // Get user from session
  const { data: { user } } = await supabase.auth.getUser(
    request.headers.get('Authorization')?.replace('Bearer ', '') || ''
  );
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  // Get organization from cookie or header
  const orgId = request.cookies.get('currentOrgId')?.value 
                || request.headers.get('X-Organization-Id');
  
  if (!orgId) {
    throw new Error('No organization context');
  }
  
  // Verify user belongs to organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .single();
  
  if (!membership) {
    throw new Error('User not member of organization');
  }
  
  return {
    user,
    organizationId: orgId,
    role: membership.role,
    permissions: membership.permissions,
  };
}
```

#### 3.2 Update ALL API Routes (30-50 routes)

**Example:** `src/app/api/admin/booking/providers/route.ts`
```typescript
// BEFORE (single-tenant)
export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('providers').select('*');
  return NextResponse.json({ providers: data });
}

// AFTER (multi-tenant)
export async function GET(request: NextRequest) {
  const { organizationId } = await getCurrentOrganization(request);
  const supabase = await getSupabaseWithOrg(organizationId);
  
  const { data } = await supabase
    .from('providers')
    .select('*')
    .eq('organization_id', organizationId);
  
  return NextResponse.json({ providers: data });
}
```

**Routes that need updating (~50 routes):**
- `/api/admin/booking/*` (providers, patients, appointments, schedules, operatories)
- `/api/admin/agents/*`
- `/api/admin/whatsapp/*` (already has org context)
- `/api/admin/translations/*`
- `/api/treatment-plans/*`
- `/api/treatments-catalog/*`
- `/api/booking/*`
- `/api/conversation/*`
- All agent config routes

---

### **Phase 4: Update Admin UI** (6-10 hours)

#### 4.1 Add Providers to Layout
**File:** `src/app/layout.tsx`
```typescript
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <OrganizationProvider>
            {children}
          </OrganizationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

#### 4.2 Add Organization Switcher
**File:** `src/components/OrganizationSwitcher.tsx`
```typescript
'use client';

import { useOrganization } from '@/app/contexts/OrganizationContext';

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, setCurrentOrganization } = useOrganization();
  
  if (organizations.length <= 1) return null;
  
  return (
    <select 
      value={currentOrganization?.id || ''}
      onChange={(e) => {
        const org = organizations.find(o => o.id === e.target.value);
        if (org) setCurrentOrganization(org);
      }}
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
```

#### 4.3 Update Admin Pages
- Add `useOrganization()` hook to get current org
- Pass org context to API calls
- Add organization switcher to navigation

---

### **Phase 5: Testing & Validation** (4-6 hours)

#### 5.1 Create Test Organizations
```sql
-- Test Clinic A
INSERT INTO organizations (name, slug) 
VALUES ('Test Clinic A', 'test-clinic-a');

-- Test Clinic B
INSERT INTO organizations (name, slug) 
VALUES ('Test Clinic B', 'test-clinic-b');

-- Create test users
INSERT INTO users (email, first_name, last_name)
VALUES 
  ('admin-a@test.com', 'Admin', 'A'),
  ('admin-b@test.com', 'Admin', 'B');

-- Link users to organizations
INSERT INTO organization_members (user_id, organization_id, role)
SELECT u.id, o.id, 'owner'
FROM users u, organizations o
WHERE (u.email = 'admin-a@test.com' AND o.slug = 'test-clinic-a')
   OR (u.email = 'admin-b@test.com' AND o.slug = 'test-clinic-b');
```

#### 5.2 Test Data Isolation
1. Login as Admin A → Create provider
2. Login as Admin B → Verify can't see Admin A's provider
3. Test all CRUD operations across organizations
4. Verify RLS is working

#### 5.3 Test Supabase Client
```typescript
// Test RLS isolation
const clientA = await getSupabaseWithOrg('clinic-a-id');
const providersA = await clientA.from('providers').select('*');
// Should only see Clinic A's providers

const clientB = await getSupabaseWithOrg('clinic-b-id');
const providersB = await clientB.from('providers').select('*');
// Should only see Clinic B's providers
```

---

## 📋 Implementation Checklist

### **Database** ✅
- [x] Create organizations table
- [x] Create users table  
- [x] Create organization_members table
- [x] Add organization_id to all tables
- [x] Enable RLS on all tables
- [x] Create helper functions
- [x] Migrate existing data

### **Authentication** 🟡
- [ ] Enable Supabase Auth
- [ ] Create AuthContext
- [ ] Create OrganizationContext
- [ ] Create login page
- [ ] Create signup page
- [ ] Create auth callback page

### **Middleware** 🟡
- [ ] Create middleware for auth check
- [ ] Set organization context in requests
- [ ] Update Supabase client helpers

### **API Routes** 🟡
- [ ] Create `getCurrentOrganization()` helper
- [ ] Update providers routes (5 routes)
- [ ] Update patients routes (4 routes)
- [ ] Update appointments routes (6 routes)
- [ ] Update schedules routes (3 routes)
- [ ] Update operatories routes (3 routes)
- [ ] Update treatments routes (4 routes)
- [ ] Update conversation routes (3 routes)
- [ ] Update agent config routes (5 routes)
- [ ] Update WhatsApp routes (already has org) ✅
- [ ] Update translation routes (4 routes)

### **Admin UI** 🟡
- [ ] Add providers to layout
- [ ] Create organization switcher component
- [ ] Update booking dashboard
- [ ] Update providers page
- [ ] Update patients page
- [ ] Update appointments page
- [ ] Update schedules page
- [ ] Update operatories page
- [ ] Update treatments pages
- [ ] Update WhatsApp page (already has org) ✅
- [ ] Update settings pages

### **Testing** 🟡
- [ ] Create test organizations
- [ ] Create test users
- [ ] Test data isolation
- [ ] Test RLS policies
- [ ] Test permission system
- [ ] End-to-end testing

---

## 🚀 Getting Started

### **Step 1: Run Database Migrations**
```bash
# Run migrations in order
psql $DATABASE_URL < supabase/migrations/000_multi_tenancy_foundation.sql
psql $DATABASE_URL < supabase/migrations/001_add_organization_id_to_tables.sql
psql $DATABASE_URL < supabase/migrations/042_whatsapp_integration.sql
```

Or with Supabase CLI:
```bash
npx supabase db push
```

### **Step 2: Create First Organization & User**
```sql
-- Create your organization
INSERT INTO organizations (name, slug, plan, status)
VALUES ('Your Clinic', 'your-clinic', 'professional', 'active');

-- Create your user (after Supabase Auth signup)
INSERT INTO users (auth_user_id, email, first_name, last_name)
VALUES ('your-auth-uuid', 'you@clinic.com', 'Your', 'Name');

-- Link user to organization as owner
INSERT INTO organization_members (user_id, organization_id, role)
SELECT u.id, o.id, 'owner'
FROM users u, organizations o
WHERE u.email = 'you@clinic.com' 
  AND o.slug = 'your-clinic';
```

### **Step 3: Start Implementation**
Follow phases 1-5 above in order.

---

## 📚 Resources

- [Supabase Multi-Tenancy Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js Auth Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)

---

**Total Estimated Time:** 31-49 hours (1-2 weeks)

**Priority:** High - Required for SaaS launch

**Status:** Database ready ✅ | Application pending 🟡
