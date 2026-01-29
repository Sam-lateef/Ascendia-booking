/**
 * Agent Configuration Loader
 * Loads agent configuration from database instead of hardcoded values
 * This makes agent behavior configurable via admin UI
 */

import { getSupabaseAdmin } from './supabaseClient';

export interface WorkflowStep {
  text: string;
  isMandatory: boolean;
  isSuccess: boolean;
}

export interface AgentWorkflow {
  id: string;
  workflow_id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  display_order: number;
}

export interface BusinessRule {
  id: string;
  title: string;
  rule_text: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  applies_to: string[];
  display_order: number;
}

export interface DomainPrompts {
  persona_prompt: string;
  extraction_prompt: string;
  business_rules: string;
}

export interface TwoAgentInstructions {
  receptionist: string;
  supervisor: string;
  mode: 'two_agent';
}

export interface OneAgentInstructions {
  instructions: string;
  mode: 'one_agent';
}

export type AgentInstructions = OneAgentInstructions | TwoAgentInstructions;

// Cache for performance (1 minute TTL)
let workflowsCache: { data: AgentWorkflow[]; timestamp: number } | null = null;
let rulesCache: { data: BusinessRule[]; timestamp: number } | null = null;
let promptsCache: { data: DomainPrompts; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 1 minute

/**
 * Load active workflows from database
 */
export async function loadAgentWorkflows(): Promise<AgentWorkflow[]> {
  // Check cache
  if (workflowsCache && Date.now() - workflowsCache.timestamp < CACHE_TTL) {
    return workflowsCache.data;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('agent_workflows')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[Config Loader] Failed to load workflows:', error);
      return getFallbackWorkflows();
    }

    workflowsCache = { data: data || [], timestamp: Date.now() };
    return data || [];
  } catch (err) {
    console.error('[Config Loader] Error loading workflows:', err);
    return getFallbackWorkflows();
  }
}

/**
 * Load active business rules from database
 * @param appliesTo - Filter rules by what they apply to ('orchestrator', 'lexi', 'extractor')
 */
export async function loadBusinessRules(appliesTo?: string): Promise<BusinessRule[]> {
  // Check cache
  if (rulesCache && Date.now() - rulesCache.timestamp < CACHE_TTL) {
    const rules = rulesCache.data;
    return appliesTo ? rules.filter(r => r.applies_to.includes(appliesTo)) : rules;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('business_rules')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[Config Loader] Failed to load business rules:', error);
      return getFallbackBusinessRules();
    }

    rulesCache = { data: data || [], timestamp: Date.now() };
    const rules = data || [];
    return appliesTo ? rules.filter(r => r.applies_to.includes(appliesTo)) : rules;
  } catch (err) {
    console.error('[Config Loader] Error loading business rules:', err);
    return getFallbackBusinessRules();
  }
}

/**
 * Load domain prompts (persona, extraction, business rules)
 * For now, loads from the first active domain
 * TODO: Make domain-specific when multi-domain support is needed
 */
export async function loadDomainPrompts(): Promise<DomainPrompts> {
  // Check cache
  if (promptsCache && Date.now() - promptsCache.timestamp < CACHE_TTL) {
    return promptsCache.data;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('domains')
      .select('system_prompt_template, business_rules')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('[Config Loader] Failed to load domain prompts:', error);
      return getFallbackPrompts();
    }

    const prompts = {
      persona_prompt: data.system_prompt_template || '',
      extraction_prompt: '', // Not stored separately in current schema
      business_rules: data.business_rules || ''
    };

    promptsCache = { data: prompts, timestamp: Date.now() };
    return prompts;
  } catch (err) {
    console.error('[Config Loader] Error loading domain prompts:', err);
    return getFallbackPrompts();
  }
}

/**
 * Load organization-specific instructions from channel configuration
 * Falls back to global domain prompts if no org-specific instructions
 * @param organizationId - Organization UUID
 * @param channel - Channel name (e.g., 'retell', 'twilio', 'web')
 */
