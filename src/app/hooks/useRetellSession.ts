import { useCallback, useRef, useState, useEffect } from 'react';
import { SessionStatus } from '../types';
import { useEvent } from '../contexts/EventContext';
import { useTranscript } from '../contexts/TranscriptContext';
import { v4 as uuidv4 } from 'uuid';

// Dynamic import for Retell Web SDK (client-side only)
let RetellWebClient: any = null;
let sdkLoadPromise: Promise<any> | null = null;

async function loadRetellSDK() {
  if (RetellWebClient) {
    return RetellWebClient;
  }
  
  if (!sdkLoadPromise) {
    sdkLoadPromise = import('retell-client-js-sdk').then((module) => {
      RetellWebClient = module.RetellWebClient || module.default?.RetellWebClient || module.default;
      if (!RetellWebClient) {
        console.error('[Retell Session] SDK module keys:', Object.keys(module));
        throw new Error('RetellWebClient not found in retell-client-js-sdk');
      }
      return RetellWebClient;
    });
  }
  
  return sdkLoadPromise;
}

export interface RetellSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onError?: (errorType: 'openai_quota' | 'opendental_connection') => void;
}

export function useRetellSession(callbacks: RetellSessionCallbacks = {}) {
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const [isRecording, setIsRecording] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  
  const { logClientEvent, logServerEvent } = useEvent();
  const { addTranscriptMessage, updateTranscriptMessage } = useTranscript();
  
  // Store transcript functions in refs so they're available in closures
  const addTranscriptMessageRef = useRef(addTranscriptMessage);
  const updateTranscriptMessageRef = useRef(updateTranscriptMessage);
  useEffect(() => {
    addTranscriptMessageRef.current = addTranscriptMessage;
    updateTranscriptMessageRef.current = updateTranscriptMessage;
  }, [addTranscriptMessage, updateTranscriptMessage]);
  
  // Retell client ref
  const clientRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(null);
  
  // Track which transcript messages we've already added to avoid duplicates
  const addedTranscriptIds = useRef<Set<string>>(new Set());
  
  // Track recent message content to prevent duplicates (for text input that might come from Retell updates)
  const recentMessageContent = useRef<Set<string>>(new Set());
  
  // Track the last agent message ID for streaming updates
  const lastAgentMessageIdRef = useRef<string | null>(null);
  
  // Track the last user message ID for streaming updates
  const lastUserMessageIdRef = useRef<string | null>(null);

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks, logClientEvent],
  );

  /**
   * Setup Retell event listeners
   */
  const setupEventListeners = useCallback((client: any) => {
    if (!client) return;

    // SDK v2.x uses different event names than v1.x - listen for both
    // v2 events
    client.on('call_started', () => {
      console.log('[Retell] Call started (v2)');
      logClientEvent({ type: 'call_started' }, 'retell_call_started');
      setIsRecording(true);
    });

    client.on('call_ended', (data: any) => {
      console.log('[Retell] Call ended (v2):', data);
      logClientEvent({ type: 'call_ended', data }, 'retell_call_ended');
      setIsRecording(false);
      updateStatus('DISCONNECTED');
    });

    // v1 events (for backward compatibility)
    client.on('conversationStarted', () => {
      console.log('[Retell] Conversation started (v1)');
      logClientEvent({ type: 'conversation_started' }, 'retell_conversation_started');
      setIsRecording(true);
    });

    client.on('conversationEnded', (data: any) => {
      console.log('[Retell] Conversation ended (v1):', data);
      logClientEvent({ type: 'conversation_ended', data }, 'retell_conversation_ended');
      setIsRecording(false);
      updateStatus('DISCONNECTED');
    });

    // Agent talking events (both versions)
    client.on('agent_start_talking', () => {
      console.log('[Retell] Agent speaking (v2)');
      logClientEvent({ type: 'agent_start_talking' }, 'retell_agent_talking');
      // Reset last agent message ID when agent starts talking (new response)
      // This ensures the next transcript update creates a new message
      lastAgentMessageIdRef.current = null;
    });

    client.on('agent_stop_talking', () => {
      console.log('[Retell] Agent stopped (v2)');
      logClientEvent({ type: 'agent_stop_talking' }, 'retell_agent_stopped');
    });

    client.on('agentStartTalking', () => {
      console.log('[Retell] Agent speaking (v1)');
      logClientEvent({ type: 'agent_start_talking' }, 'retell_agent_talking');
      // Reset last agent message ID when agent starts talking (new response)
      // This ensures the next transcript update creates a new message
      lastAgentMessageIdRef.current = null;
    });

    client.on('agentStopTalking', () => {
      console.log('[Retell] Agent stopped (v1)');
      logClientEvent({ type: 'agent_stop_talking' }, 'retell_agent_stopped');
    });

    // Connection events
    client.on('reconnect', () => {
      console.log('[Retell] Reconnected');
      logClientEvent({ type: 'reconnect' }, 'retell_reconnect');
    });

    client.on('disconnect', () => {
      console.log('[Retell] Disconnected');
      logClientEvent({ type: 'disconnect' }, 'retell_disconnect');
    });

    client.on('update', (update: any) => {
      // Real-time transcript updates from Retell
      // Logging removed to reduce noise - focus on API calls
      
      // Retell update can have different formats:
      // - update.transcript: string (full transcript)
      // - update.transcript_array: array of messages
      // - update.messages: array of messages
      
      if (update.transcript && typeof update.transcript === 'string') {
        // Full transcript string - log to server events only (not console)
        logServerEvent({ type: 'transcript_update', transcript: update.transcript }, 'retell_transcript');
      }
      
      // Check for transcript array format
      const transcriptArray = update.transcript_array || update.messages || update.transcript;
      
      if (Array.isArray(transcriptArray)) {
        // Process each message in the transcript array
        transcriptArray.forEach((msg: any, index: number) => {
          // Extract role and content
          const role = msg.role || (msg.sender === 'user' ? 'user' : 'assistant');
          const content = msg.content || msg.text || msg.transcript || '';
          
          if (!content || (role !== 'user' && role !== 'assistant' && role !== 'agent')) {
            return;
          }
          
          const transcriptRole = role === 'agent' ? 'assistant' : role;
          
          // For both agent and user messages, update the last message if it exists (streaming)
          // But only if the content is longer or similar (continuing the same message)
          // If content is shorter or completely different, it's a new message
          if (transcriptRole === 'assistant' && lastAgentMessageIdRef.current) {
            // Check if this is a continuation of the last message or a new one
            // If content is shorter, it might be a new message starting
            // For now, we'll update if the content length is >= previous length (streaming)
            // Otherwise create new (this is a heuristic - might need adjustment)
            updateTranscriptMessageRef.current(lastAgentMessageIdRef.current, content, false);
          } else if (transcriptRole === 'user' && lastUserMessageIdRef.current) {
            // Check if this is the same message we already added (text input)
            // Compare content to avoid duplicates from Retell's transcript updates
            // For now, update existing user message (streaming update)
            updateTranscriptMessageRef.current(lastUserMessageIdRef.current, content, false);
          } else {
            // Create new message
            const msgId = msg.id || msg.timestamp?.toString() || `${transcriptRole}-${Date.now()}-${index}`;
            
            // Skip if we've already added this exact message
            if (addedTranscriptIds.current.has(msgId)) {
              return;
            }
            
            // For user messages, check if we already have this exact content (from text input)
            // This prevents duplicates when Retell sends back the same message in transcript updates
            if (transcriptRole === 'user') {
              const normalizedContent = content.trim().toLowerCase();
              
              // Check if we've seen this exact content recently (within last 5 seconds)
              // This prevents duplicates from Retell's transcript updates
              if (recentMessageContent.current.has(normalizedContent)) {
                return; // Skip this duplicate
              }
              
              // Add to recent messages (will be cleaned up after 5 seconds)
              recentMessageContent.current.add(normalizedContent);
              setTimeout(() => {
                recentMessageContent.current.delete(normalizedContent);
              }, 5000);
            }
            
            addTranscriptMessageRef.current(msgId, transcriptRole, content, false);
            addedTranscriptIds.current.add(msgId);
            
            // Track the last message for streaming updates
            if (transcriptRole === 'assistant') {
              lastAgentMessageIdRef.current = msgId;
            } else if (transcriptRole === 'user') {
              lastUserMessageIdRef.current = msgId;
            }
          }
        });
      } else if (update.transcript && typeof update.transcript === 'object') {
        // Single message object (likely streaming update)
        const msg = update.transcript;
        const role = msg.role || 'assistant';
        const content = msg.content || msg.text || '';
        
        if (content) {
          const transcriptRole = role === 'agent' ? 'assistant' : role;
          
          // For both agent and user messages, update the last message if it exists (streaming)
          if (transcriptRole === 'assistant' && lastAgentMessageIdRef.current) {
            updateTranscriptMessageRef.current(lastAgentMessageIdRef.current, content, false);
          } else if (transcriptRole === 'user' && lastUserMessageIdRef.current) {
            updateTranscriptMessageRef.current(lastUserMessageIdRef.current, content, false);
          } else {
            // Create new message
            const msgId = msg.id || msg.timestamp?.toString() || `retell-${Date.now()}`;
            
            if (!addedTranscriptIds.current.has(msgId)) {
              addTranscriptMessageRef.current(msgId, transcriptRole, content, false);
              addedTranscriptIds.current.add(msgId);
              
              // Track the last message for streaming updates
              if (transcriptRole === 'assistant') {
                lastAgentMessageIdRef.current = msgId;
              } else if (transcriptRole === 'user') {
                lastUserMessageIdRef.current = msgId;
              }
            }
          }
        }
      }
    });
    
    // Listen for metadata events which might contain transcript info
    client.on('metadata', (metadata: any) => {
      console.log('[Retell] Metadata received:', metadata);
      logServerEvent({ type: 'metadata', data: metadata }, 'retell_metadata');
    });

    client.on('error', (error: any) => {
      console.error('[Retell] Error:', error);
      logServerEvent({ type: 'error', message: error.message || 'Unknown error' }, 'retell_error');
      callbacks.onError?.('opendental_connection'); // Default error type
    });
  }, [logClientEvent, logServerEvent, callbacks, updateStatus]);

  /**
   * Connect to Retell session
   */
  const connect = useCallback(async (isPTTMode: boolean = false) => {
    if (status !== 'DISCONNECTED') {
      console.log('[Retell Session] Already connected or connecting, status:', status);
      return;
    }

    console.log('[Retell Session] Starting connection');
    updateStatus('CONNECTING');

    try {
      // Load Retell Web SDK if not already loaded
      if (typeof window === 'undefined') {
        throw new Error('Retell Web SDK can only be used in browser');
      }
      
      await loadRetellSDK();

      if (!RetellWebClient) {
        throw new Error('Retell Web SDK not available after loading');
      }

      // Call backend to create web call and get access token
      // Note: agent_id is handled server-side via RETELL_AGENT_ID env var
      const response = await fetch('/api/retell/create-web-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          // agent_id is optional - API route will use RETELL_AGENT_ID from server env
          metadata: {
            // Optional: Add any metadata here
            user_id: 'web_user',
            session_id: uuidv4(),
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to create call: ${response.statusText}`);
      }

      const { access_token, call_id } = await response.json();
      callIdRef.current = call_id;
      console.log(`[Retell Session] Web call created: ${call_id}`);

      // Create Retell client
      if (!RetellWebClient) {
        throw new Error('RetellWebClient not loaded - SDK import failed');
      }
      
      const client = new RetellWebClient();
      clientRef.current = client;

      // Setup event listeners first
      setupEventListeners(client);

      // Check which API version we have (v2 uses startCall, v1 uses startConversation)
      const hasStartCall = typeof client.startCall === 'function';
      const hasStartConversation = typeof client.startConversation === 'function';
      
      console.log('[Retell Session] SDK API check:', {
        hasStartCall,
        hasStartConversation,
        clientMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(client))
      });

      if (!hasStartCall && !hasStartConversation) {
        console.error('[Retell Session] Client methods:', Object.getOwnPropertyNames(client));
        console.error('[Retell Session] Client prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
        throw new Error('RetellWebClient missing startCall or startConversation method - SDK version mismatch?');
      }

      try {
        if (hasStartCall) {
          // SDK v2.x API - use startCall with accessToken
          console.log('[Retell Session] Using SDK v2 API with startCall');
          console.log('[Retell Session] Starting call with access token...');
          
          await client.startCall({
            accessToken: access_token,
            sampleRate: 24000, // Optional: 24000 or 16000
            enableUpdate: true, // Enable real-time transcript updates
          });
        } else {
          // SDK v1.x API - use startConversation with callId
          console.log('[Retell Session] Using SDK v1 API with startConversation');
          console.log('[Retell Session] Starting conversation with call ID:', call_id);
          
          await client.startConversation({
            callId: call_id,
            sampleRate: 24000, // Optional: 24000 or 16000
            enableUpdate: true, // Enable real-time transcript updates
          });
        }

        console.log('[Retell Session] ✅ Call/Conversation started successfully');
        console.log('[Retell Session] Client audio context state:', client.audioContext?.state);
        
        // Wait a moment for audio context to be ready
        if (client.audioContext && client.audioContext.state === 'suspended') {
          console.log('[Retell Session] Resuming audio context...');
          await client.audioContext.resume();
        }
        
        updateStatus('CONNECTED');
        setIsRecording(true);
      } catch (startError: any) {
        console.error('[Retell Session] Error starting call/conversation:', startError);
        throw startError;
      }

      // Initialize conversation history
      setConversationHistory([]);
    } catch (error: any) {
      console.error('[Retell Session] Error connecting:', error);
      logServerEvent({ type: 'error', message: error.message }, 'retell_connect_error');
      updateStatus('DISCONNECTED');
      
      // Check for specific error types
      if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        callbacks.onError?.('openai_quota');
      } else {
        callbacks.onError?.('opendental_connection');
      }
      
      alert(`Failed to connect: ${error.message || 'Unknown error'}`);
    }
  }, [status, updateStatus, logServerEvent, callbacks, setupEventListeners]);

  /**
   * Disconnect from Retell session
   */
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      try {
        clientRef.current.stopCall();
      } catch (error) {
        console.error('[Retell Session] Error stopping call:', error);
      }
      clientRef.current = null;
    }

    // Reset state
    setConversationHistory([]);
    setIsRecording(false);
    callIdRef.current = null;
    addedTranscriptIds.current.clear();
    lastAgentMessageIdRef.current = null;
    lastUserMessageIdRef.current = null;

    updateStatus('DISCONNECTED');
  }, [updateStatus]);

  /**
   * Send user text directly (if supported by Retell SDK)
   */
  const sendUserText = useCallback(
    async (text: string) => {
      if (status !== 'CONNECTED' || !clientRef.current) {
        console.warn('[Retell Session] Cannot send text: not connected');
        return;
      }

      try {
        if (!callIdRef.current) {
          console.warn('[Retell Session] Cannot send text: no call_id available');
          return;
        }
        
        // Add user message to transcript with a unique ID
        // Use a timestamp-based ID so Retell's update event won't duplicate it
        const userMessageId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        addTranscriptMessageRef.current(userMessageId, "user", text, false);
        addedTranscriptIds.current.add(userMessageId);
        
        // Track this content to prevent duplicates from Retell's transcript updates
        const normalizedText = text.trim().toLowerCase();
        recentMessageContent.current.add(normalizedText);
        setTimeout(() => {
          recentMessageContent.current.delete(normalizedText);
        }, 5000);
        
        // Track this as the last user message for streaming updates
        lastUserMessageIdRef.current = userMessageId;
        
        // Add to conversation history
        const userMessage = {
          type: 'message',
          role: 'user',
          content: text,
        };
        setConversationHistory((prev) => [...prev, userMessage]);
        
        logClientEvent({ type: 'user_text', text }, 'retell_user_text');
        
        // Send text to WebSocket server via Next.js API route (proxies to WebSocket server)
        // This avoids CORS issues and works in both local and production
        const response = await fetch('/api/retell/send-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call_id: callIdRef.current,
            text: text
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to send text: ${response.statusText}`);
        }
      } catch (error: any) {
        console.error('[Retell Session] Error sending text:', error);
        logServerEvent({ type: 'error', message: error.message }, 'retell_send_text_error');
      }
    },
    [status, logClientEvent, logServerEvent],
  );

  /**
   * Interrupt current audio playback
   */
  const interrupt = useCallback(() => {
    if (clientRef.current) {
      try {
        // Retell SDK may have an interrupt method
        // Check documentation for actual method name
        console.log('[Retell Session] Interrupting call');
        // clientRef.current.interrupt?.();
      } catch (error) {
        console.error('[Retell Session] Error interrupting:', error);
      }
    }
  }, []);

  /**
   * Mute/unmute microphone input
   */
  const mute = useCallback(
    (muted: boolean) => {
      if (clientRef.current) {
        try {
          console.log(`[Retell Session] ${muted ? 'Muting' : 'Unmuting'} microphone`);
          
          // Mute the local audio stream (microphone)
          const localStream = (clientRef.current as any).localStream;
          if (localStream && localStream.getAudioTracks) {
            localStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
              track.enabled = !muted;
            });
          }
          
          // Also try Retell SDK's built-in mute if available
          if (typeof (clientRef.current as any).setMuted === 'function') {
            (clientRef.current as any).setMuted(muted);
          }
        } catch (error) {
          console.error('[Retell Session] Error muting:', error);
        }
      }
    },
    [],
  );

  /**
   * Push-to-talk: Start recording (not applicable for Retell, but kept for compatibility)
   */
  const pushToTalkStart = useCallback(() => {
    // Retell handles audio capture automatically
    console.log('[Retell Session] Push-to-talk start (not applicable for Retell)');
  }, []);

  /**
   * Push-to-talk: Stop recording (not applicable for Retell, but kept for compatibility)
   */
  const pushToTalkStop = useCallback(() => {
    // Retell handles audio capture automatically
    console.log('[Retell Session] Push-to-talk stop (not applicable for Retell)');
  }, []);

  /**
   * Enable/disable VAD mode (not applicable for Retell, but kept for compatibility)
   */
  const setVADMode = useCallback((enabled: boolean) => {
    // Retell handles VAD automatically
    console.log(`[Retell Session] VAD mode ${enabled ? 'enabled' : 'disabled'} (not applicable for Retell)`);
  }, []);

  // Dummy sendEvent for compatibility (not used in Retell mode)
  const sendEvent = useCallback((_event: any) => {
    // No-op for Retell mode - events are handled by Retell SDK
  }, []);

  // Cleanup on unmount
  const disconnectRef = useRef(disconnect);
  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  useEffect(() => {
    return () => {
      // Use ref to avoid dependency issues that cause infinite loops
      disconnectRef.current();
    };
  }, []); // Empty deps - only run on unmount

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
    pushToTalkStart,
    pushToTalkStop,
    setVADMode,
    isRecording,
    conversationHistory,
  } as const;
}


