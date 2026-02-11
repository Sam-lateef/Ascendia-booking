// @ts-nocheck
/**
 * Appointment Management Functions
 */

import { db as defaultDb } from '@/app/lib/db';
import { openDentalConfig } from '@/app/agentConfigs/openDental/config';
import type { SyncContext } from '@/app/lib/integrations/SyncManager';
import { isGoogleCalendarConfigured } from '@/app/lib/credentialLoader';
import { GoogleCalendarService } from '@/app/lib/integrations/GoogleCalendarService';

/**
 * Get appointments with filters
 * Supports: PatNum, DateStart, DateEnd, ProvNum, OpNum, status
 */
export async function GetAppointments(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any[]> {
  let query = db.from('appointments').select('*, patients(*), providers(*), operatories(*)');
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  // Apply filters
  if (parameters.PatNum) {
    query = query.eq('patient_id', parameters.PatNum);
  }
  
  if (parameters.ProvNum) {
    query = query.eq('provider_id', parameters.ProvNum);
  }
  
  if (parameters.OpNum || parameters.Op) {
    const opNum = parameters.OpNum || parameters.Op;
    query = query.eq('operatory_id', opNum);
  }
  
  if (parameters.status) {
    query = query.eq('status', parameters.status);
  }
  
  // Date range filter
  if (parameters.DateStart) {
    const startDate = parameters.DateStart.includes('T') 
      ? parameters.DateStart.split('T')[0] 
      : parameters.DateStart.split(' ')[0];
    query = query.gte('appointment_datetime', `${startDate} 00:00:00`);
  }
  
  if (parameters.DateEnd) {
    const endDate = parameters.DateEnd.includes('T') 
      ? parameters.DateEnd.split('T')[0] 
      : parameters.DateEnd.split(' ')[0];
    query = query.lte('appointment_datetime', `${endDate} 23:59:59`);
  }
  
  const { data, error } = await query.order('appointment_datetime');
  
  if (error) {
    throw new Error(`Failed to fetch appointments: ${error.message}`);
  }
  
  // Transform to OpenDental format with patient/provider/operatory details
  return (data || []).map((apt: any) => {
    const patient = apt.patients || {};
    const provider = apt.providers || {};
    const operatory = apt.operatories || {};
    
    return {
      AptNum: apt.id,
      PatNum: apt.patient_id,
      PatientName: patient.first_name && patient.last_name 
        ? `${patient.first_name} ${patient.last_name}` 
        : `Patient ${apt.patient_id}`,
      PatientFirstName: patient.first_name || '',
      PatientLastName: patient.last_name || '',
      ProvNum: apt.provider_id,
      ProviderName: provider.first_name && provider.last_name
        ? `Dr. ${provider.first_name} ${provider.last_name}`
        : `Provider ${apt.provider_id}`,
      Op: apt.operatory_id,
      OperatoryName: operatory.name || `Room ${apt.operatory_id}`,
      AptDateTime: apt.appointment_datetime,
      AptStatus: apt.status,
      Note: apt.notes || apt.appointment_type || '',
      Pattern: generatePattern(apt.duration_minutes || 30),
      IsNewPatient: false,
      DateCreated: apt.created_at,
      DateTStamp: apt.updated_at
    };
  });
}

/**
 * Calculate available time slots
 * Complex function that:
 * 1. Gets provider schedules for the date range
 * 2. Gets existing appointments
 * 3. Calculates available 30-minute slots
 */
export async function GetAvailableSlots(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any[]> {
  const { dateStart, dateEnd, ProvNum, OpNum, lengthMinutes = 30, searchAll = false } = parameters || {};
  
  // Only dateStart and dateEnd are truly required
  if (!dateStart || !dateEnd) {
    throw new Error(
      `GetAvailableSlots requires dateStart and dateEnd. ` +
      `Received: ${JSON.stringify(parameters || {})}. ` +
      `Example: { dateStart: "2025-12-16", dateEnd: "2025-12-16" }`
    );
  }
  
  // Parse date range as local dates (no timezone conversion)
  const [startYear, startMonth, startDay] = dateStart.split('-').map(Number);
  const [endYear, endMonth, endDay] = dateEnd.split('-').map(Number);
  
  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  
  // SMART SCHEDULING: If no specific provider/operatory, search ALL available schedules
  // This finds slots across any provider/operatory that has availability
  let schedules: any[] = [];
  let scheduleError: any = null;
  
  // First, try to find schedules for the specific provider/operatory if provided
  if (ProvNum && OpNum && !searchAll) {
    const providerId = parseInt(ProvNum.toString());
    const operatoryId = parseInt(OpNum.toString());
    
    // Validate provider and operatory exist and are active
    await validateProvider(providerId, db);
    await validateOperatory(operatoryId, db);
    
    let query = db
      .from('provider_schedules')
      .select('*, providers(id, first_name, last_name)')
      .eq('provider_id', providerId)
      .eq('operatory_id', operatoryId)
      .eq('is_active', true)
      .gte('schedule_date', dateStart)
      .lte('schedule_date', dateEnd);
    
    // CRITICAL: Filter by organization for multi-tenancy
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    
    const result = await query;
    
    // Add provider name to each schedule
    schedules = (result.data || []).map((s: any) => ({
      ...s,
      provider_name: s.providers ? `Dr. ${s.providers.first_name} ${s.providers.last_name}` : null
    }));
    scheduleError = result.error;
    
    console.log(`[GetAvailableSlots] Found ${schedules.length} schedules for Provider ${providerId}, Operatory ${operatoryId}`);
    
    // If no schedules found for specific provider/operatory, search ALL
    if (schedules.length === 0) {
      console.log(`[GetAvailableSlots] No schedules for Provider ${providerId}, Operatory ${operatoryId}. Searching ALL available schedules...`);
    }
  }
  
  // If no schedules found (or no provider/operatory specified), search ALL active schedules
  if (schedules.length === 0) {
    let query = db
      .from('provider_schedules')
      .select('*, providers(id, first_name, last_name)')
      .eq('is_active', true)
      .gte('schedule_date', dateStart)
      .lte('schedule_date', dateEnd);
    
    // CRITICAL: Filter by organization for multi-tenancy
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    
    const result = await query;
    
    // Add provider name to each schedule
    schedules = (result.data || []).map((s: any) => ({
      ...s,
      provider_name: s.providers ? `Dr. ${s.providers.first_name} ${s.providers.last_name}` : null
    }));
    scheduleError = result.error;
    
    console.log(`[GetAvailableSlots] Found ${schedules.length} total active schedules for date range`);
  }
  
  if (scheduleError) {
    throw new Error(`Failed to fetch schedules: ${scheduleError.message}`);
  }
  
  if (schedules.length === 0) {
    console.log(`[GetAvailableSlots] No schedules configured for ${dateStart} to ${dateEnd}. Please configure provider schedules first.`);
    return [];
  }
  
  console.log(`[GetAvailableSlots] Processing ${schedules.length} schedules for ${dateStart} to ${dateEnd}`);
  
  // Get unique provider/operatory combinations from schedules
  const provOpCombos = new Set<string>();
  schedules.forEach((s: any) => provOpCombos.add(`${s.provider_id}-${s.operatory_id}`));
  console.log(`[GetAvailableSlots] Provider/Operatory combos with schedules: ${Array.from(provOpCombos).join(', ')}`);
  
  // Fetch existing appointments in date range for ALL provider/operatory combinations
  // Format dates as YYYY-MM-DD HH:mm:ss strings for comparison (local time, no timezone)
  const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')} 00:00:00`;
  const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')} 23:59:59`;
  
  // Build a map of booked times per provider/operatory
  const bookedTimesMap = new Map<string, Set<string>>();
  
  // Fetch all appointments in date range (we'll filter by provider/operatory in processing)
  let aptQuery = db
    .from('appointments')
    .select('*')
    .in('status', ['Scheduled'])
    .gte('appointment_datetime', startDateStr)
    .lte('appointment_datetime', endDateStr);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    aptQuery = aptQuery.eq('organization_id', organizationId);
  }
  
  const { data: allAppointments, error: aptError } = await aptQuery;
  
  if (aptError) {
    throw new Error(`Failed to fetch appointments: ${aptError.message}`);
  }
  
  console.log(`[GetAvailableSlots] Found ${(allAppointments || []).length} existing appointments in date range`);
  
  // Generate available slots
  const availableSlots: any[] = [];
  
  // Google Calendar: fetch busy times when configured (excludes slots busy in Google)
  const googleBusySlotKeys = new Set<string>();
  if (organizationId) {
    try {
      const googleConfigured = await isGoogleCalendarConfigured(organizationId);
      if (googleConfigured) {
        const calendarService = new GoogleCalendarService(organizationId);
        const { getGoogleCalendarCredentials } = await import('@/app/lib/credentialLoader');
        const { getSupabaseAdmin } = await import('@/app/lib/supabaseClient');
        const creds = await getGoogleCalendarCredentials(organizationId);
        const calendarId = creds.calendarId || 'primary';

        // Get org timezone so we can correctly interpret Google Calendar busy times
        const supabaseForTz = getSupabaseAdmin();
        const { data: orgTzData } = await supabaseForTz
          .from('organizations')
          .select('timezone')
          .eq('id', organizationId)
          .single();
        const orgTimezone = orgTzData?.timezone || 'America/New_York';

        // Send timezone-aware request to Google freeBusy API
        const timeMin = `${dateStart}T00:00:00`;
        const timeMax = `${dateEnd}T23:59:59`;
        const freeBusy = await calendarService.getFreeBusy({
          timeMin,
          timeMax,
          timeZone: orgTimezone,
          items: [{ id: calendarId }],
        });
        const busyTimes = freeBusy.calendars?.[calendarId]?.busy || [];

        // Helper: convert a UTC Date to org's local time components
        // Google freeBusy returns UTC times, but our slot keys are in org local time
        const toLocalComponents = (utcDate: Date): { y: string; m: string; d: string; h: number; min: number } => {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: orgTimezone,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
          });
          const parts = formatter.formatToParts(utcDate);
          const get = (type: string): string => parts.find(p => p.type === type)?.value || '0';
          // Intl month/day are already zero-padded with '2-digit', year is 4-digit
          // Note: Intl uses MM/DD/YYYY order for en-US, but formatToParts gives named parts
          return {
            y: get('year'),
            m: get('month'),
            d: get('day'),
            h: parseInt(get('hour'), 10),
            min: parseInt(get('minute'), 10),
          };
        };

        busyTimes.forEach((b: { start: string; end: string }) => {
          const busyStart = new Date(b.start);
          const busyEnd = new Date(b.end);

          // Round busyStart down to nearest 30-min boundary in org local time
          const startLocal = toLocalComponents(busyStart);
          const roundedMin = Math.floor(startLocal.min / 30) * 30;
          // Rebuild a Date representing the rounded slot in org local time
          // We iterate in 30-min increments until we pass busyEnd
          let slotMs = busyStart.getTime() - ((startLocal.min - roundedMin) * 60000);
          while (slotMs < busyEnd.getTime()) {
            const lc = toLocalComponents(new Date(slotMs));
            const key = `${lc.y}-${lc.m}-${lc.d} ${String(lc.h).padStart(2, '0')}:${String(lc.min).padStart(2, '0')}:00`;
            googleBusySlotKeys.add(key);
            slotMs += 30 * 60000;
          }
        });
        console.log(`[GetAvailableSlots] Google Calendar: ${googleBusySlotKeys.size} busy slot keys excluded (tz: ${orgTimezone})`);
      }
    } catch (err) {
      console.warn('[GetAvailableSlots] Google free/busy fetch failed, using local only:', err);
    }
  }

  // Build booked times per provider/operatory combo
  (allAppointments || []).forEach((apt: any) => {
    // Skip if no datetime
    if (!apt.appointment_datetime) return;
    
    const provOpKey = `${apt.provider_id}-${apt.operatory_id}`;
    if (!bookedTimesMap.has(provOpKey)) {
      bookedTimesMap.set(provOpKey, new Set<string>());
    }
    const bookedTimes = bookedTimesMap.get(provOpKey)!;
    
    // Handle both space and T separator for datetime
    const dateTimeStr = String(apt.appointment_datetime);
    let datePart: string;
    let timePart: string;
    
    if (dateTimeStr.includes('T')) {
      [datePart, timePart] = dateTimeStr.split('T');
      // Handle timezone suffix if present (e.g., "+00:00" or "Z")
      timePart = timePart.split('+')[0].split('Z')[0];
    } else if (dateTimeStr.includes(' ')) {
      [datePart, timePart] = dateTimeStr.split(' ');
    } else {
      // Just a date, no time - skip
      console.log(`[GetAvailableSlots] Skipping appointment with no time: ${dateTimeStr}`);
      return;
    }
    
    if (!timePart) return;
    
    const [hour, minute] = timePart.split(':').map(Number);
    if (isNaN(hour) || isNaN(minute)) {
      console.log(`[GetAvailableSlots] Invalid time format: ${timePart}`);
      return;
    }
    
    const slotKey = `${datePart} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    bookedTimes.add(slotKey);
    console.log(`[GetAvailableSlots] Marked as booked: ${slotKey} for Provider ${apt.provider_id}, Operatory ${apt.operatory_id}`);
    
    // Also mark the slot as booked for the duration
    const duration = apt.duration_minutes || 30;
    for (let i = 30; i < duration; i += 30) {
      const totalMinutes = minute + i;
      const additionalHours = Math.floor(totalMinutes / 60);
      const finalMinutes = totalMinutes % 60;
      const finalHour = hour + additionalHours;
      const slotKey2 = `${datePart} ${String(finalHour).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}:00`;
      bookedTimes.add(slotKey2);
    }
  });
  
  // Iterate through each day in the range
  // Use milliseconds for incrementing to avoid Feb 28/29 bugs
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    // Format current date as YYYY-MM-DD for comparison
    const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    
    // Find schedules for this specific date (new date-based system)
    const daySchedules = (schedules || []).filter((s: any) => s.schedule_date === currentDateStr);
    
    daySchedules.forEach((schedule: any) => {
      const scheduleProvId = schedule.provider_id;
      const scheduleOpId = schedule.operatory_id;
      const provOpKey = `${scheduleProvId}-${scheduleOpId}`;
      
      // Get booked times for this provider/operatory combo
      const bookedTimes = bookedTimesMap.get(provOpKey) || new Set<string>();
      
      // Parse schedule times
      const [schedStartHour, schedStartMin] = schedule.start_time.split(':').map(Number);
      const [schedEndHour, schedEndMin] = schedule.end_time.split(':').map(Number);
      
      // Generate 30-minute slots within schedule
      // Use local time consistently (don't convert to UTC)
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const day = currentDate.getDate();
      
      const slotStart = new Date(year, month, day, schedStartHour, schedStartMin, 0, 0);
      const scheduleEnd = new Date(year, month, day, schedEndHour, schedEndMin, 0, 0);
      
      while (slotStart < scheduleEnd) {
        const slotEnd = new Date(slotStart.getTime() + lengthMinutes * 60000);
        
        // Check if slot fits within schedule
        if (slotEnd <= scheduleEnd) {
          // Format as local time string (YYYY-MM-DD HH:mm:ss) without timezone conversion
          const slotStartYear = slotStart.getFullYear();
          const slotStartMonth = slotStart.getMonth();
          const slotStartDay = slotStart.getDate();
          const slotEndYear = slotEnd.getFullYear();
          const slotEndMonth = slotEnd.getMonth();
          const slotEndDay = slotEnd.getDate();
          
          const slotStartDateStr = `${slotStartYear}-${String(slotStartMonth + 1).padStart(2, '0')}-${String(slotStartDay).padStart(2, '0')}`;
          const slotEndDateStr = `${slotEndYear}-${String(slotEndMonth + 1).padStart(2, '0')}-${String(slotEndDay).padStart(2, '0')}`;
          
          const slotStartTimeStr = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}:00`;
          const slotEndTimeStr = `${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}:00`;
          
          const slotKey = `${slotStartDateStr} ${slotStartTimeStr}`;
          
          // Check if slot is not booked (local) and not busy in Google Calendar
          const isLocallyBooked = bookedTimes.has(slotKey);
          const isGoogleBusy = googleBusySlotKeys.has(slotKey);
          if (!isLocallyBooked && !isGoogleBusy) {
            // Get provider name from schedule if available, otherwise use a default
            const providerName = schedule.provider_name || schedule.providers?.name || `Dr. Provider ${scheduleProvId}`;
            
            availableSlots.push({
              DateTimeStart: `${slotStartDateStr} ${slotStartTimeStr}`,
              DateTimeEnd: `${slotEndDateStr} ${slotEndTimeStr}`,
              ProvNum: scheduleProvId,
              OpNum: scheduleOpId,
              LengthMinutes: lengthMinutes,
              ProviderName: providerName
            });
          } else {
            const reason = isGoogleBusy ? 'Google Calendar busy' : 'locally booked';
            console.log(`[GetAvailableSlots] Slot ${slotKey} excluded (${reason}) for Provider ${scheduleProvId}, Operatory ${scheduleOpId}`);
          }
        }
        
        // Move to next 30-minute slot
        slotStart.setMinutes(slotStart.getMinutes() + 30);
      }
    });
    
    // Move to next day using milliseconds to avoid Feb 28/29 bugs
    currentDate.setTime(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }
  
  // Sort by datetime
  availableSlots.sort((a, b) => 
    new Date(a.DateTimeStart).getTime() - new Date(b.DateTimeStart).getTime()
  );
  
  // Summarize booked times for logging
  const allBookedTimes: string[] = [];
  bookedTimesMap.forEach((times, provOp) => {
    times.forEach(t => allBookedTimes.push(`${provOp}@${t}`));
  });
  console.log(`[GetAvailableSlots] Returning ${availableSlots.length} available slots. Booked times: ${allBookedTimes.join(', ') || 'none'}`);
  
  return availableSlots;
}

