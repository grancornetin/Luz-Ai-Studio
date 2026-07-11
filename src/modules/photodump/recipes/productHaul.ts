/**
 * recipes/productHaul.ts
 * Receta product_haul — "miren lo que me llegó" / "mis esenciales para X".
 *
 * Análoga a outfitHaul.ts pero para productos genéricos en vez de ropa.
 * Mismo esqueleto de 3 fases (coverage obligatoria → budget narrativo →
 * interleaving de empaque), SIN styling graph ni scoring de compatibilidad —
 * cada producto es independiente, no se combina con otro como una prenda
 * con un outfit.
 */
import {
  HaulRefKind, ProductHaulItem, ProductHaulManifest, ProductHaulResolvedKind,
  ProductInteractionMode, ProductHaulCoveragePlan, ProductHaulCoverageLedgerItem,
  ProductHaulShotItemPlan, PhotodumpRefs,
} from '../types';
import { PhotodumpShotDirective } from './shared';

// ── Resolución de tipo de producto ─────────────────────────────

function resolveProductKind(manualKind: HaulRefKind): ProductHaulResolvedKind {
  switch (manualKind) {
    case 'skincare':          return 'skincare';
    case 'maquillaje':        return 'makeup';
    case 'gadget_tech':       return 'gadget';
    case 'food_drink':        return 'food_drink';
    case 'wellness_item':     return 'wellness';
    case 'producto_generico': return 'generic_product';
    case 'auto':
    default:                  return 'unknown_product';
  }
}

function productKindToInteraction(rk: ProductHaulResolvedKind): ProductInteractionMode {
  switch (rk) {
    case 'skincare':
    case 'makeup':          return 'applied_to_face_or_body';
    case 'gadget':           return 'held_and_used';
    case 'food_drink':       return 'held_or_consumed';
    case 'wellness':
    case 'generic_product':
    case 'unknown_product':
    default:                 return 'held_or_displayed';
  }
}

function resolvedKindToPromptLabel(rk: ProductHaulResolvedKind): string {
  const labels: Record<ProductHaulResolvedKind, string> = {
    skincare:         'SKINCARE PRODUCT (serum, cream, cleanser — applied to face/body)',
    makeup:           'MAKEUP PRODUCT (lipstick, foundation, palette — applied to face)',
    gadget:           'TECH GADGET / DEVICE (held and actively used, buttons/screen interaction)',
    food_drink:       'FOOD OR DRINK ITEM (held, poured, or consumed naturally)',
    wellness:         'WELLNESS / SUPPLEMENT PRODUCT (held or displayed, not applied)',
    generic_product:  'GENERIC PRODUCT (held or displayed naturally, type as shown in reference)',
    unknown_product:  'PRODUCT (type auto-detected — inspect reference carefully)',
  };
  return labels[rk] ?? 'PRODUCT (type auto-detected — inspect reference carefully)';
}

// ── Interaction block — qué puede (y no puede) hacer el avatar con el ítem ──
// Análogo a buildHaulItemRoleLockBlock pero por modo de interacción, no por
// prenda. Evita cruces como "aplicar" un gadget o "sostener" un sérum como
// si fuera un teléfono.
export function buildProductInteractionBlock(item: ProductHaulItem): string {
  const isManual = item.manualKind !== 'auto';
  const tag = isManual ? `MANUAL TAG: ${item.manualKind.toUpperCase()}` : `AUTO-DETECTED: ${item.resolvedKind.toUpperCase()}`;

  const rules: Record<ProductInteractionMode, string> = {
    applied_to_face_or_body: `PRODUCT INTERACTION LOCK — APPLIED (${tag}): this product is applied directly to face/skin/lips. Allowed: applying with fingertips, dispensing onto hand, patting into skin, swatching on wrist. Forbidden: treating it as a held/displayed object only, generic "holding toward camera" without any application gesture, using it like a tool or gadget.`,

    held_and_used: `PRODUCT INTERACTION LOCK — HELD & USED (${tag}): this is a device/gadget actively operated by hand. Allowed: holding it, pressing/touching its interface, demonstrating its function, looking at its screen/display. Forbidden: applying it to skin/face, consuming it, treating it as passive background decor.`,

    held_or_consumed: `PRODUCT INTERACTION LOCK — HELD/CONSUMED (${tag}): food or drink item. Allowed: holding it, pouring, taking a natural sip/bite, examining packaging. Forbidden: applying it to skin, operating it like a device, forced "product ad" framing (studio pour shots, perfect condensation).`,

    held_or_displayed: `PRODUCT INTERACTION LOCK — HELD/DISPLAYED (${tag}): shown as an object, held naturally or resting on a surface. Allowed: holding it toward camera, examining label/packaging, placing on a surface. Forbidden: inventing an application/consumption gesture not implied by the product type.`,
  };

  return rules[item.interactionMode] ?? rules.held_or_displayed;
}

