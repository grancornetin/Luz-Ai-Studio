/**
 * photodumpDirectorService.ts
 * Director visual para Photodump Mode.
 * Arquitectura idéntica a UGC Studio (REF0, LOCK_SYSTEM, shot directives con forbidden elements)
 * pero orientada a storytelling orgánico en lugar de anuncios.
 *
 * UGC Studio  → Sesión fotográfica para ads (6 shots técnicos fijos)
 * Photodump   → Constelación narrativa visual (N momentos orgánicos: context, detail, emotion, texture, action, atmosphere, reveal, candid)
 */
import { ugcApiService } from '../../services/ugcApiService';
import { imageApiService } from '../../services/imageApiService';
import { geminiService } from '../../services/geminiService';
import { compressImageForUpload } from '../../utils/imageUtils';
import { runGenericDirector, type GenericDirectorReferenceImage } from './director/generic/genericClient';
import { buildOutfitCheckDirectorDirectives } from './recipes/outfitCheck/directorAdapter';
import {
  PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
  PhotodumpRefs, PhotodumpOutfitMode, NARRATIVE_META,
  FreeScene, FreeSceneRefs,
  WearState, CameraMode, InferredDestination,
  OutfitItemPlan, SceneLockPolicy,
  OutfitBriefContext, OutfitDestinationClass, PrepEnvironmentClass, OutfitComposition,
  PoseIntent, DetailKind, EnvironmentAffordance, SceneContinuityMode,
  HaulItem, HaulManifest, HaulItemKind, HaulPileState, HaulCoveragePlan, HaulRefKind,
  HaulResolvedKind, HaulCoverageRole, HaulCoverageLedgerItem, HaulOutfitComponents,
  HaulWorldMap, HaulItemAllowedUseMode, HaulItemState,
  HaulStyledCombination, HaulStylingGraph, HaulShotItemPlan, HaulBaseStartingLook,
  VisualRefsAnalysisResult,
} from './types';
import {
  getStorySupportFamilies, initPhotodumpIntelligence, StorySupportFamily,
} from './photodumpIntelligence';
import { buildHpiBlock, getHpiNegatives, initHpiService } from '../../services/hpiService';
import { parseTag as parseCatalogTag, SLOT_CATALOG } from './slotCatalog';
import {
  MomentType, StoryBeat, PhotodumpShotDirective, OutfitPresentationStyle,
  PhotodumpSessionPlan, PhotodumpREF0Result,
  NEGATIVE_FULL, NEGATIVE_SHORT, LOCK_SYSTEM, PARADIGM_RULE,
  STORY_MODE_DOMINANCE, STORY_MODE_FACELESS,
  GLOBAL_SCENE_LOCK, GLOBAL_AVATAR_SUPPRESSION, GLOBAL_WARDROBE_PHYSICS,
  GLOBAL_ANATOMY_SAFETY, GLOBAL_VISUAL_FIDELITY, GLOBAL_NO_BRANDING,
  inferOutfitComposition, buildItemStatePlanForShot,
  resolveWearState, injectWearStateBlock,
  resolveCameraMode, injectCameraModeBlock,
  SceneFingerprint, buildSceneFingerprint,
  resolveClosurePoseIntent,
  getAspectRatio, extractImageData, prepareRefs, getAspectInstruction,
  buildAvatarBaseClothingFingerprint, buildAvatarBaseClothingNegativeBlock,
  getDestinationDescription,
} from './recipes/shared';
import {
  buildHaulSafeHpiBlock,
  buildHaulManifest, buildHaulShotPlan, buildHaulWorldMap, buildHaulStylingGraph,
  getAllowedUseModes, computeFinalHaulCoverageFromShots,
  buildHaulItemTypeBlock, buildHaulItemRoleLockBlock, buildHaulAnatomyBlock,
  buildHaulProgressBlock, buildHaulShotItemPlanBlock,
} from './recipes/outfitHaul';
import {
  WEEKLY_SLOT_COVERAGE_MODE, buildWeeklySafeHpiBlock,
  buildWeeklyManifest, weeklyRoleToDirective, generateOutfitWeekShot,
} from './recipes/outfitWeek';
import {
  parseOutfitBriefContext, buildPrepEnvironmentDirective, buildPrepContextOnlyBlock,
  buildREF0HardLockBlock, buildSceneContinuityBlock, buildAdaptiveClosureBlock,
  buildOutfitCompatibleHpiBlock, buildSafeOutfitFamilyStyleHint, filterHpiForOutfitCheck,
  detectContradictions, PREP_SHOT_KEYS,
  resolveOutfitPresentationStyle, buildOutfitCheckShotPool, distributeOutfitCheckShots,
  outfitCheckBankShotTypes,
} from './recipes/outfitCheck';
import { fetchOutfitCheckPoseCandidates } from './recipes/outfitCheck/poseClient';
import { buildUnboxingShotPool, distributeUnboxingShots } from './recipes/unboxing';
import { resolveReferenceTagsFromBrief, PAIRING_CONNECTORS } from './recipes/briefTags';
import {
  buildProductHaulManifest, buildProductHaulShotPlan,
  buildProductInteractionBlock, buildProductHaulItemTypeBlock,
  buildProductHaulShotItemPlanBlock, buildProductHaulAnatomyBlock,
  buildProductHaulSafeHpiBlock,
} from './recipes/productHaul';
// weeklyFavoritesV2 — motor nuevo de outfit_week (reescritura completa, sin
// reutilizar lógica de recipes/outfitWeek.ts). El Director despacha
// 'outfit_week' hacia aquí; outfitWeek.ts queda importado más arriba solo
// para no romper símbolos re-exportados (buildWeeklyManifest) que
// PhotodumpModule.tsx todavía pueda usar en otro lugar, pero su lógica de
// generación ya no se ejecuta para esta receta.
import {
  buildWeeklyFavoritesV2Directives, generateWeeklyFavoritesV2REF0, generateWeeklyFavoritesV2Shot,
  type WeeklyFavoritesV2Plan,
} from './recipes/weeklyFavoritesV2';
import type { AnchorContract as WeeklyFavoritesV2AnchorContract } from './recipes/weeklyFavoritesV2/types';
// day_in_life — receta multi-mundo, misma forma de despacho que weeklyFavoritesV2:
// 3 funciones autónomas que no pasan por buildStoryDirectives/generatePhotodumpREF0/
// generatePhotodumpShot genéricos. Ver recipes/dayInLife.ts para el detalle.
import {
  buildDayInLifeManifest, buildDayInLifeShotPlan, generateDayInLifeRef0Chain,
  buildDayBlockLockBlock, buildDayInLifeCoverageDebug, getCachedDayInLifeRef0Chain,
} from './recipes/dayInLife';
// outfit_multi_look — receta propia, 4 intenciones (weekly/then_vs_now/
// trip_recap/curated_ideas), misma forma de despacho que
// weeklyFavoritesV2. Ver recipes/outfitMultiLook/index.ts.
import {
  buildOutfitMultiLookDirectives, generateOutfitMultiLookREF0, generateOutfitMultiLookShot,
} from './recipes/outfitMultiLook';
// outfit_reveal_basic — receta propia, 3 shots fijos (mirror_check, self_pov,
// close_detail), sin looks múltiples ni intenciones. Ver recipes/outfitRevealBasic/index.ts.
import {
  buildOutfitRevealBasicDirectives, generateOutfitRevealBasicREF0, generateOutfitRevealBasicShot,
} from './recipes/outfitRevealBasic';
// outfit_night_out — receta propia, 3 shots fijos de preparación (presentation/
// tryon_detail/mirror_check) + banco rotable de "momentos de noche" según el
// nivel elegido (corto/completo/extendido). Ver recipes/outfitNightOut/index.ts.
import {
  buildOutfitNightOutDirectives, generateOutfitNightOutREF0, generateOutfitNightOutShot,
} from './recipes/outfitNightOut';

initHpiService();

// ── Caché en memoria: ancla de outfit_check fusionada con la foto 1 ────────
// (sep 2026, pedido del usuario tras prueba 3: "siento que ref0 sobra, es
// pagar demás por ella"). Mismo motivo/patrón que fixedAnchorCache en
// recipes/outfitMultiLook/index.ts — generatePhotodumpREF0 y
// generatePhotodumpShot son llamadas separadas sin otro lugar para pasarse
// el resultado. Para outfit_check con count>1, generatePhotodumpREF0 genera
// la imagen del shot 1 real (Director o arco legado, lo que haya armado
// buildStoryDirectives) en vez de un mirror-check genérico aparte — la
// cachea acá, y generatePhotodumpShot la devuelve tal cual para
// arcPosition===1 en vez de generarla de nuevo. count===1 no usa esta
// caché (ver outfitCheckSingleShot, camino ya resuelto antes).
const outfitCheckAnchorCache = new Map<string, string>();
function outfitCheckAnchorCacheKey(refs: PhotodumpRefs, basePrompt: string): string {
  const urls = [refs.avatarRef, refs.bodyRef, refs.outfitRef].filter(Boolean);
  return `${urls.join('|')}::${basePrompt}`;
}

// ── Tipos ─────────────────────────────────────────────────────
//
// MomentType, StoryBeat, PhotodumpShotDirective, OutfitPresentationStyle,
// PhotodumpSessionPlan, PhotodumpREF0Result → movidos a ./recipes/shared.ts (Fase 1).
// Re-exportados aquí para no romper a otros módulos que los importen desde este archivo.
export type {
  MomentType, StoryBeat, PhotodumpShotDirective, OutfitPresentationStyle,
  PhotodumpSessionPlan, PhotodumpREF0Result,
};

// Símbolos de valor movidos a ./recipes/shared.ts (Fase 1) — re-exportados para no romper
// a otros módulos (p.ej. PhotodumpModule.tsx) que los importan desde este archivo.
export {
  inferOutfitComposition, buildItemStatePlanForShot,
  resolveWearState, injectWearStateBlock,
  resolveCameraMode, injectCameraModeBlock,
  buildSceneFingerprint,
  resolveClosurePoseIntent,
  getAspectRatio, extractImageData, prepareRefs, getAspectInstruction,
  NEGATIVE_FULL, NEGATIVE_SHORT, LOCK_SYSTEM, PARADIGM_RULE,
  STORY_MODE_DOMINANCE, STORY_MODE_FACELESS,
  GLOBAL_SCENE_LOCK, GLOBAL_AVATAR_SUPPRESSION, GLOBAL_WARDROBE_PHYSICS,
  GLOBAL_ANATOMY_SAFETY, GLOBAL_VISUAL_FIDELITY, GLOBAL_NO_BRANDING,
};
export type { SceneFingerprint };

// Símbolos de outfit_haul movidos a ./recipes/outfitHaul.ts (Fase 2) — re-exportados
// para no romper a PhotodumpModule.tsx, que los importa desde este archivo.
export {
  buildHaulManifest, buildHaulShotPlan, buildHaulWorldMap, buildHaulStylingGraph,
  getAllowedUseModes, computeFinalHaulCoverageFromShots,
};

// Símbolos de outfit_week movidos a ./recipes/outfitWeek.ts (Fase 3) — re-exportados
// para no romper a PhotodumpModule.tsx, que los importa desde este archivo.
export { buildWeeklyManifest };

// Símbolos de product_haul — re-exportados para PhotodumpModule.tsx.
export {
  buildProductHaulManifest, buildProductHaulShotPlan,
};

// Símbolos de outfit_check movidos a ./recipes/outfitCheck.ts (Fase 4) — re-exportados
// para no romper a PhotodumpModule.tsx, que los importa desde este archivo.
export { detectContradictions, parseOutfitBriefContext };

// ── Helpers ───────────────────────────────────────────────────

// Router semántico completo para outfit_check.
// Reemplaza parseBriefContext con precisión de destino, prep environment y mood.

// Compatibilidad legada — otros módulos siguen usando parseBriefContext para timeSignal/venueSignal.
export function parseBriefContext(basePrompt: string): {
  timeSignal: string;
  venueSignal: string;
  isOccasionBrief: boolean;
} {
  const ctx = parseOutfitBriefContext(basePrompt);
  const timeMap: Record<string, string> = {
    night:       'NIGHT — warm artificial light, evening atmosphere, no daylight',
    golden_hour: 'GOLDEN HOUR — warm orange-gold directional light, long shadows',
    morning:     'MORNING — soft cool-to-warm natural light, fresh atmosphere',
    day:         'DAY — natural daylight',
    afternoon:   'AFTERNOON — strong natural light, clear shadows',
    unspecified: '',
  };
  return {
    timeSignal:      timeMap[ctx.timeSignal] ?? '',
    venueSignal:     ctx.isOccasionBrief ? ctx.destinationLabel : '',
    isOccasionBrief: ctx.isOccasionBrief,
  };
}

// ── Destination inference (legado — delegado al router semántico) ─────────────
export function inferDestinationFromBrief(basePrompt: string): InferredDestination {
  const ctx = parseOutfitBriefContext(basePrompt);
  // Mapear OutfitDestinationClass → InferredDestination legado
  const map: Partial<Record<OutfitDestinationClass, InferredDestination>> = {
    opera_theatre:       'opera_theatre',
    formal_event:        'cocktail_gala',
    restaurant_dinner:   'restaurant_dinner',
    country_club_brunch: 'restaurant_dinner',
    beach_day:           'beach_outdoor',
    travel_airport:      'travel_transit',
    office_meeting:      'generic_outing',
    business_event:      'generic_outing',
    urban_social_outing: 'generic_outing',
    generic_outing:      'generic_outing',
    none:                'none',
  };
  return map[ctx.destinationClass] ?? 'none';
}

// ── Prep environment directive para REF0 outfit_check ────────────────────────
// Genera la instrucción de espacio de preparación correcta para el brief dado.
// Si el usuario subió scenePruebaRef, la IA lo respeta — sino, genera el espacio apropiado.


// ── Item state plan → bloque de prompt ───────────────────────
// Convierte el plan de estado por pieza en instrucciones para el modelo.
export function buildItemStatePlanBlock(plan: OutfitItemPlan[] | undefined, wearState: WearState): string {
  if (!plan || plan.length === 0) return '';
  const lines = ['🔒 OUTFIT ITEM STATE RULES (per-piece — binding):'];
  for (const p of plan) {
    const stateDesc: Record<string, string> = {
      worn: `WORN on the body — must be visibly on the person`,
      held: `HELD in hand or presented — not worn yet`,
      hanging: `HANGING on a rack or hanger — garment as object`,
      flat_lay: `FLAT on a surface — laid out, not worn`,
      on_floor_before_wearing: `ON THE FLOOR or nearby surface — not yet put on`,
      not_visible: `NOT in this shot`,
      detail_focus: `CLOSE-UP DETAIL — fills the frame`,
    };
    lines.push(`  • ${p.item.toUpperCase()}: ${stateDesc[p.requiredState] ?? p.requiredState}${p.mustBeVisible ? ' [REQUIRED IN FRAME]' : ' [may be off-frame]'}${p.mayBeDuplicated ? '' : ' — do NOT show both worn AND as separate object simultaneously'}`);
  }
  if (wearState === 'wearing_full_outfit' || wearState === 'ready_to_leave' || wearState === 'destination_arrived') {
    lines.push(`  ⚠️ SHOES: If shoes are part of the outfit, they MUST be WORN on the feet.`);
    lines.push(`     Do NOT show the shoes both on the person AND also placed on the floor as separate objects.`);
    lines.push(`     A person wearing full outfit with bare feet is a generation error.`);
  }
  return lines.join('\n');
}

// ── Scene lock policy → bloque de prompt ─────────────────────
// Genera la instrucción de continuidad de escena correcta según la política del shot.
function buildSceneLockPolicyBlock(
  policy: SceneLockPolicy | undefined,
  destDesc: string,
  hasUserSceneRef: boolean,
): string {
  if (!policy || policy === 'none') return '';
  switch (policy) {
    case 'strict_ref0':
    case 'prep_space':
      return `📍 SCENE CONTINUITY: Same environment as REF0.
Same walls, floor, furniture, light direction. This shot happens in the PREP SPACE — do NOT move the person to the event venue.`;
    case 'prep_space_or_surface':
      return `📍 SCENE CONTINUITY: Same prep space or compatible surface as REF0.
For detail shots, the surface/background should be consistent with the REF0 prep space.
Do NOT introduce a new room or event venue.`;
    case 'prep_space_or_pre_exit':
      return `📍 SCENE CONTINUITY: Same prep room OR transition space (hallway, doorway, immediate exterior).
The person may be on their way out, but the core space still echoes the REF0 prep space.
Do NOT place the person at the final destination yet.`;
    case 'destination_allowed':
      return `📍 SCENE LOCK — DESTINATION CLOSING SHOT:
This is the FINAL SHOT of the set. The scene is the DESTINATION — NOT the prep room.
Location: ${destDesc}
CRITICAL: Do NOT replicate the prep room walls, furniture, or lighting from previous shots.
Same person, same outfit, same identity — completely new destination space.

ACCEPTABLE POSES for this destination (choose the most natural and socially believable):
- Relaxed pose near architectural element (column, doorway, wall) — not catalog-stiff
- Seated in venue lounge or at venue seating
- Mirror selfie inside venue bathroom
- Standing naturally at venue entrance or corridor

FORBIDDEN in this shot:
- descending stairs in motion
- holding ticket as main visual subject
- shoes-only floor close-up as closing image
- rigid full-frontal mannequin stance in center of room
- prep room walls, mirror, bed, or furniture from REF0
- any nightlife prop if destination is office or brunch`;
  }
}

// ── Scene Continuity Block — propaga el fingerprint del prep space ─────────────
// Inyectado en todos los shots del prep arc que NO son OUTFIT_DESTINATION.

// ── Bloque de contexto global del brief — inyectado en REF0 y shots de destino.
// Para shots de preparación (ARRIVING, MIRROR, DETAIL, READY), usar extractShotLocationOverride.
// Para outfit_haul: si wearingContextOnly=true, NO inyectar venueSignal (evita contaminar la locación).
export function extractBriefContextBlock(basePrompt: string, recipe?: string): string {
  const { timeSignal, venueSignal } = parseBriefContext(basePrompt);

  // Para haul y outfit_week: suprimir venueSignal como locación de captura.
  // En outfit_week es SIEMPRE suprimido — la receta opera en modo de cobertura de slots,
  // no en modo de campaña narrativa. El destination solo aplica como metadata de ropa.
  let effectiveVenueSignal = venueSignal;
  if (recipe === 'outfit_week' && venueSignal) {
    const ctx = parseOutfitBriefContext(basePrompt);
    // outfit_week: siempre suprimir venue como locación — solo nota de estilo si hay ocasión
    effectiveVenueSignal = ctx.wearingContextStyleLabel
      ? `GARMENT STYLE CONTEXT: ${ctx.wearingContextStyleLabel} (describes the clothes' occasion — NOT the filming location)`
      : '';
  } else if (recipe === 'outfit_haul' && venueSignal) {
    const ctx = parseOutfitBriefContext(basePrompt);
    if (ctx.wearingContextOnly === true) {
      // Suprimir venueSignal de locación — reemplazar por nota de estilo solamente
      effectiveVenueSignal = ctx.wearingContextStyleLabel
        ? `OUTFIT STYLE CONTEXT: ${ctx.wearingContextStyleLabel} (the clothes suit this occasion, but the haul takes place at home)`
        : '';
    }
  }

  if (!timeSignal && !effectiveVenueSignal) return '';

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🎯 SCENE CONTEXT DIRECTIVE (OVERRIDES DEFAULT LIGHTING ASSUMPTIONS):',
    'The user\'s brief contains explicit context clues. These are BINDING directives — not suggestions.',
    'They override the model\'s default tendency to generate daytime/neutral lighting.',
  ];
  if (timeSignal) lines.push(`  • ${timeSignal}`);
  if (effectiveVenueSignal) lines.push(`  • ${effectiveVenueSignal}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n');
}

export function extractShotLocationOverride(
  basePrompt:       string,
  shotKey:          string,
  hasUserSceneRef:  boolean,  // true si el usuario subió scenePruebaRef o sceneRef
): string {
  const { isOccasionBrief, timeSignal } = parseBriefContext(basePrompt);
  if (!isOccasionBrief || !PREP_SHOT_KEYS.has(shotKey)) return '';

  const timeCtx = timeSignal
    ? `Lighting mood: ${timeSignal.split('—')[1]?.trim() ?? timeSignal} — pre-event getting ready.`
    : 'Pre-event getting-ready lighting — warm artificial light, intimate indoor atmosphere.';

  // Si el usuario subió una foto de la escena de prueba, el espacio está definido por ella (REF0).
  // Si no, la IA lo inventó — igual debe respetarlo para mantener coherencia visual entre shots.
  const sceneAnchor = hasUserSceneRef
    ? `This shot takes place in the SAME SPACE shown in REF0 — the room the user provided.
Preserve every visual element: same walls, same floor, same furniture, same light direction.
Do NOT invent a new room. Do NOT change wall color, floor material, or visible furniture.`
    : `This shot takes place in the SAME SPACE established in REF0.
REF0 already defined the visual world — bedroom, hotel room, or dressing area.
Match it EXACTLY: same surfaces, same ambient light, same mood.
Do NOT generate a different room. Do NOT change the color scheme or furniture style.
The brief suggests the occasion's atmosphere — let that influence the MOOD, not the physical space.`;

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 SHOT LOCATION LOCK (THIS SHOT ONLY):
${sceneAnchor}
${timeCtx}
The venue (opera / gala / restaurant) is the DESTINATION — it appears ONLY in the final DESTINATION shot.
DO NOT place garment racks, flat lays, or mirror shots inside the opera house or theatre.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ── Shot Directives (constelación de momentos) ────────────────

function buildStoryDirectives(
  count:      number,
  protagonist: PhotodumpProtagonist,
  destino:    PhotodumpDestino,
  narrative:  PhotodumpNarrative,
  recipe?:    string,
  refs?:      { avatarRef?: string | null; outfitRefs?: (string | null)[]; accesorioRefs?: (string | null)[]; accesorioCloseup?: boolean[]; sceneDestinoRef?: string | null; scenePruebaRef?: string | null; sceneRef?: string | null; gender?: 'female' | 'male' | 'neutral' },
  presentationStyle?: OutfitPresentationStyle,
  basePrompt?: string,
  // outfit_check — candidatos reales del banco por shot_type (ver
  // poseClient.ts/outfitCheckBankShotTypes), resueltos por el caller ANTES
  // de llamar acá (esta función sigue siendo síncrona, sin await). Opcional
  // y sin efecto en ninguna otra receta.
  outfitCheckPoseCandidates?: Record<string, import('./recipes/outfitCheck/poseClient').OutfitCheckPoseCandidate[]>,
  outfitCheckSeedKey?: string,
): PhotodumpShotDirective[] {

  const ar = destino === 'feed' ? '4/5' : '9/16';

  // Receta unboxing: arco lineal fijo con pool dedicado
  if (recipe === 'unboxing') {
    const hasAvatar = !!refs?.avatarRef;
    // Sin avatar, el vehículo de "opening/in use" son manos solas (ver unboxing.ts) —
    // bug real reportado: sin especificar de quién, el modelo generó manos masculinas
    // para un producto de skincare/belleza sin ninguna razón narrativa. refs.gender ya
    // se calcula en PhotodumpModule.tsx (inferido del avatar si hay, 'female' por
    // default si no) — antes llegaba hasta acá y se descartaba sin usar.
    const pool      = buildUnboxingShotPool(hasAvatar, refs?.gender ?? 'female');
    const keys      = distributeUnboxingShots(count, hasAvatar);
    return keys.map((key, i) => {
      const shot = pool.find(s => s.key === key) ?? pool[i % pool.length];
      return { ...shot, arcPosition: i + 1, aspectRatio: ar };
    });
  }

  // ── Recetas outfit — arcos específicos por modo ───────────

  if (recipe === 'outfit_check') {
    const hasDestino     = !!refs?.sceneDestinoRef;
    const style          = presentationStyle ?? 'hands_presenter';
    const briefCtx       = parseOutfitBriefContext(basePrompt ?? '');
    const inferredDest   = inferDestinationFromBrief(basePrompt ?? '');
    const composition    = inferOutfitComposition(refs ?? {} as PhotodumpRefs, basePrompt ?? '');
    // Destino sólido: subido por usuario O inferido del brief (no generic_outing ni none)
    const shouldUseDestinationClosure =
      hasDestino ||
      (briefCtx.destinationClass !== 'none' && briefCtx.destinationClass !== 'generic_outing');
    const pool           = buildOutfitCheckShotPool(style, inferredDest, hasDestino, briefCtx, outfitCheckPoseCandidates, outfitCheckSeedKey);
    const baseKeys       = distributeOutfitCheckShots(count, shouldUseDestinationClosure);
    // Accesorios antes del closing shot
    const closeupIndexes = (refs?.accesorioCloseup ?? [])
      .map((v, i) => v ? i : -1).filter(i => i >= 0);
    const closingKey   = baseKeys[baseKeys.length - 1];
    const middleKeys   = baseKeys.slice(0, -1);
    const allKeys = [
      ...middleKeys,
      ...closeupIndexes.map(() => 'ACCESSORY_CLOSEUP'),
      closingKey,
    ];
    const totalShots = allKeys.length;
    // Resolver pose intent del cierre una sola vez para el set
    const closurePose = resolveClosurePoseIntent(briefCtx, composition, hasDestino);

    return allKeys.map((key, i) => {
      const shot = pool.find(s => s.key === key) ?? pool[pool.length - 1];
      const isFinalShot    = i === totalShots - 1;
      const isClosingShot  = isFinalShot && (key === 'OUTFIT_DESTINATION' || key === 'OUTFIT_MIRROR_CHECK' || key === 'OUTFIT_READY');
      const closingStrategy = isFinalShot
        ? key === 'OUTFIT_DESTINATION'
          ? hasDestino ? 'destination_uploaded' : 'destination_inferred'
          : 'pre_exit'
        : 'none';
      const sceneLockPolicy: SceneLockPolicy = isFinalShot && key === 'OUTFIT_DESTINATION'
        ? 'destination_allowed'
        : key === 'OUTFIT_ARRIVING' || key === 'OUTFIT_DETAIL' || key === 'OUTFIT_DETAIL_WORN' || key === 'ACCESSORY_CLOSEUP'
          ? 'prep_space_or_surface'
          : key === 'OUTFIT_READY' || key === 'OUTFIT_SECOND_ANGLE'
            ? 'prep_space_or_pre_exit'
            : 'prep_space';
      const phonePolicy = key === 'OUTFIT_MIRROR_CHECK'
        ? 'forbidden' as const
        : 'not_applicable' as const;
      // detailKind: los OUTFIT_DETAIL van antes del mirror (pre_wear), los OUTFIT_DETAIL_WORN después (worn)
      const detailKind = key === 'OUTFIT_DETAIL' ? 'pre_wear' as const
        : key === 'OUTFIT_DETAIL_WORN' ? 'worn' as const
        : key === 'ACCESSORY_CLOSEUP' ? 'accessory' as const
        : undefined;
      // continuityMode: todos los shots de prep usan fingerprinted (se resuelve en generatePhotodumpShot)
      const continuityMode: SceneContinuityMode = key === 'OUTFIT_DESTINATION' ? 'free'
        : (refs?.scenePruebaRef || refs?.sceneRef) ? 'ref_locked'
        : 'fingerprinted';
      // itemStatePlan derivado de composición real — no exige dress + top + bottom a la vez
      const itemStatePlanForShot = buildItemStatePlanForShot(key, composition);
      // Para el shot de destino, aplicar el poseIntent resuelto
      const poseIntent = key === 'OUTFIT_DESTINATION' ? closurePose.poseIntent : shot.poseIntent;
      const environmentAffordances = key === 'OUTFIT_DESTINATION' ? closurePose.affordances : undefined;
      const closureReason = key === 'OUTFIT_DESTINATION' ? closurePose.reason : undefined;

      return {
        ...shot,
        arcPosition: i + 1,
        aspectRatio: ar,
        isFinalShot,
        isClosingShot,
        closingStrategy: closingStrategy as any,
        sceneLockPolicy,
        phonePolicy,
        detailKind,
        continuityMode,
        poseIntent,
        environmentAffordances,
        closureReason,
        itemStatePlan: itemStatePlanForShot.length > 0 ? itemStatePlanForShot : shot.itemStatePlan,
      };
    });
  }

  if (recipe === 'outfit_haul') {
    // El arco del haul se basa en los ítems subidos, no en un arco fijo.
    // storyShotCount = min(count, 20) — forzado en el caller (PhotodumpModule).
    // buildHaulManifest y buildHaulShotPlan generan exactamente ese número de shots.
    const manifest  = buildHaulManifest((refs ?? {}) as PhotodumpRefs, count);
    const haulShots = buildHaulShotPlan(manifest);
    // Asegurar que no excedemos el count pedido (ya garantizado por el plan, pero por seguridad)
    const finalShots = haulShots.slice(0, manifest.maxStoryShots);
    return finalShots.map((shot, i) => ({ ...shot, arcPosition: i + 1, aspectRatio: ar }));
  }

  if (recipe === 'product_haul') {
    // El arco del product haul se basa en los productos subidos, no en un arco fijo.
    const productManifest = buildProductHaulManifest((refs ?? {}) as PhotodumpRefs, count);
    const productShots    = buildProductHaulShotPlan(productManifest);
    const finalShots      = productShots.slice(0, productManifest.maxStoryShots);
    return finalShots.map((shot, i) => ({ ...shot, arcPosition: i + 1, aspectRatio: ar }));
  }

  if (recipe === 'outfit_week') {
    // Construir manifest completo con roles narrativos, cobertura y routing
    const weekManifest = buildWeeklyManifest((refs ?? {}) as PhotodumpRefs, count, basePrompt ?? '');
    const plan = weekManifest.shotPlan;
    // Convertir cada WeeklyShotPlan en un PhotodumpShotDirective con metadata de routing
    const directives = plan.slice(0, count).map((sp, i) =>
      weeklyRoleToDirective(sp, i, count, weekManifest.outfitSets, weekManifest.accessories)
    );
    return directives.map((d, i) => ({ ...d, arcPosition: i + 1, aspectRatio: ar }));
  }

  const isFaceless = narrative === 'faceless';

  const allShots: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] =
    isFaceless
      ? buildFacelessBTSShots()
      : protagonist === 'product'
        ? buildProductStoryShots()
        : buildPersonStoryShots();

  const moments = distributeMoments(count, protagonist, isFaceless);

  return moments.map((moment, i) => {
    const pool = allShots.filter(s => s.beat === moment);
    const shot = pool[i % Math.max(pool.length, 1)] ?? allShots[i % allShots.length];
    return { ...shot, beat: moment, arcPosition: i + 1, aspectRatio: ar };
  });
}

