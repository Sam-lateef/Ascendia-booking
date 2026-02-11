/**
 * API Credentials Status Check
 * Returns which credential types are configured for the current organization
 * Shows SOURCE: DB or ENV for each credential type
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentOrganization(request);
    const supabase = getSupabaseAdmin();

    const { data: orgCredentials, error: orgErr } = await supabase
      .from('api_credentials')
      .select('credential_type, credential_name, is_active, is_default, credentials')
      .eq('organization_id', context.organizationId)
      .eq('is_active', true)
      .eq('is_default', true);

    const { data: systemCredentials } = await supabase
      .from('api_credentials')
      .select('credential_type, credential_name, is_active, credentials')
      .is('organization_id', null)
      .eq('is_active', true);

    const dbCredentials = [...(orgCredentials || [])];
    (systemCredentials || []).forEach(sc => {
      if (!dbCredentials.some(c => c.credential_type === sc.credential_type)) {
        dbCredentials.push(sc);
      }
    });

    if (orgErr) {
      console.error('[Credentials Status] Error:', orgErr);
      return NextResponse.json({
        error: orgErr.message,
        success: false,
      }, { status: 500 });
    }

    // Environment variable checks
    const envFallbacks: Record<string, { available: boolean; keys: string[] }> = {
      openai: { 
        available: !!process.env.OPENAI_API_KEY,
        keys: ['api_key']
      },
      anthropic: { 
        available: !!process.env.ANTHROPIC_API_KEY,
        keys: ['api_key']
      },
      twilio: { 
        available: !!(process.env.TWILIO_WEBSOCKET_URL),
        keys: ['account_sid', 'auth_token', 'phone_number', 'websocket_url']
      },
      evolution_api: { 
        available: !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY),
        keys: ['api_url', 'api_key']
      },
      opendental: { 
        available: !!process.env.OPENDENTAL_API_URL,
        keys: ['api_url', 'api_key']
      },
      retell: { 
        available: !!process.env.RETELL_API_KEY,
        keys: ['api_key']
      },
      google_calendar: { 
        available: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        keys: ['client_id', 'client_secret', 'refresh_token', 'calendar_id']
      },
    };

    // Build detailed status for each credential type
    const credentialStatus: Record<string, {
      source: 'DATABASE' | 'ENV' | 'NONE';
      available: boolean;
      name?: string;
      hasKeys?: string[];
    }> = {};
    
    const credentialTypes = ['openai', 'anthropic', 'twilio', 'evolution_api', 'opendental', 'retell', 'google_calendar'];
    
    credentialTypes.forEach(type => {
      const dbCred = dbCredentials?.find(c => c.credential_type === type);
      const envAvailable = envFallbacks[type]?.available || false;
      
      if (dbCred && dbCred.credentials) {
        // Check which keys have values in DB
        const creds = dbCred.credentials as Record<string, string>;
        const hasKeys = Object.keys(creds).filter(k => creds[k] && creds[k].trim() !== '');
        
        credentialStatus[type] = {
          source: 'DATABASE',
          available: true,
          name: dbCred.credential_name,
          hasKeys
        };
      } else if (envAvailable) {
        credentialStatus[type] = {
          source: 'ENV',
          available: true,
          hasKeys: envFallbacks[type].keys
        };
      } else {
        credentialStatus[type] = {
          source: 'NONE',
          available: false
        };
      }
    });

    return NextResponse.json({
      organizationId: context.organizationId,
      credentials: credentialStatus,
      summary: {
        fromDatabase: Object.values(credentialStatus).filter(c => c.source === 'DATABASE').length,
        fromEnv: Object.values(credentialStatus).filter(c => c.source === 'ENV').length,
        notConfigured: Object.values(credentialStatus).filter(c => c.source === 'NONE').length,
      },
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
