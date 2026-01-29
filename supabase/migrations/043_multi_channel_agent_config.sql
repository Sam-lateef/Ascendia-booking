-- ============================================
-- Multi-Channel Agent Configuration Migration
-- ============================================
-- Adds support for:
-- 1. Per-organization agent configurations
-- 2. WhatsApp-specific instructions
-- 3. Channel-specific configurations (twilio/web/whatsapp)
--
-- Run after: 042_whatsapp_integration.sql

-- Add organization_id to agent_configurations (nullable for system-wide configs)
ALTER TABLE agent_configurations
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add WhatsApp instructions field
ALTER TABLE agent_configurations
ADD COLUMN IF NOT EXISTS whatsapp_instructions TEXT;

-- Add channel field to distinguish configs
ALTER TABLE agent_configurations
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'system' CHECK (channel IN ('twilio', 'web', 'whatsapp', 'system'));

-- Update existing system config to have channel = 'system'
UPDATE agent_configurations
SET channel = 'system'
WHERE scope = 'SYSTEM' AND channel IS NULL;

-- Create unique constraint per org + channel (only for org-specific configs)
DROP INDEX IF EXISTS idx_agent_config_org_channel;
CREATE UNIQUE INDEX idx_agent_config_org_channel 
ON agent_configurations(organization_id, channel)
WHERE organization_id IS NOT NULL;

-- Add comment explaining the schema
COMMENT ON COLUMN agent_configurations.organization_id IS 'NULL = system-wide config, UUID = org-specific config';
COMMENT ON COLUMN agent_configurations.channel IS 'Channel type: twilio (voice), web (browser agent), whatsapp (messaging), system (global)';
COMMENT ON COLUMN agent_configurations.whatsapp_instructions IS 'Instructions for WhatsApp text-based messaging (gpt-4o single-agent)';

-- Add helpful view for querying configs
CREATE OR REPLACE VIEW agent_configurations_with_fallback AS
SELECT 
  COALESCE(org_config.id, sys_config.id) as id,
  org_config.organization_id,
  COALESCE(org_config.channel, sys_config.channel) as channel,
  COALESCE(org_config.manual_ai_instructions, sys_config.manual_ai_instructions) as manual_ai_instructions,
  COALESCE(org_config.receptionist_instructions, sys_config.receptionist_instructions) as receptionist_instructions,
  COALESCE(org_config.supervisor_instructions, sys_config.supervisor_instructions) as supervisor_instructions,
  COALESCE(org_config.whatsapp_instructions, sys_config.whatsapp_instructions) as whatsapp_instructions,
  COALESCE(org_config.use_manual_instructions, sys_config.use_manual_instructions) as use_manual_instructions,
  CASE 
    WHEN org_config.id IS NOT NULL THEN 'organization'
    ELSE 'system'
  END as config_source
FROM organizations o
CROSS JOIN (SELECT DISTINCT channel FROM agent_configurations WHERE channel != 'system') channels
LEFT JOIN agent_configurations org_config 
  ON org_config.organization_id = o.id 
  AND org_config.channel = channels.channel
LEFT JOIN agent_configurations sys_config 
  ON sys_config.organization_id IS NULL 
  AND sys_config.channel = channels.channel;

COMMENT ON VIEW agent_configurations_with_fallback IS 'Shows effective configuration per org+channel with system fallback';
