/**
 * STANDARD MODE - Two-Agent Twilio WebSocket Handler
 * 
 * Cost-optimized version using:
 * - Lexi (gpt-4o-mini-realtime) - handles conversation naturally
 * - Supervisor (gpt-4o via Responses API) - handles actual tool execution
 * 
 * This approach reduces costs significantly compared to Premium mode:
 * - gpt-4o-mini for realtime conversation (60-80% cheaper than gpt-4o)
 * - gpt-4o supervisor only called when actions are needed
 * - Maintains quality for complex booking operations
 */

import WebSocket from 'ws';
import { callSupervisor } from '@/app/agentConfigs/embeddedBooking/supervisorAgent';
import { dentalOfficeInfo } from '@/app/agentConfigs/openDental/dentalOfficeData';
import { 
  processMessage, 
  addMessage, 
  recordFunctionCall,
  getOrCreateState,
  extractTimePreference,
} from '@/app/lib/conversationState';
import { getCachedDefaultOrganizationId } from '@/app/lib/callHelpers';
import { getChannelConfig } from '@/app/lib/channelConfigLoader';

interface TwilioMessage {
  event: string;
  sequenceNumber?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  mark?: {
    name: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

// ============================================
// LEXI CHAT AGENT INSTRUCTIONS (gpt-4o-mini)
// ============================================
// COMPREHENSIVE PREMIUM-QUALITY INSTRUCTIONS
// Fallback instructions - only used if DB instructions are not configured

const lexiChatInstructions = `ERROR: No receptionist instructions configured. Please configure receptionist instructions in Admin > Settings > Channels > Twilio.`;

// ============================================
// LEXI CHAT AGENT TOOL
// ============================================

const lexiTools = [
  {
    type: 'function',
    name: 'getNextResponseFromSupervisor',
    description: 'Ask the supervisor agent to handle complex requests like patient lookup, scheduling, rescheduling, or canceling. Returns a response to speak to the patient.',
    parameters: {
      type: 'object',
      properties: {
        relevantContextFromLastUserMessage: {
          type: 'string',
          description: 'Key information from the user (phone number, dates, times, preferences). Be concise.',
        },
      },
      required: ['relevantContextFromLastUserMessage'],
    },
  },
];

// ============================================
// SLOT SELECTION HELPER
// ============================================

/**
 * Match a time mention in conversation to an available slot
 * Handles formats like: "9 AM", "10:30", "2 PM", "nine o'clock", etc.
 */
function matchTimeToSlot(
  text: string, 
  slots: Array<{ AptDateTime: string; ProvNum: number; Op: number }>
): { AptDateTime: string; ProvNum: number; Op: number } | null {
  if (!text || !slots || slots.length === 0) return null;
  
  const lowerText = text.toLowerCase();
  
  // Parse various time formats from text
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)?/i,  // 10:30, 10:30 AM
    /(\d{1,2})\s*(am|pm)/i,            // 10 AM, 2 PM
    /(nine|ten|eleven|twelve|one|two|three|four|five|six|seven|eight)\s*(am|pm)?/i,  // nine AM
  ];
  
