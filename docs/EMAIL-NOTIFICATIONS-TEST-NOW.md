# Test Email Notifications NOW! 🚀

## ⚠️ Quick Fix for "Failed to load notification settings"

This error means the database migration hasn't been applied yet. Let's fix it!

---

## 📋 Step-by-Step Testing Guide

### **Step 1: Apply Database Migration** (REQUIRED!)

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project: `vihlqoivkayhvxegytlc`
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- ============================================================================
-- MIGRATION 057: Email Notification Settings
-- ============================================================================

-- Add email notification settings to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
    "call_ended_email_enabled": true,
    "call_ended_recipients": [],
    "email_from": null,
    "include_recording_links": true,
    "include_transcript": true,
    "include_cost": true,
    "include_performance": true,
    "min_duration_to_notify": 10000
  }';

-- Add email tracking fields to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_recipients TEXT[],
  ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Create index for email tracking
CREATE INDEX IF NOT EXISTS idx_conversations_email_sent 
  ON conversations(email_sent, email_sent_at) 
  WHERE channel = 'voice';

-- Comments
COMMENT ON COLUMN organizations.notification_settings IS 'Email notification configuration';
COMMENT ON COLUMN conversations.email_sent IS 'Whether call ended email was sent';
COMMENT ON COLUMN conversations.email_sent_at IS 'When the email was sent';
COMMENT ON COLUMN conversations.email_recipients IS 'Email addresses that received the notification';
COMMENT ON COLUMN conversations.email_error IS 'Error message if email sending failed';
```

6. Click **Run** (or press Ctrl+Enter)
7. You should see: ✅ "Success. No rows returned"

---

### **Step 2: Verify Migration Worked**

Run this query in Supabase SQL Editor:

```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
  AND column_name = 'notification_settings';

-- Should show 1 row with: notification_settings | jsonb
```

Also check conversations table:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
  AND column_name IN ('email_sent', 'email_sent_at', 'email_recipients');

-- Should show 3 rows
```

---

### **Step 3: Configure Email in UI**

1. Make sure your app is running: `npm run dev`
2. Go to: http://localhost:3000/admin/settings/notifications
3. **Page should now load without errors!** ✅

4. Configure settings:
   - ✅ Enable Email Notifications (toggle ON)
   - ➕ Add your email address (e.g., `your-email@gmail.com`)
   - 💾 Click **Save Settings**

**Example Configuration**:
```
Enable Email Notifications: ✅ ON
Email Recipients: your-email@gmail.com
Sender Email: (leave blank to use default)
Include transcript: ✅
Include recording links: ✅
Include performance: ✅
Include cost: ✅
Minimum duration: 10 seconds
```

---

### **Step 4: Test Email Locally**

Now test the email system without making a real call:

#### **Option A: Use Test Endpoint** (Easiest!)

```bash
# Send test email
curl -X POST http://localhost:3000/api/test/email
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Test email sent successfully! Check your inbox.",
  "call_id": "test_call_1234567890",
  "organization_id": "b445a9c7-af93-4b4a-a975-40d3f44178ec"
}
```

#### **Option B: Use Browser**

1. Open browser DevTools (F12)
2. Go to Console tab
3. Paste and run:

```javascript
fetch('/api/test/email', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

---

### **Step 5: Check Your Email Inbox** 📧

You should receive an email within **5-10 seconds** with:

**Subject**: `✅ Call Summary: +1 (234) 567-8901 → 3m 45s`

**Content**:
- 📊 Call details (from/to, duration, cost)
- ⏱️ Performance metrics
- 📝 Transcript preview
- 📊 Call analysis
- 🔗 Buttons: View in Dashboard, Listen to Recording, View Debug Log

**If no email arrives, check**:
1. ❌ Spam/junk folder
2. ❌ Email address is correct in settings
3. ❌ Email notifications are enabled
4. ❌ Check browser console for errors

---

### **Step 6: Check Logs**

In your terminal running `npm run dev`, look for:

```
[Email] Processing email for call: test_call_xxx
[Email] Using custom recipients: your-email@gmail.com
[Email] Using custom FROM: onboarding@resend.dev
[Email] ✅ Sent successfully in 1234ms
```

**If you see errors**:
```
[Email] ❌ Failed after XXXms: <error message>
```

**Common Errors**:
- `Invalid API key` → Check `.env` has correct `RESEND_API_KEY`
- `No recipients configured` → Add email in UI
- `403 Forbidden` → Resend API key might be invalid

---

## 🐛 Troubleshooting

### **Error: "Failed to load notification settings"**

✅ **Solution**: Apply migration (Step 1 above)

The `notification_settings` column doesn't exist yet.

---

### **Error: "No recipients found"**

✅ **Solution**: Add your email in UI

1. Go to Settings → Notifications
2. Add your email address
3. Save
4. Try test email again

---

### **Email sends but I don't receive it**

1. **Check spam folder** ⬅️ Most common!
2. **Verify email address**: Check for typos
3. **Check Resend dashboard**: https://resend.com/emails
   - See if email was sent successfully
   - Check delivery status
4. **Try different email**: Gmail, Outlook, etc.

---

### **Error in console: "RESEND_API_KEY not set"**

✅ **Solution**: Check `.env` file

```env
RESEND_API_KEY=re_4kqWKYMk_6wrt31BZErBD2EkdiUaDM9mC
RESEND_FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

After adding, restart dev server:
```bash
# Ctrl+C to stop
npm run dev
```

---

## ✅ Success Checklist

- [ ] Migration applied in Supabase
- [ ] Notifications page loads without errors
- [ ] Email address added and saved
- [ ] Test email sent (POST /api/test/email)
- [ ] Email received in inbox
- [ ] Logs show "✅ Sent successfully"

---

## 🎯 Next: Test with Real Call

Once test email works, you're ready for a real Retell call!

**After deployment**:
1. Make a real call to your Retell number
2. Talk for > 10 seconds
3. Hang up
4. Check your email (arrives within 5 seconds)
5. Check database:

```sql
SELECT 
  call_id,
  from_number,
  duration_ms / 1000.0 as duration_seconds,
  email_sent,
  email_sent_at,
  email_recipients
FROM conversations
WHERE channel = 'voice'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📊 Monitor Email Success

```sql
-- Email success rate (last 7 days)
SELECT 
  COUNT(*) as total_calls,
  COUNT(CASE WHEN email_sent THEN 1 END) as emails_sent,
  COUNT(CASE WHEN email_error IS NOT NULL THEN 1 END) as email_failures,
  ROUND(100.0 * COUNT(CASE WHEN email_sent THEN 1 END) / COUNT(*), 2) as success_rate_percent
FROM conversations
WHERE channel = 'voice'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days';
```

---

## 🚀 Ready for Production?

Once local testing works:

1. ✅ Deploy to Fly.io: `fly deploy`
2. ✅ Make real Retell call
3. ✅ Verify email arrives
4. ✅ Check production logs: `fly logs`

---

**Having issues? Check terminal logs for `[Email]` messages!** 📧
