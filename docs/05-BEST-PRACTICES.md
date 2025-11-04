# Best Practices & Troubleshooting

## Writing Effective Agent Instructions

### Keep Instructions Voice-Optimized

❌ **Bad (Text-optimized):**
```
Here are the available products:
- Product A: $99.99 (features: X, Y, Z)
- Product B: $149.99 (features: A, B, C)
- Product C: $199.99 (features: D, E, F)
```

✅ **Good (Voice-optimized):**
```
We have three main products. Product A at ninety-nine dollars is great for beginners, 
Product B at one forty-nine is our most popular, and Product C at one ninety-nine 
has all the premium features. Which sounds most interesting?
```

### Use Concrete Examples

❌ **Bad (Vague):**
```
Be professional and helpful.
```

✅ **Good (Specific):**
```
# Example Interaction
User: "What's my bill?"
Assistant: "Let me check that for you." [calls tool]
Assistant: "Your current bill is $47.82, due on March 15th."
```

### Define Clear Boundaries

❌ **Bad (Implicit):**
```
You're a helpful assistant for our telco company.
```

✅ **Good (Explicit):**
```
# Capabilities
- Check account balances
- Update contact information
- Schedule service appointments

# Limitations
- You CANNOT process payments (escalate to human)
- You CANNOT cancel accounts (escalate to billing)
- You CANNOT provide technical support (transfer to tech agent)
```

## State Machine Pattern Best Practices

### Structure for Data Collection

```typescript
instructions: `
# Conversation States
[
  {
    "id": "1_greeting",
    "description": "Warm greeting",
    "examples": ["Hello! How can I help you today?"],
    "transitions": [{"next_step": "2_collect_phone"}]
  },
  {
    "id": "2_collect_phone",
    "description": "Request phone number",
    "instructions": [
      "Ask for phone number",
      "Repeat back digit by digit for confirmation",
      "If corrected, confirm AGAIN"
    ],
    "examples": [
      "May I have your phone number?",
      "You said 2-0-6-5-5-5-1-2-3-4, correct?"
    ],
    "transitions": [{"next_step": "3_collect_dob"}]
  },
  ...
]
`
```

### Always Confirm Sensitive Data

```typescript
// Character-by-character confirmation
"You said 4-5-6-7-8-9-0-1-2-3, is that correct?"

// Not just:
"Your phone number is 456-789-0123, right?"
```

## Tool Design Best Practices

### Single Responsibility

❌ **Bad (Does too much):**
```typescript
const userOperations = tool({
  name: 'userOperations',
  parameters: {
    operation: { enum: ['get', 'update', 'delete'] },
    userId: { type: 'string' },
    updateData: { type: 'object' },
  },
  // Complex logic handling multiple operations
});
```

✅ **Good (Focused):**
```typescript
const getUserInfo = tool({ name: 'getUserInfo', ... });
const updateUserInfo = tool({ name: 'updateUserInfo', ... });
const deleteUser = tool({ name: 'deleteUser', ... });
```

### Validate Parameters

```typescript
execute: async (input) => {
  const { phoneNumber } = input as { phoneNumber: string };
  
  // Validate format
  if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(phoneNumber)) {
    return { 
      error: 'Invalid phone number format',
      expected: '(123) 456-7890'
    };
  }
  
  // Proceed with logic
  return await lookupUser(phoneNumber);
}
```

### Return Structured Data

❌ **Bad (Unstructured):**
```typescript
return "User John Doe, age 35, lives in Seattle";
```

✅ **Good (Structured):**
```typescript
return {
  success: true,
  user: {
    name: 'John Doe',
    age: 35,
    city: 'Seattle',
  },
};
```

## Performance Optimization

### Minimize Supervisor Calls (Chat-Supervisor Pattern)

**Expand the Chat Agent's Allow List:**
```typescript
# Allow List of Permitted Actions
## Information the chat agent can provide directly:
- Business hours: Monday-Friday 8AM-6PM
- Store locations: List our 3 locations
- Basic product categories: Mention our 5 main categories
- Return policy summary: "30-day returns with receipt"

## Everything else → getNextResponseFromSupervisor
```

