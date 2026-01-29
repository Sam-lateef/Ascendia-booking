import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseWithOrg } from '@/app/lib/supabaseClient';

export interface TreatmentCatalogItem {
  id?: string;
  code: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  requires_surface: boolean;
  is_active?: boolean;
  description?: string;
}

/**
 * GET /api/treatments-catalog
 * Get all treatments from the catalog
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get organization context
    const context = await getCurrentOrganization(request);
    const db = await getSupabaseWithOrg(context.organizationId);
    
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const category = searchParams.get('category');

    let query = db.from('treatments_catalog').select('*');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('category').order('name');

    if (error) {
      console.error('Error fetching treatments catalog:', error);
      return NextResponse.json(
        { error: 'Failed to fetch treatments', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in treatments-catalog GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/treatments-catalog
 * Create a new treatment
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get organization context
    const context = await getCurrentOrganization(request);
    const db = await getSupabaseWithOrg(context.organizationId);
    
    const body: TreatmentCatalogItem = await request.json();

    // Validate required fields
    if (!body.code || !body.name || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, category' },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from('treatments_catalog')
      .insert({
        organization_id: context.organizationId,
        code: body.code,
        name: body.name,
        category: body.category,
        price: body.price || 0,
        duration: body.duration || 30,
        requires_surface: body.requires_surface || false,
        is_active: body.is_active !== false,
        description: body.description,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating treatment:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Treatment code already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create treatment', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in treatments-catalog POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/treatments-catalog
 * Update an existing treatment
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Get organization context
    const context = await getCurrentOrganization(request);
    const db = await getSupabaseWithOrg(context.organizationId);
    
    const body: TreatmentCatalogItem = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Treatment ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from('treatments_catalog')
      .update({
        code: body.code,
        name: body.name,
        category: body.category,
        price: body.price,
        duration: body.duration,
        requires_surface: body.requires_surface,
        is_active: body.is_active,
        description: body.description,
      })
      .eq('id', body.id)
      .eq('organization_id', context.organizationId) // CRITICAL: Prevent updating other org's data
      .select()
      .single();

    if (error) {
      console.error('Error updating treatment:', error);
      return NextResponse.json(
        { error: 'Failed to update treatment', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in treatments-catalog PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/treatments-catalog?id=xxx
 * Delete a treatment
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Get organization context
    const context = await getCurrentOrganization(request);
    const db = await getSupabaseWithOrg(context.organizationId);
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Treatment ID is required' },
        { status: 400 }
      );
    }

    const { error } = await db
      .from('treatments_catalog')
      .delete()
      .eq('id', id)
      .eq('organization_id', context.organizationId); // CRITICAL: Prevent deleting other org's data

    if (error) {
      console.error('Error deleting treatment:', error);
      return NextResponse.json(
        { error: 'Failed to delete treatment', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in treatments-catalog DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
