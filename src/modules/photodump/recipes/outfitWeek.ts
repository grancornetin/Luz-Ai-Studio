/**
 * recipes/outfitWeek.ts
 * Receta outfit_week (Favoritos de la semana) — Fase 3 de la división de
 * photodumpDirectorService.ts.
 *
 * Bloque de autoridad WEEKLY_SLOT_COVERAGE_MODE, HPI seguro, manifest,
 * clasificación de ítems, role templates, planner de shots, coverage map,
 * dominance check y conversión a PhotodumpShotDirective.
 *
 * Código movido tal cual desde photodumpDirectorService.ts — sin reescribir lógica.
 * La integración dentro de generatePhotodumpShot y buildPhotodumpSessionPlan
 * (compartidos con outfit_check y outfit_haul) permanece en el archivo principal
 * por ahora — se separará cuando esas recetas también tengan su propio archivo.
 */
import { MomentType, PhotodumpShotDirective, buildAvatarBaseClothingFingerprint } from './shared';
import { resolveReferenceTagsFromBrief } from './briefTags';

// ── WeeklySlotCoverageMode — bloque de autoridad para outfit_week ─────────────
//
// outfit_week NO es una campaña narrativa con destino y arco de personaje.
// Es un sistema de cobertura visual de ítems seleccionados.
// Este bloque se inyecta como PRIMERA directiva de modo en cada prompt de outfit_week.
// Establece la jerarquía de autoridad y desactiva el destination inference a nivel de escena.
export const WEEKLY_SLOT_COVERAGE_MODE = `╔═══════════════════════════════════════════════════════════════════╗
║           WEEKLY SLOT COVERAGE MODE — OUTFIT WEEK                ║
║       (OVERRIDES narrative arc, destination, story logic)        ║
╚═══════════════════════════════════════════════════════════════════╝

🎯 MODE: SLOT COVERAGE — NOT A NARRATIVE CAMPAIGN

This is a weekly outfit edit: the user uploaded N looks / items for this week.
Your ONLY job is to show each look faithfully, one per shot, in the environment established by REF0.

AUTHORITY HIERARCHY (non-negotiable — highest priority first):

  1. SLOT COVERAGE: Every uploaded outfit must be shown. Coverage is the primary success metric.
     A shot that shows the wrong outfit, a duplicate, or an invented outfit = HARD FAILURE.

  2. VISUAL SLOT FIDELITY: The garment reference image is the sole source of truth.
     Color, silhouette, material, cut — all locked to the reference. No upgrades, no simplifications.

  3. BRIEF TAG ASSOCIATIONS: If the brief links items (@outfit3 + @accesorio2 together),
     those items appear together in the same shot. No other pairing is invented.

  4. IDENTITY CONSISTENCY: Same face, same skin, same hair across all shots. REF0 anchors the room.

  5. UGC REALISM: Simple, authentic, real-life iPhone feel. Real room. Real light.

  6. NARRATIVE DIVERSITY (lowest priority): Vary framing and angle between shots for visual interest.
     This is a secondary nice-to-have — NEVER override any of the above.

⛔ WHAT THIS MODE DISABLES — HARD OFF FOR outfit_week:

  ❌ Destination inference as capture location
     — "cena", "dinner", "oficina", "playa", "viaje" describe the CLOTHES' intended use, NOT the filming location.
     — The user is always shooting at HOME in the REF0 environment.
     — Never move the scene to a restaurant, office, airport, beach, event venue, or any other destination.

  ❌ Creative story arc and narrative protagonist logic
     — There is NO character journey. There is NO first-act / second-act / closing structure.
     — Each shot is independent — it shows one look from the weekly selection. Full stop.

  ❌ HPI that overrides slot coverage
     — Poses must serve the garment visibility, not the other way around.
     — No HPI suggestion may cause the wrong outfit to appear, the garment to be cropped out, or the scene to shift.

  ❌ Family blocks that import props, locations, or narrative layers
     — No prop, color palette, or ambient element from a narrative family overrides REF0.

  ❌ Outfit mood reinterpretation
     — "casual", "arreglado", "vibrante", "de cena" describe the CHARACTER of the clothes.
     — They do NOT license the model to change the outfit, invent a different garment, or relocate the scene.

  ❌ Invented garments as fallback
     — If a slot has no reference image, the person holds a neutral garment or the shot is a detail/overview.
     — Never invent a look to fill a gap.

✅ WHAT THE BRIEF IS ALLOWED TO DO:

  ✓ Provide mood adjectives for the clothes: "casual", "elegante", "colorido", "minimalista".
  ✓ Define order: "empieza con @outfit2".
  ✓ Specify pairings: "@outfit3 con @accesorio2 juntos en el mismo shot".
  ✓ Add soft narrative tone: "una semana cargada / outfits de diario + uno especial".
  ✓ Adjust composition notes: "empezamos con un flat lay de todo".

  ✗ The brief CANNOT: change the filming location, invent outfits, replace slots, or trigger destination shots.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
// ── Weekly Safe HPI — poses naturales para outfit_week ───────────────────────
// Sin poses de fitness, sin editorial extremo, sin torso twists raros.
// Solo lifestyle natural: de pie, espejo, caminando, ajustando, sosteniendo.
export function buildWeeklySafeHpiBlock(shotKey: string, gender: 'female' | 'male' | 'neutral'): string {
  const genderNote = gender === 'male' ? 'masculine' : 'feminine';

  // Shots sin cuerpo completo — overview, detalle, accesorio solo
  if (
    shotKey.includes('WEEK_OVERVIEW') ||
    shotKey.includes('WEEK_ACCESSORY_DETAIL') ||
    shotKey.includes('WEEK_DETAIL')
  ) return '';

  if (shotKey.includes('WEEK_MIRROR_LOOK')) {
    return `🎯 BODY LANGUAGE (weekly — mirror check, natural ${genderNote}):
The person checks their outfit in a mirror. Natural, real-life posture:
  - standing facing the mirror, full body visible in reflection
  - slight weight shift, one hand on hip or adjusting a sleeve
  - phone visible if it is a selfie, or third-person capture without phone
  - expression: genuine, checking — not posed for a shoot
FORBIDDEN: extreme torso twist, over-shoulder editorial, lat pulldown stance, fitness pose, catalog stance.
This is a real person checking their look — not a brand shoot.`;
  }

  if (shotKey.includes('WEEK_STYLING_PROCESS')) {
    return `🎯 MICRO-ACTION (weekly — styling process, natural ${genderNote}):
The person is getting dressed or styling a piece. Choose ONE real action:
  - adjusting sleeve or cuff
  - buttoning a jacket or blazer
  - tucking in a blouse
  - putting on earrings or adjusting them
  - arranging a scarf or collar
  - slipping on a shoe and adjusting the strap
  - smoothing fabric at the waist
FORBIDDEN: catalog stance, athletic pose, arms symmetrically at sides, gym gesture, fitness move.
The action must feel authentic — like getting ready in real life.`;
  }

  if (shotKey.includes('WEEK_ACCESSORY_WORN') || shotKey.includes('WEEK_ACCESSORY_INTEGRATED')) {
    return `🎯 BODY LANGUAGE (weekly — accessory worn, natural ${genderNote}):
The person wears or holds the accessory naturally with the outfit. Choose ONE:
  - tilting head slightly to show earrings, natural expression
  - hand lightly at collar area showing a necklace
  - holding bag at side or on shoulder while looking ahead naturally
  - wrist extended naturally showing a bracelet or watch
  - walking naturally with bag on shoulder, candid energy
FORBIDDEN: product-shoot pose, extreme arm extension, catalog presentation, fitness stance.
The accessory should feel naturally integrated — not displayed like a product catalog.`;
  }

  if (shotKey.includes('WEEK_ON_THE_GO')) {
    return `🎯 BODY LANGUAGE (weekly — on the go, natural ${genderNote}):
Person is in motion — walking, arriving, leaving. Candid energy.
  - mid-step with natural arm swing
  - turning to look at something, slight movement
  - arriving and looking ahead, not at camera
  - bag swinging naturally as they walk
FORBIDDEN: static catalog pose, gym walk, over-the-shoulder forced look, editorial model walk.
This is real movement, not a runway.`;
  }

  if (shotKey.includes('WEEK_CLOSER') || shotKey.includes('WEEK_FAVORITE')) {
    return `🎯 BODY LANGUAGE (weekly closer — relaxed ${genderNote} energy):
End of the weekly edit. Relaxed, low-key, genuine. Choose ONE:
  - seated on edge of bed or chair, relaxed and natural
  - standing with slight lean, arms loosely down or one hand in pocket
  - holding favorite item naturally, looking at it
  - mirror selfie from a slightly different angle than any prior mirror shot
FORBIDDEN: catalog stance, forced smile, fitness pose, editorial tension.
The mood is: done with the week, genuine, real.`;
  }

  // Default: look hero y otros shots con cuerpo completo
  return `🎯 BODY LANGUAGE (weekly look — natural ${genderNote} stance):
The person is wearing the weekly outfit. Choose ONE natural posture:
  - standing naturally with slight weight shift, arms loosely at sides or one hand at pocket
  - leaning against wall or surface, relaxed and casual
  - looking down at outfit momentarily, then back to neutral
  - walking naturally toward or past the camera
  - hand adjusting a sleeve, collar, or hem — micro-action
