/**
 * recipes/outfitNightOut/companion.ts
 *
 * Extrae la referencia de acompañante, reusando exactamente el mismo
 * mecanismo ya real de day_in_life.ts (líneas 126-136): el usuario sube la
 * foto en el slot genérico "Producto" y la marca como tipo "Acompañante"
 * (HaulRefKind === 'acompanante'); también acepta refs.companionRef directo
 * como fallback. No se agrega ningún slot de UI nuevo para esta receta.
 */
import type { PhotodumpRefs } from '../../types';

export function extractCompanionRef(refs: PhotodumpRefs): string | null {
  const allProductUrls = [refs.productRef, ...(refs.productRefs ?? [])].filter(Boolean) as string[];
  const productKinds = refs.haulProductKinds ?? [];

  for (let i = 0; i < allProductUrls.length; i++) {
    if (productKinds[i] === 'acompanante') return allProductUrls[i];
  }
  return refs.companionRef ?? null;
}
