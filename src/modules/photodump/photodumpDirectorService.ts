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
  buildWeeklyManifest, weeklyRoleToDirective,
} from './recipes/outfitWeek';

initHpiService();

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

// ── Helpers ───────────────────────────────────────────────────

// Router semántico completo para outfit_check.
// Reemplaza parseBriefContext con precisión de destino, prep environment y mood.
export function parseOutfitBriefContext(basePrompt: string): OutfitBriefContext {
  const lower = basePrompt.toLowerCase();

  // ── Time signal ───────────────────────────────────────────────
  let timeSignal: OutfitBriefContext['timeSignal'] = 'unspecified';
  if (lower.includes('noche') || lower.includes('night') || lower.includes('nocturno') || lower.includes('nocturna') || lower.includes('evening'))
    timeSignal = 'night';
  else if (lower.includes('atardecer') || lower.includes('sunset') || lower.includes('golden hour') || lower.includes('hora dorada'))
    timeSignal = 'golden_hour';
  else if (lower.includes('mañana') || lower.includes('morning') || lower.includes('amanecer') || lower.includes('desayuno') || lower.includes('brunch'))
    timeSignal = 'morning';
  else if (lower.includes('mediodía') || lower.includes('midday'))
    timeSignal = 'day';
  else if (lower.includes('tarde') || lower.includes('afternoon') || lower.includes('almuerzo'))
    timeSignal = 'afternoon';

  // ── Destination class — orden de prioridad específico→genérico ─
  let destinationClass: OutfitDestinationClass = 'none';
  let destinationLabel = '';
  let destinationMood  = '';
  let destinationShotOptions: string[] = [];

  if (lower.includes('ópera') || lower.includes('opera') || lower.includes('ballet') ||
      (lower.includes('teatro') && !lower.includes('reunión') && !lower.includes('oficina'))) {
    destinationClass = 'opera_theatre';
    destinationLabel = 'opera house or theatre — grand foyer, marble floors, ornate chandeliers, velvet curtains, formal elegance';
    destinationMood  = 'formal, opulent, golden light, architectural grandeur';
    destinationShotOptions = [
      'relaxed elegant pose in theatre foyer — near column or velvet drape, full body visible, not descending stairs',
      'mirror selfie in elegant theatre bathroom — warm vanity light, marble countertop, full body or three-quarter',
      'seated in lobby lounge on velvet sofa or chair — looking at camera or slightly off, outfit fully readable',
      'standing near ornate architectural detail (column, archway, gilded frame) — pose natural, not catalog',
    ];
  } else if (lower.includes('brunch') || lower.includes('club campestre') || lower.includes('country club') ||
             lower.includes('club house') || lower.includes('terraza club') || lower.includes('almuerzo campestre') ||
             (lower.includes('club') && (lower.includes('brunch') || lower.includes('almuerzo') || lower.includes('terraza')))) {
    destinationClass = 'country_club_brunch';
    destinationLabel = 'country club or upscale brunch venue — garden terrace, clubhouse lounge, elegant outdoor seating with greenery';
    destinationMood  = 'refined, bright, airy, social, relaxed luxury — morning to afternoon light';
    destinationShotOptions = [
      'relaxed pose on clubhouse terrace — greenery or elegant outdoor furniture in background, natural daylight',
      'seated at brunch table, relaxed and looking at camera — blurred elegant table setting in background',
      'standing near clubhouse entrance or lounge doorway — bright natural light, outfit full body visible',
      'mirror selfie in refined clubhouse bathroom — clean, elegant, bright lighting',
    ];
  } else if (lower.includes('oficina') || lower.includes('reunión') || lower.includes('meeting') ||
             lower.includes('trabajo') || lower.includes('work') || lower.includes('corporate') ||
             lower.includes('business') || lower.includes('cowork') || lower.includes('laboral') ||
             lower.includes('junta') || lower.includes('presentación') || lower.includes('pitch')) {
    destinationClass = 'office_meeting';
    destinationLabel = 'corporate environment — office lobby, building entrance, elevator mirror, coworking premium space, business corridor';
    destinationMood  = 'professional, clean, daylight or bright interior — polished and composed';
    destinationShotOptions = [
      'elevator mirror selfie — natural composition, clean corporate interior visible in reflection',
      'standing naturally near office lobby wall or column — daylight or bright interior, full body visible',
      'corporate corridor or building entrance — walking-arriving feel, not rigid, daylight',
      'cowork lounge — relaxed professional pose, blurred modern interior in background',
    ];
    // (la distinción wearingContextOnly se calcula abajo junto al return)
  } else if (lower.includes('gala') || lower.includes('black tie') || lower.includes('cocktail') ||
             lower.includes('cóctel') || lower.includes('evento formal') || lower.includes('evento de gala')) {
    destinationClass = 'formal_event';
    destinationLabel = 'upscale formal event — elegant venue lobby, cocktail reception space, refined interior with soft golden lighting';
    destinationMood  = 'elegant, polished, evening golden light, sophisticated';
    destinationShotOptions = [
      'elegant lobby or foyer pose — near architectural detail, full body visible, not walking',
      'seated lounge moment at event venue — velvet chair or sofa, outfit readable',
      'mirror selfie in venue bathroom — warm evening light, refined surfaces',
      'standing near floor-to-ceiling window or elegant wall — soft interior light',
    ];
  } else if (lower.includes('restaurant') || lower.includes('restaurante') ||
             lower.includes('dinner') || lower.includes('cena') || lower.includes('date night')) {
    destinationClass = 'restaurant_dinner';
    destinationLabel = 'elegant restaurant — warm candlelight or intimate interior, table setting visible in background, evening atmosphere';
    destinationMood  = 'intimate, warm, evening, romantic or social';
    destinationShotOptions = [
      'restaurant entrance or interior — near host stand or window table, warm light, outfit visible',
      'seated moment — looking at camera or slightly off, blurred elegant table setting behind',
      'bathroom mirror selfie at restaurant — warm intimate light, refined interior',
      'standing at bar or lounge section — relaxed, warm ambient lighting',
    ];
  } else if (lower.includes('playa') || lower.includes('beach') || lower.includes('mar ') || lower.includes('ocean') || lower.includes('pool')) {
    destinationClass = 'beach_day';
    destinationLabel = 'beach or outdoor setting — sand, ocean or pool, open natural light, relaxed and open atmosphere';
    destinationMood  = 'sunny, open, natural, relaxed';
    destinationShotOptions = [
      'full body at beach or poolside — natural light, sand or water visible',
      'relaxed pose near beach entrance or shoreline — looking at camera, outfit readable',
      'standing at outdoor terrace with sea view — natural daylight',
    ];
  } else if (lower.includes('viaje') || lower.includes('travel') || lower.includes('trip') ||
             lower.includes('vuelo') || lower.includes('airport') || lower.includes('aeropuerto')) {
    destinationClass = 'travel_airport';
    destinationLabel = 'airport terminal or travel setting — architectural space, natural light, sense of movement';
    destinationMood  = 'modern, airy, expansive, travel energy';
    destinationShotOptions = [
      'airport lounge or gate area — natural or clean interior light, full body visible',
      'walking moment in terminal — candid stride, outfit in movement',
      'mirror selfie in airport bathroom — clean modern lighting',
    ];
  } else if (lower.includes('salir') || lower.includes('salida') || lower.includes('noche') ||
             lower.includes('night out') || lower.includes('going out') || lower.includes('fiesta') ||
             lower.includes('evento') || lower.includes('concierto')) {
    destinationClass = 'urban_social_outing';
    destinationLabel = 'urban evening — venue exterior or lobby, warm city ambiance, nightlife energy';
    destinationMood  = 'urban, evening, social energy, warm city lights';
    destinationShotOptions = [
      'venue entrance or outdoor terrace — evening city light, full body visible',
      'standing near illuminated exterior or glass facade — warm night ambiance',
      'lobby or reception area — relaxed social pose',
    ];
  }

  // Fallback solo si hay señal de salida/evento pero sin clase específica
  if (destinationClass === 'none' &&
      (lower.includes('evento') || lower.includes('event') || lower.includes('celebración'))) {
    destinationClass = 'generic_outing';
    destinationLabel = 'lifestyle setting — venue entrance or ambient exterior matching the outfit';
    destinationMood  = 'social, relaxed, casual-elegant';
    destinationShotOptions = [
      'pre-exit mirror or doorway — full body visible, confident attitude',
      'venue entrance or exterior — warm ambient light, outfit readable',
    ];
  }

  // ── Prep environment class ────────────────────────────────────
  let prepEnvironmentClass: PrepEnvironmentClass = 'real_bedroom';
  let prepMood = 'real bedroom or dressing area — authentic, lived-in, UGC feel';

  if (destinationClass === 'opera_theatre' || destinationClass === 'formal_event') {
    prepEnvironmentClass = 'upscale_dressing_room';
    prepMood = 'upscale dressing room or warm-lit bedroom — evening vanity light, no daylight, refined surfaces, no clutter';
  } else if (destinationClass === 'country_club_brunch') {
    prepEnvironmentClass = 'refined_bedroom';
    prepMood = 'refined bright bedroom or hotel-like dressing room — clean surfaces, airy daylight, polished feel, no cables or mess';
  } else if ((destinationClass as OutfitDestinationClass) === 'office_meeting' || (destinationClass as OutfitDestinationClass) === 'business_event') {
    prepEnvironmentClass = 'office_ready_room';
    prepMood = 'clean minimal bedroom or tidy mirror area — morning/daylight, practical and polished, no nightlife mood';
  } else if (destinationClass === 'beach_day') {
    prepEnvironmentClass = 'tidy_bedroom';
    prepMood = 'tidy casual room or bathroom — bright natural light, casual clean feel';
  } else if (destinationClass === 'restaurant_dinner') {
    prepEnvironmentClass = 'tidy_bedroom';
    prepMood = 'tidy bedroom or mirror area — warm evening pre-dinner feel, soft light';
  } else if (timeSignal === 'night') {
    prepEnvironmentClass = 'tidy_bedroom';
    prepMood = 'tidy bedroom or mirror area — warm artificial evening light, no daylight';
  }

  // ── wearingContextOnly: distingue "para X" (uso del outfit) de "en X" (locación de captura) ──
  // Regla GLOBAL: para TODOS los destinos.
  // "para la cena / para ir a cenar / look de cena" → ropa de cena, captura en casa/habitación
  // "en el restaurante / grabado en / filmado en" → puede ser locación real
  let wearingContextOnly: boolean | undefined;
  let wearingContextStyleLabel: string | undefined;

  if (destinationClass !== 'none') {
    // Señales explícitas de "filmado en esa locación"
    const hasAtLocation =
      /\ben (la |el |mi |un |una |este )?(ofic|restauran|caf[eé]|playa|aeropuerto|hotel|gala|evento)/i.test(basePrompt) ||
      /grabad[ao] en/i.test(basePrompt) ||
      /filmad[ao] en/i.test(basePrompt) ||
      /fondo de/i.test(basePrompt) ||
      /haz.*en (la |el |mi )/i.test(basePrompt) ||
      /haul en (la |el |mi )/i.test(basePrompt);

    // Si NO hay señal explícita de "filmado en esa locación" → asumir wearingContextOnly
    // La ausencia de señal de locación explícita es la regla por defecto para outfit_week/haul
    if (!hasAtLocation) {
      wearingContextOnly = true;
      const labelMap: Partial<Record<string, string>> = {
        restaurant_dinner:   'dinner / evening out',
        office_meeting:      'office / workwear',
        formal_event:        'formal event / gala',
        opera_theatre:       'opera / theatre',
        country_club_brunch: 'brunch / social occasion',
        beach_day:           'beach / outdoor casual',
        travel_airport:      'travel / airport',
        urban_social_outing: 'night out / social event',
        generic_outing:      'social outing',
      };
      wearingContextStyleLabel = labelMap[destinationClass] ?? destinationClass;
    } else {
      wearingContextOnly = false;
    }
  }

  return {
    timeSignal,
    destinationClass,
    prepEnvironmentClass,
    destinationLabel,
    prepMood,
    destinationMood,
    isOccasionBrief: destinationClass !== 'none',
    destinationShotOptions,
    wearingContextOnly,
    wearingContextStyleLabel,
  };
}

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
export function buildPrepEnvironmentDirective(ctx: OutfitBriefContext, hasUserSceneRef: boolean): string {
  if (hasUserSceneRef) {
    return `PREP SPACE: The user has provided a real prep space reference. Reproduce it faithfully.
Same walls, same light, same surfaces. Do NOT improve or idealize it beyond what is shown.`;
  }

  const envDescriptions: Record<PrepEnvironmentClass, string> = {
    upscale_dressing_room:
      'PREP SPACE (generate): An upscale dressing room or warm-lit bedroom. ' +
      'Think hotel vanity, warm lamp light, clean mirror area, refined surfaces. ' +
      'Evening mood — NO daylight, NO window sunlight. NO clutter, cables, or messy surfaces. ' +
      'The space should feel elegantly intimate — not editorial, but tidy and aspirational.',
    refined_bedroom:
      'PREP SPACE (generate): A refined, tidy bedroom or hotel-like dressing room. ' +
      'Airy daylight through a window, clean minimal surfaces, polished feel. ' +
      'No clutter, no cables, no messy makeup spread. Light walls, clean floor. ' +
      'The space should feel bright and put-together — real but elevated.',
    office_ready_room:
      'PREP SPACE (generate): A clean, minimal bedroom or tidy mirror area. ' +
      'Morning daylight, practical and polished. No nightlife mood, no evening warmth. ' +
      'Neutral surfaces, no clutter. Could be a tidy bedroom, a clean bathroom mirror area, or a simple dressing corner.',
    tidy_bedroom:
      'PREP SPACE (generate): A tidy, real bedroom or mirror area. ' +
      'Natural light or warm room light depending on time of day. Clean surfaces, lived-in but not messy. ' +
      'Authentic UGC feel — not editorial, not messy.',
    hotel_like_room:
      'PREP SPACE (generate): A hotel-like room or upscale residential dressing area. ' +
      'Clean, quiet, refined. Soft light. No personal clutter.',
    bathroom_mirror:
      'PREP SPACE (generate): A bathroom mirror area — clean, bright, intimate. ' +
      'Mirror fills part of the frame. Light is from above or vanity strip.',
    fitting_room:
      'PREP SPACE (generate): A fitting room or boutique dressing room. ' +
      'Clean mirror, neutral walls, soft interior light.',
    real_bedroom:
      'PREP SPACE (generate): A real bedroom or dressing area. ' +
      'Authentic UGC feel — lived-in but clean enough to feel intentional. ' +
      'Light from window or room lamp. No extreme clutter.',
    user_scene_locked: '',  // handled by hasUserSceneRef branch above
  };

  const desc = envDescriptions[ctx.prepEnvironmentClass] || envDescriptions.real_bedroom;
  return `${desc}
IMPORTANT: This is the preparation space — NOT the event venue. Even if the brief mentions ${ctx.destinationLabel || 'a destination'}, this shot is in the getting-ready space.
Do NOT lock accidental clutter. Do NOT replicate random objects, cables, or messy surfaces as required elements.
Keep the space tidy and believable for the brief occasion.`;
}

