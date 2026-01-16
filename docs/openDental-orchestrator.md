# OpenDental Agent Orchestration

## Overview
The OpenDental scenario runs a two-tier voice agent system:
- **Tier 1 – Lexi:** a realtime receptionist built with `RealtimeAgent` that greets patients, manages dialog flow, and funnels complex intent to the supervisor tool.
- **Tier 2 – Orchestrator Supervisor:** a Responses API worker that plans multi-step workflows, selects OpenDental API functions from a curated catalog, and returns natural-language answers for Lexi to read aloud.

This document explains how Lexi and the Orchestrator collaborate, how the function registry is injected, and how responses are produced end-to-end.

## Tier 1: Lexi (Realtime Receptionist)
- **Definition & voice:** `RealtimeAgent` named `Lexi` with `voice: 'sage'`.
- **First-turn behavior:** forced greeting plus silent `get_datetime` and `get_office_context` tool calls to prime downstream context.
- **User-facing contract:** always announces “One moment please…” before invoking the orchestrator tool, then reads the returned text verbatim.
- **Tool surface:** exposes three tools – `get_datetime`, `get_office_context`, and `getNextResponseFromSupervisor`.

```36:113:src/app/agentConfigs/openDental/index.ts
export const dentalAgent = new RealtimeAgent({
  name: 'Lexi',
  voice: 'sage',
  instructions: `You are **Lexi**, a friendly dental receptionist ...`
  tools: [
    getCurrentDateTime,
    getCurrentOfficeContext,
    getNextResponseFromSupervisor,
  ],
});
```

### Context priming
- `get_datetime` captures the current ISO timestamp for downstream scheduling.
- `get_office_context` pulls provider/operatories/defaults/occupied slots and returns JSON that the orchestrator later reads from conversation history. The tool is called exactly once per conversation for efficiency.

```20:29:src/app/agentConfigs/openDental/index.ts
const getCurrentOfficeContext = tool({
  name: 'get_office_context',
  ...,
  execute: async () => {
    const context = await fetchOfficeContext();
    return JSON.stringify(context, null, 2);
  },
});
```

## Tier 2: Orchestrator Supervisor
The orchestrator is implemented as a tool (`getNextResponseFromSupervisor`) that proxies into the Responses API. It injects rich instructions, a curated function catalog, and iteratively executes API calls until a conversational answer is produced.

### Dynamic instruction pack
- Instructions are rendered on every call via `generateOrchestratorInstructions`.
- The generator interpolates:
  - Today/tomorrow ISO dates and friendly strings.
  - The **49-function priority catalog** from `generateFunctionCatalog(true)`.
  - Relationship rules sourced from `docs/API/unified_registry.json`.
  - Optional **office context** (providers, operatories, defaults, stale slot hints) if Lexi fetched it earlier.
- Rulesets encode booking/reschedule/cancel workflows, date-handling constraints, and mandatory provider-name confirmations.

```52:144:src/app/agentConfigs/openDental/orchestratorAgent.ts
function generateOrchestratorInstructions(officeContext?: OfficeContext): string {
  const functionCatalog = generateFunctionCatalog(true);
  const relationshipRules = (unifiedRegistry as any).natural_language_guide;
  // Builds OFFICE CONTEXT section and embeds workflows + rules
}
```

### Tool surface (meta-tool)
- The orchestrator exposes a single JSON schema tool `callOpenDentalAPI`.
- The model picks `functionName` plus typed `parameters`, enabling any prioritized OpenDental endpoint through one surface area.

```646:668:src/app/agentConfigs/openDental/orchestratorAgent.ts
export const orchestratorTools = [
  {
    type: 'function',
    name: 'callOpenDentalAPI',
    parameters: {
      type: 'object',
      required: ['functionName', 'parameters'],
    },
  },
];
```

### API execution loop
1. Lexi invokes `getNextResponseFromSupervisor` with the user’s request fragment.
2. The tool:
   - Scrapes conversation history for `get_office_context` output (if present) and user/assistant turns.
   - Builds a Responses API payload with:
     - `model: 'gpt-4o-mini'`
     - `instructions: generateOrchestratorInstructions(...)`
     - `tools: orchestratorTools`
     - `input: [conversation history…, latest user message]`
   - Sends the payload to `/api/responses`.
3. `handleResponseIterations` processes the Responses API output:
   - Executes each returned `function_call` by POSTing to `/api/opendental`.
   - Feeds results back into the `input` array as `function_call_output`.
   - Repeats until the model emits a pure message (max 12 iterations).
4. The final assistant text is returned to Lexi, who speaks it to the caller.

```920:1017:src/app/agentConfigs/openDental/orchestratorAgent.ts
export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  execute: async (input, details) => {
    const officeContext = extractOfficeContext(details?.context?.history);
    const body = {
      model: 'gpt-4o-mini',
      instructions: generateOrchestratorInstructions(officeContext),
      tools: orchestratorTools,
      input: [...conversationHistory, latestUserMessage],
    };
    const response = await fetchResponsesMessage(body);
    return await handleResponseIterations(body, response);
  },
});
```

### Meta-tool execution and error handling
- `callOpenDentalAPI` proxy hits the Next.js worker at `/api/opendental`, surfacing `functionName` and `parameters`.
- Success and error payloads are appended to the Responses API body to keep the model stateful across iterations.
- If the loop hits the 12-iteration ceiling or the Responses API fails, the orchestrator returns a polite fallback string for Lexi to read.

```676:840:src/app/agentConfigs/openDental/orchestratorAgent.ts
async function callOpenDentalAPI(functionName: string, parameters: Record<string, any>) {
  const response = await fetch('/api/opendental', { method: 'POST', body: JSON.stringify({ functionName, parameters }) });
  if (!response.ok) throw new Error(...);
}

async function handleResponseIterations(body: any, response: any): Promise<string> {
  const functionCalls = outputItems.filter((item) => item.type === 'function_call');
  for (const toolCall of functionCalls) {
    if (toolCall.name === 'callOpenDentalAPI') {
      const result = await callOpenDentalAPI(functionName, parameters);
      body.input.push(function_call, function_call_output);
    }
  }
  return finalText;
}
```

## Conversation Lifecycle Summary
1. **Greeting & Priming:** Lexi greets, silently calls `get_datetime` and `get_office_context`.
2. **User Intent Capture:** Lexi gathers any missing patient info and repeats the “One moment…” filler.
3. **Supervisor Invocation:** Lexi forwards the distilled intent to `getNextResponseFromSupervisor`.
4. **Planning & Execution:** The orchestrator plans, chooses API calls via `callOpenDentalAPI`, and verifies results (e.g., appointment slot availability) following embedded workflows.
5. **Response Delivery:** The orchestrator returns conversational text (must mention provider names on bookings/reschedules), and Lexi reads it verbatim.

## Key Guarantees & Guardrails
- **Provider names are mandatory** in any booking/reschedule confirmation (enforced in instructions).
- **Read-only default posture** unless the user requests mutation verbs (create/update/delete).
- **Date handling rules** force YYYY-MM-DD inputs and forbid past dates.
- **Availability checking** always uses `GetAppointments` with targeted ranges, avoiding unsupported endpoints.
- **Office context reuse** prevents redundant provider/operatories fetches and speeds up first responses.

## Operational Notes
- Logging tags (`[Lexi]`, `[Orchestrator]`) make it easy to trace the two tiers in server logs.
- The orchestrator currently caps iterations at 12 to prevent runaway tool loops; consider increasing if workflows grow longer.
- Any future expansion of the function catalog should happen in `apiRegistry.ts`, then re-used through `generateFunctionCatalog`.

