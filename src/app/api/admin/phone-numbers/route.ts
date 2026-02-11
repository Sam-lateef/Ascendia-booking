/**
 * Admin Phone Numbers API
 * 
 * GET - List all phone numbers for current organization
 * Includes live sync with Vapi for status and number assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganization } from '@/app/lib/apiHelpers';
import { getSupabaseAdmin } from '@/app/lib/supabaseClient';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_API_URL = 'https://api.vapi.ai';

interface VapiPhoneNumberInfo {
  number: string | null;
  status: string | null;
}

/**
 * Fetch phone number details from Vapi API (number + status)
 */
async function fetchVapiPhoneNumberInfo(vapiPhoneNumberId: string): Promise<VapiPhoneNumberInfo> {
  if (!VAPI_API_KEY || !vapiPhoneNumberId) return { number: null, status: null };
  
  try {
    const response = await fetch(`${VAPI_API_URL}/phone-number/${vapiPhoneNumberId}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      return { number: data.number || null, status: data.status || null };
    }
  } catch (error) {
    console.error('[Phone Numbers API] Error fetching from Vapi:', error);
  }
  return { number: null, status: null };
}

export async function GET(req: NextRequest) {
  try {
    const context = await getCurrentOrganization(req);
    const supabase = getSupabaseAdmin();

    console.log('[Phone Numbers API] Fetching for org:', context.organizationId);

    // Fetch from phone_numbers table
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('organization_id', context.organizationId)
      .order('created_at', { ascending: false });

    if (phoneError) {
      console.error('[Phone Numbers API] Error fetching phone_numbers:', phoneError);
    }

    // Fetch from vapi_assistants table (in case phone_numbers doesn't have the entry)
    const { data: vapiAssistants, error: vapiError } = await supabase
      .from('vapi_assistants')
      .select('*')
      .eq('organization_id', context.organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (vapiError) {
      console.error('[Phone Numbers API] Error fetching vapi_assistants:', vapiError);
    }

    console.log('[Phone Numbers API] Found:', {
      phoneNumbers: phoneNumbers?.length || 0,
      vapiAssistants: vapiAssistants?.length || 0
    });

    // Merge both sources
    const allNumbers = [...(phoneNumbers || [])];
    
    // Add vapi assistants that aren't already in phone_numbers
    if (vapiAssistants) {
      for (const assistant of vapiAssistants) {
        const existsInPhoneNumbers = allNumbers.some(
          pn => pn.metadata?.assistant_id === assistant.assistant_id ||
                (pn.phone_number && assistant.phone_number && pn.phone_number === assistant.phone_number)
        );
        
        if (!existsInPhoneNumbers) {
          allNumbers.push({
            id: assistant.id,
            phone_number: assistant.phone_number || '',
            channel: 'vapi',
            is_active: assistant.is_active,
            metadata: {
              assistant_id: assistant.assistant_id,
              assistant_name: assistant.assistant_name,
              voice_provider: assistant.voice_provider,
              vapi_phone_number_id: assistant.metadata?.vapi_phone_number_id,
              vapi_status: assistant.metadata?.vapi_status
            },
            created_at: assistant.created_at
          });
        }
      }
    }

    // For any numbers that are still activating or missing, check Vapi for live status
    const updatePromises: Promise<void>[] = [];
    
    for (const entry of allNumbers) {
      const vapiPhoneNumberId = entry.metadata?.vapi_phone_number_id;
      const vapiStatus = entry.metadata?.vapi_status;
      const hasNumber = entry.phone_number && entry.phone_number.length > 3;
      const isStillActivating = vapiStatus === 'activating' || !hasNumber;
      
      if (isStillActivating && vapiPhoneNumberId) {
        updatePromises.push(
          fetchVapiPhoneNumberInfo(vapiPhoneNumberId).then(async (info) => {
            // Update number if we got one
            if (info.number) {
              entry.phone_number = info.number;
            }
            // Always update status from live Vapi data
            if (info.status) {
              entry.metadata = { ...entry.metadata, vapi_status: info.status };
            }
            
            // Persist to DB if anything changed
            if (info.number || (info.status && info.status !== vapiStatus)) {
              console.log(`[Phone Numbers API] Updated from Vapi: number=${info.number}, status=${info.status}`);
              
              const phoneUpdate: Record<string, any> = {};
              if (info.number) phoneUpdate.phone_number = info.number;
              if (info.status) phoneUpdate.metadata = { ...entry.metadata, vapi_status: info.status };
              
              if (Object.keys(phoneUpdate).length > 0) {
                await supabase
                  .from('phone_numbers')
                  .update(phoneUpdate)
                  .eq('id', entry.id);
                
                const vapiUpdate: Record<string, any> = {};
                if (info.number) vapiUpdate.phone_number = info.number;
                if (info.status) vapiUpdate.metadata = { ...entry.metadata, vapi_status: info.status };
                
                await supabase
                  .from('vapi_assistants')
                  .update(vapiUpdate)
                  .eq('metadata->>vapi_phone_number_id', vapiPhoneNumberId);
              }
            }
          })
        );
      }
    }
    
    // Wait for all Vapi lookups to complete
    if (updatePromises.length > 0) {
      console.log(`[Phone Numbers API] Checking ${updatePromises.length} numbers with Vapi...`);
      await Promise.all(updatePromises);
    }

    console.log('[Phone Numbers API] Returning:', allNumbers.length, 'total numbers');

    return NextResponse.json({
      phoneNumbers: allNumbers
    });
  } catch (error: any) {
    console.error('[Phone Numbers API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch phone numbers' },
      { status: 500 }
    );
  }
}
