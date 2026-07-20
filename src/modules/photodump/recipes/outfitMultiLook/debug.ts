/**
 * recipes/outfitMultiLook/debug.ts
 *
 * Arma el panel de diagnóstico de un shot: qué look tuvo, qué referencias se
 * usaron, qué intensidad de pose y encuadre se aplicó, y el resultado de las
 * dos validaciones (de contrato y de enrutamiento).
 */
import type { ShotContract, RoutedReferences, ValidationResult, OutfitMultiLookShotDebug } from './types';

export function buildShotDebug(
  contract:           ShotContract,
  routed:              RoutedReferences,
  promptSummary:       string,
  contractValidation:  ValidationResult,
  routingValidation:   ValidationResult,
): OutfitMultiLookShotDebug {
  return {
    shotId:             contract.shotId,
    lookId:             contract.look.id,
    referencesUsed:     routed.orderedUrls,
    poseIntensity:      contract.poseIntensity,
    cameraGrammar:      contract.cameraGrammar,
    contractValidation,
    routingValidation,
    promptSummary,
  };
}