### Use Appropriate Models

```typescript
// For chat agent (handles 70% of interactions)
model: 'gpt-4o-mini-realtime'  // Cheaper, still capable

// For supervisor (handles complex 30%)
model: 'gpt-4.1-mini'  // Good balance of cost/quality

// For high-stakes decisions only
model: 'o4-mini'  // Reasoning model, slower but more accurate
```

### Avoid Iterative Tool Calls

❌ **Bad (Supervisor calls multiple tools sequentially):**
```typescript
// Supervisor logic that requires 4 round trips:
1. lookupUser(phone)
2. getAccountBalance(userId)
3. getBillingHistory(userId)
4. formatResponse(data)
```

✅ **Good (Single comprehensive tool):**
```typescript
const getUserFullProfile = tool({
  name: 'getUserFullProfile',
  // Returns everything in one call
  execute: async ({ phone }) => {
    const user = await lookupUser(phone);
    const balance = await getAccountBalance(user.id);
    const history = await getBillingHistory(user.id);
    
    return { user, balance, history };
  },
});
```

## Latency Reduction Strategies

### Use Filler Phrases

```typescript
// Chat agent says this BEFORE calling slow supervisor
"Let me check that for you."        // ~1 second
"Give me just a moment."            // ~1 second
"I'll look into that right now."    // ~1 second

// Then calls getNextResponseFromSupervisor
// User perceives lower latency
```

### Streaming Responses (Future Enhancement)

Currently, supervisor responses are not streamed. For better UX:
```typescript
// Future: Stream supervisor response as it's generated
// Agent can start speaking before full response is complete
```

### Preload Common Data

```typescript
// Load frequently accessed data at startup
const PRELOADED_STORE_LOCATIONS = [...];
const PRELOADED_BUSINESS_HOURS = {...};

// Chat agent can answer instantly without tool calls
```

## Common Issues & Solutions

### Issue: "Autoplay blocked by browser"

**Symptom:** No audio plays when agent speaks

**Solution:** Already handled in code
```typescript
audioElement.autoplay = true;
audioElement.play().catch((err) => {
  console.warn("Autoplay blocked, user interaction required");
});
```

**User action required:** Click anywhere on page to enable audio

### Issue: WebRTC connection fails

**Symptoms:**
- Session stays in "CONNECTING" status
- Console errors about peer connection

**Solutions:**
1. Check `OPENAI_API_KEY` is valid
2. Verify `/api/session` returns ephemeral key
3. Check browser console for WebRTC errors
4. Try different browser (Chrome/Edge recommended)

### Issue: Tool calls not working

**Symptom:** Agent says it will call tool but nothing happens

**Solutions:**
1. Ensure agent is root in `initialAgents` array
   ```typescript
   // Wrong: wrong agent is first
   const agents = [salesAgent, authAgent];
   
   // Correct: current agent is first
   const idx = agents.findIndex(a => a.name === selectedAgentName);
   const [agent] = agents.splice(idx, 1);
   agents.unshift(agent);
   ```

2. Check tool is in agent's `tools` array
3. Verify tool parameters match schema

### Issue: Handoff not working

**Symptom:** Agent says it will transfer but doesn't

**Solutions:**
1. Ensure target agent is in `handoffs` array
2. Check handoff is bidirectional if needed
3. Reconnect after changing selected agent:
   ```typescript
   disconnectFromRealtime();
   setSelectedAgentName(newAgent);
   // useEffect will trigger reconnection
   ```

### Issue: Guardrail not triggering

**Symptom:** Inappropriate content gets through

**Solutions:**
1. Check guardrail is in `outputGuardrails` array
2. Verify `/api/responses` endpoint works
3. Test guardrail classifier independently:
   ```typescript
   const result = await runGuardrailClassifier("test text", "CompanyName");
   console.log(result);
   ```

### Issue: Transcription shows "[inaudible]"

**Symptoms:**
- User speech not transcribed properly
- Frequent [inaudible] markers

