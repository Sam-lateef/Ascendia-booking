-- ============================================
-- Google Calendar Integration
-- ============================================
-- Adds Google Calendar as a credential type and integration provider
--
-- Run after: 045_dynamic_integrations.sql

-- Add google_calendar to credential_type enum (if not exists)
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE
-- So we need to check first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'credential_type' AND e.enumlabel = 'google_calendar'
    ) THEN
        ALTER TYPE credential_type ADD VALUE 'google_calendar';
    END IF;
END $$;

-- Insert Google Calendar as an available integration provider template
-- This is a template that organizations can copy when they set up Google Calendar
INSERT INTO external_integrations (
  id,
  organization_id,
  provider_key,
  provider_name,
  provider_type,
  api_base_url,
  api_version,
  auth_type,
  auth_config,
  default_headers,
  timeout_ms,
  is_enabled,
  is_default,
  description,
  metadata
) 
SELECT 
  gen_random_uuid(),
  o.id,
  'google_calendar',
  'Google Calendar',
  'calendar',
  'https://www.googleapis.com/calendar/v3',
  'v3',
  'oauth2',
  jsonb_build_object(
    'credential_type', 'google_calendar',
    'token_type', 'refresh_token',
    'scope', 'https://www.googleapis.com/auth/calendar'
  ),
  '{"Content-Type": "application/json"}'::jsonb,
  30000,
  false, -- Disabled by default until credentials are added
  false,
  'Google Calendar integration for scheduling and availability',
  jsonb_build_object(
    'features', ARRAY['read_events', 'create_events', 'update_events', 'delete_events', 'free_busy']
  )
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM external_integrations ei 
  WHERE ei.organization_id = o.id AND ei.provider_key = 'google_calendar'
);

-- Insert Google Calendar endpoints
INSERT INTO integration_endpoints (integration_id, function_name, category, description, endpoint_path, http_method, path_params, query_params, body_params, required_params)
SELECT 
  ei.id,
  ep.function_name,
  ep.category,
  ep.description,
  ep.endpoint_path,
  ep.http_method,
  ep.path_params::text[],
  ep.query_params::text[],
  ep.body_params::text[],
  ep.required_params::text[]
