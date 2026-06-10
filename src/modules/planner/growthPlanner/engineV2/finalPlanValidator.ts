import type { GrowthStrategicPlan } from '../../growthPlannerTypes';
import { buildPlanSignature, buildTaskSignature, calculateTaskNoveltyScore, detectRepeatedCaptions } from './antiRepetition';
import { validateTaskAgainstBlueprint } from './blueprintValidator';
import { validateHooksV2, validateWeakPhrasesV2 } from './copyRules';
import { hasSpanishOrthographyIssues } from './orthography';
import { dayLabelFromDate } from './planSkeletonGenerator';
import { validateSensitiveClaims } from './sensitiveGuardrails';
import { getBlueprintById } from './taskBlueprints';
import { hasDeterministicFallback } from './deterministicCompletion';
import { findVisiblePlaceholderFields, findVisibleWeakPhraseOccurrences } from './visibleOutputValidation';
import type { BusinessArchetype, FinalValidationSummary, GeneratedTaskV2, PreviousPlanMemory } from './types';

const MIN_TASKS = { 7: 5, 14: 12, 30: 25 } as const;

function taskText(task: GeneratedTaskV2): string {
  return [
    task.visualConcept, task.whyItWorks, task.caption, task.prompt, task.supportPrompt || '', task.engagementHook,
    task.executionRecipe.overview, ...task.executionRecipe.steps.map(step => step.instruction),
    ...task.shotGuide.shots.map(shot => shot.instruction), ...task.shotGuide.onScreenText,
    ...task.shotGuide.inspirationSearches, ...task.shotGuide.whatToAvoid,
  ].join(' ');
}

function isHardBlueprintContractError(error: string): boolean {
  return !/Hook |Caption |frases débiles|Hashtags|acentos/i.test(error);
}

