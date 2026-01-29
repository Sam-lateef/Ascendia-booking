# Email Notifications for Retell Calls - Implementation Plan

## 📋 Overview

Send comprehensive email notifications after each Retell call ends, including:
- Call summary & metrics
- Full transcript
- Recording links
- Performance stats
- Cost breakdown
- Public log for debugging

---

## 🏗️ Architecture

```
Retell Webhook (call_ended)
  ↓
handleCallEnded()
  ↓
Update Database
  ↓
sendCallEndedEmail() ← NEW
  ↓
Email Service (Resend)
  ↓
Recipients (org admins)
```

---

## 🔧 Implementation Steps

### 1. **Email Service Setup** ✅ Next

**Choice: Resend** (Modern, simple, great DX)
- Alternative: SendGrid, Postmark, NodeMailer

**Why Resend?**
- Modern API, great for Next.js
- Free tier: 3,000 emails/month
- Built-in HTML templates with React
- Good deliverability
- Simple integration

**Setup**:
```bash
npm install resend
```

**Env vars**:
```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=calls@yourdomain.com
```

---

### 2. **Database Schema** ✅ Already Exists

Organizations table already has `email` field:
```sql
SELECT id, name, email FROM organizations;
```

**Optional Enhancement**: Add `notification_settings` JSONB column:
```sql
ALTER TABLE organizations
  ADD COLUMN notification_settings JSONB DEFAULT '{
    "call_ended_email": true,
    "call_ended_recipients": [],
    "include_recording": true,
    "include_transcript": true,
    "include_cost": true
  }';
```

---

### 3. **Email Template Design**

#### **Subject Line**:
```
📞 Call Summary: {from_number} → {duration} ({status})
```

Examples:
- `📞 Call Summary: +1234567890 → 3m 45s (Success)`
- `📞 Call Summary: +1234567890 → 1m 12s (User Hangup)`
- `❌ Call Summary: +1234567890 → 0m 45s (Error)`

#### **Email Content** (HTML):

```
┌─────────────────────────────────────────┐
│  📞 Call Summary                         │
│  Organization: {org_name}               │
└─────────────────────────────────────────┘

📊 CALL DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• From:         +1234567890
• To:           +1555123456
• Direction:    Inbound
• Duration:     3m 45s
• Status:       Ended (user_hangup)
• Cost:         $0.12 USD

⏱️ PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• E2E Latency:  850ms (p50)
• LLM Latency:  420ms (p50)
• ASR Latency:  180ms (p50)
• TTS Latency:  250ms (p50)

📝 TRANSCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent: Hi! How can I help you today?
User: I'd like to schedule an appointment.
Agent: I'd be happy to help with that...
[View Full Transcript →]

📊 CALL ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Sentiment:         Positive
• Appointment:       Booked ✓
• In Voicemail:      No
• Call Successful:   Yes

🔗 RESOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[🎧 Listen to Recording]  [📄 View Public Log]  [📊 View in Dashboard]

⚠️ Recording expires in 10 minutes from call end

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sent by {App Name} • {timestamp}
[View Settings] • [Unsubscribe]
```

---

### 4. **Code Structure**

#### **New Files**:
```
src/app/lib/email/
  ├── resendClient.ts         # Resend client setup
  ├── templates/
  │   └── callEnded.tsx       # React email template
  └── sendCallEndedEmail.ts   # Main email function
```

#### **Modified Files**:
```
src/app/api/retell/webhook/route.ts  # Add email trigger
.env                                   # Add email config
package.json                          # Add dependencies
```

---

### 5. **Configuration Options**

#### **Env Variables** (`.env`):
```env
# Email Service
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=calls@yourdomain.com
EMAIL_FROM_NAME=Ascendia AI Calls

# Email Settings (Optional - can override per org)
EMAIL_ENABLED=true
EMAIL_INCLUDE_RECORDING=true
EMAIL_INCLUDE_TRANSCRIPT=true
EMAIL_TRUNCATE_TRANSCRIPT=500  # chars
```

#### **Per-Organization Settings** (Database):
```json
{
  "call_ended_email": true,
  "call_ended_recipients": [
    "admin@clinic.com",
    "manager@clinic.com"
  ],
  "include_recording": true,
  "include_transcript": true,
  "include_cost": true,
  "min_duration_to_notify": 10000  // ms (don't notify for < 10s calls)
}
```

---

### 6. **Recipient Selection Logic**

```typescript
async function getEmailRecipients(organizationId: string): Promise<string[]> {
  const org = await supabase
    .from('organizations')
    .select('email, notification_settings')
    .eq('id', organizationId)
    .single();
  
  // Priority order:
  // 1. Custom recipients from notification_settings
  if (org.notification_settings?.call_ended_recipients?.length > 0) {
    return org.notification_settings.call_ended_recipients;
  }
  
  // 2. Organization primary email
  if (org.email) {
    return [org.email];
  }
  
  // 3. Fallback: organization owners
  const owners = await supabase
    .from('organization_members')
    .select('users(email)')
    .eq('organization_id', organizationId)
    .eq('role', 'owner');
  
  return owners.map(o => o.users.email).filter(Boolean);
}
```

