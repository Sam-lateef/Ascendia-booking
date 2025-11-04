# Q&A Guide - Building with Multi-Agent Realtime Voice

This document captures common questions and detailed answers about extending and working with this multi-agent realtime voice application.

---

## Table of Contents

1. [Understanding Specialized Agents & Tools](#understanding-specialized-agents--tools)
2. [Working with OpenAI Vectors & Files](#working-with-openai-vectors--files)
3. [Calling External APIs & Databases](#calling-external-apis--databases)
4. [Smart Orchestration & Function Selection](#smart-orchestration--function-selection)
5. [Complex SQL Query Generation](#complex-sql-query-generation)

---

## Understanding Specialized Agents & Tools

### Q: Where do I put my business logic, API calls, and instructions in a specialized SDK agent?

**A:** There are **three key places** where your logic goes:

#### 1. Instructions Block (Agent's Brain 🧠)

```typescript
export const myAgent = new RealtimeAgent({
  name: 'myAgent',
  
  instructions: `
    # Personality and Tone
    - Your agent's personality here
    
    # Context (Business info)
    - Company name
    - Products/services
    - Hours, locations, etc.
    
    # Conversation States (Optional state machine)
    - Step-by-step flow for complex interactions
    
    # Your custom logic instructions
    - When to call which tools
    - How to handle edge cases
  `,
  
  // ...
});
```

**What goes here:** Business rules, conversation flow, decision logic, personality

---

#### 2. Tool Execute Function (Your API Calls & Logic 🔧)

```typescript
tools: [
  tool({
    name: "myCustomTool",
    description: "What this tool does",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "..." },
      },
      required: ["param1"],
    },
    
    // 👉 THIS IS WHERE YOUR MAGIC GOES!
    execute: async (input, details) => {
      const { param1 } = input;
      
      // ✨ YOUR CODE LOGIC HERE ✨
      // - Call your APIs
      // - Query your database
      // - Process data
      // - Business logic
      
      const result = await yourApiCall(param1);
      
      return {
        success: true,
        data: result,
      };
    },
  }),
]
```

**What goes here:** API calls, database queries, business logic, data processing

---

#### 3. Tool Parameters (Data Schema 📋)

```typescript
parameters: {
  type: 'object',
  properties: {
    phoneNumber: { type: 'string', description: '...' },
    orderId: { type: 'string', description: '...' },
  },
  required: ['phoneNumber'],
}
```

**What goes here:** Define what data the agent needs to collect from user

---

### Q: How does the Chat-Supervisor pattern work with tool calls and API responses?

**A:** The flow is **sequential through multiple tools**, not all at once:

```
Step 1: User talks to Realtime Agent
  User: "I want to return my broken snowboard"
         ↓
         
Step 2: Agent calls lookupOrders() tool
  Tool executes → returns order data
  Result: { orderId: "12345", item: "snowboard", date: "2024-01-15" }
  This result is ADDED TO CONVERSATION HISTORY
         ↓
         
Step 3: Agent calls retrievePolicy() tool  
  Tool executes → returns policy text
  Result: { policy: "30-day returns, defects within 1 year..." }
  This result is ALSO ADDED TO CONVERSATION HISTORY
         ↓
         
Step 4: Agent calls checkEligibilityAndPossiblyInitiateReturn()
  execute: async (input, details) => {
    // GET EVERYTHING FROM CONVERSATION HISTORY
    const history = details.context.history;
    // ☝️ This includes:
    //   - User saying "broken snowboard"
    //   - Order data from Step 2
    //   - Policy from Step 3
    //   - All back-and-forth conversation
    
    // BUILD PROMPT WITH ALL THAT INFO
    const prompt = [{
      role: "user",
      content: `
        User wants: ${input.userDesiredAction}
        Question: ${input.question}
        Full conversation: ${history}
      `
    }];
    
    // SEND TO o4-mini FOR ANALYSIS
    const response = await fetch("/api/responses", {
      model: "o4-mini", 
      input: prompt 
    });
    
    return response;
  }
         ↓
         
Step 5: Agent speaks decision to user
  Agent: "Great news! Your return is approved..."
```

**Key Point:** The conversation history already contains all API results from previous tool calls! The SDK automatically tracks all tool results.

---

### Q: What is o4-mini doing in the checkEligibility tool? Is it calling APIs?

**A:** No! The **o4-mini model acts as a "decision-making brain"**, not an API caller.

**o4-mini's Job:**
- Read business policies
- Analyze conversation history (which includes API results)
- Consider multiple factors
- Make nuanced decisions
- Provide reasoning and explanations

**Example:**
```typescript
// o4-mini receives:
const input = {
  userIntent: "Return broken snowboard",
  orderData: { /* from previous API call */ },
  policyText: { /* from previous API call */ },
  conversationHistory: [/* all context */]
};

// o4-mini thinks:
// "Hmm, snowboard is broken within 30 days,
//  defect policy says they can return within 1 year,
//  user described it as defective,
//  YES - this is eligible!"

// o4-mini returns:
{
  isEligible: true,
  rationale: "Defective item within policy window",
  nextSteps: "Send confirmation to customer..."
}
```

Think of it like calling a **"Virtual Policy Expert API"** that can reason about complex business rules.

---

## Working with OpenAI Vectors & Files

### Q: Can I reference my OpenAI vector stores directly in agent tools?

**A:** Not directly with `file_search` syntax, but you CAN access them! Here's how:

#### ❌ This Doesn't Work:
```typescript
tools: [
  {
    type: "file_search",  // ❌ This is Assistants API syntax
    file_ids: ["file-xxx"]  // Realtime API uses different tool system
  }
]
```

#### ✅ This Works:

**Step 1: Create API Route**

```typescript
// api/vector-search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  try {
    // Use your assistant with vector store attached
    const thread = await openai.beta.threads.create({
      messages: [{ role: "user", content: query }]
    });
    
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: process.env.ASSISTANT_ID!, // Your assistant ID
    });
    
    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const response = messages.data[0].content[0];
      
      return NextResponse.json({
        success: true,
        answer: response.type === 'text' ? response.text.value : '',
        citations: response.type === 'text' ? response.text.annotations : []
      });
    }
    
    return NextResponse.json({ success: false, error: 'Run failed' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
  }
}
```

**Step 2: Create Tool**

```typescript
const knowledgeBaseTool = tool({
  name: 'searchKnowledgeBase',
  description: 'Search company knowledge base with vector search',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for' }
    },
    required: ['query'],
  },
  
  execute: async (input) => {
    const { query } = input as { query: string };
    
    // Call your API endpoint
    const response = await fetch('/api/vector-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    
    return {
      answer: data.answer,
      sources: data.citations?.map((c: any) => c.text) || []
    };
  }
});
```

**Environment Setup:**
```bash
# .env
OPENAI_API_KEY=sk-...
ASSISTANT_ID=asst_...  # Your assistant with vector store attached
```

---

## Calling External APIs & Databases

### Q: How do I call an external relational database that has an API?

**A:** Create an API route for it and call it from your tool! Two options:

#### Option 1: API Route (RECOMMENDED - Secure)

**Step 1: Create API Route**

```typescript
// api/database/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { action, params } = await req.json();
  
  try {
    // Call your external database API
    const response = await fetch('https://your-db-api.com/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DATABASE_API_KEY}`, // 🔒 Secure!
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: action,
        parameters: params
      })
    });
    
    if (!response.ok) {
      throw new Error('Database query failed');
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: data.results
    });
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Database query failed' }, 
      { status: 500 }
    );
  }
}
```

**Step 2: Create Tool**

```typescript
const getUserOrdersTool = tool({
  name: 'getUserOrders',
  description: 'Get customer orders from database',
  parameters: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer ID' },
      limit: { type: 'number', description: 'Number of orders' }
    },
    required: ['customerId'],
  },
  
  execute: async (input) => {
    const { customerId, limit = 10 } = input as { 
      customerId: string; 
      limit?: number 
    };
    
    // Call your API route
    const response = await fetch('/api/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getUserOrders',
        params: { customerId, limit }
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      return { error: 'Failed to fetch orders' };
    }
    
    return {
      success: true,
      orders: data.data,
      count: data.data.length
    };
  }
});
```

#### Option 2: Direct API Call (Only if safe)

Use only if:
- ❌ No sensitive credentials
- ✅ API key is safe client-side
- ✅ CORS is enabled

```typescript
const getUserOrdersTool = tool({
  name: 'getUserOrders',
  description: 'Get customer orders',
  parameters: { /* ... */ },
  
  execute: async (input) => {
    const { customerId } = input as { customerId: string };
    
    // Direct call to external API (less secure)
    const response = await fetch('https://your-db-api.com/orders', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_PUBLIC_API_KEY', // ⚠️ Exposed!
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ customer_id: customerId })
    });
    
    const data = await response.json();
    return { success: true, orders: data.orders };
  }
});
```

---

## Smart Orchestration & Function Selection

### Q: Do I need to specify which API endpoint to call, or does the model select the function?

**A:** The **model automatically chooses which tools to call** based on:
1. Tool descriptions (most important!)
2. Current conversation context
3. Its instructions

You don't manually specify - the agent decides!

---

### Q: What's the best way to handle edge cases where the model needs to decide which functions to call and in what order?

**A:** Use the **Chat-Supervisor Pattern with Function Registry**. Here's the complete architecture:

#### Step 1: Create Function Registry

```typescript
// lib/functionRegistry.ts
export interface FunctionRegistryEntry {
  endpoint: string;
  method: 'GET' | 'POST';
  description: string;
  parameters: any;
}

