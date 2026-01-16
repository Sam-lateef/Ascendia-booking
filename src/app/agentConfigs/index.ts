import openDentalScenario from './openDental'; // ✨ NOW: Unified Lexi (no orchestrator!)
import embeddedBookingScenario from './embeddedBooking'; // ✨ Unified Lexi
import lexiStandardScenario from './embeddedBooking/lexiStandardAgent'; // ✨ Standard mode (cost-optimized)

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  dental: openDentalScenario, // ✨ Premium: Unified Lexi calling OpenDental API
  'embedded-booking': embeddedBookingScenario, // ✨ Premium: Unified Lexi calling booking API
  'embedded-booking-standard': lexiStandardScenario, // ✨ Standard: Two-agent (gpt-4o-mini + supervisor)
};

export const defaultAgentSetKey = 'dental';
