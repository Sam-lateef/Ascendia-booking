/**
 * Credential Loader
 * 
 * Centralized service for loading API credentials from database
 * Falls back to environment variables if database credentials not available
 */

import { getSupabaseAdmin } from './supabaseClient';

export type CredentialType = 'openai' | 'anthropic' | 'twilio' | 'evolution_api' | 'opendental' | 'retell' | 'google_calendar' | 'other';

export interface Credentials {
  [key: string]: string;
}

// Cache for credentials (1 minute TTL)
interface CachedCredentials {
  data: Credentials;
  timestamp: number;
  organizationId: string;
  credentialType: CredentialType;
}

const credentialCache = new Map<string, CachedCredentials>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Get credentials for a specific organization and type
 * Falls back to environment variables if not found in database
 * 
 * @param organizationId - Organization UUID
 * @param credentialType - Type of credential (openai, twilio, etc.)
 * @returns Credentials object with all fields for that type
 */
export async function getCredentials(
  organizationId: string,
  credentialType: CredentialType
): Promise<Credentials> {
  const cacheKey = `${organizationId}:${credentialType}`;
  const cached = credentialCache.get(cacheKey);
  
  // Return cached value if still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const supabase = getSupabaseAdmin();

    // Try org credential first
    let { data, error } = await supabase
      .from('api_credentials')
      .select('credentials')
      .eq('organization_id', organizationId)
      .eq('credential_type', credentialType)
      .eq('is_active', true)
      .eq('is_default', true)
      .maybeSingle();

    // Fall back to system credential (organization_id IS NULL)
    if ((error || !data?.credentials) && !['google_calendar'].includes(credentialType)) {
      const { data: systemData } = await supabase
        .from('api_credentials')
        .select('credentials')
        .is('organization_id', null)
        .eq('credential_type', credentialType)
        .eq('is_active', true)
        .maybeSingle();
      if (systemData?.credentials) {
        data = systemData;
        error = null;
      }
    }

    if (!error && data?.credentials) {
      console.log(`[Credentials] ✅ Loaded ${credentialType} from database for org ${organizationId}`);
      
      // Cache the result
      credentialCache.set(cacheKey, {
        data: data.credentials as Credentials,
        timestamp: Date.now(),
        organizationId,
        credentialType,
      });
      
      return data.credentials as Credentials;
    }
  } catch (error) {
    console.warn(`[Credentials] Database lookup failed for ${credentialType}, using env vars:`, error);
  }

  // Fall back to environment variables
  console.log(`[Credentials] ⚠️ Using environment variables for ${credentialType} (org: ${organizationId})`);
  return getEnvironmentCredentials(credentialType);
}

/**
 * Get credentials from environment variables (fallback)
 */
function getEnvironmentCredentials(credentialType: CredentialType): Credentials {
  switch (credentialType) {
    case 'openai':
      return {
        api_key: process.env.OPENAI_API_KEY || '',
      };

    case 'anthropic':
      return {
        api_key: process.env.ANTHROPIC_API_KEY || '',
      };

    case 'twilio':
      return {
        account_sid: process.env.TWILIO_ACCOUNT_SID || '',
        auth_token: process.env.TWILIO_AUTH_TOKEN || '',
        phone_number: process.env.TWILIO_PHONE_NUMBER || '',
        websocket_url: process.env.TWILIO_WEBSOCKET_URL || '',
      };

    case 'evolution_api':
      return {
        api_url: process.env.EVOLUTION_API_URL || process.env.NEXT_PUBLIC_EVOLUTION_API_URL || '',
        api_key: process.env.EVOLUTION_API_KEY || '',
      };

    case 'opendental':
      return {
        api_url: process.env.OPENDENTAL_API_URL || '',
        api_key: process.env.OPENDENTAL_API_KEY || '',
      };

    case 'retell':
      return {
        api_key: process.env.RETELL_API_KEY || '',
      };

    case 'google_calendar':
      return {
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
        calendar_id: process.env.GOOGLE_CALENDAR_ID || 'primary',
      };

    default:
      return {};
  }
}

/**
 * Clear credential cache for a specific organization
 * Call this when credentials are updated
 */
