# Architecture & Design Decisions

> Last Updated: December 5, 2024

## Domain-Agnostic Core Engine

The workflow engine is now **completely domain-agnostic**. All configuration comes from the database - no hardcoded logic for booking, CRM, or any specific domain.

### Database-Driven Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE CONFIGURATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │     DOMAINS      │     │ FUNCTION_REGISTRY│     │ENTITY_DEFINITIONS│   │
│  │                  │     │                  │     │                  │   │
│  │ - name           │◄───┤│ - domain_id (FK) │◄───┤│ - domain_id (FK) │   │
│  │ - persona_name   │     │ - function name  │     │ - name           │   │
│  │ - system_prompt  │     │ - parameters     │     │ - data_type      │   │
│  │ - business_rules │     │ - description    │     │ - validation     │   │
│  │ - capabilities   │     │ - is_virtual     │     │ - extraction_hint│   │
│  │ - api_endpoint   │     │ - category       │     │                  │   │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘   │
│           │                                                                 │
│           ├──────────────────┬──────────────────┐                          │
│           ▼                  ▼                  ▼                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │ INTENT_TRIGGERS  │  │ DYNAMIC_WORKFLOWS │  │ WORKFLOW_PATTERNS│         │
│  │ - domain_id (FK) │  │ - domain_id (FK) │  │ - domain_id (FK) │         │
│  │ - phrase         │  │ - definition     │  │ - function_seq   │         │
│  │ - intent         │  │ - triggers       │  │ - status         │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Adding a New Domain

To add a new domain (e.g., CRM, Inventory), you only need to:

1. **Insert into `domains` table** - Configure persona, capabilities, API endpoint
2. **Insert into `function_registry`** - Define available functions with parameter schemas
3. **Insert into `entity_definitions`** - Define extractable entities
4. **Insert into `intent_triggers`** - Seed initial trigger phrases
5. **Insert into `dynamic_workflows`** - Seed core workflows

**Zero code changes required!**

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           VOICE INPUT CHANNELS                                │
├──────────────────┬──────────────────┬──────────────────┬────────────────────┤
│   Realtime SDK   │     Retell AI    │    STT Mode      │    Text Input      │
│   (OpenAI)       │   (WebSocket)    │   (Whisper)      │    (UI Chat)       │
└────────┬─────────┴────────┬─────────┴────────┬─────────┴──────────┬─────────┘
         │                  │                  │                    │
         └──────────────────┼──────────────────┼────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        /api/workflow (Main Entry Point)                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Engine Priority: DYNAMIC → ORCHESTRATOR FALLBACK                       │  │
│  │                                                                        │  │
│  │  ┌─────────────────────┐        ┌─────────────────────┐               │  │
│  │  │   DYNAMIC ENGINE    │ error  │   ORCHESTRATOR      │               │  │
│  │  │   (Domain-Agnostic) │───────▶│   Functions as Tools│               │  │
│  │  │   LLM-Validated     │        │   (Domain-Agnostic) │               │  │
│  │  └─────────────────────┘        └─────────────────────┘               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Dynamic Workflow Engine Flow

### Layer 1: Deterministic Intent Matching

```
User Message: "I'd like to book an appointment"
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: DETERMINISTIC STRING MATCHING                                        │
│                                                                              │
│  Load triggers from: intent_triggers WHERE domain_id = current_domain        │
│                                                                              │
│  Check: message.includes(trigger.phrase)?                                    │
│         "book an appointment" includes "book"? ✅                            │
│                                                                              │
│  Result: { intent: "book", confidence: 1.0, needsLLMValidation: false }     │
└──────────────────────────────────────────────────────────────────────────────┘
                │
                │ Match found? Skip LLM!
                ▼
```

