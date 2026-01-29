/**
 * Dynamic Integration API Route
 * 
 * Universal route for all external integrations (OpenDental, Dentrix, Google Calendar, etc.)
 * Handles function calls by loading configuration from database and executing via IntegrationExecutor
 * 
 * Usage:
 * POST /api/integrations/opendental
 * POST /api/integrations/dentrix
 * POST /api/integrations/google_calendar
 * 
 * Body: { functionName: string, parameters: Record<string, any> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { IntegrationExecutor, getIntegrationByProvider } from '@/app/lib/integrations/IntegrationExecutor';

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;
    console.log(`[Integration API] Request for provider: ${provider}`);

    // Parse request body
    const body = await req.json();
    const { functionName, parameters } = body;

    if (!functionName) {
      return NextResponse.json(
        { 
          error: 'functionName is required',
          success: false 
        },
        { status: 400 }
      );
    }

    // Get organization context
    const context = await getCurrentOrganization(req);

    // Load integration config for this org + provider
    const integration = await getIntegrationByProvider(
      context.organizationId,
      provider
    );

    if (!integration) {
      return NextResponse.json(
        { 
          error: `Integration '${provider}' not found for your organization`,
          success: false,
          hint: 'Please configure this integration in the admin panel first'
        },
        { status: 404 }
      );
    }

    if (!integration.is_enabled) {
      return NextResponse.json(
        { 
          error: `Integration '${provider}' is disabled`,
          success: false,
          hint: 'Enable this integration in the admin panel'
        },
        { status: 403 }
      );
    }

    // Execute via dynamic engine
    console.log(`[Integration API] Executing ${functionName} on ${integration.provider_name}`);
    
    const executor = new IntegrationExecutor(
      integration.id,
      context.organizationId
    );

    const result = await executor.execute(functionName, parameters || {});

    return NextResponse.json({
      ...result,
      success: true,
      provider: integration.provider_name,
      executedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Integration API] Error:', error);

    // Check for connection errors
    const errorMessage = (error.message || '').toLowerCase();
    const isConnectionError =
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET' ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('network error') ||
      errorMessage.includes('connection refused') ||
      errorMessage.includes('timeout');

    const errorType = isConnectionError ? 'connection_error' : 'execution_error';

    return NextResponse.json(
      {
        error: error.message || 'An error occurred',
        details: error.details || null,
        errorType,
        provider: params.provider,
        success: false,
      },
      { status: error.status || 500 }
    );
  }
}

/**
 * GET endpoint - return integration status and available functions
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;
    const context = await getCurrentOrganization(req);

    // Load integration config
    const integration = await getIntegrationByProvider(
      context.organizationId,
      provider
    );

    if (!integration) {
      return NextResponse.json(
        { 
          error: `Integration '${provider}' not found`,
          success: false 
        },
        { status: 404 }
      );
    }

    // Load available endpoints
    const { getSupabaseAdmin } = await import('@/app/lib/supabaseClient');
    const supabase = getSupabaseAdmin();

    const { data: endpoints, error } = await supabase
      .from('integration_endpoints')
      .select('function_name, category, description, http_method, required_params')
      .eq('integration_id', integration.id)
      .eq('is_active', true)
      .order('category')
      .order('function_name');

    if (error) {
      console.error('[Integration API] Error loading endpoints:', error);
    }

    return NextResponse.json({
      success: true,
      integration: {
        provider_key: integration.provider_key,
        provider_name: integration.provider_name,
        provider_type: integration.provider_type,
        is_enabled: integration.is_enabled,
        api_base_url: integration.api_base_url,
      },
      endpoints: endpoints || [],
      endpoint_count: endpoints?.length || 0,
    });

  } catch (error: any) {
    console.error('[Integration API] GET Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred',
        success: false,
      },
      { status: 500 }
    );
  }
}
