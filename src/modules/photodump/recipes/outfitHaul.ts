/**
 * recipes/outfitHaul.ts
 * Receta outfit_haul — Fase 2 de la división de photodumpDirectorService.ts.
 *
 * Manifest, styling graph, scoring de compatibilidad, world map, shot planner
 * y todos los shot builders específicos de outfit_haul.
 *
 * Código movido tal cual desde photodumpDirectorService.ts — sin reescribir lógica.
 * La integración dentro de generatePhotodumpShot (ensamblador de prompt final,
 * compartido con outfit_check y outfit_week) permanece en el archivo principal
 * por ahora — se separará cuando esas recetas también tengan su propio archivo.
 */
import {
  HaulItem, HaulManifest, HaulItemKind, HaulPileState, HaulRefKind,
  HaulResolvedKind, HaulCoverageRole, HaulCoverageLedgerItem, HaulOutfitComponents,
  HaulWorldMap, HaulItemAllowedUseMode, HaulItemState, HaulCoveragePlan,
  HaulStyledCombination, HaulStylingGraph, HaulShotItemPlan, HaulBaseStartingLook,
  PhotodumpRefs, VisualRefsAnalysisResult,
} from '../types';
import { PhotodumpShotDirective } from './shared';

// ── HPI seguro para outfit_haul ────────────────────────────────────────────
// Solo lenguaje corporal y expresión. Sin locaciones, props, objetos ni accesorios.
// NUNCA mete: restaurante, café, deporte, activewear, laptop, taza, lentes, gimnasio.
export function buildHaulSafeHpiBlock(
  shotKey: string,
  scope:   string,
  gender:  'female' | 'male' | 'neutral',
): string {
  const genderNote = gender === 'male' ? 'masculine' : 'feminine';

  // Shots sin cuerpo completo: off
  if (
    shotKey === 'HAUL_OVERVIEW' ||
    shotKey.startsWith('HAUL_ACCESSORY_CLOSEUP_') ||
    shotKey.startsWith('HAUL_DETAIL_') ||
    shotKey.startsWith('HAUL_FOOTWEAR_') ||
    shotKey.startsWith('HAUL_BAG_') ||
    shotKey.startsWith('HAUL_JEWELRY_')
  ) return '';

  if (shotKey.startsWith('HAUL_SETUP_')) {
    return `🎯 MICRO-ACTION (setup — hands and natural movement only):
The person is going through haul items — choosing, organizing, holding up to preview.
  - hands holding an item up to look at it, head tilted evaluating
  - seated on bed edge with items around, leaning forward selecting a piece
  - standing at rack touching garments, casual haul energy
  - candid mid-movement, natural and unstaged
FORBIDDEN: catalog pose, full-body fashion stance, direct camera gaze as if posing, editorial lighting vibe.`;
  }

  if (shotKey.startsWith('HAUL_STYLED_')) {
    return `🎯 BODY LANGUAGE (styled result — natural ${genderNote} reveal pose):
The person just finished putting on the garment and this is the reveal angle.
  - seated on bed edge with the look on, relaxed genuine expression
  - half-turn showing the side of the look, natural
  - mirror interaction — looking at own reflection, not at camera
  - leaning lightly against wall, weight shifted, candid
FORBIDDEN: catalog mannequin stance, forced smile directly at camera, editorial frontality.
This is a genuine reveal, not a brand shoot.

⛔ SAFE LANGUAGE — DO NOT USE THESE TERMS:
sexy, sheer body, lingerie, revealing, tight body, sensual, seductive, bodycon catsuit.
USE INSTEAD: fashion garment, try-on, natural fit, clothing evaluation.`;
  }

  if (shotKey.startsWith('HAUL_ADJUSTING_')) {
    return `🎯 MICRO-ACTION (haul adjusting — hands and micro-gesture only):
Choose ONE subtle real action someone does while adjusting a garment they just put on:
  - both hands smoothing fabric at the waist or hip
  - fingertips pulling a collar or neckline into place
  - one hand tugging a hem or sleeve to the right length
  - slight weight shift while checking fit by looking down
  - hands briefly at side seams, feeling the fit
FORBIDDEN: catalog stance, athletic pose, arms raised, gym movement, looking directly at camera in a posed way, any object in hand.
The action must feel like someone genuinely trying on a piece — not performing for a camera.`;
  }

  if (shotKey.startsWith('HAUL_TRY_ON_') || shotKey === 'HAUL_SELECTION') {
    if (scope === 'micro_action_only') {
      return `🎯 MICRO-ACTION (try-on — body and expression only):
One subtle action: slight weight shift, hand on hip evaluating fit, looking down at hemline, half-turn to see the side.
FORBIDDEN: catalog stance, athletic pose, gym movement, objects in hand, destination venue framing.

⛔ SAFE LANGUAGE — DO NOT USE THESE TERMS IN YOUR INTERPRETATION:
sexy, sheer body, lingerie, revealing, tight body, sensual, seductive, bodycon, skin-tight bodysuit.
USE INSTEAD: fashion garment, try-on, natural fit check, modest framing, clothing evaluation.`;
    }
    return `🎯 BODY LANGUAGE (try-on — natural ${genderNote} evaluation pose):
The person is trying on a garment and evaluating how it fits. Choose ONE real try-on posture:
  - weight on one foot, hip slightly out, one hand on hip — genuinely evaluating
  - arms slightly away from body, looking down at the garment — checking the fit
  - slight half-turn showing the side profile — natural, not posed
  - natural standing posture, one hand adjusting a sleeve or hem
  - relaxed face: thoughtful, curious, not performing for camera

FORBIDDEN: catalog mannequin stance, arms symmetrically at sides, rigid frontality, athletic pose, walking blur, full-on smiled pose directly at camera.
The person looks like they are genuinely trying something on in their room — NOT posing for an ad.

⛔ SAFE LANGUAGE — DO NOT USE THESE TERMS:
sexy, sheer body, lingerie, revealing, tight body, sensual, seductive, bodycon catsuit.
USE INSTEAD: fashion garment, try-on, natural fit check, modest real-life pose.`;
  }

  if (shotKey === 'HAUL_RECAP') {
    return `🎯 BODY LANGUAGE (haul recap — relaxed ${genderNote} energy):
The person has finished or is winding down the haul. Choose ONE natural end-of-session posture:
  - sitting or perching on bed or chair edge, relaxed and genuine
  - standing with one hand on hip, slight satisfied expression
  - holding a favorite piece, looking at it naturally
  - natural weight shift, arms loosely at sides
FORBIDDEN: catalog pose, formal catalog smile, athletic stance, forced "winner" energy.
The mood is end-of-session: relaxed, authentic, low-key.`;
  }

  return '';
}
function resolveHaulKind(manualKind: HaulRefKind, heuristicKind?: HaulItemKind): HaulResolvedKind {
  switch (manualKind) {
    case 'look_completo':  return 'full_outfit';
    case 'varios_items':   return 'mixed_set';
    case 'top':            return 'top';
    case 'bottom':         return 'bottom';
    case 'vestido':        return 'dress';
    case 'enterizo':       return 'onepiece';
    case 'chaqueta':       return 'outerwear';
    case 'calzado':        return 'footwear';
    case 'pantys':         return 'hosiery';
    case 'bolso':          return 'bag';
    case 'joyeria':
    case 'aros':
    case 'collar':
    case 'anillo':
    case 'pulsera':        return 'jewelry';
    case 'accesorio':
    case 'cinturon':
    case 'panoleta':
    case 'scrunchie':
    case 'sombrero':
    case 'gafas':          return 'accessory';
    case 'auto':
    default:
      // fallback a heurística si existe
      if (heuristicKind === 'footwear') return 'footwear';
      if (heuristicKind === 'bag')      return 'bag';
      if (heuristicKind === 'jewelry')  return 'jewelry';
      if (heuristicKind === 'accessory') return 'accessory';
      if (heuristicKind === 'outfit_set') return 'full_outfit';
      if (heuristicKind === 'mixed')    return 'mixed_set';
      return 'unknown_visual_item';
  }
}

// Etiqueta en inglés para prompt — governa cómo el modelo interpreta el ítem
function resolvedKindToPromptLabel(rk: HaulResolvedKind): string {
  const labels: Record<HaulResolvedKind, string> = {
    full_outfit:         'COORDINATED FULL LOOK (pieces intended to be worn together)',
    mixed_set:           'MULTI-ITEM PRODUCT SET (several products, not necessarily one outfit)',
    top:                 'INDIVIDUAL TOP (blouse, shirt, t-shirt, corset, or camisole)',
    bottom:              'INDIVIDUAL BOTTOM (pants, skirt, shorts, or jeans)',
    dress:               'DRESS OR MAXI-DRESS (one-piece main garment, shoulder to hem)',
    onepiece:            'ONE-PIECE / JUMPSUIT / BODYSUIT (coverall garment, head to toe or similar)',
    outerwear:           'OUTERWEAR / JACKET / BLAZER / COAT (outer layer worn on top)',
    footwear:            'STANDALONE FOOTWEAR (shoe, boot, sandal, sneaker — NOT a full outfit)',
    hosiery:             'HOSIERY / PANTYHOSE / LEGGINGS / BASE LAYER (styling layer, not main garment)',
    bag:                 'STANDALONE BAG / PURSE (handbag, tote, clutch, crossbody — NOT a full outfit)',
    jewelry:             'JEWELRY PIECE (earrings, necklace, ring, bracelet — intimate framing required)',
    accessory:           'GENERIC ACCESSORY (belt, hat, cap, glasses, scarf — worn or displayed as detail)',
    unknown_visual_item: 'VISUAL ITEM (type auto-detected — inspect reference carefully)',
  };
  return labels[rk] ?? 'VISUAL ITEM';
}

// Refina el label genérico (jewelry/accessory) con la pieza específica que el usuario marcó
// manualmente — patch UI: joyería/accesorios desglosados por pieza (aros, collar, anillo,
// pulsera, cinturón, pañoleta, scrunchie, sombrero, gafas) en vez de categorías genéricas.
const SPECIFIC_PIECE_LABEL: Partial<Record<HaulRefKind, string>> = {
  aros:      'EARRINGS (specific piece — intimate framing on the ear)',
  collar:    'NECKLACE / CHAIN (specific piece — intimate framing on the neck)',
  anillo:    'RING (specific piece — intimate framing on the finger/hand)',
  pulsera:   'BRACELET / ANKLET (specific piece — intimate framing on the wrist/ankle)',
  cinturon:  'BELT (specific piece — worn at the waist or held as detail)',
  panoleta:  'SCARF / PAÑOLETA (specific piece — worn around neck/head or held as detail)',
  scrunchie: 'SCRUNCHIE / HAIR TIE (specific piece — worn on hair or wrist)',
  sombrero:  'HAT / CAP (specific piece — worn on head or held as detail)',
  gafas:     'SUNGLASSES / GLASSES (specific piece — worn on face or held as detail)',
};

function resolvedKindToPromptLabelForManualKind(rk: HaulResolvedKind, manualKind: HaulRefKind): string {
  return SPECIFIC_PIECE_LABEL[manualKind] ?? resolvedKindToPromptLabel(rk);
}

// ── Descomposición semántica de look_completo ─────────────────
// Infiere qué piezas tiene un look completo o set mixto a partir de las refs del usuario.
// No requiere computer vision real — usa el selector manual del usuario + señales del brief.
// La estructura resultante permite al planner y al prompter saber qué NO debe perder el modelo.
function inferOutfitComponents(
  manualKind:    HaulRefKind,
  label:         string,
  accManualKinds?: HaulRefKind[],  // kinds de accesorios del mismo haul (para saber si hay calzado/bag/jewelry)
): HaulOutfitComponents {
  // Para look_completo: asumimos que tiene top + bottom a menos que las referencias asociadas
  // digan que es un vestido. Si el haul tiene calzado/joyería en otros slots, no los contamos
  // aquí — eso lo hace el planner a nivel de manifest completo.
  // La función trabaja solo con la información de ESTA referencia puntual.
  const isFullOutfit  = manualKind === 'look_completo';
  const isMixedSet    = manualKind === 'varios_items';
  const isDress       = manualKind === 'vestido';
  const isOnepiece    = manualKind === 'enterizo';

  // Para look completo y sets mixtos, inferimos una estructura base.
  // El usuario no nos dijo exactamente qué piezas tiene, pero podemos hacer
  // suposiciones razonables que el prompt puede corregir con las refs visuales.
  const hasTop        = isFullOutfit || isMixedSet;
  const hasBottom     = (isFullOutfit || isMixedSet) && !isDress && !isOnepiece;
  const hasDress      = isDress || isOnepiece;
  const hasOuterwear  = false; // no sabemos — se infiere del prompt del usuario
  // Señal de calzado: si en los manualKinds de accesorios hay 'calzado', asumimos que puede
  // aparecer integrado cuando este look se usa como try-on
  const hasFootwear   = (accManualKinds ?? []).some(k => k === 'calzado') ||
                        (isFullOutfit && label.toLowerCase().includes('completo'));
  const hasHosiery    = (accManualKinds ?? []).some(k => k === 'pantys');
  const hasBag        = (accManualKinds ?? []).some(k => k === 'bolso');
  const hasJewelry    = (accManualKinds ?? []).some(k => k === 'joyeria');
  const hasAccessory  = (accManualKinds ?? []).some(k => k === 'accesorio');

  // Riesgo de integración anatómica: si el look incluye pantalón/leggings/falda Y calzado alto
  const footwearLegCoverageRisk = (hasBottom || hasHosiery) && hasFootwear;

  // Resumen compacto para inyectar en el prompt
  const parts: string[] = [];
  if (hasDress)      parts.push('dress/onepiece');
  else {
    if (hasTop)      parts.push('top');
    if (hasBottom)   parts.push('bottom');
  }
  if (hasOuterwear)  parts.push('outerwear');
  if (hasHosiery)    parts.push('hosiery/tights');
  if (hasFootwear)   parts.push('footwear');
  if (hasBag)        parts.push('bag');
  if (hasJewelry)    parts.push('jewelry');
  if (hasAccessory)  parts.push('accessory');

  const componentsSummary = parts.length > 0
    ? `Expected pieces in this look: ${parts.join(', ')}.`
    : `Full coordinated look — preserve all visible pieces as a cohesive unit.`;

  return {
    hasTop, hasBottom, hasDress, hasOuterwear, hasFootwear,
    hasHosiery, hasBag, hasJewelry, hasAccessory,
    footwearLegCoverageRisk,
    componentsSummary,
  };
}

// ── Haul Shot Item Plan Block — qué aparece exactamente en este shot ─────────────
// Genera el contrato explícito de ítems para este shot: qué se usa, qué se sostiene,
// qué está en background y qué está PROHIBIDO. Reemplaza las instrucciones genéricas
// de "items scattered nearby" con un inventario controlado por shot.
export function buildHaulShotItemPlanBlock(plan: HaulShotItemPlan, manifest: HaulManifest): string {
  const resolveLabels = (ids: string[]): string => {
    const labels = ids.map(id => manifest.allItems.find(it => it.id === id)?.label ?? id).filter(Boolean);
    return labels.length > 0 ? labels.join(', ') : 'none';
  };

  const wornStr    = resolveLabels(plan.wornItems);
  const heldStr    = resolveLabels(plan.heldItems);
  const surfaceStr = resolveLabels(plan.surfaceItems);
  const bgStr      = resolveLabels(plan.backgroundItems);
  const forbStr    = resolveLabels(plan.forbiddenItems);
  const primStr    = resolveLabels(plan.primaryItems);

  const lines: string[] = [
    '📋 SHOT ITEM INVENTORY CONTRACT (exact — do not deviate):',
    `  PRIMARY FOCUS:   ${primStr}`,
    `  WORN on body:    ${wornStr}`,
    `  HELD in hand:    ${heldStr}`,
    `  ON surface:      ${surfaceStr}`,
    `  BACKGROUND:      ${bgStr}`,
  ];

  if (plan.forbiddenItems.length > 0) {
    lines.push(`  ✗ FORBIDDEN in this shot: ${forbStr}`);
  }

  // Regla de conflicto held+worn
  const conflicts = plan.heldItems.filter(id => plan.wornItems.includes(id));
  if (conflicts.length > 0) {
    const conflictLabels = resolveLabels(conflicts);
    lines.push(`  ✗ CONFLICT RULE: ${conflictLabels} CANNOT be held AND worn simultaneously in this shot.`);
  }

  if (plan.supportBaseLook) {
    lines.push(`  BASE LOOK: Person wears a simple neutral non-product base (plain top + basic bottoms). This base is NOT a haul product — do NOT present it as such.`);
  }

  if (plan.integrationNote) {
    lines.push(`  NOTE: ${plan.integrationNote}`);
  }

  lines.push('  STRICT: only the items listed above should be visible as featured elements. Do NOT add invented garments, random accessories, or unlisted haul items as prominent elements.');

  return lines.join('\n');
}

