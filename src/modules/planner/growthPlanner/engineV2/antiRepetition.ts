import type { GeneratedTaskV2, PreviousPlanMemory, PlannerEngineV2Input, CampaignAngle } from './types';

const STORAGE_KEY = 'luz_growth_planner_v2_memory';
const MAX_MEMORIES = 12;

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function brandMemoryId(input: Pick<PlannerEngineV2Input, 'brand'>): string {
  return input.brand.name.trim().toLowerCase().replace(/\s+/g, '_') || 'unknown_brand';
}

export function loadPreviousPlanMemory(brandId?: string): PreviousPlanMemory[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const values = JSON.parse(storage.getItem(STORAGE_KEY) || '[]') as PreviousPlanMemory[];
    return brandId ? values.filter(value => value.brandId === brandId) : values;
  } catch {
    return [];
  }
}

export function savePlanMemory(memory: PreviousPlanMemory): void {
  const storage = safeStorage();
  if (!storage) return;
  const existing = loadPreviousPlanMemory().filter(value =>
    !(value.brandId === memory.brandId && value.lastGeneratedAt === memory.lastGeneratedAt),
  );
  storage.setItem(STORAGE_KEY, JSON.stringify([memory, ...existing].slice(0, MAX_MEMORIES)));
}

export function detectRepeatedBlueprints(current: string[], previous: string[]): string[] {
  const previousSet = new Set(previous);
  return Array.from(new Set(current.filter(id => previousSet.has(id))));
}

export function detectRepeatedCaptions(current: string[], previous: string[]): string[] {
  const normalizedPrevious = previous.map(value => value.toLowerCase().replace(/\s+/g, ' ').trim());
  return current.filter(caption => {
    const normalized = caption.toLowerCase().replace(/\s+/g, ' ').trim();
    return normalizedPrevious.some(old => old === normalized || (normalized.length > 50 && old.includes(normalized.slice(0, 50))));
  });
}

export function detectRepeatedConcepts(current: string[], previous: string[]): string[] {
  return detectRepeatedCaptions(current, previous);
}

export function calculateNoveltyScore(blueprints: string[], previousBlueprints: string[]): number {
  if (!blueprints.length || !previousBlueprints.length) return 100;
  const repeated = detectRepeatedBlueprints(blueprints, previousBlueprints).length;
  return Math.max(0, Math.round((1 - repeated / blueprints.length) * 100));
}

function signaturePart(value: string): string {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).slice(0, 10).join('_');
}

export function buildTaskSignature(task: GeneratedTaskV2): string {
  return [
    task.blueprintId,
    task.campaignAngle,
    task.ctaTarget,
    signaturePart(task.visualConcept),
    task.funnelRole,
    task.platform,
  ].join('|');
}

export function buildPlanSignature(tasks: GeneratedTaskV2[]): string {
  return tasks.map(buildTaskSignature).join('>');
}

export function calculateTaskNoveltyScore(tasks: GeneratedTaskV2[], previous?: PreviousPlanMemory): number {
  if (!tasks.length || !previous?.previousTaskSignatures?.length) return 100;
  const old = new Set(previous.previousTaskSignatures);
  const repeated = tasks.map(buildTaskSignature).filter(signature => old.has(signature)).length;
  return Math.max(0, Math.round((1 - repeated / tasks.length) * 100));
}

export function buildPlanMemory(params: {
  input: PlannerEngineV2Input;
  angle: CampaignAngle;
  tasks: GeneratedTaskV2[];
}): PreviousPlanMemory {
  return {
    brandId: brandMemoryId(params.input),
    objectiveSignature: params.input.mainGoal.toLowerCase().trim(),
    productSignature: params.input.products.map(product => product.name.toLowerCase()).sort().join('|'),
    previousCampaignAngles: [params.angle],
    previousBlueprintsUsed: params.tasks.map(task => task.blueprintId),
    previousCaptions: params.tasks.map(task => task.caption),
    previousTaskConcepts: params.tasks.map(task => task.visualConcept),
    previousCTAs: params.tasks.map(task => task.engagementHook),
    previousProductsHighlighted: params.input.products.map(product => product.name),
    previousTaskSignatures: params.tasks.map(buildTaskSignature),
    planSignature: buildPlanSignature(params.tasks),
    lastGeneratedAt: new Date().toISOString(),
  };
}
