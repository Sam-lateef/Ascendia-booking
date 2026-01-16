/**
 * Office Context Fetcher
 * 
 * Fetches and caches office data (providers, operatories, occupied slots)
 * Called ONCE at the start of a conversation by Lexi
 * Dramatically reduces API calls by pre-fetching commonly needed data
 */

import { openDentalConfig } from '@/app/agentConfigs/openDental/config';

export interface Provider {
  provNum: number;
  name: string;
  firstName: string;
  lastName: string;
  abbr: string;
  specialty: string;
  isAvailable: boolean;
  isHidden: boolean;
  color?: string;
  hasSchedules?: boolean;
  scheduleCount?: number;
  schedules?: ProviderSchedule[];
}

export interface Operatory {
  opNum: number;
  name: string;
  abbrev: string;
  isHygiene: boolean;
  isAvailable: boolean;
  isHidden: boolean;
  provNum?: number;
  clinicNum?: number;
  hasSchedules?: boolean;
  scheduleCount?: number;
}

export interface ProviderSchedule {
  scheduleNum: number;
  schedDate: string;
  startTime: string;
  stopTime: string;
  schedType: string;
  provNum: number;
  operatories?: string;
  note?: string;
}

export interface OccupiedSlot {
  aptNum: number;
  aptDateTime: string;
  patNum: number;
  provNum: number;
  opNum: number;
  duration: number;  // minutes
  aptStatus?: string;
  note?: string;
}

export interface OfficeContext {
  providers: Provider[];
  operatories: Operatory[];
  occupiedSlots: OccupiedSlot[];
  officeHours: typeof openDentalConfig.availability.officeHours;
  defaults: typeof openDentalConfig.defaults;
  fetchedAt: string;
  expiresAt: string;
  scheduleConfig?: {
    totalSchedules: number;
    providersWithSchedules: number;
    operatoriesWithSchedules: number;
    defaultProviderHasSchedule: boolean;
    defaultOperatoryHasSchedule: boolean;
  };
}

/**
 * Fetch complete office context in parallel
 * This is called ONCE at the start of the conversation
 * 
 * @returns OfficeContext with providers, operatories, and occupied slots
 */
