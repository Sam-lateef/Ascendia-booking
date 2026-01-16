import OpenAI from 'openai';

// Initialize OpenAI client
// Note: In production, API key should come from environment variable
// For client-side calls, we'll need to proxy through API route for security
const getOpenAIClient = () => {
  // Check if we're on the client side
  if (typeof window === 'undefined') {
    // Server-side: use environment variable
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  // Client-side: will use API route proxy
  return null;
};

/**
 * Transcribe audio using OpenAI Whisper API
 * @param audioBlob - Audio blob to transcribe
 * @returns Transcribed text
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    // For client-side, we need to proxy through API route
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('/api/stt', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `STT API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text || '';
  } catch (error: any) {
    console.error('[STT] Transcription error:', error);
    throw new Error(`Failed to transcribe audio: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Convert text to speech using OpenAI TTS API
 * @param text - Text to convert to speech
 * @param voice - Voice to use (default: 'sage' to match Lexi)
 * @returns Audio blob
 */
export async function textToSpeech(text: string, voice: string = 'sage'): Promise<Blob> {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice,
        model: 'tts-1', // Using tts-1 for faster generation (vs tts-1-hd for quality)
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `TTS API error: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    return audioBlob;
  } catch (error: any) {
    console.error('[TTS] Text-to-speech error:', error);
    throw new Error(`Failed to convert text to speech: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Play audio blob through HTMLAudioElement
 * @param blob - Audio blob to play
 * @param audioElement - HTMLAudioElement to play through
 * @returns Promise that resolves when audio finishes playing
 */
export async function playAudioBlob(
  blob: Blob,
  audioElement: HTMLAudioElement
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(blob);
      audioElement.src = url;
      audioElement.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audioElement.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to play audio: ${error}`));
      };
      audioElement.play().catch((error) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to play audio: ${error.message}`));
      });
    } catch (error: any) {
      reject(new Error(`Failed to play audio: ${error.message || 'Unknown error'}`));
    }
  });
}

/**
 * Convert MediaRecorder chunks to Blob
 * @param chunks - Array of Blob chunks from MediaRecorder
 * @returns Combined Blob
 */
export function chunksToBlob(chunks: Blob[]): Blob {
  return new Blob(chunks, { type: 'audio/webm' });
}

/**
 * Play cached greeting audio file
 * @param audioElement - HTMLAudioElement to play through
 * @returns Promise that resolves when audio finishes playing
 */
export async function playCachedGreeting(
  audioElement: HTMLAudioElement
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Use the greeting.wav file from public folder
      audioElement.src = '/greeting.wav';
      audioElement.onended = () => {
        resolve();
      };
      audioElement.onerror = (error) => {
        console.error('[Cached Greeting] Failed to play:', error);
        reject(new Error(`Failed to play cached greeting: ${error}`));
      };
      audioElement.play().catch((error) => {
        console.error('[Cached Greeting] Play error:', error);
        reject(new Error(`Failed to play cached greeting: ${error.message}`));
      });
    } catch (error: any) {
      reject(new Error(`Failed to play cached greeting: ${error.message || 'Unknown error'}`));
    }
  });
}

/**
 * Play cached "one moment" audio file
 * @param audioElement - HTMLAudioElement to play through
 * @returns Promise that resolves when audio finishes playing
 */
export async function playCachedOneMoment(
  audioElement: HTMLAudioElement
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Use the oneMoment.wav file from public folder
      // If file doesn't exist, fail silently (don't block the flow)
      audioElement.src = '/oneMoment.wav';
      audioElement.onended = () => {
        resolve();
      };
      audioElement.onerror = (error) => {
        console.warn('[Cached One Moment] Audio file not found or failed to play - continuing without audio:', error);
        // Resolve instead of reject so the flow continues
        resolve();
      };
      audioElement.play().catch((error) => {
        console.warn('[Cached One Moment] Play error - continuing without audio:', error);
        // Resolve instead of reject so the flow continues
        resolve();
      });
    } catch (error: any) {
      console.warn('[Cached One Moment] Error setting up audio - continuing without audio:', error);
      // Resolve instead of reject so the flow continues
      resolve();
    }
  });
}

