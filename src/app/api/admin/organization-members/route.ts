import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * GET /api/admin/organization-members
 * List all members of the current organization
 */
export async function GET(req: NextRequest) {
  try {
    const context = await getCurrentOrganization(req);
    const supabase = getSupabaseAdmin();

    // Get all members with user details
    // Need to specify the foreign key relationship explicitly since there are multiple
    const { data: members, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        role,
        status,
        created_at,
        invited_at,
        joined_at,
        user_id,
        users!organization_members_user_id_fkey (
          id,
          email,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('organization_id', context.organizationId)
      .order('created_at', { ascending: false });
    
    // Transform to include user data at the top level
    const transformedMembers = (members || []).map(m => ({
      ...m,
      user: m.users
    }));

    if (error) {
      throw new Error(`Failed to fetch members: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      members: transformedMembers
    });
  } catch (error: any) {
    console.error('[API] Error fetching organization members:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
