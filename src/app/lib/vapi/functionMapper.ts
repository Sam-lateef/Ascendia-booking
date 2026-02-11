/**
 * Vapi Function Mapper
 * 
 * Maps Vapi function names and parameters to our internal booking API functions.
 * Handles parameter transformation and validation.
 */

export interface VapiFunctionCall {
  id: string;
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface MappedFunction {
  ourFunctionName: string;
  parameters: Record<string, any>;
  originalVapiCall: VapiFunctionCall;
}

/**
 * Function mapping configuration
 * 
 * SUPPORTS TWO MODES:
 * 1. EXACT MATCH: Vapi function names match our API (e.g., GetAvailableSlots)
 * 2. SIMPLIFIED: Old simplified names (e.g., checkAvailability) - for backward compatibility
 */
const FUNCTION_MAP: Record<string, {
  ourFunction: string;
  transformParams: (vapiParams: any) => Record<string, any>;
  description: string;
}> = {
  // EXACT MATCH FUNCTIONS (preferred - no translation needed!)
  GetAvailableSlots: {
    ourFunction: 'GetAvailableSlots',
    description: 'Get available appointment slots',
    transformParams: (vapi) => vapi // Pass through as-is!
  },

  GetMultiplePatients: {
    ourFunction: 'GetMultiplePatients',
    description: 'Search for patients',
    transformParams: (vapi) => vapi // Pass through as-is!
  },

  CreatePatient: {
    ourFunction: 'CreatePatient',
    description: 'Create new patient',
    transformParams: (vapi) => vapi // Pass through as-is!
  },

  CreateAppointment: {
    ourFunction: 'CreateAppointment',
    description: 'Book an appointment',
    transformParams: (vapi) => vapi // Pass through as-is!
  },

  BreakAppointment: {
    ourFunction: 'BreakAppointment',
    description: 'Cancel an appointment',
    transformParams: (vapi) => vapi // Pass through as-is!
  },

  // SIMPLIFIED FUNCTIONS (backward compatibility - will be deprecated)
  checkAvailability: {
    ourFunction: 'GetAvailableSlots',
    description: 'Check available appointment slots',
    transformParams: (vapi) => ({
      dateStart: vapi.date,
      dateEnd: vapi.date,
      ProvNum: vapi.doctorId || undefined,
      OpNum: undefined,
      lengthMinutes: 30
    })
  },

  findPatient: {
    ourFunction: 'GetMultiplePatients',
    description: 'Search for patient by phone number',
    transformParams: (vapi) => ({
      Phone: normalizePhone(vapi.phone)
    })
  },

  createPatient: {
    ourFunction: 'CreatePatient',
    description: 'Create new patient profile',
    transformParams: (vapi) => ({
      FName: vapi.firstName,
      LName: vapi.lastName,
      WirelessPhone: normalizePhone(vapi.phone),
      Birthdate: vapi.birthdate,
      Email: vapi.email || undefined
    })
  },

  bookAppointment: {
    ourFunction: 'CreateAppointment',
    description: 'Book an appointment',
    transformParams: (vapi) => {
      const dateTime = `${vapi.date} ${vapi.time}`;
      return {
        PatNum: parseInt(vapi.patientId),
        AptDateTime: dateTime,
        ProvNum: vapi.doctorId ? parseInt(vapi.doctorId) : undefined,
        Op: undefined,
        Note: vapi.appointmentType || 'Booked via Vapi'
      };
    }
  },

  cancelAppointment: {
    ourFunction: 'BreakAppointment',
    description: 'Cancel an appointment',
    transformParams: (vapi) => ({
      AptNum: parseInt(vapi.appointmentId),
      sendToUnscheduledList: false
    })
  }
};

/**
 * Map a Vapi function call to our internal function format
 * 
 * @param vapiCall - The function call from Vapi webhook
 * @returns Mapped function with transformed parameters
 * @throws Error if function name is not recognized
 */
export function mapVapiFunction(vapiCall: VapiFunctionCall): MappedFunction {
  const functionName = vapiCall.function.name;
  const mapping = FUNCTION_MAP[functionName];

  if (!mapping) {
    throw new Error(
      `Unknown Vapi function: ${functionName}. ` +
      `Supported functions: ${Object.keys(FUNCTION_MAP).join(', ')}`
    );
  }

  // Transform parameters
  const transformedParams = mapping.transformParams(vapiCall.function.arguments);

  console.log(`[Vapi Mapper] ${functionName} → ${mapping.ourFunction}`);
  console.log(`[Vapi Mapper] Vapi params:`, vapiCall.function.arguments);
  console.log(`[Vapi Mapper] Transformed params:`, transformedParams);

  return {
    ourFunctionName: mapping.ourFunction,
    parameters: transformedParams,
    originalVapiCall: vapiCall
  };
}

/**
 * Normalize phone number to 10 digits (remove +1 prefix if present)
 * Our CreatePatient expects 10 digits, not E.164 format
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 1 and has 11 digits, remove the 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  
  return digits;
}

/**
 * Get list of supported Vapi function names
 */
export function getSupportedFunctions(): string[] {
  return Object.keys(FUNCTION_MAP);
}

/**
 * Check if a function uses exact API naming (preferred)
 */
export function isExactMatch(functionName: string): boolean {
  const exactFunctions = [
    'GetAvailableSlots',
    'GetMultiplePatients', 
    'CreatePatient',
    'CreateAppointment',
    'BreakAppointment'
  ];
  return exactFunctions.includes(functionName);
}

/**
 * Validate that a Vapi function call has required parameters
 * 
 * @param vapiCall - The function call to validate
 * @returns Validation result with error message if invalid
 */
export function validateVapiCall(vapiCall: VapiFunctionCall): {
  valid: boolean;
  error?: string;
} {
  const functionName = vapiCall.function.name;
  
  if (!FUNCTION_MAP[functionName]) {
    return {
      valid: false,
      error: `Unknown function: ${functionName}`
    };
  }

  const args = vapiCall.function.arguments;

  // Basic validation - check for empty arguments
  if (!args || Object.keys(args).length === 0) {
    return {
      valid: false,
      error: `Function ${functionName} called with no parameters`
    };
  }

  // Function-specific validation
  switch (functionName) {
    case 'checkAvailability':
      if (!args.date) {
        return { valid: false, error: 'checkAvailability requires date parameter' };
      }
      // Validate date format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
        return { valid: false, error: 'date must be in YYYY-MM-DD format' };
      }
      break;

    case 'findPatient':
      if (!args.phone) {
        return { valid: false, error: 'findPatient requires phone parameter' };
      }
      break;

    case 'createPatient':
      const required = ['firstName', 'lastName', 'phone', 'birthdate'];
      const missing = required.filter(field => !args[field]);
      if (missing.length > 0) {
        return {
          valid: false,
          error: `createPatient missing required fields: ${missing.join(', ')}`
        };
      }
      // Validate birthdate format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.birthdate)) {
        return { valid: false, error: 'birthdate must be in YYYY-MM-DD format' };
      }
      break;

    case 'bookAppointment':
      const requiredBook = ['patientId', 'date', 'time'];
      const missingBook = requiredBook.filter(field => !args[field]);
      if (missingBook.length > 0) {
        return {
          valid: false,
          error: `bookAppointment missing required fields: ${missingBook.join(', ')}`
        };
      }
      break;

    case 'cancelAppointment':
      if (!args.appointmentId) {
        return { valid: false, error: 'cancelAppointment requires appointmentId' };
      }
      break;
  }

  return { valid: true };
}