// ── Haul World Map — construye mapa físico del mundo desde ref0Analysis ──────────
// Convierte el análisis de REF0 en una estructura formal que ancla el espacio y
// genera un bloque de instrucción estricto para cada story shot del haul.
export function buildHaulWorldMap(ref0Analysis: any): HaulWorldMap {
  if (!ref0Analysis) {
    return {
      hasBed: false, bedCount: 0, hasWindow: false, hasRack: false, hasMirror: false,
      hasChair: false, hasDresser: false, hasDesk: false, hasOfficeFurniture: false,
      hasShoppingBags: false, hasCardboardBoxes: false,
      lightSource: 'unknown', lightDirection: 'ambient', roomMood: 'real interior',
      allowedClothingSurfaces: ['bed', 'floor'], allowedLargeFurniture: [],
      forbiddenInventions: ['rack', 'mirror', 'desk', 'office_chair', 'new_bed'],
      maxClutterLevel: 'light',
      worldLockSummary: 'REF0 not analyzed — apply conservative defaults: no new furniture, no new mirror, no rack, no office elements.',
    };
  }

  try {
    const s = ref0Analysis.spatial ?? {};
    const l = ref0Analysis.lighting ?? {};
    const elements: string[] = (s.elements ?? []).map((e: string) => e.toLowerCase());

    const hasBed     = elements.some(e => e.includes('bed') || e.includes('cama'));
    const bedCount   = hasBed ? 1 : 0;
    const hasWindow  = elements.some(e => e.includes('window') || e.includes('ventana'));
    const hasRack    = elements.some(e => e.includes('rack') || e.includes('rail') || e.includes('perchero'));
    const hasMirror  = elements.some(e => e.includes('mirror') || e.includes('espejo'));
    const hasChair   = elements.some(e => e.includes('chair') || e.includes('silla'));
    const hasDresser = elements.some(e => e.includes('dresser') || e.includes('wardrobe') || e.includes('closet'));
    const hasDesk    = elements.some(e => e.includes('desk') || e.includes('escritorio') || e.includes('table'));
    const hasOfficeFurniture = elements.some(e =>
      e.includes('office') || e.includes('ergonomic') || e.includes('computer') || e.includes('monitor')
    );
    const hasShoppingBags  = elements.some(e => e.includes('bag') || e.includes('bolsa'));
    const hasCardboardBoxes = elements.some(e => e.includes('box') || e.includes('caja'));

    const lightSource: HaulWorldMap['lightSource'] =
      (l.primarySource ?? '').includes('window') || (l.primarySource ?? '').includes('natural') ? 'natural_window'
      : (l.primarySource ?? '').includes('artificial') || (l.primarySource ?? '').includes('lamp') ? 'artificial'
      : 'mixed';

    const allowedSurfaces: string[] = [];
    if (hasBed)   allowedSurfaces.push('bed');
    if (hasChair) allowedSurfaces.push('chair');
    allowedSurfaces.push('floor');

    const allowedLargeFurniture: string[] = [];
    if (hasBed)     allowedLargeFurniture.push('bed');
    if (hasChair)   allowedLargeFurniture.push('chair');
    if (hasRack)    allowedLargeFurniture.push('clothing rack');
    if (hasMirror)  allowedLargeFurniture.push('mirror');
    if (hasDresser) allowedLargeFurniture.push('dresser/wardrobe');
    if (hasDesk)    allowedLargeFurniture.push('desk/table');

    const forbiddenInventions: string[] = [];
    if (!hasRack)   forbiddenInventions.push('clothing rack or garment rail');
    if (!hasMirror) forbiddenInventions.push('full-length mirror or wall mirror');
    if (!hasDesk)   forbiddenInventions.push('desk or writing table');
    if (!hasOfficeFurniture) forbiddenInventions.push('office chair or ergonomic seating');
    if (bedCount === 0) forbiddenInventions.push('any bed');
    forbiddenInventions.push('branded shopping bags', 'retail store logos', 'new architectural elements');

    const maxClutterLevel: HaulWorldMap['maxClutterLevel'] =
      hasShoppingBags && hasCardboardBoxes ? 'medium' : hasShoppingBags ? 'light' : 'minimal';

    const packageMaxVisible = hasShoppingBags && hasCardboardBoxes ? 2
      : hasShoppingBags || hasCardboardBoxes ? 1 : 0;

    const allowedLines = allowedLargeFurniture.length > 0
      ? `ALLOWED furniture (present in REF0): ${allowedLargeFurniture.join(', ')}.`
      : 'ALLOWED furniture: only what is already established in REF0.';
    const surfaceLines = `Haul items may be placed on: ${allowedSurfaces.join(', ')}.`;
    const packageLine  = packageMaxVisible > 0
      ? `Max ${packageMaxVisible} unbranded plain bag(s)/box(es) visible — NO logos, NO retail brand names.`
      : `NO shopping bags or cardboard boxes — they were NOT in REF0. Do NOT invent packaging.`;

    const worldLockSummary = `🏠 ROOM WORLD LOCK — REF0 PHYSICAL MAP: ${allowedLines} ${surfaceLines} PACKAGING: ${packageLine} Also forbidden: ${forbiddenInventions.join(', ')}, clothing not uploaded by the user. Lighting: ${lightSource === 'natural_window' ? 'natural window light — preserve direction and warmth' : lightSource}. What REF0 shows is the maximum — not the minimum.`;

    return {
      hasBed, bedCount, hasWindow, hasRack, hasMirror, hasChair, hasDresser,
      hasDesk, hasOfficeFurniture, hasShoppingBags, hasCardboardBoxes,
      lightSource, lightDirection: l.direction ?? 'ambient',
      roomMood: s.geometry ?? 'real interior',
      allowedClothingSurfaces: allowedSurfaces,
      allowedLargeFurniture,
      forbiddenInventions,
      maxClutterLevel,
      worldLockSummary,
    };
  } catch {
    return {
      hasBed: false, bedCount: 0, hasWindow: false, hasRack: false, hasMirror: false,
      hasChair: false, hasDresser: false, hasDesk: false, hasOfficeFurniture: false,
      hasShoppingBags: false, hasCardboardBoxes: false,
      lightSource: 'unknown', lightDirection: 'ambient', roomMood: 'real interior',
      allowedClothingSurfaces: ['bed', 'floor'], allowedLargeFurniture: [],
      forbiddenInventions: ['rack', 'mirror', 'desk', 'office_chair'],
      maxClutterLevel: 'light',
      worldLockSummary: 'REF0 analysis error — apply conservative defaults: no new furniture added.',
    };
  }
}

// ── Haul Item Role Lock — bloque de uso permitido por ítem ────────────────────
// Define exactamente cómo puede (y NO puede) usarse un ítem según su manualKind.
// Esto impide que un top se convierta en vestido, un bottom en look completo, etc.
export function buildHaulItemRoleLockBlock(item: HaulItem): string {
  const rk = item.resolvedKind;
  const isManual = item.manualKind !== 'auto';
  const tag = isManual ? `MANUAL TAG: ${item.manualKind.toUpperCase()}` : `AUTO-DETECTED: ${rk.toUpperCase()}`;

  const rules: Record<HaulResolvedKind, string> = {
    full_outfit: `ITEM ROLE LOCK — FULL LOOK (${tag}): complete coordinated look, all pieces together. Allowed: worn complete, or held/displayed as the full composition. Forbidden: breaking it into separate pieces, adding unrelated garments, or treating it as just one item type.`,

    mixed_set: `ITEM ROLE LOCK — MULTI-ITEM SET (${tag}): multiple products shown together, not necessarily one outfit. Allowed: natural interaction with one or more pieces, or displayed as a group. Forbidden: assuming all pieces must be worn simultaneously, or inventing pieces to "complete" a sub-look.`,

    top: `ITEM ROLE LOCK — INDIVIDUAL TOP (${tag}): single top (blouse/shirt/tee/corset/camisole). Allowed: worn as featured top with neutral bottom for context, or held/flat/detail. Forbidden: turning it into a dress or full outfit, wearing it as bottom/outerwear, or treating it as a complete look.`,

    bottom: `ITEM ROLE LOCK — INDIVIDUAL BOTTOM (${tag}): single bottom (pants/skirt/shorts/jeans). Allowed: worn as featured bottom with simple neutral top for context, or held/flat/detail. Forbidden: turning it into a dress or top, treating it as a complete outfit, or letting the context top become the hero.`,

    dress: `ITEM ROLE LOCK — DRESS (${tag}): single main garment shoulder/neckline to hem. Allowed: worn complete with full silhouette visible, or held/shown full length. Forbidden: treating it as a top or pairing with another bottom, redesigning it, or losing the hem/skirt portion.`,

    onepiece: `ITEM ROLE LOCK — ONE-PIECE/JUMPSUIT (${tag}): single continuous garment top-to-bottom. Allowed: worn complete, or shown being put on/adjusted. Forbidden: splitting it visually into top+bottom, or treating the torso portion as a standalone top.`,

    outerwear: `ITEM ROLE LOCK — OUTERWEAR/JACKET/BLAZER (${tag}): outer layer (jacket/blazer/coat/cardigan). Allowed: worn open over simple neutral base, worn closed, being put on, or held. Forbidden: treating it as bottom or dress, inventing specific garments underneath, or losing its outer-layer nature.`,

    footwear: `ITEM ROLE LOCK — STANDALONE FOOTWEAR (${tag}): shoe/boot/sandal/sneaker only. Allowed: foot-level try-on, on a surface, held, or close-up detail. Forbidden: building a full outfit from this reference alone, treating it as clothing, or inventing garments from the shoe image.`,

    hosiery: `ITEM ROLE LOCK — HOSIERY/PANTYHOSE (${tag}): styling layer (tights/pantyhose/underlay leggings/stockings). Allowed: shown as leg layer under/with another garment, or being adjusted. Forbidden: treating it as thick pants or standalone bottom, making it the dominant garment, or losing its sheer quality if shown.`,

    bag: `ITEM ROLE LOCK — STANDALONE BAG/PURSE (${tag}): handbag/tote/clutch/crossbody/shoulder bag. Allowed: held, worn on shoulder/arm, resting on surface, or hardware detail. Forbidden: building a full outfit around it, treating it as clothing, or inventing garments from the bag image.`,

    jewelry: `ITEM ROLE LOCK — JEWELRY (${tag}): earrings/necklace/bracelet/ring/anklet. Allowed: worn on body (ear/neck/wrist/finger), held, or resting on fabric, macro or semi-macro framing. Forbidden: generating a full outfit context, replacing it with generic jewelry, or letting it disappear into the background. Reproduce EXACT size/scale — do not upsize or downsize.`,

    accessory: `ITEM ROLE LOCK — GENERIC ACCESSORY (${tag}): belt/hat/glasses/scarf/cap or similar. Allowed: worn in natural position, or displayed/held as visual focus. Forbidden: treating it as a main garment, or losing it behind other elements.`,

    unknown_visual_item: `ITEM ROLE LOCK — AUTO-DETECTED (${tag}): type was auto-detected — inspect the reference carefully. Show it consistent with what it actually IS. Forbidden: assuming it is clothing if it appears to be an accessory or product.`,
  };

  return rules[rk] ?? `ITEM ROLE LOCK: Show this item faithfully as the type indicated — do not transform it into a different category of object.`;
}

// ── Haul Anatomy Block — reglas globales de anatomía ─────────────────────────
// Se inyecta en TODOS los story shots del haul. Previene errores de manos, pies, dedos.
export function buildHaulAnatomyBlock(): string {
  return `🫀 ANATOMY: exactly 2 hands (5 fingers each, no fused/floating), 2 arms, 2 legs, 2 feet. No extra limbs, no phantom body parts, no elongation/distortion. Matching earrings on both ears if present.`;
}

// ── Haul Progress State — estado lógico de los ítems en este shot ────────────
// Genera el bloque de texto que le dice al modelo qué ítems ya fueron mostrados,
// cuál es el protagonista actual, y cuáles aún están pendientes.
// Evita que una prenda aparezca "puesta y a la vez intacta sobre la cama" en el mismo shot.
export function buildHaulProgressBlock(
  shotKey:   string,
  manifest:  HaulManifest,
  shotIndex: number,   // 0-based entre los story shots
  totalShots: number,
): string {
  if (!manifest) return '';

  const allItems = manifest.allItems;
  if (allItems.length === 0) return '';

  // Detectar el ítem primario de este shot
  let primaryId: string | undefined;
  if (shotKey.startsWith('HAUL_TRY_ON_') || shotKey.startsWith('HAUL_SELECTION') ||
      shotKey.startsWith('HAUL_ADJUSTING_') || shotKey.startsWith('HAUL_STYLED_')) {
    const numStr = shotKey.replace(/^HAUL_(TRY_ON|ADJUSTING|STYLED)_/, '');
    const idx    = shotKey === 'HAUL_SELECTION'
      ? manifest.outfitItems.length - 1
      : Math.max(0, parseInt(numStr, 10) - 1);
    primaryId = manifest.outfitItems[idx]?.id ?? manifest.tryOnItems[idx]?.id;
  } else if (shotKey.startsWith('HAUL_FOOTWEAR_')) {
    const idx = Math.max(0, parseInt(shotKey.replace('HAUL_FOOTWEAR_', ''), 10) - 1);
    primaryId = manifest.footwearItems[idx]?.id;
  } else if (shotKey.startsWith('HAUL_BAG_')) {
    const idx = Math.max(0, parseInt(shotKey.replace('HAUL_BAG_', ''), 10) - 1);
    primaryId = manifest.accessoryItems.filter(it => it.kind === 'bag')[idx]?.id;
  } else if (shotKey.startsWith('HAUL_JEWELRY_')) {
    const idx = Math.max(0, parseInt(shotKey.replace('HAUL_JEWELRY_', ''), 10) - 1);
    primaryId = manifest.accessoryItems.filter(it => it.kind === 'jewelry')[idx]?.id;
  } else if (shotKey.startsWith('HAUL_ACCESSORY_CLOSEUP_')) {
    const idx = Math.max(0, parseInt(shotKey.replace('HAUL_ACCESSORY_CLOSEUP_', ''), 10) - 1);
    primaryId = manifest.accessoryItems.filter(it => it.kind !== 'bag' && it.kind !== 'jewelry')[idx]?.id;
  }

  // Clasificar ítems en estados para este momento del haul
  // Heurística: ítems cuyo shot key ya pasó en el arc = tried_done
  // El primario = currently_worn / featured_closeup
  // El resto = untried
  const isTryOnShot = shotKey.startsWith('HAUL_TRY_ON_') || shotKey.startsWith('HAUL_SELECTION') ||
                      shotKey.startsWith('HAUL_ADJUSTING_') || shotKey.startsWith('HAUL_STYLED_');
  const isDetailShot = shotKey.startsWith('HAUL_FOOTWEAR_') || shotKey.startsWith('HAUL_BAG_') ||
                       shotKey.startsWith('HAUL_JEWELRY_') || shotKey.startsWith('HAUL_ACCESSORY_CLOSEUP_');

  const wornItems:    HaulItem[] = [];
  const untried:      HaulItem[] = [];
  const triedDone:    HaulItem[] = [];

  allItems.forEach(it => {
    if (it.id === primaryId) {
      wornItems.push(it);
    } else if (shotIndex > 0 && manifest.coveragePlan.ledger.find(l => l.itemId === it.id)?.plannedHeroShots === 0) {
      untried.push(it);
    } else {
      // Approximate: items before current position are tried_done
      const itemIdx = manifest.allItems.indexOf(it);
      if (itemIdx < shotIndex) {
        triedDone.push(it);
      } else {
        untried.push(it);
      }
    }
  });

  const lines: string[] = ['🔄 HAUL PROGRESS STATE — ITEM STATES FOR THIS SHOT:'];

  if (wornItems.length > 0) {
    const state = isTryOnShot ? 'CURRENTLY WORN (protagonist of this shot)' : 'FEATURED AS OBJECT (protagonist of this shot)';
    lines.push(`  ${state}:`);
    wornItems.forEach(it => lines.push(`    → ${it.label} [${it.resolvedKind}]`));
    if (isTryOnShot) {
      lines.push(`  RULE: This item IS on the body right now. Do NOT show it simultaneously as an intact unworn piece on the bed/chair as the main subject. The WORN version is the truth of this shot.`);
    } else if (isDetailShot) {
      lines.push(`  RULE: Show this item as an OBJECT (not worn). Macro/intimate framing. It is the subject, not a body accessory in a wide shot.`);
    }
  }

  if (triedDone.length > 0) {
    lines.push(`  ALREADY SHOWN (tried or featured in earlier shots):`);
    triedDone.forEach(it => lines.push(`    • ${it.label} — set aside on bed/chair in background, NOT the hero`));
    lines.push(`  RULE: These items MAY appear as background haul clutter, but they must NOT compete for visual attention with the current hero item.`);
  }

  if (untried.length > 0) {
    lines.push(`  NOT YET FEATURED (upcoming items — not yet shown):`);
    untried.forEach(it => lines.push(`    ○ ${it.label}`));
    lines.push(`  RULE: These items should NOT appear as clearly featured pieces yet — they may be in bags or off-frame.`);
  }

  const arcLabel = shotIndex <= Math.floor(totalShots * 0.33) ? 'EARLY'
    : shotIndex <= Math.floor(totalShots * 0.66) ? 'MIDDLE' : 'LATE';
  lines.push(`  Arc position: ${arcLabel} (shot ${shotIndex + 1} of ${totalShots}).`);

  return lines.join('\n');
}

