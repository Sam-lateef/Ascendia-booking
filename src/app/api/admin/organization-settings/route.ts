import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';

/**
 * GET /api/admin/organization-settings
 * Fetch organization settings including notification_settings
 */
export async function GET(req: NextRequest) {
  try {
    const context = await getCurrentOrganization(req);
    const orgId = context.organizationId;

    const supabase = getSupabaseAdmin();
    
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, email, notification_settings')
      .eq('id', orgId)
      .single();

    if (error) {
      console.error('[Organization Settings] Error fetching:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(org);
  } catch (error: any) {
    console.error('[Organization Settings] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organization-settings
 * Update organization settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const context = await getCurrentOrganization(req);
    const orgId = context.organizationId;

    const body = await req.json();
    const { notification_settings } = body;

    if (!notification_settings) {
      return NextResponse.json(
        { error: 'notification_settings is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Update organization settings
    const { data, error } = await supabase
      .from('organizations')
      .update({
        notification_settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId)
      .select()
      .single();

    if (error) {
      console.error('[Organization Settings] Error updating:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    console.log(`[Organization Settings] ✅ Updated for org: ${orgId}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Organization Settings] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
