import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Proxy endpoint for the OpenAI Responses API
export async function POST(req: NextRequest) {
  const body = await req.json();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (body.text?.format?.type === 'json_schema') {
    return await structuredResponse(openai, body);
  } else {
    return await textResponse(openai, body);
  }
}

async function structuredResponse(openai: OpenAI, body: any) {
  try {
    const response = await openai.responses.parse({
      ...(body as any),
      stream: false,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('responses proxy error', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 }); 
  }
}

async function textResponse(openai: OpenAI, body: any) {
  try {
    // Calculate static system prompt length (this will be auto-cached by OpenAI if identical)
    // Handle both array format (old) and string format (new)
    const systemMessage = body.input?.find((item: any) => item.role === 'system');
    let systemPromptLength = 0;
    if (systemMessage?.content) {
      if (Array.isArray(systemMessage.content)) {
        // Old format: content is an array of objects
        systemPromptLength = systemMessage.content.reduce((sum: number, c: any) => sum + (c.text?.length || 0), 0);
      } else if (typeof systemMessage.content === 'string') {
        // New format: content is a string (dynamic instructions)
        systemPromptLength = systemMessage.content.length;
      }
    }
    
    console.log('[Responses API] Request:', {
      model: body.model,
      toolsCount: body.tools?.length || 0,
      inputCount: body.input?.length || 0,
      instructionsLength: typeof body.instructions === 'string' ? body.instructions.length : 0,
      systemPromptLength: systemPromptLength,
      note: 'Static instructions in body.instructions are identical across calls → OpenAI auto-caches (50% discount)'
    });
    
    const response = await openai.responses.create({
      ...(body as any),
      stream: false,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[Responses API] OpenAI Error:', {
      message: err.message,
      status: err.status,
      code: err.code,
      type: err.type,
      error: err.error,
      body: err.body
    });
    
    // Check for quota/insufficient credits errors
    const errorMessage = (err.message || err.error?.message || '').toLowerCase();
    const isQuotaError = 
      err.status === 429 ||
      err.code === 'insufficient_quota' ||
      err.type === 'insufficient_quota' ||
      errorMessage.includes('quota') ||
      errorMessage.includes('insufficient') ||
      errorMessage.includes('billing') ||
      errorMessage.includes('rate limit') ||
      (err.error?.code && err.error.code === 'insufficient_quota');
    
    return NextResponse.json({ 
      error: 'failed',
      errorType: isQuotaError ? 'openai_quota' : 'unknown',
      details: err.message || err.error?.message || 'Unknown error',
      status: err.status || 500
    }, { status: err.status || 500 });
  }
}
  