/**
 * Create new appointment
 */
export async function CreateAppointment(parameters: Record<string, any>, db: any = defaultDb): Promise<any> {
  const { PatNum, AptDateTime, Op, ProvNum, Note, Pattern, IsHygiene, AptStatus = 'Scheduled', organization_id } = parameters;
  
  // Validate required fields
  if (!PatNum) {
    throw new Error('PatNum is required');
  }
  
  if (!AptDateTime) {
    throw new Error('AptDateTime is required');
  }
  
  if (!ProvNum) {
    throw new Error('ProvNum is required');
  }
  
  if (!Op) {
    throw new Error('Op (Operatory) is required');
  }
  
  if (!organization_id) {
    throw new Error('organization_id is required');
  }
  
  const patientId = parseInt(PatNum.toString());
  const providerId = parseInt(ProvNum.toString());
  const operatoryId = parseInt(Op.toString());
  
  // Validate all foreign keys exist and are valid
  await validatePatient(patientId, db);
  await validateProvider(providerId, db);
  await validateOperatory(operatoryId, db);
  
  // Parse datetime
  let appointmentDateTime: string;
  if (AptDateTime.includes('T')) {
    appointmentDateTime = AptDateTime.replace('T', ' ').substring(0, 19);
  } else {
    appointmentDateTime = AptDateTime.substring(0, 19);
  }
  
  // Calculate duration from pattern or use default
  const duration = Pattern ? calculateDurationFromPattern(Pattern) : 30;
  
  // Check for conflicts
  const conflictCheck = await checkConflict(providerId, operatoryId, appointmentDateTime, duration, db);
  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message || 'Time slot conflict detected');
  }
  
  // Use SyncManager for dual-write support (local DB + external sync)
  const { SyncManager } = await import('@/app/lib/integrations/SyncManager');
  const syncManager = new SyncManager(organization_id);
  
  // Extract sync context from parameters (set by booking API route)
  const syncContext: SyncContext | undefined = parameters.__syncContext;
  
  const appointmentData = {
    organization_id: organization_id,
    patient_id: patientId,
    provider_id: providerId,
    operatory_id: operatoryId,
    appointment_datetime: appointmentDateTime,
    duration_minutes: duration,
    appointment_type: Note || 'General',
    status: AptStatus,
    notes: Note || ''
  };
  
  // Pass sync context to SyncManager for channel-aware syncing
  const data = await syncManager.createAppointment(appointmentData, syncContext);
  
  return {
    AptNum: data.id,
    PatNum: data.patient_id,
    ProvNum: data.provider_id,
    Op: data.operatory_id,
    AptDateTime: data.appointment_datetime,
    AptStatus: data.status,
    Note: data.notes || data.appointment_type || ''
  };
}

