// @ts-nocheck
/**
 * Operatory Management Functions
 * UPDATED FOR MULTI-TENANCY
 */

import { db as defaultDb } from '@/app/lib/db';

/**
 * Get all active operatories
 */
export async function GetOperatories(parameters: Record<string, any> = {}, db: any = defaultDb, organizationId?: string): Promise<any[]> {
  let query = db
    .from('operatories')
    .select('*')
    .eq('is_active', true);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { data: operatories, error } = await query.order('name');
  
  if (error) {
    throw new Error(`Failed to fetch operatories: ${error.message}`);
  }
  
  // Transform to OpenDental format
  return (operatories || []).map(op => ({
    OperatoryNum: op.id,
    OpName: op.name,
    Abbrev: op.name.substring(0, 10),
    IsHygiene: op.tags?.includes('Hygiene') ? 1 : 0,
    IsHidden: op.is_active ? 0 : 1,
    ProvDentist: null,
    ProvHygienist: null,
    ClinicNum: null
  }));
}

/**
 * Get single operatory by ID
 */
export async function GetOperatory(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { OperatoryNum, OpNum, id } = parameters;
  const operatoryId = OperatoryNum || OpNum || id;
  
  if (!operatoryId) {
    throw new Error('OperatoryNum, OpNum, or id is required');
  }
  
  let query = db
    .from('operatories')
    .select('*')
    .eq('id', operatoryId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { data, error } = await query.single();
  
  if (error || !data) {
    throw new Error(`Operatory not found: ${error?.message || 'No data returned'}`);
  }
  
  return {
    OperatoryNum: data.id,
    OpName: data.name,
    Abbrev: data.name.substring(0, 10),
    IsHygiene: data.tags?.includes('Hygiene') ? 1 : 0,
    IsHidden: data.is_active ? 0 : 1,
    ProvDentist: null,
    ProvHygienist: null,
    ClinicNum: null
  };
}

/**
 * Create new operatory
 */
export async function CreateOperatory(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { OpName, name, tags, IsHygiene, isHygiene, is_active, organization_id } = parameters;
  
  // Support both OpenDental format (OpName) and admin UI format (name)
  const operatoryName = OpName || name;
  
  if (!operatoryName) {
    throw new Error('Operatory name is required');
  }
  
  // CRITICAL: Get organization ID from parameter or function argument
  const orgId = organization_id || organizationId;
  if (!orgId) {
    throw new Error('organization_id is required');
  }
  
  // Handle tags - can be array or determined from IsHygiene flag
  let tagsArray: string[] = [];
  if (tags) {
    tagsArray = Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim());
  } else {
    // If IsHygiene or isHygiene is true, add Hygiene tag
    if (IsHygiene === 1 || IsHygiene === true || isHygiene === true) {
      tagsArray = ['Hygiene'];
    }
  }
  
  const { data, error } = await db
    .from('operatories')
    .insert({
      organization_id: orgId,
      name: operatoryName,
      tags: tagsArray,
      is_active: is_active !== undefined ? is_active : true
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to create operatory: ${error?.message || 'No data returned'}`);
  }
  
  return {
    OperatoryNum: data.id,
    OpName: data.name,
    Abbrev: data.name.substring(0, 10),
    IsHygiene: data.tags?.includes('Hygiene') ? 1 : 0,
    IsHidden: data.is_active ? 0 : 1,
    ProvDentist: null,
    ProvHygienist: null,
    ClinicNum: null
  };
}

/**
 * Update operatory
 */
export async function UpdateOperatory(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { OperatoryNum, OpNum, id, OpName, name, tags, IsHygiene, isHygiene, is_active } = parameters;
  const operatoryId = OperatoryNum || OpNum || id;
  
  if (!operatoryId) {
    throw new Error('OperatoryNum, OpNum, or id is required');
  }
  
  // Validate operatory exists
  let existQuery = db
    .from('operatories')
    .select('*')
    .eq('id', operatoryId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    existQuery = existQuery.eq('organization_id', organizationId);
  }
  
  const { data: existing, error: fetchError } = await existQuery.single();
  
  if (fetchError || !existing) {
    throw new Error(`Operatory not found: ${fetchError?.message || 'No data returned'}`);
  }
  
  const updateData: any = {};
  
  // Support both OpenDental format (OpName) and admin UI format (name)
  if (OpName !== undefined || name !== undefined) {
    updateData.name = OpName || name;
  }
  
  // Handle tags
  if (tags !== undefined) {
    updateData.tags = Array.isArray(tags) 
      ? tags 
      : tags.split(',').map((t: string) => t.trim());
  } else if (IsHygiene !== undefined || isHygiene !== undefined) {
    // Update tags based on Hygiene flag
    const isHygieneFlag = IsHygiene === 1 || IsHygiene === true || isHygiene === true;
    const currentTags = existing.tags || [];
    if (isHygieneFlag) {
      // Add Hygiene tag if not present
      if (!currentTags.includes('Hygiene')) {
        updateData.tags = [...currentTags, 'Hygiene'];
      }
    } else {
      // Remove Hygiene tag if present
      updateData.tags = currentTags.filter((tag: string) => tag !== 'Hygiene');
    }
  }
  
  if (is_active !== undefined) {
    updateData.is_active = is_active;
  }
  
  let updateQuery = db
    .from('operatories')
    .update(updateData)
    .eq('id', operatoryId);
  
  // CRITICAL: Only update within organization
  if (organizationId) {
    updateQuery = updateQuery.eq('organization_id', organizationId);
  }
  
  const { data, error } = await updateQuery
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to update operatory: ${error?.message || 'No data returned'}`);
  }
  
  return {
    OperatoryNum: data.id,
    OpName: data.name,
    Abbrev: data.name.substring(0, 10),
    IsHygiene: data.tags?.includes('Hygiene') ? 1 : 0,
    IsHidden: data.is_active ? 0 : 1,
    ProvDentist: null,
    ProvHygienist: null,
    ClinicNum: null
  };
}

/**
 * Delete operatory (soft delete by setting is_active to false)
 */
export async function DeleteOperatory(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { OperatoryNum, OpNum, id } = parameters;
  const operatoryId = OperatoryNum || OpNum || id;
  
  if (!operatoryId) {
    throw new Error('OperatoryNum, OpNum, or id is required');
  }
  
  // Validate operatory exists
  let existQuery = db
    .from('operatories')
    .select('id')
    .eq('id', operatoryId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    existQuery = existQuery.eq('organization_id', organizationId);
  }
  
  const { data: existing, error: fetchError } = await existQuery.single();
  
  if (fetchError || !existing) {
    throw new Error(`Operatory not found: ${fetchError?.message || 'No data returned'}`);
  }
  
  // Soft delete by setting is_active to false
  let deleteQuery = db
    .from('operatories')
    .update({ is_active: false })
    .eq('id', operatoryId);
  
  // CRITICAL: Only delete within organization
  if (organizationId) {
    deleteQuery = deleteQuery.eq('organization_id', organizationId);
  }
  
  const { data, error } = await deleteQuery
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to delete operatory: ${error?.message || 'No data returned'}`);
  }
  
  return {
    success: true,
    OperatoryNum: data.id
  };
}