// ── Prep context directive — SOLO ocasión abstracta, sin términos visuales del destino ──
// Para shots de preparación: menciona la ocasión pero NUNCA el visual del destino.
// Evita que palabras como "opera house", "marble", "chandeliers" aparezcan en prep shots.
export function buildPrepContextOnlyBlock(ctx: OutfitBriefContext, shotKey: string): string {
  if (!ctx.isOccasionBrief || ctx.destinationClass === 'none') return '';
  // Solo para shots de preparación — NUNCA para OUTFIT_DESTINATION
  if (!PREP_SHOT_KEYS.has(shotKey)) return '';

  const occasionLabels: Record<OutfitDestinationClass, string> = {
    opera_theatre:       'opera / theatre date',
    formal_event:        'formal event / gala',
    restaurant_dinner:   'restaurant dinner',
    country_club_brunch: 'upscale brunch / country club',
    office_meeting:      'office meeting / work',
    business_event:      'business event',
    beach_day:           'beach day',
    travel_airport:      'travel / airport',
    urban_social_outing: 'evening out / social event',
    generic_outing:      'outing / event',
    none:                '',
  };

  const occasionText = occasionLabels[ctx.destinationClass] || 'special occasion';
  const timeContext = ctx.timeSignal !== 'unspecified'
    ? `Lighting: ${ctx.timeSignal === 'night' ? 'warm artificial evening light — pre-event getting ready'
        : ctx.timeSignal === 'golden_hour' ? 'golden afternoon light — getting ready'
        : ctx.timeSignal === 'morning' ? 'soft morning light — early prep'
        : ctx.timeSignal === 'afternoon' ? 'natural afternoon light — getting ready'
        : 'ambient interior light — getting ready'}.`
    : 'Pre-event getting-ready lighting — warm indoor atmosphere.';

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 OCCASION CONTEXT (prep shot — destination FORBIDDEN here):
Occasion: ${occasionText}
This shot happens BEFORE leaving — the person is still in the prep/getting-ready space.
${timeContext}

⛔ CRITICAL — DO NOT SHOW THE DESTINATION IN THIS SHOT:
The destination scene appears ONLY in the final OUTFIT_DESTINATION shot.
FORBIDDEN visual terms in THIS shot: opera house, theatre, grand foyer, marble floors,
ornate chandeliers, velvet curtains, restaurant interior, lobby, office corridor,
coworking space, club house, palace hallway, street exterior, hotel lobby.
Even if the brief mentions these places, this shot stays in the PREP ROOM.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ── REF0 Hard Lock — bloque duro para preservar el espacio de preparación ────────
// Más fuerte que buildSceneContinuityBlock — regla explícita de "mismo cuarto físico".
// Aplica a todos los shots con sceneLockPolicy prep_space / prep_space_or_surface / prep_space_or_pre_exit.
function buildREF0HardLockBlock(
  sceneLockPolicy: SceneLockPolicy | undefined,
  hasUserSceneRef: boolean,
  fingerprint?: SceneFingerprint,
): string {
  if (!sceneLockPolicy) return '';
  if (sceneLockPolicy === 'none' || sceneLockPolicy === 'destination_allowed') return '';
  if (!['prep_space', 'prep_space_or_surface', 'prep_space_or_pre_exit', 'strict_ref0'].includes(sceneLockPolicy)) return '';

  const strengthNote = hasUserSceneRef
    ? 'The user provided a real room photo — reproduce it faithfully.'
    : 'REF0 established this space — maintain it exactly across all prep shots.';

  const prexitNote = sceneLockPolicy === 'prep_space_or_pre_exit'
    ? `\nALLOWED TRANSITION: The person may be at the doorway, in the immediate hallway of the SAME space, or near the exit of the prep room. The prep room must still be recognizable.`
    : '';

  const fingerprintNote = fingerprint
    ? `\nSPACE IDENTIFIERS from REF0 (must match):
  • Room type: ${fingerprint.roomType.replace(/_/g, ' ')}
  • Dominant furniture: ${fingerprint.dominantFurniture.replace(/_/g, ' ')}
  • Lighting: ${fingerprint.lightingFamily.replace(/_/g, ' ')}
  • Color palette: ${fingerprint.colorPalette}${fingerprint.hasVisibleMirror ? '\n  • Mirror: visible in the space' : ''}${fingerprint.keyProps.length > 0 ? `\n  • Key props: ${fingerprint.keyProps.join(', ')}` : ''}`
    : '';

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 REF0 BACKGROUND HARD LOCK — PREP SPACE:
${strengthNote}
${fingerprintNote}${prexitNote}

RULE: This shot happens in the EXACT SAME preparation room as REF0.
Preserve the same physical room: same walls, same floor material, same dominant furniture,
same mirror (if present), same bed/vanity/dresser, same lamp/light sources,
same spatial layout, same cleanliness level, same color palette.

ALLOWED CHANGES between shots (camera only):
  ✅ Camera angle (closer, farther, different corner)
  ✅ Crop and framing
  ✅ Focal length and depth of field
  ✅ Subject position within the room
  ✅ Minor object movement related to the outfit (garment moved, bag placed differently)

FORBIDDEN CHANGES (hard failure):
  ❌ New room or different bedroom
  ❌ Hotel lobby, palace hallway, theatre foyer, restaurant, office corridor
  ❌ Different wall color or different floor material
  ❌ Different furniture arrangement or swap of dominant furniture
  ❌ Chandeliers or velvet curtains unless they already exist in REF0
  ❌ New decorative style not present in REF0
  ❌ Any element from the destination venue (opera, theatre, club, restaurant, cowork, etc.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// Descripción textual del destino inferido para inyectar en el prompt del DESTINATION shot.
function getDestinationDescription(dest: InferredDestination): string {
  switch (dest) {
    case 'opera_theatre':   return 'opera house or theatre — grand foyer, marble floors, ornate chandeliers, velvet curtains, formal elegance';
    case 'cocktail_gala':   return 'upscale event venue — elegant space, soft golden lighting, formal gathering atmosphere';
    case 'restaurant_dinner': return 'elegant restaurant — warm candlelight, intimate ambiance, beautifully set table, evening atmosphere';
    case 'beach_outdoor':   return 'beach or outdoor setting — natural light, sand or open sky, relaxed and open atmosphere';
    case 'travel_transit':  return 'airport terminal or travel setting — architectural space, natural light, sense of movement and departure';
    case 'generic_outing':  return 'urban evening setting — warm city lights, street or venue exterior, nightlife ambiance';
    default:                return 'lifestyle setting appropriate for the outfit and brief context';
  }
}

// ── Item state plan → bloque de prompt ───────────────────────
// Convierte el plan de estado por pieza en instrucciones para el modelo.
function buildItemStatePlanBlock(plan: OutfitItemPlan[] | undefined, wearState: WearState): string {
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
function buildSceneContinuityBlock(
  fingerprint:     SceneFingerprint,
  shotKey:         string,
  hasUserSceneRef: boolean,
): string {
  // No aplica al destination shot ni a shots sin stage de prep
  const DEST_KEYS = new Set(['OUTFIT_DESTINATION']);
  if (DEST_KEYS.has(shotKey)) return '';

  const strengthText = hasUserSceneRef
    ? 'STRICT CONTINUITY — user provided a real room reference. Replicate it faithfully.'
    : 'VISUAL CONTINUITY — REF0 established this space. Maintain it consistently.';

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `🏠 SCENE CONTINUITY — PREP SPACE LOCK:`,
    strengthText,
    ``,
    `SPACE PROFILE (must match across all prep shots):`,
    `  • Room type: ${fingerprint.roomType.replace('_', ' ')}`,
    `  • Dominant furniture: ${fingerprint.dominantFurniture.replace('_', ' ')}`,
    `  • Lighting: ${fingerprint.lightingFamily.replace(/_/g, ' ')}`,
    `  • Tone / cleanliness: ${fingerprint.cleanliness}`,
    `  • Color palette: ${fingerprint.colorPalette}`,
    fingerprint.hasVisibleMirror ? `  • Mirror: present in space` : '',
    fingerprint.keyProps.length > 0 ? `  • Key identifiers: ${fingerprint.keyProps.join(', ')}` : '',
    ``,
    `RULES:`,
    `  - Do NOT change the wall color or floor material from what REF0 established`,
    `  - Do NOT swap the dominant furniture for a different piece`,
    `  - Do NOT invent a new room style or aesthetic — this is the SAME space between shots`,
    `  - Small differences (angle, position) are acceptable — reinventing the room is NOT`,
    `  - The brief describes the DESTINATION occasion — it does NOT change the prep space`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].filter(Boolean);

  return lines.join('\n');
}

// ── Adaptive Closure Block — reemplaza el bloque de destino rígido ────────────
// Genera instrucciones de pose socialmente creíble para el cierre, sin venue rules.
function buildAdaptiveClosureBlock(
  poseIntent:   PoseIntent,
  affordances:  EnvironmentAffordance[],
  destDesc:     string,
  reason:       string,
): string {
  const poseInstructions: Record<PoseIntent, string> = {
    supported_standing:
      `POSE INTENT — SUPPORTED STANDING:
The person is near a wall, column, doorframe, bar, or architectural element, resting weight against it.
Body is asymmetric — one shoulder or hip leaning slightly. Not rigid. Not centered.
Weight is shifted to one side. The element of support is part of the composition.
FORBIDDEN: standing centered with arms exactly at sides, mannequin-rigid frontality, catalog symmetry.`,

    seated_social:
      `POSE INTENT — SEATED SOCIAL:
The person is seated in a real chair, on steps, at a table edge, or on a low surface.
NOT a formal seated pose — a natural, slightly casual sit. Crossed legs, elbows on knees, or forward lean.
The outfit is still readable. Face confident or looking naturally off-camera.
FORBIDDEN: stiff upright sitting, hands folded symmetrically in lap, catalog model seated look.`,

    leaning_relaxed:
      `POSE INTENT — LEANING RELAXED:
The person leans against a surface (wall, railing, tree, architectural element) with relaxed weight.
One hand may touch the surface. Torso slightly angled. Hip slightly pushed out.
Very natural — like someone pausing between moments, not posing for a photo.
FORBIDDEN: leaning at an exaggerated angle, forced crossed arms, any catalog stance.`,

    half_turn_over_shoulder:
      `POSE INTENT — HALF TURN / OVER SHOULDER:
The person is angled away from camera with their body at 45–90 degrees, face looking back over the shoulder.
This reveals the back or side of the outfit while keeping the face expressive.
FORBIDDEN: full frontal catalog stance, walking blur that obscures the outfit, exaggerated over-rotation.`,

    candid_in_motion:
      `POSE INTENT — CANDID ARRIVAL:
The person is arriving, turning, or in a light movement — captured mid-action.
Not a motion blur — a natural moment frozen. Like: stepping through an entrance, turning to say something, pausing to look at the space.
FORBIDDEN: obvious "walk for camera" catwalking pose, motion blur, full static standing.`,

    mirror_interaction:
      `POSE INTENT — MIRROR INTERACTION AT DESTINATION:
The person is near or in front of a mirror at the venue — adjusting something, checking their look briefly.
A micro-action: fingertips touching hair, glancing at outfit. Candid feel.
FORBIDDEN: full-body mirror selfie pose, phone in hand, catalog stance reflected in mirror.`,

    object_interaction:
      `POSE INTENT — OBJECT INTERACTION:
The person interacts with something in the environment — holding a drink lightly, hand near a table edge, touching a menu or a glass.
This anchors them to the scene naturally. The interaction is subtle — not a product demo.
FORBIDDEN: item held toward camera like an advertisement, forced prop usage, anything that looks promotional.`,

    soft_environmental:
      `POSE INTENT — SOFT ENVIRONMENTAL PORTRAIT:
The person is in the space, but not obviously "posing". They look like they belong there.
Medium or 3/4 shot. Looking slightly off-camera or at something in the scene.
The environment is as important as the person — both are part of the frame.
FORBIDDEN: direct catalog stare into camera, rigid body, centered symmetric composition.`,

    casual_weight_shift:
      `POSE INTENT — CASUAL WEIGHT SHIFT:
The person stands with weight shifted naturally to one side. One hip slightly higher. One knee slightly bent.
Arms hang naturally — one may hold something lightly, one may touch hip or bag.
A real human standing stance, not a pose. Asymmetric, relaxed, not military-straight.
FORBIDDEN: equal weight on both feet, arms rigid at sides, centered perfectly symmetrical stance.`,

    seated_candid:
      `POSE INTENT — SEATED CANDID:
The person is seated in a way that feels caught-in-the-moment — slightly slouched, leaning forward, or turned.
Not a formal seated portrait. The naturalness of the position is the point.
FORBIDDEN: formal upright seated pose, catalog-symmetrical table shot, rigid back.`,

    full_body_confident:
      `POSE INTENT — FULL BODY (justified):
Full body is shown only because the outfit demands complete legibility in this context.
Even so: weight shift, slight hip asymmetry, face at a natural angle — NOT mannequin.
One hand may be in motion or on hip. The person owns the space.
FORBIDDEN: rigid catalog symmetry, centered standing with both feet exactly shoulder-width, arms hanging stiff.`,
  };

  const affordanceContext = affordances.length > 0
    ? `\nENVIRONMENT AFFORDANCES detected: ${affordances.map(a => a.replace('_', ' ')).join(', ')}`
    : '';

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ADAPTIVE CLOSURE — ORGANIC SOCIAL POSE (not catalog):
DESTINATION: ${destDesc}${affordanceContext}
POSE RATIONALE: ${reason}

${poseInstructions[poseIntent]}

ANTI-RIGIDITY RULES (apply regardless of pose intent):
  - NEVER generate: person centered, full frontal, standing symmetrically, arms at sides, expressionless catalog stare
  - ALWAYS prefer: asymmetry, weight shift, slight turn, natural hand position, engaged expression
  - Medium or 3/4 shot is PREFERRED over wide full-body unless the outfit specifically needs full-body legibility
  - If in doubt: choose the most human, organic version of the pose — the one a real person would naturally take
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ── HPI específico para outfit_check — sin bloques crudos ────────────────────
// Genera instrucciones de micro-acción específicas por shot, sin usar buildHpiBlock crudo.
function buildOutfitCompatibleHpiBlock(
  shotKey: string,
  gender: 'female' | 'male' | 'neutral',
  destinationClass: OutfitDestinationClass,
): string {
  const genderNote = gender === 'male' ? 'masculine' : 'feminine';

  switch (shotKey) {
    case 'OUTFIT_ARRIVING':
    case 'OUTFIT_DETAIL':
    case 'OUTFIT_DETAIL_WORN':
    case 'ACCESSORY_CLOSEUP':
      return '';  // HPI completamente OFF — estos shots son de objeto/fragmento

    case 'OUTFIT_MIRROR_CHECK':
      return `🎯 MICRO-ACTION (mirror check — outfit-compatible only):
Choose ONE subtle, realistic action someone does while checking their look in a mirror:
  - hand resting lightly on hip, evaluating fit
  - fingertips adjusting collar, neckline, or strap
  - slight weight shift to one side, natural relaxed posture
  - turning head slowly to check the back or side of the outfit
  - one hand smoothing jacket lapel or skirt hem
  - looking down briefly at shoes or hem, then back up
FORBIDDEN: any athletic pose, floor sitting, gym movement, extreme torso twist, walking-pose, arms-out gesture, full-body performance.
The action must be physically coherent with standing in front of a mirror evaluating an outfit.`;

    case 'OUTFIT_SECOND_ANGLE':
      return `🎯 MICRO-ACTION (second angle — body and posture only, no scene change):
The person is in the same prep room showing the outfit from a different angle.
  - slight weight shift to the other side from the mirror check
  - half-turn showing the back or side of the outfit
  - hand adjusting a detail (cuff, collar, belt)
  - natural relaxed posture — not a new catalog pose
FORBIDDEN: changing the room, adding destination venue elements, athletic pose, floor sitting.
The focus is a different angle of the same look in the same space.`;

    case 'OUTFIT_READY':
      return `🎯 MICRO-ACTION (ready selfie — expression and camera only):
The person is ready and taking a selfie or being photographed.
  - relaxed, composed ${genderNote} expression — natural smile or confident neutral
  - slight chin tilt up or head tilt — real selfie angle
  - one hand near face naturally (adjusting hair, light chin touch)
  - eyes looking directly at camera
FORBIDDEN: athletic stance, full-body performance gesture, seated floor pose, product in hand, objects in scene.
The focus is the FACE and the top of the outfit — this is a mood shot, not a pose.`;

    case 'OUTFIT_DESTINATION':
      // Micro-acción de pose social creíble según destino
      const destActions: Record<string, string> = {
        opera_theatre:       'relaxed elegant posture — hand on hip or arm slightly bent, not rigid, looking slightly off-camera or directly with composed confidence',
        country_club_brunch: 'relaxed social posture — slight weight shift, natural smile or serene expression, hands loosely in front or one on hip',
        office_meeting:      'composed, professional posture — standing naturally, subtle hand gesture or arms loosely at sides, direct camera gaze or slight profile',
        formal_event:        'elegant composed stance — one hand on hip or arms loosely down, slight profile or three-quarter angle, confident',
        restaurant_dinner:   'relaxed social posture — natural smile, seated or standing, hands loosely together or one on table edge',
        beach_day:           'relaxed open posture — natural smile, arms loose, wind in hair acceptable',
        travel_airport:      'confident walking-arriving feel or standing with carry-on nearby',
        urban_social_outing: 'relaxed urban pose — leaning slightly, natural expression, city energy',
        business_event:      'composed professional posture — direct gaze, subtle hand gesture',
        generic_outing:      'natural relaxed posture — confident, not catalog-stiff',
      };
      const action = destActions[destinationClass] || destActions.generic_outing;
      return `🎯 SOCIAL POSE (destination — creíble, no catálogo):
${action}
FORBIDDEN: mannequin-rigid full-frontal catalog stance, extreme walking blur, descending stairs in motion, holding ticket/object as hero, shoes-only floor shot, nightlife tropes unless destination is nightlife.
The pose must look like a real person sharing a social moment at this location.`;

    default:
      return '';
  }
}


// ── Visual Family: hint abstracto para outfit_check ──────────────────────────
// No inyecta el promptBlock literal (que puede meter laptop, mug, terrace, activewear).
// Solo usa señales de composición y mood sin objetos/escenas concretas.
function buildSafeOutfitFamilyStyleHint(
  family: StorySupportFamily,
  shotKey: string,
  cameraMode: CameraMode | undefined,
): string {
  // Solo aplicar en shots de objeto/detalle — y solo aspectos de composición
  const allowedShots = ['OUTFIT_DETAIL', 'OUTFIT_ARRIVING', 'ACCESSORY_CLOSEUP'];
  if (!allowedShots.includes(shotKey)) return '';

  // Verificar compatibilidad de cameraMode con la familia
  const incompatibleModes: CameraMode[] = ['full_body_room', 'selfie_pov', 'destination_social_pose'];
  if (cameraMode && incompatibleModes.includes(cameraMode)) return '';

  const lines: string[] = [
    '─────────────────────────────────────────────────────',
    '🎨 STYLE GUIDANCE (abstract — do NOT copy objects or scenes literally):',
  ];

  if (family.compositionPattern) {
    const c = family.compositionPattern;
    if (c.preferredLighting) lines.push(`  Lighting quality: ${c.preferredLighting} — ${c.lightQuality}`);
    if (c.visualRhythm)      lines.push(`  Visual rhythm: ${c.visualRhythm}`);
  }
  if (family.psychologicalMechanisms.length > 0)
    lines.push(`  Emotional register: ${family.psychologicalMechanisms.slice(0, 2).join(', ')}`);

  lines.push('  NOTE: Apply these qualities to the OUTFIT and CONTEXT of this shot — do NOT import literal objects, props, or scenes from the family reference.');
  lines.push('─────────────────────────────────────────────────────');
  return lines.join('\n');
}

// ── HPI outfit_check filter ───────────────────────────────────
// Lista de frases HPI incompatibles con shots de outfit_check.
// Si cualquiera aparece en el HPI generado para un shot de outfit_check, se descarta.
const OUTFIT_CHECK_HPI_BLOCKLIST = [
  'seated on floor',
  'kneeling squat',
  'lat pulldown',
  'fitness demonstration',
  'gym bench',
  'extreme torso twist',
  'arms extended gripping cable',
  'athletic stance',
  'workout pose',
  'deadlift',
  'squat position',
  'performance architecture',
];

function filterHpiForOutfitCheck(hpiBlock: string, shotKey: string): string {
  if (!hpiBlock) return '';
  const incompatibleKeys = ['OUTFIT_ARRIVING', 'OUTFIT_DETAIL', 'OUTFIT_DETAIL_WORN', 'ACCESSORY_CLOSEUP'];
  if (incompatibleKeys.includes(shotKey)) return '';
  const lower = hpiBlock.toLowerCase();
  if (OUTFIT_CHECK_HPI_BLOCKLIST.some(phrase => lower.includes(phrase))) {
    // Fallback micro-acción segura para outfit_check
    return `🎯 MICRO-ACTION (outfit-compatible only):
Choose ONE subtle, outfit-compatible micro-action:
  - hand resting lightly on hip
  - fingertips touching necklace or collar
  - slight weight shift to one side
  - turning head slowly to look over shoulder
  - adjusting a sleeve or strap subtly
FORBIDDEN: any athletic pose, floor sitting, gym movement, extreme twist, or full-body performance gesture.`;
  }
  return hpiBlock;
}

// ── Detectar contradicciones antes de generar ─────────────────
export function detectContradictions(
  shot:            PhotodumpShotDirective,
  inferredDest:    InferredDestination,
  hasDestPhoto:    boolean,
  timeSignal:      string,
  recipe:          string | undefined,
  allShotKeys:     string[],
  briefCtx?:       OutfitBriefContext,
  outfitComposition?: OutfitComposition,
  hpiSource?:      string,
  familyBlockMode?: string,
): string[] {
  const contradictions: string[] = [];
  const isOutfitCheck = recipe === 'outfit_check';

  if (isOutfitCheck) {
    // Destino claro en brief pero sin OUTFIT_DESTINATION en el plan
    if (briefCtx && briefCtx.destinationClass !== 'none' && briefCtx.destinationClass !== 'generic_outing' &&
        !allShotKeys.includes('OUTFIT_DESTINATION'))
      contradictions.push(`destinationClass=${briefCtx.destinationClass} in brief but no OUTFIT_DESTINATION shot in plan`);

    // generic_outing usado para destino que debería ser específico
    if (briefCtx && briefCtx.destinationClass === 'generic_outing') {
      const lower = (shot as any).__basePrompt?.toLowerCase() ?? '';
      if (lower.includes('oficina') || lower.includes('reunión') || lower.includes('club'))
        contradictions.push('destinationClass=generic_outing but brief clearly implies office_meeting or country_club_brunch');
    }

    // Brief de noche en shot de prep
    if ((timeSignal.includes('NIGHT') || timeSignal === 'night') && shot.key === 'OUTFIT_ARRIVING')
      contradictions.push('brief says NIGHT — prep shots must use warm artificial light, NOT daylight');

    // wearState full outfit pero zapatos no worn
    if ((shot.wearState === 'wearing_full_outfit' || shot.wearState === 'destination_arrived') &&
        shot.itemStatePlan?.some(p => p.item === 'shoes' && p.requiredState !== 'worn' && p.mustBeVisible))
      contradictions.push('wearState=wearing_full_outfit but itemStatePlan has shoes !== worn');

    // itemStatePlan exige dress + top + bottom a la vez
    if (outfitComposition && outfitComposition !== 'unknown' &&
        shot.itemStatePlan?.some(p => p.item === 'dress') &&
        shot.itemStatePlan?.some(p => p.item === 'top') &&
        shot.itemStatePlan?.some(p => p.item === 'bottom'))
      contradictions.push('itemStatePlan requires dress AND top AND bottom simultaneously — composition conflict');

    // Mirror check sin teléfono prohibido
    if ((shot.cameraMode === 'mirror_selfie' || shot.cameraMode === 'mirror_selfie_phone_hidden' ||
         shot.cameraMode === 'mirror_check_no_phone') && shot.phonePolicy !== 'forbidden')
      contradictions.push('mirror cameraMode but phonePolicy is not forbidden');

    // detail_macro con full_body
    if (shot.cameraMode === 'detail_macro' && shot.subjectPresence === 'full_body')
      contradictions.push('cameraMode=detail_macro but subjectPresence=full_body — should be object_detail or hands_only');

    // Shot final sin closing marking
    if (shot.isFinalShot && !shot.isClosingShot)
      contradictions.push('final shot is not marked as closing shot');

    // Closing shot con destino disponible pero sceneLockPolicy no es destination_allowed
    if (shot.isClosingShot && shot.sceneLockPolicy !== 'destination_allowed' &&
        (inferredDest !== 'none' || hasDestPhoto))
      contradictions.push('closing shot not using destination_allowed policy despite available destination');

    // HPI crudo aplicado en outfit_check
    if (hpiSource === 'raw_hpi_not_allowed')
      contradictions.push('raw_hpi_not_allowed should never be hpiSource in outfit_check');

    // familyBlock aplicado en outfit_check (debe estar disabled)
    if (familyBlockMode && familyBlockMode !== 'disabled')
      contradictions.push(`familyBlock mode=${familyBlockMode} in outfit_check — should be disabled for MVP`);

    // OUTFIT_SECOND_ANGLE debe estar en prep space, no en destino
    if (shot.key === 'OUTFIT_SECOND_ANGLE' && shot.narrativeStage === 'destination')
      contradictions.push('OUTFIT_SECOND_ANGLE should have narrativeStage=styled, not destination');

    // Validador de destino en brief pero arco sin OUTFIT_DESTINATION (con destino claro)
    if (briefCtx && briefCtx.destinationClass !== 'none' && briefCtx.destinationClass !== 'generic_outing' &&
        shot.isFinalShot && shot.key !== 'OUTFIT_DESTINATION')
      contradictions.push(`final shot is ${shot.key} but destinationClass=${briefCtx.destinationClass} — may be missing OUTFIT_DESTINATION`);
  }

  return contradictions;
}

// ── Bloque de contexto global del brief — inyectado en REF0 y shots de destino.
// Para shots de preparación (ARRIVING, MIRROR, DETAIL, READY), usar extractShotLocationOverride.
// Para outfit_haul: si wearingContextOnly=true, NO inyectar venueSignal (evita contaminar la locación).
function extractBriefContextBlock(basePrompt: string, recipe?: string): string {
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

// Para shots de PREPARACIÓN en recetas de outfit: ancla la locación del shot
// al espacio de REF0 (nunca al venue del brief).
// La ópera/gala/restaurante es el destino — no donde la persona se prueba el outfit.
const PREP_SHOT_KEYS = new Set(['OUTFIT_ARRIVING', 'OUTFIT_MIRROR_CHECK', 'OUTFIT_DETAIL', 'OUTFIT_DETAIL_WORN', 'OUTFIT_READY', 'OUTFIT_SECOND_ANGLE']);

function extractShotLocationOverride(
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
  refs?:      { avatarRef?: string | null; outfitRefs?: (string | null)[]; accesorioRefs?: (string | null)[]; accesorioCloseup?: boolean[]; sceneDestinoRef?: string | null; scenePruebaRef?: string | null; sceneRef?: string | null },
  presentationStyle?: OutfitPresentationStyle,
  basePrompt?: string,
): PhotodumpShotDirective[] {

  const ar = destino === 'feed' ? '4/5' : '9/16';

  // Receta unboxing: arco lineal fijo con pool dedicado
  if (recipe === 'unboxing') {
    const hasAvatar = !!refs?.avatarRef;
    const pool      = buildUnboxingShotPool(hasAvatar);
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
    const pool           = buildOutfitCheckShotPool(style, inferredDest, hasDestino, briefCtx);
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

function buildUnboxingShotPool(hasAvatar: boolean): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const pool: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] = [
    {
      key:   'UNBOXING_PACKAGING_CLOSED',
      beat:  'context',
      role:  'PACKAGING HERO',
      purpose: 'El empaque cerrado como primer contacto. La promesa antes de la apertura. Mostrar el packaging en su totalidad — forma, color, materiales. Luz que resalte la calidad y el diseño. Sin persona.',
      requiredElements: ['packaging_closed_fully_visible', 'real_surface_not_studio', 'light_shows_volume_and_material', 'product_brand_or_design_legible'],
      forbiddenElements: ['packaging_open', 'product_visible_inside', 'person_visible', 'white_background', 'studio_lighting', 'catalog_composition'],
      variationSpace: [
        'empaque sobre superficie de madera o mármol, luz lateral suave que muestra volumen y textura',
        'overhead del empaque centrado con sombra natural, fondo de superficie texturada',
        'empaque en ángulo de tres cuartos, luz de ventana, fondo desenfocado del ambiente',
        'empaque sostenido desde abajo por manos (sin cara), luz desde arriba, ambiente visible',
      ],
      framing:     'MEDIUM_OR_CLOSE_UP',
      composition: 'PACKAGING_FILLS_70_PERCENT',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHT_OVERHEAD',
    },
    {
      key:   'UNBOXING_OPENING_MOMENT',
      beat:  'action',
      role:  'OPENING MOMENT',
      purpose: 'El momento de apertura — manos interactuando con el empaque. La anticipación en el gesto. Puede ser el avatar o solo manos si no hay avatar. El empaque se abre, el producto asoma.',
      requiredElements: ['hands_opening_or_interacting_with_packaging', 'packaging_partially_open', 'product_beginning_to_emerge', 'real_surface_visible'],
      forbiddenElements: ['packaging_fully_closed', 'product_fully_extracted', 'studio_backdrop', 'catalog_composition', 'forced_demonstration'],
      variationSpace: [
        'manos levantando la tapa o solapa del empaque, producto asomando dentro, luz natural',
        'overhead de manos abriendo la caja, primer vistazo del interior con el producto',
        'close-up de las manos en el momento exacto de la apertura, empaque visible a los costados',
        hasAvatar
          ? 'avatar desde ángulo lateral abriendo el empaque, cara parcialmente visible, expresión de anticipación'
          : 'manos sosteniendo ambos lados del empaque abierto, producto visible, superficie real de fondo',
      ],
      framing:     'MEDIUM_OR_CLOSE_UP',
      composition: 'HANDS_AND_PACKAGING',
      cameraAngle: 'SLIGHT_OVERHEAD_OR_EYE_LEVEL',
    },
    {
      key:   'UNBOXING_PRODUCT_REVEAL',
      beat:  'reveal',
      role:  'PRODUCT REVEAL',
      purpose: 'El producto completamente visible por primera vez — extraído del empaque o dentro de él con claridad total. El reveal que hace que quien mira quiera el producto. Luz perfecta sobre el producto.',
      requiredElements: ['product_fully_visible', 'product_condition_pristine', 'packaging_context_still_present', 'reveal_composition'],
      forbiddenElements: ['product_hidden_or_obscured', 'catalog_white_background', 'studio_lighting', 'forced_symmetry'],
      variationSpace: [
        'producto extraído del empaque, ambos visibles sobre la superficie, luz natural que revela materiales',
        'overhead del empaque abierto con el producto perfectamente visible adentro, momento post-apertura',
        'producto en mano frente al empaque abierto de fondo, luz lateral que resalta forma y acabado',
        hasAvatar
          ? 'avatar sosteniendo el producto recién extraído, expresión genuina de descubrimiento, empaque visible de fondo'
          : 'producto junto al empaque abierto, ambos sobre superficie real, composición orgánica',
      ],
      framing:     'MEDIUM',
      composition: 'PRODUCT_AND_PACKAGING_TOGETHER',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHT_OVERHEAD',
    },
    {
      key:   'UNBOXING_PRODUCT_DETAIL',
      beat:  'detail',
      role:  'PRODUCT DETAIL',
      purpose: 'Un close-up íntimo del producto ya extraído. Textura, acabado, materiales, detalles de diseño. El shot que hace que quien mira quiera tocarlo. Sin empaque necesario.',
      requiredElements: ['product_extreme_close_up', 'texture_or_finish_visible', 'real_light_showing_depth', 'intentional_tight_framing'],
      forbiddenElements: ['packaging_dominant', 'white_background', 'studio_lighting', 'face_dominant', 'full_body'],
      variationSpace: [
        'macro del detalle más distintivo del producto — textura, logo, terminación, material',
        'close-up del producto sobre superficie de contraste, sombra lateral que muestra volumen',
        'producto en ángulo extremo bajo, luz rasante que revela textura y profundidad',
        'detalle del accesorio o componente adicional del producto — cable, estuche, manual',
      ],
      framing:     'CLOSE_UP_OR_EXTREME_CLOSE_UP',
      composition: 'DETAIL_FILL_FRAME',
      cameraAngle: 'MACRO_OR_LOW_ANGLE',
    },
    {
      key:   'UNBOXING_PRODUCT_IN_USE',
      beat:  'action',
      role:  'PRODUCT IN USE',
      purpose: 'El producto siendo usado de forma natural y real. Si hay avatar, es el momento donde el producto pasa de objeto a parte de su vida. Manos activas, uso genuino, contexto real.',
      requiredElements: ['product_being_used_naturally', 'hands_or_person_interacting', 'real_context_of_use', 'authentic_not_staged'],
      forbiddenElements: ['product_static_display', 'forced_demonstration', 'catalog_feel', 'studio_lighting', 'product_floating'],
      variationSpace: [
        hasAvatar
          ? 'avatar usando el producto en su contexto natural — gesto real, no pose para cámara'
          : 'manos usando el producto activamente, gesto natural, contexto visible',
        'close-up de manos interactuando con el producto en uso, detalle del gesto',
        hasAvatar
          ? 'medium shot del avatar con el producto en uso, ambiente real de fondo, mirada no forzada'
          : 'producto en su lugar natural de uso, environment real, sin persona',
        'overhead de manos usando el producto, acción clara, superficie de uso visible',
      ],
      framing:     'MEDIUM_OR_CLOSE_UP',
      composition: 'ACTION_IN_CONTEXT',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHT_OVERHEAD',
    },
    {
      key:   'UNBOXING_ATMOSPHERE',
      beat:  'atmosphere',
      role:  'LIFESTYLE ATMOSPHERE',
      purpose: 'El producto integrado al mundo del usuario — ya no en la caja, sino viviendo. Flat lay orgánico o producto en su lugar natural con el empaque como elemento de contexto. Mood y lifestyle dominan.',
      requiredElements: ['product_in_natural_setting', 'lifestyle_context_visible', 'organic_composition_not_staged', 'mood_through_light_and_surface'],
      forbiddenElements: ['catalog_arrangement', 'forced_symmetry', 'studio_feel', 'product_isolated', 'white_background'],
      variationSpace: [
        'flat lay orgánico del producto con su empaque y objetos del día — café, libro, llaves',
        'producto en su lugar natural de vida — mesa de noche, escritorio, tocador — luz ambiental',
        'overhead del ambiente completo con el producto como elemento, empaque visible a un costado',
        hasAvatar
          ? 'avatar en su ambiente natural con el producto presente pero no forzado, viviendo con él'
          : 'producto con empaque en ambiente real, luz de ventana, composición lived-in',
      ],
      framing:     'WIDE_OR_OVERHEAD',
      composition: 'ORGANIC_LIFESTYLE',
      cameraAngle: 'OVERHEAD_OR_EYE_LEVEL',
    },
  ];
  return pool;
}

// Distribuye los shots de unboxing según el count pedido.
// El arco tiene 6 beats en orden fijo. Si el usuario pide menos, se comprimen
// eliminando los menos críticos (atmosphere primero, luego un action).
function distributeUnboxingShots(count: number, hasAvatar: boolean): string[] {
  // Orden canónico del arco
  const fullArc = [
    'UNBOXING_PACKAGING_CLOSED',
    'UNBOXING_OPENING_MOMENT',
    'UNBOXING_PRODUCT_REVEAL',
    'UNBOXING_PRODUCT_DETAIL',
    'UNBOXING_PRODUCT_IN_USE',
    'UNBOXING_ATMOSPHERE',
  ];
  if (count >= 6) return fullArc;
  if (count === 5) return fullArc.filter(k => k !== 'UNBOXING_ATMOSPHERE');
  if (count === 4) return fullArc.filter(k => !['UNBOXING_ATMOSPHERE', 'UNBOXING_PRODUCT_DETAIL'].includes(k));
  // 3 shots: esencia mínima — empaque, apertura, reveal/uso
  return ['UNBOXING_PACKAGING_CLOSED', 'UNBOXING_OPENING_MOMENT', hasAvatar ? 'UNBOXING_PRODUCT_IN_USE' : 'UNBOXING_PRODUCT_REVEAL'];
}

// ── Estilo de presentación de outfit ─────────────────────────
// La IA elige UNO por sesión. El estilo define cómo se abren los shots de prep
// y cómo evolucionan hacia el mirror check — cada uno tiene su propia lógica narrativa.

function resolveOutfitPresentationStyle(
  basePrompt: string,
  refs?: PhotodumpRefs,
): OutfitPresentationStyle {
  const lower = basePrompt.toLowerCase();

  // Si hay foto de rack/perchero subida como escena → rack_haul es lo más coherente
  // (el usuario ya estableció ese contexto visualmente)
  if (refs?.scenePruebaRef || refs?.sceneRef) {
    // Con escena real no sabemos qué hay en ella — elegir por brief
    // Si el brief sugiere "haul", "llegaron", "compras" → rack o hands
    if (lower.includes('haul') || lower.includes('llegaron') || lower.includes('compras') || lower.includes('unboxing'))
      return 'rack_haul';
  }

  // Señales del brief para cada estilo
  if (lower.includes('haul') || lower.includes('rack') || lower.includes('perchero') || lower.includes('hanger'))
    return 'rack_haul';
  if (lower.includes('flat lay') || lower.includes('flatlay') || lower.includes('extendido') || lower.includes('overhead'))
    return 'flat_lay';
  if (lower.includes('mostrando') || lower.includes('sosteniendo') || lower.includes('presenting'))
    return 'hands_presenter';

  // Sin señales explícitas: rotación aleatoria por sesión — cada generación puede
  // producir un estilo distinto aunque el brief sea idéntico, dando dinamismo.
  const styles: OutfitPresentationStyle[] = ['hands_presenter', 'rack_haul', 'flat_lay', 'person_holding'];
  return styles[Math.floor(Math.random() * styles.length)];
}

// Devuelve el variationSpace y purpose específicos de OUTFIT_ARRIVING para cada estilo.
// Cada estilo también define cómo el shot de DETAIL debe complementar sin contradecir.
function getArrivingVariants(style: OutfitPresentationStyle): {
  purpose: string;
  variationSpace: string[];
  detailPurpose: string;
  detailVariationSpace: string[];
} {
  switch (style) {
    case 'hands_presenter':
      return {
        purpose: 'Manos sosteniendo cada prenda hacia la cámara, una a la vez. Sin persona de cuerpo completo. El gesto de la mano ES el shot — prenda extendida, sostenida, o presentada hacia el lente. El outfit se presenta pieza por pieza con este mismo formato.',
        variationSpace: [
          'mano sosteniendo la prenda principal extendida frente a la cámara — prenda bien legible, ambiente real desenfocado de fondo',
          'dos manos sosteniendo la prenda por los hombros, mostrando el frente completo hacia la cámara — luz natural lateral',
          'mano sosteniendo el accesorio clave (cartera, zapato, joya) hacia el lente — close-up del gesto y el objeto',
          'mano extendiendo la prenda hacia adelante con el brazo casi recto — like "toma, mira esto" — ángulo levemente bajo',
        ],
        detailPurpose: 'Otra mano sosteniendo una pieza del outfit — el accesorio, los zapatos, o una segunda prenda. Mismo formato hands_presenter del set. Sin cara, sin cuerpo completo.',
        detailVariationSpace: [
          'mano sosteniendo los zapatos hacia la cámara — par visible, diseño legible, fondo desenfocado',
          'mano sosteniendo la cartera o accesorio principal — ángulo que muestra material y diseño',
          'dos manos mostrando la prenda secundaria (pantalón, falda, campera) extendida hacia la cámara',
          'mano sosteniendo una joya o accesorio pequeño — close-up íntimo del objeto y el gesto',
        ],
      };

    case 'rack_haul':
      return {
        purpose: 'Las prendas colgadas en rack o perchero real — apertura del set. Manos acomodando, separando o señalando las prendas. El rack es el protagonista visual. Ambiente real visible de fondo.',
        variationSpace: [
          'prendas colgadas en rack, mano separando o señalando la prenda principal — luz natural, ambiente del cuarto visible',
          'medium shot del rack con todas las prendas colgadas, manos parcialmente visibles acomodando — sin cara',
          'close-up de las prendas colgadas desde el costado — hangers visibles, telas con volumen, luz que muestra texturas',
          'persona de pie junto al rack (cara parcialmente visible o de espaldas) revisando las prendas colgadas',
        ],
        detailPurpose: 'Close-up de la textura de una prenda colgada o de un accesorio apoyado cerca del rack. Continuidad visual con el formato rack del set.',
        detailVariationSpace: [
          'close-up de una prenda colgada en el rack — textura de tela, color y terminaciones bajo luz natural',
          'accesorio (zapatos, cartera) apoyado debajo del rack o sobre una silla cercana — close-up del objeto',
          'detalle del hanger y la prenda — el metal del gancho, la caída de la tela, la etiqueta visible',
          'fragmento del rack con dos prendas colgadas juntas — comparación de texturas o colores',
        ],
      };

    case 'flat_lay':
      return {
        purpose: 'UNA foto con el outfit completo extendido sobre la cama, el piso o una silla — esta es la apertura del set, el "esto me voy a poner". Overhead o ángulo bajo. Prendas y accesorios dispuestos de forma orgánica, no perfectamente simétrica.',
        variationSpace: [
          'overhead del outfit completo extendido sobre la cama: prenda superior, inferior, zapatos y cartera — disposición orgánica, no perfecta',
          'flat lay sobre el piso o alfombra — outfit completo visto desde arriba, con sombras naturales de ventana',
          'ángulo bajo desde el borde de la cama — outfit extendido visible con la habitación de fondo',
          'outfit sobre silla o sillón — prendas colocadas naturalmente como si alguien las pusiera ahí antes de vestirse',
        ],
        detailPurpose: 'Close-up de un elemento del flat lay — una prenda, un accesorio, un detalle de textura. El shot se acerca a algo que ya apareció en el flat lay de apertura.',
        detailVariationSpace: [
          'close-up de los zapatos del outfit extendidos — diseño y material claramente visibles, superficie real de fondo',
          'close-up de la prenda principal del flat lay — textura de tela, color, terminaciones bajo luz natural',
          'detalle de la cartera o accesorio del flat lay — material, cierre, forma — ángulo íntimo',
          'fragmento del flat lay: cinturón, joya o accesorio pequeño con la superficie debajo visible',
        ],
      };

    case 'person_holding':
    default:
      return {
        purpose: 'Persona de cuerpo medio mostrando prendas en hangers o sostenidas frente a sí. Cara visible. El gesto es "te muestro lo que elegí". Formato de haul conversacional — la persona es la presentadora.',
        variationSpace: [
          'persona sosteniendo dos hangers con prendas en cada mano, mostrando opciones — medium shot, cara visible, habitación real de fondo',
          'persona sosteniendo la prenda principal frente a su cuerpo — cara visible por encima, actitud de "¿qué te parece?"',
          'persona sentada en el borde de la cama sosteniendo la prenda hacia la cámara — ángulo más íntimo, cara y prenda visibles',
          'persona de pie extendiendo la prenda con el brazo hacia la cámara — gesto de ofrecimiento/presentación, cara visible',
        ],
        detailPurpose: 'Persona sosteniendo un accesorio o prenda secundaria hacia la cámara. Mismo formato person_holding del set.',
        detailVariationSpace: [
          'persona sosteniendo los zapatos del outfit en una mano hacia la cámara — cara parcialmente visible, gesto casual',
          'persona sosteniendo la cartera o accesorio principal hacia el lente — medium shot, actitud espontánea',
          'close-up de manos sosteniendo un accesorio pequeño — cara fuera de frame, fondo del ambiente visible',
          'persona mostrando la prenda secundaria frente a sí — gesto de "y esto también va" — cara visible',
        ],
      };
  }
}

// ── Outfit Check shots ────────────────────────────────────────
// Historia: "Elegí este outfit para X ocasión"
// Arco condicional basado en presentationStyle, wearState y destination inferido.

function buildOutfitCheckShotPool(
  presentationStyle: OutfitPresentationStyle = 'hands_presenter',
  inferredDest?: InferredDestination,
  hasDestinoRef?: boolean,
  briefCtx?: OutfitBriefContext,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const arrivingVariants = getArrivingVariants(presentationStyle);
  const wearArriving     = resolveWearState('OUTFIT_ARRIVING', presentationStyle);
  const wearDetail       = resolveWearState('OUTFIT_DETAIL', presentationStyle);
  const camArriving      = resolveCameraMode('OUTFIT_ARRIVING', presentationStyle);
  const camDetail        = resolveCameraMode('OUTFIT_DETAIL', presentationStyle);

  // Cierre de destino usando briefCtx si está disponible, con fallback a InferredDestination legado
  const hasDestination = hasDestinoRef || (inferredDest && inferredDest !== 'none');
  const destDesc = briefCtx?.destinationLabel ||
    (inferredDest && inferredDest !== 'none'
      ? getDestinationDescription(inferredDest)
      : 'lifestyle setting — street, entrance, or ambient exterior that matches the outfit mood');
  // Variaciones de destino específicas según el brief (si existen)
  const destShotOptions = briefCtx?.destinationShotOptions?.length
    ? briefCtx.destinationShotOptions
    : [
        `full body en ${destDesc} — outfit completo visible, actitud natural, ambiente claramente reconocible`,
        `avatar apoyada en elemento del ambiente destino (columna, barra, entrada), pose con actitud, outfit completo`,
        `medium shot en el destino, ambiente de fondo claramente legible, cara y outfit visibles, expresión segura`,
        `llegando al lugar, outfit completo visible, ambiente destino de fondo orgánico`,
      ];

  return [
    {
      key:              'OUTFIT_ARRIVING',
      beat:             'context',
      role:             'OUTFIT PRESENTATION',
      purpose:          arrivingVariants.purpose,
      requiredElements: ['garments_clearly_visible_and_readable', 'real_context_not_studio', 'visual_gesture_or_interaction_consistent_with_session_style'],
      forbiddenElements: [
        'catalog_mannequin_full_body_walking',
        'studio_white_backdrop',
        'ad_composition',
        'floating_garments_with_no_context',
        'mixing_different_presentation_formats',
        'person_wearing_complete_final_look',    // la prenda es objeto todavía
        'destination_venue_as_background',       // el destino no aparece aquí
      ],
      variationSpace:  arrivingVariants.variationSpace,
      framing:         'MEDIUM_OR_OVERHEAD',
      composition:     'GARMENTS_AS_SUBJECT',
      cameraAngle:     'EYE_LEVEL_OR_OVERHEAD',
      wearState:       wearArriving,
      cameraMode:      camArriving,
      narrativeStage:  'prep',
      hpiAllowed:      false,
      subjectPresence: presentationStyle === 'flat_lay' ? 'objects_only'
                     : presentationStyle === 'hands_presenter' ? 'hands_only'
                     : presentationStyle === 'rack_haul' ? 'objects_with_partial_person'
                     : 'full_body',
      itemStatePlan:   presentationStyle === 'flat_lay'
        ? [
            { item: 'top',    requiredState: 'flat_lay', mustBeVisible: true,  mayBeDuplicated: false },
            { item: 'bottom', requiredState: 'flat_lay', mustBeVisible: true,  mayBeDuplicated: false },
            { item: 'dress',  requiredState: 'flat_lay', mustBeVisible: true,  mayBeDuplicated: false },
            { item: 'shoes',  requiredState: 'flat_lay', mustBeVisible: false, mayBeDuplicated: false },
          ]
        : presentationStyle === 'rack_haul'
          ? [
              { item: 'top',    requiredState: 'hanging',              mustBeVisible: true,  mayBeDuplicated: false },
              { item: 'bottom', requiredState: 'hanging',              mustBeVisible: true,  mayBeDuplicated: false },
              { item: 'shoes',  requiredState: 'on_floor_before_wearing', mustBeVisible: false, mayBeDuplicated: false },
            ]
          : [
              { item: 'top',    requiredState: 'held', mustBeVisible: true,  mayBeDuplicated: false },
              { item: 'shoes',  requiredState: 'held', mustBeVisible: false, mayBeDuplicated: false },
            ],
    },
    {
      key:              'OUTFIT_MIRROR_CHECK',
      beat:             'reveal',
      role:             'MIRROR CHECK',
      purpose: 'Primer momento donde se ve el outfit COMPLETO puesto. Espejo o full body directo. Actitud real, no pose de catálogo. UNA SOLA persona en el frame. IMPORTANTE: si usa espejo, el teléfono NO es visible — el brazo está fuera de frame o no hay teléfono.',
      requiredElements: [
        'full_body_visible_with_complete_outfit',
        'complete_outfit_readable_head_to_toe',
        'shoes_worn_on_feet_not_on_floor',
        'authentic_attitude_not_catalog_stance',
        'single_person_only_in_entire_frame',
      ],
      forbiddenElements: [
        'catalog_symmetrical_pose',
        'studio_lighting',
        'white_background',
        'mannequin_stance',
        'phone_visible_anywhere_in_frame',
        'two_distinct_people_visible',
        'second_person_in_background',
        'garments_as_flat_lay',
        'shoes_on_floor_while_person_is_wearing_outfit',
        'destination_venue_visible',
      ],
      variationSpace: [
        'espejo de cuerpo entero — persona girando levemente el torso para ver la espalda del outfit, mano en la cadera evaluando la caída de la tela, outfit completo visible incluyendo zapatos puestos',
        'full body directo sin espejo — persona parada en el cuarto con el outfit completo puesto, zapatos puestos, postura natural no de desfile, mirando levemente al costado o hacia abajo',
        'espejo de dormitorio — persona ajustando un detalle con una mano (tirante, cinturón, falda) mientras mira su reflejo con concentración, outfit completo visible, NO mostrar teléfono',
        'full body desde un ángulo tres cuartos, persona con el look completo y calzado puesto, actitud evaluativa, cuarto real de fondo',
      ],
      framing:         'WIDE_FULL_BODY',
      composition:     'MIRROR_FRAME_OR_FULL_BODY_NATURAL',
      cameraAngle:     'EYE_LEVEL',
      wearState:       'wearing_full_outfit',
      cameraMode:      'mirror_selfie_phone_hidden',
      narrativeStage:  'styled',
      hpiAllowed:      true,
      hpiScope:        'micro_action_only',
      subjectPresence: 'full_body',
      itemStatePlan:   [
        { item: 'top',       requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'bottom',    requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'dress',     requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'shoes',     requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'bag',       requiredState: 'worn', mustBeVisible: false, mayBeDuplicated: false },
      ],
      phonePolicy:     'forbidden',
    },
    {
      key:              'OUTFIT_DETAIL',
      beat:             'detail',
      role:             'OUTFIT DETAIL',
      purpose:          arrivingVariants.detailPurpose,
      requiredElements: ['garment_or_accessory_fills_frame_or_is_dominant', 'real_light_showing_depth', 'consistent_with_session_presentation_style'],
      forbiddenElements: [
        'full_body_catalog_pose',
        'white_background',
        'studio_lighting',
        'forced_branding',
        'format_that_contradicts_session_style',
        'destination_venue_as_background',
      ],
      variationSpace:  arrivingVariants.detailVariationSpace,
      framing:         'CLOSE_UP_OR_EXTREME_CLOSE_UP',
      composition:     'DETAIL_FILL_FRAME',
      cameraAngle:     'TOP_DOWN_OR_MACRO_ANGLE',
      wearState:       wearDetail,
      cameraMode:      camDetail,
      narrativeStage:  presentationStyle === 'hands_presenter' ? 'prep' : 'transition',
      hpiAllowed:      camDetail === 'detail_macro' ? false : presentationStyle !== 'hands_presenter',
      hpiScope:        'gesture_only',
      subjectPresence: camDetail === 'detail_macro' ? 'object_detail'
                     : camDetail === 'hands_presenter_closeup' ? 'hands_only'
                     : 'full_body',
      detailKind:      'pre_wear',  // este detalle ocurre ANTES del mirror check
    },
    // OUTFIT_DETAIL_WORN: detalle del outfit ya puesto — ocurre DESPUÉS del mirror check
    {
      key:              'OUTFIT_DETAIL_WORN',
      beat:             'texture',
      role:             'WORN DETAIL',
      purpose: 'Close-up íntimo de un elemento del outfit YA PUESTO. La textura de la tela, el detalle de un accesorio integrado al look, los zapatos en el suelo o la silueta del bolso. El outfit está completo — este shot enfoca un fragmento de él.',
      requiredElements: ['garment_or_accessory_detail_worn_on_person', 'real_light_showing_texture', 'intimate_macro_framing'],
      forbiddenElements: [
        'garment_as_object_not_worn',
        'flat_lay',
        'full_body_standing_catalog',
        'white_background',
        'studio_lighting',
        'destination_venue_as_background',
      ],
      variationSpace: [
        'close-up de la textura de la tela del outfit ya vestido — detalle del escote, manga o dobladillo',
        'detalle del accesorio integrado al look — close-up del bolso en mano, la joya en el cuello, la hebilla del cinturón',
        'fragmento del outfit puesto — la silueta desde la cintura hacia abajo con los zapatos puestos, ángulo lateral',
        'macro de un detalle bordado, botón, o terminación de la prenda ya puesta — luz que muestra profundidad',
      ],
      framing:         'CLOSE_UP_OR_EXTREME_CLOSE_UP',
      composition:     'WORN_DETAIL_FILL_FRAME',
      cameraAngle:     'MACRO_OR_LATERAL_CLOSE',
      wearState:       'wearing_full_outfit',
      cameraMode:      'detail_macro',
      narrativeStage:  'styled',
      hpiAllowed:      false,
      subjectPresence: 'object_detail',
      detailKind:      'worn',  // este detalle ocurre DESPUÉS del mirror check
    },
    {
      key:              'OUTFIT_READY',
      beat:             'emotion',
      role:             'READY SELFIE',
      purpose: 'La persona lista con el look completo puesto. Cara dominante, outfit visible parcialmente. Mood "lista para salir" — expresión con actitud, no pose de catálogo. Puede ser selfie, foto de otra persona, o medium shot espontáneo.',
      requiredElements: ['face_dominant_natural', 'outfit_partially_visible_at_least_shoulders_and_neckline', 'authentic_expression_or_mood', 'real_context_visible'],
      forbiddenElements: [
        'catalog_stance',
        'studio_lighting',
        'symmetric_ad_composition',
        'mannequin_expression',
        'phone_visible_in_frame',
        'garments_as_flat_lay_or_on_rack',
      ],
      variationSpace: [
        'selfie POV — brazo extendido hacia la cámara, cara mirando al lente, escote y parte superior del outfit visible, fondo del cuarto o pasillo detrás',
        'foto tomada por otra persona — medium shot de frente, persona con actitud natural "lista para salir", hombros y parte del outfit visibles, ambiente de habitación de fondo',
        'selfie levemente contrapicada — cara mirando al lente con expresión resuelta de "vamos", parte del vestido o escote visible, fondo cálido del ambiente',
        'close-up de cara con el outfit visible en cuello y hombros — expresión espontánea, labios levemente abiertos o sonrisa genuina, ambiente íntimo de pre-salida',
      ],
      framing:         'MEDIUM_OR_SELFIE',
      composition:     'FACE_DOMINANT_OUTFIT_VISIBLE',
      cameraAngle:     'SLIGHT_UPWARD_FROM_HAND_LEVEL',
      wearState:       'ready_to_leave',
      cameraMode:      'selfie_pov',
      narrativeStage:  'styled',
      hpiAllowed:      true,
      hpiScope:        'full',
      subjectPresence: 'face_dominant',
    },
    {
      key:              'OUTFIT_DESTINATION',
      beat:             'atmosphere',
      role:             hasDestination ? 'DESTINATION SHOT' : 'FINAL STYLED MOMENT',
      purpose: hasDestination
        ? `La persona en el destino final con el outfit completo. Ambiente: ${destDesc}. La pose debe ser orgánica y socialmente creíble — NO full-body frontal rígido. El outfit y el entorno juntos cierran la historia de forma humana.`
        : 'Momento final con el look completo: cierre en prep space o exterior de salida. Pose natural — apoyada, medio perfil, selfie — no full-body rígido centrado.',
      requiredElements: hasDestination
        ? ['outfit_complete_and_readable', 'destination_environment_clearly_readable', 'person_belongs_in_space', 'organic_non_catalog_pose']
        : ['outfit_readable_at_least_medium_shot', 'confident_closing_attitude', 'real_environment', 'asymmetric_natural_pose'],
      forbiddenElements: [
        'mannequin_rigid_full_frontal_catalog_stance',
        'person_centered_symmetric_arms_at_sides',
        'studio_backdrop',
        'generic_white_wall',
        'ad_feel',
        'flat_lay_garments',
        'walking_runway_catwalk',
        ...(hasDestination ? ['prep_space_bedroom_or_mirror', 'REF0_room_walls_or_furniture'] : []),
      ],
      // Variaciones que favorecen poses orgánicas, no wide full body centrado
      variationSpace: hasDestination
        ? destShotOptions
        : [
            'persona apoyada en marco de puerta o pared lateral, look completo, actitud de pre-salida — peso en un lado',
            'medium shot de tres cuartos en el mismo cuarto desde otro ángulo, expresión resuelta, asimetría natural',
            'persona sentada en borde de cama o silla, look completo legible, actitud relajada pero confident',
            'selfie de medium shot en pasillo o exterior inmediato, outfit visible desde hombros arriba, mood de cierre',
          ],
      framing:         'MEDIUM_OR_THREE_QUARTERS',   // ya NO WIDE_FULL_BODY como default
      composition:     hasDestination ? 'ORGANIC_SOCIAL_POSE_IN_DESTINATION' : 'NATURAL_CLOSING_ASYMMETRIC',
      cameraAngle:     'EYE_LEVEL_OR_SLIGHTLY_LOW',
      wearState:       'destination_arrived',
      cameraMode:      'destination_social_pose',     // ya NO full_body_room como default
      narrativeStage:  'destination',
      hpiAllowed:      true,
      hpiScope:        'full',
      subjectPresence: 'medium_or_full_body',
      itemStatePlan:   [
        { item: 'top',    requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'bottom', requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'dress',  requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'shoes',  requiredState: 'worn', mustBeVisible: false, mayBeDuplicated: false }, // no forzar full body solo para ver zapatos
        { item: 'bag',    requiredState: 'worn', mustBeVisible: false, mayBeDuplicated: false },
      ],
      phonePolicy:     'not_applicable',
      poseIntent:      'casual_weight_shift',  // se recalcula en buildStoryDirectives
    },
    {
      key:              'OUTFIT_SECOND_ANGLE',
      beat:             'reveal',
      role:             'SECOND ANGLE',
      purpose: 'Ángulo adicional del look completo — distinto al mirror check. Puede ser tres cuartos, espalda, lateral, o un encuadre diferente del mismo espacio de prep. El outfit sigue puesto. No es el destino todavía — sigue siendo el prep space.',
      requiredElements: [
        'outfit_complete_readable',
        'different_framing_from_mirror_check',
        'same_prep_space_as_previous_shots',
        'natural_non_catalog_pose',
      ],
      forbiddenElements: [
        'destination_venue',
        'catalog_mannequin_stance',
        'identical_framing_to_mirror_check',
        'studio_lighting',
        'white_background',
      ],
      variationSpace: [
        'tres cuartos desde la derecha — outfit completo, ángulo de 45° diferente al mirror check, mismo cuarto de fondo',
        'detalle lateral de la silueta completa del look — desde cintura hacia arriba, ángulo diferente al reveal principal',
        'espalda del outfit — muestra el back del look, mismo espacio, actitud natural no de pasarela',
        'medium shot desde ángulo distinto del cuarto — otra esquina, otra perspectiva del mismo espacio prep',
      ],
      framing:         'MEDIUM_OR_THREE_QUARTERS',
      composition:     'DIFFERENT_ANGLE_SAME_SPACE',
      cameraAngle:     'THREE_QUARTERS_OR_LATERAL',
      wearState:       'ready_to_leave',
      cameraMode:      'third_person',
      narrativeStage:  'styled',
      hpiAllowed:      true,
      hpiScope:        'micro_action_only',
      subjectPresence: 'medium_or_full_body',
    },
    {
      key:              'ACCESSORY_CLOSEUP',
      beat:             'texture',
      role:             'ACCESSORY HERO',
      purpose: 'Macro o close-up extremo de un accesorio específico marcado por el usuario. El accesorio llena el frame. Luz que muestra su materialidad, textura y diseño. Sin persona necesaria.',
      requiredElements: ['accessory_fills_frame', 'material_and_texture_clearly_visible', 'real_light_not_studio', 'intentional_macro_framing'],
      forbiddenElements: ['full_body_in_frame', 'catalog_white_background', 'studio_lighting', 'forced_branding', 'multiple_accessories_competing'],
      variationSpace: [
        'macro del accesorio sobre superficie de contraste, sombra lateral que muestra volumen y profundidad',
        'accesorio en mano o siendo sostenido, close-up que muestra diseño y material',
        'accesorio en su lugar de uso natural — puesto, colgando, en el ambiente — close-up',
        'overhead del accesorio sobre tela o superficie orgánica, luz de ventana, ángulo íntimo',
      ],
      framing:         'EXTREME_CLOSE_UP',
      composition:     'ACCESSORY_FILL_FRAME',
      cameraAngle:     'MACRO_OR_LOW_ANGLE',
      wearState:       'not_wearing_final_outfit',
      cameraMode:      'detail_macro',
      narrativeStage:  'prep',
      hpiAllowed:      false,
      subjectPresence: 'objects_only',
    },
  ];
}

// Distribuye los shots de outfit_check según el count pedido.
//
// Arco narrativo correcto con detailKind ordering:
//   ARRIVING (prenda como objeto, pre_wear)
//   → OUTFIT_DETAIL (detalle pre_wear — antes del reveal)
//   → MIRROR_CHECK (reveal: outfit completo)
//   → OUTFIT_DETAIL_WORN (detalle ya puesto — después del reveal)
//   → READY
//   → DESTINATION (cierre)
//
// Si count < arco completo, se eliminan shots en orden de menor valor narrativo:
//   Primero: OUTFIT_DETAIL_WORN, luego READY, luego OUTFIT_DETAIL
//
// hasDestinationClosure: true si hay destino inferido en brief O si el usuario subió sceneDestinoRef.
function distributeOutfitCheckShots(count: number, hasDestinationClosure: boolean): string[] {
  const closingShot = hasDestinationClosure ? 'OUTFIT_DESTINATION' : 'OUTFIT_READY';

  // Arcos por cantidad de story shots (REF0 ya está contado por separado)
  // count = storyShotCount = visibleCount - 1

  // 7 story shots (8 visibles): agrega OUTFIT_SECOND_ANGLE antes del destination
  if (count >= 7) {
    return [
      'OUTFIT_ARRIVING',
      'OUTFIT_DETAIL',
      'OUTFIT_MIRROR_CHECK',
      'OUTFIT_DETAIL_WORN',
      'OUTFIT_READY',
      'OUTFIT_SECOND_ANGLE',
      closingShot,
    ].filter((k, i, arr) => arr.indexOf(k) === i);
  }

  // 6 story shots (7 visibles): arco completo sin second angle
  if (count >= 6) {
    return [
      'OUTFIT_ARRIVING',
      'OUTFIT_DETAIL',
      'OUTFIT_MIRROR_CHECK',
      'OUTFIT_DETAIL_WORN',
      'OUTFIT_READY',
      closingShot,
    ].filter((k, i, arr) => arr.indexOf(k) === i);
  }

  // 5 story shots (6 visibles): sin detail_worn
  if (count === 5) {
    return [
      'OUTFIT_ARRIVING',
      'OUTFIT_DETAIL',
      'OUTFIT_MIRROR_CHECK',
      'OUTFIT_READY',
      closingShot,
    ].filter((k, i, arr) => arr.indexOf(k) === i);
  }

  // 4 story shots (5 visibles): sin detail ni detail_worn
  if (count === 4) {
    return [
      'OUTFIT_ARRIVING',
      'OUTFIT_MIRROR_CHECK',
      'OUTFIT_READY',
      closingShot,
    ].filter((k, i, arr) => arr.indexOf(k) === i);
  }

  // 3 story shots (4 visibles)
  if (count === 3) return ['OUTFIT_ARRIVING', 'OUTFIT_MIRROR_CHECK', closingShot];

  // 2 mínimo (3 visibles)
  return ['OUTFIT_ARRIVING', closingShot];
}

// Outfit Haul — manifest, styling graph, scoring, world map, shot planner y
// shot builders → movidos a ./recipes/outfitHaul.ts (Fase 2).

// ── Global Reference Tag Resolver (patch v4) ─────────────────
// Resuelve tags @outfit1, @outfit2, @accessory1, etc. desde el brief del usuario.
// Usa contexto semántico circundante para extraer mood, destino y pairings explícitos.
// No específico de outfit_week — usable en cualquier receta.

// Map de alias de tag → slotType
const TAG_SLOT_ALIASES: Record<string, import('./types').RefTagSlotType> = {
  outfit: 'outfit', look: 'outfit', looks: 'outfit',
  accessory: 'accessory', accesorio: 'accessory', accesorios: 'accessory',
  aro: 'accessory', aros: 'accessory',
  bag: 'bag', bolso: 'bag',
  shoe: 'shoe', shoes: 'shoe', zapato: 'shoe', zapatos: 'shoe',
  makeup: 'makeup', maquillaje: 'makeup',
  product: 'product', producto: 'product',
  scene: 'scene', escena: 'scene',
  avatar: 'avatar',
  body: 'body',
};

// Palabras descriptoras de mood/rol de outfit extraíbles del contexto
const MOOD_KEYWORDS = [
  'casual', 'arreglado', 'cómodo', 'comodo', 'vibrante', 'elegante', 'formal',
  'informal', 'básico', 'basico', 'lindo', 'chic', 'sport', 'relajado',
  'colorido', 'simple', 'llamativo', 'divertido', 'sobrio', 'trendy',
];

// Palabras de destino extraíbles del contexto
const DESTINATION_KEYWORDS = [
  'cena', 'tarde', 'mañana', 'día', 'dia', 'noche', 'oficina', 'trabajo',
  'playa', 'salir', 'reunión', 'reunion', 'brunch', 'almuerzo', 'evento',
  'escuela', 'universidad', 'gym', 'viaje', 'aeropuerto', 'fiesta',
  'cita', 'shopping', 'mercado', 'café', 'cafe',
];

// Palabras que indican asociación explícita entre ítem y outfit
const PAIRING_VERBS = [
  'usé con', 'use con', 'combina con', 'van con', 'va con', 'queda con',
  'lo usé con', 'los usé con', 'las usé con', 'para el look de', 'con el look',
  'para este look', 'con este look', 'para ese look', 'con ese look',
];

function extractSemanticContext(brief: string, tagStart: number): { role?: string; dest?: string; contextSnippet: string } {
  // Tomar hasta 60 chars antes del tag y 40 después
  const before = brief.slice(Math.max(0, tagStart - 60), tagStart);
  const after  = brief.slice(tagStart, Math.min(brief.length, tagStart + 40));
  const ctx    = (before + after).toLowerCase();

  let role: string | undefined;
  let dest: string | undefined;

  for (const kw of MOOD_KEYWORDS) {
    if (ctx.includes(kw)) { role = kw; break; }
  }
  for (const kw of DESTINATION_KEYWORDS) {
    if (ctx.includes(kw)) { dest = kw; break; }
  }

  return { role, dest, contextSnippet: (before.slice(-40) + after).trim().replace(/\n/g, ' ') };
}

function detectExplicitPairing(
  brief:        string,
  taggedItems:  import('./types').ResolvedReferenceTag[],
  allItems:     import('./types').WeeklyItem[],
): import('./types').ExplicitItemPairing[] {
  const pairings: import('./types').ExplicitItemPairing[] = [];
  const seenPairs = new Set<string>();
  const lowerBrief = brief.toLowerCase();

  // ── Estrategia 1: tags directos en la misma oración ──────────
  // Detecta pairings cuando dos tags distintos (@accesorio1 + @outfit3) aparecen
  // en la misma cláusula (separados por ≤120 chars sin punto ni punto y coma duro).
  const tagPattern = /@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)/gi;
  const allTagMatches: { rawTag: string; pos: number; itemId?: string; type: string }[] = [];

  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(brief)) !== null) {
    const resolved = taggedItems.find(t => t.rawTag.toLowerCase() === m![0].toLowerCase());
    if (!resolved?.resolvedItemId) continue;
    const baseKey = m[1].toLowerCase().replace(/\d+$/, '');
    const tagType = TAG_SLOT_ALIASES[baseKey] ?? 'unknown';
    allTagMatches.push({ rawTag: m[0], pos: m.index, itemId: resolved.resolvedItemId, type: tagType });
  }

  for (let i = 0; i < allTagMatches.length; i++) {
    for (let j = i + 1; j < allTagMatches.length; j++) {
      const a = allTagMatches[i];
      const b = allTagMatches[j];
      if (!a.itemId || !b.itemId || a.itemId === b.itemId) continue;
      if (a.type === b.type) continue;  // mismo tipo → no es un pairing útil

      const gap     = Math.abs(b.pos - a.pos);
      if (gap > 150) continue;  // demasiado separados

      // ¿Hay separador duro entre ellos?
      const between = lowerBrief.slice(Math.min(a.pos, b.pos), Math.max(a.pos, b.pos));
      const hasSeparator = /[.;]\s/.test(between.replace(/@\w+\d*/g, ''));
      if (hasSeparator && gap > 60) continue;

      // ¿Hay conector explícito o están en la misma cláusula?
      const hasConnector = PAIRING_CONNECTORS.some(c => between.includes(c)) ||
                           PAIRING_VERBS.some(v => between.includes(v));
      const sameClause   = !hasSeparator && gap < 100;

      if (!hasConnector && !sameClause) continue;

      // Identificar cuál es accesorio/item y cuál es outfit/destino del pairing
      const isAAccessory = a.type === 'accessory' || a.type === 'bag' || a.type === 'shoe';
      const isBOutfit    = b.type === 'outfit';
      const isAOutfit    = a.type === 'outfit';
      const isBAccessory = b.type === 'accessory' || b.type === 'bag' || b.type === 'shoe';

      let sourceId: string | undefined;
      let targetId: string | undefined;

      if (isAAccessory && isBOutfit) {
        sourceId = a.itemId; targetId = b.itemId;
      } else if (isBAccessory && isAOutfit) {
        sourceId = b.itemId; targetId = a.itemId;
      } else {
        // Pairing no estándar (outfit + producto, etc.) — igualmente útil
        sourceId = a.itemId; targetId = b.itemId;
      }

      const pairKey = [sourceId, targetId].sort().join('::');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const ctxStart = Math.max(0, Math.min(a.pos, b.pos) - 30);
      const ctxEnd   = Math.min(brief.length, Math.max(a.pos, b.pos) + 50);
      const rawText  = brief.slice(ctxStart, ctxEnd).trim();

      pairings.push({
        sourceItemId: sourceId!,
        targetItemId: targetId!,
        reason:       `Direct tag pairing detected: ${a.rawTag} + ${b.rawTag} in same clause`,
        rawText,
      });
    }
  }

  // ── Estrategia 2: verbos de pairing con tags (compatible con legado) ─────────
  for (const verb of PAIRING_VERBS) {
    const verbIdx = lowerBrief.indexOf(verb);
    if (verbIdx === -1) continue;

    // Buscar cualquier tag DESPUÉS del verbo (no solo outfit)
    const afterVerb = brief.slice(verbIdx, verbIdx + 120);
    const targetTagMatch = afterVerb.match(/@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)/i);
    if (!targetTagMatch) continue;

    const targetResolved = taggedItems.find(t =>
      t.rawTag.toLowerCase() === targetTagMatch[0].toLowerCase()
    );
    if (!targetResolved?.resolvedItemId) continue;

    // Buscar cualquier tag ANTES del verbo
    const beforeVerb = brief.slice(Math.max(0, verbIdx - 100), verbIdx);
    const sourceTagMatch = beforeVerb.match(/@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)/i);
    if (!sourceTagMatch) continue;

    const sourceResolved = taggedItems.find(t =>
      t.rawTag.toLowerCase() === sourceTagMatch[0].toLowerCase()
    );
    if (!sourceResolved?.resolvedItemId) continue;
    if (sourceResolved.resolvedItemId === targetResolved.resolvedItemId) continue;

    const pairKey = [sourceResolved.resolvedItemId, targetResolved.resolvedItemId].sort().join('::');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    pairings.push({
      sourceItemId: sourceResolved.resolvedItemId,
      targetItemId: targetResolved.resolvedItemId,
      reason:       `Pairing verb "${verb}" between ${sourceResolved.rawTag} and ${targetResolved.rawTag}`,
      rawText:      brief.slice(Math.max(0, verbIdx - 40), verbIdx + 80).trim(),
    });
  }

  return pairings;
}

