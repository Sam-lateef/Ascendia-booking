# Entity Optimization Migration - Column Name Fixes

## Issue
The migration was referencing incorrect column names that don't exist in the `entity_definitions` table.

## Root Cause
The migration used:
- ❌ `description` → Doesn't exist
- ❌ `zod_schema_type` → Doesn't exist
- ❌ `is_required` → Doesn't exist

The actual table schema has:
- ✅ `extraction_hint` (not `description`)
- ✅ `data_type` (not `zod_schema_type`)
- ✅ `display_name` (for user-friendly names)
- ✅ `validation_type` (for validation rules like 'phone', 'email')

## Files Fixed

### 1. Migration SQL
**File:** `supabase/migrations/20231209_entity_optimization.sql`

**Changes:**
- Updated `core_entities` view to use correct columns
- Updated `get_entities_for_workflow()` function to return correct columns
- Now returns: `display_name`, `data_type`, `extraction_hint`, `validation_type`

### 2. TypeScript Interfaces
**File:** `src/app/lib/workflows/optimizedEntityLoader.ts`

**Changes:**
- Updated `OptimizedEntity` interface
- Updated all mapping functions
- Updated fallback entities

**New interface:**
```typescript
export interface OptimizedEntity {
  id: string;
  name: string;
  display_name: string;
  data_type: string;
  extraction_hint: string;
  validation_type: string | null;
  is_core: boolean;
  extraction_priority: number;
  used_in_workflows: string[];
}
```

### 3. Two-Stage Extractor
**File:** `src/app/lib/workflows/twoStageExtractor.ts`

**Changes:**
- Updated entity schema building to use `data_type` and `extraction_hint`

### 4. API Routes
**File:** `src/app/api/admin/config/entities/route.ts`

**Changes:**
- POST: Now inserts correct columns with backward compatibility
- PUT: Now updates correct columns
- Supports both old names (for backward compat) and new names

**Backward compatibility:**
```typescript
data_type: body.data_type || body.zod_schema_type || 'string',
extraction_hint: body.extraction_hint || body.description,
```

### 5. Admin UI
**File:** `src/app/admin/config/entities/page.tsx`

**Changes:**
- Updated `Entity` interface
- Updated form fields
- Changed "Description" → "Extraction Hint"
- All references now use correct column names

---

## Migration Now Ready! ✅

The migration can now be applied successfully:

```bash
cd supabase
psql $DATABASE_URL < migrations/20231209_entity_optimization.sql
```

## Expected Output

```sql
-- New columns added
ALTER TABLE
ALTER TABLE
ALTER TABLE

-- Core entities marked (3 rows)
UPDATE 3

-- Workflow entities tagged
UPDATE 3  -- booking entities
UPDATE 3  -- reschedule entities
UPDATE 2  -- cancel entities
UPDATE 1  -- check entities

-- Views created
CREATE VIEW
CREATE VIEW

-- Helper function created
CREATE FUNCTION

-- Verification output
=== CORE ENTITIES (Always Extracted) ===
patient_name      | 1
phone_number      | 1
confirmation      | 1

=== ENTITIES BY WORKFLOW ===
book       | 6
reschedule | 5
cancel     | 4
check      | 3
```

---

## What Got Fixed

| Component | Old (Broken) | New (Fixed) |
|-----------|-------------|-------------|
| Column: Description | `description` | `extraction_hint` |
| Column: Type | `zod_schema_type` | `data_type` |
| Column: Display | (missing) | `display_name` |
| Column: Validation | (missing) | `validation_type` |
| Column: Required | `is_required` | (removed - not in schema) |

---

## Testing Checklist

After applying migration:

### 1. Verify columns exist
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'entity_definitions'
AND column_name IN ('used_in_workflows', 'is_core', 'extraction_priority');
```

**Expected:** 3 rows returned

### 2. Check core entities
```sql
SELECT * FROM core_entities;
```

**Expected:** patient_name, phone_number, confirmation (with priority 1)

### 3. Check entities by workflow
```sql
SELECT * FROM entities_by_workflow;
```

**Expected:**
- book: 6 entities
- reschedule: 5 entities
- cancel: 4 entities
- check: 3 entities

### 4. Test helper function
```sql
SELECT * FROM get_entities_for_workflow(
  (SELECT id FROM domains WHERE is_active = true LIMIT 1),
  'book'
);
```

**Expected:** Returns 6 entities with all correct columns

### 5. Test Admin UI
- Navigate to `/admin/config/entities`
- Should see "Optimization Stats" at top
- Try adding a new entity
- Should work without errors

---

## Notes

- ✅ **Backward compatibility maintained** in API routes
- ✅ **All TypeScript types updated**
- ✅ **UI updated to use correct field names**
- ✅ **Migration is idempotent** (safe to run multiple times due to `IF NOT EXISTS`)
- ✅ **No linter errors**

Ready to go! 🚀





















