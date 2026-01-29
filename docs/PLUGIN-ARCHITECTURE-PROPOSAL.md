# Plugin Architecture Proposal
**Date:** Jan 25, 2026  
**Goal:** Make agents, functions, and data layers pluggable components

---

## 🎯 VISION

Transform the current **hardcoded booking system** into a **pluggable agent platform** where:
- Different business domains (booking, CRM, support, etc.) are plugins
- Agents can load different function sets dynamically
- Data sources are swappable (local DB, external APIs, different Supabase)
- Channel handlers route to configured plugins
- Everything is configured via database, not code

---

## 📊 CURRENT ARCHITECTURE (Analysis)

### **What's Hardcoded:**
```typescript
// ❌ Hardcoded in agent configs
import * as bookingFunctions from './functions/booking';
const lexiTools = [ getAllPatients, createAppointment, ... ]; // Static list

// ❌ Hardcoded API route
/api/booking → always routes to booking functions

// ❌ Hardcoded data source
const { data } = await supabase.from('patients').select(); // Always Supabase

// ❌ Hardcoded instructions
const instructions = "You are a dental receptionist..."; // In code
```

### **What's Already Flexible:**
```typescript
// ✅ Channel config (DB-driven)
const channelConfig = await getChannelConfig(orgId, 'twilio');

// ✅ Instructions (DB-driven via channel_configurations.instructions)
const instructions = channelConfig.instructions;

// ✅ Data integrations (DB-driven routing)
const dataIntegrations = channelConfig.data_integrations; // ['opendental', 'google_calendar']
```

---

## 🏗️ PROPOSED PLUGIN ARCHITECTURE

### **Core Concept: Domain Plugins**

A **Domain Plugin** is a self-contained module that provides:
1. **Function Registry** - Available functions/tools
2. **Data Adapter** - How to access data
3. **Instructions Template** - Agent behavior
4. **Validation Schema** - Parameter validation
5. **UI Components** - Admin configuration screens

---

## 🧩 PLUGIN STRUCTURE

### **1. Plugin Manifest Schema**

Each plugin is defined by a manifest in the database:

```sql
CREATE TABLE plugin_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- 'booking', 'crm', 'support'
  version TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Configuration
  config_schema JSONB, -- JSON Schema for plugin settings
  default_config JSONB, -- Default configuration values
  
  -- Capabilities
  functions JSONB NOT NULL, -- Array of function definitions
  data_adapters JSONB NOT NULL, -- Available data sources
  instruction_template TEXT, -- Default agent instructions
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-organization plugin instances
CREATE TABLE plugin_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plugin_id UUID REFERENCES plugin_manifests(id),
  
  -- Configuration
  enabled BOOLEAN DEFAULT true,
  config JSONB, -- Organization-specific overrides
  data_adapter_config JSONB, -- Data source connection details
  
  -- API endpoint mapping
  api_endpoint TEXT, -- e.g., '/api/plugins/booking' or '/api/plugins/crm'
  
  UNIQUE(organization_id, plugin_id)
);
```

### **2. Function Registry Pattern**

```typescript
// src/app/lib/plugins/types.ts

export interface PluginFunction {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  handler: string; // Path to handler: 'plugins/booking/functions/getPatients'
  validation?: {
    required: string[];
    optional?: string[];
    example: Record<string, any>;
  };
}

export interface DataAdapter {
  name: string; // 'supabase', 'external-api', 'google-calendar'
  type: 'database' | 'api' | 'service';
  config: {
    connectionString?: string;
    apiEndpoint?: string;
    credentials?: string; // Reference to api_credentials
  };
  
  // Standard interface all adapters must implement
  methods: {
    list: (entity: string, filters: any) => Promise<any[]>;
    get: (entity: string, id: string) => Promise<any>;
    create: (entity: string, data: any) => Promise<any>;
    update: (entity: string, id: string, data: any) => Promise<any>;
    delete: (entity: string, id: string) => Promise<void>;
  };
}

export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  
  functions: PluginFunction[];
  dataAdapters: DataAdapter[];
  instructionTemplate: string;
  
  configSchema: Record<string, any>; // JSON Schema
  defaultConfig: Record<string, any>;
}
```