// ── Item type block — análogo a buildHaulItemTypeBlock ────────
export function buildProductHaulItemTypeBlock(item: ProductHaulItem): string {
  const isManual = item.manualKind !== 'auto';
  const tagSource = isManual ? 'MANUAL USER TAG' : 'AUTO-DETECTED';
  return `REFERENCE ITEM INTERPRETATION — ${item.label}:
${tagSource}: ${item.manualKind.toUpperCase()}
RESOLVED KIND: ${item.resolvedKind.toUpperCase()}
PROMPT GUIDANCE: ${item.promptKindLabel}

${buildProductInteractionBlock(item)}
CRITICAL: The manualKind tag overrides any visual inference. Trust the user's classification. Reproduce the product's packaging, label, color and shape faithfully — do NOT invent a different product.`;
}

// ── Shot item plan block — mismo contrato que Haul, sin worn/wearable ─────
export function buildProductHaulShotItemPlanBlock(plan: ProductHaulShotItemPlan, manifest: ProductHaulManifest): string {
  const resolveLabels = (ids: string[]): string => {
    const labels = ids.map(id => manifest.allItems.find(it => it.id === id)?.label ?? id).filter(Boolean);
    return labels.length > 0 ? labels.join(', ') : 'none';
  };

  const primStr = resolveLabels(plan.primaryItems);
  const heldStr = resolveLabels(plan.heldItems);
  const surfStr = resolveLabels(plan.surfaceItems);
  const bgStr   = resolveLabels(plan.backgroundItems);
  const forbStr = resolveLabels(plan.forbiddenItems);

  const lines: string[] = [
    '📋 SHOT ITEM INVENTORY CONTRACT (exact — do not deviate):',
    `  PRIMARY FOCUS:   ${primStr}`,
    `  HELD in hand:    ${heldStr}`,
    `  ON surface:      ${surfStr}`,
    `  BACKGROUND:      ${bgStr}`,
  ];

  if (plan.forbiddenItems.length > 0) {
    lines.push(`  ✗ FORBIDDEN in this shot: ${forbStr}`);
  }
  if (plan.integrationNote) {
    lines.push(`  NOTE: ${plan.integrationNote}`);
  }
  lines.push('  STRICT: only the items listed above should be visible as featured elements. Do NOT add invented products or unlisted haul items as prominent elements.');

  return lines.join('\n');
}

// ── Anatomy block — reusa el mismo lenguaje de seguridad que Haul ─────────
export function buildProductHaulAnatomyBlock(): string {
  return `🫀 ANATOMY: exactly 2 hands (5 fingers each, no fused/floating), 2 arms. No extra limbs, no phantom body parts, no elongation/distortion.`;
}

