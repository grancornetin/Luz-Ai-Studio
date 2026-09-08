/**
 * recipes/weeklyLooks/manifest.ts
 *
 * Arma el catálogo de looks — un look por cada referencia de outfit subida.
 * Mucho más simple que weeklyFavoritesV2/manifest.ts porque esta receta no
 * maneja bolsos/joyería/skincare — eso vive en recipes/weeklyProducts/.
 */
import type { PhotodumpRefs } from '../../types';
import type { LookItem, WeeklyLooksManifest } from './types';

export function buildWeeklyLooksManifest(refs: PhotodumpRefs): WeeklyLooksManifest {
  const urls = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
  const items: LookItem[] = urls.map((url, i) => ({
    id:          `look_${i}`,
    sourceIndex: i,
    refUrl:      url,
    label:       `Look ${i + 1}`,
  }));
  return { items };
}
