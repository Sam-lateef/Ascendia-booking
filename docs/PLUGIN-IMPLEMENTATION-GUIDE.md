# Plugin Implementation Guide - Step by Step
**Date:** Jan 25, 2026  
**Goal:** Practical guide to implementing the plugin architecture

---

## 🎯 IMPLEMENTATION PHASES

### **Phase 1: Foundation** (Week 1)
- Database schema for plugins
- Base classes and interfaces
- Plugin loader infrastructure

### **Phase 2: Migration** (Week 2)
- Extract booking system into plugin
- Maintain backward compatibility
- Test thoroughly

### **Phase 3: Expansion** (Week 3-4)
- Create new plugins (Google Calendar, CRM)
- Build plugin management UI
- Documentation

---

## 📐 PHASE 1: FOUNDATION

### **Step 1.1: Create Database Schema**

```sql
-- File: supabase/migrations/050_plugin_system.sql

-- Plugin registry (available plugins)
CREATE TABLE plugin_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  version TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Plugin definition
  manifest JSONB NOT NULL, -- Full manifest including functions, adapters, etc.
  
  -- Metadata
  is_system BOOLEAN DEFAULT false, -- System plugins can't be deleted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT plugin_name_version UNIQUE (name, version)
);

-- Per-organization plugin instances
CREATE TABLE plugin_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plugin_manifest_id UUID NOT NULL REFERENCES plugin_manifests(id) ON DELETE RESTRICT,
  
  -- Configuration
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb, -- Organization-specific overrides
  data_adapter_config JSONB DEFAULT '{}'::jsonb, -- Data source configuration
  
  -- API routing
  api_endpoint TEXT, -- e.g., '/api/plugins/booking'
  
  -- Metadata
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  UNIQUE(organization_id, plugin_manifest_id)
);

-- Plugin-to-channel assignments
CREATE TABLE channel_plugin_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_configuration_id UUID NOT NULL REFERENCES channel_configurations(id) ON DELETE CASCADE,
  plugin_instance_id UUID NOT NULL REFERENCES plugin_instances(id) ON DELETE CASCADE,
  
  -- Assignment config
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100, -- Lower = higher priority (execution order)
  
  -- Settings specific to this channel-plugin combo
  channel_specific_config JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(channel_configuration_id, plugin_instance_id)
);

-- Indexes for performance
CREATE INDEX idx_plugin_instances_org ON plugin_instances(organization_id);
CREATE INDEX idx_plugin_instances_enabled ON plugin_instances(organization_id, enabled);
CREATE INDEX idx_channel_plugin_assignments_channel ON channel_plugin_assignments(channel_configuration_id);

-- RLS Policies
ALTER TABLE plugin_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_plugin_assignments ENABLE ROW LEVEL SECURITY;

-- Plugin manifests are readable by all (like a marketplace)
CREATE POLICY "Plugin manifests are readable by authenticated users"
  ON plugin_manifests FOR SELECT
  TO authenticated
  USING (true);

-- Plugin instances are organization-scoped
CREATE POLICY "Plugin instances are organization-scoped"
  ON plugin_instances FOR ALL
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- Channel plugin assignments follow channel RLS
CREATE POLICY "Channel plugin assignments follow channel RLS"
  ON channel_plugin_assignments FOR ALL
  TO authenticated
  USING (
    channel_configuration_id IN (
      SELECT id FROM channel_configurations 
      WHERE organization_id = get_current_organization_id()
    )
  );

-- Insert booking plugin as system plugin
INSERT INTO plugin_manifests (name, version, display_name, description, manifest, is_system)
VALUES (
  'booking',
  '1.0.0',
  'Appointment Booking',
  'Dental appointment booking and patient management system',
  '{
    "name": "booking",
    "version": "1.0.0",
    "displayName": "Appointment Booking",
    "description": "Dental appointment booking and patient management",
    "capabilities": {
      "entities": ["patients", "appointments", "providers", "operatories", "schedules"],
      "operations": ["create", "read", "update", "delete", "search"]
    },
    "functions": [],
    "dataAdapters": ["local-supabase", "opendental-api"],
    "configSchema": {
      "type": "object",
      "properties": {
        "allowSameDayBooking": {"type": "boolean", "default": true},
        "requirePatientConsent": {"type": "boolean", "default": false},
        "defaultAppointmentDuration": {"type": "integer", "default": 60}
      }
    }
  }'::jsonb,
  true
);

COMMENT ON TABLE plugin_manifests IS 'Registry of available plugins (marketplace)';
COMMENT ON TABLE plugin_instances IS 'Per-organization plugin installations with configuration';
COMMENT ON TABLE channel_plugin_assignments IS 'Maps plugins to specific channels with priority';
```

