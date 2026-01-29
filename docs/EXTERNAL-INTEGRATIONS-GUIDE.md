# External Integrations Guide

## Overview

The Dynamic Integration System allows you to add external integrations (OpenDental, Dentrix, Google Calendar, etc.) through database configuration only, without code changes.

**Key Benefits:**
- Zero code changes for new integrations
- Per-organization configuration
- Dynamic parameter mapping
- Flexible authentication
- Configurable sync strategies

## Architecture

```
┌─────────────────────────────────────────┐
│  Agent Makes Function Call              │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  /api/integrations/[provider]           │
│  - Loads config from DB                 │
│  - Creates IntegrationExecutor          │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  IntegrationExecutor                    │
│  1. Load endpoint config                │
│  2. Map parameters (DB-driven)          │
│  3. Transform data (dates, phones)      │
│  4. Build HTTP request                  │
│  5. Add authentication                  │
│  6. Execute with retry                  │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  External API (OpenDental, Dentrix)     │
└─────────────────────────────────────────┘
```

## Database Tables

### 1. `external_integrations`
Provider configurations per organization.

**Key Fields:**
- `provider_key`: Unique identifier (e.g., 'dentrix', 'google_calendar')
- `api_base_url`: Base URL for API (e.g., 'https://api.dentrix.com/v1')
- `auth_type`: Authentication type ('api_key', 'bearer', 'oauth2', 'basic')
- `auth_config`: JSONB with auth configuration
- `default_headers`: Default HTTP headers
- `timeout_ms`: Request timeout (default: 30000)
- `retry_config`: Retry configuration

### 2. `integration_endpoints`
Function registry per integration.

**Key Fields:**
- `function_name`: Function to execute (e.g., 'CreateAppointment')
- `endpoint_path`: API endpoint path (e.g., '/appointments')
- `http_method`: HTTP method ('GET', 'POST', 'PUT', 'DELETE')
- `path_params`: Array of parameters in URL path
- `query_params`: Array of parameters in query string
- `body_params`: Array of parameters in request body
- `required_params`: Array of required parameters

### 3. `integration_parameter_maps`
Parameter name mapping and transformations.

**Key Fields:**
- `internal_name`: Internal parameter name (e.g., 'patient_id')
- `external_name`: External API parameter name (e.g., 'PatNum')
- `transform_type`: Transformation type ('rename', 'format_date', 'clean_phone')
- `transform_config`: JSONB with transformation rules

### 4. `integration_sync_configs`
Per-organization sync settings.

**Key Fields:**
- `sync_direction`: 'local_only', 'to_external', 'from_external', 'bidirectional'
- `sync_on_create`, `sync_on_update`, `sync_on_delete`: Boolean toggles
- `always_keep_local_copy`: Enable dual-write
- `conflict_resolution`: 'external_wins', 'local_wins', 'manual'

## Adding a New Integration: Dentrix Example

### Step 1: Create API Credentials

1. Go to **Admin > API Keys**
2. Click **Add Credential**
3. Select **"Other"** as credential type
4. Enter credential details:
   ```
   Name: Dentrix Production
   Description: Dentrix Ascend API credentials
   
   Fields:
   - api_url: https://api.dentrixascend.com/v1
   - api_key: your_dentrix_api_key
   ```
5. Save the credential

### Step 2: Insert Integration Configuration

```sql
-- Insert the integration provider
INSERT INTO external_integrations (
  organization_id,
  provider_key,
  provider_name,
  provider_type,
  api_base_url,
  api_version,
  auth_type,
  auth_config,
  default_headers,
  is_enabled
) VALUES (
  'your-org-id',
  'dentrix',
  'Dentrix Ascend',
  'dental_pms',
  'https://api.dentrixascend.com/v1',
  'v1',
  'api_key',
  '{
    "credential_type": "other",
    "credential_key": "api_key",
    "header_name": "X-API-Key"
  }'::jsonb,
  '{"Content-Type": "application/json"}'::jsonb,
  true
);
```

### Step 3: Define Endpoints

For each API function, insert an endpoint definition:

```sql
-- Example: CreateAppointment endpoint
INSERT INTO integration_endpoints (
  integration_id,
  function_name,
  category,
  description,
  endpoint_path,
  http_method,
  path_params,
  query_params,
  body_params,
  required_params
) VALUES (
  (SELECT id FROM external_integrations WHERE provider_key = 'dentrix' LIMIT 1),
  'CreateAppointment',
  'appointments',
  'Create a new appointment in Dentrix',
  '/appointments',
  'POST',
  '{}',  -- No path params
  '{}',  -- No query params
  '{PatientId, AppointmentDate, ProviderId, OperatoryId, Notes}',
  '{PatientId, AppointmentDate, ProviderId}'
);
```

### Step 4: Define Parameter Mappings

Map internal names to Dentrix's parameter names:

