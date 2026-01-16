/**
 * Dynamic Agent Configuration Loader
 * Loads all agent configuration from database (company info, tools, instructions)
 * Makes the system domain-agnostic and fully configurable
 */

import { getSupabaseAdmin } from './supabaseClient';
import { z } from 'zod';

// ============================================
// TYPES
// ============================================

export interface CompanyInfo {
  id: string;
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
  model: string;
  temperature: number;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: string | null;
  parameters: Record<string, any>;
  returns_description: string | null;
  api_route: string;
  is_virtual: boolean;
  is_active: boolean;
  display_order: number;
}

export interface AgentInstruction {
  id: string;
  name: string;
  description: string | null;
  instruction_template: string;
  instruction_type: 'persona' | 'business_logic' | 'fallback' | 'safety';
  system_type: string | null;
  is_active: boolean;
  display_order: number;
}

export interface AgentConfig {
  company: CompanyInfo;
  tools: AgentTool[];
  instructions: AgentInstruction[];
}

// ============================================
// CACHE
// ============================================

let configCache: { data: AgentConfig; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 1 minute

/**
 * Load complete agent configuration from database
 */
export async function loadAgentConfig(): Promise<AgentConfig> {
  // Check cache
  if (configCache && Date.now() - configCache.timestamp < CACHE_TTL) {
    return configCache.data;
  }

  try {
    const supabase = getSupabaseAdmin();

    // Load company info
    const { data: company, error: companyError } = await supabase
      .from('company_info')
      .select('*')
      .eq('is_active', true)
      .single();

    if (companyError || !company) {
      console.error('[Config Loader] Failed to load company info:', companyError);
      throw new Error('Company info not configured');
    }

    // Load tools
    const { data: tools, error: toolsError } = await supabase
      .from('agent_tools')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (toolsError) {
      console.error('[Config Loader] Failed to load tools:', toolsError);
      throw new Error('Failed to load tools');
    }

    // Load instructions
    const { data: instructions, error: instructionsError } = await supabase
      .from('agent_instructions')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (instructionsError) {
      console.error('[Config Loader] Failed to load instructions:', instructionsError);
      throw new Error('Failed to load instructions');
    }

    const config: AgentConfig = {
      company,
      tools: tools || [],
      instructions: instructions || [],
    };

    // Update cache
    configCache = { data: config, timestamp: Date.now() };

    console.log('[Config Loader] ✅ Loaded configuration:', {
      company: company.company_name,
      tools: tools?.length || 0,
      instructions: instructions?.length || 0,
    });

    return config;
  } catch (error) {
    console.error('[Config Loader] Error loading config:', error);
    throw error;
  }
}

/**
 * Clear configuration cache
 * Call this when config is updated in admin UI
 */
export function clearAgentConfigCache() {
  configCache = null;
  console.log('[Config Loader] Cache cleared');
}

/**
 * Generate Lexi's instructions from database configuration
 */
export function generateInstructionsFromConfig(config: AgentConfig): string {
  const { company, instructions } = config;

  // Build instructions by combining all active instruction templates
  const sections = instructions.map((inst) => {
    // Replace template variables
    let template = inst.instruction_template
      .replace(/{company_name}/g, company.company_name)
      .replace(/{persona_name}/g, company.persona_name)
      .replace(/{persona_role}/g, company.persona_role)
      .replace(/{phone}/g, company.phone || '')
      .replace(/{email}/g, company.email || '')
      .replace(/{address}/g, company.address || '')
      .replace(/{hours_weekdays}/g, company.hours.weekdays || '')
      .replace(/{hours_saturday}/g, company.hours.saturday || '')
      .replace(/{hours_sunday}/g, company.hours.sunday || '')
      .replace(/{services_list}/g, company.services.join(', '));

    return template;
  }).join('\n\n');

  return sections;
}

/**
 * Convert database tool to Zod schema for Realtime SDK
 */
export function toolToZodSchema(tool: AgentTool): Record<string, any> {
  const zodSchema: Record<string, any> = {};

  for (const [paramName, paramConfig] of Object.entries(tool.parameters)) {
    const config = paramConfig as any;
    
    let fieldSchema: any;
    
    // Map type to Zod
    switch (config.type) {
      case 'string':
        fieldSchema = z.string();
        break;
      case 'number':
        fieldSchema = z.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      default:
        fieldSchema = z.string();
    }

    // Add nullable if specified
    if (config.nullable) {
      fieldSchema = fieldSchema.nullable();
    }

    // Add optional if not required
    if (!config.required) {
      fieldSchema = fieldSchema.optional();
    }

    // Add description
    if (config.description) {
      fieldSchema = fieldSchema.describe(config.description);
    }

    zodSchema[paramName] = fieldSchema;
  }

  return zodSchema;
}

/**
 * Get list of available tools formatted for instructions
 */
export function formatToolsList(tools: AgentTool[]): string {
  const byCategory: Record<string, AgentTool[]> = {};
  
  tools.forEach((tool) => {
    const category = tool.category || 'other';
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(tool);
  });

  const sections = Object.entries(byCategory).map(([category, tools]) => {
    const header = category.toUpperCase() + ' FUNCTIONS:';
    const toolsList = tools.map((t) => {
      const params = Object.keys(t.parameters).join(', ');
      return `- ${t.name}(${params}) → ${t.description}`;
    }).join('\n');
    return `${header}\n${toolsList}`;
  });

  return sections.join('\n\n');
}





























