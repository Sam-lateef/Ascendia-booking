# Supabase Client Patterns - Security Guide

## 🔒 Critical Security Rule

**NEVER use the anon key client (`db` from `./lib/db.ts`) in server-side API routes!**

The anon key is subject to Row Level Security (RLS) policies which can block legitimate queries or cause data to appear missing.

---

## ✅ Correct Patterns

### Pattern 1: System Operations (No User Context)
**Use**: `getSupabaseAdmin()` from `./lib/supabaseClient`

**When**: Webhooks, background jobs, system-level operations

**Example**:
```typescript
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  
  await supabase
    .from('conversations')
    .insert({ ... });
}
```

**Files using this pattern**:
- `src/app/api/retell/webhook/route.ts` ✅
- `src/app/lib/whatsapp/messageHandler.ts` ✅
- `src/app/lib/email/sendCallEndedEmail.ts` ✅
- `src/app/lib/callHelpers.ts` ✅

---

### Pattern 2: Multi-Tenant Queries (With User Context) 🛡️
**Use**: `getSupabaseWithOrg(organizationId)` from `./lib/supabaseClient`

**When**: API routes that query/modify org-specific data

**Why Better**: 
- Sets RLS context automatically
- **Defense in depth**: Even if you forget manual filters, RLS protects you
- Best practice for multi-tenant security

**Example**:
```typescript
import { getSupabaseWithOrg } from '@/app/lib/supabaseClient';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';

export async function GET(req: NextRequest) {
  // Get authenticated user's organization
  const context = await getCurrentOrganization(req);
  
  // Get Supabase client with RLS context set
  const supabase = await getSupabaseWithOrg(context.organizationId);
  
  // Query automatically filtered by organization through RLS
  const { data } = await supabase
    .from('conversations')
    .select('*');  // RLS automatically adds: WHERE organization_id = context.organizationId
    
  // Optional: Add explicit filter for clarity (redundant but explicit)
  // .eq('organization_id', context.organizationId)
  
  return NextResponse.json(data);
}
```

**Files using this pattern**:
- `src/app/api/booking/route.ts` ✅
- `src/app/lib/conversationState.ts` ✅ (fixed!)

---

### Pattern 3: Booking Functions (Parameterized)
**Use**: Accept `db` as parameter, default to `db` for backward compatibility

**Example**:
```typescript
import { db as defaultDb } from '@/app/lib/db';

export async function GetMultiplePatients(
  parameters: Record<string, any>, 
  db: any = defaultDb,  // Accept db as parameter
  organizationId?: string
): Promise<any[]> {
  let query = db.from('patients').select('*');
  
  // Always filter by organization
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  return query;
}
```

**Why This Works**:
- Caller passes `orgDb` from `getSupabaseWithOrg()`
- Default `db` is only used in tests/local dev
- Organization filter is explicit in code

**Files using this pattern**:
- `src/app/api/booking/functions/*.ts` ✅

---

## ❌ Wrong Patterns (NEVER Do This in API Routes)

### ❌ Pattern A: Using `db` Directly in API Routes
```typescript
import { db } from '@/app/lib/db';  // ❌ WRONG!

export async function GET(req: NextRequest) {
  const { data } = await db  // ❌ Uses anon key, subject to RLS
    .from('conversations')
    .select('*');
    
  return NextResponse.json(data);
}
```

**Problem**: 
- Uses anon key (subject to RLS blocking)
- May return 0 rows even if data exists
- Same issue we just fixed in `conversationState.ts`

---

### ❌ Pattern B: Service Key Without Org Filter
```typescript
const supabase = getSupabaseAdmin();  // Bypasses RLS

const { data } = await supabase
  .from('conversations')
  .select('*');  // ❌ Returns ALL orgs data!
```

**Problem**: 
- Returns data from ALL organizations
- Security vulnerability!

**Fix**: Always filter by organization:
```typescript
const supabase = getSupabaseAdmin();

const { data } = await supabase
  .from('conversations')
  .select('*')
  .eq('organization_id', organizationId);  // ✅ Filter by org
```

---

## 🎯 Quick Reference

| Use Case | Client to Use | Security Level |
|----------|---------------|----------------|
| Webhooks, system jobs | `getSupabaseAdmin()` | ⭐⭐⭐ Good (manual filtering) |
| API routes with user | `getSupabaseWithOrg(orgId)` | ⭐⭐⭐⭐⭐ Best (RLS + manual) |
| Booking functions | Accept `db` param | ⭐⭐⭐⭐ Good (caller's responsibility) |
| Client-side | Never use service key! | N/A |

---

## 🔍 How to Audit Your Code

### Step 1: Search for Problematic Imports
```bash
# Find any server-side code using 'db' from './lib/db'
grep -r "import.*db.*from.*'@/app/lib/db'" src/app/api/
```

### Step 2: Check If It's a Function Parameter
- ✅ If `db` is a function parameter: OK
- ❌ If `db` is used directly in API route: FIX IT

### Step 3: Check for Organization Filtering
```bash
# Find queries that might miss organization filtering
grep -r "\.from('conversations')" src/app/api/
grep -r "\.from('conversation_messages')" src/app/api/
```

Verify each has:
```typescript
.eq('organization_id', organizationId)
```

---

## 🚨 The Bug We Just Fixed

**File**: `src/app/lib/conversationState.ts`

**Before** (BROKEN):
```typescript
import { db } from './db';  // Anon key

export async function getConversationsFromSupabase(date, organizationId) {
  const dbAny = db as any;  // ❌ RLS blocks this!
  
  const { data } = await dbAny
    .from('conversations')
    .select('*')
    .eq('organization_id', organizationId);  // Filter present but RLS still blocks
    
  return data;  // Returns empty array even if data exists!
}
```

**After** (FIXED):
```typescript
import { getSupabaseWithOrg } from './supabaseClient';

export async function getConversationsFromSupabase(date, organizationId) {
  // Sets RLS context + bypasses RLS restrictions
  const dbAny = await getSupabaseWithOrg(organizationId) as any;  // ✅
  
  const { data } = await dbAny
    .from('conversations')
    .select('*')
    .eq('organization_id', organizationId);  // Double protection
    
  return data;  // ✅ Returns actual data!
}
```

---

## ✅ Action Items for Future Code

1. **New API Routes**: Always use `getSupabaseWithOrg()` when user context exists
2. **System Operations**: Use `getSupabaseAdmin()` for webhooks/jobs
3. **Always Filter**: Even with service key, explicitly filter by `organization_id`
4. **Code Reviews**: Check for `import { db }` in `/api/` routes
5. **Testing**: Test with multiple organizations to ensure no data leakage

---

**Status**: ✅ All current code audited and secure  
**Issue Fixed**: `conversationState.ts` now uses `getSupabaseWithOrg()`  
**Pattern Documented**: Follow this guide for all new code
