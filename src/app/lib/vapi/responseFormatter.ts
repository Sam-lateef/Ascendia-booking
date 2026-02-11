/**
 * Vapi Response Formatter
 * 
 * Formats booking API results for Vapi in either:
 * - JSON format (let Vapi's LLM convert to speech)
 * - Natural language format (pre-formatted strings)
 * 
 * Mode is controlled by VAPI_RESPONSE_FORMAT environment variable:
 * - 'json': Return structured JSON (default)
 * - 'natural': Return natural language strings
 */

export type ResponseFormat = 'json' | 'natural';

const RESPONSE_FORMAT: ResponseFormat = 
  (process.env.VAPI_RESPONSE_FORMAT as ResponseFormat) || 'json';

/**
 * Format a booking API result for Vapi
 * 
 * @param functionName - The Vapi function name that was called
 * @param result - The result from our booking API
 * @param error - Error object if the function failed
 * @returns Formatted string for Vapi to speak
 */
export function formatVapiResponse(
  functionName: string,
  result: any,
  error?: any
): string {
  console.log(`[Vapi Formatter] Mode: ${RESPONSE_FORMAT}, Function: ${functionName}`);

  // Handle errors
  if (error) {
    return formatError(functionName, error);
  }

  // Format based on configured mode
  if (RESPONSE_FORMAT === 'natural') {
    return formatAsNaturalLanguage(functionName, result);
  } else {
    return formatAsJSON(result);
  }
}

/**
 * Format result as JSON string (let Vapi's LLM convert)
 */
function formatAsJSON(result: any): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch (err) {
    console.error('[Vapi Formatter] JSON stringify failed:', err);
    return JSON.stringify({ error: 'Failed to format response' });
  }
}

/**
 * Format result as natural language using templates
 */
function formatAsNaturalLanguage(functionName: string, result: any): string {
  try {
    switch (functionName) {
      case 'checkAvailability':
        return formatAvailability(result);
      
      case 'findPatient':
        return formatPatientSearch(result);
      
      case 'createPatient':
        return formatPatientCreated(result);
      
      case 'bookAppointment':
        return formatAppointmentBooked(result);
      
      case 'cancelAppointment':
        return formatAppointmentCancelled(result);
      
      default:
        // Fallback to JSON if we don't have a template
        return formatAsJSON(result);
    }
  } catch (err) {
    console.error('[Vapi Formatter] Natural language formatting failed:', err);
    return formatAsJSON(result);
  }
}

/**
 * Format availability check results
 */
function formatAvailability(result: any[]): string {
  if (!result || result.length === 0) {
    return "I'm sorry, there are no available appointments on that date. Would you like to try a different date?";
  }

  const count = result.length;
  
  // Show first 3-4 slots for brevity
  const slotsToShow = result.slice(0, Math.min(4, result.length));
  
  const slotsList = slotsToShow.map(slot => {
    const dateTime = new Date(slot.DateTimeStart);
    const time = dateTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const doctorName = slot.ProviderName || `Doctor ${slot.ProvNum}`;
    return `${time} with ${doctorName}`;
  }).join(', ');

  if (count <= 4) {
    return `I found ${count} available appointment${count > 1 ? 's' : ''}: ${slotsList}. Which time would work best for you?`;
  } else {
    return `I found ${count} available appointments. Here are some options: ${slotsList}, and ${count - 4} more. Which time would you prefer?`;
  }
}

/**
 * Format patient search results
 */
function formatPatientSearch(result: any): string {
  // Result could be array or single object
  const patients = Array.isArray(result) ? result : [result];
  
  if (patients.length === 0 || !patients[0]) {
    return "I couldn't find a patient profile with that phone number. Would you like to create a new patient profile?";
  }

  if (patients.length === 1) {
    const patient = patients[0];
    return `Great! I found your profile: ${patient.FName} ${patient.LName}. Let me help you book an appointment.`;
  }

  // Multiple patients found (rare but possible)
  return `I found ${patients.length} patients with that information. Could you provide your full name to help me identify the correct profile?`;
}

/**
 * Format patient creation result
 */
function formatPatientCreated(result: any): string {
  if (!result || !result.PatNum) {
    return "I'm sorry, I had trouble creating your patient profile. Could we try again?";
  }

  return `Perfect! I've created your patient profile. Now let me help you book an appointment. What date were you looking for?`;
}

/**
 * Format appointment booking result
 */
function formatAppointmentBooked(result: any): string {
  if (!result || !result.AptNum) {
    return "I'm sorry, I wasn't able to book that appointment. That time slot may have just been taken. Would you like to try a different time?";
  }

  // Format the appointment date and time nicely
  const dateTime = new Date(result.AptDateTime);
  const dateStr = dateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const timeStr = dateTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const doctorName = result.ProviderName || (result.ProvNum ? `Doctor ${result.ProvNum}` : 'your doctor');

  return `Excellent! I've successfully booked your appointment for ${dateStr} at ${timeStr} with ${doctorName}. Your confirmation number is ${result.AptNum}. Is there anything else I can help you with?`;
}

/**
 * Format appointment cancellation result
 */
function formatAppointmentCancelled(result: any): string {
  if (!result || !result.success) {
    return "I'm sorry, I wasn't able to cancel that appointment. Could you verify the appointment number?";
  }

  return `Your appointment has been successfully cancelled. Is there anything else I can help you with today?`;
}

/**
 * Format error messages for Vapi to speak
 */
function formatError(functionName: string, error: any): string {
  const errorMessage = error?.message || error?.toString() || 'An unknown error occurred';

  console.error(`[Vapi Formatter] Error in ${functionName}:`, errorMessage);

  // Make errors user-friendly and speakable
  if (errorMessage.includes('not found')) {
    return "I'm sorry, I couldn't find that information in our system. Could you please verify the details?";
  }

  if (errorMessage.includes('conflict') || errorMessage.includes('already exists')) {
    return "I'm sorry, that time slot is no longer available. Would you like to try a different time?";
  }

  if (errorMessage.includes('required') || errorMessage.includes('missing')) {
    return "I'm sorry, I'm missing some information. Could you please provide all the required details?";
  }

  if (errorMessage.includes('invalid') || errorMessage.includes('format')) {
    return "I'm sorry, I didn't quite understand that. Could you please repeat that information?";
  }

  // Generic error fallback
  return "I apologize, but I encountered an issue. Could we try that again?";
}

/**
 * Get current response format mode
 */
export function getResponseFormat(): ResponseFormat {
  return RESPONSE_FORMAT;
}

/**
 * Log formatter configuration
 */
export function logFormatterConfig(): void {
  console.log(`[Vapi Formatter] Response format: ${RESPONSE_FORMAT}`);
  console.log(`[Vapi Formatter] To change format, set VAPI_RESPONSE_FORMAT to 'json' or 'natural'`);
}
