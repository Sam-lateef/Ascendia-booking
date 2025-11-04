/**
 * Utility functions for OpenDental API integration
 */

/**
 * Replace path parameters in endpoint URLs
 * Example: /patients/{id} with {id: 123} -> /patients/123
 */
export function replacePathParams(
  endpoint: string,
  parameters: Record<string, any>
): string {
  let url = endpoint;
  
  // Find all {param} patterns and replace with actual values
  const paramPattern = /\{([^}]+)\}/g;
  url = url.replace(paramPattern, (match, paramName) => {
    const value = parameters[paramName];
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return match; // Keep placeholder if no value
  });
  
  return url;
}

/**
 * Build query parameters for GET requests
 */
export function buildQueryParams(
  parameters: Record<string, any>,
  pathParams: string[] = []
): string {
  const queryParams: string[] = [];
  
  for (const [key, value] of Object.entries(parameters)) {
    // Skip path parameters (already in URL), undefined values, null values, and empty strings
    if (pathParams.includes(key) || value === undefined || value === null || value === '') {
      continue;
    }
    
    queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  
  return queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
}

/**
 * Extract path parameter names from endpoint
 * Example: /patients/{id}/appointments/{aptNum} -> ['id', 'aptNum']
 */
export function extractPathParamNames(endpoint: string): string[] {
  const paramPattern = /\{([^}]+)\}/g;
  const params: string[] = [];
  let match;
  
  while ((match = paramPattern.exec(endpoint)) !== null) {
    params.push(match[1]);
  }
  
  return params;
}

/**
 * Build request body for POST/PUT requests
 * Filters out path parameters and empty values
 */
export function buildRequestBody(
  parameters: Record<string, any>,
  pathParams: string[] = []
): Record<string, any> {
  const body: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(parameters)) {
    // Skip path parameters, undefined values, null values, and empty strings
    if (!pathParams.includes(key) && value !== undefined && value !== null && value !== '') {
      body[key] = value;
    }
  }
  
  return body;
}

/**
 * Format error response
 */
export function formatErrorResponse(error: any, context?: string): {
  error: string;
  details?: any;
  context?: string;
} {
  return {
    error: error.message || 'An error occurred',
    details: error.response?.data || error.details,
    context,
  };
}

/**
 * Check if running in mock mode
 */
export function isMockMode(): boolean {
  return process.env.OPENDENTAL_MOCK_MODE === 'true';
}

/**
 * Get OpenDental API base URL
 */
export function getOpenDentalBaseUrl(): string {
  return process.env.OPENDENTAL_API_BASE_URL || 'https://api.opendental.com/api/v1';
}

/**
 * Get OpenDental API authentication header
 */
export function getOpenDentalAuthHeader(): Record<string, string> {
  const apiKey = process.env.OPENDENTAL_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENDENTAL_API_KEY environment variable is not set');
  }
  
  // OpenDental supports two auth formats:
  // 1. ODFHIR format: "ODFHIR {DeveloperKey}/{CustomerKey}"
  // 2. Bearer token: "Bearer <token>"
  
  // If the key already includes the auth type (ODFHIR or Bearer), use it as-is
  const authValue = apiKey.startsWith('ODFHIR ') || apiKey.startsWith('Bearer ') 
    ? apiKey 
    : `Bearer ${apiKey}`;
  
  return {
    'Authorization': authValue,
    'Content-Type': 'application/json',
  };
}

/**
 * Retry logic for API calls
 */
export async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError;
}

/**
 * Parse OpenDental date format (yyyy-MM-dd)
 */
export function parseOpenDentalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  
  return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
}

/**
 * Format date for OpenDental API (yyyy-MM-dd)
 */
export function formatOpenDentalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format datetime for OpenDental API (yyyy-MM-dd HH:mm:ss)
 */
