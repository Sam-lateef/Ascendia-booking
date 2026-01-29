import { NextRequest, NextResponse } from 'next/server';
import { sendCallEndedEmail } from '@/app/lib/email/sendCallEndedEmail';

/**
 * POST /api/test/email
 * Send a test email notification with mock call data
 * Use this to verify email system works before deploying
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Test Email] Sending test email...');
    
    // Mock call data that looks like a real Retell call
    const mockCall = {
      id: 'test-conv-123',
      call_id: 'test_call_' + Date.now(),
      organization_id: 'b445a9c7-af93-4b4a-a975-40d3f44178ec', // Replace with your org ID if different
      from_number: '+12345678901',
      to_number: '+19876543210',
      direction: 'inbound',
      duration_ms: 225000, // 3 minutes 45 seconds
      disconnection_reason: 'user_hangup',
      transcript: `Agent: Hi! This is the dental office. How can I help you today?
User: Hi, I'd like to schedule a cleaning appointment.
Agent: I'd be happy to help you with that! Let me check our available times. May I have your name please?
User: Sure, it's John Smith.
Agent: Thank you, John. I can see we have several openings next week. Would Monday at 10 AM work for you?
User: Yes, that sounds perfect!
Agent: Great! I've scheduled you for a cleaning on Monday, January 29th at 10 AM. You'll receive a confirmation email shortly.
User: Thank you so much!
Agent: You're welcome! Is there anything else I can help you with today?
User: No, that's all. Thank you!
Agent: Have a great day, John! We'll see you on Monday.`,
      recording_url: 'https://retellai.s3.us-west-2.amazonaws.com/test/recording.wav',
      public_log_url: 'https://retellai.s3.us-west-2.amazonaws.com/test/public_log.txt',
      agent_name: 'Dental Assistant AI',
      start_timestamp: Date.now() - 225000, // 3m 45s ago
      call_cost: {
        combined_cost: 12 // 12 cents = $0.12
      },
      latency: {
        e2e: { 
          p50: 850, 
          p90: 1200, 
          p95: 1500, 
          p99: 2000, 
          max: 2500, 
          min: 500 
        },
        llm: { 
          p50: 420, 
          p90: 650, 
          p95: 800, 
          p99: 1200, 
          max: 1500, 
          min: 200 
        },
        asr: { 
          p50: 180, 
          p90: 250, 
          p95: 300, 
          p99: 400, 
          max: 500, 
          min: 100 
        },
        tts: { 
          p50: 250, 
          p90: 350, 
          p95: 450, 
          p99: 600, 
          max: 700, 
          min: 150 
        }
      },
      call_analysis: {
        user_sentiment: 'Positive',
        call_successful: true,
        in_voicemail: false,
        call_summary: 'Patient John Smith successfully scheduled a cleaning appointment for Monday, January 29th at 10 AM. The call was friendly and efficient, lasting approximately 3 minutes and 45 seconds. No issues encountered.'
      }
    };
    
    console.log('[Test Email] Mock call data prepared');
    console.log('[Test Email] Organization ID:', mockCall.organization_id);
    console.log('[Test Email] Call duration:', mockCall.duration_ms / 1000, 'seconds');
    
    // Send the email
    await sendCallEndedEmail(mockCall);
    
    console.log('[Test Email] ✅ Email sent successfully!');
    
    return NextResponse.json({ 
      success: true,
      message: 'Test email sent successfully! Check your inbox.',
      call_id: mockCall.call_id,
      organization_id: mockCall.organization_id,
      note: 'If you did not receive the email, check:\n1. Email notifications are enabled in /admin/booking/notifications\n2. You added your email address in the recipients list\n3. Check spam/junk folder\n4. Check console logs for [Email] messages'
    });
  } catch (error: any) {
    console.error('[Test Email] ❌ Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack,
      note: 'Check console logs for detailed error information'
    }, { status: 500 });
  }
}

/**
 * GET /api/test/email
 * Show instructions for testing email
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Email Test Endpoint',
    instructions: {
      step1: 'Go to Settings → Notifications (/admin/settings/notifications)',
      step2: 'Add your email address to recipients',
      step3: 'Enable email notifications',
      step4: 'Save settings',
      step5: 'POST to this endpoint to send test email'
    },
    usage: 'curl -X POST http://localhost:3000/api/test/email',
    note: 'This endpoint sends a mock Retell call email to verify the email system works'
  });
}
