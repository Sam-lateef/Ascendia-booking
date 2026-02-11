/**
 * Preview Master Template Configuration
 * 
 * GET - Fetch and display the full Vapi assistant config that will be used as template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_API_URL = 'https://api.vapi.ai';
const MASTER_TEMPLATE_ASSISTANT_ID = process.env.VAPI_MASTER_TEMPLATE_ASSISTANT_ID;

export async function GET(req: NextRequest) {
  try {
    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY not configured');
    }

    if (!MASTER_TEMPLATE_ASSISTANT_ID) {
      return NextResponse.json({
        error: 'VAPI_MASTER_TEMPLATE_ASSISTANT_ID not set',
        message: 'Set this environment variable to your reference assistant ID'
      });
    }

    await getCurrentOrganization(req); // Verify user is authenticated

    console.log('[Template Preview] Fetching config from:', MASTER_TEMPLATE_ASSISTANT_ID);

    const response = await fetch(`${VAPI_API_URL}/assistant/${MASTER_TEMPLATE_ASSISTANT_ID}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });

    if (!response.ok) {
      throw new Error(`Vapi API error: ${response.statusText}`);
    }

    const config = await response.json();

    console.log('[Template Preview] Successfully fetched config');
    console.log('[Template Preview] Config keys:', Object.keys(config));

    // Return formatted for easy viewing
    return NextResponse.json({
      assistantId: MASTER_TEMPLATE_ASSISTANT_ID,
      config: config,
      summary: {
        name: config.name,
        model: `${config.model?.provider} ${config.model?.model}`,
        temperature: config.model?.temperature,
        maxTokens: config.model?.maxTokens,
        voiceProvider: config.voice?.provider,
        voiceId: config.voice?.voiceId,
        voiceModel: config.voice?.model,
        transcriber: `${config.transcriber?.provider} ${config.transcriber?.model}`,
        firstMessage: config.firstMessage,
        firstMessageMode: config.firstMessageMode,
        functionsCount: config.model?.functions?.length || 0,
        hasServerUrl: !!config.serverUrl,
        allConfigKeys: Object.keys(config)
      }
    });
  } catch (error: any) {
    console.error('[Template Preview] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template' },
      { status: 500 }
    );
  }
}