// Distribuye momentos visuales de forma orgánica, sin arco fijo.
// Garantiza variedad: nunca dos momentos del mismo tipo consecutivos.
// El orden varía según el count para evitar patrones repetitivos entre sesiones.
function distributeMoments(
  count:      number,
  protagonist: PhotodumpProtagonist,
  faceless:   boolean = false,
): MomentType[] {
  const personMoments: MomentType[] = [
    'candid', 'context', 'emotion', 'detail', 'atmosphere', 'candid',
  ];
  const productMoments: MomentType[] = [
    'context', 'texture', 'action', 'detail', 'atmosphere', 'reveal',
  ];
  // BTS faceless: cubre los 6 tipos de shots del pool buildFacelessBTSShots
  const facelessMoments: MomentType[] = [
    'context', 'action', 'detail', 'reveal', 'atmosphere', 'texture',
  ];

  const pool = faceless
    ? facelessMoments
    : protagonist === 'product'
      ? productMoments
      : personMoments;

  // Rotar el punto de inicio según el count para que distintos tamaños
  // de set empiecen con momentos diferentes (evita que "context" sea siempre primera)
  const offset = count % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];

  return rotated.slice(0, count);
}

// ── Person story shots ────────────────────────────────────────

function buildPersonStoryShots(): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  return [
    {
      key:   'CANDID_REAL_MOMENT',
      beat:  'candid',
      role:  'CANDID MOMENT',
      purpose: 'Captura espontánea — la persona no sabe que la están fotografiando o acaba de darse vuelta. Haciendo algo con las manos, mirando lejos, riendo sin motivo visible. La foto la tomó un amigo con el teléfono, no un fotógrafo.',
      requiredElements: ['candid_doing_something', 'face_engaged_not_posing_for_camera', 'action_has_intention', 'natural_hands_active'],
      forbiddenElements: ['looking_directly_at_camera_posed', 'static_purposeless_pose', 'hands_hanging_limp', 'catalog_stance', 'beautification', 'ad_feel'],
      variationSpace: [
        'tomando un café con ambas manos, cara levemente inclinada hacia la taza, vapor sutil',
        'mirando hacia la ventana o calle, perfil a tres cuartos, expresión pensativa',
        'riendo con alguien fuera de frame, cabeza levemente echada atrás, genuino',
        'ajustándose el cabello o ropa, ojos hacia abajo, pose sin conciencia de la cámara',
      ],
      framing:     'MEDIUM',
      composition: 'THREE_QUARTERS_OR_OFF_CENTER',
      cameraAngle: 'EYE_LEVEL_CANDID',
    },
    {
      key:   'CONTEXT_ENVIRONMENT',
      beat:  'context',
      role:  'CONTEXT MOMENT',
      purpose: 'Full body integrado al ambiente. La persona pertenece al lugar — no está posando ANTE el lugar. El espacio es visible y cuenta algo. Outfit completo visible. Pose con actitud: apoyada, sentada, caminando.',
      requiredElements: ['full_body_visible', 'natural_weight_shifted_pose', 'environment_clearly_visible_and_real', 'person_belongs_in_space', 'outfit_visible_complete'],
      forbiddenElements: ['mannequin_stiff_pose', 'catalog_symmetrical_stance', 'studio_backdrop', 'environment_neutral_blank', 'walking_motion_blur', 'beautification'],
      variationSpace: [
        'apoyada en pared o fachada, un pie cruzado ligeramente, mirando a cámara con actitud',
        'sentada en escalones o borde, codo en rodilla, expresión relajada',
        'de pie con peso en una cadera, bolso en mano, mirada lateral o directa',
        'caminando lento mirando a cámara, brazo en movimiento natural, calle de fondo',
      ],
      framing:     'WIDE',
      composition: 'FULL_BODY_NATURAL',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHTLY_LOW',
    },
    {
      key:   'EMOTION_FACE',
      beat:  'emotion',
      role:  'EMOTION MOMENT',
      purpose: 'Una expresión real y fuerte que conecta directamente con quien mira. Cara dominante, ángulo o encuadre inesperado, mood con carácter. No una pose — una reacción genuina capturada en el momento justo.',
      requiredElements: ['face_dominant_or_striking_angle', 'strong_emotion_or_mood', 'unexpected_composition', 'authentic_not_posed'],
      forbiddenElements: ['symmetric_catalog_pose', 'neutral_expression', 'ad_composition', 'product_forward', 'studio_feel', 'beautification', 'mannequin_stance'],
      variationSpace: [
        'close-up ladeado desde abajo, cara mirando hacia arriba y al frente, expresión segura, luz lateral',
        'medium shot desde arriba, persona mirando hacia el costado, pelo moviéndose, fondo desenfocado',
        'close-up de tres cuartos con fondo de colores, expresión intensa o risas, luz natural dura',
        'encuadre apretado desde costado, cara en perfil mirando a cámara al último momento',
      ],
      framing:     'MEDIUM_OR_CLOSE_UP',
      composition: 'ASYMMETRIC_OR_UNEXPECTED',
      cameraAngle: 'LOW_ANGLE_OR_EYE_LEVEL',
    },
    {
      key:   'DETAIL_FRAGMENT',
      beat:  'detail',
      role:  'DETAIL MOMENT',
      purpose: 'Un fragmento del mundo visible — un detalle de la ropa, la textura de un material, las manos con algo, un elemento del ambiente. Sin cara necesaria. El fragmento cuenta más que el todo.',
      requiredElements: ['detail_subject_fills_frame', 'texture_or_material_visible', 'real_context_background', 'intentional_framing'],
      forbiddenElements: ['face_dominant', 'full_body', 'forced_product_placement', 'studio_lighting', 'white_background', 'ad_composition'],
      variationSpace: [
        'manos sosteniendo o tocando elemento del outfit: hebilla, textura de tela, accesorio',
        'zapatos o pies en el contexto — caminando, en un umbral, sobre una superficie interesante',
        'overhead de lo que está sobre la mesa — taza, bolso, objetos del día',
        'fragmento del cuerpo: hombro, escote, detalle de ropa, joya — luz lateral que muestra textura',
      ],
      framing:     'CLOSE_UP_OR_EXTREME_CLOSE_UP',
      composition: 'DETAIL_FILL_FRAME',
      cameraAngle: 'TOP_DOWN_OR_MACRO_ANGLE',
    },
    {
      key:   'ATMOSPHERE_SELFIE',
      beat:  'atmosphere',
      role:  'ATMOSPHERE MOMENT',
      purpose: 'Selfie UGC auténtica — la persona se saca la foto a sí misma con el teléfono. El brazo extendido está fuera del frame o apenas visible en el borde. La cara es dominante. El ambiente envuelve la escena. DEBE renderizarse como selfie (POV de la propia persona tomándose la foto), NO como retrato de tercera persona.',
      requiredElements: ['face_dominant_natural', 'selfie_pov_framing', 'handheld_organic_feel', 'no_phone_visible_in_frame', 'background_atmosphere_visible'],
      forbiddenElements: ['phone_visible_in_frame', 'third_person_portrait_photographer_angle', 'person_with_arm_raised_photographed_by_someone_else', 'professional_lighting', 'symmetric_composition', 'studio_feel', 'beautification', 'person_posing_for_external_camera'],
      variationSpace: [
        'selfie frente a espejo o cámara frontal, cara levemente ladeada, fondo del cuarto o local visible, sonrisa natural',
        'selfie con fondo de calle, fachada o exterior borroso, cara dominante, expresión espontánea',
        'selfie interior, cara ligeramente levantada, fondo bokeh de café o ambiente cálido, expresión relajada',
        'selfie contrapicada suave, cara mirando hacia la cámara, exterior o cielo visible en el fondo',
      ],
      framing:     'SELFIE',
      composition: 'HANDHELD_ASYMMETRIC',
      cameraAngle: 'SLIGHT_UPWARD_FROM_HAND_LEVEL',
    },
    {
      key:   'REVEAL_ANGLE',
      beat:  'reveal',
      role:  'REVEAL MOMENT',
      purpose: 'Un ángulo que muestra algo diferente del mismo mundo: espalda de la persona, sombra proyectada, vista desde abajo, overhead del espacio. Un punto de vista que sorprende sin ser artificioso. IMPORTANTE: si se usa espejo, solo debe aparecer UNA sola persona en el frame — el reflejo y la persona son el mismo individuo, no dos.',
      requiredElements: ['strong_emotional_resonance', 'memorable_composition', 'authentic_mood', 'unexpected_angle_or_perspective', 'single_person_only'],
      forbiddenElements: ['neutral_generic_pose', 'catalog_composition', 'ad_cta_feel', 'beautification', 'overly_posed', 'two_people_in_frame', 'multiple_subjects', 'crowd_or_background_figures'],
      variationSpace: [
        'espalda parcial de la persona mirando hacia algo fuera de frame, ambiente visible de fondo, luz atmosférica desde el frente',
        'sombra proyectada de la persona sobre una pared o piso — la silueta como protagonista, no la persona',
        'overhead del espacio desde arriba — la persona pequeña dentro del ambiente, entorno visible a su alrededor',
        'ángulo rasante desde el suelo mirando hacia arriba, persona de pie, perspectiva inesperada, cielo o techo de fondo',
      ],
      framing:     'CLOSE_UP_OR_WIDE_ATMOSPHERIC',
      composition: 'EMOTIONALLY_DRIVEN',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHTLY_HIGH',
    },
  ];
}

// ── Faceless BTS shots ────────────────────────────────────────
// Pool para contenido 100% sin rostro: empaque, manos trabajando, unboxing,
// espacio de trabajo, texturas, despachos. No requiere avatarRef.

function buildFacelessBTSShots(): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  return [
    {
      key:   'BTS_WORKSPACE',
      beat:  'context',
      role:  'BTS WORKSPACE',
      purpose: 'El espacio de trabajo real — mesa, herramientas, materiales. Sin persona visible. El lugar cuenta la historia del proceso sin necesitar a nadie que lo explique.',
      requiredElements: ['workspace_visible', 'tools_or_materials_in_place', 'real_light_not_studio', 'organic_arrangement_not_staged'],
      forbiddenElements: ['face_or_person_visible', 'studio_lighting', 'white_background', 'catalog_composition', 'forced_branding'],
      variationSpace: [
        'overhead de mesa de trabajo con materiales, herramientas y el producto — luz de ventana',
        'medium shot del espacio de fondo con el producto visible en contexto real',
        'flat lay orgánico de los elementos del proceso: tijeras, etiquetas, cajas, el producto',
        'vista desde un lateral del espacio de trabajo, profundidad de campo, fondo desenfocado',
      ],
      framing:     'WIDE_OR_OVERHEAD',
      composition: 'WORKSPACE_IN_CONTEXT',
      cameraAngle: 'OVERHEAD_OR_EYE_LEVEL',
    },
    {
      key:   'BTS_HANDS_WORKING',
      beat:  'action',
      role:  'BTS HANDS IN ACTION',
      purpose: 'Manos activas haciendo algo real — empacando, sellando, escribiendo, preparando. Sin cara. El gesto dice todo sobre el proceso y el cuidado que hay detrás.',
      requiredElements: ['hands_active_in_frame', 'product_or_material_visible', 'action_has_clear_intention', 'real_context_visible'],
      forbiddenElements: ['face_visible', 'hands_limp_or_static', 'studio_surface', 'forced_demonstration', 'ad_composition'],
      variationSpace: [
        'manos empacando o sellando el producto, movimiento natural, superficie de trabajo visible',
        'manos escribiendo nota o etiqueta personalizada junto al producto',
        'manos sosteniendo el producto terminado desde abajo, luz natural desde arriba',
        'manos acomodando elementos dentro del packaging, proceso visible desde arriba',
      ],
      framing:     'CLOSE_UP_OR_MEDIUM',
      composition: 'HANDS_AND_PRODUCT',
      cameraAngle: 'SLIGHT_OVERHEAD_OR_EYE_LEVEL',
    },
    {
      key:   'BTS_PACKAGING',
      beat:  'detail',
      role:  'BTS PACKAGING DETAIL',
      purpose: 'El packaging de cerca — el detalle que enamora antes de que llegue. Textura del papel, cierre, etiqueta, cinta. Sin persona. La calidad habla sola.',
      requiredElements: ['packaging_detail_fills_frame', 'texture_or_material_visible', 'real_light_showing_depth', 'intentional_framing'],
      forbiddenElements: ['full_product_catalog_shot', 'face_visible', 'white_background', 'studio_lighting', 'forced_branding'],
      variationSpace: [
        'close-up del cierre del packaging — cinta, solapa, etiqueta — luz lateral que muestra textura',
        'overhead del packaging abierto con el producto dentro, vista desde arriba',
        'macro de la etiqueta o el branding impreso, fondo desenfocado',
        'producto dentro del packaging a medio cerrar, proceso de preparación visible',
      ],
      framing:     'CLOSE_UP_OR_EXTREME_CLOSE_UP',
      composition: 'DETAIL_FILL_FRAME',
      cameraAngle: 'TOP_DOWN_OR_MACRO_ANGLE',
    },
    {
      key:   'BTS_UNBOXING_MOMENT',
      beat:  'reveal',
      role:  'BTS UNBOXING REVEAL',
      purpose: 'El momento de apertura — el producto saliendo del packaging. El reveal que anticipa la experiencia del cliente. Puede haber manos pero no cara.',
      requiredElements: ['product_emerging_from_packaging', 'opening_or_reveal_gesture', 'real_context_surface', 'anticipation_in_the_frame'],
      forbiddenElements: ['face_visible', 'studio_backdrop', 'catalog_composition', 'product_fully_unwrapped_static'],
      variationSpace: [
        'manos abriendo la caja, producto asomando, fondo del espacio visible',
        'producto ya fuera del packaging, ambos visibles juntos sobre la superficie',
        'overhead del packaging abierto y el producto al lado, momento post-apertura',
        'close-up de la primera capa que se levanta — papel de seda, caja interior',
      ],
      framing:     'MEDIUM_OR_CLOSE_UP',
      composition: 'REVEAL_IN_PROGRESS',
      cameraAngle: 'SLIGHT_OVERHEAD_OR_EYE_LEVEL',
    },
    {
      key:   'BTS_DISPATCH_STACK',
      beat:  'atmosphere',
      role:  'BTS DISPATCH ATMOSPHERE',
      purpose: 'La atmósfera del proceso de despacho — cajas listas, pedidos apilados, el volumen del trabajo. Sin persona. Transmite actividad, comunidad de compradores, movimiento.',
      requiredElements: ['multiple_packages_or_orders_visible', 'real_workspace_light', 'sense_of_volume_or_movement', 'organic_arrangement'],
      forbiddenElements: ['face_visible', 'forced_perfect_arrangement', 'studio_lighting', 'catalog_symmetry'],
      variationSpace: [
        'overhead de varios pedidos listos sobre la mesa, etiquetas visibles, luz natural',
        'medium shot de una pila de cajas o bolsas preparadas en el espacio real',
        'close-up de una pila de paquetes, nombres o etiquetas apilados, fondo desenfocado',
        'lateral de la mesa de despacho con pedidos en distintas etapas de preparación',
      ],
      framing:     'MEDIUM_OR_WIDE',
      composition: 'VOLUME_AND_ATMOSPHERE',
      cameraAngle: 'EYE_LEVEL_OR_OVERHEAD',
    },
    {
      key:   'BTS_TEXTURE_CLOSE',
      beat:  'texture',
      role:  'BTS TEXTURE DETAIL',
      purpose: 'La textura del producto o del material con el que está hecho. Un close-up que hace que quien mira quiera tocarlo. Sin persona, sin packaging — solo el material.',
      requiredElements: ['extreme_close_up_texture', 'material_quality_visible', 'real_light_showing_depth', 'no_person_in_frame'],
      forbiddenElements: ['full_product_shot', 'white_background', 'studio_lighting', 'face_visible', 'forced_branding'],
      variationSpace: [
        'macro de la textura del material principal del producto — tela, cuero, cerámica, papel',
        'producto sobre superficie de contraste, sombra natural lateral que acentúa volumen',
        'close-up del acabado o terminación — costura, borde, pintura, grabado',
        'reflejo o brillo natural del material bajo luz de ventana, ángulo bajo',
      ],
      framing:     'EXTREME_CLOSE_UP',
      composition: 'TEXTURE_FILL',
      cameraAngle: 'MACRO_ANGLE',
    },
  ];
}

// ── Product story shots ────────────────────────────────────────

function buildProductStoryShots(): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  return [
    {
      key:   'CONTEXT_PRODUCT_WORLD',
      beat:  'context',
      role:  'CONTEXT MOMENT',
      purpose: 'El producto en su mundo real. No un shot de catálogo — un momento en que el producto aparece integrado a un ambiente de vida. El espacio cuenta tanto como el objeto.',
      requiredElements: ['product_dominant_in_frame', 'real_context_not_studio', 'striking_light_or_angle', 'texture_visible'],
      forbiddenElements: ['white_background', 'studio_lighting', 'catalog_composition', 'floating_product', 'ad_feel', 'text_overlay'],
      variationSpace: [
        'close-up del producto sobre una superficie de textura interesante — madera, mármol, tela',
        'producto en mano desde arriba, fondo del ambiente visible y contextualizador',
        'overhead del producto con otros elementos del día a su alrededor — café, flores, libro',
        'producto en perfil con luz lateral dura que muestra su forma y textura',
      ],
      framing:     'CLOSE_UP_OR_MEDIUM',
      composition: 'PRODUCT_FILLS_60_PERCENT',
      cameraAngle: 'LOW_ANGLE_OR_OVERHEAD',
    },
    {
      key:   'TEXTURE_PRODUCT_DETAIL',
      beat:  'texture',
      role:  'TEXTURE MOMENT',
      purpose: 'El detalle que enamora. Textura, materialidad, packaging, color. Un close-up que hace que quien mira quiera tocarlo. Sin contexto humano necesario.',
      requiredElements: ['extreme_close_up_texture', 'material_quality_visible', 'real_light_showing_depth'],
      forbiddenElements: ['full_product_catalog_shot', 'white_background', 'studio_lighting', 'face_in_frame', 'ad_branding'],
      variationSpace: [
        'macro de la textura de la superficie del producto — material, color, terminación',
        'close-up del packaging — tipografía, forma, detalle del cierre o apertura',
        'producto reflejando el ambiente en su superficie, luz jugando sobre él',
        'producto sobre tela o superficie de contraste, sombra natural lateral',
      ],
      framing:     'EXTREME_CLOSE_UP',
      composition: 'TEXTURE_FILL',
      cameraAngle: 'MACRO_ANGLE',
    },
    {
      key:   'ACTION_PRODUCT_IN_USE',
      beat:  'action',
      role:  'ACTION MOMENT',
      purpose: 'El producto siendo usado de forma real y natural. Manos activas, contexto de uso visible. No una demostración — un momento genuino en movimiento.',
      requiredElements: ['hands_using_product_naturally', 'product_clearly_visible', 'context_of_use_real', 'action_has_intention'],
      forbiddenElements: ['static_product_display', 'forced_demonstration', 'studio_feel', 'ad_composition', 'product_floating'],
      variationSpace: [
        'manos aplicando, sosteniendo o usando el producto, gesto natural y cotidiano',
        'producto en su contexto de uso — cocina, baño, mesa, cartera',
        'overhead de la acción de usar el producto, manos visibles desde arriba',
        'medium shot del producto en un momento casual real, no demostración',
      ],
      framing:     'MEDIUM',
      composition: 'HANDS_AND_PRODUCT',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHT_OVERHEAD',
    },
    {
      key:   'DETAIL_PRODUCT_FRAGMENT',
      beat:  'detail',
      role:  'DETAIL MOMENT',
      purpose: 'Un fragmento del producto o su entorno inmediato. Un detalle que se perdería en un shot general pero que aquí es el protagonista absoluto.',
      requiredElements: ['product_fragment_or_accessory_detail', 'real_surface_visible', 'intentional_tight_framing'],
      forbiddenElements: ['full_product_visible', 'ad_composition', 'studio_surface', 'forced_branding'],
      variationSpace: [
        'detalle del cierre, hebilla o terminación del producto, luz lateral que muestra profundidad',
        'producto parcialmente visible asomándose de un bolso, cajón o superficie',
        'fragmento del packaging — etiqueta, textura del papel, colores del diseño',
        'mano o dedo tocando el producto, solo el gesto visible, fondo desenfocado',
      ],
      framing:     'CLOSE_UP_OR_EXTREME_CLOSE_UP',
      composition: 'DETAIL_FILL_FRAME',
      cameraAngle: 'TOP_DOWN_OR_MACRO_ANGLE',
    },
    {
      key:   'ATMOSPHERE_PRODUCT_OVERHEAD',
      beat:  'atmosphere',
      role:  'ATMOSPHERE MOMENT',
      purpose: 'Overhead shot — flat lay orgánico con atmósfera. El producto con objetos que cuentan su mundo. No forzado ni simétrico — como si lo pusieran ahí de verdad. El mood del espacio es el protagonista.',
      requiredElements: ['overhead_angle', 'product_visible', 'complementary_objects_organic', 'real_surface_texture'],
      forbiddenElements: ['perfect_symmetric_flatlay', 'studio_surface', 'forced_brand_arrangement', 'ad_composition'],
      variationSpace: [
        'flat lay sobre madera o mármol con objetos cotidianos: libro, café, flores',
        'overhead sobre tela o cama, producto con accesorios del día',
        'overhead sobre superficie de exterior — pasto, piedra, terraza',
        'overhead con manos parcialmente visibles arreglando elementos alrededor del producto',
      ],
      framing:     'WIDE_OVERHEAD',
      composition: 'ORGANIC_FLATLAY',
      cameraAngle: 'DIRECTLY_OVERHEAD',
    },
    {
      key:   'REVEAL_PRODUCT_LIFESTYLE',
      beat:  'reveal',
      role:  'REVEAL MOMENT',
      purpose: 'El producto integrado al lifestyle desde un ángulo o perspectiva que revela su lugar en la vida real. No siendo demostrado — viviendo en el mundo. Un punto de vista que muestra algo nuevo del objeto o su contexto.',
      requiredElements: ['product_in_natural_scene', 'lifestyle_context_visible', 'product_not_highlighted_artificially'],
      forbiddenElements: ['product_isolated', 'ad_spotlight_on_product', 'catalog_background', 'forced_product_placement'],
      variationSpace: [
        'producto en su lugar natural — estante, mesa de noche, tocador — con luz ambiental',
        'producto parcialmente visible en el contexto — asomándose de una cartera o sobre una silla',
        'wide del espacio con el producto como elemento de la escena, no el centro',
        'producto con ambiente cálido que evoca el estilo de vida que representa',
      ],
      framing:     'WIDE_OR_MEDIUM',
      composition: 'PRODUCT_AS_ELEMENT_IN_SCENE',
      cameraAngle: 'OVERHEAD_OR_EYE_LEVEL',
    },
  ];
}

// ── Unboxing story shots ───────────────────────────────────────
// Arco narrativo lineal: empaque → apertura → detalles → avatar interactuando.
// El sistema distribuye los shots disponibles según el count pedido.


// ── Estilo de presentación de outfit ─────────────────────────
// La IA elige UNO por sesión. El estilo define cómo se abren los shots de prep
// y cómo evolucionan hacia el mirror check — cada uno tiene su propia lógica narrativa.


// Outfit Haul — manifest, styling graph, scoring, world map, shot planner y
// shot builders → movidos a ./recipes/outfitHaul.ts (Fase 2).



// Outfit Week — manifest, role templates, shot planner, coverage map y
// conversión a directive → movidos a ./recipes/outfitWeek.ts (Fase 3).

// ── Generación del plan ───────────────────────────────────────

