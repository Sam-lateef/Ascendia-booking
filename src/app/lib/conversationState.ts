/**
 * Conversation State Management
 * 
 * Stores and manages conversation state independently of the LLM.
 * This allows us to:
 * 1. Track extracted parameters across messages
 * 2. Auto-fill function calls with validated data
 * 3. Switch between different LLM models (GPT, Claude, etc.)
 * 4. Debug and audit conversations
 * 
 * Uses hybrid storage:
 * - In-memory Map for fast reads during active conversations
 * - Supabase for persistence (async writes, sync reads for admin)
 */

import { db } from './db';
import { getSupabaseAdmin, getSupabaseWithOrg } from './supabaseClient';

// ============================================
// TYPES
// ============================================

export interface ExtractedPatientInfo {
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthdate?: string;  // YYYY-MM-DD format
  email?: string;
  patNum?: number;     // Once found/created
  isNewPatient?: boolean;
}

export interface ExtractedAppointmentInfo {
  type?: string;       // cleaning, checkup, filling, etc.
  preferredDate?: string;  // YYYY-MM-DD
  preferredTime?: string;  // morning, afternoon, or specific time
  selectedSlot?: {
    dateTime: string;  // YYYY-MM-DD HH:mm:ss
    provNum: number;
    opNum: number;
  };
  existingAptNum?: number;  // For reschedule/cancel
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ConversationState {
  sessionId: string;
  channel: 'retell' | 'twilio' | 'voice' | 'sms' | 'whatsapp' | 'web'; // Communication channel
  createdAt: Date;
  updatedAt: Date;
  
  // What is the user trying to do?
  intent?: 'book' | 'reschedule' | 'cancel' | 'check' | 'unknown';
  
  // Extracted patient info
  patient: ExtractedPatientInfo;
  
  // Extracted appointment info
  appointment: ExtractedAppointmentInfo;
  
  // Conversation flow tracking
  stage: 'greeting' | 'identifying' | 'gathering' | 'checking_slots' | 'confirming' | 'completed';
  
  // What info do we still need?
  missingRequired: string[];
  
  // Message history for LLM extraction fallback
  messages: ConversationMessage[];
  
  // Function calls made
  functionCalls: Array<{
    timestamp: Date;
    functionName: string;
    parameters: Record<string, any>;
    result?: any;
    error?: string;
  }>;
}

// ============================================
// PARAMETER EXTRACTION
// ============================================

/**
 * Extract patient name from text
 * Handles: "my name is John Smith", "I'm John", "this is Sarah Jones", etc.
 */
export function extractPatientName(text: string): { firstName?: string; lastName?: string } {
  const patterns = [
    /my name is (\w+)\s+(\w+)/i,
    /i'm (\w+)\s+(\w+)/i,
    /this is (\w+)\s+(\w+)/i,
    /name is (\w+)\s+(\w+)/i,
    /i am (\w+)\s+(\w+)/i,
    /(\w+)\s+(\w+) here/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return { firstName: match[1], lastName: match[2] };
    }
  }
  
  // Try single name
  const singleNamePatterns = [
    /my name is (\w+)/i,
    /i'm (\w+)/i,
    /this is (\w+)/i,
  ];
  
  for (const pattern of singleNamePatterns) {
    const match = text.match(pattern);
    if (match) {
      return { firstName: match[1] };
    }
  }
  
  return {};
}

/**
 * Extract phone number from text
 * Handles various formats: 619-555-1234, (619) 555-1234, 6195551234, etc.
 */
export function extractPhoneNumber(text: string): string | undefined {
  // Remove all non-digits
  const digits = text.replace(/\D/g, '');
  
  // Look for 10-digit sequences
  const match = digits.match(/(\d{10})/);
  if (match) {
    return match[1];
  }
  
  return undefined;
}

/**
 * Extract birthdate from text
 * Handles: "August 12, 1988", "12/8/1988", "1988-08-12", "8/12/88", etc.
 */
export function extractBirthdate(text: string): string | undefined {
  // Already in YYYY-MM-DD format
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  
  // MM/DD/YYYY or M/D/YYYY
  const usMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0');
    const day = usMatch[2].padStart(2, '0');
    return `${usMatch[3]}-${month}-${day}`;
  }
  
  // MM/DD/YY (assume 1900s for 50+, 2000s for <50)
  const shortYearMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/);
  if (shortYearMatch) {
    const month = shortYearMatch[1].padStart(2, '0');
    const day = shortYearMatch[2].padStart(2, '0');
    const shortYear = parseInt(shortYearMatch[3]);
    const year = shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear;
    return `${year}-${month}-${day}`;
  }
  
  // Month name formats: "August 12, 1988", "12 August 1988"
  const months: Record<string, string> = {
    'january': '01', 'jan': '01',
    'february': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'sept': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12',
  };
  
  // "August 12, 1988" or "August 12 1988"
  const monthFirstMatch = text.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (monthFirstMatch) {
    const monthStr = monthFirstMatch[1].toLowerCase();
    const month = months[monthStr];
    if (month) {
      const day = monthFirstMatch[2].padStart(2, '0');
      return `${monthFirstMatch[3]}-${month}-${day}`;
    }
  }
  
  // "12 August 1988"
  const dayFirstMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (dayFirstMatch) {
    const monthStr = dayFirstMatch[2].toLowerCase();
    const month = months[monthStr];
    if (month) {
      const day = dayFirstMatch[1].padStart(2, '0');
      return `${dayFirstMatch[3]}-${month}-${day}`;
    }
  }
  
  return undefined;
}

