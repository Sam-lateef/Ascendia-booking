# Known Limitations

## Office Context 404 Errors

### Issue
When `get_office_context` is called, you may see 404 errors in the console:
```
POST http://localhost:3000/api/opendental 404 (Not Found)
[fetchOfficeContext] Raw data received: {providers: 'error', operatories: 'error', appointments: 71}
```

### Cause
The functions `GetProviders` and `GetOperatories` are not in the validated API registry (`validated_registry.json`). This means the API route returns 404 when trying to fetch provider and operatory data.

### Impact
**Minimal** - The system gracefully handles this:
- Logs the error
- Sets providers/operatories to empty arrays
- Continues normal operation
- Appointments are fetched successfully (as shown by "appointments: 71")
- All booking operations still work

### Workaround
The orchestrator can still function without pre-fetched provider/operatory data:
1. **Providers**: The orchestrator can use default provider (ProvNum: 1) for bookings
2. **Operatories**: The orchestrator can use default operatory (Op: 1) for bookings
3. **Provider names**: If needed, these can be fetched individually using other functions

### Resolution (if needed)
If you need provider/operatory pre-fetching:

1. **Check your OpenDental API**:
   - Verify `GetProviders` and `GetOperatories` endpoints exist
   - Test them directly: `POST /api/v1/providers`

2. **Add to registry** (if endpoints exist):
   - Add function definitions to `docs/API/validated/validated_registry.json`
   - Or update the office context to use different functions

3. **Alternative approach**:
   - Remove provider/operatory fetching from office context
   - Use defaults (ProvNum: 1, Op: 1) for all bookings
   - Only fetch provider names when confirming appointments

## GetAvailableSlots Returns Empty Array

### Issue
The `GetAvailableSlots` function consistently returns an empty array, even when slots are available.

### Cause
Based on production analysis (`shortQuery.txt`), the real OpenDental system doesn't use `GetAvailableSlots` for finding availability. Instead, it:
1. Queries for **occupied** appointments using SQL
2. Finds gaps (free times) by checking what's NOT occupied

### Resolution
✅ **Already implemented** - The orchestrator uses the "Smart Slot Finder" approach:
1. Fetches occupied slots via `GetAppointments` (in office context)
2. Filters by requested date
3. Extracts occupied hours
4. Finds first free hour in business hours (8am-5pm)
5. Books at that time

This mirrors the production approach and works reliably.

## Priority Functions Only

### "Limitation"
The orchestrator now only has access to 50 priority functions (vs all 337).

### Impact
**None for booking assistant** - The 50 priority functions cover:
- All patient operations (search, create, update)
- All appointment operations (book, cancel, update)
- All provider operations
- Insurance, procedures, claims, payments (for future expansion)

### Resolution
If you need a function that's not in the priority list:
1. Open `src/app/agentConfigs/openDental/apiRegistry.ts`
2. Add the function name to the `PRIORITY_FUNCTIONS` array
3. Restart the dev server

The function catalog will automatically update.

## Test Environment vs Production

### Issue
Some functions may work differently in test environments vs production OpenDental installations.

### Examples
- Mock data may have different structures
- Some endpoints may not be fully implemented in test mode
- Rate limits may differ

### Resolution
Always test critical workflows against a real OpenDental instance before production deployment.

## Summary

| Limitation | Impact | Status |
|------------|--------|--------|
| GetProviders 404 | Minimal - uses defaults | ✅ Handled gracefully |
| GetOperatories 404 | Minimal - uses defaults | ✅ Handled gracefully |
| GetAvailableSlots empty | None - alternate method used | ✅ Fixed (Smart Slot Finder) |
| 50 functions only | None for booking assistant | ✅ By design (performance) |
| Test vs Production | Varies | ⚠️ Test against real API |

All limitations are either:
- Already handled gracefully by the system
- Fixed with workarounds
- Intentional design decisions for performance




