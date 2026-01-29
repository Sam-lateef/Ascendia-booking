# How to Assign Phone Numbers to Different Organizations

This guide shows you how to assign your Twilio phone number to any organization in your multi-tenant setup.

---

## Quick Start (30 seconds)

### Step 1: Find Your Organizations

```bash
node scripts/find-organizations.js
```

**Output:**
```
Found 2 organization(s):

1. Default Organization
   ID: 00000000-0000-0000-0000-000000000001
   Slug: default-org

2. Clinic ABC  
   ID: b445a9c7-af93-4b4a-a975-40d3f44178ec
   Slug: clinic-abc
```

### Step 2: Assign Phone to Organization

```bash
# Use the org ID from step 1
node scripts/update-phone-org.js b445a9c7-af93-4b4a-a975-40d3f44178ec
```

**Output:**
```
✅ Phone number organization updated!

📋 Summary:
   Phone: +18504036622
   Organization: Clinic ABC
   
🎯 Incoming calls to this number will now route to:
   Organization: Clinic ABC
```

Done! Test by calling the number.

---

## Multiple Phone Numbers → Multiple Organizations

If you have multiple Twilio phone numbers for different organizations:

```bash
# Org 1: Main clinic
node scripts/update-phone-org.js ORG_1_ID +18504036622 twilio

# Org 2: Satellite office
node scripts/update-phone-org.js ORG_2_ID +18504441234 twilio

# Org 3: After-hours line
node scripts/update-phone-org.js ORG_3_ID +18504449999 twilio
```

**Result:**
- Calls to +18504036622 → Org 1 (Main clinic)
- Calls to +18504441234 → Org 2 (Satellite office)
- Calls to +18504449999 → Org 3 (After-hours line)

Each organization sees only their own calls! 🎉

---

## Method Comparison

### Method 1: Update Script (Recommended)
✅ **Easiest** - One command  
✅ **Safe** - Validates org exists  
✅ **Fast** - Updates immediately  

```bash
node scripts/update-phone-org.js YOUR_ORG_ID
```

### Method 2: Edit SQL File
⚠️ **Manual** - Edit file, run in Supabase Dashboard  
⚠️ **No validation** - Must ensure org ID is correct  

1. Edit: `scripts/create-phone-numbers-table.sql`
2. Replace org ID on line 73
3. Run in Supabase Dashboard → SQL Editor

### Method 3: Direct SQL (Advanced)
🔧 **For experts** - Run directly in Supabase Dashboard

```sql
-- Update existing phone number
UPDATE phone_numbers 
SET organization_id = 'YOUR_NEW_ORG_ID',
    updated_at = NOW()
WHERE phone_number = '+18504036622' 
  AND channel = 'twilio';

-- Verify
SELECT phone_number, organization_id, channel 
FROM phone_numbers 
WHERE phone_number = '+18504036622';
```

---

## Verify It's Working

### Step 1: Check Database
```bash
node scripts/find-organizations.js
```

Look for your phone number in the output:
```
📞 Current phone number assignments:

   +18504036622 (twilio)
   → Clinic ABC (b445a9c7-af93-4b4a-a975-40d3f44178ec)
   Status: active
```

### Step 2: Make a Test Call

1. **Call your Twilio number**
2. **Watch server logs:**
   ```
   [Twilio Call] 🏢 Organization: b445a9c7-af93-4b4a-a975-40d3f44178ec
   [Twilio WS] ✅ Created conversation for org: b445a9c7-af93-4b4a-a975-40d3f44178ec
   ```

3. **Check Admin UI:**
   - Go to: http://localhost:3000/admin/booking/calls
   - Switch to the correct organization in the dropdown
   - Your call should appear there! ✅

---

## Troubleshooting

### "Organization not found"
**Symptom:** `Organization not found: xxx`  
**Fix:** Run `node scripts/find-organizations.js` to see valid org IDs

### "Phone number appears in wrong org"
**Symptom:** Call shows in default org instead of assigned org  
**Fix:**
```bash
# 1. Verify phone mapping
node scripts/find-organizations.js

# 2. Re-assign if needed
node scripts/update-phone-org.js CORRECT_ORG_ID

# 3. Restart servers
npm run dev:full
```

### "No organizations found"
**Symptom:** Script says no organizations exist  
**Fix:** Create an organization first:
```bash
# Via UI
http://localhost:3000/admin/settings

# Or via script
node scripts/setup-first-org-simple.js your-email@example.com "My Clinic" "my-clinic"
```

---

## Common Scenarios

### Scenario 1: Single Organization
**Setup:** One clinic, one phone number  
**Config:** Assign to default org (already done by default)
```bash
# Nothing to do - works out of the box!
```

### Scenario 2: Multiple Clinics, One Phone Number
**Setup:** 2+ organizations, shared phone number  
**Config:** Assign to primary org
```bash
node scripts/update-phone-org.js PRIMARY_ORG_ID
```

### Scenario 3: Multiple Clinics, Multiple Phone Numbers
**Setup:** Each clinic has its own Twilio number  
**Config:** Assign each number to its org
```bash
node scripts/update-phone-org.js CLINIC_A_ORG_ID +15551111111 twilio
node scripts/update-phone-org.js CLINIC_B_ORG_ID +15552222222 twilio
node scripts/update-phone-org.js CLINIC_C_ORG_ID +15553333333 twilio
```

### Scenario 4: Testing Multi-Tenancy
**Setup:** Want to verify org isolation  
**Config:**
```bash
# Step 1: Assign number to Org A
node scripts/update-phone-org.js ORG_A_ID

# Step 2: Call the number
# Verify call appears ONLY in Org A

# Step 3: Reassign to Org B
node scripts/update-phone-org.js ORG_B_ID

# Step 4: Call again
# Verify call appears ONLY in Org B
```

---

## Advanced: Channel-Specific Assignment

The same phone number can be assigned to different organizations for different channels:

```sql
-- Twilio voice calls → Org A
INSERT INTO phone_numbers (phone_number, organization_id, channel)
VALUES ('+18504036622', 'ORG_A_ID', 'twilio');

-- WhatsApp → Org B (same phone number, different channel)
INSERT INTO phone_numbers (phone_number, organization_id, channel)
VALUES ('+18504036622', 'ORG_B_ID', 'whatsapp');

-- Retell → Org C (same phone number, different channel)
INSERT INTO phone_numbers (phone_number, organization_id, channel)
VALUES ('+18504036622', 'ORG_C_ID', 'retell');
```

**Result:**
- Voice calls via Twilio → Org A
- WhatsApp messages → Org B  
- Retell calls → Org C

---

## Summary

✅ **Find orgs:** `node scripts/find-organizations.js`  
✅ **Assign phone:** `node scripts/update-phone-org.js ORG_ID`  
✅ **Test call:** Call the number, check Admin UI  
✅ **Verify:** Call appears in correct organization  

**That's it!** Your Twilio number is now properly multi-tenant. 🎉
