/**
 * Embedded Booking System API Route
 * 
 * This route handles all booking system function calls from the orchestrator agent,
 * providing the same interface as OpenDental API but using internal database.
 * 
 * Flow:
 * 1. Receive function call from orchestrator
 * 2. VALIDATE parameters before execution (prevents empty {} calls)
 * 3. Route to appropriate handler function
 * 4. Execute database operations via Supabase
 * 5. Return response in OpenDental-compatible format
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import * as bookingFunctions from './functions';
import { 
  getAutoFilledParameters, 
  recordFunctionCall,
  getOrCreateState,
  addMessage,
  processMessage,
  ConversationState
} from '@/app/lib/conversationState';
import {
  smartExtract,
  mergeExtractedData,
  ConversationMessage
} from '@/app/lib/llmExtractor';
// Validation removed - will use LLM-based validation layer later

// Feature flag for Sonnet validation
const ENABLE_SONNET_VALIDATION = process.env.ENABLE_SONNET_VALIDATION !== 'false'; // Enabled by default

/**
 * Parameter validation rules for each function
 * - required: parameters that MUST be present
 * - optional: parameters that can be omitted
 * - defaults: auto-inject these values if not provided
 * - example: shown in error messages
 */
const FUNCTION_SCHEMAS: Record<string, {
  required: string[];
  optional?: string[];
  defaults?: Record<string, any>;
  example: Record<string, any>;
  description: string;
}> = {
  GetAllPatients: {
    required: [],
    example: {},
    description: 'Get all patients (no parameters needed)'
  },
  GetMultiplePatients: {
    required: [], // At least one of LName+FName OR Phone
    optional: ['LName', 'FName', 'Phone', 'PatNum'],
    example: { LName: 'Smith', FName: 'John' },
    description: 'Search by name (LName+FName) OR phone (10 digits)'
  },
  GetPatient: {
    required: ['PatNum'],
    example: { PatNum: 1 },
    description: 'Get single patient by PatNum'
  },
  CreatePatient: {
    required: ['FName', 'LName', 'Birthdate', 'WirelessPhone'],
    optional: ['Email'],
    example: { FName: 'John', LName: 'Smith', Birthdate: '1990-01-15', WirelessPhone: '6195551234' },
    description: 'Create new patient. Birthdate must be YYYY-MM-DD, phone must be 10 digits'
  },
  GetAppointments: {
    required: ['DateStart', 'DateEnd'],
    optional: ['PatNum'],
    example: { DateStart: '2025-12-01', DateEnd: '2025-12-31', PatNum: 1 },
    description: 'Get appointments in date range. Optionally filter by PatNum'
  },
  GetAvailableSlots: {
    required: ['dateStart', 'dateEnd'],
    optional: ['ProvNum', 'OpNum', 'lengthMinutes', 'searchAll'],
    // No defaults - function now intelligently searches ALL schedules if none specified
    example: { dateStart: '2025-12-05', dateEnd: '2025-12-05' },
    description: 'Get available time slots. If ProvNum/OpNum not specified, searches all providers/operatories with schedules'
  },
  CreateAppointment: {
    required: ['PatNum', 'AptDateTime', 'ProvNum', 'Op'],
    optional: ['Note', 'AptStatus'],
    example: { PatNum: 1, AptDateTime: '2025-12-05 10:00:00', ProvNum: 1, Op: 1, Note: 'Cleaning' },
    description: 'Book appointment. AptDateTime must be YYYY-MM-DD HH:mm:ss format'
  },
  UpdateAppointment: {
    required: ['AptNum'],
    optional: ['AptDateTime', 'AptStatus', 'ProvNum', 'Op', 'Note', 'PatNum'],
    example: { AptNum: 1, AptDateTime: '2025-12-06 14:00:00' },
    description: 'Update existing appointment by AptNum'
  },
  GetProviders: {
    required: [],
    example: {},
    description: 'Get all providers (no parameters needed)'
  },
  GetOperatories: {
    required: [],
    example: {},
    description: 'Get all operatories (no parameters needed)'
  },
  GetSchedules: {
    required: [],
    optional: ['ProvNum', 'OpNum', 'ScheduleDate', 'DateStart', 'DateEnd', 'is_active'],
    example: { ScheduleDate: '2025-12-02' },
    description: 'Get provider schedules. Filter by provider, operatory, or date range'
  },
  GetSchedule: {
    required: ['ScheduleNum'],
    example: { ScheduleNum: 1 },
    description: 'Get single schedule by ID'
  },
  GetProviderSchedules: {
    required: ['ProvNum'],
    optional: ['DateStart', 'DateEnd'],
    example: { ProvNum: 1, DateStart: '2025-12-01', DateEnd: '2025-12-31' },
    description: 'Get schedules for a specific provider'
  },
  CreateSchedule: {
    required: ['ProvNum', 'OpNum', 'ScheduleDate', 'StartTime', 'EndTime'],
    optional: ['IsActive'],
    example: { ProvNum: 1, OpNum: 1, ScheduleDate: '2025-12-02', StartTime: '09:00:00', EndTime: '17:00:00' },
    description: 'Create provider schedule for a specific date. Validates no room/provider conflicts.'
  },
  UpdateSchedule: {
    required: ['ScheduleNum'],
    optional: ['ProvNum', 'OpNum', 'ScheduleDate', 'StartTime', 'EndTime', 'IsActive'],
    example: { ScheduleNum: 1, StartTime: '08:00:00' },
    description: 'Update existing schedule. Validates no conflicts.'
  },
  DeleteSchedule: {
    required: ['ScheduleNum'],
    example: { ScheduleNum: 1 },
    description: 'Delete a schedule'
  },
  CreateDefaultSchedules: {
    required: ['ProvNum', 'OpNum', 'DateStart', 'DateEnd'],
    optional: ['StartTime', 'EndTime', 'IncludeWeekends'],
    example: { ProvNum: 1, OpNum: 1, DateStart: '2025-12-02', DateEnd: '2025-12-06', StartTime: '09:00:00', EndTime: '17:00:00' },
    description: 'Create schedules for a date range (Mon-Fri by default)'
  },
  CheckScheduleConflicts: {
    required: ['ProvNum', 'OpNum', 'ScheduleDate', 'StartTime', 'EndTime'],
    optional: ['ExcludeScheduleNum'],
    example: { ProvNum: 1, OpNum: 1, ScheduleDate: '2025-12-02', StartTime: '09:00:00', EndTime: '17:00:00' },
    description: 'Check if a schedule would conflict with existing ones'
  }
};

