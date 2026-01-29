import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, getSupabaseUrl, getSupabaseAnonKey } from './supabaseClient';

/**
 * Interface for authenticated request context
 */
export interface RequestContext {
  user: {
    id: string;
    email: string;
  };
  organizationId: string;
  role: string;
  permissions: Record<string, Record<string, boolean>>;
}

/**
 * Get current user and organization from request
 * Validates that user belongs to organization
 * 
 * @throws Error if unauthorized or no organization context
 */
export async function getCurrentOrganization(request: NextRequest): Promise<RequestContext> {
  const supabase = getSupabaseAdmin();
  
  let accessToken: string | null = null;
  
  // Try Authorization header first (for API calls from Twilio/WhatsApp)
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.replace('Bearer ', '');
  
  if (bearerToken) {
    accessToken = bearerToken;
  } else {
    // Try to get access token from Supabase auth cookies (for browser-based requests)
    const cookies = request.cookies;
    const allCookies = cookies.getAll();
    
    // Find the Supabase auth token cookie
    const authCookie = allCookies.find(cookie => 
      cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
    );
    
    if (authCookie?.value) {
      try {
        // Supabase cookies can be in different formats:
        // 1. JSON array: ["access_token", "refresh_token"]
        // 2. JSON object: { "access_token": "...", "refresh_token": "..." }
        // 3. Base64-encoded JSON
        let sessionData;
        try {
          // Try parsing as plain JSON first (most common)
          sessionData = JSON.parse(authCookie.value);
        } catch (jsonErr) {
          // If that fails, try base64 decoding first
          const decoded = Buffer.from(authCookie.value, 'base64').toString('utf-8');
          sessionData = JSON.parse(decoded);
        }
        
        // Extract access token based on format
        if (Array.isArray(sessionData)) {
          // Format: ["access_token", "refresh_token"]
          accessToken = sessionData[0];
        } else if (sessionData?.access_token) {
          // Format: { "access_token": "...", "refresh_token": "..." }
          accessToken = sessionData.access_token;
        }
      } catch (e) {
        console.error('[API] Failed to parse auth cookie:', e);
      }
    }
  }
  
  if (!accessToken) {
    throw new Error('Unauthorized: No token provided');
  }
  
  // Get auth user from access token
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  
  if (userError || !user) {
    throw new Error('Unauthorized: Invalid token');
  }
  
  const authUser = user;
  
  // Get user record from our users table
  const { data: userRecord, error: userRecordError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .single();
  
  if (userRecordError || !userRecord) {
    throw new Error('User record not found');
  }
  
  // Get organization ID from cookie or header
  const cookies = request.cookies;
  const orgId = cookies.get('currentOrgId')?.value 
                || request.headers.get('X-Organization-Id');
  
  if (!orgId) {
    throw new Error('No organization context');
  }
  
  // Verify user belongs to organization and get their role/permissions
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select(`
      role,
      permissions,
      organization:organizations (
        id,
        name,
        slug,
        status
      )
    `)
    .eq('user_id', userRecord.id)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .single();
  
  if (membershipError || !membership) {
    throw new Error('User not member of organization');
  }
  
  // Check if organization is active
  const org = membership.organization as any;
  if (org.status !== 'active') {
    throw new Error('Organization is not active');
  }
  
  return {
    user: {
      id: authUser.id,
      email: authUser.email || '',
    },
    organizationId: orgId,
    role: membership.role,
    permissions: membership.permissions || {},
  };
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  context: RequestContext,
  resource: string,
  action: 'read' | 'write' | 'delete'
): boolean {
  // Owners and admins have all permissions
  if (context.role === 'owner' || context.role === 'admin') {
    return true;
  }
  
  // Check specific permission
  return context.permissions[resource]?.[action] === true;
}

/**
 * Require specific permission or throw error
 */
export function requirePermission(
  context: RequestContext,
  resource: string,
  action: 'read' | 'write' | 'delete'
): void {
  if (!hasPermission(context, resource, action)) {
    throw new Error(`Permission denied: ${action} ${resource}`);
  }
}
