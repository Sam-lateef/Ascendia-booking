/**
 * Dynamic OpenDental Agent Configuration
 * 
 * NEW UNIFIED ARCHITECTURE:
 * - Single Lexi agent with all OpenDental functions directly
 * - NO orchestrator handoff (eliminated looping/confusion)
 * - Loads configuration dynamically from database (domain-agnostic)
 * - Uses /api/opendental worker route for actual API calls
 * 
 * Configuration loaded from:
 * - company_info table: Business context, persona, API settings
 * - agent_instructions table: Business logic and flows
 * - agent_tools table: Function definitions and parameters
 */

import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

// Types for database tables (matching actual schema)
interface CompanyInfoRow {
  company_name: string;
  persona_name: string;
  persona_role: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  hours: Record<string, string>;
  services: string[];
  policies: Record<string, string>;
  system_type: string;
  api_endpoint: string;
  voice: string;
  is_active: boolean;
}

interface AgentInstructionRow {
  name: string;
  description: string | null;
  instruction_template: string;
  instruction_type: 'persona' | 'business_logic' | 'fallback' | 'safety';
  system_type: string | null;
  is_active: boolean;
  display_order: number;
}

interface AgentToolRow {
  name: string;
  description: string;
  category: string | null;
  parameters: Record<string, any>;  // Note: column is 'parameters', not 'parameters_schema'
  returns_description: string | null;
  api_route: string;  // Note: column is 'api_route', not 'endpoint'
  is_virtual: boolean;
  is_active: boolean;
  display_order: number;
}

/**
 * Build a Realtime SDK tool from database configuration
 * Each tool calls the /api/opendental worker route with the function name and parameters
 */
function buildOpenDentalTool(toolConfig: AgentToolRow) {
  // Parse the parameters from JSON
  const paramsSchema = toolConfig.parameters as Record<string, any>;
  
  // Build Zod schema from JSON schema
  const zodSchema: Record<string, any> = {};
  const requiredFields = paramsSchema.required || [];
  
  if (paramsSchema.properties) {
    for (const [key, propDef] of Object.entries(paramsSchema.properties as Record<string, any>)) {
      let fieldSchema: any;
      
      // Map JSON schema types to Zod types
      switch (propDef.type) {
        case 'string':
          fieldSchema = z.string();
          if (propDef.description) {
            fieldSchema = fieldSchema.describe(propDef.description);
          }
          break;
        case 'number':
          fieldSchema = z.number();
          if (propDef.description) {
            fieldSchema = fieldSchema.describe(propDef.description);
          }
          break;
        case 'boolean':
          fieldSchema = z.boolean();
          if (propDef.description) {
            fieldSchema = fieldSchema.describe(propDef.description);
          }
          break;
        case 'integer':
          fieldSchema = z.number().int();
          if (propDef.description) {
            fieldSchema = fieldSchema.describe(propDef.description);
          }
          break;
        default:
          fieldSchema = z.any();
      }
      
      // Make field optional if not in required array
      if (!requiredFields.includes(key)) {
        fieldSchema = fieldSchema.optional().nullable();
      }
      
      zodSchema[key] = fieldSchema;
    }
  }
  
  // Create the tool with dynamic schema
  return tool({
    name: toolConfig.name,
    description: toolConfig.description,
    parameters: Object.keys(zodSchema).length > 0 ? z.object(zodSchema) : z.object({}),
    execute: async (parameters: Record<string, any>) => {
      try {
        console.log(`[${toolConfig.name}] Calling with:`, JSON.stringify(parameters, null, 2));
        
        // Call the worker route (e.g., /api/opendental or /api/booking)
        const response = await fetch(`${toolConfig.api_route}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            functionName: toolConfig.name,
            parameters: parameters || {},
          }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.error(`[${toolConfig.name}] Error:`, result);
          return JSON.stringify({
            error: true,
            message: result.error || result.message || 'API call failed',
            statusCode: response.status,
          });
        }
        
        console.log(`[${toolConfig.name}] Success:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      } catch (error) {
        console.error(`[${toolConfig.name}] Exception:`, error);
        return JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    },
  });
}

/**
 * Load company info from database
 */
async function loadCompanyInfo(): Promise<CompanyInfoRow | null> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('company_info')
    .select('*')
    .eq('is_active', true)
    .single();
  
  if (error || !data) {
    console.error('[OpenDental Dynamic] Failed to load company info:', error);
    return null;
  }
  
  return data as CompanyInfoRow;
}

/**
 * Load agent instructions from database
 */
async function loadInstructions(): Promise<AgentInstructionRow[]> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('agent_instructions')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  
  if (error) {
    console.error('[OpenDental Dynamic] Failed to load instructions:', error);
    return [];
  }
  
  return (data as AgentInstructionRow[]) || [];
}

