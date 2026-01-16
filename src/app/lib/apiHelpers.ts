import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabaseClient';

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
  
  // Get authorization token from header
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  
  if (!token) {
    throw new Error('Unauthorized: No token provided');
  }
  
  // Get user from token
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    throw new Error('Unauthorized: Invalid token');
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
    .eq('user_id', user.id)
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
      id: user.id,
      email: user.email || '',
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