/**
 * Extract appointment type from text
 */
export function extractAppointmentType(text: string): string | undefined {
  const types = [
    { keywords: ['cleaning', 'clean'], type: 'cleaning' },
    { keywords: ['checkup', 'check-up', 'check up', 'exam'], type: 'checkup' },
    { keywords: ['filling', 'fill'], type: 'filling' },
    { keywords: ['crown'], type: 'crown' },
    { keywords: ['root canal'], type: 'root canal' },
    { keywords: ['extraction', 'extract', 'pull'], type: 'extraction' },
    { keywords: ['whitening', 'whiten'], type: 'whitening' },
    { keywords: ['emergency'], type: 'emergency' },
  ];
  
  const lowerText = text.toLowerCase();
  for (const { keywords, type } of types) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return type;
      }
    }
  }
  
  return undefined;
}

/**
 * Extract date preference from text
 * Returns YYYY-MM-DD format
 */
export function extractDatePreference(text: string, referenceDate: Date = new Date()): string | undefined {
  const lowerText = text.toLowerCase();
  
  // Specific date patterns
  const specificMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (specificMatch) {
    const month = specificMatch[1].padStart(2, '0');
    const day = specificMatch[2].padStart(2, '0');
    const year = specificMatch[3] 
      ? (specificMatch[3].length === 2 ? '20' + specificMatch[3] : specificMatch[3])
      : referenceDate.getFullYear().toString();
    return `${year}-${month}-${day}`;
  }
  
  // "December 15" or "Dec 15"
  const months: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
  };
  
  const monthDayMatch = text.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (monthDayMatch) {
    const monthStr = monthDayMatch[1].toLowerCase();
    const monthIndex = months[monthStr];
    if (monthIndex !== undefined) {
      const day = parseInt(monthDayMatch[2]);
      const date = new Date(referenceDate.getFullYear(), monthIndex, day);
      // If date is in the past, assume next year
      if (date < referenceDate) {
        date.setFullYear(date.getFullYear() + 1);
      }
      return date.toISOString().split('T')[0];
    }
  }
  
  // Relative dates
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  if (lowerText.includes('today')) {
    return referenceDate.toISOString().split('T')[0];
  }
  
  if (lowerText.includes('tomorrow')) {
    const tomorrow = new Date(referenceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // "next Monday", "this Friday"
  for (let i = 0; i < dayOfWeek.length; i++) {
    const day = dayOfWeek[i];
    if (lowerText.includes(`next ${day}`) || lowerText.includes(day)) {
      const targetDay = i;
      const currentDay = referenceDate.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) {
        daysToAdd += 7; // Next week
      }
      if (lowerText.includes('next')) {
        daysToAdd += 7; // "next" means the week after
      }
      const targetDate = new Date(referenceDate);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      return targetDate.toISOString().split('T')[0];
    }
  }
  
  return undefined;
}

/**
 * Extract time preference from text
 */
export function extractTimePreference(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('morning')) return 'morning';
  if (lowerText.includes('afternoon')) return 'afternoon';
  if (lowerText.includes('evening')) return 'evening';
  
  // Specific times: "10 AM", "2:30 PM", "10:00"
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] || '00';
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }
  
  return undefined;
}

/**
 * Extract intent from text
 */
export function extractIntent(text: string): ConversationState['intent'] {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('reschedul') || lowerText.includes('move') || lowerText.includes('change')) {
    return 'reschedule';
  }
  if (lowerText.includes('cancel')) {
    return 'cancel';
  }
  if (lowerText.includes('check') || lowerText.includes('when') || lowerText.includes('what time')) {
    return 'check';
  }
  if (lowerText.includes('book') || lowerText.includes('appointment') || lowerText.includes('schedule')) {
    return 'book';
  }
  
  return 'unknown';
}

// ============================================
// CONVERSATION STATE MANAGER
// ============================================

// In-memory store for fast reads during active conversations
const conversationStates = new Map<string, ConversationState>();

// Track Supabase conversation IDs for persistence
const sessionToDbId = new Map<string, string>();

