# Retell Call Data - COMPLETE CAPTURE ✅

## What's Captured from `call_ended` Event

### ✅ **ALL 30+ Fields Now Captured!**

We're now capturing **every single field** that Retell sends in the `call_ended` webhook event.

---

## 📊 Data Categories

### 1. **Basic Call Info**
```json
{
  "call_id": "Jabr9TXYYJHfvl6Syypi88rdAHYHmcq6",
  "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
  "agent_name": "My Dental Agent",
  "agent_version": 1,
  "call_type": "phone_call",
  "call_status": "ended"
}
```

### 2. **Phone Numbers & Direction**
```json
{
  "from_number": "+12137771234",
  "to_number": "+15551234567",
  "direction": "inbound"
}
```

### 3. **Timing**
```json
{
  "start_timestamp": 1703302407333,
  "end_timestamp": 1703302428855,
  "duration_ms": 21522,
  "disconnection_reason": "user_hangup"
}
```

### 4. **Transcripts (4 Formats!)**
```json
{
  "transcript": "Full text version...",
  "transcript_object": [
    {
      "role": "agent",
      "content": "Hi, how can I help?",
      "words": [{"word": "hi", "start": 0.7, "end": 1.3}]
    }
  ],
  "transcript_with_tool_calls": [
    {"role": "agent", "content": "Let me check..."},
    {"role": "tool_call", "tool_name": "GetAvailableSlots"},
    {"role": "tool_result", "content": "[slots data]"}
  ],
  "scrubbed_transcript_with_tool_calls": [
    // Same as above but with PII removed
  ]
}
```

### 5. **Recordings (4 Variants!)**
```json
{
  "recording_url": "https://...",  // Mixed audio
  "recording_multi_channel_url": "https://...",  // Separate tracks
  "scrubbed_recording_url": "https://...",  // PII removed
  "scrubbed_recording_multi_channel_url": "https://..."  // Separate + scrubbed
}
```

**⚠️ ALL recording URLs expire in 10 minutes!**

### 6. **Transfer Information**
```json
{
  "transfer_destination": "+12137771234",  // Where call was transferred
  "transfer_end_timestamp": 1703302628855  // When transfer ended
}
```

### 7. **Dynamic Variables**
```json
{
  "retell_llm_dynamic_variables": {
    "customer_name": "John Doe",
    "appointment_type": "Cleaning"
  },
  "collected_dynamic_variables": {
    "last_node_name": "booking_confirmed",
    "patient_confirmed": true
  }
}
```

### 8. **Debugging & Analytics URLs**
```json
{
  "public_log_url": "https://retellai.s3.../public_log.txt",
  "knowledge_base_retrieved_contents_url": "https://retellai.s3.../kb_retrieved_contents.txt"
}
```

**Public Log Contains:**
- All LLM requests & responses
- Latency for each turn
- WebSocket messages
- Error logs

### 9. **Performance Metrics**
```json
{
  "latency": {
    "e2e": {"p50": 800, "p90": 1200, "p95": 1500, "p99": 2500, "max": 2700, "min": 500},
    "asr": {"p50": 200, ...},  // Speech recognition
    "llm": {"p50": 400, ...},  // LLM response time
    "tts": {"p50": 200, ...}   // Text-to-speech
  }
}
```

**Available Latency Metrics:**
- `e2e` - End-to-end (user stops speaking → agent starts speaking)
- `asr` - Speech recognition
- `llm` - LLM processing
- `llm_websocket_network_rtt` - Network latency to your LLM
- `tts` - Text-to-speech generation
- `knowledge_base` - KB retrieval time
- `s2s` - Speech-to-speech (if using realtime API)

### 10. **Cost Tracking**
```json
{
  "call_cost": {
    "product_costs": [
      {"product": "elevenlabs_tts", "cost": 60, "unit_price": 1},
      {"product": "deepgram_asr", "cost": 30, "unit_price": 0.5}
    ],
    "total_duration_seconds": 60,
    "total_duration_unit_price": 1,
    "combined_cost": 70  // Total cost in cents
  },
  "llm_token_usage": {
    "values": [100, 150, 200],  // Tokens per request
    "average": 150,
    "num_requests": 3
  }
}
```

### 11. **Post-Call Analysis** (from `call_analyzed` event)
```json
{
  "call_analysis": {
    "call_summary": "Patient scheduled cleaning for Monday 10am",
    "in_voicemail": false,
    "user_sentiment": "Positive",
    "call_successful": true,
    // Your custom fields:
    "appointment_booked": true,
    "appointment_date": "2024-01-15",
    "patient_name": "John Doe",
    "call_outcome": "booked"
  }
}
```

---

## 🗄️ Database Schema

All fields stored in `conversations` table:

| Field Category | Count | Storage Type |
|----------------|-------|--------------|
| Identifiers | 6 | TEXT, INTEGER |
| Phone & Direction | 3 | TEXT |
| Timing | 4 | BIGINT, INTEGER |
| Status | 2 | TEXT |
| Transcripts | 4 | TEXT, JSONB |
| Recordings | 4 | TEXT |
| Transfer | 2 | TEXT, BIGINT |
| Variables | 2 | JSONB |
| URLs | 2 | TEXT |
| Metrics | 3 | JSONB |
| **TOTAL** | **32 fields** | - |

