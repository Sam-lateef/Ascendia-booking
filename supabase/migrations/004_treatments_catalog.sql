-- Treatments Catalog table
-- Stores all available dental treatments with pricing and configuration
-- Name will be translated using the app's translation system

CREATE TABLE IF NOT EXISTS treatments_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 30,
  requires_surface BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_treatments_catalog_category ON treatments_catalog(category);
CREATE INDEX IF NOT EXISTS idx_treatments_catalog_code ON treatments_catalog(code);
CREATE INDEX IF NOT EXISTS idx_treatments_catalog_active ON treatments_catalog(is_active);

-- Insert default treatments (English names - will be translated by the system)
INSERT INTO treatments_catalog (code, name, category, price, duration, requires_surface) VALUES
-- Restorative
('REST-001', 'Composite Filling', 'restorative', 800.00, 30, TRUE),
('REST-002', 'Amalgam Filling', 'restorative', 500.00, 30, TRUE),
('REST-003', 'Glass Ionomer Filling', 'restorative', 600.00, 30, TRUE),
('REST-004', 'Inlay/Onlay', 'restorative', 2500.00, 60, TRUE),

-- Endodontic
('ENDO-001', 'Root Canal Treatment - Anterior', 'endodontic', 1500.00, 60, FALSE),
('ENDO-002', 'Root Canal Treatment - Premolar', 'endodontic', 2000.00, 75, FALSE),
('ENDO-003', 'Root Canal Treatment - Molar', 'endodontic', 2500.00, 90, FALSE),
('ENDO-004', 'Root Canal Retreatment', 'endodontic', 3000.00, 90, FALSE),

-- Periodontal
('PERIO-001', 'Scaling and Root Planing', 'periodontal', 300.00, 45, FALSE),
('PERIO-002', 'Deep Cleaning (per quadrant)', 'periodontal', 400.00, 30, FALSE),
('PERIO-003', 'Gum Surgery', 'periodontal', 1500.00, 60, FALSE),
('PERIO-004', 'Pocket Reduction Surgery', 'periodontal', 2000.00, 90, FALSE),

-- Surgical
('SURG-001', 'Simple Extraction', 'surgical', 300.00, 20, FALSE),
('SURG-002', 'Surgical Extraction', 'surgical', 800.00, 45, FALSE),
('SURG-003', 'Wisdom Tooth Extraction', 'surgical', 1200.00, 60, FALSE),
('SURG-004', 'Bone Graft', 'surgical', 2000.00, 60, FALSE),
('SURG-005', 'Dental Implant', 'surgical', 5000.00, 90, FALSE),

-- Prosthodontic
('PROS-001', 'Porcelain Crown', 'prosthodontic', 3000.00, 60, FALSE),
('PROS-002', 'Zirconia Crown', 'prosthodontic', 4000.00, 60, FALSE),
('PROS-003', 'Metal Crown', 'prosthodontic', 2000.00, 60, FALSE),
('PROS-004', 'Dental Bridge (per unit)', 'prosthodontic', 2500.00, 60, FALSE),
('PROS-005', 'Complete Denture', 'prosthodontic', 3500.00, 120, FALSE),
('PROS-006', 'Partial Denture', 'prosthodontic', 2500.00, 90, FALSE),
('PROS-007', 'Veneer', 'prosthodontic', 3500.00, 45, FALSE),

-- Preventive
('PREV-001', 'Dental Cleaning', 'preventive', 200.00, 30, FALSE),
('PREV-002', 'Fluoride Treatment', 'preventive', 100.00, 15, FALSE),
('PREV-003', 'Sealant (per tooth)', 'preventive', 150.00, 15, FALSE),
('PREV-004', 'Night Guard', 'preventive', 800.00, 30, FALSE),

-- Diagnostic
('DIAG-001', 'Comprehensive Exam', 'diagnostic', 150.00, 30, FALSE),
('DIAG-002', 'Periodic Exam', 'diagnostic', 75.00, 15, FALSE),
('DIAG-003', 'Panoramic X-Ray', 'diagnostic', 100.00, 10, FALSE),
('DIAG-004', 'Bitewing X-Rays (4)', 'diagnostic', 80.00, 10, FALSE),
('DIAG-005', 'Periapical X-Ray', 'diagnostic', 40.00, 5, FALSE),
('DIAG-006', 'CBCT Scan', 'diagnostic', 300.00, 15, FALSE)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  duration = EXCLUDED.duration,
  requires_surface = EXCLUDED.requires_surface;
