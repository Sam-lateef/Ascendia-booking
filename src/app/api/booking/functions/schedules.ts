// @ts-nocheck
/**
 * Provider Schedule Management Functions
 * 
 * Manages provider availability schedules for the booking system.
 * Each schedule defines when a provider is available on a SPECIFIC DATE (not recurring).
 * 
 * Constraints:
 * - No two providers can be in the same operatory at overlapping times
 * - No provider can be in two operatories at overlapping times
 */

import { db as defaultDb } from '@/app/lib/db';

/**
 * Check for schedule conflicts
 * Returns conflict details if found, null otherwise
 */
async function checkScheduleConflicts(
  scheduleDate: string,
  startTime: string,
  endTime: string,
  providerId: number,
  operatoryId: number,
  db: any,
  excludeScheduleId?: number,
  organizationId?: string
): Promise<{ type: string; message: string; conflictWith: any } | null> {
  
  // Get all schedules for the same date
  let query = (db as any)
    .from('provider_schedules')
    .select('*, providers(*)')
    .eq('schedule_date', scheduleDate);
  
  // CRITICAL: Filter by organization to prevent false conflicts from other orgs
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  if (excludeScheduleId) {
    query = query.neq('id', excludeScheduleId);
  }
  
  const { data: existingSchedules, error } = await query;
  
  if (error) {
    console.error('Error checking conflicts:', error);
    return null;
  }
  
  if (!existingSchedules || existingSchedules.length === 0) {
    return null;
  }
  
  // Helper to check time overlap
  const timesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
    // Convert to minutes for easier comparison
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);
    
    // Overlap if one starts before the other ends
    return s1 < e2 && s2 < e1;
  };
  
  for (const existing of existingSchedules) {
    const overlaps = timesOverlap(startTime, endTime, existing.start_time, existing.end_time);
    
    if (!overlaps) continue;
    
    // Check 1: Same operatory, different provider
    if (existing.operatory_id === operatoryId && existing.provider_id !== providerId) {
      const providerName = existing.providers 
        ? `Dr. ${existing.providers.first_name} ${existing.providers.last_name}`
        : `Provider ${existing.provider_id}`;
      return {
        type: 'operatory_conflict',
        message: `Operatory is already booked by ${providerName} from ${existing.start_time} to ${existing.end_time}`,
        conflictWith: existing
      };
    }
    
    // Check 2: Same provider, different operatory (provider can't be in two rooms)
    if (existing.provider_id === providerId && existing.operatory_id !== operatoryId) {
      return {
        type: 'provider_conflict',
        message: `Provider is already scheduled in another operatory from ${existing.start_time} to ${existing.end_time}`,
        conflictWith: existing
      };
    }
    
    // Check 3: Same provider, same operatory (duplicate)
    if (existing.provider_id === providerId && existing.operatory_id === operatoryId) {
      return {
        type: 'duplicate',
        message: `Schedule already exists for this provider/operatory from ${existing.start_time} to ${existing.end_time}`,
        conflictWith: existing
      };
    }
  }
  
  return null;
}

/**
 * Get all schedules with optional filters
 */
export async function GetSchedules(parameters: Record<string, any> = {}, db: any = defaultDb, organizationId?: string): Promise<any[]> {
  let query = (db as any).from('provider_schedules').select('*, providers(*), operatories(*)');
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  if (parameters.ProvNum || parameters.provider_id) {
    const providerId = parameters.ProvNum || parameters.provider_id;
    query = query.eq('provider_id', providerId);
  }
  
  if (parameters.OpNum || parameters.operatory_id) {
    const operatoryId = parameters.OpNum || parameters.operatory_id;
    query = query.eq('operatory_id', operatoryId);
  }
  
  if (parameters.schedule_date || parameters.ScheduleDate) {
    const scheduleDate = parameters.schedule_date || parameters.ScheduleDate;
    query = query.eq('schedule_date', scheduleDate);
  }
  
  if (parameters.DateStart) {
    query = query.gte('schedule_date', parameters.DateStart);
  }
  
  if (parameters.DateEnd) {
    query = query.lte('schedule_date', parameters.DateEnd);
  }
  
  if (parameters.is_active !== undefined) {
    query = query.eq('is_active', parameters.is_active);
  }
  
  const { data, error } = await query.order('schedule_date').order('start_time');
  
  if (error) {
    throw new Error(`Failed to fetch schedules: ${error.message}`);
  }
  
  return (data || []).map((schedule: any) => ({
    ScheduleNum: schedule.id,
    ProvNum: schedule.provider_id,
    ProviderName: schedule.providers 
      ? `Dr. ${schedule.providers.first_name} ${schedule.providers.last_name}`
      : `Provider ${schedule.provider_id}`,
    OpNum: schedule.operatory_id,
    OperatoryName: schedule.operatories?.name || `Operatory ${schedule.operatory_id}`,
    ScheduleDate: schedule.schedule_date,
    StartTime: schedule.start_time,
    EndTime: schedule.end_time,
    IsActive: schedule.is_active
  }));
}