/**
 * Set the database ID for a session (used by WebSocket handlers after creating conversation)
 */
export function setSessionDbId(sessionId: string, dbId: string): void {
  sessionToDbId.set(sessionId, dbId);
  console.log(`[ConversationState] 📝 Set dbId for session ${sessionId}: ${dbId}`);
}

// ============================================
// SUPABASE PERSISTENCE (async, non-blocking)
// ============================================

/**
 * Persist conversation to Supabase (async, fire-and-forget)
 */
async function persistConversationToSupabase(state: ConversationState): Promise<void> {
  try {
    const dbAny = db as any;
    
    // Check if conversation exists
    let dbId: string | undefined = sessionToDbId.get(state.sessionId);
    
    if (!dbId) {
      // Try to find existing
      const { data: existing } = await dbAny
        .from('conversations')
        .select('id')
        .eq('session_id', state.sessionId)
        .single();
      
      if (existing && existing.id) {
        dbId = existing.id as string;
        sessionToDbId.set(state.sessionId, dbId);
      }
    }
    
    const conversationData = {
      session_id: state.sessionId,
      channel: state.channel,
      intent: state.intent || 'unknown',
      stage: state.stage,
      patient_info: state.patient,
      appointment_info: state.appointment,
      missing_required: state.missingRequired,
      updated_at: new Date().toISOString(),
    };
    
    if (dbId) {
      // Update existing
      await dbAny
        .from('conversations')
        .update(conversationData)
        .eq('id', dbId);
    } else {
      // Insert new
      const { data: inserted, error } = await dbAny
        .from('conversations')
        .insert({
          ...conversationData,
          created_at: state.createdAt.toISOString(),
        })
        .select('id')
        .single();
      
      if (inserted && !error) {
        sessionToDbId.set(state.sessionId, inserted.id);
      }
    }
  } catch (error) {
    console.error('[ConversationState] Error persisting to Supabase:', error);
    // Don't throw - persistence is non-blocking
  }
}

/**
 * Persist a message to Supabase
 * Uses admin client to bypass RLS for server-side operations
 */
async function persistMessageToSupabase(
  sessionId: string, 
  message: ConversationMessage,
  sequenceNum: number,
  extractedData: Record<string, any> = {}
): Promise<void> {
  try {
    // Use admin client to bypass RLS for server-side operations (WebSocket handlers)
    const dbAny = getSupabaseAdmin() as any;
    let dbId = sessionToDbId.get(sessionId);
    let orgId: string | null = null;
    
    if (!dbId) {
      // Find conversation ID and org_id
      const { data: conv } = await dbAny
        .from('conversations')
        .select('id, organization_id')
        .eq('session_id', sessionId)
        .single();
      
      if (conv && conv.id) {
        dbId = conv.id as string;
        orgId = conv.organization_id;
        sessionToDbId.set(sessionId, dbId);
      }
    } else {
      // Get org_id from conversation
      const { data: conv } = await dbAny
        .from('conversations')
        .select('organization_id')
        .eq('id', dbId)
        .single();
      if (conv) {
        orgId = conv.organization_id;
      }
    }
    
    if (dbId) {
      const { error } = await dbAny
        .from('conversation_messages')
        .insert({
          conversation_id: dbId,
          organization_id: orgId,  // Required by DB constraint
          role: message.role,
          content: message.content,
          sequence_num: sequenceNum,
          extracted_data: extractedData,
          created_at: message.timestamp.toISOString(),
        });
      
      if (error) {
        console.error(`[ConversationState] Error inserting message ${sequenceNum}:`, error);
      } else {
        console.log(`[ConversationState] ✓ Persisted message ${sequenceNum} (${message.role}): "${message.content.substring(0, 50)}..."`);
      }
    } else {
      console.warn(`[ConversationState] ⚠ No dbId for session ${sessionId}, message not persisted`);
    }
  } catch (error) {
    console.error('[ConversationState] Error persisting message to Supabase:', error);
  }
}

/**
 * Persist a function call to Supabase
 * Uses admin client to bypass RLS for server-side operations
 */
