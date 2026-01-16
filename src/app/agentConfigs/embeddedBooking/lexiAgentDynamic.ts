/**
 * LEXI - Dynamic Domain-Agnostic Agent
 * 
 * Loads all configuration from database:
 * - Company info (name, services, hours, etc.)
 * - Available tools/functions
 * - Business logic instructions
 * 
 * Works with ANY domain (booking, CRM, inventory, etc.) without code changes
 */

import { RealtimeAgent } from '@openai/agents/realtime';
import { loadAgentConfig, generateInstructionsFromConfig } from '@/app/lib/agentConfigDynamic';
import { createAllRealtimeTools } from '@/app/lib/realtimeToolBuilder';

// ============================================
// CONFIGURATION CACHE
// ============================================
let agentConfigCache: any = null;
let lastConfigLoad: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute

/**
 * Load or get cached agent configuration
 */
async function getAgentConfig() {
  const now = Date.now();
  
  // Return cached if still valid
  if (agentConfigCache && (now - lastConfigLoad) < CONFIG_CACHE_TTL) {
    return agentConfigCache;
  }

  // Load fresh config
  console.log('[Lexi Dynamic] 🔄 Loading configuration from database...');
  const config = await loadAgentConfig();
  
  agentConfigCache = config;
  lastConfigLoad = now;
  
  console.log('[Lexi Dynamic] ✅ Configuration loaded:', {
    company: config.company.company_name,
    persona: config.company.persona_name,
    tools: config.tools.length,
    instructions: config.instructions.length,
  });
  
  return config;
}

/**
 * Generate complete instructions from database configuration
 */
export async function generateDynamicInstructions(): Promise<string> {
  try {
    const config = await getAgentConfig();
    return generateInstructionsFromConfig(config);
  } catch (err) {
    console.error('[Lexi Dynamic] ❌ Failed to load config, using minimal fallback:', err);
    return `You are a helpful AI assistant. Please help the user with their request.`;
  }
}

/**
 * Create Realtime Agent with dynamic configuration
 */
export async function createDynamicRealtimeAgent(): Promise<RealtimeAgent> {
  const config = await getAgentConfig();
  
  // Generate instructions from database
  const instructions = generateInstructionsFromConfig(config);
  
  // Create tools from database
  const tools = createAllRealtimeTools(config.tools);
  
  console.log('[Lexi Dynamic] 🤖 Creating Realtime Agent with:');
  console.log(`  - Instructions: ${instructions.length} characters`);
  console.log(`  - Tools: ${tools.length} functions`);
  
  // Create the agent
  const agent = new RealtimeAgent({
    name: config.company.persona_name || 'Lexi',
    voice: config.company.voice as any || 'sage',
    instructions,
    tools,
  });
  
  return agent;
}

// ============================================
// REALTIME SCENARIO (for AgentUIApp)
// ============================================

/**
 * Create dynamic agent scenario array
 * Note: This creates a lazy-loading agent that initializes on first use
 */
async function createDynamicScenario(): Promise<RealtimeAgent[]> {
  const agent = await createDynamicRealtimeAgent();
  return [agent];
}

// Export as a promise that resolves to the scenario
// AgentUIApp will need to handle the async initialization
let scenarioPromise: Promise<RealtimeAgent[]> | null = null;

export function getLexiRealtimeDynamicScenario(): Promise<RealtimeAgent[]> {
  if (!scenarioPromise) {
    scenarioPromise = createDynamicScenario();
  }
  return scenarioPromise;
}

// Export as empty array initially
export const lexiRealtimeDynamicScenario: RealtimeAgent[] = [];

/**
 * Initialize the dynamic scenario (call this early in app lifecycle)
 */
export async function initializeDynamicScenario() {
  try {
    const agents = await createDynamicScenario();
    lexiRealtimeDynamicScenario.length = 0;
    lexiRealtimeDynamicScenario.push(...agents);
    console.log('[Lexi Dynamic] ✅ Scenario initialized');
  } catch (err) {
    console.error('[Lexi Dynamic] ❌ Failed to initialize:', err);
  }
}

// Auto-initialize on module load (SERVER-SIDE ONLY)
// Client-side cannot access Supabase admin keys for security reasons
// The server builds the agents and passes them to the client
if (typeof window === 'undefined') {
  // Server-side: Initialize immediately during build/server startup
  console.log('[Lexi Dynamic] 🔧 Server-side initialization starting...');
  initializeDynamicScenario().then(() => {
    console.log('[Lexi Dynamic] ✅ Server-side initialization complete, agents array length:', lexiRealtimeDynamicScenario.length);
  });
} else {
  // Client-side: Log what we have
  console.log('[Lexi Dynamic] 🖥️ Client-side module loaded');
  console.log('[Lexi Dynamic] 🖥️ Client-side agents array length:', lexiRealtimeDynamicScenario.length);
  console.log('[Lexi Dynamic] 🖥️ Client-side agents:', lexiRealtimeDynamicScenario);
}

/**
 * Clear configuration cache
 * Call this when config is updated in admin UI
 */
export function clearLexiConfigCache() {
  agentConfigCache = null;
  lastConfigLoad = 0;
  scenarioPromise = null;
  console.log('[Lexi Dynamic] 🗑️ Configuration cache cleared');
}

