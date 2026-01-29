/**
 * Integration Settings - Individual Config
 * PUT: Update integration sync config
 * DELETE: Delete integration sync config
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function PUT(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const context = await getCurrentOrganization(request);
    
    // Only owners and admins can update integration settings
    if (!['owner', 'admin'].includes(context.role)) {
      return NextResponse.json(
        { error: 'Permission denied', success: false },
        { status: 403 }
      );
    }

    const configId = params.configId;
    const body = await request.json();
    
    const {
      sync_enabled,
      sync_direction,
      sync_on_create,
      sync_on_update,
      sync_on_delete,
      always_keep_local_copy,
      conflict_resolution,
      webhook_url,
      webhook_events,
    } = body;

    // Validate sync_direction if provided
    if (sync_direction) {
      const validDirections = ['local_only', 'to_external', 'from_external', 'bidirectional'];
      if (!validDirections.includes(sync_direction)) {
        return NextResponse.json(
          { error: `sync_direction must be one of: ${validDirections.join(', ')}`, success: false },
          { status: 400 }
        );
      }
    }

    // Validate conflict_resolution if provided
    if (conflict_resolution) {
      const validResolutions = ['external_wins', 'local_wins', 'manual', 'latest_timestamp'];
      if (!validResolutions.includes(conflict_resolution)) {
        return NextResponse.json(
          { error: `conflict_resolution must be one of: ${validResolutions.join(', ')}`, success: false },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseAdmin();

    // Verify config belongs to organization
    const { data: existing, error: fetchError } = await supabase
      .from('integration_sync_configs')
      .select('id')
      .eq('id', configId)
      .eq('organization_id', context.organizationId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Config not found', success: false },
        { status: 404 }
      );
    }

    // Build update object (only include provided fields)
    const updateData: any = {};
    if (sync_enabled !== undefined) updateData.sync_enabled = sync_enabled;
    if (sync_direction !== undefined) updateData.sync_direction = sync_direction;
    if (sync_on_create !== undefined) updateData.sync_on_create = sync_on_create;
    if (sync_on_update !== undefined) updateData.sync_on_update = sync_on_update;
    if (sync_on_delete !== undefined) updateData.sync_on_delete = sync_on_delete;
    if (always_keep_local_copy !== undefined) updateData.always_keep_local_copy = always_keep_local_copy;
    if (conflict_resolution !== undefined) updateData.conflict_resolution = conflict_resolution;
    if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
    if (webhook_events !== undefined) updateData.webhook_events = webhook_events;

    // Update config
    const { data, error } = await supabase
      .from('integration_sync_configs')
      .update(updateData)
      .eq('id', configId)
      .eq('organization_id', context.organizationId)
      .select()
      .single();

    if (error) {
      console.error('[Integration Settings] Error updating config:', error);
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 500 });
    }

    console.log('[Integration Settings] ✅ Config updated:', configId);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const context = await getCurrentOrganization(request);
    
    // Only owners can delete integration settings
    if (context.role !== 'owner') {
      return NextResponse.json(
        { error: 'Permission denied - owner access required', success: false },
        { status: 403 }
      );
    }

    const configId = params.configId;
    const supabase = getSupabaseAdmin();

    // Delete config
    const { error } = await supabase
      .from('integration_sync_configs')
      .delete()
      .eq('id', configId)
      .eq('organization_id', context.organizationId);

    if (error) {
      console.error('[Integration Settings] Error deleting config:', error);
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 500 });
    }

    console.log('[Integration Settings] ✅ Config deleted:', configId);
    return NextResponse.json({
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

export async function GET(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const context = await getCurrentOrganization(request);
    const configId = params.configId;
    const supabase = getSupabaseAdmin();

    // Get specific config with integration details
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
      .eq('id', configId)
      .eq('organization_id', context.organizationId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Config not found', success: false },
        { status: 404 }
      );
    }

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
