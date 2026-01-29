/**
 * Integration Settings API
 * GET: List all integration sync configs for current organization
 * POST: Create new integration sync config
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentOrganization(request);
    const supabase = getSupabaseAdmin();

    // Get all integration sync configs with integration details
    const { data, error } = await supabase
      .from('integration_sync_configs')
      .select(`
        *,
        external_integrations (
          id,
          provider_key,
          provider_name,
          provider_type,
          is_enabled
        )
      `)
      .eq('organization_id', context.organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Integration Settings] Error fetching configs:', error);
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 500 });
    }

    return NextResponse.json({
      configs: data || [],
      success: true,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Integration Settings] Error:', errorMessage);
    return NextResponse.json({
      error: errorMessage,
      success: false,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentOrganization(request);
    
    // Only owners and admins can create integration settings
    if (!['owner', 'admin'].includes(context.role)) {
      return NextResponse.json(
        { error: 'Permission denied', success: false },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      integration_id,
      sync_enabled = true,
      sync_direction = 'local_only',
      sync_on_create = true,
      sync_on_update = true,
      sync_on_delete = false,
      always_keep_local_copy = true,
      conflict_resolution = 'external_wins',
      webhook_url,
      webhook_events,
    } = body;

    // Validate required fields
    if (!integration_id) {
      return NextResponse.json(
        { error: 'integration_id is required', success: false },
        { status: 400 }
      );
    }

    // Validate sync_direction
    const validDirections = ['local_only', 'to_external', 'from_external', 'bidirectional'];
    if (!validDirections.includes(sync_direction)) {
      return NextResponse.json(
        { error: `sync_direction must be one of: ${validDirections.join(', ')}`, success: false },
        { status: 400 }
      );
    }

    // Validate conflict_resolution
    const validResolutions = ['external_wins', 'local_wins', 'manual', 'latest_timestamp'];
    if (!validResolutions.includes(conflict_resolution)) {
      return NextResponse.json(
        { error: `conflict_resolution must be one of: ${validResolutions.join(', ')}`, success: false },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify integration belongs to organization
    const { data: integration, error: integrationError } = await supabase
      .from('external_integrations')
      .select('id')
      .eq('id', integration_id)
      .eq('organization_id', context.organizationId)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found', success: false },
        { status: 404 }
      );
    }

    // Create sync config
    const { data, error } = await supabase
      .from('integration_sync_configs')
      .insert({
        organization_id: context.organizationId,
        integration_id,
        sync_enabled,
        sync_direction,
        sync_on_create,
        sync_on_update,
        sync_on_delete,
        always_keep_local_copy,
        conflict_resolution,
        webhook_url,
        webhook_events: webhook_events || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[Integration Settings] Error creating config:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Sync config already exists for this integration', success: false },
          { status: 409 }
        );
      }
      
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 500 });
    }

    console.log('[Integration Settings] ✅ Sync config created:', data.id);
    return NextResponse.json({
      config: data,
      success: true,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Integration Settings] Error:', errorMessage);
    return NextResponse.json({
      error: errorMessage,
      success: false,
    }, { status: 500 });
  }
}
