import { validateHooksV2, validateWeakPhrasesV2 } from './copyRules';
import { hasSpanishOrthographyIssues } from './orthography';
import { dayLabelFromDate } from './planSkeletonGenerator';
import { validateSensitiveClaims } from './sensitiveGuardrails';
import { validateSlotsV2 } from './slots';
import type { BlueprintValidationResult, BusinessArchetype, GeneratedTaskV2, TaskBlueprint } from './types';
const OTHER_PLATFORM_TERMS: Record<GeneratedTaskV2['platform'], string[]> = {
  'Instagram Feed': ['responde esta story', 'sticker de story', 'publicar en facebook'],
  Stories: ['publicar en facebook', 'carrusel de feed', 'comenta en facebook'],
  Facebook: ['responde esta story', 'sticker de instagram'],
  TikTok: ['publicar en facebook', 'sticker de story'],
  WhatsApp: ['publicar en', 'link en bio', '#'],
};

function taskCreativeText(task: GeneratedTaskV2): string {
  return [
    task.visualConcept, task.whyItWorks, task.caption, task.prompt, task.supportPrompt || '',
    task.engagementHook, task.executionRecipe.overview,
    ...task.executionRecipe.steps.map(step => step.instruction),
    ...task.shotGuide.shots.map(shot => shot.instruction),
    ...task.shotGuide.onScreenText,
    ...task.shotGuide.inspirationSearches,
    ...task.shotGuide.whatToAvoid,
  ].join(' ');
}

export function validateTaskAgainstBlueprint(
  task: GeneratedTaskV2,
  blueprint: TaskBlueprint,
  options: { businessArchetype?: BusinessArchetype } = {},
): BlueprintValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const text = taskCreativeText(task);
  const lower = text.toLowerCase();

  if (task.blueprintId !== blueprint.id) errors.push('blueprintId no coincide.');
  if (task.platform !== blueprint.platform) errors.push('platform no coincide con blueprint.');
  if (task.contentType !== blueprint.contentType) errors.push('contentType no coincide con blueprint.');
  if (task.funnelRole !== blueprint.funnelRole) errors.push('funnelRole no coincide con blueprint.');
  if (!blueprint.allowedModules.includes(task.module)) errors.push('module no permitido por blueprint.');
  if (!['bajo', 'medio', 'alto'].includes(task.estimatedEffort)) errors.push('estimatedEffort inválido.');
  if (!['primary', 'support'].includes(task.taskPriority)) errors.push('taskPriority inválido.');
  if (!blueprint.ctaTargets.includes(task.ctaTarget)) errors.push('ctaTarget no permitido por blueprint.');
  if (task.dayLabel !== dayLabelFromDate(task.date)) errors.push('dayLabel no coincide con date.');
  if (task.module === 'none' && task.prompt.trim()) errors.push('module none debe tener prompt vacío.');
  if (blueprint.promptPolicy === 'required_primary' && !task.prompt.trim()) errors.push('El blueprint requiere prompt principal.');
  if (blueprint.promptPolicy === 'required_support' && !task.supportPrompt?.trim()) errors.push('El blueprint requiere prompt de apoyo.');
  if (blueprint.promptPolicy === 'none' && (task.prompt.trim() || task.supportPrompt?.trim())) errors.push('El blueprint no permite prompts.');
  if (task.supportPrompt && !task.supportModule) errors.push('supportPrompt requiere supportModule.');
  if (task.supportModule && blueprint.allowedSupportModules?.length && !blueprint.allowedSupportModules.includes(task.supportModule)) {
    errors.push('supportModule no permitido por blueprint.');
  }
  if (task.platform === 'WhatsApp' && task.hashtags.trim()) errors.push('WhatsApp no admite hashtags.');
  if (task.platform !== 'WhatsApp' && task.hashtags.trim()) {
    const tags = task.hashtags.trim().split(/\s+/);
    if (tags.some(tag => !tag.startsWith('#')) || tags.length > 10 || /#viral|#fyp|#parati/i.test(task.hashtags)) {
      errors.push('Hashtags inválidos o poco específicos.');
    }
  }
  if (!task.caption.trim() || /^(null|undefined)$/i.test(task.caption.trim())) errors.push('caption vacío o null.');
  if (task.caption.length > 600) errors.push('Caption demasiado largo.');
  errors.push(...validateHooksV2(task.engagementHook, task.ctaTarget).errors);

  const forbidden = blueprint.forbiddenTerms.filter(term => lower.includes(term.toLowerCase()));
  if (forbidden.length) errors.push(`Términos prohibidos: ${forbidden.join(', ')}.`);
  const otherPlatforms = OTHER_PLATFORM_TERMS[task.platform].filter(term => lower.includes(term));
  if (otherPlatforms.length) errors.push(`Menciones incompatibles: ${otherPlatforms.join(', ')}.`);
  const missingRequired = blueprint.requiredTerms.filter(term => !lower.includes(term.toLowerCase()));
  if (missingRequired.length) errors.push(`Términos requeridos ausentes: ${missingRequired.join(', ')}.`);

  errors.push(...validateSlotsV2(task, blueprint, options.businessArchetype || 'other'));
  const weakTerms = validateWeakPhrasesV2(text);
  if (weakTerms.length) {
    const hookCaptionWeakTerms = new Set([
      ...validateWeakPhrasesV2(task.caption),
      ...validateWeakPhrasesV2(task.engagementHook),
    ]);
    const onlyHookCaption = weakTerms.every(term => hookCaptionWeakTerms.has(term));
    errors.push(onlyHookCaption ? 'Caption o hook contiene frases débiles.' : 'Hay frases débiles fuera de caption/hook.');
  }
  if (hasSpanishOrthographyIssues(text)) warnings.push('Hay posibles acentos pendientes.');
  const sensitiveClaims = validateSensitiveClaims(text, options.businessArchetype);
  if (!sensitiveClaims.valid) errors.push('Hay claims sensibles o riesgosos.');
  warnings.push(...sensitiveClaims.warnings);
  if (!task.executionRecipe.steps.length) errors.push('La receta no tiene pasos.');

  return { valid: errors.length === 0, errors, warnings };
}

export const validateBlueprintContractV2 = validateTaskAgainstBlueprint;
