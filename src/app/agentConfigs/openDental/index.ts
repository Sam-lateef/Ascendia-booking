/**
 * OpenDental Agent Configuration
 * 
 * ARCHITECTURE OPTIONS:
 * 1. OLD: dentalAgent with orchestrator handoff (static, 2-agent system)
 * 2. NEW: openDentalScenarioDynamic - Unified Lexi with database config ✨
 * 
 * Default: NEW dynamic architecture (domain-agnostic, configurable via UI)
 */

import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';
import { getNextResponseFromSupervisor } from './orchestratorAgent';
import { fetchOfficeContext } from '@/app/lib/officeContext';
import { generateGreetingAgentInstructions } from './greetingAgentSTT';
import { openDentalScenarioDynamic, initializeDynamicOpenDentalScenario } from './lexiAgentDynamic';
import { lexiOpenDentalScenario } from './lexiAgentStatic'; // ✨ NEW: Unified Lexi (static)

// ============================================================================
// OLD ARCHITECTURE (Static, Orchestrator-based)
// Kept for backward compatibility, but not recommended
// ============================================================================

// Simple tool to get current date/time
const getCurrentDateTime = tool({
  name: 'get_datetime',
  description: 'Gets the current date and time in ISO format to ensure accurate appointment handling',
  parameters: z.object({}),
  execute: async () => {
    const now = new Date();
    return now.toISOString();
  },
});

// Pre-fetch office context (providers, operatories, occupied slots)
const getCurrentOfficeContext = tool({
  name: 'get_office_context',
  description: 'Fetches current office data (providers, operatories, occupied appointment slots). Call this ONCE at the start of the conversation after get_datetime. This data is then passed to the orchestrator to eliminate redundant API calls.',
  parameters: z.object({}),
  execute: async () => {
    const context = await fetchOfficeContext();
    return JSON.stringify(context, null, 2);
  },
});

export const dentalAgent = new RealtimeAgent({
  name: 'Lexi',
  voice: 'sage',
  instructions: generateGreetingAgentInstructions(true),
  tools: [
    getCurrentDateTime,
    getCurrentOfficeContext,
    getNextResponseFromSupervisor, // ❌ OLD: Orchestrator with handoff
  ],
});

export const openDentalScenario = [dentalAgent]; // ❌ OLD: Static orchestrator

// ============================================================================
// NEW ARCHITECTURE (Dynamic, Unified Lexi) ✨
// Loads configuration from database, domain-agnostic, no orchestrator
// ============================================================================

export { openDentalScenarioDynamic, initializeDynamicOpenDentalScenario };

// ============================================================================
// EXPORTS
// ============================================================================

export const openDentalCompanyName = 'Barton Dental';

// Default: Use NEW unified Lexi (static version) ✨
// No orchestrator - direct function calls!
export default lexiOpenDentalScenario;