export async function buildPhotodumpSessionPlan(
  narrative:   PhotodumpNarrative,
  protagonist: PhotodumpProtagonist,
  destino:     PhotodumpDestino,
  basePrompt:  string,
  recipe?:     string,
  refs?:       PhotodumpRefs,
  count:       number = 6,
  sessionId?:  string,
): Promise<PhotodumpSessionPlan> {
  initPhotodumpIntelligence();

  // weeklyFavoritesV2 — motor nuevo, no pasa por buildStoryDirectives ni por
  // ninguna lógica de outfitWeek.ts. El plan de fotos aquí es preliminar
  // (usa un ancla neutra de referencia): la política de referencias real y
  // definitiva de cada foto se recalcula en generatePhotodumpShot, una vez
  // que la foto ancla ya se generó y su modo real (identidad neutra / con
  // outfit definitivo / con outfit por estilo) está resuelto.
  if (recipe === 'outfit_week' && refs) {
    const provisionalAnchor: WeeklyFavoritesV2AnchorContract = { mode: 'world_only' };
    const { directives } = buildWeeklyFavoritesV2Directives(refs, count, provisionalAnchor);
    const shots: PhotodumpShotDirective[] = directives.map((d, i) => ({
      ...d,
      arcPosition: i + 1,
      aspectRatio: getAspectRatio(destino),
    }));
    const sessionFamilies = { storySupport: [], creatorAesthetic: [] };
    return {
      narrative,
      protagonist,
      destino,
      storyTheme: `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 50)}`,
      shots,
      assignedFamilies: [],
      sessionFamilies,
    };
  }

  // outfit_multi_look — motor propio, no pasa por buildStoryDirectives. Una
  // sola receta, 4 intenciones (weekly/then_vs_now/trip_recap/
  // curated_ideas) resueltas dentro de recipes/outfitMultiLook/. No necesita
  // un ancla provisional acá (a diferencia de outfit_week) porque el modo de
  // ancla (fija vs. cadena) se deriva directamente de la intención, sin
  // detección de estilo por IA de por medio.
  if (recipe === 'outfit_multi_look' && refs) {
    const { directives } = await buildOutfitMultiLookDirectives(refs, count, sessionId || basePrompt);
    const shots: PhotodumpShotDirective[] = directives.map((d, i) => ({
      ...d,
      arcPosition: i + 1,
      aspectRatio: getAspectRatio(destino),
    }));
    const sessionFamilies = { storySupport: [], creatorAesthetic: [] };
    return {
      narrative,
      protagonist,
      destino,
      storyTheme: `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 50)}`,
      shots,
      assignedFamilies: [],
      sessionFamilies,
    };
  }

  // day_in_life — multi-mundo: manifest de bloques + shot plan propio, sin pasar
  // por buildStoryDirectives (que asume un único mundo/REF0 para todo el set).
  if (recipe === 'day_in_life' && refs) {
    const manifest = buildDayInLifeManifest(refs, count, basePrompt);
    const plannedShots = buildDayInLifeShotPlan(manifest);
    const shots: PhotodumpShotDirective[] = plannedShots.map((d, i) => ({
      ...d,
      arcPosition: i + 1,
      aspectRatio: getAspectRatio(destino),
    }));
    const sessionFamilies = { storySupport: [], creatorAesthetic: [] };
    return {
      narrative,
      protagonist,
      destino,
      storyTheme: `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 50)}`,
      shots,
      assignedFamilies: [],
      sessionFamilies,
    };
  }

  // outfit_reveal_basic — motor propio, siempre 3 shots (mirror_check fijo +
  // 2 variaciones elegidas del banco de renderVariants.ts), sin importar
  // count ni looks — no pasa por buildStoryDirectives.
  if (recipe === 'outfit_reveal_basic' && refs) {
    const directives = buildOutfitRevealBasicDirectives(refs);
    const shots: PhotodumpShotDirective[] = directives.map((d, i) => ({
      ...d,
      arcPosition: i + 1,
      aspectRatio: getAspectRatio(destino),
    }));
    const sessionFamilies = { storySupport: [], creatorAesthetic: [] };
    return {
      narrative,
      protagonist,
      destino,
      storyTheme: `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 50)}`,
      shots,
      assignedFamilies: [],
      sessionFamilies,
    };
  }

  // outfit_night_out — motor propio, 1 shot de preparación fijo (mirror_check,
  // siempre presente) + shots opcionales de preparación (presentation/
  // tryon_detail, solo Completo/Extendido) + N momentos de noche rotados del
  // banco según el nivel elegido — no pasa por buildStoryDirectives.
  if (recipe === 'outfit_night_out' && refs) {
    const directives = await buildOutfitNightOutDirectives(refs, basePrompt, sessionId);
    const shots: PhotodumpShotDirective[] = directives.map((d, i) => ({
      ...d,
      arcPosition: i + 1,
      aspectRatio: getAspectRatio(destino),
    }));
    const sessionFamilies = { storySupport: [], creatorAesthetic: [] };
    return {
      narrative,
      protagonist,
      destino,
      storyTheme: `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 50)}`,
      shots,
      assignedFamilies: [],
      sessionFamilies,
    };
  }

  const isOutfitRecipe = recipe === 'outfit_check' || recipe === 'outfit_haul' || recipe === 'outfit_week';
  const presentationStyle = isOutfitRecipe
    ? resolveOutfitPresentationStyle(basePrompt, refs)
    : undefined;

  // outfit_check — poses/actitudes reales del banco (ver poseClient.ts).
  // Una sola llamada de red por sesión (todos los shot_type del set juntos),
  // ANTES de armar los shots — buildStoryDirectives sigue siendo síncrona.
  // seedKey usa sessionId cuando existe (mismo criterio que el resto del
  // pipeline) — sin sessionId, usa basePrompt como fallback determinístico
  // (nunca Math.random(): mismo brief en la misma sesión de pruebas debe
  // poder reproducirse). Si la llamada falla, sigue con un objeto vacío —
  // nunca bloquea la generación por esto (ver fetchOutfitCheckPoseCandidates).
  const outfitCheckSeedKey = sessionId || basePrompt;
  const outfitCheckPoseCandidates = recipe === 'outfit_check'
    ? await fetchOutfitCheckPoseCandidates(outfitCheckBankShotTypes(), outfitCheckSeedKey)
    : undefined;

  // outfit_check — Director Creativo GENÉRICO (ver director/generic/),
  // pedido explícito del usuario (sep 2026): "¿por qué no podría armar un
  // set entero acá si la herramienta está?" — en vez de reusar el director
  // solo para resolver el destino, la receta entera pasa a razonar con el
  // mismo Director Creativo que usaba outfit_night_out (banco real +
  // Gemini decidiendo/redactando libremente), con su propio
  // RecipeDirectorContract (ver recipes/outfitCheck/directorContract.ts).
  // Camino liviano (decisión del usuario): se enchufa DENTRO de este flujo
  // genérico en vez de replicar la arquitectura aislada de night_out — si
  // el director falla por cualquier motivo, cae al arco de vehículos fijos
  // ya existente (buildOutfitCheckShotPool/distributeOutfitCheckShots) sin
  // romper la generación, mismo principio de fallback no-negociable que ya
  // usaba night_out.
  let directorShots: PhotodumpShotDirective[] | null = null;
  if (recipe === 'outfit_check' && refs) {
    try {
      const referenceEntries: Array<{ role: string; url: string | null | undefined }> = [
        { role: 'identidad/rostro', url: refs.avatarRef },
        { role: 'cuerpo', url: refs.bodyRef },
        { role: 'outfit', url: refs.outfitRef },
        ...(refs.outfitRefs ?? []).map(url => ({ role: 'outfit', url })),
        { role: 'escena/destino', url: refs.sceneDestinoRef ?? refs.scenePruebaRef ?? refs.sceneRef },
      ];
      const referenceImages: GenericDirectorReferenceImage[] = [];
      for (const entry of referenceEntries) {
        if (!entry.url) continue;
        try {
          const compressed = await compressImageForUpload(entry.url, 768, 0.72);
          const extracted = extractImageData(compressed);
          if (extracted) referenceImages.push({ role: entry.role, data: extracted.data, mimeType: extracted.mimeType });
        } catch {
          // No bloquear el director por una imagen individual que falle en comprimir.
        }
      }
      const { plan, finalPrompts } = await runGenericDirector(basePrompt, 'outfit_check', count, referenceImages);
      const directives = buildOutfitCheckDirectorDirectives(plan.shots, finalPrompts, getAspectRatio(destino));
      if (directives.length > 0) {
        directorShots = directives.map((d, i) => ({ ...d, arcPosition: i + 1 }));
      }
    } catch (err) {
      console.warn('[outfit_check] Director Creativo falló, cayendo al arco de vehículos fijos:', err);
    }
  }

  const shots = directorShots
    ?? buildStoryDirectives(count, protagonist, destino, narrative, recipe, refs, presentationStyle, basePrompt, outfitCheckPoseCandidates, outfitCheckSeedKey);
  const sessionFamilies = selectSessionFamilies();
  const assignedFamilies = [...sessionFamilies.storySupport, ...sessionFamilies.creatorAesthetic];
  return {
    narrative,
    protagonist,
    destino,
    storyTheme: `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 50)}`,
    shots,
    assignedFamilies,
    sessionFamilies,
    presentationStyle,
  };
}

// Selecciona familias narrativas separadas por clase para la sesión.
// story_support: orgánicas, cálidas — para hook, development y closing.
// creator_aesthetic: más curadas — reservadas solo para shots de detalle/overhead.
// Devuelve ambas listas para que pickFamilyForBeat pueda elegir con criterio de tono.
export interface SessionFamilies {
  storySupport:       StorySupportFamily[];
  creatorAesthetic:   StorySupportFamily[];
}

function selectStorySupportFamilies(): StorySupportFamily[] {
  const { storySupport, creatorAesthetic } = selectSessionFamilies();
  return [...storySupport, ...creatorAesthetic];
}

function selectSessionFamilies(): SessionFamilies {
  const all = getStorySupportFamilies();
  const storySupport     = all.filter(f => f.usageClass === 'story_support');
  const creatorAesthetic = all.filter(f => f.usageClass === 'creator_aesthetic');
  // Ordenar cada grupo por avgScore descendente (ya viene ordenado desde getStorySupportFamilies)
  return { storySupport, creatorAesthetic };
}

// ── Generación REF0 (imagen ancla) ───────────────────────────

// ── Outfit lock completo (igual a Content Studio) ────────────
function buildOutfitLockBlock(outfitMode: PhotodumpOutfitMode, basePrompt: string, hasOutfitRef: boolean): string {
  if (outfitMode === 'keep') {
    return `OUTFIT LOCK:
- Maintain EXACTLY the outfit visible in the avatar reference image.
- Same garments, same color, same fit, same fabric texture.
- SHOE SPECIFICITY LOCK: Reproduce the exact shoe design from the avatar reference.
  Same number of straps, same strap routing, same heel shape and height, same toe shape,
  same hardware (buckles, clasps), same material finish, same color.
  Do NOT simplify, reinterpret, or generalize the shoe.
- Do NOT invent fabric continuation beyond what is visible in the reference.
- Do NOT add or remove garments. The outfit is already established.`;
  }
  if (outfitMode === 'upload' && hasOutfitRef) {
    return `OUTFIT LOCK (uploaded reference — binding):
- Copy the exact garments from the outfit reference image.
- Same color, fabric, cut, fit, and silhouette.
- SHOE SPECIFICITY LOCK: Reproduce the exact shoe design from the outfit reference.
  Same number of straps, same strap routing, same heel shape and height, same toe shape,
  same hardware (buckles, clasps), same material finish (patent, suede, matte), same color.
  Do NOT simplify, reinterpret, or generalize the shoe. It must be recognizably the same shoe.
- For close-up shots: ONLY show what physically exists in the reference. DO NOT invent fabric
  continuation, fake hems, or imaginary garment extensions beyond the visible framing.
- Tights/hosiery color and opacity MUST match the outfit reference exactly. Do NOT change them.
- This outfit OVERRIDES any clothing that might appear in the avatar or REF0 references.`;
  }
  // generate
  return `OUTFIT: Choose the most fitting outfit for this scene based on the story brief ("${basePrompt}"),
the narrative style, and the visual world. Keep it authentic, non-commercial, real-life appropriate.
Maintain visual consistency with the overall set once established.`;
}

// ── Asignar escena por posición en el arco narrativo ─────────
// shot 0-indexed; sceneRefs[0] es la escena principal, [1] y [2] son alternativas
export function getSceneRefForShot(refs: PhotodumpRefs, shotIndex: number, totalShots: number): string | null {
  const extras = (refs.sceneRefs ?? []).filter(Boolean) as string[];
  if (extras.length === 0) return refs.sceneRef;
  // Dividir el arco en tramos iguales según cuántas escenas haya (máx 3 en total)
  const allScenes = [refs.sceneRef, ...extras].filter(Boolean) as string[];
  if (allScenes.length === 1) return allScenes[0];
  const tramo = Math.floor(shotIndex / Math.ceil(totalShots / allScenes.length));
  return allScenes[Math.min(tramo, allScenes.length - 1)];
}

// ── Asignar outfit por posición en el arco narrativo ──────────
// Cada shot del haul muestra una prenda distinta. Si hay más shots que prendas,
// los shots sobrantes reciben null → el caller genera flat lay de la prenda.
export function getOutfitForShot(
  refs: PhotodumpRefs,
  shotIndex: number,  // 0-indexed (shot.arcPosition - 1)
): { outfitUrl: string | null; isFlatLay: boolean } {
  const outfitMode = refs.outfitMode ?? 'generate';
  if (outfitMode !== 'upload') return { outfitUrl: null, isFlatLay: false };

  const allOutfits = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
  if (allOutfits.length === 0) return { outfitUrl: null, isFlatLay: false };

  if (shotIndex < allOutfits.length) {
    // Shot con prenda asignada
    return { outfitUrl: allOutfits[shotIndex], isFlatLay: false };
  }
  // Shots sobrantes: flat lay — rota cíclicamente sobre las prendas disponibles
  const cycledIndex = shotIndex % allOutfits.length;
  return { outfitUrl: allOutfits[cycledIndex], isFlatLay: true };
}

// Infiere el género del avatar desde su foto de referencia.
// Se llama antes de generar para que HPI y captions usen el género correcto.
// Fallback silencioso: si la llamada falla, devuelve 'female'.
export async function inferAvatarGender(avatarRef: string): Promise<'female' | 'male' | 'neutral'> {
  try {
    const extracted = extractImageData(avatarRef);
    if (!extracted) return 'female';
    const result = await ugcApiService.inferGender({ imageData: extracted.data, mimeType: extracted.mimeType });
    return result.gender ?? 'female';
  } catch {
    return 'female';
  }
}

export async function generatePhotodumpREF0(
  refs:        PhotodumpRefs,
  narrative:   PhotodumpNarrative,
  protagonist: PhotodumpProtagonist,
  destino:     PhotodumpDestino,
  basePrompt:  string,
  sessionParams: { uid?: string; sessionId?: string },
  recipe?:     string,
  // outfit_check con count=1 (visibleCount, incluye REF0): mismo patrón que
  // outfit_night_out/level='una_foto' — el ÚNICO shot del set ES el ancla,
  // en vez de sumar un story shot aparte al mirror-check genérico de REF0.
  // Opcional y sin efecto en ninguna otra receta ni en outfit_check con más
  // de 1 foto — el resto del pipeline sigue exactamente igual.
  visibleCount?: number,
  // outfit_check con count>1 (sep 2026, pedido del usuario tras prueba 3:
  // "siento que ref0 sobra, es pagar demás por ella"): shots[0] del plan ya
  // armado (Director o arco legado) — cuando viene presente, generatePhotodumpREF0
  // genera ESA foto como ancla real en vez de un mirror-check genérico
  // aparte, mismo principio que outfit_multi_look/generateFixedAnchor.
  // Opcional y sin efecto en ninguna otra receta ni en outfit_check con
  // count===1 (ese caso ya resuelto por outfitCheckSingleShot más abajo).
  firstShot?: PhotodumpShotDirective,
): Promise<PhotodumpREF0Result> {

  // weeklyFavoritesV2 — motor nuevo, foto ancla resuelta por completo en su
  // propio archivo (identidad neutra / outfit definitivo / outfit por
  // estilo detectado). No pasa por ninguna lógica de outfitWeek.ts.
  // day_in_life — multi-mundo: genera una cadena de N REF0 (uno por bloque
  // detectado en el brief) en vez de un único ancla. El resultado completo se
  // cachea en recipes/dayInLife.ts; aquí solo se devuelve el REF0 del primer
  // bloque para no romper el contrato PhotodumpREF0Result que espera el resto
  // del pipeline (PhotodumpModule.tsx guarda ref0Url/ref0Analysis del retorno).
  if (recipe === 'day_in_life' && refs) {
    const manifest = buildDayInLifeManifest(refs, 6, basePrompt);
    const chainResult = await generateDayInLifeRef0Chain(
      manifest, refs, narrative, protagonist, destino, basePrompt, sessionParams,
    );
    return chainResult.primaryResult;
  }

  if (recipe === 'outfit_week') {
    const result = await generateWeeklyFavoritesV2REF0(refs, narrative, protagonist, destino, basePrompt, sessionParams);
    return { imageUrl: result.imageUrl, ref0Analysis: result.ref0Analysis, prompt: result.prompt, refsCount: result.refsCount };
  }

  if (recipe === 'outfit_multi_look') {
    const result = await generateOutfitMultiLookREF0(refs, narrative, protagonist, destino, basePrompt, 6, sessionParams);
    return { imageUrl: result.imageUrl, ref0Analysis: result.ref0Analysis, prompt: result.prompt, refsCount: result.refsCount };
  }

  if (recipe === 'outfit_reveal_basic') {
    return generateOutfitRevealBasicREF0(refs, destino, sessionParams);
  }

  if (recipe === 'outfit_night_out') {
    return generateOutfitNightOutREF0(refs, destino, basePrompt, sessionParams);
  }

  // outfit_check, count>1: la foto 1 real (Director o arco legado) ES el
  // ancla — se genera acá mismo (sin ref0Url propio, no lo necesita: el
  // Director ya resuelve continuidad con isMainPlace/needsPlaceAnchor sobre
  // fotos reales del banco, y el arco legado no depende de un REF0 previo
  // para su primer shot) y se cachea para que el loop principal, al llegar
  // a arcPosition===1, devuelva esta misma imagen en vez de generarla de
  // nuevo (ver chequeo espejo en generatePhotodumpShot).
  if (recipe === 'outfit_check' && firstShot && (visibleCount ?? 0) > 1) {
    const result = await generatePhotodumpShot(
      firstShot, refs, '', null, basePrompt, narrative, destino, sessionParams,
      [], { storySupport: [], creatorAesthetic: [] }, visibleCount, protagonist, recipe,
      undefined, undefined,
    );
    outfitCheckAnchorCache.set(outfitCheckAnchorCacheKey(refs, basePrompt), result.imageUrl);
    return { imageUrl: result.imageUrl, ref0Analysis: null, prompt: result.prompt, refsCount: result.refsCount };
  }

  const aspectInstr = getAspectInstruction(destino);
  const narrativeCtx = NARRATIVE_META[narrative].label;
  const isUnboxing = recipe === 'unboxing';

  // Referencia principal del protagonista
  const mainRef = refs.avatarRef ?? refs.productRef ?? refs.outfitRef ?? refs.sceneRef ?? refs.packagingRef;
  if (!mainRef) throw new Error('Se necesita al menos una referencia para generar el ancla visual.');

  const outfitMode = refs.outfitMode ?? 'generate';

  // ── Construir lista de referencias para REF0 ─────────────────
  const refsToPass: (string | null)[] = [];

  const isOutfitRecipe = recipe === 'outfit_check' || recipe === 'outfit_haul' || recipe === 'outfit_week';

  // ── outfit_week: REF0 debe ser un anchor neutral de sesión, no un "primer outfit" ──
  // Patch quirúrgico (Problema 1): REF0 en Weekly Favorites NO debe consumir un weekly
  // item como si fuera el look de la semana — eso contamina la receta (compite con los
  // heroes reales y le dice al modelo "usa este outfit" cuando el usuario subió varios).
  // Se calcula el dominantType con el mismo manifest liviano que usa el planner, sin
  // tocar la firma de buildPhotodumpSessionPlan ni el pipeline que llama a esta función.
  const weekRef0Info = recipe === 'outfit_week' ? (() => {
    try {
      const manifest = buildWeeklyManifest(refs, 6, basePrompt);
      // "Base outfit explícito" = el usuario marcó manualmente al menos un outfit como
      // look_completo (no 'auto') — señal de que ese outfit es la base de REF0, no un
      // item más a rotar. Sin esa señal manual, mixed nunca usa outfit en REF0.
      const hasExplicitBaseOutfit = (refs.haulOutfitKinds ?? []).some(k => k === 'look_completo');
      const mode: 'no_outfit' | 'no_product' | 'world_and_base_outfit' =
        manifest.dominantType === 'outfits' ? 'no_outfit'
        : (manifest.dominantType === 'mixed' && hasExplicitBaseOutfit) ? 'world_and_base_outfit'
        : 'no_outfit'; // products/skincare/beauty/tech/makeup/bags/footwear/jewelry/mixed-sin-base → nunca visten REF0 con un weekly item
      return { dominantType: manifest.dominantType, mode };
    } catch {
      return { dominantType: 'mixed' as import('./types').WeeklySetDominantType, mode: 'no_outfit' as const };
    }
  })() : undefined;

  // outfit_check, count=1: detección liviana (solo el booleano, el texto
  // completo de destino se arma más abajo en outfitCheckSingleShot) — usada
  // acá para decidir si refsToPass debe incluir sceneDestinoRef en vez de
  // scenePruebaRef/sceneRef, ANTES de que briefCtxForRef0 exista (se calcula
  // más abajo). Evita duplicar parseOutfitBriefContext 2 veces en la misma
  // función.
  const outfitCheckSingleShotDestinationCheck = (recipe === 'outfit_check' && visibleCount === 1)
    ? (() => {
        const ctx = parseOutfitBriefContext(basePrompt);
        return !!refs.sceneDestinoRef || (ctx.destinationClass !== 'none' && ctx.destinationClass !== 'generic_outing');
      })()
    : false;

  if (isUnboxing) {
    // Unboxing REF0: si hay avatar → ancla con persona sosteniendo/interactuando con el producto.
    // El avatar se pasa x2 (identidad suficiente sin dominar el presupuesto).
    // Si no hay avatar → product hero puro, empaque + producto son protagonistas.
    if (refs.avatarRef) {
      refsToPass.push(refs.avatarRef, refs.avatarRef);
    }
    // outfitRef opcional (decisión del usuario, sep 2026): por default unboxing hereda
    // la ropa que trae puesta el avatar de referencia — este slot solo entra si la
    // usuaria sube una prenda distinta para reemplazarla. Ver identityBlock/anchorShotDesc
    // más abajo para el texto que resuelve cuál de las 2 fuentes manda.
    if (refs.outfitRef) refsToPass.push(refs.outfitRef);
    // Empaque principal primero (es el protagonista visual de REF0 en unboxing)
    if (refs.packagingRef) refsToPass.push(refs.packagingRef);
    const extraPackaging = (refs.packagingRefs ?? []).filter(Boolean) as string[];
    extraPackaging.forEach(r => refsToPass.push(r));
    // Producto
    if (refs.productRef) refsToPass.push(refs.productRef);
    const extraProducts = (refs.productRefs ?? []).filter(Boolean) as string[];
    extraProducts.forEach(r => refsToPass.push(r));
    // Escena si existe
    if (refs.sceneRef) refsToPass.push(refs.sceneRef);
  } else if (isOutfitRecipe) {
    // Outfit REF0: avatar x3 (identidad dominante) + prendas del outfit (hasta 3) + escena de prueba o general
    if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
    if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
    // Prendas: primera prenda + hasta 2 adicionales para que el modelo entienda el look completo
    // outfit_week: SOLO si mode === 'world_and_base_outfit' (mixed con base explícita marcada
    // por el usuario). Para 'outfits'/'products'/'skincare'/etc. REF0 no debe recibir ningún
    // weekly item — ver weekRef0Info arriba (Problema 1 del patch).
    const skipOutfitRefsForWeek = recipe === 'outfit_week' && weekRef0Info?.mode !== 'world_and_base_outfit';
    if (!skipOutfitRefsForWeek) {
      const allOutfitRefs = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
      allOutfitRefs.slice(0, 3).forEach(r => refsToPass.push(r));
    }
    // Escena: outfit_check usa scenePruebaRef primero, las demás usan sceneRef.
    // Excepción (count=1 con destino, ver outfitCheckSingleShotDestinationCheck
    // arriba): la ÚNICA foto del set ocurre en el destino, no en el cuarto de
    // preparación — si el usuario subió una foto real del lugar destino, esa
    // es la referencia visual correcta acá, no la de preparación.
    const sceneForRef0 = recipe === 'outfit_check'
      ? (outfitCheckSingleShotDestinationCheck && refs.sceneDestinoRef
          ? refs.sceneDestinoRef
          : (refs.scenePruebaRef ?? refs.sceneRef))
      : refs.sceneRef;
    if (sceneForRef0) refsToPass.push(sceneForRef0);
  } else {
    // Comportamiento original para todas las demás recetas
    if (refs.avatarRef) {
      refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
    }
    if (refs.bodyRef) {
      refsToPass.push(refs.bodyRef);
    }
    if (outfitMode === 'upload' && refs.outfitRef) refsToPass.push(refs.outfitRef);
    if (refs.productRef) refsToPass.push(refs.productRef);
    const extraProducts = (refs.productRefs ?? []).filter(Boolean) as string[];
    extraProducts.forEach(r => refsToPass.push(r));
    if (refs.sceneRef) refsToPass.push(refs.sceneRef);
  }

  const extraProducts = (refs.productRefs ?? []).filter(Boolean) as string[];
  const extraPackaging = (refs.packagingRefs ?? []).filter(Boolean) as string[];

  const outfitInstruction = buildOutfitLockBlock(outfitMode, basePrompt, !!refs.outfitRef);

  // Instrucción de complexión cuando se subió bodyRef
  const bodyInstruction = refs.bodyRef
    ? `PHYSIQUE LOCK: The body reference establishes the person's real physique — height, build, and proportions.
Copy them faithfully. Do NOT generate a heavier, slimmer, taller, or shorter person than shown in the body reference.
The body reference is secondary to the face reference for identity but binding for proportions.`
    : '';

  // Instrucción de producto multi-ángulo
  const productInstruction = extraProducts.length > 0
    ? `PRODUCT MULTI-ANGLE: Multiple product reference images are provided showing the same product from different angles.
They all represent the SAME object. Use all angles to understand its exact shape, color, material, and details.
Reproduce the product faithfully — same design, same finish, same proportions.`
    : '';

  // Instrucción de empaque
  const packagingInstruction = refs.packagingRef
    ? `PACKAGING REFERENCE: The packaging/box images show the exact container the product comes in.
${extraPackaging.length > 0 ? `Multiple angles are provided — they all show the SAME packaging. ` : ''}Reproduce the packaging faithfully — same shape, color, design, and materials.
${!refs.packagingRef ? `No packaging reference provided — create a packaging consistent with the product and brief, and maintain it across all shots.` : ''}`
    : `PACKAGING: No reference provided — create a packaging that feels natural and consistent with the product. Maintain the same invented packaging across all shots.`;

  const isFaceless = narrative === 'faceless';
  const modeBlock  = isFaceless ? STORY_MODE_FACELESS : STORY_MODE_DOMINANCE;

  // protagonistLine y anchorShotDesc específicos según receta
  const protagonistLine = isUnboxing
    ? refs.avatarRef
      ? 'PROTAGONIST: The PRODUCT and its PACKAGING are the visual heroes. The PERSON frames the unboxing — present but not dominant. Show their face clearly in REF0 to establish identity for the set.'
      : 'PROTAGONIST: The PRODUCT and its PACKAGING are the sole visual heroes. No person. Show the packaging in context, pristine condition, real light.'
    : isOutfitRecipe
      ? 'PROTAGONIST: The PERSON is the hero. The OUTFIT defines the visual world. Full body — the look must be readable from head to toe. Natural, lived-in, authentic — NOT a catalog shot.'
      : isFaceless
        ? 'PROTAGONIST: NO FACE. Show the product, the workspace, or hands doing something real. No person visible.'
        : protagonist === 'product'
          ? 'PROTAGONIST: The PRODUCT is the hero. Show it in its natural context with real, atmospheric lighting.'
          : protagonist === 'person'
            ? 'PROTAGONIST: The PERSON is the hero. Natural medium shot, authentic expression, real environment.'
            : 'PROTAGONIST: The PERSON and PRODUCT together. Natural interaction, real context.';

  const briefCtxForRef0 = parseOutfitBriefContext(basePrompt);
  const hasUserSceneForRef0 = !!(refs.scenePruebaRef || refs.sceneRef);
  const prepEnvDirective = buildPrepEnvironmentDirective(briefCtxForRef0, hasUserSceneForRef0);
  const timeLabel = briefCtxForRef0.timeSignal === 'night' ? 'NIGHT — warm artificial light, no daylight'
    : briefCtxForRef0.timeSignal === 'golden_hour' ? 'GOLDEN HOUR — warm directional window light'
    : briefCtxForRef0.timeSignal === 'morning' ? 'MORNING — soft natural daylight'
    : briefCtxForRef0.timeSignal === 'afternoon' ? 'AFTERNOON — natural daylight'
    : 'AMBIENT — match the context of the prep space';

  // outfit_check, count=1 (visibleCount incluye REF0): el ÚNICO shot del set
  // ES el ancla — mismo patrón que outfit_night_out/level='una_foto'. Sin
  // esto, REF0 siempre sería el mirror-check genérico en el cuarto de
  // preparación, aunque el brief describa un destino real ("me veía
  // increíble para la cena en tal restaurante") — con 1 sola foto, esa es
  // precisamente la foto que mejor cuenta la historia completa, no el paso
  // intermedio de "antes de salir". hasDestination/destDesc/destShotOptions
  // reusan exactamente el mismo criterio que ya usa el story shot
  // OUTFIT_DESTINATION (buildOutfitCheckShotPool) — nunca se duplica lógica
  // de inferencia de destino en 2 lugares distintos.
  const outfitCheckSingleShot = (recipe === 'outfit_check' && visibleCount === 1) ? (() => {
    const hasDestino = !!refs.sceneDestinoRef;
    const hasDestination = hasDestino || (briefCtxForRef0.destinationClass !== 'none' && briefCtxForRef0.destinationClass !== 'generic_outing');
    const destDesc = briefCtxForRef0.destinationLabel ||
      (briefCtxForRef0.destinationClass !== 'none' ? briefCtxForRef0.destinationLabel : 'lifestyle setting — street, entrance, or ambient exterior that matches the outfit mood');
    const destShotOptions = briefCtxForRef0.destinationShotOptions?.length
      ? briefCtxForRef0.destinationShotOptions
      : [`full body en ${destDesc} — outfit completo visible, actitud natural, ambiente claramente reconocible`];
    return { hasDestination, destDesc, destShotOptions };
  })() : null;

  const outfitRecipeDesc: Record<string, string> = {
    outfit_check: outfitCheckSingleShot
      ? (outfitCheckSingleShot.hasDestination
        ? `SHOT: This is the ONLY photo of this set — it must tell the complete story by itself: "I chose this outfit and I looked incredible for this occasion, so I wanted to show it."
The person is AT THE DESTINATION with the COMPLETE OUTFIT on: ${outfitCheckSingleShot.destDesc}.
${outfitCheckSingleShot.destShotOptions[0]}
Full body or medium-to-full framing — the outfit must be clearly readable, but the FEELING (confident, "I looked incredible") matters more than a rigid head-to-toe checklist. A strong pose with character, a real sense of the destination, and visible outfit together tell this story better than a neutral centered full-body shot.
Time of day: ${timeLabel}
iPhone photo quality — candid, not a catalog shot. This establishes the person's identity, the outfit, AND closes the story in a single frame — there is no other shot to complete it.`
        : `SHOT: This is the ONLY photo of this set — it must tell the complete story by itself: "I chose this outfit and I looked incredible for this occasion, so I wanted to show it."
Full body mirror check with the COMPLETE OUTFIT on, in the getting-ready space — the look must be readable from head to toe, but the FEELING (confident, "I looked incredible") matters as much as showing every piece. Face visible, authentic attitude, not a catalog stance.
Time of day: ${timeLabel}

${prepEnvDirective}

iPhone photo quality. This establishes the person's identity, the outfit, AND closes the story in a single frame — there is no other shot to complete it.`)
      : `SHOT: Full body of the person with the COMPLETE OUTFIT on, in the getting-ready space.
Full body visible — the look must be readable from head to toe. Face visible, natural expression.
Time of day: ${timeLabel}

${prepEnvDirective}

iPhone photo quality. This establishes: the person's identity, the outfit, and the visual world for the set.`,
    outfit_haul: `SHOT: This is the anchor image for a clothing haul session.
The person is in a real bedroom, dressing room, or home fitting space — NOT a studio, NOT an office, NOT a retail store.
Several haul items are visible nearby as a natural collection — on a bed, chair, boxes, or bags. Not a catalog grid.
The image communicates: "I am about to try all of these pieces."
The person is NOT fully styled in a final look yet — this is pre-try-on energy.
Face visible, relaxed expression — casual haul opening, not editorial.

⛔ AVATAR/BODY CLOTHING FORBIDDEN IN REF0 — HARD RULE:
The avatar reference and body reference photos exist ONLY to establish face identity and body proportions.
ANY clothing visible on the avatar or body reference is IDENTITY DATA — it is NOT a haul item.
  • Do NOT show the person wearing the avatar's catsuit, bodysuit, base shirt, pants, or any garment from the avatar/body ref.
  • Do NOT interpret the avatar's base outfit as a haul garment to display or wear in REF0.
  • Do NOT let the avatar reference clothing become the visible outfit of the person in REF0.
In REF0, dress the person in NEUTRAL PREPARATION CLOTHING — completely separate from the avatar reference and the haul items:
  ALLOWED neutral prep looks (choose one):
    ✓ simple fitted white or grey tee + jeans
    ✓ casual knit top + leggings or joggers
    ✓ simple tank top + relaxed trousers
    ✓ comfortable lounge outfit — plain, no logo, no brand
  FORBIDDEN for REF0:
    ✗ Any outfit that appears to be one of the uploaded haul references
    ✗ Any clothing that matches the avatar/body reference clothing
    ✗ Black catsuit, bodysuit, sleek base outfit from the avatar ref
    ✗ Any editorial, branded, or catalog-style outfit
The neutral prep clothing must look visually secondary — it is the "before" state, not the main event.
It must NOT be mistaken for a haul product or reappear as a haul item in story shots.

⛔ PACKAGING AND SCENE — HARD RULES FOR REF0:
  • All shopping bags and boxes must be PLAIN, BLANK, UNBRANDED — solid color, no text, no logos.
  • Do NOT invent retail branding: ZARA, H&M, Shein, Forever21, or any store name.
  • Maximum 1-2 bags or boxes visible in REF0 — do NOT overload the scene.
  • Props: ONLY what would naturally be in the person's real room. No mirror, rack, or desk unless clearly present in a scene reference.

iPhone UGC realism: natural window light, slight handheld imperfection, real room texture, real skin.
No beauty filter. No editorial grade. No fashion campaign lighting. No studio polish.
This REF0 establishes: the person's identity, the real haul space, the iPhone UGC aesthetic, and the mood of the session.`,
    // outfit_week: REF0 es un anchor neutral de sesión — NUNCA "el primer outfit de la
    // semana" (patch quirúrgico Problema 1). El modo se decide arriba en weekRef0Info,
    // calculado desde el dominantType real del set antes de construir refsToPass.
    outfit_week: weekRef0Info?.mode === 'world_and_base_outfit'
      ? `SHOT: Full body of the person in a natural, real environment — this is the visual anchor for the entire weekly set.
The person wears a BASE OUTFIT that anchors the session styling (marked explicitly by the user as the base look — "world_and_base_outfit" mode). Full body visible and readable head to toe.
Real environment, authentic light — same room, same light direction, same ambient mood will anchor all subsequent shots.
iPhone photo quality. NOT a catalog. NOT a studio. NOT a white background.

⚠️ AVATAR BASE CLOTHING — HARD RULE:
The clothing visible in the avatar/body reference is ONLY for identity and body proportions.
Do NOT treat avatar base clothing as the base outfit or as any item of the week.
The person must wear the BASE OUTFIT reference explicitly marked by the user — not the avatar's base clothes.

⛔ NO EXTERNAL BRANDING:
Do NOT generate bags, boxes, or props with visible brand names.
Do NOT invent Zara, H&M, Shein, Topshop or any retail brand.
If props appear, they must be plain, generic, unbranded.

🛍️ SCENE PROP BUDGET:
Maximum 1–2 neutral props in the scene. No clutter. No boxes or bags unless organic and unbranded.
The space should feel real, tidy, and editorial — not a warehouse or a store.

REF0 establishes: identity, body proportions, lighting, room/world, session mood, AND the base outfit/styling for the week (explicitly marked by the user).`
      : `SHOT: Full body of the person in a natural, real environment — this is the visual anchor for the entire weekly set.
REF0 is NOT a weekly item shot. Do NOT use any uploaded weekly item (outfit, product, skincare, beauty, accessory) in this shot unless explicitly marked as base outfit.
${weekRef0Info?.dominantType === 'outfits' ? 'This set is dominated by weekly outfits — REF0 must NOT wear or reference any of the uploaded weekly outfits. It establishes the neutral session anchor only, not a "first look".' : ''}
${(weekRef0Info?.dominantType === 'products' || weekRef0Info?.dominantType === 'skincare' || weekRef0Info?.dominantType === 'beauty' || weekRef0Info?.dominantType === 'makeup' || weekRef0Info?.dominantType === 'tech') ? 'This set is dominated by products/skincare/beauty — REF0 must NOT show or hold any uploaded product. Clean room/world anchor only, no product in frame.' : ''}
If the avatar reference shows the person in simple neutral clothing, that is acceptable ONLY to dress the avatar for the shot — it is NOT a weekly item and must NOT compete with or resemble any uploaded weekly item.
Real environment, authentic light — same room, same light direction, same ambient mood will anchor all subsequent shots.
iPhone photo quality. NOT a catalog. NOT a studio. NOT a white background.

⚠️ AVATAR BASE CLOTHING — HARD RULE:
The clothing visible in the avatar/body reference is ONLY for identity and body proportions.
Do NOT treat avatar base clothing as a weekly item. Do NOT carry it over into other shots as a featured look.

⛔ NO EXTERNAL BRANDING:
Do NOT generate bags, boxes, or props with visible brand names.
Do NOT invent Zara, H&M, Shein, Topshop or any retail brand.
If props appear, they must be plain, generic, unbranded.

🛍️ SCENE PROP BUDGET:
Maximum 1–2 neutral props in the scene. No clutter. No boxes or bags unless organic and unbranded.
The space should feel real, tidy, and editorial — not a warehouse or a store.

REF0 establishes identity, body proportions, lighting, room/world, and session mood. REF0 is not a weekly item shot.`,
  };

  const anchorShotDesc = isUnboxing
    ? refs.avatarRef
      ? `SHOT: The person holding or interacting with the CLOSED packaging — face clearly visible, natural expression of anticipation or excitement.
Medium shot, waist up or 3/4. The packaging is prominent in frame. Real environment, natural light.
iPhone photo quality — handheld, authentic, lived-in. NOT a catalog shot.
This establishes: the person's identity, the product's packaging, and the unboxing world.`
      : `SHOT: The CLOSED packaging as the visual anchor — no person.
Medium shot or slight overhead. Packaging fills 60-70% of frame. Real surface, natural window light.
Shows the full packaging design: shape, color, branding. Authentic, not studio.
This establishes the visual world for the entire unboxing set.`
    : isOutfitRecipe
      ? (outfitRecipeDesc[recipe ?? ''] ?? outfitRecipeDesc['outfit_check'])
      : isFaceless
        ? `SHOT: Overhead or medium shot of the workspace/product — no face, no full body.
Hands may be visible if actively doing something. Real surface, natural window light, organic arrangement.
iPhone photo quality — handheld, imperfect, lived-in. NOT a catalog shot. NOT a styled flat lay.`
        : `SHOT: Natural medium shot (waist-up or 3/4 body). Authentic, candid, story-opening feel.
iPhone photo quality — handheld, natural light, real skin texture, no studio polish.
The person looks like they are living their life — not posing for a photographer.
Environment is real, light is natural or ambient, mood is aspirational but authentic.`;

  // Instrucción de outfit para las recetas outfit — prendas solas como referencia de identidad
  const allOutfitRefs = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
  const outfitRefInstruction = (isOutfitRecipe || isUnboxing) && allOutfitRefs.length > 0
    ? `OUTFIT REFERENCE (${allOutfitRefs.length} garment${allOutfitRefs.length > 1 ? 's' : ''} provided):
- The outfit reference image${allOutfitRefs.length > 1 ? 's show' : ' shows'} the exact garment${allOutfitRefs.length > 1 ? 's' : ''} the person wears in this set.
- Copy the garments EXACTLY: same color, fabric, cut, fit, silhouette, and details.
- SHOE SPECIFICITY LOCK: Reproduce the exact shoe design — same straps, heel, toe, hardware, material.
- These are photos of the garments ALONE — the person is NOT wearing them in the reference images.
- Use these references to understand the garment, then show the person wearing it naturally.
- Do NOT invent fabric continuation beyond what is visible. Do NOT add or remove garments.
${allOutfitRefs.length > 1 ? `- Multiple garments provided — in REF0, the person should wear the COMPLETE look (all or most pieces together).` : ''}`
    : '';

  // unboxing sin outfitRef: decisión explícita del usuario (sep 2026) — a diferencia de
  // TODAS las demás recetas con persona (donde la ropa del avatar es solo identidad, ver
  // GLOBAL_AVATAR_SUPPRESSION), acá el default es heredarla tal cual aparece en la
  // referencia. Antes esto pasaba de forma implícita y sin control (ninguna instrucción
  // lo pedía ni lo prohibía, simplemente era la única ropa visible en cualquier
  // referencia) — ahora queda explícito para que sea un comportamiento intencional y
  // no dependa de que el modelo "adivine" qué hacer con una imagen sin instrucción.
  const unboxingInheritAvatarClothingInstruction = (isUnboxing && refs.avatarRef && allOutfitRefs.length === 0)
    ? `WARDROBE: No separate outfit reference was provided — the person wears the SAME clothing visible in the face/avatar reference image, copied faithfully (same garment, color, fit). This is the intended default for this session, not a fallback to avoid.`
    : '';

  const identityBlock = isUnboxing
    ? refs.avatarRef
      ? `IDENTITY: Copy the face, hair, skin tone, and physical features EXACTLY from the face reference images.
${outfitRefInstruction}
${unboxingInheritAvatarClothingInstruction}
${productInstruction}
${packagingInstruction}`
      : `${productInstruction}
${packagingInstruction}`
    : isOutfitRecipe
      ? `IDENTITY: Copy the face, hair, skin tone, and physical features EXACTLY from the face reference images.
${refs.bodyRef ? bodyInstruction : ''}
${outfitRefInstruction}`
    : isFaceless
      ? `${productInstruction}`
      : `IDENTITY: Copy the face, hair, skin tone, and physical features EXACTLY from the face reference images.
${bodyInstruction}
${outfitInstruction}
${productInstruction}`;

  const briefContextBlock = extractBriefContextBlock(basePrompt, recipe);

  const prompt = `${LOCK_SYSTEM}

${PARADIGM_RULE}

${modeBlock}

${briefContextBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 REF0 — VISUAL ANCHOR SHOT

STORY CONTEXT: "${basePrompt}"
NARRATIVE: ${narrativeCtx}
FORMAT: ${aspectInstr}

This is the ANCHOR image — it defines the visual world for the entire story set.
It must establish: color temperature, lighting quality, surface texture, and overall mood.

${protagonistLine}

${anchorShotDesc}

${identityBlock}

Natural iPhone quality. UGC feel. One photo. Not a collage. Not a grid.

${NEGATIVE_FULL}`;

  const preparedRefs = await prepareRefs(refsToPass);
  const imageUrl = await imageApiService.generateImage({
    prompt,
    negative:        NEGATIVE_FULL,
    referenceImages: preparedRefs,
    aspectRatio:     getAspectRatio(destino),
    modelId:         'gemini',
    uid:             sessionParams.uid,
    sessionId:       sessionParams.sessionId,
    module:          'photodump',
    moduleLabel:     'Photodump Mode',
    shotIndex:       0,
    totalShots:      1,
    metadata:        { role: 'REF0_ANCHOR', narrative, protagonist },
  });

  // Analizar el REF0 para freezar luz y espacio
  let ref0Analysis: any = null;
  try {
    const extracted = extractImageData(imageUrl);
    if (extracted) {
      ref0Analysis = await ugcApiService.analyzeREF0({ imageData: extracted.data, mimeType: extracted.mimeType });
    }
  } catch (err) {
    console.warn('[photodumpDirector] REF0 analysis failed, proceeding without:', err);
  }

  return { imageUrl, ref0Analysis, prompt, refsCount: preparedRefs.length };
}