### **Step 1.2: Create TypeScript Types**

```typescript
// src/app/lib/plugins/types.ts

export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  
  capabilities: {
    entities: string[]; // ['patients', 'appointments', ...]
    operations: ('create' | 'read' | 'update' | 'delete' | 'search')[];
  };
  
  functions: PluginFunction[];
  dataAdapters: string[]; // ['local-supabase', 'external-api', ...]
  
  configSchema: {
    type: 'object';
    properties: Record<string, any>;
  };
  
  defaultConfig?: Record<string, any>;
}

export interface PluginFunction {
  name: string;
  description: string;
  parameters: Record<string, ParameterDefinition>;
  returns?: any;
  
  // Validation
  required?: string[];
  optional?: string[];
  example?: Record<string, any>;
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: any;
  enum?: any[];
  format?: string; // 'date', 'date-time', 'email', 'phone', etc.
}

export interface PluginInstance {
  id: string;
  organizationId: string;
  pluginManifestId: string;
  
  enabled: boolean;
  config: Record<string, any>;
  dataAdapterConfig: DataAdapterConfig;
  apiEndpoint: string;
  
  installedAt: Date;
  lastUsedAt?: Date;
  
  // Joined data
  manifest?: PluginManifest;
}

export interface DataAdapterConfig {
  type: 'supabase' | 'rest-api' | 'graphql' | 'oauth2';
  
  // Supabase adapter
  supabaseUrl?: string;
  supabaseKey?: string;
  
  // REST API adapter
  apiEndpoint?: string;
  apiKeyCredentialId?: string;
  
  // OAuth2 adapter
  oauth2CredentialId?: string;
  
  // Custom settings
  custom?: Record<string, any>;
}

export interface ExecutionContext {
  organizationId: string;
  channel: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}
```

### **Step 1.3: Create Base Plugin Interface**

```typescript
// src/app/lib/plugins/BasePlugin.ts

import { PluginManifest, PluginFunction, ExecutionContext } from './types';

export abstract class BasePlugin {
  constructor(
    protected config: Record<string, any>,
    protected dataAdapterConfig: any
  ) {}
  
  /**
   * Get plugin manifest (metadata, capabilities, config schema)
   */
  abstract getManifest(): PluginManifest;
  
  /**
   * Get all available functions with their handlers
   */
  abstract getFunctions(): Map<string, PluginFunctionHandler>;
  
  /**
   * Initialize plugin (load resources, validate config, etc.)
   */
  async initialize(): Promise<void> {
    // Override in subclasses if needed
  }
  
  /**
   * Execute a function by name
   */
  async executeFunction(
    functionName: string,
    parameters: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    const functions = this.getFunctions();
    const handler = functions.get(functionName);
    
    if (!handler) {
      throw new PluginError(`Function ${functionName} not found in plugin ${this.getManifest().name}`);
    }
    
    // Validate parameters
    await this.validateParameters(functionName, parameters);
    
    // Execute
    try {
      return await handler(parameters, context);
    } catch (error: any) {
      throw new PluginError(
        `Function ${functionName} execution failed: ${error.message}`,
        { functionName, parameters, originalError: error }
      );
    }
  }
  
  /**
   * Validate function parameters against schema
   */
  protected async validateParameters(
    functionName: string,
    parameters: Record<string, any>
  ): Promise<void> {
    const manifest = this.getManifest();
    const functionDef = manifest.functions.find(f => f.name === functionName);
    
    if (!functionDef) {
      throw new PluginError(`Function ${functionName} not defined in manifest`);
    }
    
    // Check required parameters
    if (functionDef.required) {
      for (const required of functionDef.required) {
        if (parameters[required] === undefined || parameters[required] === null) {
          throw new PluginError(
            `Missing required parameter: ${required}`,
            { functionName, required: functionDef.required, provided: Object.keys(parameters) }
          );
        }
      }
    }
    
    // Type validation (basic)
    for (const [param, definition] of Object.entries(functionDef.parameters)) {
      if (parameters[param] !== undefined) {
        const actualType = typeof parameters[param];
        if (definition.type === 'number' && actualType !== 'number') {
          throw new PluginError(`Parameter ${param} must be a number`);
        }
        // Add more type checks as needed
      }
    }
  }
  
  /**
   * Get data adapter for this plugin instance
   */
  abstract getDataAdapter(): Promise<DataAdapter>;
}

export type PluginFunctionHandler = (
  parameters: Record<string, any>,
  context: ExecutionContext
) => Promise<any>;

export class PluginError extends Error {
  constructor(
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PluginError';
  }
}
```