/**
 * Update appointment
 */
export async function UpdateAppointment(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { AptNum, AppointmentId, AptDateTime, Op, ProvNum, AptStatus, Note } = parameters;
  const appointmentId = AptNum || AppointmentId;
  
  if (!appointmentId) {
    throw new Error('AptNum or AppointmentId is required');
  }
  
  // Validate appointment exists (with org filtering)
  await validateAppointment(appointmentId, db, organizationId);
  
  const updateData: any = {};
  
  if (AptDateTime) {
    updateData.appointment_datetime = AptDateTime.includes('T') 
      ? AptDateTime.replace('T', ' ').substring(0, 19)
      : AptDateTime.substring(0, 19);
  }
  
  // Validate and update operatory if provided
  if (Op !== undefined) {
    const operatoryId = parseInt(Op.toString());
    await validateOperatory(operatoryId, db);
    updateData.operatory_id = operatoryId;
  }
  
  // Validate and update provider if provided
  if (ProvNum !== undefined) {
    const providerId = parseInt(ProvNum.toString());
    await validateProvider(providerId, db);
    updateData.provider_id = providerId;
  }
  
  if (AptStatus) updateData.status = AptStatus;
  if (Note !== undefined) updateData.notes = Note;
  
  // Check for conflicts if datetime changed
  if (updateData.appointment_datetime) {
    const { data: existing } = await db
      .from('appointments')
      .select('duration_minutes, provider_id, operatory_id')
      .eq('id', appointmentId)
      .single();
    
    if (existing) {
      const duration = existing.duration_minutes || 30;
      const provId = updateData.provider_id || existing.provider_id;
      const opId = updateData.operatory_id || existing.operatory_id;
      
      const conflictCheck = await checkConflict(
        provId, 
        opId, 
        updateData.appointment_datetime, 
        duration,
        db,
        appointmentId // Exclude current appointment
      );
      
      if (conflictCheck.hasConflict) {
        throw new Error(conflictCheck.message || 'Time slot conflict detected');
      }
    }
  }
  
  let updateQuery = db
    .from('appointments')
    .update(updateData)
    .eq('id', appointmentId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    updateQuery = updateQuery.eq('organization_id', organizationId);
  }
  
  const { data, error } = await updateQuery
    .select()
    .single();
  
  if (error || !data) {
    if (error?.code === '23505') {
      throw new Error('Time slot conflict: Appointment already exists at this time');
    }
    throw new Error(`Failed to update appointment: ${error?.message || 'No data returned'}`);
  }
  
  return {
    AptNum: data.id,
    PatNum: data.patient_id,
    ProvNum: data.provider_id,
    Op: data.operatory_id,
    AptDateTime: data.appointment_datetime,
    AptStatus: data.status,
    Note: data.notes || data.appointment_type || ''
  };
}

