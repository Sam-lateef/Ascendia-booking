/**
 * LLM-based Parameter Extraction
 * 
 * Fallback when regex extraction fails.
 * Makes a single LLM call to extract ALL possible parameters from conversation history.
 * 
 * Why this approach:
 * 1. Regex is fast but brittle - doesn't handle all speech patterns
 * 2. LLM extraction is reliable but expensive
 * 3. Only call LLM when regex fails AND we can't auto-fill
 * 4. Extract EVERYTHING in one call since we're paying for it anyway
 */

import { 
  ConversationState, 
  ExtractedPatientInfo, 
  ExtractedAppointmentInfo,
  ConversationMessage 
} from './conversationState';

// Re-export for convenience
export type { ConversationMessage };

// Types for LLM extraction
export interface LLMExtractedData {
  patient: ExtractedPatientInfo;
  appointment: ExtractedAppointmentInfo;
  intent: 'book' | 'reschedule' | 'cancel' | 'check' | 'unknown';
  confidence: number; // 0-1, how confident the extraction is
  rawResponse?: string;
}

/**
 * The prompt for LLM extraction - designed to extract ALL variables in one call
 */
function buildExtractionPrompt(messages: ConversationMessage[], functionName: string, missingParams: string[]): string {
  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  return `You are a data extraction assistant. Extract information from this dental office conversation.

CONVERSATION:
${conversationText}

THE FUNCTION "${functionName}" NEEDS THESE PARAMETERS: ${missingParams.join(', ')}

Extract ALL available information from the conversation. Return a JSON object with this exact structure:
{
  "patient": {
    "firstName": "extracted first name or null",
    "lastName": "extracted last name or null",
    "phone": "10-digit phone number or null",
    "birthdate": "YYYY-MM-DD format or null",
    "isNewPatient": true/false/null
  },
  "appointment": {
    "type": "cleaning/checkup/filling/crown/extraction/emergency or null",
    "preferredDate": "YYYY-MM-DD format or null",
    "preferredTime": "morning/afternoon/HH:MM or null"
  },
  "intent": "book/reschedule/cancel/check/unknown",
  "confidence": 0.0-1.0
}

IMPORTANT RULES:
1. Convert ALL dates to YYYY-MM-DD format
   - "August 12, 1988" → "1988-08-12"
   - "8/12/88" → "1988-08-12"
   - "next Friday" → calculate the actual date
2. Convert phone numbers to 10 digits only (no dashes/spaces)
3. If information is not mentioned, use null
4. TODAY'S DATE IS ${new Date().toISOString().split('T')[0]} (CURRENT YEAR IS ${new Date().getFullYear()})
5. If user says "next Monday", "next Friday", etc., calculate the actual date FROM TODAY
6. NEVER use year 2023 - the current year is ${new Date().getFullYear()}
7. For appointment dates, use ${new Date().getFullYear()} unless the user specifically mentions a past date

Return ONLY the JSON object, no other text.`;
}

/**
 * Call LLM to extract parameters from conversation history
 */
