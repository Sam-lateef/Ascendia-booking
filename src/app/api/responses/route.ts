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
    console.log('[Responses API] Request:', {
      model: body.model,
      toolsCount: body.tools?.length || 0,
      inputCount: body.input?.length || 0,
      instructionsLength: body.instructions?.length || 0
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
    return NextResponse.json({ 
      error: 'failed',
      details: err.message || err.error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
  