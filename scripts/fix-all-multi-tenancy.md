# Multi-Tenancy Fix Plan

## Functions to Fix (by file)

### ✅ Already Fixed:
- appointments.ts: GetAppointments, GetAvailableSlots
- patients.ts: GetAllPatients, GetMultiplePatients, GetPatient

### ⚠️ Need to Fix:

#### appointments.ts (4 functions)
- CreateAppointment - needs org filter on validation queries
- UpdateAppointment - needs org filter on validation queries
- BreakAppointment - needs org filter on GET query
- DeleteAppointment - needs org filter on DELETE query

#### patients.ts (3 functions)
- CreatePatient - already has org_id in params ✅
- UpdatePatient - needs org filter on UPDATE query
- DeletePatient - needs org filter on DELETE query

#### providers.ts (5 functions)
- GetProviders - needs org filter
- GetProvider - needs org filter
- CreateProvider - needs org_id insertion
- UpdateProvider - needs org filter
- DeleteProvider - needs org filter

#### operatories.ts (5 functions)
- GetOperatories - needs org filter
- GetOperatory - needs org filter
- CreateOperatory - needs org_id insertion
- UpdateOperatory - needs org filter
- DeleteOperatory - needs org filter

#### schedules.ts (8 functions)
- GetSchedules - needs org filter
- GetSchedule - needs org filter
- CreateSchedule - needs org_id insertion
- UpdateSchedule - needs org filter
- DeleteSchedule - needs org filter
- GetProviderSchedules - needs org filter
- CreateDefaultSchedules - needs org_id insertion
- CheckScheduleConflicts - needs org filter

## Pattern to Apply:

### For READ operations (GET):
```typescript
export async function GetSomething(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  let query = db.from('table').select('*');
  
  // CRITICAL: Filter by organization
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  // ... rest of query
}
```

### For CREATE operations:
```typescript
export async function CreateSomething(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { organization_id } = parameters;
  
  if (!organization_id && !organizationId) {
    throw new Error('organization_id is required');
  }
  
  const orgId = organization_id || organizationId;
  
  await db.from('table').insert({
    ...data,
    organization_id: orgId
  });
}
```

### For UPDATE/DELETE operations:
```typescript
export async function UpdateSomething(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  let query = db.from('table').update(data).eq('id', id);
  
  // CRITICAL: Only update within organization
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  await query;
}
```
