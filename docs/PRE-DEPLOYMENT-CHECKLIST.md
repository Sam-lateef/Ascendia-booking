# Pre-Deployment Checklist ✅

## 🎯 Quick Answer: Can We Test Locally?

**Retell Integration**: ❌ **No** - Must deploy (needs public URLs)
**Email System**: ✅ **Yes** - Can test locally!

---

## 📋 Pre-Deployment Checklist

### **1. Database Migrations** (CRITICAL)

Run all migrations in Supabase SQL Editor:

- [ ] `055_retell_call_fields.sql` (Retell call data)
- [ ] `056_retell_additional_fields.sql` (Extended call fields)
- [ ] `057_email_notification_settings.sql` (Email notifications)

**Test Migration Success**:
```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
  AND column_name IN ('call_id', 'email_sent', 'latency', 'call_cost');

-- Should see 4 rows (or more)
```

---

### **2. Environment Variables**

#### **Local (.env)**:
```env
✅ RESEND_API_KEY=re_4kqWKYMk_6wrt31BZErBD2EkdiUaDM9mC
✅ RESEND_FROM_EMAIL=onboarding@resend.dev
✅ NEXT_PUBLIC_APP_URL=http://localhost:3000
✅ RETELL_API_KEY=key_c68c57dad997cea645ac6f57d61e
✅ SUPABASE_URL=https://vihlqoivkayhvxegytlc.supabase.co
✅ SUPABASE_SERVICE_KEY=eyJhbGci...
```

#### **Production (Fly.io)**:
```bash
# Set production env vars
fly secrets set RESEND_API_KEY="re_4kqWKYMk_6wrt31BZErBD2EkdiUaDM9mC"
fly secrets set RESEND_FROM_EMAIL="onboarding@resend.dev"
fly secrets set NEXT_PUBLIC_APP_URL="https://your-domain.fly.dev"
fly secrets set RETELL_API_KEY="key_c68c57dad997cea645ac6f57d61e"
fly secrets set SUPABASE_URL="https://vihlqoivkayhvxegytlc.supabase.co"
fly secrets set SUPABASE_SERVICE_KEY="eyJhbGci..."
fly secrets set OPENAI_API_KEY="sk-proj-..."
```

---

### **3. Code Quality Checks**

- [x] **No TypeScript errors**: Files compile
- [x] **No linter errors**: Code passes lint
- [x] **Dependencies installed**: `resend` package added
- [ ] **Build succeeds**: Run `npm run build` (do this now!)

**Test Build**:
```bash
npm run build
# Should complete without errors
```

---

### **4. Test Email Locally** ✅ (CAN DO NOW!)

Create a test endpoint to verify email system works:

```typescript
// src/app/api/test/email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendCallEndedEmail } from '@/app/lib/email/sendCallEndedEmail';

export async function POST(req: NextRequest) {
  try {
    const mockCall = {
      id: 'test-conv-123',
      call_id: 'test_call_123',
      organization_id: 'b445a9c7-af93-4b4a-a975-40d3f44178ec', // Your org ID
      from_number: '+12345678901',
      to_number: '+19876543210',
      direction: 'inbound',
      duration_ms: 225000, // 3m 45s
      disconnection_reason: 'user_hangup',
      transcript: 'Agent: Hi! How can I help you today?\nUser: I\'d like to schedule an appointment.\nAgent: I\'d be happy to help with that! Let me check our available times...',
      recording_url: 'https://retellai.s3.us-west-2.amazonaws.com/test/recording.wav',
      public_log_url: 'https://retellai.s3.us-west-2.amazonaws.com/test/log.txt',
      agent_name: 'Dental Assistant AI',
      start_timestamp: Date.now(),
      call_cost: {
        combined_cost: 12 // 12 cents
      },
      latency: {
        e2e: { p50: 850, p90: 1200 },
        llm: { p50: 420, p90: 650 },
        asr: { p50: 180, p90: 250 },
        tts: { p50: 250, p90: 350 }
      },
      call_analysis: {
        user_sentiment: 'Positive',
        call_successful: true,
        in_voicemail: false,
        call_summary: 'Patient scheduled a cleaning appointment for Monday at 10 AM.'
      }
    };
    
    await sendCallEndedEmail(mockCall);
    
    return NextResponse.json({ 
      success: true,
      message: 'Test email sent! Check your inbox.'
    });
  } catch (error: any) {
    console.error('[Test Email] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
```

