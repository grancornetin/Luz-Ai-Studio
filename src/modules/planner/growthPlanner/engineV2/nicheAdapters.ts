import { getBusinessAdapter } from './businessAdapters';
import type { BusinessArchetype, NicheAdapter, PlannerEngineV2Input } from './types';

export function selectNicheAdapter(_input: PlannerEngineV2Input, archetype: BusinessArchetype): NicheAdapter {
  return getBusinessAdapter(archetype);
}
