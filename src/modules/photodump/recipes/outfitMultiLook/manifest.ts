/**
 * recipes/outfitMultiLook/manifest.ts
 *
 * Construye la lista de looks a partir de [outfitRef, ...outfitRefs] — cada
 * imagen subida en esos slots es un look completo, no un ítem clasificado
 * por categoría (a diferencia de weeklyFavoritesV2).
 *
 * Los campos era/placeLabel vienen de arrays paralelos indexados igual que
 * haulOutfitKinds — nunca se infieren ni se inventan acá.
 */
import type { PhotodumpRefs, MultiLookIntent, MultiLookBackgroundMode } from '../../types';
import type { MultiLookManifest, LookItem, MultiLookAccessory } from './types';

export function backgroundModeForIntent(intent: MultiLookIntent): MultiLookBackgroundMode {
  return intent === 'trip_recap' ? 'variable_per_shot' : 'fixed_single_anchor';
}

// curated_ideas: pool de accesorios (calzado/joyas) con enlace many-to-many
// a looks, declarado explícitamente por el usuario con chips en la UI — ver
// PDStep2Receta.tsx. Ausente/vacío para el resto de las intenciones.
function buildAccessories(refs: PhotodumpRefs, looks: LookItem[]): MultiLookAccessory[] {
  const urls  = refs.curatedIdeasAccessoryRefs ?? [];
  const links = refs.curatedIdeasAccessoryLinks ?? [];
  const validLookIds = new Set(looks.map(l => l.id));

  const accessories: MultiLookAccessory[] = [];
  urls.forEach((url, i) => {
    if (!url) return;
    const linkedLookIds = (links[i] ?? []).filter(id => validLookIds.has(id));
    accessories.push({
      id:            `acc_${accessories.length}`,
      sourceIndex:   i,
      refUrl:        url,
      linkedLookIds,
    });
  });
  return accessories;
}

export function buildMultiLookManifest(refs: PhotodumpRefs): MultiLookManifest {
  const intent: MultiLookIntent = refs.multiLookIntent ?? 'weekly';
  const urls = [refs.outfitRef, ...(refs.outfitRefs ?? [])];
  const eras = refs.multiLookEras ?? [];
  const places = refs.multiLookPlaces ?? [];

  const looks: LookItem[] = [];
  urls.forEach((url, i) => {
    if (!url) return;
    const look: LookItem = {
      id:          `look_${looks.length}`,
      sourceIndex: i,
      refUrl:      url,
      label:       `Look ${looks.length + 1}`,
    };
    if (intent === 'then_vs_now') {
      const era = eras[i];
      if (era === 'before' || era === 'after') look.era = era;
    }
    if (intent === 'trip_recap') {
      const place = places[i];
      if (place && place.trim().length > 0) look.placeLabel = place.trim();
    }
    looks.push(look);
  });

  return {
    intent,
    backgroundMode: backgroundModeForIntent(intent),
    looks,
    accessories: intent === 'curated_ideas' ? buildAccessories(refs, looks) : [],
  };
}
