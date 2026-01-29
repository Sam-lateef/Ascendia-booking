import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * GET /api/user/organizations
 * Get all organizations that the current user belongs to
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get authorization token from header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    console.log('[/api/user/organizations] Auth header:', authHeader ? 'present' : 'missing');
    console.log('[/api/user/organizations] Token length:', token.length);
    
    if (!token) {
      console.log('[/api/user/organizations] No token provided');
      return NextResponse.json(
        { error: 'Unauthorized: No token provided' },
        { status: 401 }
      );
    }
    
    // Get auth user from token
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !authUser) {
      console.log('[/api/user/organizations] Token validation failed:', userError?.message);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }
    
    console.log('[/api/user/organizations] Auth user validated:', authUser.email);
    
    // Get user record from our users table
    const { data: userRecord, error: userRecordError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .single();
    
    if (userRecordError || !userRecord) {
      return NextResponse.json(
        { error: 'User record not found. Please contact support.' },
        { status: 404 }
      );
    }
    
    // Get user's organizations
    console.log('[/api/user/organizations] Fetching memberships for user:', userRecord.id);
    
    const { data: memberships, error: membershipsError } = await supabase
      .from('organization_members')
      .select(`
        role,
        status,
        organization_id,
        organizations!inner (
          id,
          name,
          slug,
          plan,
          status,
          logo_url,
          primary_color
        )
      `)
      .eq('user_id', userRecord.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (membershipsError) {
      console.error('[/api/user/organizations] Error fetching organizations:', {
        message: membershipsError.message,
        details: membershipsError.details,
        hint: membershipsError.hint,
        code: membershipsError.code
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch organizations',
          details: membershipsError.message 
        },
        { status: 500 }
      );
    }
    
    console.log('[/api/user/organizations] Raw memberships:', memberships?.length || 0);
    
    // Format response
    const organizations = (memberships || [])
      .filter((m: any) => m.organizations && m.organizations.status === 'active')
      .map((m: any) => ({
        id: m.organizations.id,
        name: m.organizations.name,
        slug: m.organizations.slug,
        role: m.role,
        plan: m.organizations.plan,
        logo_url: m.organizations.logo_url,
        primary_color: m.organizations.primary_color,
      }));
    
    console.log('[/api/user/organizations] Returning organizations:', organizations.length);
    console.log('[/api/user/organizations] Organizations:', JSON.stringify(organizations, null, 2));
    
    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error('Error in /api/user/organizations:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
