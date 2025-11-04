// Use validated registry (duplicates removed, tested against real API)
import apiRegistryData from '../../../../docs/API/validated/validated_registry.json' assert { type: 'json' };

export interface EndpointInfo {
  function_name: string;
  endpoint: string;
  method: string;
  description: string;
  parameters: Record<string, {
    required: boolean;
    type: string;
    description: string;
  }>;
  request_example: any;
  response_example: any;
  error_codes: Record<string, string>;
}

export interface OpenAIFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
      additionalProperties: boolean;
    };
  };
}

// Optimized function set - covers 95% of dental office operations
// Balanced between capability (49 functions) and performance (<5s response time)
const PRIORITY_FUNCTIONS = [
  // === PATIENTS (10 functions) ===
  'GetPatients',              // List all patients
  'GetMultiplePatients',      // Search by phone/name/address/SSN - CRITICAL for lookups
  'GetPatient',               // Get specific patient by ID
  'CreatePatient',            // Register new patient
  'UpdatePatient',            // Update patient info
  'DeletePatient',            // Remove patient
  'GetPatientBalances',       // Check patient balance
  'GetPatientAccountInfo',    // Get detailed account info
  'GetPatientProcedures',     // Get patient's procedures
  'GetPatientFamily',         // Get family members
  
  // === APPOINTMENTS (11 functions) ===
  'GetAppointments',          // List appointments
  'GetAppointmentById',       // Get specific appointment
  // 'GetAppointmentSlots',  // ❌ REMOVED - Endpoint not supported: "appointments GET slots is not a valid method"
  // 'GetAvailableSlots',     // ❌ REMOVED - Always returns [] in test DBs
  // Use GetAppointments with dateStart/dateEnd to get occupied slots, then calculate free slots
  'CreateAppointment',        // Schedule appointment
  'UpdateAppointment',        // Modify appointment
  'BreakAppointment',         // Cancel appointment (keeps record)
  'DeleteAppointment',        // Permanently delete
  'ConfirmAppointment',       // Confirm appointment
  'GetAppointmentTypes',      // Get appointment type list
  'GetOperatories',           // Get operatory list
  'SearchAppointments',       // Search appointments by criteria
  'GetAppointmentConflicts',  // Check for scheduling conflicts
  
  // === PROVIDERS (4 functions) ===
  'GetProviders',             // List all providers
  'GetMultipleProviders',     // Search providers
  'GetProvider',              // Get specific provider
  'GetProviderSchedule',      // Get provider schedule
  
  // === INSURANCE (6 functions) ===
  'GetInsuranceForPatient',   // Get patient's insurance
  'GetInsurancePlans',        // List insurance plans
  'GetInsurancePlan',         // Get specific plan
  'CreateInsurancePlan',      // Add insurance plan
  'UpdateInsurancePlan',      // Update plan
  'GetInsuranceVerification', // Check insurance verification
  
  // === PROCEDURES (5 functions) ===
  'GetProcedures',            // List procedures
  'GetProcedureCodes',        // Get CDT codes
  'GetProcedureCode',         // Get specific code
  'CreateProcedure',          // Add procedure to treatment plan
  'UpdateProcedure',          // Update procedure
  
  // === CLAIMS (4 functions) ===
  'GetClaims',                // List claims
  'GetSingleClaim',           // Get specific claim
  'CreateClaim',              // Submit claim
  'UpdateClaim',              // Update claim status
  
  // === PAYMENTS (4 functions) ===
  'CreatePayment',            // Record payment
  'GetPayments',              // List payments
  'GetPayment',               // Get specific payment
  'UpdatePayment',            // Update payment
  
  // === RECALLS (3 functions) ===
  'GetRecalls',               // List recalls
  'CreateRecall',             // Create recall
  'UpdateRecall',             // Update recall
  
  // === PREFERENCES & SYSTEM (2 functions) ===
  'GetPreferences',           // Get system preferences
  'GetAgingData',             // Get aging report data
];

