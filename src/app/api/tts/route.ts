import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Proxy endpoint for OpenAI TTS API (for API key security)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = 'sage', model = 'tts-1' } = body; // Using tts-1 for faster generation (vs tts-1-hd for quality)

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const ttsStartTime = Date.now();
    const mp3 = await openai.audio.speech.create({
      model: model,
      voice: voice as any,
      input: text,
    });
    const ttsEndTime = Date.now();
    console.log(`[TTS API] OpenAI TTS generation took ${ttsEndTime - ttsStartTime}ms for ${text.length} characters`);

    // Convert response to buffer
    const bufferStartTime = Date.now();
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const bufferEndTime = Date.now();
    console.log(`[TTS API] Buffer conversion took ${bufferEndTime - bufferStartTime}ms`);

    // Return audio file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[TTS API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate speech' },
      { status: 500 }
    );
  }
}