export const FUNCTION_REGISTRY: Record<string, FunctionRegistryEntry> = {
  // User operations
  getUserInfo: {
    endpoint: '/api/database',
    method: 'POST',
    description: 'Get user information by phone or email',
    parameters: { phoneNumber: 'string', email: 'string' }
  },
  
  // Order operations
  getOrderDetails: {
    endpoint: '/api/database',
    method: 'POST',
    description: 'Get order details by order ID',
    parameters: { orderId: 'string' }
  },
  
  // Inventory operations
  checkInventory: {
    endpoint: '/api/inventory',
    method: 'POST',
    description: 'Check product inventory levels',
    parameters: { productId: 'string' }
  },
  
  // Payment operations
  processRefund: {
    endpoint: '/api/payments',
    method: 'POST',
    description: 'Process a refund',
    parameters: { orderId: 'string', amount: 'number' }
  },
};

// Helper to execute any function
export async function executeFunction(
  functionName: string, 
  args: any
): Promise<any> {
  const func = FUNCTION_REGISTRY[functionName];
  
  if (!func) {
    throw new Error(`Function not found: ${functionName}`);
  }
  
  const response = await fetch(func.endpoint, {
    method: func.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      action: functionName, 
      params: args 
    })
  });
  
  if (!response.ok) {
    throw new Error(`Function failed: ${functionName}`);
  }
  
  return response.json();
}

