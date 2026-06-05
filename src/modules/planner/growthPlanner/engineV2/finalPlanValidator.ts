import type { GrowthStrategicPlan } from '../../growthPlannerTypes';
import { detectRepeatedBlueprints, detectRepeatedCaptions } from './antiRepetition';
import { validateTaskAgainstBlueprint } from './blueprintValidator';
import { findWeakCopyTerms, isActionableHook } from './copyRules';
import { hasSpanishOrthographyIssues } from './orthography';
import { dayLabelFromDate } from './planSkeletonGenerator';
import { validateSensitiveClaims } from './sensitiveGuardrails';
import { getBlueprintById } from './taskBlueprints';
import type { FinalValidationSummary, GeneratedTaskV2, PreviousPlanMemory } from './types';

const MIN_TASKS = { 7: 5, 14: 12, 30: 25 } as const;

function taskText(task: GeneratedTaskV2): string {
  return [
    task.visualConcept, task.whyItWorks, task.caption, task.prompt, task.supportPrompt || '', task.engagementHook,
    task.executionRecipe.overview, ...task.executionRecipe.steps.map(step => step.instruction),
    ...task.shotGuide.shots.map(shot => shot.instruction), ...task.shotGuide.onScreenText,
  ].join(' ');
}

export function validateFinalPlan(plan: GrowthStrategicPlan, previousPlans: PreviousPlanMemory[]): FinalValidationSummary {
  const tasks = plan.tasks as GeneratedTaskV2[];
  const blueprintResults = tasks.map(task => {
    const blueprint = getBlueprintById(task.blueprintId);
    return blueprint ? validateTaskAgainstBlueprint(task, blueprint) : { valid: false, errors: ['Blueprint inexistente.'], warnings: [] };
  });
  const dates = tasks.map(task => new Date(`${task.date}T12:00:00`));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const previous = previousPlans[0];
  const repeatedBlueprints = detectRepeatedBlueprints(tasks.map(task => task.blueprintId), previous?.previousBlueprintsUsed || []);
  const repeatedCaptions = detectRepeatedCaptions(tasks.map(task => task.caption), previous?.previousCaptions || []);
  const allText = tasks.map(taskText).join(' ');
  const efforts = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.estimatedEffort] = (acc[task.estimatedEffort] || 0) + 1;
    return acc;
  }, {});
  const primaryCount = tasks.filter(task => task.taskPriority === 'primary').length;
  const activeChannels = plan.brand.activeSocials.length ? plan.brand.activeSocials : ['Instagram Feed'];
  const noThreeHighEffortTasks = !tasks.some((task, index) => index >= 2
    && task.estimatedEffort === 'alto'
    && tasks[index - 1].estimatedEffort === 'alto'
    && tasks[index - 2].estimatedEffort === 'alto');
  const total = tasks.length || 1;
  const checks: Record<string, boolean> = {
    taskCountValid: tasks.length >= MIN_TASKS[plan.duration],
    datesValid: dates.every(date => !Number.isNaN(date.getTime())),
    noPastDates: dates.every(date => date >= today),
    dayLabelMatchesDate: tasks.every(task => task.dayLabel === dayLabelFromDate(task.date)),
    roadmapWeeksValid: plan.roadmap.length >= (plan.duration === 30 ? 4 : plan.duration === 14 ? 2 : 1),
    channelDistributionValid: tasks.every(task => activeChannels.includes(task.platform)),
    effortDistributionValid: plan.duration !== 30 || (
      (efforts.bajo || 0) >= Math.ceil(total * 0.35)
      && (efforts.medio || 0) >= Math.ceil(total * 0.35)
      && (efforts.alto || 0) <= Math.floor(total * 0.3)
      && noThreeHighEffortTasks
    ),
    priorityDistributionValid: primaryCount / total >= 0.6 && primaryCount / total <= 0.75,
    platformFormatValid: blueprintResults.every(result => !result.errors.some(error => /platform|contentType/.test(error))),
    platformCtaCoherenceValid: blueprintResults.every(result => !result.errors.some(error => /ctaTarget|Menciones incompatibles/.test(error))),
    primaryModuleActionValid: blueprintResults.every(result => !result.errors.some(error => /module/.test(error))),
    blueprintContractsValid: blueprintResults.every(result => result.valid),
    taskInternalCoherenceValid: blueprintResults.every(result => result.valid),
    slotsValid: blueprintResults.every(result => !result.errors.some(error => /slots/.test(error))),
    hashtagsValid: blueprintResults.every(result => !result.errors.some(error => /Hashtags/.test(error))),
    noNullCaptions: tasks.every(task => task.caption.trim() && !/^(null|undefined)$/i.test(task.caption.trim())),
    captionsNaturalValid: tasks.every(task => task.caption.length <= 600 && !findWeakCopyTerms(task.caption).length),
    noWeakPhrases: !findWeakCopyTerms(allText).length,
    spanishOrthographyValid: !hasSpanishOrthographyIssues(allText),
    actionableHooksValid: tasks.every(task => isActionableHook(task.engagementHook)),
    sensitiveClaimsValid: validateSensitiveClaims(allText).valid,
    antiRepetitionValid: !previous || repeatedBlueprints.length / total <= 0.6 && repeatedCaptions.length === 0,
    directPlanSalesPresent: plan.duration !== 30 || tasks.some(task => task.funnelRole === 'convertir'),
    productsNormalized: (plan.normalizedProducts || plan.products).length > 0,
  };
  const criticalNames = ['taskCountValid', 'datesValid', 'noPastDates'];
  const reviewNames = ['dayLabelMatchesDate', 'blueprintContractsValid', 'taskInternalCoherenceValid', 'sensitiveClaimsValid'];
  const criticalErrors = criticalNames.filter(name => !checks[name]);
  const reviewWarnings = reviewNames.filter(name => !checks[name]);
  const status = criticalErrors.length ? 'failed_validation' : reviewWarnings.length ? 'needs_review' : 'ready';
  return { status, checks, criticalErrors, reviewWarnings };
}