---

## 🔌 IMPLEMENTATION STRATEGY

### **Phase 1: Extract Current Booking System into Plugin**

1. **Create Plugin Loader**
```typescript
// src/app/lib/plugins/PluginLoader.ts

export class PluginLoader {
  private plugins = new Map<string, PluginManifest>();
  private instances = new Map<string, any>(); // orgId-pluginName → instance
  
  async loadPlugin(pluginName: string): Promise<PluginManifest> {
    // Load from database or file system
    const { data } = await supabase
      .from('plugin_manifests')
      .select('*')
      .eq('name', pluginName)
      .single();
      
    const manifest = JSON.parse(data.manifest);
    this.plugins.set(pluginName, manifest);
    return manifest;
  }
  
  async getPluginInstance(orgId: string, pluginName: string) {
    const cacheKey = `${orgId}-${pluginName}`;
    
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey);
    }
    
    // Load plugin instance config
    const { data } = await supabase
      .from('plugin_instances')
      .select('*, plugin:plugin_manifests(*)')
      .eq('organization_id', orgId)
      .eq('plugin.name', pluginName)
      .single();
      
    if (!data?.enabled) {
      throw new Error(`Plugin ${pluginName} not enabled for organization`);
    }
    
    // Instantiate plugin with config
    const PluginClass = await this.loadPluginClass(pluginName);
    const instance = new PluginClass(data.config, data.data_adapter_config);
    
    this.instances.set(cacheKey, instance);
    return instance;
  }
  
  private async loadPluginClass(pluginName: string) {
    // Dynamic import of plugin implementation
    const module = await import(`@/app/plugins/${pluginName}/index`);
    return module.default;
  }
}
```

2. **Create Base Plugin Class**
```typescript
// src/app/lib/plugins/BasePlugin.ts

export abstract class BasePlugin {
  constructor(
    protected config: Record<string, any>,
    protected dataAdapterConfig: Record<string, any>
  ) {}
  
  abstract getManifest(): PluginManifest;
  abstract getFunctions(): Map<string, Function>;
  abstract getDataAdapter(): DataAdapter;
  abstract generateInstructions(context?: any): string;
  
  // Standard interface for function execution
  async executeFunction(
    functionName: string,
    parameters: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    const functions = this.getFunctions();
    const handler = functions.get(functionName);
    
    if (!handler) {
      throw new Error(`Function ${functionName} not found in plugin`);
    }
    
    // Execute with data adapter
    const adapter = this.getDataAdapter();
    return await handler(parameters, adapter, context);
  }
}

export interface ExecutionContext {
  organizationId: string;
  channel: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}
```