async function persistFunctionCallToSupabase(
  sessionId: string,
  functionName: string,
  parameters: Record<string, any>,
  result?: any,
  error?: string,
  autoFilledParams: Record<string, any> = {}
): Promise<void> {
  try {
    // Use admin client to bypass RLS for server-side operations (WebSocket handlers)
    const dbAny = getSupabaseAdmin() as any;
    let dbId = sessionToDbId.get(sessionId);
    let orgId: string | null = null;
    
    if (!dbId) {
      const { data: conv } = await dbAny
        .from('conversations')
        .select('id, organization_id')
        .eq('session_id', sessionId)
        .single();
      
      if (conv && conv.id) {
        dbId = conv.id as string;
        orgId = conv.organization_id;
        sessionToDbId.set(sessionId, dbId);
      }
    } else {
      // Get org_id from conversation
      const { data: conv } = await dbAny
        .from('conversations')
        .select('organization_id')
        .eq('id', dbId)
        .single();
      if (conv) {
        orgId = conv.organization_id;
      }
    }
    
    if (dbId) {
      const { error: insertError } = await dbAny
        .from('function_calls')
        .insert({
          conversation_id: dbId,
          organization_id: orgId,  // May be required by DB constraint
          function_name: functionName,
          parameters,
          result: result ? JSON.stringify(result).substring(0, 10000) : null, // Limit size
          error,
          auto_filled_params: autoFilledParams,
        });
      
      if (insertError) {
        console.error(`[ConversationState] Error inserting function call ${functionName}:`, insertError);
      } else {
        console.log(`[ConversationState] ✓ Persisted function call: ${functionName}`);
      }
    }
  } catch (err) {
    console.error('[ConversationState] Error persisting function call to Supabase:', err);
  }
}

/**
 * Detect channel from session ID prefix
 */
function detectChannelFromSessionId(sessionId: string): 'voice' | 'sms' | 'whatsapp' | 'web' {
  if (sessionId.startsWith('whatsapp_')) return 'whatsapp';
  if (sessionId.startsWith('lexi_twilio_')) return 'sms';
  if (sessionId.startsWith('twilio_')) return 'voice';
  if (sessionId.startsWith('web_')) return 'web';
  return 'voice'; // Default
}

/**
 * Create or get conversation state for a session
 */
export function getOrCreateState(sessionId: string): ConversationState {
  if (!conversationStates.has(sessionId)) {
    const channel = detectChannelFromSessionId(sessionId);
    
    const newState: ConversationState = {
      sessionId,
      channel,
      createdAt: new Date(),
      updatedAt: new Date(),
      patient: {},
      appointment: {},
      stage: 'greeting',
      missingRequired: [],
      messages: [],
      functionCalls: [],
    };
    conversationStates.set(sessionId, newState);
    
    // Persist to Supabase asynchronously
    persistConversationToSupabase(newState).catch(() => {});
  }
  return conversationStates.get(sessionId)!;
}

/**
 * Update conversation state with extracted info from a message
 * @param sessionId - Session identifier
 * @param message - Message content
 * @param role - Message role (defaults to 'user' for backward compatibility)
 */
export function processMessage(sessionId: string, message: string, role: 'user' | 'assistant' = 'user'): ConversationState {
  const state = getOrCreateState(sessionId);
  state.updatedAt = new Date();
  
  // Ensure role is never null/undefined
  const safeRole = role || 'user';
  
  const newMessage: ConversationMessage = {
    role: safeRole,
    content: message,
    timestamp: new Date(),
  };
  
  // Store message in history (for LLM extraction fallback)
  state.messages.push(newMessage);
  
  // Track what we extract for Supabase
  const extractedData: Record<string, any> = {};
  
  // Only extract from user messages
  if (role === 'user') {
    // Extract all possible information from the message
    const nameInfo = extractPatientName(message);
    if (nameInfo.firstName) {
      state.patient.firstName = nameInfo.firstName;
      extractedData.firstName = nameInfo.firstName;
    }
    if (nameInfo.lastName) {
      state.patient.lastName = nameInfo.lastName;
      extractedData.lastName = nameInfo.lastName;
    }
    
    const phone = extractPhoneNumber(message);
    if (phone) {
      state.patient.phone = phone;
      extractedData.phone = phone;
    }
    
    const birthdate = extractBirthdate(message);
    if (birthdate) {
      state.patient.birthdate = birthdate;
      extractedData.birthdate = birthdate;
    }
    
    const aptType = extractAppointmentType(message);
    if (aptType) {
      state.appointment.type = aptType;
      extractedData.appointmentType = aptType;
    }
    
    const datePreference = extractDatePreference(message);
    if (datePreference) {
      state.appointment.preferredDate = datePreference;
      extractedData.preferredDate = datePreference;
    }
    
    const timePreference = extractTimePreference(message);
    if (timePreference) {
      state.appointment.preferredTime = timePreference;
      extractedData.preferredTime = timePreference;
    }
    
    const intent = extractIntent(message);
    if (intent !== 'unknown' || !state.intent) {
      state.intent = intent;
      extractedData.intent = intent;
    }
    
    // Check for "new patient" indication
    if (message.toLowerCase().includes('new patient') || message.toLowerCase().includes("i'm new")) {
      state.patient.isNewPatient = true;
      extractedData.isNewPatient = true;
    }
    
    // Update missing required based on intent
    updateMissingRequired(state);
  }
  
  // Persist to Supabase asynchronously
  // IMPORTANT: Persist conversation FIRST, then messages (messages need conversation_id)
  const sequenceNum = state.messages.length;
  persistConversationToSupabase(state)
    .then(() => persistMessageToSupabase(sessionId, newMessage, sequenceNum, extractedData))
    .catch((err) => console.error('[ConversationState] Persist error:', err));
  
  return state;
}

