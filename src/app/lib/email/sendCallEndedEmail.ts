/**
 * Send Call Ended Email Notification
 * Triggered after a Retell call completes
 */

import { getResendClient, getDefaultFromEmail, getAppUrl } from './resendClient';
import { generateCallEndedEmail } from './templates/callEndedEmail';
import { getSupabaseAdmin } from '../supabaseClient';

interface CallData {
  id: string;
  call_id: string;
  organization_id: string;
  from_number: string;
  to_number: string;
  direction: string;
  duration_ms: number;
  disconnection_reason: string;
  transcript?: string;
  recording_url?: string;
  public_log_url?: string;
  start_timestamp?: number;
  agent_name?: string;
  call_cost?: {
    combined_cost: number;
  };
  latency?: any;
  call_analysis?: any;
}

/**
 * Get email recipients for an organization
 */
async function getEmailRecipients(organizationId: string): Promise<string[]> {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get organization with notification settings
    const { data: org, error } = await supabase
      .from('organizations')
      .select('email, notification_settings, slug, name')
      .eq('id', organizationId)
      .single();
    
    if (error) {
      console.error('[Email] Error fetching organization:', error);
      return [];
    }
    
    // Check if this is the demo organization
    const isDemoOrg = org.slug === 'demo' || org.name?.toLowerCase() === 'demo';
    
    if (isDemoOrg) {
      console.log('[Email] Demo organization detected - checking for demo emails');
      
      // Get active demo emails (registered in last 2 hours)
      const { data: demoEmails, error: demoError } = await supabase
        .from('demo_emails')
        .select('email')
        .eq('organization_id', organizationId)
        .gte('last_used_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .order('last_used_at', { ascending: false });
      
      if (!demoError && demoEmails && demoEmails.length > 0) {
        const emails = demoEmails.map(d => d.email);
        console.log(`[Email] Using ${emails.length} demo email(s): ${emails.join(', ')}`);
        return emails;
      }
      
      console.log('[Email] No active demo emails found, falling back to standard recipients');
    }
    
    // Priority 1: Custom recipients from notification_settings
    const customRecipients = org.notification_settings?.call_ended_recipients || [];
    if (customRecipients.length > 0) {
      console.log(`[Email] Using custom recipients: ${customRecipients.join(', ')}`);
      return customRecipients;
    }
    
    // Priority 2: Organization primary email
    if (org.email) {
      console.log(`[Email] Using org primary email: ${org.email}`);
      return [org.email];
    }
    
    // Priority 3: Fallback to organization owners
    const { data: members } = await supabase
      .from('organization_members')
      .select('users(email)')
      .eq('organization_id', organizationId)
      .eq('role', 'owner');
    
    const ownerEmails = members
      ?.map((m: any) => m.users?.email)
      .filter(Boolean) || [];
    
    if (ownerEmails.length > 0) {
      console.log(`[Email] Using owner emails: ${ownerEmails.join(', ')}`);
      return ownerEmails;
    }
    
    console.warn('[Email] No recipients found for organization');
    return [];
    
  } catch (error) {
    console.error('[Email] Error getting recipients:', error);
    return [];
  }
}

/**
 * Get FROM email address for organization
 */
async function getFromEmail(organizationId: string): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: org } = await supabase
      .from('organizations')
      .select('notification_settings')
      .eq('id', organizationId)
      .single();
    
    // Check if org has custom FROM email
    const customFrom = org?.notification_settings?.email_from;
    if (customFrom) {
      console.log(`[Email] Using custom FROM: ${customFrom}`);
      return customFrom;
    }
    
  } catch (error) {
    console.error('[Email] Error getting FROM email:', error);
  }
  
  // Fallback to default
  return getDefaultFromEmail();
}

/**
 * Check if email notifications are enabled for this call
 */
async function shouldSendEmail(callData: CallData): Promise<{ shouldSend: boolean; reason?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get organization settings
    const { data: org } = await supabase
      .from('organizations')
      .select('notification_settings')
      .eq('id', callData.organization_id)
      .single();
    
    const settings = org?.notification_settings || {};
    
    // Check if email notifications are disabled
    if (settings.call_ended_email_enabled === false) {
      return { shouldSend: false, reason: 'Email notifications disabled in org settings' };
    }
    
    // Check minimum duration filter (skip if duration is unknown/null)
    const minDuration = settings.min_duration_to_notify || 10000; // Default 10 seconds
    if (callData.duration_ms != null && callData.duration_ms < minDuration) {
      return { 
        shouldSend: false, 
        reason: `Call too short (${callData.duration_ms}ms < ${minDuration}ms)` 
      };
    }
    
    return { shouldSend: true };
    
  } catch (error) {
    console.error('[Email] Error checking settings:', error);
    return { shouldSend: true }; // Default to sending on error
  }
}