export function clearCredentialCache(organizationId?: string): void {
  if (organizationId) {
    // Clear all credentials for this org
    for (const key of credentialCache.keys()) {
      if (key.startsWith(`${organizationId}:`)) {
        credentialCache.delete(key);
      }
    }
  } else {
    // Clear entire cache
    credentialCache.clear();
  }
  
  console.log('[Credentials] Cache cleared', organizationId ? `for org ${organizationId}` : '(all)');
}

/**
 * Get OpenAI API key (convenience function)
 */
export async function getOpenAIKey(organizationId: string): Promise<string> {
  const credentials = await getCredentials(organizationId, 'openai');
  return credentials.api_key || process.env.OPENAI_API_KEY || '';
}

/**
 * Get Anthropic API key (convenience function)
 */
export async function getAnthropicKey(organizationId: string): Promise<string> {
  const credentials = await getCredentials(organizationId, 'anthropic');
  return credentials.api_key || process.env.ANTHROPIC_API_KEY || '';
}

/**
 * Get Twilio credentials (convenience function)
 */
export async function getTwilioCredentials(organizationId: string): Promise<{
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  websocketUrl: string;
}> {
  const credentials = await getCredentials(organizationId, 'twilio');
  return {
    accountSid: credentials.account_sid || '',
    authToken: credentials.auth_token || '',
    phoneNumber: credentials.phone_number || '',
    websocketUrl: credentials.websocket_url || '',
  };
}

/**
 * Get Evolution API credentials (convenience function)
 */
export async function getEvolutionAPICredentials(organizationId: string): Promise<{
  apiUrl: string;
  apiKey: string;
}> {
  const credentials = await getCredentials(organizationId, 'evolution_api');
  return {
    apiUrl: credentials.api_url || '',
    apiKey: credentials.api_key || '',
  };
}

/**
 * Get OpenDental credentials (convenience function)
 */
export async function getOpenDentalCredentials(organizationId: string): Promise<{
  apiUrl: string;
  apiKey: string;
}> {
  const credentials = await getCredentials(organizationId, 'opendental');
  return {
    apiUrl: credentials.api_url || '',
    apiKey: credentials.api_key || '',
  };
}

/**
 * Get Google Calendar credentials (convenience function)
 * Merges system-level (client_id, client_secret) with org-level (refresh_token, calendar_id)
 */
export async function getGoogleCalendarCredentials(organizationId: string): Promise<{
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
}> {
  const supabase = getSupabaseAdmin();

  // System-level: client_id, client_secret (shared OAuth app)
  const { data: systemCred } = await supabase
    .from('api_credentials')
    .select('credentials')
    .is('organization_id', null)
    .eq('credential_type', 'google_calendar')
    .eq('is_active', true)
    .maybeSingle();

  // Org-level: refresh_token, calendar_id (per-org OAuth connection)
  const { data: orgCred } = await supabase
    .from('api_credentials')
    .select('credentials')
    .eq('organization_id', organizationId)
    .eq('credential_type', 'google_calendar')
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle();

  const system = (systemCred?.credentials as Record<string, string>) || {};
  const org = (orgCred?.credentials as Record<string, string>) || {};

  return {
    clientId: system.client_id || org.client_id || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: system.client_secret || org.client_secret || process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: org.refresh_token || process.env.GOOGLE_REFRESH_TOKEN || '',
    calendarId: org.calendar_id || process.env.GOOGLE_CALENDAR_ID || 'primary',
  };
}

/**
 * Check if Google Calendar is configured and has valid credentials for an organization
 * Used by GetAvailableSlots and SyncManager to determine if Google integration is active
 */
export async function isGoogleCalendarConfigured(organizationId: string): Promise<boolean> {
  try {
    const credentials = await getGoogleCalendarCredentials(organizationId);
    return !!(credentials.clientId && credentials.clientSecret && credentials.refreshToken);
  } catch {
    return false;
  }
}

/**
 * Get Retell credentials (convenience function)
 */
export async function getRetellCredentials(organizationId: string): Promise<{
  apiKey: string;
}> {
  const credentials = await getCredentials(organizationId, 'retell');
  return {
    apiKey: credentials.api_key || '',
  };
}
