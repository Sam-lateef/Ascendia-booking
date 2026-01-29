# Retell Organization Mapping

Current organization mappings for WebSocket endpoints.

Last Updated: January 26, 2026

---

## 📋 Active Organizations

| Organization | Slug | WebSocket URL | Org ID |
|--------------|------|---------------|---------|
| **Test Clinic A** | `test-a` | `wss://ascendiaai-websocket.fly.dev/llm-websocket/test-a` | `1c26bf4a-2575-45e3-82eb-9f58c899e2e7` |
| **Nurai Clinic** | `nurai-clinic` | `wss://ascendiaai-websocket.fly.dev/llm-websocket/nurai-clinic` | `660d9ca6-b200-4c12-9b8d-af0a470d8b88` |
| **Default Organization** | `default-org` | `wss://ascendiaai-websocket.fly.dev/llm-websocket/default-org` | `00000000-0000-0000-0000-000000000001` |
| **admin's Organization** | `admin` | `wss://ascendiaai-websocket.fly.dev/llm-websocket/admin` | `9aa626ad-9a3e-4a79-a959-dda0a0b8b983` |
| **sam.lateeff's Organization** | `sam-lateeff` | `wss://ascendiaai-websocket.fly.dev/llm-websocket/sam-lateeff` | `b445a9c7-af93-4b4a-a975-40d3f44178ec` |

---

## 🎯 Retell Agent Configuration

### For Each Organization:

1. **Create a Retell Agent** in the Retell dashboard
2. **Configure WebSocket URL** using the URL from the table above
3. **Set Webhook URL**: `https://ascendia-booking.fly.dev/api/retell/webhook`
4. **Get a Phone Number** and assign it to that agent

### Example: Test Clinic A

**Retell Agent Settings:**
- **Name:** Test Clinic A - Voice Agent
- **Voice:** Choose your preference (e.g., Daphne, Nova)
- **LLM Type:** Custom LLM (WebSocket)
- **WebSocket URL:** `wss://ascendiaai-websocket.fly.dev/llm-websocket/test-a`
- **Webhook URL:** `https://ascendia-booking.fly.dev/api/retell/webhook`
- **Response Latency:** Low
- **Interruption Sensitivity:** Medium

**Get Phone Number:**
1. Retell Dashboard → Phone Numbers → Add Phone Number
2. Select your agent: "Test Clinic A - Voice Agent"
3. Purchase number

**Result:** Calls to that number will route to Test Clinic A's:
- Providers
- Operatories
- Appointments
- Patient records

---

## 🔄 Updating Organizations

### To Add a New Organization:

1. **Get the org details** from database:
   ```sql
   SELECT id, name, slug FROM organizations WHERE id = 'new-org-id';
   ```

2. **Update the map** in `src/retell/websocket-handler.ts`:
   ```typescript
   const ORG_SLUG_MAP: Record<string, string> = {
     // ... existing orgs ...
     'new-org-slug': 'new-org-id-here',
   };
   ```

3. **Redeploy WebSocket server:**
   ```powershell
   fly deploy --config fly-websocket.toml --dockerfile Dockerfile.websocket --app ascendiaai-websocket
   ```

4. **Create Retell agent** with new WebSocket URL

5. **Update this document** with the new org

---

## 🧪 Testing

### Verify Routing for Each Org:

```powershell
# Monitor logs
fly logs --app ascendiaai-websocket -f

# Make test call to each organization's number
# Look for these logs:
```

**Expected Log Output:**
```
[Retell WS] Connected for call: abc123 (org slug: test-a)
[Retell WS] Using org 1c26bf4a-... from slug 'test-a'
[Retell WS] Channel config loaded for call abc123
[Booking API] Request from org: 1c26bf4a-...
```

### Test Different Organizations:

Call each number and verify:
- ✅ Correct org ID in logs
- ✅ Correct providers listed
- ✅ Correct operatories used
- ✅ Appointments saved to correct org

---

## 📊 Organization Data Isolation

Each organization has completely separate:

| Data Type | Isolation | Example |
|-----------|-----------|---------|
| **Providers** | Per org | Test Clinic A sees only their doctors |
| **Operatories** | Per org | Nurai Clinic uses their own rooms |
| **Appointments** | Per org | sam.lateeff's appointments are separate |
| **Patients** | Per org | Each org has their own patient list |
| **Phone Numbers** | Per org | Each org's Retell number routes correctly |
| **Instructions** | Per org | Custom agent instructions per org |
| **Channel Config** | Per org | Different settings per org |

---

## 🔐 Security Notes

- Organization IDs are not exposed to end users
- All database queries are org-scoped via RLS
- Slugs are just routing keys (not authentication)
- Each org can only access their own data
- Phone numbers can be mapped to specific orgs (future enhancement)

---

## 📞 Phone Number Assignment (Future)

Once you set up the `phone_numbers` table (migration `054_phone_number_org_mapping.sql`):

```sql
-- Example: Map phone numbers to organizations
INSERT INTO phone_numbers (phone_number, organization_id, channel, friendly_name) VALUES
  ('+15551234567', '1c26bf4a-2575-45e3-82eb-9f58c899e2e7', 'retell', 'Test Clinic A - Main'),
  ('+15559876543', '660d9ca6-b200-4c12-9b8d-af0a470d8b88', 'retell', 'Nurai Clinic - Support'),
  ('+15555551234', 'b445a9c7-af93-4b4a-a975-40d3f44178ec', 'retell', 'Sam - Main Line');
```

This will enable automatic routing by phone number instead of manual slug assignment.

---

## 📝 Maintenance Checklist

- [ ] Deploy WebSocket server with updated ORG_SLUG_MAP
- [ ] Create Retell agent for each organization
- [ ] Get phone number for each organization
- [ ] Test calls to each number
- [ ] Verify correct org routing in logs
- [ ] Verify data isolation (providers, appointments, etc.)
- [ ] Document phone numbers assigned to each org
- [ ] Set up phone_numbers table for automatic routing (optional)

---

## 🆘 Troubleshooting

### Issue: Calls Going to Wrong Org

**Check:**
1. Verify org slug in Retell WebSocket URL
2. Check `ORG_SLUG_MAP` has correct org ID
3. Confirm WebSocket server was redeployed
4. Look at logs to see which org was selected

**Debug Command:**
```powershell
fly logs --app ascendiaai-websocket | Select-String "org slug"
```

### Issue: "Unknown org slug" Warning

**Solution:** The slug doesn't exist in `ORG_SLUG_MAP`. Add it and redeploy.

### Issue: Old Organization Showing Up

**Check:** Did you redeploy after updating the map?
```powershell
fly deploy --app ascendiaai-websocket
```

---

## 🔄 Sync from Database

To keep this mapping in sync with your database:

```sql
-- Get all organizations with their mapping info
SELECT 
  id,
  name,
  slug,
  CONCAT('wss://ascendiaai-websocket.fly.dev/llm-websocket/', slug) as websocket_url
FROM organizations
ORDER BY created_at;
```

---

Last Updated: January 26, 2026

**Next Steps:**
1. Redeploy WebSocket server
2. Create Retell agents for each org
3. Test with phone calls
4. Celebrate! 🎉