// Convert registry to tool definitions
export function getToolDefinitions() {
  return Object.entries(FUNCTION_REGISTRY).map(([name, config]) => ({
    type: "function",
    name,
    description: config.description,
    parameters: {
      type: "object",
      properties: config.parameters,
      required: Object.keys(config.parameters),
    }
  }));
}
```

#### Step 2: Create Chat-Supervisor Setup

```typescript
// Simple chat agent
export const chatAgent = new RealtimeAgent({
  name: 'chatAgent',
  instructions: `
    You handle basic interactions.
    For complex operations, use getNextResponseFromSupervisor.
  `,
  tools: [getNextResponseFromSupervisor],
});

// Smart supervisor
const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description: 'Ask intelligent supervisor to handle complex logic',
  parameters: {
    type: 'object',
    properties: {
      context: { type: 'string' }
    },
    required: ['context'],
  },
  
  execute: async (input, details) => {
    const history = (details?.context as any)?.history ?? [];
    
    const supervisorInstructions = `
      You are an expert orchestrator for customer service.
      
      # Decision Logic:
      - Analyze user intent
      - Determine which tools to call and in what order
      - Handle edge cases intelligently
      - Consider business rules
      
      # Business Rules:
      - Always authenticate before accessing sensitive data
      - Check eligibility before processing returns
      - Validate inventory before promising delivery
    `;
    
    // Send to supervisor with ALL tools
    const response = await fetch('/api/responses', {
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-4.1', // or 'o4-mini' for reasoning
        input: [
          { role: 'system', content: supervisorInstructions },
          { role: 'user', content: `${JSON.stringify(history)}\n\n${input.context}` }
        ],
        tools: getToolDefinitions(), // All your functions
        parallel_tool_calls: false,
      })
    });
    
    // Handle tool calls iteratively
    const result = await handleToolCallsIteratively(response);
    
    return { nextResponse: result };
  }
});
```

#### Why This Works:

✅ Model automatically decides which tools to call  
✅ Model handles edge cases intelligently  
✅ Easy to add new functions (just add to registry)  
✅ Centralized logic in supervisor instructions  
✅ Scales well as business grows  

---

## Complex SQL Query Generation

### Q: I have a relational DB with complex schema. How do I build a model for SQL query generation with JOINs and multi-step queries?

**A:** Use **o4-mini (reasoning model) + detailed schema context**. Here's the complete approach:

#### Step 1: Document Your Schema

```typescript
// lib/databaseSchema.ts
export const DATABASE_SCHEMA = {
  description: "E-commerce database schema",
  
  tables: {
    customers: {
      description: "Customer information",
      columns: {
        id: { type: "INTEGER", primaryKey: true },
        email: { type: "VARCHAR(255)", unique: true },
        name: { type: "VARCHAR(255)" },
        phone: { type: "VARCHAR(20)" },
      },
      relationships: {
        orders: "One customer has many orders (customers.id → orders.customer_id)"
      }
    },
    
    orders: {
      description: "Customer orders",
      columns: {
        id: { type: "INTEGER", primaryKey: true },
        customer_id: { type: "INTEGER", foreignKey: "customers.id" },
        order_date: { type: "TIMESTAMP" },
        total_amount: { type: "DECIMAL(10,2)" },
        status: { type: "VARCHAR(50)" },
      },
      relationships: {
        customer: "Many orders belong to one customer",
        order_items: "One order has many order_items"
      }
    },
    
    order_items: {
      description: "Items within each order",
      columns: {
        id: { type: "INTEGER", primaryKey: true },
        order_id: { type: "INTEGER", foreignKey: "orders.id" },
        product_id: { type: "INTEGER", foreignKey: "products.id" },
        quantity: { type: "INTEGER" },
        price: { type: "DECIMAL(10,2)" },
      },
    },
    
    products: {
      description: "Product catalog",
      columns: {
        id: { type: "INTEGER", primaryKey: true },
        name: { type: "VARCHAR(255)" },
        category_id: { type: "INTEGER", foreignKey: "categories.id" },
        price: { type: "DECIMAL(10,2)" },
      },
    },
  },
  
  commonPatterns: {
    getCustomerOrders: `
      SELECT c.name, o.id, o.total_amount
      FROM customers c
      JOIN orders o ON c.id = o.customer_id
      WHERE c.email = ?
    `,
  },
  
  businessRules: [
    "Orders status: 'pending', 'processing', 'shipped', 'delivered', 'cancelled'",
    "total_amount should equal SUM(price * quantity) from order_items",
  ]
};
```

#### Step 2: Create SQL Generator Tool

```typescript
import { tool } from '@openai/agents/realtime';

