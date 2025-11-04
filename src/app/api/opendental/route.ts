import { NextRequest, NextResponse } from 'next/server';
import { 
  getEndpointDetails,
  type EndpointInfo 
} from '@/app/agentConfigs/openDental/apiRegistry';
import {
  replacePathParams,
  buildQueryParams,
  buildRequestBody,
  extractPathParamNames,
  formatErrorResponse,
  isMockMode,
  getOpenDentalBaseUrl,
  getOpenDentalAuthHeader,
  retryRequest,
  mapParametersToOpenDental,
  cleanPhoneNumber,
} from '@/app/lib/opendentalUtils';
// Mock data for testing (inline)
const mockPatientData = [
  {
    patientId: 'PT-001',
    firstName: 'John',
    lastName: 'Smith',
    dateOfBirth: '1985-03-15',
    phone: '555-1234',
  },
];

const mockProviderData = [
  {
    providerId: 'PROV-001',
    firstName: 'Dr.',
    lastName: 'Pearl',
    specialty: 'General Dentist',
  },
];

const mockAppointmentSlots = [
  {
    date: '2025-10-27',
    time: '10:00 AM',
    duration: 60,
    available: true,
  },
];

/**
 * Tier 3: API Worker Route
 * 
 * This route receives function calls from the orchestrator agent,
 * translates them to HTTP requests, and calls the OpenDental API.
 * 
 * Flow:
 * 1. Receive function call from orchestrator
 * 2. Look up endpoint details from registry
 * 3. Build HTTP request (URL, method, headers, body)
 * 4. Execute API call (or return mock data)
 * 5. Return response to orchestrator
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[OpenDental API] Received request:', body);
    
    const { functionName, parameters } = body;

    if (!functionName) {
      console.error('[OpenDental API] Missing functionName');
      return NextResponse.json(
        { error: 'functionName is required' },
        { status: 400 }
      );
    }

    // Block GetAvailableSlots - not supported, use GetAppointments instead
    if (functionName === 'GetAvailableSlots' || functionName === 'GetAppointmentSlots') {
      console.error('[OpenDental API] GetAvailableSlots/GetAppointmentSlots is not supported. Use GetAppointments instead.');
      return NextResponse.json(
        { 
          error: true,
          message: 'GetAvailableSlots and GetAppointmentSlots are not supported. Use GetAppointments with dateStart and dateEnd parameters instead.',
          alternative: 'Use GetAppointments(DateStart="YYYY-MM-DD", DateEnd="YYYY-MM-DD") to check availability'
        },
        { status: 400 }
      );
    }

    // Look up endpoint details from registry
    let endpoint = getEndpointDetails(functionName);

    // Fallback: manual support for functions missing from registry
    if (!endpoint) {
      if (functionName === 'GetOperatories') {
        endpoint = {
          function_name: 'GetOperatories',
          endpoint: '/operatories',
          method: 'GET',
          description: 'List operatories',
          parameters: {},
          request_example: {},
          response_example: {},
          error_codes: {},
        } as unknown as EndpointInfo;
      } else if (functionName === 'GetProviders') {
        // Map GetProviders → GetMultipleProviders (same endpoint, same behavior)
        endpoint = {
          function_name: 'GetProviders',
          endpoint: '/providers',
          method: 'GET',
          description: 'Get list of all providers',
          parameters: {
            ClinicNum: {
              required: false,
              type: 'number',
              description: 'Filter by clinic number'
            },
            DateTStamp: {
              required: false,
              type: 'string',
              description: 'Get providers altered after this date/time (yyyy-MM-dd HH:mm:ss)'
            }
          },
          request_example: {},
          response_example: {},
          error_codes: {},
        } as unknown as EndpointInfo;
      } else {
        console.error(`[OpenDental API] Unknown function: ${functionName}`);
        return NextResponse.json(
          { error: `Unknown function: ${functionName}` },
          { status: 404 }
        );
      }
    }
    
    console.log(`[OpenDental API] Found endpoint for ${functionName}:`, {
      method: endpoint.method,
      endpoint: endpoint.endpoint
    });

    // Check if in mock mode
    if (isMockMode()) {
      console.log(`[OpenDental Mock] ${functionName}`, parameters);
      const mockResponse = getMockResponse(functionName, parameters);
      return NextResponse.json(mockResponse);
    }

    // Map parameters to OpenDental's expected format
    let mappedParameters = mapParametersToOpenDental(functionName, parameters || {});
    
    // Clean phone numbers for search/create operations
    if ((functionName === 'GetMultiplePatients' || functionName === 'CreatePatient' || functionName === 'UpdatePatient') && mappedParameters.Phone) {
      mappedParameters.Phone = cleanPhoneNumber(mappedParameters.Phone);
    }
    if (functionName === 'CreatePatient' || functionName === 'UpdatePatient') {
      if (mappedParameters.WirelessPhone) {
        mappedParameters.WirelessPhone = cleanPhoneNumber(mappedParameters.WirelessPhone);
      }
      if (mappedParameters.HmPhone) {
        mappedParameters.HmPhone = cleanPhoneNumber(mappedParameters.HmPhone);
      }
      if (mappedParameters.WkPhone) {
        mappedParameters.WkPhone = cleanPhoneNumber(mappedParameters.WkPhone);
      }
    }
    
    // For GetAvailableSlots: Remove 'date' if 'dateStart' is present (range takes precedence)
    if (functionName === 'GetAvailableSlots' && mappedParameters.dateStart && mappedParameters.date) {
      console.log('[OpenDental API] Removing "date" parameter (dateStart/dateEnd takes precedence)');
      const { date: _date, ...rest } = mappedParameters;
      mappedParameters = rest;
    }
    
    // For CreateAppointment: Filter to only essential parameters
    if (functionName === 'CreateAppointment') {
      // Only keep parameters that OpenDental actually accepts (minimal set)
      const allowedParams = [
        'PatNum', 'Op', 'ProvNum', 'AptDateTime', 'Note'
      ];
      
      const filtered: Record<string, any> = {};
      for (const key of allowedParams) {
        if (mappedParameters[key] !== undefined) {
          filtered[key] = mappedParameters[key];
        }
      }
      
      // Add defaults for required fields
      if (!filtered.Op) filtered.Op = 1;
      if (!filtered.ProvNum) filtered.ProvNum = 1;
      
      // Convert PatNum to number if it's a string
      if (filtered.PatNum && typeof filtered.PatNum === 'string') {
        filtered.PatNum = parseInt(filtered.PatNum, 10);
      }
      
      console.log('[OpenDental API] Filtered CreateAppointment params:', filtered);
      mappedParameters = filtered;
    }
    
    // For UpdateAppointment: Map AptNum to AppointmentId for path parameter
    if (functionName === 'UpdateAppointment' && mappedParameters.AptNum) {
      mappedParameters.AppointmentId = mappedParameters.AptNum;
    }
    
    // For UpdatePatient: Map PatNum to id for path parameter
    if (functionName === 'UpdatePatient' && mappedParameters.PatNum) {
      mappedParameters.id = mappedParameters.PatNum;
    }
    
    console.log('[OpenDental API] Mapped parameters:', mappedParameters);

    // Check for conflicts before creating/updating appointments
    if (functionName === 'CreateAppointment' || functionName === 'UpdateAppointment') {
      const conflictCheck = await checkAppointmentConflict(functionName, mappedParameters);
      if (conflictCheck.hasConflict) {
        console.error('[OpenDental API] ❌ Appointment conflict detected:', conflictCheck.message);
        return NextResponse.json(
          {
            error: true,
            message: conflictCheck.message,
            conflictDetails: conflictCheck.details
          },
          { status: 409 } // 409 Conflict
        );
      }
    }

    // Execute real API call
    const response = await executeOpenDentalApiCall(endpoint, mappedParameters);
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[OpenDental API Error]', error);
    return NextResponse.json(
      formatErrorResponse(error, 'API call failed'),
      { status: error.status || 500 }
    );
  }
}

/**
 * Check for appointment conflicts before creating/updating
 */