  const wordToNumber: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
    'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12
  };
  
  let targetHour: number | null = null;
  let targetMinute = 0;
  
  // Try to extract time from text
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1] && /^\d+$/.test(match[1])) {
        // Numeric hour
        targetHour = parseInt(match[1]);
        targetMinute = match[2] ? parseInt(match[2]) : 0;
        
        // Handle AM/PM
        const ampm = match[3]?.toLowerCase() || match[2]?.toLowerCase();
        if (ampm === 'pm' && targetHour < 12) targetHour += 12;
        if (ampm === 'am' && targetHour === 12) targetHour = 0;
      } else if (match[1]) {
        // Word hour
        const wordHour = match[1].toLowerCase();
        targetHour = wordToNumber[wordHour] || null;
        
        if (targetHour !== null) {
          const ampm = match[2]?.toLowerCase();
          if (ampm === 'pm' && targetHour < 12) targetHour += 12;
          if (ampm === 'am' && targetHour === 12) targetHour = 0;
        }
      }
      
      if (targetHour !== null) break;
    }
  }
  
  // If we found a time, match it to a slot
  if (targetHour !== null) {
    // Try exact match first
    for (const slot of slots) {
      const slotDate = new Date(slot.AptDateTime);
      const slotHour = slotDate.getHours();
      const slotMinute = slotDate.getMinutes();
      
      if (slotHour === targetHour && slotMinute === targetMinute) {
        console.log(`[Slot Matcher] 🎯 Exact match: ${targetHour}:${targetMinute.toString().padStart(2, '0')} → ${slot.AptDateTime}`);
        return slot;
      }
    }
    
    // Try hour-only match (ignore minutes)
    for (const slot of slots) {
      const slotDate = new Date(slot.AptDateTime);
      const slotHour = slotDate.getHours();
      
      if (slotHour === targetHour) {
        console.log(`[Slot Matcher] 🎯 Hour match: ${targetHour}:xx → ${slot.AptDateTime}`);
        return slot;
      }
    }
  }
  
  // Fallback: look for keywords like "first", "second", "last"
  if (lowerText.includes('first') || lowerText.includes('1st')) {
    console.log('[Slot Matcher] 🎯 Keyword match: first slot');
    return slots[0];
  }
  if (lowerText.includes('second') || lowerText.includes('2nd')) {
    console.log('[Slot Matcher] 🎯 Keyword match: second slot');
    return slots[1] || slots[0];
  }
  if (lowerText.includes('last')) {
    console.log('[Slot Matcher] 🎯 Keyword match: last slot');
    return slots[slots.length - 1];
  }
  
  // Check for "morning", "afternoon", "evening"
  if (lowerText.includes('morning')) {
    const morningSlot = slots.find(s => {
      const hour = new Date(s.AptDateTime).getHours();
      return hour >= 6 && hour < 12;
    });
    if (morningSlot) {
      console.log('[Slot Matcher] 🎯 Time period match: morning');
      return morningSlot;
    }
  }
  if (lowerText.includes('afternoon')) {
    const afternoonSlot = slots.find(s => {
      const hour = new Date(s.AptDateTime).getHours();
      return hour >= 12 && hour < 17;
    });
    if (afternoonSlot) {
      console.log('[Slot Matcher] 🎯 Time period match: afternoon');
      return afternoonSlot;
    }
  }
  
  console.log('[Slot Matcher] ❌ No match found for:', text.substring(0, 100));
  return null;
}

// ============================================
// CONNECTION STATE
// ============================================

interface ConnectionState {
  streamSid: string | null;
  callSid: string | null;
  openaiWs: WebSocket | null;
  openaiReady: boolean;
  audioQueue: string[];
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  // Track booking state to avoid duplicate operations across supervisor calls
  bookingState: {
    // Patient info
    patNum?: number;
    phone?: string;
    firstName?: string;
    lastName?: string;
    // Appointment info
    aptNum?: number;  // Created or existing appointment
    // Slot selection
    availableSlots?: Array<{ AptDateTime: string; ProvNum: number; Op: number }>;
    selectedSlot?: { AptDateTime: string; ProvNum: number; Op: number };
    // Track what's been done
    patientLookedUp?: boolean;
    slotsQueried?: boolean;
    appointmentCreated?: boolean;
  };
}

/**
 * Handle a Twilio Media Stream WebSocket connection (Standard Mode)
 * 
 * @param twilioWs - WebSocket connection to Twilio
 * @param urlOrgId - Organization ID from URL parameters
 * @param initialCallSid - Call SID from URL parameters
 * @param fromNumber - Caller phone number
 * @param toNumber - Called phone number (Twilio number)
 */
