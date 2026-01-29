/**
 * API Credentials Status Check
 * Returns which credential types are configured for the current organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentOrganization(request);
    const supabase = getSupabaseAdmin();

    // Check which credential types exist for this organization
    const { data, error } = await supabase
      .from('api_credentials')
      .select('credential_type, is_active, is_default')
      .eq('organization_id', context.organizationId)
      .eq('is_active', true);

    if (error) {
      console.error('[Credentials Status] Error:', error);
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 500 });
    }

    // Build status object
    const status: Record<string, boolean> = {};
    const credentialTypes = ['openai', 'anthropic', 'twilio', 'evolution_api', 'opendental', 'retell', 'google_calendar'];
    
    credentialTypes.forEach(type => {
      status[type] = data?.some(c => c.credential_type === type) || false;
    });

    // Also check environment variables as fallback
    const envFallbacks: Record<string, boolean> = {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      evolution_api: !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY),
      opendental: !!process.env.OPENDENTAL_API_URL,
      retell: !!process.env.RETELL_API_KEY,
      google_calendar: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    };

    // Merge: DB takes precedence, but show env as fallback
    Object.keys(status).forEach(key => {
      if (!status[key] && envFallbacks[key]) {
        status[key] = true; // Available via env vars
      }
    });

    return NextResponse.json({
      status,
      hasDbCredentials: data && data.length > 0,
      usingEnvFallback: Object.keys(envFallbacks).filter(k => envFallbacks[k] && !data?.some(c => c.credential_type === k)),
      success: true,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Credentials Status] Error:', errorMessage);
    return NextResponse.json({
      error: errorMessage,
      success: false,
    }, { status: 500 });
  }
}
