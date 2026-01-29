/**
 * API Credentials Management API
 * GET: List all credentials for current organization
 * POST: Create new credential
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentOrganization(request);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('organization_id', context.organizationId)
      .order('credential_type', { ascending: true })
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API Credentials] Error fetching credentials:', error);
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 500 });
    }

    return NextResponse.json({
      credentials: data || [],
      success: true,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API Credentials] Error:', errorMessage);
    return NextResponse.json({
      error: errorMessage,
      success: false,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentOrganization(request);
    
    console.log('[API Credentials] POST - User role:', context.role, 'User ID:', context.user.id, 'Org:', context.organizationId);
    
    // Only owners and admins can create credentials
    if (!['owner', 'admin'].includes(context.role)) {
      console.error('[API Credentials] Permission denied - Role:', context.role);
      return NextResponse.json(
        { error: `Permission denied - Your role is '${context.role}'. Only 'owner' or 'admin' can save credentials.`, success: false },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { credential_type, credential_name, description, credentials, is_default } = body;

    // Validate required fields
    if (!credential_type || !credential_name || !credentials) {
      return NextResponse.json(
        { error: 'Missing required fields', success: false },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // If setting as default, unset other defaults for this type
    if (is_default) {
      await supabase
        .from('api_credentials')
        .update({ is_default: false })
        .eq('organization_id', context.organizationId)
        .eq('credential_type', credential_type)
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('api_credentials')
      .insert({
        organization_id: context.organizationId,
        credential_type,
        credential_name,
        description,
        credentials,
        is_default: is_default || false,
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('[API Credentials] Error creating credential:', error);
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 500 });
    }

    console.log('[API Credentials] ✅ Credential created:', credential_name);
    return NextResponse.json({
      credential: data,
      success: true,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API Credentials] Error:', errorMessage);
    return NextResponse.json({
      error: errorMessage,
      success: false,
    }, { status: 500 });
  }
}
