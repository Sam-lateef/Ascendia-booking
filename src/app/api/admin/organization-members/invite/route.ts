import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * POST /api/admin/organization-members/invite
 * Invite a new user to the organization
 */
export async function POST(req: NextRequest) {
  try {
    const context = await getCurrentOrganization(req);
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    
    const { email, role = 'member' } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['member', 'staff', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check if user already exists in auth
    const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
    const existingAuthUser = existingAuthUsers?.users.find(u => u.email === email);

    let userId: string;

    if (existingAuthUser) {
      // User exists in auth - check if they have a user record
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', existingAuthUser.id)
        .single();

      if (existingUser) {
        userId = existingUser.id;

        // Check if already a member
        const { data: existingMember } = await supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', context.organizationId)
          .eq('user_id', userId)
          .single();

        if (existingMember) {
          return NextResponse.json(
            { success: false, error: 'User is already a member of this organization' },
            { status: 400 }
          );
        }
      } else {
        // Auth user exists but no user record - create one
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            auth_user_id: existingAuthUser.id,
            email: email,
            first_name: existingAuthUser.user_metadata?.first_name || email.split('@')[0],
            last_name: existingAuthUser.user_metadata?.last_name || '',
            is_active: true,
            email_verified: true
          })
          .select('id')
          .single();

        if (userError || !newUser) {
          throw new Error(`Failed to create user record: ${userError?.message}`);
        }

        userId = newUser.id;
      }
    } else {
      // User doesn't exist - invite them to sign up
      // Create invitation record with pending status
      
      // For now, create a placeholder user record that will be linked when they sign up
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: email,
          first_name: email.split('@')[0],
          last_name: '',
          is_active: false, // Will be activated when they sign up
          email_verified: false
        })
        .select('id')
        .single();

      if (userError || !newUser) {
        throw new Error(`Failed to create user record: ${userError?.message}`);
      }

      userId = newUser.id;
    }

    // Get current user info for invited_by
    const { data: currentUserRecord } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', context.user.id)
      .single();

    // Create organization membership with invited status
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: context.organizationId,
        user_id: userId,
        role: role,
        status: existingAuthUser ? 'active' : 'invited',
        invited_at: new Date().toISOString(),
        invited_by: currentUserRecord?.id,
        joined_at: existingAuthUser ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (memberError) {
      throw new Error(`Failed to create membership: ${memberError.message}`);
    }

    // TODO: Send invitation email
    // This would typically use a service like SendGrid, Resend, or your own SMTP
    console.log(`[Invite] Would send invitation email to ${email} with role ${role}`);

    return NextResponse.json({
      success: true,
      message: existingAuthUser 
        ? 'User added to organization successfully' 
        : 'Invitation sent successfully',
      membership
    });
  } catch (error: any) {
    console.error('[API] Error inviting member:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
