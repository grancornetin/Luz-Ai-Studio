/**
 * recipes/weeklyFavoritesV2/routingValidator.ts
 *
 * Segunda etapa de validación: revisa el resultado ya resuelto a URLs
 * (después de referenceRouter.ts), antes de armar el texto de instrucciones
 * para el generador de imágenes.
 *
 * Límite explícito e intencional: este validador solo confirma datos que
 * puede ver en código (URLs presentes/ausentes, conteos, pertenencia al
 * contrato). NO afirma haber detectado visualmente un "outfit inventado",
 * un "producto reemplazado" o un "cambio no deseado en la imagen" — eso
 * solo se puede confirmar mirando la imagen ya generada, a mano o con una
 * futura capa de revisión de imagen que no existe todavía.
 */
import type { ShotContract, RoutedReferences, ValidationResult } from './types';

const MAX_REFS = 10;

export function validateRouting(
  contract:  ShotContract,
  routed:    RoutedReferences,
): ValidationResult {
  const errors: string[] = [];

  // 1. Si hay item activo y su política pedía su referencia, esa URL debe
  // estar realmente incluida en la lista final.
  const activeUrls = contract.referencePolicy.activeItemRefs;
  for (const url of activeUrls) {
    if (!routed.orderedUrls.includes(url)) {
      errors.push(`La referencia del item activo (${url}) no llegó a la lista final de referencias.`);
    }
  }

  // 2. Toda URL solicitada por la política debe haberse resuelto — ninguna
  // referencia obligatoria puede faltar en el desglose.
  if (contract.referencePolicy.useIdentityRef && !routed.breakdown.identity) {
    errors.push('La política pedía referencia de identidad pero no se resolvió ninguna URL.');
  }
  if (contract.referencePolicy.useBodyRef && !routed.breakdown.body) {
    errors.push('La política pedía referencia de cuerpo pero no se resolvió ninguna URL.');
  }
  if (contract.referencePolicy.useAnchorRef && !routed.breakdown.anchor) {
    errors.push('La política pedía referencia de anclaje pero no se resolvió ninguna URL.');
  }

  // 3. Ninguna referencia ajena al contrato: todo lo que aparece en
  // orderedUrls debe venir de alguna de las categorías del desglose.
  const allowedUrls = new Set([
    routed.breakdown.identity,
    routed.breakdown.body,
    routed.breakdown.anchor,
    routed.breakdown.overview,
    ...routed.breakdown.activeItem,
    ...routed.breakdown.secondaryItems,
    ...routed.breakdown.technical,
  ].filter(Boolean));
  for (const url of routed.orderedUrls) {
    if (!allowedUrls.has(url)) {
      errors.push(`La referencia ${url} apareció en la lista final sin estar justificada por el contrato.`);
    }
  }

  // 4. Overview: cero identidad, cero cuerpo, cero anclaje humano.
  if (contract.role === 'overview') {
    if (routed.breakdown.identity) errors.push('La foto general (overview) no debe incluir referencia de identidad.');
    if (routed.breakdown.body) errors.push('La foto general (overview) no debe incluir referencia de cuerpo.');
    if (routed.breakdown.anchor) errors.push('La foto general (overview) no debe incluir referencia de anclaje humano.');
  }

  // 5. Conteo de referencias dentro de rango válido.
  if (routed.orderedUrls.length === 0) {
    errors.push('La foto no tiene ninguna referencia resuelta.');
  }
  if (routed.orderedUrls.length > MAX_REFS) {
    errors.push(`La foto tiene ${routed.orderedUrls.length} referencias, por encima del máximo permitido (${MAX_REFS}).`);
  }

  // 6. La foto general (u otro shot ya generado) nunca se usa como entrada
  // por defecto — solo llegaría vía technicalRefs si un contrato futuro lo
  // pidiera explícitamente, cosa que hoy no ocurre en ningún rol.
  if (contract.role !== 'overview' && routed.breakdown.overview) {
    errors.push('Se coló una referencia de overview en una foto que no es la foto general.');
  }

  return { passed: errors.length === 0, errors };
}

export function validateRoutings(
  pairs: Array<{ contract: ShotContract; routed: RoutedReferences }>,
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();
  for (const { contract, routed } of pairs) {
    results.set(contract.shotId, validateRouting(contract, routed));
  }
  return results;
}