/**
 * Break/Cancel appointment
 */
export async function BreakAppointment(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { AptNum, sendToUnscheduledList = true } = parameters;
  
  if (!AptNum) {
    throw new Error('AptNum is required');
  }
  
  const appointmentId = parseInt(AptNum.toString());
  
  // Validate appointment exists (with org filtering)
  await validateAppointment(appointmentId, db, organizationId);
  
  // Check appointment status
  let fetchQuery = db
    .from('appointments')
    .select('status')
    .eq('id', appointmentId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    fetchQuery = fetchQuery.eq('organization_id', organizationId);
  }
  
  const { data: appointment, error: fetchError } = await fetchQuery.single();
  
  if (fetchError || !appointment) {
    throw new Error(`Appointment not found: ${fetchError?.message || 'No data returned'}`);
  }
  
  if (appointment.status !== 'Scheduled') {
    throw new Error(`Only appointments with status 'Scheduled' can be broken. Current status: ${appointment.status}`);
  }
  
  const newStatus = sendToUnscheduledList ? 'Broken' : 'Cancelled';
  
  let updateQuery = db
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', appointmentId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    updateQuery = updateQuery.eq('organization_id', organizationId);
  }
  
  const { data, error } = await updateQuery
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to break appointment: ${error?.message || 'No data returned'}`);
  }
  
  return {
    AptNum: data.id,
    AptStatus: data.status,
    success: true
  };
}

/**
 * Delete appointment permanently
 */
export async function DeleteAppointment(parameters: Record<string, any>, db: any = defaultDb, organizationId?: string): Promise<any> {
  const { AptNum } = parameters;
  
  if (!AptNum) {
    throw new Error('AptNum is required');
  }
  
  const appointmentId = parseInt(AptNum.toString());
  
  // Validate appointment exists (with org filtering)
  await validateAppointment(appointmentId, db, organizationId);
  
  let deleteQuery = db
    .from('appointments')
    .delete()
    .eq('id', appointmentId);
  
  // CRITICAL: Filter by organization for multi-tenancy (prevents deleting other org's data)
  if (organizationId) {
    deleteQuery = deleteQuery.eq('organization_id', organizationId);
  }
  
  const { error } = await deleteQuery;
  
  if (error) {
    throw new Error(`Failed to delete appointment: ${error.message}`);
  }
  
  return { success: true, AptNum: appointmentId };
}

// Helper functions

/**
 * Validate that a patient exists
 */
async function validatePatient(patientId: number, db: any): Promise<void> {
  const { data, error } = await db
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .single();
  
  if (error || !data) {
    throw new Error(`Patient with ID ${patientId} not found`);
  }
}

/**
 * Validate that a provider exists and is active
 */
async function validateProvider(providerId: number, db: any): Promise<void> {
  const { data, error } = await db
    .from('providers')
    .select('id, is_active')
    .eq('id', providerId)
    .single();
  
  if (error || !data) {
    throw new Error(`Provider with ID ${providerId} not found`);
  }
  
  if (!data.is_active) {
    throw new Error(`Provider with ID ${providerId} is not active`);
  }
}

/**
 * Validate that an operatory exists and is active
 */
async function validateOperatory(operatoryId: number, db: any): Promise<void> {
  const { data, error } = await db
    .from('operatories')
    .select('id, is_active')
    .eq('id', operatoryId)
    .single();
  
  if (error || !data) {
    throw new Error(`Operatory with ID ${operatoryId} not found`);
  }
  
  if (!data.is_active) {
    throw new Error(`Operatory with ID ${operatoryId} is not active`);
  }
}

/**
 * Validate that an appointment exists
 */
async function validateAppointment(appointmentId: number, db: any, organizationId?: string): Promise<void> {
  let query = db
    .from('appointments')
    .select('id')
    .eq('id', appointmentId);
  
  // CRITICAL: Filter by organization for multi-tenancy
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { data, error } = await query.single();
  
  if (error || !data) {
    throw new Error(`Appointment with ID ${appointmentId} not found`);
  }
}

/**
 * Generate pattern string from duration (OpenDental format)
 */
function generatePattern(durationMinutes: number): string {
  const blocks = Math.floor(durationMinutes / 5);
  const gap = '/';
  const slot = 'X';
  return gap + slot.repeat(blocks) + gap;
}

/**
 * Calculate duration from pattern
 */
function calculateDurationFromPattern(pattern: string): number {
  const blocks = (pattern.match(/X/g) || []).length;
  return blocks * 5; // Each X = 5 minutes
}

/**
 * Check for scheduling conflicts
 */
async function checkConflict(
  providerId: number,
  operatoryId: number,
  datetime: string,
  durationMinutes: number,
  db: any,
  excludeAptId?: number
): Promise<{ hasConflict: boolean; message?: string }> {
  const appointmentStart = new Date(datetime);
  const appointmentEnd = new Date(appointmentStart.getTime() + durationMinutes * 60000);
  
  // Use consistent date formatting (local time, no UTC conversion)
  // Extract date from the datetime string directly instead of using toISOString()
  const datePart = datetime.includes('T') 
    ? datetime.split('T')[0] 
    : datetime.split(' ')[0];
  
  let query = db
    .from('appointments')
    .select('*')
    .eq('provider_id', providerId)
    .eq('operatory_id', operatoryId)
    .in('status', ['Scheduled'])
    .gte('appointment_datetime', datePart + ' 00:00:00')
    .lte('appointment_datetime', datePart + ' 23:59:59');
  
  console.log(`[checkConflict] Checking for conflicts on ${datePart} for Provider ${providerId}, Operatory ${operatoryId}`);
  
  if (excludeAptId) {
    query = query.neq('id', excludeAptId);
  }
  
  const { data: conflicting } = await query;
  
  if (!conflicting || conflicting.length === 0) {
    return { hasConflict: false };
  }
  
  // Check for time overlap
  for (const apt of conflicting) {
    const aptStart = new Date(apt.appointment_datetime);
    const aptEnd = new Date(aptStart.getTime() + (apt.duration_minutes || 30) * 60000);
    
    // Check if appointments overlap
    if (appointmentStart < aptEnd && appointmentEnd > aptStart) {
      return {
        hasConflict: true,
        message: `Time slot conflict: Provider ${providerId} and Operatory ${operatoryId} already have an appointment at ${apt.appointment_datetime}`
      };
    }
  }
  
  return { hasConflict: false };
}

