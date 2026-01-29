/**
 * Agent Mode Configuration
 * 
 * Manages the global agent mode (Premium vs Standard) for Twilio calls
 * Premium: gpt-4o-realtime (full power)
 * Standard: gpt-4o-mini-realtime + gpt-4o supervisor (cost-optimized)
 * 
 * Uses existing agent_configurations table with use_two_agent_mode field
 */

import { createClient } from '@supabase/supabase-js';

// Use server-side env vars (API routes run server-side)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type AgentMode = 'premium' | 'standard';

const DEFAULT_MODE: AgentMode = 'standard'; // Default to cost-optimized
const SYSTEM_AGENT_ID = 'lexi-twilio'; // System agent for Twilio calls

// In-memory cache for performance
let cachedMode: AgentMode | null = null;
let lastFetch: number = 0;
const CACHE_TTL = 5000; // 5 seconds cache

/**
 * Get the current agent mode
 * Returns 'standard' if database is not available
 */
export async function getAgentMode(): Promise<AgentMode> {
  // Return cached value if still fresh
  const now = Date.now();
  if (cachedMode && (now - lastFetch) < CACHE_TTL) {
    return cachedMode;
  }

  // Try to get from Supabase
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      const { data, error } = await supabase
        .from('agent_configurations')
        .select('use_two_agent_mode')
        .eq('agent_id', SYSTEM_AGENT_ID)
        .eq('scope', 'SYSTEM')
        .single();

      if (!error && data) {
        // use_two_agent_mode = true means Standard (cost-optimized)
        // use_two_agent_mode = false means Premium (full power)
        cachedMode = data.use_two_agent_mode ? 'standard' : 'premium';
        lastFetch = now;
        console.log(`[AgentMode] ✅ Loaded from DB: ${cachedMode.toUpperCase()} (use_two_agent_mode: ${data.use_two_agent_mode})`);
        return cachedMode;
      }
    } catch (error) {
      console.warn('[AgentMode] Database not available, using default:', DEFAULT_MODE);
    }
  }

  // Fallback to default
  cachedMode = DEFAULT_MODE;
  lastFetch = now;
  return cachedMode;
}

/**
 * Set the agent mode
 */
export async function setAgentMode(mode: AgentMode): Promise<{ success: boolean; error?: string }> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Convert mode to use_two_agent_mode boolean
    const useTwoAgentMode = mode === 'standard'; // standard = true, premium = false
    
    // Try to update existing record first
    const { data: existing } = await supabase
      .from('agent_configurations')
      .select('id')
      .eq('agent_id', SYSTEM_AGENT_ID)
      .eq('scope', 'SYSTEM')
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('agent_configurations')
        .update({ 
          use_two_agent_mode: useTwoAgentMode,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        console.error('[AgentMode] Failed to update mode:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Create new record
      const { error } = await supabase
        .from('agent_configurations')
        .insert({
          agent_id: SYSTEM_AGENT_ID,
          name: 'Lexi - Twilio Voice Agent',
          description: 'System agent for handling Twilio voice calls',
          scope: 'SYSTEM',
          llm_provider: 'openai',
          llm_model: useTwoAgentMode ? 'gpt-4o-mini-realtime-preview-2024-12-17' : 'gpt-4o-realtime-preview-2025-06-03',
          use_two_agent_mode: useTwoAgentMode,
          voice: 'sage',
          created_by: '00000000-0000-0000-0000-000000000000', // System user
        });

      if (error) {
        console.error('[AgentMode] Failed to create agent config:', error);
        return { success: false, error: error.message };
      }
    }

    // Update cache
    cachedMode = mode;
    lastFetch = Date.now();

    console.log(`[AgentMode] ✅ Mode switched to: ${mode.toUpperCase()}`);
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AgentMode] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Clear the cache (useful for testing)
 */
export function clearAgentModeCache(): void {
  cachedMode = null;
  lastFetch = 0;
}

/**
 * Get the WebSocket URL based on mode
 */
export function getWebSocketUrlForMode(mode: AgentMode): string {
  const baseUrl = process.env.TWILIO_WEBSOCKET_URL || 'wss://ascendia-ws.ngrok.io/twilio-media-stream';
  
  if (mode === 'standard') {
    return baseUrl.replace('/twilio-media-stream', '/twilio-media-stream-standard');
  }
  
  return baseUrl;
}

/**
 * Get agent instructions from database
 * Returns default instructions if database is not available
 * @deprecated Use getOrganizationInstructions() for per-org configs
 */
export async function getAgentInstructions(): Promise<{
  premiumInstructions: string | null;
  receptionistInstructions: string | null;
  supervisorInstructions: string | null;
  useManualInstructions: boolean;
}> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      premiumInstructions: null,
      receptionistInstructions: null,
      supervisorInstructions: null,
      useManualInstructions: false,
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data, error } = await supabase
      .from('agent_configurations')
      .select('manual_ai_instructions, receptionist_instructions, supervisor_instructions, use_manual_instructions')
      .eq('agent_id', SYSTEM_AGENT_ID)
      .eq('scope', 'SYSTEM')
      .single();

    if (error || !data) {
      console.warn('[AgentMode] Could not fetch instructions from database');
      return {
        premiumInstructions: null,
        receptionistInstructions: null,
        supervisorInstructions: null,
        useManualInstructions: false,
      };
    }

    const result = {
      premiumInstructions: data.manual_ai_instructions,
      receptionistInstructions: data.receptionist_instructions,
      supervisorInstructions: data.supervisor_instructions,
      useManualInstructions: data.use_manual_instructions || false,
    };
    
    console.log('[AgentMode] 📋 Instructions loaded:', {
      useManualInstructions: result.useManualInstructions,
      premiumLength: result.premiumInstructions?.length || 0,
      receptionistLength: result.receptionistInstructions?.length || 0,
      supervisorLength: result.supervisorInstructions?.length || 0,
    });
    
    return result;
  } catch (error) {
    console.warn('[AgentMode] Error fetching instructions:', error);
    return {
      premiumInstructions: null,
      receptionistInstructions: null,
      supervisorInstructions: null,
      useManualInstructions: false,
    };
  }
}