/**
 * Get a single schedule by ID
 */
export async function GetSchedule(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { ScheduleNum, id } = parameters;
  const scheduleId = ScheduleNum || id;
  
  if (!scheduleId) {
    throw new Error('ScheduleNum or id is required');
  }
  
  let query = (db as any)
    .from('provider_schedules')
    .select('*, providers(*), operatories(*)')
    .eq('id', scheduleId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { data, error } = await query.single();
  
  if (error) {
    throw new Error(`Failed to fetch schedule: ${error.message}`);
  }
  
  if (!data) {
    throw new Error(`Schedule with ID ${scheduleId} not found`);
  }
  
  return {
    ScheduleNum: data.id,
    ProvNum: data.provider_id,
    ProviderName: data.providers 
      ? `Dr. ${data.providers.first_name} ${data.providers.last_name}`
      : `Provider ${data.provider_id}`,
    OpNum: data.operatory_id,
    OperatoryName: data.operatories?.name || `Operatory ${data.operatory_id}`,
    ScheduleDate: data.schedule_date,
    StartTime: data.start_time,
    EndTime: data.end_time,
    IsActive: data.is_active
  };
}

/**
 * Create a new schedule
 */
export async function CreateSchedule(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { 
    organization_id,
    ProvNum, 
    provider_id,
    OpNum,
    operatory_id,
    ScheduleDate,
    schedule_date,
    StartTime, 
    start_time,
    EndTime, 
    end_time,
    IsActive,
    is_active
  } = parameters;
  
  const providerId = ProvNum || provider_id;
  const operatoryId = OpNum || operatory_id;
  const scheduleDate = ScheduleDate || schedule_date;
  const startTime = StartTime || start_time;
  const endTime = EndTime || end_time;
  const active = IsActive !== undefined ? IsActive : (is_active !== undefined ? is_active : true);
  
  // Validate required fields
  if (providerId === undefined) {
    throw new Error('ProvNum (provider ID) is required');
  }
  if (operatoryId === undefined) {
    throw new Error('OpNum (operatory ID) is required');
  }
  if (!scheduleDate) {
    throw new Error('ScheduleDate is required (format: YYYY-MM-DD)');
  }
  if (!startTime) {
    throw new Error('StartTime is required (format: HH:MM or HH:MM:SS)');
  }
  if (!endTime) {
    throw new Error('EndTime is required (format: HH:MM or HH:MM:SS)');
  }
  
  // Validate provider exists
  const { data: provider, error: providerError } = await (db as any)
    .from('providers')
    .select('id')
    .eq('id', providerId)
    .single();
  
  if (providerError || !provider) {
    throw new Error(`Provider with ID ${providerId} not found`);
  }
  
  // Validate operatory exists
  const { data: operatory, error: operatoryError } = await (db as any)
    .from('operatories')
    .select('id')
    .eq('id', operatoryId)
    .single();
  
  if (operatoryError || !operatory) {
    throw new Error(`Operatory with ID ${operatoryId} not found`);
  }
  
  // Check for conflicts
  const conflict = await checkScheduleConflicts(
    scheduleDate,
    startTime,
    endTime,
    providerId,
    operatoryId,
    db,
    undefined,
    organizationId
  );
  
  if (conflict) {
    throw new Error(`Schedule conflict: ${conflict.message}`);
  }
  
  const { data, error } = await (db as any)
    .from('provider_schedules')
    .insert({
      organization_id: organization_id,
      provider_id: providerId,
      operatory_id: operatoryId,
      schedule_date: scheduleDate,
      start_time: startTime,
      end_time: endTime,
      is_active: active
    })
    .select('*, providers(*), operatories(*)')
    .single();
  
  if (error) {
    throw new Error(`Failed to create schedule: ${error.message}`);
  }
  
  return {
    ScheduleNum: data.id,
    ProvNum: data.provider_id,
    ProviderName: data.providers 
      ? `Dr. ${data.providers.first_name} ${data.providers.last_name}`
      : `Provider ${data.provider_id}`,
    OpNum: data.operatory_id,
    OperatoryName: data.operatories?.name || `Operatory ${data.operatory_id}`,
    ScheduleDate: data.schedule_date,
    StartTime: data.start_time,
    EndTime: data.end_time,
    IsActive: data.is_active
  };
}

/**
 * Update an existing schedule
 */
export async function UpdateSchedule(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { ScheduleNum, id, ...updates } = parameters;
  const scheduleId = ScheduleNum || id;
  
  if (!scheduleId) {
    throw new Error('ScheduleNum or id is required');
  }
  
  // Get existing schedule for conflict checking
  let query = (db as any)
    .from('provider_schedules')
    .select('*')
    .eq('id', scheduleId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { data: existing, error: fetchError } = await query.single();
  
  if (fetchError || !existing) {
    throw new Error(`Schedule with ID ${scheduleId} not found`);
  }
  
  // Build update object
  const updateData: Record<string, any> = {};
  
  if (updates.ProvNum !== undefined || updates.provider_id !== undefined) {
    updateData.provider_id = updates.ProvNum || updates.provider_id;
  }
  if (updates.OpNum !== undefined || updates.operatory_id !== undefined) {
    updateData.operatory_id = updates.OpNum || updates.operatory_id;
  }
  if (updates.ScheduleDate !== undefined || updates.schedule_date !== undefined) {
    updateData.schedule_date = updates.ScheduleDate || updates.schedule_date;
  }
  if (updates.StartTime !== undefined || updates.start_time !== undefined) {
    updateData.start_time = updates.StartTime || updates.start_time;
  }
  if (updates.EndTime !== undefined || updates.end_time !== undefined) {
    updateData.end_time = updates.EndTime || updates.end_time;
  }
  if (updates.IsActive !== undefined || updates.is_active !== undefined) {
    updateData.is_active = updates.IsActive !== undefined ? updates.IsActive : updates.is_active;
  }
  
  if (Object.keys(updateData).length === 0) {
    throw new Error('No update fields provided');
  }
  
  // Check for conflicts with the updated values
  const finalScheduleDate = updateData.schedule_date || existing.schedule_date;
  const finalStartTime = updateData.start_time || existing.start_time;
  const finalEndTime = updateData.end_time || existing.end_time;
  const finalProviderId = updateData.provider_id || existing.provider_id;
  const finalOperatoryId = updateData.operatory_id || existing.operatory_id;
  
  const conflict = await checkScheduleConflicts(
    finalScheduleDate,
    finalStartTime,
    finalEndTime,
    finalProviderId,
    finalOperatoryId,
    db,
    scheduleId, // Exclude current schedule from conflict check
    organizationId
  );
  
  if (conflict) {
    throw new Error(`Schedule conflict: ${conflict.message}`);
  }
  
  const { data, error } = await (db as any)
    .from('provider_schedules')
    .update(updateData)
    .eq('id', scheduleId)
    .select('*, providers(*), operatories(*)')
    .single();
  
  if (error) {
    throw new Error(`Failed to update schedule: ${error.message}`);
  }
  
  if (!data) {
    throw new Error(`Schedule with ID ${scheduleId} not found`);
  }
  
  return {
    ScheduleNum: data.id,
    ProvNum: data.provider_id,
    ProviderName: data.providers 
      ? `Dr. ${data.providers.first_name} ${data.providers.last_name}`
      : `Provider ${data.provider_id}`,
    OpNum: data.operatory_id,
    OperatoryName: data.operatories?.name || `Operatory ${data.operatory_id}`,
    ScheduleDate: data.schedule_date,
    StartTime: data.start_time,
    EndTime: data.end_time,
    IsActive: data.is_active
  };
}

/**
 * Delete a schedule
 */
export async function DeleteSchedule(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<{ success: boolean; message: string }> {
  const { ScheduleNum, id } = parameters;
  const scheduleId = ScheduleNum || id;
  
  if (!scheduleId) {
    throw new Error('ScheduleNum or id is required');
  }
  
  let query = (db as any)
    .from('provider_schedules')
    .delete()
    .eq('id', scheduleId);
  
  // CRITICAL: Filter by organization for multi-tenancy (prevents deleting other org's data)
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { error } = await query;
  
  if (error) {
    throw new Error(`Failed to delete schedule: ${error.message}`);
  }
  
  return {
    success: true,
    message: `Schedule ${scheduleId} deleted successfully`
  };
}

/**
 * Get schedules for a specific provider
 */
export async function GetProviderSchedules(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any[]> {
  const { ProvNum, provider_id, DateStart, DateEnd } = parameters;
  const providerId = ProvNum || provider_id;
  
  if (!providerId) {
    throw new Error('ProvNum (provider ID) is required');
  }
  
  const params: Record<string, any> = { ProvNum: providerId, is_active: true };
  if (DateStart) params.DateStart = DateStart;
  if (DateEnd) params.DateEnd = DateEnd;
  
  return GetSchedules(params, db, organizationId);
}

/**
 * Bulk create schedules for a date range (Mon-Fri or all days)
 * Creates schedules for each day in the range
 */
export async function CreateDefaultSchedules(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any[]> {
  const { 
    ProvNum, 
    provider_id,
    OpNum,
    operatory_id,
    DateStart,
    DateEnd,
    StartTime = '09:00:00',
    EndTime = '17:00:00',
    IncludeWeekends = false
  } = parameters;
  
  const providerId = ProvNum || provider_id;
  const operatoryId = OpNum || operatory_id;
  
  if (!providerId) {
    throw new Error('ProvNum (provider ID) is required');
  }
  if (!operatoryId) {
    throw new Error('OpNum (operatory ID) is required');
  }
  if (!DateStart || !DateEnd) {
    throw new Error('DateStart and DateEnd are required (format: YYYY-MM-DD)');
  }
  
  const created: any[] = [];
  const errors: string[] = [];
  
  // Parse dates
  const start = new Date(DateStart);
  const end = new Date(DateEnd);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  
  if (end < start) {
    throw new Error('DateEnd must be after DateStart');
  }
  
  // Limit to 31 days to prevent abuse
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 31) {
    throw new Error('Date range cannot exceed 31 days');
  }
  
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    
    // Skip weekends unless included
    if (!IncludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      // Use milliseconds to avoid Feb 28/29 bugs
      currentDate.setTime(currentDate.getTime() + 24 * 60 * 60 * 1000);
      continue;
    }
    
    const dateStr = currentDate.toISOString().split('T')[0];
    
    try {
      const schedule = await CreateSchedule({
        ProvNum: providerId,
        OpNum: operatoryId,
        ScheduleDate: dateStr,
        StartTime,
        EndTime,
        IsActive: true,
        organization_id: organizationId
      }, db, organizationId);
      created.push(schedule);
    } catch (e: any) {
      // Skip if conflict, but track the error
      if (e.message.includes('conflict')) {
        errors.push(`${dateStr}: ${e.message}`);
      } else {
        throw e;
      }
    }
    
    // Use milliseconds to avoid Feb 28/29 bugs
    currentDate.setTime(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }
  
  if (errors.length > 0 && created.length === 0) {
    throw new Error(`All schedules had conflicts: ${errors.join('; ')}`);
  }
  
  return created;
}

/**
 * Check for conflicts without creating
 */
export async function CheckScheduleConflicts(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { 
    ProvNum, 
    provider_id,
    OpNum,
    operatory_id,
    ScheduleDate,
    schedule_date,
    StartTime, 
    start_time,
    EndTime, 
    end_time,
    ExcludeScheduleNum
  } = parameters;
  
  const providerId = ProvNum || provider_id;
  const operatoryId = OpNum || operatory_id;
  const scheduleDate = ScheduleDate || schedule_date;
  const startTime = StartTime || start_time;
  const endTime = EndTime || end_time;
  
  if (!providerId || !operatoryId || !scheduleDate || !startTime || !endTime) {
    throw new Error('ProvNum, OpNum, ScheduleDate, StartTime, and EndTime are required');
  }
  
  const conflict = await checkScheduleConflicts(
    scheduleDate,
    startTime,
    endTime,
    providerId,
    operatoryId,
    db,
    ExcludeScheduleNum,
    organizationId
  );
  
  return {
    hasConflict: conflict !== null,
    conflict
  };
}