export function resolveReferenceTagsFromBrief(
  brief:         string,
  outfitItems:   import('./types').WeeklyItem[],
  accessoryItems: import('./types').WeeklyItem[],
  allItems?:     import('./types').WeeklyItem[],
): import('./types').ReferenceTagResolutionResult {
  const items = allItems ?? [...outfitItems, ...accessoryItems];
  const tags: import('./types').ResolvedReferenceTag[] = [];
  const seenRawTags: Record<string, { count: number; contexts: string[] }> = {};

  // Regex que captura @word seguido de dígito opcional, soporta tildes y puntuación pegada
  const tagPattern = /@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)(?=[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ\d]|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(brief)) !== null) {
    const rawTag    = match[0].replace(/[.,!?;:]$/, '');
    const rawName   = match[1].replace(/[.,!?;:]$/, '');
    const lowerName = rawName.toLowerCase();

    // Resolver slotType
    const baseKey     = lowerName.replace(/\d+$/, '');
    const slotType: import('./types').RefTagSlotType = TAG_SLOT_ALIASES[baseKey] ?? 'unknown';

    // Resolver índice humano (1-based): @outfit → 1, @outfit2 → 2, @outfit3 → 3
    const numStr      = lowerName.match(/\d+$/)?.[0];
    const humanIndex  = numStr ? parseInt(numStr, 10) : 1;
    const slotIndex   = humanIndex - 1;  // 0-based

    // Resolver el WeeklyItem real
    let resolvedItemId: string | undefined;
    let resolvedRefUrl: string | undefined;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let warning: string | undefined;

    if (slotType === 'outfit') {
      const candidate = outfitItems[slotIndex];
      if (candidate) {
        resolvedItemId = candidate.id;
        resolvedRefUrl = candidate.refUrl;
        confidence = 'high';
      } else {
        warning = `Tag @${rawName} refers to outfit slot ${humanIndex}, but only ${outfitItems.length} outfit(s) were uploaded`;
        confidence = 'low';
      }
    } else if (slotType === 'accessory' || slotType === 'bag' || slotType === 'shoe') {
      const candidate = accessoryItems[slotIndex];
      if (candidate) {
        resolvedItemId = candidate.id;
        resolvedRefUrl = candidate.refUrl;
        confidence = 'high';
      } else {
        warning = `Tag @${rawName} refers to accessory slot ${humanIndex}, but only ${accessoryItems.length} accessory/ies were uploaded`;
        confidence = 'low';
      }
    } else if (slotType === 'unknown') {
      warning = `Tag @${rawName} could not be mapped to a known slot type`;
      confidence = 'low';
    }

    // Extraer contexto semántico
    const tagPos = match.index;
    const { role: semanticRole, dest: semanticDest, contextSnippet } = extractSemanticContext(brief, tagPos);

    const resolved: import('./types').ResolvedReferenceTag = {
      rawTag:            rawTag.trim(),
      normalizedTag:     rawName,
      slotType,
      slotIndex,
      humanIndex,
      resolvedItemId,
      resolvedRefUrl,
      confidence,
      usedInTextContext: contextSnippet,
      semanticRole,
      semanticDest,
      warning,
    };

    tags.push(resolved);

    // Tracking de duplicados
    const key = rawTag.trim().toLowerCase();
    if (!seenRawTags[key]) seenRawTags[key] = { count: 0, contexts: [] };
    seenRawTags[key].count++;
    seenRawTags[key].contexts.push(contextSnippet);
  }

  // Construir lista de duplicados
  const duplicateTagUses: import('./types').ReferenceTagDuplicateUse[] = Object.entries(seenRawTags)
    .filter(([, v]) => v.count > 1)
    .map(([k, v]) => ({
      rawTag:   k,
      count:    v.count,
      contexts: v.contexts,
      warning:  `Same tagged item (${k}) assigned to ${v.count} different contexts`,
    }));

  // Ítems sin resolver
  const unresolvedTags = tags.filter(t => !t.resolvedItemId);

  // Asignaciones semánticas por ítem
  const itemSemanticAssignments: import('./types').ItemSemanticAssignment[] = [];
  const assignedItems = new Map<string, import('./types').ItemSemanticAssignment>();

  for (const tag of tags) {
    if (!tag.resolvedItemId) continue;
    const existing = assignedItems.get(tag.resolvedItemId);
    if (!existing) {
      const entry: import('./types').ItemSemanticAssignment = {
        itemId:              tag.resolvedItemId,
        sourceTag:           tag.rawTag,
        roleFromBrief:       tag.semanticRole,
        destinationFromBrief: tag.semanticDest,
      };
      assignedItems.set(tag.resolvedItemId, entry);
      itemSemanticAssignments.push(entry);
    } else {
      // Ítem duplicado — enriquecer si hay más info
      if (!existing.roleFromBrief && tag.semanticRole) existing.roleFromBrief = tag.semanticRole;
      if (!existing.destinationFromBrief && tag.semanticDest) existing.destinationFromBrief = tag.semanticDest;
    }
  }

  // Pairings explícitos (accesorio + outfit)
  const explicitPairings = detectExplicitPairing(brief, tags, items);

  // Brief sin tags (para uso interno)
  const briefWithoutTags = brief.replace(/@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)/gi, '').replace(/\s{2,}/g, ' ').trim();

  // Warnings de cobertura
  const warnings: string[] = [];
  for (const tag of unresolvedTags) {
    if (tag.warning) warnings.push(tag.warning);
  }
  for (const dup of duplicateTagUses) warnings.push(dup.warning);

  // Detectar declaración de count vs tags únicos
  const declaredCountMatch = brief.match(/\b(\d+)\s+(looks?|outfits?)/i);
  const uniqueTaggedOutfitIds = new Set(
    tags.filter(t => t.slotType === 'outfit' && t.resolvedItemId).map(t => t.resolvedItemId)
  );
  const declaredCountDoesNotMatchUniqueTaggedItems = declaredCountMatch
    ? parseInt(declaredCountMatch[1], 10) !== uniqueTaggedOutfitIds.size && uniqueTaggedOutfitIds.size > 0
    : false;

  if (declaredCountDoesNotMatchUniqueTaggedItems) {
    warnings.push(
      `Brief mentions ${declaredCountMatch![1]} looks but only ${uniqueTaggedOutfitIds.size} unique outfit tag(s) were found`
    );
  }

  return {
    tags,
    unresolvedTags,
    duplicateTagUses,
    itemSemanticAssignments,
    explicitPairings,
    briefWithoutTags,
    referenceTaggingUsed: tags.length > 0,
    declaredCountDoesNotMatchUniqueTaggedItems,
    warnings,
  };
}

