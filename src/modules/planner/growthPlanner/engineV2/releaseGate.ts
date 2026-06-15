import type { GrowthStrategicPlan } from '../../growthPlannerTypes';
import { findVisiblePlaceholderFields, findVisibleWeakPhraseOccurrences } from './visibleOutputValidation';
import type { EngineV2Metadata, FinalValidationSummary, ReleaseGateResult } from './types';

const HARD_CHECKS = [
  'taskCountValid', 'datesValid',
];

const REVIEW_CHECKS = [
  'captionsNaturalValid', 'actionableHooksValid', 'noWeakPhrases', 'spanishOrthographyValid',
  'fallbackCompletionValid', 'blueprintContractsValid', 'taskInternalCoherenceValid', 'slotsValid',
  'platformCtaCoherenceValid', 'platformFormatValid', 'primaryModuleActionValid', 'sensitiveClaimsValid',
  'noPastDates', 'noPlaceholderTasks',
  'correctBusinessArchetype', 'correctAdapter', 'noForbiddenAdapterVocabulary', 'noForbiddenBlueprints',
  'noSaasLeakage', 'noRawPlanSlotsForPhysicalProducts', 'adapterIsolationValid',
];

export function validateValidationConsistency(
  plan: GrowthStrategicPlan,
  validationSummary: FinalValidationSummary,
  metadata: EngineV2Metadata,
): { summary: FinalValidationSummary; contradictions: string[]; correctedChecks: string[] } {
  const checks = { ...validationSummary.checks };
  const contradictions: string[] = [];
  const correctedChecks: string[] = [];
  const correct = (name: string, value: boolean, reason: string) => {
    if (checks[name] === value) return;
    contradictions.push(reason);
    checks[name] = value;
    correctedChecks.push(name);
  };

  const visibleWeakPhrases = findVisibleWeakPhraseOccurrences(plan);
  const visiblePlaceholders = findVisiblePlaceholderFields(plan);
  metadata.weakPhraseSummary.remainingWeakPhrases = Array.from(new Set(visibleWeakPhrases.map(item => item.phrase)));
  metadata.weakPhraseSummary.occurrences = visibleWeakPhrases;
  correct('noWeakPhrases', visibleWeakPhrases.length === 0, 'noWeakPhrases no coincidía con el contenido visible.');
  correct('noPlaceholderTasks', visiblePlaceholders.length === 0, 'noPlaceholderTasks no coincidía con el contenido visible.');
  if (metadata.tasksMarkedForReview !== metadata.tasksNeedingManualReview.length) {
    contradictions.push('tasksMarkedForReview no coincidía con tasksNeedingManualReview.');
    metadata.tasksMarkedForReview = metadata.tasksNeedingManualReview.length;
    correctedChecks.push('tasksMarkedForReview');
  }
  correct('manualReviewRatioValid', metadata.tasksNeedingManualReview.length <= 2, 'manualReviewRatioValid no coincidía con tasksNeedingManualReview.');
  correct('fallbackCompletionValid', metadata.fallbackCompletion.blueprintsMissingFallback.length === 0, 'fallbackCompletionValid no coincidía con blueprintsMissingFallback.');
  correct('slotsValid', metadata.slotNormalizationSummary.unresolvedSlots.length === 0, 'slotsValid no coincidía con unresolvedSlots.');

  const unresolvedRejectedHooks = metadata.hookValidationSummary.hooksRejectedAndRebuilt.filter(id =>
    !metadata.hookValidationSummary.hooksBuiltByFactory.includes(id)
    && !metadata.hookValidationSummary.hooksAcceptedFromGemini.includes(id),
  );
  if (unresolvedRejectedHooks.length) correct('actionableHooksValid', false, 'Hay hooks rechazados sin reconstrucción válida.');

  const antiRepetitionShouldBeValid = metadata.noveltyScore >= 60
    && metadata.antiRepetitionSummary.repeatedTaskSignaturesRejected.length === 0
    && metadata.repeatedCaptionsDetected.length === 0
    && !metadata.antiRepetitionSummary.sameBlueprintSequenceRepeated
    && !metadata.antiRepetitionSummary.sameCampaignAngleRepeatedThreeTimes
    && metadata.antiRepetitionSummary.similarTaskSignatureRatio <= 0.6;
  correct('antiRepetitionValid', antiRepetitionShouldBeValid, 'antiRepetitionValid no coincidía con la evidencia de repetición.');

  const hasDerivedReviewIssue = [
    ...HARD_CHECKS,
    ...REVIEW_CHECKS,
    'manualReviewRatioValid',
    'antiRepetitionValid',
  ].some(check => checks[check] === false)
    || metadata.tasksNeedingManualReview.length > 0
    || metadata.antiRepetitionSummary.repeatedTaskSignaturesRejected.length > 0
    || metadata.repeatedCaptionsDetected.length > 0
    || metadata.noveltyScore < 60;
  if (metadata.planQualityStatus === 'needs_review' && !hasDerivedReviewIssue) {
    contradictions.push('planQualityStatus era needs_review sin advertencias o fallos reales.');
    correctedChecks.push('planQualityStatus');
  }

  return {
    summary: { ...validationSummary, checks },
    contradictions,
    correctedChecks,
  };
}

