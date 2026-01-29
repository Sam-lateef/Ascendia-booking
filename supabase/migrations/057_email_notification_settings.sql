-- ============================================================================
-- MIGRATION 057: Email Notification Settings
-- ============================================================================
-- Adds email notification configuration to organizations
-- ============================================================================

-- Add email notification settings to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
    "call_ended_email_enabled": true,
    "call_ended_recipients": [],
    "email_from": null,
    "include_recording_links": true,
    "include_transcript": true,
    "include_cost": true,
    "include_performance": true,
    "min_duration_to_notify": 10000
  }';

-- Add email tracking fields to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_recipients TEXT[],
  ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Create index for email tracking
CREATE INDEX IF NOT EXISTS idx_conversations_email_sent 
  ON conversations(email_sent, email_sent_at) 
  WHERE channel = 'voice';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN organizations.notification_settings IS 'Email notification configuration: recipients, triggers, content settings';
COMMENT ON COLUMN conversations.email_sent IS 'Whether call ended email was sent';
COMMENT ON COLUMN conversations.email_sent_at IS 'When the email was sent';
COMMENT ON COLUMN conversations.email_recipients IS 'Email addresses that received the notification';
COMMENT ON COLUMN conversations.email_error IS 'Error message if email sending failed';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 057 complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Added email notification settings:';
  RAISE NOTICE '  - organizations.notification_settings (configurable per org)';
  RAISE NOTICE '  - conversations.email_sent (tracking)';
  RAISE NOTICE '  - conversations.email_sent_at (timestamp)';
  RAISE NOTICE '  - conversations.email_recipients (who received it)';
  RAISE NOTICE '  - conversations.email_error (if failed)';
  RAISE NOTICE '';
  RAISE NOTICE 'Configure in UI:';
  RAISE NOTICE '  - Enable/disable email notifications';
  RAISE NOTICE '  - Set recipient email addresses';
  RAISE NOTICE '  - Customize FROM email';
  RAISE NOTICE '  - Control what data to include';
  RAISE NOTICE '';
END $$;
