import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export interface TreatmentPlanItem {
  toothFdi: string;
  surfaces: string[];
  treatmentId: string;
  treatmentCode: string;
  treatmentName: string;
  price: number;
  duration: number;
  notes?: string;
  status: 'planned' | 'completed' | 'in-progress';
}

export interface TreatmentPlan {
  id?: string;
  patientId: string;
  createdAt: string;
  updatedAt?: string;
  totalPrice: number;
  totalDuration: number;
  status: 'pending' | 'approved' | 'in-progress' | 'completed';
  treatments: TreatmentPlanItem[];
}

/**
 * POST /api/treatment-plans
 * Create a new treatment plan
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: TreatmentPlan = await request.json();

    // Validate required fields
    if (!body.patientId) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    if (!body.treatments || body.treatments.length === 0) {
      return NextResponse.json(
        { error: 'At least one treatment is required' },
        { status: 400 }
      );
    }

    // Create the treatment plan
    const { data: planData, error: planError } = await db
      .from('treatment_plans')
      .insert({
        patient_id: body.patientId,
        total_price: body.totalPrice,
        total_duration: body.totalDuration,
        status: body.status || 'pending',
      })
      .select()
      .single();

    if (planError) {
      console.error('Error creating treatment plan:', planError);
      return NextResponse.json(
        { error: 'Failed to create treatment plan', details: planError.message },
        { status: 500 }
      );
    }

    // Create treatment plan items
    const items = body.treatments.map(treatment => ({
      treatment_plan_id: planData.id,
      tooth_fdi: treatment.toothFdi,
      surfaces: treatment.surfaces,
      treatment_code: treatment.treatmentCode,
      treatment_name: treatment.treatmentName,
      price: treatment.price,
      duration: treatment.duration,
      notes: treatment.notes,
      status: treatment.status || 'planned',
    }));

    const { error: itemsError } = await db
      .from('treatment_plan_items')
      .insert(items);

    if (itemsError) {
      console.error('Error creating treatment plan items:', itemsError);
      // Rollback the plan creation
      await db.from('treatment_plans').delete().eq('id', planData.id);
      return NextResponse.json(
        { error: 'Failed to create treatment plan items', details: itemsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: planData.id,
      patientId: body.patientId,
      createdAt: planData.created_at,
      totalPrice: body.totalPrice,
      totalDuration: body.totalDuration,
      status: body.status || 'pending',
      treatments: body.treatments,
    });
  } catch (error) {
    console.error('Error in treatment-plans POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/treatment-plans?patientId=123
 * Get treatment plans for a patient
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    let query = db.from('treatment_plans').select(`
      *,
      treatment_plan_items (*)
    `);

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching treatment plans:', error);
      return NextResponse.json(
        { error: 'Failed to fetch treatment plans', details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format
    const plans: TreatmentPlan[] = (data || []).map((plan: any) => ({
      id: plan.id,
      patientId: plan.patient_id,
      createdAt: plan.created_at,
      updatedAt: plan.updated_at,
      totalPrice: plan.total_price,
      totalDuration: plan.total_duration,
      status: plan.status,
      treatments: (plan.treatment_plan_items || []).map((item: any) => ({
        toothFdi: item.tooth_fdi,
        surfaces: item.surfaces,
        treatmentId: item.treatment_id,
        treatmentCode: item.treatment_code,
        treatmentName: item.treatment_name,
        price: item.price,
        duration: item.duration,
        notes: item.notes,
        status: item.status,
      })),
    }));

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error in treatment-plans GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
