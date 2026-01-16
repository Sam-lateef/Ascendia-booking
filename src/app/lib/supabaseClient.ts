/**
 * Unified Supabase Client Helper
 * Checks for env vars with or without NEXT_PUBLIC_ prefix
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Get Supabase URL from environment
 * Checks SUPABASE_URL first (server-side), then NEXT_PUBLIC_SUPABASE_URL (client-side)
 */
export function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Get Supabase Service Key from environment
 */
export function getSupabaseServiceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_KEY;
}

/**
 * Get Supabase Anon Key from environment
 * Checks SUPABASE_ANON_KEY first (server-side), then NEXT_PUBLIC_SUPABASE_ANON_KEY (client-side)
 */
export function getSupabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * Create Supabase client with service role key (for admin/server operations)
 * Throws error if credentials are missing
 */
export function getSupabaseAdmin() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  
  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set either:\n' +
      '  - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_KEY\n' +
      'in your .env file'
    );
  }
  
  return createClient(url, key);
}

/**
 * Create Supabase client with anon key (for client operations)
 * Throws error if credentials are missing
 */
export function getSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  
  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set either:\n' +
      '  - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and\n' +
      '  - NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)\n' +
      'in your .env file'
    );
  }
  
  return createClient(url, key);
}

/**
 * Create Supabase client with organization context for RLS
 * Sets the app.current_org_id config parameter for Row-Level Security
 */
export async function getSupabaseWithOrg(organizationId: string) {
  const supabase = getSupabaseAdmin();
  
  // Set organization context for RLS
  // This makes RLS policies filter data automatically
  await supabase.rpc('set_config', {
    key: 'app.current_org_id',
    value: organizationId,
  });
  
  return supabase;
}


























