/**
 * Call Ended Email Template
 * Professional HTML email for Retell call notifications
 */

interface FunctionCallDetail {
  functionName: string;
  parameters: Record<string, any>;
  result: any;
  error?: string;
  timestamp: string;
}

interface CallEmailData {
  callId: string;
  organizationName: string;
  fromNumber: string;
  toNumber: string;
  direction: string;
  durationMs: number;
  disconnectionReason: string;
  costCents?: number;
  transcript?: string;
  callAnalysis?: any;
  latency?: any;
  recordingUrl?: string;
  publicLogUrl?: string;
  startTimestamp?: number;
  agentName?: string;
  functionCalls?: FunctionCallDetail[];
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(phone: string): string {
  if (!phone) return 'Unknown';
  // Format: +1 (234) 567-8900
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms: number): string {
  if (!ms) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format cost in USD
 */
function formatCost(cents?: number): string {
  if (!cents) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format timestamp to readable date
 */
function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get status emoji based on disconnection reason
 */
function getStatusEmoji(reason: string): string {
  const errorReasons = ['error_llm_websocket_open', 'error_llm_websocket_lost_connection', 
                        'error_llm_websocket_runtime', 'error_asr', 'error_retell', 'error_unknown'];
  
  if (errorReasons.some(r => reason?.includes(r))) return '❌';
  if (reason === 'user_hangup' || reason === 'agent_hangup') return '✅';
  if (reason === 'voicemail_reached') return '📧';
  return '📞';
}

/**
 * Format a function call into a human-readable action (matches UI formatAction)
 */
function formatAction(fc: FunctionCallDetail): { icon: string; text: string; success: boolean; time: string } {
  const params = fc.parameters || {};
  const result = fc.result;
  const hasError = !!fc.error;
  const time = fc.timestamp ? new Date(fc.timestamp).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  }) : '';
  
  switch (fc.functionName) {
    case 'CreatePatient': {
      if (hasError) {
        return { icon: '❌', text: `Failed to create patient: ${fc.error}`, success: false, time };
      }
      const name = `${params.FName || ''} ${params.LName || ''}`.trim() || 'Unknown';
      const phone = params.WirelessPhone ? formatPhoneNumber(params.WirelessPhone) : '';
      return { 
        icon: '👤', 
        text: `Patient Created: ${name}${phone ? ` (${phone})` : ''}`,
        success: true, time 
      };
    }
    
    case 'CreateAppointment': {
      if (hasError) {
        return { icon: '❌', text: `Failed to book appointment: ${fc.error}`, success: false, time };
      }
      const dateTime = params.AptDateTime ? formatDateTime(params.AptDateTime) : 'Unknown time';
      return { icon: '📅', text: `Appointment Booked: ${dateTime}`, success: true, time };
    }
    
    case 'UpdateAppointment': {
      if (hasError) {
        return { icon: '❌', text: `Failed to reschedule: ${fc.error}`, success: false, time };
      }
      const newDateTime = params.AptDateTime ? formatDateTime(params.AptDateTime) : '';
      return { icon: '🔄', text: `Appointment Rescheduled${newDateTime ? `: ${newDateTime}` : ''}`, success: true, time };
    }
    
    case 'CancelAppointment': {
      if (hasError) {
        return { icon: '❌', text: `Failed to cancel: ${fc.error}`, success: false, time };
      }
      return { icon: '🚫', text: 'Appointment Cancelled', success: true, time };
    }
    
    case 'GetMultiplePatients':
    case 'GetPatientByPhone':
    case 'SearchPatients': {
      if (hasError) {
        return { icon: '❌', text: 'Patient lookup failed', success: false, time };
      }
      const patients = Array.isArray(result) ? result : (result ? [result] : []);
      if (patients.length > 0 && patients[0]?.PatNum) {
        const patient = patients[0];
        const name = `${patient.FName || ''} ${patient.LName || ''}`.trim();
        return { icon: '✅', text: `Patient Found: ${name} (#${patient.PatNum})`, success: true, time };
      }
      return { icon: '🔍', text: 'Patient Search: No matches', success: true, time };
    }
    
    case 'GetAvailableSlots': {
      if (hasError) {
        return { icon: '❌', text: 'Failed to check availability', success: false, time };
      }
      const slots = Array.isArray(result) ? result : (result?.slots || []);
      const date = params.date || params.startDate || '';
      return { icon: '📋', text: `Checked Availability: ${date} (${slots.length} slots)`, success: true, time };
    }
    
    case 'GetPatientAppointments': {
      if (hasError) {
        return { icon: '❌', text: 'Failed to get appointments', success: false, time };
      }
      const appts = Array.isArray(result) ? result : [];
      return { icon: '📆', text: `Checked Appointments: ${appts.length} found`, success: true, time };
    }
    
    default:
      return { 
        icon: hasError ? '❌' : '⚙️', 
        text: `${fc.functionName}${hasError ? ` (Error: ${fc.error})` : ''}`, 
        success: !hasError, 
        time 
      };
  }
}

/**
 * Format date/time for display
 */
function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format transcript as chat bubbles
 * Handles formats like "User: text" and "Agent: text"
 */
function formatTranscriptAsChat(transcript: string): string {
  if (!transcript) return '';
  
  // Split by double newlines or single newlines with role prefix
  const lines = transcript.split(/\n\n|\n(?=(?:User|Agent|Assistant):)/gi);
  
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    
    // Check if it's a user message
    const userMatch = trimmed.match(/^User:\s*(.+)/is);
    if (userMatch) {
      return `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
          <div style="max-width: 80%; background-color: #3B82F6; color: white; padding: 10px 14px; border-radius: 16px 16px 4px 16px; font-size: 14px; line-height: 1.5;">
            ${escapeHtml(userMatch[1].trim())}
          </div>
        </div>
      `;
    }
    
    // Check if it's an agent/assistant message
    const agentMatch = trimmed.match(/^(?:Agent|Assistant):\s*(.+)/is);
    if (agentMatch) {
      return `
        <div style="display: flex; justify-content: flex-start; margin-bottom: 10px;">
          <div style="max-width: 80%; background-color: #E5E7EB; color: #1F2937; padding: 10px 14px; border-radius: 16px 16px 16px 4px; font-size: 14px; line-height: 1.5;">
            ${escapeHtml(agentMatch[1].trim())}
          </div>
        </div>
      `;
    }
    
    // Unknown format - show as-is
    return `
      <div style="margin-bottom: 10px; padding: 8px; background-color: #F3F4F6; border-radius: 8px; font-size: 13px; color: #4B5563;">
        ${escapeHtml(trimmed)}
      </div>
    `;
  }).join('');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate HTML email for call ended notification
 */
