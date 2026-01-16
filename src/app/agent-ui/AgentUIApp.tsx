"use client";

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
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import openDentalScenario, { openDentalCompanyName } from "@/app/agentConfigs/openDental";
import embeddedBookingScenario from "@/app/agentConfigs/embeddedBooking";

// Utilities
import useAudioDownload from "../hooks/useAudioDownload";

// Map used by connect logic for scenarios defined via the SDK.
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  dental: openDentalScenario, // ✨ Premium: Unified Lexi - OpenDental API
  'embedded-booking': embeddedBookingScenario, // ✨ Premium: Unified Lexi - Booking API
  'embedded-booking-standard': allAgentSets['embedded-booking-standard'], // ✨ Standard: Two-agent - Booking API
};

function AgentUIAppInner() {
  const searchParams = useSearchParams();

  const {
    addTranscriptMessage,
    addTranscriptBreadcrumb,
  } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  // Voice engine selection: 'premium' (gpt-4o Realtime) or 'standard' (gpt-4o-mini + gpt-4o supervisor)
  const [agentEngine, setAgentEngine] = useState<'premium' | 'standard'>('premium');

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    RealtimeAgent[] | null
  >(null);

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

  // Realtime session hook (Premium mode - OpenAI Realtime API)
  const realtimeSession = useRealtimeSession({
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  // Retell session hook (kept for compatibility, not used in Standard mode)
  const retellSession = useRetellSession({
    onConnectionChange: (status) => {
      console.log('[AgentUI] Retell connection status:', status);
    },
    onError: (errType) => {
      console.error('[AgentUI] Retell error:', errType);
      setErrorType(errType === 'openai_quota' ? 'openai_quota' : 'opendental_connection');
    },
  });

  // Use realtime session for both Premium and Standard modes
  // The difference is in which agent config is loaded (embedded-booking vs embedded-booking-standard)
  const activeSession = realtimeSession;
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
      if (sendEvent) {
        sendEvent(eventObj);
      }
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  // Initialize agent config from URL
  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    console.log(`[AgentUI] Loading config: ${finalAgentConfig}`);
    console.log(`[AgentUI] Available agent sets:`, Object.keys(allAgentSets));
    const agents = allAgentSets[finalAgentConfig];
    console.log(`[AgentUI] Agents for ${finalAgentConfig}:`, agents);
    console.log(`[AgentUI] Agents length:`, agents?.length);
    
    // Wait for agents to load (they initialize async on server-side)
    if (!agents || agents.length === 0) {
      console.warn(`[AgentUI] ⚠️ Agents array is empty for ${finalAgentConfig}`);
      console.log(`[AgentUI] Polling for agents to load...`);
      
      // Poll every 500ms until agents are loaded (max 10 seconds)
      let attempts = 0;
      const maxAttempts = 20;
      const pollInterval = setInterval(() => {
        attempts++;
        const currentAgents = allAgentSets[finalAgentConfig];
        console.log(`[AgentUI] Poll attempt ${attempts}/${maxAttempts}, agents length: ${currentAgents?.length || 0}`);
        
        if (currentAgents && currentAgents.length > 0) {
          console.log(`[AgentUI] ✅ Agents loaded: ${currentAgents.length} agents`);
          clearInterval(pollInterval);
          const agentKeyToUse = currentAgents[0]?.name || "";
          setSelectedAgentName(agentKeyToUse);
          setSelectedAgentConfigSet(currentAgents);
        } else if (attempts >= maxAttempts) {
          console.error(`[AgentUI] ❌ Timeout waiting for agents to load after ${attempts} attempts`);
          console.error(`[AgentUI] This likely means the agents didn't initialize on the client side`);
          clearInterval(pollInterval);
          setErrorType('config');
        }
      }, 500);
      
      return () => clearInterval(pollInterval);
    }

    console.log(`[AgentUI] ✅ Agents already loaded: ${agents.length} agents`);
    const agentKeyToUse = agents[0]?.name || "";
    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  // Handle agent switch after connection
  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(!handoffTriggeredRef.current);
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      updateSession();
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
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
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

  const connectToSession = async () => {
    if (sessionStatus !== "DISCONNECTED") return;

    // Use Realtime SDK connection (works for both Premium and Standard modes)
    let agentSetKey = searchParams.get("agentConfig") || "default";
    
    // If Standard mode is selected and we're on embedded-booking, use the standard scenario
    if (agentEngine === 'standard' && agentSetKey === 'embedded-booking') {
      agentSetKey = 'embedded-booking-standard';
      console.log('[AgentUI] Standard mode active (cost-optimized)');
    } else {
      console.log('[AgentUI] Premium mode active');
    }
    
    if (sdkScenarioMap[agentSetKey]) {
      // Status is managed by the hook, will be set to CONNECTING automatically

      // Check if agents are loaded (dynamic scenarios may still be initializing)
      const agentSet = sdkScenarioMap[agentSetKey];
      if (!agentSet || agentSet.length === 0) {
        console.warn(`[AgentUI] Agent set '${agentSetKey}' is empty, still initializing...`);
        setErrorType('config');
        return;
      }

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        // Ensure the selectedAgentName is first so that it becomes the root
        const reorderedAgents = [...agentSet];
        const idx = reorderedAgents.findIndex((a) => a.name === selectedAgentName);
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        // Use appropriate company name based on scenario
        const companyName = agentSetKey === 'embedded-booking' ? 'Barton Dental' : openDentalCompanyName;
        const guardrail = createModerationGuardrail(companyName);

        // Generate unique session ID for transcript persistence (especially for Standard mode)
        const sessionId = `${agentSetKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await realtimeSession.connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: {
            addTranscriptBreadcrumb,
            sessionId, // Pass session ID to agents for transcript persistence
          },
        });
      } catch (err) {
        console.error("[AgentUI] Error connecting via SDK:", err);
        setErrorType('api');
        // Status is managed by the hook, will be set to DISCONNECTED on error
      }
      return;
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

  useEffect(() => {
    // Component mounted/updated
  }, [sessionStatus, selectedAgentName, selectedAgentConfigSet]);

  // Debug: Log render on every render (disabled to reduce console noise)
  // console.log('[AgentUI] Render:', {
  //   sessionStatus,
  //   hasOrb: true,
  // });

  // Active tab state - derived from URL param
  const currentConfig = searchParams.get("agentConfig") || defaultAgentSetKey;
  const activeTab = currentConfig === "embedded-booking" ? "ascendia" : "opendental";

  const handleTabChange = (tab: "opendental" | "ascendia") => {
    const newConfig = tab === "ascendia" ? "embedded-booking" : "dental";
    const url = new URL(window.location.toString());
    url.searchParams.set("agentConfig", newConfig);
    window.location.replace(url.toString());
  };

  return (
    <div className="flex flex-col h-screen w-full" style={{ background: '#ffffff' }}>
      {/* Error Notification */}
      <ErrorNotification 
        errorType={errorType} 
        onDismiss={() => setErrorType(null)} 
      />
      {/* Header */}
      <div className="p-3 md:p-4 flex justify-between items-center border-b" style={{ borderColor: '#e5e7eb' }}>
        <div className="flex items-center gap-3">
          <div className="text-base md:text-lg font-medium" style={{ color: '#111827' }}>
            Ascendia AI
          </div>
          <select
            value={agentEngine}
            onChange={(e) => setAgentEngine(e.target.value as 'premium' | 'standard')}
            disabled={sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING"}
            className="px-2 py-1 rounded text-xs md:text-sm border"
            style={{
              borderColor: '#d1d5db',
              color: sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING" ? '#9ca3af' : '#111827',
              background: sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING" ? '#f3f4f6' : '#ffffff',
              cursor: sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING" ? 'not-allowed' : 'pointer',
            }}
          >
            <option value="premium">Premium</option>
            <option value="standard">Standard</option>
          </select>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleConnection();
            }}
            className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors active:scale-95 cursor-pointer"
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

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 md:px-4 py-2 border-b" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
        <button
          onClick={() => handleTabChange("opendental")}
          disabled={sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING"}
          className="px-4 py-2 rounded-t-lg text-xs md:text-sm font-medium transition-colors"
          style={{
            background: activeTab === "opendental" ? '#ffffff' : 'transparent',
            color: activeTab === "opendental" ? '#111827' : '#6b7280',
            borderBottom: activeTab === "opendental" ? '2px solid #3b82f6' : '2px solid transparent',
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
          Ascendia Booking
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

