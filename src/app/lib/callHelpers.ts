/**
 * Call Helper Functions
 * 
 * Utilities for working with calls across different channels (Twilio, WhatsApp)
 * Handles organization lookup and call metadata management
 */

import { getSupabaseAdmin } from './supabaseClient';

/**
 * Get organization ID from a Twilio call SID
 * Looks up the call in the conversations table
 * Falls back to the first available organization if not found
 * 
 * @param callSid - Twilio call SID (e.g., "CA...")
 * @returns Organization UUID
 */
export async function getOrganizationIdFromCall(callSid: string): Promise<string> {
  if (!callSid) {
    console.warn('[CallHelpers] No callSid provided, using default org');
    return getDefaultOrganizationId();
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Look up call in conversations table by external_id
    const { data, error } = await supabase
      .from('conversations')
      .select('organization_id')
      .eq('external_id', callSid)
      .maybeSingle();
    
    if (error) {
      console.warn('[CallHelpers] Error looking up call:', error);
      return getDefaultOrganizationId();
    }
    
    if (data?.organization_id) {
      console.log(`[CallHelpers] Found org ${data.organization_id} for call ${callSid}`);
      return data.organization_id;
    }
    
    // Call not found in conversations yet (might be initial setup)
    console.log(`[CallHelpers] Call ${callSid} not in conversations, using default org`);
    return getDefaultOrganizationId();
  } catch (error) {
    console.error('[CallHelpers] Error getting org from call:', error);
    return getDefaultOrganizationId();
  }
}

/**
 * Get organization ID from a WhatsApp instance
 * Looks up the instance in whatsapp_instances table
 * 
 * @param instanceId - WhatsApp instance UUID
 * @returns Organization UUID
 */
export async function getOrganizationIdFromWhatsAppInstance(instanceId: string): Promise<string> {
  if (!instanceId) {
    console.warn('[CallHelpers] No instanceId provided, using default org');
    return getDefaultOrganizationId();
  }

  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .select('organization_id')
      .eq('id', instanceId)
      .single();
    
    if (error) {
      console.warn('[CallHelpers] Error looking up WhatsApp instance:', error);
      return getDefaultOrganizationId();
    }
    
    if (data?.organization_id) {
      console.log(`[CallHelpers] Found org ${data.organization_id} for WhatsApp instance ${instanceId}`);
      return data.organization_id;
    }
    
    console.warn('[CallHelpers] WhatsApp instance has no org, using default');
    return getDefaultOrganizationId();
  } catch (error) {
    console.error('[CallHelpers] Error getting org from WhatsApp instance:', error);
    return getDefaultOrganizationId();
  }
}

/**
 * Get the default (first) organization ID
 * Used as fallback when specific org cannot be determined
 * 
 * @returns Organization UUID
 */
export async function getDefaultOrganizationId(): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    if (error || !data?.id) {
      console.error('[CallHelpers] No organizations found in database!');
      return '';
    }
    
    return data.id;
  } catch (error) {
    console.error('[CallHelpers] Error getting default org:', error);
    return '';
  }
}

/**
 * Cache for default organization ID to avoid repeated queries
 */
let cachedDefaultOrgId: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get default organization ID with caching
 * More efficient for frequently called functions
 */
export async function getCachedDefaultOrganizationId(): Promise<string> {
  const now = Date.now();

  // Return cached value if still fresh
  if (cachedDefaultOrgId && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedDefaultOrgId;
  }

  // Fetch fresh value
  cachedDefaultOrgId = await getDefaultOrganizationId();
  cacheTimestamp = now;
  
  return cachedDefaultOrgId;
}

/**
 * Get organization ID from a phone number
 * Looks up the phone number in phone_numbers table
 * Falls back to default organization if not found
 * 
 * @param phoneNumber - Phone number in any format (will be normalized)
 * @returns Organization UUID
 */
export async function getOrganizationIdFromPhone(phoneNumber: string): Promise<string> {
  if (!phoneNumber) {
    console.warn('[CallHelpers] No phone number provided, using default org');
    return getCachedDefaultOrganizationId();
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Normalize phone number to E.164 format (+1234567890)
    const normalized = normalizePhoneNumber(phoneNumber);
    
    // Look up phone number in phone_numbers table
    const { data, error } = await supabase
      .from('phone_numbers')
      .select('organization_id')
      .eq('phone_number', normalized)
      .eq('is_active', true)
      .maybeSingle();
    
    if (error) {
      console.warn('[CallHelpers] Error looking up phone number:', error);
      return getCachedDefaultOrganizationId();
    }
    
    if (data?.organization_id) {
      console.log(`[CallHelpers] ✓ Found org ${data.organization_id} for phone ${phoneNumber}`);
      return data.organization_id;
    }
    
    // Phone number not mapped, use default org
    console.log(`[CallHelpers] ⚠️ Phone ${phoneNumber} not mapped, using default org`);
    return getCachedDefaultOrganizationId();
  } catch (error) {
    console.error('[CallHelpers] Error getting org from phone:', error);
    return getCachedDefaultOrganizationId();
  }
}

/**
 * Normalize phone number to E.164 format
 * Removes spaces, dashes, parentheses, and ensures + prefix
 * 
 * @param phone - Phone number in any format
 * @returns Normalized phone number (+1234567890)
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Add + if not present
  if (!normalized.startsWith('+')) {
    // Assume US number if no country code
    if (normalized.length === 10) {
      normalized = '+1' + normalized;
    } else if (normalized.length === 11 && normalized.startsWith('1')) {
      normalized = '+' + normalized;
    } else {
      normalized = '+' + normalized;
    }
  }
  
  return normalized;
}

/**
 * Clear organization cache
 * Call this when organizations are added/removed
 */
export function clearOrganizationCache(): void {
  cachedDefaultOrgId = null;
  cacheTimestamp = 0;
}
