/**
 * Register Demo Email
 * Stores visitor email for demo notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, organizationId } = await request.json();

    if (!email || !organizationId) {
      return NextResponse.json(
        { error: 'Email and organization ID required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get IP and user agent for tracking
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check if email already exists for this org
    const { data: existing } = await supabase
      .from('demo_emails')
      .select('id')
      .eq('email', email)
      .eq('organization_id', organizationId)
      .single();

    if (existing) {
      // Update last_used_at
      await supabase
        .from('demo_emails')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      // Insert new demo email
      await supabase
        .from('demo_emails')
        .insert({
          email,
          organization_id: organizationId,
          ip_address: ip,
          user_agent: userAgent
        });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Email registered for demo notifications'
    });

  } catch (error: any) {
    console.error('[Demo Register Email] Error:', error);
    return NextResponse.json(
      { error: 'Failed to register email', details: error.message },
      { status: 500 }
    );
  }
}
