import type { BusinessArchetype, GeneratedTaskV2, TaskBlueprint } from './types';
import { normalizeSlotsV2 } from './slotRegistry';

const SAAS_SLOT_ALIASES: Record<string, string[]> = {
  '@producto1': ['@producto1', '@plan1'],
  '@producto2': ['@producto2', '@plan2'],
  '@producto3': ['@producto3', '@plan3'],
  '@plan1': ['@plan1', '@producto1'],
  '@plan2': ['@plan2', '@producto2'],
  '@plan3': ['@plan3', '@producto3'],
  '@app_screen1': ['@app_screen1'],
  '@resultado1': ['@resultado1'],
  '@comparativa1': ['@comparativa1'],
};

const SLOT_PATTERN = /@[a-zA-Z0-9_]+/g;

export function requiredSlotsForArchetype(blueprint: TaskBlueprint, archetype: BusinessArchetype): string[] {
  if (archetype !== 'saas_subscription') return blueprint.requiredSlots;
  return blueprint.requiredSlots.map(slot => slot === '@producto1' ? '@plan1' : slot);
}

export function validateSlotsV2(
  task: GeneratedTaskV2,
  blueprint: TaskBlueprint,
  archetype: BusinessArchetype,
): string[] {
  const normalized = normalizeSlotsV2(task, archetype);
  if (normalized.unresolvedSlots.length) return normalized.unresolvedSlots.map(slot => `Slot ${slot} usado sin instrucción equivalente.`);
  task = normalized.task;
  const text = [
    task.prompt,
    task.supportPrompt || '',
    ...task.slotInstructions.map(slot => `${slot.slot} ${slot.instruction}`),
  ].join(' ');
  const usedSlots = Array.from(new Set(text.match(SLOT_PATTERN) || []));
  const describedSlots = new Set(task.slotInstructions.map(slot => slot.slot));
  const errors: string[] = [];

  usedSlots.forEach(slot => {
    const aliases = archetype === 'saas_subscription' ? SAAS_SLOT_ALIASES[slot] || [slot] : [slot];
    if (!aliases.some(alias => describedSlots.has(alias))) errors.push(`Slot ${slot} usado sin instrucción equivalente.`);
  });

  requiredSlotsForArchetype(blueprint, archetype).forEach(required => {
    const aliases = archetype === 'saas_subscription' ? SAAS_SLOT_ALIASES[required] || [required] : [required];
    if (!aliases.some(alias => usedSlots.includes(alias))) errors.push(`Falta slot requerido ${required}.`);
  });
  return errors;
}
