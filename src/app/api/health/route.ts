import { NextResponse } from "next/server";

export async function GET() {
  // Check if environment variables are set (without exposing values)
  const envStatus = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'set' : 'missing',
    OPENDENTAL_API_KEY: process.env.OPENDENTAL_API_KEY ? 'set' : 'missing',
    OPENDENTAL_MOCK_MODE: process.env.OPENDENTAL_MOCK_MODE || 'not set',
    OPENDENTAL_API_BASE_URL: process.env.OPENDENTAL_API_BASE_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  };

  // Try to connect to OpenAI API to verify it works
  let openaiStatus = 'unknown';
  try {
    if (process.env.OPENAI_API_KEY) {
      // Clean the API key (remove quotes and whitespace if present)
      const cleanApiKey = process.env.OPENAI_API_KEY.trim().replace(/^["']|["']$/g, '');
      
      const response = await fetch(
        "https://api.openai.com/v1/realtime/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cleanApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-realtime-preview-2025-06-03",
          }),
        }
      );
      
      if (response.ok) {
        openaiStatus = 'connected';
      } else {
        openaiStatus = `error: ${response.status} ${response.statusText}`;
      }
    } else {
      openaiStatus = 'no_api_key';
    }
  } catch (error: any) {
    openaiStatus = `error: ${error.message}`;
  }

  const status: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: envStatus,
    openai: {
      status: openaiStatus,
    },
  };

  return NextResponse.json(status);
}