export async function loadOrgInstructions(
  organizationId: string,
  channel: string = 'retell'
): Promise<DomainPrompts> {
  console.log(`[Config Loader] 🔍 Loading instructions for org ${organizationId}, channel: ${channel}`);
  
  try {
    const supabase = getSupabaseAdmin();
    
    // Test database connection first
    const { error: testError } = await supabase.from('channel_configurations').select('id').limit(1);
    if (testError) {
      console.error('[Config Loader] ❌ Database connection test failed:', testError);
      throw testError;
    }
    console.log('[Config Loader] ✅ Database connection OK');
    
    // Try to load channel-specific instructions first
    console.log(`[Config Loader] Querying channel_configurations for org ${organizationId}...`);
    const { data: channelConfig, error: channelError } = await supabase
      .from('channel_configurations')
      .select('instructions, one_agent_instructions, receptionist_instructions, supervisor_instructions, enabled, ai_backend, settings')
      .eq('organization_id', organizationId)
      .eq('channel', channel)
      .single();

    if (channelError) {
      console.log(`[Config Loader] ⚠️ No channel config found (error: ${channelError.message})`);
    } else {
      // Determine which instructions field to use based on agent_mode
      const agentMode = channelConfig?.settings?.agent_mode || 'one_agent';
      let effectiveInstructions = null;
      
      if (agentMode === 'two_agent') {
        // For two-agent mode, use receptionist instructions
        effectiveInstructions = channelConfig?.receptionist_instructions;
      } else {
        // For one-agent mode, prefer one_agent_instructions, fallback to legacy instructions
        effectiveInstructions = channelConfig?.one_agent_instructions || channelConfig?.instructions;
      }
      
      console.log(`[Config Loader] Found channel config:`, {
        agent_mode: agentMode,
        has_instructions: !!effectiveInstructions,
        instructions_length: effectiveInstructions?.length || 0,
        enabled: channelConfig?.enabled,
        ai_backend: channelConfig?.ai_backend
      });
      
      if (effectiveInstructions) {
        console.log(`[Config Loader] ✅ Using org-specific instructions (${effectiveInstructions.length} chars, mode: ${agentMode})`);
        return {
          persona_prompt: effectiveInstructions,
          extraction_prompt: '',
          business_rules: ''
        };
      }
    }

    // Fallback: Load global domain prompts
    console.log(`[Config Loader] No channel-specific instructions, trying global domain prompts...`);
    const globalPrompts = await loadDomainPrompts();
    console.log(`[Config Loader] Global prompts loaded:`, {
      has_persona: !!globalPrompts.persona_prompt,
      persona_length: globalPrompts.persona_prompt?.length || 0
    });
    return globalPrompts;
  } catch (err) {
    console.error('[Config Loader] ❌ Error loading org instructions:', err);
    console.log('[Config Loader] Attempting fallback to global domain prompts...');
    try {
      return await loadDomainPrompts();
    } catch (fallbackErr) {
      console.error('[Config Loader] ❌ Fallback also failed:', fallbackErr);
      return getFallbackPrompts();
    }
  }
}

/**
 * Format workflows as text for LLM instructions
 */
export function formatWorkflowsAsInstructions(workflows: AgentWorkflow[]): string {
  return workflows.map(wf => {
    const header = `═══════════════════════════════════════════════════════════════════════════════
FLOW: ${wf.name.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════════`;
    
    const steps = wf.steps.map((step, i) => `${i + 1}. ${step.text}`).join('\n');
    
    return `${header}\n\n${steps}\n`;
  }).join('\n\n');
}

/**
 * Format business rules as text for LLM instructions
 */
export function formatBusinessRulesAsInstructions(rules: BusinessRule[]): string {
  const header = `═══════════════════════════════════════════════════════════════════════════════
BUSINESS RULES - CRITICAL CONSTRAINTS
═══════════════════════════════════════════════════════════════════════════════\n`;
  
  const rulesList = rules
    .sort((a, b) => {
      // Sort by severity first
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.display_order - b.display_order;
    })
    .map((rule, i) => {
      const prefix = rule.severity === 'critical' ? '⚠️ CRITICAL:' : 
                     rule.severity === 'high' ? '❗' : '•';
      return `${prefix} ${rule.title}\n   ${rule.rule_text}`;
    })
    .join('\n\n');
  
  return header + rulesList;
}