// ── Generación de shots narrativos ───────────────────────────

// Inyecta el análisis de REF0 con control de alcance.
// sceneRole: 'prep' (anclar escena), 'destination' (anclar solo identidad, no escena/luz),
//            undefined (comportamiento por defecto — full anchor)
export function injectREF0Analysis(ref0Analysis: any, sceneRole?: 'prep' | 'destination' | string): string {
  if (!ref0Analysis) return '';
  try {
    const l = ref0Analysis.lighting ?? {};
    const s = ref0Analysis.spatial  ?? {};

    if (sceneRole === 'destination') {
      // En el DESTINATION shot solo anclamos identidad, tono de piel y outfit.
      // La iluminación y el entorno son del destino — NO del prep space de REF0.
      return `
🔒 REF0 IDENTITY LOCK (apply only to person identity — NOT to scene or lighting):
- Skin tone rendering: SAME as REF0 — do NOT lighten or darken
- This shot takes place in the DESTINATION environment. The lighting and environment
  come from the destination, NOT from the prep space established in REF0.
- Do NOT replicate REF0's room, walls, furniture, or prep lighting in this shot.
`;
    }

    // Prep shots y shots neutros: anclar world style + luz, NO clutter específico.
    // Separar elementos en tres categorías: outfit items, clutter/movable, y arquitectura real.
    const OUTFIT_KEYWORDS = [
      'heel', 'shoe', 'shoes', 'boot', 'boots', 'sneaker',
      'bag', 'purse', 'clutch', 'handbag',
      'jacket', 'blazer', 'coat',
      'dress', 'skirt', 'pants', 'jeans', 'trousers',
      'top', 'shirt', 'blouse', 'tshirt',
      'corset', 'bustier', 'bodysuit',
      'accessory', 'accessories', 'jewelry', 'necklace', 'bracelet', 'earring',
      'scarf', 'hat', 'glove',
    ];
    const CLUTTER_KEYWORDS = [
      'cable', 'charger', 'laptop', 'phone', 'device',
      'makeup', 'cosmetic', 'bottle', 'cup', 'mug', 'glass',
      'random', 'loose', 'clutter', 'scattered', 'pile',
      'tissue', 'product container', 'skincare',
    ];
    const envElements = (s.elements ?? []).filter((el: string) => {
      const lower = el.toLowerCase();
      return !OUTFIT_KEYWORDS.some(kw => lower.includes(kw)) &&
             !CLUTTER_KEYWORDS.some(kw => lower.includes(kw));
    });
    return `
🔒 REF0 ANALYSIS LOCK — WORLD STYLE (not clutter):
- Lighting family: ${l.primarySource ?? 'natural'}, direction ${l.direction ?? 'ambient'}, temperature ${l.colorTemperature ?? 'warm'}, ${l.shadowType ?? 'soft'} shadows
- Space style: ${envElements.join(', ') || 'real interior'} — ${s.geometry ?? 'interior'}
- Color temperature: SAME as REF0 — do NOT shift warm/cool between shots
- Skin tone rendering: SAME as REF0 — do NOT lighten or darken

IMPORTANT: Lock the WORLD STYLE, not the exact arrangement.
- Same wall color, floor material, light family, and general room mood.
- Do NOT replicate exact object positions, clutter, or random items from REF0.
- Outfit items (shoes, bag, garments) are NOT fixed environment elements — they move per shot.
- Keep the space tidy and believable for the occasion — real UGC does not mean messy.
`;
  } catch { return ''; }
}

// Elige la familia narrativa más apropiada para un tipo de momento.
//
// Lógica de protagonista:
//   person  → preferir familias con compositionPattern.dominantElement === 'face'
//             (candid selfie, morning routine con persona) sobre flat lays de producto
//   product → preferir familias con dominantElement === 'product' (top-down, flat lay)
//
// Lógica de beat:
//   detail / texture             → creator_aesthetic primero (composición más curada)
//   atmosphere                   → story_support con 'mood_frame' o 'transition_frame'
//   context / reveal             → story_support con 'story_opener' o 'world_building'
//   emotion / candid / action    → story_support rotando por índice, priorizando face si person
//
// La rotación es por índice global del shot para que sea determinista por sesión.
export function pickFamilyForShot(
  beat:            MomentType,
  shotKey:         string,
  shotIndex:       number,
  sessionFamilies: SessionFamilies,
  protagonist:     PhotodumpProtagonist = 'person',
): StorySupportFamily | null {
  const { storySupport, creatorAesthetic } = sessionFamilies;
  if (storySupport.length === 0 && creatorAesthetic.length === 0) return null;

  const all = [...storySupport, ...creatorAesthetic];

  // Para persona: preferir familias donde la cara/persona domina el encuadre
  const faceFamilies = all.filter(f =>
    f.compositionPattern?.dominantElement === 'face'
  );
  // Para producto: preferir familias orientadas a producto (flat lay, top-down)
  const productFamilies = all.filter(f =>
    f.compositionPattern?.dominantElement === 'product'
  );

  // Shots de textura/detalle curados → creator_aesthetic (mejor composición para ese beat)
  const isCuratedShot = [
    'DETAIL_FRAGMENT', 'TEXTURE_PRODUCT_DETAIL', 'DETAIL_PRODUCT_FRAGMENT',
    'ATMOSPHERE_PRODUCT_OVERHEAD', 'BTS_PACKAGING', 'BTS_WORKSPACE',
  ].includes(shotKey);

  if (isCuratedShot && creatorAesthetic.length > 0) {
    // Para persona en shot curado: dentro de creator_aesthetic, preferir face si existe
    if (protagonist === 'person') {
      const faceAesthetic = creatorAesthetic.filter(
        f => f.compositionPattern?.dominantElement === 'face'
      );
      const pool = faceAesthetic.length > 0 ? faceAesthetic : creatorAesthetic;
      return pool[shotIndex % pool.length];
    }
    return creatorAesthetic[shotIndex % creatorAesthetic.length];
  }

  // Atmosphere: buscar familia con posición mood_frame o transition_frame
  if (beat === 'atmosphere') {
    const atmoPool = protagonist === 'person' && faceFamilies.length > 0
      ? faceFamilies
      : storySupport;
    const match = atmoPool.find(f =>
      f.storyFamilyValue?.recommendedSequencePositions?.some(
        p => ['mood_frame', 'transition_frame', 'context_frame'].includes(p)
      )
    );
    return match ?? atmoPool[atmoPool.length - 1] ?? storySupport[0] ?? null;
  }

  // Context / reveal: buscar familia con posición story_opener o world_building
  if (beat === 'context' || beat === 'reveal') {
    const ctxPool = protagonist === 'product' && productFamilies.length > 0
      ? productFamilies
      : storySupport;
    const match = ctxPool.find(f =>
      f.storyFamilyValue?.recommendedSequencePositions?.some(
        p => ['story_opener', 'world_building', 'early_context', 'opener'].includes(p)
      )
    );
    return match ?? ctxPool[0] ?? storySupport[0] ?? null;
  }

  // Emotion / candid: para persona, fuertemente preferir familia de cara
  if ((beat === 'emotion' || beat === 'candid') && protagonist === 'person') {
    if (faceFamilies.length > 0) return faceFamilies[shotIndex % faceFamilies.length];
  }

  // Action / todo lo demás: rotar story_support por índice
  if (storySupport.length > 0) {
    return storySupport[shotIndex % storySupport.length];
  }

  return creatorAesthetic[0] ?? null;
}

// Construye el bloque de texto que se inyecta en el prompt con la inteligencia
// narrativa de la familia seleccionada.
//
// Orden de prioridad en el bloque (mayor impacto primero):
//   1. promptBlock  — descripción visual concreta de una foto real de esa familia
//   2. compositionPattern — tipo de encuadre, luz, ritmo visual
//   3. psychologicalMechanisms — qué debe despertar emocionalmente esta imagen
//   4. narrativeBehavior — rol de este shot en la constelación
//   5. ejemplos de subfamilia — nombres de shots reales para anclar la referencia
//
// storyDirective se omite: contiene texto de sistema ("Familia Story Support — alto valor...")
// que no aporta guía creativa al modelo de imagen.
export function buildFamilyInjectBlock(family: StorySupportFamily): string {
  const lines: string[] = [
    '─────────────────────────────────────────────────────',
    '🎨 VISUAL FAMILY REFERENCE (use as creative direction — NOT as literal copy):',
  ];

  // 1. Referencia visual concreta — va primero para anclar el modelo visualmente
  if (family.promptBlock)
    lines.push(`  VISUAL REFERENCE: ${family.promptBlock}`);

  // 2. Patrón de composición
  if (family.compositionPattern) {
    const c = family.compositionPattern;
    if (c.preferredShotType)  lines.push(`  Shot type: ${c.preferredShotType}`);
    if (c.preferredLighting)  lines.push(`  Lighting: ${c.preferredLighting} — quality: ${c.lightQuality}`);
    if (c.visualRhythm)       lines.push(`  Visual rhythm: ${c.visualRhythm}`);
  }

  // 3. Mecanismos emocionales — qué debe sentir quien ve la imagen
  if (family.psychologicalMechanisms.length > 0)
    lines.push(`  Emotional register: ${family.psychologicalMechanisms.slice(0, 3).join(', ')}`);

  // 4. Comportamiento narrativo
  if (family.narrativeBehavior)
    lines.push(`  Narrative behavior: ${family.narrativeBehavior}`);

  // 5. Ejemplos de shots reales de esta familia
  const exampleLabels = family.subfamilies.slice(0, 2).map(s => s.label).filter(Boolean);
  if (exampleLabels.length > 0)
    lines.push(`  Shot examples from this family: ${exampleLabels.join(' · ')}`);

  lines.push('─────────────────────────────────────────────────────');
  return lines.join('\n');
}

export interface PhotodumpShotResult {
  imageUrl:  string;
  prompt:    string;
  refsCount: number;
  // Solo poblado por outfit_night_out por ahora — true si este shot vino del
  // Director Creativo (banco real + razonamiento de Gemini), false si vino
  // del banco estático de respaldo (director no corrió, o falló).
  usedDirector?: boolean;
}