// ── HPI seguro para product_haul ───────────────────────────────
// Ramas por modo de interacción — aplicar skincare ≠ sostener gadget ≠
// sostener bebida ≠ exhibir producto genérico.
export function buildProductHaulSafeHpiBlock(
  shotKey: string,
  interactionMode: ProductInteractionMode,
  gender: 'female' | 'male' | 'neutral',
): string {
  const genderNote = gender === 'male' ? 'masculine' : 'feminine';

  if (shotKey === 'PRODUCT_OVERVIEW' || shotKey.startsWith('PRODUCT_UNBOXING_')) return '';

  if (shotKey === 'PRODUCT_RECAP') {
    return `🎯 BODY LANGUAGE (product recap — relaxed ${genderNote} energy):
The person has finished going through the set. Choose ONE natural end-of-session posture:
  - seated or perched near the products, relaxed and genuine
  - standing with one hand near the products, satisfied expression
  - holding a favorite piece, looking at it naturally
FORBIDDEN: catalog pose, forced "winner" energy, editorial frontality.`;
  }

  if (interactionMode === 'applied_to_face_or_body') {
    return `🎯 MICRO-ACTION (product application — hands and natural gesture only):
Choose ONE real application gesture:
  - fingertips patting or smoothing product onto skin/face
  - dispensing product onto the back of the hand before application
  - applying near a mirror, natural candid angle
FORBIDDEN: catalog beauty-ad pose, exaggerated glam lighting, direct camera gaze as if posing for an ad.`;
  }

  if (interactionMode === 'held_and_used') {
    return `🎯 MICRO-ACTION (device interaction — hands and natural gesture only):
Choose ONE real interaction:
  - both hands holding the device, thumb near the interface/screen
  - examining or demonstrating a feature, natural curious expression
  - device held at a natural angle toward camera, casual UGC energy
FORBIDDEN: studio product-ad pose, exaggerated presenter gesture, staring at camera like a commercial.`;
  }

  if (interactionMode === 'held_or_consumed') {
    return `🎯 MICRO-ACTION (holding/consuming — natural gesture only):
Choose ONE real gesture:
  - holding the item naturally, casual grip
  - a natural sip or bite, candid moment, not posed
  - examining the packaging/label with genuine curiosity
FORBIDDEN: studio ad pose, forced smile directly at camera, perfect condensation/steam styling.`;
  }

  return `🎯 BODY LANGUAGE (holding/displaying — natural ${genderNote} pose):
Choose ONE real posture:
  - holding the product naturally toward camera, relaxed grip
  - examining the product, genuine curious expression
  - product resting in hand while person looks at it, candid
FORBIDDEN: catalog mannequin stance, studio ad pose, forced camera-facing smile.`;
}

// ── Manifest builder ───────────────────────────────────────────
export function buildProductHaulManifest(
  refs: PhotodumpRefs,
  requestedCount: number,
): ProductHaulManifest {
  const maxStoryShots = Math.min(requestedCount, 20);

  const rawProducts = [refs.productRef, ...(refs.productRefs ?? [])].filter(Boolean) as string[];
  const productManualKinds = refs.haulProductKinds ?? [];

  const featuredItems: ProductHaulItem[] = rawProducts.map((url, i) => {
    const manualKind: HaulRefKind = productManualKinds[i] ?? 'auto';
    const resolvedKind = resolveProductKind(manualKind);
    const interactionMode = productKindToInteraction(resolvedKind);
    const promptKindLabel = resolvedKindToPromptLabel(resolvedKind);
    const label = `Producto ${i + 1}`;

    return {
      id:              `product_${i}`,
      sourceIndex:     i,
      refUrl:          url,
      manualKind,
      resolvedKind,
      interactionMode,
      promptKindLabel,
      label,
      isPackaging:     false,
      priority:        'required' as const,
    };
  });

  const rawPackaging = [refs.packagingRef, ...(refs.packagingRefs ?? [])].filter(Boolean) as string[];
  const packagingItems: ProductHaulItem[] = rawPackaging.map((url, i) => ({
    id:              `packaging_${i}`,
    sourceIndex:     i,
    refUrl:          url,
    manualKind:      'auto' as HaulRefKind,
    resolvedKind:    'generic_product' as ProductHaulResolvedKind,
    interactionMode: 'held_or_displayed' as ProductInteractionMode,
    promptKindLabel: 'PRODUCT PACKAGING / BOX (the container the products arrived in)',
    label:           `Empaque ${i + 1}`,
    isPackaging:     true,
    priority:        'optional' as const,
  }));

  const allItems = [...featuredItems, ...packagingItems];

  const requiredFeatureItemIds = featuredItems.map(it => it.id);
  const optionalItemIds        = packagingItems.map(it => it.id);

  const ledger: ProductHaulCoverageLedgerItem[] = allItems.map(it => ({
    itemId:                     it.id,
    manualKind:                 it.manualKind,
    resolvedKind:               it.resolvedKind,
    label:                      it.label,
    required:                   it.priority === 'required',
    plannedHeroShots:           0,
    plannedSupportShots:        0,
    actualPromptedHeroShots:    0,
    actualPromptedSupportShots: 0,
    coverageStatus:             'uncovered' as const,
    shotIds:                    [],
  }));

  const coveragePlan: ProductHaulCoveragePlan = {
    requiredFeatureItemIds,
    optionalItemIds,
    plannedCoverage: Object.fromEntries(allItems.map(it => [it.id, 0])),
    missingCoverage: [],
    ledger,
    uncoveredRequiredItems: [],
    supportOnlyItems:       [],
    overexposedItems:       [],
    coverageWarnings:       [],
  };

  return {
    totalItems: allItems.length,
    featuredItems,
    packagingItems,
    allItems,
    requestedCount,
    maxStoryShots,
    coveragePlan,
  };
}

