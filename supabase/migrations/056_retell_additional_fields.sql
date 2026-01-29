-- ============================================================================
-- MIGRATION 056: Add Additional Retell Call Fields
-- ============================================================================
-- Adds remaining fields from call_ended event for complete data capture
-- ============================================================================

-- Add agent details
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_version INTEGER;

-- Add collected dynamic variables from call
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS collected_dynamic_variables JSONB;

-- Add transfer information
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS transfer_destination TEXT,
  ADD COLUMN IF NOT EXISTS transfer_end_timestamp BIGINT;

-- Add additional recording URLs (all variants)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS recording_multi_channel_url TEXT,
  ADD COLUMN IF NOT EXISTS scrubbed_recording_url TEXT,
  ADD COLUMN IF NOT EXISTS scrubbed_recording_multi_channel_url TEXT;

-- Add scrubbed transcript (PII removed)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS scrubbed_transcript_with_tool_calls JSONB;

-- Add debugging & analytics URLs
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS public_log_url TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_base_retrieved_contents_url TEXT;

-- Add performance metrics
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS latency JSONB;

-- Add cost tracking
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS call_cost JSONB,
  ADD COLUMN IF NOT EXISTS llm_token_usage JSONB;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN conversations.agent_name IS 'Name of the Retell agent used for this call';
COMMENT ON COLUMN conversations.agent_version IS 'Version number of the agent';
COMMENT ON COLUMN conversations.collected_dynamic_variables IS 'Dynamic variables collected during the call';
COMMENT ON COLUMN conversations.transfer_destination IS 'Phone number or SIP URI where call was transferred';
COMMENT ON COLUMN conversations.transfer_end_timestamp IS 'Unix timestamp (ms) when transferred call ended';
COMMENT ON COLUMN conversations.recording_multi_channel_url IS 'Multi-channel recording URL (separate tracks for agent/user)';
COMMENT ON COLUMN conversations.scrubbed_recording_url IS 'Recording URL with PII removed';
COMMENT ON COLUMN conversations.scrubbed_recording_multi_channel_url IS 'Multi-channel recording with PII removed';
COMMENT ON COLUMN conversations.scrubbed_transcript_with_tool_calls IS 'Transcript with tool calls, PII removed';
COMMENT ON COLUMN conversations.public_log_url IS 'Public debugging log URL from Retell';
COMMENT ON COLUMN conversations.knowledge_base_retrieved_contents_url IS 'Knowledge base retrieval results URL';
COMMENT ON COLUMN conversations.latency IS 'Latency metrics: e2e, asr, llm, tts (p50, p90, p95, p99, max, min)';
COMMENT ON COLUMN conversations.call_cost IS 'Cost breakdown: product_costs[], total_duration_seconds, combined_cost';
COMMENT ON COLUMN conversations.llm_token_usage IS 'LLM token usage statistics';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 056 complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Added additional Retell fields:';
  RAISE NOTICE '  - Agent details (agent_name, agent_version)';
  RAISE NOTICE '  - Transfer info (transfer_destination, transfer_end_timestamp)';
  RAISE NOTICE '  - Additional recordings (multi-channel, scrubbed variants)';
  RAISE NOTICE '  - Debugging URLs (public_log_url, kb_retrieved_contents_url)';
  RAISE NOTICE '  - Performance metrics (latency, call_cost, llm_token_usage)';
  RAISE NOTICE '  - Collected dynamic variables';
  RAISE NOTICE '';
  RAISE NOTICE 'Now capturing ALL data from call_ended event!';
  RAISE NOTICE '';
END $$;
