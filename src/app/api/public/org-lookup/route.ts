import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

/**
 * PUBLIC API - No authentication required
 * GET /api/public/org-lookup?slug=xxx
 * 
 * Resolve organization ID from slug for embeddable web chat widget
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'Organization slug is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Look up organization by slug
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, slug, status')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organizationId: org.id,
      name: org.name,
      slug: org.slug
    });
  } catch (error: any) {
    console.error('[Public API] Error looking up organization:', error);
    return NextResponse.json(
      { error: 'Failed to lookup organization' },
      { status: 500 }
    );
  }
}
