/**
 * Quick Setup for OpenDental Integration
 * Creates the base integration record so it can be configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentOrganization(request);
    
    // Only owners and admins can set up integrations
    if (!['owner', 'admin'].includes(context.role)) {
      return NextResponse.json(
        { error: 'Permission denied', success: false },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check if OpenDental integration already exists
    const { data: existing } = await supabase
      .from('external_integrations')
      .select('id')
      .eq('organization_id', context.organizationId)
      .eq('provider_key', 'opendental')
      .single();

    if (existing) {
      // Already exists - create sync config if it doesn't exist
      const { data: syncConfig } = await supabase
        .from('integration_sync_configs')
        .select('id')
        .eq('organization_id', context.organizationId)
        .eq('integration_id', existing.id)
        .single();

      if (!syncConfig) {
        // Create sync config
        await supabase
          .from('integration_sync_configs')
          .insert({
            organization_id: context.organizationId,
            integration_id: existing.id,
            sync_enabled: false,
            sync_direction: 'local_only',
            sync_on_create: true,
            sync_on_update: true,
            sync_on_delete: false,
            always_keep_local_copy: true,
            conflict_resolution: 'external_wins',
          });
      }

      return NextResponse.json({
        success: true,
        message: 'OpenDental integration already configured',
        integration_id: existing.id,
      });
    }

    // Get API URL from credentials if available
    const { data: credentials } = await supabase
      .from('api_credentials')
      .select('credentials')
      .eq('organization_id', context.organizationId)
      .eq('credential_type', 'opendental')
      .eq('is_active', true)
      .single();

    const apiUrl = credentials?.credentials?.api_url || 'https://api.opendental.com/api/v1';

    // Create OpenDental integration
    const { data: integration, error: integrationError } = await supabase
      .from('external_integrations')
      .insert({
        organization_id: context.organizationId,
        provider_key: 'opendental',
        provider_name: 'OpenDental',
        provider_type: 'dental_pms',
        api_base_url: apiUrl,
        api_version: 'v1',
        auth_type: 'api_key',
        auth_config: {
          credential_type: 'opendental',
          credential_key: 'api_key',
          header_name: 'Authorization',
          prefix: '',
        },
        default_headers: {
          'Content-Type': 'application/json',
        },
        timeout_ms: 30000,
        retry_config: {
          max_retries: 3,
          backoff: 'exponential',
        },
        is_enabled: true,
      })
      .select()
      .single();

    if (integrationError) {
      console.error('[Setup OpenDental] Error creating integration:', integrationError);
      return NextResponse.json({
        error: integrationError.message,
        success: false,
      }, { status: 500 });
    }

    // Create default sync config (disabled by default)
    const { error: syncError } = await supabase
      .from('integration_sync_configs')
      .insert({
        organization_id: context.organizationId,
        integration_id: integration.id,
        sync_enabled: false,
        sync_direction: 'local_only',
        sync_on_create: true,
        sync_on_update: true,
        sync_on_delete: false,
        always_keep_local_copy: true,
        conflict_resolution: 'external_wins',
      });

    if (syncError) {
      console.error('[Setup OpenDental] Error creating sync config:', syncError);
    }

    console.log('[Setup OpenDental] ✅ Integration created:', integration.id);
    return NextResponse.json({
      success: true,
      message: 'OpenDental integration configured successfully',
      integration,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Setup OpenDental] Error:', errorMessage);
    return NextResponse.json({
      error: errorMessage,
      success: false,
    }, { status: 500 });
  }
}
