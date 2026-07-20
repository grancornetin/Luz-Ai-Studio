import type { GeneratedTaskV2 } from './types';
import { normalizeSpanishText } from './orthography';
import { sanitizePlannerText } from './inputSanitizer';

function normalizeList(values: string[]): string[] {
  return values.map(value => sanitizePlannerText(normalizeSpanishText(value)).value).map(value => value.trim()).filter(Boolean);
}

export function normalizeCreativeTextV2(task: GeneratedTaskV2): GeneratedTaskV2 {
  const text = (value: string) => sanitizePlannerText(normalizeSpanishText(String(value || '').trim())).value;
  const hashtags = task.platform === 'WhatsApp' || task.module === 'none'
    ? ''
    : Array.from(new Set(task.hashtags.split(/\s+/).filter(tag => /^#[\p{L}\p{N}_]+$/u.test(tag) && !/#viral|#fyp|#parati/i.test(tag)))).slice(0, 10).join(' ');
  return {
    ...task,
    visualConcept: text(task.visualConcept),
    whyItWorks: text(task.whyItWorks),
    caption: text(task.caption),
    hashtags,
    prompt: task.module === 'none' ? '' : text(task.prompt),
    supportPrompt: task.supportModule && task.supportPrompt ? text(task.supportPrompt) : undefined,
    slotInstructions: task.slotInstructions.map(slot => ({ ...slot, instruction: text(slot.instruction) })),
    requiredAssets: normalizeList(task.requiredAssets),
    executionRecipe: {
      ...task.executionRecipe,
      overview: text(task.executionRecipe.overview),
      steps: task.executionRecipe.steps.slice(0, 3).map(step => ({
        ...step,
        title: text(step.title),
        instruction: text(step.instruction),
        ctaLabel: text(step.ctaLabel),
      })),
    },
    shotGuide: {
      ...task.shotGuide,
      duration: text(task.shotGuide.duration),
      shots: task.shotGuide.shots.slice(0, 3).map(shot => ({ ...shot, duration: text(shot.duration), instruction: text(shot.instruction) })),
      onScreenText: normalizeList(task.shotGuide.onScreenText),
      inspirationSearches: normalizeList(task.shotGuide.inspirationSearches),
      whatToAvoid: normalizeList(task.shotGuide.whatToAvoid),
    },
    engagementHook: text(task.engagementHook),
  };
}
