/**
 * OpenDental Configuration
 * 
 * Centralized configuration for OpenDental integration
 * including defaults, office hours, API settings, and conflict detection rules
 */

export interface OpenDentalConfig {
  defaults: {
    provNum: number;
    opNum: number;
    clinicNum: null;
    appointmentLength: number;
    bufferBetweenAppointments: number;
  };
  
  dataFreshness: {
    officeContextTTL: number;  // milliseconds
    refetchIfOlderThan: boolean;
  };
  
  availability: {
    lookAheadDays: number;
    suggestMultipleSlots: number;
    preferredTimes: string[];
    officeHours: {
      monday: { open: string; close: string; closed?: boolean };
      tuesday: { open: string; close: string; closed?: boolean };
      wednesday: { open: string; close: string; closed?: boolean };
      thursday: { open: string; close: string; closed?: boolean };
      friday: { open: string; close: string; closed?: boolean };
      saturday: { open: string; close: string; closed?: boolean };
      sunday: { open: string; close: string; closed?: boolean };
    };
  };
  
  apiSettings: {
    maxIterations: number;
    retryAttempts: number;
    timeoutMs: number;
  };
  
  conflictDetection: {
    enabled: boolean;
    checkPatientConflicts: boolean;
    checkOperatoryConflicts: boolean;
    checkProviderConflicts: boolean;
    allowDoubleBooking: boolean;
    conflictWindowMinutes: number;
  };
}

/**
 * Main configuration object
 * Edit these values to customize your dental office settings
 */
export const openDentalConfig: OpenDentalConfig = {
  // Default values for required fields
  defaults: {
    provNum: 1,           // Default provider number (first provider)
    opNum: 1,             // Default operatory number (first operatory)
    clinicNum: null,      // NEVER send ClinicNum (causes errors in test DBs)
    appointmentLength: 30,              // Default appointment duration in minutes
    bufferBetweenAppointments: 15       // Buffer time between appointments
  },
  
  // Data caching and freshness settings
  dataFreshness: {
    officeContextTTL: 300000,     // 5 minutes (in milliseconds)
    refetchIfOlderThan: true      // Auto-refetch if context is stale
  },
  
  // Availability and scheduling settings
  availability: {
    lookAheadDays: 7,              // How many days ahead to fetch appointments
    suggestMultipleSlots: 3,       // Number of alternative times to suggest
    preferredTimes: [
      '09:00',   // 9:00 AM
      '10:00',   // 10:00 AM
      '14:00',   // 2:00 PM
      '15:00',   // 3:00 PM
      '16:00'    // 4:00 PM
    ],
    
    // Office hours configuration
    // Edit these to match your actual office hours
    officeHours: {
      monday: {
        open: '08:00',
        close: '17:00'
      },
      tuesday: {
        open: '08:00',
        close: '17:00'
      },
      wednesday: {
        open: '08:00',
        close: '17:00'
      },
      thursday: {
        open: '08:00',
        close: '17:00'
      },
      friday: {
        open: '08:00',
        close: '17:00'
      },
      saturday: {
        open: '09:00',
        close: '13:00'
      },
      sunday: {
        open: '00:00',
        close: '00:00',
        closed: true
      }
    }
  },
  
  // API call settings
  apiSettings: {
    maxIterations: 6,        // Maximum iterations for orchestrator tool calling
    retryAttempts: 2,        // Number of retries on API failure
    timeoutMs: 30000         // 30 second timeout for API calls
  },
  
  // Conflict detection configuration
  conflictDetection: {
    enabled: true,                      // Master switch for conflict detection
    checkPatientConflicts: true,        // Prevent same patient double-booking
    checkOperatoryConflicts: true,      // Prevent operatory double-booking
    checkProviderConflicts: true,       // Prevent provider double-booking
    allowDoubleBooking: false,          // Set to true to allow double-booking
    conflictWindowMinutes: 30           // Check 30-minute window for conflicts
  }
};

/**
 * Get configuration value by path
 * Example: getConfig('defaults.provNum') returns 1
 */
export function getConfig<T = any>(path: string): T {
  const keys = path.split('.');
  let value: any = openDentalConfig;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key as keyof typeof value];
    } else {
      throw new Error(`Configuration path '${path}' not found`);
    }
  }
  
  return value as T;
}

/**
 * Check if office is open on a given day and time
 */
export function isOfficeOpen(day: string, time: string): boolean {
  const dayLower = day.toLowerCase() as keyof typeof openDentalConfig.availability.officeHours;
  const hours = openDentalConfig.availability.officeHours[dayLower];
  
  if (!hours || hours.closed) {
    return false;
  }
  
  const [timeHour, timeMinute] = time.split(':').map(Number);
  const [openHour, openMinute] = hours.open.split(':').map(Number);
  const [closeHour, closeMinute] = hours.close.split(':').map(Number);
  
  const timeInMinutes = timeHour * 60 + timeMinute;
  const openInMinutes = openHour * 60 + openMinute;
  const closeInMinutes = closeHour * 60 + closeMinute;
  
  return timeInMinutes >= openInMinutes && timeInMinutes < closeInMinutes;
}

/**
 * Get office hours for a specific day
 */
export function getOfficeHoursForDay(day: string): { open: string; close: string } | null {
  const dayLower = day.toLowerCase() as keyof typeof openDentalConfig.availability.officeHours;
  const hours = openDentalConfig.availability.officeHours[dayLower];
  
  if (!hours || hours.closed) {
    return null;
  }
  
  return { open: hours.open, close: hours.close };
}

/**
 * Get all open days of the week
 */
export function getOpenDays(): string[] {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.filter(day => {
    const hours = openDentalConfig.availability.officeHours[day as keyof typeof openDentalConfig.availability.officeHours];
    return hours && !hours.closed;
  });
}

export default openDentalConfig;