---

### 7. **Error Handling**

```typescript
async function sendCallEndedEmail(callData: any) {
  try {
    // 1. Check if email is enabled globally
    if (process.env.EMAIL_ENABLED === 'false') {
      console.log('[Email] Skipped: EMAIL_ENABLED=false');
      return;
    }
    
    // 2. Get recipients
    const recipients = await getEmailRecipients(callData.organization_id);
    if (recipients.length === 0) {
      console.log('[Email] No recipients configured');
      return;
    }
    
    // 3. Check org settings
    const org = await getOrganization(callData.organization_id);
    if (org.notification_settings?.call_ended_email === false) {
      console.log('[Email] Skipped: disabled in org settings');
      return;
    }
    
    // 4. Check minimum duration
    const minDuration = org.notification_settings?.min_duration_to_notify || 0;
    if (callData.duration_ms < minDuration) {
      console.log(`[Email] Skipped: call too short (${callData.duration_ms}ms < ${minDuration}ms)`);
      return;
    }
    
    // 5. Send email
    await resend.emails.send({...});
    
    // 6. Log success
    await supabase
      .from('conversations')
      .update({ email_sent: true, email_sent_at: new Date() })
      .eq('id', callData.id);
    
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    // Don't throw - don't want to break webhook processing
  }
}
```

---

### 8. **Testing Strategy**

#### **Local Testing**:
```typescript
// Create test endpoint
// POST /api/test/send-call-email
export async function POST(req: NextRequest) {
  const mockCallData = {
    call_id: 'test_123',
    from_number: '+1234567890',
    to_number: '+1555123456',
    duration_ms: 225000,
    // ... all fields
  };
  
  await sendCallEndedEmail(mockCallData);
  return NextResponse.json({ success: true });
}
```

#### **Test Cases**:
1. ✅ Email sent successfully
2. ✅ No recipients configured
3. ✅ Email disabled in settings
4. ✅ Call too short (filtered)
5. ✅ Recording URL expired
6. ✅ Missing transcript
7. ✅ Missing cost data
8. ✅ API key invalid

---

### 9. **Optional Enhancements**

#### **Immediate** (Phase 1):
- [x] Basic HTML email
- [x] Call summary & metrics
- [x] Recording links
- [x] Transcript (truncated)

#### **Future** (Phase 2):
- [ ] React email templates (beautiful!)
- [ ] Attachment: Full transcript as .txt
- [ ] Attachment: Recording as .wav (downloaded)
- [ ] Daily/weekly digest emails
- [ ] Email preferences UI in admin
- [ ] Unsubscribe functionality
- [ ] Email open tracking
- [ ] Link click tracking

#### **Advanced** (Phase 3):
- [ ] Slack/Teams notifications
- [ ] SMS alerts for urgent calls
- [ ] Webhook to custom endpoints
- [ ] Integration with CRM systems

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "resend": "^3.2.0",
    "@react-email/components": "^0.0.15",  // Optional: for React templates
    "@react-email/render": "^0.0.12"       // Optional: for React templates
  }
}
```

---

## 🎯 Success Metrics

- ✅ Email sent within 5 seconds of call_ended webhook
- ✅ 99%+ delivery rate
- ✅ < 1% bounce rate
- ✅ All critical data included
- ✅ Links work for 24 hours minimum
- ✅ No PII in subject lines
- ✅ Mobile-friendly design

---

## 🔐 Security Considerations

1. **PII Protection**:
   - Use scrubbed transcript if available
   - Mask phone numbers in subject (optional)
   - Don't include full transcript in email body (just preview + link)

2. **Recording URLs**:
   - Warn about expiration
   - Consider downloading & storing permanently
   - Or just link to dashboard view

3. **Access Control**:
   - Only send to authorized recipients
   - Validate email addresses
   - Rate limiting on email endpoint

4. **API Keys**:
   - Store in env vars only
   - Never expose in frontend
   - Rotate regularly

---

## 🚀 Deployment Checklist

- [ ] Install dependencies
- [ ] Add env variables
- [ ] Create email templates
- [ ] Add email function
- [ ] Update webhook handler
- [ ] Test with mock data
- [ ] Test with real call
- [ ] Deploy to production
- [ ] Monitor delivery rate
- [ ] Set up alerts for failures

---

## 📊 Monitoring

```typescript
// Track email metrics
await supabase
  .from('email_logs')
  .insert({
    conversation_id: callData.id,
    email_type: 'call_ended',
    recipients: recipients,
    sent_at: new Date(),
    status: 'sent',  // sent, failed, bounced
    error: null
  });
```

---

**Next Step**: Implement Phase 1 (Basic HTML Email)

**Estimated Time**: 2-3 hours for complete implementation
