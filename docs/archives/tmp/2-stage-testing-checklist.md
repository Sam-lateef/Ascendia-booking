# 2-Stage Entity Extraction - Testing Checklist

## ✅ Pre-Implementation Checklist

### 1. Database Migration
```bash
cd supabase
psql $DATABASE_URL < migrations/20231209_entity_optimization.sql
```

**Verify:**
```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'entity_definitions'
AND column_name IN ('used_in_workflows', 'is_core', 'extraction_priority');

-- Should return 3 rows

-- Check core entities
SELECT name, is_core, extraction_priority, used_in_workflows 
FROM entity_definitions 
WHERE is_core = true;

-- Should return: patient_name, phone_number, confirmation

-- Check entities by workflow
SELECT * FROM entities_by_workflow;

-- Should show: book (6 entities), reschedule (5), cancel (4), check (3)
```

---

### 2. Environment Variables
Ensure you have OpenAI API key set:

```bash
# In .env.local
OPENAI_API_KEY=sk-...
```

---

### 3. UI Configuration

Navigate to: `/admin/config/entities`

**Verify:**
1. ✅ New "Optimization Stats" section at top
2. ✅ "Core Entity" checkbox in add form
3. ✅ "Extraction Priority" slider in add form
4. ✅ "Used in Workflows" multi-select in add form
5. ✅ Entity list shows CORE badges
6. ✅ Entity list shows priority levels
7. ✅ Entity list shows workflow tags

**Configure entities:**

```typescript
// Core entities (3)
patient_name: 
  ☑️ Core Entity
  Priority: 1
  Workflows: [all auto-included]

phone_number:
  ☑️ Core Entity
  Priority: 1
  Workflows: [all auto-included]

confirmation:
  ☑️ Core Entity
  Priority: 1
  Workflows: [all auto-included]

// Booking entities (3)
appointment_type:
  ☐ Core Entity
  Priority: 10
  Workflows: [✓ book]

preferred_date:
  ☐ Core Entity
  Priority: 15
  Workflows: [✓ book] [✓ reschedule]

time_preference:
  ☐ Core Entity
  Priority: 15
  Workflows: [✓ book]

// Reschedule entities (2)
new_date:
  ☐ Core Entity
  Priority: 15
  Workflows: [✓ reschedule]

appointment_to_change:
  ☐ Core Entity
  Priority: 10
  Workflows: [✓ reschedule]

// Cancel entities (2)
appointment_to_cancel:
  ☐ Core Entity
  Priority: 10
  Workflows: [✓ cancel]

cancellation_reason:
  ☐ Core Entity
  Priority: 50  // Optional
  Workflows: [✓ cancel]

// Check entities (1)
check_date_range:
  ☐ Core Entity
  Priority: 20
  Workflows: [✓ check]
```

---

## 🧪 Testing Phase

### Test 1: Intent Extraction Only

```typescript
import { extractIntent } from '@/app/lib/workflows/twoStageExtractor';

const result = await extractIntent({
  domainId: 'your-domain-id',
  userMessage: 'I need to book a cleaning',
  conversationHistory: [],
  availableIntents: ['book', 'reschedule', 'cancel', 'check']
});

console.log(result);
```

**Expected:**
```json
{
  "intent": "book",
  "confidence": 0.85,
  "tokens": 198
}
```

**Verify:**
- ✅ Correct intent detected
- ✅ Token count ~200
- ✅ Confidence > 0.7

---

### Test 2: Relevant Entity Loading

```typescript
import { loadRelevantEntities } from '@/app/lib/workflows/optimizedEntityLoader';

const entities = await loadRelevantEntities('domain-id', 'book');

console.log(`Loaded ${entities.length} entities`);
console.log(entities.map(e => e.name));
```

**Expected:**
```
Loaded 6 entities
[
  'patient_name',      // Core
  'phone_number',      // Core
  'confirmation',      // Core
  'appointment_type',  // Workflow-specific
  'preferred_date',    // Workflow-specific
  'time_preference'    // Workflow-specific
]
```

**Verify:**
- ✅ Core entities included (3)
- ✅ Workflow entities included (3)
- ✅ Total ~6 entities (not 50!)
- ✅ No unrelated entities (e.g., cancellation_reason)