// ═══════════════════════════════════════════════════════════════
// Shot planner — 3 fases:
//   1. Coverage obligatoria: cada producto → 1 PRODUCT_FEATURE hero shot
//   2. Budget narrativo: PRODUCT_OVERVIEW (apertura) + PRODUCT_UNBOXING_N
//      (empaque) + PRODUCT_RECAP (cierre)
//   3. Interleaving: empaque intercalado entre los feature shots
// ═══════════════════════════════════════════════════════════════

export function buildProductHaulShotPlan(
  manifest: ProductHaulManifest,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const total = manifest.maxStoryShots;

  const ledgerMap = new Map<string, ProductHaulCoverageLedgerItem>(
    manifest.coveragePlan.ledger.map(l => [l.itemId, { ...l }]),
  );
  const addHeroShot = (itemId: string, shotKey: string) => {
    const l = ledgerMap.get(itemId);
    if (l) { l.plannedHeroShots++; l.shotIds.push(shotKey); }
  };
  const addSupportShot = (itemId: string, shotKey: string) => {
    const l = ledgerMap.get(itemId);
    if (l) { l.plannedSupportShots++; l.shotIds.push(shotKey); }
  };

  type PlannedShot = Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>;

  // ── PHASE 1 — Coverage obligatoria: 1 hero shot por producto ──────────
  const obligatoryFeatures: PlannedShot[] = manifest.featuredItems.map((item, idx) => {
    const shot = buildProductFeatureShot(item, idx, manifest.featuredItems.length);
    addHeroShot(item.id, shot.key);
    return shot;
  });

  // ── PHASE 2 — Budget narrativo: overview + unboxing + recap ───────────
  const narrativeBudget = Math.max(0, total - obligatoryFeatures.length);
  const narrativeShots: PlannedShot[] = [];

  if (narrativeBudget >= 1) {
    const overview = buildProductOverviewShot(manifest);
    narrativeShots.push(overview);
    manifest.featuredItems.forEach(it => addSupportShot(it.id, overview.key));
  }

  const varietyBudgetRaw = narrativeBudget - 1; // -1 para overview
  const wantRecap = manifest.featuredItems.length >= 2 && varietyBudgetRaw >= 1;
  const unboxingBudget = Math.max(0, varietyBudgetRaw - (wantRecap ? 1 : 0));
  const unboxingCount  = Math.min(manifest.packagingItems.length, unboxingBudget);

  const unboxingShots: PlannedShot[] = manifest.packagingItems.slice(0, unboxingCount).map((item, idx) => {
    const shot = buildProductUnboxingShot(item, idx);
    addHeroShot(item.id, shot.key);
    return shot;
  });

  const recapShot: PlannedShot[] = wantRecap ? [buildProductRecapShot(manifest)] : [];
  if (wantRecap) manifest.featuredItems.forEach(it => addSupportShot(it.id, 'PRODUCT_RECAP'));

  // ── PHASE 3 — Interleaving: empaque intercalado entre los feature shots ──
  // En vez de [overview, ...features, ...unboxing, recap], intercalamos
  // unboxing entre los features para que no quede todo agrupado al final.
  const interleaved: PlannedShot[] = [];
  if (narrativeShots.length > 0) interleaved.push(narrativeShots[0]); // overview siempre primero

  const features = [...obligatoryFeatures];
  const unboxing = [...unboxingShots];
  // Distribuir unboxing shots uniformemente entre los features (no todos al principio ni al final)
  const step = unboxing.length > 0 ? Math.max(1, Math.floor(features.length / (unboxing.length + 1))) : Infinity;
  let unboxingCursor = 0;
  features.forEach((shot, idx) => {
    interleaved.push(shot);
    const shouldInsertUnboxing = unboxingCursor < unboxing.length && (idx + 1) % step === 0;
    if (shouldInsertUnboxing) {
      interleaved.push(unboxing[unboxingCursor]);
      unboxingCursor++;
    }
  });
  // Cualquier unboxing shot restante (por redondeo) se agrega antes del recap
  while (unboxingCursor < unboxing.length) {
    interleaved.push(unboxing[unboxingCursor]);
    unboxingCursor++;
  }

  interleaved.push(...recapShot);

  // Export ledger final al manifest para debug
  manifest.coveragePlan.ledger = Array.from(ledgerMap.values());
  manifest.coveragePlan.uncoveredRequiredItems = manifest.coveragePlan.ledger
    .filter(l => l.required && l.plannedHeroShots === 0)
    .map(l => l.itemId);

  return interleaved.slice(0, total);
}

