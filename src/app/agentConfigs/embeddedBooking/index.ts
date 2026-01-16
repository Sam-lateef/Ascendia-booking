/**
 * Embedded Booking Agent Configuration
 * 
 * NEW ARCHITECTURE: Single unified Lexi agent with all booking functions
 * NO orchestrator handoff - direct function execution
 * 
 * DYNAMIC VERSION: Loads configuration from database (domain-agnostic)
 */

import { lexiRealtimeAgent, lexiRealtimeScenario } from './lexiAgent';
import { lexiRealtimeDynamicScenario, initializeDynamicScenario } from './lexiAgentDynamic';

// Export both static and dynamic versions
export const embeddedBookingAgent = lexiRealtimeAgent;
export const embeddedBookingScenario = lexiRealtimeScenario; // Static (hardcoded) ✅ WORKS!
export const embeddedBookingScenarioDynamic = lexiRealtimeDynamicScenario; // Dynamic (database) ⚠️ Client-side issue

// Export initializer for dynamic scenario
export { initializeDynamicScenario };

// Default: Use STATIC version for now (always works in Next.js)
// TODO: Fix dynamic loading for client-side
export default lexiRealtimeScenario;







