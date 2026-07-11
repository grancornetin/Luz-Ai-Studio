/**
 * recipes/weeklyFavoritesV2/manifest.ts
 *
 * Construye el Manifest — la única fuente de verdad sobre qué items existen
 * y cómo deben comportarse. El slot de origen (outfit/accesorio/producto)
 * NO determina comportamiento; behaviorType sí.
 */
import type { PhotodumpRefs, HaulRefKind } from '../../types';
import type { ItemCategory, BehaviorType, ManifestItem, WeeklyManifestV2 } from './types';

const EMPTY_CATEGORY_MAP: Record<ItemCategory, ManifestItem[]> = {
  outfit:           [],
  bag:              [],
  footwear:         [],
  jewelry:          [],
  makeup:           [],
  skincare:         [],
  product_generic:  [],
};

// Traduce el HaulRefKind (elegido manualmente por el usuario en el selector,
// o 'auto' si no eligió nada) a la categoría/comportamiento propios de esta
// receta. No reutiliza WeeklyItemKind — vocabulario propio y acotado.
function classifyRefKind(kind: HaulRefKind): { category: ItemCategory; behaviorType: BehaviorType } {
  switch (kind) {
    case 'bolso':
      return { category: 'bag', behaviorType: 'bag' };
    case 'calzado':
      return { category: 'footwear', behaviorType: 'footwear' };
    case 'joyeria':
    case 'aros':
    case 'collar':
    case 'anillo':
    case 'pulsera':
      return { category: 'jewelry', behaviorType: 'jewelry' };
    case 'maquillaje':
      return { category: 'makeup', behaviorType: 'makeup_applied' };
    case 'skincare':
      return { category: 'skincare', behaviorType: 'skincare_product' };
    case 'look_completo':
    case 'top':
    case 'bottom':
    case 'vestido':
    case 'enterizo':
    case 'chaqueta':
    case 'pantys':
      return { category: 'outfit', behaviorType: 'outfit_look' };
    case 'cinturon':
    case 'panoleta':
    case 'scrunchie':
    case 'sombrero':
    case 'gafas':
    case 'accesorio':
      return { category: 'jewelry', behaviorType: 'jewelry' };
    case 'gadget_tech':
    case 'food_drink':
    case 'wellness_item':
    case 'producto_generico':
    case 'varios_items':
    case 'auto':
    default:
      return { category: 'product_generic', behaviorType: 'product_texture' };
  }
}

function buildItemsFromSlot(
  urls:      (string | null | undefined)[],
  kinds:     HaulRefKind[],
  prefix:    string,
  idOffset:  number,
  defaultCategory: ItemCategory,
  defaultBehavior: BehaviorType,
): ManifestItem[] {
  const items: ManifestItem[] = [];
  let localIndex = 0;
  urls.forEach((url, i) => {
    if (!url) return;
    const kind = kinds[i] ?? 'auto';
    const classified = kind === 'auto'
      ? { category: defaultCategory, behaviorType: defaultBehavior }
      : classifyRefKind(kind);
    items.push({
      id:                       `${prefix}_${idOffset + localIndex}`,
      sourceIndex:              i,
      refUrl:                   url,
      category:                 classified.category,
      behaviorType:              classified.behaviorType,
      label:                    `${prefix} ${idOffset + localIndex + 1}`,
      supportsCloseup:           classified.category === 'jewelry' || classified.category === 'bag' || classified.category === 'footwear',
      replacePolicy:             'fixed',
      technicalReferenceOnly:    classified.behaviorType === 'product_texture',
      includeInOverview:         true,
      includeAsIndividualShot:   true,
    });
    localIndex += 1;
  });
  return items;
}

export function buildWeeklyFavoritesV2Manifest(refs: PhotodumpRefs): WeeklyManifestV2 {
  const outfitUrls  = [refs.outfitRef, ...(refs.outfitRefs ?? [])];
  const accUrls      = refs.accesorioRefs ?? [];
  const productUrls  = [refs.productRef, ...(refs.productRefs ?? [])];

  const outfitKinds:  HaulRefKind[] = refs.haulOutfitKinds  ?? [];
  const accKinds:      HaulRefKind[] = refs.haulAccKinds     ?? [];
  const productKinds:  HaulRefKind[] = refs.haulProductKinds ?? [];

  const outfitItems  = buildItemsFromSlot(outfitUrls, outfitKinds, 'outfit', 0, 'outfit', 'outfit_look');
  const accItems      = buildItemsFromSlot(accUrls, accKinds, 'acc', 0, 'jewelry', 'jewelry');
  const productItems  = buildItemsFromSlot(productUrls, productKinds, 'product', 0, 'product_generic', 'skincare_product');

  const accCloseup = refs.accesorioCloseup ?? [];
  accItems.forEach((item, i) => {
    if (accCloseup[item.sourceIndex]) item.supportsCloseup = true;
  });

  const allItems = [...outfitItems, ...accItems, ...productItems];

  // El único item elegible para el Anchor es uno marcado explícitamente
  // base_outfit. Nada en el flujo automático produce ese behaviorType hoy —
  // solo puede llegar por asignación explícita (ver nota en anchor.ts).
  const baseOutfitItem = allItems.find(it => it.behaviorType === 'base_outfit');

  const itemsByCategory: Record<ItemCategory, ManifestItem[]> = {
    outfit:           [],
    bag:              [],
    footwear:         [],
    jewelry:          [],
    makeup:           [],
    skincare:         [],
    product_generic:  [],
  };
  for (const item of allItems) {
    itemsByCategory[item.category].push(item);
  }

  return {
    items: allItems,
    baseOutfitItem,
    itemsByCategory,
  };
}
