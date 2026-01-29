/**
 * API Credentials Management - Single Credential Operations
 * GET: Get single credential
 * PUT: Update credential
 * DELETE: Delete credential
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getCurrentOrganization(request);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('id', params.id)
      .eq('organization_id', context.organizationId)
      .single();

    if (error) {
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 404 });
    }

    return NextResponse.json({
      credential: data,
      success: true,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: errorMessage,
      success: false,
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getCurrentOrganization(request);
    
    console.log('[API Credentials] PUT - User role:', context.role, 'Credential ID:', params.id);
    
    // Only owners and admins can update credentials
    if (!['owner', 'admin'].includes(context.role)) {
      console.error('[API Credentials] Permission denied - Role:', context.role);
      return NextResponse.json(
        { error: `Permission denied - Your role is '${context.role}'. Only 'owner' or 'admin' can update credentials.`, success: false },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { credential_type, credential_name, description, credentials, is_default } = body;

    const supabase = getSupabaseAdmin();

    // Verify credential belongs to user's organization
    const { data: existing, error: checkError } = await supabase
      .from('api_credentials')
      .select('id')
      .eq('id', params.id)
      .eq('organization_id', context.organizationId)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Credential not found', success: false },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults for this type
    if (is_default) {
      await supabase
        .from('api_credentials')
        .update({ is_default: false })
        .eq('organization_id', context.organizationId)
        .eq('credential_type', credential_type)
        .eq('is_default', true)
        .neq('id', params.id);
    }

    const { data, error } = await supabase
      .from('api_credentials')
      .update({
        credential_type,
        credential_name,
        description,
        credentials,
        is_default: is_default || false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('organization_id', context.organizationId)
      .select()
      .single();

    if (error) {
      console.error('[API Credentials] Error updating credential:', error);
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 500 });
    }

    console.log('[API Credentials] Updated credential:', params.id);

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getCurrentOrganization(request);
    
    // Only owners can delete credentials
    if (context.role !== 'owner') {
      return NextResponse.json(
        { error: 'Permission denied - Only owners can delete credentials', success: false },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('api_credentials')
      .delete()
      .eq('id', params.id)
      .eq('organization_id', context.organizationId);

    if (error) {
      console.error('[API Credentials] Error deleting credential:', error);
      return NextResponse.json({
        error: error.message,
        success: false,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: errorMessage,
      success: false,
    }, { status: 500 });
  }
}
