// ── Photodump Preset Adapter ───────────────────────────────────────────────
// Serializa y restaura el estado completo de configuración del módulo Photodump.
// Solo guarda la CONFIGURACIÓN (receta, brief, refs, count, destino, outfitMode).
// Los resultados generados (imágenes, captions, debug) NO se guardan en presets.

import type { ModulePresetAdapter, PresetAsset, PresetAssetInput } from '../../shared/presets/types';
import type {
  PhotodumpRecipe,
  PhotodumpDestino,
  PhotodumpRefs,
  PhotodumpOutfitMode,
} from './types';

// Estado configurable del módulo que el preset captura
export interface PhotodumpPresetState {
  recipe:     PhotodumpRecipe;
  count:      number;
  destino:    PhotodumpDestino;
  basePrompt: string;
  outfitMode: PhotodumpOutfitMode;
  refs:       PhotodumpRefs;
  modelId?:   string;
}

// Claves de asset semánticas que se guardan en Storage
const REF_ASSET_KEYS: Array<{ key: string; field: keyof PhotodumpRefs }> = [
  { key: 'avatarRef',   field: 'avatarRef'   },
  { key: 'bodyRef',     field: 'bodyRef'     },
  { key: 'productRef',  field: 'productRef'  },
  { key: 'outfitRef',   field: 'outfitRef'   },
  { key: 'sceneRef',    field: 'sceneRef'    },
  { key: 'scenePruebaRef',  field: 'scenePruebaRef'  },
  { key: 'sceneDestinoRef', field: 'sceneDestinoRef' },
];

function urlToKey(url: string | null | undefined, key: string): PresetAssetInput | null {
  if (!url) return null;
  return { key, existingUrl: url };
}

