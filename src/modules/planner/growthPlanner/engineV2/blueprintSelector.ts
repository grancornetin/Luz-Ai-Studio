import { calculateNoveltyScore, detectRepeatedBlueprints } from './antiRepetition';
import { compatibleBlueprints, TASK_BLUEPRINTS } from './taskBlueprints';
import type {
  BusinessArchetype,
  CampaignAngle,
  Channel,
  FunnelRole,
  PreviousPlanMemory,
  TaskBlueprint,
} from './types';

export interface BlueprintSelectionContext {
  slots: Array<{ platform: Channel; funnelRole: FunnelRole }>;
  campaignAngle: CampaignAngle;
  businessArchetype: BusinessArchetype;
  previousPlans: PreviousPlanMemory[];
  creativeSeed: string;
}

function hash(value: string): number {
  return Array.from(value).reduce((total, char) => ((total * 33) ^ char.charCodeAt(0)) >>> 0, 5381);
}

export function selectBlueprintsForPlan(context: BlueprintSelectionContext): {
  blueprints: TaskBlueprint[];
  blueprintsUsed: string[];
  variationDecisions: string[];
  noveltyScore: number;
} {
  const previous = context.previousPlans[0]?.previousBlueprintsUsed || [];
  const usedCounts = new Map<string, number>();
  const blueprints = context.slots.map((slot, index) => {
    const candidates = compatibleBlueprints({
      platform: slot.platform,
      funnelRole: slot.funnelRole,
      archetype: context.businessArchetype,
      campaignAngle: context.campaignAngle,
    });
    const pool = candidates.length ? candidates : TASK_BLUEPRINTS.filter(item =>
      item.platform === slot.platform && item.funnelRole === slot.funnelRole,
    );
    const ranked = [...pool].sort((a, b) => {
      const aPenalty = (usedCounts.get(a.id) || 0) * 5 + (previous[index] === a.id ? 8 : 0) + (previous.includes(a.id) ? 2 : 0);
      const bPenalty = (usedCounts.get(b.id) || 0) * 5 + (previous[index] === b.id ? 8 : 0) + (previous.includes(b.id) ? 2 : 0);
      return aPenalty - bPenalty || (hash(`${context.creativeSeed}-${index}-${a.id}`) - hash(`${context.creativeSeed}-${index}-${b.id}`));
    });
    const selected = ranked[0] || TASK_BLUEPRINTS[0];
    usedCounts.set(selected.id, (usedCounts.get(selected.id) || 0) + 1);
    return selected;
  });
  const ids = blueprints.map(blueprint => blueprint.id);
  const repeated = detectRepeatedBlueprints(ids, previous);
  return {
    blueprints,
    blueprintsUsed: ids,
    noveltyScore: calculateNoveltyScore(ids, previous),
    variationDecisions: [
      `Se evitaron coincidencias en el mismo orden con el plan anterior.`,
      `Blueprints repetidos respecto al último plan: ${repeated.length}/${ids.length}.`,
      `La selección rotó formatos usando la semilla ${context.creativeSeed}.`,
    ],
  };
}
