import type { GrowthStrategicPlan } from '../../growthPlannerTypes';
import type { EngineV2Metadata, GeneratedTaskV2 } from './types';

export function buildEngineV2ValidationReport(plan: GrowthStrategicPlan, metadata: EngineV2Metadata): string {
  const tasks = plan.tasks as GeneratedTaskV2[];
  const checkLines = Object.entries(metadata.finalValidationSummary.checks)
    .map(([name, valid]) => `- ${name}: ${valid ? 'sí' : 'no'}`)
    .join('\n');
  const reviewTasks = tasks.filter(task => task.needsManualReview);
  return `# Planner Engine V2 Validation Report

## Motor
- Versión: ${metadata.plannerEngineVersion}
- Estado: ${metadata.planQualityStatus}
- Arquetipo: ${metadata.businessArchetype}
- Adaptador: ${metadata.nicheAdapterUsed}
- Ángulo: ${metadata.campaignAngle}
- Semilla creativa: ${metadata.creativeSeed}
- Novelty score: ${metadata.noveltyScore}
- Research mode: ${metadata.researchMode}

## Estructura
- Duración: ${plan.duration} días
- Tareas: ${tasks.length}
- Semanas: ${plan.roadmap.length}
- Blueprints usados: ${metadata.blueprintsUsed.length}
- Tareas para revisión manual: ${reviewTasks.length}
- Campos bloqueados por contrato: ${metadata.contractLockedFields.join(', ')}

## Pipeline V2.1
- Normalizadores legacy omitidos: ${metadata.legacyNormalizersSkipped.length}
- Validadores V2 aplicados: ${metadata.v2ValidatorsApplied.join(', ')}
- Tareas regeneradas: ${metadata.tasksRegenerated}
- Tareas marcadas para revisión: ${metadata.tasksMarkedForReview}
- fixedErrors legacy: ${plan.generationLog.fixedErrors.length}

## Blueprint completion V2.2
- Blueprints con fallback: ${metadata.fallbackCompletion.blueprintsWithFallback}
- Blueprints sin fallback: ${metadata.fallbackCompletion.blueprintsMissingFallback.join(', ') || 'ninguno'}
- Tareas completadas por fallback: ${metadata.fallbackCompletion.tasksCompletedByFallback.length}
- Tareas completadas por Gemini: ${metadata.fallbackCompletion.tasksCompletedByGemini.length}
- Gemini rechazado y fallback conservado: ${metadata.fallbackCompletion.tasksWhereGeminiRejectedButFallbackUsed.length}
- Slots sin resolver: ${metadata.slotNormalizationSummary.unresolvedSlots.join(', ') || 'ninguno'}
- Hooks construidos por Factory: ${metadata.hookValidationSummary.hooksBuiltByFactory.length}
- Hooks aceptados de Gemini: ${metadata.hookValidationSummary.hooksAcceptedFromGemini.length}
- Frases débiles restantes: ${metadata.weakPhraseSummary.remainingWeakPhrases.join(', ') || 'ninguna'}

## Validación final
${checkLines}

## Intentos y revisión
${reviewTasks.length ? reviewTasks.map(task => `- ${task.blueprintId}: ${task.validationErrors.join('; ')}`).join('\n') : '- Sin tareas pendientes de revisión.'}

## Anti-repetición
- Comparación: ${metadata.previousPlanComparison}
- Blueprints repetidos: ${metadata.repeatedBlueprintsDetected.join(', ') || 'ninguno'}
- Captions repetidos: ${metadata.repeatedCaptionsDetected.length}
- Decisiones de variación:
${metadata.variationDecisions.map(value => `  - ${value}`).join('\n')}
`;
}