### **Step 1.4: Create Data Adapter Interface**

```typescript
// src/app/lib/plugins/adapters/DataAdapter.ts

export interface DataAdapter {
  /**
   * List entities with optional filtering
   */
  list(
    entity: string,
    filters?: Record<string, any>,
    options?: QueryOptions
  ): Promise<any[]>;
  
  /**
   * Get single entity by ID
   */
  get(entity: string, id: string | number): Promise<any>;
  
  /**
   * Create new entity
   */
  create(entity: string, data: Record<string, any>): Promise<any>;
  
  /**
   * Update existing entity
   */
  update(entity: string, id: string | number, data: Record<string, any>): Promise<any>;
  
  /**
   * Delete entity
   */
  delete(entity: string, id: string | number): Promise<void>;
  
  /**
   * Search/query with complex filters
   */
  query(entity: string, query: QueryBuilder): Promise<any[]>;
  
  /**
   * Batch operations
   */
  batchCreate(entity: string, items: Record<string, any>[]): Promise<any[]>;
  batchUpdate(entity: string, updates: Array<{ id: string | number; data: Record<string, any> }>): Promise<any[]>;
  
  /**
   * Get metadata about available entities and their schemas
   */
  getSchema(entity: string): Promise<EntitySchema>;
  listEntities(): Promise<string[]>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface QueryBuilder {
  filters: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
    value: any;
  }>;
  logic?: 'and' | 'or';
}

export interface EntitySchema {
  name: string;
  fields: Record<string, FieldSchema>;
  primaryKey: string;
  foreignKeys?: Record<string, string>;
}

export interface FieldSchema {
  type: string;
  nullable: boolean;
  unique?: boolean;
  default?: any;
}
```

### **Step 1.5: Implement Supabase Data Adapter**