export async function fetchOfficeContext(): Promise<OfficeContext> {
  const config = openDentalConfig;
  const startTime = Date.now();
  
  // Calculate date range (today + lookAheadDays)
  const today = new Date();
  const todayStr = formatDate(today);
  
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + config.availability.lookAheadDays);
  const endDateStr = formatDate(endDate);

  try {
    // Fetch all 3 in parallel for maximum speed
    const [providersRes, operatoriesRes, appointmentsRes] = await Promise.all([
      fetch('/api/opendental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          functionName: 'GetProviders',
          parameters: {}
        })
      }),
      
      fetch('/api/opendental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          functionName: 'GetOperatories',
          parameters: {}
        })
      }),
      
      fetch('/api/opendental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          functionName: 'GetAppointments',
          parameters: {
            DateStart: todayStr,
            DateEnd: endDateStr
          }
        })
      })
    ]);

    // Parse responses
    const [providersData, operatoriesData, appointmentsData] = await Promise.all([
      providersRes.json(),
      operatoriesRes.json(),
      appointmentsRes.json()
    ]);


    // Format providers
    const providers: Provider[] = (Array.isArray(providersData) ? providersData : []).map((p: any) => ({
      provNum: p.ProvNum,
      name: formatProviderName(p),
      firstName: p.FName || '',
      lastName: p.LName || '',
      abbr: p.Abbr || '',
      specialty: p.Specialty || 'General',
      isAvailable: !p.IsHidden && !p.IsSecondary,
      isHidden: p.IsHidden || false,
      color: p.ProvColor,
      hasSchedules: false,
      scheduleCount: 0,
      schedules: []
    }));

    // Format operatories  
    const operatories: Operatory[] = (Array.isArray(operatoriesData) ? operatoriesData : []).map((o: any) => ({
      opNum: o.OperatoryNum,
      name: o.OpName || `Op ${o.OperatoryNum}`,
      abbrev: o.Abbrev || `Op${o.OperatoryNum}`,
      isHygiene: o.IsHygiene === 1 || o.IsHygiene === true,
      isAvailable: !(o.IsHidden === 1 || o.IsHidden === true),
      isHidden: o.IsHidden === 1 || o.IsHidden === true,
      provNum: o.ProvDentist || o.ProvHygienist,
      clinicNum: o.ClinicNum,
      hasSchedules: false,
      scheduleCount: 0
    }));

    // Format occupied slots
    const occupiedSlots: OccupiedSlot[] = (Array.isArray(appointmentsData) ? appointmentsData : []).map((apt: any) => ({
      aptNum: apt.AptNum,
      aptDateTime: apt.AptDateTime,
      patNum: apt.PatNum,
      provNum: apt.ProvNum,
      opNum: apt.Op,
      duration: calculateDuration(apt.Pattern) || config.defaults.appointmentLength,
      aptStatus: apt.AptStatus,
      note: apt.Note
    }));

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.dataFreshness.officeContextTTL);
    
    // Fetch schedule configuration for providers and operatories
    const scheduleStartTime = Date.now();
    
    try {
      // Fetch schedules for all providers (check today and next 7 days)
      // Use a wider date range to ensure we catch schedules even if they're a few days away
      const scheduleStartDate = new Date(today);
      scheduleStartDate.setDate(scheduleStartDate.getDate() - 1); // Start 1 day before today
      const scheduleStartDateStr = formatDate(scheduleStartDate);
      
      const scheduleEndDate = new Date(today);
      scheduleEndDate.setDate(scheduleEndDate.getDate() + 14); // Check next 14 days
      const scheduleEndDateStr = formatDate(scheduleEndDate);
      
      // Fetch schedules for each provider in parallel (limit to first 10 to avoid too many calls)
      const providersToCheck = providers.filter(p => p.isAvailable && !p.isHidden).slice(0, 10);
      // If no providers pass the filter, check all providers anyway (maybe filter is too strict)
      const providersToCheckFinal = providersToCheck.length > 0 ? providersToCheck : providers.slice(0, 10);
      
      const schedulePromises = providersToCheckFinal.map(async (provider) => {
        try {
          const requestParams = {
            dateStart: scheduleStartDateStr,
            dateEnd: scheduleEndDateStr,
            ProvNum: provider.provNum,
            SchedType: 'Provider'
          };
          
          const scheduleRes = await fetch('/api/opendental', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              functionName: 'GetMultipleSchedules',
              parameters: requestParams
            })
          });
          
          if (!scheduleRes.ok) {
            await scheduleRes.json().catch(() => ({}));
            return { provNum: provider.provNum, schedules: [] };
          }
          
          const scheduleData = await scheduleRes.json();
          
          const schedules: ProviderSchedule[] = Array.isArray(scheduleData) ? scheduleData.map((s: any) => ({
            scheduleNum: s.ScheduleNum,
            schedDate: s.SchedDate,
            startTime: s.StartTime,
            stopTime: s.StopTime,
            schedType: s.SchedType,
            provNum: s.ProvNum,
            operatories: s.operatories,
            note: s.Note
          })) : [];
          
          return { provNum: provider.provNum, schedules };
        } catch (error) {
          return { provNum: provider.provNum, schedules: [] };
        }
      });
      
      const scheduleResults = await Promise.all(schedulePromises);
      
      // Update providers with schedule info
      scheduleResults.forEach(({ provNum, schedules }) => {
        const provider = providers.find(p => p.provNum === provNum);
        if (provider) {
          provider.schedules = schedules;
          provider.scheduleCount = schedules.length;
          provider.hasSchedules = schedules.length > 0;
        }
      });
      
      // Check operatory schedules via GetScheduleOps
      const operatoryPromises = operatories.filter(o => o.isAvailable && !o.isHidden).slice(0, 10).map(async (operatory) => {
        try {
          const scheduleOpsRes = await fetch('/api/opendental', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              functionName: 'GetScheduleOps',
              parameters: {
                OperatoryNum: operatory.opNum
              }
            })
          });
          
          const scheduleOpsData = await scheduleOpsRes.json();
          const scheduleOps = Array.isArray(scheduleOpsData) ? scheduleOpsData : [];
          
          return { opNum: operatory.opNum, scheduleCount: scheduleOps.length };
        } catch (error) {
          return { opNum: operatory.opNum, scheduleCount: 0 };
        }
      });
      
      const operatoryScheduleResults = await Promise.all(operatoryPromises);
      
      // Update operatories with schedule info
      operatoryScheduleResults.forEach(({ opNum, scheduleCount }) => {
        const operatory = operatories.find(o => o.opNum === opNum);
        if (operatory) {
          operatory.scheduleCount = scheduleCount;
          operatory.hasSchedules = scheduleCount > 0;
        }
      });
      
      // Calculate schedule configuration summary
      const providersWithSchedules = providers.filter(p => p.hasSchedules).length;
      const operatoriesWithSchedules = operatories.filter(o => o.hasSchedules).length;
      const totalSchedules = providers.reduce((sum, p) => sum + (p.scheduleCount || 0), 0);
      const defaultProvider = providers.find(p => p.provNum === config.defaults.provNum);
      const defaultOperatory = operatories.find(o => o.opNum === config.defaults.opNum);
      
      const scheduleConfig = {
        totalSchedules,
        providersWithSchedules,
        operatoriesWithSchedules,
        defaultProviderHasSchedule: defaultProvider?.hasSchedules || false,
        defaultOperatoryHasSchedule: defaultOperatory?.hasSchedules || false
      };
      
      const fetchTime = Date.now() - startTime;

      return {
        providers,
        operatories,
        occupiedSlots,
        officeHours: config.availability.officeHours,
        defaults: config.defaults,
        fetchedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        scheduleConfig
      };
    } catch (scheduleError) {
      // Return context without schedule data if schedule fetch fails

      return {
        providers,
        operatories,
        occupiedSlots,
        officeHours: config.availability.officeHours,
        defaults: config.defaults,
        fetchedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      };
    }

  } catch (error) {
    // Return minimal fallback context
    const now = new Date();
    return {
      providers: [{ 
        provNum: 1, 
        name: 'Default Provider', 
        firstName: 'Default',
        lastName: 'Provider',
        abbr: 'DP',
        specialty: 'General', 
        isAvailable: true,
        isHidden: false
      }],
      operatories: [{ 
        opNum: 1, 
        name: 'Operatory 1', 
        abbrev: 'Op1', 
        isHygiene: false, 
        isAvailable: true,
        isHidden: false
      }],
      occupiedSlots: [],
      officeHours: config.availability.officeHours,
      defaults: config.defaults,
      fetchedAt: now.toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString()  // 1 minute
    };
  }
}