export function validateFinalPlan(
  plan: GrowthStrategicPlan,
  previousPlans: PreviousPlanMemory[],
  businessArchetype: BusinessArchetype = 'other',
): FinalValidationSummary {
  const tasks = plan.tasks as GeneratedTaskV2[];
  const blueprintResults = tasks.map(task => {
    const blueprint = getBlueprintById(task.blueprintId);
    return blueprint ? validateTaskAgainstBlueprint(task, blueprint, { businessArchetype }) : { valid: false, errors: ['Blueprint inexistente.'], warnings: [] };
  });
  const dates = tasks.map(task => new Date(`${task.date}T12:00:00`));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const previous = previousPlans[0];
  const repeatedCaptions = detectRepeatedCaptions(tasks.map(task => task.caption), previous?.previousCaptions || []);
  const taskNoveltyScore = calculateTaskNoveltyScore(tasks, previous);
  const signatureCounts = tasks.map(buildTaskSignature).reduce<Record<string, number>>((acc, signature) => {
    acc[signature] = (acc[signature] || 0) + 1;
    return acc;
  }, {});
  const repeatedTaskSignatures = Object.values(signatureCounts).filter(count => count > 3);
  const currentCaptionCounts = tasks.map(task => task.caption.toLowerCase().replace(/\s+/g, ' ').trim()).reduce<Record<string, number>>((acc, caption) => {
    if (caption) acc[caption] = (acc[caption] || 0) + 1;
    return acc;
  }, {});
  const repeatedCurrentCaptions = Object.values(currentCaptionCounts).some(count => count > 1);
  const repeatsPreviousSequence = Boolean(previous?.planSignature && previous.planSignature === buildPlanSignature(tasks));
  const currentAngle = tasks[0]?.campaignAngle;
  const normalizedGoal = plan.mainGoal.toLowerCase().replace(/\s+/g, ' ').trim();
  const repeatsCampaignAngleThreeTimes = Boolean(currentAngle && previousPlans.slice(0, 2).length === 2
    && previousPlans.slice(0, 2).every(memory =>
      memory.previousCampaignAngles.includes(currentAngle)
      && memory.objectiveSignature.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedGoal,
    ));
  const allText = [
    tasks.map(taskText).join(' '),
    plan.strategyGoal, plan.businessDiagnosis, plan.planNarrative, plan.strategicTip,
    ...plan.nicheInsights,
    ...plan.roadmap.flatMap(item => [item.title, item.objective, item.hint]),
  ].join(' ');
  const visibleWeakPhrases = findVisibleWeakPhraseOccurrences(plan);
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
  const placeholderFields = findVisiblePlaceholderFields(plan);
  const manualReviewCount = tasks.filter(task => task.needsManualReview).length;
  const checks: Record<string, boolean> = {
    taskCountValid: tasks.length >= MIN_TASKS[plan.duration],
    datesValid: dates.every(date => !Number.isNaN(date.getTime())),
    noPastDates: dates.every(date => date >= today),
    dayLabelMatchesDate: tasks.every(task => task.dayLabel === dayLabelFromDate(task.date)),
    roadmapWeeksValid: plan.roadmap.length >= (plan.duration === 30 ? 4 : plan.duration === 14 ? 2 : 1),
    channelDistributionValid: tasks.every(task => activeChannels.includes(task.platform)),
    effortDistributionValid: plan.duration !== 30 || (
      (efforts.bajo || 0) >= Math.ceil(total * 0.3)
      && (efforts.medio || 0) >= Math.ceil(total * 0.3)
      && (efforts.alto || 0) <= Math.floor(total * 0.3)
      && noThreeHighEffortTasks
    ),
    effortDistributionIdeal: plan.duration !== 30 || (
      (efforts.bajo || 0) >= Math.ceil(total * 0.35)
      && (efforts.medio || 0) >= Math.ceil(total * 0.35)
      && (efforts.alto || 0) <= Math.floor(total * 0.3)
    ),
    priorityDistributionValid: primaryCount / total >= 0.6 && primaryCount / total <= 0.8,
    priorityDistributionIdeal: primaryCount / total >= 0.6 && primaryCount / total <= 0.75,
    platformFormatValid: blueprintResults.every(result => !result.errors.some(error => /platform|contentType/.test(error))),
    platformCtaCoherenceValid: blueprintResults.every(result => !result.errors.some(error => /ctaTarget|Menciones incompatibles|Hook no coincide/.test(error))),
    primaryModuleActionValid: blueprintResults.every(result => !result.errors.some(error => /module/.test(error))),
    blueprintContractsValid: blueprintResults.every(result => !result.errors.some(isHardBlueprintContractError)),
    taskInternalCoherenceValid: blueprintResults.every(result => !result.errors.some(error =>
      /platform|contentType|funnelRole|ctaTarget|Menciones incompatibles|dayLabel/i.test(error),
    )),
    slotsValid: blueprintResults.every(result => !result.errors.some(error => /slot/i.test(error))),
    hashtagsValid: blueprintResults.every(result => !result.errors.some(error => /Hashtags/.test(error))),
    noNullCaptions: tasks.every(task => task.caption.trim() && !/^(null|undefined)$/i.test(task.caption.trim())),
    captionsNaturalValid: tasks.every(task => task.caption.length <= 600 && !validateWeakPhrasesV2(task.caption).length),
    noWeakPhrases: visibleWeakPhrases.length === 0,
    spanishOrthographyValid: !hasSpanishOrthographyIssues(allText),
    actionableHooksValid: tasks.every(task => validateHooksV2(task.engagementHook, task.ctaTarget).valid),
    sensitiveClaimsValid: validateSensitiveClaims(allText, businessArchetype).valid,
    antiRepetitionValid: repeatedTaskSignatures.length === 0
      && !repeatedCurrentCaptions
      && !repeatsCampaignAngleThreeTimes
      && (!previous || taskNoveltyScore >= 60 && repeatedCaptions.length === 0 && !repeatsPreviousSequence),
    noPlaceholderTasks: placeholderFields.length === 0,
    manualReviewRatioValid: manualReviewCount <= 2,
    fallbackCompletionValid: tasks.every(task => {
      const blueprint = getBlueprintById(task.blueprintId);
      return Boolean(blueprint && hasDeterministicFallback(blueprint));
    }),
    directPlanSalesPresent: plan.duration !== 30 || tasks.some(task => task.funnelRole === 'convertir'),
    productsNormalized: (plan.normalizedProducts || plan.products).length > 0,
  };
  const criticalNames = ['taskCountValid', 'datesValid', 'noPastDates', 'noPlaceholderTasks'];
  if (manualReviewCount > 2) criticalNames.push('manualReviewRatioValid');
  const reviewNames = [
    'dayLabelMatchesDate', 'blueprintContractsValid', 'taskInternalCoherenceValid',
    'sensitiveClaimsValid', 'manualReviewRatioValid', 'slotsValid', 'actionableHooksValid',
    'platformCtaCoherenceValid', 'noWeakPhrases', 'antiRepetitionValid', 'fallbackCompletionValid',
  ];
  const criticalErrors = criticalNames.filter(name => !checks[name]);
  const reviewWarnings = reviewNames.filter(name => !checks[name]);
  const status = criticalErrors.length ? 'failed_validation' : reviewWarnings.length ? 'needs_review' : 'ready';
  return { status, checks, criticalErrors, reviewWarnings };
}
