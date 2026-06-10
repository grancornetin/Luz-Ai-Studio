import type { BusinessArchetype, GeneratedTaskV2 } from './types';

const SLOT_PATTERN = /@[a-zA-Z0-9_]+/g;

export const SLOT_REGISTRY_V2: Record<string, string> = {
  '@producto1': 'Imagen principal del producto o servicio destacado.',
  '@producto2': 'Imagen secundaria de otro producto o servicio destacado.',
  '@producto3': 'Imagen de apoyo de un tercer producto o servicio.',
  '@plan1': 'Información visual del primer plan o suscripción.',
  '@plan2': 'Información visual del segundo plan o suscripción.',
  '@plan3': 'Información visual del tercer plan o suscripción.',
  '@plan4': 'Información visual del cuarto plan o suscripción.',
  '@app_screen1': 'Captura o mockup de la interfaz de Luz IA Studio mostrando el flujo de generación.',
  '@resultado1': 'Ejemplo de imagen final generada con Luz IA Studio.',
  '@comparativa1': 'Comparativa visual de planes con precio, créditos y beneficio principal.',
  '@testimonio1': 'Testimonio real autorizado con contexto suficiente.',
  '@logo1': 'Logo oficial de la marca en buena resolución.',
};

const SAAS_ALIASES: Record<string, string> = {
  '@producto1': '@plan1',
  '@producto2': '@plan2',
  '@producto3': '@plan3',
  '@plan_explorer': '@plan1',
  '@plan_starter': '@plan2',
  '@plan_pro': '@plan3',
  '@plan_studio': '@plan4',
};

export interface SlotNormalizationResult {
  task: GeneratedTaskV2;
  aliasesNormalized: string[];
  missingInstructionsAdded: string[];
  unresolvedSlots: string[];
}

function canonicalSlot(slot: string, archetype: BusinessArchetype): string {
  return archetype === 'saas_subscription' ? SAAS_ALIASES[slot.toLowerCase()] || slot : slot;
}

function replaceSlots(value: string, archetype: BusinessArchetype, aliases: string[]): string {
  return String(value || '').replace(SLOT_PATTERN, slot => {
    const canonical = canonicalSlot(slot, archetype);
    if (canonical !== slot) aliases.push(`${slot} -> ${canonical}`);
    return canonical;
  });
}

export function normalizeSlotsV2(task: GeneratedTaskV2, archetype: BusinessArchetype): SlotNormalizationResult {
  const aliasesNormalized: string[] = [];
  const text = (value: string) => replaceSlots(value, archetype, aliasesNormalized);
  const next: GeneratedTaskV2 = {
    ...task,
    visualConcept: text(task.visualConcept),
    whyItWorks: text(task.whyItWorks),
    caption: text(task.caption),
    prompt: text(task.prompt),
    supportPrompt: task.supportPrompt ? text(task.supportPrompt) : undefined,
    requiredAssets: task.requiredAssets.map(text),
    executionRecipe: {
      ...task.executionRecipe,
      overview: text(task.executionRecipe.overview),
      steps: task.executionRecipe.steps.map(step => ({ ...step, instruction: text(step.instruction) })),
    },
    shotGuide: {
      ...task.shotGuide,
      shots: task.shotGuide.shots.map(shot => ({ ...shot, instruction: text(shot.instruction) })),
      onScreenText: task.shotGuide.onScreenText.map(text),
      inspirationSearches: task.shotGuide.inspirationSearches.map(text),
      whatToAvoid: task.shotGuide.whatToAvoid.map(text),
    },
    engagementHook: text(task.engagementHook),
    slotInstructions: task.slotInstructions.map(item => ({
      slot: canonicalSlot(item.slot, archetype),
      instruction: text(item.instruction),
    })),
  };
  const visibleText = [
    next.visualConcept, next.whyItWorks, next.caption, next.prompt, next.supportPrompt || '',
    ...next.requiredAssets, next.executionRecipe.overview,
    ...next.executionRecipe.steps.map(step => step.instruction),
    ...next.shotGuide.shots.map(shot => shot.instruction), ...next.shotGuide.onScreenText,
  ].join(' ');
  const used = Array.from(new Set(visibleText.match(SLOT_PATTERN) || []));
  const described = new Set(next.slotInstructions.map(item => item.slot));
  const missingInstructionsAdded: string[] = [];
  used.forEach(slot => {
    if (described.has(slot) || !SLOT_REGISTRY_V2[slot]) return;
    next.slotInstructions.push({ slot, instruction: SLOT_REGISTRY_V2[slot] });
    described.add(slot);
    missingInstructionsAdded.push(slot);
  });
  return {
    task: next,
    aliasesNormalized: Array.from(new Set(aliasesNormalized)),
    missingInstructionsAdded,
    unresolvedSlots: used.filter(slot => !described.has(slot)),
  };
}
