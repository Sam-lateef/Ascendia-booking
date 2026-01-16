-- ============================================
-- Agent Configuration System
-- Makes the entire system domain-agnostic and configurable via UI
-- ============================================

-- ============================================
-- Table 1: COMPANY_INFO
-- Store company/business information
-- ============================================
CREATE TABLE IF NOT EXISTS company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Basic Info
  company_name TEXT NOT NULL,
  persona_name TEXT NOT NULL DEFAULT 'Lexi',
  persona_role TEXT NOT NULL DEFAULT 'receptionist',
  
  -- Contact Details
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  
  -- Hours (JSONB for flexibility)
  -- Example: { "weekdays": "Monday-Friday: 8:00 AM - 5:00 PM", "saturday": "Closed", "sunday": "Closed" }
  hours JSONB DEFAULT '{}'::jsonb,
  
  -- Services/Products (Array)
  services TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Policies (JSONB for flexibility)
  -- Example: { "cancellation": "24-hour notice required", "newCustomers": "New patients welcome" }
  policies JSONB DEFAULT '{}'::jsonb,
  
  -- System Configuration
  system_type TEXT CHECK (system_type IN ('booking', 'crm', 'inventory', 'ecommerce', 'custom')) DEFAULT 'booking',
  api_endpoint TEXT DEFAULT '/api/booking',
  
  -- Voice Settings
  voice TEXT DEFAULT 'sage',
  model TEXT DEFAULT 'gpt-4o-realtime-preview-2024-12-17',
  temperature NUMERIC DEFAULT 0.8,
  
  -- Active Status
  is_active BOOLEAN DEFAULT TRUE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_company_info_active ON company_info(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_company_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_info_updated_at ON company_info;
CREATE TRIGGER company_info_updated_at
  BEFORE UPDATE ON company_info
  FOR EACH ROW
  EXECUTE FUNCTION update_company_info_updated_at();

-- ============================================
-- Table 2: AGENT_TOOLS
-- Dynamic tool/function configuration
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tool Identification
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT, -- 'patients', 'appointments', 'contacts', 'inventory', 'context'
  
  -- Parameters (Zod-compatible JSON schema)
  -- Example: {
  --   "Phone": { "type": "string", "required": false, "nullable": true, "description": "10-digit phone" },
  --   "PatNum": { "type": "number", "required": true, "description": "Patient ID" }
  -- }
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Return Type
  returns_description TEXT,
  
  -- Execution
  api_route TEXT NOT NULL, -- '/api/booking', '/api/crm'
  is_virtual BOOLEAN DEFAULT FALSE, -- Virtual functions (AskUser, PresentOptions, etc.)
  
  -- Display
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_tools_active ON agent_tools(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_agent_tools_category ON agent_tools(category);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS agent_tools_updated_at ON agent_tools;
CREATE TRIGGER agent_tools_updated_at
  BEFORE UPDATE ON agent_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_company_info_updated_at();

-- ============================================
-- Table 3: AGENT_INSTRUCTIONS
-- Store instruction templates and business logic
-- ============================================
CREATE TABLE IF NOT EXISTS agent_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  
  -- Content
  instruction_template TEXT NOT NULL,
  -- Template variables supported:
  -- {company_name}, {persona_name}, {persona_role}
  -- {phone}, {email}, {address}
  -- {hours_weekdays}, {hours_saturday}, {hours_sunday}
  -- {services_list}, {tools_list}
  
  -- Categorization
  instruction_type TEXT CHECK (instruction_type IN ('persona', 'business_logic', 'fallback', 'safety')) DEFAULT 'business_logic',
  system_type TEXT, -- 'booking', 'crm', 'inventory', 'generic', null for all
  
  -- Display
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_by TEXT,
  last_modified_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_instructions_active ON agent_instructions(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_agent_instructions_type ON agent_instructions(instruction_type);
CREATE INDEX IF NOT EXISTS idx_agent_instructions_system ON agent_instructions(system_type);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS agent_instructions_updated_at ON agent_instructions;
CREATE TRIGGER agent_instructions_updated_at
  BEFORE UPDATE ON agent_instructions
  FOR EACH ROW
  EXECUTE FUNCTION update_company_info_updated_at();

-- ============================================
-- Views for Easy Access
-- ============================================

-- View: Active tools by category
CREATE OR REPLACE VIEW active_tools_by_category AS
SELECT 
  category,
  json_agg(
    json_build_object(
      'id', id,
      'name', name,
      'description', description,
      'parameters', parameters,
      'api_route', api_route,
      'is_virtual', is_virtual
    ) ORDER BY display_order
  ) as tools
FROM agent_tools
WHERE is_active = TRUE
GROUP BY category
ORDER BY category;

-- View: Active instructions by type
CREATE OR REPLACE VIEW active_instructions_by_type AS
SELECT 
  instruction_type,
  system_type,
  json_agg(
    json_build_object(
      'id', id,
      'name', name,
      'instruction_template', instruction_template
    ) ORDER BY display_order
  ) as instructions
FROM agent_instructions
WHERE is_active = TRUE
GROUP BY instruction_type, system_type
ORDER BY instruction_type, system_type;





























