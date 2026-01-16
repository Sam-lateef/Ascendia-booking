import { NextResponse } from "next/server";

export async function GET() {
  // Check if API key is set
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error("[Session API] OPENAI_API_KEY is not set");
    return NextResponse.json(
      { 
        error: "OPENAI_API_KEY environment variable is not set",
        message: "Please set OPENAI_API_KEY in Fly.io secrets"
      },
      { status: 500 }
    );
  }

  // Log key info for debugging (without exposing full key)
  console.log("[Session API] API Key info:", {
    length: apiKey.length,
    startsWith: apiKey.substring(0, 10),
    endsWith: apiKey.substring(apiKey.length - 10),
    hasQuotes: apiKey.startsWith('"') || apiKey.endsWith('"'),
    hasWhitespace: apiKey.trim() !== apiKey
  });

  // Clean the API key (remove quotes and whitespace if present)
  const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, '');

  try {
    console.log("[Session API] Creating realtime session...");
    
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error("[Session API] OpenAI API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      return NextResponse.json(
        { 
          error: "Failed to create realtime session",
          status: response.status,
          details: errorData
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.client_secret?.value) {
      console.error("[Session API] No client_secret in response:", data);
      return NextResponse.json(
        { 
          error: "No ephemeral key in response",
          response: data
        },
        { status: 500 }
      );
    }

    console.log("[Session API] Session created successfully");
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Session API] Error:", {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { 
        error: "Internal Server Error",
        message: error.message
      },
      { status: 500 }
    );
  }
}
