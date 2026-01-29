# Multi-Organization Voice Call Routing

How to support multiple organizations with Retell and Twilio using a single WebSocket server.

---

## 🎯 The Challenge

**Question:** How does the WebSocket server know which organization a call belongs to?

**Current behavior:** All calls go to the DEFAULT organization (first one created)

**Goal:** Route each call to the correct organization based on the phone number called

---

## 🏗️ Solution: Phone Number Mapping

Map each phone number to an organization in the database.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Incoming Calls                             │
│  Retell: +1-555-0100 | Twilio: +1-555-0200 | WhatsApp       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
         ┌────────────────────────┐
         │  WebSocket Server      │
         │  (Fly.io)              │
         └───────────┬────────────┘
                     │
                     ↓
         ┌────────────────────────┐
         │  phone_numbers table   │  ← NEW!
         │  Maps phone → org      │
         └───────────┬────────────┘
                     │
         ┌───────────┴──────────────────────────────┐
         │                                           │
         ↓                                           ↓
   Organization A                              Organization B
   - Providers                                 - Providers
   - Operatories                              - Operatories
   - Appointments                             - Appointments
```

---

## 📊 Database Setup

### 1. Run Migration

Created: `supabase/migrations/054_phone_number_org_mapping.sql`

```sql
CREATE TABLE phone_numbers (
  id uuid PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,      -- E.164 format: +15551234567
  organization_id uuid REFERENCES organizations(id),
  channel text NOT NULL,                   -- 'retell', 'twilio', 'whatsapp'
  is_active boolean DEFAULT true,
  friendly_name text,                      -- 'Main Support', 'After Hours'
  metadata jsonb DEFAULT '{}'
);
```

### 2. Add Your Phone Numbers

```sql
-- Example: Map your Retell and Twilio numbers to organizations
INSERT INTO phone_numbers (phone_number, organization_id, channel, friendly_name) VALUES
  -- Organization A (sam.lateeff's Organization)
  ('+15551234567', 'b445a9c7-af93-4b4a-a975-40d3f44178ec', 'retell', 'Main Support Line'),
  ('+15551234568', 'b445a9c7-af93-4b4a-a975-40d3f44178ec', 'twilio', 'Twilio Standard'),
  
  -- Organization B (if you have a second org)
  ('+15559876543', 'your-second-org-id-here', 'retell', 'Org B Support'),
  ('+15559876544', 'your-second-org-id-here', 'twilio', 'Org B Twilio');
```

---

## 🔧 Implementation Status

### ✅ What's Ready:

1. **Database Schema** - `phone_numbers` table created
2. **Helper Function** - `getOrganizationIdFromPhone()` in `src/app/lib/callHelpers.ts`
3. **Phone Normalization** - Handles any format (+1-555-1234, (555) 123-4567, etc.)

### 🚧 What's Needed:

Update WebSocket handlers to extract phone number and look up organization:

#### For Retell (`src/retell/websocket-handler.ts`):

```typescript
// CURRENT (line 377):
const orgId = await getCachedDefaultOrganizationId();

// UPDATE TO:
// Get phone number from Retell call metadata
// Option 1: From query params (if available)
const toNumber = req.query.to_number || req.query.phone_number;

// Option 2: From Retell API (more reliable)
if (callId) {
  const { getOrganizationIdFromPhone } = await import('../app/lib/callHelpers');
  const orgId = await getOrganizationIdFromPhone(toNumber);
}
```

**Challenge:** Need to get the "to" number (number customer called) from Retell

#### For Twilio (`src/twilio/websocket-handler-standard.ts`):

```typescript
// Twilio sends 'To' parameter in initial message
// Extract from: message.start.customParameters.To
const toNumber = customParameters.To;
const orgId = await getOrganizationIdFromPhone(toNumber);
```

---

## 📞 How It Works (After Implementation)

### Call Flow Example:

1. **Customer calls** `+1-555-0100` (your Retell number)
2. **Retell connects** to: `wss://ascendiaai-websocket.fly.dev/llm-websocket/abc123`
3. **WebSocket handler** receives connection
4. **System looks up** `+1-555-0100` in `phone_numbers` table
5. **Finds:** Organization A (`b445a9c7-af93-4b4a-a975-40d3f44178ec`)
6. **Routes call** to Organization A's:
   - Providers (Mike Lee, Sarah J)
   - Operatories (room1 ID=14, room2 ID=15)
   - Appointments
   - Custom instructions

---

## 🎯 Current Workaround (Until Full Implementation)

For now, you can use **Option 2: Separate Endpoints Per Org**

### Quick Fix for Multiple Orgs:

#### 1. Update WebSocket Handler

```typescript
// In src/retell/websocket-handler.ts
// Change line 360 from:
expressWsInstance.app.ws('/llm-websocket/:call_id', ...

// To:
expressWsInstance.app.ws('/llm-websocket/:org_slug/:call_id', async (ws, req) => {
  const orgSlug = req.params.org_slug;
  const callId = req.params.call_id;
  
  // Map slug to org ID
  const orgMap: Record<string, string> = {
    'org-a': 'b445a9c7-af93-4b4a-a975-40d3f44178ec',
    'org-b': 'your-second-org-id-here'
  };
  
  const orgId = orgMap[orgSlug] || await getCachedDefaultOrganizationId();
  // Rest of handler...
});
```

#### 2. Configure Retell Agents

- **Agent for Org A:** 
  - WebSocket URL: `wss://ascendiaai-websocket.fly.dev/llm-websocket/org-a`

- **Agent for Org B:**
  - WebSocket URL: `wss://ascendiaai-websocket.fly.dev/llm-websocket/org-b`

#### 3. Redeploy

```powershell
fly deploy --config fly-websocket.toml --dockerfile Dockerfile.websocket --app ascendiaai-websocket
```

---

## 🧪 Testing Multi-Org Setup

### Verify Phone Number Mapping

```sql
-- Check your phone number mappings
SELECT 
  phone_number,
  friendly_name,
  channel,
  o.name as organization_name,
  is_active
FROM phone_numbers pn
JOIN organizations o ON o.id = pn.organization_id
ORDER BY phone_number;
```

### Test Call Routing

```powershell
# Monitor logs
fly logs --app ascendiaai-websocket -f

# Make test call from each number
# Look for:
# [CallHelpers] ✓ Found org b445a9c7-... for phone +15551234567
```

---

## 📋 Admin UI (Future Enhancement)

Add a phone number management page in your admin dashboard:

**Location:** `/admin/settings/phone-numbers`

**Features:**
- View all phone numbers
- Map new numbers to organizations
- Edit/deactivate numbers
- Set friendly names
- Configure routing rules (business hours, etc.)

---

## 🔐 Security Considerations

### RLS Policies

Already configured:
- ✅ Users can only view phone numbers for their organizations
- ✅ Only admins/owners can manage phone numbers
- ✅ Phone numbers are org-scoped

### Phone Number Validation

- All numbers normalized to E.164 format
- Duplicate numbers prevented by UNIQUE constraint
- Invalid numbers caught before database insert

---

## 🎉 Benefits

✅ **One Server, Multiple Orgs** - Cost-effective
✅ **Automatic Routing** - No manual configuration per call
✅ **Scalable** - Add unlimited organizations
✅ **Flexible** - Support Retell, Twilio, WhatsApp from same table
✅ **Admin-Friendly** - Manage mappings from dashboard

---

## 📝 Next Steps

### Immediate (Quick Fix):

1. Use **separate endpoint approach** for each org
2. Configure Retell agents with org-specific URLs
3. Test with your existing organizations

### Long-term (Recommended):

1. Run the phone number migration
2. Add your phone numbers to the database
3. Update WebSocket handlers to extract phone numbers
4. Build admin UI for phone management
5. Test multi-org routing

---

## 🆘 Troubleshooting

### Issue: Calls going to wrong organization

**Check:**
```sql
-- Verify phone number mapping
SELECT * FROM phone_numbers WHERE phone_number = '+15551234567';
```

### Issue: Can't get phone number from Retell

**Solution:** Use separate endpoint approach (`/llm-websocket/:org_slug/:call_id`)

### Issue: Multiple orgs showing same data

**Check:** Organization ID is being correctly passed to `/api/booking`

---

Last Updated: January 26, 2026

**Status:** 
- ✅ Database schema ready
- ✅ Helper functions implemented
- 🚧 WebSocket handler update needed
- 🚧 Admin UI (future)