// ── Avatar Base Clothing Fingerprint — Global (patch v4) ──────
// Genera un fingerprint textual de la ropa del avatar para usarlo como negative constraint.
// Se llama antes de generar prompts en cualquier receta donde avatarRef existe.
// El fingerprint se inyecta en cada story shot como "FORBIDDEN WARDROBE".

export function buildAvatarBaseClothingFingerprint(
  avatarDescription?: string,
): import('./types').AvatarBaseClothingFingerprint {
  // Sin análisis visual — generamos un fingerprint estándar conservador
  // que cubre el caso más común: bodysuit/top negro + jeans + zapatillas.
  // Cuando tengamos análisis visual del avatar, se puede enriquecer aquí.
  const topColor    = 'black';
  const topType     = 'fitted bodysuit, long sleeve top, or base shirt';
  const bottomColor = 'light blue or mid-tone';
  const bottomType  = 'wide leg jeans or casual pants';
  const shoes       = 'white sneakers or generic neutral footwear';

  const summary = [
    `black fitted bodysuit/top`,
    `${bottomColor} ${bottomType}`,
    shoes ? shoes : '',
  ].filter(Boolean).join(' + ');

  return { topColor, topType, bottomColor, bottomType, shoes, summary };
}

// Construye el bloque de texto "FORBIDDEN WARDROBE" para inyectar en prompts de story shots.
export function buildAvatarBaseClothingNegativeBlock(
  fingerprint: import('./types').AvatarBaseClothingFingerprint,
): string {
  return `
⛔ FORBIDDEN WARDROBE — AVATAR BASE CLOTHING MUST NOT APPEAR AS A STORY OUTFIT:
The avatar/body reference photos show the person wearing their own base clothing.
That base clothing is IDENTITY DATA ONLY — it is NOT a content item, NOT a weekly look, NOT a haul piece.

DO NOT dress the avatar in this base clothing as any story outfit:
  • Do NOT use: ${fingerprint.summary}
  • Do NOT carry over the avatar's base top (${fingerprint.topColor} ${fingerprint.topType}) as a story outfit
  • Do NOT carry over the avatar's base bottoms (${fingerprint.bottomColor} ${fingerprint.bottomType}) as a story look
  • If ${fingerprint.shoes} appears as shoes, it is acceptable as neutral footwear ONLY if no footwear item was uploaded

The story outfit MUST come from the uploaded outfit/garment references.
If a shot has an explicit primary outfit item, use THAT item's clothing — not the avatar's base wardrobe.
`.trim();
}

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
): Promise<PhotodumpSessionPlan> {
  initPhotodumpIntelligence();
  const isOutfitRecipe = recipe === 'outfit_check' || recipe === 'outfit_haul' || recipe === 'outfit_week';
  const presentationStyle = isOutfitRecipe
    ? resolveOutfitPresentationStyle(basePrompt, refs)
    : undefined;
  const shots           = buildStoryDirectives(count, protagonist, destino, narrative, recipe, refs, presentationStyle, basePrompt);
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
function getSceneRefForShot(refs: PhotodumpRefs, shotIndex: number, totalShots: number): string | null {
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
): Promise<PhotodumpREF0Result> {

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

  if (isUnboxing) {
    // Unboxing REF0: si hay avatar → ancla con persona sosteniendo/interactuando con el producto.
    // El avatar se pasa x2 (identidad suficiente sin dominar el presupuesto).
    // Si no hay avatar → product hero puro, empaque + producto son protagonistas.
    if (refs.avatarRef) {
      refsToPass.push(refs.avatarRef, refs.avatarRef);
    }
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
    const allOutfitRefs = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
    allOutfitRefs.slice(0, 3).forEach(r => refsToPass.push(r));
    // Escena: outfit_check usa scenePruebaRef primero, las demás usan sceneRef
    const sceneForRef0 = recipe === 'outfit_check'
      ? (refs.scenePruebaRef ?? refs.sceneRef)
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

  const outfitRecipeDesc: Record<string, string> = {
    outfit_check: `SHOT: Full body of the person with the COMPLETE OUTFIT on, in the getting-ready space.
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
    outfit_week: `SHOT: Full body of the person in a natural, real environment — this is the visual anchor for the entire weekly set.
The person wears the FIRST WEEKLY OUTFIT. Full body visible and readable head to toe.
Real environment, authentic light — same room, same light direction, same ambient mood will anchor all subsequent shots.
iPhone photo quality. NOT a catalog. NOT a studio. NOT a white background.

⚠️ AVATAR BASE CLOTHING — HARD RULE:
The clothing visible in the avatar/body reference is ONLY for identity and body proportions.
Do NOT treat avatar base clothing as the first weekly outfit or as any item of the week.
Do NOT carry over avatar reference clothing into this shot as the visible look.
The person must wear the ACTUAL FIRST WEEKLY OUTFIT uploaded by the user — not the avatar's base clothes.
If the first outfit reference is a dress, the person wears the dress. If it is a top + bottom, the person wears those pieces.

⛔ NO EXTERNAL BRANDING:
Do NOT generate bags, boxes, or props with visible brand names.
Do NOT invent Zara, H&M, Shein, Topshop or any retail brand.
If props appear, they must be plain, generic, unbranded.

🛍️ SCENE PROP BUDGET:
Maximum 1–2 neutral props in the scene. No clutter. No boxes or bags unless organic and unbranded.
The space should feel real, tidy, and editorial — not a warehouse or a store.

This REF0 establishes: identity, first weekly look, visual world (light, color, room mood) for the entire weekly set.`,
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
  const outfitRefInstruction = isOutfitRecipe && allOutfitRefs.length > 0
    ? `OUTFIT REFERENCE (${allOutfitRefs.length} garment${allOutfitRefs.length > 1 ? 's' : ''} provided):
- The outfit reference image${allOutfitRefs.length > 1 ? 's show' : ' shows'} the exact garment${allOutfitRefs.length > 1 ? 's' : ''} the person wears in this set.
- Copy the garments EXACTLY: same color, fabric, cut, fit, silhouette, and details.
- SHOE SPECIFICITY LOCK: Reproduce the exact shoe design — same straps, heel, toe, hardware, material.
- These are photos of the garments ALONE — the person is NOT wearing them in the reference images.
- Use these references to understand the garment, then show the person wearing it naturally.
- Do NOT invent fabric continuation beyond what is visible. Do NOT add or remove garments.
${allOutfitRefs.length > 1 ? `- Multiple garments provided — in REF0, the person should wear the COMPLETE look (all or most pieces together).` : ''}`
    : '';

  const identityBlock = isUnboxing
    ? refs.avatarRef
      ? `IDENTITY: Copy the face, hair, skin tone, and physical features EXACTLY from the face reference images.
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
function injectREF0Analysis(ref0Analysis: any, sceneRole?: 'prep' | 'destination' | string): string {
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
function pickFamilyForShot(
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
function buildFamilyInjectBlock(family: StorySupportFamily): string {
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
}

// Lógica de alcance del estilo por shot:
//
// hands_presenter → ARRIVING + DETAIL ambos con formato hands (cada prenda se presenta con manos)
// rack_haul       → solo ARRIVING con rack; a partir del siguiente shot la persona ya aparece vistiéndose
// flat_lay        → solo ARRIVING con flat lay; el resto del set la persona ya está vistiendo/posando
// person_holding  → solo ARRIVING con persona sosteniendo; el resto evoluciona normalmente
//
// El bloque se inyecta solo en los shots donde el estilo sigue siendo relevante.
function buildStyleCoherenceBlock(
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

interface BriefTagRefMap {
  outfit:     string[];         // reordenados según orden de @outfitN en el brief
  accesorio:  string[];         // reordenados según orden de @accesorioN
  producto:   string[];         // reordenados según orden de @productoN
  escena:     string[];         // reordenados según orden de @escenaN
  tagContext: string;           // bloque de texto para el prompt
  pairings:   BriefTagPairing[]; // pares de refs que deben ir juntos en el mismo shot
  sequence:   BriefTagSlotInfo[]; // todos los tags en orden de aparición en el brief
  hasAnyTag:  boolean;
}

// Verbos y conectores que indican pairing entre dos items
const PAIRING_CONNECTORS = [
  'van con', 'va con', 'combina con', 'combino con', 'lo usé con', 'la usé con',
  'los usé con', 'las usé con', 'use con', 'usé con', 'lo uso con', 'la uso con',
  'lo llevé con', 'la llevé con', 'lo puse con', 'la puse con',
  'junto con', 'juntos con', 'acompañé con', 'acompañan', 'acompaña',
  'pair with', 'goes with', 'combined with', 'wore with',
];

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

function buildBriefTagRefMap(brief: string, refs: PhotodumpRefs): BriefTagRefMap {
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

interface VisualRefContractEntry {
  refPosition: number;   // 1-based index en el array de refs
  role:        string;   // 'IDENTITY' | 'BODY' | 'WORLD' | 'OUTFIT_SLOT_N' | 'ACCESSORY_SLOT_N' | etc.
  instruction: string;   // qué debe hacer el modelo con esta imagen
  itemId?:     string;   // ID interno (outfit_2, acc_0)
  isForbiddenSource?: boolean;  // si es true, el modelo no puede tomar ropa de aquí
}

interface VisualReferenceContract {
  entries:            VisualRefContractEntry[];
  primarySlotNames:   string[];   // 'OUTFIT_SLOT_3', 'ACCESSORY_SLOT_1', etc.
  secondarySlotNames: string[];
  forbiddenSlotNames: string[];
  avatarClothingForbidden: boolean;
  ref0ClothingForbidden:   boolean;
  contractBlock:      string;     // bloque de texto listo para insertar en prompt
}

function buildVisualReferenceContract(
  refsToPass:        string[],
  weekPlan:          import('./types').WeeklyShotPlan | undefined,
  allOutfitUrls:     string[],
  allAccUrls:        string[],
  avatarRef?:        string,
  bodyRef?:          string,
  ref0Url?:          string,
  pairingsFromBrief?: { primaryItemId: string; secondaryItemId: string; context?: string }[],
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
      entries.push({
        refPosition: pos,
        role:        'WORLD_ANCHOR',
        instruction: 'Use for room, environment, light quality, and color temperature only. DO NOT use clothing from this image as a wardrobe item.',
        isForbiddenSource: true,
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
          ? `PRIMARY GARMENT: The person in this shot MUST wear exactly the clothing shown in this image. Preserve all colors, cuts, patterns, and visible details. This is the SOLE wardrobe protagonist for this shot.`
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
          ? `PRIMARY ACCESSORY: This exact piece must appear clearly visible in the shot. Preserve its shape, material, color, and details exactly. Do NOT substitute another piece.`
          : isSecondary && pairedOutfitSlotName
          ? `INTEGRATED ACCESSORY (paired with ${pairedOutfitSlotName} per user's brief): This accessory must appear worn TOGETHER with ${pairedOutfitSlotName} in this shot — not as an isolated macro. Show it naturally worn as part of that look.`
          : isSecondary
          ? `INTEGRATED ACCESSORY: This piece appears alongside the primary outfit. Show it naturally worn or held — not as a macro close-up.`
          : `ACCESSORY CONTEXT: Present if space allows.`,
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
    lines.push(`WORLD ANCHOR (image #${worldEntry.refPosition}): Room, environment, light quality, color temperature. Do NOT extract clothing from this image as a wardrobe reference.`);
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

  lines.push('');
  lines.push('⛔ GLOBAL WARDROBE RULES (ALL SHOTS):');
  lines.push('  • NEVER use clothing visible in IDENTITY or BODY references as a weekly outfit or story item.');
  lines.push('  • NEVER use clothing from the WORLD ANCHOR (REF0) as a wardrobe item.');
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
    ref0ClothingForbidden:   true,
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
    // Slots: ref0(1) + avatar x2 si existe(2) + empaque(1-2) + producto(1-2) + escena(1) = máx 9
    refsToPass.push(ref0Url);
    if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef);
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
    if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
    if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
    refsToPass.push(ref0Url);

    const weekPlan: import('./types').WeeklyShotPlan | undefined = shot.weeklyItemPlan;
    const allOutfitUrls  = [refs.outfitRef, ...(refs.outfitRefs  ?? [])].filter(Boolean) as string[];
    const allAccUrls     = (refs.accesorioRefs ?? []).filter(Boolean) as string[];

    if (weekPlan) {
      // Routing explícito desde el plan: primary → urls de outfit/acc
      // Primaries: ítems protagonistas del shot
      for (const itemId of weekPlan.primaryItemIds) {
        if (itemId.startsWith('outfit_')) {
          const idx = parseInt(itemId.replace('outfit_', ''), 10);
          if (allOutfitUrls[idx]) refsToPass.push(allOutfitUrls[idx]);
        } else if (itemId.startsWith('acc_')) {
          const idx = parseInt(itemId.replace('acc_', ''), 10);
          if (allAccUrls[idx]) refsToPass.push(allAccUrls[idx]);
        }
      }
      // Secondaries: ítems de integración (accesorio + outfit compatible)
      for (const itemId of weekPlan.secondaryItemIds) {
        if (itemId.startsWith('outfit_')) {
          const idx = parseInt(itemId.replace('outfit_', ''), 10);
          if (allOutfitUrls[idx]) refsToPass.push(allOutfitUrls[idx]);
        } else if (itemId.startsWith('acc_')) {
          const idx = parseInt(itemId.replace('acc_', ''), 10);
          if (allAccUrls[idx]) refsToPass.push(allAccUrls[idx]);
        }
      }
    } else {
      // Fallback: primer outfit disponible (no debería ocurrir con el nuevo planner)
      if (allOutfitUrls[0]) refsToPass.push(allOutfitUrls[0]);
    }

    // Escena opcional — solo si el usuario la subió
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

    // Escena: outfit_check usa scenePrueba/Destino según el shot
    const isLastShot = shot.key === 'OUTFIT_DESTINATION';
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
    const allOutfitUrls = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
    const allAccUrls    = (refs.accesorioRefs ?? []).filter(Boolean) as string[];

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
  //   outfit_week:  safe hint filtrado
  //   otras:        block completo
  const isOutfitCheckRecipe = recipe === 'outfit_check' || recipe === 'outfit_haul';
  const familyBlock = (recipe === 'outfit_check' || recipe === 'outfit_haul')
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

⛔ AVATAR CLOTHING FORBIDDEN POLICY — HARD RULE — NO EXCEPTIONS:
The avatar/body reference photos exist ONLY to establish face identity and body proportions.
ANY clothing visible on the avatar or body reference is FORBIDDEN as haul wardrobe.
  • The avatar's black catsuit, bodysuit, base shirt, pants, or any default clothing is NOT a haul item.
  • Do NOT use avatar base clothing as a fallback when the garment reference is ambiguous.
  • Do NOT transform, recolor, or restyle avatar base clothing into a haul piece.
  • Do NOT let avatar base clothing appear as the dominant garment in any shot.
Only the GARMENT REFERENCE image provided for THIS SPECIFIC SHOT defines what the person wears.
If the garment reference is insufficient, show the person holding/arranging the item — do NOT fall back to avatar clothing.

⛔ SUPPORT SHOT WEAR POLICY — BINDING:
For non-try-on haul shots (setup, overview, recap, adjusting), the person must be in EXACTLY ONE of:
  A) Wearing one of the already-established haul looks from a previous try-on.
  B) Wearing a neutral non-product base: simple fitted tee/tank + simple jeans/shorts/leggings.
     This neutral base must be INVENTED BY THE SYSTEM — NOT derived from anything visible in the avatar reference.
Never leave the wear state unconstrained. Never fall back to avatar reference clothing.

⛔ DO NOT CLONE REF0:
REF0 is a world anchor — use it for room, light, and environment.
Do NOT recreate the same pose, same camera distance, same crop, or same arrangement as REF0.
This shot MUST have a different action, framing, or focus than REF0.
${shotOutfitInstruction}

🔒 SCENE FINGERPRINT LOCK — HAUL SPACE (HARD LOCK):
REF0 defines the physical world of this haul. Every shot in this set must feel captured in that SAME REAL ROOM.
MANDATORY to preserve across ALL shots:
  • Same bedroom / dressing area — exact same walls, same floor material, same dominant furniture
  • Same bed (size, headboard style, sheets color/pattern) — do NOT replace with different bed
  • Same rack, chair, dresser, or mirror if visible in REF0 — do NOT remove or replace them
  • Same window position and natural light direction — same warm/cool balance, same source angle
  • Same spatial layout — do NOT rearrange furniture between shots
  • Same shopping bags, boxes, and haul clutter family established in REF0

🪞 SCENE PROP ALLOWLIST — STRICT LOCK TO REF0:
Only props CLEARLY VISIBLE in REF0 are allowed. Everything else is FORBIDDEN, even if plausible.

ALWAYS ALLOWED (organic haul clutter that evolves naturally):
  ✓ Shopping bags (opened or closed)
  ✓ Cardboard boxes (opened or closed)
  ✓ Clothing pieces lying on bed, chair, or floor
  ✓ Items from the haul draped or folded in background
  ✓ Any specific furniture already shown in REF0

FORBIDDEN UNLESS EXPLICITLY IN REF0:
  ✗ Clothing rack or garment rack — do NOT add if not in REF0
  ✗ Full-length mirror or wall mirror — do NOT add if not in REF0
  ✗ Desk, writing table, or office-style furniture
  ✗ Office chair or ergonomic chair
  ✗ Lamp, floor lamp, or desk lamp not in REF0
  ✗ Dresser or wardrobe not in REF0
  ✗ New shelving or storage units
  ✗ Extra seating not in REF0
  ✗ Any large decor object not established in REF0
  ✗ Architectural changes (different walls, ceiling, floor material)
Do NOT invent plausible props. If REF0 does not show it, it does not exist in this haul space.

⛔ NO EXTERNAL BRANDING — HARD RULE:
Do NOT generate bags, boxes, or packaging with visible brand names or logos.
Do NOT invent retail store branding: ZARA, H&M, Shein, Zara, Forever21, Topshop, or any other brand name.
Do NOT show price tags, hang tags with external brand logos, or retail chain shopping bags with visible text.
If packaging or shopping bags appear: they must be PLAIN, UNBRANDED, GENERIC (solid color, no logo).
Exception: only if the user explicitly uploaded a branded asset as a reference — reproduce that faithfully.

🛍️ CONTROLLED HAUL CLUTTER — WHAT IS AND IS NOT ALLOWED IN SCENE:
Allowed background elements (organic haul mess from the user's actual items):
  ✓ Clothing pieces that ARE part of the uploaded haul — lying on bed, chair, or floor
  ✓ Plain shopping bags (no logos) or plain cardboard boxes
  ✓ The specific accessories from the haul references (bags, shoes, jewelry)
  ✓ Natural fabric movement, open zippers, hangers from actual haul pieces

Forbidden clutter — DO NOT invent these:
  ✗ Generic clothing not matching any uploaded reference
  ✗ Extra garments on bed/floor that were not uploaded by the user
  ✗ Multiple bags with retail branding
  ✗ Unrelated props, food, drink, phone (unless REF0 established it)
  ✗ Overloaded surfaces with many random items
The scene should feel like a real person's room with THEIR actual haul — not a set with invented props.

📦 CONTROLLED ITEM MOVEMENT — HAUL SESSION ARC:
The haul space evolves naturally as items are tried on — but it stays CONTROLLED at every stage.
Shot ${shot.arcPosition} of ${totalShots}:
${shot.arcPosition <= Math.ceil(totalShots * 0.33)
  ? '  EARLY (controlled_tidy): Space is fresh. 1–2 haul items visible nearby. Maximum 1 plain unbranded bag or closed box. No clothing piles yet.'
  : shot.arcPosition <= Math.ceil(totalShots * 0.66)
  ? '  MIDDLE (lightly_used): 2–4 items from the uploaded haul set aside on bed or chair. Room is naturally used but not chaotic. Maximum 2 plain unbranded packages visible.'
  : '  LATE (organized_haul): Tried haul items draped/folded in background. Room feels actively used. STILL tidy enough to see clearly. Maximum 2 plain unbranded packages. No random clothing piles.'}
ALLOWED: haul clothes from the uploaded set move and shift naturally. Opened boxes. Tried items set aside.
STRICTLY FORBIDDEN — DO NOT GENERATE:
  ✗ Generic clothing piles not matching any uploaded haul reference
  ✗ Branded packaging (ZARA, H&M, Shein, any retail brand)
  ✗ More than 2 bags or boxes visible at once
  ✗ New props, new mirrors, new furniture not in REF0
  ✗ Room redesign between shots — same room, same light direction

⚠️ FOOTWEAR + LEGWEAR ANATOMICAL INTEGRATION (GLOBAL RULE — ALL HAUL SHOTS):
Any time the person's visible look includes BOTH legwear AND footwear, apply this rule:

LEGWEAR includes: pants, jeans, trousers, leggings, skirt, dress hem, tights, hosiery, shorts.
FOOTWEAR includes: boots (any shaft height), sneakers, heels, sandals, loafers, flats, any shoes.

MANDATORY SYMMETRY — both legs/feet must look IDENTICAL in how they integrate:
  — If legwear is tucked into footwear → BOTH legs tucked, same depth
  — If footwear is worn over legwear → BOTH legs show the same drape/overlap
  — If footwear is under legwear hem → BOTH sides show consistent coverage
  — If wearing heels with a skirt → BOTH feet at same angle, same heel height visible consistently
  — If wearing sandals with tights → BOTH feet show the same tights texture at the toe

FORBIDDEN anatomical errors — these are hard generation failures:
  ✗ One leg tucked into boot/shaft, the other leg hanging outside
  ✗ One boot shaft piercing through the pants fabric, the other sitting on top
  ✗ Left foot appears to wear one style of integration, right foot a different one
  ✗ Footwear geometry that is physically impossible (shaft passing through solid fabric)
  ✗ Half-tuck, half-drape — inconsistent on same person in same shot
  ✗ One leg floating or disconnected from the body due to footwear clipping
  ✗ Different apparent heel height between left and right shoe
  ✗ One sandal strap visible, matching strap missing on the other foot

EXCEPTION — intentional asymmetry: only if the reference explicitly shows it (e.g., one boot folded down). Match the reference exactly in that case.

⚠️ SAFE HAUL FALLBACK (only if try-on fails):
If wearing this garment causes a content policy issue, do NOT redesign the garment.
Instead generate: the person holding the item toward the camera, arranging it on the bed, or showing it as a detail close-up.
Preserve the garment's exact shape, color, material, and design. The garment must still be the hero.

⚠️ REFERENCE ROLE — HAUL RULES:
Garment references are photos of the SPECIFIC GARMENT for this shot — not a person wearing it.
Use the reference to understand the piece exactly, then show the person wearing it naturally.
One garment ref = one shot's piece. Do not mix garment refs across shots.
ONE person maximum in any frame. Any background figure is a generation error.
HAUL CONTEXT: ${shot.purpose}

${haulWorldMapBlock}

${haulShotItemPlanBlock}

${haulItemRoleLockBlock}

${haulProgressBlock}

${haulAnatomyBlock}

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
  // GLOBAL_AVATAR_SUPPRESSION: todas las recetas con persona (no faceless)
  // GLOBAL_WARDROBE_PHYSICS: todos los shots con garment — omitir en overview/product-only
  // GLOBAL_ANATOMY_SAFETY: todos los shots con persona
  // GLOBAL_VISUAL_FIDELITY: todos los shots con slot item
  // GLOBAL_NO_BRANDING: todas las recetas sin excepción

  const hasPersonInShot = !isFacelessShot;
  const isOverviewShot  = (shot.key ?? '').includes('OVERVIEW') || (shot.key ?? '').includes('ANCHOR') || (shot.key ?? '').includes('INTRO');
  const hasGarmentSlot  = !isOverviewShot || recipe === 'outfit_haul';  // overview de haul también tiene refs de prendas

  const globalSceneLock        = (recipe !== 'outfit_check') ? GLOBAL_SCENE_LOCK : '';
  const globalAvatarSuppression = hasPersonInShot ? GLOBAL_AVATAR_SUPPRESSION : '';
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

  const preparedRefs = await prepareRefs(refsToPass);
  const imageUrl = await imageApiService.generateImage({
    prompt,
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
    prompt,
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
