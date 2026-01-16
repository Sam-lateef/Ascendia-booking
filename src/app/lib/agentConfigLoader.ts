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

