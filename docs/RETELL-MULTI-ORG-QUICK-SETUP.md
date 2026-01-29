# Retell Multi-Org Quick Setup (5 Minutes)

**Status:** ✅ Implemented - Ready to use!

---

## 🎯 What Changed

Your WebSocket server now supports **organization-specific endpoints**!

### Old Format (Single Org):
```
wss://ascendiaai-websocket.fly.dev/llm-websocket
```
→ All calls go to default organization

### New Format (Multi Org):
```
wss://ascendiaai-websocket.fly.dev/llm-websocket/:org_slug
```
→ Each org gets its own endpoint!

**Backward Compatible:** The old format still works for your default org.

---

## 🚀 Setup Steps

### 1. Add Your Organizations to the Map

Edit `src/retell/websocket-handler.ts` around line 360:

```typescript
const ORG_SLUG_MAP: Record<string, string> = {
  'default': '', // Uses getCachedDefaultOrganizationId()
  
  // Add your organizations here:
  'sam-lateeff': 'b445a9c7-af93-4b4a-a975-40d3f44178ec',
  'org-b': 'your-second-org-id-here',
  'clinic-downtown': 'another-org-id',
  'clinic-uptown': 'yet-another-org-id',
};
```

**To find your org IDs:**
```sql
SELECT id, name, slug FROM organizations;
```

Or check in your admin dashboard under Settings.

---

### 2. Deploy Updated WebSocket Server

```powershell
# Deploy to Fly.io
fly deploy --config fly-websocket.toml --dockerfile Dockerfile.websocket --app ascendiaai-websocket

# Or if running locally, restart:
npm run dev:websocket
```

---

### 3. Configure Retell Agents

For each organization, create or update a Retell agent:

#### Organization A (sam.lateeff's Organization):
- **Agent Name:** Ascendia - Org A
- **WebSocket URL:** `wss://ascendiaai-websocket.fly.dev/llm-websocket/sam-lateeff`
- **Webhook URL:** `https://ascendia-booking.fly.dev/api/retell/webhook`

#### Organization B:
- **Agent Name:** Ascendia - Org B
- **WebSocket URL:** `wss://ascendiaai-websocket.fly.dev/llm-websocket/org-b`
- **Webhook URL:** `https://ascendia-booking.fly.dev/api/retell/webhook`

#### Organization C:
- **Agent Name:** Downtown Clinic
- **WebSocket URL:** `wss://ascendiaai-websocket.fly.dev/llm-websocket/clinic-downtown`
- **Webhook URL:** `https://ascendia-booking.fly.dev/api/retell/webhook`

---

### 4. Get Phone Numbers

Purchase a phone number for each org in the Retell dashboard:

1. Go to **Phone Numbers** → **Add Phone Number**
2. Choose your country/area code
3. **Select the agent** for that organization
4. Save

**Result:**
- Phone #1 (+1-555-0100) → Org A Agent → Routes to Org A
- Phone #2 (+1-555-0200) → Org B Agent → Routes to Org B

---

## 🧪 Test It

### Monitor Logs:
```powershell
fly logs --app ascendiaai-websocket -f
```

### Make Test Calls:

**Call Org A's number** → You should see:
```
[Retell WS] Connected for call: abc123 (org slug: sam-lateeff)
[Retell WS] Using org b445a9c7-... from slug 'sam-lateeff'
[Booking API] Request from org: b445a9c7-...
🏥 Auto-filled Op=14 (first active operatory)
```

**Call Org B's number** → You should see:
```
[Retell WS] Connected for call: def456 (org slug: org-b)
[Retell WS] Using org your-second-org-id from slug 'org-b'
[Booking API] Request from org: your-second-org-id
🏥 Auto-filled Op=22 (first active operatory)
```

---

## 📊 What Gets Org-Specific Data?

Each organization now has completely isolated data:

✅ **Providers** - Each org sees only their doctors
✅ **Operatories** - Each org uses their own rooms
✅ **Appointments** - Each org's appointments are separate
✅ **Patients** - Each org's patient list is isolated
✅ **Instructions** - Each org can have custom agent instructions
✅ **Channel Config** - Each org can configure their own settings

---

## 🔄 URL Format Examples

| Format | Example | Organization |
|--------|---------|--------------|
| **Default** | `wss://domain.fly.dev/llm-websocket` | Default (first org) |
| **With call_id** | `wss://domain.fly.dev/llm-websocket/abc123` | Default (backward compatible) |
| **With org slug** | `wss://domain.fly.dev/llm-websocket/org-a` | Organization A |
| **Complete** | `wss://domain.fly.dev/llm-websocket/org-a/abc123` | Organization A (Retell adds call_id automatically) |

**Note:** Retell automatically appends the `:call_id` parameter, so you only configure the base URL with the org slug.

---

## 🎯 Benefits

✅ **One Server** - All orgs use the same WebSocket server (cost-effective)
✅ **Easy Setup** - Just add slug to URL in Retell dashboard
✅ **Scalable** - Add unlimited organizations
✅ **Backward Compatible** - Old URLs still work
✅ **Simple Maintenance** - Update once, applies to all orgs
✅ **Complete Isolation** - Each org's data is separate

---

## 🔐 Security Notes

- Organization IDs in the map are not exposed to clients
- Each org's data is protected by RLS (Row Level Security)
- Slugs are just routing keys, not authentication
- All data queries are org-scoped at the database level

---

## 🆙 Future Enhancement: Dynamic Mapping

Currently, org slugs are hardcoded in `websocket-handler.ts`. 

**Future improvement:** Load from database or environment variables:

```typescript
// Instead of hardcoded map, load from database:
const orgMap = await loadOrgSlugMapFromDatabase();

// Or from environment variables:
const orgMap = JSON.parse(process.env.ORG_SLUG_MAP || '{}');
```

For now, the hardcoded map works great and is easy to update!

---

## 📝 Quick Reference

### Add a New Organization:

1. **Get org ID** from database or admin dashboard
2. **Add to map** in `websocket-handler.ts`:
   ```typescript
   'new-org': 'uuid-for-new-org',
   ```
3. **Deploy** to Fly.io
4. **Create Retell agent** with WebSocket URL:
   ```
   wss://ascendiaai-websocket.fly.dev/llm-websocket/new-org
   ```
5. **Get phone number** and assign to that agent
6. **Test!**

---

## ❓ Troubleshooting

### Issue: Calls still going to default org

**Check:**
1. Is the org slug in the `ORG_SLUG_MAP`?
2. Did you redeploy after adding it?
3. Is the Retell agent using the correct WebSocket URL?

**Verify in logs:**
```
[Retell WS] Connected for call: abc123 (org slug: your-slug)
```

### Issue: "Unknown org slug" warning

**Solution:** The slug in your Retell WebSocket URL doesn't match any key in `ORG_SLUG_MAP`. Add it!

### Issue: Wrong data showing up

**Check:** Is the org ID correct in the map? Query the database:
```sql
SELECT id, name FROM organizations WHERE id = 'your-org-id';
```

---

Last Updated: January 26, 2026

**Status:** ✅ Implemented and ready to use!

Deploy and configure your Retell agents now! 🚀