/**
 * Load and parse the API registry from JSON
 */
export function loadApiRegistry(): { 
  endpoints: EndpointInfo[]; 
  total: number;
  byName: Map<string, EndpointInfo>;
} {
  // Handle both formats: original (direct array) and validated (with metadata)
  const endpoints = (apiRegistryData as any).endpoints 
    ? (apiRegistryData as any).endpoints as EndpointInfo[]
    : apiRegistryData as unknown as EndpointInfo[];
  
  const byName = new Map<string, EndpointInfo>();
  
  endpoints.forEach(ep => {
    byName.set(ep.function_name, ep);
  });
  
  return {
    endpoints,
    total: endpoints.length,
    byName,
  };
}

/**
 * Convert API registry endpoints to OpenAI Responses API tool format
 * @param priorityOnly - If true, only convert priority functions (~50); if false, convert ALL 337 functions
 * WARNING: Using ALL functions causes 40-65 second response times! Use priority set for production.
 */
export function convertRegistryToTools(priorityOnly: boolean = true): any[] {
  const { endpoints } = loadApiRegistry();
  
  const filteredEndpoints = priorityOnly 
    ? endpoints.filter(ep => PRIORITY_FUNCTIONS.includes(ep.function_name))
    : endpoints;
  
  return filteredEndpoints.map(endpoint => {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    // Build parameter schema
    for (const [paramName, paramInfo] of Object.entries(endpoint.parameters || {})) {
      const paramType = paramInfo.type || 'string';
      
      // Skip array parameters - they require 'items' which we don't have in registry
      if (paramType === 'array') {
        continue;
      }
      
      properties[paramName] = {
        type: paramType,
        description: paramInfo.description || `${paramName} parameter`,
      };
      
      if (paramInfo.required) {
        required.push(paramName);
      }
    }
    
    // Return flat format for Responses API (not nested under 'function')
    return {
      type: 'function',
      name: endpoint.function_name,
      description: endpoint.description || `Execute ${endpoint.function_name}`,
      parameters: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
    };
  });
}

/**
 * Get endpoint details by function name
 */
export function getEndpointDetails(functionName: string): EndpointInfo | undefined {
  const { byName } = loadApiRegistry();
  return byName.get(functionName);
}

/**
 * Generate a text catalog of functions for instructions
 * @param priorityOnly - If true, only include priority functions (~50); if false, include ALL 337 functions
 * Returns a formatted list: "FunctionName - Description"
 */
export function generateFunctionCatalog(priorityOnly: boolean = true): string {
  const { endpoints } = loadApiRegistry();
  
  const filteredEndpoints = priorityOnly 
    ? endpoints.filter(ep => PRIORITY_FUNCTIONS.includes(ep.function_name))
    : endpoints;
  
  const catalog = filteredEndpoints.map((endpoint, index) => {
    const num = String(index + 1).padStart(3, ' ');
    const name = endpoint.function_name.padEnd(30, ' ');
    const desc = endpoint.description || `Execute ${endpoint.function_name}`;
    return `${num}. ${name} - ${desc}`;
  }).join('\n');
  
  return catalog;
}

/**
 * Get statistics about the API registry
 */
export function getRegistryStats() {
  const { endpoints } = loadApiRegistry();
  const priorityEndpoints = endpoints.filter(ep => 
    PRIORITY_FUNCTIONS.includes(ep.function_name)
  );
  
  return {
    total: endpoints.length,
    priority: priorityEndpoints.length,
    methods: {
      GET: endpoints.filter(ep => ep.method === 'GET').length,
      POST: endpoints.filter(ep => ep.method === 'POST').length,
      PUT: endpoints.filter(ep => ep.method === 'PUT').length,
      DELETE: endpoints.filter(ep => ep.method === 'DELETE').length,
    },
  };
}