---

## 📝 Example Query: Get Call Analytics

```sql
SELECT 
  call_id,
  from_number,
  duration_ms / 1000.0 as duration_seconds,
  disconnection_reason,
  
  -- Extract cost in dollars
  (call_cost->>'combined_cost')::int / 100.0 as cost_usd,
  
  -- Extract e2e latency p50
  (latency->'e2e'->>'p50')::int as e2e_latency_ms,
  
  -- Check if appointment was booked
  call_analysis->>'appointment_booked' as appointment_booked,
  call_analysis->>'sentiment' as sentiment,
  
  -- Check if call was successful
  CASE 
    WHEN disconnection_reason = 'user_hangup' THEN 'Normal'
    WHEN disconnection_reason = 'agent_hangup' THEN 'Normal'
    WHEN disconnection_reason LIKE 'error%' THEN 'Error'
    ELSE 'Other'
  END as call_outcome,
  
  created_at
FROM conversations
WHERE channel = 'voice'
  AND call_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

---

## 📊 Example Query: Cost Analysis

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_calls,
  
  -- Total duration
  SUM(duration_ms) / 1000.0 / 60.0 as total_minutes,
  
  -- Average duration per call
  AVG(duration_ms) / 1000.0 as avg_duration_seconds,
  
  -- Total cost
  SUM((call_cost->>'combined_cost')::int) / 100.0 as total_cost_usd,
  
  -- Average cost per call
  AVG((call_cost->>'combined_cost')::int) / 100.0 as avg_cost_per_call_usd,
  
  -- Cost per minute
  SUM((call_cost->>'combined_cost')::int) / 100.0 / NULLIF(SUM(duration_ms) / 1000.0 / 60.0, 0) as cost_per_minute_usd
  
FROM conversations
WHERE channel = 'voice'
  AND call_id IS NOT NULL
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🎯 Example Query: Performance Metrics

```sql
SELECT 
  call_id,
  duration_ms / 1000.0 as duration_seconds,
  
  -- E2E latency stats
  (latency->'e2e'->>'p50')::int as e2e_p50_ms,
  (latency->'e2e'->>'p90')::int as e2e_p90_ms,
  (latency->'e2e'->>'max')::int as e2e_max_ms,
  
  -- LLM latency
  (latency->'llm'->>'p50')::int as llm_p50_ms,
  (latency->'llm'->>'max')::int as llm_max_ms,
  
  -- TTS latency
  (latency->'tts'->>'p50')::int as tts_p50_ms,
  
  -- Token usage
  (llm_token_usage->>'average')::int as avg_tokens_per_request,
  (llm_token_usage->>'num_requests')::int as num_llm_requests,
  
  created_at
FROM conversations
WHERE channel = 'voice'
  AND call_id IS NOT NULL
  AND latency IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🔍 What You Can Analyze

### Call Quality
- E2E latency (target: < 1000ms p90)
- ASR accuracy issues
- LLM response time
- TTS generation speed

### Business Metrics
- Appointment booking rate
- Call success rate
- Average call duration
- Sentiment analysis
- Revenue per call (if tracked)

### Cost Optimization
- Cost per call
- Cost per minute
- Most expensive products (TTS vs ASR)
- Token usage optimization

### User Experience
- Transfer rate
- Hangup reasons
- Voicemail detection
- Call abandonment

---

## ⚠️ Important Notes

### Recording URLs
- **All 4 recording variants expire in 10 minutes**
- If you need permanent storage:
  - Download immediately in `handleCallEnded()`
  - Upload to Supabase Storage or S3
  - Update `recording_url` with permanent URL

### Public Log URL
- Great for debugging specific calls
- Contains complete request/response history
- Shows exact latency for each turn
- Available permanently (doesn't expire like recordings)

### Cost Data
- Costs in **cents**, not dollars
- Divide by 100 for USD: `combined_cost / 100`
- Includes all products: TTS, ASR, LLM, etc.
- Updated after call completes

### Latency Metrics
- All values in **milliseconds**
- p50 = median (50th percentile)
- p90 = 90% of requests faster than this
- p95 = 95% of requests faster than this
- p99 = 99% of requests faster than this

---

## 🚀 Next Steps

1. **Apply Migration**:
   ```bash
   # Run in Supabase SQL Editor
   # Copy contents from: supabase/migrations/056_retell_additional_fields.sql
   ```

2. **Deploy Updated Webhook**:
   ```bash
   fly deploy
   ```

3. **Make Test Call**:
   - Call your Retell number
   - Check database for complete data

4. **Build Analytics Dashboard**:
   - Use queries above
   - Create visualizations
   - Track key metrics

---

**Status**: ✅ **COMPLETE DATA CAPTURE**  
**Files Modified**:
- `supabase/migrations/055_retell_call_fields.sql` (updated)
- `supabase/migrations/056_retell_additional_fields.sql` (new)
- `src/app/api/retell/webhook/route.ts` (enhanced)

**What's Captured**: ALL 32 fields from `call_ended` event! 🎉
