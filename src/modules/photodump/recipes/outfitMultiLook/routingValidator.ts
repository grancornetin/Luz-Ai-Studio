/**
 * recipes/outfitMultiLook/routingValidator.ts
 *
 * Segunda etapa de validación: revisa el resultado ya resuelto a URLs, antes
 * de armar el texto de instrucciones para el generador de imágenes.
 *
 * Límite explícito: solo confirma datos que puede ver en código (URLs
 * presentes/ausentes, conteos, pertenencia al contrato) — no afirma nada
 * sobre el contenido visual de una imagen ya generada.
 */
import type { ShotContract, RoutedReferences, ValidationResult } from './types';

const MAX_REFS = 10;

export function validateRouting(contract: ShotContract, routed: RoutedReferences): ValidationResult {
  const errors: string[] = [];

  if (contract.referencePolicy.activeLookRef && !routed.orderedUrls.includes(contract.referencePolicy.activeLookRef)) {
    errors.push(`La referencia del look activo no llegó a la lista final de referencias.`);
  }

  if (contract.referencePolicy.useAnchorRef && !routed.breakdown.anchor) {
    errors.push('La política pedía referencia de ancla pero no se resolvió ninguna URL.');
  }

  const allowedUrls = new Set([
    routed.breakdown.identity, routed.breakdown.body, routed.breakdown.anchor, ...routed.breakdown.look,
  ].filter(Boolean));
  for (const url of routed.orderedUrls) {
    if (!allowedUrls.has(url)) {
      errors.push(`La referencia ${url} apareció en la lista final sin estar justificada por el contrato.`);
    }
  }

  if (routed.orderedUrls.length === 0) {
    errors.push('El shot no tiene ninguna referencia resuelta.');
  }
  if (routed.orderedUrls.length > MAX_REFS) {
    errors.push(`El shot tiene ${routed.orderedUrls.length} referencias, por encima del máximo permitido (${MAX_REFS}).`);
  }

  return { passed: errors.length === 0, errors };
}
