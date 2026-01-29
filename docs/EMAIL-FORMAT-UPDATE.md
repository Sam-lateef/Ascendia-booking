# Email Format Update - Matches Admin UI

## 🎯 **What Changed**

### Before (Issue)
- **Emails sent too early**: Triggered on `call_ended` event
- **Missing data**: Call analysis (summary, extracted fields) not included
- **Only showed**: Transcript

### After (Fixed)
- **Emails sent at the right time**: Triggered on `call_analyzed` event
- **Complete data**: Includes everything from admin UI
- **Shows**: Call details, sentiment, success status, summary, extracted fields, transcript, recording link, debug log link

---

## 📧 **New Email Format**

### Email Structure

```
┌─────────────────────────────────────────┐
│  📞 Call Summary Header                 │
│  Organization • Date • Duration         │
├─────────────────────────────────────────┤
│  📊 Call Details Card                   │
│  ┌─────────────┬─────────────┐         │
│  │ From        │ To          │         │
│  │ Duration    │ Status      │         │
│  └─────────────┴─────────────┘         │
│  Badges: [Sentiment] [✓ Success]       │
├─────────────────────────────────────────┤
│  📝 Call Summary                        │
│  [Gradient box with full summary]      │
├─────────────────────────────────────────┤
│  📊 Extracted Information               │
│  • Patient Name: John Doe              │
│  • Phone Number: 6194563960            │
│  • Appointment Date: Jan 29th          │
│  • Appointment Type: Cleaning          │
├─────────────────────────────────────────┤
│  🔗 Links                               │
│  [🎧 Listen to Recording]              │
│  [🔍 View Debug Log]                   │
├─────────────────────────────────────────┤
│  💬 Conversation Transcript             │
│  [Full transcript in monospace font]   │
├─────────────────────────────────────────┤
│  Footer: [View in Dashboard]           │
│  Call ID: call_xxx                     │
└─────────────────────────────────────────┘
```

---

## 🎨 **Visual Elements**

### 1. Call Details Card
- **Grid layout**: From/To, Duration/Status
- **Badges** (matching admin UI):
  - Sentiment: Green (Positive), Gray (Neutral), Red (Negative)
  - Success: Green ✓ (Successful), Red ✗ (Incomplete)
  - Voicemail: Blue 📧 (if applicable)

### 2. Call Summary
- **Gradient purple background** (same as admin UI)
- Prominent display with shadow
- Full summary text from Retell analysis

### 3. Extracted Information
- **Light blue box** with left border
- Key-value pairs from `custom_analysis_data`
- Filters out empty values (0, '', null)
- Capitalizes field labels

### 4. Recording & Debug Links
- **Two styled buttons**:
  - Purple: Listen to Recording (links to recording_url)
  - Gray: View Debug Log (links to public_log_url)

### 5. Transcript
- **Monospace font** (code-style)
- Light gray background with border
- Scrollable if long (max 400px height)
- Pre-formatted to preserve line breaks

---

## 🔄 **Webhook Event Sequence**

### Old Flow (Incomplete)
```
1. call_started → Create conversation record
2. call_ended → Update with transcript → 📧 Send email (NO ANALYSIS!)
3. call_analyzed → Update with analysis (email already sent)
```

### New Flow (Complete) ✅
```
1. call_started → Create conversation record
2. call_ended → Update with transcript ⏳
3. call_analyzed → Update with analysis → 📧 Send email (WITH EVERYTHING!)
```

---

## 📊 **Data Included in Email**

| Field | Source | Display Location |
|-------|--------|------------------|
| From/To Numbers | `call_ended` | Call Details Card |
| Duration | `call_ended` | Call Details Card + Header |
| Disconnection Reason | `call_ended` | Call Details Card |
| Call Summary | `call_analyzed` | Prominent Summary Box |
| User Sentiment | `call_analyzed` | Badge in Call Details |
| Call Success | `call_analyzed` | Badge in Call Details |
| Voicemail Status | `call_analyzed` | Badge in Call Details |
| Extracted Fields | `call_analyzed.custom_analysis_data` | Extracted Information Section |
| Transcript | `call_ended` | Conversation Transcript |
| Recording URL | `call_ended` | Recording Link Button |
| Public Log URL | `call_ended` | Debug Log Link Button |

---

## 🎯 **Comparison: Email vs Admin UI**

### Admin UI Shows:
- ✅ Call details (duration, numbers, status)
- ✅ Sentiment and success badges
- ✅ Call summary
- ✅ Extracted fields (custom_analysis_data)
- ✅ Full transcript
- ✅ Audio player for recording
- ✅ Link to debug log
- ✅ Disconnection reason
- ✅ Voicemail indicator