/**
 * Check if office context has expired
 */
export function isContextExpired(context: OfficeContext): boolean {
  return new Date() > new Date(context.expiresAt);
}

/**
 * Detect scheduling conflicts
 * Checks patient, operatory, and provider conflicts
 * 
 * @param context - Office context with occupied slots
 * @param requestedDateTime - Requested appointment datetime (ISO format)
 * @param requestedProvNum - Requested provider number
 * @param requestedOpNum - Requested operatory number
 * @param patNum - Patient number (optional, for patient conflict check)
 * @returns Object with hasConflict flag and array of conflict messages
 */
export function detectConflicts(
  context: OfficeContext,
  requestedDateTime: string,
  requestedProvNum: number,
  requestedOpNum: number,
  patNum?: number
): {
  hasConflict: boolean;
  conflicts: string[];
  suggestions: string[];
} {
  const config = openDentalConfig.conflictDetection;
  if (!config.enabled) {
    return { hasConflict: false, conflicts: [], suggestions: [] };
  }

  const conflicts: string[] = [];
  const suggestions: string[] = [];
  const requestedTime = new Date(requestedDateTime);
  const requestedEndTime = new Date(requestedTime.getTime() + config.conflictWindowMinutes * 60000);


  for (const slot of context.occupiedSlots) {
    const slotTime = new Date(slot.aptDateTime);
    const slotEndTime = new Date(slotTime.getTime() + slot.duration * 60000);

    // Check if times overlap
    const isOverlap = requestedTime < slotEndTime && requestedEndTime > slotTime;
    
    if (isOverlap) {
      // Patient conflict
      if (config.checkPatientConflicts && patNum && slot.patNum === patNum) {
        conflicts.push(`Patient already has an appointment at ${formatDateTime(slot.aptDateTime)}`);
        suggestions.push(`Reschedule existing appointment or choose a different time`);
      }
      
      // Operatory conflict
      if (config.checkOperatoryConflicts && slot.opNum === requestedOpNum) {
        conflicts.push(`Operatory ${requestedOpNum} is occupied at ${formatDateTime(slot.aptDateTime)}`);
        
        // Suggest alternative operatory
        const availableOp = context.operatories.find(op => 
          op.isAvailable && op.opNum !== requestedOpNum &&
          !context.occupiedSlots.some(s => 
            s.opNum === op.opNum && 
            new Date(s.aptDateTime) < requestedEndTime && 
            new Date(s.aptDateTime).getTime() + s.duration * 60000 > requestedTime.getTime()
          )
        );
        
        if (availableOp) {
          suggestions.push(`Operatory ${availableOp.opNum} (${availableOp.name}) is available at this time`);
        }
      }
      
      // Provider conflict
      if (config.checkProviderConflicts && slot.provNum === requestedProvNum) {
        conflicts.push(`Provider ${requestedProvNum} is busy at ${formatDateTime(slot.aptDateTime)}`);
        
        // Suggest alternative provider
        const availableProvider = context.providers.find(p => 
          p.isAvailable && p.provNum !== requestedProvNum &&
          !context.occupiedSlots.some(s => 
            s.provNum === p.provNum && 
            new Date(s.aptDateTime) < requestedEndTime && 
            new Date(s.aptDateTime).getTime() + s.duration * 60000 > requestedTime.getTime()
          )
        );
        
        if (availableProvider) {
          suggestions.push(`${availableProvider.name} is available at this time`);
        }
      }
    }
  }

  const hasConflict = !config.allowDoubleBooking && conflicts.length > 0;
  
  if (hasConflict) {
  } else {
  }

  return {
    hasConflict,
    conflicts,
    suggestions
  };
}

/**
 * Calculate appointment duration from pattern string
 * Pattern uses 'X' for 5-minute blocks (OpenDental standard)
 * 
 * @param pattern - Pattern string (e.g., "XXXXX" = 25 minutes)
 * @returns Duration in minutes
 */
function calculateDuration(pattern?: string): number {
  if (!pattern) return openDentalConfig.defaults.appointmentLength;
  const blocks = pattern.split('').filter(c => c === 'X').length;
  return blocks * 5;  // Each X = 5 minutes
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format datetime for display (e.g., "Oct 30, 2:00 PM")
 */
function formatDateTime(datetime: string): string {
  try {
    const date = new Date(datetime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return datetime;
  }
}

/**
 * Format provider name (handles various formats)
 */
function formatProviderName(provider: any): string {
  if (provider.FName && provider.LName) {
    return `${provider.FName} ${provider.LName}`.trim();
  }
  if (provider.LName) {
    return provider.LName;
  }
  if (provider.Abbr) {
    return provider.Abbr;
  }
  return `Provider ${provider.ProvNum}`;
}