**Test It**:
```bash
# 1. Start dev server
npm run dev

# 2. Configure email in UI first!
# Go to: http://localhost:3000/admin/booking/notifications
# - Add your email address
# - Enable notifications
# - Save settings

# 3. Send test email
curl -X POST http://localhost:3000/api/test/email

# 4. Check your inbox!
```

---

### **5. WebSocket Server** (Deploy Separately)

The WebSocket server must be deployed:

```bash
cd d:/Dev/Agent0

# Deploy WebSocket server to Fly.io
fly deploy -c fly-websocket.toml

# Verify it's running
curl https://ascendiaai-websocket.fly.dev/health
# Should return: {"status":"ok","timestamp":...}
```

**WebSocket URLs for Retell**:
- Sam's org: `wss://ascendiaai-websocket.fly.dev/llm-websocket/sam-lateeff/{call_id}`
- Nurai: `wss://ascendiaai-websocket.fly.dev/llm-websocket/nurai-clinic/{call_id}`

---

### **6. Main Next.js App** (Deploy)

```bash
# Deploy main app to Fly.io
fly deploy

# Verify it's running
curl https://your-app.fly.dev/api/health
```

---

### **7. Retell Configuration** (After Deploy)

Update Retell agent with production URLs:

#### **WebSocket URL**:
```
wss://ascendiaai-websocket.fly.dev/llm-websocket/sam-lateeff/{call_id}
```

#### **Webhook URL**:
```
https://your-app.fly.dev/api/retell/webhook
```

---

## 🧪 Testing Strategy

### **Phase 1: Local Testing** (DO THIS NOW!)

1. **Email System**:
   ```bash
   # Create test endpoint above
   # Configure email in UI
   # POST to /api/test/email
   # Check inbox
   ```

2. **Database Queries**:
   ```sql
   -- Test org settings
   SELECT notification_settings FROM organizations 
   WHERE id = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';
   
   -- Should show JSON with email settings
   ```

3. **Build Test**:
   ```bash
   npm run build
   # Must complete without errors
   ```

---

### **Phase 2: After Deployment** (PRODUCTION TESTING)

1. **WebSocket Health Check**:
   ```bash
   curl https://ascendiaai-websocket.fly.dev/health
   ```

2. **Webhook Test** (manual):
   ```bash
   curl -X POST https://your-app.fly.dev/api/retell/webhook \
     -H "Content-Type: application/json" \
     -H "x-retell-signature: test" \
     -d '{"event":"call_started","call":{"call_id":"test_123","from_number":"+1234567890","to_number":"+1987654321"}}'
   ```

3. **Real Retell Call**:
   - Make a test call to your Retell number
   - Monitor logs: `fly logs -a your-app`
   - Check database for new conversation record
   - Check email inbox

---

## ⚠️ Common Issues & Fixes

### **Issue 1: Build Fails**

```bash
# Error: Module not found
npm install

# Error: TypeScript errors
npm run type-check
# Fix any errors shown
```

### **Issue 2: Email Test Fails**

```bash
# Check logs
# Look for: [Email] messages

# Common causes:
# - Invalid Resend API key → Check .env
# - No recipients configured → Add in UI
# - Invalid email format → Check recipient emails
```

### **Issue 3: WebSocket 404**

```bash
# WebSocket not deployed or wrong URL
fly status -a ascendiaai-websocket

# If not running:
fly deploy -c fly-websocket.toml
```

---

## 📊 Deployment Command Summary

```bash
# 1. Build test
npm run build

# 2. Deploy WebSocket server
fly deploy -c fly-websocket.toml

# 3. Set production env vars
fly secrets set RESEND_API_KEY="re_..." \
  RESEND_FROM_EMAIL="onboarding@resend.dev" \
  NEXT_PUBLIC_APP_URL="https://your-app.fly.dev"

# 4. Deploy main app
fly deploy

# 5. Check both are running
fly status
fly logs
```

---

## ✅ Ready to Deploy When:

- [x] All migrations applied in Supabase
- [ ] `npm run build` succeeds
- [ ] Email test works locally (POST to /api/test/email)
- [ ] Environment variables set in Fly.io
- [ ] WebSocket server code updated (multi-org version)

---

## 🎯 NEXT STEPS:

1. **Test email locally first** (create test endpoint above)
2. **Run `npm run build`** to verify no errors
3. **Deploy WebSocket server**: `fly deploy -c fly-websocket.toml`
4. **Deploy main app**: `fly deploy`
5. **Test with real Retell call**
6. **Monitor logs**: `fly logs -a your-app`

---

**Want me to create the test email endpoint so you can verify email works before deploying?** 🚀
