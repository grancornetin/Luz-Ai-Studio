/**
 * recipes/weeklyFavoritesV2/allocator.ts
 *
 * Decide cuántas fotos se pueden generar y a qué item corresponde cada una,
 * a partir de lo que realmente se subió — nunca inventa un outfit, producto
 * o accesorio que no exista en el catálogo.
 *
 * Reglas duras:
 *  - Un item que solo aparece en la foto general (overview) NO cuenta como
 *    cubierto — la cobertura completa exige que cada item elegible tenga
 *    su propia foto (o al menos aparecer como secundario en alguna).
 *  - Si se piden más fotos de las que harían falta para cubrir cada item una
 *    vez, el sobrante NO se deja vacío ni se inventa un item nuevo — se
 *    reparte como fotos de detalle adicional sobre los items que sí existen
 *    (prioridad a los que admiten close-up). La variedad real entre esa foto
 *    y la foto principal del mismo item la aporta la capa de inteligencia
 *    (HPI + UGC Intelligence, ver intelligenceLayer.ts) con un ángulo/momento
 *    distinto — nunca se trata de una copia repetida.
 *  - Si el sobrante es mayor a lo que incluso el detalle adicional puede
 *    sostener (más fotos pedidas que items × 2), el resto se declara
 *    explícitamente como hueco de cobertura en vez de fabricar contenido
 *    falso.
 *  - Si se piden menos fotos de las que harían falta para cubrir todo, se
 *    prioriza: primero los items elegibles individualmente, en el orden en
 *    que fueron subidos.
 */
import type {
  WeeklyManifestV2, ManifestItem, ShotAllocationResult,
  AllocatedShotSlot, ShotRole, CoverageLevel,
} from './types';

function roleForItem(item: ManifestItem): ShotRole {
  switch (item.category) {
    case 'outfit':           return 'outfit_hero';
    case 'bag':               return 'bag';
    case 'footwear':          return 'footwear';
    case 'jewelry':           return 'jewelry';
    case 'makeup':            return item.behaviorType === 'makeup_applied' ? 'makeup_applied' : 'product_texture';
    case 'skincare':          return item.technicalReferenceOnly ? 'product_texture' : 'skincare_in_hand';
    case 'product_generic':
    default:                  return item.technicalReferenceOnly ? 'product_texture' : 'skincare_product_only';
  }
}

export function allocateShots(
  manifest:        WeeklyManifestV2,
  requestedCount:   number,
): ShotAllocationResult {
  const eligibleItems = manifest.items.filter(it => it.includeAsIndividualShot);

  // Cuántas fotos harían falta para cubrir cada item elegible con al menos
  // una foto propia, más una foto general si hay más de un item.
  const minimumShotsForFullCoverage = eligibleItems.length + (manifest.items.length > 1 ? 1 : 0);

  const itemCoverageLevel: Record<string, CoverageLevel> = {};
  for (const item of manifest.items) {
    itemCoverageLevel[item.id] = item.includeInOverview ? 'overview_only' : 'not_covered';
  }

  const shots: AllocatedShotSlot[] = [];
  const uncoveredItems: ManifestItem[] = [];

  // Presupuesto disponible para fotos individuales — se reserva 1 foto para
  // la general (overview) si hay más de un item y si entra en el pedido.
  const reserveOverview = manifest.items.length > 1 && requestedCount > eligibleItems.length;
  const individualBudget = reserveOverview ? requestedCount - 1 : requestedCount;

  const itemsWithPrimaryShot: ManifestItem[] = [];

  eligibleItems.forEach((item, idx) => {
    if (idx < individualBudget) {
      const role = roleForItem(item);
      shots.push({
        slotId:        `shot_${shots.length}`,
        role,
        activeItem:     item,
        secondaryItems: [],
      });
      itemCoverageLevel[item.id] = 'primary';
      itemsWithPrimaryShot.push(item);
    } else {
      uncoveredItems.push(item);
    }
  });

  if (reserveOverview) {
    shots.push({
      slotId:        `shot_${shots.length}`,
      role:          'overview',
      activeItem:     null,
      secondaryItems: manifest.items.filter(it => it.includeInOverview),
    });
  }

  // Si sobra presupuesto respecto a lo mínimo necesario, no se deja vacío ni
  // se inventa un item — se reparten fotos de detalle adicional sobre los
  // items que sí tienen foto principal, priorizando los que admiten
  // close-up (joyería, calzado, carteras) porque un segundo ángulo ahí
  // aporta valor real. Se turna entre items para no concentrar todas las
  // fotos extra en uno solo.
  const usedShotsSoFar = shots.length;
  let extraBudget = Math.max(0, requestedCount - usedShotsSoFar);

  if (extraBudget > 0 && itemsWithPrimaryShot.length > 0) {
    const closeupCandidates = itemsWithPrimaryShot.filter(it => it.supportsCloseup);
    const detailCandidates  = closeupCandidates.length > 0 ? closeupCandidates : itemsWithPrimaryShot;

    let round = 0;
    while (extraBudget > 0 && round < detailCandidates.length * 2) {
      const item = detailCandidates[round % detailCandidates.length];
      const role = roleForItem(item);
      shots.push({
        slotId:              `shot_${shots.length}`,
        role,
        activeItem:           item,
        secondaryItems:       [],
        isAdditionalDetail:   true,
      });
      itemCoverageLevel[item.id] = 'primary_plus_detail';
      extraBudget -= 1;
      round += 1;
    }
  }

  // Si aún sobra presupuesto sin nada más que cubrir (más fotos pedidas que
  // items × 2, o catálogo vacío), se declara el resto como hueco explícito
  // en vez de fabricar contenido falso.
  const coverageMode: 'full' | 'partial' = uncoveredItems.length === 0 ? 'full' : 'partial';

  const reason = coverageMode === 'full'
    ? 'Todos los items elegibles tienen su propia foto.'
    : `Se pidieron ${requestedCount} fotos pero harían falta ${minimumShotsForFullCoverage} para cubrir cada item con su propia foto — ${uncoveredItems.length} item(s) quedaron sin foto individual.`;

  return {
    requestedCount,
    minimumShotsForFullCoverage,
    coverageMode,
    uncoveredItems,
    reason,
    shots,
    itemCoverageLevel,
  };
}