/**
 * Update the list of missing required parameters
 */
function updateMissingRequired(state: ConversationState): void {
  const missing: string[] = [];
  
  // Always need patient identification
  if (!state.patient.patNum && !state.patient.firstName && !state.patient.phone) {
    missing.push('patient_name_or_phone');
  }
  
  // For new bookings
  if (state.intent === 'book') {
    if (!state.appointment.type) missing.push('appointment_type');
    if (!state.appointment.preferredDate) missing.push('preferred_date');
    if (!state.appointment.preferredTime) missing.push('preferred_time');
    
    // If new patient
    if (state.patient.isNewPatient) {
      if (!state.patient.birthdate) missing.push('birthdate');
      if (!state.patient.phone) missing.push('phone');
    }
  }
  
  // For reschedules
  if (state.intent === 'reschedule') {
    if (!state.appointment.existingAptNum && !state.patient.patNum) {
      missing.push('patient_identification');
    }
  }
  
  state.missingRequired = missing;
}

/**
 * Record a function call and its result
 */
export function recordFunctionCall(
  sessionId: string, 
  functionName: string, 
  parameters: Record<string, any>,
  result?: any,
  error?: string,
  autoFilledParams: Record<string, any> = {}
): void {
  const state = getOrCreateState(sessionId);
  state.functionCalls.push({
    timestamp: new Date(),
    functionName,
    parameters,
    result,
    error,
  });
  
  // Update state based on function results
  if (result && !error) {
    if (functionName === 'GetMultiplePatients' && result.length > 0) {
      state.patient.patNum = result[0].PatNum;
      state.patient.firstName = result[0].FName;
      state.patient.lastName = result[0].LName;
    }
    if (functionName === 'CreatePatient' && result.PatNum) {
      state.patient.patNum = result.PatNum;
    }
    if (functionName === 'GetAppointments' && Array.isArray(result) && result.length > 0) {
      // Store the first appointment's AptNum for reschedule/update operations
      // Filter to only scheduled appointments (not cancelled/broken)
      const scheduledApts = result.filter((apt: any) => 
        apt.AptStatus === 'Scheduled' || apt.AptStatus === 'scheduled'
      );
      if (scheduledApts.length > 0) {
        state.appointment.existingAptNum = scheduledApts[0].AptNum;
        console.log(`[ConversationState] Stored AptNum ${scheduledApts[0].AptNum} from GetAppointments result`);
      } else if (result.length > 0) {
        // Fallback to first appointment if no scheduled ones
        state.appointment.existingAptNum = result[0].AptNum;
        console.log(`[ConversationState] Stored AptNum ${result[0].AptNum} from GetAppointments result (fallback)`);
      }
    }
    if (functionName === 'CreateAppointment' && result.AptNum) {
      // Store newly created appointment
      state.appointment.existingAptNum = result.AptNum;
      state.stage = 'completed';
      console.log(`[ConversationState] Stored AptNum ${result.AptNum} from CreateAppointment result`);
    }
    if (functionName === 'UpdateAppointment') {
      state.stage = 'completed';
    }
  }
  
  state.updatedAt = new Date();
  
  // Persist to Supabase asynchronously
  persistFunctionCallToSupabase(sessionId, functionName, parameters, result, error, autoFilledParams).catch(() => {});
  persistConversationToSupabase(state).catch(() => {});
}

/**
 * Get parameters for a function call, auto-filling from conversation state
 */
export function getAutoFilledParameters(
  sessionId: string, 
  functionName: string
): Record<string, any> {
  const state = getOrCreateState(sessionId);
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
      // Don't default ProvNum/OpNum - let GetAvailableSlots search ALL providers/rooms
      // Patients can choose provider, room will be auto-assigned when booking
      break;
      
    case 'CreateAppointment':
      if (state.patient.patNum) params.PatNum = state.patient.patNum;
      if (state.appointment.selectedSlot) {
        params.AptDateTime = state.appointment.selectedSlot.dateTime;
        params.ProvNum = state.appointment.selectedSlot.provNum;
        params.Op = state.appointment.selectedSlot.opNum;
        console.log('[ConversationState] Auto-filling CreateAppointment from selectedSlot:', {
          AptDateTime: params.AptDateTime,
          ProvNum: params.ProvNum,
          Op: params.Op
        });
      } else {
        console.warn('[ConversationState] ⚠️ CreateAppointment called but no selectedSlot in state');
        // Note: Op will be dynamically fetched in the booking API route
        // Don't set a default here - let the API fetch the first active operatory
      }
      if (state.appointment.type) params.Note = state.appointment.type;
      break;
      
    case 'GetAppointments':
      if (state.patient.patNum) params.PatNum = state.patient.patNum;
      break;
      
    case 'UpdateAppointment':
      // Auto-fill AptNum from stored appointment
      if (state.appointment.existingAptNum) {
        params.AptNum = state.appointment.existingAptNum;
        console.log(`[ConversationState] Auto-filling AptNum: ${state.appointment.existingAptNum}`);
      }
      // Also fill PatNum if available
      if (state.patient.patNum) params.PatNum = state.patient.patNum;
      break;
      
    case 'BreakAppointment':
    case 'DeleteAppointment':
      // Auto-fill AptNum for cancel operations too
      if (state.appointment.existingAptNum) {
        params.AptNum = state.appointment.existingAptNum;
      }
      break;
  }
  
  return params;
}