3. **Refactor Booking as Plugin**
```typescript
// src/app/plugins/booking/index.ts

import { BasePlugin, PluginManifest } from '@/app/lib/plugins/BasePlugin';
import * as functions from './functions';
import { SupabaseAdapter } from './adapters/SupabaseAdapter';

export default class BookingPlugin extends BasePlugin {
  getManifest(): PluginManifest {
    return {
      name: 'booking',
      version: '1.0.0',
      displayName: 'Appointment Booking',
      description: 'Dental appointment booking and patient management',
      
      functions: [
        {
          name: 'GetAllPatients',
          description: 'Retrieve all patients',
          parameters: {},
          handler: 'functions/patients/getAll',
          validation: { required: [], example: {} }
        },
        {
          name: 'CreateAppointment',
          description: 'Book a new appointment',
          parameters: {
            PatNum: { type: 'number', required: true },
            AptDateTime: { type: 'string', format: 'date-time', required: true },
            // ... more parameters
          },
          handler: 'functions/appointments/create',
          validation: {
            required: ['PatNum', 'AptDateTime', 'ProvNum', 'Op'],
            example: { PatNum: 1, AptDateTime: '2025-12-15 10:00:00' }
          }
        },
        // ... all other booking functions
      ],
      
      dataAdapters: [
        {
          name: 'local-supabase',
          type: 'database',
          config: { connectionString: 'env:SUPABASE_URL' }
        },
        {
          name: 'opendental',
          type: 'api',
          config: { apiEndpoint: 'configured-per-org' }
        }
      ],
      
      instructionTemplate: `You are a dental receptionist...`,
      
      configSchema: {
        type: 'object',
        properties: {
          allowSameDayBooking: { type: 'boolean', default: true },
          requirePatientConsent: { type: 'boolean', default: false },
          // ... more config options
        }
      },
      
      defaultConfig: {
        allowSameDayBooking: true,
        requirePatientConsent: false
      }
    };
  }
  
  getFunctions(): Map<string, Function> {
    return new Map([
      ['GetAllPatients', functions.getAllPatients],
      ['CreateAppointment', functions.createAppointment],
      // ... all functions
    ]);
  }
  
  getDataAdapter(): DataAdapter {
    // Return configured adapter based on dataAdapterConfig
    if (this.dataAdapterConfig.type === 'supabase') {
      return new SupabaseAdapter(this.dataAdapterConfig);
    } else if (this.dataAdapterConfig.type === 'opendental') {
      return new OpenDentalAdapter(this.dataAdapterConfig);
    }
    throw new Error('Unknown data adapter type');
  }
  
  generateInstructions(context?: any): string {
    // Return instructions, optionally personalized with context
    return this.getManifest().instructionTemplate;
  }
}
```

### **Phase 2: Create Generic Plugin API Route**

```typescript
// src/app/api/plugins/[pluginName]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PluginLoader } from '@/app/lib/plugins/PluginLoader';

const pluginLoader = new PluginLoader();

export async function POST(
  request: NextRequest,
  { params }: { params: { pluginName: string } }
) {
  try {
    const orgId = request.headers.get('x-organization-id');
    const body = await request.json();
    const { function: functionName, parameters } = body;
    
    // Load plugin instance for this organization
    const plugin = await pluginLoader.getPluginInstance(orgId, params.pluginName);
    
    // Execute function
    const result = await plugin.executeFunction(
      functionName,
      parameters,
      {
        organizationId: orgId,
        channel: request.headers.get('x-channel') || 'unknown',
        sessionId: body.sessionId
      }
    );
    
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error(`[Plugin API] Error in ${params.pluginName}:`, error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Migrate existing /api/booking → /api/plugins/booking
// But keep /api/booking as alias for backward compatibility
```

### **Phase 3: Update Channel Configuration**

Extend `channel_configurations` to include plugin routing:

```sql
ALTER TABLE channel_configurations
ADD COLUMN plugin_assignments JSONB DEFAULT '[]'::jsonb;

-- Example data:
UPDATE channel_configurations 
SET plugin_assignments = '[
  {
    "plugin": "booking",
    "enabled": true,
    "priority": 1
  },
  {
    "plugin": "crm",
    "enabled": true,
    "priority": 2
  }
]'::jsonb
WHERE channel = 'twilio';
```

Update channel loader:

```typescript
export interface ChannelConfig {
  // ... existing fields
  plugin_assignments?: PluginAssignment[];
}

interface PluginAssignment {
  plugin: string; // Plugin name
  enabled: boolean;
  priority: number; // Execution order
}
```

### **Phase 4: Dynamic Agent Configuration**

```typescript
// src/app/lib/agents/DynamicAgentBuilder.ts

export class DynamicAgentBuilder {
  async buildAgent(
    organizationId: string,
    channel: string
  ): Promise<{
    instructions: string;
    tools: any[];
    dataRouting: Map<string, DataAdapter>;
  }> {
    // Load channel config
    const channelConfig = await getChannelConfig(organizationId, channel);
    
    // Load assigned plugins
    const plugins = await Promise.all(
      (channelConfig.plugin_assignments || [])
        .filter(p => p.enabled)
        .sort((a, b) => a.priority - b.priority)
        .map(assignment => 
          pluginLoader.getPluginInstance(organizationId, assignment.plugin)
        )
    );
    
    // Merge instructions from all plugins
    const instructions = this.mergeInstructions(
      channelConfig.instructions, // Channel-specific override
      plugins.map(p => p.generateInstructions())
    );
    
    // Collect all tools from plugins
    const tools = plugins.flatMap(plugin => 
      Array.from(plugin.getFunctions().entries()).map(([name, handler]) => ({
        name,
        handler,
        plugin: plugin.getManifest().name
      }))
    );
    
    // Map data routing (which plugin handles which data)
    const dataRouting = new Map();
    plugins.forEach(plugin => {
      dataRouting.set(plugin.getManifest().name, plugin.getDataAdapter());
    });
    
    return { instructions, tools, dataRouting };
  }
  
  private mergeInstructions(
    channelOverride: string | null,
    pluginInstructions: string[]
  ): string {
    if (channelOverride) return channelOverride;
    
    return pluginInstructions.join('\n\n---\n\n');
  }
}
```