export const generateSQLTool = tool({
  name: 'generateSQL',
  description: 'Generate SQL query from natural language. Handles JOINs and multi-step queries.',
  parameters: {
    type: 'object',
    properties: {
      userQuery: { type: 'string', description: 'What data to retrieve' }
    },
    required: ['userQuery'],
  },
  
  execute: async (input) => {
    const { userQuery } = input as { userQuery: string };
    
    const prompt = [
      {
        role: 'system',
        content: `You are an expert SQL query generator.

# Database Schema
[Full schema here with tables, relationships, examples]

# Output Format:
\`\`\`json
{
  "analysis": "Brief explanation",
  "queryType": "single" | "multi-step",
  "steps": [
    {
      "stepNumber": 1,
      "description": "What this query does",
      "sql": "SELECT ... FROM ... WHERE ...",
      "parameters": [],
      "dependsOn": null
    }
  ]
}
\`\`\`

# Examples:

Simple:
User: "Get customer by email"
{
  "queryType": "single",
  "steps": [{
    "sql": "SELECT * FROM customers WHERE email = ?",
    "parameters": ["email"]
  }]
}

Complex with JOINs:
User: "Show revenue by product category last 30 days"
{
  "queryType": "single",
  "steps": [{
    "sql": "SELECT c.name, SUM(oi.price * oi.quantity) as revenue FROM categories c JOIN products p ON c.id = p.category_id JOIN order_items oi ON p.id = oi.product_id JOIN orders o ON oi.order_id = o.id WHERE o.order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY c.id ORDER BY revenue DESC"
  }]
}

Multi-step:
User: "Find customers who ordered Electronics but not Sports"
{
  "queryType": "multi-step",
  "steps": [
    {
      "stepNumber": 1,
      "sql": "SELECT DISTINCT c.id FROM customers c JOIN orders o ... WHERE cat.name = 'Electronics'"
    },
    {
      "stepNumber": 2,
      "sql": "SELECT c.id FROM customers WHERE c.id IN (?) AND c.id NOT IN (...Sports query...)",
      "dependsOn": 1
    }
  ]
}
`
      },
      {
        role: 'user',
        content: userQuery
      }
    ];
    
    // Use o4-mini for reasoning
    const response = await fetch('/api/responses', {
      method: 'POST',
      body: JSON.stringify({
        model: 'o4-mini',
        input: prompt,
      })
    });
    
    const data = await response.json();
    const sqlPlan = JSON.parse(extractJSON(data));
    
    return { success: true, sqlPlan };
  }
});
```

#### Step 3: Create SQL Executor

```typescript
export const executeSQLTool = tool({
  name: 'executeSQL',
  description: 'Execute generated SQL query',
  parameters: {
    type: 'object',
    properties: {
      sqlPlan: { type: 'object' }
    },
    required: ['sqlPlan'],
  },
  
  execute: async (input) => {
    const { sqlPlan } = input;
    const results = [];
    
    // Execute steps in order
    for (const step of sqlPlan.steps) {
      let sql = step.sql;
      
      // Handle dependencies
      if (step.dependsOn !== null) {
        const prevStep = results[step.dependsOn - 1];
        const ids = prevStep.data.map(row => row.id);
        sql = sql.replace(/\$\$STEP_\d+_IDS\$\$/g, ids.join(','));
      }
      
      // Execute via API route
      const response = await fetch('/api/database/execute', {
        method: 'POST',
        body: JSON.stringify({
          sql,
          parameters: step.parameters,
          readOnly: true,
        })
      });
      
      const data = await response.json();
      results.push({
        stepNumber: step.stepNumber,
        data: data.rows,
      });
    }
    
    return {
      success: true,
      results: results[results.length - 1].data,
    };
  }
});
```

#### Step 4: Database API Route

```typescript
// api/database/execute/route.ts
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export async function POST(req: NextRequest) {
  const { sql, parameters, readOnly } = await req.json();
  
  try {
    // Security: Only SELECT in read-only mode
    if (readOnly && !sql.trim().toUpperCase().startsWith('SELECT')) {
      return NextResponse.json(
        { error: 'Only SELECT queries allowed' },
        { status: 403 }
      );
    }
    
    const [rows] = await pool.execute(sql, parameters || []);
    
    return NextResponse.json({
      success: true,
      rows: rows,
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
```

#### Complete Flow Example:

```
User: "Show me customers who bought electronics but never returned anything"
         ↓
Agent calls: generateSQL(userQuery)
         ↓
o4-mini analyzes schema and generates complex JOIN query
         ↓
Returns SQL plan with optimized query
         ↓
Agent calls: executeSQL(sqlPlan)
         ↓
Executes query → Returns results
         ↓
Agent: "I found 43 customers. Top buyers: John Doe, Jane Smith..."
```

#### Best Practices:

1. ✅ Always use reasoning model (o4-mini/gpt-4.1)
2. ✅ Provide complete schema with relationships
3. ✅ Include example queries in prompt
4. ✅ Use read-only mode for safety
5. ✅ Handle multi-step queries explicitly
6. ✅ Validate SQL before execution
7. ✅ Add query timeout limits
8. ✅ Log all queries for debugging

---

## Summary

This Q&A guide covers the most common patterns for extending the multi-agent realtime voice application:

- **Specialized agents** have instructions, tools with execute functions, and parameters
- **Tool execution** happens sequentially with results stored in conversation history
- **o4-mini** acts as a reasoning brain for complex decisions
- **Vector stores** are accessed via API routes, not direct references
- **External APIs** should use server-side API routes for security
- **Function orchestration** happens automatically via Chat-Supervisor pattern
- **Complex SQL** generation uses reasoning models with full schema context

For more details, see:
- [Architecture Guide](./02-ARCHITECTURE.md) - System design
- [Components Guide](./03-COMPONENTS.md) - File structure
- [Extending Guide](./04-EXTENDING.md) - Customization examples
- [Best Practices](./05-BEST-PRACTICES.md) - Production tips