/**
 * Load agent tools from database
 */
async function loadTools(): Promise<AgentToolRow[]> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('agent_tools')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  
  if (error) {
    console.error('[OpenDental Dynamic] Failed to load tools:', error);
    return [];
  }
  
  return (data as AgentToolRow[]) || [];
}

/**
 * Initialize the dynamic OpenDental scenario
 * Loads all configuration from database
 */
export async function initializeDynamicOpenDentalScenario(): Promise<RealtimeAgent[]> {
  try {
    // Load configuration from database
    const companyInfo = await loadCompanyInfo();
    const instructions = await loadInstructions();
    const tools = await loadTools();
    
    if (!companyInfo) {
      throw new Error('Company info not found or not active');
    }
    
    // Extract key settings
    const agentName = companyInfo.persona_name || 'Lexi';
    const agentVoice = companyInfo.voice || 'sage';
    const companyName = companyInfo.company_name || 'Barton Dental';
    
    // Build instructions from database sections
    const instructionText = instructions
      .sort((a: AgentInstructionRow, b: AgentInstructionRow) => a.display_order - b.display_order)
      .map((inst: AgentInstructionRow) => inst.instruction_template)
      .join('\n\n');
    
    // Build context header
    const contextHeader = `You are ${agentName}, the AI receptionist for ${companyName}.\n\n`;
    
    // Build tools array
    const realtimeTools = tools.map((toolConfig: AgentToolRow) => buildOpenDentalTool(toolConfig));
    
    console.log(`[OpenDental Dynamic] Initialized with ${tools.length} tools`);
    
    // Create the unified Lexi agent
    const lexiAgent = new RealtimeAgent({
      name: agentName,
      voice: agentVoice as any,
      instructions: contextHeader + instructionText,
      tools: realtimeTools,
    });
    
    return [lexiAgent];
  } catch (error) {
    console.error('[OpenDental Dynamic] Failed to initialize:', error);
    
    // Fallback to a minimal agent if database load fails
    const fallbackAgent = new RealtimeAgent({
      name: 'Lexi',
      voice: 'sage',
      instructions: 'You are Lexi, an AI receptionist. There was an error loading your configuration. Please inform the caller that you are experiencing technical difficulties.',
      tools: [],
    });
    
    return [fallbackAgent];
  }
}

// Lazy loading pattern to avoid top-level await
let scenarioPromise: Promise<RealtimeAgent[]> | null = null;

export function getOpenDentalScenarioDynamic(): Promise<RealtimeAgent[]> {
  if (!scenarioPromise) {
    scenarioPromise = initializeDynamicOpenDentalScenario();
  }
  return scenarioPromise;
}

// Export as empty array initially (will be filled on initialization)
export const openDentalScenarioDynamic: RealtimeAgent[] = [];

/**
 * Initialize the dynamic OpenDental scenario
 * Call this early in app lifecycle (auto-called on server-side)
 */
export async function initializeOpenDentalScenario() {
  try {
    const agents = await initializeDynamicOpenDentalScenario();
    openDentalScenarioDynamic.length = 0;
    openDentalScenarioDynamic.push(...agents);
    console.log('[OpenDental Dynamic] ✅ Scenario initialized');
  } catch (err) {
    console.error('[OpenDental Dynamic] ❌ Failed to initialize:', err);
  }
}

// Auto-initialize on module load (SERVER-SIDE ONLY)
// Client-side cannot access Supabase admin keys for security reasons
// The server builds the agents and passes them to the client
if (typeof window === 'undefined') {
  // Server-side: Initialize immediately during build/server startup
  console.log('[OpenDental Dynamic] 🔧 Server-side initialization starting...');
  initializeOpenDentalScenario().then(() => {
    console.log('[OpenDental Dynamic] ✅ Server-side initialization complete, agents array length:', openDentalScenarioDynamic.length);
  });
} else {
  // Client-side: Log what we have
  console.log('[OpenDental Dynamic] 🖥️ Client-side module loaded');
  console.log('[OpenDental Dynamic] 🖥️ Client-side agents array length:', openDentalScenarioDynamic.length);
  console.log('[OpenDental Dynamic] 🖥️ Client-side agents:', openDentalScenarioDynamic);
}

/**
 * Company name export for UI display
 */
export const openDentalCompanyName = 'Barton Dental';

export default openDentalScenarioDynamic;