export function generateCallEndedEmail(data: CallEmailData, dashboardUrl: string): { subject: string; html: string } {
  const {
    callId,
    organizationName,
    fromNumber,
    toNumber,
    direction,
    durationMs,
    disconnectionReason,
    costCents,
    transcript,
    callAnalysis,
    latency,
    recordingUrl,
    publicLogUrl,
    startTimestamp,
    agentName,
    functionCalls = []
  } = data;

  // Debug: Log what we're actually rendering
  console.log('[Email Template] callAnalysis type:', typeof callAnalysis);
  console.log('[Email Template] callAnalysis?.call_summary:', callAnalysis?.call_summary ? 'EXISTS' : 'MISSING');
  console.log('[Email Template] functionCalls count:', functionCalls.length);
  if (callAnalysis?.call_summary) {
    console.log('[Email Template] call_summary length:', callAnalysis.call_summary.length);
  }

  const statusEmoji = getStatusEmoji(disconnectionReason);
  const formattedDuration = formatDuration(durationMs);
  const formattedCost = formatCost(costCents);
  const formattedFrom = formatPhoneNumber(fromNumber);
  const formattedTo = formatPhoneNumber(toNumber);
  const formattedDate = formatTimestamp(startTimestamp);

  // Truncate transcript for preview
  const transcriptPreview = transcript 
    ? transcript.substring(0, 500) + (transcript.length > 500 ? '...' : '')
    : 'No transcript available';

  // Subject line - make it informative
  let subject = `${statusEmoji} Call Summary: ${formattedFrom} → ${formattedDuration}`;
  
  // Add outcome to subject if available
  if (callAnalysis?.call_successful !== undefined) {
    const outcome = callAnalysis.call_successful ? '✅ Successful' : '⚠️ Incomplete';
    subject = `${statusEmoji} ${outcome} Call: ${formattedDuration}`;
  }
  
  // Add custom data context if available
  if (callAnalysis?.custom_analysis_data?.patient_name && 
      callAnalysis.custom_analysis_data.patient_name !== '1st_time_customer' &&
      callAnalysis.custom_analysis_data.patient_name !== '') {
    subject = `${statusEmoji} Call with ${callAnalysis.custom_analysis_data.patient_name}: ${formattedDuration}`;
  } else if (callAnalysis?.custom_analysis_data?.['appointment type']) {
    subject = `${statusEmoji} ${callAnalysis.custom_analysis_data['appointment type']} Call: ${formattedDuration}`;
  }

  // HTML email - SIMPLIFIED VERSION
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Call Summary</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #4F46E5;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #1F2937;
    }
    .header p {
      margin: 5px 0 0 0;
      color: #6B7280;
      font-size: 14px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #1F2937;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #E5E7EB;
    }
    .summary-box {
      padding: 16px;
      background: #667eea; /* Solid fallback for email clients that don't support gradients */
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      color: #ffffff !important; /* Force white text */
      font-size: 15px;
      line-height: 1.6;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .analysis-box {
      margin-top: 15px;
      padding: 12px;
      background-color: #F0F9FF;
      border-left: 3px solid #3B82F6;
      border-radius: 4px;
    }
    .analysis-title {
      font-weight: 600;
      color: #1E40AF;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .analysis-field {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 13px;
    }
    .field-label {
      color: #6B7280;
      text-transform: capitalize;
    }
    .field-value {
      color: #1F2937;
      font-weight: 500;
    }
    .transcript-box {
      background-color: #F9FAFB;
      border-left: 3px solid #4F46E5;
      padding: 15px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #374151;
      white-space: pre-wrap;
      word-wrap: break-word;
      max-height: 400px;
      overflow-y: auto;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      color: #6B7280;
      font-size: 12px;
    }
    .footer a {
      color: #4F46E5;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <h1>${statusEmoji} Call Summary</h1>
      <p>${organizationName} • ${formattedDate} • ${formattedDuration}</p>
    </div>

    <!-- Call Details Card -->
    <div class="section">
      <div class="section-title">📊 Call Details</div>
      <div style="background-color: #F9FAFB; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          <div>
            <div style="color: #6B7280; font-size: 12px; margin-bottom: 4px;">From</div>
            <div style="font-weight: 600; color: #1F2937;">${formattedFrom}</div>
          </div>
          <div>
            <div style="color: #6B7280; font-size: 12px; margin-bottom: 4px;">To</div>
            <div style="font-weight: 600; color: #1F2937;">${formattedTo}</div>
          </div>
          <div>
            <div style="color: #6B7280; font-size: 12px; margin-bottom: 4px;">Duration</div>
            <div style="font-weight: 600; color: #1F2937;">${formattedDuration}</div>
          </div>
          <div>
            <div style="color: #6B7280; font-size: 12px; margin-bottom: 4px;">Status</div>
            <div style="font-weight: 600; color: #1F2937;">${disconnectionReason.replace(/_/g, ' ')}</div>
          </div>
        </div>
        ${callAnalysis?.user_sentiment ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #E5E7EB;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="color: #6B7280; font-size: 12px;">Sentiment:</span>
            <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; ${
              callAnalysis.user_sentiment === 'Positive' ? 'background-color: #D1FAE5; color: #065F46;' :
              callAnalysis.user_sentiment === 'Negative' ? 'background-color: #FEE2E2; color: #991B1B;' :
              'background-color: #E5E7EB; color: #1F2937;'
            }">${callAnalysis.user_sentiment}</span>
            ${callAnalysis.call_successful !== undefined ? `
            <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; ${
              callAnalysis.call_successful ? 'background-color: #D1FAE5; color: #065F46;' : 'background-color: #FEE2E2; color: #991B1B;'
            }">${callAnalysis.call_successful ? '✓ Successful' : '✗ Incomplete'}</span>
            ` : ''}
            ${callAnalysis.in_voicemail ? `
            <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background-color: #DBEAFE; color: #1E40AF;">📧 Voicemail</span>
            ` : ''}
          </div>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Call Summary -->
    <div class="section">
      <div class="section-title">📝 Call Summary</div>
      <div style="padding: 16px; background: #667eea; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: #ffffff; font-size: 15px; line-height: 1.6; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${callAnalysis?.call_summary || 'No summary available'}
      </div>
    </div>

    ${functionCalls.length > 0 ? `
    <!-- Actions Taken -->
    <div class="section">
      <div class="section-title">📋 Actions Taken (${functionCalls.length})</div>
      <div style="background-color: #F9FAFB; border-radius: 8px; padding: 12px;">
        ${functionCalls.map(fc => {
          const action = formatAction(fc);
          const bgColor = action.success ? '#ECFDF5' : '#FEF2F2';
          const borderColor = action.success ? '#10B981' : '#EF4444';
          return `
          <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px; margin-bottom: 8px; background-color: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: 4px;">
            <span style="font-size: 18px;">${action.icon}</span>
            <div style="flex: 1;">
              <div style="font-size: 14px; color: #374151;">${action.text}</div>
              <div style="font-size: 11px; color: #9CA3AF; margin-top: 2px;">${action.time}</div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${callAnalysis && (callAnalysis.custom_analysis_data && Object.keys(callAnalysis.custom_analysis_data).length > 0) ? `
    <!-- Extracted Fields & Variables -->
    <div class="section">
      <div class="section-title">📊 Extracted Information</div>
      <div class="analysis-box">
        ${Object.entries(callAnalysis.custom_analysis_data)
          .filter(([key, value]) => value !== 0 && value !== '' && value !== null)
          .map(([key, value]) => `
          <div class="analysis-field">
            <span class="field-label">${key}:</span>
            <span class="field-value">${value}</span>
          </div>
          `).join('')}
      </div>
    </div>
    ` : ''}

    ${recordingUrl || publicLogUrl ? `
    <!-- Recording & Debug Links -->
    <div class="section">
      <div class="section-title">🔗 Links</div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        ${recordingUrl ? `
        <a href="${recordingUrl}" style="display: inline-block; padding: 8px 16px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">🎧 Listen to Recording</a>
        ` : ''}
        ${publicLogUrl ? `
        <a href="${publicLogUrl}" style="display: inline-block; padding: 8px 16px; background-color: #6B7280; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">🔍 View Debug Log</a>
        ` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Full Transcript -->
    <div class="section">
      <div class="section-title">💬 Conversation Transcript</div>
      <div style="background-color: #F9FAFB; border-radius: 8px; padding: 16px; max-height: 500px; overflow-y: auto;">
        ${transcript ? formatTranscriptAsChat(transcript) : '<div style="color: #6B7280; text-align: center; padding: 20px;">No transcript available</div>'}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>
        <a href="${dashboardUrl}">View in Dashboard</a> • 
        <a href="${dashboardUrl}">Manage Settings</a>
      </p>
      <p style="margin-top: 10px; color: #9CA3AF; font-size: 11px;">
        Call ID: ${callId}
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}
