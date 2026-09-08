/**
 * recipes/weeklyLooks/referenceRouter.ts
 *
 * Resuelve qué referencias de imagen viajan a la generación de cada shot:
 * identidad, cuerpo, la referencia de outfit de ESE look específico, y (si
 * placeMode === 'same_place' y no es el shot ancla) la imagen ya generada
 * del shot ancla como referencia de escena — mismo patrón de encadenamiento
 * que outfitRevealBasic/referenceRouter.ts.
 */
import type { PhotodumpRefs } from '../../types';
import type { ShotContract } from './types';

export interface RoutedReferences {
  orderedUrls: string[];
}

export function routeReferences(
  contract:      ShotContract,
  refs:          PhotodumpRefs,
  sceneAnchorImageUrl?: string,
): RoutedReferences {
  const orderedUrls = [
    refs.avatarRef,
    refs.bodyRef,
    contract.lookItem.refUrl,
    sceneAnchorImageUrl,
  ].filter((url): url is string => Boolean(url));

  return { orderedUrls: Array.from(new Set(orderedUrls)) };
}
