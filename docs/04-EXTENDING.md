# Extending the Application

## Adding a New Agent Scenario

### Step 1: Create Agent Configuration File

Create a new file in `src/app/agentConfigs/`:

```typescript
// src/app/agentConfigs/myScenario.ts
import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';

// Define your agent
export const myAgent = new RealtimeAgent({
  name: 'myAgent',
  voice: 'sage', // or 'alloy', 'echo', 'shimmer'
  
  instructions: `
You are a helpful assistant that...

# Tone
- Be friendly and professional
- Keep responses concise for voice

# Capabilities
- You can call the searchDatabase tool
- You can transfer to a human agent

# Restrictions
- Never make up information
- Always cite sources when available
  `,
  
  tools: [
    // Add tools here (see below)
  ],
  
  handoffs: [
    // Add handoff agents here (see below)
  ],
  
  handoffDescription: 'Agent that does XYZ',
});

export const myScenario = [myAgent];
export default myScenario;
```

### Step 2: Register in Agent Registry

```typescript
// src/app/agentConfigs/index.ts
import { myScenario } from './myScenario';

export const allAgentSets: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
  myScenario: myScenario, // Add this line
};
```

### Step 3: Access Your Scenario

Navigate to: `http://localhost:3000?agentConfig=myScenario`

Or select "myScenario" from the Scenario dropdown.

## Creating Custom Tools

### Basic Tool Example

```typescript
import { tool } from '@openai/agents/realtime';
import { z } from 'zod';

const searchDatabase = tool({
  name: 'searchDatabase',
  description: 'Searches the product database for items matching a query',
  
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      category: {
        type: 'string',
        enum: ['electronics', 'clothing', 'food'],
        description: 'Product category to search within',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  
  execute: async (input, details) => {
    const { query, category, maxResults = 10 } = input as {
      query: string;
      category?: string;
      maxResults?: number;
    };
    
    // Your tool logic here
    const results = await yourDatabaseSearch(query, category, maxResults);
    
    return {
      success: true,
      results: results,
      count: results.length,
    };
  },
});
```

### Tool with Access to Conversation History

```typescript
const analyzeConversation = tool({
  name: 'analyzeConversation',
  description: 'Analyzes the conversation sentiment',
  
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  
  execute: async (input, details) => {
    // Access conversation history
    const history = (details?.context as any)?.history ?? [];
    
    // Filter to just user messages
    const userMessages = history.filter(
      (item: any) => item.type === 'message' && item.role === 'user'
    );
    
    // Analyze sentiment (your logic here)
    const sentiment = analyzeSentiment(userMessages);
    
    return { sentiment };
  },
});
```

### Tool with Custom Context

```typescript
// In App.tsx, when connecting:
await connect({
  getEphemeralKey: async () => EPHEMERAL_KEY,
  initialAgents: reorderedAgents,
  audioElement: sdkAudioElement,
  extraContext: {
    userId: '12345',
    sessionId: 'abc-def',
    customData: { foo: 'bar' },
  },
});

// In your tool:
execute: async (input, details) => {
  const userId = (details?.context as any)?.userId;
  const customData = (details?.context as any)?.customData;
  
  console.log('User ID:', userId); // '12345'
  console.log('Custom:', customData.foo); // 'bar'
  
  return { success: true };
}
```

### Tool that Calls External APIs

```typescript
const getWeather = tool({
  name: 'getWeather',
  description: 'Gets current weather for a location',
  
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name or zip code',
      },
    },
    required: ['location'],
    additionalProperties: false,
  },
  
  execute: async (input) => {
    const { location } = input as { location: string };
    
    try {
      const response = await fetch(
        `https://api.weather.com/v1/current?location=${location}&apiKey=${process.env.WEATHER_API_KEY}`
      );
      
      if (!response.ok) {
        return { error: 'Failed to fetch weather data' };
      }
      
      const data = await response.json();
      
      return {
        temperature: data.temp,
        conditions: data.conditions,
        humidity: data.humidity,
      };
    } catch (error) {
      return { error: 'Weather service unavailable' };
    }
  },
});
```

## Implementing Agent Handoffs

### Simple Handoff Setup

```typescript
// Define specialist agents
const salesAgent = new RealtimeAgent({
  name: 'sales',
  voice: 'sage',
  instructions: 'Help customers with purchases and product info',
  tools: [/* sales tools */],
  handoffs: [], // Will be populated
  handoffDescription: 'Handles sales inquiries',
});

const supportAgent = new RealtimeAgent({
  name: 'support',
  voice: 'sage',
  instructions: 'Help customers with technical issues',
  tools: [/* support tools */],
  handoffs: [],
  handoffDescription: 'Handles technical support',
});

// Main routing agent
const routerAgent = new RealtimeAgent({
  name: 'router',
  voice: 'sage',
  instructions: `
Greet the customer and determine their need:
- If they want to buy something → transfer to sales
- If they have a technical issue → transfer to support
  `,
  tools: [],
  handoffs: [salesAgent, supportAgent],
  handoffDescription: 'Routes customers to the right department',
});

// Setup bidirectional handoffs
(salesAgent.handoffs as any).push(supportAgent, routerAgent);
(supportAgent.handoffs as any).push(salesAgent, routerAgent);