// Lógica de alcance del estilo por shot:
//
// hands_presenter → ARRIVING + DETAIL ambos con formato hands (cada prenda se presenta con manos)
// rack_haul       → solo ARRIVING con rack; a partir del siguiente shot la persona ya aparece vistiéndose
// flat_lay        → solo ARRIVING con flat lay; el resto del set la persona ya está vistiendo/posando
// person_holding  → solo ARRIVING con persona sosteniendo; el resto evoluciona normalmente
//
// El bloque se inyecta solo en los shots donde el estilo sigue siendo relevante.
export function buildStyleCoherenceBlock(
  style:   OutfitPresentationStyle | undefined,
  shotKey: string,
): string {
  if (!style) return '';

  // hands_presenter: aplica a ARRIVING y DETAIL (presenta cada prenda con manos)
  if (style === 'hands_presenter') {
    if (shotKey !== 'OUTFIT_ARRIVING' && shotKey !== 'OUTFIT_DETAIL') return '';
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 SESSION STYLE LOCK — HANDS PRESENTER:
This set presents each garment using hands only — no full-body person, no rack, no flat lay.
For THIS shot: show a hand or hands holding/presenting the garment or accessory toward the camera.
The garment must be clearly readable. Real ambient background. No studio setup.
DO NOT generate a rack, flat lay, or full-body person presenting clothes.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  // rack_haul, flat_lay, person_holding: solo aplican a OUTFIT_ARRIVING
  // A partir del siguiente shot la persona ya está vistiéndose/posando — no imponer formato
  if (shotKey !== 'OUTFIT_ARRIVING') return '';

  const arrivingDescriptions: Record<Exclude<OutfitPresentationStyle, 'hands_presenter'>, string> = {
    rack_haul:
      'RACK HAUL — THIS OPENING SHOT shows the garments hanging on a rack or clothing rail. ' +
      'Hands may be arranging or touching the garments. Real room visible in background. ' +
      'DO NOT generate a flat lay, hands-only shot, or full-body person posing. The rack must be visible.',
    flat_lay:
      'FLAT LAY — THIS OPENING SHOT shows the complete outfit spread on a surface (bed, floor, chair). ' +
      'Overhead or low angle. Garments arranged naturally, not perfectly symmetric. ' +
      'DO NOT generate a rack, hands-only shot, or standing person. Garments on surface only.',
    person_holding:
      'PERSON HOLDING — THIS OPENING SHOT shows the person (mid-body, face visible) holding hangers ' +
      'or garments toward the camera. Conversational haul energy — "look what I picked". ' +
      'DO NOT generate a flat lay, rack-only shot, or hands-only shot. Face must be visible.',
  };

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 OPENING SHOT STYLE — ${style.toUpperCase()}:
${arrivingDescriptions[style as Exclude<OutfitPresentationStyle, 'hands_presenter'>]}
After this opening shot, the person appears wearing the outfit — posing, checking the mirror, etc.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ── Global Brief Tag → Ref Map ────────────────────────────────
// Parsea el brief y construye:
//   1. Orden de aparición de cada slot en el brief → reordena refs
//   2. Pairings explícitos: dos tags en la misma oración semántica → van juntos en el mismo shot
//   3. Orden secuencial: "primero @producto1, luego @producto4" → shots en ese orden
//   4. tagContext: bloque de texto para el prompt con el contexto semántico completo

interface BriefTagPairing {
  urlA:     string;   // URL de la ref A
  urlB:     string;   // URL de la ref B (va junto a A en el mismo shot)
  labelA:   string;   // e.g. "outfit slot 3"
  labelB:   string;   // e.g. "accessory slot 2"
  context:  string;   // fragmento del brief que establece el pairing
}

interface BriefTagSlotInfo {
  idx:      number;   // 0-based index en el array de URLs de ese tipo
  url:      string;
  label:    string;   // "outfit slot 2"
  tagRaw:   string;   // "@outfit2"
  type:     string;  // SlotType del catálogo
  briefCtx: string;   // 60 chars de contexto semántico alrededor del tag
  charPos:  number;   // posición en el brief (para detectar cercanía)
}

export interface BriefTagRefMap {
  outfit:     string[];         // reordenados según orden de @outfitN en el brief
  accesorio:  string[];         // reordenados según orden de @accesorioN
  producto:   string[];         // reordenados según orden de @productoN
  escena:     string[];         // reordenados según orden de @escenaN
  tagContext: string;           // bloque de texto para el prompt
  pairings:   BriefTagPairing[]; // pares de refs que deben ir juntos en el mismo shot
  sequence:   BriefTagSlotInfo[]; // todos los tags en orden de aparición en el brief
  hasAnyTag:  boolean;
}

// Palabras que indican orden secuencial
const SEQUENCE_WORDS = [
  'primero', 'después', 'luego', 'segundo', 'tercero', 'cuarto', 'quinto',
  'first', 'then', 'second', 'third', 'next', 'after',
];

function getUrlArrayForType(type: string, refs: PhotodumpRefs): string[] {
  if (type === 'outfit')    return [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
  if (type === 'accesorio') return (refs.accesorioRefs ?? []).filter(Boolean) as string[];
  if (type === 'producto')  return [refs.productRef, ...(refs.productRefs ?? [])].filter(Boolean) as string[];
  if (type === 'packaging') return [refs.packagingRef, ...(refs.packagingRefs ?? [])].filter(Boolean) as string[];
  if (type === 'escena')    return [refs.sceneRef, ...(refs.sceneRefs ?? [])].filter(Boolean) as string[];
  // persona, prop, textura, moodboard, pose, expresion: no tienen array en PhotodumpRefs aún
  // → devolver avatarRef para persona, vacío para el resto
  if (type === 'persona')   return [refs.avatarRef].filter(Boolean) as string[];
  return [];
}

export function buildBriefTagRefMap(brief: string, refs: PhotodumpRefs): BriefTagRefMap {
  const allOutfitUrls   = getUrlArrayForType('outfit',    refs);
  const allAccUrls      = getUrlArrayForType('accesorio', refs);
  const allProductoUrls = getUrlArrayForType('producto',  refs);
  const allEscenaUrls   = getUrlArrayForType('escena',    refs);

  const tagMatches = [...brief.matchAll(/@([a-záéíóúüñA-ZÁÉÍÓÚÜÑA-Za-z_]+\d*)/gi)];

  // Paso 1: construir info completa de cada tag encontrado en el brief
  const allSlotInfos: BriefTagSlotInfo[] = [];

  for (const m of tagMatches) {
    const rawTag  = m[0];  // "@outfit3"
    const parsed  = parseCatalogTag(rawTag);
    if (!parsed) continue;  // tag no reconocido por el catálogo → ignorar

    const { type, index: humanN } = parsed;
    const idx    = humanN - 1;

    const urlArr = getUrlArrayForType(type, refs);
    if (!urlArr[idx]) continue;  // slot no tiene imagen → ignorar

    const tagPos   = m.index ?? 0;
    const briefWin = brief.slice(Math.max(0, tagPos - 80), tagPos + 60);
    const briefCtx = briefWin.replace(/@[a-záéíóúüñA-ZÁÉÍÓÚÜÑA-Za-z_]+\d*/gi, '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const slotDef  = SLOT_CATALOG[type as keyof typeof SLOT_CATALOG];

    allSlotInfos.push({
      idx,
      url:      urlArr[idx],
      label:    `${slotDef?.label ?? type} slot ${humanN}`,
      tagRaw:   rawTag,
      type:     type as BriefTagSlotInfo['type'],
      briefCtx,
      charPos:  tagPos,
    });
  }

  // Paso 2: detectar pairings — dos tags separados por ≤120 chars con conector de pairing,
  // O dos tags en la misma oración (separados por punto/punto y coma = nueva oración)
  const pairings: BriefTagPairing[] = [];
  const briefLower = brief.toLowerCase();

  for (let i = 0; i < allSlotInfos.length; i++) {
    for (let j = i + 1; j < allSlotInfos.length; j++) {
      const a = allSlotInfos[i];
      const b = allSlotInfos[j];
      if (a.url === b.url) continue;  // mismo slot, no es pairing

      const posMin = Math.min(a.charPos, b.charPos);
      const posMax = Math.max(a.charPos, b.charPos);
      const gap    = posMax - posMin;
      if (gap > 150) continue;  // demasiado separados

      // Texto entre los dos tags
      const between = briefLower.slice(posMin, posMax);

      // ¿Hay un separador duro entre ellos? (punto, punto y coma, guión largo)
      const hardSeparator = /[.;]\s/.test(between.replace(/@\w+\d*/g, ''));
      if (hardSeparator && gap > 50) continue;

      // ¿Hay un conector de pairing entre ellos?
      const hasConnector = PAIRING_CONNECTORS.some(c => between.includes(c));

      // ¿Están en la misma oración Y son de tipos distintos? → pairing implícito
      const differentTypes = a.type !== b.type;
      const sameClause     = !hardSeparator && gap < 80;

      if (hasConnector || (differentTypes && sameClause)) {
        // Contexto del pairing: texto alrededor de ambos tags
        const ctxStart = Math.max(0, posMin - 30);
        const ctxEnd   = Math.min(brief.length, posMax + 40);
        const ctx      = brief.slice(ctxStart, ctxEnd).replace(/\s+/g, ' ').trim().slice(0, 120);

        pairings.push({ urlA: a.url, urlB: b.url, labelA: a.label, labelB: b.label, context: ctx });
      }
    }
  }

  // Paso 3: orden de aparición por tipo (para reordenar arrays de refs)
  const seenByType: Record<string, Set<number>> = { outfit: new Set(), accesorio: new Set(), producto: new Set(), escena: new Set() };
  const orderByType: Record<string, number[]>   = { outfit: [], accesorio: [], producto: [], escena: [] };

  for (const info of allSlotInfos) {
    if (!seenByType[info.type].has(info.idx)) {
      seenByType[info.type].add(info.idx);
      orderByType[info.type].push(info.idx);
    }
  }

  const reorder = (all: string[], order: number[]) => {
    const rest = all.map((_, i) => i).filter(i => !order.includes(i));
    return [...order, ...rest].map(i => all[i]).filter(Boolean) as string[];
  };

  // Paso 4: construir bloque de contexto para el prompt
  const hasAnyTag = allSlotInfos.length > 0;

  // Agrupar context lines por slot (deduplicar si el mismo slot aparece varias veces)
  const seenLabels = new Set<string>();
  const contextLines: string[] = [];
  for (const info of allSlotInfos) {
    if (seenLabels.has(info.label)) continue;
    seenLabels.add(info.label);
    if (info.briefCtx) contextLines.push(`  • ${info.tagRaw} → ${info.label}: "${info.briefCtx}"`);
  }

  const pairingLines = pairings.map(p =>
    `  ⟷ PAIR: ${p.labelA} + ${p.labelB} must appear TOGETHER in the same shot — "${p.context}"`
  );

  // Detectar secuencia explícita (primero X, luego Y)
  const sequenceLines: string[] = [];
  const hasSqWord = SEQUENCE_WORDS.some(w => briefLower.includes(w));
  if (hasSqWord && allSlotInfos.length > 1) {
    sequenceLines.push(`  📋 SEQUENCE: The user described items in this order: ${allSlotInfos.map(s => s.tagRaw).join(' → ')}. Respect this order across shots when possible.`);
  }

  const tagContext = hasAnyTag
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ REFERENCE SLOT DIRECTIVE (from user's brief — BINDING):
The user tagged reference images with semantic intent. Treat these as creative directions:
${contextLines.join('\n')}
${pairingLines.length > 0 ? '\n' + pairingLines.join('\n') : ''}
${sequenceLines.length > 0 ? '\n' + sequenceLines.join('\n') : ''}
When a PAIR is specified: both reference images MUST appear in the SAME shot — one worn/held/displayed alongside the other.
The image order passed to you in the references matches the slot numbers above.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : '';

  return {
    outfit:    reorder(allOutfitUrls,   orderByType['outfit']),
    accesorio: reorder(allAccUrls,      orderByType['accesorio']),
    producto:  reorder(allProductoUrls, orderByType['producto']),
    escena:    reorder(allEscenaUrls,   orderByType['escena']),
    tagContext,
    pairings,
    sequence:  allSlotInfos,
    hasAnyTag,
  };
}

// ── Visual Reference Contract ─────────────────────────────────────────────────
//
// Genera un bloque de texto que mapea EXPLÍCITAMENTE cada ítem del shot
// a su posición 1-based en el array de refs que se pasa al modelo.
// El modelo no sabe que "outfit_2" = imagen #6 del array — este bloque se lo dice.
//
// Diseñado para cualquier receta que use index routing (outfit_week, outfit_haul, futuras).
// NO hardcodea descripciones visuales — usa posición de la imagen como fuente de verdad.

export interface VisualRefContractEntry {
  refPosition: number;   // 1-based index en el array de refs
  role:        string;   // 'IDENTITY' | 'BODY' | 'WORLD' | 'OUTFIT_SLOT_N' | 'ACCESSORY_SLOT_N' | etc.
  instruction: string;   // qué debe hacer el modelo con esta imagen
  itemId?:     string;   // ID interno (outfit_2, acc_0)
  isForbiddenSource?: boolean;  // si es true, el modelo no puede tomar ropa de aquí
}

export interface VisualReferenceContract {
  entries:            VisualRefContractEntry[];
  primarySlotNames:   string[];   // 'OUTFIT_SLOT_3', 'ACCESSORY_SLOT_1', etc.
  secondarySlotNames: string[];
  forbiddenSlotNames: string[];
  avatarClothingForbidden: boolean;
  ref0ClothingForbidden:   boolean;
  contractBlock:      string;     // bloque de texto listo para insertar en prompt
}

export function buildVisualReferenceContract(
  refsToPass:        string[],
  weekPlan:          import('./types').WeeklyShotPlan | undefined,
  allOutfitUrls:     string[],
  allAccUrls:        string[],
  avatarRef?:        string,
  bodyRef?:          string,
  ref0Url?:          string,
  pairingsFromBrief?: { primaryItemId: string; secondaryItemId: string; context?: string }[],
  allProductUrls?:   string[],
): VisualReferenceContract {
  const entries: VisualRefContractEntry[] = [];

  // Mapear cada posición en el array de refs
  for (let i = 0; i < refsToPass.length; i++) {
    const url      = refsToPass[i];
    const pos      = i + 1;   // 1-based para el modelo

    // Identificar qué es esta imagen
    if (avatarRef && url === avatarRef) {
      entries.push({
        refPosition: pos,
        role:        'IDENTITY',
        instruction: 'Use for identity only: face, hair, skin tone, bone structure. DO NOT use the clothing in this image as a wardrobe item.',
        isForbiddenSource: true,
      });
      continue;
    }
    if (bodyRef && url === bodyRef) {
      entries.push({
        refPosition: pos,
        role:        'BODY',
        instruction: 'Use for body proportions only. DO NOT copy or use the clothing in this image.',
        isForbiddenSource: true,
      });
      continue;
    }
    if (ref0Url && url === ref0Url) {
      // REF0 contract condicional (patch Fase 2): por defecto es world_only (mundo/luz,
      // sin ropa), pero si el shot hereda el outfit base (useRef0AsBaseStyling), REF0
      // también aporta el look base — no es "forbidden source" para ese caso.
      const ref0ProvidesBaseOutfit = !!weekPlan?.useRef0AsBaseStyling;
      entries.push({
        refPosition: pos,
        role:        'WORLD_ANCHOR',
        instruction: ref0ProvidesBaseOutfit
          ? 'Use for room, environment, light quality, color temperature, AND the base outfit/styling the person is wearing — unless a primary item in this shot explicitly replaces part of that look.'
          : 'Use for room, environment, light quality, and color temperature only. DO NOT use clothing from this image as a wardrobe item.',
        isForbiddenSource: !ref0ProvidesBaseOutfit,
      });
      continue;
    }

    // Buscar en outfits
    const outfitIdx = allOutfitUrls.indexOf(url);
    if (outfitIdx >= 0) {
      const slotName = `OUTFIT_SLOT_${outfitIdx + 1}`;
      const isPrimary   = weekPlan?.primaryItemIds.includes(`outfit_${outfitIdx}`) ?? false;
      const isSecondary = weekPlan?.secondaryItemIds.includes(`outfit_${outfitIdx}`) ?? false;
      const isForbidden = weekPlan?.forbiddenItemIds?.includes(`outfit_${outfitIdx}`) ?? false;
      entries.push({
        refPosition: pos,
        role:        slotName,
        itemId:      `outfit_${outfitIdx}`,
        instruction: isPrimary
          ? (weekPlan?.replaceBaseOutfit
              ? `PRIMARY GARMENT — REPLACES ACTIVE ITEM (${weekPlan.activeItemReplaces ?? 'full_outfit'}): The person in this shot MUST wear exactly the clothing shown in this image, replacing the corresponding part of the REF0 base look. Preserve all colors, cuts, patterns, and visible details. This is the SOLE wardrobe protagonist for this shot.`
              : `PRIMARY GARMENT: The person in this shot MUST wear exactly the clothing shown in this image. Preserve all colors, cuts, patterns, and visible details. This is the SOLE wardrobe protagonist for this shot.`)
          : isSecondary
          ? `SECONDARY ITEM: This item appears alongside the primary item. Show it naturally integrated — do not invent styling not shown in the reference.`
          : isForbidden
          ? `⛔ FORBIDDEN: Do NOT show this outfit in this shot. It belongs to a different moment in the story.`
          : `CONTEXT ITEM: Present but not the shot protagonist.`,
        isForbiddenSource: isForbidden,
      });
      continue;
    }

    // Buscar en accesorios
    const accIdx = allAccUrls.indexOf(url);
    if (accIdx >= 0) {
      const slotName  = `ACCESSORY_SLOT_${accIdx + 1}`;
      const isPrimary   = weekPlan?.primaryItemIds.includes(`acc_${accIdx}`) ?? false;
      const isSecondary = weekPlan?.secondaryItemIds.includes(`acc_${accIdx}`) ?? false;

      // ¿Este accesorio está explícitamente pareado con algún outfit en este shot?
      const pairing = pairingsFromBrief?.find(
        p => p.secondaryItemId === `acc_${accIdx}` || p.primaryItemId === `acc_${accIdx}`
      );
      const pairedWithOutfitId   = pairing
        ? (pairing.primaryItemId.startsWith('outfit_') ? pairing.primaryItemId : pairing.secondaryItemId)
        : undefined;
      const pairedOutfitIdx      = pairedWithOutfitId
        ? parseInt(pairedWithOutfitId.replace('outfit_', ''), 10)
        : -1;
      const pairedOutfitSlotName = pairedOutfitIdx >= 0
        ? `OUTFIT_SLOT_${pairedOutfitIdx + 1}`
        : undefined;

      entries.push({
        refPosition: pos,
        role:        slotName,
        itemId:      `acc_${accIdx}`,
        instruction: isPrimary
          ? (weekPlan?.useRef0AsBaseStyling && weekPlan?.activeItemReplaces && weekPlan.activeItemReplaces !== 'none'
              ? `PRIMARY ACCESSORY — REPLACES ${weekPlan.activeItemReplaces.toUpperCase()} FROM BASE LOOK: The REF0 base outfit/styling applies to the rest of the look, but this piece replaces or is the featured ${weekPlan.activeItemReplaces} in this shot. This exact piece must appear clearly visible. Preserve its shape, material, color, and details exactly. Do NOT substitute another piece.`
              : weekPlan?.useRef0AsBaseStyling
              ? `PRIMARY ACCESSORY — INTEGRATED WITH BASE LOOK: The REF0 base outfit/styling applies. This exact piece must appear clearly visible, worn or held naturally with that look. Preserve its shape, material, color, and details exactly. Do NOT substitute another piece.`
              : `PRIMARY ACCESSORY: This exact piece must appear clearly visible in the shot. Preserve its shape, material, color, and details exactly. Do NOT substitute another piece.`)
          : isSecondary && pairedOutfitSlotName
          ? `INTEGRATED ACCESSORY (paired with ${pairedOutfitSlotName} per user's brief): This accessory must appear worn TOGETHER with ${pairedOutfitSlotName} in this shot — not as an isolated macro. Show it naturally worn as part of that look.`
          : isSecondary
          ? `INTEGRATED ACCESSORY: This piece appears alongside the primary outfit. Show it naturally worn or held — not as a macro close-up.`
          : `ACCESSORY CONTEXT: Present if space allows.`,
      });
      continue;
    }

    // Buscar en productos (skincare/beauty/producto genérico — patch Fase 4)
    const productIdx = (allProductUrls ?? []).indexOf(url);
    if (productIdx >= 0) {
      const slotName    = `PRODUCT_SLOT_${productIdx + 1}`;
      const isPrimary   = weekPlan?.primaryItemIds.includes(`producto_${productIdx}`) ?? false;
      const isSecondary = weekPlan?.secondaryItemIds.includes(`producto_${productIdx}`) ?? false;
      const isTechnicalOnly = !!weekPlan?.technicalReferenceOnly && isPrimary;
      entries.push({
        refPosition: pos,
        role:        slotName,
        itemId:      `producto_${productIdx}`,
        instruction: isTechnicalOnly
          ? `TECHNICAL REFERENCE: This image shows the product's packaging/texture/color for fidelity only — it is NOT a composition instruction. Reproduce the product faithfully (bottle/tube/jar shape, cap/dropper/pump, label, color, material, proportions, and formula identity) wherever it appears in the shot.`
          : isPrimary
          ? `PRIMARY PRODUCT — ACTIVE PRODUCT FOR THIS SHOT: This exact product is the active product for this shot. Preserve bottle/tube/jar shape, cap/dropper/pump, colors, label layout, material, proportions, and formula identity. Do NOT substitute another product. Do NOT invent extra products. Treat as product/skincare/beauty photography — never as jewelry or a wearable accessory.`
          : isSecondary
          ? `SECONDARY PRODUCT: This product appears alongside the primary item, naturally integrated — do not make it the focal point.`
          : `PRODUCT CONTEXT: Present if space allows, faithful to the reference.`,
      });
      continue;
    }

    // Otras refs (escena, etc.) — marcar como world context
    entries.push({
      refPosition: pos,
      role:        'SCENE_CONTEXT',
      instruction: 'Use for scene environment and background reference only.',
    });
  }

  // Construir listas de nombres de slot para los summaries
  const primarySlotNames: string[] = [];
  const secondarySlotNames: string[] = [];
  const forbiddenSlotNames: string[] = [];

  for (const e of entries) {
    if (!e.role.includes('_SLOT_')) continue;
    if (e.instruction.startsWith('PRIMARY'))   primarySlotNames.push(e.role);
    if (e.instruction.startsWith('SECONDARY') || e.instruction.startsWith('INTEGRATED')) secondarySlotNames.push(e.role);
    if (e.isForbiddenSource && e.role.includes('OUTFIT_SLOT')) forbiddenSlotNames.push(e.role);
  }

  const identityEntries  = entries.filter(e => e.role === 'IDENTITY');
  const bodyEntry        = entries.find(e => e.role === 'BODY');
  const worldEntry       = entries.find(e => e.role === 'WORLD_ANCHOR');
  const primaryEntries   = entries.filter(e => e.instruction.startsWith('PRIMARY'));
  const secondaryEntries = entries.filter(e => e.instruction.startsWith('SECONDARY') || e.instruction.startsWith('INTEGRATED'));
  const forbiddenEntries = entries.filter(e => e.isForbiddenSource && e.role.includes('SLOT'));

  // Construir el bloque de texto completo
  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🎯 VISUAL REFERENCE CONTRACT FOR THIS SHOT (BINDING — OBEY EXACTLY)',
    '',
  ];

  if (identityEntries.length > 0) {
    lines.push(`IDENTITY (image${identityEntries.length > 1 ? 's' : ''} #${identityEntries.map(e => e.refPosition).join(', #')}): Face, hair, skin tone, bone structure — identity anchor only. The clothing in these images is NOT a wardrobe item for this story.`);
  }
  if (bodyEntry) {
    lines.push(`BODY (image #${bodyEntry.refPosition}): Body proportions only. The clothing in this image is NOT a wardrobe item.`);
  }
  if (worldEntry) {
    lines.push(`WORLD ANCHOR (image #${worldEntry.refPosition}): ${worldEntry.instruction}`);
  }
  lines.push('');

  if (primaryEntries.length > 0) {
    lines.push('PRIMARY VISUAL ITEM(S) — THE WARDROBE SOURCE FOR THIS SHOT:');
    for (const e of primaryEntries) {
      lines.push(`  → Image #${e.refPosition} = ${e.role}: ${e.instruction}`);
    }
  }

  if (secondaryEntries.length > 0) {
    lines.push('');
    lines.push('SECONDARY / INTEGRATED ITEM(S):');
    for (const e of secondaryEntries) {
      lines.push(`  → Image #${e.refPosition} = ${e.role}: ${e.instruction}`);
    }
  }

  if (forbiddenEntries.length > 0) {
    lines.push('');
    lines.push('⛔ FORBIDDEN IN THIS SHOT — DO NOT SHOW:');
    for (const e of forbiddenEntries) {
      lines.push(`  ❌ Image #${e.refPosition} = ${e.role}: ${e.instruction}`);
    }
  }

  const ref0ProvidesBaseOutfit = !!weekPlan?.useRef0AsBaseStyling;

  lines.push('');
  lines.push('⛔ GLOBAL WARDROBE RULES (ALL SHOTS):');
  lines.push('  • NEVER use clothing visible in IDENTITY or BODY references as a weekly outfit or story item.');
  lines.push(ref0ProvidesBaseOutfit
    ? '  • The WORLD ANCHOR (REF0) base outfit applies UNLESS a PRIMARY GARMENT explicitly replaces it — see REPLACES ACTIVE ITEM instructions above.'
    : '  • NEVER use clothing from the WORLD ANCHOR (REF0) as a wardrobe item.');
  lines.push('  • If a PRIMARY GARMENT is assigned, the person MUST wear exactly that — no substitutions.');
  lines.push('  • If multiple outfit slots are uploaded, use ONLY the assigned slot for this shot.');
  lines.push('  • Do NOT generate any visible text, labels, numbers, watermarks, or UI overlays in the output image.');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return {
    entries,
    primarySlotNames,
    secondarySlotNames,
    forbiddenSlotNames,
    avatarClothingForbidden: true,
    ref0ClothingForbidden:   !ref0ProvidesBaseOutfit,
    contractBlock: lines.join('\n'),
  };
}

export async function generatePhotodumpShot(
  shot:               PhotodumpShotDirective,
  refs:               PhotodumpRefs,
  ref0Url:            string,
  ref0Analysis:       any,
  basePrompt:         string,
  narrative:          PhotodumpNarrative,
  destino:            PhotodumpDestino,
  sessionParams:      { uid?: string; sessionId?: string },
  assignedFamilies:   StorySupportFamily[] = [],
  sessionFamilies:    SessionFamilies = { storySupport: [], creatorAesthetic: [] },
  totalShots:         number = 4,
  protagonist:        PhotodumpProtagonist = 'person',
  recipe?:            string,
  presentationStyle?: OutfitPresentationStyle,
  haulManifest?:      HaulManifest,
): Promise<PhotodumpShotResult> {

  // ── Despacho a implementación dedicada por receta ──────────────────────────
  // outfit_week → weeklyFavoritesV2 (motor nuevo, reescritura completa, ver
  // recipes/weeklyFavoritesV2/). recipes/outfitWeek.ts (generateOutfitWeekShot)
  // queda importado más arriba pero desconectado — no se ejecuta para esta
  // receta mientras este return esté activo.
  if (recipe === 'outfit_week') {
    const result = await generateWeeklyFavoritesV2Shot(
      shot, refs, destino, sessionParams, shot.arcPosition - 1, totalShots, totalShots,
    );
    return { imageUrl: result.imageUrl, prompt: result.prompt, refsCount: result.refsCount };
  }

  // outfit_check, count=1 (totalShots===1): mismo patrón que
  // outfit_multi_look/outfit_reveal_basic/outfit_night_out — el ÚNICO story
  // shot del plan resuelve al mismo vehículo (mirror check o destino) que ya
  // se generó como REF0 (ver outfitCheckSingleShot en generatePhotodumpREF0)
  // — devuelve esa imagen ya generada en vez de gastar una segunda
  // generación real que nunca se muestra (PhotodumpModule.tsx trata este
  // caso con ref0IsFirstShot=true, sin recuadro de ancla aparte).
  if (recipe === 'outfit_check' && totalShots === 1) {
    return { imageUrl: ref0Url, prompt: '(mismo shot que el ancla — ver generatePhotodumpREF0)', refsCount: 0 };
  }

  // outfit_check, count>1: la foto 1 (shot.arcPosition===1) YA se generó
  // como ancla dentro de generatePhotodumpREF0 (ver bloque firstShot ahí) —
  // devuelve esa misma imagen cacheada en vez de generarla de nuevo. Red de
  // seguridad: si por algún motivo la caché no tiene el valor (llamada fuera
  // de orden), sigue de largo y genera normal — nunca bloquea el set por esto.
  if (recipe === 'outfit_check' && totalShots > 1 && shot.arcPosition === 1) {
    const cached = outfitCheckAnchorCache.get(outfitCheckAnchorCacheKey(refs, basePrompt));
    if (cached) {
      return { imageUrl: cached, prompt: '(mismo shot que el ancla — ver generatePhotodumpREF0)', refsCount: 0 };
    }
  }

  // outfit_multi_look — motor propio (ver recipes/outfitMultiLook/). Cada
  // shot corresponde a un look identificado en shot.outfitMultiLookPlan.
  if (recipe === 'outfit_multi_look') {
    const result = await generateOutfitMultiLookShot(
      shot, refs, destino, sessionParams, shot.arcPosition - 1, totalShots, totalShots, basePrompt, narrative, protagonist,
    );
    return { imageUrl: result.imageUrl, prompt: result.prompt, refsCount: result.refsCount };
  }

  // outfit_reveal_basic — motor propio (ver recipes/outfitRevealBasic/). Los
  // 3 shots son siempre los mismos, identificados en shot.outfitRevealBasicPlan.
  if (recipe === 'outfit_reveal_basic') {
    const result = await generateOutfitRevealBasicShot(
      shot, refs, destino, sessionParams, shot.arcPosition - 1, totalShots,
    );
    return { imageUrl: result.imageUrl, prompt: result.prompt, refsCount: result.refsCount };
  }

  // outfit_night_out — motor propio (ver recipes/outfitNightOut/). Cada shot
  // (fijo de preparación o del banco de momentos de noche) está identificado
  // en shot.outfitNightOutPlan.
  if (recipe === 'outfit_night_out') {
    const result = await generateOutfitNightOutShot(
      shot, refs, destino, basePrompt, sessionParams, shot.arcPosition - 1, totalShots,
    );
    return { imageUrl: result.imageUrl, prompt: result.prompt, refsCount: result.refsCount, usedDirector: result.debug.usedDirector };
  }

  // day_in_life — multi-mundo: cada shot se ancla al REF0 de SU bloque (no al
  // ref0Url/ref0Analysis genéricos que recibe esta función), recuperado de la
  // cadena cacheada al generar REF0. shot.key trae el blockId embebido
  // (ej. "ESTABLISH_BLOCK_1") por buildDayBlockShot en recipes/dayInLife.ts.
  if (recipe === 'day_in_life') {
    const manifest = buildDayInLifeManifest(refs, totalShots, basePrompt);
    const chainResult = getCachedDayInLifeRef0Chain(refs, basePrompt);
    const matchedBlock = manifest.blocks.find(b => (shot.key ?? '').toUpperCase().includes(b.id.toUpperCase()));
    const chainEntry = chainResult?.chain.find(c => c.blockId === (matchedBlock?.id ?? manifest.blocks[0].id));
    const blockRef0Url = chainEntry?.imageUrl ?? ref0Url;

    const avatarRefs = [refs.avatarRef, refs.bodyRef].filter(Boolean) as string[];
    const isCompanionShot = (shot as any).role === 'BLOCK_COMPANION' || (shot.key ?? '').startsWith('COMPANION_');
    const companionRef = manifest.companionRefs[0] ?? null;

    const refsToPass: string[] = [
      blockRef0Url,
      ...avatarRefs,
      ...manifest.sharedOutfitRefs.slice(0, 2),
      ...(isCompanionShot && companionRef ? [companionRef] : []),
    ].filter(Boolean) as string[];

    const lockBlock = chainEntry ? buildDayBlockLockBlock(chainEntry.fingerprint, matchedBlock?.label ?? '') : '';

    const promptParts = [
      LOCK_SYSTEM,
      lockBlock,
      PARADIGM_RULE,
      STORY_MODE_DOMINANCE,
      `SHOT PURPOSE: ${shot.purpose}`,
      `VARIATION: ${shot.variationSpace[Math.floor(Math.random() * shot.variationSpace.length)] ?? shot.variationSpace[0] ?? ''}`,
      shot.requiredElements.length ? `REQUIRED: ${shot.requiredElements.join(', ')}` : '',
      shot.forbiddenElements.length ? `FORBIDDEN: ${shot.forbiddenElements.join(', ')}` : '',
      isCompanionShot && !companionRef ? '⚠️ No companion reference was uploaded — do NOT invent a second person. Show the protagonist alone in a social-feeling moment instead.' : '',
    ].filter(Boolean);

    const prompt = promptParts.join('\n\n');
    const preparedRefs = await prepareRefs(refsToPass);
    const imageUrl = await imageApiService.generateImage({
      prompt,
      negative:        NEGATIVE_FULL,
      referenceImages: preparedRefs,
      aspectRatio:     getAspectRatio(destino),
      modelId:         'gemini',
      uid:             sessionParams.uid,
      sessionId:       sessionParams.sessionId,
      module:          'photodump',
      moduleLabel:     'Photodump Mode',
      shotIndex:       shot.arcPosition,
      totalShots,
      metadata:        { role: shot.role, blockId: matchedBlock?.id, shotKey: shot.key },
    });

    return { imageUrl, prompt, refsCount: preparedRefs.length };
  }

  const aspectInstr = getAspectInstruction(destino);
  const isUnboxing  = recipe === 'unboxing';

  const outfitMode = refs.outfitMode ?? 'generate';

  // ── Brief tag → ref map (todas las recetas) ───────────────────
  // Si el brief contiene @tags, reordena las refs según el orden de aparición en el brief
  // y construye un bloque de texto para el prompt con el contexto semántico de cada slot.
  const briefTagMap = basePrompt.includes('@') ? buildBriefTagRefMap(basePrompt, refs) : null;

  // ── Outfit por shot: cada prenda se asigna a un shot distinto ─
  // Si hay tag map, usar los outfits reordenados por brief
  const outfitRefsForRotation = briefTagMap?.outfit.length ? briefTagMap.outfit : undefined;
  const { outfitUrl: outfitForThisShot, isFlatLay } = getOutfitForShot(
    outfitRefsForRotation ? { ...refs, outfitRef: outfitRefsForRotation[0] ?? refs.outfitRef, outfitRefs: outfitRefsForRotation.slice(1) } : refs,
    shot.arcPosition - 1,
  );

  // ── Budget de referencias por shot ───────────────────────────
  const refsToPass: string[] = [];

  if (isUnboxing) {
    // Unboxing: producto y empaque son protagonistas, avatar es secundario.
    // Slots: ref0(1) + avatar x2 si existe(2) + outfit(0-1) + empaque(1-2) + producto(1-2) + escena(1) = máx 10
    refsToPass.push(ref0Url);
    if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef);
    // outfitRef opcional (ver identityBlock del REF0 más arriba) — se repite acá además
    // de la continuidad visual con ref0Url para reforzar fidelidad de la prenda en
    // shots donde se ve de cerca (ej. PRODUCT_IN_USE), mismo patrón que isOutfitRecipe.
    if (refs.outfitRef) refsToPass.push(refs.outfitRef);
    if (refs.packagingRef) refsToPass.push(refs.packagingRef);
    const extraPackaging = (refs.packagingRefs ?? []).filter(Boolean) as string[];
    // En shots de detalle de producto, no pasar empaque extra para dar espacio al producto
    const isProductDetailShot = shot.key === 'UNBOXING_PRODUCT_DETAIL' || shot.key === 'UNBOXING_PRODUCT_IN_USE';
    if (!isProductDetailShot) extraPackaging.forEach(r => refsToPass.push(r));
    if (refs.productRef) refsToPass.push(refs.productRef);
    const extraProducts = (refs.productRefs ?? []).filter(Boolean) as string[];
    extraProducts.slice(0, isProductDetailShot ? 2 : 1).forEach(r => refsToPass.push(r));
    const sceneForShot = getSceneRefForShot(refs, shot.arcPosition - 1, totalShots);
    if (sceneForShot) refsToPass.push(sceneForShot);
  } else if (recipe === 'outfit_haul') {
    // ── Haul: routing de referencias por tipo de shot ─────────
    // Cada shot recibe SOLO lo que necesita — routing por itemId del manifest,
    // NO por índice crudo de allOutfits. Fallback a índice solo si manifest no tiene el ítem.
    const allOutfits    = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
    const allAccesorios = (refs.accesorioRefs ?? []).filter(Boolean) as string[];
    const shotKey       = shot.key ?? '';
    const m             = haulManifest ?? buildHaulManifest(refs, 20);

    // Helper: buscar ref de ítem por ID en el manifest
    const getRefByItemId = (itemId: string): string | undefined =>
      m.allItems.find(it => it.id === itemId)?.refUrl;

    // Helper: refs para los worn/held items del haulItemPlan del shot
    const getItemPlanRefs = (): string[] => {
      const plan = shot.haulItemPlan;
      if (!plan) return [];
      const worn = plan.wornItems.map(getRefByItemId).filter(Boolean) as string[];
      const held = plan.heldItems.map(getRefByItemId).filter(Boolean) as string[];
      // dedup
      const seen = new Set<string>();
      return [...worn, ...held].filter(r => { if (seen.has(r)) return false; seen.add(r); return true; });
    };

    refsToPass.push(ref0Url);  // REF0 siempre presente

    if (shotKey.startsWith('HAUL_ACCESSORY_CLOSEUP_')) {
      // close-up: accesorio específico + avatar mínimo para contexto corporal
      const accIdx = parseInt(shotKey.replace('HAUL_ACCESSORY_CLOSEUP_', ''), 10) - 1;
      if (refs.avatarRef) refsToPass.push(refs.avatarRef);
      // Buscar por ID desde manifest — fallback a índice de accesorioRefs
      const accItem = m.accessoryItems.filter(it => it.kind !== 'bag' && it.kind !== 'jewelry')[accIdx];
      const accRef  = accItem?.refUrl ?? allAccesorios[accIdx];
      if (accRef) refsToPass.push(accRef);

    } else if (shotKey === 'HAUL_OVERVIEW') {
      // overview: avatar + todos los ítems del haul (máx 6 refs de prendas)
      if (refs.avatarRef) refsToPass.push(refs.avatarRef);
      m.allItems.slice(0, 6).forEach(it => { if (it.refUrl) refsToPass.push(it.refUrl); });
      if (refs.sceneRef) refsToPass.push(refs.sceneRef);

    } else if (shotKey.startsWith('HAUL_TRY_ON_') || shotKey === 'HAUL_SELECTION') {
      // try-on/selection: avatar x2 + la prenda específica por ID del manifest
      if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef);
      if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
      // Resolver por plan de ítems del shot (primaryItems / wornItems) si existe
      const planRefs = getItemPlanRefs();
      if (planRefs.length > 0) {
        planRefs.forEach(r => refsToPass.push(r));
      } else {
        // Fallback: resolver por índice numérico del shotKey
        let itemIdx = 0;
        if (shotKey.startsWith('HAUL_TRY_ON_')) {
          itemIdx = parseInt(shotKey.replace('HAUL_TRY_ON_', ''), 10) - 1;
        } else {
          itemIdx = Math.max(0, m.outfitItems.length - 1);
        }
        const item = m.outfitItems[itemIdx] ?? m.tryOnItems[itemIdx];
        if (item?.refUrl) refsToPass.push(item.refUrl);
        else if (allOutfits[itemIdx]) refsToPass.push(allOutfits[itemIdx]);
      }

    } else if (shotKey.startsWith('HAUL_ADJUSTING_')) {
      // adjusting: avatar x2 + misma prenda — resolver por manifest
      if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef);
      if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
      const planRefs = getItemPlanRefs();
      if (planRefs.length > 0) {
        planRefs.forEach(r => refsToPass.push(r));
      } else {
        const itemIdx = Math.max(0, parseInt(shotKey.replace('HAUL_ADJUSTING_', ''), 10) - 1);
        const item    = m.outfitItems[itemIdx];
        if (item?.refUrl) refsToPass.push(item.refUrl);
        else if (allOutfits[itemIdx]) refsToPass.push(allOutfits[itemIdx]);
      }

    } else if (shotKey.startsWith('HAUL_DETAIL_')) {
      // detalle de prenda: solo la prenda + avatar mínimo (manos)
      if (refs.avatarRef) refsToPass.push(refs.avatarRef);
      const planRefs = getItemPlanRefs();
      if (planRefs.length > 0) {
        planRefs.forEach(r => refsToPass.push(r));
      } else {
        const itemIdx = Math.max(0, parseInt(shotKey.replace('HAUL_DETAIL_', ''), 10) - 1);
        const item    = m.outfitItems[itemIdx];
        if (item?.refUrl) refsToPass.push(item.refUrl);
        else if (allOutfits[itemIdx]) refsToPass.push(allOutfits[itemIdx]);
      }

    } else if (shotKey.startsWith('HAUL_FOOTWEAR_')) {
      // footwear: calzado + avatar + ref de outfit compatible si hay integración
      const footwearIdx = Math.max(0, parseInt(shotKey.replace('HAUL_FOOTWEAR_', ''), 10) - 1);
      if (refs.avatarRef) refsToPass.push(refs.avatarRef);
      // Resolver por ID del manifest — priorizar footwearItems, luego accessoryFootwear
      const allFw = [...m.footwearItems, ...m.accessoryItems.filter(it => it.kind === 'footwear')];
      const fwItem = allFw[footwearIdx];
      if (fwItem?.refUrl) refsToPass.push(fwItem.refUrl);
      // Si hay integración con outfit, pasar también la ref del outfit
      const plan = shot.haulItemPlan;
      if (plan?.wornItems) {
        plan.wornItems.filter(id => id !== fwItem?.id).forEach(id => {
          const ref = getRefByItemId(id);
          if (ref) refsToPass.push(ref);
        });
      }

    } else if (shotKey.startsWith('HAUL_BAG_')) {
      // bolso: bag + avatar + ref de outfit compatible si hay integración
      const bagIdx  = Math.max(0, parseInt(shotKey.replace('HAUL_BAG_', ''), 10) - 1);
      if (refs.avatarRef) refsToPass.push(refs.avatarRef);
      const bagItems = m.accessoryItems.filter(it => it.kind === 'bag');
      const bagItem  = bagItems[bagIdx];
      if (bagItem?.refUrl) refsToPass.push(bagItem.refUrl);
      const plan = shot.haulItemPlan;
      if (plan?.wornItems) {
        plan.wornItems.filter(id => id !== bagItem?.id).forEach(id => {
          const ref = getRefByItemId(id);
          if (ref) refsToPass.push(ref);
        });
      }

    } else if (shotKey.startsWith('HAUL_JEWELRY_')) {
      // joyería: jewel + avatar + ref de outfit compatible si hay integración
      const jewIdx   = Math.max(0, parseInt(shotKey.replace('HAUL_JEWELRY_', ''), 10) - 1);
      if (refs.avatarRef) refsToPass.push(refs.avatarRef);
      const jewItems = m.accessoryItems.filter(it => it.kind === 'jewelry');
      const jewItem  = jewItems[jewIdx];
      if (jewItem?.refUrl) refsToPass.push(jewItem.refUrl);
      const plan = shot.haulItemPlan;
      if (plan?.wornItems) {
        plan.wornItems.filter(id => id !== jewItem?.id).forEach(id => {
          const ref = getRefByItemId(id);
          if (ref) refsToPass.push(ref);
        });
      }

    } else if (shotKey.startsWith('HAUL_SETUP_')) {
      // setup shot: avatar + la prenda específica del setup como objeto
      const setupIdx = Math.max(0, parseInt(shotKey.replace('HAUL_SETUP_', ''), 10) - 1);
      if (refs.avatarRef) refsToPass.push(refs.avatarRef);
      const setupItem = m.outfitItems[setupIdx] ?? m.tryOnItems[setupIdx];
      if (setupItem?.refUrl) {
        refsToPass.push(setupItem.refUrl);
      } else {
        // fallback: subset de 3 prendas
        allOutfits.slice(0, 3).forEach(r => refsToPass.push(r));
      }

    } else if (shotKey.startsWith('HAUL_STYLED_')) {
      // styled result: avatar x2 + prenda por ID del manifest
      if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef);
      if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
      const planRefs = getItemPlanRefs();
      if (planRefs.length > 0) {
        planRefs.forEach(r => refsToPass.push(r));
      } else {
        const styledIdx = Math.max(0, parseInt(shotKey.replace('HAUL_STYLED_', ''), 10) - 1);
        const item      = m.outfitItems[styledIdx];
        if (item?.refUrl) refsToPass.push(item.refUrl);
        else if (allOutfits[styledIdx]) refsToPass.push(allOutfits[styledIdx]);
      }

    } else {
      // HAUL_RECAP y cualquier otro shot: avatar x2 + subset de 3 prendas por ID
      if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef);
      if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
      m.outfitItems.slice(0, 3).forEach(it => { if (it.refUrl) refsToPass.push(it.refUrl); });
      if (refsToPass.length <= 3) allOutfits.slice(0, 3).forEach(r => refsToPass.push(r));
    }

  } else if (recipe === 'outfit_week') {
    // outfit_week: INDEX ROUTING OBLIGATORIO — cada shot recibe solo sus refs específicas
    // El plan está en shot.weeklyItemPlan (inyectado por weeklyRoleToDirective)
    // WEEK_OVERVIEW es item-only por contrato (patch Fase 3): no debe recibir avatar/body
    // como referencia de identidad, para no contradecir "NO PERSON, NO HANDS, NO FACE" del
    // prompt. REF0 sí viaja (misma superficie/luz que el resto del set), pero el contrato
    // visual (buildVisualReferenceContract) ya la marca como world-only por defecto.
    const isItemOnlyOverview = shot.key === 'WEEK_OVERVIEW';
    if (!isItemOnlyOverview) {
      if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
      if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
    }
    refsToPass.push(ref0Url);

    const weekPlan: import('./types').WeeklyShotPlan | undefined = shot.weeklyItemPlan;
    const allOutfitUrls  = [refs.outfitRef, ...(refs.outfitRefs  ?? [])].filter(Boolean) as string[];
    const allAccUrls     = (refs.accesorioRefs ?? []).filter(Boolean) as string[];
    // producto_N: buildWeeklyManifest() clasifica refs.productRef/productRefs con este
    // prefijo (skincare/beauty/producto genérico que no cabe en el slot outfit/accesorio).
    const allProductUrls = [refs.productRef, ...(refs.productRefs ?? [])].filter(Boolean) as string[];

    const routeWeeklyItemId = (itemId: string) => {
      if (itemId.startsWith('outfit_')) {
        const idx = parseInt(itemId.replace('outfit_', ''), 10);
        if (allOutfitUrls[idx]) refsToPass.push(allOutfitUrls[idx]);
      } else if (itemId.startsWith('acc_')) {
        const idx = parseInt(itemId.replace('acc_', ''), 10);
        if (allAccUrls[idx]) refsToPass.push(allAccUrls[idx]);
      } else if (itemId.startsWith('producto_')) {
        const idx = parseInt(itemId.replace('producto_', ''), 10);
        if (allProductUrls[idx]) refsToPass.push(allProductUrls[idx]);
      }
    };

    if (weekPlan) {
      // Routing explícito desde el plan: primary → urls de outfit/acc/producto
      // Primaries: ítems protagonistas del shot
      for (const itemId of weekPlan.primaryItemIds) routeWeeklyItemId(itemId);
      // Secondaries: ítems de integración (accesorio + outfit compatible)
      for (const itemId of weekPlan.secondaryItemIds) routeWeeklyItemId(itemId);
    } else {
      // Fallback: primer outfit disponible (no debería ocurrir con el nuevo planner)
      if (allOutfitUrls[0]) refsToPass.push(allOutfitUrls[0]);
    }

    // Escena opcional — solo si el usuario la subió
    if (refs.sceneRef) refsToPass.push(refs.sceneRef);

  } else if (recipe === 'product_haul') {
    // ── Product Haul: routing de referencias por ítem del shot ──
    // Cada shot recibe SOLO el producto (o empaque) que le corresponde según
    // productHaulItemPlan.primaryItems — sin scoring, sin styling graph.
    refsToPass.push(ref0Url);
    if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef);

    const allProductUrls   = [refs.productRef, ...(refs.productRefs ?? [])].filter(Boolean) as string[];
    const allPackagingUrls = [refs.packagingRef, ...(refs.packagingRefs ?? [])].filter(Boolean) as string[];

    const routeProductHaulItemId = (itemId: string) => {
      if (itemId.startsWith('product_')) {
        const idx = parseInt(itemId.replace('product_', ''), 10);
        if (allProductUrls[idx]) refsToPass.push(allProductUrls[idx]);
      } else if (itemId.startsWith('packaging_')) {
        const idx = parseInt(itemId.replace('packaging_', ''), 10);
        if (allPackagingUrls[idx]) refsToPass.push(allPackagingUrls[idx]);
      }
    };

    const productPlan = shot.productHaulItemPlan;
    if (productPlan) {
      for (const itemId of productPlan.primaryItems) routeProductHaulItemId(itemId);
    } else if (allProductUrls[0]) {
      refsToPass.push(allProductUrls[0]);
    }

    if (refs.sceneRef) refsToPass.push(refs.sceneRef);

  } else if (recipe === 'outfit_check') {
    // outfit_check: avatar x3 + ref0 + prenda(s) + escena
    if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
    if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
    refsToPass.push(ref0Url);

    const allOutfits = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];

    if (shot.key === 'ACCESSORY_CLOSEUP') {
      const allAccesorios = (refs.accesorioRefs ?? []).filter(Boolean) as string[];
      const closeupShots  = allAccesorios.length;
      const accIdx        = (shot.arcPosition - 1) % Math.max(closeupShots, 1);
      if (allAccesorios[accIdx]) refsToPass.push(allAccesorios[accIdx]);
    } else {
      // outfit_check: mismo outfit en todos los shots
      allOutfits.slice(0, 2).forEach(r => refsToPass.push(r));
    }

    // Escena: outfit_check usa scenePrueba/Destino según el shot.
    // Director genérico (ver outfitCheckDirectorAdapter.ts): sus shots
    // sintéticos declaran narrativeStage='destination' en vez de usar el
    // shotKey fijo OUTFIT_DESTINATION — mismo criterio, otro campo.
    const isLastShot = shot.key === 'OUTFIT_DESTINATION' || shot.narrativeStage === 'destination';
    const sceneRef   = isLastShot
      ? (refs.sceneDestinoRef ?? refs.scenePruebaRef ?? refs.sceneRef)
      : (refs.scenePruebaRef ?? refs.sceneRef);
    if (sceneRef) refsToPass.push(sceneRef);

  } else {
    // Recetas genéricas: day_in_life, travel, bts, launch y cualquier futura.
    // Si el brief tiene @tags, las refs se reordenan según el orden de aparición de los tags.
    if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
    if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
    refsToPass.push(ref0Url);

    if (briefTagMap?.hasAnyTag) {
      // ── Tag-driven routing ─────────────────────────────────────
      // outfitForThisShot ya viene reordenado por brief (via outfitRefsForRotation)
      if (outfitForThisShot) refsToPass.push(outfitForThisShot);

      // Si hay pairings que incluyen el outfit de este shot, agregar sus pares
      const pairedWithCurrentOutfit = briefTagMap.pairings.filter(p =>
        p.urlA === outfitForThisShot || p.urlB === outfitForThisShot
      );
      for (const pair of pairedWithCurrentOutfit) {
        const companion = pair.urlA === outfitForThisShot ? pair.urlB : pair.urlA;
        if (!refsToPass.includes(companion)) refsToPass.push(companion);
      }

      // Productos: en orden del brief, con sus pairings
      const arcIdx   = shot.arcPosition - 1;
      const prodUrl  = briefTagMap.producto[arcIdx % Math.max(briefTagMap.producto.length, 1)];
      if (prodUrl) {
        refsToPass.push(prodUrl);
        // Pairing de este producto con otros items
        const pairedWithProd = briefTagMap.pairings.filter(p => p.urlA === prodUrl || p.urlB === prodUrl);
        for (const pair of pairedWithProd) {
          const companion = pair.urlA === prodUrl ? pair.urlB : pair.urlA;
          if (!refsToPass.includes(companion)) refsToPass.push(companion);
        }
      } else {
        // Fallback: productos en orden original
        if (refs.productRef) refsToPass.push(refs.productRef);
        (refs.productRefs ?? []).filter(Boolean).slice(0, 1).forEach(r => refsToPass.push(r as string));
      }

      // Accesorios taggeados que no están ya en pairings
      const accNotPaired = briefTagMap.accesorio.filter(a =>
        !refsToPass.includes(a) &&
        !briefTagMap.pairings.some(p => p.urlA === a || p.urlB === a)
      );
      accNotPaired.slice(0, 1).forEach(a => refsToPass.push(a));

      // Escena: la taggeada en el brief o fallback
      const sceneTagged = briefTagMap.escena[0] ?? getSceneRefForShot(refs, arcIdx, totalShots);
      if (sceneTagged && !refsToPass.includes(sceneTagged)) refsToPass.push(sceneTagged);

    } else {
      // Comportamiento original sin tags
      if (outfitForThisShot) refsToPass.push(outfitForThisShot);
      if (refs.productRef) refsToPass.push(refs.productRef);
      const extraProducts = (refs.productRefs ?? []).filter(Boolean) as string[];
      extraProducts.forEach(r => refsToPass.push(r as string));
      const sceneForShot = getSceneRefForShot(refs, shot.arcPosition - 1, totalShots);
      if (sceneForShot) refsToPass.push(sceneForShot);
    }
  }

  const extraProducts = (refs.productRefs ?? []).filter(Boolean) as string[];
  const extraPackaging = (refs.packagingRefs ?? []).filter(Boolean) as string[];
  const sceneForShot  = getSceneRefForShot(refs, shot.arcPosition - 1, totalShots);

  // ── Visual Reference Contract — para outfit_week (y futuras recetas con index routing) ──
  // Se construye DESPUÉS de que refsToPass está completo, así los números de posición son exactos.
  const weeklyVisualContract: VisualReferenceContract | null = (() => {
    if (recipe !== 'outfit_week') return null;
    const weekPlan = shot.weeklyItemPlan as import('./types').WeeklyShotPlan | undefined;
    const allOutfitUrls  = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
    const allAccUrls     = (refs.accesorioRefs ?? []).filter(Boolean) as string[];
    const allProductUrls = [refs.productRef, ...(refs.productRefs ?? [])].filter(Boolean) as string[];

    // Pairings del brief para el contrato visual
    const pairingsForContract = weekPlan?.explicitPairingsFromBrief?.map(p => ({
      primaryItemId:   p.targetItemId,   // el outfit
      secondaryItemId: p.sourceItemId,   // el accesorio
      context:         p.rawText,
    })) ?? [];

    return buildVisualReferenceContract(
      refsToPass,
      weekPlan,
      allOutfitUrls,
      allAccUrls,
      refs.avatarRef,
      refs.bodyRef,
      ref0Url,
      pairingsForContract,
      allProductUrls,
    );
  })();

  const momentLabel = {
    candid:     '📱 CANDID — Captura espontánea sin pose ni artificio.',
    context:    '🌍 CONTEXT — El mundo y ambiente de esta historia.',
    emotion:    '💫 EMOTION — Una expresión o reacción genuina.',
    detail:     '🔍 DETAIL — Un fragmento íntimo del mundo visible.',
    texture:    '🧵 TEXTURE — Material, superficie, profundidad.',
    action:     '⚡ ACTION — Alguien haciendo algo, en movimiento.',
    atmosphere: '🌫 ATMOSPHERE — El mood: luz, espacio, silencio.',
    reveal:     '👁 REVEAL — Un ángulo que muestra algo nuevo.',
  }[shot.beat] ?? `📸 ${shot.beat.toUpperCase()}`;

  const isFacelessShot = narrative === 'faceless';
  // outfit_week usa WEEKLY_SLOT_COVERAGE_MODE en lugar del bloque narrativo genérico.
  // El modo de cobertura de slots es la autoridad máxima y reemplaza la lógica de campaña.
  const shotModeBlock  = recipe === 'outfit_week'
    ? WEEKLY_SLOT_COVERAGE_MODE
    : isFacelessShot
      ? STORY_MODE_FACELESS
      : STORY_MODE_DOMINANCE;

  const selectedFamily = pickFamilyForShot(
    shot.beat, shot.key, shot.arcPosition - 1, sessionFamilies, protagonist,
  );
  // Family blocks:
  //   outfit_check: desactivados completamente (lighting hints incompatibles)
  //   outfit_haul:  desactivados para MVP — family blocks pueden meter props/locaciones no pedidas
  //   product_haul: desactivados por la misma razón que outfit_haul
  //   outfit_week:  safe hint filtrado
  //   otras:        block completo
  const isOutfitCheckRecipe = recipe === 'outfit_check' || recipe === 'outfit_haul' || recipe === 'product_haul';
  const familyBlock = (recipe === 'outfit_check' || recipe === 'outfit_haul' || recipe === 'product_haul')
    ? ''  // disabled_for_outfit_check_and_haul_mvp
    : recipe === 'outfit_week'
      ? (selectedFamily ? buildSafeOutfitFamilyStyleHint(selectedFamily, shot.key ?? '', shot.cameraMode) : '')
      : (selectedFamily ? buildFamilyInjectBlock(selectedFamily) : '');

  // HPI:
  //   outfit_haul:  usa buildHaulSafeHpiBlock — solo lenguaje corporal y expresión
  //   outfit_check: usa buildOutfitCompatibleHpiBlock — filtrado por shot y destino
  //   otras:        buildHpiBlock estándar con filtros globales
  const shotHpiAllowed = shot.hpiAllowed;
  const globalHpiBlock = !isFacelessShot
    && !!refs.avatarRef
    && shot.key !== 'HAUL_OVERVIEW'
    && shot.key !== 'HAUL_INTRO'
    && shot.key !== 'OUTFIT_ARRIVING'
    && shot.key !== 'OUTFIT_DETAIL'
    && shot.key !== 'OUTFIT_DETAIL_WORN'
    && shot.key !== 'ACCESSORY_CLOSEUP'
    && !(shot.key ?? '').startsWith('HAUL_ACCESSORY_CLOSEUP_')
    && !(shot.key ?? '').startsWith('HAUL_DETAIL_')
    && !(shot.key ?? '').startsWith('HAUL_FOOTWEAR_')
    && !(shot.key ?? '').startsWith('HAUL_BAG_')
    && !(shot.key ?? '').startsWith('HAUL_JEWELRY_')
    && !(shot.key ?? '').startsWith('HAUL_SETUP_')
    && shot.key !== 'UNBOXING_PACKAGING_CLOSED'
    && shot.key !== 'UNBOXING_PRODUCT_REVEAL'
    && shot.key !== 'UNBOXING_PRODUCT_DETAIL'
    && shot.key !== 'UNBOXING_ATMOSPHERE';

  const hpiEligible = typeof shotHpiAllowed === 'boolean'
    ? shotHpiAllowed && !!refs.avatarRef && !isFacelessShot
    : globalHpiBlock;

  const hpiScope = shot.hpiScope ?? 'full';
  let hpiBlock = '';
  let hpiSource: 'disabled' | 'filtered_outfit_hpi' | 'raw_hpi_not_allowed' = 'disabled';

  if (recipe === 'outfit_haul') {
    if (hpiEligible) {
      hpiBlock  = buildHaulSafeHpiBlock(shot.key ?? '', shot.hpiScope ?? 'full', refs.gender ?? 'female');
      hpiSource = hpiBlock ? 'filtered_outfit_hpi' : 'disabled';
    }
  } else if (recipe === 'outfit_check') {
    if (hpiEligible) {
      const briefCtxForHpi = parseOutfitBriefContext(basePrompt);
      hpiBlock  = buildOutfitCompatibleHpiBlock(shot.key ?? '', refs.gender ?? 'female', briefCtxForHpi.destinationClass);
      hpiSource = hpiBlock ? 'filtered_outfit_hpi' : 'disabled';
    }
  } else if (recipe === 'outfit_week') {
    // weekly_safe HPI — poses naturales de lifestyle, sin poses de fitness ni editorial extremo
    if (hpiEligible) {
      hpiBlock  = buildWeeklySafeHpiBlock(shot.key ?? '', refs.gender ?? 'female');
      hpiSource = hpiBlock ? 'filtered_outfit_hpi' : 'disabled';
    }
  } else if (recipe === 'product_haul') {
    if (hpiEligible) {
      const primaryId = shot.productHaulItemPlan?.primaryItems[0];
      const activeInteractionMode = primaryId
        ? buildProductHaulManifest(refs, 20).allItems.find(it => it.id === primaryId)?.interactionMode ?? 'held_or_displayed'
        : 'held_or_displayed';
      hpiBlock  = buildProductHaulSafeHpiBlock(shot.key ?? '', activeInteractionMode, refs.gender ?? 'female');
      hpiSource = hpiBlock ? 'filtered_outfit_hpi' : 'disabled';
    }
  } else {
    const rawHpiBlock = hpiEligible
      ? buildHpiBlock({
          enabled:            true,
          gender:             refs.gender ?? 'female',
          modoVisual:         'ugc',
          includeGesture:     true,
          includePerformance: hpiScope === 'full' && (shot.beat === 'emotion' || shot.beat === 'candid'),
          ...( hpiScope === 'micro_action_only' && {
            _scopeNote: 'MICRO ACTION ONLY: adjusting a strap, hand on hip, slight torso turn — NO gym move, NO athletic stance',
          } as any ),
        })
      : '';
    hpiBlock  = rawHpiBlock;
    hpiSource = hpiBlock ? 'filtered_outfit_hpi' : 'disabled';
  }

  // Bloque HPI de restricción activa cuando el modo NO admite poses corporales
  const hpiBlockOff = !hpiEligible && !!refs.avatarRef && !isFacelessShot
    ? `⚠️ HPI DISABLED FOR THIS SHOT:
This shot format (${shot.cameraMode ?? shot.key}) does NOT involve a full-body person posing.
Do NOT inject body poses, athletic gestures, or performance stances.
If the person appears partially, their posture is incidental — not the subject of the shot.`
    : '';

  // Bloques estructurales de WearState y CameraMode
  const wearStateBlock  = shot.wearState  ? injectWearStateBlock(shot.wearState)   : '';
  const cameraModeBlock = shot.cameraMode ? injectCameraModeBlock(shot.cameraMode) : '';
  // Item state plan — instrucciones por pieza
  const itemStatePlanBlock = buildItemStatePlanBlock(shot.itemStatePlan, shot.wearState ?? 'wearing_full_outfit');

  // Bloque de outfit para este shot específico
  const outfitLockForShot = isFlatLay && outfitForThisShot
    ? `OUTFIT FLAT LAY — THIS SHOT:
This is an overhead or angled flat-lay shot of the garment reference provided.
Do NOT show a person wearing the outfit. Show the garment laid flat or arranged on a surface
(bed, floor, chair, or styled surface consistent with the scene).
Copy the exact garment from the outfit reference — same color, fabric, cut, silhouette.
Style it naturally — wrinkled, organic, real — NOT a product catalog. Accessories may be added nearby.
This shot showcases the piece itself as part of the haul/outfit story.`
    : outfitForThisShot
      ? buildOutfitLockBlock(outfitMode, basePrompt, true)
      : buildOutfitLockBlock(outfitMode, basePrompt, false);

  const isOutfitShot = recipe === 'outfit_check' || recipe === 'outfit_haul' || recipe === 'outfit_week';
  const allOutfitsForShot = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];

  // Para haul: resolver el HaulItem activo de este shot (para inyectar manualKind en prompt)
  // Usar el manifest ya construido (con visualAnalysis) para garantizar clasificación consistente.
  const shotKey_ = shot.key ?? '';
  let haulActiveItem: HaulItem | undefined;
  if (recipe === 'outfit_haul') {
    const m = haulManifest ?? buildHaulManifest(refs, 20);
    if (shotKey_.startsWith('HAUL_TRY_ON_')) {
      const idx = parseInt(shotKey_.replace('HAUL_TRY_ON_', ''), 10) - 1;
      haulActiveItem = m.outfitItems[idx] ?? m.tryOnItems[idx];
    } else if (shotKey_ === 'HAUL_SELECTION') {
      haulActiveItem = m.outfitItems[m.outfitItems.length - 1];
    } else if (shotKey_.startsWith('HAUL_ADJUSTING_')) {
      const idx = parseInt(shotKey_.replace('HAUL_ADJUSTING_', ''), 10) - 1;
      haulActiveItem = m.outfitItems[idx] ?? m.tryOnItems[idx];
    } else if (shotKey_.startsWith('HAUL_STYLED_')) {
      const idx = parseInt(shotKey_.replace('HAUL_STYLED_', ''), 10) - 1;
      haulActiveItem = m.outfitItems[idx] ?? m.tryOnItems[idx];
    } else if (shotKey_.startsWith('HAUL_FOOTWEAR_')) {
      const idx = parseInt(shotKey_.replace('HAUL_FOOTWEAR_', ''), 10) - 1;
      haulActiveItem = m.footwearItems[idx];
    } else if (shotKey_.startsWith('HAUL_BAG_')) {
      const idx = parseInt(shotKey_.replace('HAUL_BAG_', ''), 10) - 1;
      haulActiveItem = m.accessoryItems.filter(it => it.kind === 'bag')[idx];
    } else if (shotKey_.startsWith('HAUL_JEWELRY_')) {
      const idx = parseInt(shotKey_.replace('HAUL_JEWELRY_', ''), 10) - 1;
      haulActiveItem = m.accessoryItems.filter(it => it.kind === 'jewelry')[idx];
    } else if (shotKey_.startsWith('HAUL_ACCESSORY_CLOSEUP_')) {
      // Generic accessories: bag/jewelry ya tienen sus propios keys — aquí solo van los genéricos
      const idx = parseInt(shotKey_.replace('HAUL_ACCESSORY_CLOSEUP_', ''), 10) - 1;
      const genericAccItems = m.accessoryItems.filter(it => it.kind !== 'bag' && it.kind !== 'jewelry');
      haulActiveItem = genericAccItems[idx];
    } else if (shotKey_.startsWith('HAUL_SETUP_')) {
      const idx = parseInt(shotKey_.replace('HAUL_SETUP_', ''), 10) - 1;
      haulActiveItem = m.outfitItems[idx] ?? m.tryOnItems[idx];
    }
  }
  const haulItemTypeBlock     = haulActiveItem ? buildHaulItemTypeBlock(haulActiveItem) : '';
  const haulItemRoleLockBlock = recipe === 'outfit_haul' && haulActiveItem
    ? buildHaulItemRoleLockBlock(haulActiveItem)
    : '';
  const haulAnatomyBlock      = recipe === 'outfit_haul' ? buildHaulAnatomyBlock() : '';
  const haulProgressBlock     = recipe === 'outfit_haul' && haulManifest
    ? buildHaulProgressBlock(shotKey_, haulManifest, shot.arcPosition - 1, totalShots)
    : '';
  const haulWorldMapBlock = recipe === 'outfit_haul' && ref0Analysis
    ? buildHaulWorldMap(ref0Analysis).worldLockSummary
    : '';
  // Bloque de plan de ítems por shot — qué aparece exactamente en este shot
  const haulShotItemPlanBlock = recipe === 'outfit_haul' && shot.haulItemPlan && haulManifest
    ? buildHaulShotItemPlanBlock(shot.haulItemPlan, haulManifest)
    : '';

  // ── Product Haul: bloques específicos de la receta ────────────
  // Reconstruye el manifest para resolver el ítem activo del shot (mismo patrón que haul,
  // sin caching entre llamadas — buildProductHaulManifest es barato, sin scoring/graph).
  const productHaulManifest = recipe === 'product_haul' ? buildProductHaulManifest(refs, 20) : undefined;
  let productHaulActiveItem: import('./types').ProductHaulItem | undefined;
  if (productHaulManifest && shot.productHaulItemPlan?.primaryItems.length) {
    const primaryId = shot.productHaulItemPlan.primaryItems[0];
    productHaulActiveItem = productHaulManifest.allItems.find(it => it.id === primaryId);
  }
  const productHaulInteractionBlock = productHaulActiveItem ? buildProductInteractionBlock(productHaulActiveItem) : '';
  const productHaulItemTypeBlock    = productHaulActiveItem ? buildProductHaulItemTypeBlock(productHaulActiveItem) : '';
  const productHaulAnatomyBlockText = recipe === 'product_haul' ? buildProductHaulAnatomyBlock() : '';
  const productHaulShotItemPlanBlock = recipe === 'product_haul' && shot.productHaulItemPlan && productHaulManifest
    ? buildProductHaulShotItemPlanBlock(shot.productHaulItemPlan, productHaulManifest)
    : '';

  // Instrucción de outfit específica para este shot
  const shotOutfitInstruction = isOutfitShot
    ? shotKey_ === 'HAUL_OVERVIEW'
      ? `HAUL COLLECTION: The garment references show a subset of the haul items. Show them as a collection — on a bed, rack, surface, or held — NOT worn as a complete look. They should feel like items waiting to be tried on. Real arrangement, not a catalog grid.`
      : shotKey_.startsWith('HAUL_ACCESSORY_CLOSEUP_')
        ? (() => {
            const visual = haulActiveItem?.label ?? '';
            const colorHint = visual.length > 0 ? `\nPRIMARY ACCESSORY REFERENCE: ${visual}` : '';
            return `ACCESSORY CLOSE-UP: The accessory reference shows the EXACT piece to feature. Reproduce it faithfully — same shape, color, material, hardware, design. Do NOT fuse it with other accessories. Do NOT change it into a different accessory type.${colorHint}`;
          })()
        : shotKey_ === 'HAUL_INTRO' || shotKey_ === 'OUTFIT_ARRIVING'
          ? `OUTFIT PRESENTATION: The garment references show the exact pieces to display. Show them as objects — on a rack, laid flat, or held by hands. The garments must be clearly readable. Do NOT show a full-body catalog pose.`
          : shotKey_ === 'ACCESSORY_CLOSEUP'
            ? `ACCESSORY CLOSE-UP: The accessory reference shows the exact piece to feature. Fill the frame with it. Reproduce it faithfully — same color, material, hardware, design. Real light, real surface. No person needed.`
            : recipe === 'outfit_haul'
              ? shotKey_.startsWith('HAUL_FOOTWEAR_')
                ? `FOOTWEAR ITEM — THIS SHOT: The reference provided is a STANDALONE FOOTWEAR ITEM (shoe, boot, sandal, sneaker).
Do NOT generate a full outfit from this shoe reference alone.
Show the footwear as: a close-up detail, held by hand, placed on a surface, or being tried on at foot level.
Do NOT invent a complete look. The shoe IS the subject.
${haulItemTypeBlock}`
                : shotKey_.startsWith('HAUL_BAG_')
                ? (() => {
                    const visual = haulActiveItem?.label ?? '';
                    const primaryRefBlock = visual.length > 0
                      ? `\nPRIMARY BAG REFERENCE: Use the uploaded bag reference as the exact source of truth.\n${visual}\nRecreate the same bag shape, material, hardware, and color. Do not invent a different bag.`
                      : '\nPRIMARY BAG REFERENCE: Use the uploaded bag reference as the exact source of truth. Reproduce its exact design, material, and color.';
                    return `BAG / BOLSO — THIS SHOT: The reference provided is a STANDALONE BAG or PURSE.
Do NOT generate a full outfit around it. Show the bag as protagonist — held, worn over shoulder, resting on bed, or detail of hardware/stitching.
Real room context. Natural light. The bag IS the subject of this shot.${primaryRefBlock}
${haulItemTypeBlock}`;
                  })()
                : shotKey_.startsWith('HAUL_JEWELRY_')
                ? (() => {
                    const visual = haulActiveItem?.label ?? '';
                    const primaryRefBlock = visual.length > 0
                      ? `\nPRIMARY JEWELRY REFERENCE: Use the uploaded jewelry reference as the exact source of truth.\n${visual}\nRecreate the same jewelry design, material, color, scale, and shape. Do not invent a different piece. Do not replace with generic jewelry.`
                      : '\nPRIMARY JEWELRY REFERENCE: Use the uploaded jewelry reference as the exact source of truth. Reproduce its exact design, material, and color.';
                    return `JEWELRY ITEM — THIS SHOT: The reference provided is a JEWELRY PIECE.
Do NOT generate a full outfit for context. Show the jewelry intimately — worn on body (ear, neck, wrist, finger), held between fingers, or resting on fabric.
Macro or semi-macro framing. Real skin texture if worn. The jewelry IS the subject.${primaryRefBlock}
${haulItemTypeBlock}`;
                  })()
                : shotKey_.startsWith('HAUL_SETUP_')
                ? `HAUL SETUP MOMENT — THIS SHOT: Show the person interacting with haul items as OBJECTS (not yet worn).
Hands active — organizing, selecting, holding up to preview. Real room context. UGC energy.
Do NOT show a full-body catalog pose. This is a natural selection/organizing moment.
${haulItemTypeBlock}`
                : shotKey_.startsWith('HAUL_STYLED_')
                ? `STYLED RESULT — THIS SHOT: The person IS wearing the garment reference. Reveal moment — different framing than the preceding try-on.
Copy the garment EXACTLY. Natural posture — not a catalog stance. Real room visible.

${haulItemTypeBlock}

⛔ AVATAR BASE LOOK RULE:
The avatar/body reference may show the person wearing a base outfit.
This base outfit is allowed as their starting state — it is NOT a haul item.
Do NOT merge avatar base clothing with the referenced haul item.
Do NOT transform avatar base clothing into a new haul garment.
The referenced haul item must visually dominate this shot.`
                : `HAUL GARMENT — THIS SHOT: The garment reference provided is the SPECIFIC piece the person is wearing or showing right now.
Copy it EXACTLY — same color, fabric, cut, fit, silhouette.
The person wears it naturally, evaluating how it looks. NOT a catalog pose. NOT a styled editorial look.

${haulItemTypeBlock}

⛔ AVATAR BASE LOOK RULE:
The avatar/body reference may show the person wearing a base outfit.
This base outfit is allowed as their starting state — it is NOT a haul item and must NOT count as product coverage.
Do NOT merge avatar base clothing with the referenced haul item.
Do NOT transform avatar base clothing into a new haul garment.
When the referenced haul item is the hero, it must visually dominate.`
              : `OUTFIT LOCK: Copy the garment(s) EXACTLY from the outfit references — same color, fabric, cut, fit, silhouette. SHOE SPECIFICITY LOCK: same straps, heel, toe, hardware. Do NOT invent fabric continuation. Do NOT add or remove pieces.`
    : '';

  const shotIdentityBlock = isUnboxing
    ? `SHOT IDENTITY — UNBOXING SET:
- REF0 is the visual anchor — same light, same surface, same color temperature across all shots.
${refs.avatarRef ? `- Face reference (appears twice): EXACT identity — same bone structure, same hair, same skin tone. The person is a GUIDE in this unboxing, not the star. Keep face authentic, no beautification.` : '- No person in this set — product and packaging are the sole protagonists.'}
${refs.avatarRef && refs.outfitRef ? `- WARDROBE: The person wears the garment shown in the outfit reference (NOT the clothing visible in the face/avatar reference) — same color, fabric, cut, fit across every shot.` : ''}
${refs.avatarRef && !refs.outfitRef ? `- WARDROBE: No separate outfit reference — the person wears the SAME clothing already established in REF0 (inherited from the face/avatar reference), consistent across every shot.` : ''}
- PRODUCT: Reproduce faithfully — same shape, color, finish, and proportions as the reference.
${refs.packagingRef ? `- PACKAGING: Reproduce faithfully — same box/container shape, color, design, and materials.` : `- PACKAGING: No reference provided — maintain whatever packaging was established in REF0 consistently.`}
${extraProducts.length > 0 ? `- Product shown from multiple angles in references — same object. Use all angles to understand it fully.` : ''}
${extraPackaging.length > 0 ? `- Packaging shown from multiple angles — same container. Maintain design consistency.` : ''}

⚠️ REFERENCE ROLE — READ CAREFULLY:
References are visual constraints for IDENTITY and CONSISTENCY — they are NOT a checklist of elements to include in every frame.
Each shot tells ONE moment of the story. Show only what belongs to THIS moment.
A face reference does NOT mean a face must appear. A packaging reference does NOT mean the box must be visible.
If an element is not part of this shot's narrative role, leave it out — its absence is correct, not a failure.
ONE person maximum in any frame. Any background figure is a generation error.

NARRATIVE ARC POSITION: Shot ${shot.arcPosition} of ${totalShots} — ${shot.role}.`
    : recipe === 'outfit_haul'
      ? `SHOT IDENTITY — HAUL SESSION:
- Face reference (appears TWICE): EXACT identity — same bone structure, same hair, same skin tone. No beautification.
${refs.bodyRef ? '- Body reference: establishes physique and proportions ONLY. Do NOT alter them.' : ''}
- REF0: establishes the haul space — same room, same light, same real environment. NOT a studio.
- Avatar/body/REF0 clothing is identity context only, never haul wardrobe (see global avatar-suppression rule).

⛔ SUPPORT SHOT WEAR POLICY — BINDING:
For non-try-on haul shots (setup, overview, recap, adjusting), the person must be in EXACTLY ONE of:
  A) Wearing one of the already-established haul looks from a previous try-on.
  B) Wearing a neutral non-product base: simple fitted tee/tank + simple jeans/shorts/leggings, INVENTED BY THE SYSTEM.
Never leave the wear state unconstrained. Never fall back to avatar reference clothing.

⛔ DO NOT CLONE REF0: use it for room/light/environment only — different pose, distance, crop, or focus than REF0 every shot.
${shotOutfitInstruction}

🔒 HAUL SPACE CONTINUITY: same room as REF0 across all shots — walls, floor, furniture, window, light direction, and shopping bags/boxes family. Only props visible in REF0 are allowed (see global scene-lock rule for the full prop allowlist).

📦 CONTROLLED ITEM MOVEMENT — HAUL SESSION ARC:
Shot ${shot.arcPosition} of ${totalShots}:
${shot.arcPosition <= Math.ceil(totalShots * 0.33)
  ? '  EARLY (controlled_tidy): fresh space, 1–2 haul items visible nearby, max 1 plain unbranded bag/box, no piles yet.'
  : shot.arcPosition <= Math.ceil(totalShots * 0.66)
  ? '  MIDDLE (lightly_used): 2–4 haul items set aside on bed/chair, naturally used but not chaotic, max 2 plain packages.'
  : '  LATE (organized_haul): tried items draped/folded in background, actively used but still tidy, max 2 plain packages.'}
Haul clothes from the uploaded set only — do NOT invent generic clothing piles or extra garments not uploaded by the user.

⚠️ SAFE HAUL FALLBACK (only if try-on fails): do not redesign the garment — show it held toward camera, arranged on the bed, or as a detail close-up, preserving its exact shape/color/material.

⚠️ REFERENCE ROLE: garment references show the SPECIFIC GARMENT for this shot, not a person wearing it. One garment ref = one shot's piece — do not mix refs across shots. ONE person maximum in any frame.
HAUL CONTEXT: ${shot.purpose}

${haulWorldMapBlock}

${haulShotItemPlanBlock}

${haulItemRoleLockBlock}

${haulProgressBlock}

${haulAnatomyBlock}

NARRATIVE ARC POSITION: Shot ${shot.arcPosition} of ${totalShots} — ${shot.role}.`
      : recipe === 'product_haul'
      ? `SHOT IDENTITY — PRODUCT HAUL SESSION:
- Face reference (appears twice): EXACT identity — same bone structure, same hair, same skin tone. No beautification.
- REF0: establishes the haul space — same room, same light, same real environment. NOT a studio.
- Avatar clothing is identity context only, never a haul product.

⛔ DO NOT CLONE REF0: use it for room/light/environment only — different pose, distance, crop, or focus than REF0 every shot.

${productHaulItemTypeBlock}

${productHaulInteractionBlock}

PRODUCT HAUL CONTEXT: ${shot.purpose}

${productHaulShotItemPlanBlock}

${productHaulAnatomyBlockText}

⚠️ REFERENCE ROLE: product references show the SPECIFIC PRODUCT for this shot. One product ref = one shot's item — do not mix refs across shots. ONE person maximum in any frame.

NARRATIVE ARC POSITION: Shot ${shot.arcPosition} of ${totalShots} — ${shot.role}.`
      : recipe === 'outfit_week'
      ? (() => {
          const weekPlan: import('./types').WeeklyShotPlan | undefined = shot.weeklyItemPlan;
          const roleLabel        = weekPlan?.role ?? shot.role ?? 'WEEKLY SHOT';
          const visualIntent     = weekPlan?.visualWeightIntent ?? '';
          const compositionMode  = weekPlan?.compositionMode    ?? '';
          const isOverview       = roleLabel.includes('OVERVIEW');
          const isDetail         = roleLabel.includes('DETAIL') || roleLabel.includes('ACCESSORY_DETAIL');
          const isAccessory      = roleLabel.includes('ACCESSORY');
          const isHero           = roleLabel === 'WEEK_LOOK_HERO' || roleLabel === 'WEEK_MIRROR_LOOK';
          const semIntent        = weekPlan?.semanticIntentFromBrief;
          const resolvedTags     = weekPlan?.resolvedTagsUsed?.length ? weekPlan.resolvedTagsUsed.join(', ') : '';
          // IMPORTANTE: destination describe el uso del outfit (cena, oficina) — NO la locación de captura.
          // Solo se inyecta como mood de vestimenta, nunca como locación física del shot.
          const moodLine         = semIntent?.mood || semIntent?.destination
            ? `OUTFIT MOOD / INTENDED OCCASION (describes the CLOTHES, NOT the capture location): "${[semIntent.mood, semIntent.destination].filter(Boolean).join(' — ')}"`
            : '';
          // El Visual Reference Contract ya construido arriba
          const contractBlock    = weeklyVisualContract?.contractBlock ?? '';
          const primarySlots     = weeklyVisualContract?.primarySlotNames.join(', ') ?? '';
          const fingerprint      = buildAvatarBaseClothingFingerprint();
          return `SHOT IDENTITY — WEEKLY EDIT:
- Face reference images: EXACT identity anchor — same bone structure, same hair, same skin tone. No beautification.
${refs.bodyRef ? '- Body reference: establishes physique (build, proportions) ONLY. The clothing in this image is NOT a wardrobe item.' : ''}
- World anchor image: establishes room, light quality, ambient mood, color temperature ONLY. Clothing from this image is NOT a wardrobe item.

WEEKLY ROLE: ${roleLabel}
VISUAL INTENT: ${visualIntent || `The primary wardrobe item for this shot is ${primarySlots || 'the assigned outfit'}.`}
COMPOSITION MODE: ${compositionMode || 'authentic_natural'}
${resolvedTags ? `TAGS FROM BRIEF: ${resolvedTags}` : ''}
${moodLine}

${contractBlock}

${isHero ? `HERO SHOT RULES:
- The person wears EXACTLY the garment assigned as PRIMARY in the contract above.
- Look for the PRIMARY GARMENT image in the contract — that is the SOLE source of wardrobe truth.
- DO NOT use clothing from identity/body/world images as the garment.
- DO NOT mix in elements from other uploaded outfit images.
- The garment in the PRIMARY slot is the ONLY outfit for this shot.${semIntent?.destination ? `\n- The style intention of this look is "${semIntent.destination}" — reflect this in body language, attitude, and styling ONLY. Do NOT change the capture environment or move to a ${semIntent.destination} location. The room stays as anchored by REF0.` : ''}` : ''}
${isOverview ? `OVERVIEW RULES:
- Show ALL weekly items arranged naturally together on a surface (bed, rack, chair, floor, table).
- Person may appear partially (hands organizing) or not at all.
- This is NOT a worn look. The person should NOT be modeling the outfit in this shot.
- Arrange items in an editorial, organized but real way — NOT a catalog grid, NOT a collage.` : ''}
${(isDetail || isAccessory) ? `ACCESSORY / DETAIL RULES:
- The reference image shown in the contract is the EXACT piece. Reproduce faithfully — same shape, material, color.
- Do NOT substitute another piece.
- Do NOT invent a different accessory or combine it with another piece.
${weekPlan?.integratedWithOutfitId ? `- This accessory must appear TOGETHER with the associated outfit in the contract — show both naturally worn, not as an isolated macro.` : ''}` : ''}

⛔ FORBIDDEN WARDROBE — AVATAR BASE CLOTHING MUST NOT BE A STORY OUTFIT:
The avatar/body reference photos are IDENTITY REFERENCES ONLY.
The clothing on those photos (${fingerprint.summary}) is background data — NOT a content item.
  • Do NOT dress the person in: ${fingerprint.topColor} ${fingerprint.topType} + ${fingerprint.bottomColor} ${fingerprint.bottomType}
  • If this shot has an assigned primary outfit, the person MUST wear THAT uploaded outfit exclusively.
  • The avatar's base wardrobe must NEVER substitute for a missing or unassigned outfit.
  • Neutral footwear (${fingerprint.shoes}) is allowed ONLY if no footwear item was uploaded.

⛔ NO EXTERNAL BRANDING — HARD RULE:
Do NOT generate bags, boxes, or props with visible brand names or logos.
If props appear: PLAIN, UNBRANDED, GENERIC only.

🛍️ SCENE PROP BUDGET — WEEKLY:
Maximum 1–3 neutral unbranded props per scene (exception: OVERVIEW role may show all weekly items).
Space must feel clean, real, editorial — not a cluttered store room.
Do NOT invent large props or furniture not established in REF0.

⚠️ REFERENCE ROLE:
Weekly outfit/accessory references are photos of the ITEMS — not a person wearing them.
Use them to understand the piece; show the person wearing it naturally in this shot.
References = identity constraints, NOT a visual checklist.
ONE person maximum in any frame.

NARRATIVE ARC POSITION: Shot ${shot.arcPosition} of ${totalShots} — ${roleLabel}.`;
        })()
      : isOutfitShot
      ? `SHOT IDENTITY — OUTFIT SET:
- Face reference (appears 3 times): EXACT identity — same bone structure, same hair, same skin tone. No beautification.
${refs.bodyRef ? '- Body reference: establishes physique (build, proportions). Do NOT make the person heavier or slimmer than shown.' : ''}
- REF0: establishes the visual world — same light, same scene, same color temperature.
${shotOutfitInstruction}

⚠️ REFERENCE ROLE — READ CAREFULLY:
Garment references are photos of the GARMENTS ALONE — not a person wearing them. Use them to understand the piece, then show the person wearing it naturally.
References are IDENTITY constraints, NOT a checklist. Show only what belongs to THIS moment.
ONE person maximum in any frame. Any background figure is a generation error.

NARRATIVE ARC POSITION: Shot ${shot.arcPosition} of ${totalShots} — ${shot.role}.`
    : isFacelessShot
      ? `SHOT IDENTITY:
- REF0 establishes the visual world — same surface, same light, same color temperature.
${extraProducts.length > 0 ? `PRODUCT MULTI-ANGLE: Multiple product references show the same object from different angles. Use all of them to reproduce it faithfully.` : refs.productRef ? `- Product reference: reproduce it faithfully — same design, finish, and proportions.` : ''}
${sceneForShot ? `- Scene reference: same workspace / environment as established in REF0.` : ''}
🚫 NO FACE. NO HEAD. NO FULL BODY. If hands appear, they must be actively doing something.`
      : `SHOT IDENTITY:
- Face reference (appears multiple times): EXACT identity, same bone structure, same hair, same skin tone.
${refs.bodyRef ? '- Body reference: establishes physique (build, proportions). Do NOT make the person heavier or slimmer than shown.' : ''}
- REF0 (after face/body refs): establishes the visual world — same light, same scene, same color temp.
${outfitLockForShot}
${extraProducts.length > 0 ? `PRODUCT MULTI-ANGLE: Multiple product references show the same object from different angles. Use all of them to reproduce it faithfully.` : ''}
${sceneForShot !== refs.sceneRef ? `SCENE NOTE: This shot uses an alternate scene reference (position ${shot.arcPosition} of ${totalShots} in the story arc). Integrate the person naturally into this new environment — same person, new setting.` : ''}`;

  const ugcRealismBlock = isFacelessShot
    ? `📱 iPhone BTS REALISM (NON-NEGOTIABLE):
You are taking a new iPhone-style photo inside the same workspace/process as REF0.
Natural window light, handheld imperfection, real surface texture — no studio polish.
The result must look like a creator documenting their process on their phone.
Organic, imperfect, lived-in. NOT editorial. NOT advertising. NOT staged. NO FACE.`
    : recipe === 'outfit_haul'
      ? `📱 iPhone HAUL REALISM (NON-NEGOTIABLE):
You are capturing a real clothing haul session on an iPhone.
REQUIRED: natural window light, slight handheld imperfection, real room texture (sheets, wood, carpet), real skin.
REQUIRED: the room feels lived-in — a real bedroom, dressing room, or fitting space, not a stage.

FORBIDDEN:
- editorial fashion shoot look
- high fashion campaign lighting
- beauty filter or skin retouching
- studio softbox or artificial setups
- glossy magazine aesthetic
- perfectly symmetric catalog composition
- overly composed flat lay with props
- fashion week runway energy
- any ad or commercial feel

This is a real person trying on clothes in their real space and sharing it on social media.
The image should feel like it came directly from someone's camera roll.`
      : recipe === 'outfit_week'
      ? `📱 iPhone WEEKLY EDIT REALISM (NON-NEGOTIABLE):
You are capturing a real weekly fashion edit on an iPhone — "my outfits / favorites of the week."
REQUIRED: natural window light, slight handheld imperfection, real room texture, real skin tone.
REQUIRED: the space feels lived-in and real — a real room or real environment, not a studio set.

FORBIDDEN:
- editorial fashion shoot aesthetics
- high fashion campaign lighting
- beauty filters or skin retouching
- studio backdrop or artificial softbox
- catalog or brand-shoot composition
- generic white background
- external brand logos (Zara, H&M, Nike, etc.)
- invented retail packaging or shopping bags with brand names
- props not established in REF0 (unless the shot role requires a neutral surface)

This is a real creator sharing their weekly looks and favorites on social media.
The image should feel authentic, lived-in, and carouseable — not an ad.`
      : recipe === 'product_haul'
      ? `📱 iPhone PRODUCT HAUL REALISM (NON-NEGOTIABLE):
You are capturing a real product haul session on an iPhone — "look what arrived" / "my new set."
REQUIRED: natural window light, slight handheld imperfection, real room texture, real skin tone.
REQUIRED: the space feels lived-in and real — a real room, desk, or table, not a studio set.

FORBIDDEN:
- studio product-ad lighting or softbox setups
- glossy commercial/catalog composition
- beauty filters or skin retouching
- generic white background
- external brand logos not visible in the uploaded references
- invented packaging or products not uploaded by the user
- interaction mismatched with the product type (e.g. "applying" a gadget, "operating" a skincare jar)

This is a real person sharing a new product set on social media.
The image should feel authentic and lived-in — not an ad.`
      : `📱 iPhone UGC REALISM (NON-NEGOTIABLE):
You are taking a new iPhone-style photo inside the same existing moment as REF0.
Natural light, handheld imperfection, real skin texture, no studio polish.
The result must look like someone captured this moment on their phone — not a photographer.
Organic, imperfect, lived-in. NOT editorial. NOT advertising. NOT staged.`;

  const briefContextBlock   = extractBriefContextBlock(basePrompt, recipe);
  const hasUserSceneRef = !!(refs.scenePruebaRef || refs.sceneRef);
  // Para outfit_check usar el router semántico completo; para otros usar legado
  const briefCtxForShot = isOutfitCheckRecipe ? parseOutfitBriefContext(basePrompt) : null;
  const destDescForShot = briefCtxForShot?.destinationLabel || getDestinationDescription(inferDestinationFromBrief(basePrompt));
  const shotLocationOverride = shot.sceneLockPolicy
    ? (buildSceneLockPolicyBlock(shot.sceneLockPolicy, destDescForShot, hasUserSceneRef) ?? '')
    : extractShotLocationOverride(basePrompt, shot.key, hasUserSceneRef);
  const styleCoherenceBlock  = buildStyleCoherenceBlock(presentationStyle, shot.key);

  // ── Prep context block — solo ocasión abstracta, sin visual del destino ────────
  // Solo para outfit_check en shots de prep. Reemplaza el venueSignal genérico.
  const prepContextBlock = recipe === 'outfit_check' && briefCtxForShot
    ? buildPrepContextOnlyBlock(briefCtxForShot, shot.key ?? '')
    : '';

  // ── REF0 Hard Lock — regla dura para mantener el prep space ──────────────────
  // Para outfit_check en shots de prep — más fuerte que el sceneContinuityBlock.
  const ref0HardLock = (() => {
    if (recipe !== 'outfit_check') return '';
    if (shot.narrativeStage === 'destination') return '';
    if (!ref0Analysis) return '';
    const fingerprint = buildSceneFingerprint(
      ref0Analysis,
      hasUserSceneRef,
      briefCtxForShot?.prepMood ?? '',
    );
    return buildREF0HardLockBlock(shot.sceneLockPolicy, hasUserSceneRef, fingerprint);
  })();

  // ── Scene Continuity Block — propaga fingerprint del prep space ───────────────
  // Solo para recetas outfit_check y solo en shots del prep arc (no destination)
  // Complementa el hard lock con información específica del fingerprint
  const sceneContinuityBlock = (() => {
    if (!isOutfitCheckRecipe) return '';
    if (shot.continuityMode === 'free' || shot.narrativeStage === 'destination') return '';
    if (!ref0Analysis) return '';
    if (ref0HardLock) return '';  // el hard lock ya cubre esto para outfit_check
    const fingerprint = buildSceneFingerprint(
      ref0Analysis,
      hasUserSceneRef,
      briefCtxForShot?.prepMood ?? '',
    );
    return buildSceneContinuityBlock(fingerprint, shot.key ?? '', hasUserSceneRef);
  })();

  // ── Adaptive Closure Block — solo para OUTFIT_DESTINATION ─────────────────────
  const adaptiveClosureBlock = (() => {
    if (!isOutfitCheckRecipe) return '';
    if (shot.key !== 'OUTFIT_DESTINATION') return '';
    if (!shot.poseIntent) return '';
    return buildAdaptiveClosureBlock(
      shot.poseIntent,
      shot.environmentAffordances ?? [],
      destDescForShot,
      shot.closureReason ?? 'organic social closure',
    );
  })();

  // ── WEARING CONTEXT SEMANTICS — outfit_haul y outfit_week ────────────────────
  // Evita que términos de ocasión ("cena", "oficina") contaminen el fondo de captura.
  const haulLocationSemanticsBlock = (() => {
    if (recipe !== 'outfit_haul' && recipe !== 'outfit_week') return '';
    const ctx = parseOutfitBriefContext(basePrompt);
    const isWearingOnly = ctx.wearingContextOnly === true;
    // Siempre inyectar el bloque de semántica de locación en haul.
    // Si wearingContextOnly=true, añadir advertencia explícita + forbidden list.
    // Si wearingContextOnly=false/undefined, solo el recordatorio base.
    const sessionType = recipe === 'outfit_week' ? 'weekly outfit edit' : 'clothing haul';
    const wearingOnlyWarning = isWearingOnly
      ? `
⚠️ CRITICAL — OCCASION ≠ CAPTURE LOCATION:
The brief mentions "${ctx.wearingContextStyleLabel ?? 'this occasion'}". This describes what the CLOTHES are for — NOT where this ${sessionType} is filmed.
The user is shooting their ${sessionType} at HOME. The clothes happen to be ${ctx.wearingContextStyleLabel ?? 'occasion-appropriate'}.
DO NOT move the session into a ${ctx.wearingContextStyleLabel ?? 'specific venue'}.
DO NOT generate: restaurant interior, candlelit table, office lobby, event venue, airport terminal, beach, or any destination-specific environment.
The clothes evoke an occasion — the ROOM is still a bedroom / dressing area / home space anchored by REF0.`
      : '';
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 CAPTURE LOCATION LOCK (BINDING — DO NOT IGNORE):
This ${sessionType} is filmed in a HOME / PERSONAL SPACE: bedroom, dressing room, mirror area, or closet.
The brief may mention occasions (dinner, office, beach, travel) — these describe WHERE THE CLOTHES WILL BE WORN, not where this session is filmed.
${wearingOnlyWarning}
FORBIDDEN BACKGROUNDS (unless the user explicitly says "film it at X"):
❌ restaurant interior, candlelit dining room, bar, or any dining venue
❌ office lobby, coworking, corporate corridor, or workplace
❌ event venue, gala hall, cocktail reception space
❌ airport terminal or travel setting
❌ beach, pool, or outdoor destination
❌ any location invented from the brief's occasion keywords
ALWAYS stay in the REF0 environment — that is the ONLY allowed capture location.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  })();

  // ── Global Stability Blocks — selección condicional por receta y contexto ─────
  //
  // GLOBAL_SCENE_LOCK: todas las recetas excepto outfit_check (ya tiene ref0HardLock/sceneContinuity)
  // GLOBAL_AVATAR_SUPPRESSION: todas las recetas con persona (no faceless), EXCEPTO unboxing
  //   sin outfitRef — ver unboxingInheritsAvatarClothing abajo, decisión explícita del
  //   usuario de invertir el comportamiento default solo para ese caso puntual.
  // GLOBAL_WARDROBE_PHYSICS: todos los shots con garment — omitir en overview/product-only
  // GLOBAL_ANATOMY_SAFETY: todos los shots con persona
  // GLOBAL_VISUAL_FIDELITY: todos los shots con slot item
  // GLOBAL_NO_BRANDING: todas las recetas sin excepción

  const hasPersonInShot = !isFacelessShot;
  const isOverviewShot  = (shot.key ?? '').includes('OVERVIEW') || (shot.key ?? '').includes('ANCHOR') || (shot.key ?? '').includes('INTRO');
  const hasGarmentSlot  = !isOverviewShot || recipe === 'outfit_haul' || recipe === 'product_haul';  // overview de haul/product haul también tiene refs de ítems

  // unboxing sin outfitRef: el avatar SÍ debe vestir con su propia ropa (heredada, ver
  // shotIdentityBlock/identityBlock del REF0) — GLOBAL_AVATAR_SUPPRESSION diría
  // exactamente lo contrario ("no dejes que la ropa del avatar se vuelva el wardrobe
  // dominante"), así que se omite solo en este caso puntual. Con outfitRef sí se
  // mantiene: ahí la prenda subida debe ganarle a la ropa del avatar, como en cualquier
  // otra receta.
  const unboxingInheritsAvatarClothing = isUnboxing && !refs.outfitRef;

  const globalSceneLock        = (recipe !== 'outfit_check') ? GLOBAL_SCENE_LOCK : '';
  const globalAvatarSuppression = (hasPersonInShot && !unboxingInheritsAvatarClothing) ? GLOBAL_AVATAR_SUPPRESSION : '';
  const globalWardrobePhysics   = (hasPersonInShot && hasGarmentSlot) ? GLOBAL_WARDROBE_PHYSICS : '';
  const globalAnatomySafety     = hasPersonInShot ? GLOBAL_ANATOMY_SAFETY : '';
  const globalVisualFidelity    = hasGarmentSlot ? GLOBAL_VISUAL_FIDELITY : '';
  const globalNoBranding        = GLOBAL_NO_BRANDING;  // siempre

  const prompt = `${LOCK_SYSTEM}

${PARADIGM_RULE}

${shotModeBlock}

${briefContextBlock}

${prepContextBlock}

${shotLocationOverride}

${ref0HardLock}

${sceneContinuityBlock}

${adaptiveClosureBlock}

${haulLocationSemanticsBlock}

${styleCoherenceBlock}

${wearStateBlock}

${itemStatePlanBlock}

${cameraModeBlock}

${hpiBlockOff}

${injectREF0Analysis(ref0Analysis, shot.narrativeStage)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 IMAGE ${shot.arcPosition} · ${momentLabel}

STORY CONTEXT: "${basePrompt}"
NARRATIVE: ${NARRATIVE_META[narrative].label}
FORMAT: ${aspectInstr}

${briefTagMap?.tagContext ?? ''}

${familyBlock}

${hpiBlock}

SHOT ROLE: ${shot.role}
SHOT PURPOSE: ${shot.purpose}

FRAMING: ${shot.framing}
COMPOSITION: ${shot.composition}
CAMERA ANGLE: ${shot.cameraAngle}

REQUIRED ELEMENTS (must be present):
${shot.requiredElements.map(e => `- ${e}`).join('\n')}

FORBIDDEN (automatic failure if present):
${shot.forbiddenElements.map(e => `❌ ${e}`).join('\n')}

VISUAL VARIATION OPTIONS (choose the most fitting for this scene):
${shot.variationSpace.map((v, i) => `${i + 1}. ${v}`).join('\n')}

${shotIdentityBlock}
- This shot is part of a STORY — it must connect to the same narrative world established in REF0.

${ugcRealismBlock}

${globalSceneLock}

${globalAvatarSuppression}

${globalWardrobePhysics}

${globalAnatomySafety}

${globalVisualFidelity}

${globalNoBranding}

🚫 ONE SINGLE IMAGE:
Generate ONE photo. No collage. No grid. No side by side. No reference board.
Do NOT paste reference images into the output. Use them only as visual constraints.

${NEGATIVE_SHORT}`;

  // Director Creativo GENÉRICO (ver directorFinalPrompt en shared.ts): si
  // este shot ya trae un prompt completo redactado por el director, se usa
  // TAL CUAL — el director ya incluye PHOTODUMP_HARD_RULES_TEXT y sus
  // propias reglas de redacción, ensamblar el prompt genérico de arriba
  // encima sería redundante y podría contradecirlo. refsToPass/preparedRefs
  // siguen viniendo del mecanismo normal de la receta (identidad/cuerpo/
  // outfit/escena) — solo el TEXTO cambia, nunca las referencias reales.
  const finalPrompt = shot.directorFinalPrompt ?? prompt;

  const preparedRefs = await prepareRefs(refsToPass);
  const imageUrl = await imageApiService.generateImage({
    prompt: finalPrompt,
    negative:        NEGATIVE_SHORT,
    referenceImages: preparedRefs,
    aspectRatio:     getAspectRatio(destino),
    modelId:         'gemini',
    uid:             sessionParams.uid,
    sessionId:       sessionParams.sessionId,
    module:          'photodump',
    moduleLabel:     'Photodump Mode',
    shotIndex:       shot.arcPosition,
    totalShots:      6,
    metadata:        { role: shot.role, beat: shot.beat, narrative },
  });
  return {
    imageUrl,
    prompt: finalPrompt,
    refsCount:      preparedRefs.length,
    hpiSource,
    familyBlockMode: recipe === 'outfit_check'
      ? 'disabled'
      : familyBlock
        ? (isOutfitCheckRecipe ? 'abstract_style_hint' : 'literal_prompt_block')
        : 'disabled',
    poseIntent:     shot.poseIntent,
    detailKind:     shot.detailKind,
    continuityMode: shot.continuityMode,
    environmentAffordances: shot.environmentAffordances,
    closureReason:  shot.closureReason,
    // ── Global Stability Debug (patch v5) ──
    globalStabilityBlocks: {
      sceneWorldPlanApplied:              true,
      sceneFingerprintLockApplied:        globalSceneLock !== '',
      avatarBaseClothingSuppressedGlobally:   globalAvatarSuppression !== '',
      avatarBaseClothingSuppressedInStoryShots: hasPersonInShot,
      wardrobePhysicalIntegrationApplied: globalWardrobePhysics !== '',
      longFootwearIntegrationChecked:     globalWardrobePhysics !== '',
      layeringConsistencyChecked:         globalWardrobePhysics !== '',
      anatomySafetyApplied:               globalAnatomySafety !== '',
      mirrorConsistencyApplied:           globalAnatomySafety !== '',
      visualItemFidelityApplied:          globalVisualFidelity !== '',
      externalBrandingForbiddenApplied:   true,
      readableTextForbiddenApplied:       true,
      // Riesgos detectados (estimados estáticamente — sin análisis semántico del output)
      avatarBaseClothingContaminationRisk: false,
      ref0UsedAsWardrobeSource:            false,
      extraLimbRisk:                       false,
      mirrorReflectionRisk:                false,
      externalBrandTextRisk:               false,
      primaryItemFidelityRisk:             false,
      colorMaterialDriftRisk:              false,
      wardrobeIntegrationRisk:             false,
    },
    // ── WeeklySlotCoverageMode debug (outfit_week only) ──
    weeklySlotCoverageMode:                      recipe === 'outfit_week',
    creativePlannerReducedForOutfitWeek:         recipe === 'outfit_week',
    destinationInferenceDisabledForOutfitWeek:   recipe === 'outfit_week',
    hpiCannotOverrideSlotCoverage:               recipe === 'outfit_week',
    briefContextVenueSignalSuppressedForWeek:    recipe === 'outfit_week',
  } as any;
}

