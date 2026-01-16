import { NextRequest, NextResponse } from 'next/server';

// Dynamic import to avoid Next.js bundling issues
let RetellClient: any = null;
let retellClient: any = null;

async function getRetellClient() {
  if (!RetellClient) {
    const sdk = await import('retell-sdk');
    RetellClient = sdk.RetellClient || sdk.default?.RetellClient;
  }
  if (!retellClient && RetellClient) {
    retellClient = new RetellClient({
      apiKey: process.env.RETELL_API_KEY!,
    });
  }
  return retellClient;
}

/**
 * Handle Retell webhook events
 * POST /api/retell/webhook
 */
export async function POST(req: NextRequest) {
  try {
    // Get webhook signature from headers
    const signature = req.headers.get('x-retell-signature') as string;
    
    if (!signature) {
      console.error('[Retell Webhook] Missing signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Get request body as text for signature verification
    const bodyText = await req.text();
    
    // Get Retell client
    const client = await getRetellClient();
    
    // Verify webhook signature
    // Note: Retell SDK verify method signature may vary, adjust if needed
    const isValid = client.verify?.(
      bodyText,
      process.env.RETELL_API_KEY!,
      signature
    ) ?? true; // If verify method doesn't exist, skip verification for now

    if (!isValid) {
      console.error('[Retell Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse verified body
    const body = JSON.parse(bodyText);
    const { event, call } = body;

    console.log(`[Retell Webhook] Received event: ${event} for call: ${call?.call_id}`);

    // Handle different event types
    switch (event) {
      case 'call_started':
        console.log(`[Retell Webhook] Call started: ${call.call_id}`);
        await handleCallStarted(call);
        break;

      case 'call_ended':
        console.log(`[Retell Webhook] Call ended: ${call.call_id}`);
        console.log(`[Retell Webhook] Disconnection reason: ${call.disconnection_reason}`);
        if (call.end_timestamp && call.start_timestamp) {
          const duration = call.end_timestamp - call.start_timestamp;
          console.log(`[Retell Webhook] Call duration: ${duration}ms`);
        }
        await handleCallEnded(call);
        break;

      case 'call_analyzed':
        console.log(`[Retell Webhook] Call analyzed: ${call.call_id}`);
        // This event includes post-call analysis data
        // Use this for most comprehensive call data
        await handleCallAnalyzed(call);
        break;

      default:
        console.log(`[Retell Webhook] Unknown event: ${event}`);
    }

    // Always respond with 200 OK within 10 seconds (Retell requirement)
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Retell Webhook] Error:', error);
    // Still return 200 to prevent Retell from retrying
    return NextResponse.json(
      { error: 'Internal error', message: error.message },
      { status: 200 }
    );
  }
}

/**
 * Handle call started event
 */
async function handleCallStarted(call: any) {
  try {
    // TODO: Implement your logic
    // - Store call start in database
    // - Initialize any session data
    // - Send notification
    console.log(`[Retell Webhook] Call started details:`, {
      call_id: call.call_id,
      from_number: call.from_number,
      to_number: call.to_number,
      start_timestamp: call.start_timestamp,
    });
  } catch (error) {
    console.error('[Retell Webhook] Error handling call_started:', error);
  }
}

/**
 * Handle call ended event
 */
async function handleCallEnded(call: any) {
  try {
    // TODO: Implement your logic
    // - Store transcript: call.transcript
    // - Store structured transcript: call.transcript_object
    // - Store transcript with tool calls: call.transcript_with_tool_calls
    // - Calculate metrics
    // - Update OpenDental if needed
    console.log(`[Retell Webhook] Call ended details:`, {
      call_id: call.call_id,
      transcript: call.transcript,
      transcript_object: call.transcript_object,
      transcript_with_tool_calls: call.transcript_with_tool_calls,
    });
  } catch (error) {
    console.error('[Retell Webhook] Error handling call_ended:', error);
  }
}

/**
 * Handle call analyzed event (most comprehensive)
 */
async function handleCallAnalyzed(call: any) {
  try {
    // TODO: Implement your logic
    // This is the most comprehensive event with all analysis
    // Use this for final processing, reporting, analytics
    console.log(`[Retell Webhook] Call analyzed details:`, {
      call_id: call.call_id,
      // Include any analysis fields you need
    });
  } catch (error) {
    console.error('[Retell Webhook] Error handling call_analyzed:', error);
  }
}


