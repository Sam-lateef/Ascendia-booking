/**
 * API Credentials Test Endpoint
 * 
 * Tests if API credentials are valid by making a simple API call
 * Returns success/failure and connection details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const context = await getCurrentOrganization(req);
    
    // Only owners and admins can test credentials
    if (!['owner', 'admin'].includes(context.role)) {
      return NextResponse.json(
        { error: 'Permission denied', success: false },
        { status: 403 }
      );
    }

    const { credentialId } = await req.json();

    if (!credentialId) {
      return NextResponse.json(
        { error: 'credentialId is required', success: false },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Load credential
    const { data: credential, error } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('id', credentialId)
      .eq('organization_id', context.organizationId)
      .single();

    if (error || !credential) {
      return NextResponse.json(
        { error: 'Credential not found', success: false },
        { status: 404 }
      );
    }

    // Test based on credential type
    let testResult;
    
    switch (credential.credential_type) {
      case 'openai':
        testResult = await testOpenAI(credential.credentials);
        break;

      case 'anthropic':
        testResult = await testAnthropic(credential.credentials);
        break;

      case 'twilio':
        testResult = await testTwilio(credential.credentials);
        break;

      case 'opendental':
        testResult = await testOpenDental(credential.credentials);
        break;

      case 'evolution_api':
        testResult = await testEvolutionAPI(credential.credentials);
        break;

      case 'retell':
        testResult = await testRetell(credential.credentials);
        break;

      default:
        return NextResponse.json(
          { 
            error: `Testing not implemented for ${credential.credential_type}`,
            success: false 
          },
          { status: 400 }
        );
    }

    // Update last_used_at if test succeeded
    if (testResult.success) {
      await supabase
        .from('api_credentials')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', credentialId);
    }

    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      details: testResult.details,
      testedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Test Credentials] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'An error occurred',
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * Test OpenAI API credentials
 */
async function testOpenAI(credentials: Record<string, string>): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const apiKey = credentials.api_key;
    
    if (!apiKey) {
      return {
        success: false,
        message: 'API key not found in credentials',
      };
    }

    // Make a simple API call to list models
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `OpenAI API returned ${response.status}: ${response.statusText}`,
        details: errorData,
      };
    }

    const data = await response.json();
    const modelCount = data.data?.length || 0;

    return {
      success: true,
      message: `Connected successfully. Found ${modelCount} models.`,
      details: { modelCount },
    };

  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to OpenAI',
    };
  }
}

/**
 * Test Anthropic API credentials
 */
async function testAnthropic(credentials: Record<string, string>): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const apiKey = credentials.api_key;
    
    if (!apiKey) {
      return {
        success: false,
        message: 'API key not found in credentials',
      };
    }

    // Make a simple API call to Anthropic
    // Note: Anthropic doesn't have a models endpoint, so we'll try a minimal completion
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Anthropic API returned ${response.status}: ${response.statusText}`,
        details: errorData,
      };
    }

    return {
      success: true,
      message: 'Connected successfully to Anthropic API.',
    };

  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to Anthropic',
    };
  }
}

/**
 * Test Twilio credentials
 */
async function testTwilio(credentials: Record<string, string>): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const { account_sid, auth_token } = credentials;
    
    if (!account_sid || !auth_token) {
      return {
        success: false,
        message: 'Account SID or Auth Token not found in credentials',
      };
    }

    // Make a simple API call to get account info
    const authString = Buffer.from(`${account_sid}:${auth_token}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`, {
      headers: {
        'Authorization': `Basic ${authString}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Twilio API returned ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      message: 'Connected successfully to Twilio.',
      details: {
        accountStatus: data.status,
        friendlyName: data.friendly_name,
      },
    };

  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to Twilio',
    };
  }
}

/**
 * Test OpenDental API credentials
 */
async function testOpenDental(credentials: Record<string, string>): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const { api_url, api_key } = credentials;
    
    if (!api_url || !api_key) {
      return {
        success: false,
        message: 'API URL or API key not found in credentials',
      };
    }

    // Try to get preferences (simple endpoint that doesn't modify data)
    const baseUrl = api_url.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/preferences`, {
      headers: {
        'Authorization': api_key.startsWith('ODFHIR') || api_key.startsWith('Bearer') 
          ? api_key 
          : `Bearer ${api_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `OpenDental API returned ${response.status}: ${response.statusText}`,
        details: errorData,
      };
    }

    return {
      success: true,
      message: 'Connected successfully to OpenDental API.',
    };

  } catch (error: any) {
    // Check for connection errors
    const errorMessage = (error.message || '').toLowerCase();
    const isConnectionError =
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('connection refused');

    return {
      success: false,
      message: isConnectionError 
        ? 'Cannot connect to OpenDental API. Please check the API URL and ensure the service is running.'
        : error.message || 'Failed to connect to OpenDental',
    };
  }
}

/**
 * Test Evolution API (WhatsApp) credentials
 */
async function testEvolutionAPI(credentials: Record<string, string>): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const { api_url, api_key } = credentials;
    
    if (!api_url || !api_key) {
      return {
        success: false,
        message: 'API URL or API key not found in credentials',
      };
    }

    // Try to fetch instances (simple endpoint)
    const baseUrl = api_url.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: {
        'apikey': api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Evolution API returned ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const instanceCount = Array.isArray(data) ? data.length : 0;

    return {
      success: true,
      message: `Connected successfully. Found ${instanceCount} WhatsApp instances.`,
      details: { instanceCount },
    };

  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to Evolution API',
    };
  }
}

/**
 * Test Retell AI credentials
 */
async function testRetell(credentials: Record<string, string>): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const apiKey = credentials.api_key;

    if (!apiKey) {
      return {
        success: false,
        message: 'API key not found in credentials',
      };
    }

    // Try to list agents (simple endpoint)
    const response = await fetch('https://api.retellai.com/list-agents', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Retell Test] API Error:', response.status, errorText);
      return {
        success: false,
        message: `Retell API returned ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const agentCount = Array.isArray(data) ? data.length : 0;

    return {
      success: true,
      message: `Connected successfully. Found ${agentCount} agent${agentCount !== 1 ? 's' : ''}.`,
      details: { 
        agentCount,
        agents: Array.isArray(data) ? data.map((a: any) => ({
          agent_id: a.agent_id,
          agent_name: a.agent_name,
        })) : []
      },
    };

  } catch (error: any) {
    console.error('[Retell Test] Error:', error);
    return {
      success: false,
      message: error.message || 'Failed to connect to Retell AI',
    };
  }
}
