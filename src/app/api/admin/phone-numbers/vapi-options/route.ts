/**
 * Fetch Available Options from Vapi API
 * 
 * GET - Returns all available voices, models, transcribers for dropdown population
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_API_URL = 'https://api.vapi.ai';

export async function GET(req: NextRequest) {
  try {
    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY not configured');
    }

    await getCurrentOrganization(req); // Verify authenticated

    console.log('[Vapi Options] Fetching available options from Vapi API...');

    // Fetch available voices from Vapi
    const voicesResponse = await fetch(`${VAPI_API_URL}/voice`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });

    let customVoices = [];
    if (voicesResponse.ok) {
      customVoices = await voicesResponse.json();
      console.log('[Vapi Options] Fetched custom voices:', customVoices.length);
    } else {
      console.log('[Vapi Options] Could not fetch custom voices (status:', voicesResponse.status, ')');
    }

    // Return structured options for dropdowns
    return NextResponse.json({
      // Voice providers
      voiceProviders: [
        { value: 'vapi', label: 'Vapi (Built-in)' },
        { value: '11labs', label: 'ElevenLabs' },
        { value: 'azure', label: 'Azure' },
        { value: 'playht', label: 'PlayHT' },
        { value: 'deepgram', label: 'Deepgram' },
        { value: 'openai', label: 'OpenAI' }
      ],
      
      // Voices grouped by provider
      // Source: https://docs.vapi.ai/providers/voice/vapi-voices
      // Source: https://docs.vapi.ai/providers/voice/vapi-voices/legacy-migration
      voicesByProvider: {
        vapi: [
          // Active Vapi voices (PascalCase required by API)
          { value: 'Elliot', label: 'Elliot (Male, Canadian)' },
          { value: 'Savannah', label: 'Savannah (Female, American Southern)' },
          { value: 'Leo', label: 'Leo (Male)' },
          { value: 'Zoe', label: 'Zoe (Female)' },
          { value: 'Mia', label: 'Mia (Female)' },
          { value: 'Jess', label: 'Jess (Female)' },
          { value: 'Zac', label: 'Zac (Male)' },
          { value: 'Dan', label: 'Dan (Male)' },
          { value: 'Leah', label: 'Leah (Female)' },
          { value: 'Tara', label: 'Tara (Female)' },
          { value: 'Rohan', label: 'Rohan (Male)' },
          ...customVoices.filter((v: any) => v.provider === 'vapi' || !v.provider).map((v: any) => ({
            value: v.voiceId || v.name,
            label: `${v.name || v.voiceId} (Custom)`
          }))
        ],
        '11labs': [
          { value: 'sarah', label: 'Sarah' },
          { value: 'rachel', label: 'Rachel' },
          { value: 'adam', label: 'Adam' },
          { value: 'antoni', label: 'Antoni' },
          { value: 'bella', label: 'Bella' },
          { value: 'emily', label: 'Emily' },
          { value: 'josh', label: 'Josh' },
          ...customVoices.filter((v: any) => v.provider === '11labs').map((v: any) => ({
            value: v.voiceId,
            label: `${v.name || v.voiceId} (Custom)`
          }))
        ],
        azure: [
          { value: 'en-US-JennyNeural', label: 'Jenny (Female, American)' },
          { value: 'en-US-GuyNeural', label: 'Guy (Male, American)' },
          { value: 'en-US-AriaNeural', label: 'Aria (Female, American)' },
          { value: 'en-GB-SoniaNeural', label: 'Sonia (Female, British)' },
          { value: 'en-GB-RyanNeural', label: 'Ryan (Male, British)' }
        ],
        playht: [
          { value: 'jennifer', label: 'Jennifer' },
          { value: 'melissa', label: 'Melissa' },
          { value: 'will', label: 'Will' },
          { value: 'chris', label: 'Chris' }
        ],
        deepgram: [
          { value: 'aura-asteria-en', label: 'Asteria (Female)' },
          { value: 'aura-luna-en', label: 'Luna (Female)' },
          { value: 'aura-stella-en', label: 'Stella (Female)' },
          { value: 'aura-athena-en', label: 'Athena (Female)' },
          { value: 'aura-hera-en', label: 'Hera (Female)' },
          { value: 'aura-orion-en', label: 'Orion (Male)' },
          { value: 'aura-arcas-en', label: 'Arcas (Male)' },
          { value: 'aura-perseus-en', label: 'Perseus (Male)' },
          { value: 'aura-angus-en', label: 'Angus (Male)' },
          { value: 'aura-orpheus-en', label: 'Orpheus (Male)' },
          { value: 'aura-helios-en', label: 'Helios (Male)' },
          { value: 'aura-zeus-en', label: 'Zeus (Male)' }
        ],
        openai: [
          { value: 'alloy', label: 'Alloy' },
          { value: 'echo', label: 'Echo' },
          { value: 'fable', label: 'Fable' },
          { value: 'onyx', label: 'Onyx' },
          { value: 'nova', label: 'Nova' },
          { value: 'shimmer', label: 'Shimmer' }
        ]
      },
      
      // Model providers and models
      modelProviders: [
        { value: 'openai', label: 'OpenAI' },
        { value: 'anthropic', label: 'Anthropic (Claude)' },
        { value: 'groq', label: 'Groq' }
      ],
      
      modelsByProvider: {
        openai: [
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
        ],
        anthropic: [
          { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
        ],
        groq: [
          { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B' }
        ]
      },
      
      // Transcriber options
      transcribers: [
        { value: 'deepgram', label: 'Deepgram' },
        { value: 'talkscriber', label: 'Talkscriber' }
      ],
      
      transcriberModels: {
        deepgram: [
          { value: 'nova-3', label: 'Nova 3 (Latest)' },
          { value: 'nova-2', label: 'Nova 2' },
          { value: 'nova', label: 'Nova 1' }
        ]
      },
      
      // Language options
      languages: [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
        { value: 'de', label: 'German' },
        { value: 'multi', label: 'Multi-language' }
      ],
      
      // First message modes
      firstMessageModes: [
        { value: 'assistant-speaks-first', label: 'Assistant Speaks First' },
        { value: 'assistant-waits', label: 'Assistant Waits' }
      ],
      
      // Countries for phone numbers
      countries: [
        { value: 'US', label: 'United States' },
        { value: 'CA', label: 'Canada' },
        { value: 'GB', label: 'United Kingdom' },
        { value: 'AU', label: 'Australia' }
      ],
      
      // ElevenLabs models (for 11labs provider)
      elevenLabsModels: [
        { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5 (Recommended)' },
        { value: 'eleven_turbo_v2', label: 'Turbo v2' },
        { value: 'eleven_multilingual_v2', label: 'Multilingual v2' }
      ]
    });
  } catch (error: any) {
    console.error('[Vapi Options] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch options' },
      { status: 500 }
    );
  }
}
