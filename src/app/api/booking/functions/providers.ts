// @ts-nocheck
/**
 * Provider Management Functions
 * Updated for multi-tenancy - accepts org-scoped database client
 */

import { db as defaultDb } from '@/app/lib/db';

/**
 * Get all active providers with their schedules
 */
export async function GetProviders(parameters: Record<string, any> = {}, db: any = defaultDb, organizationId?: string): Promise<any[]> {
  let query = db
    .from('providers')
    .select('*')
    .eq('is_active', true);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { data: providers, error } = await query
    .order('last_name')
    .order('first_name');
  
  if (error) {
    throw new Error(`Failed to fetch providers: ${error.message}`);
  }
  
  // Transform to OpenDental format
  return (providers || []).map(provider => ({
    ProvNum: provider.id,
    FName: provider.first_name,
    LName: provider.last_name,
    Abbr: `${provider.first_name.charAt(0)}${provider.last_name.charAt(0)}`,
    Specialty: provider.specialty_tags?.join(', ') || 'General',
    IsHidden: !provider.is_active,
    IsSecondary: false,
    ProvColor: null
  }));
}

/**
 * Get single provider by ID
 */
export async function GetProvider(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { ProvNum, id } = parameters;
  const providerId = ProvNum || id;
  
  if (!providerId) {
    throw new Error('ProvNum or id is required');
  }
  
  let query = db
    .from('providers')
    .select('*')
    .eq('id', providerId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { data, error } = await query.single();
  
  if (error || !data) {
    throw new Error(`Provider not found: ${error?.message || 'No data returned'}`);
  }
  
  return {
    ProvNum: data.id,
    FName: data.first_name,
    LName: data.last_name,
    Abbr: `${data.first_name.charAt(0)}${data.last_name.charAt(0)}`,
    Specialty: data.specialty_tags?.join(', ') || 'General',
    IsHidden: !data.is_active,
    IsSecondary: false
  };
}

/**
 * Create new provider
 */
export async function CreateProvider(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { FName, LName, first_name, last_name, specialty_tags, Specialty, is_active, organization_id } = parameters;
  
  // Support both OpenDental format (FName, LName) and admin UI format (first_name, last_name)
  const firstName = FName || first_name;
  const lastName = LName || last_name;
  
  if (!firstName || !lastName) {
    throw new Error('First name and last name are required');
  }
  
  // CRITICAL: Get organization ID from parameter or function argument
  const orgId = organization_id || organizationId;
  if (!orgId) {
    throw new Error('organization_id is required');
  }
  
  // Handle specialty tags - can be array or comma-separated string
  let tagsArray: string[] = [];
  if (specialty_tags) {
    tagsArray = Array.isArray(specialty_tags) ? specialty_tags : specialty_tags.split(',').map((t: string) => t.trim());
  } else if (Specialty) {
    tagsArray = Specialty.split(',').map((t: string) => t.trim());
  }
  
  const { data, error } = await db
    .from('providers')
    .insert({
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      specialty_tags: tagsArray,
      is_active: is_active !== undefined ? is_active : true
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to create provider: ${error?.message || 'No data returned'}`);
  }
  
  return {
    ProvNum: data.id,
    FName: data.first_name,
    LName: data.last_name,
    Abbr: `${data.first_name.charAt(0)}${data.last_name.charAt(0)}`,
    Specialty: data.specialty_tags?.join(', ') || 'General',
    IsHidden: !data.is_active,
    IsSecondary: false
  };
}

/**
 * Update provider
 */
export async function UpdateProvider(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { ProvNum, id, FName, LName, first_name, last_name, specialty_tags, Specialty, is_active } = parameters;
  const providerId = ProvNum || id;
  
  if (!providerId) {
    throw new Error('ProvNum or id is required');
  }
  
  // Validate provider exists
  let existQuery = db
    .from('providers')
    .select('*')
    .eq('id', providerId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    existQuery = existQuery.eq('organization_id', organizationId);
  }
  
  const { data: existing, error: fetchError } = await existQuery.single();
  
  if (fetchError || !existing) {
    throw new Error(`Provider not found: ${fetchError?.message || 'No data returned'}`);
  }
  
  const updateData: any = {};
  
  // Support both OpenDental format (FName, LName) and admin UI format (first_name, last_name)
  if (FName !== undefined || first_name !== undefined) {
    updateData.first_name = FName || first_name;
  }
  if (LName !== undefined || last_name !== undefined) {
    updateData.last_name = LName || last_name;
  }
  
  // Handle specialty tags
  if (specialty_tags !== undefined) {
    updateData.specialty_tags = Array.isArray(specialty_tags) 
      ? specialty_tags 
      : specialty_tags.split(',').map((t: string) => t.trim());
  } else if (Specialty !== undefined) {
    updateData.specialty_tags = Specialty.split(',').map((t: string) => t.trim());
  }
  
  if (is_active !== undefined) {
    updateData.is_active = is_active;
  }
  
  let updateQuery = db
    .from('providers')
    .update(updateData)
    .eq('id', providerId);
  
  // CRITICAL: Only update within organization
  if (organizationId) {
    updateQuery = updateQuery.eq('organization_id', organizationId);
  }
  
  const { data, error } = await updateQuery
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to update provider: ${error?.message || 'No data returned'}`);
  }
  
  return {
    ProvNum: data.id,
    FName: data.first_name,
    LName: data.last_name,
    Abbr: `${data.first_name.charAt(0)}${data.last_name.charAt(0)}`,
    Specialty: data.specialty_tags?.join(', ') || 'General',
    IsHidden: !data.is_active,
    IsSecondary: false
  };
}

/**
 * Delete provider (soft delete by setting is_active to false)
 */
export async function DeleteProvider(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { ProvNum, id } = parameters;
  const providerId = ProvNum || id;
  
  if (!providerId) {
    throw new Error('ProvNum or id is required');
  }
  
  // Validate provider exists
  let existQuery = db
    .from('providers')
    .select('id')
    .eq('id', providerId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    existQuery = existQuery.eq('organization_id', organizationId);
  }
  
  const { data: existing, error: fetchError } = await existQuery.single();
  
  if (fetchError || !existing) {
    throw new Error(`Provider not found: ${fetchError?.message || 'No data returned'}`);
  }
  
  // Soft delete by setting is_active to false
  let deleteQuery = db
    .from('providers')
    .update({ is_active: false })
    .eq('id', providerId);
  
  // CRITICAL: Only delete within organization
  if (organizationId) {
    deleteQuery = deleteQuery.eq('organization_id', organizationId);
  }
  
  const { data, error } = await deleteQuery
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to delete provider: ${error?.message || 'No data returned'}`);
  }
  
  return {
    success: true,
    ProvNum: data.id
  };
}

