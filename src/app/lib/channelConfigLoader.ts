/**
 * Channel Configuration Loader
 * 
 * Loads channel-specific configuration from the database.
 * Used by handlers (Twilio, Retell, WhatsApp, Web) to determine:
 * - Which AI backend to use
 * - Which data integrations are enabled
 * - Channel-specific settings
 */

import { getSupabaseAdmin } from './supabaseClient';

export type ChannelType = 'twilio' | 'retell' | 'whatsapp' | 'web';
export type AIBackend = 'openai_realtime' | 'openai_gpt4o' | 'openai_gpt4o_mini' | 'anthropic_claude';
export type DataIntegration = 'opendental' | 'google_calendar';

export interface ChannelConfig {
  id: string;
  channel: ChannelType;
  enabled: boolean;
  ai_backend: AIBackend;
  settings: Record<string, string>;
  data_integrations: DataIntegration[];
  one_agent_instructions?: string;
  receptionist_instructions?: string;
  supervisor_instructions?: string;
  // Deprecated - kept for backward compatibility
  instructions?: string;
}

// Default configurations when database config doesn't exist
const DEFAULT_CONFIGS: Record<ChannelType, Omit<ChannelConfig, 'id'>> = {
  twilio: {
    channel: 'twilio',
    enabled: true,
    ai_backend: 'openai_realtime',
    settings: {},
    data_integrations: [],
  },
  retell: {
    channel: 'retell',
    enabled: false,
    ai_backend: 'openai_gpt4o',
    settings: {},
    data_integrations: [],
  },
  whatsapp: {
    channel: 'whatsapp',
    enabled: false,
    ai_backend: 'openai_gpt4o',
    settings: {},
    data_integrations: [],
  },
  web: {
    channel: 'web',
    enabled: true,
    ai_backend: 'openai_realtime',
    settings: {},
    data_integrations: [],
  },
};

// Cache for channel configs (per org)
const configCache = new Map<string, { config: ChannelConfig; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get channel configuration for an organization
 */
export async function getChannelConfig(
  organizationId: string,
  channel: ChannelType
): Promise<ChannelConfig> {
  const cacheKey = `${organizationId}-${channel}`;
  const cached = configCache.get(cacheKey);
  
  // Return cached if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.config;
  }

  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('channel_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('channel', channel)
      .single();

    if (error || !data) {
      console.log(`[ChannelConfig] No config found for ${channel}, using defaults`);
      const defaultConfig = { 
        id: 'default',
        ...DEFAULT_CONFIGS[channel] 
      };
      return defaultConfig;
    }

    const config: ChannelConfig = {
      id: data.id,
      channel: data.channel,
      enabled: data.enabled ?? DEFAULT_CONFIGS[channel].enabled,
      ai_backend: data.ai_backend ?? DEFAULT_CONFIGS[channel].ai_backend,
      settings: data.settings ?? {},
      data_integrations: data.data_integrations ?? [],
      one_agent_instructions: data.one_agent_instructions,
      receptionist_instructions: data.receptionist_instructions,
      supervisor_instructions: data.supervisor_instructions,
      instructions: data.instructions, // Deprecated
    };

    // Cache the result
    configCache.set(cacheKey, { config, timestamp: Date.now() });
    
    return config;
  } catch (error) {
    console.error(`[ChannelConfig] Error loading config for ${channel}:`, error);
    return { 
      id: 'default',
      ...DEFAULT_CONFIGS[channel] 
    };
  }
}

/**
 * Get all enabled channels for an organization
 */
export async function getEnabledChannels(organizationId: string): Promise<ChannelConfig[]> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('channel_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('enabled', true);

    if (error) {
      console.error('[ChannelConfig] Error loading enabled channels:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      channel: d.channel,
      enabled: d.enabled,
      ai_backend: d.ai_backend || DEFAULT_CONFIGS[d.channel as ChannelType]?.ai_backend,
      settings: d.settings || {},
      data_integrations: d.data_integrations || [],
      one_agent_instructions: d.one_agent_instructions,
      receptionist_instructions: d.receptionist_instructions,
      supervisor_instructions: d.supervisor_instructions,
      instructions: d.instructions, // Deprecated
    }));
  } catch (error) {
    console.error('[ChannelConfig] Error loading enabled channels:', error);
    return [];
  }
}

/**
 * Check if a data integration is enabled for a channel
 */
export async function isIntegrationEnabled(
  organizationId: string,
  channel: ChannelType,
  integration: DataIntegration
): Promise<boolean> {
  const config = await getChannelConfig(organizationId, channel);
  return config.data_integrations.includes(integration);
}

/**
 * Get the AI backend for a channel
 */
export async function getAIBackend(
  organizationId: string,
  channel: ChannelType
): Promise<AIBackend> {
  const config = await getChannelConfig(organizationId, channel);
  return config.ai_backend;
}

/**
 * Get model name from AI backend type
 */
export function getModelFromBackend(backend: AIBackend): string {
  switch (backend) {
    case 'openai_realtime':
      return 'gpt-4o-realtime-preview-2024-12-17';
    case 'openai_gpt4o':
      return 'gpt-4o';
    case 'openai_gpt4o_mini':
      return 'gpt-4o-mini';
    case 'anthropic_claude':
      return 'claude-3-5-sonnet-20241022';
    default:
      return 'gpt-4o';
  }
}

/**
 * Check if channel uses realtime (voice) API
 */
export function isRealtimeBackend(backend: AIBackend): boolean {
  return backend === 'openai_realtime';
}

/**
 * Clear cache for an organization (call after config updates)
 */
export function clearChannelConfigCache(organizationId?: string): void {
  if (organizationId) {
    // Clear specific org's cache
    for (const key of configCache.keys()) {
      if (key.startsWith(organizationId)) {
        configCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    configCache.clear();
  }
}