export function formatOpenDentalDateTime(date: Date): string {
  const datePart = formatOpenDentalDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}:${seconds}`;
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  // OpenDental typically expects 10 digits
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
}

/**
 * Format phone number for OpenDental (xxx) xxx-xxxx
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 10) return phone;
  
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

/**
 * Clean phone number for API calls (remove all non-digit characters)
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Map registry parameter names to OpenDental's actual API parameter names
 * The registry has snake_case names, but OpenDental expects specific PascalCase/abbreviated names
 */
export function mapParametersToOpenDental(
  functionName: string,
  parameters: Record<string, any>
): Record<string, any> {
  // Define mappings for each function
  const parameterMappings: Record<string, Record<string, string>> = {
    'GetAppointments': {
      'DateStart': 'dateStart',
      'dateStart': 'dateStart',
      'DateEnd': 'dateEnd',
      'dateEnd': 'dateEnd',
      'PatNum': 'PatNum',
      'AptNum': 'AptNum',
      'ProvNum': 'ProvNum',
      'Op': 'Op',
      'status': 'status',
    },
    'GetMultiplePatients': {
      'last_name': 'LName',
      'first_name': 'FName',
      'phone': 'Phone',
      'address': 'Address',
      'city': 'City',
      'state': 'State',
      'ssn': 'SSN',
      'chart_number': 'ChartNumber',
      'hide_inactive': 'hideInactive',
      'guar_only': 'guarOnly',
      'show_archived': 'showArchived',
    },
    'CreatePatient': {
      'first_name': 'FName',
      'last_name': 'LName',
      'middle_initial': 'MiddleI',
      'date_of_birth': 'Birthdate',
      'preferred': 'Preferred',
      'patient_status': 'PatStatus',
      'gender': 'Gender',
      'position': 'Position',
      'ssn': 'SSN',
      'address': 'Address',
      'address2': 'Address2',
      'city': 'City',
      'state': 'State',
      'zip': 'Zip',
      'home_phone': 'HmPhone',
      'work_phone': 'WkPhone',
      'wireless_phone': 'WirelessPhone',
      'phone': 'WirelessPhone', // Map generic 'phone' to WirelessPhone
      'mobile': 'WirelessPhone', // Map 'mobile' to WirelessPhone
      'cell': 'WirelessPhone', // Map 'cell' to WirelessPhone
      'guarantor': 'Guarantor',
      'email': 'Email',
      'primary_provider': 'PriProv',
      'secondary_provider': 'SecProv',
      'fee_schedule': 'FeeSched',
      'billing_type': 'BillingType',
      'chart_number': 'ChartNumber',
      'medicaid_id': 'MedicaidID',
      'employer_num': 'EmployerNum',
      'date_first_visit': 'DateFirstVisit',
      'clinic_num': 'ClinicNum',
      'premed': 'Premed',
      'ward': 'Ward',
      'prefer_confirm_method': 'PreferConfirmMethod',
      'prefer_contact_method': 'PreferContactMethod',
      'prefer_recall_method': 'PreferRecallMethod',
      'language': 'Language',
      'admit_date': 'AdmitDate',
      'super_family': 'SuperFamily',
      'txt_msg_ok': 'TxtMsgOk',
    },
    'UpdatePatient': {
      'first_name': 'FName',
      'last_name': 'LName',
      'middle_initial': 'MiddleI',
      'date_of_birth': 'Birthdate',
      'preferred': 'Preferred',
      'patient_status': 'PatStatus',
      'gender': 'Gender',
      'home_phone': 'HmPhone',
      'work_phone': 'WkPhone',
      'wireless_phone': 'WirelessPhone',
      'email': 'Email',
      'address': 'Address',
      'address2': 'Address2',
      'city': 'City',
      'state': 'State',
      'zip': 'Zip',
    },
    'CreateAppointment': {
      'PatientId': 'PatNum',
      'patient_id': 'PatNum',
      'Date': 'AptDateTime',
      'date': 'AptDateTime',
      'appointment_date': 'AptDateTime',
      'Notes': 'Note',
      'notes': 'Note',
      'Provider': 'ProvNum',
      'provider': 'ProvNum',
      'provider_id': 'ProvNum',
      'Operatory': 'Op',
      'operatory': 'Op',
      'operatory_id': 'Op',
      'Status': 'AptStatus',
      'status': 'AptStatus',
    },
  };

  const mapping = parameterMappings[functionName];
  if (!mapping) {
    // No mapping defined, return parameters as-is
    return parameters;
  }

  const mappedParams: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(parameters)) {
    const mappedKey = mapping[key] || key; // Use mapping if exists, otherwise keep original
    let mappedValue = value;
    
    // Normalize GetAppointments and GetAvailableSlots date values to yyyy-MM-dd (strip time if present)
    if (
      (functionName === 'GetAppointments' || functionName === 'GetAvailableSlots') &&
      (mappedKey === 'dateStart' || mappedKey === 'dateEnd') &&
      typeof mappedValue === 'string'
    ) {
      // Strip time from ISO timestamp or datetime format
      // "2025-11-10T09:00:00" -> "2025-11-10"
      // "2025-11-10 09:00:00" -> "2025-11-10"
      const match = mappedValue.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) {
        mappedValue = match[0];
      }
    }
    
    // Normalize patient name search parameters for case-insensitive search
    // Convert to proper case (first letter uppercase, rest lowercase) for better matching
    if (
      functionName === 'GetMultiplePatients' &&
      (mappedKey === 'FName' || mappedKey === 'LName') &&
      typeof mappedValue === 'string'
    ) {
      // Normalize to title case: "sam" -> "Sam", "SAM" -> "Sam", "sAm" -> "Sam"
      mappedValue = mappedValue.charAt(0).toUpperCase() + mappedValue.slice(1).toLowerCase();
    }
    
    mappedParams[mappedKey] = mappedValue;
  }

  return mappedParams;
}

