import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * PATCH /api/admin/organization-members/[id]/role
 * Update a member's role
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getCurrentOrganization(req);
    const supabase = getSupabaseAdmin();
    const memberId = params.id;
    const body = await req.json();
    
    const { role } = body;

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role is required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['member', 'staff', 'manager', 'admin', 'owner'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check if member exists and belongs to this organization
    const { data: member, error: fetchError } = await supabase
      .from('organization_members')
      .select('role, organization_id')
      .eq('id', memberId)
      .eq('organization_id', context.organizationId)
      .single();

    if (fetchError || !member) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    // Prevent changing the owner role
    if (member.role === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Cannot change the owner role' },
        { status: 400 }
      );
    }

    // Only owners and admins can change roles
    if (!['owner', 'admin'].includes(context.role)) {
      return NextResponse.json(
        { success: false, error: 'Only Owners and Admins can change member roles' },
        { status: 403 }
      );
    }

    // Update the role
    const { data: updated, error: updateError } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)
      .eq('organization_id', context.organizationId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update role: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Role updated successfully',
      member: updated
    });
  } catch (error: any) {
    console.error('[API] Error updating role:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