// ── Shot builders ───────────────────────────────────────────────

function buildProductOverviewShot(
  manifest: ProductHaulManifest,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const itemCount  = manifest.featuredItems.length;
  const allItemIds = manifest.allItems.map(it => it.id);
  return {
    key:    'PRODUCT_OVERVIEW',
    beat:   'context',
    role:   'PRODUCT OVERVIEW',
    purpose: `Opening shot: all (or most) products visible together as a collection — on a table, desk, bed, or tray. ${itemCount} products visible. The person may be partially visible arranging or looking at the set. Communicates "look what arrived" / "this is my new set." NOT a studio catalog shot.`,
    requiredElements:  ['products_visible_as_collection', 'real_room_context', 'organic_not_catalog_arrangement'],
    forbiddenElements: ['white_background', 'studio_lighting', 'catalog_grid', 'forced_symmetry', 'editorial_polish', 'invented_products_not_in_set', 'extra_furniture_not_in_ref0'],
    variationSpace: [
      `flat lay of all ${itemCount} products on a table or bed — natural arrangement, real surface visible`,
      `overhead shot of products spread on a desk or tray, packaging partially visible nearby`,
      `person holding several products up toward camera, multiple items visible, genuine "look what I got" energy`,
      `products arranged on a surface with the person partially in frame, reaching for one`,
    ],
    framing:     'WIDE_OR_OVERHEAD',
    composition: 'PRODUCT_COLLECTION_VISIBLE',
    cameraAngle: 'OVERHEAD_OR_EYE_LEVEL',
    hpiAllowed:  false,
    wearState:   'not_wearing_final_outfit',
    cameraMode:  'object_flatlay',
    productHaulItemPlan: {
      primaryItems:    allItemIds,
      heldItems:       [],
      surfaceItems:    allItemIds,
      backgroundItems: [],
      forbiddenItems:  [],
      integrationNote: 'All uploaded products visible as a collection — opening shot of the set',
    },
  };
}

function buildProductFeatureShot(
  item:       ProductHaulItem,
  itemIndex:  number,
  totalItems: number,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const shotNum = itemIndex + 1;
  const interactionBlock = buildProductInteractionBlock(item);

  const variationsByMode: Record<ProductInteractionMode, string[]> = {
    applied_to_face_or_body: [
      `close-medium shot applying ${item.label} to face/skin — fingertips active, genuine focused expression`,
      `medium shot dispensing ${item.label} onto hand before application, natural bathroom/vanity light`,
      `person applying ${item.label} near a mirror, candid angle, product clearly visible in hand`,
      `close-up of ${item.label} being patted/smoothed onto skin, texture and product both readable`,
    ],
    held_and_used: [
      `medium shot holding and operating ${item.label}, thumb near interface, curious engaged expression`,
      `close-medium shot demonstrating a feature of ${item.label}, natural desk or room context`,
      `person examining ${item.label} closely, turning it to see a detail, genuine interest`,
      `${item.label} held toward camera mid-use, casual UGC framing, real room behind`,
    ],
    held_or_consumed: [
      `medium shot holding ${item.label}, natural grip, examining the packaging or label`,
      `person taking a natural sip/bite of ${item.label}, candid, not posed`,
      `close-medium shot of ${item.label} held near camera, genuine curious expression`,
      `${item.label} held at the table, natural light, person glancing at it`,
    ],
    held_or_displayed: [
      `medium shot holding ${item.label} toward camera, relaxed grip, natural expression`,
      `close-up of ${item.label} resting in hand, label/packaging readable`,
      `person examining ${item.label}, turning it slightly, genuine curiosity`,
      `${item.label} placed on a real surface with the person nearby, natural light`,
    ],
  };

  const variations = variationsByMode[item.interactionMode] ?? variationsByMode.held_or_displayed;

  return {
    key:    `PRODUCT_FEATURE_${shotNum}`,
    beat:   'action',
    role:   `PRODUCT FEATURE ${shotNum}/${totalItems} — ${item.label}`,
    purpose: `The person interacting with ${item.label} (product ${shotNum} of ${totalItems}). ${interactionBlock} Real room visible. iPhone UGC feel, not a studio ad.`,
    requiredElements:  [
      'avatar_interacting_with_item',
      'product_clearly_visible_and_readable',
      'real_environment_visible',
      'interaction_matches_product_type',
      'no_catalog_pose',
    ],
    forbiddenElements: ['catalog_stance', 'studio_backdrop', 'white_background', 'ad_composition', 'editorial_lighting', 'interaction_mismatched_with_product_type'],
    variationSpace:    variations,
    framing:     'MEDIUM_OR_CLOSE',
    composition: 'PRODUCT_INTERACTION_IN_REAL_CONTEXT',
    cameraAngle: 'EYE_LEVEL',
    hpiAllowed:  true,
    hpiScope:    'full',
    wearState:   'not_wearing_final_outfit',
    cameraMode:  'third_person',
    productHaulItemPlan: {
      primaryItems:    [item.id],
      heldItems:       item.interactionMode === 'applied_to_face_or_body' ? [] : [item.id],
      surfaceItems:    [],
      backgroundItems: [],
      forbiddenItems:  [],
      integrationNote: `Person interacting with ${item.label} as primary product — interaction mode: ${item.interactionMode}`,
    },
  };
}

