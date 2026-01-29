import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * DELETE /api/admin/organization-members/[id]
 * Remove a member from the organization
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getCurrentOrganization(req);
    const supabase = getSupabaseAdmin();
    const memberId = params.id;

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

    // Prevent removing the owner
    if (member.role === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Cannot remove the organization owner' },
        { status: 400 }
      );
    }

    // Delete the membership
    const { error: deleteError } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', context.organizationId);

    if (deleteError) {
      throw new Error(`Failed to remove member: ${deleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error: any) {
    console.error('[API] Error removing member:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