FROM external_integrations ei
CROSS JOIN (VALUES
  ('GetCalendars', 'calendars', 'List all calendars', '/users/me/calendarList', 'GET', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('GetCalendar', 'calendars', 'Get a specific calendar', '/calendars/{calendarId}', 'GET', ARRAY['calendarId'], ARRAY[]::text[], ARRAY[]::text[], ARRAY['calendarId']),
  ('GetEvents', 'events', 'List events in a calendar', '/calendars/{calendarId}/events', 'GET', ARRAY['calendarId'], ARRAY['timeMin','timeMax','maxResults','singleEvents','orderBy'], ARRAY[]::text[], ARRAY['calendarId']),
  ('GetEvent', 'events', 'Get a specific event', '/calendars/{calendarId}/events/{eventId}', 'GET', ARRAY['calendarId','eventId'], ARRAY[]::text[], ARRAY[]::text[], ARRAY['calendarId','eventId']),
  ('CreateEvent', 'events', 'Create a new event', '/calendars/{calendarId}/events', 'POST', ARRAY['calendarId'], ARRAY[]::text[], ARRAY['summary','description','start','end','attendees','location','reminders'], ARRAY['calendarId','summary','start','end']),
  ('UpdateEvent', 'events', 'Update an existing event', '/calendars/{calendarId}/events/{eventId}', 'PUT', ARRAY['calendarId','eventId'], ARRAY[]::text[], ARRAY['summary','description','start','end','attendees','location','reminders'], ARRAY['calendarId','eventId']),
  ('DeleteEvent', 'events', 'Delete an event', '/calendars/{calendarId}/events/{eventId}', 'DELETE', ARRAY['calendarId','eventId'], ARRAY[]::text[], ARRAY[]::text[], ARRAY['calendarId','eventId']),
  ('GetFreeBusy', 'availability', 'Check free/busy status', '/freeBusy', 'POST', ARRAY[]::text[], ARRAY[]::text[], ARRAY['timeMin','timeMax','items'], ARRAY['timeMin','timeMax','items'])
) AS ep(function_name, category, description, endpoint_path, http_method, path_params, query_params, body_params, required_params)
WHERE ei.provider_key = 'google_calendar'
  AND NOT EXISTS (
    SELECT 1 FROM integration_endpoints ie2 
    WHERE ie2.integration_id = ei.id AND ie2.function_name = ep.function_name
  );

-- Insert parameter mappings for Google Calendar
INSERT INTO integration_parameter_maps (endpoint_id, internal_name, external_name, transform_type, transform_config, direction)
SELECT 
  ie.id,
  pm.internal_name,
  pm.external_name,
  pm.transform_type,
  pm.transform_config::jsonb,
  pm.direction
FROM integration_endpoints ie
JOIN external_integrations ei ON ie.integration_id = ei.id
CROSS JOIN (VALUES
  -- Event mappings
  ('start_time', 'start.dateTime', 'rename', '{}', 'request'),
  ('end_time', 'end.dateTime', 'rename', '{}', 'request'),
  ('start_date', 'start.date', 'rename', '{}', 'request'),
  ('end_date', 'end.date', 'rename', '{}', 'request'),
  ('title', 'summary', 'rename', '{}', 'request'),
  ('event_description', 'description', 'rename', '{}', 'request'),
  ('event_location', 'location', 'rename', '{}', 'request'),
  ('calendar_id', 'calendarId', 'rename', '{}', 'request'),
  ('event_id', 'eventId', 'rename', '{}', 'request'),
  -- Date formatting
  ('appointment_date', 'start.dateTime', 'format_date', '{"to": "yyyy-MM-ddTHH:mm:ssXXX"}', 'request'),
  -- Response mappings  
  ('id', 'event_id', 'rename', '{}', 'response'),
  ('summary', 'title', 'rename', '{}', 'response')
) AS pm(internal_name, external_name, transform_type, transform_config, direction)
WHERE ei.provider_key = 'google_calendar'
  AND ie.function_name IN ('CreateEvent', 'UpdateEvent', 'GetEvent', 'GetEvents')
  AND NOT EXISTS (
    SELECT 1 FROM integration_parameter_maps ipm 
    WHERE ipm.endpoint_id = ie.id AND ipm.internal_name = pm.internal_name AND ipm.direction = pm.direction
  );

-- Add google_calendar_event_id column to appointments table for tracking synced events
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Create index for fast lookup by Google Calendar event ID
CREATE INDEX IF NOT EXISTS idx_appointments_gcal_event_id ON appointments(google_calendar_event_id) WHERE google_calendar_event_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN appointments.google_calendar_event_id IS 'Google Calendar event ID for synced appointments';
COMMENT ON COLUMN external_integrations.metadata IS 'Integration-specific metadata. For Google Calendar: features array, oauth scopes';

-- Create a function to help set up Google Calendar sync
CREATE OR REPLACE FUNCTION setup_google_calendar_sync(
  p_org_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_integration_id UUID;
  v_sync_config_id UUID;
BEGIN
  -- Get the Google Calendar integration for this org
  SELECT id INTO v_integration_id
  FROM external_integrations
  WHERE organization_id = p_org_id AND provider_key = 'google_calendar';
  
  IF v_integration_id IS NULL THEN
    RAISE EXCEPTION 'Google Calendar integration not found for organization';
  END IF;
  
  -- Create or update sync config
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
    p_org_id,
    v_integration_id,
    true,
    'bidirectional',
    true,
    true,
    false,
    true,
    'latest_timestamp'
  )
  ON CONFLICT (organization_id, integration_id) 
  DO UPDATE SET
    sync_enabled = true,
    updated_at = NOW()
  RETURNING id INTO v_sync_config_id;
  
  -- Enable the integration
  UPDATE external_integrations
  SET is_enabled = true
  WHERE id = v_integration_id;
  
  RETURN v_sync_config_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION setup_google_calendar_sync IS 'Helper function to set up Google Calendar sync for an organization';