---

### Test 3: Full Two-Stage Extraction

```typescript
import { extractWithTwoStages } from '@/app/lib/workflows/twoStageExtractor';

const result = await extractWithTwoStages({
  domainId: 'your-domain-id',
  userMessage: 'I need to book a cleaning next Tuesday morning. My name is John Smith.',
  conversationHistory: [],
  availableIntents: ['book', 'reschedule', 'cancel', 'check']
});

console.log(JSON.stringify(result, null, 2));
```

**Expected:**
```json
{
  "intent": "book",
  "confidence": 0.9,
  "entities": {
    "patient_name": "John Smith",
    "appointment_type": "cleaning",
    "preferred_date": "next Tuesday",
    "time_preference": "morning"
  },
  "reasoning": "User wants to book a cleaning appointment",
  "tokensUsed": {
    "stage1": 201,
    "stage2": 487,
    "total": 688
  }
}
```

**Verify:**
- ✅ Intent correct
- ✅ Entities extracted correctly
- ✅ Total tokens < 800
- ✅ Stage 1 ~200 tokens
- ✅ Stage 2 ~500 tokens
- ✅ **72% reduction vs old approach (2,500 tokens)**

---

### Test 4: Unknown Intent (Fallback)

```typescript
const result = await extractWithTwoStages({
  domainId: 'your-domain-id',
  userMessage: 'What are your office hours?',
  conversationHistory: [],
  availableIntents: ['book', 'reschedule', 'cancel', 'check']
});

console.log(JSON.stringify(result, null, 2));
```

**Expected:**
```json
{
  "intent": "unknown",
  "confidence": 0.3,
  "entities": {
    // Only core entities extracted (3)
  },
  "tokensUsed": {
    "stage1": 185,
    "stage2": 320,  // Fewer entities = fewer tokens
    "total": 505
  }
}
```

**Verify:**
- ✅ Intent = "unknown"
- ✅ Only core entities loaded (3)
- ✅ Total tokens < 600
- ✅ Still works correctly (graceful fallback)

---

### Test 5: Different Workflows

Test each workflow to ensure correct entities are loaded:

```bash
# Book: 6 entities (3 core + 3 workflow)
# Reschedule: 5 entities (3 core + 2 workflow)
# Cancel: 4 entities (3 core + 1 workflow)
# Check: 3 entities (3 core only)
```

```typescript
const workflows = ['book', 'reschedule', 'cancel', 'check'];

for (const workflow of workflows) {
  const entities = await loadRelevantEntities(domainId, workflow);
  console.log(`${workflow}: ${entities.length} entities`);
}
```

**Expected:**
```
book: 6 entities
reschedule: 5 entities
cancel: 4 entities
check: 3 entities
```

---

### Test 6: Cache Performance

```typescript
import { loadRelevantEntities, clearEntityCache } from '@/app/lib/workflows/optimizedEntityLoader';

// First call (database hit)
console.time('first-call');
const entities1 = await loadRelevantEntities(domainId, 'book');
console.timeEnd('first-call');

// Second call (cache hit)
console.time('second-call');
const entities2 = await loadRelevantEntities(domainId, 'book');
console.timeEnd('second-call');

// Clear cache
clearEntityCache();

// Third call (database hit again)
console.time('third-call');
const entities3 = await loadRelevantEntities(domainId, 'book');
console.timeEnd('third-call');
```

**Expected:**
```
first-call: ~150ms   (database query)
second-call: ~1ms    (cache hit - 150x faster!)
third-call: ~150ms   (database query after cache clear)
```

**Verify:**
- ✅ Cache hit is significantly faster
- ✅ Cache expires after 1 minute
- ✅ clearEntityCache() works

---

## 📊 Performance Benchmarks

### Before (Single-Stage)

```typescript
// Old approach: Load all entities
const allEntities = await loadAllEntities(domainId);
console.log(`Loaded ${allEntities.length} entities`);

// Build schema and extract
const result = await validateIntent({
  domainId,
  userMessage: 'I need to book a cleaning',
  conversationHistory: [],
  availableIntents: ['book', 'reschedule', 'cancel', 'check']
});

console.log(`Tokens used: ${result.tokensUsed}`);
```