export function evaluatePlanReleaseGate(
  plan: GrowthStrategicPlan,
  validationSummary: FinalValidationSummary,
  metadata: EngineV2Metadata,
): ReleaseGateResult {
  const hardFailures = HARD_CHECKS.filter(check => validationSummary.checks[check] === false);
  if ((plan.generationLog.generatedTasks || plan.tasks.length) < (plan.generationLog.expectedTasks || plan.tasks.length)) {
    hardFailures.push('generatedTasksBelowExpected');
  }
  const softWarnings = REVIEW_CHECKS.filter(check => validationSummary.checks[check] === false);
  if (metadata.tasksNeedingManualReview.length > 0) {
    softWarnings.push(`${metadata.tasksNeedingManualReview.length} tarea(s) requieren revisión manual.`);
  }
  if (metadata.noveltyScore < 60) softWarnings.push('La novedad del plan es menor a 60.');
  else if (metadata.noveltyScore < 70) softWarnings.push('La novedad del plan está entre 60 y 69.');
  if (metadata.antiRepetitionSummary.repeatedTaskSignaturesRejected.length) softWarnings.push('Hay firmas de tareas repetidas que requieren revisión.');
  if (metadata.repeatedCaptionsDetected.length) softWarnings.push('Hay captions reales repetidos.');
  if (metadata.antiRepetitionSummary.sameBlueprintSequenceRepeated) softWarnings.push('Se repitió la misma secuencia de blueprints del plan anterior.');
  if (metadata.antiRepetitionSummary.sameCampaignAngleRepeatedThreeTimes) softWarnings.push('El mismo ángulo comercial se repitió tres planes seguidos con un objetivo similar.');
  if (metadata.antiRepetitionSummary.similarTaskSignatureRatio > 0.6) softWarnings.push('Más del 60% de las firmas de tareas son similares al plan anterior.');
  if (metadata.researchMode === 'gemini_without_grounding') softWarnings.push('Los insights de nicho fueron generados sin búsqueda web/grounding.');
  if (plan.productAnalysis.productWarnings.length) softWarnings.push(...plan.productAnalysis.productWarnings);
  if (metadata.antiRepetitionSummary.repeatedBlueprintsAllowed.length && validationSummary.checks.antiRepetitionValid) {
    softWarnings.push('Se repitieron algunos blueprints permitidos, pero el plan mantiene novedad suficiente.');
  }

  const consistencyProblems = metadata.validationConsistency.valid
    ? []
    : metadata.validationConsistency.contradictions;
  const blockingReasons = [...hardFailures];
  if (consistencyProblems.length) blockingReasons.push('Inconsistencia interna del reporte de validación.');
  const hasReviewIssue = softWarnings.some(warning =>
    /captionsNaturalValid|actionableHooksValid|noWeakPhrases|spanishOrthographyValid|menor a 60|firmas de tareas|captions reales|requieren revisión manual|misma secuencia|tres planes seguidos|más del 60%/i.test(warning),
  );
  const planQualityStatus = hardFailures.length
    ? 'failed_validation'
    : blockingReasons.length || hasReviewIssue
      ? 'needs_review'
      : 'ready';
  return {
    canPublishToUser: planQualityStatus === 'ready',
    planQualityStatus,
    hardFailures: Array.from(new Set(hardFailures)),
    softWarnings: Array.from(new Set(softWarnings)),
    blockingReasons: Array.from(new Set(blockingReasons)),
    releaseNotes: planQualityStatus === 'ready'
      ? ['El plan pasó los contratos y puede mostrarse al usuario.']
      : ['El plan requiere resolver las razones de bloqueo antes de publicarse.'],
  };
}