/**
 * Get organization-specific agent instructions from database
 * Falls back to system-wide config if org-specific config doesn't exist
 * 
 * @param organizationId - Organization UUID
 * @param channel - Channel type (twilio, web, whatsapp)
 * @returns Agent instructions for the organization and channel
 */
export async function getOrganizationInstructions(
  organizationId: string,
  channel: 'twilio' | 'web' | 'whatsapp'
): Promise<{
  premiumInstructions: string | null;
  receptionistInstructions: string | null;
  supervisorInstructions: string | null;
  whatsappInstructions: string | null;
  useManualInstructions: boolean;
}> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      premiumInstructions: null,
      receptionistInstructions: null,
      supervisorInstructions: null,
      whatsappInstructions: null,
      useManualInstructions: false,
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Query org-specific config first, then fall back to system config
    // Order by organization_id DESC NULLS LAST to prioritize org-specific over system
    const { data, error } = await supabase
      .from('agent_configurations')
      .select('manual_ai_instructions, receptionist_instructions, supervisor_instructions, whatsapp_instructions, use_manual_instructions, organization_id')
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .eq('channel', channel)
      .order('organization_id', { ascending: false, nullsLast: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(`[AgentMode] Error fetching instructions for org ${organizationId}, channel ${channel}:`, error);
      return {
        premiumInstructions: null,
        receptionistInstructions: null,
        supervisorInstructions: null,
        whatsappInstructions: null,
        useManualInstructions: false,
      };
    }

    if (!data) {
      console.log(`[AgentMode] No config found for org ${organizationId}, channel ${channel} - will use hardcoded`);
      return {
        premiumInstructions: null,
        receptionistInstructions: null,
        supervisorInstructions: null,
        whatsappInstructions: null,
        useManualInstructions: false,
      };
    }

    const isOrgSpecific = data.organization_id === organizationId;
    const configSource = isOrgSpecific ? 'organization-specific' : 'system-wide';

    const result = {
      premiumInstructions: data.manual_ai_instructions,
      receptionistInstructions: data.receptionist_instructions,
      supervisorInstructions: data.supervisor_instructions,
      whatsappInstructions: data.whatsapp_instructions,
      useManualInstructions: data.use_manual_instructions || false,
    };
    
    console.log(`[AgentMode] 📋 Instructions loaded (${configSource}):`, {
      organizationId: isOrgSpecific ? organizationId : 'system',
      channel,
      useManualInstructions: result.useManualInstructions,
      premiumLength: result.premiumInstructions?.length || 0,
      receptionistLength: result.receptionistInstructions?.length || 0,
      supervisorLength: result.supervisorInstructions?.length || 0,
      whatsappLength: result.whatsappInstructions?.length || 0,
    });
    
    return result;
  } catch (error) {
    console.warn('[AgentMode] Error fetching organization instructions:', error);
    return {
      premiumInstructions: null,
      receptionistInstructions: null,
      supervisorInstructions: null,
      whatsappInstructions: null,
      useManualInstructions: false,
    };
  }
}

