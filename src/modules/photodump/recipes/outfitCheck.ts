/**
 * recipes/outfitCheck.ts
 * Receta outfit_check — Fase 4 de la división de photodumpDirectorService.ts.
 *
 * Router semántico de brief (destino, prep environment, mood), directivas de
 * prep space, HPI específico, detección de contradicciones y pool de shots
 * con su distribución por cantidad.
 *
 * Código movido tal cual desde photodumpDirectorService.ts — sin reescribir lógica.
 * La integración dentro de generatePhotodumpShot, generatePhotodumpREF0 y
 * buildPhotodumpSessionPlan (compartidos con outfit_haul y outfit_week)
 * permanece en el archivo principal — se llama a estas funciones desde ahí.
 */
import {
  OutfitBriefContext, OutfitDestinationClass, PrepEnvironmentClass,
  SceneLockPolicy, InferredDestination, OutfitComposition,
  PoseIntent, EnvironmentAffordance, CameraMode,
  PhotodumpRefs,
} from '../types';
import { StorySupportFamily } from '../photodumpIntelligence';
import {
  PhotodumpShotDirective, MomentType, OutfitPresentationStyle, SceneFingerprint,
  resolveWearState, resolveCameraMode,
} from './shared';
import { getDestinationDescription, PREP_SHOT_KEYS } from '../photodumpDirectorService';

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
export function buildREF0HardLockBlock(
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
export function buildSceneContinuityBlock(
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
export function buildAdaptiveClosureBlock(
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
export function buildOutfitCompatibleHpiBlock(
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
export function buildSafeOutfitFamilyStyleHint(
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

export function filterHpiForOutfitCheck(hpiBlock: string, shotKey: string): string {
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
export function resolveOutfitPresentationStyle(
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

export function buildOutfitCheckShotPool(
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
export function distributeOutfitCheckShots(count: number, hasDestinationClosure: boolean): string[] {
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