export async function extractWithLLM(
  messages: ConversationMessage[],
  functionName: string,
  missingParams: string[]
): Promise<LLMExtractedData> {
  const prompt = buildExtractionPrompt(messages, functionName, missingParams);
  
  console.log('[LLM Extractor] Calling LLM for parameter extraction...');
  console.log('[LLM Extractor] Missing params:', missingParams);
  
  try {
    // Call OpenAI API for extraction
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use mini for cost efficiency - this is just extraction
        messages: [
          { role: 'system', content: 'You are a precise data extraction assistant. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0, // Deterministic for extraction
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    
    console.log('[LLM Extractor] Raw response:', rawContent);
    
    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = rawContent;
    if (rawContent.includes('```')) {
      const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    }
    
    const extracted = JSON.parse(jsonStr.trim());
    
    console.log('[LLM Extractor] Extracted:', extracted);
    
    return {
      patient: extracted.patient || {},
      appointment: extracted.appointment || {},
      intent: extracted.intent || 'unknown',
      confidence: extracted.confidence || 0.5,
      rawResponse: rawContent,
    };
    
  } catch (error: any) {
    console.error('[LLM Extractor] Error:', error);
    
    // Return empty extraction on failure
    return {
      patient: {},
      appointment: {},
      intent: 'unknown',
      confidence: 0,
      rawResponse: error.message,
    };
  }
}

/**
 * Smart extraction: Try regex first, fall back to LLM if needed
 */
export async function smartExtract(
  sessionId: string,
  messages: ConversationMessage[],
  functionName: string,
  missingParams: string[],
  currentState: ConversationState
): Promise<{
  extracted: LLMExtractedData;
  source: 'state' | 'llm';
  autoFilledParams: Record<string, any>;
}> {
  // First, check what we can fill from current state (regex-extracted)
  const fromState = buildParamsFromState(functionName, currentState);
  const stillMissing = missingParams.filter(p => !(p in fromState) || fromState[p] === undefined);
  
  if (stillMissing.length === 0) {
    console.log('[Smart Extract] All params available from state');
    return {
      extracted: {
        patient: currentState.patient,
        appointment: currentState.appointment,
        intent: currentState.intent || 'unknown',
        confidence: 0.8,
      },
      source: 'state',
      autoFilledParams: fromState,
    };
  }
  
  // Need LLM extraction for missing params
  console.log('[Smart Extract] Missing params after state check:', stillMissing);
  console.log('[Smart Extract] Falling back to LLM extraction...');
  
  const llmExtracted = await extractWithLLM(messages, functionName, stillMissing);
  
  // Merge LLM results with state (LLM takes precedence for missing values)
  const mergedParams = buildParamsFromExtraction(functionName, currentState, llmExtracted);
  
  return {
    extracted: llmExtracted,
    source: 'llm',
    autoFilledParams: mergedParams,
  };
}

/**
 * Build function parameters from conversation state
 */
function buildParamsFromState(functionName: string, state: ConversationState): Record<string, any> {
  const params: Record<string, any> = {};
  
  switch (functionName) {
    case 'GetMultiplePatients':
      if (state.patient.lastName) params.LName = state.patient.lastName;
      if (state.patient.firstName) params.FName = state.patient.firstName;
      if (state.patient.phone) params.Phone = state.patient.phone;
      break;
      
    case 'CreatePatient':
      if (state.patient.firstName) params.FName = state.patient.firstName;
      if (state.patient.lastName) params.LName = state.patient.lastName;
      if (state.patient.birthdate) params.Birthdate = state.patient.birthdate;
      if (state.patient.phone) params.WirelessPhone = state.patient.phone;
      break;
      
    case 'GetAvailableSlots':
      if (state.appointment.preferredDate) {
        params.dateStart = state.appointment.preferredDate;
        params.dateEnd = state.appointment.preferredDate;
      }
      params.ProvNum = 1;
      params.OpNum = 1;
      break;
      
    case 'CreateAppointment':
      if (state.patient.patNum) params.PatNum = state.patient.patNum;
      if (state.appointment.selectedSlot) {
        params.AptDateTime = state.appointment.selectedSlot.dateTime;
        params.ProvNum = state.appointment.selectedSlot.provNum;
        params.Op = state.appointment.selectedSlot.opNum;
      }
      if (state.appointment.type) params.Note = state.appointment.type;
      break;
  }
  
  return params;
}

/**
 * Build function parameters from both state and LLM extraction
 */
function buildParamsFromExtraction(
  functionName: string, 
  state: ConversationState, 
  llmData: LLMExtractedData
): Record<string, any> {
  // Start with state-based params
  const params = buildParamsFromState(functionName, state);
  
  // Merge LLM-extracted values (fill in gaps)
  switch (functionName) {
    case 'GetMultiplePatients':
      if (!params.LName && llmData.patient.lastName) params.LName = llmData.patient.lastName;
      if (!params.FName && llmData.patient.firstName) params.FName = llmData.patient.firstName;
      if (!params.Phone && llmData.patient.phone) params.Phone = llmData.patient.phone;
      break;
      
    case 'CreatePatient':
      if (!params.FName && llmData.patient.firstName) params.FName = llmData.patient.firstName;
      if (!params.LName && llmData.patient.lastName) params.LName = llmData.patient.lastName;
      if (!params.Birthdate && llmData.patient.birthdate) params.Birthdate = llmData.patient.birthdate;
      if (!params.WirelessPhone && llmData.patient.phone) params.WirelessPhone = llmData.patient.phone;
      break;
      
    case 'GetAvailableSlots':
      if (!params.dateStart && llmData.appointment.preferredDate) {
        params.dateStart = llmData.appointment.preferredDate;
        params.dateEnd = llmData.appointment.preferredDate;
      }
      break;
      
    case 'CreateAppointment':
      if (!params.Note && llmData.appointment.type) params.Note = llmData.appointment.type;
      break;
  }
  
  return params;
}

/**
 * Update conversation state with LLM-extracted data
 */
export function mergeExtractedData(state: ConversationState, extracted: LLMExtractedData): ConversationState {
  // Merge patient info (only fill in missing values)
  if (extracted.patient) {
    if (!state.patient.firstName && extracted.patient.firstName) {
      state.patient.firstName = extracted.patient.firstName;
    }
    if (!state.patient.lastName && extracted.patient.lastName) {
      state.patient.lastName = extracted.patient.lastName;
    }
    if (!state.patient.phone && extracted.patient.phone) {
      state.patient.phone = extracted.patient.phone;
    }
    if (!state.patient.birthdate && extracted.patient.birthdate) {
      state.patient.birthdate = extracted.patient.birthdate;
    }
    if (state.patient.isNewPatient === undefined && extracted.patient.isNewPatient !== undefined) {
      state.patient.isNewPatient = extracted.patient.isNewPatient;
    }
  }
  
  // Merge appointment info
  if (extracted.appointment) {
    if (!state.appointment.type && extracted.appointment.type) {
      state.appointment.type = extracted.appointment.type;
    }
    if (!state.appointment.preferredDate && extracted.appointment.preferredDate) {
      state.appointment.preferredDate = extracted.appointment.preferredDate;
    }
    if (!state.appointment.preferredTime && extracted.appointment.preferredTime) {
      state.appointment.preferredTime = extracted.appointment.preferredTime;
    }
  }
  
  // Update intent if we got a better one
  if (extracted.intent !== 'unknown' && (!state.intent || state.intent === 'unknown')) {
    state.intent = extracted.intent;
  }
  
  state.updatedAt = new Date();
  
  return state;
}