### Layer 2: LLM Intent Validation (if no match)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: DUAL LLM VALIDATION                                                  │
│                                                                              │
│  ┌─────────────────────────┐     ┌─────────────────────────┐                │
│  │ RECEPTIONIST            │     │ LLM A                   │                │
│  │ (gpt-4o-mini)           │     │ (gpt-4o-mini)           │                │
│  │                         │     │                         │                │
│  │ System: "You are {name},│     │ System: "You are an AI  │                │
│  │ a {role} at {company}"  │     │ extracting data for     │                │
│  │                         │     │ {domain.displayName}"   │                │
│  │ Extract: intent,        │     │ Extract: intent,        │                │
│  │ entities from config    │     │ entities from config    │                │
│  └───────────┬─────────────┘     └───────────┬─────────────┘                │
│              │                               │                               │
│              └───────────────┬───────────────┘                               │
│                              ▼                                               │
│              ┌───────────────────────────────────┐                           │
│              │ SEMANTIC COMPARISON               │                           │
│              │ Do both extractions match         │                           │
│              │ LOGICALLY (not string match)?     │                           │
│              └───────────────┬───────────────────┘                           │
│                              │                                               │
│                    YES       │       NO (retry up to 3x)                     │
│                     │        │        │                                      │
│                     ▼        │        ▼                                      │
│              PROCEED         │  CLARIFY WITH USER                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Layer 3: Workflow Lookup/Creation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: WORKFLOW MANAGEMENT                                                  │
│                                                                              │
│  Query: SELECT * FROM dynamic_workflows                                      │
│         WHERE domain_id = {domain.id}                                        │
│         AND (workflow_name = {intent} OR {intent} = ANY(intent_triggers))    │
│                                                                              │
│                              │                                               │
│              ┌───────────────┴───────────────┐                               │
│              │                               │                               │
│        FOUND │                               │ NOT FOUND                     │
│              ▼                               ▼                               │
│     Use cached workflow           Create new workflow (LLM B/C/D)            │
│                                              │                               │
│                                              ▼                               │
│                              ┌───────────────────────────────────┐           │
│                              │ LLM B: GPT-4o    │  LLM C: Sonnet │           │
│                              │                  │                │           │
│                              │ Both receive:    │                │           │
│                              │ - Function defs  │                │           │
│                              │ - Business rules │                │           │
│                              │ - Extracted info │                │           │
│                              │ FROM DATABASE    │                │           │
│                              └────────┬─────────┴────────────────┘           │
│                                       │                                      │
│                                       ▼                                      │
│                              ┌───────────────────────────────────┐           │
│                              │ LLM D: Semantic Validator        │           │
│                              │ Compare B vs C logically          │           │
│                              │ Return merged/preferred workflow  │           │
│                              └────────┬──────────────────────────┘           │
│                                       │                                      │
│                                       ▼                                      │
│                              Store in dynamic_workflows for reuse            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Layer 4: Workflow Execution

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: ZOD-VALIDATED EXECUTION                                              │
│                                                                              │
│  For each step in workflow.steps:                                            │
│                                                                              │
│  1. Check skipIf condition                                                   │
│  2. Build params from inputMapping                                           │
│  3. Validate with Zod (schema from function_registry)                        │
│  4. Execute:                                                                 │
│     - Virtual function? Handle in engine                                     │
│     - API function? Call domain.apiEndpoint                                  │
│  5. Store result in state.data[outputAs]                                     │
│  6. Check waitForUser? Pause and ask user                                    │
│                                                                              │
│  On complete: Format successMessage with state.data                          │
│  On error: Return errorMessage                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### Domain-Agnostic Core

| Component | File | Purpose |
|-----------|------|---------|
| **Domain Config** | `domainConfig.ts` | Load domain settings from DB |
| **Function Registry** | `functionRegistry.ts` | Load functions, generate Zod schemas |
| **Schemas** | `schemas.ts` | Generic validators only |
| **Intent Matcher** | `intentMatcher.ts` | Deterministic string matching |
| **Intent Validator** | `intentValidator.ts` | Dual LLM validation |
| **Workflow Creator** | `workflowCreator.ts` | LLM B/C parallel generation |
| **Workflow Validator** | `workflowValidator.ts` | LLM D semantic comparison |
| **Dynamic Engine** | `dynamicEngine.ts` | Zod-validated executor |
| **Dynamic Router** | `dynamicRouter.ts` | Main entry point |
| **Orchestrator** | `orchestratorFallback.ts` | Functions-as-tools fallback |

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `20231206_domain_agnostic.sql` | Creates domains, function_registry, entity_definitions tables |

---

## Learning System

The learning system tracks orchestrator usage to automatically suggest new workflows:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LEARNING LIFECYCLE                                    │
│                                                                             │
│  1. OBSERVE                                                                 │
│     User asks something no workflow handles                                 │
│     → Orchestrator handles with function calls                              │
│     → Monitor records: intent + functions + result + domain_id              │
│                                                                             │
│  2. ANALYZE                                                                 │
│     Pattern analyzer groups by: domain + intent + function_sequence         │
│     → Track: times_observed, success_rate, feedback_score                   │
│                                                                             │
│  3. SUGGEST                                                                 │
│     When pattern exceeds thresholds → status = "suggested"                  │
│                                                                             │
│  4. APPROVE                                                                 │
│     Admin reviews in /admin/patterns                                        │
│     → Approve generates workflow → Saved to dynamic_workflows               │
│                                                                             │
│  5. DETERMINISTIC                                                           │
│     Next request finds workflow in DB → No orchestrator needed              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration

| Setting | Description |
|---------|-------------|
| Domain via DB | All domain config in `domains` table |
| Functions via DB | All function definitions in `function_registry` table |
| Entities via DB | All entity definitions in `entity_definitions` table |
| Triggers via DB | All intent triggers in `intent_triggers` table |
| Workflows via DB | All workflows in `dynamic_workflows` table |

**No environment variables needed for domain configuration!**