// ── Allowed use modes por resolvedKind — para el debug coverageMap ────────────
export function getAllowedUseModes(rk: HaulResolvedKind): HaulItemAllowedUseMode[] {
  const map: Record<HaulResolvedKind, HaulItemAllowedUseMode[]> = {
    full_outfit:         ['worn_as_complete_look', 'displayed_as_object'],
    mixed_set:           ['displayed_as_object', 'worn_as_complete_look', 'worn_as_garment_layer'],
    top:                 ['worn_as_garment_layer', 'displayed_as_object'],
    bottom:              ['worn_as_garment_layer', 'displayed_as_object'],
    dress:               ['worn_as_dress', 'displayed_as_object'],
    onepiece:            ['worn_as_onepiece', 'displayed_as_object'],
    outerwear:           ['worn_as_garment_layer', 'displayed_as_object'],
    footwear:            ['worn_on_feet', 'displayed_as_object'],
    hosiery:             ['worn_as_styling_layer', 'displayed_as_object'],
    bag:                 ['held_or_carried', 'displayed_as_object'],
    jewelry:             ['worn_as_jewelry', 'displayed_as_object'],
    accessory:           ['worn_as_accessory', 'displayed_as_object'],
    unknown_visual_item: ['displayed_as_object'],
  };
  return map[rk] ?? ['displayed_as_object'];
}

// Genera el bloque de interpretación del ítem para el prompt final
export function buildHaulItemTypeBlock(item: HaulItem): string {
  const isManual = item.manualKind !== 'auto';
  const tagSource = isManual ? 'MANUAL USER TAG' : 'AUTO-DETECTED';
  return `REFERENCE ITEM INTERPRETATION — ${item.label}:
${tagSource}: ${item.manualKind.toUpperCase()}
RESOLVED KIND: ${item.resolvedKind.toUpperCase()}
PROMPT GUIDANCE: ${item.promptKindLabel}

${item.resolvedKind === 'full_outfit' ? `→ Treat as a COORDINATED OUTFIT/LOOK. The pieces shown together are intended to be worn as a set.
   Preserve the combination logic and styling relationship between visible pieces.
   Do NOT reduce it to one isolated garment. Do NOT treat it as a vague "look" — every visible piece must appear.

${item.outfitComponents ? `OUTFIT COMPONENT CONTRACT — ALL pieces listed below MUST be visible and faithful in this shot:
${item.outfitComponents.componentsSummary}
PARTIAL LOOK RULE: If only SOME components appear, the image is a partial failure — the generation must show the COMPLETE look as described.
FORBIDDEN: losing any of the main listed pieces. Showing only the top but not the bottom. Wearing a different shoe than the reference provides.
  • Top: ${item.outfitComponents.hasTop ? 'REQUIRED — must be visible' : 'not expected'}
  • Bottom: ${item.outfitComponents.hasBottom ? 'REQUIRED — silhouette, length, and fit readable' : 'not expected'}
  • Dress/Onepiece: ${item.outfitComponents.hasDress ? 'REQUIRED — full silhouette top to hem visible' : 'not expected'}
  • Footwear: ${item.outfitComponents.hasFootwear ? 'REQUIRED — show correctly integrated on both feet' : 'not expected in this shot'}
  • Hosiery/Tights: ${item.outfitComponents.hasHosiery ? 'REQUIRED — visible on both legs consistently' : 'not expected'}
  • Bag: ${item.outfitComponents.hasBag ? 'INCLUDE if it appears in the reference — worn or held naturally' : 'not expected'}
  • Jewelry: ${item.outfitComponents.hasJewelry ? 'INCLUDE if it appears in the reference — worn naturally' : 'not expected'}

${item.outfitComponents.footwearLegCoverageRisk ? `⚠️ FOOTWEAR + LEGWEAR INTEGRATION WARNING FOR THIS LOOK:
This outfit combines legwear (pants/skirt/tights/leggings) with footwear that may cover the leg.
MANDATORY SYMMETRY: Both legs must have IDENTICAL integration — choose one coherent style and apply it to BOTH sides:
  — legwear tucked into boot/shaft on both legs
  — boot shaft under legwear on both legs
  — legwear draping over footwear on both legs
FORBIDDEN: one leg tucked, the other not. Shaft clipping through fabric on one side. Half-inside half-outside. Leg geometry mismatch.` : ''}` : `If a neutral base is needed for missing pieces, use the simplest neutral possible — it must NOT become the hero.`}` : ''}${item.resolvedKind === 'mixed_set' ? `→ Treat as a PRODUCT GROUP — multiple items in one image, not necessarily one complete outfit.
   Do NOT assume every piece goes together unless the reference clearly shows it.
   Show the person interacting with one or more items naturally.` : ''}${item.resolvedKind === 'dress' ? `→ Treat as a DRESS or ONE-PIECE. It is the main garment — top to hem.
   Do NOT treat it as a generic garment. Ensure the full silhouette reads clearly.` : ''}${item.resolvedKind === 'onepiece' ? `→ Treat as a JUMPSUIT / BODYSUIT / ONEPIECE. It covers the body as a single piece.
   Show the full silhouette. Do NOT show it as two separate pieces.` : ''}${item.resolvedKind === 'outerwear' ? `→ Treat as OUTERWEAR. It is a jacket, blazer, or coat worn as an outer layer.
   It may be worn open over another piece, or shown being put on. Do NOT invent what is underneath unless visible.` : ''}${item.resolvedKind === 'footwear' ? `→ Treat as STANDALONE FOOTWEAR. Do NOT invent a complete outfit around the shoe.
   Show it: held, placed on surface, at foot level, or as a close-up detail. The shoe IS the subject.` : ''}${item.resolvedKind === 'bag' ? `→ Treat as a STANDALONE BAG. Do NOT build a full outfit around it.
   Show it: held, worn on shoulder, resting on bed, or with hardware/texture close-up. The bag IS the subject.` : ''}${item.resolvedKind === 'jewelry' ? `→ Treat as a JEWELRY PIECE. Use intimate/macro framing: worn on body, held between fingers, or resting on fabric.
   Do NOT generate a full outfit for context. The jewelry IS the subject.` : ''}${item.resolvedKind === 'hosiery' ? `→ Treat as a HOSIERY / STYLING LAYER. It is NOT a standalone outfit.
   Show it as a layering piece. A supporting garment for context is allowed but must not become the hero.` : ''}${item.resolvedKind === 'top' ? `→ Treat as an INDIVIDUAL TOP. Show it worn with a neutral bottom (pants/skirt) for context.
   The top must be the clear visual focus. Do NOT let the bottom piece dominate.` : ''}${item.resolvedKind === 'bottom' ? `→ Treat as an INDIVIDUAL BOTTOM. Show it with a simple neutral top for context.
   The bottom piece must be the clear visual focus — length, silhouette, fit.` : ''}${item.resolvedKind === 'accessory' ? `→ Treat as a GENERIC ACCESSORY. Show it worn, held, or displayed as a detail.
   Do NOT treat it as the centerpiece of a full outfit if it is a small piece.` : ''}
CRITICAL: The manualKind tag overrides any visual inference. Trust the user's classification.`;
}

function haulRefKindToItemKind(refKind: HaulRefKind): HaulItemKind {
  switch (refKind) {
    case 'look_completo':  return 'outfit_set';
    case 'varios_items':   return 'mixed';
    case 'top':
    case 'bottom':
    case 'vestido':
    case 'enterizo':
    case 'chaqueta':
    case 'pantys':         return 'garment';
    case 'calzado':        return 'footwear';
    case 'bolso':          return 'bag';
    case 'joyeria':
    case 'aros':
    case 'collar':
    case 'anillo':
    case 'pulsera':        return 'jewelry';
    case 'accesorio':
    case 'cinturon':
    case 'panoleta':
    case 'scrunchie':
    case 'sombrero':
    case 'gafas':          return 'accessory';
    case 'auto':
    default:               return 'garment'; // fallback — será sobreescrito por heurística si es 'auto'
  }
}

// Heurística de clasificación por etiqueta/slot.
// Solo se usa cuando el usuario no seleccionó un tipo (refKind === 'auto').
function inferHaulItemKindByLabel(slotLabel: string): HaulItemKind {
  const label = slotLabel.toLowerCase();
  if (label.includes('calzado') || label.includes('zapato') || label.includes('botín') || label.includes('botin') ||
      label.includes('sandalia') || label.includes('zapatilla') || label.includes('footwear') ||
      label.includes('shoe') || label.includes('boot') || label.includes('sneaker') || label.includes('heel') ||
      label.includes('taco') || label.includes('stiletto') || label.includes('mule')) {
    return 'footwear';
  }
  if (label.includes('bolso') || label.includes('cartera') || label.includes('tote') || label.includes('clutch') || label.includes('bag')) {
    return 'bag';
  }
  if (label.includes('collar') || label.includes('aros') || label.includes('anillo') || label.includes('pulsera') ||
      label.includes('joya') || label.includes('jewel') || label.includes('necklace') || label.includes('ring')) {
    return 'jewelry';
  }
  return 'garment';
}

// Punto de entrada unificado. Si el usuario eligió tipo manual, lo usa con prioridad total.
function inferHaulItemKind(slotLabel: string, index: number, manualKind?: HaulRefKind): HaulItemKind {
  if (manualKind && manualKind !== 'auto') {
    return haulRefKindToItemKind(manualKind);
  }
  return inferHaulItemKindByLabel(slotLabel);
}

export function buildHaulManifest(
  refs:           PhotodumpRefs,
  requestedCount: number,
  visualAnalysis?: VisualRefsAnalysisResult,
): HaulManifest {
  const maxStoryShots = Math.min(requestedCount, 20);

  // REGLA DURA: avatarRef y bodyRef NUNCA entran en haulItems.
  // outfitRef (slot 0) + outfitRefs[] (slots 1-N) son los ítems del haul.
  // La ropa visible en avatarRef/bodyRef es identidad base, no un ítem del haul.
  const rawOutfits      = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
  const outfitManualKinds = refs.haulOutfitKinds ?? [];

  const outfitItems:   HaulItem[] = [];
  const footwearItems: HaulItem[] = [];
  const bagItems:      HaulItem[] = [];
  const jewelryItems:  HaulItem[] = [];

  // Pre-calcular los manualKinds de accesorios para poder inferir outfitComponents
  const accManualKindsPre: HaulRefKind[] = (refs.haulAccKinds ?? []);

  rawOutfits.forEach((url, i) => {
    const manualKind: HaulRefKind = outfitManualKinds[i] ?? 'auto';

    // Análisis visual de Gemini para este slot (si está disponible).
    // El índice en visualAnalysis coincide con la posición en rawOutfits (outfitRef=0, outfitRefs[0]=1...).
    const visualRef = visualAnalysis?.refs.find(r => r.index === i);

    // Regla de prioridad:
    // 1. Selector manual explícito del usuario → siempre gana (intención declarada)
    // 2. Análisis visual de Gemini (confidence high/medium) → corrige 'auto'
    // 3. Heurística de texto (inferHaulItemKind) → fallback si no hay análisis
    const kind: HaulItemKind = (() => {
      if (manualKind !== 'auto') return haulRefKindToItemKind(manualKind);
      if (visualRef && (visualRef.confidence === 'high' || visualRef.confidence === 'medium')) {
        // Mapear resolvedKind visual → HaulItemKind
        const rk = visualRef.resolvedKind;
        if (rk === 'footwear')  return 'footwear';
        if (rk === 'bag')       return 'bag';
        if (rk === 'jewelry')   return 'jewelry';
        if (rk === 'accessory') return 'accessory';
        if (rk === 'full_outfit' || rk === 'mixed_set') return 'outfit_set';
        return 'garment';
      }
      return inferHaulItemKindByLabel(`Prenda ${i + 1}`);
    })();

    const resolvedKind = resolveHaulKind(manualKind, kind);
    const promptKindLabel = resolvedKindToPromptLabelForManualKind(resolvedKind, manualKind);

    // Etiqueta descriptiva según el tipo elegido
    const kindLabel: Record<HaulItemKind, string> = {
      outfit_set: 'Look completo',
      garment:    'Prenda',
      footwear:   'Calzado',
      accessory:  'Accesorio',
      bag:        'Bolso',
      jewelry:    'Joyería',
      mixed:      'Set de ítems',
      unknown:    'Ítem',
    };
    const label = `${kindLabel[kind] ?? 'Ítem'} ${i + 1}`;

    const isTryOnEligible = kind !== 'footwear' && kind !== 'bag' && kind !== 'jewelry' && kind !== 'accessory';

    // outfitComponents: priorizar análisis visual de Gemini si está disponible.
    // Fallback: inferOutfitComponents semántico (basado en selector + accesorios del haul).
    const outfitComponents = (resolvedKind === 'full_outfit' || resolvedKind === 'mixed_set')
      ? (visualRef?.components ?? inferOutfitComponents(manualKind, label, accManualKindsPre))
      : undefined;

    // Añadir descripción visual al label si Gemini la proveyó (enriquece el prompt)
    const enrichedLabel = visualRef?.visualDescription
      ? `${label} — ${visualRef.visualDescription}`
      : label;

    const item: HaulItem = {
      id:                        `outfit_${i}`,
      sourceIndex:               i,
      refUrl:                    url,
      kind,
      manualKind,
      resolvedKind,
      promptKindLabel,
      label:                     enrichedLabel,
      closeupRequested:          false,
      tryOnEligible:             isTryOnEligible,
      footwearTryOnEligible:     kind === 'footwear',
      detailEligible:            true,
      canBeIntegratedIntoOutfit: kind === 'footwear' || kind === 'accessory' || kind === 'bag' || kind === 'jewelry',
      priority:                  'required' as const,
      outfitComponents,
    };

    if (kind === 'footwear') {
      footwearItems.push(item);
    } else if (kind === 'bag') {
      bagItems.push(item);
    } else if (kind === 'jewelry') {
      jewelryItems.push(item);
    } else {
      outfitItems.push(item);
    }
  });

  // Accesorios: accesorioRefs[] + closeup flags + manual kinds
  const rawAccs    = (refs.accesorioRefs ?? []).filter(Boolean) as string[];
  const closeupArr = refs.accesorioCloseup ?? [];
  // accManualKindsPre ya fue definida arriba para inferir outfitComponents
  const accManualKinds = accManualKindsPre;

  const accessoryItems: HaulItem[] = rawAccs.map((url, i) => {
    const manualKind: HaulRefKind = accManualKinds[i] ?? 'auto';

    // Índice global: accesorios vienen después de los outfits en el array enviado a Gemini
    const visualAccRef = visualAnalysis?.refs.find(r => r.index === rawOutfits.length + i);

    // Prioridad: selector manual > análisis Gemini > heurística
    const accKind: HaulItemKind = (() => {
      if (manualKind === 'bolso')   return 'bag';
      if (manualKind === 'joyeria' || manualKind === 'aros' || manualKind === 'collar' || manualKind === 'anillo' || manualKind === 'pulsera') return 'jewelry';
      if (manualKind === 'calzado') return 'footwear';
      if (manualKind !== 'auto')    return 'accessory';
      if (visualAccRef && (visualAccRef.confidence === 'high' || visualAccRef.confidence === 'medium')) {
        const rk = visualAccRef.resolvedKind;
        if (rk === 'footwear') return 'footwear';
        if (rk === 'bag')      return 'bag';
        if (rk === 'jewelry')  return 'jewelry';
      }
      return 'accessory';
    })();

    const resolvedKind = resolveHaulKind(manualKind, accKind);
    const promptKindLabel = resolvedKindToPromptLabelForManualKind(resolvedKind, manualKind);
    const baseLabel = `Accesorio ${i + 1}`;
    const label = visualAccRef?.visualDescription
      ? `${baseLabel} — ${visualAccRef.visualDescription}`
      : baseLabel;

    return {
      id:                        `acc_${i}`,
      sourceIndex:               i,
      refUrl:                    url,
      kind:                      accKind,
      manualKind,
      resolvedKind,
      promptKindLabel,
      label,
      closeupRequested:          !!closeupArr[i],
      tryOnEligible:             false,
      footwearTryOnEligible:     accKind === 'footwear',
      detailEligible:            true,
      canBeIntegratedIntoOutfit: true,
      priority:                  'required' as const,
    };
  });

  const allItems     = [...outfitItems, ...footwearItems, ...bagItems, ...jewelryItems, ...accessoryItems];
  const closeupItems = [
    ...footwearItems.filter(it => it.closeupRequested),
    ...bagItems.filter(it => it.closeupRequested),
    ...jewelryItems.filter(it => it.closeupRequested),
    ...accessoryItems.filter(it => it.closeupRequested),
  ];
  const tryOnItems   = outfitItems.filter(it => it.tryOnEligible);

  // ── CoveragePlan ───────────────────────────────────────────────
  const requiredTryOnItemIds   = outfitItems.map(it => it.id);
  const requiredCloseupItemIds = closeupItems.map(it => it.id);
  // calzado y bolsos sin closeup marcado igual merecen al menos un detail shot
  const requiredDetailItemIds  = [
    ...footwearItems.filter(it => !it.closeupRequested).map(it => it.id),
    ...bagItems.filter(it => !it.closeupRequested).map(it => it.id),
  ];
  const optionalItemIds        = accessoryItems.filter(it => !it.closeupRequested).map(it => it.id);

  // Construir ledger real — plannedHeroShots se rellena en buildHaulShotPlan
  const ledger: HaulCoverageLedgerItem[] = allItems.map(it => ({
    itemId:                     it.id,
    manualKind:                 it.manualKind,
    resolvedKind:               it.resolvedKind,
    label:                      it.label,
    required:                   it.priority === 'required',
    plannedHeroShots:           0,
    plannedIntegratedShots:     0,
    plannedSupportShots:        0,
    actualPromptedHeroShots:    0,
    actualPromptedSupportShots: 0,
    coverageStatus:             'uncovered' as const,
    shotIds:                    [],
  }));

  const coveragePlan: HaulCoveragePlan = {
    requiredTryOnItemIds,
    requiredCloseupItemIds,
    requiredDetailItemIds,
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
    totalItems:     allItems.length,
    outfitItems,
    footwearItems,
    accessoryItems: [...bagItems, ...jewelryItems, ...accessoryItems],
    closeupItems,
    tryOnItems,
    allItems,
    requestedCount,
    maxStoryShots,
    coveragePlan,
    baseStartingLook: {
      id:           'base_starting_look',
      label:        'neutral non-product base',
      description:  'simple neutral fitted top + basic jeans/leggings/shorts — understated, NOT a haul item, NOT visible in avatar reference',
      isHaulItem:   false,
      allowedShots: ['HAUL_OVERVIEW', 'HAUL_ACCESSORY_CLOSEUP', 'HAUL_JEWELRY', 'HAUL_BAG', 'HAUL_FOOTWEAR'],
      forbiddenShots: ['HAUL_TRY_ON', 'HAUL_SELECTION', 'HAUL_STYLED', 'HAUL_RECAP'],
    },
  };
}

