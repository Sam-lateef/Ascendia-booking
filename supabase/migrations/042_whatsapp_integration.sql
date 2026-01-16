-- ============================================================================
-- MIGRATION 042: WhatsApp Integration via Evolution API
-- ============================================================================
-- Stores WhatsApp instances, phone numbers, and message mappings
-- Integrates with existing conversations table
-- ============================================================================

-- ============================================================================
-- WHATSAPP INSTANCES TABLE
-- ============================================================================
-- Each organization can have one or more WhatsApp numbers connected
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Evolution API instance details
  instance_name TEXT NOT NULL UNIQUE, -- Evolution API instance name (e.g., "org-abc-whatsapp")
  instance_id TEXT, -- Evolution API instance ID (returned after creation)
  phone_number TEXT, -- WhatsApp phone number (e.g., "+1234567890") - populated after QR scan
  phone_number_formatted TEXT, -- Formatted display (e.g., "+1 (234) 567-8900")
  
  -- Connection status
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'failed', 'qr_code')),
  qr_code TEXT, -- Base64 QR code for initial connection
  qr_code_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  
  -- Configuration
  webhook_url TEXT, -- Webhook URL for this instance
  is_active BOOLEAN DEFAULT true,
  
  -- Agent configuration
  agent_config JSONB DEFAULT '{}'::JSONB, -- WhatsApp-specific agent settings
  greeting_message TEXT, -- First message to send
  away_message TEXT, -- Message when agent is unavailable
  
  -- Usage stats
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  conversations_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_org ON whatsapp_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_phone ON whatsapp_instances(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_name ON whatsapp_instances(instance_name);

-- Updated_at trigger
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- WHATSAPP CONVERSATIONS MAPPING
-- ============================================================================
-- Maps WhatsApp remote_jid (chat ID) to our conversations table
-- Allows session continuity across multiple messages
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- WhatsApp identifiers
  remote_jid TEXT NOT NULL, -- WhatsApp contact ID (e.g., "1234567890@s.whatsapp.net")
  contact_name TEXT, -- Contact name from WhatsApp
  contact_push_name TEXT, -- Push name from WhatsApp
  
  -- Session management
  is_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one active conversation per remote_jid per instance
  UNIQUE(whatsapp_instance_id, remote_jid, is_active)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_instance ON whatsapp_conversations(whatsapp_instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_conv ON whatsapp_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_jid ON whatsapp_conversations(remote_jid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_active ON whatsapp_conversations(whatsapp_instance_id, remote_jid, is_active) WHERE is_active = true;

-- Updated_at trigger
CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- WHATSAPP MESSAGES TABLE
-- ============================================================================
-- Stores raw WhatsApp messages for debugging and audit trail
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  whatsapp_conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_message_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
  
  -- WhatsApp message details
  message_id TEXT, -- Evolution API message ID
  remote_jid TEXT NOT NULL, -- Sender/receiver WhatsApp ID
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  
  -- Message content
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'contact', 'sticker')),
  text_content TEXT,
  media_url TEXT, -- URL if media file
  caption TEXT, -- Caption for media
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'deleted')),
  error_message TEXT,
  
  -- Raw webhook data (for debugging)
  raw_payload JSONB,
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_instance ON whatsapp_messages(whatsapp_instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conv ON whatsapp_messages(whatsapp_conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON whatsapp_messages(organization_id, direction, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_jid ON whatsapp_messages(remote_jid, created_at DESC);

-- Full text search on messages
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_text_search ON whatsapp_messages USING GIN(
  to_tsvector('english', COALESCE(text_content, ''))
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- whatsapp_instances policies
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_instances_service_all ON whatsapp_instances;
CREATE POLICY whatsapp_instances_service_all ON whatsapp_instances
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- whatsapp_conversations policies
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_conversations_service_all ON whatsapp_conversations;
CREATE POLICY whatsapp_conversations_service_all ON whatsapp_conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- whatsapp_messages policies
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_messages_service_all ON whatsapp_messages;
CREATE POLICY whatsapp_messages_service_all ON whatsapp_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get or create WhatsApp conversation mapping
CREATE OR REPLACE FUNCTION get_or_create_whatsapp_conversation(
  p_instance_id UUID,
  p_remote_jid TEXT,
  p_org_id UUID,
  p_contact_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_whatsapp_conv_id UUID;
  v_conversation_id UUID;
BEGIN
  -- Try to find existing active WhatsApp conversation
  SELECT id, conversation_id INTO v_whatsapp_conv_id, v_conversation_id
  FROM whatsapp_conversations
  WHERE whatsapp_instance_id = p_instance_id
    AND remote_jid = p_remote_jid
    AND is_active = true
  LIMIT 1;
  
  IF v_whatsapp_conv_id IS NOT NULL THEN
    -- Update last_message_at
    UPDATE whatsapp_conversations
    SET last_message_at = NOW()
    WHERE id = v_whatsapp_conv_id;
    
    RETURN v_conversation_id;
  END IF;
  
  -- Create new conversation in conversations table
  INSERT INTO conversations (
    organization_id,
    user_id,
    agent_id,
    title,
    status,
    metadata
  ) VALUES (
    p_org_id,
    NULL, -- Anonymous WhatsApp user
    'whatsapp-agent',
    COALESCE(p_contact_name, 'WhatsApp Chat'),
    'active',
    jsonb_build_object(
      'channel', 'whatsapp',
      'remote_jid', p_remote_jid
    )
  ) RETURNING id INTO v_conversation_id;
  
  -- Create WhatsApp conversation mapping
  INSERT INTO whatsapp_conversations (
    whatsapp_instance_id,
    conversation_id,
    organization_id,
    remote_jid,
    contact_name,
    is_active,
    last_message_at
  ) VALUES (
    p_instance_id,
    v_conversation_id,
    p_org_id,
    p_remote_jid,
    p_contact_name,
    true,
    NOW()
  ) RETURNING id INTO v_whatsapp_conv_id;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Update WhatsApp instance stats on message insert
CREATE OR REPLACE FUNCTION update_whatsapp_instance_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE whatsapp_instances
  SET 
    messages_sent = messages_sent + CASE WHEN NEW.direction = 'outbound' THEN 1 ELSE 0 END,
    messages_received = messages_received + CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END,
    last_message_at = NOW(),
    last_seen_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.whatsapp_instance_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_whatsapp_instance_stats
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_instance_stats();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- WhatsApp instance summary
CREATE OR REPLACE VIEW whatsapp_instance_summary AS
SELECT 
  wi.id,
  wi.organization_id,
  o.name as organization_name,
  wi.instance_name,
  wi.phone_number,
  wi.status,
  wi.connected_at,
  wi.messages_sent,
  wi.messages_received,
  wi.conversations_count,
  wi.last_message_at,
  wi.is_active,
  COUNT(DISTINCT wc.id) FILTER (WHERE wc.is_active = true) as active_conversations,
  COUNT(DISTINCT wm.id) FILTER (WHERE wm.created_at >= NOW() - INTERVAL '24 hours') as messages_last_24h
FROM whatsapp_instances wi
JOIN organizations o ON o.id = wi.organization_id
LEFT JOIN whatsapp_conversations wc ON wc.whatsapp_instance_id = wi.id
LEFT JOIN whatsapp_messages wm ON wm.whatsapp_instance_id = wi.id
GROUP BY wi.id, o.name;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE whatsapp_instances IS 'WhatsApp phone numbers connected via Evolution API';
COMMENT ON TABLE whatsapp_conversations IS 'Maps WhatsApp chats to internal conversation records';
COMMENT ON TABLE whatsapp_messages IS 'Raw WhatsApp messages for audit trail and debugging';
COMMENT ON FUNCTION get_or_create_whatsapp_conversation IS 'Get existing or create new conversation for WhatsApp chat';
COMMENT ON VIEW whatsapp_instance_summary IS 'Summary of WhatsApp instances with usage stats';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 042 complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - whatsapp_instances table (phone numbers per organization)';
  RAISE NOTICE '  - whatsapp_conversations table (maps WhatsApp chats to conversations)';
  RAISE NOTICE '  - whatsapp_messages table (raw message audit trail)';
  RAISE NOTICE '  - Helper function: get_or_create_whatsapp_conversation()';
  RAISE NOTICE '  - View: whatsapp_instance_summary';
  RAISE NOTICE '  - Automatic stats tracking triggers';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready for WhatsApp integration via Evolution API!';
  RAISE NOTICE '';
END $$;