export const myScenario = [routerAgent, salesAgent, supportAgent];
```

### Handoff with State Transfer

The SDK automatically includes conversation history when transferring.
To pass additional state, use the conversation context:

```typescript
const collectInfo = tool({
  name: 'collectCustomerInfo',
  description: 'Collects customer information before transfer',
  
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      issue: { type: 'string' },
    },
    required: ['name', 'email', 'issue'],
  },
  
  execute: async (input, details) => {
    // Store in context (the next agent will have access)
    return {
      customerInfo: input,
      collectedAt: new Date().toISOString(),
    };
  },
});
```

## Creating Custom Guardrails

### Simple Content Filter

```typescript
export function createCustomGuardrail() {
  return {
    name: 'custom_guardrail',
    
    async execute({ agentOutput, agent, context }) {
      // Check for banned words
      const bannedWords = ['competitor', 'lawsuit', 'bankruptcy'];
      const lowerOutput = agentOutput.toLowerCase();
      
      const triggered = bannedWords.some(word => lowerOutput.includes(word));
      
      if (triggered) {
        return {
          tripwireTriggered: true,
          outputInfo: {
            reason: 'Contains banned content',
            offendingText: agentOutput,
          },
        };
      }
      
      return {
        tripwireTriggered: false,
        outputInfo: { status: 'passed' },
      };
    },
  };
}

// Use in App.tsx:
const guardrail = createCustomGuardrail();

await connect({
  // ...
  outputGuardrails: [guardrail],
});
```

### AI-Powered Guardrail

```typescript
export function createSentimentGuardrail() {
  return {
    name: 'sentiment_guardrail',
    
    async execute({ agentOutput }) {
      // Call your AI service
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          input: [
            {
              type: 'message',
              role: 'user',
              content: `Analyze the sentiment of this message. Reply with POSITIVE, NEGATIVE, or NEUTRAL:\n\n"${agentOutput}"`,
            },
          ],
        }),
      });
      
      const data = await response.json();
      const sentiment = data.output?.[0]?.content?.[0]?.text?.trim();
      
      // Block overly negative responses
      if (sentiment === 'NEGATIVE') {
        return {
          tripwireTriggered: true,
          outputInfo: { sentiment },
        };
      }
      
      return {
        tripwireTriggered: false,
        outputInfo: { sentiment },
      };
    },
  };
}
```

## Customizing the Chat-Supervisor Pattern

### Modify Chat Agent Allow List

```typescript
// In agentConfigs/chatSupervisor/index.ts

// Add to the "Allow List of Permitted Actions" section:
# Allow List of Permitted Actions
You can take the following actions directly:

## Basic chitchat
- Handle greetings
- Engage in basic chitchat

## NEW: Product recommendations
- Suggest products from the following list: [Product A, Product B, Product C]
- Provide basic product specs (but defer pricing to supervisor)

## Collect information for Supervisor Agent tool calls
- Request user information...
```

### Add Supervisor Tools

```typescript
// In agentConfigs/chatSupervisor/supervisorAgent.ts

export const supervisorAgentTools = [
  // Existing tools...
  {
    type: "function",
    name: "checkInventory",
    description: "Check product inventory levels",
    parameters: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "The product ID to check",
        },
      },
      required: ["productId"],
    },
  },
];

// Add handler in getToolResponse():
function getToolResponse(fName: string) {
  switch (fName) {
    case "getUserAccountInfo":
      return exampleAccountInfo;
    case "checkInventory":
      return { inStock: true, quantity: 42 }; // Your logic here
    default:
      return { result: true };
  }
}
```

## Adding Custom UI Components

### Display Custom Breadcrumbs

```typescript
// In your tool or App.tsx:
const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb;

if (addBreadcrumb) {
  addBreadcrumb('Custom Event', {
    eventType: 'user_action',
    details: 'User clicked special button',
    timestamp: Date.now(),
  });
}
```

### Custom Event Handler

```typescript
// In App.tsx or useRealtimeSession:
useEffect(() => {
  if (sessionRef.current) {
    sessionRef.current.on("custom_event", (data: any) => {
      console.log('Custom event received:', data);
      // Handle your custom event
    });
  }
}, [sessionRef.current]);
```

## Testing Different Codecs

### URL Parameters

```
http://localhost:3000?agentConfig=chatSupervisor&codec=pcmu
```

Supported codecs:
- `opus` (default): 48kHz, high quality
- `pcmu`: 8kHz, simulates phone line
- `pcma`: 8kHz, simulates phone line

### Programmatic Codec Selection

```typescript
// In lib/codecUtils.ts - already implemented
export function audioFormatForCodec(codec: string): 'pcm16' | 'g711_ulaw' | 'g711_alaw' {
  if (codec === 'pcmu') return 'g711_ulaw';
  if (codec === 'pcma') return 'g711_alaw';
  return 'pcm16';
}
```

## Environment Variables

### Adding New Variables

```typescript
// .env
OPENAI_API_KEY=sk-...
CUSTOM_API_KEY=your-key-here
DATABASE_URL=postgresql://...
```

```typescript
// In your API route or tool:
const customKey = process.env.CUSTOM_API_KEY;
```

### Runtime Configuration

```typescript
// lib/envSetup.ts (create if needed)
export function validateEnv() {
  const required = ['OPENAI_API_KEY'];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
```

## Next Steps

- [Best Practices](./05-BEST-PRACTICES.md) - Tips, troubleshooting, and optimization
- [Architecture](./02-ARCHITECTURE.md) - Understand the system design
- [Components](./03-COMPONENTS.md) - Learn about each component

