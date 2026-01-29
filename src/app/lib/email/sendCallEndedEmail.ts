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
      .select('email, notification_settings')
      .eq('id', organizationId)
      .single();
    
    if (error) {
      console.error('[Email] Error fetching organization:', error);
      return [];
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
    
    // Check minimum duration filter
    const minDuration = settings.min_duration_to_notify || 10000; // Default 10 seconds
    if (callData.duration_ms < minDuration) {
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
 * Main function to send call ended email
 */
export async function sendCallEndedEmail(callDataParam: CallData): Promise<void> {
  const startTime = Date.now();
  let callData = callDataParam; // Make it mutable for race condition handling
  
  try {
    console.log(`[Email] Processing email for call: ${callData.call_id}`);
    
    // Handle race condition: call_analyzed might arrive before call_ended
    // If duration is missing, wait a moment and refetch from DB
    if (!callData.duration_ms || callData.duration_ms === null) {
      console.log(`[Email] Duration missing (race condition), waiting 2s and refetching...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refetch call data from DB
      const supabase = getSupabaseAdmin();
      const { data: refreshedData, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('call_id', callData.call_id)
        .single();
      
      if (refreshedData && !error) {
        console.log(`[Email] Refetched data - duration: ${refreshedData.duration_ms}ms`);
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
      } else {
        console.log(`[Email] Failed to refetch, using original data`);
      }
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
    
    // Get organization name
    const supabase = getSupabaseAdmin();
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', callData.organization_id)
      .single();
    
    const organizationName = org?.name || 'Your Organization';
    
    // Generate dashboard URL for this call
    const appUrl = getAppUrl();
    const dashboardUrl = `${appUrl}/admin/booking/calls?call=${callData.call_id}`;
    
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
      agentName: callData.agent_name
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