// ── Caption + hashtags por Gemini ─────────────────────────────
// Un caption único por set + una colección de hashtags para el carrusel completo.
// El caption va en la primera imagen del set (orden 1). Las demás no llevan caption.

export interface PhotodumpSetCaption {
  caption:  string;
  hashtags: string;
}

export async function generatePhotodumpCaptions(
  basePrompt: string,
  narrative:  PhotodumpNarrative,
  shots:      PhotodumpShotDirective[],
  gender:     'female' | 'male' | 'neutral' = 'female',
): Promise<PhotodumpSetCaption> {

  const storyContext = NARRATIVE_META[narrative].label;
  const genderNote = gender === 'male'
    ? 'The creator/protagonist is MALE. Use masculine grammar and pronouns in Spanish (e.g., "estoy listo", "me puse", "quedé"). Do NOT use feminine forms like "-a", "lista", "puesta".'
    : gender === 'neutral'
      ? 'Use gender-neutral language in Spanish where possible. Avoid heavily gendered adjectives.'
      : 'The creator/protagonist is FEMALE. Use feminine grammar in Spanish.';

  const prompt = `You are a social media copywriter for a Spanish-speaking content creator.
Write ONE caption for a ${shots.length}-image photodump carousel posted as a single Instagram/TikTok post.

CREATOR GENDER: ${genderNote}

CONTEXT: "${basePrompt}"
NARRATIVE: ${storyContext}

This is a single post — one caption covers the whole set. The caption should capture the mood and story of the entire carousel, not describe any single image.

Write:
1. "caption": one engaging caption in Spanish (max 180 chars, conversational, authentic voice, 1-2 emojis — sounds like a real person posting, NOT a brand)
2. "hashtags": 8-12 hashtags mix Spanish/English as a single string

Rules:
- The caption must work as the opening text of the post — it will be read before swiping
- Sound like someone talking to a friend or sharing a moment, not writing an ad
- Do NOT describe images in sequence ("primero", "luego", "al final")
- The hashtags should be a mix: niche (2-3), topic-specific (3-4), broad reach (2-3)

Output ONLY valid JSON object:
{"caption":"...","hashtags":"..."}`;

  try {
    const raw = await geminiService.generateText(prompt);
    const match = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.caption) {
        return {
          caption:  parsed.caption  ?? '',
          hashtags: parsed.hashtags ?? '',
        };
      }
    }
  } catch (err) {
    console.warn('[photodumpDirector] generateCaptions failed:', err);
  }

  return { caption: 'Momentos así 💫', hashtags: '#lifestyle #organic #ugc #content #moments' };
}

