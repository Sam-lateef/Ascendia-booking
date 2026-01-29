import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getChannelConfig, getModelFromBackend, isRealtimeBackend, type AIBackend } from "@/app/lib/channelConfigLoader";
import { getCurrentOrganization } from "@/app/lib/apiHelpers";

// Available Realtime models
const REALTIME_MODELS = {
  premium: "gpt-4o-realtime-preview-2025-06-03",  // Full model for premium mode
  standard: "gpt-4o-mini-realtime-preview-2024-12-17",  // Mini model for cost-effective standard mode
};

// Map AI backend to realtime model
function getRealtimeModel(backend: AIBackend): string {
  switch (backend) {
    case 'openai_realtime':
      return REALTIME_MODELS.premium;
    case 'openai_gpt4o':
      return REALTIME_MODELS.premium; // Fallback to premium realtime for gpt-4o
    case 'openai_gpt4o_mini':
      return REALTIME_MODELS.standard;
    default:
      return REALTIME_MODELS.premium;
  }
}

export async function GET(request: NextRequest) {
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

  // Get mode from query parameter (default: premium)
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') as 'premium' | 'standard' || 'premium';
  
  // Try to get organization-specific channel config
  let model = REALTIME_MODELS[mode] || REALTIME_MODELS.premium;
  let channelEnabled = true;
  let dataIntegrations: string[] = [];
  
  try {
    const context = await getCurrentOrganization(request);
    if (context?.organizationId) {
      const channelConfig = await getChannelConfig(context.organizationId, 'web');
      
      channelEnabled = channelConfig.enabled;
      dataIntegrations = channelConfig.data_integrations;
      
      // Use channel-configured AI backend
      if (channelConfig.ai_backend) {
        model = getRealtimeModel(channelConfig.ai_backend);
        console.log(`[Session API] Using channel config: backend=${channelConfig.ai_backend}, model=${model}`);
      }
    }
  } catch (error) {
    // If we can't get org context, use query param mode
    console.log("[Session API] No org context, using mode param:", mode);
  }

  // Check if channel is enabled
  if (!channelEnabled) {
    console.log("[Session API] Web channel is disabled for this organization");
    return NextResponse.json(
      { 
        error: "Web chat channel is disabled",
        message: "Please enable the Web channel in Settings > Channels"
      },
      { status: 403 }
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
  console.log("[Session API] Mode:", mode, "| Model:", model, "| Data Integrations:", dataIntegrations.join(', ') || 'none');

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
          model: model,
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
    return NextResponse.json({
      ...data,
      channel_config: {
        model,
        data_integrations: dataIntegrations,
      }
    });
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