---

## 🎨 EXAMPLE: Creating a CRM Plugin

Let's say you want to add a CRM plugin for managing leads:

### **1. Define Plugin Manifest**

```typescript
// src/app/plugins/crm/index.ts

export default class CRMPlugin extends BasePlugin {
  getManifest(): PluginManifest {
    return {
      name: 'crm',
      version: '1.0.0',
      displayName: 'Customer Relationship Management',
      description: 'Lead tracking and customer management',
      
      functions: [
        {
          name: 'CreateLead',
          description: 'Create a new lead',
          parameters: {
            name: { type: 'string', required: true },
            email: { type: 'string', required: true },
            phone: { type: 'string', required: false },
            source: { type: 'string', required: true }
          },
          handler: 'functions/leads/create'
        },
        {
          name: 'GetLeadsByStatus',
          description: 'Retrieve leads by status',
          parameters: {
            status: { type: 'string', enum: ['new', 'contacted', 'qualified', 'lost'] }
          },
          handler: 'functions/leads/getByStatus'
        }
      ],
      
      dataAdapters: [
        {
          name: 'external-crm',
          type: 'api',
          config: { apiEndpoint: 'https://external-crm-api.com' }
        }
      ],
      
      instructionTemplate: `You can help manage customer relationships by creating leads and tracking their status.`,
      
      configSchema: {
        type: 'object',
        properties: {
          autoQualifyLeads: { type: 'boolean', default: false },
          requireManagerApproval: { type: 'boolean', default: true }
        }
      }
    };
  }
  
  getFunctions(): Map<string, Function> {
    return new Map([
      ['CreateLead', this.createLead.bind(this)],
      ['GetLeadsByStatus', this.getLeadsByStatus.bind(this)]
    ]);
  }
  
  getDataAdapter(): DataAdapter {
    return new ExternalCRMAdapter(this.dataAdapterConfig);
  }
  
  private async createLead(params: any, adapter: DataAdapter, context: ExecutionContext) {
    // Implementation using adapter
    return await adapter.create('leads', {
      ...params,
      organizationId: context.organizationId,
      createdAt: new Date().toISOString()
    });
  }
  
  private async getLeadsByStatus(params: any, adapter: DataAdapter, context: ExecutionContext) {
    return await adapter.list('leads', {
      status: params.status,
      organizationId: context.organizationId
    });
  }
}
```

### **2. Register Plugin in Database**

```sql
INSERT INTO plugin_manifests (name, version, display_name, description, functions, data_adapters)
VALUES (
  'crm',
  '1.0.0',
  'CRM Plugin',
  'Lead tracking and customer management',
  '[...]'::jsonb, -- JSON version of manifest
  '[...]'::jsonb
);
```

### **3. Enable for Organization**

```sql
INSERT INTO plugin_instances (organization_id, plugin_id, enabled, config, api_endpoint)
VALUES (
  '660d9ca6-b200-4c12-9b8d-af0a470d8b88',
  (SELECT id FROM plugin_manifests WHERE name = 'crm'),
  true,
  '{"autoQualifyLeads": true}'::jsonb,
  '/api/plugins/crm'
);
```

### **4. Assign to Channel**

