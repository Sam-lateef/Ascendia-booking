// @ts-nocheck
/**
 * Appointment Management Functions
 */

import { db } from '@/app/lib/db';
import { openDentalConfig } from '@/app/agentConfigs/openDental/config';

/**
 * Get appointments with filters
 * Supports: PatNum, DateStart, DateEnd, ProvNum, OpNum, status
 */
export async function GetAppointments(parameters: Record<string, any>): Promise<any[]> {
  let query = db.from('appointments').select('*, patients(*), providers(*), operatories(*)');
  
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
export async function GetAvailableSlots(parameters: Record<string, any>): Promise<any[]> {
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
    await validateProvider(providerId);
    await validateOperatory(operatoryId);
    
    const result = await db
      .from('provider_schedules')
      .select('*, providers(id, first_name, last_name)')
      .eq('provider_id', providerId)
      .eq('operatory_id', operatoryId)
      .eq('is_active', true)
      .gte('schedule_date', dateStart)
      .lte('schedule_date', dateEnd);
    
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
    const result = await db
      .from('provider_schedules')
      .select('*, providers(id, first_name, last_name)')
      .eq('is_active', true)
      .gte('schedule_date', dateStart)
      .lte('schedule_date', dateEnd);
    
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
  const { data: allAppointments, error: aptError } = await db
    .from('appointments')
    .select('*')
    .in('status', ['Scheduled'])
    .gte('appointment_datetime', startDateStr)
    .lte('appointment_datetime', endDateStr);
  
  if (aptError) {
    throw new Error(`Failed to fetch appointments: ${aptError.message}`);
  }
  
  console.log(`[GetAvailableSlots] Found ${(allAppointments || []).length} existing appointments in date range`);
  
  // Generate available slots
  const availableSlots: any[] = [];
  
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
          
          // Check if slot is not booked for this provider/operatory
          if (!bookedTimes.has(slotKey)) {
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
            console.log(`[GetAvailableSlots] Slot ${slotKey} is booked for Provider ${scheduleProvId}, Operatory ${scheduleOpId} - excluding`);
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
export async function CreateAppointment(parameters: Record<string, any>): Promise<any> {
  const { PatNum, AptDateTime, Op, ProvNum, Note, Pattern, IsHygiene, AptStatus = 'Scheduled' } = parameters;
  
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
  
  const patientId = parseInt(PatNum.toString());
  const providerId = parseInt(ProvNum.toString());
  const operatoryId = parseInt(Op.toString());
  
  // Validate all foreign keys exist and are valid
  await validatePatient(patientId);
  await validateProvider(providerId);
  await validateOperatory(operatoryId);
  
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
  const conflictCheck = await checkConflict(providerId, operatoryId, appointmentDateTime, duration);
  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message || 'Time slot conflict detected');
  }
  
  const { data, error } = await db
    .from('appointments')
    .insert({
      patient_id: patientId,
      provider_id: providerId,
      operatory_id: operatoryId,
      appointment_datetime: appointmentDateTime,
      duration_minutes: duration,
      appointment_type: Note || 'General',
      status: AptStatus,
      notes: Note || ''
    })
    .select()
    .single();
  
  if (error || !data) {
    if (error?.code === '23505') { // Unique constraint violation
      throw new Error('Time slot conflict: Appointment already exists at this time');
    }
    throw new Error(`Failed to create appointment: ${error?.message || 'No data returned'}`);
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
 * Update appointment
 */
export async function UpdateAppointment(parameters: Record<string, any>): Promise<any> {
  const { AptNum, AppointmentId, AptDateTime, Op, ProvNum, AptStatus, Note } = parameters;
  const appointmentId = AptNum || AppointmentId;
  
  if (!appointmentId) {
    throw new Error('AptNum or AppointmentId is required');
  }
  
  // Validate appointment exists
  await validateAppointment(appointmentId);
  
  const updateData: any = {};
  
  if (AptDateTime) {
    updateData.appointment_datetime = AptDateTime.includes('T') 
      ? AptDateTime.replace('T', ' ').substring(0, 19)
      : AptDateTime.substring(0, 19);
  }
  
  // Validate and update operatory if provided
  if (Op !== undefined) {
    const operatoryId = parseInt(Op.toString());
    await validateOperatory(operatoryId);
    updateData.operatory_id = operatoryId;
  }
  
  // Validate and update provider if provided
  if (ProvNum !== undefined) {
    const providerId = parseInt(ProvNum.toString());
    await validateProvider(providerId);
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
        appointmentId // Exclude current appointment
      );
      
      if (conflictCheck.hasConflict) {
        throw new Error(conflictCheck.message || 'Time slot conflict detected');
      }
    }
  }
  
  const { data, error } = await db
    .from('appointments')
    .update(updateData)
    .eq('id', appointmentId)
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
export async function BreakAppointment(parameters: Record<string, any>): Promise<any> {
  const { AptNum, sendToUnscheduledList = true } = parameters;
  
  if (!AptNum) {
    throw new Error('AptNum is required');
  }
  
  const appointmentId = parseInt(AptNum.toString());
  
  // Validate appointment exists
  await validateAppointment(appointmentId);
  
  // Check appointment status
  const { data: appointment, error: fetchError } = await db
    .from('appointments')
    .select('status')
    .eq('id', appointmentId)
    .single();
  
  if (fetchError || !appointment) {
    throw new Error(`Appointment not found: ${fetchError?.message || 'No data returned'}`);
  }
  
  if (appointment.status !== 'Scheduled') {
    throw new Error(`Only appointments with status 'Scheduled' can be broken. Current status: ${appointment.status}`);
  }
  
  const newStatus = sendToUnscheduledList ? 'Broken' : 'Cancelled';
  
  const { data, error } = await db
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', appointmentId)
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
export async function DeleteAppointment(parameters: Record<string, any>): Promise<any> {
  const { AptNum } = parameters;
  
  if (!AptNum) {
    throw new Error('AptNum is required');
  }
  
  const appointmentId = parseInt(AptNum.toString());
  
  // Validate appointment exists
  await validateAppointment(appointmentId);
  
  const { error } = await db
    .from('appointments')
    .delete()
    .eq('id', appointmentId);
  
  if (error) {
    throw new Error(`Failed to delete appointment: ${error.message}`);
  }
  
  return { success: true, AptNum: appointmentId };
}

// Helper functions

/**
 * Validate that a patient exists
 */
async function validatePatient(patientId: number): Promise<void> {
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
async function validateProvider(providerId: number): Promise<void> {
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
async function validateOperatory(operatoryId: number): Promise<void> {
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
async function validateAppointment(appointmentId: number): Promise<void> {
  const { data, error } = await db
    .from('appointments')
    .select('id')
    .eq('id', appointmentId)
    .single();
  
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

