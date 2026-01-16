-- Migration: Hallucination Prevention System
-- Configurable 3-LLM validation + logging of caught hallucinations

-- ============================================
-- Table 1: Validation Settings (Configurable)
-- ============================================
CREATE TABLE IF NOT EXISTS validation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Configuration
  validation_enabled BOOLEAN DEFAULT TRUE,
  validation_model TEXT DEFAULT 'claude-3-5-sonnet-20241022',  -- Validator LLM
  
  -- Which operations require validation
  validate_bookings BOOLEAN DEFAULT TRUE,
  validate_reschedules BOOLEAN DEFAULT TRUE,
  validate_cancellations BOOLEAN DEFAULT FALSE,  -- Lower risk
  validate_patient_creation BOOLEAN DEFAULT TRUE,
  
  -- Thresholds
  confidence_threshold DECIMAL(3,2) DEFAULT 0.85,  -- Min confidence to proceed
  max_retries INTEGER DEFAULT 2,
  
  -- Cost tracking
  validation_calls_count INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(10,4) DEFAULT 0.0000,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT
);

-- Insert default configuration
INSERT INTO validation_settings (
  validation_enabled,
  validate_bookings,
  validate_reschedules,
  validate_cancellations,
  validate_patient_creation,
  notes
) VALUES (
  TRUE,
  TRUE,
  TRUE,
  FALSE,
  TRUE,
  'Default configuration - validates high-risk operations only'
);

-- ============================================
-- Table 2: Hallucination Prevention Log
-- ============================================
CREATE TABLE IF NOT EXISTS hallucination_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Session context
  session_id TEXT NOT NULL,
  conversation_id TEXT,
  
  -- What was being attempted
  operation_type TEXT NOT NULL,  -- 'create_appointment', 'update_appointment', 'create_patient', etc.
  function_name TEXT NOT NULL,
  
  -- The issue detected
  hallucination_type TEXT NOT NULL,  -- 'missing_parameter', 'invalid_value', 'fabricated_data', 'logic_error'
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')) DEFAULT 'high',
  
  -- What the agent tried to do (wrong)
  original_request JSONB NOT NULL,  -- The parameters agent wanted to send
  
  -- What the validator caught
  validation_error TEXT NOT NULL,  -- Human-readable error
  validator_reasoning TEXT,  -- Why validator flagged it
  
  -- How it was fixed
  corrected_request JSONB,  -- The corrected parameters (if auto-fixed)
  action_taken TEXT CHECK (action_taken IN ('blocked', 'corrected', 'asked_user', 'escalated')) NOT NULL,
  
  -- Models involved
  primary_agent_model TEXT DEFAULT 'gpt-4o',
  validator_model TEXT DEFAULT 'claude-3-5-sonnet-20241022',
  
  -- Cost tracking
  validation_cost_usd DECIMAL(8,6),
  tokens_used INTEGER,
  
  -- Outcome
  prevented_error BOOLEAN DEFAULT TRUE,
  user_impact TEXT  -- 'prevented_wrong_booking', 'prevented_data_corruption', etc.
);

-- ============================================
-- Table 3: Validation Metrics (Aggregated)
-- ============================================
CREATE TABLE IF NOT EXISTS validation_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL UNIQUE,
  
  -- Counts
  total_validations INTEGER DEFAULT 0,
  hallucinations_caught INTEGER DEFAULT 0,
  hallucinations_blocked INTEGER DEFAULT 0,
  hallucinations_corrected INTEGER DEFAULT 0,
  
  -- By operation type
  bookings_validated INTEGER DEFAULT 0,
  bookings_hallucinations INTEGER DEFAULT 0,
  reschedules_validated INTEGER DEFAULT 0,
  reschedules_hallucinations INTEGER DEFAULT 0,
  cancellations_validated INTEGER DEFAULT 0,
  cancellations_hallucinations INTEGER DEFAULT 0,
  
  -- By hallucination type
  missing_parameters INTEGER DEFAULT 0,
  invalid_values INTEGER DEFAULT 0,
  fabricated_data INTEGER DEFAULT 0,
  logic_errors INTEGER DEFAULT 0,
  
  -- Cost
  total_cost_usd DECIMAL(10,4) DEFAULT 0.0000,
  total_tokens INTEGER DEFAULT 0,
  
  -- Effectiveness
  false_positives INTEGER DEFAULT 0,  -- Validator was wrong
  false_negatives INTEGER DEFAULT 0,  -- Validator missed an issue
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_hallucination_logs_session ON hallucination_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_hallucination_logs_operation ON hallucination_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_hallucination_logs_type ON hallucination_logs(hallucination_type);
CREATE INDEX IF NOT EXISTS idx_hallucination_logs_severity ON hallucination_logs(severity);
CREATE INDEX IF NOT EXISTS idx_hallucination_logs_date ON hallucination_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_validation_metrics_date ON validation_metrics_daily(metric_date);

