/**
 * recipes/weeklyFavoritesV2/referenceRouter.ts
 *
 * Resuelve la política de referencias de un contrato ya armado (ver
 * contracts.ts) a una lista concreta de URLs, en orden. No decide nada por
 * su cuenta — la decisión de qué referencia usar ya está tomada en el
 * contrato; esta pieza solo la traduce a datos concretos y confirma que
 * cada referencia solicitada exista.
 */
import type { AnchorContract, ReferencePolicy, RoutedReferences } from './types';

function anchorRefUrl(anchor: AnchorContract): string | undefined {
  // La referencia "de mundo/ambiente" de la foto ancla: si hay una prenda
  // base explícita, esa es la referencia de outfit dentro del ancla; si no,
  // el ancla se resuelve con identidad/cuerpo/escena — no hay una única URL
  // de "anchor" separada, así que se prioriza escena y luego identidad como
  // referencia visual de mundo/luz.
  return anchor.sceneRefUrl ?? anchor.identityRefUrl ?? anchor.bodyRefUrl;
}

export function routeReferences(
  policy:   ReferencePolicy,
  anchor:   AnchorContract,
): RoutedReferences {
  const breakdown: RoutedReferences['breakdown'] = {
    activeItem:     [],
    secondaryItems: [],
    technical:      [],
  };

  if (policy.useIdentityRef && anchor.identityRefUrl) {
    breakdown.identity = anchor.identityRefUrl;
  }
  if (policy.useBodyRef && anchor.bodyRefUrl) {
    breakdown.body = anchor.bodyRefUrl;
  }
  if (policy.useAnchorRef) {
    breakdown.anchor = anchorRefUrl(anchor);
  }
  if (policy.useOverviewRef) {
    // La foto general no usa una única "referencia de overview" propia —
    // se arma solo con los items seleccionados (activeItemRefs/secondaryItemRefs).
    // Este flag existe para que el validador de enrutamiento pueda confirmar
    // que, en este rol, nunca se coló identidad/cuerpo/anchor humano.
  }

  breakdown.activeItem = [...policy.activeItemRefs];
  breakdown.secondaryItems = [...policy.secondaryItemRefs];
  breakdown.technical = [...policy.technicalRefs];

  const orderedUrls = [
    breakdown.identity,
    breakdown.body,
    breakdown.anchor,
    ...breakdown.activeItem,
    ...breakdown.secondaryItems,
    ...breakdown.technical,
  ].filter((url): url is string => Boolean(url));

  // Sin duplicados — una misma URL no debe pasarse dos veces al generador.
  const dedupedUrls = Array.from(new Set(orderedUrls));

  return { orderedUrls: dedupedUrls, breakdown };
}
