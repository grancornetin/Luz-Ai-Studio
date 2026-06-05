import type { GeneratedTaskV2, PlanSkeletonTask } from './types';

export const CONTRACT_LOCKED_FIELDS = [
  'platform',
  'contentType',
  'funnelRole',
  'module',
  'supportModule',
  'ctaTarget',
  'estimatedEffort',
  'taskPriority',
  'date',
  'dayLabel',
  'blueprintId',
] as const;

export function validateContractLock(task: GeneratedTaskV2, skeleton: PlanSkeletonTask): string[] {
  return CONTRACT_LOCKED_FIELDS.flatMap(field =>
    task[field] === skeleton[field] ? [] : [`Contract Lock: ${field} fue modificado.`],
  );
}
