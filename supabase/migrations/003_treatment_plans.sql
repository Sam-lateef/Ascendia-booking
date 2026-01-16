-- Treatment Plans Migration
-- Creates tables for storing dental treatment plans

-- Treatment Plans table (one per patient visit)
CREATE TABLE IF NOT EXISTS treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(50) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_duration INTEGER NOT NULL DEFAULT 0, -- in minutes
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in-progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Treatment Plan Items table (individual treatments within a plan)
CREATE TABLE IF NOT EXISTS treatment_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  tooth_fdi VARCHAR(3) NOT NULL, -- FDI notation (e.g., "11", "36")
  surfaces TEXT[] DEFAULT '{}', -- Array of surfaces: M, O, D, B, L
  treatment_code VARCHAR(20) NOT NULL,
  treatment_name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0, -- in minutes
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'in-progress')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_id ON treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_status ON treatment_plans(status);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_plan_id ON treatment_plan_items(treatment_plan_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_tooth ON treatment_plan_items(tooth_fdi);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_treatment_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER treatment_plans_updated_at
  BEFORE UPDATE ON treatment_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_treatment_plans_updated_at();

-- Comments
COMMENT ON TABLE treatment_plans IS 'Stores dental treatment plans for patients';
COMMENT ON TABLE treatment_plan_items IS 'Individual treatments within a treatment plan';
COMMENT ON COLUMN treatment_plan_items.tooth_fdi IS 'FDI tooth notation (international standard)';
COMMENT ON COLUMN treatment_plan_items.surfaces IS 'Tooth surfaces: M(esial), O(cclusal), D(istal), B(uccal), L(ingual)';