FORBIDDEN: catalog mannequin pose, extreme torso twist, lat pulldown, reclined couch editorial, athletic stance, gym movement, over-shoulder forced look.
USE INSTEAD: natural standing, adjusting sleeve, mirror selfie, holding bag, putting earrings, walking naturally, looking down at outfit, hand on waistband, seated casual.
This is a real person sharing their weekly looks — not a brand shoot.

⚠️ SAFE LANGUAGE — DO NOT USE THESE TERMS:
sexy, revealing, bodycon catsuit, sensual, seductive, skin-tight, sheer body.
USE INSTEAD: fashion outfit, weekly look, natural fit, casual lifestyle.`;
}
function classifyWeeklyItemFromSlot(
  refUrl:      string,
  sourceIndex: number,
  slotType:    'outfit' | 'accesorio' | 'producto',
  manualKind:  import('../types').HaulRefKind,
  slotIndex:   number,
): import('../types').WeeklyItem {
  // Derivar WeeklyItemKind desde el slotType y el selector manual
  let kind: import('../types').WeeklyItemKind;
  let id: string;
  let label: string;
  let tryOnEligible = false;
  let accessoryEligible = false;
  let canBeIntegratedWithOutfit = false;

  if (slotType === 'outfit') {
    id    = `outfit_${slotIndex}`;
    label = `Outfit ${slotIndex + 1}`;
    // Derivar kind según selector
    switch (manualKind) {
      case 'vestido':    kind = 'dress';       tryOnEligible = true; break;
      case 'enterizo':   kind = 'onepiece';    tryOnEligible = true; break;
      case 'top':        kind = 'top';         tryOnEligible = true; break;
      case 'bottom':     kind = 'bottom';      tryOnEligible = true; break;
      case 'chaqueta':   kind = 'outerwear';   tryOnEligible = true; break;
      case 'calzado':    kind = 'footwear';    break;
      case 'bolso':      kind = 'bag';         accessoryEligible = true; canBeIntegratedWithOutfit = true; break;
      case 'joyeria':    kind = 'jewelry';     accessoryEligible = true; canBeIntegratedWithOutfit = true; break;
      case 'accesorio':  kind = 'accessory';   accessoryEligible = true; canBeIntegratedWithOutfit = true; break;
      case 'varios_items': kind = 'outfit_set'; tryOnEligible = true; break;
      default:           kind = 'outfit_set';  tryOnEligible = true;
    }
  } else if (slotType === 'accesorio') {
    id    = `acc_${slotIndex}`;
    accessoryEligible = true;
    canBeIntegratedWithOutfit = true;
    switch (manualKind) {
      case 'bolso':      kind = 'bag';      label = `Bolso ${slotIndex + 1}`;    break;
      case 'calzado':    kind = 'footwear'; label = `Calzado ${slotIndex + 1}`;  break;
      case 'joyeria':    kind = 'jewelry';  label = `Joyería ${slotIndex + 1}`;  break;
      default:           kind = 'accessory'; label = `Accesorio ${slotIndex + 1}`;
    }
  } else {
    // producto
    id    = `producto_${slotIndex}`;
    label = `Producto ${slotIndex + 1}`;
    kind  = 'product';
  }

  return {
    id,
    sourceIndex,
    refUrl,
    kind,
    label,
    priority:                 'required',
    tryOnEligible,
    detailEligible:           true,
    accessoryEligible,
    canBeIntegratedWithOutfit,
    compatibleWith:           [],
  };
}

function classifyWeeklyItem(
  refUrl: string,
  sourceIndex: number,
  isOutfitSlot: boolean,
  slotIndex: number,
): import('../types').WeeklyItem {
  const kind: import('../types').WeeklyItemKind = isOutfitSlot ? 'outfit_set' : 'accessory';
  return {
    id:                       isOutfitSlot ? `outfit_${slotIndex}` : `acc_${slotIndex}`,
    sourceIndex,
    refUrl,
    kind,
    label:                    isOutfitSlot ? `Outfit ${slotIndex + 1}` : `Accesorio ${slotIndex + 1}`,
    priority:                 'required',
    tryOnEligible:            isOutfitSlot,
    detailEligible:           true,
    accessoryEligible:        !isOutfitSlot,
    canBeIntegratedWithOutfit: !isOutfitSlot,
    compatibleWith:           [],
  };
}

// Detecta el tipo dominante del set para adaptar los roles narrativos
function detectWeeklyDominantType(
  allItems: import('../types').WeeklyItem[],
): import('../types').WeeklySetDominantType {
  const total = allItems.length;
  if (total === 0) return 'mixed';

  // Contar por categoría
  const outfitCount   = allItems.filter(it => ['outfit_set', 'dress', 'onepiece', 'garment', 'top', 'bottom', 'outerwear'].includes(it.kind)).length;
  const bagCount      = allItems.filter(it => it.kind === 'bag').length;
  const footwearCount = allItems.filter(it => ['footwear', 'shoes', 'boots'].includes(it.kind)).length;
  const jewelryCount  = allItems.filter(it => it.kind === 'jewelry').length;
  const makeupCount   = allItems.filter(it => ['makeup', 'lipstick', 'makeup_color', 'beauty_product'].includes(it.kind)).length;
  const skincareCount = allItems.filter(it => it.kind === 'skincare').length;
  const productCount  = allItems.filter(it => ['product', 'tech'].includes(it.kind)).length;
  const accCount      = allItems.filter(it => it.kind === 'accessory').length;

  const threshold = Math.ceil(total * 0.5);

  if (outfitCount >= threshold) return 'outfits';
  if (bagCount >= threshold) return 'bags';
  if (footwearCount >= threshold) return 'footwear';
  if (jewelryCount >= threshold) return 'jewelry';
  if (makeupCount >= threshold) return 'beauty';
  if (skincareCount >= threshold) return 'skincare';
  if (productCount >= threshold) return 'products';
  // Fallback por categoría dominante individual
  if (outfitCount > 0 && outfitCount >= Math.max(bagCount, footwearCount, jewelryCount, makeupCount, skincareCount, productCount, accCount)) return 'outfits';
  if (makeupCount + skincareCount > 0 && (makeupCount + skincareCount) >= Math.max(outfitCount, bagCount, footwearCount)) return 'beauty';
  return 'mixed';
}

// Compatibilidad accesorio ↔ outfit — 0–100
// Sin análisis visual: usa el tipo de ítem para determinar modo de integración.
// El prompt builder refina con instrucciones de compatibilidad de estilo/color.
function scoreWeeklyCompatibility(
  acc: import('../types').WeeklyItem,
  outfit: import('../types').WeeklyItem,
): { score: number; reason: string; integrationMode: 'worn' | 'held' | 'flatlay' | 'detail' } {
  const baseScore = acc.kind === 'jewelry' ? 80
    : acc.kind === 'bag'                    ? 75
    : acc.kind === 'shoes' || acc.kind === 'boots' ? 70
    : 65;

  const integrationMode: 'worn' | 'held' | 'flatlay' | 'detail' =
    acc.kind === 'jewelry'                        ? 'worn'
    : acc.kind === 'bag'                          ? 'held'
    : acc.kind === 'shoes' || acc.kind === 'boots' ? 'worn'
    : 'held';

  return {
    score: baseScore,
    reason: `${acc.label} pairs naturally with ${outfit.label} (${integrationMode})`,
    integrationMode,
  };
}

// ── Role templates por dominantType ──────────────────────────
// Define la secuencia base de roles narrativos para cada tipo de set.
// El planner rellena los heroes con los outfits reales del manifest.
function getWeeklyRoleTemplate(
  dominant: import('../types').WeeklySetDominantType,
  outfitCount: number,
  accCount: number,
  count: number,
): import('../types').WeeklyShotRole[] {
  if (dominant === 'outfits' || (dominant === 'mixed' && outfitCount >= accCount)) {
    // Template A: outfits de la semana
    // Estructura: OVERVIEW → N look heroes → ACC_INTEGRATED × acc → CLOSER
    const roles: import('../types').WeeklyShotRole[] = ['WEEK_OVERVIEW'];
    const heroSlots = Math.min(outfitCount, count - 2 - Math.min(accCount, Math.floor((count - 2) / 4)));
    for (let i = 0; i < heroSlots; i++) {
      // Romper monotonía: cada 3er hero usa MIRROR_LOOK
      roles.push(i % 3 === 2 ? 'WEEK_MIRROR_LOOK' : 'WEEK_LOOK_HERO');
    }
    const accSlots = Math.min(accCount, count - roles.length - 1);
    for (let i = 0; i < accSlots; i++) roles.push('WEEK_ACCESSORY_INTEGRATED');
    roles.push('WEEK_CLOSER');
    return roles;
  }

  if (dominant === 'accessories') {
    // Template B: accesorios de la semana — sin forzar full-body looks
    return [
      'WEEK_OVERVIEW',
      'WEEK_ACCESSORY_WORN',
      'WEEK_ACCESSORY_HELD',
      'WEEK_ACCESSORY_DETAIL',
      'WEEK_ACCESSORY_WORN',
      'WEEK_ACCESSORY_HELD',
      'WEEK_ACCESSORY_DETAIL',
      'WEEK_CLOSER',
    ].slice(0, count) as import('../types').WeeklyShotRole[];
  }

  if (dominant === 'bags') {
    return [
      'WEEK_OVERVIEW',
      'WEEK_ACCESSORY_HELD',
      'WEEK_ACCESSORY_DETAIL',
      'WEEK_ACCESSORY_HELD',
      'WEEK_DETAIL',
      'WEEK_ACCESSORY_HELD',
      'WEEK_DETAIL',
      'WEEK_CLOSER',
    ].slice(0, count) as import('../types').WeeklyShotRole[];
  }

  if (dominant === 'makeup') {
    return [
      'WEEK_OVERVIEW',
      'WEEK_DETAIL',
      'WEEK_STYLING_PROCESS',
      'WEEK_DETAIL',
      'WEEK_ACCESSORY_DETAIL',
      'WEEK_STYLING_PROCESS',
      'WEEK_DETAIL',
      'WEEK_CLOSER',
    ].slice(0, count) as import('../types').WeeklyShotRole[];
  }

  // mixed — balance
  const roles: import('../types').WeeklyShotRole[] = ['WEEK_OVERVIEW'];
  if (outfitCount > 0) roles.push('WEEK_LOOK_HERO');
  if (accCount > 0) roles.push('WEEK_ACCESSORY_INTEGRATED');
  if (outfitCount > 1) roles.push('WEEK_LOOK_HERO');
  if (accCount > 1) roles.push('WEEK_ACCESSORY_WORN');
  roles.push('WEEK_DETAIL', 'WEEK_CLOSER');
  return roles.slice(0, count);
}

// ── Plan de integración de accesorios: distribución anti-acumulación ──
// Garantiza que los accesorios se repartan entre distintos outfits.
function buildWeeklyAccessoryIntegrationPlan(
  accessoryItems:    import('../types').WeeklyItem[],
  outfitItems:       import('../types').WeeklyItem[],
  compatPairs:       import('../types').WeeklyCompatibilityPair[],
  accCloseup:        boolean[],
  explicitPairings?: Record<string, string>,  // accId → outfitId — del brief (@accessory2 con @outfit3)
): import('../types').WeeklyAccessoryIntegrationEntry[] {
  const plan: import('../types').WeeklyAccessoryIntegrationEntry[] = [];
  // Rastrea cuántas veces fue elegido cada outfit para el reparto
  const outfitUsageCount: Record<string, number> = {};
  for (const o of outfitItems) outfitUsageCount[o.id] = 0;

  for (let ai = 0; ai < accessoryItems.length; ai++) {
    const acc = accessoryItems[ai];

    // Si el brief tuvo un pairing explícito para este accesorio, respetarlo primero
    const explicitOutfitId = explicitPairings?.[acc.id];
    if (explicitOutfitId && outfitItems.some(o => o.id === explicitOutfitId)) {
      const explicitOutfit = outfitItems.find(o => o.id === explicitOutfitId)!;
      const mode: 'worn' | 'held' | 'detail' | 'flatlay' | 'macro' =
        acc.kind === 'jewelry' ? 'worn' : acc.kind === 'bag' ? 'held' : 'held';
      outfitUsageCount[explicitOutfitId] = (outfitUsageCount[explicitOutfitId] ?? 0) + 1;
      plan.push({
        accessoryId:        acc.id,
        accessoryLabel:     acc.label,
        selectedOutfitId:   explicitOutfitId,
        compatibleOutfitIds: [explicitOutfitId],
        reason:             `Explicit brief pairing: user said to use with ${explicitOutfit.label}`,
        integrationMode:    mode,
        fallbackToIsolated: false,
      });
      continue;
    }

    const pairs = compatPairs
      .filter(p => p.accessoryId === acc.id)
      .sort((a, b) => b.score - a.score);

    if (pairs.length === 0 || outfitItems.length === 0) {
      plan.push({
        accessoryId:       acc.id,
        accessoryLabel:    acc.label,
        selectedOutfitId:  undefined,
        compatibleOutfitIds: [],
        reason:            'No compatible outfits — isolated shot',
        integrationMode:   acc.kind === 'jewelry' ? 'worn' : acc.kind === 'bag' ? 'held' : 'macro',
        fallbackToIsolated: true,
      });
      continue;
    }

    // Elegir el outfit compatible con MENOR uso hasta ahora — anti-acumulación
    let selectedPair = pairs[0];
    let lowestUsage = outfitUsageCount[pairs[0].outfitId] ?? 0;
    let avoidedOutfitId: string | undefined;
    let avoidedReason: string | undefined;

    for (const pair of pairs) {
      const usage = outfitUsageCount[pair.outfitId] ?? 0;
      if (usage < lowestUsage) {
        lowestUsage = usage;
        avoidedOutfitId = selectedPair.outfitId;
        avoidedReason = `Already used ${outfitUsageCount[selectedPair.outfitId]} times`;
        selectedPair = pair;
      }
    }

    const wouldOverRepeat = lowestUsage >= 2;
    outfitUsageCount[selectedPair.outfitId] = (outfitUsageCount[selectedPair.outfitId] ?? 0) + 1;

    plan.push({
      accessoryId:        acc.id,
      accessoryLabel:     acc.label,
      selectedOutfitId:   selectedPair.outfitId,
      compatibleOutfitIds: pairs.map(p => p.outfitId),
      reason:             selectedPair.reason,
      integrationMode:    selectedPair.integrationMode as 'worn' | 'held' | 'detail' | 'flatlay' | 'macro',
      avoidedBecauseWouldOverRepeat: wouldOverRepeat,
      avoidedOutfitId,
      avoidedReason,
      fallbackToIsolated: false,
    });
  }

  return plan;
}

// ── Reemplazo de shots redundantes — por dominantType ──
// Devuelve un rol alternativo real para el cierre según el tipo de contenido.
function getNonRedundantCloserRole(
  dominant: import('../types').WeeklySetDominantType,
  existingRoles: import('../types').WeeklyShotRole[],
): { role: import('../types').WeeklyShotRole; reason: string } {
  if (dominant === 'outfits') {
    const candidates: Array<{ role: import('../types').WeeklyShotRole; avoid: import('../types').WeeklyShotRole[] }> = [
      { role: 'WEEK_DETAIL',     avoid: ['WEEK_DETAIL'] },
      { role: 'WEEK_ACCESSORY_INTEGRATED', avoid: ['WEEK_ACCESSORY_INTEGRATED', 'WEEK_ACCESSORY_INTEGRATED', 'WEEK_ACCESSORY_INTEGRATED'] },
      { role: 'WEEK_MIRROR_LOOK', avoid: ['WEEK_MIRROR_LOOK', 'WEEK_MIRROR_LOOK'] },
      { role: 'WEEK_FAVORITE',   avoid: ['WEEK_FAVORITE'] },
      { role: 'WEEK_CLOSER',     avoid: [] },
    ];
    for (const c of candidates) {
      const used = existingRoles.filter(r => r === c.avoid[0]).length;
      if (used < 2) return { role: c.role, reason: `Replaced redundant full-body with ${c.role}` };
    }
    return { role: 'WEEK_CLOSER', reason: 'Fallback closer' };
  }
  if (dominant === 'accessories') {
    return { role: 'WEEK_ACCESSORY_DETAIL', reason: 'Accessory detail as closer' };
  }
  if (dominant === 'bags') {
    return { role: 'WEEK_DETAIL', reason: 'Bag interior or texture detail as closer' };
  }
  if (dominant === 'makeup') {
    return { role: 'WEEK_DETAIL', reason: 'Product detail as closer' };
  }
  return { role: 'WEEK_CLOSER', reason: 'Default closer' };
}

// ── Planificador de roles narrativos — núcleo del patch v3 ──
function buildWeeklyShotPlan(
  outfitItems:      import('../types').WeeklyItem[],
  accessoryItems:   import('../types').WeeklyItem[],
  compatPairs:      import('../types').WeeklyCompatibilityPair[],
  accIntPlan:       import('../types').WeeklyAccessoryIntegrationEntry[],
  accCloseup:       boolean[],
  count:            number,
  dominant:         import('../types').WeeklySetDominantType,
  taggedOutfitOrder?: string[],  // IDs en orden del brief (patch v4)
): {
  shotPlan:        import('../types').WeeklyShotPlan[];
  redundancyDebug: import('../types').WeeklyRedundancyDebugEntry[];
  compositionMap:  import('../types').WeeklyCompositionVarietyMap;
} {
  const plan: import('../types').WeeklyShotPlan[] = [];
  const redundancyDebug: import('../types').WeeklyRedundancyDebugEntry[] = [];

  // Obtener template de roles para este dominantType
  const roleTemplate = getWeeklyRoleTemplate(dominant, outfitItems.length, accessoryItems.length, count);

  // Si hay orden explícito del brief, reordenar outfitItems para los hero slots
  // Los outfits taggeados van primero (en el orden del brief), los no taggeados al final
  let orderedOutfitItems = outfitItems;
  if (taggedOutfitOrder && taggedOutfitOrder.length > 0) {
    const taggedSet = new Set(taggedOutfitOrder);
    const inOrder   = taggedOutfitOrder.map(id => outfitItems.find(o => o.id === id)).filter(Boolean) as import('../types').WeeklyItem[];
    const notTagged = outfitItems.filter(o => !taggedSet.has(o.id));
    orderedOutfitItems = [...inOrder, ...notTagged];
  }

  // Rastreadores de uso
  let outfitCursor    = 0;                    // siguiente outfit para hero slots
  let accCursor       = 0;                    // siguiente accesorio para acc slots
  const outfitHeroCount: Record<string, number> = {};
  for (const o of orderedOutfitItems) outfitHeroCount[o.id] = 0;
  const fullBodyCount = { count: 0 };

  for (let si = 0; si < roleTemplate.length && plan.length < count; si++) {
    const role = roleTemplate[si];
    const shotIdx = plan.length;

    let shotPlan: import('../types').WeeklyShotPlan;

    // ── OVERVIEW ──────────────────────────────────────────────
    if (role === 'WEEK_OVERVIEW') {
      // Overview: todos los outfits + accesorios en visible order (max ~5 refs para no saturar)
      const overviewOutfits = outfitItems.slice(0, Math.min(outfitItems.length, 4)).map(it => it.id);
      const overviewAccs    = accessoryItems.slice(0, Math.min(accessoryItems.length, 2)).map(it => it.id);
      shotPlan = {
        role,
        primaryItemIds:   [...overviewOutfits, ...overviewAccs],
        secondaryItemIds: [],
        backgroundItemIds: [],
        forbiddenItemIds: [],
        refsToRoute:      [],
        redundancyScore:  0,
        replacedBecauseRedundant: false,
        compositionMode:  'flatlay_or_rack_all_items',
        visualWeightIntent: 'All weekly items displayed together — NOT a worn look',
      };
    }

    // ── LOOK HERO ─────────────────────────────────────────────
    else if (role === 'WEEK_LOOK_HERO' || role === 'WEEK_MIRROR_LOOK') {
      if (outfitCursor >= orderedOutfitItems.length) {
        // No hay más outfits — reemplazar por detail del último
        const lastOutfit = orderedOutfitItems[orderedOutfitItems.length - 1];
        const { role: altRole, reason } = getNonRedundantCloserRole(dominant, plan.map(s => s.role));
        shotPlan = {
          role: altRole,
          primaryItemIds:   lastOutfit ? [lastOutfit.id] : [],
          secondaryItemIds: [],
          refsToRoute:      [],
          redundancyScore:  8,
          replacedBecauseRedundant: true,
          replacementRole:  altRole,
          replacementReason: `No more outfits left for hero slot ${si}: ${reason}`,
        };
        redundancyDebug.push({ shotIndex: shotIdx, role: role as import('../types').WeeklyShotRole, score: 8, reason: 'No more outfits', replacedBecauseRedundant: true, replacementRole: altRole, replacementReason: reason });
      } else {
        const outfit = orderedOutfitItems[outfitCursor];
        outfitCursor++;
        const heroUseCount = outfitHeroCount[outfit.id] ?? 0;
        outfitHeroCount[outfit.id] = heroUseCount + 1;
        fullBodyCount.count++;

        // Todos los otros outfits como forbidden (no mezclar outfits en hero shots)
        const forbiddenOutfitIds = orderedOutfitItems.filter(o => o.id !== outfit.id).map(o => o.id);

        const redundancyScore = heroUseCount >= 1 ? 9 : fullBodyCount.count > orderedOutfitItems.length ? 6 : 0;
        let finalRole: import('../types').WeeklyShotRole = role;
        let replaced  = false;
        let replacementRole: import('../types').WeeklyShotRole | undefined;
        let replacementReason: string | undefined;

        if (redundancyScore >= 8) {
          const alt = getNonRedundantCloserRole(dominant, plan.map(s => s.role));
          finalRole = alt.role;
          replaced  = true;
          replacementRole   = alt.role;
          replacementReason = alt.reason;
        }

        shotPlan = {
          role:             finalRole,
          primaryItemIds:   [outfit.id],
          secondaryItemIds: [],
          backgroundItemIds: [],
          forbiddenItemIds:  forbiddenOutfitIds,
          outfitIndex:      outfitCursor - 1,
          refsToRoute:      [],
          redundancyScore,
          replacedBecauseRedundant: replaced,
          replacementRole,
          replacementReason,
          compositionMode:  role === 'WEEK_MIRROR_LOOK' ? 'mirror_selfie_full_body' : 'full_body_authentic',
          visualWeightIntent: `${outfit.label} is the sole protagonist — full look readable head to toe${outfit.semanticIntent?.destination ? ` (${outfit.semanticIntent.destination} mood)` : ''}`,
          semanticIntentFromBrief: outfit.semanticIntent,
          resolvedTagsUsed: outfit.tagsUsed,
          avatarBaseClothingForbidden: true,
        };

        redundancyDebug.push({
          shotIndex: shotIdx,
          role: role as import('../types').WeeklyShotRole,
          score: redundancyScore,
          reason: heroUseCount >= 1 ? `${outfit.label} already had a hero shot` : 'First hero for this outfit',
          replacedBecauseRedundant: replaced,
          replacementRole,
          replacementReason,
          redundantShotNotReplaced: redundancyScore >= 8 && !replaced,
        });
      }
    }

    // ── ACCESSORY INTEGRATED ──────────────────────────────────
    else if (role === 'WEEK_ACCESSORY_INTEGRATED') {
      if (accCursor >= accIntPlan.length) {
        // Sin más accesorios — saltar este slot con detail o styiling
        const fallbackRole: import('../types').WeeklyShotRole = orderedOutfitItems.length > 0 ? 'WEEK_DETAIL' : 'WEEK_CLOSER';
        const fallbackOutfit = orderedOutfitItems[Math.max(0, outfitCursor - 1)];
        shotPlan = {
          role:             fallbackRole,
          primaryItemIds:   fallbackOutfit ? [fallbackOutfit.id] : [],
          secondaryItemIds: [],
          refsToRoute:      [],
          redundancyScore:  3,
          replacedBecauseRedundant: false,
          fallbackUsed:     true,
          fallbackRole,
          compositionMode:  'texture_detail_closeup',
          visualWeightIntent: 'Garment detail or texture — no full body needed',
        };
      } else {
        const entry   = accIntPlan[accCursor];
        accCursor++;
        const needsCloseup = accCloseup[accessoryItems.findIndex(a => a.id === entry.accessoryId)] === true;

        if (entry.fallbackToIsolated) {
          // No hay outfit compatible — shot isolado según tipo
          const acc = accessoryItems.find(a => a.id === entry.accessoryId);
          const isoRole: import('../types').WeeklyShotRole =
            acc?.kind === 'jewelry' ? 'WEEK_ACCESSORY_WORN' : 'WEEK_ACCESSORY_HELD';
          shotPlan = {
            role:             isoRole,
            primaryItemIds:   [entry.accessoryId],
            secondaryItemIds: [],
            accessoryId:      entry.accessoryId,
            refsToRoute:      [],
            redundancyScore:  2,
            replacedBecauseRedundant: false,
            compositionMode:  entry.integrationMode === 'worn' ? 'worn_on_body_closeup' : 'held_toward_camera',
            visualWeightIntent: `${entry.accessoryLabel} isolated — no outfit context needed`,
          };
        } else {
          shotPlan = {
            role:             'WEEK_ACCESSORY_INTEGRATED',
            primaryItemIds:   [entry.accessoryId],
            secondaryItemIds: entry.selectedOutfitId ? [entry.selectedOutfitId] : [],
            backgroundItemIds: [],
            forbiddenItemIds:  orderedOutfitItems.filter(o => o.id !== entry.selectedOutfitId).map(o => o.id),
            accessoryId:      entry.accessoryId,
            integratedWithOutfitId: entry.selectedOutfitId,
            refsToRoute:      [],
            redundancyScore:  0,
            replacedBecauseRedundant: false,
            compositionMode:  `accessory_${entry.integrationMode}_with_outfit`,
            visualWeightIntent: `${entry.accessoryLabel} visible as part of the look with the compatible outfit — NOT floating or isolated`,
          };
        }

        // Closeup adicional solo si el usuario lo pidió y hay budget
        if (needsCloseup && plan.length + 1 < count) {
          // Se inserta como un shot extra en el plan (fuera del template)
          plan.push(shotPlan);
          redundancyDebug.push({ shotIndex: plan.length - 1, role: shotPlan.role, score: 0, reason: 'Accessory integrated', replacedBecauseRedundant: false });
          shotPlan = {
            role:             'WEEK_ACCESSORY_DETAIL',
            primaryItemIds:   [entry.accessoryId],
            secondaryItemIds: [],
            accessoryId:      entry.accessoryId,
            refsToRoute:      [],
            redundancyScore:  3,
            replacedBecauseRedundant: false,
            compositionMode:  'macro_detail_closeup',
            visualWeightIntent: `${entry.accessoryLabel} macro — user requested close-up (⭐)`,
          };
        }
      }
    }

    // ── CLOSER ────────────────────────────────────────────────
    else if (role === 'WEEK_CLOSER') {
      const existingRoles = plan.map(s => s.role);
      const fullBodyInPlan = existingRoles.filter(r => r === 'WEEK_LOOK_HERO' || r === 'WEEK_MIRROR_LOOK').length;
      const isRedundant    = fullBodyInPlan >= 2;

      let finalRole: import('../types').WeeklyShotRole = 'WEEK_CLOSER';
      let replaced  = false;
      let replacementRole: import('../types').WeeklyShotRole | undefined;
      let replacementReason: string | undefined;

      if (isRedundant) {
        const alt = getNonRedundantCloserRole(dominant, existingRoles);
        finalRole         = alt.role;
        replaced          = true;
        replacementRole   = alt.role;
        replacementReason = alt.reason;
      }

      const closerOutfit = orderedOutfitItems.length > 0 ? orderedOutfitItems[orderedOutfitItems.length - 1] : null;
      const closerAcc    = accessoryItems.length  > 0 ? accessoryItems[0] : null;

      shotPlan = {
        role:             finalRole,
        primaryItemIds:   closerAcc ? [closerAcc.id] : closerOutfit ? [closerOutfit.id] : [],
        secondaryItemIds: closerOutfit && closerAcc ? [closerOutfit.id] : [],
        refsToRoute:      [],
        redundancyScore:  isRedundant ? 9 : 1,
        replacedBecauseRedundant: replaced,
        replacementRole,
        replacementReason,
        compositionMode:  'closing_non_redundant',
        visualWeightIntent: 'Close the set with a different visual gesture — not another full-body standing pose',
      };

      redundancyDebug.push({
        shotIndex: plan.length,
        role:      'WEEK_CLOSER',
        score:     isRedundant ? 9 : 1,
        reason:    isRedundant ? `${fullBodyInPlan} full-body shots already — closer must differ` : 'Clean closer',
        replacedBecauseRedundant: replaced,
        replacementRole,
        replacementReason,
        redundantShotNotReplaced: isRedundant && !replaced,
      });
    }

    // ── ROLES ESPECÍFICOS de accesorios / makeup / bags ──────
    else if (
      role === 'WEEK_ACCESSORY_WORN' ||
      role === 'WEEK_ACCESSORY_HELD' ||
      role === 'WEEK_ACCESSORY_DETAIL' ||
      role === 'WEEK_DETAIL'
    ) {
      // Asignar el siguiente accesorio disponible (o el último outfit para detail)
      const targetAcc  = accessoryItems[accCursor % Math.max(accessoryItems.length, 1)];
      const targetItem = targetAcc ?? (orderedOutfitItems.length > 0 ? orderedOutfitItems[outfitCursor % orderedOutfitItems.length] : null);
      if (targetAcc) accCursor++;

      const compositionByRole: Record<string, string> = {
        WEEK_ACCESSORY_WORN:   'worn_on_body_macro',
        WEEK_ACCESSORY_HELD:   'held_toward_camera',
        WEEK_ACCESSORY_DETAIL: 'macro_detail_surface',
        WEEK_DETAIL:           'texture_or_material_closeup',
      };

      shotPlan = {
        role,
        primaryItemIds:   targetItem ? [targetItem.id] : [],
        secondaryItemIds: [],
        accessoryId:      targetAcc?.id,
        refsToRoute:      [],
        redundancyScore:  0,
        replacedBecauseRedundant: false,
        compositionMode:  compositionByRole[role] ?? 'detail_shot',
        visualWeightIntent: targetItem ? `${targetItem.label} as the visual focus of this shot` : 'Detail shot',
      };
    }

    // ── STYLING PROCESS / otros ───────────────────────────────
    else {
      const targetOutfit = orderedOutfitItems.length > 0 ? orderedOutfitItems[outfitCursor % orderedOutfitItems.length] : null;
      shotPlan = {
        role,
        primaryItemIds:   targetOutfit ? [targetOutfit.id] : [],
        secondaryItemIds: [],
        refsToRoute:      [],
        redundancyScore:  0,
        replacedBecauseRedundant: false,
        compositionMode:  'process_or_candid',
        visualWeightIntent: 'Candid process moment — not a finished look',
      };
    }

    plan.push(shotPlan);
  }

  // ── Relleno: si quedan slots sin cubrir por el template ───
  while (plan.length < count) {
    const fallbackOutfit = orderedOutfitItems[outfitCursor % Math.max(orderedOutfitItems.length, 1)];
    if (outfitCursor < orderedOutfitItems.length) outfitCursor++;
    plan.push({
      role:             'WEEK_STYLING_PROCESS',
      primaryItemIds:   fallbackOutfit ? [fallbackOutfit.id] : [],
      secondaryItemIds: [],
      refsToRoute:      [],
      redundancyScore:  4,
      replacedBecauseRedundant: false,
      compositionMode:  'process_or_candid',
      visualWeightIntent: 'Filler styling moment',
    });
  }

  // ── Composition variety map ──
  const compositionMap: import('../types').WeeklyCompositionVarietyMap = {
    fullBodyStandingCount:    plan.filter(s => s.role === 'WEEK_LOOK_HERO').length,
    mirrorCount:              plan.filter(s => s.role === 'WEEK_MIRROR_LOOK').length,
    flatlayCount:             plan.filter(s => s.role === 'WEEK_OVERVIEW').length,
    detailCount:              plan.filter(s => s.role === 'WEEK_DETAIL' || s.role === 'WEEK_ACCESSORY_DETAIL').length,
    accessoryIntegratedCount: plan.filter(s => s.role === 'WEEK_ACCESSORY_INTEGRATED').length,
    seatedCount:              0,
    inHandCount:              plan.filter(s => s.role === 'WEEK_ACCESSORY_HELD').length,
    tooManyGenericFullBodyShots: plan.filter(s => s.role === 'WEEK_LOOK_HERO').length > orderedOutfitItems.length + 1,
  };

  return { shotPlan: plan, redundancyDebug, compositionMap };
}

// ── WeeklyItemCoverage con peso visual ──────────────────────
function buildWeeklyCoverageMap(
  allItems:  import('../types').WeeklyItem[],
  shotPlan:  import('../types').WeeklyShotPlan[],
): Record<string, import('../types').WeeklyItemCoverage> {
  const map: Record<string, import('../types').WeeklyItemCoverage> = {};
  for (const item of allItems) {
    map[item.id] = {
      itemId:                       item.id,
      itemKind:                     item.kind,
      label:                        item.label,
      totalAppearances:             0,
      heroAppearances:              0,
      secondaryAppearances:         0,
      detailAppearances:            0,
      integratedAccessoryAppearances: 0,
      overviewAppearances:          0,
      visualWeight:                 0,
      isPrimaryInAnyShot:           false,
      isOnlyBackground:             true,
      isOnlyInOverview:             true,
      realCoverage:                 false,
    };
  }

  const WEIGHT_HERO      = 30;
  const WEIGHT_DETAIL    = 20;
  const WEIGHT_INTEGRATED = 18;
  const WEIGHT_SECONDARY = 10;
  const WEIGHT_OVERVIEW  = 3;

  for (const shot of shotPlan) {
    const isHeroRole   = ['WEEK_LOOK_HERO', 'WEEK_MIRROR_LOOK', 'WEEK_ANCHOR'].includes(shot.role);
    const isDetailRole = ['WEEK_DETAIL', 'WEEK_ACCESSORY_DETAIL', 'WEEK_ACCESSORY_WORN', 'WEEK_ACCESSORY_HELD'].includes(shot.role);
    const isIntRole    = shot.role === 'WEEK_ACCESSORY_INTEGRATED';
    const isOverview   = shot.role === 'WEEK_OVERVIEW';

    for (const id of shot.primaryItemIds) {
      const cov = map[id];
      if (!cov) continue;
      cov.totalAppearances++;
      cov.isPrimaryInAnyShot = true;
      cov.isOnlyBackground   = false;
      if (!isOverview) cov.isOnlyInOverview = false;

      if (isHeroRole)   { cov.heroAppearances++; cov.visualWeight += WEIGHT_HERO; }
      if (isDetailRole) { cov.detailAppearances++; cov.visualWeight += WEIGHT_DETAIL; }
      if (isIntRole)    { cov.integratedAccessoryAppearances++; cov.visualWeight += WEIGHT_INTEGRATED; }
      if (isOverview)   { cov.overviewAppearances++; cov.visualWeight += WEIGHT_OVERVIEW; }
      if (!isHeroRole && !isDetailRole && !isIntRole && !isOverview) {
        cov.heroAppearances++;
        cov.visualWeight += WEIGHT_SECONDARY;
      }
    }

    for (const id of shot.secondaryItemIds) {
      const cov = map[id];
      if (!cov) continue;
      cov.totalAppearances++;
      cov.secondaryAppearances++;
      cov.isOnlyBackground = false;
      if (!isOverview) cov.isOnlyInOverview = false;
      cov.visualWeight += WEIGHT_SECONDARY;
    }
  }

  // Determinar cobertura real (no solo presencia superficial)
  const MINIMUM_WEIGHT = 10; // al menos un secondary appearance real
  for (const cov of Object.values(map)) {
    cov.realCoverage = (
      cov.isPrimaryInAnyShot &&
      !cov.isOnlyInOverview &&
      cov.visualWeight >= MINIMUM_WEIGHT
    );
  }

  return map;
}

// ── Dominance check ─────────────────────────────────────────
function buildWeeklyDominanceCheck(
  coverageMap: Record<string, import('../types').WeeklyItemCoverage>,
  allItems: import('../types').WeeklyItem[],
): import('../types').WeeklyDominanceCheck {
  const weights = allItems.map(it => coverageMap[it.id]?.visualWeight ?? 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0 || allItems.length === 0) {
    return {
      dominantItemVisualWeight: 0,
      averageVisualWeight:      0,
      dominanceRatio:           0,
      dominantItemRisk:         false,
      corrected:                false,
      correctionActions:        [],
    };
  }

  let dominantIdx = 0;
  for (let i = 1; i < weights.length; i++) {
    if (weights[i] > weights[dominantIdx]) dominantIdx = i;
  }

  const dominantItem   = allItems[dominantIdx];
  const dominantWeight = weights[dominantIdx];
  const avgWeight      = totalWeight / allItems.length;
  const dominanceRatio = dominantWeight / totalWeight;
  const DOMINANCE_THRESHOLD = 0.40;

  return {
    dominantItemId:          dominantItem?.id,
    dominantItemLabel:       dominantItem?.label,
    dominantItemVisualWeight: dominantWeight,
    averageVisualWeight:      avgWeight,
    dominanceRatio,
    dominantItemRisk:        dominanceRatio > DOMINANCE_THRESHOLD && allItems.length >= 3,
    corrected:               false, // el planner ya previene esto via anti-acumulación; se puede marcar en post
    correctionActions:       [],
  };
}

// Construye el WeeklyManifest desde las refs subidas
export function buildWeeklyManifest(
  refs:           import('../types').PhotodumpRefs,
  requestedCount: number,
  basePrompt?:    string,
): import('../types').WeeklyManifest {
  const allOutfitUrls   = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
  const allAccUrls      = (refs.accesorioRefs ?? []).filter(Boolean) as string[];
  const allProductUrls  = [refs.productRef, ...(refs.productRefs ?? [])].filter(Boolean) as string[];
  const accCloseup      = refs.accesorioCloseup ?? [];
  // Resolver kinds manuales del selector (haulOutfitKinds también cubre outfit_week)
  const outfitKinds: import('../types').HaulRefKind[] = refs.haulOutfitKinds ?? [];
  const accKinds:    import('../types').HaulRefKind[] = refs.haulAccKinds    ?? [];

  const outfitItems: import('../types').WeeklyItem[] = allOutfitUrls.map((url, i) =>
    classifyWeeklyItemFromSlot(url, i, 'outfit', outfitKinds[i] ?? 'auto', i)
  );
  const accessoryItems: import('../types').WeeklyItem[] = allAccUrls.map((url, i) =>
    classifyWeeklyItemFromSlot(url, outfitItems.length + i, 'accesorio', accKinds[i] ?? 'auto', i)
  );
  const productItems: import('../types').WeeklyItem[] = allProductUrls.map((url, i) =>
    classifyWeeklyItemFromSlot(url, outfitItems.length + accessoryItems.length + i, 'producto', 'auto', i)
  );

  const allItems      = [...outfitItems, ...accessoryItems, ...productItems];

  // ── Reference Tag Resolution (patch v4) ──────────────────────
  // Si el brief contiene tags @outfit1, @outfit2, etc., resolverlos y enriquecer los ítems
  let referenceTagResolution: import('../types').ReferenceTagResolutionResult | undefined;

  if (basePrompt && basePrompt.includes('@')) {
    referenceTagResolution = resolveReferenceTagsFromBrief(basePrompt, outfitItems, [...accessoryItems, ...productItems], allItems);

    // Aplicar semantic intent a cada ítem taggeado
    for (const assignment of referenceTagResolution.itemSemanticAssignments) {
      const item = allItems.find(it => it.id === assignment.itemId);
      if (item) {
        item.semanticIntent = {
          userLabel:       assignment.roleFromBrief,
          mood:            assignment.roleFromBrief,
          destination:     assignment.destinationFromBrief,
          priority:        'required',
          explicitFromBrief: true,
        };
        item.explicitlyTaggedInBrief      = true;
        item.tagsUsed                     = [assignment.sourceTag];
        item.coverageRequiredBecauseTagged = true;
        item.priority                     = 'required';  // elevar a required
      }
    }

    // Aplicar pairings explícitos: marcar en accessoryItems que deben ir con un outfit específico
    for (const pairing of referenceTagResolution.explicitPairings) {
      const acc = accessoryItems.find(a => a.id === pairing.sourceItemId);
      if (acc) {
        acc.compatibleWith = [pairing.targetItemId, ...(acc.compatibleWith ?? []).filter(id => id !== pairing.targetItemId)];
      }
    }
  }

  // Clasificar ítems en buckets por kind para el manifest y el planner
  const outfitSets         = allItems.filter(it => it.kind === 'outfit_set');
  const standaloneGarments = allItems.filter(it => ['garment', 'top', 'bottom', 'outerwear', 'dress', 'onepiece'].includes(it.kind));
  const shoes              = allItems.filter(it => ['footwear', 'shoes', 'boots'].includes(it.kind));
  const bags               = allItems.filter(it => it.kind === 'bag');
  const jewelry            = allItems.filter(it => it.kind === 'jewelry');
  const accessories        = allItems.filter(it => it.kind === 'accessory');
  const makeup             = allItems.filter(it => ['makeup', 'lipstick', 'makeup_color', 'beauty_product'].includes(it.kind));
  const products           = allItems.filter(it => ['product', 'skincare', 'tech', 'beauty_product'].includes(it.kind) && !makeup.includes(it));

  const requiredItems = allItems;

  const dominantType = detectWeeklyDominantType(allItems);

  // Compatibilidad cruzada — todos los pares accesorio/producto × outfit
  const compatibilityPairs: import('../types').WeeklyCompatibilityPair[] = [];
  const nonOutfitItems = [...accessoryItems, ...productItems];
  for (const acc of nonOutfitItems) {
    for (const outfit of outfitItems) {
      const { score, reason, integrationMode } = scoreWeeklyCompatibility(acc, outfit);
      if (score >= 65) {
        compatibilityPairs.push({ accessoryId: acc.id, outfitId: outfit.id, score, reason, integrationMode });
        if (!acc.compatibleWith?.includes(outfit.id)) {
          acc.compatibleWith = [...(acc.compatibleWith ?? []), outfit.id];
        }
      }
    }
  }

  // Plan de integración de accesorios — anti-acumulación
  // Si hay pairings explícitos del brief, pasarlos para que tengan prioridad
  const explicitPairingsMap: Record<string, string> = {};
  if (referenceTagResolution) {
    for (const p of referenceTagResolution.explicitPairings) {
      explicitPairingsMap[p.sourceItemId] = p.targetItemId;
    }
  }
  const accIntPlan = buildWeeklyAccessoryIntegrationPlan(
    nonOutfitItems, outfitItems, compatibilityPairs, accCloseup, explicitPairingsMap,
  );

  // Plan de shots con roles narrativos
  // Pasar el orden de outfits por tags para respetar orden del brief
  const taggedOutfitOrder = referenceTagResolution
    ? referenceTagResolution.itemSemanticAssignments
        .filter(a => outfitItems.some(o => o.id === a.itemId))
        .map(a => a.itemId)
    : [];

  // Para el shot planner, tratar productos como accesorios adicionales
  // (cobertura real — aparecen como hero shots, not combined with outfits by default)
  const allNonOutfitItems = [...accessoryItems, ...productItems];
  const { shotPlan, redundancyDebug, compositionMap } = buildWeeklyShotPlan(
    outfitItems.length > 0 ? outfitItems : [],
    allNonOutfitItems,
    compatibilityPairs,
    accIntPlan,
    accCloseup,
    requestedCount,
    dominantType,
    taggedOutfitOrder,
  );

  // Inyectar tags usados y semantic intent en cada shot del plan
  if (referenceTagResolution) {
    for (const sp of shotPlan) {
      const usedTags: string[] = [];
      for (const itemId of [...sp.primaryItemIds, ...sp.secondaryItemIds]) {
        const item = allItems.find(it => it.id === itemId);
        if (item?.tagsUsed) usedTags.push(...item.tagsUsed);
        if (item?.semanticIntent && sp.primaryItemIds[0] === itemId) {
          sp.semanticIntentFromBrief = item.semanticIntent;
        }
      }
      if (usedTags.length > 0) sp.resolvedTagsUsed = [...new Set(usedTags)];
      sp.avatarBaseClothingForbidden = true;

      // Inyectar pairings del brief que involucren a ítems de este shot
      // El Visual Reference Contract los usa para generar instrucciones de integración
      if (referenceTagResolution.explicitPairings.length > 0) {
        const shotItemIds = new Set([...sp.primaryItemIds, ...sp.secondaryItemIds]);
        const relevantPairings = referenceTagResolution.explicitPairings.filter(
          p => shotItemIds.has(p.sourceItemId) || shotItemIds.has(p.targetItemId)
        );
        if (relevantPairings.length > 0) {
          sp.explicitPairingsFromBrief = relevantPairings.map(p => ({
            sourceItemId: p.sourceItemId,
            targetItemId: p.targetItemId,
            rawText:      p.rawText,
          }));
        }
      }
    }
  }

  // Avatar base clothing fingerprint
  const avatarBaseClothingFingerprint = buildAvatarBaseClothingFingerprint();

  // Coverage map clásico (binario) — compatibilidad con código existente
  const coverageMap: Record<string, import('../types').WeeklyCoverageEntry> = {};
  for (const item of allItems) {
    coverageMap[item.id] = {
      itemId: item.id, kind: item.kind, covered: false, coveredByShots: [], coverageType: [],
    };
  }
  const coveredItemIds: string[] = [];
  for (const sp of shotPlan) {
    for (const id of [...sp.primaryItemIds, ...sp.secondaryItemIds]) {
      if (coverageMap[id]) {
        coverageMap[id].covered = true;
        coverageMap[id].coveredByShots.push(sp.role);
        if (!coveredItemIds.includes(id)) coveredItemIds.push(id);
      }
    }
  }

  // Coverage con peso visual
  const weeklyCoverageMap = buildWeeklyCoverageMap(allItems, shotPlan);

  // Items sin cobertura REAL (no solo presencia superficial)
  // Si un ítem fue taggeado explícitamente en el brief, su ausencia es más urgente
  const uncoveredRequiredItems = requiredItems
    .filter(it => !weeklyCoverageMap[it.id]?.realCoverage)
    .map(it => it.id);

  // Dominance check
  const weeklyDominanceCheck = buildWeeklyDominanceCheck(weeklyCoverageMap, allItems);

  const accessoryIntegrationUsed = shotPlan.some(
    sp => sp.role === 'WEEK_ACCESSORY_INTEGRATED' || sp.role === 'WEEK_ACCESSORY_WORN'
  );

  const tooManyGenericFullBodyShots = compositionMap.tooManyGenericFullBodyShots;
  const redundantShotNotReplaced    = redundancyDebug.some(r => r.redundantShotNotReplaced === true);
  const weeklyStructure             = buildWeeklyStructureDescription(shotPlan, dominantType);

  // ── Debug: distribución de ítems primarios por shot ──────────
  const shotPrimaryItemDistribution: Record<string, number> = {};
  for (const sp of shotPlan) {
    for (const id of sp.primaryItemIds) {
      shotPrimaryItemDistribution[id] = (shotPrimaryItemDistribution[id] ?? 0) + 1;
    }
  }

  // ítems sobreusados: aparecen como primary más veces de lo razonable
  const fairShare = requestedCount / Math.max(allItems.length, 1);
  const overusedPrimaryItems = Object.entries(shotPrimaryItemDistribution)
    .filter(([, count]) => count > Math.ceil(fairShare * 1.5) && allItems.length > 1)
    .map(([id]) => id);

  // ── Brief binding compliance ──────────────────────────────────
  const briefBindingCompliance = referenceTagResolution ? (() => {
    const taggedItemIds = new Set(
      referenceTagResolution.itemSemanticAssignments
        .filter(a => a.itemId)
        .map(a => a.itemId)
    );
    const missingTaggedRefs = [...taggedItemIds].filter(id => !coveredItemIds.includes(id));

    const explicitPairingIds = referenceTagResolution.explicitPairings.map(
      p => [p.sourceItemId, p.targetItemId].sort().join('::')
    );
    const coveredPairingIds = shotPlan
      .filter(sp => sp.explicitPairingsFromBrief && sp.explicitPairingsFromBrief.length > 0)
      .flatMap(sp => (sp.explicitPairingsFromBrief ?? []).map(
        p => [p.sourceItemId, p.targetItemId].sort().join('::')
      ));
    const missingPairings = explicitPairingIds.filter(pid => !coveredPairingIds.includes(pid));

    return {
      allMentionedTagsCovered:    missingTaggedRefs.length === 0,
      allExplicitPairingsCovered: missingPairings.length === 0,
      missingTaggedRefs,
      missingPairings,
    };
  })() : undefined;

  return {
    totalItems:         allItems.length,
    dominantType,
    outfitSets,
    standaloneGarments,
    shoes,
    bags,
    jewelry,
    accessories,
    makeup,
    products,
    allItems,
    requiredItems,
    compatibilityPairs,
    coverageMap,
    shotPlan,
    weeklyCoverageMap,
    weeklyDominanceCheck,
    weeklyAccessoryIntegrationPlan: accIntPlan,
    compositionVarietyMap: compositionMap,
    redundancyDebug,
    tooManyGenericFullBodyShots,
    redundantShotNotReplaced,
    uncoveredRequiredItems,
    coveredItemIds,
    weeklyStructure,
    accessoryIntegrationUsed,
    unsafeHpiSuppressed:  true,
    brandRiskDetected:    false,
    referenceTagResolution,
    avatarBaseClothingPolicyApplied:    true,
    avatarBaseClothingFingerprint,
    // Patch v5 — Visual Reference Contract debug
    visualSlotBindingUsed:            !!(referenceTagResolution?.referenceTaggingUsed),
    avatarBaseClothingSuppressedGlobally: true,
    ref0UsedAsWardrobeSource:         false,
    briefBindingCompliance,
    shotPrimaryItemDistribution,
    overusedPrimaryItems,
  };
}

// Descripción legible del arco para debug
function buildWeeklyStructureDescription(
  plan: import('../types').WeeklyShotPlan[],
  dominant: import('../types').WeeklySetDominantType,
): string {
  const roles = plan.map(sp => sp.role).join(' → ');
  return `Weekly edit (${dominant}) | ${plan.length} shots | Arc: ${roles}`;
}

// Convierte un WeeklyShotPlan en un PhotodumpShotDirective con prompt completo
export function weeklyRoleToDirective(
  sp:           import('../types').WeeklyShotPlan,
  position:     number,
  totalShots:   number,
  outfitItems:  import('../types').WeeklyItem[],
  accItems:     import('../types').WeeklyItem[],
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  // Framings rotan por índice de outfit — garantiza variedad entre heroes
  const heroFramings = [
    { framing: 'WIDE_FULL_BODY', composition: 'FULL_BODY_NATURAL',        angle: 'EYE_LEVEL_OR_SLIGHTLY_LOW' },
    { framing: 'WIDE_FULL_BODY', composition: 'MIRROR_SELFIE_FULL_BODY',  angle: 'EYE_LEVEL' },
    { framing: 'MEDIUM',         composition: 'THREE_QUARTERS_NATURAL',   angle: 'EYE_LEVEL' },
    { framing: 'WIDE_FULL_BODY', composition: 'FULL_BODY_IN_CONTEXT',     angle: 'SLIGHTLY_LOW_LOOKING_UP' },
    { framing: 'MEDIUM',         composition: 'CANDID_IN_SPACE',          angle: 'EYE_LEVEL' },
    { framing: 'WIDE_FULL_BODY', composition: 'WALKING_OR_ARRIVING',      angle: 'EYE_LEVEL' },
    { framing: 'MEDIUM',         composition: 'LEANING_OR_RESTING',       angle: 'EYE_LEVEL_OR_SLIGHTLY_HIGH' },
  ];
  const heroIdx = outfitItems.findIndex(it => sp.primaryItemIds[0] === it.id);
  const rot     = heroFramings[(heroIdx >= 0 ? heroIdx : position) % heroFramings.length];

  // Resolver labels de los ítems asignados al shot — para inyectar en el prompt
  const allItems = [...outfitItems, ...accItems];
  const resolveLabelList = (ids: string[]) =>
    ids.map(id => allItems.find(it => it.id === id)?.label ?? id).join(', ');

  const primaryLabel    = resolveLabelList(sp.primaryItemIds);
  const secondaryLabel  = resolveLabelList(sp.secondaryItemIds);
  const visualIntent    = sp.visualWeightIntent ?? '';
  const compositionMode = sp.compositionMode    ?? '';

  // Forbidden items — labels de ítems que NO deben aparecer en este shot
  const forbiddenLabels = (sp.forbiddenItemIds ?? [])
    .map(id => allItems.find(it => it.id === id)?.label ?? id);

  // Semantic context from brief tag resolution
  const semanticIntent = sp.semanticIntentFromBrief;
  const semanticMoodLabel = semanticIntent?.mood
    ? ` [mood: ${semanticIntent.mood}${semanticIntent.destination ? ` / ${semanticIntent.destination}` : ''}]`
    : '';

  const baseForbidden = [
    'studio_backdrop', 'catalog_pose', 'beautification',
    'invented_outfit', 'avatar_base_clothing_as_featured_outfit',
    'external_brand_logo', 'retail_bag_with_brand',
    ...(forbiddenLabels.length > 0 ? [`other_outfits_in_frame: [${forbiddenLabels.join(', ')}]`] : []),
  ];

  const roleDescriptions: Record<import('../types').WeeklyShotRole, { purpose: string; required: string[]; forbidden: string[]; beat: MomentType; framing: string; composition: string; angle: string }> = {
    WEEK_ANCHOR: {
      purpose: `Opening anchor of the weekly set. PRIMARY ITEM: ${primaryLabel || 'general mood'}. ${visualIntent}. Person in their space establishing visual world — light quality, ambient tone, environment. Full body or medium shot. Authentic, lived-in iPhone quality. Composition: ${compositionMode || 'authentic_natural'}.`,
      required: ['real_environment', 'authentic_mood', 'clear_identity', 'primary_item_readable'],
      forbidden: [...baseForbidden, 'white_background'],
      beat: 'context',
      framing: 'WIDE_FULL_BODY', composition: 'FULL_BODY_NATURAL', angle: 'EYE_LEVEL',
    },
    WEEK_OVERVIEW: {
      purpose: `Weekly favorites overview — ITEM-ONLY SHOT. ALL WEEKLY ITEMS arranged naturally together: ${primaryLabel}${secondaryLabel ? ` and ${secondaryLabel}` : ''}. MUST show all items in one frame on a real surface (bed, rack, chair, floor, vanity). ${visualIntent}. NO PERSON, NO HANDS, NO FACE, NO PHONE, NO BODY PARTS — items only. NOT a worn look. NOT a collage. A real editorial flat-lay or arrangement photo of the week's picks together.`,
      required: ['all_primary_items_visible_and_readable', 'organized_natural_arrangement', 'real_surface', 'no_person_in_frame', 'no_hands_no_body_parts'],
      forbidden: [...baseForbidden, 'collage_layout', 'catalog_grid', 'floating_items', 'person_in_frame', 'hands_in_frame', 'body_parts_in_frame', 'person_wearing_any_item'],
      beat: 'context',
      framing: 'WIDE', composition: 'FLATLAY_ITEM_ONLY_EDITORIAL', angle: 'SLIGHTLY_HIGH_OR_OVERHEAD',
    },
    WEEK_LOOK_HERO: {
      purpose: `Weekly look hero for ${primaryLabel}${semanticMoodLabel}. ${visualIntent}. Full body shot — outfit clearly readable head to toe. THIS outfit only — do NOT include elements from other uploaded outfits. Framing: ${compositionMode || rot.composition}. Angle: ${rot.angle}. Real environment anchored by REF0, authentic attitude.${semanticIntent?.destination ? ` The mood of this look is "${semanticIntent.destination}" — express this through the garment styling, body language, and attitude ONLY. Do NOT change the capture environment. The room stays exactly as REF0 established it.` : ''} NOT a catalog. NOT mannequin pose.${sp.replaceBaseOutfit ? ' ACTIVE OUTFIT REPLACES BASE: The uploaded outfit reference is the complete look — do NOT use clothing from REF0.' : ''}`,
      required: ['full_body_visible', 'assigned_outfit_readable_head_to_toe', 'real_environment', 'authentic_attitude', 'only_assigned_outfit_visible'],
      forbidden: [...baseForbidden, 'identical_framing_as_prior_hero_shot', ...(forbiddenLabels.length > 0 ? [`do_not_show: ${forbiddenLabels.join(', ')}`] : [])],
      beat: 'context',
      framing: rot.framing, composition: rot.composition, angle: rot.angle,
    },
    WEEK_MIRROR_LOOK: {
      purpose: `Mirror look for ${primaryLabel}. ${visualIntent}. Person checks this weekly outfit in a mirror — full body visible in the reflection. Can be phone visible (selfie) or third-person capture. THIS outfit only. Authentic mood — not a catalog shot.`,
      required: ['mirror_visible', 'full_body_in_reflection', 'assigned_outfit_readable', 'only_assigned_outfit'],
      forbidden: [...baseForbidden, 'invented_background', ...(forbiddenLabels.length > 0 ? [`do_not_show: ${forbiddenLabels.join(', ')}`] : [])],
      beat: 'candid',
      framing: 'WIDE_FULL_BODY', composition: 'MIRROR_SELFIE_FULL_BODY', angle: 'EYE_LEVEL',
    },
    WEEK_STYLING_PROCESS: {
      purpose: `Styling process moment with ${primaryLabel}. ${visualIntent}. Person adjusting, buttoning, tucking, arranging — getting dressed or fine-tuning the look. NOT a finished posed look. Authentic and candid energy. Medium or detail framing.`,
      required: ['styling_action_visible', 'authentic_not_posed', 'primary_item_context_present'],
      forbidden: [...baseForbidden, 'finished_catalog_pose', 'full_body_static_standing_pose'],
      beat: 'action',
      framing: 'MEDIUM', composition: 'ACTION_CANDID_DETAIL', angle: 'EYE_LEVEL',
    },
    WEEK_ACCESSORY_INTEGRATED: {
      purpose: `Accessory integrated shot: ${primaryLabel} worn/held WITH ${secondaryLabel || 'compatible outfit'}. ${visualIntent}. The accessory is clearly visible and readable as PART of the look — NOT isolated or floating. The outfit provides context. Show both items naturally together. Mode: ${compositionMode || 'worn_with_outfit'}.${sp.inheritBaseOutfit ? ' BASE OUTFIT CONTINUITY: Use REF0 for the base outfit styling — same clothing, same room. Only add or feature the accessory as the active item.' : ''}`,
      required: ['accessory_clearly_visible', 'outfit_context_present', 'natural_integration_not_floating', 'both_items_readable'],
      forbidden: [...baseForbidden, 'accessory_isolated_without_outfit_context', 'invented_outfit_not_from_refs', 'product_catalog_background'],
      beat: 'detail',
      framing: 'MEDIUM', composition: 'ACCESSORY_WITH_OUTFIT_CONTEXT', angle: 'EYE_LEVEL',
    },
    WEEK_ACCESSORY_DETAIL: {
      purpose: `Accessory detail / macro: ${primaryLabel}. ${visualIntent}. Close-up or macro — the piece fills most of the frame. Held, laid flat, or detail of how it is worn. Real surface. Natural light. Faithful to the uploaded reference — do NOT invent the design.`,
      required: ['accessory_fills_frame', 'faithful_to_reference', 'real_natural_light', 'no_invented_design'],
      forbidden: [...baseForbidden, 'catalog_surface', 'invented_design', 'full_body_shot'],
      beat: 'detail',
      framing: 'CLOSE_UP', composition: 'MACRO_DETAIL_SURFACE', angle: 'SLIGHTLY_HIGH',
    },
    WEEK_ACCESSORY_WORN: {
      purpose: `Accessory worn: ${primaryLabel} visible on the person's body. ${visualIntent}. Close-up of ear / neck / wrist / finger showing the piece being worn — OR the person putting it on. Authentic, intimate. NOT a product shot. The reference defines the design — do NOT invent it.`,
      required: ['accessory_worn_on_body', 'faithful_to_reference_design', 'intimate_framing', 'no_invented_design'],
      forbidden: [...baseForbidden, 'product_catalog_background', 'floating_accessory', 'full_body_catalog_pose'],
      beat: 'detail',
      framing: 'CLOSE_UP', composition: 'WORN_ON_BODY_MACRO', angle: 'EYE_LEVEL_OR_SLIGHTLY_HIGH',
    },
    WEEK_ACCESSORY_HELD: {
      purpose: `Accessory held: ${primaryLabel} held by hand or displayed naturally. ${visualIntent}. Person holds it toward camera or at their side — standing or seated. Item is clear and readable. Mode: ${compositionMode || 'held_toward_camera'}.`,
      required: ['item_held_and_readable', 'hands_or_person_present', 'faithful_to_reference'],
      forbidden: [...baseForbidden, 'floating_object_without_hands', 'invented_branding', 'catalog_background'],
      beat: 'reveal',
      framing: 'MEDIUM', composition: 'HELD_TOWARD_CAMERA', angle: 'EYE_LEVEL',
    },
    WEEK_DETAIL: {
      purpose: `Garment or item detail: ${primaryLabel}. ${visualIntent}. Fabric texture, zipper, embroidery, pattern, stitching, material surface. Close-up or macro. No full body needed. Shows the quality and character of the piece. Authentic natural light. Mode: ${compositionMode || 'texture_closeup'}.`,
      required: ['detail_fills_frame', 'real_material_texture_visible', 'authentic_natural_light'],
      forbidden: [...baseForbidden, 'full_body_shot', 'studio_background', 'product_catalog_background'],
      beat: 'detail',
      framing: 'CLOSE_UP', composition: 'TEXTURE_DETAIL_MACRO', angle: 'SLIGHTLY_HIGH',
    },
    WEEK_ON_THE_GO: {
      purpose: `On-the-go moment: ${primaryLabel}. ${visualIntent}. Person in motion — walking, leaving, arriving. Weekly outfit in a real environment. Candid feel — movement captured mid-step or turning. Not a static pose.`,
      required: ['motion_implied_or_visible', 'real_environment', 'outfit_readable'],
      forbidden: [...baseForbidden, 'static_catalog_standing_pose', 'studio_setup'],
      beat: 'action',
      framing: 'WIDE_FULL_BODY', composition: 'WALKING_OR_ARRIVING', angle: 'EYE_LEVEL',
    },
    WEEK_FAVORITE: {
      purpose: `Favorite of the week: ${primaryLabel}. ${visualIntent}. The person's highlight pick. Can be a specific outfit, accessory, or item that feels special. Selfie energy or intimate medium shot. "This was my favorite" mood — not a catalog pose.`,
      required: ['primary_item_clearly_readable', 'intimate_framing', 'authentic_expression_not_catalog'],
      forbidden: [...baseForbidden, 'catalog_expression', 'studio_feel'],
      beat: 'emotion',
      framing: 'MEDIUM', composition: 'INTIMATE_SELFIE_OR_CLOSE', angle: 'EYE_LEVEL',
    },
    WEEK_CLOSER: {
      purpose: `Closing shot of the weekly set. ${visualIntent}. Primary reference: ${primaryLabel || 'any weekly item'}. Final summary mood — MUST be visually different from the previous shots. Options: flat lay of favorite items, hand holding favorite bag, candid moment wrapping up, texture detail, mirror from different angle. NOT another full-body standing pose if those already dominated the set. Mode: ${compositionMode || 'closing_gesture'}.`,
      required: ['visually_different_from_prior_full_body_shots', 'closing_mood', 'weekly_edit_wrap_up_feel'],
      forbidden: [...baseForbidden, 'another_identical_full_body_standing_pose', 'copy_of_previous_shot'],
      beat: 'atmosphere',
      framing: 'MEDIUM', composition: 'CLOSING_NON_REDUNDANT', angle: 'EYE_LEVEL_OR_SLIGHTLY_HIGH',
    },
  };

  const desc = roleDescriptions[sp.role];

  return {
    key:              `${sp.role}_${position}`,
    beat:             desc.beat,
    role:             sp.role,
    purpose:          desc.purpose,
    requiredElements: desc.required,
    forbiddenElements: desc.forbidden,
    variationSpace:   [desc.purpose],
    framing:          desc.framing  ?? rot.framing,
    composition:      desc.composition ?? rot.composition,
    cameraAngle:      desc.angle    ?? rot.angle,
    weeklyItemPlan:   sp,
  };
}