async function handleTwilioConnectionStandard(
  twilioWs: WebSocket,
  urlOrgId?: string | null,
  initialCallSid?: string | null,
  fromNumber?: string | null,
  toNumber?: string | null
) {
  console.log('[Standard WS] 🟢 Client connected');

  // Organization ID - prefer URL param, can be overridden by customParameters in start message
  let organizationId: string = urlOrgId || '';
  
  // Load channel configuration and instructions
  let receptionistInstructionsToUse = lexiChatInstructions; // Default hardcoded
  let supervisorInstructionsToUse: string | undefined = undefined;
  let dataIntegrations: string[] = [];
  const modelName = 'gpt-4o-mini-realtime-preview-2024-12-17'; // Default for standard mode
  let configLoaded = false;
  
  // Function to load config - called when we have org ID
  async function loadChannelConfig() {
    if (configLoaded) return;
    configLoaded = true;
    
    try {
      // Use provided org ID or fall back to default
      if (!organizationId) {
        organizationId = await getCachedDefaultOrganizationId();
        console.warn('[Standard WS] ⚠️ No org ID provided, using default:', organizationId);
      } else {
        console.log('[Standard WS] 📋 Using org ID:', organizationId);
      }
      
      if (organizationId) {
        // Load channel configuration
        const channelConfig = await getChannelConfig(organizationId, 'twilio');
        
        // Check if enabled
        if (!channelConfig.enabled) {
          console.log('[Standard WS] ⚠️ Twilio channel is disabled for this organization');
        }
        
        // Store data integrations
        dataIntegrations = channelConfig.data_integrations || [];
        
        // Log channel config
        console.log(`[Standard WS] 📋 Channel config: backend=${channelConfig.ai_backend}, integrations=${dataIntegrations.join(',') || 'none'}`);
        
        // Load TWO-AGENT MODE instructions from DB
        // Receptionist (Lexi) and Supervisor have SEPARATE instruction fields
        
        // Load receptionist instructions
        if (channelConfig.receptionist_instructions) {
          receptionistInstructionsToUse = channelConfig.receptionist_instructions;
          console.log('[Standard WS] 📋 Receptionist: Using DB instructions (receptionist_instructions field)');
        } else {
          console.log('[Standard WS] 📋 Receptionist: Using hardcoded instructions (no DB config)');
        }
        
        // Load supervisor instructions
        if (channelConfig.supervisor_instructions) {
          supervisorInstructionsToUse = channelConfig.supervisor_instructions;
          console.log('[Standard WS] 📋 Supervisor: Using DB instructions (supervisor_instructions field)');
        } else {
          console.log('[Standard WS] 📋 Supervisor: Using hardcoded instructions (no DB config)');
        }
      }
    } catch (error) {
      console.warn('[Standard WS] ⚠️ Failed to load config, using hardcoded:', error);
    }
  }
  
  // Load config immediately if we have org ID from URL
  if (urlOrgId) {
    await loadChannelConfig();
  }

  const state: ConnectionState = {
    streamSid: null,
    callSid: null,
    openaiWs: null,
    openaiReady: false,
    audioQueue: [],
    conversationHistory: [],
    bookingState: {},
  };

  // Create OpenAI Realtime WebSocket (gpt-4o-mini for chat)
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('[Standard WS] ❌ OPENAI_API_KEY not configured');
    twilioWs.close();
    return;
  }

  try {
    // Standard mode always uses gpt-4o-mini-realtime for cost optimization
    console.log(`[Standard WS] 🔌 Connecting to OpenAI Realtime with model: ${modelName}`);
    
    state.openaiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${modelName}`,
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      }
    );

    state.openaiWs.on('open', () => {
      console.log('[Standard WS] ✅ Connected to OpenAI Realtime (gpt-4o-mini)');
      
      // Configure session
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: receptionistInstructionsToUse,
          voice: 'sage',
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: {
            model: 'gpt-4o-mini-transcribe',
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,           // How loud to detect speech (0.0-1.0)
            prefix_padding_ms: 300,   // Audio to include before speech
            silence_duration_ms: 700, // Wait 700ms of silence before ending turn (increased from 200ms)
          },
          tools: lexiTools.map(tool => ({
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      };

      state.openaiWs!.send(JSON.stringify(sessionUpdate));
      console.log('[Standard WS] 📤 Session configured (two-agent mode)');

      // Mark OpenAI as ready and process queued audio
      state.openaiReady = true;
      if (state.audioQueue.length > 0) {
        console.log(`[Standard WS] 📦 Processing ${state.audioQueue.length} queued audio packets`);
        for (const audioPayload of state.audioQueue) {
          state.openaiWs!.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: audioPayload,
          }));
        }
        state.audioQueue.length = 0;
      }

      // CRITICAL: Trigger the initial greeting immediately after session is configured
      // The instructions tell the model to greet when the call starts, but we need to 
      // explicitly trigger a response for the model to start speaking
      console.log('[Standard WS] 🎤 Triggering initial greeting...');
      state.openaiWs!.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: 'Start the conversation by greeting the caller warmly.',
        },
      }));
    });

    state.openaiWs.on('message', async (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString());

        // Log key events for debugging (skip only the most verbose ones)
        const skipLogEvents = [
          'response.audio.delta',
          'response.audio_transcript.delta',
          'conversation.item.input_audio_transcription.delta',
          'response.function_call_arguments.delta',
          'input_audio_buffer.speech_started',
          'input_audio_buffer.speech_stopped',
          'input_audio_buffer.committed',
          'rate_limits.updated',
        ];
        if (!skipLogEvents.includes(response.type)) {
          console.log('[Standard WS] 📨 OpenAI event:', response.type);
        }

        if (response.type === 'session.updated') {
          console.log('[Standard WS] ✅ Session updated successfully');
        }

        // Audio from OpenAI → Twilio
        if (response.type === 'response.audio.delta' && response.delta) {
          // Audio delta logging removed - too verbose
          if (twilioWs.readyState === WebSocket.OPEN && state.streamSid) {
            twilioWs.send(JSON.stringify({
              event: 'media',
              streamSid: state.streamSid,
              media: { payload: response.delta }
            }));
          } else {
            console.log('[Standard WS] ⚠️ Cannot send audio - Twilio not ready or no streamSid');
          }
        }

        // Handle getNextResponseFromSupervisor tool call
        if (response.type === 'response.function_call_arguments.done') {
          if (response.name === 'getNextResponseFromSupervisor') {
            console.log('[Standard WS] Calling supervisor...');
            
            try {
              const args = JSON.parse(response.arguments);
              let context = args.relevantContextFromLastUserMessage || '';

              // CRITICAL: Check if patient just chose a time (before building state context)
              if (state.bookingState.availableSlots && !state.bookingState.selectedSlot && !state.bookingState.aptNum) {
                const lastUserMessage = state.conversationHistory.filter(m => m.role === 'user').pop()?.content || '';
                const matchedSlot = matchTimeToSlot(lastUserMessage, state.bookingState.availableSlots);
                if (matchedSlot) {
                  state.bookingState.selectedSlot = matchedSlot;
                  console.log('[Standard WS] 🎯 Patient chose time from conversation:', matchedSlot.AptDateTime);
                  
                  // CRITICAL: Sync to ConversationState so booking API can auto-fill
                  if (state.callSid) {
                    const convState = getOrCreateState(`standard_${state.callSid}`);
                    convState.appointment.selectedSlot = {
                      dateTime: matchedSlot.AptDateTime,
                      provNum: matchedSlot.ProvNum,
                      opNum: matchedSlot.Op
                    };
                    console.log('[Standard WS] 🔄 Synced selectedSlot to ConversationState');
                  }
                }
              }
              
              // CRITICAL: Build booking state context to avoid duplicate operations
              const stateContext: string[] = [];
              
              if (state.bookingState.patNum) {
                stateContext.push(`[EXISTING PATIENT - PatNum: ${state.bookingState.patNum}] - DO NOT call CreatePatient or GetMultiplePatients again`);
              }
              if (state.bookingState.phone) {
                stateContext.push(`[Patient phone: ${state.bookingState.phone}]`);
              }
              if (state.bookingState.firstName || state.bookingState.lastName) {
                stateContext.push(`[Patient name: ${state.bookingState.firstName || ''} ${state.bookingState.lastName || ''}]`);
              }
              if (state.bookingState.availableSlots && state.bookingState.availableSlots.length > 0) {
                stateContext.push(`[AVAILABLE SLOTS already queried - DO NOT call GetAvailableSlots again unless patient wants different date]`);
                stateContext.push(`[Slots: ${JSON.stringify(state.bookingState.availableSlots.slice(0, 5))}]`);
              }
              if (state.bookingState.selectedSlot) {
                stateContext.push(`[SELECTED SLOT: ${JSON.stringify(state.bookingState.selectedSlot)}] - USE THIS for CreateAppointment`);
              }
              if (state.bookingState.aptNum) {
                stateContext.push(`[APPOINTMENT CREATED - AptNum: ${state.bookingState.aptNum}] - DO NOT call CreateAppointment again`);
              }
              
              if (stateContext.length > 0) {
                context = `=== BOOKING STATE (from previous calls) ===\n${stateContext.join('\n')}\n\n=== NEW REQUEST ===\n${context}`;
                console.log('[Standard WS] 📋 Including booking state:', stateContext.length, 'items');
              }

              // Call supervisor agent (gpt-4o)
              const result = await callSupervisor(
                state.conversationHistory,
                context,
                `standard_${state.callSid}`,
                supervisorInstructionsToUse,
                organizationId  // Pass org ID for booking API authentication
              );

              console.log('[Standard WS] Supervisor response received');

              // Extract and store all relevant tool results for state tracking
              
              // CreatePatient - store PatNum
              if (result.toolResults?.CreatePatient) {
                const createResult = result.toolResults.CreatePatient as { 
                  PatNum?: number; 
                  FName?: string; 
                  LName?: string;
                  HmPhone?: string;
                  WirelessPhone?: string;
                };
                if (createResult?.PatNum) {
                  state.bookingState.patNum = createResult.PatNum;
                  state.bookingState.firstName = createResult.FName;
                  state.bookingState.lastName = createResult.LName;
                  state.bookingState.phone = createResult.WirelessPhone || createResult.HmPhone;
                  console.log('[Standard WS] 📋 Stored PatNum from CreatePatient:', state.bookingState.patNum, state.bookingState.firstName, state.bookingState.lastName, state.bookingState.phone);
                  
                  // CRITICAL: Sync to ConversationState so booking API can auto-fill
                  if (state.callSid) {
                    const convState = getOrCreateState(`standard_${state.callSid}`);
                    convState.patient.patNum = createResult.PatNum;
                    convState.patient.firstName = createResult.FName;
                    convState.patient.lastName = createResult.LName;
                    console.log('[Standard WS] 🔄 Synced PatNum to ConversationState');
                  }
                }
              }
              
              // GetMultiplePatients - store PatNum if found
              if (result.toolResults?.GetMultiplePatients) {
                const patients = result.toolResults.GetMultiplePatients as Array<{ PatNum?: number; FName?: string; LName?: string; WirelessPhone?: string }>;
                if (Array.isArray(patients) && patients.length > 0 && patients[0]?.PatNum) {
                  state.bookingState.patNum = patients[0].PatNum;
                  state.bookingState.firstName = patients[0].FName;
                  state.bookingState.lastName = patients[0].LName;
                  state.bookingState.phone = patients[0].WirelessPhone;
                  state.bookingState.patientLookedUp = true;
                  console.log('[Standard WS] 📋 Stored PatNum from GetMultiplePatients:', state.bookingState.patNum);
                  
                  // CRITICAL: Sync to ConversationState so booking API can auto-fill
                  if (state.callSid) {
                    const convState = getOrCreateState(`standard_${state.callSid}`);
                    convState.patient.patNum = patients[0].PatNum;
                    convState.patient.firstName = patients[0].FName;
                    convState.patient.lastName = patients[0].LName;
                    convState.patient.phone = patients[0].WirelessPhone;
                    console.log('[Standard WS] 🔄 Synced patient info to ConversationState');
                  }
                }
              }
              
              // GetAvailableSlots - store available slots
              if (result.toolResults?.GetAvailableSlots) {
                const slots = result.toolResults.GetAvailableSlots as Array<{ AptDateTime: string; ProvNum: number; Op: number }>;
                if (Array.isArray(slots) && slots.length > 0) {
                  state.bookingState.availableSlots = slots;
                  state.bookingState.slotsQueried = true;
                  console.log('[Standard WS] 📋 Stored', slots.length, 'available slots');
                  
                  // Auto-detect if patient chose a time in the conversation
                  const lastUserMessage = state.conversationHistory.filter(m => m.role === 'user').pop()?.content || '';
                  const selectedSlot = matchTimeToSlot(lastUserMessage, slots);
                  if (selectedSlot) {
                    state.bookingState.selectedSlot = selectedSlot;
                    console.log('[Standard WS] 🎯 Auto-detected selected slot from conversation:', selectedSlot.AptDateTime);
                    
                    // CRITICAL: Sync to ConversationState so booking API can auto-fill
                    if (state.callSid) {
                      const convState = getOrCreateState(`standard_${state.callSid}`);
                      convState.appointment.selectedSlot = {
                        dateTime: selectedSlot.AptDateTime,
                        provNum: selectedSlot.ProvNum,
                        opNum: selectedSlot.Op
                      };
                      console.log('[Standard WS] 🔄 Synced selectedSlot to ConversationState');
                    }
                  }
                }
              }
              
              // CreateAppointment - store AptNum and update call_analysis
              if (result.toolResults?.CreateAppointment) {
                const aptResult = result.toolResults.CreateAppointment as { AptNum?: number; AptDateTime?: string };
                if (aptResult?.AptNum) {
                  state.bookingState.aptNum = aptResult.AptNum;
                  state.bookingState.appointmentCreated = true;
                  // Store the slot that was used
                  if (aptResult.AptDateTime) {
                    state.bookingState.selectedSlot = state.bookingState.availableSlots?.find(
                      s => s.AptDateTime === aptResult.AptDateTime
                    );
                  }
                  console.log('[Standard WS] 📋 Stored AptNum from CreateAppointment:', state.bookingState.aptNum);
                  
                  // Update conversation with call_analysis for demo widget
                  if (convState?.conversationId) {
                    try {
                      const appointmentDate = aptResult.AptDateTime ? new Date(aptResult.AptDateTime) : null;
                      
                      // Try to get provider name from conversation state
                      let providerName = 'Dr. Smith';
                      if (state.bookingState.selectedSlot?.ProvNum && convState?.appointment?.provider) {
                        providerName = convState.appointment.provider;
                      }
                      
                      const callAnalysis = {
                        booking_completed: true,
                        patient_first_name: state.bookingState.firstName || '',
                        patient_last_name: state.bookingState.lastName || '',
                        patient_phone: state.bookingState.phone || '',
                        appointment_date: appointmentDate ? appointmentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
                        appointment_time: appointmentDate ? appointmentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
                        provider_name: providerName,
                        appointment_type: 'Appointment',
                        apt_num: aptResult.AptNum
                      };
                      
                      console.log('[Standard WS] 📊 Updating call_analysis:', callAnalysis);
                      
                      await supabaseAdmin
                        .from('conversations')
                        .update({ call_analysis: callAnalysis })
                        .eq('id', convState.conversationId);
                      
                      console.log('[Standard WS] ✅ Updated call_analysis for demo widget');
                    } catch (error) {
                      console.error('[Standard WS] ❌ Failed to update call_analysis:', error);
                    }
                  }
                }
              }
              
              // GetAppointments - store existing appointment info for reschedule/cancel
              if (result.toolResults?.GetAppointments) {
                const appointments = result.toolResults.GetAppointments as Array<{ AptNum?: number }>;
                if (Array.isArray(appointments) && appointments.length > 0 && appointments[0]?.AptNum) {
                  state.bookingState.aptNum = appointments[0].AptNum;
                  console.log('[Standard WS] 📋 Stored AptNum from GetAppointments:', state.bookingState.aptNum);
                }
              }

              // Record the supervisor call
              if (state.callSid) {
                recordFunctionCall(
                  `standard_${state.callSid}`,
                  'getNextResponseFromSupervisor',
                  args,
                  { response: result.response, toolsCalled: result.toolsCalled, toolResults: result.toolResults },
                  result.error,
                  {}
                );
              }

              // Send response back to OpenAI Realtime
              state.openaiWs!.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: response.call_id,
                  output: JSON.stringify({ nextResponse: result.response }),
                },
              }));

              // Trigger response generation
              state.openaiWs!.send(JSON.stringify({ type: 'response.create' }));

            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error('[Standard WS] ❌ Supervisor error:', errorMessage);

              if (state.callSid) {
                recordFunctionCall(
                  `standard_${state.callSid}`,
                  'getNextResponseFromSupervisor',
                  JSON.parse(response.arguments || '{}'),
                  undefined,
                  errorMessage,
                  {}
                );
              }

              state.openaiWs!.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: response.call_id,
                  output: JSON.stringify({ 
                    nextResponse: "I'm having a little trouble with our system. Could you hold on just a moment?" 
                  }),
                },
              }));

              state.openaiWs!.send(JSON.stringify({ type: 'response.create' }));
            }
          }
        }

        // User speech transcription
        if (response.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = response.transcript;
          if (transcript && transcript.trim() && state.callSid) {
            // Transcript logging removed - too verbose
            processMessage(`standard_${state.callSid}`, transcript.trim(), 'user');
            state.conversationHistory.push({ role: 'user', content: transcript.trim() });
          }
        }

        // Assistant speech transcription
        if (response.type === 'response.audio_transcript.done') {
          const transcript = response.transcript;
          if (transcript && transcript.trim() && state.callSid) {
            // Transcript logging removed - too verbose
            addMessage(`standard_${state.callSid}`, 'assistant', transcript.trim());
            state.conversationHistory.push({ role: 'assistant', content: transcript.trim() });
          }
        }

        // Speech start/stop logging removed - too verbose

        if (response.type === 'error') {
          console.error('[Standard WS] ❌ OpenAI error:', response.error);
        }

      } catch (error) {
        console.error('[Standard WS] ❌ Error processing OpenAI message:', error);
      }
    });

    state.openaiWs.on('error', (error: Error) => {
      console.error('[Standard WS] ❌ OpenAI WebSocket error:', error.message);
      console.error('[Standard WS] ❌ Error details:', error);
      // Mark as not ready to prevent audio forwarding to broken connection
      state.openaiReady = false;
    });

    state.openaiWs.on('close', (code: number, reason: Buffer) => {
      console.log(`[Standard WS] 🔴 OpenAI connection closed - Code: ${code}, Reason: ${reason?.toString() || 'none'}`);
      state.openaiReady = false;
    });

  } catch (error) {
    console.error('[Standard WS] ❌ Failed to create OpenAI connection:', error);
    twilioWs.close();
    return;
  }

  // Keep-alive
  const keepAlive = setInterval(() => {
    if (twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({ event: 'mark', streamSid: state.streamSid }));
    }
  }, 20000);

  // Handle Twilio messages
  twilioWs.on('message', async (message: WebSocket.Data) => {
    try {
      const msg: TwilioMessage = JSON.parse(message.toString());
      
      // Log connection events for debugging
      if (msg.event === 'start' || msg.event === 'stop' || msg.event === 'connected') {
        console.log('[Standard WS] 📩 Twilio event:', msg.event);
      }

      switch (msg.event) {
        case 'start':
          state.streamSid = msg.start!.streamSid;
          state.callSid = msg.start!.callSid;
          console.log('[Standard WS] 📞 Call started:', state.callSid);
          console.log('[Standard WS] 🎵 Mode: Two-Agent (gpt-4o-mini + gpt-4o supervisor)');
          console.log('[Standard WS] 📡 Media format:', JSON.stringify(msg.start!.mediaFormat));
          
          // Extract customParameters from Twilio start message
          // These are sent via TwiML <Parameter> elements
          const customParams = (msg.start as any)?.customParameters || {};
          console.log('[Standard WS] 📋 Custom parameters:', JSON.stringify(customParams));
          
          // Use custom parameters - CRITICAL for multi-tenancy
          if (customParams.orgId && !organizationId) {
            organizationId = customParams.orgId;
            console.log('[Standard WS] 📋 Using orgId from customParameters:', organizationId);
            // Load config now that we have org ID
            await loadChannelConfig();
          }
          
          console.log('[Standard WS] 🏢 Organization ID:', organizationId);
          console.log('[Standard WS] 🔗 OpenAI connection ready:', state.openaiReady);
          
          // Initialize conversation state
          if (state.callSid) {
            const convState = getOrCreateState(`standard_${state.callSid}`);
            convState.intent = 'unknown';
            console.log('[Standard WS] 📊 Conversation state initialized');
            
            // Create conversation record in database
            try {
              const { getSupabaseAdmin } = await import('@/app/lib/supabaseClient');
              const supabase = getSupabaseAdmin();
              
              const { data, error } = await supabase
                .from('conversations')
                .insert({
                  session_id: `standard_${state.callSid}`,
                  organization_id: organizationId,
                  channel: 'voice',
                  call_id: state.callSid,
                  from_number: fromNumber || customParams.from || '',
                  to_number: toNumber || customParams.to || '',
                  status: 'active',
                  metadata: { 
                    mode: 'two_agent',
                    model: modelName,
                    source: 'twilio_standard'
                  },
                })
                .select('id')
                .single();
              
              if (error) {
                console.error('[Standard WS] ❌ Error creating conversation:', error);
              } else {
                console.log(`[Standard WS] ✅ Created conversation: ${data.id} for org: ${organizationId}`);
                // Set the dbId in conversationState so messages can be persisted
                const { setSessionDbId } = await import('@/app/lib/conversationState');
                setSessionDbId(`standard_${state.callSid}`, data.id);
              }
            } catch (dbError) {
              console.error('[Standard WS] ❌ Failed to create conversation record:', dbError);
            }
          }
          
          // If OpenAI is already connected but greeting hasn't been triggered,
          // this can happen if start event arrives after OpenAI is ready
          if (state.openaiReady && state.openaiWs && state.openaiWs.readyState === WebSocket.OPEN) {
            console.log('[Standard WS] ✅ OpenAI already connected - call flow ready');
          } else {
            console.log('[Standard WS] ⏳ Waiting for OpenAI connection to be ready...');
          }
          break;

        case 'media':
          if (state.openaiReady && state.openaiWs && state.openaiWs.readyState === WebSocket.OPEN && msg.media?.payload) {
            state.openaiWs.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: msg.media.payload,
            }));
          } else if (msg.media?.payload && state.audioQueue.length < 100) {
            state.audioQueue.push(msg.media.payload);
          }
          break;

        case 'stop':
          console.log('[Standard WS] 📴 Call stopped');
          clearInterval(keepAlive);
          if (state.openaiWs) state.openaiWs.close();
          break;
      }
    } catch (error) {
      console.error('[Standard WS] ❌ Error processing Twilio message:', error);
    }
  });

  twilioWs.on('close', () => {
    console.log('[Standard WS] 🔴 Twilio disconnected');
    clearInterval(keepAlive);
    if (state.openaiWs) state.openaiWs.close();
  });

  twilioWs.on('error', (error) => {
    console.error('[Standard WS] ❌ Twilio WebSocket error:', error);
    clearInterval(keepAlive);
    if (state.openaiWs) state.openaiWs.close();
  });
}

/**
 * Setup Standard Mode Twilio WebSocket handler
 */
export function setupTwilioStandardWebSocketHandler(expressWsApp: {
  ws: (path: string, handler: (ws: WebSocket, req: any) => void) => void;
}) {
  expressWsApp.ws('/twilio-media-stream-standard', (ws: WebSocket, req: any) => {
    console.log('[Standard WS] 🔌 New connection on /twilio-media-stream-standard');
    
    // Extract query parameters from URL
    // Format: /twilio-media-stream-standard?orgId=xxx&callSid=xxx&from=xxx&to=xxx
    const url = new URL(req.url, 'http://localhost');
    const orgId = url.searchParams.get('orgId');
    const callSid = url.searchParams.get('callSid');
    const fromNumber = url.searchParams.get('from');
    const toNumber = url.searchParams.get('to');
    
    console.log('[Standard WS] 📋 Call metadata from URL:');
    console.log(`  Org ID: ${orgId || 'NOT PROVIDED'}`);
    console.log(`  Call SID: ${callSid || 'NOT PROVIDED'}`);
    console.log(`  From: ${fromNumber || 'NOT PROVIDED'}`);
    console.log(`  To: ${toNumber || 'NOT PROVIDED'}`);
    
    if (!orgId) {
      console.error('[Standard WS] ❌ No organization ID provided in URL parameters');
      console.error('[Standard WS] ❌ Will try to get from customParameters or fall back to default');
    }
    
    handleTwilioConnectionStandard(ws, orgId, callSid, fromNumber, toNumber);
  });

  console.log('[Standard WS] ✅ Handler registered on /twilio-media-stream-standard');
}