/**
 * Load agent instructions based on channel configuration
 * Returns the appropriate instructions for one-agent or two-agent mode
 * @param organizationId - Organization UUID
 * @param channel - Channel name (e.g., 'retell', 'twilio', 'web')
 */
export async function loadAgentInstructions(
  organizationId: string,
  channel: string = 'retell'
): Promise<AgentInstructions | null> {
  console.log(`[Config Loader] 🔍 Loading agent instructions for org ${organizationId}, channel: ${channel}`);
  
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: channelConfig, error: channelError } = await supabase
      .from('channel_configurations')
      .select('one_agent_instructions, receptionist_instructions, supervisor_instructions, settings')
      .eq('organization_id', organizationId)
      .eq('channel', channel)
      .single();

    if (channelError || !channelConfig) {
      console.log(`[Config Loader] ⚠️ No channel config found`);
      return null;
    }

    const agentMode = channelConfig?.settings?.agent_mode || 'one_agent';
    
    if (agentMode === 'two_agent') {
      if (!channelConfig.receptionist_instructions || !channelConfig.supervisor_instructions) {
        console.log(`[Config Loader] ⚠️ Two-agent mode configured but instructions missing`);
        return null;
      }
      
      console.log(`[Config Loader] ✅ Loaded two-agent instructions (receptionist: ${channelConfig.receptionist_instructions.length} chars, supervisor: ${channelConfig.supervisor_instructions.length} chars)`);
      
      return {
        receptionist: channelConfig.receptionist_instructions,
        supervisor: channelConfig.supervisor_instructions,
        mode: 'two_agent',
      };
    } else {
      if (!channelConfig.one_agent_instructions) {
        console.log(`[Config Loader] ⚠️ One-agent mode configured but instructions missing`);
        return null;
      }
      
      console.log(`[Config Loader] ✅ Loaded one-agent instructions (${channelConfig.one_agent_instructions.length} chars)`);
      
      return {
        instructions: channelConfig.one_agent_instructions,
        mode: 'one_agent',
      };
    }
  } catch (err) {
    console.error('[Config Loader] ❌ Error loading agent instructions:', err);
    return null;
  }
}

/**
 * Clear cache (call after updating config)
 */
export function clearConfigCache() {
  workflowsCache = null;
  rulesCache = null;
  promptsCache = null;
}

// ============================================
// Fallback Configurations (if database fails)
// ============================================

function getFallbackWorkflows(): AgentWorkflow[] {
  return [
    {
      id: 'fallback-book',
      workflow_id: 'book',
      name: 'Book New Appointment',
      description: 'Fallback workflow',
      steps: [
        { text: 'Identify patient', isMandatory: false, isSuccess: false },
        { text: 'Gather appointment details', isMandatory: false, isSuccess: false },
        { text: 'Check availability', isMandatory: false, isSuccess: false },
        { text: 'Present options', isMandatory: true, isSuccess: false },
        { text: 'Confirm and book', isMandatory: false, isSuccess: false }
      ],
      display_order: 1
    }
  ];
}

function getFallbackBusinessRules(): BusinessRule[] {
  return [
    {
      id: 'fallback-1',
      title: 'Never Skip User Choices',
      rule_text: 'ALWAYS present options. NEVER pick for the user.',
      severity: 'critical',
      category: 'workflow',
      applies_to: ['orchestrator'],
      display_order: 1
    }
  ];
}

function getFallbackPrompts(): DomainPrompts {
  return {
    persona_prompt: 'You are a helpful assistant.',
    extraction_prompt: 'Extract user intent and entities from the conversation.',
    business_rules: 'Follow standard business practices.'
  };
}