```typescript
// src/app/lib/plugins/adapters/SupabaseAdapter.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DataAdapter, QueryOptions, QueryBuilder } from './DataAdapter';

export class SupabaseAdapter implements DataAdapter {
  private client: SupabaseClient;
  
  constructor(
    private config: {
      url: string;
      key: string;
      organizationId?: string;
    }
  ) {
    this.client = createClient(config.url, config.key);
  }
  
  async list(
    entity: string,
    filters?: Record<string, any>,
    options?: QueryOptions
  ): Promise<any[]> {
    let query = this.client.from(entity).select('*');
    
    // Apply organization filter if available
    if (this.config.organizationId) {
      query = query.eq('organization_id', this.config.organizationId);
    }
    
    // Apply filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }
    
    // Apply options
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection !== 'desc' });
    }
    
    const { data, error } = await query;
    
    if (error) throw new Error(`Supabase list error: ${error.message}`);
    return data || [];
  }
  
  async get(entity: string, id: string | number): Promise<any> {
    let query = this.client
      .from(entity)
      .select('*')
      .eq('id', id);
      
    if (this.config.organizationId) {
      query = query.eq('organization_id', this.config.organizationId);
    }
    
    const { data, error } = await query.single();
    
    if (error) throw new Error(`Supabase get error: ${error.message}`);
    return data;
  }
  
  async create(entity: string, data: Record<string, any>): Promise<any> {
    // Inject organization_id if configured
    const dataWithOrg = this.config.organizationId
      ? { ...data, organization_id: this.config.organizationId }
      : data;
    
    const { data: created, error } = await this.client
      .from(entity)
      .insert(dataWithOrg)
      .select()
      .single();
    
    if (error) throw new Error(`Supabase create error: ${error.message}`);
    return created;
  }
  
  async update(entity: string, id: string | number, data: Record<string, any>): Promise<any> {
    let query = this.client
      .from(entity)
      .update(data)
      .eq('id', id);
      
    if (this.config.organizationId) {
      query = query.eq('organization_id', this.config.organizationId);
    }
    
    const { data: updated, error } = await query.select().single();
    
    if (error) throw new Error(`Supabase update error: ${error.message}`);
    return updated;
  }
  
  async delete(entity: string, id: string | number): Promise<void> {
    let query = this.client
      .from(entity)
      .delete()
      .eq('id', id);
      
    if (this.config.organizationId) {
      query = query.eq('organization_id', this.config.organizationId);
    }
    
    const { error } = await query;
    
    if (error) throw new Error(`Supabase delete error: ${error.message}`);
  }
  
  async query(entity: string, queryBuilder: QueryBuilder): Promise<any[]> {
    let query = this.client.from(entity).select('*');
    
    if (this.config.organizationId) {
      query = query.eq('organization_id', this.config.organizationId);
    }
    
    for (const filter of queryBuilder.filters) {
      switch (filter.operator) {
        case 'eq': query = query.eq(filter.field, filter.value); break;
        case 'ne': query = query.neq(filter.field, filter.value); break;
        case 'gt': query = query.gt(filter.field, filter.value); break;
        case 'gte': query = query.gte(filter.field, filter.value); break;
        case 'lt': query = query.lt(filter.field, filter.value); break;
        case 'lte': query = query.lte(filter.field, filter.value); break;
        case 'in': query = query.in(filter.field, filter.value); break;
        case 'like': query = query.ilike(filter.field, `%${filter.value}%`); break;
      }
    }
    
    const { data, error } = await query;
    
    if (error) throw new Error(`Supabase query error: ${error.message}`);
    return data || [];
  }
  
  async batchCreate(entity: string, items: Record<string, any>[]): Promise<any[]> {
    const itemsWithOrg = this.config.organizationId
      ? items.map(item => ({ ...item, organization_id: this.config.organizationId }))
      : items;
    
    const { data, error } = await this.client
      .from(entity)
      .insert(itemsWithOrg)
      .select();
    
    if (error) throw new Error(`Supabase batch create error: ${error.message}`);
    return data || [];
  }
  
  async batchUpdate(
    entity: string,
    updates: Array<{ id: string | number; data: Record<string, any> }>
  ): Promise<any[]> {
    // Supabase doesn't have native batch update, do sequentially
    const results = [];
    for (const { id, data } of updates) {
      const result = await this.update(entity, id, data);
      results.push(result);
    }
    return results;
  }
  
  async getSchema(entity: string): Promise<any> {
    // This would require querying Supabase metadata
    // For now, return basic structure
    return { name: entity, fields: {}, primaryKey: 'id' };
  }
  
  async listEntities(): Promise<string[]> {
    // This would require querying Supabase schema
    // For now, return known entities
    return ['patients', 'appointments', 'providers', 'operatories', 'schedules'];
  }
}
```

---

## 🔄 PHASE 2: MIGRATE BOOKING TO PLUGIN

