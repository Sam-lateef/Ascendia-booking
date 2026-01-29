# CRUD Operations Audit - Missing organization_id
**Date:** 2026-01-16  
**Status:** ⚠️ CRITICAL ISSUES FOUND

## Summary
Found **7 critical files** with INSERT/UPDATE operations missing `organization_id`.

---

## ❌ CRITICAL: Missing organization_id

### 1. **src/app/api/booking/functions/providers.ts**
**Issue:** CreateProvider INSERT missing organization_id

**Location:** Line 93
```typescript
.insert({
  first_name: firstName,
  last_name: lastName,
  specialty_tags: tagsArray,
  is_active: is_active !== undefined ? is_active : true
  // ❌ MISSING: organization_id
})
```

**Fix Needed:** Add `organization_id: organizationId,`

---

### 2. **src/app/api/booking/functions/schedules.ts**
**Issue:** CreateSchedule INSERT missing organization_id

**Location:** Line 278
```typescript
.insert({
  provider_id: providerId,
  operatory_id: operatoryId,
  schedule_date: scheduleDate,
  start_time: startTime,
  end_time: endTime,
  is_active: active
  // ❌ MISSING: organization_id
})
```

**Fix Needed:** Add `organization_id: organizationId,`

---

### 3. **src/app/api/booking/functions/patients.ts**
**Needs Verification:** Check CreatePatient function

---

### 4. **src/app/api/booking/functions/appointments.ts**
**Needs Verification:** Check CreateAppointment function

---

### 5. **src/app/api/booking/functions/operatories.ts**
**Needs Verification:** Check CreateOperatory function

---

### 6. **src/app/api/admin/agent-instructions/route.ts**
**Status:** ⚠️ System-level config (no org_id needed?)

**Note:** This updates `agent_configurations` which may be system-wide, not org-specific. Needs clarification.

---

### 7. **src/app/api/admin/seed-instructions/route.ts**
**Status:** ⚠️ System-level config (no org_id needed?)

**Note:** This upserts system agent config. Needs clarification if this should be org-specific.

---

## ✅ VERIFIED CORRECT

### ✅ src/app/api/treatment-plans/route.ts
- treatment_plans INSERT: ✅ Has organization_id
- treatment_plan_items INSERT: ✅ Has organization_id

### ✅ src/app/api/treatments-catalog/route.ts
- treatments_catalog INSERT: ✅ Has organization_id
- treatments_catalog UPDATE: ✅ No org_id needed (can't change org)

### ✅ src/app/api/admin/whatsapp/create-instance/route.ts
- whatsapp_instances INSERT: ✅ Has organization_id

### ✅ WhatsApp Update Operations
All WhatsApp UPDATE operations are status updates only, no org_id needed in UPDATE statements.

---

## 🔍 Analysis by Table

### Tables That NEED organization_id:

1. **providers** ❌ Missing in INSERT
2. **provider_schedules** ❌ Missing in INSERT
3. **patients** ❓ Needs check
4. **appointments** ❓ Needs check
5. **operatories** ❓ Needs check
6. **treatment_plans** ✅ Fixed
7. **treatment_plan_items** ✅ Fixed
8. **treatments_catalog** ✅ Fixed
9. **whatsapp_instances** ✅ Correct

### System Tables (May Not Need org_id):
- **agent_configurations** - System-wide config
- **validation_logs** - Needs verification
- **validation_settings** - Needs verification

---

## 🚨 Impact

**SEVERITY: HIGH**

Without organization_id in these INSERT operations:
1. Records will fail with NOT NULL constraint violation
2. Users cannot create new providers
3. Users cannot create new schedules
4. Multi-tenancy data isolation is broken

---

## 🔧 Fix Strategy

### Immediate Fixes Needed:
1. ✅ Check all booking functions (appointments, patients, providers, operatories, schedules)
2. ✅ Add organization_id to all INSERT statements
3. ✅ Verify organization_id is passed to these functions
4. ✅ Test each CRUD operation

### Files to Fix:
- [ ] src/app/api/booking/functions/providers.ts
- [ ] src/app/api/booking/functions/schedules.ts
- [ ] src/app/api/booking/functions/patients.ts (verify)
- [ ] src/app/api/booking/functions/appointments.ts (verify)
- [ ] src/app/api/booking/functions/operatories.ts (verify)

---

## Next Steps

1. Read each booking function file completely
2. Find all INSERT operations
3. Add `organization_id` parameter
4. Update function signatures to accept organizationId
5. Pass organizationId from route handler
6. Test each CRUD operation

---
