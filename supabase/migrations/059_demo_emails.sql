-- Demo Emails Table
-- Store emails from landing page visitors for marketing and demo notifications

CREATE TABLE IF NOT EXISTS demo_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_demo_emails_org ON demo_emails(organization_id);
CREATE INDEX IF NOT EXISTS idx_demo_emails_email ON demo_emails(email);
CREATE INDEX IF NOT EXISTS idx_demo_emails_created ON demo_emails(created_at DESC);

-- Add call_analysis column to conversations if it doesn't exist
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS call_analysis JSONB;

-- Index for call_analysis queries
CREATE INDEX IF NOT EXISTS idx_conversations_call_analysis ON conversations USING GIN (call_analysis);

-- Composite index for fast demo bookings query
CREATE INDEX IF NOT EXISTS idx_conversations_org_created ON conversations(organization_id, created_at DESC);

COMMENT ON TABLE demo_emails IS 'Stores visitor emails from landing page for demo notifications and marketing';
COMMENT ON COLUMN conversations.call_analysis IS 'Structured analysis data extracted from call (patient info, appointment details, booking status)';
