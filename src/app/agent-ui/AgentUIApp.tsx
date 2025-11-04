"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

// Components
import MinimalTranscript from "./MinimalTranscript";
import { Orb, type AgentState } from "../components/ui/orb";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from '@openai/agents/realtime';

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { openDentalScenario, openDentalCompanyName } from "@/app/agentConfigs/openDental";

// Utilities
import useAudioDownload from "../hooks/useAudioDownload";
import { useHandleSessionHistory } from "../hooks/useHandleSessionHistory";

// Map used by connect logic for scenarios defined via the SDK.
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  dental: openDentalScenario,
};

function AgentUIAppInner() {
  const searchParams = useSearchParams();
  const urlCodec = searchParams?.get("codec") || "opus";

  const {
    addTranscriptMessage,
    addTranscriptBreadcrumb,
  } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

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

  const {
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
  } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return true;
      const stored = localStorage.getItem('audioPlaybackEnabled');
      return stored ? stored === 'true' : true;
    },
  );

  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  useHandleSessionHistory();

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

    const agents = allAgentSets[finalAgentConfig];
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
    }
  }, [isPTTActive]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || "default";
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        // Ensure the selectedAgentName is first so that it becomes the root
        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex((a) => a.name === selectedAgentName);
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        const companyName = openDentalCompanyName;
        const guardrail = createModerationGuardrail(companyName);

        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: {
            addTranscriptBreadcrumb,
          },
        });
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
      return;
    }
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
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
    const turnDetection = isPTTActive
      ? null
      : {
          type: 'server_vad',
          threshold: 0.9,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        };

    sendEvent({
      type: 'session.update',
      session: {
        turn_detection: turnDetection,
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
      sendUserText(userText.trim());
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }

    setUserText("");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    interrupt();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: 'input_audio_buffer.clear' }, 'clear PTT buffer');
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking)
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: 'input_audio_buffer.commit' }, 'commit PTT');
    sendClientEvent({ type: 'response.create' }, 'trigger response PTT');
  };

  const onToggleConnection = () => {
    console.log('[AgentUI] Toggle connection clicked, current status:', sessionStatus);
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      console.log('[AgentUI] Disconnecting...');
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      console.log('[AgentUI] Connecting...');
      connectToRealtime();
    }
  };

  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set("codec", newCodec);
    window.location.replace(url.toString());
  };

  // Load localStorage preferences
  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) {
      setIsPTTActive(storedPushToTalkUI === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem("audioPlaybackEnabled");
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  // Save localStorage preferences
  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);

  useEffect(() => {
    localStorage.setItem("audioPlaybackEnabled", isAudioPlaybackEnabled.toString());
  }, [isAudioPlaybackEnabled]);

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

  // Handle audio playback enable/disable
  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn('Failed to toggle SDK mute', err);
    }
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('mute sync after connect failed', err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

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
      if (isPTTActive && isPTTUserSpeaking) {
        return "listening";
      }
      return "listening";
    }
    if (sessionStatus === "CONNECTING") {
      return "thinking";
    }
    return null;
  };

  useEffect(() => {
    console.log('[AgentUI] Component mounted/updated:', {
      sessionStatus,
      selectedAgentName,
      hasSelectedAgentConfig: !!selectedAgentConfigSet,
    });
    
    // Verify Orb component is available
    console.log('[AgentUI] Orb component check:', typeof Orb !== 'undefined' ? 'Available' : 'MISSING');
  }, [sessionStatus, selectedAgentName, selectedAgentConfigSet]);

  // Debug: Log render on every render
  console.log('[AgentUI] Render:', {
    sessionStatus,
    hasOrb: true, // Will help identify if render is happening
  });

  return (
    <div className="flex flex-col h-screen w-full" style={{ background: '#ffffff' }}>
      {/* Minimal Header */}
      <div className="p-3 md:p-4 flex justify-between items-center border-b" style={{ borderColor: '#e5e7eb' }}>
        <div className="text-base md:text-lg font-medium" style={{ color: '#111827' }}>
          Ascendia AI
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[AgentUI] Connect button clicked');
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

      {/* Main Content - Clean White Layout */}
      {/* Mobile: Stack vertically (Orb above, Transcript below) */}
      {/* Desktop: Side by side (Transcript left, Orb center) */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden" style={{ background: '#ffffff' }}>
        {/* Desktop: Transcript Panel - Left Side */}
        {/* Mobile: Hidden (shown below Orb instead) */}
        <div className="hidden md:flex md:flex-col md:w-1/3 border-r" style={{ borderColor: '#e5e7eb', background: '#ffffff' }}>
          <MinimalTranscript
            userText={userText}
            setUserText={setUserText}
            onSendMessage={handleSendTextMessage}
            downloadRecording={downloadRecording}
            canSend={sessionStatus === "CONNECTED"}
          />
        </div>

        {/* Orb - Center/Top */}
        <div className="flex-1 flex items-center justify-center py-4 md:py-0 min-h-0" style={{ background: '#ffffff', position: 'relative' }}>
          {sessionStatus === "CONNECTED" ? (
            <div className="w-[280px] h-[280px] md:w-[400px] md:h-[400px]" style={{ minHeight: '280px', minWidth: '280px' }}>
              <Orb agentState={getOrbState()} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 md:gap-4 px-4">
              <div className="w-[200px] h-[200px] md:w-[300px] md:h-[300px] opacity-20" style={{ minHeight: '200px', minWidth: '200px', position: 'relative' }}>
                <Orb agentState={null} />
              </div>
              <div className="text-center">
                <div className="text-base md:text-lg font-medium mb-2" style={{ color: '#374151' }}>
                  Not Connected
                </div>
                <div className="text-xs md:text-sm mb-3 md:mb-4" style={{ color: '#6b7280' }}>
                  Click "Connect" to start the voice agent
                </div>
                {/* Center Connect button removed per request */}
              </div>
            </div>
          )}
        </div>

        {/* Desktop: Right Side - Empty */}
        {/* Mobile: Hidden */}
        <div className="hidden md:block md:w-1/3" style={{ background: '#ffffff' }}></div>

        {/* Mobile: Transcript Panel - Below Orb */}
        <div className="flex md:hidden flex-col border-t h-1/2" style={{ borderColor: '#e5e7eb', background: '#ffffff' }}>
          <MinimalTranscript
            userText={userText}
            setUserText={setUserText}
            onSendMessage={handleSendTextMessage}
            downloadRecording={downloadRecording}
            canSend={sessionStatus === "CONNECTED"}
          />
        </div>
      </div>

      {/* Minimal Bottom Controls */}
      <div className="p-2 md:p-4 flex items-center justify-center gap-2 md:gap-4 border-t" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
        <button
          onClick={() => setIsPTTActive(!isPTTActive)}
          className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors active:scale-95 flex-1 md:flex-none"
          style={{
            background: isPTTActive ? '#3b82f6' : '#e5e7eb',
            color: isPTTActive ? '#ffffff' : '#374151'
          }}
        >
          <span className="hidden sm:inline">{isPTTActive ? "Push-to-Talk: ON" : "Push-to-Talk: OFF"}</span>
          <span className="sm:hidden">{isPTTActive ? "PTT: ON" : "PTT: OFF"}</span>
        </button>
        <button
          onClick={() => setIsAudioPlaybackEnabled(!isAudioPlaybackEnabled)}
          className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors active:scale-95 flex-1 md:flex-none"
          style={{
            background: isAudioPlaybackEnabled ? '#10b981' : '#e5e7eb',
            color: isAudioPlaybackEnabled ? '#ffffff' : '#374151'
          }}
        >
          {isAudioPlaybackEnabled ? "Audio: ON" : "Audio: OFF"}
        </button>
      </div>
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

