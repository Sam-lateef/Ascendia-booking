-- Migration: Store Agent Configuration in Database
-- Makes workflows, business rules, and prompts configurable via UI

-- ============================================
-- Table 1: Agent Workflows
-- Stores deterministic workflow definitions
-- ============================================
CREATE TABLE IF NOT EXISTS agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Identification
  workflow_id TEXT UNIQUE NOT NULL,  -- 'book', 'reschedule', 'cancel'
  name TEXT NOT NULL,
  description TEXT,
  
  -- Configuration
  steps JSONB NOT NULL,  -- Array of step objects with text, isMandatory, isSuccess
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_by TEXT,
  last_modified_by TEXT
);

-- ============================================
-- Table 2: Business Rules
-- Stores operational constraints for agents
-- ============================================
CREATE TABLE IF NOT EXISTS business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Rule details
  title TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
  
  -- Categorization
  category TEXT,  -- 'workflow', 'validation', 'safety', etc.
  applies_to TEXT[],  -- ['orchestrator', 'lexi', 'extractor']
  
  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_by TEXT,
  last_modified_by TEXT
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_agent_workflows_active ON agent_workflows(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_id ON agent_workflows(workflow_id);
CREATE INDEX IF NOT EXISTS idx_business_rules_active ON business_rules(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_business_rules_severity ON business_rules(severity);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_workflows_updated_at
  BEFORE UPDATE ON agent_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER business_rules_updated_at
  BEFORE UPDATE ON business_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Seed Data: Current Workflows
-- ============================================
INSERT INTO agent_workflows (workflow_id, name, description, steps, display_order) VALUES
(
  'book',
  'Book New Appointment',
  'Complete workflow for booking a new appointment from scratch',
  '[
    {"text": "Identify patient (by name or phone)", "isMandatory": false, "isSuccess": false},
    {"text": "Patient not found → Collect DOB & phone → CreatePatient()", "isMandatory": false, "isSuccess": false},
    {"text": "Patient found → Welcome back + show existing appointments", "isMandatory": false, "isSuccess": false},
    {"text": "Gather details (type, date, time preference)", "isMandatory": false, "isSuccess": false},
    {"text": "GetAvailableSlots(dateStart, dateEnd, ProvNum, OpNum)", "isMandatory": false, "isSuccess": false},
    {"text": "**MANDATORY:** Present 3 time options (DO NOT pick for user!)", "isMandatory": true, "isSuccess": false},
    {"text": "Wait for user to select specific time", "isMandatory": false, "isSuccess": false},
    {"text": "Confirm: \"Booking [type] on [date] at [time]. Shall I confirm?\"", "isMandatory": false, "isSuccess": false},
    {"text": "CreateAppointment(PatNum, AptDateTime, ProvNum, Op, Note)", "isMandatory": false, "isSuccess": false},
    {"text": "Success: \"Perfect! Your [type] is confirmed for [date] at [time].\"", "isMandatory": false, "isSuccess": true}
  ]'::jsonb,
  1
),
(
  'reschedule',
  'Reschedule Existing Appointment',
  'Workflow for moving an existing appointment to a new date/time',
  '[
    {"text": "Identify patient", "isMandatory": false, "isSuccess": false},
    {"text": "**MANDATORY:** Show existing appointments", "isMandatory": true, "isSuccess": false},
    {"text": "User selects which appointment", "isMandatory": false, "isSuccess": false},
    {"text": "**MANDATORY:** Ask for new date (DO NOT assume!)", "isMandatory": true, "isSuccess": false},
    {"text": "Wait for user to provide specific date", "isMandatory": false, "isSuccess": false},
    {"text": "GetAvailableSlots() with new date", "isMandatory": false, "isSuccess": false},
    {"text": "**MANDATORY:** Present time options", "isMandatory": true, "isSuccess": false},
    {"text": "Wait for user selection", "isMandatory": false, "isSuccess": false},
    {"text": "Confirm: \"Moving it to [date] at [time]. Confirm?\"", "isMandatory": false, "isSuccess": false},
    {"text": "UpdateAppointment(AptNum, AptDateTime, ProvNum, Op)", "isMandatory": false, "isSuccess": false},
    {"text": "Success: \"Done! Your appointment is now [date] at [time].\"", "isMandatory": false, "isSuccess": true}
  ]'::jsonb,
  2
),
(
  'cancel',
  'Cancel Appointment',
  'Workflow for canceling an existing appointment',
  '[
    {"text": "Identify patient", "isMandatory": false, "isSuccess": false},
    {"text": "GetAppointments() → Show appointments", "isMandatory": false, "isSuccess": false},
    {"text": "User selects which to cancel", "isMandatory": false, "isSuccess": false},
    {"text": "Confirm: \"Cancel your [date] at [time] appointment?\"", "isMandatory": false, "isSuccess": false},
    {"text": "BreakAppointment(AptNum) or UpdateAppointment(AptStatus=\"Cancelled\")", "isMandatory": false, "isSuccess": false},
    {"text": "Success: \"Your [date] appointment has been cancelled.\"", "isMandatory": false, "isSuccess": true}
  ]'::jsonb,
  3
);

-- ============================================
-- Seed Data: Business Rules
-- ============================================
INSERT INTO business_rules (title, rule_text, severity, category, applies_to, display_order) VALUES
(
  'Never Skip User Choices',
  'ALWAYS present time options. NEVER pick a time for the user.',
  'critical',
  'workflow',
  ARRAY['orchestrator'],
  1
),
(
  'Always Ask for New Date',
  'When rescheduling, ALWAYS ask for the new date. DO NOT assume "next week" or any date.',
  'critical',
  'workflow',
  ARRAY['orchestrator'],
  2
),
(
  'Show Existing Appointments',
  'Before any changes, ALWAYS show current appointments first.',
  'high',
  'workflow',
  ARRAY['orchestrator'],
  3
),
(
  'Explicit Confirmation Required',
  'Wait for explicit "yes" before creating/updating appointments.',
  'high',
  'validation',
  ARRAY['orchestrator', 'lexi'],
  4
),
(
  'Date Validation',
  'NEVER use Feb 29 in non-leap years (2025, 2026, 2027). Use Feb 28 instead.',
  'medium',
  'validation',
  ARRAY['orchestrator', 'extractor'],
  5
),
(
  'Required Parameters',
  'GetAvailableSlots requires ALL 4 params: dateStart, dateEnd, ProvNum, OpNum.',
  'high',
  'validation',
  ARRAY['orchestrator'],
  6
);

-- ============================================
-- Views for Easy Access
-- ============================================

-- View: Active workflows in display order
CREATE OR REPLACE VIEW active_workflows AS
SELECT 
  id,
  workflow_id,
  name,
  description,
  steps,
  display_order,
  updated_at
FROM agent_workflows
WHERE is_active = TRUE
ORDER BY display_order;

-- View: Active business rules by severity
CREATE OR REPLACE VIEW active_business_rules AS
SELECT 
  id,
  title,
  rule_text,
  severity,
  category,
  applies_to,
  display_order
FROM business_rules
WHERE is_active = TRUE
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  display_order;

