-- Add metadata columns for AI-generated workflows
-- This allows tracking confidence, warnings, and review status

ALTER TABLE dynamic_workflows
ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'pending_review',
ADD COLUMN IF NOT EXISTS generation_confidence decimal(3,2),
ADD COLUMN IF NOT EXISTS generation_warnings text[],
ADD COLUMN IF NOT EXISTS reviewed_by text,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Add index for filtering by status
CREATE INDEX IF NOT EXISTS idx_workflows_validation_status 
ON dynamic_workflows(validation_status);

-- Add index for filtering pending reviews
CREATE INDEX IF NOT EXISTS idx_workflows_pending_review 
ON dynamic_workflows(validation_status, created_at DESC)
WHERE validation_status = 'pending_review';

COMMENT ON COLUMN dynamic_workflows.validation_status IS 'Status of workflow: pending_review, approved, rejected';
COMMENT ON COLUMN dynamic_workflows.generation_confidence IS 'AI confidence score (0.0 to 1.0)';
COMMENT ON COLUMN dynamic_workflows.generation_warnings IS 'Warnings detected during generation';
COMMENT ON COLUMN dynamic_workflows.reviewed_by IS 'Admin who reviewed the workflow';
COMMENT ON COLUMN dynamic_workflows.reviewed_at IS 'When the workflow was reviewed';






























