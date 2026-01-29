-- ============================================================================
-- MIGRATION 055: Add Retell Call Fields to Conversations
-- ============================================================================
-- Adds Retell-specific fields for voice call logging
-- Allows conversations table to store call metadata, transcripts, and analysis
-- ============================================================================

-- Add Retell identifiers
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS call_id TEXT,
  ADD COLUMN IF NOT EXISTS agent_id TEXT,
  ADD COLUMN IF NOT EXISTS call_type TEXT CHECK (call_type IN ('phone_call', 'web_call', NULL));

-- Add call participant info
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS from_number TEXT,
  ADD COLUMN IF NOT EXISTS to_number TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound', NULL));

-- Add call timing
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS start_timestamp BIGINT,
  ADD COLUMN IF NOT EXISTS end_timestamp BIGINT,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Add call outcome
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS call_status TEXT CHECK (call_status IN ('registered', 'ongoing', 'ended', 'error', NULL)),
  ADD COLUMN IF NOT EXISTS disconnection_reason TEXT;

-- Add call content (stored for 30 days, then archived)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS transcript_object JSONB,
  ADD COLUMN IF NOT EXISTS transcript_with_tool_calls JSONB;

-- Add analysis & metadata
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS call_analysis JSONB,
  ADD COLUMN IF NOT EXISTS retell_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS retell_llm_dynamic_variables JSONB DEFAULT '{}',
  
  -- Additional call details from call_ended
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_version INTEGER,
  ADD COLUMN IF NOT EXISTS collected_dynamic_variables JSONB,
  ADD COLUMN IF NOT EXISTS transfer_destination TEXT,
  ADD COLUMN IF NOT EXISTS transfer_end_timestamp BIGINT,
  
  -- Additional recording URLs
  ADD COLUMN IF NOT EXISTS recording_multi_channel_url TEXT,
  ADD COLUMN IF NOT EXISTS scrubbed_recording_url TEXT,
  ADD COLUMN IF NOT EXISTS scrubbed_recording_multi_channel_url TEXT,
  ADD COLUMN IF NOT EXISTS scrubbed_transcript_with_tool_calls JSONB,
  
  -- Debugging & analytics URLs
  ADD COLUMN IF NOT EXISTS public_log_url TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_base_retrieved_contents_url TEXT,
  
  -- Performance & cost metrics
  ADD COLUMN IF NOT EXISTS latency JSONB,
  ADD COLUMN IF NOT EXISTS call_cost JSONB,
  ADD COLUMN IF NOT EXISTS llm_token_usage JSONB;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for looking up by Retell call_id
CREATE INDEX IF NOT EXISTS idx_conversations_call_id 
  ON conversations(call_id) 
  WHERE call_id IS NOT NULL;

-- Index for filtering by phone number
CREATE INDEX IF NOT EXISTS idx_conversations_from_number 
  ON conversations(from_number) 
  WHERE from_number IS NOT NULL;

-- Index for sorting by call start time
CREATE INDEX IF NOT EXISTS idx_conversations_start_timestamp 
  ON conversations(start_timestamp DESC);

-- Index for filtering by channel and status
CREATE INDEX IF NOT EXISTS idx_conversations_channel_status 
  ON conversations(channel, call_status);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN conversations.call_id IS 'Retell call ID - unique identifier from Retell AI';
COMMENT ON COLUMN conversations.agent_id IS 'Retell agent ID used for this call';
COMMENT ON COLUMN conversations.call_type IS 'Type of call: phone_call or web_call';
COMMENT ON COLUMN conversations.from_number IS 'Caller phone number (E.164 format)';
COMMENT ON COLUMN conversations.to_number IS 'Called phone number (organization number)';
COMMENT ON COLUMN conversations.direction IS 'Call direction: inbound or outbound';
COMMENT ON COLUMN conversations.start_timestamp IS 'Unix timestamp (ms) when call started';
COMMENT ON COLUMN conversations.end_timestamp IS 'Unix timestamp (ms) when call ended';
COMMENT ON COLUMN conversations.duration_ms IS 'Call duration in milliseconds';
COMMENT ON COLUMN conversations.call_status IS 'Current call status from Retell';
COMMENT ON COLUMN conversations.disconnection_reason IS 'Why call ended: user_hangup, agent_hangup, error, transferred';
COMMENT ON COLUMN conversations.recording_url IS 'URL to call recording (expires in 10 minutes from Retell)';
COMMENT ON COLUMN conversations.transcript IS 'Full text transcript from Retell';
COMMENT ON COLUMN conversations.transcript_object IS 'Structured transcript with roles and timestamps';
COMMENT ON COLUMN conversations.transcript_with_tool_calls IS 'Transcript showing function calls inline';
COMMENT ON COLUMN conversations.call_analysis IS 'Post-call analysis from Retell (custom extraction fields)';
COMMENT ON COLUMN conversations.retell_metadata IS 'Custom metadata passed to Retell call';
COMMENT ON COLUMN conversations.retell_llm_dynamic_variables IS 'Dynamic variables used in LLM prompts';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 055 complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Added Retell call fields to conversations table:';
  RAISE NOTICE '  - Call identifiers (call_id, agent_id)';
  RAISE NOTICE '  - Phone numbers (from_number, to_number)';
  RAISE NOTICE '  - Call timing (start_timestamp, end_timestamp, duration_ms)';
  RAISE NOTICE '  - Call status (call_status, disconnection_reason)';
  RAISE NOTICE '  - Content (recording_url, transcript, transcript_object)';
  RAISE NOTICE '  - Analysis (call_analysis, retell_metadata)';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes created for efficient querying';
  RAISE NOTICE '';
END $$;