**Expected:**
```
Loaded 50 entities
Tokens used: 2,487
```

### After (Two-Stage)

```typescript
const result = await extractWithTwoStages({
  domainId,
  userMessage: 'I need to book a cleaning',
  conversationHistory: [],
  availableIntents: ['book', 'reschedule', 'cancel', 'check']
});

console.log(`Tokens used: ${result.tokensUsed.total}`);
console.log(`Savings: ${Math.round((1 - result.tokensUsed.total / 2487) * 100)}%`);
```

**Expected:**
```
Tokens used: 688
Savings: 72%
```

---

## 🚨 Edge Cases to Test

### 1. No Entities Found
```typescript
const result = await extractWithTwoStages({
  domainId,
  userMessage: 'Hello',  // No extractable entities
  conversationHistory: [],
  availableIntents: ['book', 'reschedule', 'cancel', 'check']
});
```

**Expected:** Empty entities object, no errors

---

### 2. Database Failure
```typescript
// Temporarily break database connection
process.env.SUPABASE_URL = 'invalid';

const result = await extractWithTwoStages({...});

// Should fall back to hardcoded core entities
```

**Expected:** Uses fallback entities, no crash

---

### 3. Entity Added via UI
```typescript
// 1. Add new entity via UI: "insurance_provider"
// 2. Tag it to "book" workflow
// 3. Clear cache
clearEntityCache();

// 4. Load entities for book
const entities = await loadRelevantEntities(domainId, 'book');

// 5. Verify new entity included
console.log(entities.find(e => e.name === 'insurance_provider'));
```

**Expected:** New entity immediately available after cache clear

---

## ✅ Success Criteria

All tests must pass:

- [✓] Migration applied successfully
- [✓] New columns exist in database
- [✓] Core entities marked correctly
- [✓] Workflow entities tagged correctly
- [✓] UI shows optimization stats
- [✓] Intent extraction works (~200 tokens)
- [✓] Entity loading filters correctly (6-8 entities not 50)
- [✓] Full extraction works (~700 tokens total)
- [✓] Unknown intent falls back to core entities
- [✓] Cache improves performance (150x faster)
- [✓] Edge cases handled gracefully
- [✓] **72% token reduction achieved**

---

## 📈 Monitoring (Post-Launch)

### Daily Checks (First Week)

```sql
-- Avg tokens per extraction (should be ~700)
SELECT AVG(tokens_used) as avg_tokens
FROM extraction_logs
WHERE created_at > NOW() - INTERVAL '1 day';

-- Token distribution by workflow
SELECT 
  workflow,
  AVG(tokens_used) as avg_tokens,
  COUNT(*) as extraction_count
FROM extraction_logs
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY workflow;

-- Entities extracted but never used
SELECT 
  e.name,
  e.used_in_workflows,
  COUNT(DISTINCT el.extraction_id) as times_extracted
FROM entity_definitions e
LEFT JOIN extraction_entity_logs el ON el.entity_id = e.id
WHERE el.created_at > NOW() - INTERVAL '7 days'
  OR el.extraction_id IS NULL
GROUP BY e.id
HAVING COUNT(DISTINCT el.extraction_id) = 0;
```

**Target Metrics:**
- Avg tokens: 600-800 (vs 2,500 before)
- Cost per call: $0.0003-0.0004 (vs $0.00125 before)
- Cache hit rate: > 50%
- Extraction accuracy: > 95%

---

## 🎯 Next Steps After Testing

1. ✅ Run all tests above
2. ✅ Verify 72% token reduction
3. ✅ Deploy to staging
4. ✅ A/B test for 1 week
5. ✅ Monitor metrics
6. ✅ Roll out to production
7. ✅ Celebrate savings! 🎉

---

**Questions? Issues?**

Refer to:
- `docs/entity-extraction-optimization.md` - Full documentation
- `tmp/2-stage-entity-extraction-summary.md` - Implementation summary
- `docs/entity-flow-diagram.md` - Updated flow with optimization

**Common Issues:**
- Migration fails → Check if columns already exist
- UI doesn't show new fields → Hard refresh browser (Ctrl+Shift+R)
- Cache not working → Verify `clearEntityCache()` called after updates
- Token count still high → Check if entities tagged correctly





















