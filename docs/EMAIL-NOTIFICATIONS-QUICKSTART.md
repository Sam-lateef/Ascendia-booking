# Email Notifications - Quick Start 🚀

## ✅ What's Done

You now have a **complete email notification system** that sends beautiful emails after every Retell call!

---

## 📋 3 Steps to Activate

### **Step 1: Apply Database Migration** (1 minute)

1. Go to your **Supabase Dashboard** → SQL Editor
2. Copy the contents of `supabase/migrations/057_email_notification_settings.sql`
3. Paste and **Run** it
4. Should see: ✅ Migration 057 complete!

### **Step 2: Configure in UI** (2 minutes)

1. Start your app: `npm run dev`
2. Go to **Admin Panel** → **⚙️ Settings** → **🔔 Notifications**
3. Enable email notifications
4. Add your email address(es) in "Email Recipients"
5. Click **Save Settings**

### **Step 3: Test** (1 minute)

1. Make a test Retell call (or wait for a real one)
2. Check your email inbox
3. You should receive a beautiful HTML email with:
   - Call summary
   - Transcript preview
   - Recording links
   - Performance metrics
   - Cost info

---

## 🎨 What the Email Looks Like

**Subject**: `✅ Call Summary: +1 (555) 123-4567 → 3m 45s`

**Content**: Professional HTML email with:
- 📊 Call details (from/to, duration, cost)
- ⏱️ Performance metrics (latency stats)
- 📝 Transcript preview
- 📊 Call analysis (sentiment, success)
- 🔗 Action buttons (view in dashboard, listen to recording)

---

## ⚙️ Configuration Options

### **In the UI** (`/admin/settings/notifications`):

- **Enable/Disable**: Turn notifications on/off
- **Recipients**: Add multiple emails (admin@clinic.com, manager@clinic.com, etc.)
- **FROM Email**: Set custom sender (optional)
- **Content**: Choose what to include (transcript, recordings, metrics, cost)
- **Filters**: Set minimum call duration (default: 10 seconds)

### **Who Gets the Email?**

Priority order:
1. **Custom recipients** (if you added emails in UI)
2. **Organization email** (from your org settings)
3. **Organization owners** (as fallback)

---

## 🔧 Environment Variables

Already configured in your `.env`:

```env
RESEND_API_KEY=re_4kqWKYMk_6wrt31BZErBD2EkdiUaDM9mC
RESEND_FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For Production**: Update `NEXT_PUBLIC_APP_URL` to your production domain.

---

## 🧪 Test It Now!

### **Option A**: Make a Real Call
1. Call your Retell number
2. Have a conversation
3. Hang up
4. Check your email (arrives within 5 seconds)

### **Option B**: Check Webhook Logs
```bash
# Watch logs after a call ends
# Look for:
[Retell Webhook] ✅ Updated conversation: xxx
[Retell Webhook] 📧 Email notification triggered
[Email] ✅ Sent successfully in XXXms
```

---

## 🐛 Troubleshooting

### **No Email Received?**

1. **Check spam/junk folder**
2. **Verify configuration**:
   - Go to **Settings** → **Notifications** (`/admin/settings/notifications`)
   - Make sure "Enable Email Notifications" is ON
   - Check that your email is in the recipients list
3. **Check console logs** for `[Email]` messages
4. **Check call duration**: Calls < 10 seconds are skipped by default

### **Email Says "Failed"?**

Check logs for errors:
```bash
[Email] ❌ Failed after XXms: <error message>
```

Common issues:
- Invalid Resend API key
- Invalid email address
- Resend account not verified

---

## 📊 Monitor Email Success

```sql
-- Check email tracking in database
SELECT 
  call_id,
  from_number,
  duration_ms / 1000.0 as duration_seconds,
  email_sent,
  email_sent_at,
  email_recipients,
  email_error
FROM conversations
WHERE channel = 'voice'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 What Happens Automatically

After **every call ends**:

1. ✅ Call data saved to database (all 32 fields!)
2. ✅ Email notification triggered
3. ✅ Check if enabled for your org
4. ✅ Check if call meets duration filter
5. ✅ Get recipients
6. ✅ Generate beautiful HTML email
7. ✅ Send via Resend
8. ✅ Track success/failure in database

**No manual work needed!** Just configure once and forget it.

---

## 🎉 You're All Set!

Your email notification system is **ready to use**. Just:

1. Apply the migration
2. Configure in UI
3. Test with a call

**That's it!** 🚀

---

## 📝 Next Steps (Optional)

### **For Production**:
- [ ] Update `NEXT_PUBLIC_APP_URL` in production `.env`
- [ ] Verify your custom domain in Resend (for custom FROM email)
- [ ] Set up email preferences per user/role
- [ ] Add more recipients as needed

### **Future Enhancements**:
- [ ] Daily/weekly digest emails
- [ ] Slack notifications
- [ ] SMS alerts
- [ ] CRM integration

---

## 📚 Full Documentation

For detailed info, see:
- `docs/EMAIL-NOTIFICATIONS-IMPLEMENTED.md` - Complete implementation guide
- `docs/EMAIL-NOTIFICATIONS-PLAN.md` - Original plan
- `docs/RETELL-CALL-DATA-COMPLETE.md` - What call data is captured

---

**Questions?** Check the full documentation or logs with `[Email]` prefix!