```sql
UPDATE channel_configurations
SET plugin_assignments = '[
  {"plugin": "booking", "enabled": true, "priority": 1},
  {"plugin": "crm", "enabled": true, "priority": 2}
]'::jsonb
WHERE organization_id = '660d9ca6-b200-4c12-9b8d-af0a470d8b88'
AND channel = 'twilio';
```

### **5. Agent Now Has Both Capabilities!**

```typescript
// When Twilio call comes in for this org:
const agent = await agentBuilder.buildAgent(orgId, 'twilio');

// Agent now has tools from BOTH plugins:
agent.tools = [
  { name: 'GetAllPatients', plugin: 'booking' },
  { name: 'CreateAppointment', plugin: 'booking' },
  { name: 'CreateLead', plugin: 'crm' },
  { name: 'GetLeadsByStatus', plugin: 'crm' }
];

// Instructions include both domains:
agent.instructions = `
You are a receptionist at a dental office.
You handle appointment booking and patient management.
You can also create leads and track customer relationships.
...
`;
```

---

## 🔐 DATA ADAPTER ABSTRACTION

Create a standard interface for all data sources:

```typescript
// src/app/lib/plugins/adapters/DataAdapter.ts

export interface DataAdapter {
  // CRUD operations
  list(entity: string, filters: Record<string, any>): Promise<any[]>;
  get(entity: string, id: string | number): Promise<any>;
  create(entity: string, data: Record<string, any>): Promise<any>;
  update(entity: string, id: string | number, data: Record<string, any>): Promise<any>;
  delete(entity: string, id: string | number): Promise<void>;
  
  // Query operations
  query(entity: string, query: Record<string, any>): Promise<any[]>;
  
  // Batch operations
  batchCreate(entity: string, items: Record<string, any>[]): Promise<any[]>;
  batchUpdate(entity: string, updates: Array<{ id: string | number; data: Record<string, any> }>): Promise<any[]>;
  
  // Metadata
  getSchema(entity: string): Promise<Record<string, any>>;
  listEntities(): Promise<string[]>;
}

// Implementations:
// - SupabaseAdapter (local database)
// - ExternalAPIAdapter (REST APIs)
// - GraphQLAdapter (GraphQL APIs)
// - GoogleCalendarAdapter (Google Calendar API)
// - OpenDentalAdapter (OpenDental API)
```

---

## 🎛️ ADMIN UI FOR PLUGINS

Create a plugin management page:

```typescript
// src/app/admin/settings/plugins/page.tsx

export default function PluginsPage() {
  const [availablePlugins, setAvailablePlugins] = useState([]);
  const [enabledPlugins, setEnabledPlugins] = useState([]);
  
  return (
    <div>
      <h1>Plugin Management</h1>
      
      {/* Available Plugins */}
      <section>
        <h2>Available Plugins</h2>
        {availablePlugins.map(plugin => (
          <PluginCard
            key={plugin.name}
            plugin={plugin}
            onEnable={() => enablePlugin(plugin.name)}
          />
        ))}
      </section>
      
      {/* Enabled Plugins */}
      <section>
        <h2>Enabled Plugins</h2>
        {enabledPlugins.map(instance => (
          <EnabledPluginCard
            key={instance.id}
            instance={instance}
            onConfigure={() => openPluginConfig(instance)}
            onDisable={() => disablePlugin(instance.id)}
          />
        ))}
      </section>
      
      {/* Channel-Plugin Assignment */}
      <section>
        <h2>Channel Assignments</h2>
        <ChannelPluginMatrix
          channels={['twilio', 'retell', 'whatsapp', 'web']}
          plugins={enabledPlugins}
          onChange={updateAssignments}
        />
      </section>
    </div>
  );
}
```

---

## 🚀 MIGRATION PATH

### **Step 1: Extract Booking into Plugin Structure**
- Create `src/app/plugins/booking/`
- Move functions to plugin directory
- Implement `BookingPlugin` class
- Keep `/api/booking` as legacy alias

### **Step 2: Create Plugin Loader Infrastructure**
- Implement `PluginLoader` class
- Create `BasePlugin` abstract class
- Add database tables for plugin manifests