export const photodumpPresetAdapter: ModulePresetAdapter<PhotodumpPresetState> = {
  moduleId: 'photodump',
  version: 1,

  serialize(state: PhotodumpPresetState): Record<string, unknown> {
    // Las URLs de Storage ya son persistentes — se guardan directo en config.
    // Los arrays de refs (outfitRefs, productRefs, etc.) se guardan como están.
    return {
      recipe:     state.recipe,
      count:      state.count,
      destino:    state.destino,
      basePrompt: state.basePrompt,
      outfitMode: state.outfitMode,
      modelId:    state.modelId ?? null,
      refs: {
        avatarRef:        state.refs.avatarRef        ?? null,
        bodyRef:          state.refs.bodyRef          ?? null,
        productRef:       state.refs.productRef       ?? null,
        productRefs:      state.refs.productRefs      ?? [],
        packagingRef:     state.refs.packagingRef     ?? null,
        packagingRefs:    state.refs.packagingRefs    ?? [],
        outfitRef:        state.refs.outfitRef        ?? null,
        outfitRefs:       state.refs.outfitRefs       ?? [],
        accesorioRefs:    state.refs.accesorioRefs    ?? [],
        accesorioCloseup: state.refs.accesorioCloseup ?? [],
        sceneRef:         state.refs.sceneRef         ?? null,
        sceneRefs:        state.refs.sceneRefs        ?? [],
        sceneText:        state.refs.sceneText        ?? '',
        outfitMode:       state.refs.outfitMode       ?? 'generate',
        gender:           state.refs.gender           ?? null,
        haulOutfitKinds:  state.refs.haulOutfitKinds  ?? [],
        haulAccKinds:     state.refs.haulAccKinds     ?? [],
        haulProductKinds: state.refs.haulProductKinds ?? [],
        scenePruebaRef:   state.refs.scenePruebaRef   ?? null,
        sceneDestinoRef:  state.refs.sceneDestinoRef  ?? null,
        multiLookIntent:  state.refs.multiLookIntent  ?? null,
        multiLookEras:    state.refs.multiLookEras    ?? [],
        curatedIdeasAccessoryRefs:  state.refs.curatedIdeasAccessoryRefs  ?? [],
        curatedIdeasAccessoryLinks: state.refs.curatedIdeasAccessoryLinks ?? [],
      },
    };
  },

  deserialize(config: Record<string, unknown>, _assets: PresetAsset[]): Partial<PhotodumpPresetState> {
    const refs = (config.refs ?? {}) as Partial<PhotodumpRefs>;
    return {
      recipe:     (config.recipe     as PhotodumpRecipe)   ?? 'day_in_life',
      count:      (config.count      as number)            ?? 4,
      destino:    (config.destino    as PhotodumpDestino)  ?? 'feed',
      basePrompt: (config.basePrompt as string)            ?? '',
      outfitMode: (config.outfitMode as PhotodumpOutfitMode) ?? 'generate',
      modelId:    (config.modelId    as string | undefined) ?? undefined,
      refs: {
        avatarRef:        refs.avatarRef        ?? null,
        bodyRef:          refs.bodyRef          ?? null,
        productRef:       refs.productRef       ?? null,
        productRefs:      refs.productRefs      ?? [],
        packagingRef:     refs.packagingRef     ?? null,
        packagingRefs:    refs.packagingRefs    ?? [],
        outfitRef:        refs.outfitRef        ?? null,
        outfitRefs:       refs.outfitRefs       ?? [],
        accesorioRefs:    refs.accesorioRefs    ?? [],
        accesorioCloseup: refs.accesorioCloseup ?? [],
        sceneRef:         refs.sceneRef         ?? null,
        sceneRefs:        refs.sceneRefs        ?? [],
        sceneText:        refs.sceneText        ?? '',
        outfitMode:       refs.outfitMode       ?? 'generate',
        gender:           refs.gender           ?? undefined,
        haulOutfitKinds:  refs.haulOutfitKinds  ?? [],
        haulAccKinds:     refs.haulAccKinds     ?? [],
        haulProductKinds: refs.haulProductKinds ?? [],
        scenePruebaRef:   refs.scenePruebaRef   ?? null,
        sceneDestinoRef:  refs.sceneDestinoRef  ?? null,
        multiLookIntent:  refs.multiLookIntent  ?? undefined,
        multiLookEras:    refs.multiLookEras    ?? [],
        curatedIdeasAccessoryRefs:  refs.curatedIdeasAccessoryRefs  ?? [],
        curatedIdeasAccessoryLinks: refs.curatedIdeasAccessoryLinks ?? [],
      },
    };
  },

  // Las refs de Photodump ya son URLs públicas de Gemini/Firebase — se reusan sin re-subir
  getAssets(state: PhotodumpPresetState): PresetAssetInput[] {
    const assets: PresetAssetInput[] = [];

    // Refs simples
    for (const { key, field } of REF_ASSET_KEYS) {
      const asset = urlToKey(state.refs[field] as string | null, key);
      if (asset) assets.push(asset);
    }

    // Arrays de refs
    (state.refs.outfitRefs ?? []).forEach((url, i) => {
      const a = urlToKey(url, `outfitRefs_${i}`);
      if (a) assets.push(a);
    });
    (state.refs.productRefs ?? []).forEach((url, i) => {
      const a = urlToKey(url, `productRefs_${i}`);
      if (a) assets.push(a);
    });
    (state.refs.accesorioRefs ?? []).forEach((url, i) => {
      const a = urlToKey(url, `accesorioRefs_${i}`);
      if (a) assets.push(a);
    });
    const packagingAsset = urlToKey(state.refs.packagingRef ?? null, 'packagingRef');
    if (packagingAsset) assets.push(packagingAsset);
    (state.refs.packagingRefs ?? []).forEach((url, i) => {
      const a = urlToKey(url, `packagingRefs_${i}`);
      if (a) assets.push(a);
    });
    (state.refs.sceneRefs ?? []).forEach((url, i) => {
      const a = urlToKey(url, `sceneRefs_${i}`);
      if (a) assets.push(a);
    });

    return assets;
  },

  validate(config: Record<string, unknown>): boolean {
    return typeof config.recipe === 'string' && typeof config.refs === 'object';
  },

  defaultName(state: PhotodumpPresetState): string {
    const recipeLabels: Record<PhotodumpRecipe, string> = {
      day_in_life:  'Day in life',
      outfit:       'Outfit',
      outfit_check: 'Outfit check',
      outfit_haul:  'Outfit haul',
      outfit_week:  'Favoritos de la semana',
      outfit_multi_look: 'Varios looks',
      unboxing:     'Unboxing',
      product_haul: 'Haul de productos',
      bts:          'BTS',
      travel:       'Travel',
      free:         'Libre',
    };
    const label = recipeLabels[state.recipe] ?? state.recipe;
    const date  = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
    return `${label} — ${date}`;
  },
};