/**
 * Build transcript from conversation_messages table
 */
async function buildTranscriptFromMessages(conversationId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: messages, error } = await supabase
      .from('conversation_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('sequence_num', { ascending: true });
    
    if (error || !messages || messages.length === 0) {
      console.log('[Email] No messages found for transcript');
      return null;
    }
    
    // Format transcript like Retell does
    const transcript = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
      .join('\n\n');
    
    console.log(`[Email] Built transcript from ${messages.length} messages`);
    return transcript;
  } catch (error) {
    console.error('[Email] Error building transcript:', error);
    return null;
  }
}

/**
 * Function call details for email template
 */
export interface FunctionCallDetail {
  functionName: string;
  parameters: Record<string, any>;
  result: any;
  error?: string;
  timestamp: string;
}

/**
 * Fetch full function calls from database
 */
async function fetchFunctionCalls(conversationId: string): Promise<FunctionCallDetail[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: calls, error } = await supabase
      .from('function_calls')
      .select('function_name, parameters, result, error, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error || !calls || calls.length === 0) {
      console.log('[Email] No function calls found');
      return [];
    }
    
    return calls.map(call => ({
      functionName: call.function_name,
      parameters: call.parameters || {},
      result: typeof call.result === 'string' ? JSON.parse(call.result) : call.result,
      error: call.error,
      timestamp: call.created_at
    }));
  } catch (error) {
    console.error('[Email] Error fetching function calls:', error);
    return [];
  }
}

/**
 * Build function call summary from function_calls table
 */
async function buildFunctionCallSummary(conversationId: string): Promise<string | null> {
  try {
    const calls = await fetchFunctionCalls(conversationId);
    
    if (calls.length === 0) {
      return null;
    }
    
    // Build summary of what happened
    const summaryParts: string[] = [];
    
    for (const call of calls) {
      const name = call.functionName;
      const result = call.result;
      
      if (name === 'GetPatientByPhone' || name === 'SearchPatients' || name === 'GetMultiplePatients') {
        const patient = Array.isArray(result) ? result[0] : result;
        if (patient?.PatNum) {
          summaryParts.push(`Patient identified: ${patient.FName || ''} ${patient.LName || ''} (#${patient.PatNum})`);
        }
      } else if (name === 'CreateAppointment') {
        if (result?.AptNum) {
          const apptDate = result.AptDateTime ? new Date(result.AptDateTime).toLocaleDateString() : 'scheduled';
          summaryParts.push(`Appointment booked for ${apptDate}`);
        }
      } else if (name === 'UpdateAppointment') {
        summaryParts.push(`Appointment updated`);
      } else if (name === 'CancelAppointment') {
        summaryParts.push(`Appointment cancelled`);
      } else if (name === 'GetAvailableSlots') {
        const slotCount = Array.isArray(result) ? result.length : result?.slots?.length || 0;
        summaryParts.push(`Found ${slotCount} available slots`);
      }
    }
    
    if (summaryParts.length === 0) {
      return null;
    }
    
    return summaryParts.join('. ') + '.';
  } catch (error) {
    console.error('[Email] Error building function call summary:', error);
    return null;
  }
}

/**
 * Main function to send call ended email
 */
