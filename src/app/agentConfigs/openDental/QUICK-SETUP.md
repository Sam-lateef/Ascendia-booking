# ⚡ Quick Setup - OpenDental Voice Agent

## 🚀 5-Minute Setup with Real Test Database

### Step 1: Create `.env` File
Copy this into your `.env` file at the project root:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-key-here

# OpenDental - Real Test Database
OPENDENTAL_MOCK_MODE=false
OPENDENTAL_API_BASE_URL=https://api.opendental.com/api/v1
OPENDENTAL_API_KEY=ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z
```

### Step 2: Start Server
```bash
npm run dev
```

### Step 3: Test
1. Open `http://localhost:3000`
2. Select **"openDental"** from scenario dropdown
3. Click **"Start Session"**
4. Try: **"Can you look up patients in the database?"**

**🎉 You're now connected to real OpenDental test data!**

---

## 🧪 Alternative Test Credential

If the first credential doesn't work, try the StreamLineIQ credential:

```bash
OPENDENTAL_API_KEY=ODFHIR ekwr82TdcQVdz5dk/0ZkfiFtiCMMoOdrl
```

---

## 🎯 Test These Commands

### Basic Lookups
- "What patients do we have in the system?"
- "Can you look up patient John Doe?"
- "Show me the list of providers"

### Appointments
- "What appointments do we have today?"
- "I need to schedule a cleaning"
- "Show me available appointment slots"

### Insurance & Billing
- "What insurance does patient [name] have?"
- "Check the balance for patient [name]"
- "What claims do we have pending?"

### Office Info (works offline too)
- "What are your office hours?"
- "Where are you located?"
- "What services do you offer?"

---

## 🔄 Switch Back to Mock Mode

To test without hitting the real API:

```bash
OPENDENTAL_MOCK_MODE=true
# Comment out or remove OPENDENTAL_API_KEY and OPENDENTAL_API_BASE_URL
```

---

## 📚 Full Documentation

- **Complete Setup:** `TEST-CREDENTIALS.md`
- **System Documentation:** `README.md`
- **Quick Start Guide:** `/docs/OPENDENTAL-QUICKSTART.md`

---

## ⚠️ Important Notes

- These are **test credentials** - safe to use for development
- Real patient data may exist in test database
- Do NOT use these credentials in production
- `.env` is gitignored - your credentials stay private

---

## 🐛 Troubleshooting

**"401 Unauthorized"**
→ Make sure you included the full string starting with "ODFHIR "

**"Cannot read properties"**
→ Set `OPENDENTAL_MOCK_MODE=false`

**No response**
→ Check internet connection, API might be down

**Still stuck?**
→ Set `OPENDENTAL_MOCK_MODE=true` and test with mock data first

---

## ✅ Checklist

- [ ] `.env` file created in project root
- [ ] `OPENAI_API_KEY` is set
- [ ] `OPENDENTAL_MOCK_MODE=false`
- [ ] `OPENDENTAL_API_KEY` starts with "ODFHIR "
- [ ] Server restarted (`npm run dev`)
- [ ] Selected "openDental" scenario in UI
- [ ] Tested basic patient lookup

**All checked? You're ready to go!** 🎊









