import { useCallback, useRef, useState, useEffect } from 'react';
import { SessionStatus } from '../types';
import { useEvent } from '../contexts/EventContext';
import { useTranscript } from '../contexts/TranscriptContext';
import { transcribeAudio, textToSpeech, playAudioBlob, chunksToBlob, playCachedGreeting, playCachedOneMoment } from '../lib/sttTtsUtils';
import { callGreetingAgent } from '../agentConfigs/openDental/greetingAgentSTT';
import { fetchOfficeContext } from '../lib/officeContext';
import { v4 as uuidv4 } from 'uuid';

export interface STTSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onError?: (errorType: 'openai_quota' | 'opendental_connection') => void;
}

export function useSTTSession(callbacks: STTSessionCallbacks = {}) {
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const [isRecording, setIsRecording] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  
  const { logClientEvent, logServerEvent } = useEvent();
  const { addTranscriptMessage } = useTranscript();
  
  // Store addTranscriptMessage in a ref so it's available in closures
  const addTranscriptMessageRef = useRef(addTranscriptMessage);
  useEffect(() => {
    addTranscriptMessageRef.current = addTranscriptMessage;
  }, [addTranscriptMessage]);
  
  // CRITICAL: Use ref to track conversation history synchronously
  // React state updates are async, so if user speaks quickly, messages can be lost
  const conversationHistoryRef = useRef<any[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);
  
  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);
  const currentAudioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const isVADActiveRef = useRef(false);
  const isRecordingRef = useRef(false);

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks, logClientEvent],
  );

  /**
   * Process user message through greeting agent and play response
   */
  const processUserMessage = useCallback(async (text: string) => {
    if (isProcessingRef.current) {
      console.warn('[STT Session] Already processing a message, ignoring');
      return;
    }

    isProcessingRef.current = true;

    try {
      // Play "one moment" audio IMMEDIATELY after user question (optimization)
      // This provides instant feedback while the greeting agent processes
      if (audioElementRef.current) {
        playCachedOneMoment(audioElementRef.current).catch((error) => {
          console.warn('[STT Session] Failed to play "one moment" audio:', error);
          // Continue even if audio fails
        });
      }

      // Add user message to conversation history
      // CRITICAL: Use ref for reading (sync) to avoid race conditions when user speaks quickly
      // Keep all items (messages and function_call_output for office context)
      // but remove call_id from messages (Responses API doesn't accept it on messages)
      const cleanHistory = conversationHistoryRef.current.map(item => {
        if (item.type === 'message') {
          const { call_id, ...rest } = item;
          return rest;
        }
        return item; // Keep function_call_output items as-is (for office context extraction)
      });
      
      const userMessage = {
        type: 'message',
        role: 'user',
        content: text,
      };

      // Create working copy that will be modified by callGreetingAgent
      // callGreetingAgent modifies conversationHistory in place (adds function calls)
      const updatedHistory = [...cleanHistory, userMessage];
      
      // Update BOTH ref (sync) and state (for UI re-renders)
      conversationHistoryRef.current = updatedHistory;
      setConversationHistory(updatedHistory);
      
      console.log(`[STT Session] 📝 Added user message to history. Total messages: ${updatedHistory.length}`);

      // Create callback to play "one moment" audio when orchestrator is called
      // NOTE: Audio already playing above, but keep callback for backwards compatibility
      // (in case greeting agent wants to replay it, though it shouldn't be necessary)
      const playOneMomentCallback = async () => {
        // Audio already playing, so this is a no-op
        // But we keep it for compatibility with greeting agent
        return Promise.resolve();
      };

      // Call greeting agent - pass full history including function_call_output for office context
      // isFirstMessage should already be false after greeting plays
      // Pass the callback (though audio is already playing)
      // IMPORTANT: callGreetingAgent will modify updatedHistory in place with function calls
      const response = await callGreetingAgent(text, updatedHistory, false, playOneMomentCallback);

      // Add assistant response to conversation history
      // updatedHistory now includes: original history + user message + function calls from greeting agent
      const assistantMessage = {
        type: 'message',
        role: 'assistant',
        content: response,
      };

      // Use the modified updatedHistory (which now includes function calls) + assistant message
      const finalHistory = [...updatedHistory, assistantMessage];
      conversationHistoryRef.current = finalHistory;
      setConversationHistory(finalHistory);
      
      console.log(`[STT Session] 📝 Added assistant response. Total messages: ${finalHistory.length}`);
      
      // Add assistant message to transcript
      const assistantMessageId = uuidv4().slice(0, 32);
      addTranscriptMessageRef.current(assistantMessageId, "assistant", response, false);

      // Pre-create audio element while TTS is generating (optimization)
      let audioEl: HTMLAudioElement | null = null;
      if (audioElementRef.current) {
        // Stop any current playback
        if (currentAudioPlaybackRef.current) {
          currentAudioPlaybackRef.current.pause();
          currentAudioPlaybackRef.current = null;
        }

        // Create audio element before TTS generation starts
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        currentAudioPlaybackRef.current = audioEl;
      }

      // Generate TTS audio (this is the main delay - OpenAI API call)
      const audioBlob = await textToSpeech(response, 'sage');

      // Play audio (element already created)
      if (audioEl) {
        await playAudioBlob(audioBlob, audioEl);

        // Clean up
        document.body.removeChild(audioEl);
        currentAudioPlaybackRef.current = null;
      }

      logServerEvent({ type: 'assistant_response', text: response }, 'stt_tts_response');
    } catch (error: any) {
      console.error('[STT Session] Error processing message:', error);
      logServerEvent({ type: 'error', message: error.message }, 'stt_tts_error');
      
      // Check for specific error types and notify via callback
      const errorType = error.errorType;
      if (errorType === 'openai_quota' || errorType === 'opendental_connection') {
        callbacks.onError?.(errorType);
      }
      
      // Show error message to user via TTS
      try {
        const errorMessage = "I'm sorry, I encountered an error. Please try again.";
        const audioBlob = await textToSpeech(errorMessage, 'sage');
        if (audioElementRef.current) {
          await playAudioBlob(audioBlob, audioElementRef.current);
        }
      } catch (ttsError) {
        console.error('[STT Session] Failed to play error message:', ttsError);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [conversationHistory, isFirstMessage, logServerEvent, addTranscriptMessage]);

  /**
   * Stop recording audio
   */
  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) {
      return;
    }

    try {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      setIsRecording(false);
      isRecordingRef.current = false;
      logClientEvent({ type: 'recording_stop' }, 'stt_recording_stop');
    } catch (error: any) {
      console.error('[STT Session] Error stopping recording:', error);
      logServerEvent({ type: 'error', message: error.message }, 'stt_stop_error');
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [logClientEvent, logServerEvent]);

  /**
   * VAD (Voice Activity Detection) using Web Audio API
   */
  const startVAD = useCallback((stream: MediaStream, isPTTMode: boolean) => {
    if (isPTTMode || isVADActiveRef.current) {
      return;
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      isVADActiveRef.current = true;
      silenceStartTimeRef.current = null;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const threshold = 30; // Volume threshold (0-255)
      const silenceDurationMs = 1200; // Same as RealtimeSession
      const checkInterval = 100; // Check every 100ms

      // Capture stream in closure for MediaRecorder creation
      const vadStream = stream;

      const checkVAD = () => {
        if (!isVADActiveRef.current || !analyserRef.current) {
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const isSpeaking = average > threshold;

        if (isSpeaking) {
          // User is speaking
          silenceStartTimeRef.current = null;
          
          // Start recording if not already recording and MediaRecorder exists
          if (!isRecordingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
            audioChunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
            isRecordingRef.current = true;
            logClientEvent({ type: 'vad_speech_detected' }, 'stt_vad_speech');
          }
        } else {
          // User is silent
          if (isRecordingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            if (silenceStartTimeRef.current === null) {
              silenceStartTimeRef.current = Date.now();
            } else {
              const silenceDuration = Date.now() - silenceStartTimeRef.current;
              if (silenceDuration >= silenceDurationMs) {
                // Stop recording after silence duration
                console.log('[STT Session] VAD: Silence detected, stopping recording');
                stopRecording();
                silenceStartTimeRef.current = null;
              }
            }
          }
        }
      };

      vadIntervalRef.current = window.setInterval(checkVAD, checkInterval);
      // Don't log during VAD start to avoid infinite loops - logClientEvent causes state updates
      // logClientEvent({ type: 'vad_start' }, 'stt_vad_start');
      console.log('[STT Session] VAD started');
    } catch (error: any) {
      console.error('[STT Session] Error starting VAD:', error);
      isVADActiveRef.current = false;
    }
  }, [stopRecording, processUserMessage, logServerEvent]);

  /**
   * Stop VAD
   */
  const stopVAD = useCallback(() => {
    if (vadIntervalRef.current !== null) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    isVADActiveRef.current = false;
    silenceStartTimeRef.current = null;
    // Don't log during cleanup to avoid infinite render loops
    // logClientEvent({ type: 'vad_stop' }, 'stt_vad_stop');
  }, []);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async (isPTTMode: boolean = false) => {
    if (status !== 'CONNECTED' || isRecordingRef.current) {
      return;
    }

    try {
      // Get or reuse existing stream
      let stream = mediaStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = chunksToBlob(audioChunksRef.current);
          
          if (audioBlob.size === 0) {
            console.warn('[STT Session] Empty audio blob, skipping transcription');
            setIsRecording(false);
            return;
          }

          console.log('[STT Session] Transcribing audio...');
          logClientEvent({ type: 'stt_start' }, 'stt_transcription_start');

          const transcribedText = await transcribeAudio(audioBlob);
          
          logClientEvent({ type: 'stt_complete', text: transcribedText }, 'stt_transcription_complete');
          logServerEvent({ type: 'user_transcription', text: transcribedText }, 'stt_user_message');

          if (transcribedText.trim()) {
            // Add user message to transcript
            const userMessageId = uuidv4().slice(0, 32);
            addTranscriptMessage(userMessageId, "user", transcribedText.trim(), true);
            
            await processUserMessage(transcribedText.trim());
          }
        } catch (error: any) {
          console.error('[STT Session] Error in recording stop handler:', error);
          logServerEvent({ type: 'error', message: error.message }, 'stt_transcription_error');
        } finally {
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      isRecordingRef.current = true;
      logClientEvent({ type: 'recording_start' }, 'stt_recording_start');

      // Start VAD if not in PTT mode
      if (!isPTTMode) {
        startVAD(stream, false);
      }
    } catch (error: any) {
      console.error('[STT Session] Error starting recording:', error);
      logServerEvent({ type: 'error', message: error.message }, 'stt_recording_error');
      updateStatus('DISCONNECTED');
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Microphone permission denied. Please allow microphone access and try again.');
      }
    }
  }, [status, logClientEvent, logServerEvent, processUserMessage, updateStatus, startVAD]);

  /**
   * Connect to STT/TTS session
   */
  const connect = useCallback(async (isPTTMode: boolean = false) => {
    if (status !== 'DISCONNECTED') {
      // Already connected or connecting
      return;
    }
    updateStatus('CONNECTING');

    try {
      // Request microphone permission and keep stream open
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Create audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      audioElementRef.current = audioEl;

      // Create MediaRecorder upfront for VAD mode (it will be used when speech is detected)
      if (!isPTTMode) {
        try {
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm',
          });
          
          audioChunksRef.current = [];
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };
          
          mediaRecorder.onstop = async () => {
            try {
              const audioBlob = chunksToBlob(audioChunksRef.current);
              
              if (audioBlob.size === 0) {
                console.warn('[STT Session] Empty audio blob, skipping transcription');
                setIsRecording(false);
                isRecordingRef.current = false;
                return;
              }

              logClientEvent({ type: 'stt_start' }, 'stt_transcription_start');

              const transcribedText = await transcribeAudio(audioBlob);
              
              logClientEvent({ type: 'stt_complete', text: transcribedText }, 'stt_transcription_complete');
              logServerEvent({ type: 'user_transcription', text: transcribedText }, 'stt_user_message');

              if (transcribedText.trim()) {
                // Add user message to transcript immediately (before processing)
                // Use ref to ensure we have the latest function
                const userMessageId = uuidv4().slice(0, 32);
                addTranscriptMessageRef.current(userMessageId, "user", transcribedText.trim(), false);
                
                await processUserMessage(transcribedText.trim());
              }
            } catch (error: any) {
              console.error('[STT Session] Error in recording stop handler:', error);
              logServerEvent({ type: 'error', message: error.message }, 'stt_transcription_error');
            } finally {
              setIsRecording(false);
              isRecordingRef.current = false;
            }
          };
          
          mediaRecorderRef.current = mediaRecorder;
        } catch (error: any) {
          console.error('[STT Session] Error creating MediaRecorder:', error);
        }
      }

      updateStatus('CONNECTED');

      // Start VAD if not in PTT mode (VAD will handle recording automatically)
      if (!isPTTMode) {
        startVAD(stream, false);
      }

      // Play cached greeting and initialize office context in parallel
      // Play cached greeting audio (faster and cheaper than TTS)
      const greetingPromise = playCachedGreeting(audioEl).catch((error) => {
        console.warn('[STT Session] Failed to play cached greeting, falling back to TTS:', error);
        // Fallback: if cached greeting fails, use TTS
        return textToSpeech('Hi! Welcome to Barton Dental. This is Lexi. How can I help you today?', 'sage')
          .then((blob) => playAudioBlob(blob, audioEl));
      });

      // Initialize office context in the background (silently, don't wait for it)
      const initContextPromise = (async () => {
        try {
          const context = await fetchOfficeContext();
          // Add to conversation history silently
          const contextMessage = {
            type: 'function_call_output',
            name: 'get_office_context',
            output: JSON.stringify(context),
          };
          setConversationHistory((prev) => [...prev, contextMessage]);
          console.log('[STT Session] Office context initialized:', {
            providers: context.providers.length,
            operatories: context.operatories.length,
            occupiedSlots: context.occupiedSlots.length,
          });
        } catch (error: any) {
          console.error('[STT Session] Failed to initialize office context:', error);
          // Don't block on this - continue even if it fails
        }
      })();

      // Also get datetime
      const datetimeMessage = {
        type: 'function_call_output',
        name: 'get_datetime',
        output: new Date().toISOString(),
      };
      setConversationHistory((prev) => [...prev, datetimeMessage]);

      // Wait for greeting to finish playing
      await greetingPromise;
      
      // Set isFirstMessage to false after greeting plays - user's first message should be processed normally
      setIsFirstMessage(false);
      
      // Don't wait for office context - it will be available when needed
      initContextPromise.catch(console.error);
    } catch (error: any) {
      console.error('[STT Session] Error connecting:', error);
      console.error('[STT Session] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      logServerEvent({ type: 'error', message: error.message }, 'stt_connect_error');
      updateStatus('DISCONNECTED');

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Microphone permission denied. Please allow microphone access and try again.');
      } else {
        alert(`Failed to connect: ${error.message || 'Unknown error'}`);
      }
    }
  }, [status, updateStatus, logServerEvent, processUserMessage, startVAD]);

  /**
   * Disconnect from STT/TTS session
   */
  const disconnect = useCallback(() => {
    // Stop VAD
    stopVAD();

    // Stop recording if active
    if (isRecordingRef.current) {
      stopRecording();
    }

    // Stop audio playback
    if (currentAudioPlaybackRef.current) {
      currentAudioPlaybackRef.current.pause();
      if (currentAudioPlaybackRef.current.parentNode) {
        document.body.removeChild(currentAudioPlaybackRef.current);
      }
      currentAudioPlaybackRef.current = null;
    }

    // Clean up audio element
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      if (audioElementRef.current.parentNode) {
        document.body.removeChild(audioElementRef.current);
      }
      audioElementRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Reset state (both ref and state)
    conversationHistoryRef.current = [];
    setConversationHistory([]);
    setIsFirstMessage(true);
    isProcessingRef.current = false;
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;

    updateStatus('DISCONNECTED');
  }, [stopRecording, updateStatus, stopVAD]);

  /**
   * Send user text directly (bypass STT)
   */
  const sendUserText = useCallback(
    async (text: string) => {
      if (status !== 'CONNECTED') {
        return;
      }

      await processUserMessage(text);
    },
    [status, processUserMessage],
  );

  /**
   * Interrupt current audio playback
   */
  const interrupt = useCallback(() => {
    if (currentAudioPlaybackRef.current) {
      currentAudioPlaybackRef.current.pause();
      currentAudioPlaybackRef.current = null;
    }

    // Also stop any recording
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  /**
   * Mute/unmute microphone input AND audio playback
   */
  const mute = useCallback(
    (muted: boolean) => {
      // Mute output audio (Lexi's voice)
      if (audioElementRef.current) {
        audioElementRef.current.muted = muted;
      }
      if (currentAudioPlaybackRef.current) {
        currentAudioPlaybackRef.current.muted = muted;
      }
      
      // Mute microphone input
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !muted;
        });
        console.log(`[STT Session] Microphone ${muted ? 'muted' : 'unmuted'}`);
      }
    },
    [],
  );

  /**
   * Push-to-talk: Start recording
   */
  const pushToTalkStart = useCallback(() => {
    if (status !== 'CONNECTED') {
      return;
    }

    interrupt(); // Stop any current playback
    stopVAD(); // Stop VAD when PTT is active
    startRecording(true); // Pass true to indicate PTT mode
  }, [status, interrupt, startRecording, stopVAD]);

  /**
   * Push-to-talk: Stop recording
   */
  const pushToTalkStop = useCallback(() => {
    if (status !== 'CONNECTED' || !isRecordingRef.current) {
      return;
    }

    stopRecording();
    // Note: VAD will be restarted when PTT is disabled (handled by AgentUIApp)
  }, [status, stopRecording]);

  /**
   * Enable/disable VAD mode (called when PTT toggle changes)
   */
  const setVADMode = useCallback((enabled: boolean) => {
    if (status !== 'CONNECTED' || !mediaStreamRef.current) {
      return;
    }

    if (enabled) {
      // Enable VAD
      stopVAD(); // Stop any existing VAD
      startVAD(mediaStreamRef.current, false);
    } else {
      // Disable VAD (PTT mode)
      stopVAD();
      if (isRecordingRef.current) {
        stopRecording();
      }
    }
  }, [status, startVAD, stopVAD, stopRecording]);

  // Cleanup on unmount - use ref to avoid dependency issues
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

  // Dummy sendEvent for compatibility (not used in STT/TTS mode)
  const sendEvent = useCallback((_event: any) => {
    // No-op for STT/TTS mode - events are handled differently
  }, []);

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