/**
 * Clear conversation state (e.g., when conversation ends)
 */
export function clearState(sessionId: string): void {
  conversationStates.delete(sessionId);
}

/**
 * Get conversation history for LLM extraction
 */
export function getConversationHistory(sessionId: string): ConversationMessage[] {
  const state = getOrCreateState(sessionId);
  return state.messages;
}

/**
 * Add a message to conversation history (useful when messages come from external source)
 */
export function addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string): void {
  const state = getOrCreateState(sessionId);
  
  // Ensure role is never null/undefined - default to 'assistant' for system messages
  const safeRole = role || 'assistant';
  
  const newMessage: ConversationMessage = {
    role: safeRole as 'user' | 'assistant',
    content,
    timestamp: new Date(),
  };
  state.messages.push(newMessage);
  state.updatedAt = new Date();
  
  // Persist to Supabase asynchronously
  // IMPORTANT: Persist conversation FIRST, then messages (messages need conversation_id)
  const sequenceNum = state.messages.length;
  persistConversationToSupabase(state)
    .then(() => persistMessageToSupabase(sessionId, newMessage, sequenceNum, {}))
    .catch((err) => console.error('[ConversationState] Persist error:', err));
}

/**
 * Get summary of conversation state for debugging
 */
export function getStateSummary(sessionId: string): string {
  const state = getOrCreateState(sessionId);
  
  return `
Session: ${sessionId}
Intent: ${state.intent || 'unknown'}
Stage: ${state.stage}

Patient Info:
  - Name: ${state.patient.firstName || '?'} ${state.patient.lastName || '?'}
  - Phone: ${state.patient.phone || '?'}
  - DOB: ${state.patient.birthdate || '?'}
  - PatNum: ${state.patient.patNum || 'not found'}
  - New Patient: ${state.patient.isNewPatient ? 'yes' : 'no'}

Appointment Info:
  - Type: ${state.appointment.type || '?'}
  - Preferred Date: ${state.appointment.preferredDate || '?'}
  - Preferred Time: ${state.appointment.preferredTime || '?'}
  - Selected Slot: ${state.appointment.selectedSlot ? state.appointment.selectedSlot.dateTime : 'none'}

Missing: ${state.missingRequired.join(', ') || 'nothing'}
Function Calls: ${state.functionCalls.length}
`.trim();
}

/**
 * Get all conversations (for admin view)
 * Returns conversations sorted by most recent first
 */
export function getAllConversations(): ConversationState[] {
  const conversations = Array.from(conversationStates.values());
  return conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Get conversations for a specific date
 */
export function getConversationsByDate(date: string): ConversationState[] {
  const targetDate = new Date(date + 'T00:00:00');
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  return getAllConversations().filter(conv => {
    const convDate = conv.createdAt;
    return convDate >= targetDate && convDate < nextDay;
  });
}

/**
 * Export conversation for external storage/display
 */
export interface ConversationExport {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  intent: string;
  stage: string;
  patientName: string;
  patientPhone: string;
  patientId: number | null;
  appointmentType: string;
  appointmentDate: string;
  messageCount: number;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
  functionCallCount: number;
  functionCalls: Array<{
    timestamp: string;
    functionName: string;
    parameters: Record<string, any>;
    result?: any;
    error?: string;
  }>;
  outcome: 'completed' | 'in_progress' | 'abandoned';
  channel?: 'voice' | 'sms' | 'whatsapp' | 'web';  // Communication channel
  transcript?: string;  // Full conversation transcript from Retell
  durationMs?: number;  // Call duration
  callAnalysis?: any;   // Post-call analysis from Retell
  recordingUrl?: string;  // Recording URL
  publicLogUrl?: string;  // Public log URL
  disconnectionReason?: string;  // Why call ended
}

export function exportConversation(state: ConversationState): ConversationExport {
  const patientName = [state.patient.firstName, state.patient.lastName]
    .filter(Boolean)
    .join(' ') || 'Unknown';
  
  let outcome: 'completed' | 'in_progress' | 'abandoned' = 'in_progress';
  if (state.stage === 'completed') {
    outcome = 'completed';
  } else if (state.messages.length > 0) {
    const lastMessageTime = state.messages[state.messages.length - 1].timestamp;
    const minutesAgo = (Date.now() - lastMessageTime.getTime()) / 1000 / 60;
    if (minutesAgo > 30) {
      outcome = 'abandoned';
    }
  }
  
  return {
    sessionId: state.sessionId,
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
    intent: state.intent || 'unknown',
    stage: state.stage,
    patientName,
    patientPhone: state.patient.phone || '',
    patientId: state.patient.patNum || null,
    appointmentType: state.appointment.type || '',
    appointmentDate: state.appointment.selectedSlot?.dateTime || state.appointment.preferredDate || '',
    messageCount: state.messages.length,
    messages: state.messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    })),
    functionCallCount: state.functionCalls.length,
    functionCalls: state.functionCalls.map(fc => ({
      timestamp: fc.timestamp.toISOString(),
      functionName: fc.functionName,
      parameters: fc.parameters,
      result: fc.result,
      error: fc.error,
    })),
    outcome,
  };
}