### **Step 2.1: Create Booking Plugin Class**

```typescript
// src/app/plugins/booking/BookingPlugin.ts

import { BasePlugin } from '@/app/lib/plugins/BasePlugin';
import { PluginManifest, ExecutionContext } from '@/app/lib/plugins/types';
import { DataAdapter } from '@/app/lib/plugins/adapters/DataAdapter';
import { SupabaseAdapter } from '@/app/lib/plugins/adapters/SupabaseAdapter';

// Import existing booking functions
import * as PatientFunctions from '@/app/api/booking/functions/patients';
import * as AppointmentFunctions from '@/app/api/booking/functions/appointments';
import * as ProviderFunctions from '@/app/api/booking/functions/providers';

export default class BookingPlugin extends BasePlugin {
  private adapter: DataAdapter | null = null;
  
  getManifest(): PluginManifest {
    return {
      name: 'booking',
      version: '1.0.0',
      displayName: 'Appointment Booking',
      description: 'Dental appointment booking and patient management system',
      
      capabilities: {
        entities: ['patients', 'appointments', 'providers', 'operatories', 'schedules'],
        operations: ['create', 'read', 'update', 'delete', 'search']
      },
      
      functions: [
        {
          name: 'GetAllPatients',
          description: 'Retrieve all patients',
          parameters: {},
          required: [],
          example: {}
        },
        {
          name: 'GetPatient',
          description: 'Get patient by ID',
          parameters: {
            PatNum: { type: 'number', description: 'Patient ID', required: true }
          },
          required: ['PatNum'],
          example: { PatNum: 1 }
        },
        {
          name: 'CreateAppointment',
          description: 'Create new appointment',
          parameters: {
            PatNum: { type: 'number', required: true },
            AptDateTime: { type: 'string', format: 'date-time', required: true },
            ProvNum: { type: 'number', required: true },
            Op: { type: 'number', required: true }
          },
          required: ['PatNum', 'AptDateTime', 'ProvNum', 'Op'],
          example: {
            PatNum: 1,
            AptDateTime: '2025-12-15 10:00:00',
            ProvNum: 1,
            Op: 1
          }
        }
        // ... add all other booking functions
      ],
      
      dataAdapters: ['local-supabase', 'opendental-api'],
      
      configSchema: {
        type: 'object',
        properties: {
          allowSameDayBooking: { type: 'boolean', default: true },
          requirePatientConsent: { type: 'boolean', default: false },
          defaultAppointmentDuration: { type: 'number', default: 60 }
        }
      },
      
      defaultConfig: {
        allowSameDayBooking: true,
        requirePatientConsent: false,
        defaultAppointmentDuration: 60
      }
    };
  }
  
  getFunctions(): Map<string, any> {
    return new Map([
      ['GetAllPatients', this.wrapFunction(PatientFunctions.GetAllPatients)],
      ['GetPatient', this.wrapFunction(PatientFunctions.GetPatient)],
      ['CreateAppointment', this.wrapFunction(AppointmentFunctions.CreateAppointment)],
      // ... map all booking functions
    ]);
  }
  
  async getDataAdapter(): Promise<DataAdapter> {
    if (this.adapter) return this.adapter;
    
    // Determine adapter based on configuration
    if (this.dataAdapterConfig.type === 'supabase' || !this.dataAdapterConfig.type) {
      this.adapter = new SupabaseAdapter({
        url: this.dataAdapterConfig.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key: this.dataAdapterConfig.supabaseKey || process.env.SUPABASE_SERVICE_KEY!,
        organizationId: this.dataAdapterConfig.organizationId
      });
    } else if (this.dataAdapterConfig.type === 'opendental') {
      // Future: OpenDentalAdapter
      throw new Error('OpenDental adapter not yet implemented');
    }
    
    return this.adapter!;
  }
  
  /**
   * Wrap existing booking functions to work with plugin interface
   */
  private wrapFunction(originalFunction: Function) {
    return async (parameters: Record<string, any>, context: ExecutionContext) => {
      // Get data adapter (Supabase client in this case)
      const adapter = await this.getDataAdapter();
      
      // Call original function
      // Note: You'll need to refactor original functions to accept adapter instead of hardcoded supabase
      return await originalFunction(parameters, adapter, context.organizationId);
    };
  }
}
```

