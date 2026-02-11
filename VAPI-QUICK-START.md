# Vapi Integration - Quick Start Checklist

**Goal:** Get Vapi working in 15 minutes

---

## ☑️ Pre-Flight Checklist

- [ ] Vapi account created (https://dashboard.vapi.ai)
- [ ] VAPI_API_KEY obtained from dashboard
- [ ] Backend deployed and running
- [ ] Database accessible

---

## 🚀 5-Step Setup

### 1. Apply Database Migration (2 min)

```bash
# Via Supabase Dashboard → SQL Editor
# Paste and run: supabase/migrations/060_vapi_assistants.sql
```

**Verify:**
```sql
SELECT * FROM vapi_assistants LIMIT 1;
-- Should return empty table (no error)
```

---

### 2. Set Environment Variables (1 min)

Add to `.env` or Fly.io secrets:
```bash
VAPI_API_KEY=sk_your_key_here
VAPI_RESPONSE_FORMAT=json
```

**Deploy:**
```bash
fly deploy
# Or restart your server
```

---

### 3. Create Vapi Assistant (3 min)

**Option A: Using Script (Easiest)**
```bash
node scripts/create-vapi-assistant.js YOUR_ORG_ID --name "Sarah"
```

**Option B: Manual in Vapi Dashboard**
1. Go to https://dashboard.vapi.ai/assistants
2. Click "Create Assistant"
3. Copy function definitions from `docs/VAPI-INTEGRATION-COMPLETE.md`
4. Set webhook URL: `https://your-domain.com/api/vapi/functions`
5. Save assistant ID
6. Insert into database:
```sql
INSERT INTO vapi_assistants (organization_id, assistant_id, assistant_name, is_active)
VALUES ('your-org-id', 'asst_from_vapi', 'Sarah', true);
```

---

### 4. Get Phone Number (5 min)

1. Go to Vapi Dashboard → Phone Numbers
2. Click "Buy Number"
3. Select country/region
4. Purchase number
5. Assign to your assistant
6. Update database:
```sql
UPDATE vapi_assistants 
SET phone_number = '+18504036622' 
WHERE assistant_id = 'asst_your_id';
```

---

### 5. Test! (4 min)

1. **Call the number**
2. **Say:** "Hi, I'd like to book an appointment"
3. **Verify:**
   - Agent responds naturally
   - Functions are called
   - Appointment is created
   - Conversation shows in admin UI

---

## ✅ Success Checklist

- [ ] Migration applied (vapi_assistants table exists)
- [ ] Environment variables set (VAPI_API_KEY)
- [ ] Backend deployed and running
- [ ] Assistant created in Vapi
- [ ] Assistant mapped in database
- [ ] Phone number purchased and assigned
- [ ] Test call completes successfully
- [ ] Appointment appears in database
- [ ] Conversation logged in admin UI

---

## 🐛 Quick Troubleshooting

### "Functions not being called"
```bash
# Check webhook is accessible
curl https://your-domain.com/api/vapi/functions
# Should return: {"status":"ok",...}
```

### "Wrong organization"
```sql
-- Check assistant mapping
SELECT * FROM vapi_assistants WHERE assistant_id = 'asst_your_id';
-- Should show correct organization_id
```

### "Agent says strange things"
```bash
# Switch to natural language mode
# In .env: VAPI_RESPONSE_FORMAT=natural
fly deploy
```

### "Can't find logs"
```bash
# View Fly.io logs
fly logs

# Filter for Vapi
fly logs | grep "VAPI"

# Real-time
fly logs -f
```

---

## 📞 Test Workflow

1. **Call:** Dial Vapi number
2. **Agent:** "Hello! Thank you for calling..."
3. **You:** "I'd like to book an appointment"
4. **Agent:** "Are you a new or existing patient?"
5. **You:** "New patient"
6. **Agent:** "I'll need your first name..."
7. *[Agent collects info]*
8. **Agent:** "What date were you looking for?"
9. **You:** "February 10th"
10. **Agent:** *[Checks availability]* "I found 3 slots: 10:00 AM..."
11. **You:** "10:00 AM"
12. **Agent:** *[Books appointment]* "Excellent! I've booked your appointment..."

---

## 📚 Full Documentation

See `docs/VAPI-INTEGRATION-COMPLETE.md` for:
- Complete function definitions
- Multi-tenant setup
- Response format options
- Advanced troubleshooting
- API reference

---

## 🆘 Need Help?

1. Check logs: `fly logs`
2. Test webhook: `curl https://your-domain.com/api/vapi/functions`
3. Verify database: `SELECT * FROM vapi_assistants;`
4. Check Vapi dashboard call logs

---

**Estimated Total Time:** 15 minutes

**Difficulty:** ⭐⭐☆☆☆ (Easy)