### **Step 3: Update Channel Configuration**
- Add `plugin_assignments` to `channel_configurations`
- Migrate existing configs to use booking plugin

### **Step 4: Create Generic Plugin API**
- Implement `/api/plugins/[pluginName]` route
- Test with booking plugin
- Ensure backward compatibility

### **Step 5: Build New Plugins**
- Create CRM plugin as example
- Create Google Calendar plugin (native, not external integration)
- Test multi-plugin agents

### **Step 6: UI for Plugin Management**
- Plugin marketplace/library page
- Plugin configuration pages
- Channel-plugin assignment matrix

---

## ✅ BENEFITS

### **For You (Platform Owner):**
- Add new capabilities without changing core code
- Easy to test plugins in isolation
- Different orgs can have different plugin sets
- Plugins are portable and reusable

### **For Clients (Organizations):**
- Pick and choose features they need
- Configure plugins independently
- No code deployment for new features
- Mix and match capabilities per channel

### **For Developers:**
- Clear plugin API to follow
- Self-contained modules
- Easy to debug
- Versioned and upgradable

---

## 🎯 EXAMPLE USE CASES

### **Use Case 1: Multi-Domain Agent**
Organization wants a Twilio agent that:
- Books appointments (booking plugin)
- Creates support tickets (support plugin)
- Tracks leads (CRM plugin)

**Configuration:**
```json
{
  "channel": "twilio",
  "plugin_assignments": [
    { "plugin": "booking", "enabled": true, "priority": 1 },
    { "plugin": "support", "enabled": true, "priority": 2 },
    { "plugin": "crm", "enabled": true, "priority": 3 }
  ]
}
```

### **Use Case 2: External Data Only**
Organization wants WhatsApp agent that:
- Uses external Salesforce CRM (no local DB)
- Uses external Google Calendar (no booking DB)

**Configuration:**
```json
{
  "channel": "whatsapp",
  "plugin_assignments": [
    {
      "plugin": "salesforce-crm",
      "enabled": true,
      "data_adapter": {
        "type": "api",
        "endpoint": "https://api.salesforce.com",
        "credentials": "credential-id-123"
      }
    },
    {
      "plugin": "google-calendar",
      "enabled": true,
      "data_adapter": {
        "type": "oauth2",
        "credentials": "credential-id-456"
      }
    }
  ]
}
```

### **Use Case 3: Different Supabase Instance**
Organization wants their own Supabase instance for data:

**Configuration:**
```json
{
  "channel": "web",
  "plugin_assignments": [
    {
      "plugin": "booking",
      "enabled": true,
      "data_adapter": {
        "type": "supabase",
        "url": "https://their-project.supabase.co",
        "anonKey": "their-anon-key"
      }
    }
  ]
}
```

---

## 📋 NEXT STEPS

### **Immediate (Current Sprint):**
1. Design plugin manifest schema
2. Create database migrations for plugin tables
3. Build `PluginLoader` and `BasePlugin` classes
4. Extract booking into plugin structure (maintain backward compatibility)

### **Short-term (Next Sprint):**
5. Create generic plugin API route
6. Build CRM plugin as proof of concept
7. Build native Google Calendar plugin
8. Add plugin management UI

### **Long-term:**
9. Plugin marketplace/discovery
10. Plugin versioning and upgrades
11. Third-party plugin support
12. Plugin testing framework

---

## 🎉 VISION: The Future

Imagine an organization saying:

> "We need a voice agent that handles dental appointments, creates Salesforce leads, sends SMS reminders via Twilio, books Zoom meetings, and logs everything to our own Supabase. Oh, and we want it to speak Spanish."

**With this plugin architecture, your response is:**

"Just enable these plugins in your dashboard:
- ✅ Booking Plugin (connects to your Supabase)
- ✅ Salesforce CRM Plugin (connects to your Salesforce)
- ✅ SMS Plugin (Twilio integration)
- ✅ Zoom Plugin (meeting scheduler)
- ✅ Translation Plugin (Spanish language support)

Configure in 5 minutes, no code required." 🚀

---

**This transforms your platform from a booking SaaS into a composable agent platform!**
