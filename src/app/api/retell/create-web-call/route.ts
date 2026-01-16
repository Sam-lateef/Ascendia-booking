import { NextRequest, NextResponse } from 'next/server';

/**
 * Create a Retell web call and return access token
 * POST /api/retell/create-web-call
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent_id, metadata } = body;

    // Use agent_id from request or fall back to environment variable
    const agentId = agent_id || process.env.RETELL_AGENT_ID;

    if (!agentId) {
      console.error('[Retell API] RETELL_AGENT_ID not configured in environment variables');
      return NextResponse.json(
        { 
          error: 'Agent ID is required',
          message: 'RETELL_AGENT_ID must be set in server environment variables (.env file)'
        },
        { status: 400 }
      );
    }

    console.log(`[Retell API] Creating web call for agent: ${agentId}`);

    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey) {
      console.error('[Retell API] RETELL_API_KEY not configured in environment variables');
      throw new Error('RETELL_API_KEY must be set in server environment variables (.env file)');
    }

    // Use Retell REST API directly (createWebCall in SDK is WebSocket-based, not suitable for server-side)
    // Try v2 endpoint first, fallback to v1 if needed
    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey, // Some APIs use X-API-Key header instead
      },
      body: JSON.stringify({
        agent_id: agentId,
        metadata: metadata || {},
        // Optional: retell_llm_dynamic_variables for custom context
        retell_llm_dynamic_variables: {
          // Add any dynamic variables here if needed
          // customer_name: metadata?.customer_name || 'Guest',
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Retell API] REST API error:', response.status, errorText);
      throw new Error(`Retell API error: ${response.status} - ${errorText}`);
    }

    const webCallResponse = await response.json();
    console.log(`[Retell API] Web call created: ${webCallResponse.call_id}`);

    // Return access token and call_id to frontend
    return NextResponse.json({
      access_token: webCallResponse.access_token,
      call_id: webCallResponse.call_id
    });
  } catch (error: any) {
    console.error('[Retell API] Error creating web call:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create call',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}


