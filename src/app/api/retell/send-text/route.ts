import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint to send text messages to Retell WebSocket server
 * POST /api/retell/send-text
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { call_id, text } = body;

    if (!call_id || !text) {
      console.warn(`[Retell API] ❌ Missing call_id or text:`, { call_id: !!call_id, text: !!text });
      return NextResponse.json(
        { error: 'call_id and text are required' },
        { status: 400 }
      );
    }

    // Get WebSocket server URL from environment or default to localhost
    const websocketServerUrl = process.env.WEBSOCKET_SERVER_URL || process.env.RETELL_WEBSOCKET_SERVER_URL || 'http://localhost:8080';

    // Proxy the request to the WebSocket server
    const response = await fetch(`${websocketServerUrl}/api/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        call_id,
        text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Retell API] WebSocket server error:', response.status, errorText);
      return NextResponse.json(
        { error: `WebSocket server error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Retell API] Error proxying text message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send text message',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

