-- ============================================
-- Channel Configurations Migration
-- ============================================
-- Stores per-organization channel settings including:
-- - Which channels are enabled
-- - AI backend selection per channel
-- - Channel-specific settings (phone numbers, webhooks, etc.)
-- - Data integrations enabled per channel
-- - Custom instructions per channel
--
-- Run after: 046_google_calendar_integration.sql

-- Create channel_configurations table
CREATE TABLE IF NOT EXISTS channel_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('twilio', 'retell', 'whatsapp', 'web')),
  enabled BOOLEAN DEFAULT false,
  
  -- AI Backend: openai_realtime, openai_gpt4o, openai_gpt4o_mini, anthropic_claude
  ai_backend TEXT,
  
  -- Channel-specific settings (JSON)
  -- e.g., phone_number, websocket_url, agent_id, instance_name, etc.
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Data integrations enabled for this channel
  -- e.g., ['opendental', 'google_calendar']
  data_integrations TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Custom instructions override for this channel (optional)
  instructions TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each org can have one config per channel
  UNIQUE(organization_id, channel)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_channel_configs_org ON channel_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_channel_configs_channel ON channel_configurations(channel);
CREATE INDEX IF NOT EXISTS idx_channel_configs_enabled ON channel_configurations(enabled) WHERE enabled = true;

-- Add RLS policies
ALTER TABLE channel_configurations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their organization's channel configs
CREATE POLICY "channel_configs_select_own_org" ON channel_configurations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins can insert/update their organization's channel configs
CREATE POLICY "channel_configs_insert_own_org" ON channel_configurations
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "channel_configs_update_own_org" ON channel_configurations
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "channel_configs_delete_own_org" ON channel_configurations
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Service role bypass
CREATE POLICY "channel_configs_service_role" ON channel_configurations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments
COMMENT ON TABLE channel_configurations IS 'Per-organization configuration for each communication channel';
COMMENT ON COLUMN channel_configurations.channel IS 'Channel type: twilio (voice), retell (voice AI), whatsapp (messaging), web (browser chat)';
COMMENT ON COLUMN channel_configurations.ai_backend IS 'AI model/backend: openai_realtime, openai_gpt4o, openai_gpt4o_mini, anthropic_claude';
COMMENT ON COLUMN channel_configurations.settings IS 'Channel-specific settings like phone numbers, webhooks, agent IDs';
COMMENT ON COLUMN channel_configurations.data_integrations IS 'Array of enabled data integrations: opendental, google_calendar';
COMMENT ON COLUMN channel_configurations.instructions IS 'Optional channel-specific instruction override';

-- Insert default configurations for existing organizations
INSERT INTO channel_configurations (organization_id, channel, enabled, ai_backend, data_integrations)
SELECT 
  o.id,
  channel.name,
  CASE 
    WHEN channel.name = 'web' THEN true  -- Web is enabled by default
    ELSE false
  END,
  CASE 
    WHEN channel.name = 'twilio' THEN 'openai_realtime'
    WHEN channel.name = 'retell' THEN 'openai_gpt4o'
    WHEN channel.name = 'whatsapp' THEN 'openai_gpt4o'
    WHEN channel.name = 'web' THEN 'openai_realtime'
  END,
  ARRAY[]::TEXT[]
FROM organizations o
CROSS JOIN (VALUES ('twilio'), ('retell'), ('whatsapp'), ('web')) AS channel(name)
ON CONFLICT (organization_id, channel) DO NOTHING;

-- Create a helper view to get effective channel config with fallbacks
-- Note: Falls back to system-wide agent_configurations if no channel-specific instructions
CREATE OR REPLACE VIEW effective_channel_configs AS
SELECT 
  cc.id,
  cc.organization_id,
  cc.channel,
  cc.enabled,
  cc.ai_backend,
  cc.settings,
  cc.data_integrations,
  COALESCE(
    cc.instructions, 
    (SELECT ac.manual_ai_instructions 
     FROM agent_configurations ac 
     WHERE ac.organization_id = cc.organization_id 
     LIMIT 1),
    (SELECT ac.manual_ai_instructions 
     FROM agent_configurations ac 
     WHERE ac.organization_id IS NULL AND ac.scope = 'SYSTEM'
     LIMIT 1)
  ) as effective_instructions,
  o.name as organization_name
FROM channel_configurations cc
JOIN organizations o ON o.id = cc.organization_id;

COMMENT ON VIEW effective_channel_configs IS 'Channel configs with instruction fallback from agent_configurations';