### Email Now Shows:
- ✅ Call details (duration, numbers, status)
- ✅ Sentiment and success badges
- ✅ Call summary
- ✅ Extracted fields (custom_analysis_data)
- ✅ Full transcript
- ✅ Link to recording (can't embed audio player in email)
- ✅ Link to debug log
- ✅ Disconnection reason
- ✅ Voicemail indicator

**Result**: 100% parity except audio player (email limitation)

---

## 🚀 **Technical Details**

### Code Changes

#### 1. Webhook Route (`src/app/api/retell/webhook/route.ts`)

**Before:**
```typescript
async function handleCallEnded(call) {
  // ... update conversation ...
  
  // Send email HERE (before analysis)
  sendCallEndedEmail(callData);
}

async function handleCallAnalyzed(call) {
  // ... update analysis ...
  // NO email sending
}
```

**After:**
```typescript
async function handleCallEnded(call) {
  // ... update conversation ...
  
  // NOTE: Email moved to call_analyzed
  console.log('⏳ Email will be sent after analysis completes');
}

async function handleCallAnalyzed(call) {
  // ... update analysis ...
  
  // Send email HERE (with complete data)
  sendCallEndedEmail(callData); // Includes call_analysis!
}
```

#### 2. Email Template (`src/app/lib/email/templates/callEndedEmail.ts`)

**Added:**
- Call details card with grid layout
- Sentiment and success badges
- Voicemail indicator
- Prominent links to recording and debug log
- Better visual hierarchy

**Enhanced:**
- Call summary with gradient background (matching UI)
- Extracted fields with better formatting
- Responsive design for mobile email clients

---

## 📝 **Subject Line Examples**

The email subject is now dynamic and informative:

### With Patient Name
```
📞 Call with John Doe: 2m 15s
```

### With Appointment Type
```
📞 Cleaning Call: 1m 45s
```

### With Success/Failure
```
✅ Successful Call: 3m 20s
❌ ⚠️ Incomplete Call: 1m 10s
```

### With Voicemail
```
📧 Voicemail: 45s
```

---

## ⚡ **Performance**

- **Email delay**: ~2-5 seconds after call ends (waiting for analysis)
- **Retell analysis**: Typically arrives 1-3 seconds after call_ended
- **No blocking**: Email sent asynchronously (doesn't slow webhook response)

---

## ✅ **Testing**

### How to Test

1. **Make a test call** via Retell
2. **Check webhook logs**:
   ```bash
   fly logs -a ascendia-booking | grep "call_analyzed"
   ```
3. **Look for**:
   ```
   [Retell Webhook] Call analyzed: call_xxx
   [Retell Webhook] 📧 Email notification triggered (with analysis)
   ```
4. **Check email** - should now show:
   - Call summary
   - Extracted fields
   - Sentiment/success badges
   - All other details

### Expected Timeline

```
Call ends → 0s
  ↓
Webhook call_ended arrives → ~500ms
  ↓
Database updated (transcript) → ~1s
  ↓
Webhook call_analyzed arrives → ~2s
  ↓
Database updated (analysis) → ~2.5s
  ↓
Email sent with complete data → ~3s
  ↓
Email received → ~5s total
```

---

## 🐛 **Troubleshooting**

### Issue: Still only seeing transcript

**Check:**
1. Is `call_analyzed` event being received?
   ```bash
   fly logs -a ascendia-booking | grep "call_analyzed"
   ```
2. Does the DB have `call_analysis` data?
   ```sql
   SELECT call_id, call_analysis FROM conversations WHERE call_id = 'call_xxx';
   ```
3. Is the email being sent from `call_analyzed` event?
   ```bash
   fly logs -a ascendia-booking | grep "Email notification triggered (with analysis)"
   ```

**Solution:**
- If `call_analyzed` not arriving: Check Retell webhook configuration
- If analysis not in DB: Check webhook handler logs for errors
- If email sent from wrong event: Verify latest deployment

---

## 📚 **Related Documentation**

- `RETELL-CALL-LOGGING-GUIDE.md` - Webhook event details
- `EMAIL-NOTIFICATIONS-TEST-NOW.md` - Email setup and configuration
- `PRODUCTION-DEBUGGING-GUIDE.md` - How to debug call issues

---

**Status**: ✅ Deployed to production  
**Deployed**: 2026-01-28  
**Email Format**: Matches admin UI 100% (except audio player limitation)
