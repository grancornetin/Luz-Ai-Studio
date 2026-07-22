/**
 * recipes/outfitRevealBasic/debug.ts
 * Mismo patrón que outfitMultiLook/debug.ts.
 */
import type { ShotContract, RoutedReferences, ValidationResult, OutfitRevealBasicShotDebug } from './types';

export function buildShotDebug(
  contract:          ShotContract,
  routed:            RoutedReferences,
  prompt:            string,
  routingValidation: ValidationResult,
): OutfitRevealBasicShotDebug {
  return {
    shotId:            contract.shotId,
    referencesUsed:    routed.orderedUrls,
    cameraGrammar:      contract.cameraGrammar,
    routingValidation,
    promptSummary:      prompt.slice(0, 300),
  };
}
