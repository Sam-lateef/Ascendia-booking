import { openDentalScenario } from './openDental';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  dental: openDentalScenario,
};

export const defaultAgentSetKey = 'dental';