-- ============================================
-- Triggers
-- ============================================
CREATE TRIGGER validation_settings_updated_at
  BEFORE UPDATE ON validation_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views
-- ============================================

-- Recent hallucinations (last 7 days)
CREATE OR REPLACE VIEW recent_hallucinations AS
SELECT 
  id,
  created_at,
  session_id,
  operation_type,
  function_name,
  hallucination_type,
  severity,
  validation_error,
  action_taken,
  prevented_error
FROM hallucination_logs
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Hallucination statistics
CREATE OR REPLACE VIEW hallucination_stats AS
SELECT 
  COUNT(*) as total_caught,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
  COUNT(*) FILTER (WHERE severity = 'high') as high_count,
  COUNT(*) FILTER (WHERE action_taken = 'blocked') as blocked_count,
  COUNT(*) FILTER (WHERE action_taken = 'corrected') as corrected_count,
  COUNT(DISTINCT session_id) as sessions_affected,
  SUM(validation_cost_usd)::DECIMAL(10,4) as total_cost_usd,
  AVG(tokens_used)::INTEGER as avg_tokens_per_validation
FROM hallucination_logs
WHERE created_at > NOW() - INTERVAL '30 days';

-- Top hallucination types
CREATE OR REPLACE VIEW top_hallucination_types AS
SELECT 
  hallucination_type,
  COUNT(*) as occurrences,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical,
  COUNT(*) FILTER (WHERE action_taken = 'blocked') as blocked,
  COUNT(*) FILTER (WHERE action_taken = 'corrected') as corrected,
  ROUND(AVG(validation_cost_usd)::NUMERIC, 6) as avg_cost
FROM hallucination_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY hallucination_type
ORDER BY occurrences DESC;

-- Cost savings estimate (what would have happened without validation)
CREATE OR REPLACE VIEW validation_roi AS
SELECT 
  COUNT(*) as issues_prevented,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_issues,
  SUM(validation_cost_usd)::DECIMAL(10,4) as validation_cost,
  -- Estimate: Each prevented critical issue saves ~$50 in support time
  (COUNT(*) FILTER (WHERE severity = 'critical') * 50)::DECIMAL(10,2) as estimated_support_cost_saved,
  -- ROI calculation
  CASE 
    WHEN SUM(validation_cost_usd) > 0 THEN
      ROUND(((COUNT(*) FILTER (WHERE severity = 'critical') * 50) / SUM(validation_cost_usd)::NUMERIC), 2)
    ELSE 0
  END as roi_multiplier
FROM hallucination_logs
WHERE created_at > NOW() - INTERVAL '30 days'
  AND prevented_error = TRUE;

-- ============================================
-- Functions
-- ============================================