// ── Modo libre: generación de escena individual ───────────────
//
// Lógica:
//   1. El prompt del usuario va primero — es la directiva principal.
//   2. LOCK_SYSTEM y PARADIGM_RULE se mantienen como invariantes.
//   3. HPI se inyecta solo si hay avatar en esta escena Y el prompt del
//      usuario no describe expresión ni pose explícitamente.
//   4. Si la escena tiene relación con una anterior, el resultado de esa
//      escena se adjunta como referencia adicional para coherencia visual.
//   5. Se envían solo las referencias de esta escena — no se acumula el set.

export interface FreeModeSceneParams {
  scene:         FreeScene;
  sceneIndex:    number;
  destino:       PhotodumpDestino;
  priorResults:  (string | null)[];
  allScenes?:    FreeScene[];
  modelId?:      string;
  sessionParams: { uid?: string; sessionId?: string };
}

// Detecta si el prompt del usuario ya describe expresión o pose
// para evitar inyectar HPI redundante o contradictorio.
function promptDescribesHuman(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const humanTerms = [
    'sonriendo', 'mirando', 'posando', 'expresi', 'gesto', 'emocion',
    'riendo', 'sentada', 'parada', 'caminando', 'pose', 'expresion',
    'feliz', 'seria', 'pensativa', 'looking', 'smiling', 'sitting',
    'standing', 'walking', 'laughing', 'expression', 'pose',
  ];
  return humanTerms.some(t => lower.includes(t));
}

