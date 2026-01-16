-- Conversation State Tables
-- Stores conversation history and extracted parameters independently of LLM

-- Main conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Intent tracking
  intent TEXT CHECK (intent IN ('book', 'reschedule', 'cancel', 'check', 'unknown')),
  stage TEXT CHECK (stage IN ('greeting', 'identifying', 'gathering', 'checking_slots', 'confirming', 'completed')) DEFAULT 'greeting',
  
  -- Extracted patient info (JSON for flexibility)
  patient_info JSONB DEFAULT '{}',
  
  -- Extracted appointment info
  appointment_info JSONB DEFAULT '{}',
  
  -- What's still missing
  missing_required TEXT[] DEFAULT '{}',
  
  -- Metadata
  agent_config TEXT, -- 'embedded-booking', 'openDental', etc.
  completed_at TIMESTAMPTZ
);

-- Conversation messages
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- What was extracted from this message
  extracted_data JSONB DEFAULT '{}',
  
  -- Ordering
  sequence_num INTEGER NOT NULL
);

-- Function call history
CREATE TABLE IF NOT EXISTS function_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  function_name TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  result JSONB,
  error TEXT,
  duration_ms INTEGER,
  
  -- Whether parameters were auto-filled
  auto_filled_params JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_function_calls_conversation_id ON function_calls(conversation_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- View for debugging conversations
CREATE OR REPLACE VIEW conversation_summary AS
SELECT 
  c.id,
  c.session_id,
  c.intent,
  c.stage,
  c.patient_info->>'firstName' as patient_first_name,
  c.patient_info->>'lastName' as patient_last_name,
  c.patient_info->>'patNum' as patient_num,
  c.appointment_info->>'type' as appointment_type,
  c.appointment_info->>'preferredDate' as preferred_date,
  c.missing_required,
  c.created_at,
  c.updated_at,
  COUNT(DISTINCT cm.id) as message_count,
  COUNT(DISTINCT fc.id) as function_call_count,
  COUNT(DISTINCT CASE WHEN fc.error IS NOT NULL THEN fc.id END) as failed_calls
FROM conversations c
LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
LEFT JOIN function_calls fc ON c.id = fc.conversation_id
GROUP BY c.id
ORDER BY c.created_at DESC;

COMMENT ON TABLE conversations IS 'Stores conversation state independently of LLM for parameter extraction';
COMMENT ON TABLE conversation_messages IS 'All messages in a conversation for auditing and debugging';
COMMENT ON TABLE function_calls IS 'History of API calls made during conversation';

