/**
 * recipes/outfitNightOut/referenceRouter.ts
 *
 * Resuelve la política de referencias de un contrato a una lista concreta de
 * URLs, en orden. A diferencia de outfitRevealBasic (1 sola ancla), acá hay
 * DOS anclas posibles:
 *  - prepAnchorUrl: la imagen ya generada de mirror_check, citada por los
 *    shots de preparación (presentation/tryon_detail) para mantener el mismo
 *    cuarto — mismo criterio que outfitRevealBasic/referenceRouter.ts.
 *  - venueAnchorUrl: la imagen ya generada del primer NightMoment del venue,
 *    citada por los NightMoment siguientes para mantener el mismo lugar.
 * companionRef se agrega solo si el contrato lo pide (useCompanionRef) y
 * existe una referencia real subida — nunca se inventa.
 */
import type { PhotodumpRefs } from '../../types';
import type { ShotContract, RoutedReferences } from './types';

export interface AnchorUrls {
  prepAnchorUrl?:  string;
  venueAnchorUrl?: string;
  venueImageUrl?:  string;
  companionRef?:   string | null;
}

export function routeReferences(
  contract: ShotContract,
  refs:     PhotodumpRefs,
  anchors:  AnchorUrls,
): RoutedReferences {
  const breakdown: RoutedReferences['breakdown'] = { outfits: [] };

  if (contract.referencePolicy.useIdentityRef && refs.avatarRef) {
    breakdown.identity = refs.avatarRef;
  }
  if (contract.referencePolicy.useBodyRef && refs.bodyRef) {
    breakdown.body = refs.bodyRef;
  }
  if (contract.referencePolicy.useOutfitRefs) {
    breakdown.outfits = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter((url): url is string => Boolean(url));
  }
  if (contract.referencePolicy.useCompanionRef && anchors.companionRef) {
    breakdown.companion = anchors.companionRef;
  }

  const orderedUrls = [
    breakdown.identity,
    breakdown.body,
    ...breakdown.outfits,
    breakdown.companion,
    anchors.prepAnchorUrl,
    anchors.venueAnchorUrl,
    anchors.venueImageUrl,
  ].filter((url): url is string => Boolean(url));

  const dedupedUrls = Array.from(new Set(orderedUrls));

  return { orderedUrls: dedupedUrls, breakdown };
}
