"use client";

import { useTranslations } from '@/lib/i18n/TranslationProvider';

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

// Components
import MinimalTranscript from "./MinimalTranscript";
import { Orb, type AgentState } from "../components/ui/orb";
import ErrorNotification, { type ErrorType } from "./ErrorNotification";
import OfficeContextPanel from "./OfficeContextPanel";
import EmbeddedBookingPanel from "./EmbeddedBookingPanel";
import FeedbackPanel from "./FeedbackPanel";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from '@openai/agents/realtime';

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import { useRetellSession } from "../hooks/useRetellSession";

// Agent configs (now loaded from database)
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

// Utilities
import useAudioDownload from "../hooks/useAudioDownload";

function AgentUIAppInner() {
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();

  const {
    addTranscriptMessage,
    addTranscriptBreadcrumb,
  } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  // Organization context from URL (for embeddable widget)
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null);
  const [channelConfig, setChannelConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // === TESTING CONFIGURATION ===
  // Available channels to test
  const [availableChannels, setAvailableChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('web'); // web, twilio, retell, whatsapp
  const [channelConfigs, setChannelConfigs] = useState<Record<string, any>>({});
  const [loadingChannels, setLoadingChannels] = useState(true);
  
  // Voice backend: realtime (OpenAI) vs retell (Retell AI) - derived from channel
  const [voiceBackend, setVoiceBackend] = useState<'realtime' | 'retell'>('realtime');
  
  // Agent mode comes from channel configuration (not user-selectable in testing)
  const [agentEngine, setAgentEngine] = useState<'premium' | 'standard'>('premium');

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const handoffTriggeredRef = useRef(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  // Error state
  const [errorType, setErrorType] = useState<ErrorType>(null);
  
  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [sessionIdForFeedback, setSessionIdForFeedback] = useState<string>("");
  const [messageCount, setMessageCount] = useState(0);
  const previousSessionStatus = useRef<SessionStatus>("DISCONNECTED");

  // Load all channel configurations from database
  useEffect(() => {
    const loadChannelConfigs = async () => {
      try {
        console.log('[Testing Lab] Loading channel configurations...');
        
        // Fetch all channel configs for current organization
        const response = await fetch('/api/admin/channel-configs');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.configs) {
            const configs = data.configs;
            console.log('[Testing Lab] Loaded configs:', configs);
            
            // Build channel config map
            const configMap: Record<string, any> = {};
            configs.forEach((config: any) => {
              configMap[config.channel] = config;
              
              // Debug log for web channel
              if (config.channel === 'web') {
                console.log('[Testing Lab] 🔍 WEB CHANNEL CONFIG FROM DATABASE:');
                console.log('  - Has instructions?', !!config.instructions);
                console.log('  - Instructions length:', config.instructions?.length || 0);
                console.log('  - Agent mode:', config.settings?.agent_mode);
                console.log('  - One agent model:', config.settings?.one_agent_model);
                console.log('  - Instructions preview (first 200 chars):', config.instructions?.substring(0, 200));
              }
            });
            setChannelConfigs(configMap);
            
            // Determine available testable channels
            const testableChannels = [
              { id: 'web', name: 'Web (Voice & Text)', backend: 'realtime', config: configMap.web },
              { id: 'twilio', name: 'Twilio Voice', backend: 'realtime', config: configMap.twilio },
              { id: 'retell', name: 'Retell AI', backend: 'retell', config: configMap.retell },
              { id: 'whatsapp', name: 'WhatsApp (Text)', backend: 'openai', config: configMap.whatsapp },
            ].filter(ch => ch.config); // Only show configured channels
            
            setAvailableChannels(testableChannels);
            
            // Set initial selection based on first available
            if (testableChannels.length > 0) {
              const firstChannel = testableChannels[0];
              setSelectedChannel(firstChannel.id);
              setVoiceBackend(firstChannel.backend as any);
              
              // Set agent mode from config
              const channelConfig = firstChannel.config;
              const agentMode = channelConfig?.settings?.agent_mode || 'one_agent';
              setAgentEngine(agentMode === 'two_agent' ? 'standard' : 'premium');
              
              console.log('[Testing Lab] Selected channel:', firstChannel.id, 'mode:', agentMode, '-> agentEngine:', agentMode === 'two_agent' ? 'standard' : 'premium');
            }
          }
        } else {
          console.error('[Testing Lab] Failed to load channel configs');
        }
      } catch (error) {
        console.error('[Testing Lab] Error loading configs:', error);
      } finally {
        setLoadingChannels(false);
      }
    };

    loadChannelConfigs();
  }, []);

  // Realtime session hook (Premium mode - OpenAI Realtime API)
  const realtimeSession = useRealtimeSession({
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      // Note: Agent handoff received
      console.log('[Agent Handoff]', agentName);
    },
  });

  // Retell session hook
  const retellSession = useRetellSession({
    onConnectionChange: (status) => {
      console.log('[Retell] Connection status:', status);
    },
    onError: (errType) => {
      console.error('[Retell] Error:', errType);
      setErrorType(errType === 'openai_quota' ? 'openai_quota' : 'opendental_connection');
    },
  });

  // Select active session based on backend choice
  const activeSession = voiceBackend === 'retell' ? retellSession : realtimeSession;
  const {
    status: sessionStatus,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
  } = activeSession;

  const [userText, setUserText] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (mute) {
      mute(newMutedState);
    }
  };

  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      // Don't send events if not connected
      if (sessionStatus !== "CONNECTED") {
        console.warn('[AgentUI] Ignoring event - not connected:', eventObj.type);
        return;
      }
      
      if (sendEvent) {
        sendEvent(eventObj);
      }
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  // NOTE: Old URL-based agent config system disabled
  // Now using database-driven channel configurations instead
  // All agent configs are loaded from /api/admin/channel-configs

  // Handle agent switch after connection (disabled - using DB config now)
  // NOTE: Agent switching is handled by channel configuration

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      updateSession(true); // Pass true to trigger agent's initial greeting
      // Store session ID for feedback when connected
      setSessionIdForFeedback(`session_${Date.now()}`);
      setMessageCount(0);
    }
  }, [sessionStatus]);
  
  // Detect disconnect and show feedback panel
  useEffect(() => {
    // Only show feedback if transitioning from CONNECTED to DISCONNECTED
    // and there was actual conversation (messages > 0)
    if (
      previousSessionStatus.current === "CONNECTED" &&
      sessionStatus === "DISCONNECTED" &&
      messageCount > 0
    ) {
      // Wait a moment before showing feedback
      setTimeout(() => setShowFeedback(true), 500);
    }
    previousSessionStatus.current = sessionStatus;
  }, [sessionStatus, messageCount]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    // Determine which mode to pass based on channel config
    // For single-agent mode: check one_agent_model setting
    // For two-agent mode: always use 'standard' (mini + gpt-4o)
    
    const channelConfig = channelConfigs[selectedChannel];
    let modeToUse = agentEngine; // Default to current agentEngine
    
    if (agentEngine === 'premium' && channelConfig?.settings?.one_agent_model) {
      // Single-agent mode: check if they selected mini
      if (channelConfig.settings.one_agent_model === 'gpt-4o-mini-realtime') {
        modeToUse = 'standard'; // Use standard mode for mini model
      }
    }
    
    const sessionUrl = `/api/session?mode=${modeToUse}`;
    console.log('[AgentUI] Fetching ephemeral key with mode:', modeToUse, '(agentEngine:', agentEngine, ', one_agent_model:', channelConfig?.settings?.one_agent_model, ')');
    
    logClientEvent({ url: sessionUrl }, "fetch_session_token_request");
    const tokenResponse = await fetch(sessionUrl);
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      // Status is managed by the hook, will remain at current state
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRetellSession = async () => {
    try {
      console.log('[Retell] 🔵 Connecting to Retell AI...');
      
      // Get Retell configuration from channel config
      const retellConfig = channelConfigs[selectedChannel];
      if (retellConfig) {
        console.log('[Retell] Using channel config:', {
          ai_backend: retellConfig.ai_backend,
          hasInstructions: !!retellConfig.instructions,
          dataIntegrations: retellConfig.data_integrations
        });
      }
      
      await retellSession.connect();
    } catch (err) {
      console.error("[Retell] Error connecting:", err);
      setErrorType('api');
    }
  };

  const connectToSession = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    
    // Route to appropriate backend
    if (voiceBackend === 'retell') {
      await connectToRetellSession();
      return;
    }

    // Get channel configuration from database
    const channelConfig = channelConfigs[selectedChannel];
    if (!channelConfig) {
      console.error('[AgentUI] No channel config found for:', selectedChannel);
      setErrorType('config');
      return;
    }

    console.log('[AgentUI] Using database channel config:', {
      channel: selectedChannel,
      mode: agentEngine,
      oneAgentInstructionsLength: channelConfig.one_agent_instructions?.length || 0,
      receptionistInstructionsLength: channelConfig.receptionist_instructions?.length || 0,
      supervisorInstructionsLength: channelConfig.supervisor_instructions?.length || 0,
      settings: channelConfig.settings
    });

    // Build agents from database configuration
    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) return;

      // Import RealtimeAgent and tool creator
      const { RealtimeAgent, tool } = await import('@openai/agents/realtime');
      const { z } = await import('zod');
      
      // Create booking tools inline (same as lexiAgent.ts)
      const createBookingTools = () => {
        const getCurrentDateTime = tool({
          name: 'get_datetime',
          description: 'Gets the current date and time with day name in user local timezone',
          parameters: z.object({}),
          execute: async () => {
            const now = new Date();
            return JSON.stringify({
              datetime: now.toLocaleString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }),
              iso: now.toISOString()
            });
          },
        });

        const getCurrentOfficeContext = tool({
          name: 'get_office_context',
          description: 'Get current office information and context',
          parameters: z.object({}),
          execute: async () => {
            const response = await fetch('/api/booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                functionName: 'GetOfficeContext',
                parameters: {},
                sessionId: `realtime_${Date.now()}`,
                conversationHistory: []
              })
            });
            const result = await response.json();
            return JSON.stringify(result);
          },
        });

        const getMultiplePatientsRealtime = tool({
          name: 'GetMultiplePatients',
          description: 'Search for patients by name, phone, or email',
          parameters: z.object({
            FirstName: z.string().optional().nullable(),
            LastName: z.string().optional().nullable(),
            Phone: z.string().optional().nullable(),
            Email: z.string().optional().nullable(),
          }),
          execute: async (params) => {
            const response = await fetch('/api/booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                functionName: 'GetMultiplePatients',
                parameters: params,
                sessionId: `realtime_${Date.now()}`,
                conversationHistory: []
              })
            });
            const result = await response.json();
            return JSON.stringify(result);
          },
        });

        const createPatientRealtime = tool({
          name: 'CreatePatient',
          description: 'Create a new patient record',
          parameters: z.object({
            FirstName: z.string(),
            LastName: z.string(),
            Phone: z.string(),
            Email: z.string().optional().nullable(),
          }),
          execute: async (params) => {
            const response = await fetch('/api/booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                functionName: 'CreatePatient',
                parameters: params,
                sessionId: `realtime_${Date.now()}`,
                conversationHistory: []
              })
            });
            const result = await response.json();
            return JSON.stringify(result);
          },
        });

        const getAppointmentsRealtime = tool({
          name: 'GetAppointments',
          description: 'Get appointments for a patient',
          parameters: z.object({
            PatNum: z.number(),
          }),
          execute: async (params) => {
            const response = await fetch('/api/booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                functionName: 'GetAppointments',
                parameters: params,
                sessionId: `realtime_${Date.now()}`,
                conversationHistory: []
              })
            });
            const result = await response.json();
            return JSON.stringify(result);
          },
        });

        const getAvailableSlotsRealtime = tool({
          name: 'GetAvailableSlots',
          description: 'Find available appointment slots. dateStart and dateEnd are required. ProvNum and OpNum are optional - if not provided, searches ALL providers and operatories.',
          parameters: z.object({
            dateStart: z.string().describe('Start date in YYYY-MM-DD format (required)'),
            dateEnd: z.string().describe('End date in YYYY-MM-DD format (required)'),
            ProvNum: z.number().optional().nullable().describe('Optional: Provider ID to search only that provider. If omitted, searches ALL providers.'),
            OpNum: z.number().optional().nullable().describe('Optional: Operatory ID. If omitted, searches ALL operatories.'),
            lengthMinutes: z.number().optional().nullable().describe('Optional: Appointment length in minutes. Defaults to 30.'),
          }),
          execute: async (params) => {
            const response = await fetch('/api/booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                functionName: 'GetAvailableSlots',
                parameters: params,
                sessionId: `realtime_${Date.now()}`,
                conversationHistory: []
              })
            });
            const result = await response.json();
            return JSON.stringify(result);
          },
        });

        const createAppointmentRealtime = tool({
          name: 'CreateAppointment',
          description: 'Create a new appointment',
          parameters: z.object({
            PatNum: z.number(),
            ProvNum: z.number(),
            AppointmentTypeDefNum: z.number(),
            AptDateTime: z.string(),
            Note: z.string().optional().nullable(),
          }),
          execute: async (params) => {
            const response = await fetch('/api/booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                functionName: 'CreateAppointment',
                parameters: params,
                sessionId: `realtime_${Date.now()}`,
                conversationHistory: []
              })
            });
            const result = await response.json();
            return JSON.stringify(result);
          },
        });

        const updateAppointmentRealtime = tool({
          name: 'UpdateAppointment',
          description: 'Update an existing appointment',
          parameters: z.object({
            AptNum: z.number(),
            AptDateTime: z.string().optional().nullable(),
            Note: z.string().optional().nullable(),
          }),
          execute: async (params) => {
            const response = await fetch('/api/booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                functionName: 'UpdateAppointment',
                parameters: params,
                sessionId: `realtime_${Date.now()}`,
                conversationHistory: []
              })
            });
            const result = await response.json();
            return JSON.stringify(result);
          },
        });

        const breakAppointmentRealtime = tool({
          name: 'BreakAppointment',
          description: 'Cancel an appointment',
          parameters: z.object({
            AptNum: z.number(),
          }),
          execute: async (params) => {
            const response = await fetch('/api/booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                functionName: 'BreakAppointment',
                parameters: params,
                sessionId: `realtime_${Date.now()}`,
                conversationHistory: []
              })
            });
            const result = await response.json();
            return JSON.stringify(result);
          },
        });

        return [
          getCurrentDateTime,
          getCurrentOfficeContext,
          getMultiplePatientsRealtime,
          createPatientRealtime,
          getAppointmentsRealtime,
          getAvailableSlotsRealtime,
          createAppointmentRealtime,
          updateAppointmentRealtime,
          breakAppointmentRealtime,
        ];
      };
      
      const bookingTools = createBookingTools();
      let agents: any[] = [];
      
      // Determine model based on settings
      const oneAgentModel = channelConfig.settings?.one_agent_model || 'gpt-4o-realtime';
      
      if (agentEngine === 'standard') {
        // Two-agent mode: Receptionist + Supervisor
        console.log('[AgentUI] 🔷 Standard mode (two-agent)');
        
        // Load instructions directly from separate database fields
        const receptionistInstructions = channelConfig.receptionist_instructions || 'You are a helpful receptionist assistant.';
        const supervisorInstructions = channelConfig.supervisor_instructions || 'You are a supervisor agent that helps with complex tasks.';
        
      console.log('[AgentUI] 📝 Receptionist instructions (length:', receptionistInstructions.length, ')');
      console.log('[AgentUI] Preview:', receptionistInstructions.substring(0, 150));
      console.log('[AgentUI] 📝 Supervisor instructions (length:', supervisorInstructions.length, ')');
      console.log('[AgentUI] Preview:', supervisorInstructions.substring(0, 150));
        
        // Receptionist (mini)
        const receptionistAgent = new RealtimeAgent({
          name: 'receptionist',
          // model: 'gpt-4o-mini-realtime-preview-2024-12-17', // TODO: SDK API changed
          voice: channelConfig.settings?.voice || 'sage',
          instructions: receptionistInstructions,
          tools: bookingTools,
        });
        
        // Supervisor (gpt-4o)
        const supervisorAgent = new RealtimeAgent({
          name: 'supervisor',
          // model: 'gpt-4o', // TODO: SDK API changed
          voice: 'ash',
          instructions: supervisorInstructions,
          tools: [],
        });
        
        agents = [receptionistAgent, supervisorAgent];
      } else {
        // Single-agent mode
        const model = oneAgentModel === 'gpt-4o-mini-realtime' 
          ? 'gpt-4o-mini-realtime-preview-2024-12-17'
          : 'gpt-4o-realtime-preview-2024-12-17';
          
        console.log('[AgentUI] 💎 Premium mode (single-agent):', model);
        
        // Load instructions directly from database field
        const instructions = channelConfig.one_agent_instructions || 'You are Lexi, a helpful assistant.';
        console.log('[AgentUI] 📝 Single-agent instructions (length:', instructions.length, ')');
        console.log('[AgentUI] Preview:', instructions.substring(0, 150));
        console.log('[AgentUI] Is using database instructions?', !!channelConfig.one_agent_instructions);
        
        const agent = new RealtimeAgent({
          name: 'lexi',
          // model, // TODO: SDK API changed
          voice: channelConfig.settings?.voice || 'sage',
          instructions,
          tools: bookingTools,
        });
        
        agents = [agent];
      }

      console.log('[AgentUI] ✅ Created agents from DB config:', agents.map((a, idx) => ({
        index: idx,
        name: a.name,
        model: a.model,
        voice: a.voice,
        toolCount: a.tools?.length || 0,
        instructionsLength: a.instructions?.length || 0,
        instructionsPreview: a.instructions?.substring(0, 150) + '...'
      })));

      // Use company name from settings or default
      const companyName = 'Barton Dental'; // TODO: Get from org settings
      const guardrail = createModerationGuardrail(companyName);
      const sessionId = `${selectedChannel}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await realtimeSession.connect({
        getEphemeralKey: async () => EPHEMERAL_KEY,
        initialAgents: agents,
        audioElement: sdkAudioElement,
        outputGuardrails: [guardrail],
        extraContext: {
          addTranscriptBreadcrumb,
          sessionId,
        },
      });
    } catch (err) {
      console.error("[AgentUI] Error connecting:", err);
      setErrorType('api');
    }
  };

  const disconnectFromSession = () => {
    disconnect();
    // Status is managed by the hook, will be set to DISCONNECTED automatically
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent({
      type: 'conversation.item.create',
      item: {
        id,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    sendClientEvent({ type: 'response.create' }, '(simulated user text message)');
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    // Don't send events if not connected
    if (sessionStatus !== "CONNECTED") {
      console.warn('[AgentUI] Cannot update session - not connected');
      return;
    }
    
    // Always use VAD (voice activity detection) - no push-to-talk
    // Higher threshold = less sensitive to background noise/music
    const turnDetection = {
      type: 'server_vad',
      threshold: 0.97, // Very high threshold (0.97) to filter out background noise/music - only clear speech triggers
      prefix_padding_ms: 400, // Slightly longer prefix to capture speech start better
      silence_duration_ms: 1500, // Longer silence detection to prevent false triggers from brief sounds
      create_response: true,
    };

    sendEvent({
      type: 'session.update',
      session: {
        turn_detection: turnDetection,
        input_audio_transcription: {
          model: 'gpt-4o-mini-transcribe',
          language: 'en', // Force English only - prevents language mixing
        },
      },
    });

    if (shouldTriggerResponse) {
      sendSimulatedUserMessage('hi');
    }
    return;
  }

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    
    // Don't send if not connected
    if (sessionStatus !== "CONNECTED") {
      console.warn('[AgentUI] Cannot send message - not connected');
      return;
    }
    
    interrupt();

    try {
      // sendUserText already handles adding to transcript, so we don't need to add it again
      sendUserText(userText.trim());
      setMessageCount(prev => prev + 1); // Track message count for feedback
    } catch (err) {
      console.error('Failed to send message', err);
    }

    setUserText("");
  };

  const onToggleConnection = async () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromSession();
    } else {
      await connectToSession();
    }
  };




  // Track if agent is speaking
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  useEffect(() => {
    if (audioElementRef.current) {
      const audioElement = audioElementRef.current;

      const handlePlay = () => setIsAgentSpeaking(true);
      const handlePause = () => setIsAgentSpeaking(false);
      const handleEnded = () => setIsAgentSpeaking(false);

      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('pause', handlePause);
      audioElement.addEventListener('ended', handleEnded);

      return () => {
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('ended', handleEnded);
      };
    }
  }, [sessionStatus]);

  // Audio playback is always enabled - no toggle needed

  // Start recording when connected
  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  // Map session status to Orb agentState
  const getOrbState = (): AgentState => {
    if (sessionStatus === "CONNECTED") {
      if (isAgentSpeaking) {
        return "talking";
      }
      return "listening";
    }
    if (sessionStatus === "CONNECTING") {
      return "thinking";
    }
    return null;
  };

  // Component lifecycle management
  useEffect(() => {
    // Agents are now created dynamically from DB config in connectToSession
  }, [sessionStatus]);

  // Debug: Log render on every render (disabled to reduce console noise)
  // console.log('[AgentUI] Render:', {
  //   sessionStatus,
  //   hasOrb: true,
  // });

  // Active tab state - no longer needed (using channel config from DB)
  const activeTab = "ascendia"; // Default to ascendia/booking
  
  // Tabs disabled - all config comes from database now
  const handleTabChange = (tab: "opendental" | "ascendia") => {
    // Tab switching disabled - using database channel configs instead
    console.log('[AgentUI] Tab switching disabled, using DB config');
  };

  return (
    <div className="flex flex-col h-screen w-full" style={{ background: '#ffffff' }}>
      {/* Error Notification */}
      <ErrorNotification 
        errorType={errorType} 
        onDismiss={() => setErrorType(null)} 
      />
      {/* Header with Testing Controls */}
      <div className="p-3 md:p-4 border-b" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-base md:text-lg font-bold" style={{ color: '#111827' }}>
            🧪 Agent Testing Lab
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={onToggleConnection}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors active:scale-95"
              style={{
                background: sessionStatus === "CONNECTED" ? '#ef4444' : sessionStatus === "CONNECTING" ? '#f59e0b' : '#10b981',
                color: '#ffffff',
                border: 'none',
              }}
              type="button"
            >
              {sessionStatus === "CONNECTED" ? "Disconnect" : sessionStatus === "CONNECTING" ? "Connecting..." : "Connect"}
            </button>
            <div className="text-xs hidden sm:block" style={{ color: '#6b7280' }}>
              {sessionStatus === "CONNECTED" ? "● Connected" : sessionStatus === "CONNECTING" ? "○ Connecting" : "○ Disconnected"}
            </div>
          </div>
        </div>

        {/* Testing Configuration Panel */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-white border border-gray-200">
          {/* Channel Selection */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Select Channel to Test</label>
            <select
              value={selectedChannel}
              onChange={(e) => {
                const channelId = e.target.value;
                setSelectedChannel(channelId);
                const channel = availableChannels.find(ch => ch.id === channelId);
                if (channel) {
                  setVoiceBackend(channel.backend);
                  const config = channel.config;
                  const agentMode = config?.settings?.agent_mode || 'one_agent';
                  setAgentEngine(agentMode === 'two_agent' ? 'standard' : 'premium');
                  console.log('[Testing Lab] Switched to', channelId, '- Mode:', agentMode, '-> agentEngine:', agentMode === 'two_agent' ? 'standard' : 'premium', 'Backend:', channel.backend);
                }
              }}
              disabled={sessionStatus !== "DISCONNECTED" || loadingChannels}
              className="px-3 py-1.5 rounded border text-sm min-w-[180px]"
              style={{
                borderColor: '#d1d5db',
                color: sessionStatus !== "DISCONNECTED" ? '#9ca3af' : '#111827',
                background: sessionStatus !== "DISCONNECTED" ? '#f3f4f6' : '#ffffff',
                cursor: sessionStatus !== "DISCONNECTED" ? 'not-allowed' : 'pointer',
              }}
            >
              {loadingChannels ? (
                <option>Loading channels...</option>
              ) : availableChannels.length === 0 ? (
                <option>No channels configured</option>
              ) : (
                availableChannels.map(ch => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} {ch.config?.enabled ? '✓' : '(disabled)'}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Current Configuration Display */}
          <div className="flex-1 flex flex-wrap items-center justify-end gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-500">Using:</span>
              <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">
                {voiceBackend === 'realtime' ? 'OpenAI Realtime' : voiceBackend === 'retell' ? 'Retell AI' : 'OpenAI'}
              </span>
            </div>
            {voiceBackend === 'realtime' && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 font-medium">
                  {(() => {
                    if (agentEngine === 'standard') {
                      return '2 Agents (Mini+GPT-4o)';
                    } else {
                      // Single-agent mode: check which model is selected
                      const oneAgentModel = channelConfigs[selectedChannel]?.settings?.one_agent_model || 'gpt-4o-realtime';
                      const modelName = oneAgentModel === 'gpt-4o-mini-realtime' ? 'GPT-4o-mini' : 'GPT-4o';
                      return `1 Agent (${modelName})`;
                    }
                  })()}
                </span>
              </div>
            )}
            {(channelConfigs[selectedChannel]?.one_agent_instructions || 
              channelConfigs[selectedChannel]?.receptionist_instructions || 
              channelConfigs[selectedChannel]?.supervisor_instructions) && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700">
                <span>✓</span>
                <span className="font-medium">Custom Instructions</span>
              </div>
            )}
            {channelConfigs[selectedChannel]?.data_integrations?.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-700">
                <span>🔗</span>
                <span className="font-medium">
                  {channelConfigs[selectedChannel].data_integrations.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 md:px-4 py-2 border-b" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
        <button
          onClick={() => handleTabChange("opendental")}
          disabled={sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING"}
          className="px-4 py-2 rounded-t-lg text-xs md:text-sm font-medium transition-colors"
          style={{
            background: 'transparent', // activeTab is always "ascendia"
            color: '#6b7280',
            borderBottom: '2px solid transparent',
            cursor: sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING" ? 'not-allowed' : 'pointer',
            opacity: sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING" ? 0.5 : 1,
          }}
        >
          OpenDental
        </button>
        <button
          onClick={() => handleTabChange("ascendia")}
          disabled={sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING"}
          className="px-4 py-2 rounded-t-lg text-xs md:text-sm font-medium transition-colors"
          style={{
            background: activeTab === "ascendia" ? '#ffffff' : 'transparent',
            color: activeTab === "ascendia" ? '#111827' : '#6b7280',
            borderBottom: activeTab === "ascendia" ? '2px solid #3b82f6' : '2px solid transparent',
            cursor: sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING" ? 'not-allowed' : 'pointer',
            opacity: sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING" ? 0.5 : 1,
          }}
        >
          Nurai
        </button>
        <button
          onClick={() => window.open('/admin/booking', '_blank')}
          className="ml-2 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-80"
          style={{
            background: '#10b981',
            color: '#ffffff',
          }}
        >
          Open Booking System
          <span>↗</span>
        </button>
        
        {/* Mute Mic Button */}
        <button
          onClick={handleMuteToggle}
          disabled={sessionStatus !== "CONNECTED"}
          className="ml-2 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors hover:opacity-80"
          style={{
            background: isMuted ? '#ef4444' : '#6b7280',
            color: '#ffffff',
            opacity: sessionStatus !== "CONNECTED" ? 0.5 : 1,
            cursor: sessionStatus !== "CONNECTED" ? 'not-allowed' : 'pointer',
          }}
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
              Muted
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
              Mic On
            </>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column */}
        <div className="flex flex-col w-[45%] min-w-[350px] border-r border-gray-200">
          {/* Orb Section */}
          <div className="h-[220px] flex flex-col items-center justify-center border-b border-gray-200 bg-gray-50 shrink-0">
            <div 
              className="relative" 
              style={{ 
                width: '180px', 
                height: '180px',
                opacity: sessionStatus === "CONNECTED" ? 1 : 0.3 
              }}
            >
              <Orb agentState={getOrbState()} />
            </div>
            {sessionStatus !== "CONNECTED" && (
              <div className="text-center mt-1">
                <div className="text-xs text-gray-500">
                  {sessionStatus === "CONNECTING" ? "Connecting..." : "Click Connect to start"}
                </div>
              </div>
            )}
          </div>

          {/* Transcript Section */}
          <div className="flex-1 min-h-[200px] overflow-hidden bg-white">
            <MinimalTranscript
              userText={userText}
              setUserText={setUserText}
              onSendMessage={handleSendTextMessage}
              downloadRecording={downloadRecording}
              canSend={sessionStatus === "CONNECTED"}
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col flex-1 overflow-hidden bg-white">
          {activeTab === "opendental" ? (
            <OfficeContextPanel sessionStatus={sessionStatus} />
          ) : (
            <EmbeddedBookingPanel sessionStatus={sessionStatus} />
          )}
        </div>
      </div>
      
      {/* Feedback Panel - shows after disconnect */}
      {showFeedback && (
        <FeedbackPanel
          sessionId={sessionIdForFeedback}
          onClose={() => setShowFeedback(false)}
          conversationMessageCount={messageCount}
        />
      )}
    </div>
  );
}

// Wrap with Suspense for useSearchParams
function AgentUIApp() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-gray)' }}>Loading...</div>}>
      <AgentUIAppInner />
    </Suspense>
  );
}

export default AgentUIApp;