async function checkAppointmentConflict(
  functionName: string,
  parameters: Record<string, any>
): Promise<{ hasConflict: boolean; message?: string; details?: any }> {
  // Extract appointment details
  const aptDateTime = parameters.AptDateTime;
  const op = parameters.Op || 1; // Default operatory
  const provNum = parameters.ProvNum || 1; // Default provider
  const aptNum = parameters.AptNum; // For updates, exclude the current appointment

  if (!aptDateTime) {
    return { hasConflict: false };
  }

  try {
    // Parse the appointment date/time
    // Handle both ISO format and "YYYY-MM-DD HH:mm:ss" format
    let appointmentDate: Date;
    if (typeof aptDateTime === 'string' && aptDateTime.includes(' ')) {
      // Format: "YYYY-MM-DD HH:mm:ss"
      const [datePart, timePart] = aptDateTime.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);
      appointmentDate = new Date(year, month - 1, day, hours, minutes, seconds || 0);
    } else {
      appointmentDate = new Date(aptDateTime);
    }
    
    const year = appointmentDate.getFullYear();
    const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
    const day = String(appointmentDate.getDate()).padStart(2, '0');
    const appointmentDateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
    const appointmentHour = appointmentDate.getHours();
    const appointmentMinute = appointmentDate.getMinutes();

    // Get appointments for the same date and operatory
    // Use the same endpoint format as GetAppointments
    const baseUrl = getOpenDentalBaseUrl();
    const url = `${baseUrl.replace(/\/$/, '')}/appointments?dateStart=${appointmentDateStr}&dateEnd=${appointmentDateStr}&Op=${op}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getOpenDentalAuthHeader(),
    });

    if (!response.ok) {
      // If we can't check, assume no conflict (let the API handle it)
      console.warn('[OpenDental API] Could not check conflicts, proceeding with appointment');
      return { hasConflict: false };
    }

    const appointments = await response.json();
    
    // Check for conflicts (same operatory, overlapping time)
    for (const apt of Array.isArray(appointments) ? appointments : []) {
      // Skip the current appointment being updated
      if (functionName === 'UpdateAppointment' && apt.AptNum === aptNum) {
        continue;
      }

      // Only check scheduled appointments
      if (apt.AptStatus !== 'Scheduled' && apt.AptStatus !== 'ASAP') {
        continue;
      }

      // Check if same operatory
      if (apt.Op !== op) {
        continue;
      }

      // Parse existing appointment time
      // Handle both ISO format and "YYYY-MM-DD HH:mm:ss" format
      let existingAptDateTime: Date;
      if (typeof apt.AptDateTime === 'string' && apt.AptDateTime.includes(' ')) {
        // Format: "YYYY-MM-DD HH:mm:ss"
        const [datePart, timePart] = apt.AptDateTime.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);
        existingAptDateTime = new Date(year, month - 1, day, hours, minutes, seconds || 0);
      } else {
        existingAptDateTime = new Date(apt.AptDateTime);
      }
      
      const existingHour = existingAptDateTime.getHours();
      const existingMinute = existingAptDateTime.getMinutes();

      // Check for time overlap (same hour or within 1 hour window)
      // Appointments typically last 30-60 minutes, so we check if they're in the same hour
      if (existingHour === appointmentHour) {
        return {
          hasConflict: true,
          message: `Time slot conflict: Operatory ${op} is already booked at ${appointmentDate.toLocaleTimeString()}. Existing appointment at ${existingAptDateTime.toLocaleTimeString()}.`,
          details: {
            requestedTime: aptDateTime,
            conflictingAppointment: apt,
            operatory: op,
          }
        };
      }

      // Also check if appointments are very close (within 30 minutes)
      const timeDiff = Math.abs(appointmentDate.getTime() - existingAptDateTime.getTime());
      const thirtyMinutes = 30 * 60 * 1000;
      if (timeDiff < thirtyMinutes) {
        return {
          hasConflict: true,
          message: `Time slot conflict: Operatory ${op} has an appointment too close to the requested time.`,
          details: {
            requestedTime: aptDateTime,
            conflictingAppointment: apt,
            operatory: op,
          }
        };
      }
    }

    return { hasConflict: false };
  } catch (error: any) {
    // If conflict check fails, log warning but don't block the appointment
    // The API will handle conflicts if they exist
    console.warn('[OpenDental API] Conflict check failed:', error.message);
    return { hasConflict: false };
  }
}

/**
 * Execute actual OpenDental API call
 */
async function executeOpenDentalApiCall(
  endpoint: EndpointInfo,
  parameters: Record<string, any>
) {
  const baseUrl = getOpenDentalBaseUrl();
  const pathParams = extractPathParamNames(endpoint.endpoint);

  // Strip /api/v1 or /api prefix from endpoint if present (baseUrl already includes /api/v1)
  let endpointPath = endpoint.endpoint;
  if (endpointPath.startsWith('/api/v1/')) {
    endpointPath = endpointPath.substring(7); // Remove '/api/v1'
  } else if (endpointPath.startsWith('/api/')) {
    endpointPath = endpointPath.substring(4); // Remove '/api'
  }
  
  // Ensure path starts with /
  if (!endpointPath.startsWith('/')) {
    endpointPath = '/' + endpointPath;
  }

  // Build URL with path parameters (baseUrl should not end with /)
  let url = baseUrl.replace(/\/$/, '') + replacePathParams(endpointPath, parameters);

  // Add query parameters for GET requests
  if (endpoint.method === 'GET') {
    url += buildQueryParams(parameters, pathParams);
  }

  // Build request options
  const requestOptions: RequestInit = {
    method: endpoint.method,
    headers: getOpenDentalAuthHeader(),
  };

  // Add body for POST/PUT requests
  if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
    const body = buildRequestBody(parameters, pathParams);
    if (Object.keys(body).length > 0) {
      requestOptions.body = JSON.stringify(body);
    }
  }

  console.log(`[OpenDental API] Calling: ${endpoint.method} ${url}`);
  console.log(`[OpenDental API] Headers:`, requestOptions.headers);

  // Execute with retry logic
  return await retryRequest(async () => {
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: `OpenDental API error: ${response.statusText}`,
        details: errorData,
      };
    }

    // Some endpoints return empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return { success: true };
  });
}

/**
 * Get mock response for testing without real API
 */
function getMockResponse(functionName: string, parameters: Record<string, any>) {
  // Map function names to mock data
  switch (functionName) {
    // Patient operations
    case 'GetPatients':
      return mockPatientData;

    case 'GetPatient':
      const patient = mockPatientData.find(p => 
        p.patientId === parameters.id ||
        p.firstName.toLowerCase() === parameters.first_name?.toLowerCase() &&
        p.lastName.toLowerCase() === parameters.last_name?.toLowerCase()
      );
      return patient || { error: 'Patient not found' };

    case 'CreatePatient':
      return {
        success: true,
        patientId: `PT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        location: `/api/patients/PT-${Math.floor(Math.random() * 1000)}`,
      };

    case 'UpdatePatient':
      return { success: true, message: 'Patient updated successfully' };

    case 'DeletePatient':
      return { success: true, message: 'Patient deleted successfully' };

    // Provider operations
    case 'GetProviders':
    case 'GetMultipleProviders':
      return mockProviderData;

    case 'GetProvider':
      const provider = mockProviderData.find(p => p.providerId === parameters.id);
      return provider || { error: 'Provider not found' };

    // Appointment operations
    case 'GetAppointments':
      return [
        {
          appointmentId: 'APT-001',
          patientId: 'PT-001',
          providerId: 'PROV-001',
          date: '2025-10-27',
          time: '09:00 AM',
          type: 'Regular Cleaning',
          status: 'Scheduled',
        },
      ];

    case 'GetAvailableSlots':
    case 'GetAppointmentSlots':
      return mockAppointmentSlots;

    case 'CreateAppointment':
      return {
        success: true,
        appointmentId: `APT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        location: `/api/appointments/APT-${Math.floor(Math.random() * 1000)}`,
        message: 'Appointment created successfully',
      };

    case 'UpdateAppointment':
      return { success: true, message: 'Appointment updated successfully' };

    case 'DeleteAppointment':
    case 'BreakAppointment':
      return { success: true, message: 'Appointment cancelled successfully' };

    case 'ConfirmAppointment':
      return { success: true, message: 'Appointment confirmed' };

    // Insurance operations
    case 'GetInsuranceForPatient':
      return {
        primary: {
          carrier: 'Delta Dental',
          policyNumber: 'DD123456789',
          groupNumber: 'GRP-001',
        },
        secondary: null,
      };

    case 'GetInsurancePlans':
      return [
        { planId: 'PLAN-001', carrier: 'Delta Dental', type: 'PPO' },
        { planId: 'PLAN-002', carrier: 'MetLife', type: 'HMO' },
      ];

    // Claims
    case 'CreateClaim':
      return {
        success: true,
        claimId: `CLM-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        message: 'Claim created successfully',
      };

    case 'GetClaims':
    case 'GetSingleClaim':
      return {
        claimId: 'CLM-001',
        patientId: 'PT-001',
        status: 'Submitted',
        amount: '$350.00',
        dateSubmitted: '2024-10-01',
      };

    // Procedures
    case 'GetProcedures':
      return [
        {
          procedureId: 'PROC-001',
          code: 'D1110',
          description: 'Prophylaxis - Adult',
          fee: '$95.00',
        },
        {
          procedureId: 'PROC-002',
          code: 'D0150',
          description: 'Comprehensive Oral Evaluation',
          fee: '$85.00',
        },
      ];

    case 'GetProcedureCodes':
      return [
        { code: 'D1110', description: 'Prophylaxis - Adult', category: 'Preventive' },
        { code: 'D0150', description: 'Comprehensive Oral Evaluation', category: 'Diagnostic' },
        { code: 'D2391', description: 'Composite Filling - One Surface', category: 'Restorative' },
      ];

    // Recalls
    case 'GetRecalls':
      return [
        {
          recallId: 'RCL-001',
          patientId: 'PT-001',
          recallType: 'Cleaning',
          dueDate: '2025-02-15',
          status: 'Scheduled',
        },
      ];

    case 'CreateRecall':
      return {
        success: true,
        recallId: `RCL-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        message: 'Recall created successfully',
      };

    // Payments
    case 'CreatePayment':
      return {
        success: true,
        paymentId: `PAY-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        message: 'Payment recorded successfully',
      };

    case 'GetPayments':
      return [
        {
          paymentId: 'PAY-001',
          patientId: 'PT-001',
          amount: '$125.00',
          date: '2024-10-15',
          method: 'Credit Card',
        },
      ];

    // Patient balance
    case 'GetPatientBalances':
    case 'GetPatientAccountInfo':
      return {
        patientId: parameters.patientId || parameters.PatNum,
        balance: '$125.00',
        lastPayment: '$95.00',
        lastPaymentDate: '2024-09-15',
      };

    // Preferences
    case 'GetPreferences':
    case 'GetAgingData':
      return {
        DateLastAging: '2024-10-25T12:00:00Z',
        AgingServiceTimeDue: '12:00:00',
      };

    // Default response for unhandled functions
    default:
      return {
        success: true,
        message: `Mock response for ${functionName}`,
        data: parameters,
      };
  }
}