/**
 * Get all conversations exported for admin view
 */
export function getAllConversationsExported(): ConversationExport[] {
  return getAllConversations().map(exportConversation);
}

/**
 * Get conversations for a specific date, exported
 */
export function getConversationsByDateExported(date: string): ConversationExport[] {
  return getConversationsByDate(date).map(exportConversation);
}

// ============================================
// SUPABASE QUERIES (async, for admin views)
// ============================================

/**
 * Get conversations from Supabase for a specific date (async)
 * This includes historical data not in memory
 */
export async function getConversationsFromSupabase(date: string, organizationId?: string): Promise<ConversationExport[]> {
  try {
    // Query conversations for the date
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;
    
    console.log(`[ConversationState] Querying for date=${date}, org=${organizationId}, range: ${startOfDay} to ${endOfDay}`);
    
    // Use getSupabaseWithOrg for defense-in-depth security:
    // Sets RLS context so all queries are automatically filtered by org
    // Even if we forget manual filter, RLS protects us!
    const dbAny = organizationId 
      ? await getSupabaseWithOrg(organizationId) as any
      : getSupabaseAdmin() as any;
    
    let query = dbAny
      .from('conversations')
      .select('*')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);
    
    // Manual filter as additional safety (redundant with RLS but explicit is good)
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    
    const { data: conversations, error: convError } = await query
      .order('created_at', { ascending: false });
    
    console.log(`[ConversationState] Query returned ${conversations?.length || 0} conversations`);
    if (conversations && conversations.length > 0) {
      console.log('[ConversationState] First conversation:', {
        id: conversations[0].id,
        call_id: conversations[0].call_id,
        created_at: conversations[0].created_at,
        organization_id: conversations[0].organization_id
      });
    }
    
    if (convError || !conversations) {
      console.error('[ConversationState] Error fetching from Supabase:', convError);
      // Fallback to in-memory
      return getConversationsByDateExported(date);
    }
    
    // Get messages and function calls for each conversation
    const exports: ConversationExport[] = [];
    
    for (const conv of conversations) {
      // Get messages
      const { data: messages } = await dbAny
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('sequence_num', { ascending: true });
      
      // Get function calls
      const { data: functionCalls } = await dbAny
        .from('function_calls')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      
      // Build patient name
      const patientInfo = conv.patient_info || {};
      const patientName = [patientInfo.firstName, patientInfo.lastName]
        .filter(Boolean)
        .join(' ') || 'Unknown';
      
      // Determine outcome - check both stage and call_status
      let outcome: 'completed' | 'in_progress' | 'abandoned' = 'in_progress';
      const callStatus = conv.call_status;
      if (conv.stage === 'completed' || callStatus === 'ended' || callStatus === 'completed') {
        outcome = 'completed';
      } else if (messages && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        const lastTime = new Date(lastMsg.created_at);
        const minutesAgo = (Date.now() - lastTime.getTime()) / 1000 / 60;
        if (minutesAgo > 30) {
          outcome = 'abandoned';
        }
      }
      
      exports.push({
        sessionId: conv.session_id,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        intent: conv.intent || 'unknown',
        stage: conv.stage || 'unknown',
        patientName,
        patientPhone: patientInfo.phone || '',
        patientId: patientInfo.patNum || null,
        appointmentType: conv.appointment_info?.type || '',
        appointmentDate: conv.appointment_info?.selectedSlot?.dateTime || conv.appointment_info?.preferredDate || '',
        messageCount: messages?.length || 0,
        messages: (messages || []).map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
        })),
        functionCallCount: functionCalls?.length || 0,
        functionCalls: (functionCalls || []).map((fc: any) => {
          let result = undefined;
          if (fc.result) {
            try {
              result = typeof fc.result === 'string' ? JSON.parse(fc.result) : fc.result;
            } catch {
              // If JSON parsing fails (truncated data), use as string
              result = { _truncated: true, preview: String(fc.result).substring(0, 200) };
            }
          }
          return {
            timestamp: fc.created_at,
            functionName: fc.function_name,
            parameters: fc.parameters || {},
            result,
            error: fc.error,
          };
        }),
        outcome,
        channel: conv.channel || undefined,
        transcript: conv.transcript || undefined,
        durationMs: conv.duration_ms || undefined,
        callAnalysis: conv.call_analysis || undefined,
        recordingUrl: conv.recording_url || undefined,
        publicLogUrl: conv.public_log_url || undefined,
        disconnectionReason: conv.disconnection_reason || undefined,
      });
    }
    
    // Also include any in-memory conversations not yet in Supabase
    const memoryConversations = getConversationsByDateExported(date);
    for (const memConv of memoryConversations) {
      if (!exports.find(e => e.sessionId === memConv.sessionId)) {
        exports.push(memConv);
      }
    }
    
    // Sort by created time descending
    exports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return exports;
  } catch (error) {
    console.error('[ConversationState] Error in getConversationsFromSupabase:', error);
    // Fallback to in-memory
    return getConversationsByDateExported(date);
  }
}