export async function sendCallEndedEmail(callDataParam: CallData): Promise<void> {
  const startTime = Date.now();
  let callData = callDataParam; // Make it mutable for race condition handling
  
  try {
    console.log(`[Email] Processing email for call: ${callData.call_id}`);
    
    // Wait a bit for messages to be persisted (Twilio calls save messages during the call)
    console.log(`[Email] Waiting 3s for messages to be persisted...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Refetch call data from DB to get latest info
    const supabase = getSupabaseAdmin();
    const { data: refreshedData, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('call_id', callData.call_id)
      .single();
    
    if (refreshedData && !error) {
      console.log(`[Email] Refetched data - duration: ${refreshedData.duration_ms}ms, id: ${refreshedData.id}`);
      // Parse JSON fields if they're strings
      if (typeof refreshedData.call_analysis === 'string') {
        try {
          refreshedData.call_analysis = JSON.parse(refreshedData.call_analysis);
          console.log('[Email] Parsed call_analysis from string to object');
        } catch (e) {
          console.error('[Email] Failed to parse call_analysis:', e);
        }
      }
      callData = { ...callData, ...refreshedData };
      
      // If no transcript in conversation record, build from messages
      if (!callData.transcript && refreshedData.id) {
        const builtTranscript = await buildTranscriptFromMessages(refreshedData.id);
        if (builtTranscript) {
          callData.transcript = builtTranscript;
        }
      }
      
      // If no call_analysis/summary, build from function calls
      if (!callData.call_analysis?.call_summary && refreshedData.id) {
        const functionSummary = await buildFunctionCallSummary(refreshedData.id);
        if (functionSummary) {
          callData.call_analysis = callData.call_analysis || {};
          callData.call_analysis.call_summary = functionSummary;
          console.log(`[Email] Built summary from function calls: ${functionSummary}`);
        }
      }
    } else {
      console.log(`[Email] Failed to refetch conversation, using original data`);
    }
    
    // Check if we should send email
    const { shouldSend, reason } = await shouldSendEmail(callData);
    if (!shouldSend) {
      console.log(`[Email] Skipping: ${reason}`);
      return;
    }
    
    // Get recipients
    const recipients = await getEmailRecipients(callData.organization_id);
    if (recipients.length === 0) {
      console.warn('[Email] No recipients configured, skipping');
      return;
    }
    
    // Get FROM email
    const fromEmail = await getFromEmail(callData.organization_id);
    
    // Get organization name (reuse supabase from above or get new one)
    const supabaseOrg = getSupabaseAdmin();
    const { data: org } = await supabaseOrg
      .from('organizations')
      .select('name')
      .eq('id', callData.organization_id)
      .single();
    
    const organizationName = org?.name || 'Your Organization';
    
    // Generate dashboard URL for this call
    const appUrl = getAppUrl();
    const dashboardUrl = `${appUrl}/admin/booking/calls?call=${callData.call_id}`;
    
    // Fetch function calls for detailed actions section
    let functionCalls: FunctionCallDetail[] = [];
    if (refreshedData?.id) {
      functionCalls = await fetchFunctionCalls(refreshedData.id);
      console.log(`[Email] Fetched ${functionCalls.length} function calls`);
    }
    
    // Prepare email data
    const emailData = {
      callId: callData.call_id,
      organizationName,
      fromNumber: callData.from_number,
      toNumber: callData.to_number,
      direction: callData.direction,
      durationMs: callData.duration_ms,
      disconnectionReason: callData.disconnection_reason,
      costCents: callData.call_cost?.combined_cost,
      transcript: callData.transcript,
      callAnalysis: callData.call_analysis,
      latency: callData.latency,
      recordingUrl: callData.recording_url,
      publicLogUrl: callData.public_log_url,
      startTimestamp: callData.start_timestamp,
      agentName: callData.agent_name,
      functionCalls: functionCalls
    };
    
    // Debug: Log what we're passing to email template
    console.log('[Email] callAnalysis type:', typeof emailData.callAnalysis);
    console.log('[Email] callAnalysis value:', JSON.stringify(emailData.callAnalysis));
    if (emailData.callAnalysis?.call_summary) {
      console.log('[Email] call_summary present:', emailData.callAnalysis.call_summary.substring(0, 50) + '...');
    } else {
      console.log('[Email] ⚠️ call_summary is MISSING!');
    }
    
    // Generate email HTML
    const { subject, html } = generateCallEndedEmail(emailData, dashboardUrl);
    
    // Send email via Resend
    const resend = getResendClient();
    const response = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      html
    });
    
    const duration = Date.now() - startTime;
    console.log(`[Email] ✅ Sent successfully in ${duration}ms`);
    console.log(`[Email] Response:`, response);
    
    // Update conversation record
    await supabase
      .from('conversations')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_recipients: recipients,
        email_error: null
      })
      .eq('id', callData.id);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Email] ❌ Failed after ${duration}ms:`, error);
    
    // Log error to database
    try {
      const supabase = getSupabaseAdmin();
      await supabase
        .from('conversations')
        .update({
          email_sent: false,
          email_error: error.message || 'Unknown error'
        })
        .eq('id', callData.id);
    } catch (dbError) {
      console.error('[Email] Failed to log error to DB:', dbError);
    }
    
    // Don't throw - we don't want to break the webhook
  }
}