-- Update daily metrics (call this after logging a hallucination)
CREATE OR REPLACE FUNCTION update_validation_metrics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO validation_metrics_daily (metric_date)
  VALUES (CURRENT_DATE)
  ON CONFLICT (metric_date) DO NOTHING;
  
  UPDATE validation_metrics_daily
  SET 
    total_validations = total_validations + 1,
    hallucinations_caught = hallucinations_caught + 
      CASE WHEN NEW.prevented_error THEN 1 ELSE 0 END,
    hallucinations_blocked = hallucinations_blocked + 
      CASE WHEN NEW.action_taken = 'blocked' THEN 1 ELSE 0 END,
    hallucinations_corrected = hallucinations_corrected + 
      CASE WHEN NEW.action_taken = 'corrected' THEN 1 ELSE 0 END,
    
    -- By operation type
    bookings_validated = bookings_validated + 
      CASE WHEN NEW.operation_type = 'create_appointment' THEN 1 ELSE 0 END,
    bookings_hallucinations = bookings_hallucinations + 
      CASE WHEN NEW.operation_type = 'create_appointment' AND NEW.prevented_error THEN 1 ELSE 0 END,
    
    reschedules_validated = reschedules_validated + 
      CASE WHEN NEW.operation_type = 'update_appointment' THEN 1 ELSE 0 END,
    reschedules_hallucinations = reschedules_hallucinations + 
      CASE WHEN NEW.operation_type = 'update_appointment' AND NEW.prevented_error THEN 1 ELSE 0 END,
    
    cancellations_validated = cancellations_validated + 
      CASE WHEN NEW.operation_type = 'cancel_appointment' THEN 1 ELSE 0 END,
    cancellations_hallucinations = cancellations_hallucinations + 
      CASE WHEN NEW.operation_type = 'cancel_appointment' AND NEW.prevented_error THEN 1 ELSE 0 END,
    
    -- By type
    missing_parameters = missing_parameters + 
      CASE WHEN NEW.hallucination_type = 'missing_parameter' THEN 1 ELSE 0 END,
    invalid_values = invalid_values + 
      CASE WHEN NEW.hallucination_type = 'invalid_value' THEN 1 ELSE 0 END,
    fabricated_data = fabricated_data + 
      CASE WHEN NEW.hallucination_type = 'fabricated_data' THEN 1 ELSE 0 END,
    logic_errors = logic_errors + 
      CASE WHEN NEW.hallucination_type = 'logic_error' THEN 1 ELSE 0 END,
    
    -- Cost
    total_cost_usd = total_cost_usd + COALESCE(NEW.validation_cost_usd, 0),
    total_tokens = total_tokens + COALESCE(NEW.tokens_used, 0),
    
    updated_at = NOW()
  WHERE metric_date = CURRENT_DATE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update metrics on new hallucination log
CREATE TRIGGER update_metrics_on_hallucination
  AFTER INSERT ON hallucination_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_metrics();

-- ============================================
-- Sample Data (for testing)
-- ============================================
-- Uncomment to insert sample hallucination logs

/*
INSERT INTO hallucination_logs (
  session_id,
  operation_type,
  function_name,
  hallucination_type,
  severity,
  original_request,
  validation_error,
  validator_reasoning,
  action_taken,
  validation_cost_usd,
  tokens_used
) VALUES 
(
  'test-session-1',
  'create_appointment',
  'CreateAppointment',
  'missing_parameter',
  'critical',
  '{"PatNum": null, "AptDateTime": "2025-12-10 10:00:00", "ProvNum": 1, "Op": 1}'::jsonb,
  'PatNum is null - cannot create appointment without patient ID',
  'Agent attempted to book appointment without identifying patient first. This would cause database error.',
  'blocked',
  0.002500,
  450
),
(
  'test-session-2',
  'create_appointment',
  'CreateAppointment',
  'fabricated_data',
  'critical',
  '{"PatNum": 999999, "AptDateTime": "2025-12-10 14:00:00", "ProvNum": 1, "Op": 1}'::jsonb,
  'PatNum 999999 does not exist in patient database',
  'Agent hallucinated a patient ID that was never returned by GetMultiplePatients. Likely confused IDs from conversation context.',
  'blocked',
  0.002800,
  520
),
(
  'test-session-3',
  'create_patient',
  'CreatePatient',
  'invalid_value',
  'high',
  '{"FName": "John", "LName": "Smith", "Birthdate": "0000-00-00", "WirelessPhone": "6195551234"}'::jsonb,
  'Birthdate is invalid: 0000-00-00',
  'Agent failed to parse spoken birthdate and used placeholder instead of asking user to clarify.',
  'asked_user',
  0.002200,
  410
);
*/

