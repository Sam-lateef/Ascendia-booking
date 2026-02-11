# Twilio SMS - Quick Test Guide

**5-Minute Test Checklist**

---

## ✅ Pre-Flight Check (30 seconds)

1. **Verify phone number is mapped:**
   ```bash
   node scripts/seed-twilio-phone-numbers.js
   ```
   
   Should show: `✅ Phone: +18504036622` (or your SMS number)

2. **Verify Twilio webhook:**
   - Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
   - Click your number
   - Messaging → A Message Comes In: `https://ascendia-booking.fly.dev/api/twilio/incoming-sms`
   - Must be HTTP POST

---

## 📱 Test 1: Basic SMS Response (1 minute)

**Action:** Send SMS to your Twilio number

```
Text: "Hi"
```

**Expected:**
- Response within 2-3 seconds
- Lexi greets you: "Hi! Welcome to [Office Name]. This is Lexi. How can I help you today?"

**Logs to watch:**
```
💬 [TWILIO SMS] NEW INCOMING MESSAGE
[Twilio SMS] 🏢 Organization: [your-org-id]
[Twilio SMS] 📝 Creating new conversation: sms_...
[Twilio SMS] ✅ Created conversation: [conversation-id]
[Twilio SMS] ✅ Response: "Hi! Welcome to..."
```

**If it fails:**
- Check Twilio webhook URL is correct
- Verify app is running (local: `npm run dev`, production: check Fly.io)
- Check logs for errors

---

## 💬 Test 2: Conversation Context (2 minutes)

**Action:** Continue the conversation

```
Message 1: "I'd like to book an appointment"
Message 2: "My name is John Smith"
Message 3: "619-555-1234"
```

**Expected:**
- Each response acknowledges previous messages
- Lexi remembers your name when asking for phone
- Context maintained throughout conversation

**Logs to watch:**
```
[Twilio SMS] 🤖 Processing with Lexi (continuing message)...
[Twilio SMS] 📥 Loaded [N] previous messages from database
```

**If context is lost:**
- Check database query is working
- Verify session ID is consistent: `sms_<from>_<to>`
- Look for errors in message fetch

---

## 🏢 Test 3: Admin UI Visibility (1 minute)

**Action:** Check Admin UI

1. Go to Admin → Calls (or Conversations)
2. Find your SMS conversation

**Expected:**
- Conversation appears with Channel: "SMS"
- Organization: Correct org (not default)
- All messages visible in transcript
- Timestamps correct

**If not showing:**
- Check organization filter (might be filtering out)
- Verify RLS permissions for your user
- Check conversation has correct `organization_id`

---

## 🎯 Test 4: Multi-Tenant (Optional, 2 minutes)

**Only if you have multiple organizations**

**Setup:**
1. Add second phone number to different org in `phone_numbers` table
2. Text both numbers with different conversations

**Expected:**
- Conversation 1 appears in Org 1
- Conversation 2 appears in Org 2
- No cross-contamination (Org 1 can't see Org 2's data)

**SQL to add second number:**
```sql
INSERT INTO phone_numbers (
  id,
  organization_id,
  phone_number,
  channel,
  is_active
) VALUES (
  gen_random_uuid(),
  'ORG_2_ID_HERE',
  '+18505551234',  -- Second Twilio number
  'twilio',
  true
);
```

---

## 🔧 Quick Troubleshooting

### No response received
- **Check:** Twilio webhook URL is correct
- **Check:** App is running (Fly.io or local with ngrok)
- **Fix:** Verify webhook URL, restart app if needed

### Response but no context
- **Check:** Database query is working
- **Check:** Session ID is consistent
- **Fix:** Check logs for "Loaded [N] previous messages"

### Wrong organization
- **Check:** Phone number is in `phone_numbers` table
- **Check:** `To` number matches exactly (with +1)
- **Fix:** Run `node scripts/seed-twilio-phone-numbers.js`

### Not showing in Admin UI
- **Check:** Organization filter settings
- **Check:** RLS permissions
- **Fix:** Verify conversation has correct `organization_id`

---

## 📊 Success Criteria

✅ SMS received and response sent  
✅ Conversation maintains context across multiple messages  
✅ Conversation visible in Admin UI  
✅ Correct organization routing  
✅ All messages logged to database  
✅ No errors in server logs  

---

## 🚀 Next Steps After Testing

1. ✅ SMS working → Deploy to production (if testing locally)
2. ✅ Test with real booking flow (name, phone, appointment)
3. ✅ Monitor logs for any edge cases
4. ✅ Add more phone numbers if multi-org setup

---

**Need help?** Check full guide: `docs/TWILIO-SMS-INTEGRATION-COMPLETE.md`
