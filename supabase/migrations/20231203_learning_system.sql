-- Learning System Tables
-- Records orchestrator/validator activity and identifies patterns for new workflows

-- ============================================
-- Table 1: Orchestrator Executions
-- Records every orchestrator/validator execution for analysis
-- ============================================
CREATE TABLE IF NOT EXISTS orchestrator_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- What was detected
  intent_detected TEXT,
  entities_extracted JSONB DEFAULT '{}',
  
  -- What happened
  used_workflow_engine BOOLEAN DEFAULT FALSE,
  workflow_id TEXT,
  functions_called JSONB DEFAULT '[]',  -- Array of {name, params, result, success}
  
  -- Validation
  validation_results JSONB DEFAULT '[]', -- Array of {function, valid, reason, corrections}
  
  -- Outcome
  resolution_status TEXT CHECK (resolution_status IN ('success', 'partial', 'failed', 'unknown')),
  error_message TEXT,
  
  -- Response generated
  response_text TEXT,
  response_time_ms INTEGER
);

-- Indexes for orchestrator_executions
CREATE INDEX IF NOT EXISTS idx_orchestrator_executions_session_id ON orchestrator_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_orchestrator_executions_created_at ON orchestrator_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orchestrator_executions_intent ON orchestrator_executions(intent_detected);
CREATE INDEX IF NOT EXISTS idx_orchestrator_executions_status ON orchestrator_executions(resolution_status);
CREATE INDEX IF NOT EXISTS idx_orchestrator_executions_workflow ON orchestrator_executions(used_workflow_engine);

-- ============================================
-- Table 2: Workflow Patterns
-- Pattern candidates for new workflows (detected from repeated orchestrator patterns)
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Pattern identification
  pattern_hash TEXT UNIQUE NOT NULL,  -- Hash of intent + function sequence
  intent_name TEXT NOT NULL,
  function_sequence JSONB NOT NULL,   -- Ordered array of function names
  
  -- Tracking
  times_observed INTEGER DEFAULT 1,
  times_successful INTEGER DEFAULT 0,
  times_failed INTEGER DEFAULT 0,
  avg_feedback_score DECIMAL(3,2),
  
  -- Sample data for review
  sample_entities JSONB DEFAULT '[]',
  sample_executions UUID[] DEFAULT '{}',  -- References to orchestrator_executions
  
  -- Generated workflow definition (when approved)
  workflow_definition JSONB,
  
  -- Status workflow
  status TEXT CHECK (status IN ('observing', 'suggested', 'approved', 'rejected')) DEFAULT 'observing',
  suggested_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- When approved, this becomes the workflow name
  approved_workflow_name TEXT
);

-- Indexes for workflow_patterns
CREATE INDEX IF NOT EXISTS idx_workflow_patterns_hash ON workflow_patterns(pattern_hash);
CREATE INDEX IF NOT EXISTS idx_workflow_patterns_status ON workflow_patterns(status);
CREATE INDEX IF NOT EXISTS idx_workflow_patterns_intent ON workflow_patterns(intent_name);
CREATE INDEX IF NOT EXISTS idx_workflow_patterns_times ON workflow_patterns(times_observed DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_workflow_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workflow_patterns_updated_at ON workflow_patterns;
CREATE TRIGGER workflow_patterns_updated_at
  BEFORE UPDATE ON workflow_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_patterns_updated_at();

-- ============================================
-- Table 3: Conversation Feedback
-- Records user feedback at end of conversations
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Rating options
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  thumbs_up BOOLEAN,
  
  -- Optional details
  feedback_text TEXT,
  feedback_source TEXT CHECK (feedback_source IN ('voice', 'ui', 'both')),
  
  -- What voice response was given (if any)
  voice_response TEXT,
  
  -- Link to execution for correlation
  execution_id UUID REFERENCES orchestrator_executions(id) ON DELETE SET NULL,
  
  -- Conversation summary for context
  conversation_summary TEXT,
  total_messages INTEGER,
  total_function_calls INTEGER
);

-- Indexes for conversation_feedback
CREATE INDEX IF NOT EXISTS idx_conversation_feedback_session ON conversation_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_feedback_created ON conversation_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_feedback_rating ON conversation_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_conversation_feedback_thumbs ON conversation_feedback(thumbs_up);

-- ============================================
-- Table 4: Dynamic Workflows
-- Stores approved workflows that are loaded at runtime
-- ============================================
CREATE TABLE IF NOT EXISTS dynamic_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Workflow identification
  workflow_name TEXT UNIQUE NOT NULL,
  intent_triggers TEXT[] NOT NULL,  -- Intents that activate this workflow
  
  -- Workflow definition (same structure as static definitions)
  definition JSONB NOT NULL,
  
  -- Metadata
  description TEXT,
  source_pattern_id UUID REFERENCES workflow_patterns(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  
  -- Performance tracking
  times_used INTEGER DEFAULT 0,
  success_rate DECIMAL(5,4),
  last_used_at TIMESTAMPTZ
);

-- Indexes for dynamic_workflows
CREATE INDEX IF NOT EXISTS idx_dynamic_workflows_name ON dynamic_workflows(workflow_name);
CREATE INDEX IF NOT EXISTS idx_dynamic_workflows_active ON dynamic_workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_dynamic_workflows_triggers ON dynamic_workflows USING GIN(intent_triggers);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS dynamic_workflows_updated_at ON dynamic_workflows;
CREATE TRIGGER dynamic_workflows_updated_at
  BEFORE UPDATE ON dynamic_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_patterns_updated_at();

-- ============================================
-- Views for Analytics
-- ============================================

-- View: Pattern suggestions (patterns ready for review)
CREATE OR REPLACE VIEW pattern_suggestions AS
SELECT 
  p.*,
  CASE 
    WHEN times_observed > 0 THEN ROUND(times_successful::decimal / times_observed * 100, 1)
    ELSE 0 
  END as success_rate_pct,
  COALESCE(avg_feedback_score, 0) as feedback_score
FROM workflow_patterns p
WHERE status = 'suggested'
  OR (status = 'observing' 
      AND times_observed >= 5 
      AND times_successful::decimal / NULLIF(times_observed, 0) >= 0.8)
ORDER BY times_observed DESC, avg_feedback_score DESC NULLS LAST;

-- View: Execution summary by day
CREATE OR REPLACE VIEW daily_execution_summary AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_executions,
  SUM(CASE WHEN used_workflow_engine THEN 1 ELSE 0 END) as workflow_engine_count,
  SUM(CASE WHEN NOT used_workflow_engine THEN 1 ELSE 0 END) as orchestrator_count,
  SUM(CASE WHEN resolution_status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN resolution_status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  AVG(response_time_ms) as avg_response_time
FROM orchestrator_executions
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View: Intent distribution
CREATE OR REPLACE VIEW intent_distribution AS
SELECT 
  intent_detected,
  COUNT(*) as count,
  SUM(CASE WHEN resolution_status = 'success' THEN 1 ELSE 0 END) as success_count,
  AVG(response_time_ms) as avg_response_time
FROM orchestrator_executions
WHERE intent_detected IS NOT NULL
GROUP BY intent_detected
ORDER BY count DESC;