function buildProductUnboxingShot(
  item:       ProductHaulItem,
  itemIndex:  number,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const shotNum = itemIndex + 1;
  return {
    key:    `PRODUCT_UNBOXING_${shotNum}`,
    beat:   'reveal',
    role:   `UNBOXING — ${item.label}`,
    purpose: `The person opening or revealing ${item.label} — the packaging/box the products arrived in. Hands actively opening, lifting a flap, or holding the box open toward camera. Genuine "unboxing" energy, not a studio product shot.`,
    requiredElements:  ['packaging_clearly_visible', 'hands_actively_opening_or_revealing', 'real_room_context'],
    forbiddenElements: ['studio_backdrop', 'white_background', 'branded_logos_not_in_reference', 'catalog_product_shot'],
    variationSpace: [
      `hands opening ${item.label}, flaps lifted, genuine reveal moment`,
      `medium shot holding ${item.label} open toward camera, contents partially visible`,
      `overhead shot of ${item.label} being opened on a table, natural light`,
      `close-up of hands lifting the lid or flap of ${item.label}`,
    ],
    framing:     'MEDIUM_OR_CLOSE',
    composition: 'PACKAGING_REVEAL',
    cameraAngle: 'EYE_LEVEL_OR_OVERHEAD',
    hpiAllowed:  true,
    hpiScope:    'micro_action_only',
    wearState:   'not_wearing_final_outfit',
    cameraMode:  'third_person',
    productHaulItemPlan: {
      primaryItems:    [item.id],
      heldItems:       [item.id],
      surfaceItems:    [],
      backgroundItems: [],
      forbiddenItems:  [],
      integrationNote: `Opening/revealing ${item.label} — packaging moment, not a featured product`,
    },
  };
}

function buildProductRecapShot(
  manifest: ProductHaulManifest,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const allItemIds = manifest.featuredItems.map(it => it.id);
  return {
    key:    'PRODUCT_RECAP',
    beat:   'atmosphere',
    role:   'PRODUCT RECAP',
    purpose: `Closing shot. The person surrounded by the products already shown — on a table, desk, or tray. Relaxed, natural mood. Communicates "these are my essentials for X" / "that's everything." iPhone UGC energy, not editorial.`,
    requiredElements:  ['products_visible_in_background_or_nearby', 'natural_relaxed_mood', 'person_present'],
    forbiddenElements: ['catalog_pose', 'studio_backdrop', 'editorial_lighting', 'forced_symmetry', 'ad_feel', 'invented_new_products_never_shown'],
    variationSpace: [
      `person sitting or standing near the products — items visible on table/desk, relaxed smile`,
      `medium shot of person holding a favorite product, background shows the rest of the set`,
      `overhead view of person near the products spread out — camera above, everything visible`,
      `person looking at the products, genuine satisfied expression, end-of-session energy`,
    ],
    framing:     'WIDE_OR_MEDIUM',
    composition: 'PERSON_IN_PRODUCT_CONTEXT',
    cameraAngle: 'EYE_LEVEL_OR_OVERHEAD',
    hpiAllowed:  true,
    hpiScope:    'full',
    wearState:   'not_wearing_final_outfit',
    cameraMode:  'third_person',
    productHaulItemPlan: {
      primaryItems:    allItemIds,
      heldItems:       [],
      surfaceItems:    allItemIds,
      backgroundItems: [],
      forbiddenItems:  [],
      integrationNote: 'Closing shot — products already featured visible around the person, no new items',
    },
  };
}
