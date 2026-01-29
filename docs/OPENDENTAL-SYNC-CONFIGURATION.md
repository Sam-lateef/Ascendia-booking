# OpenDental Sync Configuration Guide

## Overview

This guide explains how to configure synchronization between your local booking system and OpenDental. The system supports multiple sync strategies to match different clinic workflows.

## Use Cases

### Scenario 1: Booking System Only
**"We want to use the booking system and AI, but not OpenDental"**

- **Sync Direction**: Local Only
- **Configuration**: Sync disabled or `sync_direction = 'local_only'`
- **Behavior**: All data stays in your local database
- **Best For**: Clinics starting fresh or not using OpenDental

### Scenario 2: Booking + OpenDental (Dual-Write)
**"We want to use both systems, with our booking system as primary"**

- **Sync Direction**: To External (Dual-Write)
- **Configuration**: `sync_direction = 'to_external'`, `always_keep_local_copy = true`
- **Behavior**: 
  - Data saved locally first
  - Then synced to OpenDental
  - Both systems stay in sync
  - If OpenDental sync fails, local data preserved
- **Best For**: Most clinics using OpenDental

### Scenario 3: AI Voice + OpenDental Only
**"We only want AI voice booking, write directly to OpenDental"**

- **Sync Direction**: To External (External Only)
- **Configuration**: `sync_direction = 'to_external'`, `always_keep_local_copy = false`
- **Behavior**:
  - Data written directly to OpenDental
  - No local copy kept
  - OpenDental is source of truth
- **Best For**: Clinics fully committed to OpenDental

### Scenario 4: Bidirectional Sync
**"We want changes in either system to sync to the other"**

- **Sync Direction**: Bidirectional
- **Configuration**: `sync_direction = 'bidirectional'`
- **Behavior**:
  - Changes flow both directions
  - Conflict resolution rules apply
  - Requires webhook setup
- **Best For**: Advanced setups with real-time sync needs

## Configuration Steps

### Step 1: Configure OpenDental API Credentials

1. Go to **Admin > API Keys**
2. Click **Add Credential**
3. Select **"OpenDental"**
4. Enter your credentials:
   ```
   API URL: https://api.opendental.com/api/v1
   API Key: ODFHIR your_dev_key/your_customer_key
   ```
5. Click **Test** to verify connectivity
6. Save the credential

### Step 2: Set Up Integration Sync

1. Go to **Admin > Settings > Integrations**
2. Find **OpenDental** in the list
3. Configure sync settings:

#### For Local Only:
```
✓ Sync Enabled: OFF
```

#### For Dual-Write (Recommended):
```
✓ Sync Enabled: ON
Sync Direction: To External (Dual Write)

Operation Toggles:
✓ Sync on Create: ON
✓ Sync on Update: ON
✓ Sync on Delete: OFF (recommended)

✓ Always keep local copy: ON

Conflict Resolution: External Wins
```

#### For External Only:
```
✓ Sync Enabled: ON
Sync Direction: To External (Dual Write)

Operation Toggles:
✓ Sync on Create: ON
✓ Sync on Update: ON
✓ Sync on Delete: OFF

✗ Always keep local copy: OFF

Conflict Resolution: External Wins
```

### Step 3: Test the Configuration

Create a test appointment to verify sync is working:

1. Book an appointment through the AI voice interface
2. Check local database (should see appointment)
3. Check OpenDental (should see appointment if sync enabled)
4. Verify sync status in **Admin > Settings > Integrations**

## Sync Behavior Details

### What Gets Synced

When sync is enabled, the following operations can be synced:

#### Appointments
- **Create**: New appointments
- **Update**: Reschedules, note changes, status updates
- **Delete**: Cancellations (if enabled)

#### Patients
- **Create**: New patient records
- **Update**: Contact information, demographics
- **Delete**: Patient removal (usually disabled)

### Sync Flow

#### Dual-Write Flow (Recommended)

