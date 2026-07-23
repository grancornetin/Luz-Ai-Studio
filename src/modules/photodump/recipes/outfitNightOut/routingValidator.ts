/**
 * recipes/outfitNightOut/routingValidator.ts
 *
 * Valida el resultado ya resuelto a URLs, antes de armar el prompt final.
 * Mismo patrón que outfitRevealBasic/routingValidator.ts.
 */
import type { ShotContract, RoutedReferences, ValidationResult } from './types';

const MAX_REFS = 10;

export function validateRouting(contract: ShotContract, routed: RoutedReferences): ValidationResult {
  const errors: string[] = [];

  if (contract.referencePolicy.useOutfitRefs && routed.breakdown.outfits.length === 0) {
    errors.push(`El shot "${contract.shotId}" necesita al menos una referencia de outfit.`);
  }

  if (routed.orderedUrls.length === 0) {
    errors.push('El shot no tiene ninguna referencia resuelta.');
  }
  if (routed.orderedUrls.length > MAX_REFS) {
    errors.push(`El shot tiene ${routed.orderedUrls.length} referencias, por encima del máximo permitido (${MAX_REFS}).`);
  }

  return { passed: errors.length === 0, errors };
}
