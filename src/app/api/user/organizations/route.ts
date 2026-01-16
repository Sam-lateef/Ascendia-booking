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
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: No token provided' },
        { status: 401 }
      );
    }
    
    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }
    
    // Get user's organizations
    const { data: memberships, error: membershipsError } = await supabase
      .from('organization_members')
      .select(`
        role,
        status,
        organization:organizations (
          id,
          name,
          slug,
          plan,
          status,
          logo_url,
          primary_color
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (membershipsError) {
      console.error('Error fetching organizations:', membershipsError);
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 }
      );
    }
    
    // Format response
    const organizations = memberships
      .filter((m: any) => m.organization && m.organization.status === 'active')
      .map((m: any) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        plan: m.organization.plan,
        logo_url: m.organization.logo_url,
        primary_color: m.organization.primary_color,
      }));
    
    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error('Error in /api/user/organizations:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