```
1. User books appointment via AI
   ↓
2. SyncManager.createAppointment() called
   ↓
3. Create in local database FIRST
   ✓ Local appointment created (ID: 123)
   ↓
4. Check sync config
   → sync_enabled = true
   → sync_direction = 'to_external'
   → sync_on_create = true
   ↓
5. Sync to OpenDental
   → IntegrationExecutor executes CreateAppointment
   → OpenDental returns AptNum: 456
   ↓
6. Update local record with external_id
   → appointments.external_id = 456
   ↓
7. Return success to user
   ✓ Appointment 123 created locally
   ✓ Synced to OpenDental as 456
```

If OpenDental sync fails:
```
1-3. Same as above (local creation succeeds)
   ↓
4-5. Sync attempt to OpenDental
   ✗ Network error / API error
   ↓
6. Log error but DON'T fail local creation
   → last_sync_status = 'error'
   → last_sync_error = error message
   ↓
7. Return success to user
   ✓ Appointment created locally
   ⚠️ OpenDental sync failed (logged)
```

User still has their appointment, admin can review sync errors later.

### Error Handling

The system gracefully handles sync errors:

**What Happens on Sync Failure:**
1. Local operation completes successfully
2. Error is logged to `integration_sync_configs.last_sync_error`
3. `last_sync_status` set to 'error'
4. User is NOT affected (local appointment exists)
5. Admin can review errors in Integration Settings

**Common Sync Errors:**
- Network connectivity issues
- OpenDental API down
- Invalid credentials
- Data validation errors
- Duplicate entries

**How to Monitor:**
- Check **Admin > Settings > Integrations**
- Look for "Last sync" status
- Review error messages if status is "error"

## Conflict Resolution

When the same data exists in both systems, conflicts can occur.

### Strategies

#### External Wins (Default)
- OpenDental data takes precedence
- Local changes overwritten by external
- **Use when**: OpenDental is source of truth

#### Local Wins
- Local database data takes precedence
- External changes overwritten by local
- **Use when**: Your booking system is primary

#### Latest Timestamp Wins
- Most recent update takes precedence
- Compares `updated_at` timestamps
- **Use when**: Both systems equally important

#### Manual Resolution
- Conflicts flagged for admin review
- No automatic resolution
- **Use when**: Data integrity critical

### Conflict Scenarios

**Example 1**: Appointment rescheduled in both systems

```
Local: 2025-12-05 10:00 AM (updated 9:30 AM)
OpenDental: 2025-12-05 2:00 PM (updated 9:45 AM)

Resolution with "Latest Timestamp Wins":
→ OpenDental version chosen (9:45 AM is later)
→ Local updated to 2:00 PM
```

**Example 2**: Patient phone changed

```
Local: (619) 555-1234 (updated today)
OpenDental: (619) 555-5678 (updated yesterday)

Resolution with "External Wins":
→ OpenDental version chosen
→ Local updated to 555-5678

Resolution with "Local Wins":
→ Local version chosen
→ OpenDental updated to 555-1234
```

## Operation Toggles

### Sync on Create

**Enabled**: New records synced to OpenDental immediately
**Disabled**: New records stay local only

**Example**: Patient books appointment
- Enabled: Creates in local DB + OpenDental
- Disabled: Creates in local DB only

### Sync on Update

**Enabled**: Changes synced to OpenDental
**Disabled**: Changes stay local

**Example**: Patient reschedules
- Enabled: Updates local DB + OpenDental
- Disabled: Updates local DB only

### Sync on Delete

**Enabled**: Deletions synced to OpenDental
**Disabled**: Deletions local only

**Recommendation**: Keep DISABLED
- Deletions are permanent
- Safer to use status changes (cancelled, no-show)
- If enabled, uses BreakAppointment (soft delete) not DELETE

## Advanced Configuration

### Database Configuration

Direct database configuration for advanced users:

```sql
-- Get your integration ID
SELECT id, provider_name 
FROM external_integrations 
WHERE provider_key = 'opendental'
AND organization_id = 'your-org-id';

-- Update sync config
UPDATE integration_sync_configs
SET
  sync_enabled = true,
  sync_direction = 'to_external',
  sync_on_create = true,
  sync_on_update = true,
  sync_on_delete = false,
  always_keep_local_copy = true,
  conflict_resolution = 'external_wins'
WHERE integration_id = 'your-integration-id';
```

### API Configuration

Configure via API:

```bash
# Create sync config
POST /api/admin/integration-settings
{
  "integration_id": "integration-uuid",
  "sync_enabled": true,
  "sync_direction": "to_external",
  "sync_on_create": true,
  "sync_on_update": true,
  "sync_on_delete": false,
  "always_keep_local_copy": true,
  "conflict_resolution": "external_wins"
}

# Update existing config
PUT /api/admin/integration-settings/{config-id}
{
  "sync_enabled": true,
  "sync_on_update": false
}
```

## Monitoring & Troubleshooting

### Check Sync Status

1. Go to **Admin > Settings > Integrations**
2. Find OpenDental integration
3. Check "Last sync" timestamp and status

### View Sync Statistics

```sql
SELECT 
  sync_enabled,
  sync_direction,
  last_sync_at,
  last_sync_status,
  last_sync_error
FROM integration_sync_configs
WHERE integration_id IN (
  SELECT id FROM external_integrations 
  WHERE provider_key = 'opendental'
);
```

### Common Issues

#### "Sync always failing"

**Possible causes:**
- Invalid API credentials
- Network connectivity issues
- OpenDental API down
- Invalid data (missing required fields)

**Solutions:**
1. Test credentials: **Admin > API Keys > Test**
2. Check OpenDental API status
3. Review error message in sync config
4. Verify data completeness

#### "Appointments in local DB but not OpenDental"

**Possible causes:**
- Sync disabled
- `sync_on_create` set to false
- Sync errors occurred

**Solutions:**
1. Enable sync in integration settings
2. Check `sync_on_create` toggle
3. Review sync error logs
4. Manually retry failed syncs

#### "Duplicate appointments created"

**Possible causes:**
- Sync retried after success
- Conflict resolution issue
- Multiple syncs triggered

**Solutions:**
1. Check `external_id` field in local appointments
2. Review `last_sync_status`
3. Implement idempotency checks

## Best Practices

1. **Start with Dual-Write**: Safest option for most clinics
2. **Test Thoroughly**: Use test appointments first
3. **Monitor Errors**: Check sync status regularly
4. **Keep Sync Disabled for Deletes**: Use status changes instead
5. **Document Your Setup**: Note your configuration choices
6. **Regular Backups**: Backup both systems regularly
7. **Use External Wins**: Let OpenDental be source of truth (usually)
8. **Review Conflicts**: Check for data mismatches weekly

## Migration Path

### From Standalone to OpenDental Sync

1. **Current State**: Using local booking system only
2. **Goal**: Add OpenDental sync

**Steps:**
1. Configure OpenDental API credentials
2. Start with sync DISABLED
3. Test OpenDental connectivity
4. Enable sync with `always_keep_local_copy = true`
5. Test with a single appointment
6. Enable `sync_on_create` and `sync_on_update`
7. Monitor for 1-2 days
8. Roll out to all users

### From OpenDental to Hybrid

1. **Current State**: Using OpenDental only
2. **Goal**: Add local booking system with sync

**Steps:**
1. Set up local booking system
2. Configure OpenDental API credentials
3. Enable sync with `sync_direction = 'from_external'` (pull mode)
4. Import existing data from OpenDental
5. Switch to `bidirectional` sync
6. Test thoroughly
7. Roll out gradually

## FAQ

**Q: What happens if OpenDental is down?**  
A: With dual-write enabled, appointments are still created locally. They can be synced to OpenDental later when it's back up.

**Q: Can I disable sync temporarily?**  
A: Yes, toggle "Sync Enabled" OFF in integration settings.

**Q: Do I need to keep local data?**  
A: Recommended. Provides backup and faster queries. But you can disable with `always_keep_local_copy = false`.

**Q: How do I know if sync failed?**  
A: Check "Last sync status" in integration settings. Also logged in `integration_sync_configs` table.

**Q: Can I sync historical data?**  
A: Not automatically. You can write a script to sync existing data or import via OpenDental API.

**Q: What if I have multiple OpenDental locations?**  
A: Create separate integrations per location with different credentials and sync configs.

## Further Reading

- [External Integrations Guide](./EXTERNAL-INTEGRATIONS-GUIDE.md)
- [OpenDental API Documentation](../src/app/agentConfigs/openDental/README.md)
- [Multi-Tenant Setup](./MULTI-TENANCY-COMPLETE-FOUNDATION.md)