**Solutions:**
1. Check microphone permissions
2. Reduce background noise
3. Speak more clearly / closer to microphone
4. Try PTT mode instead of VAD
5. Adjust VAD threshold:
   ```typescript
   turn_detection: {
     threshold: 0.8,  // Lower = more sensitive (default: 0.9)
     silence_duration_ms: 700,  // Wait longer for user to finish
   }
   ```

## Cost Optimization

### Monitor Token Usage

```typescript
// Add to useRealtimeSession event handler:
session.on("response.done", (event: any) => {
  const usage = event.usage;
  console.log('Tokens used:', {
    input: usage?.input_tokens,
    output: usage?.output_tokens,
    total: usage?.total_tokens,
  });
});
```

### Batch Requests

For supervisor pattern, batch related queries:
```typescript
// Instead of 3 separate supervisor calls:
getNextResponseFromSupervisor("get balance")
getNextResponseFromSupervisor("get due date")
getNextResponseFromSupervisor("check past due")

// Single call:
getNextResponseFromSupervisor("provide complete billing summary")
```

### Cache Static Content

```typescript
// Cache policy documents, FAQs, etc.
const policyCache = new Map<string, any>();

function lookupPolicyDocument(topic: string) {
  if (policyCache.has(topic)) {
    return policyCache.get(topic);
  }
  
  const result = expensiveLookup(topic);
  policyCache.set(topic, result);
  return result;
}
```

## Security Best Practices

### Never Expose API Keys Client-Side

✅ **Correct:** Ephemeral keys only
```typescript
// api/session/route.ts (server-side)
headers: {
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
}
```

❌ **Wrong:** Never do this
```typescript
// Client-side - NEVER DO THIS
const apiKey = 'sk-...';  // Exposed in browser!
```

### Validate All Tool Inputs

```typescript
execute: async (input) => {
  const { userId } = input as { userId: string };
  
  // Validate format
  if (!/^[a-zA-Z0-9-]+$/.test(userId)) {
    throw new Error('Invalid user ID format');
  }
  
  // Check authorization (your logic)
  if (!await userHasAccess(userId)) {
    throw new Error('Unauthorized access');
  }
  
  return await getData(userId);
}
```

### Sanitize User Inputs

```typescript
function sanitizeInput(text: string): string {
  return text
    .replace(/<script>/gi, '')  // Remove scripts
    .replace(/javascript:/gi, '')  // Remove javascript: URLs
    .trim();
}
```

## Testing Strategies

### Test Different Scenarios

```bash
# Test basic handoff
1. Open simpleHandoff scenario
2. Say "I want a haiku"
3. Verify transfer to haikuWriter

# Test Chat-Supervisor
1. Open chatSupervisor scenario
2. Ask complex question
3. Verify supervisor is called
4. Check response quality

# Test Guardrails
1. Trigger guardrail (say something offensive)
2. Verify guardrail_tripped event
3. Check agent rephrases
```

### Monitor Event Logs

Enable the Events panel to see:
- All client/server events
- Tool call payloads
- Guardrail triggers
- Handoff events

### Test Error Handling

```typescript
// Simulate tool failure
execute: async () => {
  throw new Error('Database unavailable');
}

// Verify agent handles gracefully:
// "I'm sorry, I'm having trouble accessing that information right now."
```

## Production Deployment Checklist

- [ ] Environment variables set properly
- [ ] Guardrails configured and tested
- [ ] Error handling for all tools
- [ ] Rate limiting on API routes
- [ ] Logging for debugging
- [ ] Analytics tracking (optional)
- [ ] Load testing completed
- [ ] Fallback mechanisms for service outages
- [ ] User feedback collection mechanism

## Additional Resources

- [Overview](./01-OVERVIEW.md) - System overview
- [Architecture](./02-ARCHITECTURE.md) - Technical architecture
- [Components](./03-COMPONENTS.md) - Component details
- [Extending](./04-EXTENDING.md) - Customization guide
- [Official OpenAI Realtime Agents Repo](https://github.com/openai/openai-realtime-agents)

