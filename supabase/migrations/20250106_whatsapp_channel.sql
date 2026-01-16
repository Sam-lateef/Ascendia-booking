-- Add WhatsApp Channel Support to Conversations
-- Migration: 20250106_whatsapp_channel.sql

-- Add channel field to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS channel TEXT 
CHECK (channel IN ('voice', 'sms', 'whatsapp', 'web')) 
DEFAULT 'voice';

-- Add WhatsApp-specific metadata
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS whatsapp_metadata JSONB DEFAULT '{}';

-- Index for filtering by channel
CREATE INDEX IF NOT EXISTS idx_conversations_channel 
ON conversations(channel);

-- Update existing conversations to set channel based on session_id prefix
UPDATE conversations 
SET channel = CASE 
  WHEN session_id LIKE 'twilio_%' THEN 'voice'
  WHEN session_id LIKE 'lexi_twilio_%' THEN 'sms'
  WHEN session_id LIKE 'whatsapp_%' THEN 'whatsapp'
  ELSE 'voice'
END
WHERE channel IS NULL;

COMMENT ON COLUMN conversations.channel IS 'Communication channel: voice, sms, whatsapp, web';
COMMENT ON COLUMN conversations.whatsapp_metadata IS 'WhatsApp-specific data: phone@s.whatsapp.net, profile info, etc.';


