import { NextRequest, NextResponse } from 'next/server';
import { getChannelConfig, type ChannelType } from '@/app/lib/channelConfigLoader';

/**
 * PUBLIC API - No authentication required
 * GET /api/public/channel-config?orgId=xxx&channel=web
 * 
 * Get channel configuration for embeddable web chat widget
 * Only returns non-sensitive configuration data
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const channel = searchParams.get('channel') as ChannelType;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel is required' },
        { status: 400 }
      );
    }

    // Only allow web channel for public API (security)
    if (channel !== 'web') {
      return NextResponse.json(
        { error: 'Only web channel is accessible via public API' },
        { status: 403 }
      );
    }

    // Load channel configuration
    const config = await getChannelConfig(orgId, channel);

    // Check if channel is enabled
    if (!config.enabled) {
      return NextResponse.json(
        { error: 'Web chat is not enabled for this organization' },
        { status: 403 }
      );
    }

    // Return configuration (excluding sensitive data if any)
    return NextResponse.json({
      config: {
        channel: config.channel,
        enabled: config.enabled,
        ai_backend: config.ai_backend,
        settings: config.settings,
        data_integrations: config.data_integrations,
        // Don't expose raw instructions for security - web chat will fetch via authenticated API
        hasInstructions: !!config.instructions
      }
    });
  } catch (error: any) {
    console.error('[Public API] Error fetching channel config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel configuration' },
      { status: 500 }
    );
  }
}