/**
 * Get all conversations from Supabase (async)
 */
export async function getAllConversationsFromSupabase(organizationId?: string): Promise<ConversationExport[]> {
  try {
    // Use getSupabaseWithOrg for defense-in-depth security
    const dbAny = organizationId 
      ? await getSupabaseWithOrg(organizationId) as any
      : getSupabaseAdmin() as any;
    
    let query = dbAny
      .from('conversations')
      .select('*');
    
    // Manual filter as additional safety (redundant with RLS but explicit is good)
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    
    const { data: conversations, error } = await query
      .order('created_at', { ascending: false })
      .limit(100); // Limit for performance
    
    if (error || !conversations) {
      return getAllConversationsExported();
    }
    
    // For each conversation, get messages and function calls
    const exports: ConversationExport[] = [];
    
    for (const conv of conversations) {
      const { data: messages } = await dbAny
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('sequence_num', { ascending: true });
      
      const { data: functionCalls } = await dbAny
        .from('function_calls')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      
      const patientInfo = conv.patient_info || {};
      const patientName = [patientInfo.firstName, patientInfo.lastName]
        .filter(Boolean)
        .join(' ') || 'Unknown';
      
      // Determine outcome - check both stage and call_status
      let outcome: 'completed' | 'in_progress' | 'abandoned' = 'in_progress';
      const callStatus = conv.call_status;
      if (conv.stage === 'completed' || callStatus === 'ended' || callStatus === 'completed') {
        outcome = 'completed';
      } else if (messages && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        const lastTime = new Date(lastMsg.created_at);
        const minutesAgo = (Date.now() - lastTime.getTime()) / 1000 / 60;
        if (minutesAgo > 30) {
          outcome = 'abandoned';
        }
      }
      
      exports.push({
        sessionId: conv.session_id,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        intent: conv.intent || 'unknown',
        stage: conv.stage || 'unknown',
        patientName,
        patientPhone: patientInfo.phone || '',
        patientId: patientInfo.patNum || null,
        appointmentType: conv.appointment_info?.type || '',
        appointmentDate: conv.appointment_info?.selectedSlot?.dateTime || conv.appointment_info?.preferredDate || '',
        messageCount: messages?.length || 0,
        messages: (messages || []).map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
        })),
        functionCallCount: functionCalls?.length || 0,
        functionCalls: (functionCalls || []).map((fc: any) => {
          let result = undefined;
          if (fc.result) {
            try {
              result = typeof fc.result === 'string' ? JSON.parse(fc.result) : fc.result;
            } catch {
              // If JSON parsing fails (truncated data), use as string
              result = { _truncated: true, preview: String(fc.result).substring(0, 200) };
            }
          }
          return {
            timestamp: fc.created_at,
            functionName: fc.function_name,
            parameters: fc.parameters || {},
            result,
            error: fc.error,
          };
        }),
        outcome,
        channel: conv.channel || undefined,
        transcript: conv.transcript || undefined,
        durationMs: conv.duration_ms || undefined,
        callAnalysis: conv.call_analysis || undefined,
        recordingUrl: conv.recording_url || undefined,
        publicLogUrl: conv.public_log_url || undefined,
        disconnectionReason: conv.disconnection_reason || undefined,
      });
    }
    
    return exports;
  } catch (error) {
    console.error('[ConversationState] Error in getAllConversationsFromSupabase:', error);
    return getAllConversationsExported();
  }
}

// ============================================
// WORKFLOW ENGINE INTEGRATION - REMOVED



