import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';
import { clearChannelConfigCache } from '@/app/lib/channelConfigLoader';

// GET - Fetch channel configurations for the organization
export async function GET(request: NextRequest) {
  try {
    // Get organization ID from header (set by middleware) or cookie
    let orgId = request.headers.get('x-organization-id');
    
    // Fallback: try to get from cookie directly
    if (!orgId) {
      orgId = request.cookies.get('currentOrgId')?.value || null;
    }
    
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization ID required' }, { status: 400 });
    }

    console.log('[Channel Configs API] Loading configs for org:', orgId);

    // First try to get org-specific configs
    const supabase = getSupabaseAdmin();
    const { data: configs, error } = await supabase
      .from('channel_configurations')
      .select('*')
      .eq('organization_id', orgId);

    if (error) {
      // If table doesn't exist yet, return empty array
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, configs: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, configs: configs || [] });
  } catch (error) {
    console.error('Error fetching channel configs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch channel configurations' }, { status: 500 });
  }
}

// POST - Create or update a channel configuration
export async function POST(request: NextRequest) {
  try {
    // Get organization ID from header (set by middleware) or cookie
    let orgId = request.headers.get('x-organization-id');
    
    // Fallback: try to get from cookie directly
    if (!orgId) {
      orgId = request.cookies.get('currentOrgId')?.value || null;
    }
    
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { 
      channel, 
      enabled, 
      ai_backend, 
      settings, 
      data_integrations, 
      one_agent_instructions,
      receptionist_instructions,
      supervisor_instructions,
      instructions // Deprecated - kept for backward compatibility
    } = body;

    console.log('[Channel Configs API] Saving config for org:', orgId, 'channel:', channel);

    if (!channel) {
      return NextResponse.json({ success: false, error: 'Channel is required' }, { status: 400 });
    }

    // Check if config exists
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from('channel_configurations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('channel', channel)
      .single();

    const configData = {
      organization_id: orgId,
      channel,
      enabled: enabled ?? false,
      ai_backend: ai_backend || null,
      settings: settings || {},
      data_integrations: data_integrations || [],
      one_agent_instructions: one_agent_instructions || null,
      receptionist_instructions: receptionist_instructions || null,
      supervisor_instructions: supervisor_instructions || null,
      instructions: instructions || null, // Deprecated
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update
      result = await supabase
        .from('channel_configurations')
        .update(configData)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert
      result = await supabase
        .from('channel_configurations')
        .insert({
          ...configData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
    }

    if (result.error) {
      // If table doesn't exist, create it
      if (result.error.code === '42P01') {
        return NextResponse.json({ 
          success: false, 
          error: 'Channel configurations table not found. Please run migration 047_channel_configurations.sql' 
        }, { status: 500 });
      }
      throw result.error;
    }

    // Clear cache for this organization so changes take effect immediately
    clearChannelConfigCache(orgId);

    return NextResponse.json({ success: true, config: result.data });
  } catch (error) {
    console.error('Error saving channel config:', error);
    return NextResponse.json({ success: false, error: 'Failed to save channel configuration' }, { status: 500 });
  }
}