// ── Haul Styling Graph — pairing semántico entre ítems ───────
// Analiza los ítems del manifest y genera combinaciones compatibles.
// Reglas: color/ocasión/formalidad coherente, no mezcla aberrante.
// Exportada para reutilización en otras recetas de photodump.
export function buildHaulStylingGraph(manifest: HaulManifest): HaulStylingGraph {
  const combinations: HaulStyledCombination[] = [];
  const warnings: string[] = [];

  const wearableKinds: HaulResolvedKind[] = ['full_outfit', 'top', 'bottom', 'dress', 'onepiece', 'outerwear', 'hosiery', 'mixed_set'];
  const wearables    = manifest.allItems.filter(it => wearableKinds.includes(it.resolvedKind));
  const footwears    = manifest.allItems.filter(it => it.resolvedKind === 'footwear');
  const bags         = manifest.allItems.filter(it => it.resolvedKind === 'bag');
  const jewels       = manifest.allItems.filter(it => it.resolvedKind === 'jewelry');
  const accessories  = manifest.allItems.filter(it => it.resolvedKind === 'accessory');
  const hosiery      = manifest.allItems.filter(it => it.resolvedKind === 'hosiery');

  // Ítem IDs que ya participan en alguna combinación
  const pairedItemIds = new Set<string>();

  // ── Paso 1: combinar bases wearable con complementos compatibles ──
  for (const base of wearables) {
    if (base.resolvedKind === 'hosiery') continue; // hosiery no es base primario

    const combo: HaulStyledCombination = {
      id:                  `combo_${base.id}`,
      label:               base.label,
      itemIds:             [base.id],
      primaryWearableId:   base.id,
      compatibilityScore:  80,
      compatibilityReason: `${base.label} as primary wearable`,
    };

    // Asignar campos según resolvedKind del base
    if (base.resolvedKind === 'top')       combo.topId       = base.id;
    if (base.resolvedKind === 'bottom')    combo.bottomId    = base.id;
    if (base.resolvedKind === 'dress')     combo.dressId     = base.id;
    if (base.resolvedKind === 'onepiece')  combo.onepieceId  = base.id;
    if (base.resolvedKind === 'outerwear') combo.outerwearId = base.id;
    if (base.resolvedKind === 'full_outfit' || base.resolvedKind === 'mixed_set') {
      combo.topId    = base.id;
      combo.bottomId = base.id;
    }

    // ── Top + Bottom pairing ──────────────────────────────────
    if (base.resolvedKind === 'top') {
      const bottom = wearables.find(it =>
        it.resolvedKind === 'bottom' && !pairedItemIds.has(it.id),
      );
      if (bottom) {
        combo.bottomId = bottom.id;
        combo.itemIds.push(bottom.id);
        combo.label   = `${base.label} + ${bottom.label}`;
        combo.compatibilityScore  = 85;
        combo.compatibilityReason = 'top + bottom pairing';
      }
    }
    if (base.resolvedKind === 'bottom') {
      const top = wearables.find(it =>
        it.resolvedKind === 'top' && !pairedItemIds.has(it.id),
      );
      if (top) {
        combo.topId = top.id;
        combo.itemIds.push(top.id);
        combo.label   = `${top.label} + ${base.label}`;
        combo.compatibilityScore  = 85;
        combo.compatibilityReason = 'top + bottom pairing';
      }
    }

    // ── Outerwear sobre look base ─────────────────────────────
    if (base.resolvedKind !== 'outerwear') {
      const outer = wearables.find(it =>
        it.resolvedKind === 'outerwear' && !combo.itemIds.includes(it.id),
      );
      if (outer) {
        combo.outerwearId = outer.id;
        combo.itemIds.push(outer.id);
        combo.label  += ` + ${outer.label}`;
      }
    }

    // ── Hosiery con falda/vestido/enterizo ───────────────────
    const needsHosiery = ['dress', 'onepiece', 'bottom'].includes(base.resolvedKind ?? '');
    if (needsHosiery && hosiery.length > 0) {
      const hose = hosiery.find(it => !combo.itemIds.includes(it.id));
      if (hose) {
        combo.hosieryId = hose.id;
        combo.itemIds.push(hose.id);
      }
    }

    // ── Calzado compatible ────────────────────────────────────
    if (footwears.length > 0) {
      // Regla: no usar tacones elegantes con ropa muy casual. Scoring simplificado:
      // si la base tiene outfitComponents con footwear → buscar calzado compatible.
      // Sin outfitComponents: asignar el primer calzado disponible.
      const fw = footwears.find(it => !combo.itemIds.includes(it.id));
      if (fw) {
        combo.footwearId = fw.id;
        combo.itemIds.push(fw.id);
        combo.compatibilityScore = Math.max(60, combo.compatibilityScore - 5); // ligera reducción por incertidumbre
        combo.compatibilityReason += ` + footwear integrated`;
      }
    }

    // ── Bolso compatible ──────────────────────────────────────
    if (bags.length > 0) {
      const bag = bags.find(it => !combo.itemIds.includes(it.id));
      if (bag) {
        combo.bagId = bag.id;
        combo.itemIds.push(bag.id);
      }
    }

    // ── Joyería compatible ────────────────────────────────────
    const jewelryForCombo = jewels.filter(it => !combo.itemIds.includes(it.id)).slice(0, 2);
    if (jewelryForCombo.length > 0) {
      combo.jewelryIds = jewelryForCombo.map(j => j.id);
      combo.itemIds.push(...combo.jewelryIds);
    }

    // ── Accesorios ────────────────────────────────────────────
    const accsForCombo = accessories.filter(it => !combo.itemIds.includes(it.id)).slice(0, 1);
    if (accsForCombo.length > 0) {
      combo.accessoryIds = accsForCombo.map(a => a.id);
      combo.itemIds.push(...combo.accessoryIds);
    }

    // Registrar todos los ítems de esta combinación como paired
    combo.itemIds.forEach(id => pairedItemIds.add(id));

    // Advertir si la combinación es arriesgada (score bajo)
    if (combo.compatibilityScore < 65) combo.risky = true;

    combinations.push(combo);
  }

  // ── Paso 2: identificar ítems sin pairing ────────────────────
  const allItemIds    = manifest.allItems.map(it => it.id);
  const standaloneIds = allItemIds.filter(id => !pairedItemIds.has(id));

  // Ítems complementarios solos sin base wearable
  const unpairedIds = standaloneIds.filter(id => {
    const item = manifest.allItems.find(it => it.id === id);
    return item && !wearableKinds.includes(item.resolvedKind);
  });

  if (combinations.length === 0 && unpairedIds.length > 0) {
    warnings.push('NO_WEARABLE_BASE: all items are accessories/footwear/jewelry — no styled combinations possible, all items will be standalone shots');
  }

  const risky = combinations.filter(c => c.risky);
  if (risky.length > 0) {
    warnings.push(`RISKY_COMBINATIONS: ${risky.map(c => c.id).join(', ')} — compatibility score < 65, integration may look forced`);
  }

  return {
    combinations,
    standaloneItems: standaloneIds,
    unpairedItems:   unpairedIds,
    warnings,
  };
}

// ── Accessory-Outfit Compatibility Scoring ────────────────────
// Heurística de compatibilidad entre accesorio/joyería/calzado y outfit.
// No requiere IA — trabaja con color family, material/metal y vibe.
// Exportada para reutilización en otras recetas de photodump.

export interface AccessoryOutfitMatch {
  accessoryId:     string;
  outfitId:        string;
  score:           number;   // 0–100
  reason:          string;
  integrationMode: 'worn' | 'adjusting' | 'held' | 'detail_on_body' | 'flatlay_pairing';
}

export function scoreAccessoryOutfitCompatibility(
  accessory: HaulItem,
  outfit:    HaulItem,
): AccessoryOutfitMatch {
  const accLabel  = (accessory.label ?? '').toLowerCase();
  const outLabel  = (outfit.label ?? '').toLowerCase();
  const accKind   = accessory.resolvedKind;
  const outKind   = outfit.resolvedKind;

  // ── Color family detection ──
  const GOLD_SIGNALS    = ['dorado', 'gold', 'golden', 'camel', 'beige', 'bronce', 'bronze', 'copper'];
  const SILVER_SIGNALS  = ['plateado', 'silver', 'plata', 'grey', 'gris', 'chrome', 'acero'];
  const BLACK_SIGNALS   = ['negro', 'black', 'ebony', 'dark', 'oscuro', 'cuero negro', 'leather'];
  const WHITE_SIGNALS   = ['blanco', 'white', 'ivory', 'cream', 'crema', 'off-white'];
  const WARM_SIGNALS    = ['café', 'brown', 'tan', 'terracota', 'naranja', 'orange', 'rojo', 'red', 'burdeos', 'vino', 'wine', 'rust', 'coral'];
  const COOL_SIGNALS    = ['azul', 'blue', 'verde', 'green', 'navy', 'celeste', 'teal', 'aqua', 'lila', 'morado', 'purple', 'violet'];
  const NEUTRAL_SIGNALS = ['gris', 'grey', 'gray', 'nude', 'neutro', 'neutral', 'beige', 'khaki', 'arena'];
  const DENIM_SIGNALS   = ['jean', 'denim', 'vaquero', 'jeans'];

  const hasAny = (text: string, signals: string[]) => signals.some(s => text.includes(s));

  const accIsGold    = hasAny(accLabel, GOLD_SIGNALS);
  const accIsSilver  = hasAny(accLabel, SILVER_SIGNALS);
  const accIsBlack   = hasAny(accLabel, BLACK_SIGNALS);
  const accIsWhite   = hasAny(accLabel, WHITE_SIGNALS);
  const accIsWarm    = hasAny(accLabel, WARM_SIGNALS);
  const accIsCool    = hasAny(accLabel, COOL_SIGNALS);
  const accIsNeutral = hasAny(accLabel, NEUTRAL_SIGNALS);
  const accIsGreen   = accLabel.includes('verde') || accLabel.includes('green');

  const outIsBlack   = hasAny(outLabel, BLACK_SIGNALS);
  const outIsWhite   = hasAny(outLabel, WHITE_SIGNALS);
  const outIsWarm    = hasAny(outLabel, WARM_SIGNALS);
  const outIsCool    = hasAny(outLabel, COOL_SIGNALS);
  const outIsNeutral = hasAny(outLabel, NEUTRAL_SIGNALS);
  const outIsDenim   = hasAny(outLabel, DENIM_SIGNALS);

  // ── Vibe detection ──
  const ELEGANT_SIGNALS = ['vestido', 'dress', 'falda', 'skirt', 'blazer', 'traje', 'suit', 'elegante', 'formal', 'noche', 'night', 'satin', 'satén', 'silk', 'seda'];
  const CASUAL_SIGNALS  = ['casual', 'basic', 'everyday', 'jeans', 'jean', 'denim', 'hoodie', 'sweater', 'polera', 'remera', 'tshirt', 't-shirt', 'shorts', 'short'];
  const LEATHER_SIGNALS = ['cuero', 'leather', 'eco-cuero', 'leatherette', 'faux leather'];
  const SPORT_SIGNALS   = ['sport', 'gym', 'legging', 'leggins', 'track', 'jogger', 'activewear', 'deportivo'];

  const outIsElegant = hasAny(outLabel, ELEGANT_SIGNALS);
  const outIsCasual  = hasAny(outLabel, CASUAL_SIGNALS);
  const outIsLeather = hasAny(outLabel, LEATHER_SIGNALS);
  const outIsSport   = hasAny(outLabel, SPORT_SIGNALS);

  // ── Item kind ──
  const isJewelry  = accKind === 'jewelry';
  const isFootwear = accKind === 'footwear';
  const isBag      = accKind === 'bag';
  const isBelt     = accLabel.includes('cinturón') || accLabel.includes('belt') || accLabel.includes('cinto');
  const isGlasses  = accLabel.includes('gafas') || accLabel.includes('lentes') || accLabel.includes('sunglasses') || accLabel.includes('anteojos');
  const isHat      = accLabel.includes('sombrero') || accLabel.includes('hat') || accLabel.includes('gorra') || accLabel.includes('boina');

  // ── Conflict detection (hard blockers) ──
  const isHeels    = isFootwear && (accLabel.includes('taco') || accLabel.includes('heel') || accLabel.includes('stiletto') || accLabel.includes('pump'));
  const isBoots    = isFootwear && (accLabel.includes('bota') || accLabel.includes('boot'));
  const isSneakers = isFootwear && (accLabel.includes('zapatilla') || accLabel.includes('sneaker') || accLabel.includes('tenis'));

  // Anti-match: heels with sportswear
  if (isHeels && outIsSport) return { accessoryId: accessory.id, outfitId: outfit.id, score: 5, reason: 'heels + sportswear — style clash', integrationMode: 'flatlay_pairing' };
  // Anti-match: sneakers with formal/elegant
  if (isSneakers && outIsElegant && !outIsCasual) return { accessoryId: accessory.id, outfitId: outfit.id, score: 15, reason: 'sneakers + formal outfit — low compatibility', integrationMode: 'flatlay_pairing' };

  // ── Scoring ──
  let score = 50; // baseline neutral
  const reasons: string[] = [];

  // Gold jewelry + warm/beige/brown outfit → great
  if (isJewelry && accIsGold && (outIsWarm || outIsNeutral)) { score += 25; reasons.push('gold jewelry + warm/neutral tones'); }
  // Silver jewelry + cool/black/white → great
  if (isJewelry && accIsSilver && (outIsCool || outIsBlack || outIsWhite)) { score += 25; reasons.push('silver jewelry + cool/dark tones'); }
  // Green jewelry + neutral/white/denim → good
  if (isJewelry && accIsGreen && (outIsNeutral || outIsWhite || outIsDenim || outIsBlack)) { score += 20; reasons.push('green jewelry + neutral/denim/black base'); }
  // Any jewelry + neutral outfit → safe
  if (isJewelry && outIsNeutral) { score += 15; reasons.push('jewelry + neutral outfit — always compatible'); }
  // Jewelry + denim → casual match
  if (isJewelry && outIsDenim) { score += 15; reasons.push('jewelry + denim — casual compatibility'); }
  // Black footwear + elegant or leather → excellent
  if (isFootwear && accIsBlack && (outIsElegant || outIsLeather)) { score += 30; reasons.push('black footwear + elegant/leather look'); }
  // White footwear + white/neutral/denim → excellent
  if (isFootwear && accIsWhite && (outIsWhite || outIsNeutral || outIsDenim)) { score += 30; reasons.push('white footwear + light/neutral/denim outfit'); }
  // Warm-tone footwear + warm outfit
  if (isFootwear && accIsWarm && outIsWarm) { score += 20; reasons.push('warm-tone footwear + warm outfit'); }
  // Footwear + elegant outfit → always push integration
  if (isFootwear && outIsElegant) { score += 20; reasons.push('footwear preferred with elegant look'); }
  // Bag + any non-sport outfit → good
  if (isBag && !outIsSport) { score += 15; reasons.push('bag integrates well with non-sport look'); }
  // Bag + elegant → great
  if (isBag && outIsElegant) { score += 20; reasons.push('bag + elegant look'); }
  // Belt + bottom/dress → contextual
  if (isBelt && (outKind === 'bottom' || outKind === 'dress' || outKind === 'onepiece')) { score += 25; reasons.push('belt + bottom/dress — natural pairing'); }
  // Glasses + casual/denim → relaxed match
  if (isGlasses && (outIsCasual || outIsDenim)) { score += 15; reasons.push('glasses + casual look'); }
  // Hat + casual or denim → match
  if (isHat && (outIsCasual || outIsDenim)) { score += 15; reasons.push('hat + casual/denim look'); }
  // Neutral accessory → safe with anything
  if (accIsNeutral) { score += 10; reasons.push('neutral-tone accessory — universally compatible'); }

  // Clamp 0–100
  score = Math.min(100, Math.max(0, score));

  // ── Integration mode ──
  let integrationMode: AccessoryOutfitMatch['integrationMode'];
  if (isJewelry) integrationMode = score >= 65 ? 'worn' : 'detail_on_body';
  else if (isFootwear) integrationMode = score >= 60 ? 'worn' : 'detail_on_body';
  else if (isBag) integrationMode = score >= 60 ? 'held' : 'flatlay_pairing';
  else if (isBelt) integrationMode = 'worn';
  else integrationMode = score >= 60 ? 'worn' : 'flatlay_pairing';

  return {
    accessoryId:     accessory.id,
    outfitId:        outfit.id,
    score,
    reason:          reasons.length > 0 ? reasons.join('; ') : 'baseline neutral compatibility',
    integrationMode,
  };
}

