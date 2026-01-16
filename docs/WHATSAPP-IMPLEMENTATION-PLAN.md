# WhatsApp Integration - Complete Implementation Plan

**Purpose:** Replicate the WhatsApp integration from Ascendia to another application

**Last Updated:** January 16, 2026

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Components Breakdown](#components-breakdown)
4. [Database Schema](#database-schema)
5. [File Structure](#file-structure)
6. [Dependencies](#dependencies)
7. [Environment Variables](#environment-variables)
8. [Implementation Steps](#implementation-steps)
9. [Testing Checklist](#testing-checklist)
10. [Deployment Considerations](#deployment-considerations)
11. [Cost Analysis](#cost-analysis)

---

## Architecture Overview

### High-Level Flow

```
WhatsApp User
    ↓ (sends message)
WhatsApp Business API
    ↓
EvolutionAPI (self-hosted middleware)
    ↓ (webhook)
Your App: /api/webhooks/whatsapp
    ↓
Message Handler (AI Processing)
    ↓
OpenAI GPT-4o (with function calling)
    ↓
Function Execution (findProducts, createLead, searchKnowledgeBase)
    ↓
EvolutionAPI (send response)
    ↓
WhatsApp User receives AI response
```

### Key Components

1. **Evolution API** - Self-hosted WhatsApp middleware (replaces official WhatsApp Business API)
2. **Database Tables** - Store instances, conversations, messages
3. **Webhook Handler** - Receive and process incoming messages
4. **Message Handler** - AI processing with GPT-4o
5. **Evolution Client** - API wrapper for Evolution API
6. **Admin Interface** - Manage instances, view QR codes, monitor conversations

### Why Evolution API?

- **Free & Open Source** - No WhatsApp Business API fees
- **QR Code Connection** - Easy setup (scan QR like WhatsApp Web)
- **Full Features** - Text, images, documents, buttons, lists
- **Self-Hosted** - You control the infrastructure
- **Active Development** - Well-maintained, good docs

---

## Prerequisites

### Required Services

1. **Evolution API Instance**
   - Self-hosted (Docker, EasyPanel, or VPS)
   - Public URL with HTTPS
   - API key configured
   - Version: v2.x (current stable)

2. **OpenAI Account**
   - API key with GPT-4o access
   - Billing enabled
   - Cost: ~$0.02 per 10-message conversation

3. **Database**
   - PostgreSQL (via Supabase or direct)
   - pgvector extension (for semantic search)
   - RLS policies supported (if multi-tenant)

4. **Your Application**
   - Next.js 14+ (or any Node.js framework)
   - Public URL with HTTPS (for webhooks)
   - TypeScript recommended

### Existing System Requirements

Your application should already have:
- Organization/tenant system
- Product/catalog management
- Conversation logging (or you'll create it)
- Lead capture system (or you'll create it)

---

## Components Breakdown

### 1. Database Schema (3 Tables + Helpers)

**Tables:**
- `whatsapp_instances` - WhatsApp phone numbers per organization
- `whatsapp_conversations` - Maps WhatsApp chats to conversation records
- `whatsapp_messages` - Raw message audit trail

**Functions:**
- `get_or_create_whatsapp_conversation()` - Session continuity
- `update_whatsapp_instance_stats()` - Auto-update message counts

**Triggers:**
- Auto-update stats on message insert
- Updated_at timestamp triggers

**Views:**
- `whatsapp_instance_summary` - Stats dashboard

### 2. Evolution API Client

**Purpose:** TypeScript wrapper for Evolution API

**Key Methods:**
- **Instance Management:** create, connect, logout, restart, delete
- **Webhook Config:** setWebhook, getWebhook
- **Send Messages:** sendTextMessage, sendImage, sendDocument, sendButtons, sendList
- **Message Status:** markMessageAsRead, sendTyping, sendPresence
- **Utilities:** formatPhoneNumber, checkNumberExists, getProfilePicture

**Features:**
- Error handling with custom EvolutionAPIError class
- Automatic phone number formatting (adds @s.whatsapp.net)
- Request logging
- Singleton pattern

### 3. Webhook Handler

**Route:** `/api/webhooks/whatsapp`

**Events Handled:**
- `messages.upsert` → Process incoming messages
- `connection.update` → Update instance status
- `qrcode.updated` → Store QR code in database

**Security:**
- API key validation (header or body)
- Instance verification against database
- Ignore outbound messages (fromMe: true)
- Ignore group messages (for now)

**Flow:**
1. Receive webhook
2. Validate API key
3. Get instance from database
4. Get/create conversation mapping
5. Pass to message handler
6. Return 200 OK

### 4. Message Handler

**Purpose:** AI processing of incoming WhatsApp messages

**Architecture:**
- Uses GPT-4o (full model, not mini)
- Function calling enabled (4 functions)
- Conversation history (last 20 messages)
- Product card sending (images + formatted text)
- Typing indicator support

**AI Functions Available:**
1. `findProducts` - Category/tag filtering
2. `searchProducts` - Semantic search
3. `createLead` - Capture contact info
4. `searchKnowledgeBase` - FAQs and policies

**Process:**
1. Extract message text
2. Send typing indicator
3. Store incoming message
4. Get conversation history
5. Build AI prompt with supervisor instructions
6. Call OpenAI with function calling
7. Execute functions if called
8. Call OpenAI again with function results
9. Send product cards (if any)
10. Send text response
11. Store outgoing message

### 5. Admin Interface

**Route:** `/admin/whatsapp`

**Features:**
- Auto-create instance on first visit
- Display QR code for connection
- Show instance status (connected, qr_code, disconnected, failed)
- Stats cards (messages sent/received, active conversations)
- Action buttons (refresh QR, restart, disconnect)
- Debug info panel
- Real-time status updates

**User Flow:**
1. Admin visits page
2. System auto-creates instance if none exists
3. QR code displayed
4. Admin scans with WhatsApp
5. Status updates to "connected"
6. Start receiving messages

### 6. Supporting API Routes

**Admin Routes:**
- `POST /api/admin/whatsapp/create-instance` - Create new instance
- `GET /api/admin/whatsapp/instances` - List all instances
- `POST /api/admin/whatsapp/[id]/refresh-qr` - Get new QR code
- `POST /api/admin/whatsapp/[id]/restart` - Restart instance
- `POST /api/admin/whatsapp/[id]/disconnect` - Logout instance
- `POST /api/admin/whatsapp/[id]/configure-webhook` - Update webhook

**Public Routes:**
- `POST /api/webhooks/whatsapp` - Receive Evolution API webhooks
- `GET /api/webhooks/whatsapp` - Health check

### 7. Helper Utilities

**Formatters** (`lib/whatsapp/formatters.ts`):
- `formatProductCard()` - Format product for WhatsApp (image + caption)
- `formatProductList()` - Format multiple products as text list
- `formatContactInfo()` - Format contact details

**Features:**
- WhatsApp markdown support (*bold*, _italic_, ~strikethrough~)
- Emoji inclusion
- Price formatting
- Character limits (WhatsApp caption max: 1024 chars)

---

## Database Schema

### File Location
`supabase/migrations/042_whatsapp_integration.sql`

### Tables Overview

#### 1. whatsapp_instances

```sql
CREATE TABLE whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Evolution API details
  instance_name TEXT NOT NULL UNIQUE,
  instance_id TEXT,
  phone_number TEXT,
  phone_number_formatted TEXT,
  
  -- Connection
  status TEXT DEFAULT 'disconnected' CHECK (status IN (...)),
  qr_code TEXT,
  qr_code_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  
  -- Config
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  agent_config JSONB DEFAULT '{}'::JSONB,
  greeting_message TEXT,
  away_message TEXT,
  
  -- Stats
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  conversations_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `instance_name` - Unique identifier (e.g., "acme-whatsapp")
- `status` - Connection state for UI
- `qr_code` - Base64 QR image
- `phone_number` - Populated after QR scan
- Stats auto-increment via trigger

#### 2. whatsapp_conversations

```sql
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_instance_id UUID NOT NULL REFERENCES whatsapp_instances(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- WhatsApp identifiers
  remote_jid TEXT NOT NULL, -- "1234567890@s.whatsapp.net"
  contact_name TEXT,
  contact_push_name TEXT,
  
  -- Session
  is_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMPTZ,
  
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(whatsapp_instance_id, remote_jid, is_active)
);
```

**Purpose:** Maps WhatsApp chat IDs to your conversation system

#### 3. whatsapp_messages

```sql
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_instance_id UUID NOT NULL,
  whatsapp_conversation_id UUID,
  organization_id UUID NOT NULL,
  conversation_message_id UUID,
  
  -- Message details
  message_id TEXT,
  remote_jid TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  
  -- Content
  message_type TEXT DEFAULT 'text',
  text_content TEXT,
  media_url TEXT,
  caption TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  
  -- Raw data
  raw_payload JSONB,
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Audit trail + debugging

#### Helper Function

```sql
CREATE FUNCTION get_or_create_whatsapp_conversation(
  p_instance_id UUID,
  p_remote_jid TEXT,
  p_org_id UUID,
  p_contact_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
  -- Returns conversation_id (creates if doesn't exist)
$$;
```

**Usage:** Called by webhook handler to maintain session continuity

---

## File Structure

### Required Files to Copy/Create

```
your-app/
├── supabase/migrations/
│   └── 042_whatsapp_integration.sql          [COPY - Database schema]
│
├── app/lib/
│   ├── evolution/
│   │   ├── EvolutionClient.ts                [COPY - API wrapper]
│   │   └── types.ts                          [COPY - TypeScript types]
│   │
│   └── whatsapp/
│       ├── messageHandler.ts                 [COPY & ADAPT - AI processing]
│       └── formatters.ts                     [COPY - Message formatting]
│
├── app/api/
│   ├── webhooks/whatsapp/
│   │   └── route.ts                          [COPY - Webhook receiver]
│   │
│   └── admin/whatsapp/
│       ├── create-instance/route.ts          [COPY - Create instance]
│       ├── instances/route.ts                [COPY - List instances]
│       └── [instanceId]/
│           ├── refresh-qr/route.ts           [COPY - Get QR code]
│           ├── restart/route.ts              [COPY - Restart instance]
│           ├── disconnect/route.ts           [COPY - Logout instance]
│           └── configure-webhook/route.ts    [COPY - Update webhook]
│
└── app/admin/whatsapp/
    └── page.tsx                              [COPY & ADAPT - Admin UI]
```

### Files to Adapt (Not Copy Directly)

**messageHandler.ts** - Needs adaptation for:
- Your product/catalog system structure
- Your conversation logging system
- Your lead capture system
- Your knowledge base system
- Your instruction building system

**page.tsx** - Needs adaptation for:
- Your admin layout/navigation
- Your organization context system
- Your UI component library (if not shadcn/ui)

---

## Dependencies

### NPM Packages Required

```json
{
  "dependencies": {
    "openai": "^4.20.0",          // OpenAI API client
    // These you likely already have:
    "@supabase/supabase-js": "^2.x",
    "next": "^14.x",
    "react": "^18.x",
    "typescript": "^5.x"
  }
}
```

### Install Command

```bash
npm install openai
```

### UI Components (if using shadcn/ui)

```bash
npx shadcn-ui@latest add card button badge dialog select toast
```

**Or use your existing UI library**

---

## Environment Variables

### Required Variables

```env
# Evolution API Configuration
EVOLUTION_API_URL=https://your-evolution-api-domain.com
EVOLUTION_API_KEY=your-api-key-here

# Your App URL (for webhooks)
NEXT_PUBLIC_APP_URL=https://your-app-domain.com

# OpenAI API Key (for AI processing)
OPENAI_API_KEY=sk-your-openai-key-here

# Database (if not already set)
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Where to Add

- **Development:** `.env.local`
- **Production:** Your hosting platform's environment variables
  - Vercel: Project Settings → Environment Variables
  - Railway: Project → Variables
  - Fly.io: `fly secrets set KEY=value`

---

## Implementation Steps

### Phase 1: Database Setup (30 minutes)

**1. Run Migration**

```bash
# If using Supabase CLI
npx supabase db push

# Or manually in Supabase SQL Editor
# Copy content from 042_whatsapp_integration.sql and run
```

**2. Verify Tables Created**

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'whatsapp%';

-- Should return:
-- whatsapp_instances
-- whatsapp_conversations
-- whatsapp_messages
```

**3. Verify Function Created**

```sql
-- Test helper function
SELECT get_or_create_whatsapp_conversation(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'test@s.whatsapp.net',
  (SELECT id FROM organizations LIMIT 1),
  'Test User'
);
```

**4. Check RLS Policies**

```sql
-- View policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'whatsapp%';
```

### Phase 2: Evolution API Client (1 hour)

**1. Create Directory Structure**

```bash
mkdir -p app/lib/evolution
```

**2. Copy Files**

Copy these files from Ascendia to your app:
- `app/lib/evolution/EvolutionClient.ts`
- `app/lib/evolution/types.ts`

**3. No Changes Needed**

These files are framework-agnostic and can be used as-is.

**4. Test Connection**

Create a test script:

```typescript
// test-evolution.ts
import { EvolutionClient } from './app/lib/evolution/EvolutionClient';

const client = new EvolutionClient({
  baseUrl: process.env.EVOLUTION_API_URL!,
  apiKey: process.env.EVOLUTION_API_KEY!,
});

async function test() {
  try {
    // Test connection by fetching an instance (will 404 if none exist, but proves connection works)
    const result = await client.getInstance('test-instance');
    console.log('✅ Evolution API connected');
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log('✅ Evolution API connected (no instance yet)');
    } else {
      console.error('❌ Evolution API error:', error);
    }
  }
}

test();
```

Run: `npx tsx test-evolution.ts`

### Phase 3: Webhook Handler (1 hour)

**1. Copy Webhook Route**

Copy from Ascendia:
```
app/api/webhooks/whatsapp/route.ts
```

**2. Verify Supabase Import**

Make sure this line matches your setup:
```typescript
import { getSupabaseAdmin } from '@/app/lib/supabase';
```

**3. Deploy & Test Webhook Endpoint**

```bash
# Deploy to production (webhooks need public URL)
# Vercel: git push
# Fly.io: fly deploy

# Test health check
curl https://your-app.com/api/webhooks/whatsapp

# Should return:
# {"status":"ok","service":"whatsapp-webhook","timestamp":"..."}
```

**4. Test with Evolution API**

```bash
# Send test webhook
curl -X POST https://your-app.com/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_EVOLUTION_API_KEY" \
  -d '{
    "event": "messages.upsert",
    "instance": "test",
    "data": {
      "key": {
        "remoteJid": "1234567890@s.whatsapp.net",
        "fromMe": false,
        "id": "test123"
      },
      "messageType": "conversation",
      "message": {
        "conversation": "Hello!"
      },
      "messageTimestamp": 1234567890,
      "pushName": "Test User"
    },
    "date_time": "2026-01-16T12:00:00Z",
    "server_url": "https://evolution-api.com",
    "apikey": "YOUR_KEY"
  }'
```

Expected: 404 (instance not found) - This is correct! Webhook works, instance doesn't exist yet.

### Phase 4: Message Handler (2-3 hours)

**🚨 THIS REQUIRES ADAPTATION - Not direct copy!**

**1. Copy Base File**

```
app/lib/whatsapp/messageHandler.ts → Your app
```

**2. Adapt Imports**

Update these to match your app structure:
```typescript
import { getSupabaseAdmin } from '../supabase';
import { getEvolutionClient } from '../evolution/EvolutionClient';
import { buildSupervisorInstructions, loadSystemDefaults, getSuperAdminOrgId } from '../baseInstructions';
import { getFunctionRegistry } from '../functionRegistry';
import { formatProductCard, formatProductList, formatContactInfo } from './formatters';
```

**3. Adapt AI Instructions**

Your app may have different instruction building:

```typescript
// OPTION A: Use your existing instruction system
const aiInstructions = await yourInstructionBuilder({
  organizationId,
  includeProducts: true,
  includeKnowledgeBase: true,
});

// OPTION B: Create simple instructions
const aiInstructions = `
You are a helpful AI assistant for ${orgName}.

Available Functions:
- findProducts(categories, tags) - Find products
- searchProducts(query) - Search products semantically
- createLead(name, email, phone, interests) - Capture leads
- searchKnowledgeBase(query) - Search FAQs

Always be helpful, friendly, and professional.
If asked about products, use findProducts or searchProducts.
If user provides contact info, use createLead.
If asked questions, use searchKnowledgeBase.
`;
```

**4. Adapt Function Implementations**

Update these methods to call YOUR API endpoints:

```typescript
private async findProducts(organizationId: string, args: any) {
  // YOUR product finding logic here
  const products = await yourProductService.find({
    organizationId,
    categories: args.categories,
    tags: args.tags,
  });
  
  return {
    success: true,
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      image: p.primaryImage,
      // ... your product fields
    })),
  };
}

private async createLead(organizationId: string, args: any, context: any) {
  // YOUR lead capture logic here
  const lead = await yourLeadService.create({
    organizationId,
    name: args.name,
    email: args.email || `${context.remoteJid.replace('@s.whatsapp.net', '')}@whatsapp.placeholder`,
    phone: args.phone || context.remoteJid.replace('@s.whatsapp.net', ''),
    source: 'whatsapp',
    notes: args.notes,
  });
  
  return { success: true, leadId: lead.id };
}

private async searchKnowledgeBase(organizationId: string, args: any) {
  // YOUR knowledge base search here
  // OR return empty if you don't have one yet:
  return {
    success: true,
    results: [],
    message: 'No knowledge base configured yet',
  };
}
```

**5. Copy Formatters**

Copy `formatters.ts` as-is - it's generic and works for any product structure.

**6. Test Message Handler**

Create test script:

```typescript
// test-message-handler.ts
import { getWhatsAppMessageHandler } from './app/lib/whatsapp/messageHandler';

const handler = getWhatsAppMessageHandler();

async function test() {
  const context = {
    instanceId: 'test-instance-id',
    instanceName: 'test-instance',
    organizationId: 'your-org-id',
    remoteJid: '1234567890@s.whatsapp.net',
    contactName: 'Test User',
    conversationId: 'test-conv-id',
    whatsappConversationId: 'test-wa-conv-id',
  };

  const messageData: any = {
    key: {
      remoteJid: '1234567890@s.whatsapp.net',
      fromMe: false,
      id: 'test123',
    },
    messageType: 'conversation',
    message: {
      conversation: 'Hello! Show me your products.',
    },
    messageTimestamp: Date.now(),
    pushName: 'Test User',
  };

  const result = await handler.processIncomingMessage(context, messageData);
  console.log('Result:', result);
}

test();
```

### Phase 5: Admin Interface (2 hours)

**1. Copy Admin Page**

```
app/admin/whatsapp/page.tsx → Your app
```

**2. Adapt UI Components**

If not using shadcn/ui, replace with your components:

```typescript
// Change from:
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// To your components:
import { Card, Button } from '@your-ui-library';
```

**3. Adapt Organization Context**

Update how you get current organization:

```typescript
// Ascendia uses:
const response = await fetch('/api/admin/current-org');
const data = await response.json();
const orgId = data.organization?.id;

// Your app might use:
const { currentOrg } = useOrganization(); // Context hook
const orgId = currentOrg.id;

// Or:
const session = await getServerSession();
const orgId = session.user.organizationId;
```

**4. Test Admin Interface**

1. Start dev server: `npm run dev`
2. Navigate to `/admin/whatsapp`
3. Should see "Creating WhatsApp instance..." or instance list
4. Check browser console for errors

### Phase 6: Admin API Routes (1 hour)

**Copy these files from Ascendia:**

```
app/api/admin/whatsapp/
├── create-instance/route.ts
├── instances/route.ts
└── [instanceId]/
    ├── refresh-qr/route.ts
    ├── restart/route.ts
    ├── disconnect/route.ts
    └── configure-webhook/route.ts
```

**Verify imports match your setup:**
```typescript
import { getSupabaseAdmin } from '@/app/lib/supabase';
import { getEvolutionClient } from '@/app/lib/evolution/EvolutionClient';
```

**No other changes needed** - these are generic

### Phase 7: End-to-End Testing (1 hour)

**1. Create WhatsApp Instance**

Visit `/admin/whatsapp` → Should auto-create instance

**2. Scan QR Code**

- QR code displayed on page
- Open WhatsApp on phone
- Settings → Linked Devices → Link a Device
- Scan QR code
- Wait for status to change to "Connected"

**3. Send Test Message**

Send to your WhatsApp number:
```
Hello!
```

**4. Verify AI Response**

Should receive automatic AI greeting

**5. Test Product Search**

```
Show me your products
```

Should receive:
- AI response
- Product cards with images (if products exist)

**6. Test Lead Capture**

```
My name is John Smith and I'm interested in your services
```

Should:
- Capture lead in database
- Receive confirmation message

**7. Check Database**

```sql
-- Verify message logged
SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT 5;

-- Verify conversation created
SELECT * FROM whatsapp_conversations ORDER BY created_at DESC LIMIT 5;

-- Verify lead captured
SELECT * FROM leads WHERE source = 'whatsapp' ORDER BY created_at DESC LIMIT 5;
```

### Phase 8: Production Deployment (30 minutes)

**1. Add Environment Variables**

Add to your production environment:
```
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

**2. Deploy Application**

```bash
# Vercel
git push

# Railway
railway up

# Fly.io
fly deploy
```

**3. Update Webhook URL**

In Evolution API, update webhook to production URL:
```bash
curl -X POST https://your-evolution-api.com/webhook/instance/your-instance \
  -H "apikey: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-production-app.com/api/webhooks/whatsapp",
    "webhook_by_events": false,
    "events": ["QRCODE_UPDATED", "MESSAGES_UPSERT", "CONNECTION_UPDATE"]
  }'
```

**4. Test Production**

Send message to your WhatsApp number → Verify AI responds

**5. Monitor Logs**

- Application logs (Vercel/Railway/Fly.io dashboard)
- Evolution API logs (Docker/EasyPanel)
- Database logs (Supabase)

---

## Testing Checklist

### Unit Tests

- [ ] Evolution API client connects
- [ ] Webhook endpoint responds to health check
- [ ] Database functions work (`get_or_create_whatsapp_conversation`)
- [ ] Message handler processes text messages
- [ ] Formatters create valid WhatsApp messages

### Integration Tests

- [ ] Create instance via admin interface
- [ ] QR code generated and displayed
- [ ] Scan QR code and connect
- [ ] Instance status updates to "connected"
- [ ] Send test message → AI responds
- [ ] Product search returns results
- [ ] Lead capture saves to database
- [ ] Message history logged correctly
- [ ] Stats update correctly (messages sent/received)

### User Acceptance Tests

- [ ] Non-technical user can scan QR code and connect
- [ ] AI responses are helpful and accurate
- [ ] Product cards display correctly in WhatsApp
- [ ] Images load in WhatsApp
- [ ] Lead capture works without errors
- [ ] Conversation flows naturally
- [ ] Admin can monitor conversations
- [ ] Admin can disconnect/restart instance

### Performance Tests

- [ ] AI responds within 3-5 seconds
- [ ] Handles 10 simultaneous conversations
- [ ] Handles 100+ messages per hour
- [ ] No memory leaks after 1000 messages
- [ ] Database queries optimized (< 100ms)

### Security Tests

- [ ] Webhook validates API key
- [ ] RLS policies prevent cross-organization access
- [ ] Sensitive data not logged
- [ ] OpenAI API key not exposed
- [ ] Evolution API key not exposed

---

## Deployment Considerations

### Evolution API Hosting

**Option 1: EasyPanel (Recommended)**
- One-click install
- Auto-updates
- Built-in monitoring
- Cost: ~$5-15/month (VPS)

**Option 2: Docker**
```bash
docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=your-key-here \
  -e DATABASE_CONNECTION_URI=postgresql://... \
  atendai/evolution-api:latest
```

**Option 3: VPS Manual Install**
- Clone Evolution API repo
- Install Node.js 18+
- Install PostgreSQL
- Configure nginx reverse proxy
- Setup SSL with Let's Encrypt

### Webhook Reliability

**Challenge:** Webhooks can fail (network issues, timeouts)

**Solution: Implement Retry Logic**

In your webhook handler:
```typescript
// Return 200 OK quickly, process in background
export async function POST(request: NextRequest) {
  const event = await request.json();
  
  // Queue for background processing
  await queueWebhookProcessing(event);
  
  // Return immediately
  return NextResponse.json({ status: 'queued' });
}
```

Use a job queue (BullMQ, Inngest, or similar)

### Scaling Considerations

**Single Instance:** Handles 100-500 conversations/day

**Multiple Instances:**
- Each WhatsApp number = separate instance
- Each organization can have 1+ instances
- No limit on total instances

**Database Scaling:**
- Supabase Free tier: Up to 500MB database
- Messages table grows ~1KB per message
- 500MB = ~500,000 messages
- Archive old messages after 90 days

**OpenAI Costs:**
- ~$0.02 per 10-message conversation
- 1,000 conversations = $20/month
- Budget accordingly

### Monitoring & Alerts

**What to Monitor:**
1. Webhook response time (should be < 500ms)
2. AI response time (should be < 5s)
3. OpenAI API errors
4. Evolution API connection status
5. Message delivery failures
6. Database connection pool saturation

**Tools:**
- Sentry (error tracking)
- LogRocket (session replay)
- Datadog (APM)
- Uptime Robot (uptime monitoring)

**Critical Alerts:**
- Evolution API disconnected
- Webhook endpoint down
- OpenAI API errors > 10/hour
- Database connection errors

### Backup Strategy

**Database:**
- Daily automated backups (Supabase includes)
- Keep 30 days of backups
- Test restore procedure monthly

**Evolution API Data:**
- Instance configurations backed up
- QR codes are temporary (don't need backup)
- Message history in your database (primary source of truth)

### Disaster Recovery

**Evolution API Goes Down:**
1. WhatsApp messages will queue
2. Deploy new Evolution API instance
3. Restore instance configurations
4. Reconnect via QR code
5. Messages resume

**Database Goes Down:**
1. Evolution API continues running
2. Messages lost during outage (if not queued)
3. Restore database from backup
4. Conversations resume with new messages

**Your App Goes Down:**
1. Evolution API will retry webhooks
2. Messages queued for 24 hours
3. After 24 hours, messages lost
4. Deploy backup app instance ASAP

---

## Cost Analysis

### Development Costs

- **Time to Implement:** 8-12 hours (one developer)
- **Complexity:** Medium
- **Maintenance:** 1-2 hours/month

### Infrastructure Costs

**Evolution API:**
- Self-hosted VPS: $5-15/month (Digital Ocean, Hetzner)
- EasyPanel: $10/month (includes management UI)

**OpenAI API:**
- GPT-4o: ~$0.02 per 10-message conversation
- 1,000 conversations/month: $20
- 10,000 conversations/month: $200

**Database (Supabase):**
- Free tier: $0 (up to 500MB, 2GB bandwidth)
- Pro tier: $25/month (8GB database, 50GB bandwidth)

**Your App Hosting:**
- Already covered (existing infrastructure)

**Total Monthly Cost:**
- Low volume (100 conversations): ~$7-20/month
- Medium volume (1,000 conversations): ~$40-60/month
- High volume (10,000 conversations): ~$230-260/month

### Cost Comparison

**WhatsApp Business API (Official):**
- Setup fee: $0
- Per conversation: $0.005-0.04 (varies by country)
- Marketing messages: $0.01-0.15
- 1,000 conversations: $5-40/month
- **BUT:** Requires Meta Business verification, complex approval process

**WhatsApp + Voice Agent (Ascendia):**
- Voice realtime: $3.60 per 5-minute conversation
- 1,000 conversations: $3,600/month
- **WhatsApp is 99% cheaper!** 🎉

---

## FAQ

### Q: Do I need a WhatsApp Business account?

**A:** No! Evolution API uses regular WhatsApp Web protocol. Just scan QR with your personal or business WhatsApp.

### Q: Can I use the same WhatsApp number for multiple organizations?

**A:** No. Each WhatsApp number can only be linked to one Evolution API instance at a time.

### Q: What happens if Evolution API goes down?

**A:** Messages will queue in WhatsApp for 24 hours. After that, they're lost. Deploy redundant Evolution API instances if uptime is critical.

### Q: Can I send rich media (videos, PDFs)?

**A:** Yes! Evolution API supports text, images, documents, audio, video, stickers, location, contacts, buttons, and lists.

### Q: How do I handle multiple languages?

**A:** Update your AI instructions to include multi-language support. GPT-4o natively supports 50+ languages. Detect user language and respond accordingly.

### Q: Can I use this for WhatsApp groups?

**A:** Yes, but requires additional logic. Currently, the integration ignores group messages. To enable:
1. Remove the group filter in webhook handler
2. Update message handler to track group context
3. Handle @mentions
4. Manage permissions (who can command the bot)

### Q: How do I prevent spam/abuse?

**A:** Implement rate limiting:
```typescript
// In message handler
const messageCount = await countMessagesInLast24Hours(remoteJid);
if (messageCount > 50) {
  await sendTextMessage(instance, remoteJid, {
    text: "You've reached the daily message limit. Please try again tomorrow.",
  });
  return { success: true };
}
```

### Q: Can I integrate with my existing CRM?

**A:** Yes! In the `createLead` function, add webhooks to your CRM:

```typescript
private async createLead(organizationId: string, args: any, context: any) {
  // Save to your database
  const lead = await yourLeadService.create({...});
  
  // Send to CRM (HubSpot, Salesforce, etc.)
  await fetch('https://api.yourcrm.com/leads', {
    method: 'POST',
    body: JSON.stringify({
      name: args.name,
      email: args.email,
      phone: args.phone,
      source: 'whatsapp',
    }),
  });
  
  return { success: true, leadId: lead.id };
}
```

---

## Next Steps After Implementation

1. **Add Analytics Dashboard**
   - Message volume graphs
   - Response time metrics
   - Popular questions/products
   - Conversion rates

2. **Implement Advanced Features**
   - Button messages (quick replies)
   - List messages (dropdown menus)
   - Carousel messages (product galleries)
   - Automated follow-ups
   - Business hours handling

3. **Optimize AI Prompts**
   - A/B test different instructions
   - Monitor conversation quality
   - Collect user feedback
   - Iterate on product recommendations

4. **Add Multi-Language Support**
   - Detect user language
   - Translate instructions
   - Use multilingual embeddings

5. **Create Onboarding Flow**
   - Welcome message with capabilities
   - Quick start guide
   - Product catalog overview
   - Contact options

---

## Support & Resources

### Documentation

- **Evolution API:** https://doc.evolution-api.com/
- **OpenAI Function Calling:** https://platform.openai.com/docs/guides/function-calling
- **WhatsApp Business API:** https://developers.facebook.com/docs/whatsapp/

### Community

- **Evolution API Discord:** https://discord.gg/evolution-api
- **Evolution API GitHub:** https://github.com/EvolutionAPI/evolution-api

### Troubleshooting

**Issue: Webhook not receiving messages**
- Check webhook URL is publicly accessible (HTTPS)
- Verify API key matches
- Check Evolution API logs
- Test webhook with curl

**Issue: AI not responding**
- Check OpenAI API key
- Verify organization has products
- Check conversation history loading
- Review OpenAI API errors in logs

**Issue: QR code not working**
- QR codes expire after 1 minute
- Refresh QR code
- Ensure phone has internet connection
- Try restarting Evolution API instance

**Issue: Instance disconnects frequently**
- Check Evolution API server resources (RAM, CPU)
- Verify stable internet connection
- Update Evolution API to latest version
- Check WhatsApp phone battery saver settings

---

## Conclusion

You now have a complete implementation plan for replicating the WhatsApp integration!

**Estimated Time:**
- Initial setup: 8-12 hours
- Testing & refinement: 2-4 hours
- Deployment: 1-2 hours
- **Total: 11-18 hours**

**Complexity Level:** Medium

**Skills Required:**
- TypeScript/JavaScript
- Next.js API routes
- PostgreSQL
- REST APIs
- Basic DevOps (environment variables, deployment)

**Success Criteria:**
- WhatsApp number connected
- AI responds to messages within 5 seconds
- Product search works correctly
- Lead capture saves to database
- Admin interface functional
- Production-ready (monitoring, error handling, logging)

**Good luck with your implementation!** 🚀📱

---

*Created: January 16, 2026*  
*Based on: Ascendia WhatsApp Integration*  
*Evolution API Version: v2.x*