---

## ✅ QUICK START: MINIMAL VIABLE PLUGIN

If you want to test the concept quickly, here's a minimal Google Calendar plugin:

```typescript
// src/app/plugins/google-calendar/GoogleCalendarPlugin.ts

import { BasePlugin } from '@/app/lib/plugins/BasePlugin';

export default class GoogleCalendarPlugin extends BasePlugin {
  getManifest() {
    return {
      name: 'google-calendar',
      version: '1.0.0',
      displayName: 'Google Calendar',
      description: 'Native Google Calendar integration',
      
      capabilities: {
        entities: ['events', 'calendars'],
        operations: ['create', 'read', 'update', 'delete']
      },
      
      functions: [
        {
          name: 'CreateCalendarEvent',
          description: 'Create event in Google Calendar',
          parameters: {
            summary: { type: 'string', required: true },
            startDateTime: { type: 'string', format: 'date-time', required: true },
            endDateTime: { type: 'string', format: 'date-time', required: true },
            description: { type: 'string', required: false }
          },
          required: ['summary', 'startDateTime', 'endDateTime']
        },
        {
          name: 'GetCalendarEvents',
          description: 'List calendar events',
          parameters: {
            startDate: { type: 'string', format: 'date', required: true },
            endDate: { type: 'string', format: 'date', required: true }
          }
        }
      ],
      
      dataAdapters: ['google-calendar-api'],
      configSchema: { type: 'object', properties: {} }
    };
  }
  
  getFunctions() {
    return new Map([
      ['CreateCalendarEvent', this.createEvent.bind(this)],
      ['GetCalendarEvents', this.getEvents.bind(this)]
    ]);
  }
  
  async getDataAdapter() {
    // Return Google Calendar API adapter
    return new GoogleCalendarAPIAdapter(this.dataAdapterConfig);
  }
  
  private async createEvent(params: any, context: any) {
    const calendar = google.calendar({ version: 'v3', auth: this.getAuth() });
    
    const event = {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startDateTime },
      end: { dateTime: params.endDateTime }
    };
    
    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event
    });
    
    return result.data;
  }
  
  private async getEvents(params: any, context: any) {
    const calendar = google.calendar({ version: 'v3', auth: this.getAuth() });
    
    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: params.startDate,
      timeMax: params.endDate,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    return result.data.items || [];
  }
  
  private getAuth() {
    // Load OAuth2 credentials from dataAdapterConfig
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    
    oauth2Client.setCredentials(this.dataAdapterConfig.oauth2Credentials);
    return oauth2Client;
  }
}
```

---

## 🎯 RECOMMENDED APPROACH

### **Start Small:**
1. **Week 1:** Build plugin infrastructure (BasePlugin, PluginLoader, DB tables)
2. **Week 2:** Create a simple test plugin (e.g., "hello-world" plugin with 2-3 functions)
3. **Week 3:** Migrate booking system to use plugin architecture
4. **Week 4:** Create Google Calendar as native plugin

### **Test Early:**
- Create a test plugin that just echoes back parameters
- Ensure dynamic loading works
- Test with multiple organizations
- Verify isolation and security

### **Iterate:**
- Start with basic data adapters (Supabase only)
- Add external API adapters later
- Build UI for plugin management incrementally

---

## 🚀 NEXT STEPS FOR YOU

1. **Review the proposal** - Does this match your vision?
2. **Design your first "non-booking" plugin** - What domain? What functions?
3. **Decide on timeline** - How fast do you want to implement this?
4. **I can help you:**
   - Create the migration SQL
   - Build the base classes
   - Refactor booking functions to be adapter-based
   - Create your first custom plugin

**Want me to start implementing the foundation (Phase 1)?** 🚀
