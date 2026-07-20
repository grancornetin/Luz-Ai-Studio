import type { GrowthStrategicPlan, GrowthTask } from '../../growthPlannerTypes';
import { validateWeakPhrasesV2 } from './copyRules';
import type { WeakPhraseOccurrence } from './types';

export const PLACEHOLDER_PATTERN = /tarea pendiente de revisi[oó]n|revisa esta tarea|no se recibi[oó] una respuesta creativa v[aá]lida|completa la tarea antes de publicarla|revisar manualmente/i;

interface VisibleField {
  taskId?: string;
  field: string;
  value: string;
}

function taskVisibleFields(task: GrowthTask): VisibleField[] {
  return [
    { taskId: task.id, field: 'visualConcept', value: task.visualConcept },
    { taskId: task.id, field: 'whyItWorks', value: task.whyItWorks },
    { taskId: task.id, field: 'caption', value: task.caption },
    { taskId: task.id, field: 'prompt', value: task.prompt },
    { taskId: task.id, field: 'supportPrompt', value: task.supportPrompt || '' },
    { taskId: task.id, field: 'executionRecipe.overview', value: task.executionRecipe.overview },
    ...task.executionRecipe.steps.map((step, index) => ({ taskId: task.id, field: `executionRecipe.steps[${index}].instruction`, value: step.instruction })),
    { taskId: task.id, field: 'shotGuide.duration', value: task.shotGuide.duration },
    ...task.shotGuide.shots.map((shot, index) => ({ taskId: task.id, field: `shotGuide.shots[${index}].instruction`, value: shot.instruction })),
    ...task.shotGuide.onScreenText.map((value, index) => ({ taskId: task.id, field: `shotGuide.onScreenText[${index}]`, value })),
    ...task.shotGuide.inspirationSearches.map((value, index) => ({ taskId: task.id, field: `shotGuide.inspirationSearches[${index}]`, value })),
    ...task.shotGuide.whatToAvoid.map((value, index) => ({ taskId: task.id, field: `shotGuide.whatToAvoid[${index}]`, value })),
    { taskId: task.id, field: 'engagementHook', value: task.engagementHook },
    { taskId: task.id, field: 'hashtags', value: task.hashtags },
  ];
}

export function visiblePlanFields(plan: GrowthStrategicPlan): VisibleField[] {
  return [
    { field: 'planNarrative', value: plan.planNarrative },
    { field: 'strategicTip', value: plan.strategicTip },
    ...plan.roadmap.flatMap((item, index) => [
      { field: `roadmap[${index}].title`, value: item.title },
      { field: `roadmap[${index}].objective`, value: item.objective },
      { field: `roadmap[${index}].hint`, value: item.hint },
    ]),
    ...plan.tasks.flatMap(taskVisibleFields),
  ];
}

function snippetAround(value: string, phrase: string): string {
  const index = value.toLowerCase().indexOf(phrase.toLowerCase());
  if (index < 0) return value.slice(0, 120);
  return value.slice(Math.max(0, index - 35), Math.min(value.length, index + phrase.length + 55)).trim();
}

export function findVisibleWeakPhraseOccurrences(plan: GrowthStrategicPlan): WeakPhraseOccurrence[] {
  return visiblePlanFields(plan).flatMap(field =>
    validateWeakPhrasesV2(field.value).map(phrase => ({
      taskId: field.taskId,
      field: field.field,
      phrase,
      snippet: snippetAround(field.value, phrase),
    })),
  );
}

export function findVisiblePlaceholderFields(plan: GrowthStrategicPlan): VisibleField[] {
  return visiblePlanFields(plan).filter(field => PLACEHOLDER_PATTERN.test(field.value));
}
