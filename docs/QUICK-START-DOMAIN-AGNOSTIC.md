# 🚀 Quick Start: Domain-Agnostic Agent Configuration

**Ready in 5 minutes!**

---

## Prerequisites

✅ Build completed successfully  
✅ Database migrations need to be applied  
✅ Server running (`npm run dev`)

---

## Step 1: Apply Database Migrations (30 seconds)

```bash
# Migrations will auto-apply on next Supabase connection
# Or manually run them from Supabase dashboard:
# 1. Go to https://supabase.com/dashboard
# 2. Select your project
# 3. Navigate to SQL Editor
# 4. Run the following migrations in order:
```

Upload these files:
1. `supabase/migrations/20241207_agent_configuration.sql`
2. `supabase/migrations/20241207_seed_booking_config.sql`

---

## Step 2: Start the Server (10 seconds)

```bash
npm run dev
```

Navigate to: `http://localhost:3000`

---

## Step 3: Configure Your Company (2 minutes)

### Go to: `http://localhost:3000/admin/config/company`

**Pre-filled with Barton Dental example. Customize it:**

| Field | Example Value | Description |
|-------|--------------|-------------|
| **Company Name** | Acme CRM | Your business name |
| **System Type** | crm | booking / crm / inventory / custom |
| **Persona Name** | Alex | AI agent's name |
| **Persona Role** | sales assistant | What the AI does |
| **Phone** | (555) 123-4567 | Your business phone |
| **Email** | info@acme.com | Your business email |
| **Address** | 123 Main St | Physical address |

**Business Hours** (click "Add"):
- weekdays: "Monday-Friday: 9 AM - 6 PM"
- saturday: "Saturday: 10 AM - 2 PM"
- sunday: "Closed"

**Services** (click "Add"):
- Lead Generation
- Deal Management  
- Follow-up Scheduling

**Policies** (click "Add"):
- response_time: "We respond within 24 hours"
- availability: "Available M-F 9-6, Sat 10-2"

Click **"Save Changes"** 💾

---

## Step 4: Review & Customize Tools (2 minutes)

### Go to: `http://localhost:3000/admin/config/tools`

**Pre-configured with 9 booking tools.**

### To Add a New Tool:

Click **"Add Tool"**

Example: **Get Contacts (CRM)**

```
Name: GetContacts
Description: Search for contacts by name, email, or phone
Category: contacts
API Route: /api/crm
Is Virtual: [ ] No
Is Active: [x] Yes

Parameters (JSON):
{
  "email": {
    "type": "string",
    "required": false,
    "nullable": true,
    "description": "Email address"
  },
  "phone": {
    "type": "string",
    "required": false,
    "nullable": true,
    "description": "Phone number"
  }
}

Returns Description: Array of contact objects
```

Click **"Save Tool"** 💾

---

## Step 5: Test the Dynamic Agent (30 seconds)

### Go to: `http://localhost:3000/agent-ui`

1. Select mode: **"Premium (Realtime)"**
2. Click **"Connect"**
3. Start talking or typing!

### Check Console Logs:
Look for these messages in browser console:
```
[Lexi Dynamic] 🔄 Loading configuration from database...
[Lexi Dynamic] ✅ Configuration loaded: { company: "Acme CRM", tools: 9, instructions: 5 }
[Lexi Dynamic] 🤖 Creating Realtime Agent with:
  - Instructions: 2847 characters
  - Tools: 9 functions
```

---

## Step 6: Verify It's Working

### The agent should:
- ✅ Introduce itself with YOUR company name
- ✅ Mention YOUR persona name
- ✅ Reference YOUR services
- ✅ Use YOUR configured tools

Example:
> "Hi! Welcome to **Acme CRM**. This is **Alex**. How can I help you today?"

---

## 🎯 Domain-Specific Examples

### For CRM System

**Company Info:**
```
company_name: "Acme Sales"
persona_name: "Alex"
persona_role: "sales assistant"
system_type: "crm"
services: ["Lead Qualification", "Deal Management", "Follow-ups"]
```

**Tools to Add:**
- `GetContacts` → Search contacts
- `CreateLead` → New lead entry
- `GetDeals` → List deals
- `UpdateDealStage` → Move deal in pipeline
- `ScheduleFollowup` → Book follow-up call

### For Inventory System

**Company Info:**
```
company_name: "Warehouse Pro"
persona_name: "Ivy"
persona_role: "inventory assistant"
system_type: "inventory"
services: ["Stock Check", "Order Processing", "Restock Alerts"]
```

**Tools to Add:**
- `GetStock` → Check inventory levels
- `AddProduct` → New product entry
- `UpdateQuantity` → Adjust stock
- `CreatePurchaseOrder` → Order more stock
- `GetLowStock` → Items below threshold

### For E-commerce

**Company Info:**
```
company_name: "ShopEasy"
persona_name: "Ellie"
persona_role: "customer support"
system_type: "ecommerce"
services: ["Order Tracking", "Returns", "Product Search"]
```

**Tools to Add:**
- `GetOrder` → Track order status
- `SearchProducts` → Find products
- `InitiateReturn` → Start return process
- `GetShippingStatus` → Check delivery
- `ApplyDiscount` → Apply promo code

---

## ⚡ Power User Tips

### Tip 1: Template Variables in Instructions
When editing instructions (via API or future UI), use these variables:

```
{company_name} → "Acme CRM"
{persona_name} → "Alex"
{persona_role} → "sales assistant"
{phone} → "(555) 123-4567"
{email} → "info@acme.com"
{address} → "123 Main St"
{hours_weekdays} → "Monday-Friday: 9-6"
{services_list} → "Lead Generation, Deal Management, ..."
```

### Tip 2: Tool Categories
Organize tools by category:
- `contacts` → Contact management
- `deals` → Deal pipeline
- `tasks` → Task management
- `calendar` → Scheduling
- `reports` → Analytics

### Tip 3: Enable/Disable Tools
Toggle `is_active` to enable/disable tools without deleting them.

### Tip 4: Display Order
Use `display_order` to control the order tools appear in agent instructions.

### Tip 5: Cache Refresh
If changes don't appear immediately, wait 1 minute (cache TTL) or restart the server.

---

## 🐛 Common Issues

### Issue: Agent still says "Barton Dental"
**Solution:** Clear browser cache, check database was updated, restart dev server.

### Issue: Tools not working
**Solution:** Verify `api_route` matches your backend route, check tool is `is_active = true`.

### Issue: Agent says "helpful assistant" instead of persona
**Solution:** Check instructions in `agent_instructions` table have `is_active = true`.

### Issue: Console shows "Failed to load config"
**Solution:** Check Supabase connection, verify migrations ran, check `.env` file.

---

## 📚 Next Steps

1. **Customize Instructions** (coming soon - UI under development)
2. **Add Your API Routes** (create `/api/crm`, `/api/inventory`, etc.)
3. **Test Each Tool** individually via the agent
4. **Monitor Logs** in browser console for debugging
5. **Iterate & Improve** based on real conversations

---

## 🎉 You're Done!

Your agent is now **100% configurable** without touching code!

**Need help?** Check `docs/DOMAIN-AGNOSTIC-REFACTOR-COMPLETE.md` for full details.

---

**"From dental booking to enterprise CRM in 5 minutes."** 🚀





























