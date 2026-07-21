/**
 * recipes/outfitMultiLook/referenceRouter.ts
 *
 * Resuelve la política de referencias de un contrato ya armado a una lista
 * concreta de URLs, en orden. No decide nada — la decisión ya está en el
 * contrato, esto solo la traduce a datos concretos.
 *
 * anchorImageUrl es distinto según backgroundMode:
 *  - fixed_single_anchor: la imagen REF0 generada una sola vez para toda la sesión.
 *  - variable_per_shot (trip_recap): el eslabón de cadena de ESTE shot puntual
 *    (contract.chainAnchorUrl), no una imagen compartida entre todos los shots.
 *
 * curated_ideas: si el contrato trae linkedAccessoryUrls (calzado/joyas
 * enlazados a este look, ver contracts.ts), se agregan al final del array
 * ordenado — respetando MAX_REFS en routingValidator.ts.
 */
import type { PhotodumpRefs } from '../../types';
import type { ShotContract, RoutedReferences } from './types';

export function routeReferences(
  contract:       ShotContract,
  refs:           PhotodumpRefs,
  anchorImageUrl: string | undefined,
): RoutedReferences {
  const breakdown: RoutedReferences['breakdown'] = { look: [] };

  if (contract.referencePolicy.useIdentityRef && refs.avatarRef) {
    breakdown.identity = refs.avatarRef;
  }
  if (contract.referencePolicy.useBodyRef && refs.bodyRef) {
    breakdown.body = refs.bodyRef;
  }
  if (contract.referencePolicy.useAnchorRef && anchorImageUrl) {
    breakdown.anchor = anchorImageUrl;
  }
  if (contract.referencePolicy.activeLookRef) {
    breakdown.look = [contract.referencePolicy.activeLookRef];
  }
  if (contract.referencePolicy.linkedAccessoryUrls && contract.referencePolicy.linkedAccessoryUrls.length > 0) {
    breakdown.look = [...breakdown.look, ...contract.referencePolicy.linkedAccessoryUrls];
  }

  const orderedUrls = [
    breakdown.identity,
    breakdown.body,
    breakdown.anchor,
    ...breakdown.look,
  ].filter((url): url is string => Boolean(url));

  const dedupedUrls = Array.from(new Set(orderedUrls));

  return { orderedUrls: dedupedUrls, breakdown };
}