// ── Outfit Haul — Shot planner ────────────────────────────────
// Genera exactamente `manifest.maxStoryShots` story shots con cobertura inteligente.
// Orden de reserva:
//   1. close-ups obligatorios (accesorios marcados)
//   2. un HAUL_OVERVIEW de apertura
//   3. try-ons de outfits/prendas
//   4. detalles / adjusting para variedad
//   5. HAUL_RECAP de cierre si hay espacio

// Threshold above which an accessory is integrated into a compatible outfit shot
// rather than receiving an isolated closeup. Score is 0–100.
const COMPATIBILITY_THRESHOLD = 65;

export function buildHaulShotPlan(
  manifest: HaulManifest,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const total = manifest.maxStoryShots;

  // ── Build / reuse styling graph ──────────────────────────────
  const graph = manifest.stylingGraph ?? buildHaulStylingGraph(manifest);
  manifest.stylingGraph = graph;

  // All wearable items in the manifest (outfits + tops + bottoms, etc.)
  const wearableKindsSet = new Set<HaulResolvedKind>(['full_outfit', 'top', 'bottom', 'dress', 'onepiece', 'outerwear', 'hosiery', 'mixed_set']);
  const allWearables = manifest.allItems.filter(it => wearableKindsSet.has(it.resolvedKind));

  // Helper: find best compatible wearable for an accessory using the scorer.
  // Uses stylingGraph first (semantic pairing), then falls back to raw scorer over allWearables.
  // Returns null if best score < COMPATIBILITY_THRESHOLD.
  const findCompatibleOutfitFor = (
    item: HaulItem,
  ): { outfitItemId: string; outfitLabel: string; score: number; integrationMode: AccessoryOutfitMatch['integrationMode'] } | null => {
    // 1. Check styling graph combinations first
    for (const combo of graph.combinations) {
      if (combo.itemIds.includes(item.id) && combo.primaryWearableId && combo.primaryWearableId !== item.id) {
        const base = manifest.allItems.find(it => it.id === combo.primaryWearableId);
        if (base) {
          const match = scoreAccessoryOutfitCompatibility(item, base);
          if (match.score >= COMPATIBILITY_THRESHOLD) {
            return { outfitItemId: base.id, outfitLabel: base.label, score: match.score, integrationMode: match.integrationMode };
          }
        }
      }
    }
    // 2. Fallback: score all wearables and pick best
    if (allWearables.length > 0) {
      const matches = allWearables.map(w => scoreAccessoryOutfitCompatibility(item, w));
      const best = matches.reduce((a, b) => (a.score >= b.score ? a : b));
      if (best.score >= COMPATIBILITY_THRESHOLD) {
        const base = manifest.allItems.find(it => it.id === best.outfitId);
        if (base) return { outfitItemId: base.id, outfitLabel: base.label, score: best.score, integrationMode: best.integrationMode };
      }
    }
    return null;
  };

  // Track which items already appear in the HAUL_OVERVIEW (all items do, as flatlay)
  // so we can avoid redundant isolated closeups when integration is available
  const appearsInOverview = new Set(manifest.allItems.map(it => it.id));

  // Track accessory→outfit matches for debug export
  const accessoryCompatibilityLog = new Map<string, Array<{ outfitId: string; score: number; reason: string; selected: boolean; integrationMode?: string }>>();
  manifest.accessoryItems.forEach(acc => {
    const matches = allWearables.map(w => {
      const m = scoreAccessoryOutfitCompatibility(acc, w);
      return { outfitId: w.id, score: m.score, reason: m.reason, selected: false, integrationMode: m.integrationMode };
    });
    accessoryCompatibilityLog.set(acc.id, matches);
  });

  // ── Ledger tracking ─────────────────────────────────────────
  const ledgerMap = new Map<string, HaulCoverageLedgerItem>(
    manifest.coveragePlan.ledger.map(l => [l.itemId, { ...l }]),
  );
  const addHeroShot = (itemId: string, shotKey: string) => {
    const l = ledgerMap.get(itemId);
    if (l) { l.plannedHeroShots++; l.shotIds.push(shotKey); }
  };
  const addIntegratedShot = (itemId: string, shotKey: string) => {
    const l = ledgerMap.get(itemId);
    if (l) { l.plannedIntegratedShots = (l.plannedIntegratedShots ?? 0) + 1; l.shotIds.push(shotKey); }
  };
  const addSupportShot = (itemId: string, shotKey: string) => {
    const l = ledgerMap.get(itemId);
    if (l) { l.plannedSupportShots++; l.shotIds.push(shotKey); }
  };

  // ═══════════════════════════════════════════════════════════
  // PHASE 1 — OBLIGATORY COVERAGE SLOTS
  // Every item the user uploaded gets a dedicated hero slot.
  // These slots are guaranteed BEFORE any narrative variety.
  // Items are sorted by category so the final sequence feels
  // natural: wearables → footwear → accessories → closeups.
  // ═══════════════════════════════════════════════════════════

  type PlannedShot = Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>;

  // Wearables: each gets exactly 1 hero try-on slot
  const tryOnQueue  = [...manifest.tryOnItems];
  const obligatoryTryOns: PlannedShot[] = [];
  tryOnQueue.forEach((item, idx) => {
    const isLast    = idx === tryOnQueue.length - 1;
    const pileState = derivePileState(idx, manifest.outfitItems.length);
    const shot = buildHaulTryOnShot(item, idx, manifest.outfitItems.length, isLast, pileState);
    obligatoryTryOns.push(shot);
    addHeroShot(item.id, shot.key);
  });
  const coveredByFirst = new Set(tryOnQueue.map(it => it.id));

  // Non-wearable items from the outfit slots — use styling graph + scorer for integration
  const footwearFromOutfits = manifest.footwearItems;
  const obligatoryFootwear: PlannedShot[] = footwearFromOutfits.map((item, fi) => {
    const combo = findCompatibleOutfitFor(item);
    if (combo) {
      const log = accessoryCompatibilityLog.get(item.id);
      if (log) { const e = log.find(m => m.outfitId === combo.outfitItemId); if (e) e.selected = true; }
    }
    const compatArg = combo ? { outfitItemId: combo.outfitItemId, outfitLabel: combo.outfitLabel } : null;
    const shot = buildHaulFootwearShot(item, fi, compatArg);
    addHeroShot(item.id, shot.key);
    if (combo) addIntegratedShot(combo.outfitItemId, shot.key);
    return shot;
  });

  // Accessories (from accesorioRefs slot): bags, jewelry, generic accessories
  const accessoryBags     = manifest.accessoryItems.filter(it => it.kind === 'bag');
  const accessoryJewelry  = manifest.accessoryItems.filter(it => it.kind === 'jewelry');
  const accessoryGeneric  = manifest.accessoryItems.filter(it => it.kind !== 'bag' && it.kind !== 'jewelry' && it.kind !== 'footwear');
  const accessoryFootwear = manifest.accessoryItems.filter(it => it.kind === 'footwear');

  const obligatoryBags: PlannedShot[] = accessoryBags.map((item, bi) => {
    const combo = findCompatibleOutfitFor(item);
    if (combo) {
      const log = accessoryCompatibilityLog.get(item.id);
      if (log) { const e = log.find(m => m.outfitId === combo.outfitItemId); if (e) e.selected = true; }
    }
    const compatArg = combo ? { outfitItemId: combo.outfitItemId, outfitLabel: combo.outfitLabel } : null;
    const shot = buildHaulBagShot(item, bi, compatArg);
    addHeroShot(item.id, shot.key);
    if (combo) addIntegratedShot(combo.outfitItemId, shot.key);
    return shot;
  });

  const obligatoryJewelry: PlannedShot[] = accessoryJewelry.map((item, ji) => {
    const combo = findCompatibleOutfitFor(item);
    if (combo) {
      const log = accessoryCompatibilityLog.get(item.id);
      if (log) { const e = log.find(m => m.outfitId === combo.outfitItemId); if (e) e.selected = true; }
    }
    const compatArg = combo ? { outfitItemId: combo.outfitItemId, outfitLabel: combo.outfitLabel } : null;
    const shot = buildHaulJewelryShot(item, ji, compatArg);
    addHeroShot(item.id, shot.key);
    if (combo) addIntegratedShot(combo.outfitItemId, shot.key);
    return shot;
  });

  const obligatoryAccFootwear: PlannedShot[] = accessoryFootwear.map((item, fi) => {
    const combo = findCompatibleOutfitFor(item);
    if (combo) {
      const log = accessoryCompatibilityLog.get(item.id);
      if (log) { const e = log.find(m => m.outfitId === combo.outfitItemId); if (e) e.selected = true; }
    }
    const compatArg = combo ? { outfitItemId: combo.outfitItemId, outfitLabel: combo.outfitLabel } : null;
    const shot = buildHaulFootwearShot(item, footwearFromOutfits.length + fi, compatArg);
    addHeroShot(item.id, shot.key);
    if (combo) addIntegratedShot(combo.outfitItemId, shot.key);
    return shot;
  });

  // Generic accessories: prefer integration when compatible, else closeup
  // Redundancy rule: if item already in overview AND has compatible outfit → integrate; skip isolated closeup
  const obligatoryGenericAcc: PlannedShot[] = accessoryGeneric.map((item, ai) => {
    const combo = findCompatibleOutfitFor(item);
    const alreadyInOverview = appearsInOverview.has(item.id);
    // If compatible outfit found AND item is not marked closeupRequested → integrate, no isolated closeup
    if (combo && (!item.closeupRequested || alreadyInOverview)) {
      const log = accessoryCompatibilityLog.get(item.id);
      if (log) { const e = log.find(m => m.outfitId === combo.outfitItemId); if (e) e.selected = true; }
      const shot = buildHaulAccessoryCloseupShot(item, ai); // still builds a shot, builder uses combo in prompt
      addHeroShot(item.id, shot.key);
      addIntegratedShot(combo.outfitItemId, shot.key);
      return shot;
    }
    const shot = buildHaulAccessoryCloseupShot(item, ai);
    addHeroShot(item.id, shot.key);
    return shot;
  });

  // Export accessoryCompatibilityLog to manifest for debug access
  (manifest as any)._accessoryCompatibilityLog = Object.fromEntries(accessoryCompatibilityLog);

  // Total obligatory slots (guaranteed in final plan)
  const obligatorySlots: PlannedShot[] = [
    ...obligatoryTryOns,
    ...obligatoryFootwear,
    ...obligatoryAccFootwear,
    ...obligatoryBags,
    ...obligatoryJewelry,
    ...obligatoryGenericAcc,
  ];
  const obligatoryCount = obligatorySlots.length;

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 — NARRATIVE BUDGET
  // Remaining slots after obligatory coverage are distributed
  // between: overview (1), variety (adjusting/styled), recap (1).
  // Budget degrades gracefully: recap first to drop, then variety.
  // ═══════════════════════════════════════════════════════════
  const narrativeBudget = Math.max(0, total - obligatoryCount);

  const narrativeShots: PlannedShot[] = [];

  // Overview — always first if we have any budget
  if (narrativeBudget >= 1) {
    const overview = buildHaulOverviewShot(manifest);
    narrativeShots.push(overview);
    // overview is support-only — not hero coverage for any item
    manifest.outfitItems.forEach(it => addSupportShot(it.id, overview.key));
  }

  // Variety slots: adjusting / styled (only after all items have 1 hero shot)
  // Anti-overexposure rule: never assign a 2nd+ shot to an outfit if any required item
  // (accessory, footwear, bag, jewelry) is still uncovered in the ledger at this point.
  const varietyBudgetRaw = narrativeBudget - 1; // -1 for overview
  const wantRecap = tryOnQueue.length >= 2 && varietyBudgetRaw >= 2;
  const varietyBudget = wantRecap ? Math.max(0, varietyBudgetRaw - 1) : varietyBudgetRaw;

  if (coveredByFirst.size === tryOnQueue.length && varietyBudget > 0) {
    const varietyCandidates = [...manifest.tryOnItems];
    let varietyIdx = 0;
    let varietySlotsUsed = 0;
    let tryOnIndexForVariety = obligatoryTryOns.length;

    while (varietySlotsUsed < varietyBudget && varietyCandidates.length > 0) {
      const item      = varietyCandidates[varietyIdx % varietyCandidates.length];
      const pileState = derivePileState(manifest.tryOnItems.indexOf(item), manifest.outfitItems.length);
      const heroCount = ledgerMap.get(item.id)?.plannedHeroShots ?? 0;

      if (heroCount < 2) {
        // Anti-overexposure: check if any required non-wearable item is still uncovered
        // If so, skip this variety slot — non-wearables have priority over outfit extras.
        const hasUncoveredRequired = manifest.allItems.some(it => {
          if (it.priority !== 'required') return false;
          const wearableKinds: HaulResolvedKind[] = ['full_outfit', 'top', 'bottom', 'dress', 'onepiece', 'outerwear', 'hosiery', 'mixed_set'];
          if (wearableKinds.includes(it.resolvedKind)) return false; // wearables already have their try-on
          const l = ledgerMap.get(it.id);
          return !l || l.plannedHeroShots === 0;
        });
        if (!hasUncoveredRequired) {
          const useAdjusting = tryOnIndexForVariety % 2 === 0;
          const varShot = useAdjusting
            ? buildHaulAdjustingShot(item, manifest.tryOnItems.indexOf(item), pileState)
            : buildHaulStyledResultShot(item, manifest.tryOnItems.indexOf(item), pileState);
          narrativeShots.push(varShot);
          addHeroShot(item.id, varShot.key);
          varietySlotsUsed++;
          tryOnIndexForVariety++;
        }
      }
      varietyIdx++;
      if (varietyIdx >= varietyCandidates.length * 2) break;
    }
  }

  // Recap — only if budget remains and there are multiple outfits
  if (wantRecap) {
    narrativeShots.push(buildHaulRecapShot(manifest));
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 3 — INTERLEAVE INTO FINAL SEQUENCE
  // Order: overview → [try-on, optional variety, optional accessory] × N → recap
  // Non-wearable items are spread evenly through the middle, not appended at the end.
  // This guarantees all items appear even if the plan exceeds total (we truncate fairly).
  // ═══════════════════════════════════════════════════════════

  const nonWearableObligatory = [
    ...obligatoryFootwear,
    ...obligatoryAccFootwear,
    ...obligatoryBags,
    ...obligatoryJewelry,
    ...obligatoryGenericAcc,
  ];

  const finalShots: PlannedShot[] = [];

  // 1. Overview first
  const overviewShot = narrativeShots.find(s => s.key === 'HAUL_OVERVIEW');
  if (overviewShot) finalShots.push(overviewShot);

  // 2. Interleave try-ons + variety with non-wearable items spread across the middle
  const tryOnBlock = narrativeShots.filter(s =>
    s.key !== 'HAUL_OVERVIEW' && s.key !== 'HAUL_RECAP',
  );
  // Include all obligatory try-on shots
  const allTryOnLike = [...obligatoryTryOns, ...tryOnBlock];

  // Spread non-wearables evenly across try-on positions
  const spreadInterval = nonWearableObligatory.length > 0
    ? Math.max(1, Math.floor(allTryOnLike.length / (nonWearableObligatory.length + 1)))
    : Infinity;

  let nwIdx = 0;
  allTryOnLike.forEach((s, i) => {
    finalShots.push(s);
    // Insert a non-wearable every spreadInterval positions
    if (nwIdx < nonWearableObligatory.length && (i + 1) % spreadInterval === 0) {
      finalShots.push(nonWearableObligatory[nwIdx++]);
    }
  });
  // Any remaining non-wearables that weren't interleaved yet
  while (nwIdx < nonWearableObligatory.length) {
    finalShots.push(nonWearableObligatory[nwIdx++]);
  }

  // 3. Recap last
  const recapShot = narrativeShots.find(s => s.key === 'HAUL_RECAP');
  if (recapShot) finalShots.push(recapShot);

  // ═══════════════════════════════════════════════════════════
  // PHASE 4 — TRUNCATION (only if strictly necessary)
  // If obligatory shots alone exceed the budget, drop narrative
  // variety first (adjusting, styled, recap, overview), never
  // drop obligatory hero shots for user-uploaded items.
  // ═══════════════════════════════════════════════════════════
  let result: PlannedShot[];

  if (finalShots.length <= total) {
    result = finalShots;
  } else {
    // More obligatory than budget — keep as many obligatory as possible,
    // prioritizing wearable try-ons, then non-wearables in order.
    // Drop narrative variety (non-obligatory) first.
    const obligatoryKeys = new Set(obligatorySlots.map(s => s.key));
    const mandatory  = finalShots.filter(s => obligatoryKeys.has(s.key));
    const narrative  = finalShots.filter(s => !obligatoryKeys.has(s.key));

    if (mandatory.length <= total) {
      // Fit as many narrative shots as possible
      result = [...mandatory, ...narrative].slice(0, total);
    } else {
      // Even mandatory exceeds budget — take try-ons first, then accessories
      const tryOnKeys = new Set(obligatoryTryOns.map(s => s.key));
      const tryOnOnly = mandatory.filter(s => tryOnKeys.has(s.key));
      const accOnly   = mandatory.filter(s => !tryOnKeys.has(s.key));
      result = [...tryOnOnly, ...accOnly].slice(0, total);

      // Mark overflow in ledger for debug honesty
      const droppedKeys = new Set(
        [...tryOnOnly, ...accOnly].slice(total).map(s => s.key),
      );
      ledgerMap.forEach((entry) => {
        if (entry.shotIds.some(k => droppedKeys.has(k))) {
          entry.plannedHeroShots = Math.max(0, entry.plannedHeroShots - 1);
        }
      });
    }
  }

  // ── Actualizar ledger con status final ─────────────────────
  ledgerMap.forEach((entry, itemId) => {
    const hasHero       = entry.plannedHeroShots > 0;
    const hasIntegrated = (entry.plannedIntegratedShots ?? 0) > 0;
    const hasSupport    = entry.plannedSupportShots > 0;

    if (!hasHero && !hasIntegrated && !hasSupport) {
      entry.coverageStatus = 'uncovered';
    } else if (!hasHero && hasIntegrated) {
      // Accessories/footwear/jewelry that appear integrated in another item's shot
      entry.coverageStatus = 'integrated';
    } else if (!hasHero && hasSupport) {
      entry.coverageStatus = 'support_only';
    } else if (entry.required && entry.plannedHeroShots >= 3) {
      entry.coverageStatus = 'overexposed';
    } else {
      entry.coverageStatus = 'covered';
    }

    // Fidelity note: para look_completo con outfitComponents, indica qué tan completo
    // puede ser la cobertura visual (basado solo en plan — se actualiza con shots reales en Module)
    const item = manifest.allItems.find(it => it.id === itemId);
    if (item?.outfitComponents && entry.coverageStatus === 'covered') {
      const comps = item.outfitComponents;
      const hasComplexLook = comps.hasFootwear || comps.hasHosiery || comps.hasBag || comps.hasJewelry;
      entry.fidelityLevel = hasComplexLook ? 'full' : 'full';
      entry.fidelityNote = hasComplexLook
        ? `Look completo con ${comps.componentsSummary} — requires full multi-piece fidelity in try-on shot`
        : `Basic look — top/bottom fidelity required`;
    } else if (entry.coverageStatus === 'covered' || entry.coverageStatus === 'integrated') {
      entry.fidelityLevel = 'full';
      if (entry.coverageStatus === 'integrated') {
        entry.fidelityNote = 'Item appears integrated in a compatible styled look — counts as covered';
      }
    } else if (entry.coverageStatus === 'support_only') {
      entry.fidelityLevel = 'partial';
      entry.fidelityNote = 'Item only in support/background shots — no dedicated on-body hero shot';
    } else {
      entry.fidelityLevel = 'none';
      entry.fidelityNote = 'Item never appeared in plan';
    }

    const idx = manifest.coveragePlan.ledger.findIndex(l => l.itemId === itemId);
    if (idx >= 0) manifest.coveragePlan.ledger[idx] = entry;
    manifest.coveragePlan.plannedCoverage[itemId] = entry.plannedHeroShots + (entry.plannedIntegratedShots ?? 0) + entry.plannedSupportShots;
  });

  // Calcular warnings — support_only escalated to uncovered for wearables (need body hero shot)
  // 'integrated' counts as covered for accessories/footwear/jewelry
  const requiredIds = manifest.allItems.filter(it => it.priority === 'required').map(it => it.id);
  const wearableKindsConst: HaulResolvedKind[] = ['full_outfit', 'top', 'bottom', 'dress', 'onepiece', 'outerwear', 'hosiery', 'mixed_set'];
  manifest.coveragePlan.uncoveredRequiredItems = requiredIds.filter(id => {
    const l = ledgerMap.get(id);
    if (!l || l.coverageStatus === 'uncovered') return true;
    // Wearable items must have a dedicated on-body hero shot — support_only doesn't count
    const item = manifest.allItems.find(it => it.id === id);
    if (item && wearableKindsConst.includes(item.resolvedKind) && l.coverageStatus === 'support_only') return true;
    // 'integrated' is acceptable coverage for non-wearables
    return false;
  });
  manifest.coveragePlan.supportOnlyItems = requiredIds.filter(id => {
    const l = ledgerMap.get(id);
    if (l?.coverageStatus !== 'support_only') return false;
    const item = manifest.allItems.find(it => it.id === id);
    if (item && wearableKindsConst.includes(item.resolvedKind)) return false; // escalated above
    return true;
  });
  manifest.coveragePlan.overexposedItems = Array.from(ledgerMap.values())
    .filter(l => l.coverageStatus === 'overexposed').map(l => l.itemId);
  manifest.coveragePlan.missingCoverage = manifest.coveragePlan.uncoveredRequiredItems;

  const overflowWarning = obligatoryCount > total
    ? [`BUDGET_OVERFLOW: ${manifest.allItems.length} items uploaded but only ${total} shots requested — some items may share slots or have reduced coverage. Increase shot count for full coverage.`]
    : [];
  manifest.coveragePlan.coverageWarnings = [
    ...overflowWarning,
    ...manifest.coveragePlan.uncoveredRequiredItems.map(id => `UNCOVERED: ${ledgerMap.get(id)?.label ?? id}`),
    ...manifest.coveragePlan.supportOnlyItems.map(id => `SUPPORT_ONLY: ${ledgerMap.get(id)?.label ?? id}`),
    ...manifest.coveragePlan.overexposedItems.map(id => `OVEREXPOSED: ${ledgerMap.get(id)?.label ?? id}`),
  ];

  return result;
}

// ── Coverage post-generación ──────────────────────────────────
// Calcula coverage REAL basado en qué shots fueron generados con status 'ok'.
// Un ítem solo está cubierto si tiene al menos 1 shot hero generado con status ok.
// Llama esto DESPUÉS de que todos los shots terminen — no antes.
export function computeFinalHaulCoverageFromShots(
  manifest: HaulManifest,
  plannedShots: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[],
  debugShots: { key?: string; status: 'ok' | 'failed'; coverageRole?: HaulCoverageRole; primaryItemId?: string }[],
): {
  ledger:                 HaulCoverageLedgerItem[];
  uncoveredRequiredItems: string[];
  failedCoverageItems:    string[];
  supportOnlyItems:       string[];
  overexposedItems:       string[];
  coverageWarnings:       string[];
  isComplete:             boolean;
  blockingIssues:         string[];
  requiredItemCount:      number;
  coveredRequiredItemCount: number;
  failedRequiredItemCount:  number;
} {
  // Build maps: shotKey → result, shotKey → primaryItemId (para detectar routing real)
  const shotResultByKey    = new Map<string, 'ok' | 'failed'>();
  const shotPrimaryItemMap = new Map<string, string | undefined>();
  debugShots.forEach(ds => {
    if (ds.key) {
      shotResultByKey.set(ds.key, ds.status);
      shotPrimaryItemMap.set(ds.key, ds.primaryItemId);
    }
  });

  // Hero shots by item: shotKey → itemId mapping from planned shots
  const heroShotToItem = new Map<string, string>();
  manifest.allItems.forEach(item => {
    const ledgerEntry = manifest.coveragePlan.ledger.find(l => l.itemId === item.id);
    if (ledgerEntry) {
      ledgerEntry.shotIds.forEach(shotKey => {
        heroShotToItem.set(shotKey, item.id);
      });
    }
  });

  // Recalculate ledger from actual generated results
  const finalLedger: HaulCoverageLedgerItem[] = manifest.coveragePlan.ledger.map(l => {
    const heroShotIds      = l.shotIds;
    const actualOkHero     = heroShotIds.filter(sk => shotResultByKey.get(sk) === 'ok').length;
    const actualFailedHero = heroShotIds.filter(sk => shotResultByKey.get(sk) === 'failed').length;

    // actualRoutedHeroRefs: shots ok donde primaryItemId coincide con este item.
    // Esto distingue "shot existió" de "ref del item llegó al modelo".
    const actualRoutedHeroRefs = heroShotIds.filter(sk =>
      shotResultByKey.get(sk) === 'ok' && shotPrimaryItemMap.get(sk) === l.itemId,
    ).length;

    // actualIntegratedOk: shots ok donde este item aparece como integrado (no es el primaryItemId,
    // pero el shot fue generado ok y el item fue planeado como integrado).
    // Aplica a accesorios/joyería/calzado que están en un combo con un outfit.
    const isIntegratedItem = (l.plannedIntegratedShots ?? 0) > 0 && l.plannedHeroShots === 0;
    const actualIntegratedOk = isIntegratedItem
      ? heroShotIds.filter(sk => shotResultByKey.get(sk) === 'ok').length
      : 0;

    const item = manifest.allItems.find(it => it.id === l.itemId);
    const wearableKindsLocal: HaulResolvedKind[] = ['full_outfit', 'top', 'bottom', 'dress', 'onepiece', 'outerwear', 'hosiery', 'mixed_set'];
    const isWearable = item ? wearableKindsLocal.includes(item.resolvedKind) : false;

    let coverageStatus: HaulCoverageLedgerItem['coverageStatus'];
    if (isIntegratedItem && actualIntegratedOk > 0) {
      // Accessory/footwear/jewelry planned as integrated — shot generated ok
      coverageStatus = 'integrated';
    } else if (isIntegratedItem && actualFailedHero > 0) {
      // Planned integrated but the host shot failed
      coverageStatus = 'uncovered';
    } else if (actualOkHero === 0 && actualFailedHero > 0) {
      // Todos los hero shots fallaron (content policy o network)
      coverageStatus = 'uncovered';
    } else if (actualOkHero > 0 && actualRoutedHeroRefs === 0 && !isIntegratedItem) {
      // Shot generado pero sin ref primaria routeada — cobertura nominal, no real
      coverageStatus = 'planned_not_routed';
    } else if (actualRoutedHeroRefs === 0 && l.plannedSupportShots > 0) {
      coverageStatus = isWearable ? 'uncovered' : 'support_only';
    } else if (actualRoutedHeroRefs === 0) {
      coverageStatus = 'uncovered';
    } else if (l.required && actualRoutedHeroRefs >= 3) {
      coverageStatus = 'overexposed';
    } else {
      coverageStatus = 'covered';
    }

    return {
      ...l,
      actualPromptedHeroShots:    actualOkHero,
      actualPromptedSupportShots: l.actualPromptedSupportShots,
      actualRoutedHeroRefs:       isIntegratedItem ? actualIntegratedOk : actualRoutedHeroRefs,
      coverageStatus,
    };
  });

  const requiredItems = manifest.allItems.filter(it => it.priority === 'required');
  const wearableKinds: HaulResolvedKind[] = ['full_outfit', 'top', 'bottom', 'dress', 'onepiece', 'outerwear', 'hosiery', 'mixed_set'];

  const uncoveredRequiredItems = requiredItems
    .filter(it => {
      const l = finalLedger.find(x => x.itemId === it.id);
      if (!l) return true;
      if (l.coverageStatus === 'uncovered') return true;
      if (l.coverageStatus === 'planned_not_routed') return true;  // ref nunca llegó al modelo
      if (wearableKinds.includes(it.resolvedKind) && l.coverageStatus === 'support_only') return true;
      return false;
    })
    .map(it => it.id);

  const failedCoverageItems = requiredItems
    .filter(it => {
      const l = finalLedger.find(x => x.itemId === it.id);
      if (!l) return false;
      // Item has planned hero shots but ALL of them failed (content policy / network)
      return l.plannedHeroShots > 0 && l.actualPromptedHeroShots === 0;
    })
    .map(it => it.id);

  // planned_not_routed: shot generado ok pero sin ref primaria routeada
  const plannedNotRoutedItems = finalLedger
    .filter(l => l.coverageStatus === 'planned_not_routed' && l.required)
    .map(l => l.itemId);

  const supportOnlyItems = finalLedger
    .filter(l => l.coverageStatus === 'support_only' && l.required)
    .filter(l => {
      const item = manifest.allItems.find(it => it.id === l.itemId);
      return item && !wearableKinds.includes(item.resolvedKind);
    })
    .map(l => l.itemId);

  const overexposedItems = finalLedger
    .filter(l => l.coverageStatus === 'overexposed')
    .map(l => l.itemId);

  // Build blockingIssues from failed coverage
  const blockingIssues: string[] = [];
  failedCoverageItems.forEach(itemId => {
    const item = manifest.allItems.find(it => it.id === itemId);
    const l = finalLedger.find(x => x.itemId === itemId);
    const failedShots = (l?.shotIds ?? []).filter(sk => shotResultByKey.get(sk) === 'failed');
    if (failedShots.length > 0) {
      blockingIssues.push(
        `required item ${itemId} (${item?.label ?? itemId}) failed visual coverage because ${failedShots.join(', ')} failed`,
      );
    }
  });
  plannedNotRoutedItems.forEach(itemId => {
    const item = manifest.allItems.find(it => it.id === itemId);
    blockingIssues.push(
      `required item ${itemId} (${item?.label ?? itemId}) was shot but primary ref was not routed to the model — ref may have been missing or misclassified`,
    );
  });
  uncoveredRequiredItems
    .filter(id => !failedCoverageItems.includes(id) && !plannedNotRoutedItems.includes(id))
    .forEach(id => {
      const item = manifest.allItems.find(it => it.id === id);
      blockingIssues.push(`required item ${id} (${item?.label ?? id}) has no planned hero shot`);
    });

  const coverageWarnings: string[] = [
    ...uncoveredRequiredItems.map(id => `UNCOVERED: ${finalLedger.find(l => l.itemId === id)?.label ?? id}`),
    ...failedCoverageItems.map(id => `FAILED_HERO: ${finalLedger.find(l => l.itemId === id)?.label ?? id}`),
    ...plannedNotRoutedItems.map(id => `PLANNED_NOT_ROUTED: ${finalLedger.find(l => l.itemId === id)?.label ?? id}`),
    ...supportOnlyItems.map(id => `SUPPORT_ONLY: ${finalLedger.find(l => l.itemId === id)?.label ?? id}`),
    ...overexposedItems.map(id => `OVEREXPOSED: ${finalLedger.find(l => l.itemId === id)?.label ?? id}`),
  ];

  const coveredRequiredItemCount = requiredItems.filter(it => {
    const l = finalLedger.find(x => x.itemId === it.id);
    return l?.coverageStatus === 'covered' || l?.coverageStatus === 'overexposed' || l?.coverageStatus === 'integrated';
  }).length;

  return {
    ledger:                   finalLedger,
    uncoveredRequiredItems,
    failedCoverageItems,
    supportOnlyItems,
    overexposedItems,
    coverageWarnings,
    isComplete:               uncoveredRequiredItems.length === 0 && failedCoverageItems.length === 0 && plannedNotRoutedItems.length === 0,
    blockingIssues,
    requiredItemCount:        requiredItems.length,
    coveredRequiredItemCount,
    failedRequiredItemCount:  failedCoverageItems.length,
  };
}

// ── Helpers de estado de pila ─────────────────────────────────

function derivePileState(tryOnIndex: number, totalOutfits: number): HaulPileState {
  if (totalOutfits <= 1 || tryOnIndex === 0) return 'clean';
  const ratio = tryOnIndex / totalOutfits;
  if (ratio < 0.35) return 'light_pile';
  if (ratio < 0.70) return 'medium_pile';
  return 'messy_but_believable';
}

function pileStateDesc(state: HaulPileState, count: number): string {
  if (state === 'clean') return 'SCENE STATE — EARLY: Space is tidy. This is the first try-on. Maximum 1 plain bag or closed box visible. No clothing piles.';
  if (state === 'light_pile') return `SCENE STATE — LIGHTLY USED: ${count === 1 ? 'One' : String(count)} haul item(s) from the uploaded set are set aside on the bed or chair. Plain packaging only — no logos. Room is still organized.`;
  if (state === 'medium_pile') return `SCENE STATE — ORGANIZED HAUL: ${count} haul pieces from the uploaded set are naturally arranged in background — tried items on bed or draped on chair. Plain boxes/bags if any. Still tidy enough to feel intentional. Maximum 2 plain unbranded bags or boxes visible.`;
  // messy_but_believable: keep controlled — NEVER invent extra clothing or branded packaging
  return `SCENE STATE — ACTIVE HAUL: Several haul items from the uploaded set are visible in background — tried, folded, draped. Room feels used but not chaotic. STRICT: only items from this actual haul appear in background. Maximum 2 plain unbranded bags or boxes. No invented clothing. No branded packaging.`;
}

// ── Shot builders ─────────────────────────────────────────────

function buildHaulOverviewShot(
  manifest: HaulManifest,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const itemCount  = manifest.outfitItems.length;
  const hasAccs    = manifest.accessoryItems.length > 0;
  const allItemIds = manifest.allItems.map(it => it.id);
  return {
    key:    'HAUL_OVERVIEW',
    beat:   'context',
    role:   'HAUL OVERVIEW',
    purpose: `Opening shot: all (or most) haul items visible as a collection — on a bed, rack, chair, floor, bags, or boxes. ${itemCount} garments${hasAccs ? ' + accessories' : ''} visible. The person may be partially visible arranging pieces or selecting something. Communicates "this is everything I got." NOT a studio catalog.`,
    requiredElements:  ['haul_items_visible_as_collection', 'real_room_context', 'organic_not_catalog_arrangement'],
    forbiddenElements: ['white_background', 'studio_lighting', 'catalog_grid', 'full_body_catalog_pose', 'forced_symmetry', 'editorial_polish', 'invented_clothing_not_in_haul', 'extra_furniture_not_in_ref0'],
    variationSpace: [
      `flat lay of all ${itemCount} garments on bed — imperfect arrangement, slightly overlapping, real sheets visible`,
      `pieces hanging on rack or draped over chair, hands partially visible adjusting the last piece`,
      `overhead shot of garments spread on floor or bed, accessories scattered nearby`,
      `person holding several pieces up toward camera, multiple items visible, natural haul energy`,
    ],
    framing:     'WIDE_OR_OVERHEAD',
    composition: 'HAUL_COLLECTION_VISIBLE',
    cameraAngle: 'OVERHEAD_OR_EYE_LEVEL',
    hpiAllowed:  false,
    wearState:   'not_wearing_final_outfit',
    cameraMode:  'object_flatlay',
    haulItemPlan: {
      primaryItems:    allItemIds,
      wornItems:       [],
      heldItems:       [],
      surfaceItems:    allItemIds,
      backgroundItems: [],
      forbiddenItems:  [],
      supportBaseLook: false,
      integrationNote: 'All uploaded haul items visible as a collection — person NOT wearing any of them yet',
    },
  };
}

function buildHaulTryOnShot(
  item:          HaulItem,
  tryOnIndex:    number,
  totalOutfits:  number,
  isLast:        boolean,
  pileState:     HaulPileState,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const pileCount = tryOnIndex;
  const pileNote  = pileStateDesc(pileState, pileCount);
  const shotNum   = tryOnIndex + 1;

  if (isLast) {
    return {
      key:    'HAUL_SELECTION',
      beat:   'emotion',
      role:   `HAUL SELECTION — ${item.label}`,
      purpose: `The person wearing one of their favorite pieces from the haul. ${pileNote} Natural expression — not "winning" necessarily, just genuinely wearing it. The haul energy is winding down. Full body or medium shot. The garment reads clearly. NOT a catalog pose. NOT forced "winner" energy.`,
      requiredElements:  ['avatar_wearing_item', 'garment_clearly_readable', 'natural_relaxed_expression'],
      forbiddenElements: ['catalog_stance', 'studio_backdrop', 'white_background', 'mannequin_pose', 'beautification', 'ad_composition', 'editorial_lighting', 'forced_winner_pose', 'avatar_base_clothing_as_haul_item'],
      variationSpace: [
        `full body wearing ${item.label}, haul pile visible in background, relaxed natural posture`,
        `medium shot wearing ${item.label}, genuine expression, background shows haul context`,
        `mirror selfie wearing ${item.label}, haul space reflected behind`,
        `person holding or adjusting ${item.label}, candid haul moment`,
      ],
      framing:     'WIDE_FULL_BODY',
      composition: 'SELECTION_WITH_HAUL_BACKGROUND',
      cameraAngle: 'EYE_LEVEL',
      hpiAllowed:  true,
      hpiScope:    'full',
      wearState:   'wearing_full_outfit',
      cameraMode:  'third_person',
      haulItemPlan: {
        primaryItems:    [item.id],
        wornItems:       [item.id],
        heldItems:       [],
        surfaceItems:    [],
        backgroundItems: [],
        forbiddenItems:  [],
        supportBaseLook: false,
        integrationNote: `Person wearing ${item.label} — avatar base clothing must NOT appear as a haul product`,
      },
    };
  }

  // Variaciones por tipo de prenda
  const kindVariations: Record<string, string[]> = {
    outfit_set: [
      `full body wearing the complete ${item.label} look — natural standing posture, real room behind, outfit reads clearly`,
      `medium shot wearing ${item.label} — expression of "what do I think?", weight slightly to one side, real room`,
      `half-turn showing the side or back of the ${item.label} outfit — candid, not posed`,
      `mirror selfie in ${item.label} — natural composition, haul space reflected, phone held naturally`,
    ],
    garment: [
      `full body wearing ${item.label}, candid — checking fit, looking down at hem or sleeve, real room behind`,
      `medium shot wearing ${item.label}, one hand adjusting waist or sleeve, expression curious-evaluating`,
      `half-turn or side profile wearing ${item.label} — showing drape or silhouette, natural light`,
      `close-medium: upper body wearing ${item.label}, slight chin tilt, genuine expression, not performing for camera`,
    ],
    vestido: [
      `full body wearing the ${item.label} — natural posture, hem line visible, real room behind`,
      `spinning or mid-turn in ${item.label} — fabric movement, candid energy`,
      `medium shot in ${item.label}, hand lightly on hip or touching hem, expression genuine`,
      `mirror selfie in ${item.label} — full body visible in reflection, haul context behind`,
    ],
    chaqueta: [
      `putting on ${item.label} — jacket mid-shrug, shoulders being settled, hands at lapels`,
      `wearing ${item.label} open over another piece — relaxed, hands in pockets or by side`,
      `close-up of lapel or collar of ${item.label} — fabric detail, fingers adjusting it`,
      `full body in ${item.label}, evaluating — slight weight shift, real room behind`,
    ],
    enterizo: [
      `full body in ${item.label} — natural standing posture, real room behind, seam and fit visible`,
      `medium shot in ${item.label} — hand adjusting neckline or strap, candid expression`,
      `half-turn showing the back of ${item.label} — detail of closure or cut`,
      `sitting on bed edge in ${item.label} — relaxed, genuine expression, haul context around`,
    ],
    top: [
      `medium-close shot wearing ${item.label} — front detail readable, slight hand on hip or tucking into pants`,
      `full body with ${item.label} tucked or paired naturally — showing top in context`,
      `close: hands adjusting hem or neckline of ${item.label}, candid`,
      `medium shot — slight profile showing the cut of ${item.label}, natural light from window`,
    ],
    bottom: [
      `full body wearing ${item.label} — silhouette and length readable, natural posture, real room behind`,
      `medium-low shot emphasizing ${item.label} — top of body cropped or blurred, pants/skirt as focus`,
      `hands adjusting waist or hem of ${item.label} — evaluating fit, candid`,
      `half-turn showing the back and fall of ${item.label}, candid`,
    ],
    pantys: [
      `${item.label} worn as styling layer — full body visible, rest of outfit in context`,
      `leg-level or low-medium shot highlighting ${item.label} — real skin, real light`,
      `close of hand pulling up or adjusting ${item.label} — honest styling moment`,
      `seated on bed showing ${item.label} detail at leg level — real room background`,
    ],
  };

  const kindKey = item.manualKind !== 'auto' ? item.manualKind : item.kind;
  const kindVariationKey =
    kindKey === 'look_completo' ? 'outfit_set'
    : kindKey === 'vestido'  ? 'vestido'
    : kindKey === 'chaqueta' ? 'chaqueta'
    : kindKey === 'enterizo' ? 'enterizo'
    : kindKey === 'top'      ? 'top'
    : kindKey === 'bottom'   ? 'bottom'
    : kindKey === 'pantys'   ? 'pantys'
    : 'garment';

  const variations = kindVariations[kindVariationKey] ?? kindVariations.garment;

  // Enriquecer purpose y requiredElements para look_completo con outfitComponents
  const comps = item.outfitComponents;
  const componentsPurposeSuffix = comps
    ? ` COMPONENT CONTRACT: ${comps.componentsSummary} All listed pieces must be simultaneously visible and faithful in this shot.`
    : '';
  const componentsRequired: string[] = comps ? [
    ...(comps.hasTop       ? ['top_piece_visible_and_faithful']     : []),
    ...(comps.hasBottom    ? ['bottom_piece_visible_length_readable'] : []),
    ...(comps.hasDress     ? ['dress_full_silhouette_hem_to_shoulder'] : []),
    ...(comps.hasFootwear  ? ['footwear_on_both_feet_consistently']  : []),
    ...(comps.hasHosiery   ? ['hosiery_visible_on_both_legs']        : []),
    ...(comps.hasBag       ? ['bag_visible_worn_or_held']            : []),
    ...(comps.hasJewelry   ? ['jewelry_visible_worn_naturally']      : []),
  ] : [];

  return {
    key:    `HAUL_TRY_ON_${shotNum}`,
    beat:   'action',
    role:   `TRY-ON ${shotNum}/${totalOutfits} — ${item.label}`,
    purpose: `The person wearing ${item.label} (garment ${shotNum} of ${totalOutfits}). ${pileNote} Natural attitude — trying it on, evaluating, moving. NOT a catalog pose. Real room visible. iPhone UGC feel.${componentsPurposeSuffix}`,
    requiredElements:  [
      'avatar_wearing_item',
      'garment_clearly_visible_and_readable',
      'real_environment_visible',
      'natural_try_on_attitude',
      'no_catalog_pose',
      ...componentsRequired,
    ],
    forbiddenElements: ['catalog_stance', 'studio_backdrop', 'white_background', 'mannequin_pose', 'beautification', 'ad_composition', 'editorial_lighting', 'high_fashion_look', 'avatar_base_clothing_worn_as_haul_product'],
    variationSpace:    variations,
    framing:     'MEDIUM_OR_WIDE',
    composition: 'TRY_ON_IN_REAL_CONTEXT',
    cameraAngle: 'EYE_LEVEL',
    hpiAllowed:  true,
    hpiScope:    'full',
    wearState:   'wearing_full_outfit',
    cameraMode:  'third_person',
    haulItemPlan: {
      primaryItems:    [item.id],
      wornItems:       [item.id],
      heldItems:       [],
      surfaceItems:    [],
      backgroundItems: [],
      forbiddenItems:  [],
      supportBaseLook: false,
      integrationNote: `Person wearing ${item.label} as primary haul item — ropa visible en avatar ref NO es producto del haul`,
    },
  };
}

function buildHaulAdjustingShot(
  item:       HaulItem,
  itemIndex:  number,
  pileState:  HaulPileState,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  return {
    key:    `HAUL_ADJUSTING_${itemIndex + 1}`,
    beat:   'action',
    role:   `ADJUSTING — ${item.label}`,
    purpose: `Micro-moment: the person adjusting, fiddling with, or evaluating ${item.label} — straightening a collar, pulling a hem, checking a sleeve. Very UGC, very real. Hands active. NOT a full-body catalog pose.`,
    requiredElements:  ['hands_active_on_garment', 'natural_micro_gesture', 'real_room_context'],
    forbiddenElements: ['full_body_catalog_stance', 'studio_backdrop', 'posed_looking_at_camera', 'editorial_lighting'],
    variationSpace: [
      `close-up of hands adjusting collar or neckline of ${item.label}`,
      `medium shot pulling hem or checking sleeve length, candid`,
      `person checking the fit in a surface — turning slightly, hands on waist`,
      `hands smoothing fabric of ${item.label}, texture visible, real light`,
    ],
    framing:     'MEDIUM_OR_CLOSE',
    composition: 'HANDS_ACTIVE_ON_GARMENT',
    cameraAngle: 'EYE_LEVEL_OR_SLIGHTLY_HIGH',
    hpiAllowed:  true,
    hpiScope:    'micro_action_only',
    wearState:   'wearing_full_outfit',
    cameraMode:  'third_person',
    haulItemPlan: {
      primaryItems:    [item.id],
      wornItems:       [item.id],
      heldItems:       [],
      surfaceItems:    [],
      backgroundItems: [],
      forbiddenItems:  [],
      supportBaseLook: false,
      integrationNote: `Adjusting ${item.label} — person wearing it, hands active on the garment`,
    },
  };
}

function buildHaulDetailGarmentShot(
  item:      HaulItem,
  itemIndex: number,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  return {
    key:    `HAUL_DETAIL_${itemIndex + 1}`,
    beat:   'detail',
    role:   `DETAIL — ${item.label}`,
    purpose: `Close-up detail of ${item.label} — fabric texture, label, stitching, cut, tag, or pattern. The garment fills most of the frame. Real room light. The person may hold it or it may be laid out. NOT a catalog product shot.`,
    requiredElements:  ['garment_detail_visible', 'real_light_and_texture', 'intimate_close_up_framing'],
    forbiddenElements: ['white_background', 'studio_lighting', 'catalog_product_shot', 'person_posing_full_body'],
    variationSpace: [
      `macro of fabric texture of ${item.label} — weave, pattern or material detail visible`,
      `close-up of label or tag of ${item.label} held between fingers`,
      `detail of seam, hem or cut of ${item.label} on a real surface`,
      `${item.label} laid on bed or draped over chair, close-up of distinctive feature`,
    ],
    framing:     'CLOSE_UP',
    composition: 'DETAIL_MACRO',
    cameraAngle: 'OVERHEAD_OR_SLIGHT_ANGLE',
    hpiAllowed:  false,
    wearState:   'not_wearing_final_outfit',
    cameraMode:  'detail_macro',
  };
}

function buildHaulAccessoryCloseupShot(
  item:       HaulItem,
  closeupIdx: number,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  return {
    key:    `HAUL_ACCESSORY_CLOSEUP_${closeupIdx + 1}`,
    beat:   'detail',
    role:   `ACCESSORY CLOSEUP — ${item.label}`,
    purpose: `Dedicated close-up of ${item.label}. Reproduce the accessory faithfully: same shape, color, material, hardware, design. Real light, real surface or body context. Do NOT fuse this accessory with other pieces. Do NOT change it into a different accessory type.`,
    requiredElements:  ['accessory_fills_frame', 'faithful_reproduction_of_design', 'real_light_and_texture'],
    forbiddenElements: ['white_studio_background', 'catalog_product_shot', 'fused_accessories', 'different_accessory_design', 'editorial_lighting'],
    variationSpace: [
      `macro of ${item.label} on a fabric surface — texture and detail clear, natural light`,
      `${item.label} held between fingers close to camera — real skin, real light`,
      `${item.label} being worn or put on — ear, wrist, neck or hand visible contextually`,
      `${item.label} resting on bed, bag or haul pile — design fully readable, real environment`,
    ],
    framing:     'CLOSE_UP_OR_MACRO',
    composition: 'ACCESSORY_DETAIL',
    cameraAngle: 'STRAIGHT_ON_OR_SLIGHT_ANGLE',
    hpiAllowed:  false,
    wearState:   'not_wearing_final_outfit',
    cameraMode:  'detail_macro',
    haulItemPlan: {
      primaryItems:    [item.id],
      wornItems:       [],
      heldItems:       [item.id],
      surfaceItems:    [item.id],
      backgroundItems: [],
      forbiddenItems:  [],
      supportBaseLook: true,
      integrationNote: `Close-up of ${item.label} — accessory as object, no full outfit context`,
    },
  };
}

function buildHaulFootwearShot(
  item:            HaulItem,
  footwearIdx:     number,
  compatibleCombo?: { outfitItemId: string; outfitLabel: string } | null,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const hasCompatible = !!compatibleCombo;
  const integrationNote = hasCompatible
    ? `${item.label} worn with ${compatibleCombo!.outfitLabel} — footwear and outfit appear together`
    : `${item.label} as standalone detail — NOT worn simultaneously AND NOT held simultaneously in the same shot`;

  const purpose = hasCompatible
    ? `${item.label} integrated with a compatible haul look (${compatibleCombo!.outfitLabel}). Foot-level or medium shot showing both pieces together. Footwear fits naturally with the outfit — no contradiction. Real room, real light. FOOTWEAR CONTRACT: shoe appears on BOTH feet, same design both sides, no boot fusing with leg/pants/skin.`
    : `${item.label} is a footwear item. Show it as: held near camera between both hands, placed on a bed or floor surface, or being tried on at foot level. The footwear is the protagonist. Real light, real surface. FOOTWEAR CONTRACT: if worn → on BOTH feet, same design, same leg integration. If held → NOT simultaneously worn. Never fuse boot shaft with pants or skin. Never show one leg different from the other.`;

  const variations = hasCompatible ? [
    `foot-level shot: ${item.label} worn with ${compatibleCombo!.outfitLabel} — both feet visible, consistent styling`,
    `medium shot — lower body showing ${item.label} with compatible haul look, real room`,
    `sitting on bed edge wearing ${item.label} with ${compatibleCombo!.outfitLabel} — legs and footwear in frame`,
    `close of feet wearing ${item.label} — floor visible, haul context around`,
  ] : [
    `${item.label} held between both hands near camera — NOT worn, real room in background`,
    `${item.label} placed on bed or floor next to haul pile — design and texture readable, natural light`,
    `foot-level shot: ${item.label} being put on — both feet, consistent, floor and room visible`,
    `close-up of ${item.label} on a real surface — design, hardware, sole readable`,
  ];

  return {
    key:    `HAUL_FOOTWEAR_${footwearIdx + 1}`,
    beat:   'detail',
    role:   `FOOTWEAR — ${item.label}`,
    purpose,
    requiredElements: hasCompatible
      ? ['footwear_worn_with_compatible_outfit', 'both_feet_consistent_design', 'real_light_and_texture']
      : ['footwear_clearly_visible', 'real_light_and_texture', 'intimate_or_detail_framing'],
    forbiddenElements: [
      'full_body_outfit_invented_from_shoe_alone',
      'studio_backdrop',
      'catalog_product_shot',
      'white_background',
      'editorial_lighting',
      'one_leg_different_from_other',
      'boot_shaft_fusing_with_pants_or_skin',
      'footwear_held_and_worn_simultaneously',
      'asymmetric_footwear_styling',
    ],
    variationSpace: variations,
    framing:     hasCompatible ? 'MEDIUM_OR_WIDE' : 'CLOSE_UP_OR_MEDIUM',
    composition: hasCompatible ? 'FOOTWEAR_WITH_COMPATIBLE_LOOK' : 'FOOTWEAR_DETAIL',
    cameraAngle: 'EYE_LEVEL_OR_SLIGHT_ANGLE',
    hpiAllowed:  false,
    wearState:   hasCompatible ? 'wearing_full_outfit' : 'not_wearing_final_outfit',
    cameraMode:  hasCompatible ? 'third_person' : 'detail_macro',
    haulItemPlan: {
      primaryItems:    [item.id],
      wornItems:       hasCompatible ? [item.id, compatibleCombo!.outfitItemId] : [],
      heldItems:       hasCompatible ? [] : [item.id],
      surfaceItems:    hasCompatible ? [] : [item.id],
      backgroundItems: [],
      forbiddenItems:  [],
      supportBaseLook: !hasCompatible,
      combinationId:   hasCompatible ? `combo_${compatibleCombo!.outfitItemId}` : undefined,
      integrationNote,
    },
  };
}

function buildHaulRecapShot(
  manifest: HaulManifest,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const allItemIds = manifest.allItems.map(it => it.id);
  return {
    key:    'HAUL_RECAP',
    beat:   'atmosphere',
    role:   'HAUL RECAP',
    purpose: `Closing shot of the haul. The person is wearing ONE of the haul looks already shown — NOT a new outfit, NOT avatar base clothing, NOT an invented outfit. They are surrounded by haul items they uploaded (on bed, chair, or floor). Relaxed, natural mood. Communicates "that was everything." iPhone UGC energy, not editorial.`,
    requiredElements:  ['person_wearing_one_of_the_haul_looks_already_shown', 'haul_items_visible_in_background', 'natural_relaxed_mood'],
    forbiddenElements: ['catalog_pose', 'studio_backdrop', 'editorial_lighting', 'forced_symmetry', 'ad_feel', 'avatar_base_clothing_as_haul_look', 'invented_new_outfit_never_shown'],
    variationSpace: [
      `person sitting or standing surrounded by haul items — items on bed/rack visible, relaxed smile`,
      `medium shot of person holding favorite piece(s), background shows the haul in progress`,
      `overhead view of person seated among haul items — camera above, everything visible around them`,
      `person looking at haul items spread out — evaluating, candid, end-of-session energy`,
    ],
    framing:     'WIDE_OR_MEDIUM',
    composition: 'PERSON_IN_HAUL_CONTEXT',
    cameraAngle: 'EYE_LEVEL_OR_OVERHEAD',
    hpiAllowed:  true,
    hpiScope:    'full',
    wearState:   'wearing_full_outfit',
    cameraMode:  'third_person',
    haulItemPlan: {
      primaryItems:    allItemIds,
      wornItems:       [],  // planner resolverá qué look se usa en el arc
      heldItems:       [],
      surfaceItems:    allItemIds,
      backgroundItems: allItemIds,
      forbiddenItems:  [],
      supportBaseLook: false,
      integrationNote: 'Recap: person wears a PREVIOUSLY SHOWN haul look — all haul items visible in background',
    },
  };
}

// ── Haul: Setup shot (selección / organización de prendas) ───

function buildHaulSetupShot(
  item:      HaulItem,
  setupIdx:  number,
  itemIndex: number,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const shotVariations = [
    `organizing haul items on the bed — hands active, comparing ${item.label} with another piece, casual bedroom light`,
    `taking ${item.label} out of a bag or box — discovery moment, hands visible, natural haul energy`,
    `holding ${item.label} up in front of body to preview without wearing it — candid evaluating pose`,
    `looking at ${item.label} while seated on bed edge — natural selection moment, items around her`,
  ];
  // Key encodes the outfit item index (1-based) so the resolver in generatePhotodumpShot
  // can always recover the correct HaulItem without relying on setup insertion order.
  return {
    key:    `HAUL_SETUP_${itemIndex + 1}`,
    beat:   'action',
    role:   `HAUL SETUP — ${item.label}`,
    purpose: `Selection/setup moment before trying on ${item.label}. The person is organizing or evaluating haul items — not yet wearing them. Hands active. Real bedroom context. UGC energy. NOT a catalog flatlay — this is a real person going through their haul.`,
    requiredElements:  ['hands_active', 'real_room_context', 'garment_visible_as_object', 'natural_organic_moment'],
    forbiddenElements: ['catalog_grid', 'studio_backdrop', 'white_background', 'editorial_lighting', 'forced_symmetry', 'full_body_catalog_pose'],
    variationSpace:    shotVariations,
    framing:     'MEDIUM_OR_CLOSE',
    composition: 'HANDS_ACTIVE_WITH_GARMENT',
    cameraAngle: 'EYE_LEVEL_OR_SLIGHT_HIGH',
    hpiAllowed:  false,
    wearState:   'not_wearing_final_outfit',
    cameraMode:  'third_person',
  };
}

// ── Haul: Styled result shot (look final puesto — variedad) ──

function buildHaulStyledResultShot(
  item:      HaulItem,
  itemIndex: number,
  pileState: HaulPileState,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const pileNote = pileStateDesc(pileState, itemIndex);
  return {
    key:    `HAUL_STYLED_${itemIndex + 1}`,
    beat:   'reveal',
    role:   `STYLED RESULT — ${item.label}`,
    purpose: `The person is wearing ${item.label} and has finished styling it. ${pileNote} This is the "reveal" moment — full look readable. Different framing than the try-on shot for the same piece. Can be: mirror shot, seated on bed, leaning against wall, or medium frame showing the styled result from a different angle than the preceding try-on.`,
    requiredElements:  ['avatar_wearing_item', 'garment_clearly_readable', 'different_framing_than_try_on'],
    forbiddenElements: ['same_framing_as_try_on', 'catalog_stance', 'editorial_lighting', 'mannequin_pose', 'beautification'],
    variationSpace: [
      `mirror selfie showing ${item.label} fully — natural posture, haul space reflected behind`,
      `seated on bed edge wearing ${item.label} — relaxed, looking at camera or slightly off`,
      `medium shot leaning against wall — natural weight shift, ${item.label} clearly readable`,
      `half-turn showing the back or side of ${item.label} — candid, real lighting`,
    ],
    framing:     'MEDIUM_OR_WIDE',
    composition: 'STYLED_RESULT_REVEAL',
    cameraAngle: 'EYE_LEVEL',
    hpiAllowed:  true,
    hpiScope:    'full',
    wearState:   'wearing_full_outfit',
    cameraMode:  'mirror_selfie_phone_hidden',
  };
}

// ── Haul: Bag/bolso shot ──────────────────────────────────────

function buildHaulBagShot(
  item:            HaulItem,
  bagIdx:          number,
  compatibleCombo?: { outfitItemId: string; outfitLabel: string } | null,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const hasCompatible = !!compatibleCombo;

  const purpose = hasCompatible
    ? `${item.label} carried with a compatible haul look (${compatibleCombo!.outfitLabel}). The person holds or wears the bag naturally while also wearing the compatible outfit. Medium or medium-close framing. Real room. The bag is clearly readable — design, hardware, shape faithful to the reference. Do NOT invent additional garments.`
    : `${item.label} is a bag or purse. Show it with character — not a catalog shot: held casually over shoulder or in hand, resting on bed near haul pile, detail of hardware or stitching, being opened or adjusted. Real room light. The bag is the protagonist. Do NOT invent a full styled outfit — person may be present but NOT showing off a full haul look.`;

  const variations = hasCompatible ? [
    `person carrying ${item.label} over shoulder wearing ${compatibleCombo!.outfitLabel} — medium shot, natural posture`,
    `${item.label} held in hand while wearing ${compatibleCombo!.outfitLabel} — candid real moment`,
    `medium: person with ${item.label} and ${compatibleCombo!.outfitLabel} — bag as style detail of the look`,
    `close of ${item.label} being opened or adjusted while ${compatibleCombo!.outfitLabel} visible around it`,
  ] : [
    `${item.label} held casually over shoulder or in hand — natural posture, room visible behind`,
    `${item.label} resting on bed or haul pile — design and texture readable, real light`,
    `close-up of ${item.label} hardware, stitching, or clasp — macro real texture`,
    `person opening or adjusting ${item.label} — hands active, candid interaction`,
  ];

  return {
    key:    `HAUL_BAG_${bagIdx + 1}`,
    beat:   'detail',
    role:   `BAG / BOLSO — ${item.label}`,
    purpose,
    requiredElements:  [
      'bag_clearly_visible_faithful_to_reference',
      'real_light_and_texture',
      hasCompatible ? 'compatible_outfit_worn_in_same_shot' : 'intimate_or_contextual_framing',
    ],
    forbiddenElements: [
      'white_studio_background',
      'catalog_product_shot',
      'editorial_lighting',
      'forced_symmetry',
      'invented_outfit_not_in_haul',
      'bag_design_changed_or_fused',
    ],
    variationSpace: variations,
    framing:     hasCompatible ? 'MEDIUM_OR_WIDE' : 'MEDIUM_OR_CLOSE',
    composition: hasCompatible ? 'BAG_WITH_COMPATIBLE_LOOK' : 'BAG_AS_PROTAGONIST',
    cameraAngle: 'EYE_LEVEL_OR_SLIGHT_ANGLE',
    hpiAllowed:  false,
    wearState:   hasCompatible ? 'wearing_full_outfit' : 'not_wearing_final_outfit',
    cameraMode:  hasCompatible ? 'third_person' : 'third_person',
    haulItemPlan: {
      primaryItems:    [item.id],
      wornItems:       hasCompatible ? [compatibleCombo!.outfitItemId] : [],
      heldItems:       [item.id],
      surfaceItems:    hasCompatible ? [] : [item.id],
      backgroundItems: [],
      forbiddenItems:  [],
      supportBaseLook: !hasCompatible,
      combinationId:   hasCompatible ? `combo_${compatibleCombo!.outfitItemId}` : undefined,
      integrationNote: hasCompatible
        ? `${item.label} carried with ${compatibleCombo!.outfitLabel} — bag held, outfit worn`
        : `${item.label} standalone — held or surface placement, no invented look`,
    },
  };
}

// ── Haul: Jewelry shot ────────────────────────────────────────

function buildHaulJewelryShot(
  item:            HaulItem,
  jewelryIdx:      number,
  compatibleCombo?: { outfitItemId: string; outfitLabel: string } | null,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const hasCompatible = !!compatibleCombo;

  // Determinar si son aros (earrings) para regla de simetría
  const lowerLabel = item.label.toLowerCase();
  const isEarrings = lowerLabel.includes('aro') || lowerLabel.includes('earring') || lowerLabel.includes('arete') || lowerLabel.includes('pendiente');
  const earringRule = isEarrings
    ? ' EARRING SYMMETRY: both ears must wear the same earring — same design, same scale, same position. Never mismatched.'
    : '';

  const purpose = hasCompatible
    ? `${item.label} worn with a compatible haul outfit (${compatibleCombo!.outfitLabel}). Close crop near the body part where jewelry is worn — ear/neck/wrist visible. Jewelry is the detail protagonist but outfit context is present.${earringRule} Do NOT invent new garments — only use the referenced haul outfit.`
    : `${item.label} is a jewelry piece. Show it intimately: worn on body (ear/wrist/neck/finger) with natural light — close crop, real skin visible; OR held between fingers macro-close to camera; OR resting on real fabric surface. Reproduce ${item.label} faithfully: exact shape, color, material, scale, pair if applicable.${earringRule} Do NOT invent full outfit context that was not provided.`;

  const variations = hasCompatible ? [
    `close crop: ${item.label} worn with ${compatibleCombo!.outfitLabel} — face/neck/wrist tight framing, jewelry as focal detail`,
    `person putting on ${item.label} while wearing ${compatibleCombo!.outfitLabel} — hands active, candid gesture`,
    `medium shot — ${item.label} detail as styling finishing touch on ${compatibleCombo!.outfitLabel} look`,
    `macro of ${item.label} on body with ${compatibleCombo!.outfitLabel} soft-focused behind — depth, real light`,
  ] : [
    `${item.label} worn on body — ear/wrist/neck visible, natural light, real skin texture, macro-intimate`,
    `${item.label} held between fingers — macro framing, design and detail readable, real hand`,
    `${item.label} resting on fabric surface (bed, haul garment) — real environment, intimate detail`,
    `person putting on or adjusting ${item.label} — candid gesture, hands and jewelry in frame`,
  ];

  return {
    key:    `HAUL_JEWELRY_${jewelryIdx + 1}`,
    beat:   'detail',
    role:   `JEWELRY — ${item.label}`,
    purpose,
    requiredElements: [
      'jewelry_faithfully_reproduced_exact_shape_color_scale',
      'real_light',
      'intimate_macro_framing',
      ...(isEarrings ? ['both_ears_same_earring_design'] : []),
      ...(hasCompatible ? ['compatible_outfit_present_in_shot'] : []),
    ],
    forbiddenElements: [
      'white_studio_background',
      'catalog_product_shot',
      'editorial_lighting',
      'invented_outfit_not_in_haul',
      'different_jewelry_than_reference',
      'wrong_scale_jewelry',
      ...(isEarrings ? ['mismatched_earrings', 'single_earring_only'] : []),
    ],
    variationSpace: variations,
    framing:     'CLOSE_UP_OR_MACRO',
    composition: hasCompatible ? 'JEWELRY_WITH_COMPATIBLE_LOOK' : 'JEWELRY_INTIMATE_DETAIL',
    cameraAngle: 'SLIGHT_ANGLE_OR_STRAIGHT',
    hpiAllowed:  false,
    wearState:   hasCompatible ? 'wearing_full_outfit' : 'not_wearing_final_outfit',
    cameraMode:  hasCompatible ? 'third_person' : 'detail_macro',
    haulItemPlan: {
      primaryItems:    [item.id],
      wornItems:       [item.id, ...(hasCompatible ? [compatibleCombo!.outfitItemId] : [])],
      heldItems:       hasCompatible ? [] : [item.id],
      surfaceItems:    [],
      backgroundItems: [],
      forbiddenItems:  [],
      supportBaseLook: !hasCompatible,
      combinationId:   hasCompatible ? `combo_${compatibleCombo!.outfitItemId}` : undefined,
      integrationNote: hasCompatible
        ? `${item.label} integrated with ${compatibleCombo!.outfitLabel} — jewelry is detail focal point`
        : `${item.label} standalone — macro or held shot, no invented outfit context`,
    },
  };
}
