// @ts-nocheck
/**
 * Provider Management Functions
 */

import { db } from '@/app/lib/db';

/**
 * Get all active providers with their schedules
 */
export async function GetProviders(parameters: Record<string, any> = {}): Promise<any[]> {
  const { data: providers, error } = await db
    .from('providers')
    .select('*')
    .eq('is_active', true)
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
export async function GetProvider(parameters: Record<string, any>): Promise<any> {
  const { ProvNum, id } = parameters;
  const providerId = ProvNum || id;
  
  if (!providerId) {
    throw new Error('ProvNum or id is required');
  }
  
  const { data, error } = await db
    .from('providers')
    .select('*')
    .eq('id', providerId)
    .single();
  
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
export async function CreateProvider(parameters: Record<string, any>): Promise<any> {
  const { FName, LName, first_name, last_name, specialty_tags, Specialty, is_active } = parameters;
  
  // Support both OpenDental format (FName, LName) and admin UI format (first_name, last_name)
  const firstName = FName || first_name;
  const lastName = LName || last_name;
  
  if (!firstName || !lastName) {
    throw new Error('First name and last name are required');
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
export async function UpdateProvider(parameters: Record<string, any>): Promise<any> {
  const { ProvNum, id, FName, LName, first_name, last_name, specialty_tags, Specialty, is_active } = parameters;
  const providerId = ProvNum || id;
  
  if (!providerId) {
    throw new Error('ProvNum or id is required');
  }
  
  // Validate provider exists
  const { data: existing, error: fetchError } = await db
    .from('providers')
    .select('*')
    .eq('id', providerId)
    .single();
  
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
  
  const { data, error } = await db
    .from('providers')
    .update(updateData)
    .eq('id', providerId)
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
export async function DeleteProvider(parameters: Record<string, any>): Promise<any> {
  const { ProvNum, id } = parameters;
  const providerId = ProvNum || id;
  
  if (!providerId) {
    throw new Error('ProvNum or id is required');
  }
  
  // Validate provider exists
  const { data: existing, error: fetchError } = await db
    .from('providers')
    .select('id')
    .eq('id', providerId)
    .single();
  
  if (fetchError || !existing) {
    throw new Error(`Provider not found: ${fetchError?.message || 'No data returned'}`);
  }
  
  // Soft delete by setting is_active to false
  const { data, error } = await db
    .from('providers')
    .update({ is_active: false })
    .eq('id', providerId)
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