function flattenFreeRefs(refs: FreeSceneRefs): (string | null)[] {
  return [
    ...(refs.personas ?? []),
    ...(refs.outfit   ?? []),
    ...(refs.producto ?? []),
    ...(refs.escena   ?? []),
  ];
}

export async function generateFreeModeScene(params: FreeModeSceneParams): Promise<string> {
  const { scene, sceneIndex, destino, priorResults, allScenes, modelId, sessionParams } = params;

  const aspectInstr  = getAspectInstruction(destino);
  const hasPersonas  = (scene.refs.personas ?? []).some(Boolean);
  // compatibilidad: si viejo set usaba avatar
  const hasAvatar    = hasPersonas || (scene.refs as any).avatar?.some(Boolean);

  // ── Slot tag map: @persona/@persona2..→personas, @outfit→outfit, etc. ──
  const SLOT_TAG_MAP: Record<string, keyof FreeSceneRefs> = {
    persona:  'personas',
    persona2: 'personas',
    persona3: 'personas',
    persona4: 'personas',
    outfit:   'outfit',
    producto: 'producto',
    escena:   'escena',
  };

  // ── Resolver @tags del prompt ─────────────────────────────────
  // Tipo A: @persona, @outfit, @producto, @escena → slots de esta escena
  // Tipo B: @escena1, @escena2... → resultados generados de escenas anteriores
  const promptTags = [...new Set((scene.prompt.match(/@(\w+)/g) ?? []).map(t => t.slice(1)))];

  // Tags tipo A activados en el prompt (para incluir esas refs aunque no estén por defecto)
  const activeSlotTags = promptTags.filter(t => SLOT_TAG_MAP[t]);

  // Tags tipo B: @escena1, @escena3, etc.
  const sceneTagRefs: string[] = [];
  promptTags.forEach(t => {
    const m = t.match(/^escena(\d+)$/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      const url = priorResults[idx];
      if (url) sceneTagRefs.push(url);
    }
  });

  // También incluir sceneRefs seleccionados manualmente en la UI (sin @tag en el prompt)
  (scene.sceneRefs ?? []).forEach(tag => {
    const m = tag.match(/^escena(\d+)$/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      const url = priorResults[idx];
      if (url && !sceneTagRefs.includes(url)) sceneTagRefs.push(url);
    }
  });

  // ── Construir refsToPass (cap 6 total, aplicado en prepareRefs) ──
  const refsToPass: (string | null)[] = [];

  // Personas: cada una aparece x2 para reforzar identidad (sin triplicar, cap global de 6 controla)
  const personaImages = (scene.refs.personas ?? (scene.refs as any).avatar ?? []).filter(Boolean) as string[];
  personaImages.forEach(r => refsToPass.push(r, r));

  // Outfit
  (scene.refs.outfit ?? []).filter(Boolean).forEach(r => refsToPass.push(r));

  // Producto
  (scene.refs.producto ?? []).filter(Boolean).forEach(r => refsToPass.push(r));

  // Escena
  (scene.refs.escena ?? []).filter(Boolean).forEach(r => refsToPass.push(r));

  // Refs de escenas previas (tipo B) al final — contexto narrativo (máx 2)
  sceneTagRefs.slice(0, 2).forEach(r => refsToPass.push(r));

  // ── Bloques de contexto para el prompt ───────────────────────
  const useHpi = hasAvatar && !promptDescribesHuman(scene.prompt);
  const hpiBlock = useHpi
    ? buildHpiBlock({
        enabled:            true,
        gender:             'female',
        modoVisual:         'ugc',
        includeGesture:     false,
        includePerformance: false,
      })
    : '';

  const personaCount = personaImages.length;
  const identityBlock = hasAvatar
    ? `IDENTITY LOCK${personaCount > 1 ? ` (${personaCount} PERSONS)` : ''}:
- Each person's reference appears twice — intentional. They are the ground truth.
- Preserve: bone structure, eye shape/color, nose, lips, jaw, hair (color+texture+length), skin tone.
${personaCount > 1 ? `- There are ${personaCount} DISTINCT people — do NOT merge or blend their faces.` : ''}
- Reference images OVERRIDE any stylistic drift.

⚠️ ANTI-COLLAGE RULE:
- References are VISUAL GUIDES for identity ONLY — NOT elements to paste.
- Generate ONE single seamless photograph from scratch.`
    : '';

  // Bloque de continuidad multi-escena (resume qué aporta cada ref de escena)
  const continuityBlock = sceneTagRefs.length > 0
    ? `VISUAL CONTINUITY WITH PRIOR SCENES (${sceneTagRefs.length} reference${sceneTagRefs.length > 1 ? 's' : ''}):
- The last ${sceneTagRefs.length} reference image${sceneTagRefs.length > 1 ? 's are' : ' is'} from prior scenes in this story.
- Use them for NARRATIVE CONTINUITY: same lighting quality, color temperature, and any object/element explicitly mentioned as carried over.
- Elements NOT mentioned in this scene's directive do NOT need to appear — follow the directive.
- This is a NEW shot in the same visual world — NOT a copy of any prior scene.`
    : '';

  // ── Prompt final ──────────────────────────────────────────────
  const prompt = `${LOCK_SYSTEM}

${PARADIGM_RULE}

${STORY_MODE_DOMINANCE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 FREE MODE — SCENE ${sceneIndex + 1}

FORMAT: ${aspectInstr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCENE DIRECTIVE (user prompt — this is the primary instruction):
${scene.prompt}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${identityBlock}

${continuityBlock}

${hpiBlock}

📱 iPhone UGC REALISM (NON-NEGOTIABLE):
Natural light, handheld imperfection, real skin texture, no studio polish.
Organic, imperfect, lived-in. NOT editorial. NOT advertising. NOT staged.

🚫 ONE SINGLE IMAGE:
Generate ONE photo. No collage. No grid. No side by side.
Use references ONLY as visual constraints — do NOT paste them.

${NEGATIVE_SHORT}`;

  const hpiNegatives = useHpi ? getHpiNegatives('female').join(', ') : '';
  const negative = hpiNegatives
    ? `${NEGATIVE_SHORT}, ${hpiNegatives}`
    : NEGATIVE_SHORT;

  return imageApiService.generateImage({
    prompt,
    negative,
    referenceImages: await prepareRefs(refsToPass),
    aspectRatio:     getAspectRatio(destino),
    modelId:         modelId as any,
    uid:             sessionParams.uid,
    sessionId:       sessionParams.sessionId,
    module:          'photodump',
    moduleLabel:     'Photodump Mode · Libre',
    shotIndex:       sceneIndex,
    totalShots:      1,
    metadata:        { role: 'FREE_SCENE', sceneIndex, sceneRefs: scene.sceneRefs ?? [] },
  });
}

// ── Helper de UI ──────────────────────────────────────────────

export function getRefsAsArray(refs: PhotodumpRefs): string[] {
  return [
    refs.avatarRef,
    refs.bodyRef ?? null,
    refs.productRef,
    ...((refs.productRefs ?? []).filter(Boolean)),
    refs.outfitRef,
    refs.sceneRef,
    ...((refs.sceneRefs ?? []).filter(Boolean)),
  ].filter(Boolean) as string[];
}
