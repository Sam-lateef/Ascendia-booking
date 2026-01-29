import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * Create a Retell web call and return access token
 * POST /api/retell/create-web-call
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent_id, metadata } = body;

    // Get organization ID from header or cookie
    let orgId = req.headers.get('x-organization-id');
    if (!orgId) {
      orgId = req.cookies.get('currentOrgId')?.value || null;
    }

    console.log('[Retell API] Organization:', orgId);

    // Load Retell credentials from database (with fallback to .env)
    let apiKey = process.env.RETELL_API_KEY;
    let agentIdToUse = agent_id || process.env.RETELL_AGENT_ID;

    if (orgId) {
      const supabase = getSupabaseAdmin();
      try {
        const { data: credentials } = await supabase
          .from('api_credentials')
          .select('credential_data')
          .eq('organization_id', orgId)
          .eq('service_name', 'retell')
          .single();

        if (credentials?.credential_data) {
          const creds = credentials.credential_data;
          if (creds.api_key) {
            apiKey = creds.api_key;
            console.log('[Retell API] Using DB API key for org:', orgId);
          }
          if (creds.agent_id && !agent_id) {
            agentIdToUse = creds.agent_id;
            console.log('[Retell API] Using DB agent ID:', agentIdToUse);
          }
        }
      } catch (error) {
        console.log('[Retell API] No DB credentials, falling back to .env');
      }
    }

    if (!agentIdToUse) {
      console.error('[Retell API] Agent ID not configured');
      return NextResponse.json(
        { 
          error: 'Agent ID is required',
          message: 'Configure Retell Agent ID in /admin/settings/integrations'
        },
        { status: 400 }
      );
    }

    if (!apiKey) {
      console.error('[Retell API] API key not configured');
      throw new Error('Configure Retell API Key in /admin/settings/integrations');
    }

    console.log(`[Retell API] Creating web call for agent: ${agentIdToUse}`);

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
        agent_id: agentIdToUse,
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


