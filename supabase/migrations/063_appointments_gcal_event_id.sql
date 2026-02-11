-- Add google_calendar_event_id column to appointments table
-- Used by SyncManager to track the Google Calendar event associated with each appointment
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Index for lookup by Google Calendar event ID (used in syncFromGoogleCalendar)
CREATE INDEX IF NOT EXISTS idx_appointments_gcal_event_id 
  ON appointments (google_calendar_event_id) 
  WHERE google_calendar_event_id IS NOT NULL;
