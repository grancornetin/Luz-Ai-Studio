/**
 * recipes/outfitNightOut/debug.ts
 * Mismo patrón que outfitRevealBasic/debug.ts.
 */
import type { ShotContract, RoutedReferences, ValidationResult, OutfitNightOutShotDebug } from './types';

export function buildShotDebug(
  contract:          ShotContract,
  routed:            RoutedReferences,
  prompt:            string,
  routingValidation: ValidationResult,
  usedDirector:      boolean = false,
): OutfitNightOutShotDebug {
  return {
    shotId:            contract.shotId,
    referencesUsed:    routed.orderedUrls,
    cameraGrammar:      contract.cameraGrammar,
    routingValidation,
    promptSummary:      prompt.slice(0, 300),
    usedDirector,
  };
}
