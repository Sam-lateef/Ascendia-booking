import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Proxy endpoint for OpenAI STT API (for API key security)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const model = formData.get('model') as string || 'whisper-1';
    const language = formData.get('language') as string || 'en';

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Convert File to File-like object for OpenAI SDK
    const fileBlob = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileBlob);
    
    // Create a File-like object
    const audioFile = new File([fileBuffer], file.name, { type: file.type });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: model,
      language: language as any,
    });

    // Log transcription for debugging
    console.log(`[STT API] Transcribed: "${transcription.text}" (file size: ${file.size} bytes, type: ${file.type})`);

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error('[STT API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}