/**
 * Validate parameters before function execution
 * Returns null if valid, or error response if invalid
 */
function validateParameters(
  functionName: string, 
  parameters: Record<string, any> | undefined
): { valid: true; params: Record<string, any> } | { valid: false; error: any } {
  const schema = FUNCTION_SCHEMAS[functionName];
  
  // If no schema defined, allow through (for functions like GetProviders)
  if (!schema) {
    return { valid: true, params: parameters || {} };
  }
  
  const params = { ...(parameters || {}) };
  const missing: string[] = [];
  
  // Check required parameters
  for (const param of schema.required) {
    if (params[param] === undefined || params[param] === null || params[param] === '') {
      missing.push(param);
    }
  }
  
  // Special case: GetMultiplePatients needs EITHER (LName+FName) OR Phone
  if (functionName === 'GetMultiplePatients') {
    const hasName = params.LName || params.FName;
    const hasPhone = params.Phone;
    const hasPatNum = params.PatNum;
    
    if (!hasName && !hasPhone && !hasPatNum) {
      return {
        valid: false,
        error: {
          error: true,
          validationError: true,
          functionName,
          message: `GetMultiplePatients requires at least one search parameter.`,
          options: [
            'Search by name: { LName: "Smith", FName: "John" }',
            'Search by phone: { Phone: "6195551234" }',
            'Search by ID: { PatNum: 1 }'
          ],
          received: params,
          hint: 'You called GetMultiplePatients with no parameters. Please provide name, phone, or PatNum to search.'
        }
      };
    }
  }
  
  // If missing required params, return error with CLEAR ACTION
  if (missing.length > 0) {
    // Build specific ask-for message based on function
    let userAskMessage = '';
    if (functionName === 'CreatePatient') {
      const missingFields: string[] = [];
      if (missing.includes('FName')) missingFields.push('first name');
      if (missing.includes('LName')) missingFields.push('last name');
      if (missing.includes('Birthdate')) missingFields.push('date of birth');
      if (missing.includes('WirelessPhone')) missingFields.push('phone number');
      userAskMessage = `STOP! The user has NOT provided: ${missingFields.join(', ')}. You MUST ask the user: "I'll need your ${missingFields.join(', and ')} to create your profile." DO NOT call CreatePatient again until the user provides ALL of these!`;
    } else if (functionName === 'CreateAppointment') {
      userAskMessage = `STOP! Cannot book without: ${missing.join(', ')}. You need a valid patient (call GetMultiplePatients first) and available slot (call GetAvailableSlots first) before booking.`;
    } else {
      userAskMessage = `STOP! Missing: ${missing.join(', ')}. Ask the user for this information before calling ${functionName} again.`;
    }
    
    return {
      valid: false,
      error: {
        error: true,
        validationError: true,
        functionName,
        message: userAskMessage,
        required: schema.required,
        received: params,
        example: schema.example,
        action: 'ASK_USER', // Clear action indicator
        missingFields: missing
      }
    };
  }
  
  // Apply defaults for optional parameters
  if (schema.defaults) {
    for (const [key, value] of Object.entries(schema.defaults)) {
      if (params[key] === undefined) {
        params[key] = value;
        console.log(`[Booking API] Auto-injected default: ${key}=${value}`);
      }
    }
  }
  
  // Validate birthdate format for CreatePatient
  if (functionName === 'CreatePatient' && params.Birthdate) {
    const birthdateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthdateRegex.test(params.Birthdate)) {
      return {
        valid: false,
        error: {
          error: true,
          validationError: true,
          functionName,
          message: `Invalid Birthdate format: "${params.Birthdate}"`,
          expected: 'YYYY-MM-DD format (e.g., 1988-08-12)',
          conversionHint: 'Convert spoken dates: "August 12, 1988" → "1988-08-12", "12/8/1988" → "1988-12-08"',
          received: params
        }
      };
    }
    
    // Check for obviously invalid dates
    const [year, month, day] = params.Birthdate.split('-').map(Number);
    if (year < 1900 || year > new Date().getFullYear() || month < 1 || month > 12 || day < 1 || day > 31) {
      return {
        valid: false,
        error: {
          error: true,
          validationError: true,
          functionName,
          message: `Invalid Birthdate value: "${params.Birthdate}"`,
          expected: `Year: 1900-${new Date().getFullYear()}, Month: 01-12, Day: 01-31`,
          received: params
        }
      };
    }
  }
  
  return { valid: true, params };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Booking API] Received request:', body);
    
    const { functionName, parameters, sessionId, conversationHistory } = body;
    
    // If sessionId and conversationHistory provided, sync messages to state
    // This ensures the Calls section can display conversation history
    if (sessionId && conversationHistory && Array.isArray(conversationHistory)) {
      const state = getOrCreateState(sessionId);
      
      // Sync new messages that aren't already in state
      const existingCount = state.messages.length;
      
      conversationHistory.forEach((msg: any, idx: number) => {
        // Only add messages we don't already have
        if (idx >= existingCount) {
          const content = typeof msg.content === 'string' ? msg.content : 
            (Array.isArray(msg.content) ? msg.content.map((c: any) => c.text || c.content || '').join(' ') : '');
          
          if (content.trim()) {
            // Use processMessage for user messages to extract parameters
            if (msg.role === 'user') {
              processMessage(sessionId, content, 'user');
            } else {
              addMessage(sessionId, msg.role || 'assistant', content);
            }
          }
        }
      });
      
      const newCount = state.messages.length;
      if (newCount > existingCount) {
        console.log(`[Booking API] Synced ${newCount - existingCount} new messages to conversation state`);
        // Log what we've extracted so far
        console.log(`[Booking API] Extracted from conversation:`, {
          patient: {
            firstName: state.patient.firstName || '(not found)',
            lastName: state.patient.lastName || '(not found)',
            phone: state.patient.phone || '(not found)',
            birthdate: state.patient.birthdate || '(not found)',
          },
          intent: state.intent || '(not detected)',
          appointmentType: state.appointment.type || '(not found)',
        });
      }
    }
    
    // If sessionId provided, try to auto-fill missing parameters from conversation state
    let enhancedParameters = parameters || {};
    let autoFilledParams: Record<string, any> = {}; // Track what was auto-filled
    
    if (sessionId) {
      autoFilledParams = getAutoFilledParameters(sessionId, functionName);
      
      // For critical IDs from actual API results, our stored values take precedence
      // This prevents LLM hallucination (e.g., AptNum: 1234 instead of real ID)
      const criticalFields = ['AptNum', 'PatNum'];
      
      // Start with provided params
      enhancedParameters = { ...enhancedParameters };
      
      // Merge auto-filled, but critical fields from state override provided params
      for (const [key, value] of Object.entries(autoFilledParams)) {
        if (criticalFields.includes(key) && value !== undefined) {
          // Critical field from state takes precedence
          if (enhancedParameters[key] !== undefined && enhancedParameters[key] !== value) {
            console.log(`[Booking API] ⚠️ Overriding provided ${key}=${enhancedParameters[key]} with stored value ${value}`);
          }
          enhancedParameters[key] = value;
        } else if (enhancedParameters[key] === undefined) {
          // Non-critical: only fill if not provided
          enhancedParameters[key] = value;
        }
      }
      
      if (Object.keys(autoFilledParams).length > 0) {
        console.log(`[Booking API] Auto-filled from conversation state:`, autoFilledParams);
      }
    }

    if (!functionName) {
      console.error('[Booking API] Missing functionName');
      return NextResponse.json(
        { error: true, message: 'functionName is required' },
        { status: 400 }
      );
    }

    // Route to appropriate handler function
    const handler = (bookingFunctions as any)[functionName];
    
    if (!handler || typeof handler !== 'function') {
      console.error(`[Booking API] Unknown function: ${functionName}`);
      return NextResponse.json(
        { 
          error: true, 
          message: `Unknown function: ${functionName}`,
          availableFunctions: Object.keys(bookingFunctions).filter(k => typeof (bookingFunctions as any)[k] === 'function')
        },
        { status: 404 }
      );
    }

    // ========================================
    // VALIDATE PARAMETERS BEFORE EXECUTION
    // ========================================
    let validation = validateParameters(functionName, enhancedParameters);
    let validatedParams = validation.valid ? validation.params : enhancedParameters;
    
    // ========================================
    // LLM EXTRACTION FALLBACK
    // If validation fails AND we have sessionId AND conversation history
    // ========================================
    if (!validation.valid && sessionId && body.conversationHistory) {
      console.log(`[Booking API] Validation failed, trying LLM extraction fallback...`);
      
      // Get missing parameters from validation error
      const missingParams = validation.error.required || 
        (validation.error.message?.match(/missing.*?:\s*(.+)/i)?.[1]?.split(', ') || []);
      
      // Get current conversation state
      const currentState = getOrCreateState(sessionId);
      
      // Convert conversation history to the right format
      const messages: ConversationMessage[] = (body.conversationHistory || []).map((msg: any) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: typeof msg.content === 'string' ? msg.content : 
          (Array.isArray(msg.content) ? msg.content.map((c: any) => c.text || c.content || '').join(' ') : '')
      })).filter((msg: ConversationMessage) => msg.content.trim());
      
      if (messages.length > 0 && missingParams.length > 0) {
        try {
          // Call LLM to extract missing parameters
          const extraction = await smartExtract(
            sessionId,
            messages,
            functionName,
            missingParams,
            currentState
          );
          
          console.log(`[Booking API] LLM extraction result (source: ${extraction.source}):`, extraction.autoFilledParams);
          
          // Merge extracted params with what we have
          const llmEnhancedParams = {
            ...enhancedParameters,
            ...extraction.autoFilledParams
          };
          
          // Update conversation state with extracted data
          if (extraction.source === 'llm') {
            mergeExtractedData(currentState, extraction.extracted);
          }
          
          // Re-validate with LLM-enhanced parameters
          validation = validateParameters(functionName, llmEnhancedParams);
          
          if (validation.valid) {
            console.log(`[Booking API] ✓ LLM extraction fixed the parameters!`);
            validatedParams = validation.params;
          } else {
            console.log(`[Booking API] ✗ LLM extraction couldn't fill all required params`);
          }
          
        } catch (llmError: any) {
          console.error(`[Booking API] LLM extraction failed:`, llmError.message);
          // Continue with original validation error
        }
      }
    }
    
    // If still invalid after LLM fallback, return error
    if (!validation.valid) {
      console.log(`[Booking API] Final validation failed for ${functionName}:`, validation.error.message);
      
      // Record failed call in conversation state if sessionId provided
      if (sessionId) {
        recordFunctionCall(sessionId, functionName, enhancedParameters, undefined, validation.error.message, autoFilledParams);
      }
      
      // Return 200 with ACTIONABLE error - tell LLM exactly what to do
      return NextResponse.json({
        ...validation.error,
        llmExtractionAttempted: !!body.conversationHistory,
        nextAction: 'You MUST ask the user to provide the missing information. Do NOT call any other functions until you have collected this data from the user.',
        doNotProceed: true
      });
    }

    try {
      // ========================================
      // SONNET VALIDATION REMOVED
      // TODO: Implement LLM-based validation layer later
      
      // Execute the handler function with validated parameters
      const result = await handler(validatedParams);
      
      // Record successful call in conversation state
      if (sessionId) {
        recordFunctionCall(sessionId, functionName, validatedParams, result, undefined, autoFilledParams);
      }
      
      // Return success response
      return NextResponse.json(result);
      
    } catch (error: any) {
      // Record error in conversation state
      if (sessionId) {
        recordFunctionCall(sessionId, functionName, validatedParams, undefined, error.message, autoFilledParams);
      }
      
      // Check if this is a validation error from the handler
      const isValidationError = error.message?.includes('requires') || 
                                 error.message?.includes('Missing') ||
                                 error.message?.includes('Invalid') ||
                                 error.message?.includes('required');
      
      if (isValidationError) {
        console.log(`[Booking API] Handler validation error for ${functionName}: ${error.message}`);
        return NextResponse.json({
          error: true,
          validationError: true,
          functionName,
          message: error.message,
          hint: 'Please retry with correct parameters.'
        });
      }
      
      // Actual server error - return 500
      console.error(`[Booking API] Error executing ${functionName}:`, error);
      
      const errorMessage = error.message || `Error executing ${functionName}`;
      return NextResponse.json(
        {
          error: true,
          message: errorMessage,
          errorMessage: errorMessage, // For backwards compatibility
          details: error.details || error.stack
        },
        { status: error.status || 500 }
      );
    }

  } catch (error: any) {
    console.error('[Booking API] Request error:', error);
    
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Internal server error',
        // Also include error as string for backwards compatibility
        errorMessage: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}