```sql
INSERT INTO integration_parameter_maps (
  endpoint_id,
  internal_name,
  external_name,
  transform_type,
  transform_config,
  direction
) VALUES
  (
    (SELECT id FROM integration_endpoints WHERE function_name = 'CreateAppointment' AND integration_id IN (SELECT id FROM external_integrations WHERE provider_key = 'dentrix')),
    'patient_id',
    'PatientId',
    'rename',
    '{}'::jsonb,
    'request'
  ),
  (
    (SELECT id FROM integration_endpoints WHERE function_name = 'CreateAppointment' AND integration_id IN (SELECT id FROM external_integrations WHERE provider_key = 'dentrix')),
    'appointment_date',
    'AppointmentDate',
    'format_date',
    '{"to": "YYYY-MM-DD HH:mm:ss"}'::jsonb,
    'request'
  );
```

### Step 5: Test the Integration

```bash
# Test via the dynamic API route
POST /api/integrations/dentrix
{
  "functionName": "CreateAppointment",
  "parameters": {
    "patient_id": 123,
    "appointment_date": "2025-12-05",
    "provider_id": 1,
    "operatory_id": 2,
    "notes": "Regular cleaning"
  }
}
```

The system will:
1. Load Dentrix integration config
2. Map `patient_id` → `PatientId`
3. Transform date format
4. Build HTTP POST to `https://api.dentrixascend.com/v1/appointments`
5. Add authentication header
6. Execute with retry logic

### Step 6: Configure Sync (Optional)

If you want dual-write (local + Dentrix):

```sql
INSERT INTO integration_sync_configs (
  organization_id,
  integration_id,
  sync_enabled,
  sync_direction,
  sync_on_create,
  sync_on_update,
  sync_on_delete,
  always_keep_local_copy,
  conflict_resolution
) VALUES (
  'your-org-id',
  (SELECT id FROM external_integrations WHERE provider_key = 'dentrix'),
  true,
  'to_external',
  true,
  true,
  false,
  true,  -- Keep local copy
  'external_wins'
);
```

## Authentication Types

### API Key

```json
{
  "auth_type": "api_key",
  "auth_config": {
    "credential_type": "other",
    "credential_key": "api_key",
    "header_name": "X-API-Key",
    "prefix": ""
  }
}
```

### Bearer Token

```json
{
  "auth_type": "bearer",
  "auth_config": {
    "credential_type": "other",
    "credential_key": "access_token"
  }
}
```

### Basic Auth

```json
{
  "auth_type": "basic",
  "auth_config": {
    "credential_type": "other",
    "username_key": "username",
    "password_key": "password"
  }
}
```

### OAuth2

```json
{
  "auth_type": "oauth2",
  "auth_config": {
    "credential_type": "other",
    "token_key": "access_token",
    "token_url": "https://api.example.com/oauth/token",
    "client_id_key": "client_id",
    "client_secret_key": "client_secret"
  }
}
```

## Parameter Transformations

### Date Formatting

```json
{
  "transform_type": "format_date",
  "transform_config": {
    "from": "YYYY-MM-DD",
    "to": "YYYY-MM-DD HH:mm:ss"
  }
}
```

### Phone Cleaning

```json
{
  "transform_type": "clean_phone",
  "transform_config": {}
}
```

Converts: `(619) 555-1234` → `6195551234`

### Case Transform

```json
{
  "transform_type": "case_transform",
  "transform_config": {
    "to": "title_case"
  }
}
```

Options: `lowercase`, `uppercase`, `title_case`

### Default Value

```json
{
  "transform_type": "default_value",
  "transform_config": {
    "value": 1
  }
}
```

## Testing Integrations

### 1. Test Credentials

In **Admin > API Keys**, click **Test** on a credential to verify connectivity.

### 2. Test via API

```bash
GET /api/integrations/dentrix
```

Returns available functions and integration status.

### 3. Test Function Call

```bash
POST /api/integrations/dentrix
{
  "functionName": "GetPatients",
  "parameters": {
    "last_name": "Smith"
  }
}
```

## Best Practices

1. **Start Simple**: Begin with read-only operations (GET endpoints)
2. **Test Thoroughly**: Use test credentials first
3. **Map Carefully**: Ensure parameter mappings are accurate
4. **Handle Errors**: Add error handling for failed syncs
5. **Monitor**: Check `last_sync_status` in sync configs
6. **Document**: Keep API documentation for each integration

## Troubleshooting

### Integration Not Found

- Verify `provider_key` matches exactly
- Check `is_enabled = true`
- Verify organization_id is correct

### Authentication Failed

- Test credentials using Test button
- Check `auth_config` format
- Verify credential keys match

### Parameter Errors

- Check parameter mappings
- Verify required_params are provided
- Review transform_config syntax

### Connection Timeouts

- Increase `timeout_ms` in integration config
- Check API base URL is reachable
- Verify network connectivity

## Migration Tools

For migrating existing integrations (like OpenDental) to the dynamic system, see:
- `scripts/migrate-opendental-to-dynamic.ts` (future)

## Further Reading

- [OpenDental Sync Configuration](./OPENDENTAL-SYNC-CONFIGURATION.md)
- [Multi-Tenant Setup](./MULTI-TENANCY-COMPLETE-FOUNDATION.md)
- [API Endpoints](./API-ENDPOINTS-AUDIT.md)
