-- ============================================
-- Intent Triggers Table
-- 
-- Stores learned intent triggers from LLM validation.
-- When LLM validates a new phrase → intent mapping,
-- it gets added here so future matches are deterministic.
-- ============================================

CREATE TABLE IF NOT EXISTS intent_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Trigger phrase (lowercase, normalized)
  phrase TEXT UNIQUE NOT NULL,
  
  -- Intent it maps to (book, reschedule, cancel, check)
  intent TEXT NOT NULL,
  
  -- Source: 'hardcoded' or 'learned'
  source TEXT NOT NULL DEFAULT 'learned',
  
  -- Original message that led to learning this trigger
  original_message TEXT,
  
  -- Usage tracking
  times_matched INTEGER DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Admin notes
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intent_triggers_phrase ON intent_triggers(phrase);
CREATE INDEX IF NOT EXISTS idx_intent_triggers_intent ON intent_triggers(intent);
CREATE INDEX IF NOT EXISTS idx_intent_triggers_active ON intent_triggers(is_active);
CREATE INDEX IF NOT EXISTS idx_intent_triggers_times ON intent_triggers(times_matched DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_intent_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS intent_triggers_updated_at ON intent_triggers;
CREATE TRIGGER intent_triggers_updated_at
  BEFORE UPDATE ON intent_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_intent_triggers_updated_at();

-- View for trigger analytics
CREATE OR REPLACE VIEW intent_trigger_stats AS
SELECT 
  intent,
  source,
  COUNT(*) as trigger_count,
  SUM(times_matched) as total_matches,
  AVG(times_matched) as avg_matches_per_trigger
FROM intent_triggers
WHERE is_active = TRUE
GROUP BY intent, source
ORDER BY total_matches DESC;

