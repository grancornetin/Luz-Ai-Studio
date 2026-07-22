/**
 * recipes/outfitRevealBasic/referenceRouter.ts
 *
 * Resuelve la política de referencias de un contrato a una lista concreta de
 * URLs, en orden. Las N prendas subidas (outfitRef + outfitRefs) se tratan
 * como componentes de UN SOLO look combinado — mismo criterio que
 * photodumpDirectorService.ts usa para outfit_check/outfit_haul/outfit_week
 * (ver outfitRefInstruction en ese archivo), no como looks independientes
 * (a diferencia de outfit_multi_look).
 *
 * anchorImageUrl (bug real visto en producción): los shots de variación
 * generaban su propio cuarto/fondo desde cero, distinto al del shot 1
 * (mirror_check) — nunca se citaba esa imagen ya generada como referencia.
 * Mismo patrón de encadenamiento que outfitMultiLook/anchorChain.ts: se pasa
 * la imagen anterior como referencia de escena para que el modelo reutilice
 * el mismo cuarto en vez de inventar uno nuevo.
 */
import type { PhotodumpRefs } from '../../types';
import type { ShotContract, RoutedReferences } from './types';

export function routeReferences(
  contract:      ShotContract,
  refs:          PhotodumpRefs,
  anchorImageUrl?: string,
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

  const orderedUrls = [
    breakdown.identity,
    breakdown.body,
    ...breakdown.outfits,
    anchorImageUrl,
  ].filter((url): url is string => Boolean(url));

  const dedupedUrls = Array.from(new Set(orderedUrls));

  return { orderedUrls: dedupedUrls, breakdown };
}
