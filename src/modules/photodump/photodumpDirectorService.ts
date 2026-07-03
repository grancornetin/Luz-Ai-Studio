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

initHpiService();

// ── Tipos ─────────────────────────────────────────────────────

export type MomentType =
  | 'context'     // ambiente y mundo
  | 'detail'      // fragmento íntimo — textura, objeto
  | 'emotion'     // expresión o reacción genuina
  | 'texture'     // material, superficie, profundidad
  | 'action'      // alguien haciendo algo, en movimiento
  | 'atmosphere'  // mood — luz, espacio, silencio
  | 'reveal'      // ángulo que muestra algo nuevo
  | 'candid';     // captura espontánea sin pose

// Alias para compatibilidad con código existente que use StoryBeat
export type StoryBeat = MomentType;

export interface PhotodumpShotDirective {
  key:              string;          // 'S1' … 'S6'
  beat:             MomentType;
  role:             string;          // tipo de momento en mayúsculas
  purpose:          string;          // descripción para el prompt
  requiredElements: string[];
  forbiddenElements: string[];
  variationSpace:   string[];        // 4 variaciones visuales a elegir
  framing:          string;          // CLOSE_UP | MEDIUM | WIDE | SELFIE
  composition:      string;
  cameraAngle:      string;
  arcPosition:      number;
  aspectRatio:      string;
  // Capas de control estructural
  wearState?:       WearState;
  cameraMode?:      CameraMode;
  narrativeStage?:  'prep' | 'transition' | 'styled' | 'destination';
  hpiAllowed?:      boolean;
  hpiScope?:        'micro_action_only' | 'gesture_only' | 'full';
  subjectPresence?: string;
  // Plan de estado por pieza del outfit
  itemStatePlan?:   OutfitItemPlan[];
  // Metadatos de cierre narrativo
  isFinalShot?:     boolean;
  isClosingShot?:   boolean;
  closingStrategy?: 'destination_inferred' | 'destination_uploaded' | 'pre_exit' | 'none';
  sceneLockPolicy?: SceneLockPolicy;
  phonePolicy?:     'required_visible' | 'allowed_visible' | 'forbidden' | 'not_applicable';
  // Nuevos — pose adaptativa, tipo de detalle, continuidad
  poseIntent?:               PoseIntent;
  detailKind?:               DetailKind;
  continuityMode?:           SceneContinuityMode;
  environmentAffordances?:   EnvironmentAffordance[];
  closureReason?:            string;
  // Haul: plan de ítems por shot — qué aparece, se sostiene, está prohibido
  haulItemPlan?:             HaulShotItemPlan;
  // Weekly edit: plan de rol narrativo + routing de ítems por shot
  weeklyItemPlan?:           import('./types').WeeklyShotPlan;
}

// Estilo visual de presentación para recetas outfit.
// La IA lo elige una vez por sesión — todos los shots de prep lo respetan.
export type OutfitPresentationStyle =
  | 'hands_presenter'   // manos sosteniendo cada prenda hacia la cámara — sin persona de cuerpo
  | 'rack_haul'         // prendas colgadas en rack/perchero como apertura — luego persona interactuando
  | 'flat_lay'          // UNA foto con el outfit extendido — luego la persona ya vistiéndose
  | 'person_holding';   // persona de cuerpo medio mostrando hangers/prendas, cara visible

export interface PhotodumpSessionPlan {
  narrative:            PhotodumpNarrative;
  protagonist:          PhotodumpProtagonist;
  destino:              PhotodumpDestino;
  storyTheme:           string;
  shots:                PhotodumpShotDirective[];
  assignedFamilies:     StorySupportFamily[];   // Lista plana para compatibilidad
  sessionFamilies:      SessionFamilies;        // Separadas por clase para asignación ordenada
  presentationStyle?:   OutfitPresentationStyle; // Solo presente en recetas outfit
}

export interface PhotodumpREF0Result {
  imageUrl:    string;
  ref0Analysis: any;
  prompt:      string;
  refsCount:   number;
}

// ── Sistema de prompts (copiado y adaptado de UGC Studio) ─────

const NEGATIVE_FULL = `
🔴🔴🔴 CRITICAL NEGATIVES — VIOLATION WILL INVALIDATE THE IMAGE 🔴🔴🔴

IDENTITY DRIFT (ABSOLUTELY FORBIDDEN):
different person, different face, different features, different bone structure,
face replacement, identity change, person swap, different ethnicity, different age,
different hair color, different hair texture, straight hair replacing wavy hair,
dark hair replacing blonde hair, blonde hair replacing dark hair,
different eye color, different eye shape, different nose shape,
different jaw shape, different lip shape,
face that does NOT match the face reference EXACTLY,
averaging the face with other references,
using REF0's person instead of the face reference person

BEAUTIFICATION & EDITORIAL (FORBIDDEN):
beautification, skin smoothing, beauty filter, airbrushed, retouched, perfect skin,
editorial softening, high fashion look, luxury redesign, commercial polish,
professional studio lighting, softbox lighting, glamour lighting,
plastic skin, CGI skin, Instagram filter, FaceTune, porcelain skin,
flawless skin, no pores, wax figure look, mannequin skin

OUTFIT INVENTION (FORBIDDEN):
inventing fabric continuation, fake hem, imaginary pants length,
adding fabric where none exists, changing garment structure,
inventing shoes, inventing accessories, changing fabric texture, changing color,
altering garment length, changing silhouette, changing shoe design,
different number of straps, different strap routing, simplified heel

SCENE REDESIGN (FORBIDDEN):
different background, different location, relocated furniture, different walls,
added decor not in reference, prettier version of scene, idealized environment,
CGI background, person floating over the scene, compositing artifacts

AD / BRANDED LOOK (FORBIDDEN):
commercial ad feel, product catalog, studio composed shot, branded look,
advertising composition, posed for camera in an obvious brand way,
overly staged, too perfect, product placement obvious

TECHNICAL ARTIFACTS:
watermark, text overlay, collage, multiple images, grid, side by side,
composite image, face pasted over body, reference image inserted as collage element,
extra limbs, duplicated arms, phantom hands, broken joints,
color drift between shots, different color temperature, filters, stylization,
camera visible in frame (unless the shot explicitly calls for a phone in mirror)

PERSON COUNT:
two distinct people in the same frame (unless the scene explicitly calls for it),
background figures, crowd reflections in mirror, second person appearing in reflection,
duplicated subject, cloned person
`;

const NEGATIVE_SHORT = `
face replacement, identity change, different person, different face,
different hair color, different hair texture, different eye color,
different bone structure, averaging face with other references,
beautification, skin smoothing, editorial look, studio lighting,
luxury redesign, mannequin pose, catalog stance,
outfit invention, fake fabric, extra clothing, changed shoe design,
different background, scene redesign, person floating over background,
ad feel, commercial polish, branded composition, product catalog look,
composite image, face pasted over body, collage artifact,
phone visible in selfie, color temperature drift, filter drift,
two people in frame, second person in background, crowd in mirror reflection,
duplicated subject, extra person appearing, background figures
`;

const LOCK_SYSTEM = `
╔═══════════════════════════════════════════════════════════════════╗
║              LOCK SYSTEM (NON-NEGOTIABLE — NEVER CHANGES)        ║
╚═══════════════════════════════════════════════════════════════════╝

🔒🔒🔒 IDENTITY LOCK (HARD — ABSOLUTE PRIORITY):
- The face reference appears MULTIPLE TIMES in this request. That is intentional.
- This face is the non-negotiable ground truth. Do not average it. Do not override it.
- Same bone structure, same eye shape and color, same nose, same lips, same jaw.
- Same hair: color, length, texture, wave/straight/curly pattern.
- Same skin tone: undertone, warmth, complexion depth.
- The face reference OVERRIDES every other image — including REF0.

⚠️ ANTI-COLLAGE RULE:
- The face reference is a VISUAL GUIDE for identity ONLY — NOT an element to paste.
- DO NOT paste, overlay, composite, or layer the face reference into the image.
- The result must be a SINGLE SEAMLESS PHOTOGRAPH generated from scratch.

🔒🔒 VISUAL CONTINUITY LOCK:
- Same color temperature across all shots — do NOT shift warm/cool.
- Same skin tone rendering — do NOT lighten or darken.
- Same ambient light quality. Same overall contrast range.
- Every shot must look like it was taken in the same session, same day.

🔒 OUTFIT LOCK:
- Same clothing. Same fit. Same fabric. Same color. Same pattern.
- NO invented fabric continuation beyond visible reference.

🔒 PERSON COUNT LOCK:
- There is exactly ONE protagonist person in this story.
- NEVER generate a second person in the background, reflected in a mirror, or implied in the scene.
- A mirror reflection of the protagonist is NOT a second person — it is the same person.
- Any background figure is a hard generation error.

🔒 SCENE LOCK:
- Same environment. Same walls, floor, furniture.
- Person MUST share the scene's lighting — same shadows, same direction.
- NO compositing artifacts — the person belongs in the scene physically.
`;

const PARADIGM_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 PARADIGM (CRITICAL):

You are taking a new iPhone-style photo inside the same existing moment as REF0.
REF0 defines the reality of this session. Every shot is a new angle of that same physical reality.

Do NOT produce a slightly modified version of REF0.
Do NOT add new elements, furniture, lighting, or backgrounds.
Each image must feel like a friend or the person themselves moved to a new position with their phone.

Preserve natural iPhone UGC realism: imperfect, organic, real-life capture.
Avoid studio polish, beauty filter, editorial lighting, over-smooth skin.

THIS IS NOT AN AD. THIS IS NOT A CATALOG SHOT.
This is real social media content — the kind someone posts to tell a story and connect with their audience.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 SINGLE IMAGE RULE (ABSOLUTE):
Generate ONE single realistic photo. No collage. No grid. No reference board.
Do NOT treat the reference images as a layout to copy or paste.
Do NOT insert reference images into the output as layers or collage elements.
Use references ONLY as visual constraints for identity, outfit, and scene.
A grid or collage of multiple images is a HARD FAILURE.
`;

const STORY_MODE_DOMINANCE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 MODE DOMINANCE: PHOTODUMP — ORGANIC VISUAL CONSTELLATION

IDENTITY: This is a real person's Instagram photodump / carousel.
Think "my day", "something I wanted to share", "a moment that happened".
The set is a constellation of visual moments — each image stands on its own
and connects to the others through mood, light, and world, not through narrative sequence.

OUTFIT CHECK EXCEPTION: When this set follows an outfit_check arc, the images DO have a soft
natural sequence — prep → details → full look → ready moment → optional destination closure.
The sequence feels organic and social, NOT cinematic or structured. Each image still stands alone.

CRITICAL RULES:
- NO commercial feel. NO ad composition. NO product placement vibe.
- Every shot must feel CANDID, LIVED-IN, AUTHENTIC.
- The person has a LIFE in these photos — they are not posing FOR a camera,
  they are being captured BY a camera that happens to be nearby.
- VARIETY IS MANDATORY: each shot must have a different framing, angle, and emotional tone.
- The set as a whole shares a coherent visual world — same light, same mood, same person.

ANTI-AD RULES (NON-NEGOTIABLE):
- No product-first compositions (even if a product is present).
- No symmetric centered compositions that feel composed for a brand.
- No studio or controlled lighting feel.
- No text overlays, no logo placement, no brand color dominance.

WHAT MAKES A GREAT PHOTODUMP:
- Each image could stand alone as a real moment — not as "image 1 of 4".
- Together they feel like scrolling through someone's camera roll.
- The emotional impact comes from variety and authenticity, not from sequence.
`;

const STORY_MODE_FACELESS = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 MODE DOMINANCE: FACELESS BTS — ORGANIC BEHIND-THE-SCENES CONTENT

IDENTITY: This is 100% faceless content. No face, no head, no person visible.
Think "behind the scenes", "this is how I pack orders", "the process you never see".
The set shows the world of the brand/product through objects, hands, textures, and spaces.

WHAT IS ALLOWED:
- Hands and arms (without showing face or full body)
- The product at any stage: raw material, in production, packaged, ready to ship
- The workspace, tools, surfaces, materials
- Packaging, labels, boxes, tissue paper, tape — any part of the prep process
- Close-ups of textures, stitching, finishes, materials

WHAT IS FORBIDDEN:
- Any face, head, or recognizable person
- Full-body shots that include the face
- Selfies or portrait framing
- Product catalog look (the BTS feel is mandatory — imperfect, real, honest)
- Studio lighting, white background, commercial composition

WHAT MAKES GREAT FACELESS CONTENT:
- Hands doing something real — not posed, actively working
- The product in a process, not finished and displayed
- Surfaces that feel lived-in: scratched wood, fabric texture, kraft paper
- Light that feels like a window, not a softbox
- The viewer feels like they are looking over the creator's shoulder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

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
  // Aplica solo a office_meeting por ahora — es el caso que más se presta a confusión.
  // "para la oficina / para el trabajo / para trabajar / para ir a la oficina" → ropa de trabajo, haul en casa
  // "en la oficina / en mi oficina / grabado en / fondo de oficina / filmado en" → puede ser locación real
  let wearingContextOnly: boolean | undefined;
  let wearingContextStyleLabel: string | undefined;
  if (destinationClass === 'office_meeting') {
    const hasForUsage =
      /para (la |el |mi |ir a )?ofic/i.test(basePrompt) ||
      /para (el |mi )?trabajo/i.test(basePrompt) ||
      /para trabajar/i.test(basePrompt) ||
      /para (la |una )?reunión/i.test(basePrompt) ||
      /ropa (de|para) (la |el )?ofic/i.test(basePrompt) ||
      /outfits? (de|para) (la |el )?ofic/i.test(basePrompt) ||
      /looks? (de|para) (la |el )?ofic/i.test(basePrompt) ||
      /prendas? (de|para) (la |el )?ofic/i.test(basePrompt);
    const hasAtLocation =
      /en (la |mi |una )?ofic/i.test(basePrompt) ||
      /grabad[ao] en/i.test(basePrompt) ||
      /filmad[ao] en/i.test(basePrompt) ||
      /fondo (de )?ofic/i.test(basePrompt) ||
      /haz.*en (la |mi )?ofic/i.test(basePrompt) ||
      /haul en (la |mi |una )?ofic/i.test(basePrompt);
    // Si hay señal de "para uso" pero NO hay señal de "en locación" → wearingContextOnly
    if (hasForUsage && !hasAtLocation) {
      wearingContextOnly = true;
      wearingContextStyleLabel = 'office / workwear inspired';
    } else if (hasAtLocation) {
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

// ── Outfit composition inference ──────────────────────────────
// Infiere la composición del outfit desde el brief y los refs disponibles.
export function inferOutfitComposition(refs: Partial<PhotodumpRefs>, basePrompt: string): OutfitComposition {
  const lower = basePrompt.toLowerCase();

  // Señales explícitas de vestido
  if (lower.includes('vestido') || lower.includes('dress') || lower.includes('gown') ||
      lower.includes('maxi dress') || lower.includes('midi dress') || lower.includes('mini dress'))
    return 'dress';

  // Señales de traje/suit
  if (lower.includes('traje') || lower.includes('suit') || lower.includes('blazer y') ||
      lower.includes('blazer con'))
    return 'suit';

  // Señales de top + bottom
  const hasTop = lower.includes('camisa') || lower.includes('blusa') || lower.includes('top') ||
                 lower.includes('camiseta') || lower.includes('corset') || lower.includes('bustier') ||
                 lower.includes('body') || lower.includes('remera');
  const hasBottom = lower.includes('pantalón') || lower.includes('jeans') || lower.includes('falda') ||
                    lower.includes('short') || lower.includes('skirt') || lower.includes('pants') ||
                    lower.includes('trousers') || lower.includes('leggins');
  const hasOuterwear = lower.includes('blazer') || lower.includes('saco') || lower.includes('campera') ||
                       lower.includes('chaqueta') || lower.includes('jacket') || lower.includes('coat');

  if (hasOuterwear && (hasTop || hasBottom)) return 'outerwear_top_bottom';
  if (hasTop || hasBottom) return 'top_bottom';

  return 'unknown';
}

// ── Item state plan por composición ──────────────────────────
// Construye el itemStatePlan correcto según el shotKey y la composición inferida.
// Evita exigir simultáneamente dress + top + bottom.
function buildItemStatePlanForShot(
  shotKey: string,
  composition: OutfitComposition,
): OutfitItemPlan[] {
  const isDress     = composition === 'dress';
  const isSuit      = composition === 'suit';
  const isTopBottom = composition === 'top_bottom' || composition === 'outerwear_top_bottom';

  if (shotKey === 'OUTFIT_ARRIVING') {
    // No puesta todavía
    if (isDress) return [
      { item: 'dress',  requiredState: 'held', mustBeVisible: true,  mayBeDuplicated: false },
      { item: 'shoes',  requiredState: 'on_floor_before_wearing', mustBeVisible: false, mayBeDuplicated: false },
    ];
    return [
      { item: 'top',    requiredState: 'held', mustBeVisible: true,  mayBeDuplicated: false },
      { item: 'bottom', requiredState: 'held', mustBeVisible: false, mayBeDuplicated: false },
      { item: 'shoes',  requiredState: 'on_floor_before_wearing', mustBeVisible: false, mayBeDuplicated: false },
    ];
  }

  if (shotKey === 'OUTFIT_MIRROR_CHECK' || shotKey === 'OUTFIT_READY' || shotKey === 'OUTFIT_DESTINATION' || shotKey === 'OUTFIT_DETAIL_WORN') {
    // Outfit puesto completo
    if (isDress) return [
      { item: 'dress',  requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
      { item: 'shoes',  requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
      { item: 'bag',    requiredState: 'worn', mustBeVisible: false, mayBeDuplicated: false },
    ];
    if (isSuit) return [
      { item: 'top',    requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
      { item: 'bottom', requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
      { item: 'shoes',  requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
    ];
    // top_bottom o unknown
    return [
      { item: 'top',    requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
      { item: 'bottom', requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
      { item: 'shoes',  requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
      { item: 'bag',    requiredState: 'worn', mustBeVisible: false, mayBeDuplicated: false },
    ];
  }

  return [];
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

// ── WearState resolver ────────────────────────────────────────
// Calcula el estado del outfit en cada shot de forma condicional — no por índice fijo.
export function resolveWearState(
  shotKey: string,
  style:   OutfitPresentationStyle | undefined,
): WearState {
  switch (shotKey) {
    case 'OUTFIT_ARRIVING':
      // hands_presenter y flat_lay: prenda como objeto — no puesta
      // person_holding: persona mostrando prenda sin llevarla puesta completa
      // rack_haul: prendas en rack, tampoco puestas
      return 'not_wearing_final_outfit';

    case 'OUTFIT_DETAIL':
      // hands_presenter: otra prenda como objeto (manos sosteniendo accesorio)
      // El resto: ya en transición — pero el foco es el objeto, no el look puesto
      if (style === 'hands_presenter') return 'not_wearing_final_outfit';
      return 'partially_styled';

    case 'OUTFIT_DETAIL_WORN':
      // Este detalle ocurre DESPUÉS del mirror check — el outfit está puesto
      return 'wearing_full_outfit';

    case 'OUTFIT_MIRROR_CHECK':
      return 'wearing_full_outfit';

    case 'OUTFIT_READY':
    case 'OUTFIT_SECOND_ANGLE':
      return 'ready_to_leave';

    case 'OUTFIT_DESTINATION':
      return 'destination_arrived';

    case 'ACCESSORY_CLOSEUP':
      return 'not_wearing_final_outfit';

    default:
      return 'wearing_full_outfit';
  }
}

// Bloque de texto inyectado en el prompt basado en wearState.
function injectWearStateBlock(wearState: WearState): string {
  switch (wearState) {
    case 'not_wearing_final_outfit':
      return `⚠️ WEAR STATE — OUTFIT AS OBJECT:
The person is NOT wearing the complete final outfit in this shot.
The garment(s) appear as OBJECTS — held, laid flat, hanging on a rack, or presented by hands.
DO NOT show the person wearing the complete styled look in this shot.
DO NOT generate a catalog full-body pose with the outfit on.`;

    case 'partially_styled':
      return `ℹ️ WEAR STATE — IN TRANSITION:
The person may be in the process of putting on or adjusting the outfit.
They are not yet in the final complete look. Show the transition — dressing, adjusting, exploring.
Partial styling is correct here — do NOT force the full final look yet.`;

    case 'wearing_full_outfit':
      return `✅ WEAR STATE — FULL OUTFIT ON:
The person IS wearing the complete final outfit. Every piece must be visible and readable:
top, bottom or dress, shoes, and key accessories. The look should read as complete and intentional.
This is NOT a getting-ready shot — the person is styled and the outfit is the story.`;

    case 'ready_to_leave':
      return `✅ WEAR STATE — READY TO LEAVE:
The person has the complete look on and is ready. The mood is "about to walk out the door" —
a mix of confidence and anticipation. The outfit is fully styled.
This is a mood shot — expression and attitude matter as much as the outfit legibility.`;

    case 'destination_arrived':
      return `✅ WEAR STATE — AT THE DESTINATION:
The person has arrived at the final location. The outfit is complete and integrated into the scene.
The environment is the DESTINATION (venue, restaurant, street, event) — NOT the prep space.
Person and place together tell the closure of this outfit story.`;
  }
}

// ── CameraMode resolver ───────────────────────────────────────
// Determina la perspectiva correcta según shotKey, presentationStyle y wearState.
export function resolveCameraMode(
  shotKey:    string,
  style?:     OutfitPresentationStyle,
  wearState?: WearState,
): CameraMode {
  // Shots de objeto/accesorio puro
  if (shotKey === 'ACCESSORY_CLOSEUP') return 'detail_macro';

  if (shotKey === 'OUTFIT_ARRIVING') {
    if (style === 'hands_presenter') return 'hands_presenter_closeup';
    if (style === 'flat_lay')        return 'object_flatlay';
    if (style === 'rack_haul')       return 'rack_wide';
    if (style === 'person_holding')  return 'third_person';
    return 'hands_presenter_closeup';
  }

  if (shotKey === 'OUTFIT_DETAIL') {
    if (style === 'hands_presenter') return 'hands_presenter_closeup';
    if (style === 'flat_lay')        return 'detail_macro';
    return 'detail_macro';
  }

  // OUTFIT_DETAIL_WORN: siempre detail_macro — el outfit ya está puesto, solo se muestra un fragmento
  if (shotKey === 'OUTFIT_DETAIL_WORN') return 'detail_macro';

  if (shotKey === 'OUTFIT_MIRROR_CHECK') return 'mirror_selfie_phone_hidden';
  if (shotKey === 'OUTFIT_READY')        return 'selfie_pov';
  // OUTFIT_DESTINATION: destination_social_pose en vez de full_body_room rígido
  if (shotKey === 'OUTFIT_DESTINATION')  return 'destination_social_pose';

  return 'third_person';
}

// Bloque de texto que activa reglas específicas del cameraMode.
function injectCameraModeBlock(mode: CameraMode): string {
  switch (mode) {
    case 'hands_presenter_closeup':
      return `📷 CAMERA MODE — HANDS PRESENTER:
Frame: hands or forearms fill the frame, presenting the garment/accessory toward the lens.
No full body visible. No face required (face may appear at edge if natural, not dominant).
The HAND GESTURE is the shot — not a person posing with clothes.
FORBIDDEN: full-body catalog stance, mirror reflection, overhead flat lay.`;

    case 'object_flatlay':
      return `📷 CAMERA MODE — FLAT LAY / OVERHEAD:
Camera is above the surface looking down, or at a low angle showing garments spread flat.
No standing person in frame. Hands may appear at edges naturally while arranging.
The SURFACE COMPOSITION is the shot — garments, light, texture.
FORBIDDEN: standing or seated person dominating the frame, mirror, selfie angle.`;

    case 'rack_wide':
      return `📷 CAMERA MODE — RACK / PERCHERO:
Camera faces the clothing rack at eye level or slight angle. Garments hang visibly.
Person may appear partially (arm, torso, back) interacting with the rack — not posing for camera.
The RACK is the visual subject of this shot.
FORBIDDEN: garments lying flat, hands-only framing, full-body catalog pose facing camera.`;

    case 'mirror_selfie_phone_visible':
      return `📷 CAMERA MODE — MIRROR SELFIE (PHONE VISIBLE):
The person takes a selfie using the mirror. The phone IS visible in the reflection.
CRITICAL GEOMETRY: The arm holding the phone must point TOWARD the mirror surface.
The phone's camera must face the mirror — not sideways, not toward a third-person camera.
The image captured should look like what the phone would see reflected in the mirror.
Full body visible in reflection. ONE person only — reflection is the same individual.
The posture, arm direction, and gaze must all be coherent with holding a phone toward a mirror.
FORBIDDEN: phone pointing in a direction inconsistent with the mirror, third-person angle that reveals the phone from outside, second distinct person.`;

    case 'mirror_selfie_phone_hidden':
      return `📷 CAMERA MODE — MIRROR SELFIE (PHONE NOT SHOWN):
The person checks their full look in the mirror. Phone is either outside the frame or not used.
This could be captured by a tripod or a third person — the subject is not holding a phone.
Full body visible head to toe. ONE person only — mirror reflection is NOT a second person.
Natural, non-catalog posture: adjusting something, turning to see the back, evaluating fit.
FORBIDDEN: phone visible anywhere in frame, second distinct person, catalog symmetrical stance.`;

    case 'mirror_check_no_phone':
      return `📷 CAMERA MODE — MIRROR CHECK (NO PHONE):
The person is checking their look in a mirror without using a phone.
Captured by a tripod or third person from behind or from the side.
Focus is on the person evaluating their reflection — the mirror frames the full outfit.
Natural, intimate, non-posed. The person is absorbed in the act of looking, not performing for a camera.
FORBIDDEN: any phone in frame, selfie arm angle, catalog stance, second distinct person.`;

    case 'third_person_mirror_capture':
      return `📷 CAMERA MODE — THIRD PERSON MIRROR CAPTURE:
An external camera captures both the person AND their reflection in the mirror.
The person is NOT holding a phone. They are free to pose, move, or look naturally.
The composition shows: person from behind or side + their face/front visible in the mirror reflection.
FORBIDDEN: phone in frame, selfie arm, second distinct person.`;

    case 'mirror_selfie':
      return `📷 CAMERA MODE — MIRROR SELFIE:
The person checks their full look in the mirror. Phone is outside the frame.
Full body visible head to toe. ONE person only — mirror reflection is NOT a second person.
Natural posture: adjusting something, turning to see the back, evaluating fit.
FORBIDDEN: phone visible in mirror, second distinct person, catalog symmetrical stance.`;

    case 'selfie_pov':
      return `📷 CAMERA MODE — SELFIE POV:
The person takes the photo themselves. Camera arm is extended toward lens or implied.
Face is dominant. Outfit partially visible at neck/shoulders/upper body.
The angle is slightly upward (from arm level). Background is ambient and real.
FORBIDDEN: phone visible in frame, third-person photographer angle, studio lighting.`;

    case 'third_person':
      return `📷 CAMERA MODE — THIRD PERSON CAPTURE:
Another person (friend, partner) or a tripod captures this shot.
The protagonist is not holding the camera — they are free to pose, move, or be candid.
Medium to wide shot. Real environment context visible.
FORBIDDEN: selfie arm visible, phone in frame, studio composition.`;

    case 'detail_macro':
      return `📷 CAMERA MODE — DETAIL / MACRO:
Extreme close-up of a specific element: fabric texture, accessory, shoe detail, jewelry.
The DETAIL fills the frame. No full body. No face required.
Real light showing depth and material quality. Background blurred or suggestive.
FORBIDDEN: full-body shot, selfie framing, generic catalog close-up on white background.`;

    case 'full_body_room':
      return `📷 CAMERA MODE — FULL BODY IN SPACE:
Person standing, walking, or posed in the full environment.
Complete outfit visible head to toe. The SETTING is as important as the person.
Camera at eye level or slightly low — the person owns their space.
FORBIDDEN: mirror selfie framing, tight portrait crop, product catalog background.`;

    case 'candid_third':
      return `📷 CAMERA MODE — CANDID THIRD PERSON:
A friend or bystander captures this — the subject may not be fully aware.
Natural, unstaged. The person is doing something, not posing for the shot.
FORBIDDEN: direct to camera pose, studio arrangement, obvious staged composition.`;

    case 'destination_social_pose':
      return `📷 CAMERA MODE — DESTINATION SOCIAL POSE:
This is the closing shot at the destination. The person is in the real social space.
Frame choice: medium, 3/4 body, or environmental portrait — NOT necessarily wide full-body.
The pose is organic and socially plausible: leaning, seated, half-turned, weight-shifted, or in motion.
The environment reads clearly behind and around the person.
FORBIDDEN: mannequin-rigid full-frontal catalog stance, person centered with arms symmetrically at sides,
catwalk walking pose, wide full-body shot with the person isolated in center of space,
studio backdrop feel, any pose that looks like a product catalog or advertisement.
The result must look like a real social photo — the kind someone would post from an actual outing.`;
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

// ── Scene Fingerprint: extrae propiedades estructurales del prep space ────────
// Se construye a partir del REF0 analysis + señales del brief.
// No necesita ser perfecta — solo suficientemente específica para propagar continuidad.
export interface SceneFingerprint {
  roomType:         string;   // 'bedroom' | 'hotel_room' | 'dressing_room' | 'bathroom' | etc.
  dominantFurniture: string;  // mueble más grande o dominante
  lightingFamily:   string;   // 'warm_artificial' | 'cool_daylight' | 'golden_natural' | etc.
  cleanliness:      'tidy' | 'lived_in' | 'cluttered';
  hasVisibleMirror: boolean;
  colorPalette:     string;   // descripción corta del tono dominante
  keyProps:         string[];  // hasta 3 props identificatorias
  continuityMode:   SceneContinuityMode;
}

export function buildSceneFingerprint(
  ref0Analysis:    any,
  hasUserSceneRef: boolean,
  prepMood:        string,  // de OutfitBriefContext.prepMood
): SceneFingerprint {
  // Extraer señales del ref0Analysis (es texto libre generado por Gemini)
  const raw = typeof ref0Analysis === 'string' ? ref0Analysis.toLowerCase()
    : typeof ref0Analysis?.description === 'string' ? ref0Analysis.description.toLowerCase()
    : typeof ref0Analysis?.worldLock === 'string' ? ref0Analysis.worldLock.toLowerCase()
    : '';

  // Room type
  let roomType = 'bedroom';
  if (raw.includes('hotel') || raw.includes('suite'))                    roomType = 'hotel_room';
  else if (raw.includes('dressing room') || raw.includes('vestuario'))   roomType = 'dressing_room';
  else if (raw.includes('bathroom') || raw.includes('baño') || raw.includes('vanity')) roomType = 'bathroom_vanity';
  else if (raw.includes('probador') || raw.includes('fitting'))          roomType = 'fitting_room';
  else if (raw.includes('bedroom') || raw.includes('dormitorio') || raw.includes('cuarto') || raw.includes('habitación')) roomType = 'bedroom';
  // fallback from prepMood
  else if (prepMood.includes('hotel')) roomType = 'hotel_room';
  else if (prepMood.includes('dressing')) roomType = 'dressing_room';

  // Dominant furniture
  let dominantFurniture = 'bed';
  if (raw.includes('vanity') || raw.includes('tocador'))     dominantFurniture = 'vanity_dresser';
  else if (raw.includes('wardrobe') || raw.includes('armario')) dominantFurniture = 'wardrobe';
  else if (raw.includes('rack') || raw.includes('perchero')) dominantFurniture = 'clothing_rack';
  else if (raw.includes('sofa') || raw.includes('sofá') || raw.includes('couch')) dominantFurniture = 'sofa';
  else if (raw.includes('chair') || raw.includes('silla'))   dominantFurniture = 'chair';
  else if (raw.includes('mirror') || raw.includes('espejo')) dominantFurniture = 'floor_mirror';
  else if (raw.includes('bed') || raw.includes('cama'))      dominantFurniture = 'bed';

  // Lighting
  let lightingFamily = 'warm_artificial';
  if (raw.includes('daylight') || raw.includes('natural light') || raw.includes('window'))
    lightingFamily = 'cool_natural_window';
  else if (raw.includes('golden') || raw.includes('dorado') || raw.includes('warm window'))
    lightingFamily = 'golden_natural';
  else if (raw.includes('warm') || raw.includes('cálido') || raw.includes('lamp') || raw.includes('lámpara'))
    lightingFamily = 'warm_artificial';
  else if (raw.includes('cool') || raw.includes('frío') || raw.includes('white light'))
    lightingFamily = 'cool_artificial';
  // fallback de timeSignal / prepMood
  if (prepMood.includes('evening') || prepMood.includes('vanity light')) lightingFamily = 'warm_artificial';
  else if (prepMood.includes('airy daylight') || prepMood.includes('daylight')) lightingFamily = 'cool_natural_window';

  // Cleanliness
  let cleanliness: 'tidy' | 'lived_in' | 'cluttered' = 'lived_in';
  if (raw.includes('clutter') || raw.includes('messy') || raw.includes('desorden'))    cleanliness = 'cluttered';
  else if (raw.includes('tidy') || raw.includes('clean') || raw.includes('organized') || raw.includes('orden')) cleanliness = 'tidy';
  if (prepMood.includes('no clutter') || prepMood.includes('polished'))  cleanliness = 'tidy';

  // Mirror presence
  const hasVisibleMirror = raw.includes('mirror') || raw.includes('espejo') || roomType === 'bathroom_vanity' || roomType === 'dressing_room';

  // Color palette
  let colorPalette = 'neutral warm tones';
  if (raw.includes('white') || raw.includes('blanco'))        colorPalette = 'white and bright neutrals';
  else if (raw.includes('dark') || raw.includes('oscuro'))    colorPalette = 'dark and moody';
  else if (raw.includes('beige') || raw.includes('cream'))    colorPalette = 'warm beige and cream';
  else if (raw.includes('grey') || raw.includes('gray') || raw.includes('gris')) colorPalette = 'cool grey tones';

  // Key props (up to 3 unique identifiers)
  const keyProps: string[] = [];
  if (raw.includes('curtain') || raw.includes('cortina')) keyProps.push('curtains visible');
  if (raw.includes('rug') || raw.includes('alfombra'))    keyProps.push('rug on floor');
  if (raw.includes('plant') || raw.includes('planta'))    keyProps.push('plant in scene');
  if (raw.includes('lamp') || raw.includes('lámpara'))    keyProps.push('ambient lamp');
  if (raw.includes('artwork') || raw.includes('cuadro'))  keyProps.push('wall artwork');
  if (dominantFurniture !== 'bed')                         keyProps.push(`${dominantFurniture.replace('_', ' ')} visible`);

  const continuityMode: SceneContinuityMode = hasUserSceneRef ? 'ref_locked'
    : (raw.length > 20) ? 'fingerprinted'
    : 'soft_match';

  return {
    roomType, dominantFurniture, lightingFamily, cleanliness,
    hasVisibleMirror, colorPalette, keyProps: keyProps.slice(0, 3), continuityMode,
  };
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

// ── Pose Intent: elige la intención de pose adaptativa para el cierre ──────────
// NO usa reglas por venue. Usa señales de affordance del entorno + tono del brief.
export function resolveClosurePoseIntent(
  briefCtx:        OutfitBriefContext,
  outfitComposition: OutfitComposition,
  hasDestinoRef:   boolean,
): { poseIntent: PoseIntent; affordances: EnvironmentAffordance[]; reason: string } {

  const dest = briefCtx.destinationClass;

  // Inferir affordances del espacio del destino desde el brief/destinationMood
  const mood = (briefCtx.destinationMood + ' ' + briefCtx.destinationLabel).toLowerCase();
  const affordances: EnvironmentAffordance[] = [];

  if (mood.includes('restauran') || mood.includes('café') || mood.includes('café') || mood.includes('table') || mood.includes('bar'))
    affordances.push('table_surface', 'seating', 'counter_bar');
  if (mood.includes('hotel') || mood.includes('lobby') || mood.includes('lounge') || mood.includes('corridor') || mood.includes('hall'))
    affordances.push('seating', 'corridor', 'support');
  if (mood.includes('theatre') || mood.includes('opera') || mood.includes('foyer') || mood.includes('marble'))
    affordances.push('support', 'corridor', 'doorway');
  if (mood.includes('office') || mood.includes('meeting') || mood.includes('building'))
    affordances.push('support', 'doorway', 'corridor');
  if (mood.includes('brunch') || mood.includes('club') || mood.includes('garden'))
    affordances.push('seating', 'natural_element', 'table_surface');
  if (mood.includes('beach') || mood.includes('outdoor') || mood.includes('park') || mood.includes('street'))
    affordances.push('natural_element', 'open_space');
  if (mood.includes('airport') || mood.includes('terminal') || mood.includes('transit'))
    affordances.push('corridor', 'open_space', 'support');
  if (mood.includes('urban') || mood.includes('city') || mood.includes('street') || mood.includes('wall'))
    affordances.push('support', 'doorway', 'open_space');

  // Default — toda escena puede tener apoyo o espacio abierto
  if (affordances.length === 0) affordances.push('support', 'open_space');

  // Elegir poseIntent según affordances prioritarias — NO por venue
  let poseIntent: PoseIntent = 'casual_weight_shift'; // fallback universal
  let reason = 'default — casual weight shift preferred over rigid standing';

  if (affordances.includes('seating') && dest !== 'opera_theatre') {
    poseIntent = 'seated_social';
    reason = 'seating affordance detected — seated social preferred over standing';
  } else if (affordances.includes('table_surface')) {
    poseIntent = 'object_interaction';
    reason = 'table surface affordance — hand near surface or cup, natural interaction';
  } else if (affordances.includes('counter_bar')) {
    poseIntent = 'supported_standing';
    reason = 'bar/counter affordance — leaning on bar edge naturally';
  } else if (affordances.includes('support')) {
    // Apoyo: peso en un lado, más natural que de pie centrada
    poseIntent = affordances.includes('corridor') ? 'soft_environmental' : 'supported_standing';
    reason = 'support affordance — leaning or resting against surface, asymmetric weight';
  } else if (affordances.includes('doorway')) {
    poseIntent = 'supported_standing';
    reason = 'doorway affordance — standing in or near frame, natural asymmetry';
  } else if (affordances.includes('corridor')) {
    poseIntent = 'half_turn_over_shoulder';
    reason = 'corridor affordance — three-quarter turn or over-shoulder favored in hallway contexts';
  } else if (affordances.includes('natural_element')) {
    poseIntent = 'leaning_relaxed';
    reason = 'natural element affordance — leaning on wall, tree, or architectural surface';
  } else if (affordances.includes('open_space')) {
    poseIntent = 'casual_weight_shift';
    reason = 'open space — casual weight shift with asymmetry preferred over centered standing';
  }

  // Dress override — con vestido largo, seated_social puede ser complicado
  if (outfitComposition === 'dress' && poseIntent === 'seated_social') {
    poseIntent = 'soft_environmental';
    reason = 'dress composition override — soft environmental preferred over seated to maintain outfit legibility';
  }

  return { poseIntent, affordances, reason };
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

// ── HPI seguro para outfit_haul ────────────────────────────────────────────
// Solo lenguaje corporal y expresión. Sin locaciones, props, objetos ni accesorios.
// NUNCA mete: restaurante, café, deporte, activewear, laptop, taza, lentes, gimnasio.
function buildHaulSafeHpiBlock(
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

// ── Weekly Safe HPI — poses naturales para outfit_week ───────────────────────
// Sin poses de fitness, sin editorial extremo, sin torso twists raros.
// Solo lifestyle natural: de pie, espejo, caminando, ajustando, sosteniendo.
function buildWeeklySafeHpiBlock(shotKey: string, gender: 'female' | 'male' | 'neutral'): string {
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

  // Para haul: detectar si la mención de destino es solo contexto de uso (no locación de captura)
  let effectiveVenueSignal = venueSignal;
  if (recipe === 'outfit_haul' && venueSignal) {
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

function getAspectRatio(destino: PhotodumpDestino): '4:5' | '9:16' {
  return destino === 'feed' ? '4:5' : '9:16';
}

function extractImageData(img: string | null | undefined): { data: string; mimeType: string } | null {
  if (!img) return null;
  const match = img.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  if (/^[A-Za-z0-9+/=]+$/.test(img.trim())) return { mimeType: 'image/jpeg', data: img.trim() };
  return null;
}

// Cap máximo de referencias por llamada al modelo — evita error 413
// Con compresión activa (768px / quality 0.72) cada imagen ~60-120KB base64.
// 10 imágenes ≈ 600KB-1.2MB, bien dentro del límite de 4.5MB de Vercel.
const MAX_REFS = 10;
// Parámetros de compresión agresivos para payload mínimo
const REF_MAX_WIDTH = 768;
const REF_QUALITY   = 0.72;

async function prepareRefs(refs: (string | null | undefined)[]): Promise<Array<{ data: string; mimeType: string }>> {
  const valid = refs.filter(Boolean) as string[];
  const capped = valid.slice(0, MAX_REFS);
  const results: Array<{ data: string; mimeType: string }> = [];
  for (const r of capped) {
    try {
      const compressed = await compressImageForUpload(r, REF_MAX_WIDTH, REF_QUALITY);
      const extracted  = extractImageData(compressed);
      if (extracted) results.push(extracted);
    } catch {
      const extracted = extractImageData(r);
      if (extracted) results.push(extracted);
    }
  }
  return results;
}

function getAspectInstruction(destino: PhotodumpDestino): string {
  if (destino === 'feed')    return 'Compose for 4:5 portrait (Instagram feed). Subject fills 70-80% of frame.';
  if (destino === 'stories') return 'Compose for 9:16 full vertical (Stories/TikTok). Centered with breathing room top/bottom.';
  return 'Compose for 9:16 full vertical (TikTok). Bold framing, strong visual impact.';
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
    const weekManifest = buildWeeklyManifest((refs ?? {}) as PhotodumpRefs, count);
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

// ── Outfit Haul — Manifest builder ──────────────────────────
// Construye la lista canónica de ítems del haul desde los refs del usuario.
// outfitRefs = prendas/outfits (slot outfit del wizard)
// accesorioRefs + accesorioCloseup = accesorios

// Mapea HaulRefKind (valor de UI) → HaulItemKind (interno del planner).
// El valor de UI tiene más granularidad, lo colapsamos para el planner.
// Normaliza HaulRefKind → HaulResolvedKind (más específico que HaulItemKind)
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
    case 'joyeria':        return 'jewelry';
    case 'accesorio':      return 'accessory';
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
function buildHaulShotItemPlanBlock(plan: HaulShotItemPlan, manifest: HaulManifest): string {
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
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
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
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
    const forbiddenLines = forbiddenInventions.map(f => `  ✗ ${f}`).join('\n');
    const surfaceLines = `Haul items may be placed on: ${allowedSurfaces.join(', ')}.`;
    const packageLine  = packageMaxVisible > 0
      ? `Max ${packageMaxVisible} unbranded plain bag(s)/box(es) visible — NO logos, NO retail brand names.`
      : `NO shopping bags or cardboard boxes — they were NOT in REF0. Do NOT invent packaging.`;

    const worldLockSummary = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 ROOM WORLD LOCK — REF0 PHYSICAL MAP (strict — do NOT redesign this space):
${allowedLines}
${surfaceLines}
PACKAGING: ${packageLine}
FORBIDDEN — do NOT invent or add any of these:
${forbiddenLines}
  ✗ clothing or garments NOT uploaded by the user
  ✗ external brand logos (ZARA, H&M, Shein, Bershka, Pull&Bear, etc.)
  ✗ new architectural elements (new walls, windows, doorways not in REF0)
Lighting: ${lightSource === 'natural_window' ? 'natural window light — preserve direction and warmth' : lightSource}.
RULE: Do NOT add, redesign, rearrange, or invent any element of this physical space between shots. What REF0 shows is the maximum — not the minimum.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

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
function buildHaulItemRoleLockBlock(item: HaulItem): string {
  const rk = item.resolvedKind;
  const isManual = item.manualKind !== 'auto';
  const tag = isManual ? `MANUAL TAG: ${item.manualKind.toUpperCase()}` : `AUTO-DETECTED: ${rk.toUpperCase()}`;

  const rules: Record<HaulResolvedKind, string> = {
    full_outfit: `ITEM ROLE LOCK — FULL LOOK:
${tag}
This reference IS a complete coordinated look. Show it exactly as designed — all pieces together.
✓ ALLOWED: worn as a complete outfit (all visible pieces on body simultaneously)
✓ ALLOWED: held up or displayed showing the complete composition
✗ FORBIDDEN: breaking it apart into individual pieces and wearing only one
✗ FORBIDDEN: adding unrelated garments to "complete" the look
✗ FORBIDDEN: transforming it into a different garment type (e.g., treating a look as just a top)`,

    mixed_set: `ITEM ROLE LOCK — MULTI-ITEM SET:
${tag}
This reference shows multiple products together. They may or may not form a single outfit.
✓ ALLOWED: showing the person interacting with one or more pieces naturally
✓ ALLOWED: displaying them as a group on a surface
✗ FORBIDDEN: assuming all pieces must be worn simultaneously if they don't form a cohesive look
✗ FORBIDDEN: inventing new pieces to "complete" any sub-look`,

    top: `ITEM ROLE LOCK — INDIVIDUAL TOP:
${tag}
This is a SINGLE TOP PIECE (blouse, shirt, t-shirt, corset, camisole).
✓ ALLOWED: worn as the featured top with a neutral bottom for context
✓ ALLOWED: held up toward camera, laid flat, or shown as a detail
✗ FORBIDDEN: transforming this top into a dress or full outfit
✗ FORBIDDEN: wearing it as a skirt, bottom, or outer layer unless the reference explicitly shows it
✗ FORBIDDEN: treating it as a complete coordinated look`,

    bottom: `ITEM ROLE LOCK — INDIVIDUAL BOTTOM:
${tag}
This is a SINGLE BOTTOM PIECE (pants, skirt, shorts, jeans, trousers).
✓ ALLOWED: worn as the featured bottom with a simple neutral top for context
✓ ALLOWED: held, laid flat, or shown as detail
✗ FORBIDDEN: transforming this bottom into a dress or top
✗ FORBIDDEN: treating it as a complete outfit
✗ FORBIDDEN: letting the neutral context top become the visual hero`,

    dress: `ITEM ROLE LOCK — DRESS:
${tag}
This is a DRESS — a single main garment from shoulder (or neckline) to hem.
✓ ALLOWED: worn as the complete garment — full silhouette visible
✓ ALLOWED: held up or shown full length
✗ FORBIDDEN: treating this dress as a top or combining it with another skirt/bottom
✗ FORBIDDEN: transforming it into a different dress design
✗ FORBIDDEN: losing the hem or skirt portion — full silhouette required`,

    onepiece: `ITEM ROLE LOCK — ONE-PIECE / JUMPSUIT:
${tag}
This is a JUMPSUIT, BODYSUIT, or ONE-PIECE GARMENT — covers body as a single continuous piece.
✓ ALLOWED: worn as the complete piece — top-to-bottom silhouette visible
✓ ALLOWED: shown being put on or adjusted
✗ FORBIDDEN: splitting it visually into top + bottom
✗ FORBIDDEN: treating the body/torso portion as a standalone top`,

    outerwear: `ITEM ROLE LOCK — OUTERWEAR / JACKET / BLAZER:
${tag}
This is OUTERWEAR — a jacket, blazer, coat, or cardigan worn as an outer layer.
✓ ALLOWED: worn open over a simple neutral base
✓ ALLOWED: worn closed, being put on, or held up
✗ FORBIDDEN: treating this outerwear as the bottom or dress
✗ FORBIDDEN: inventing specific garments underneath — any simple neutral base is fine
✗ FORBIDDEN: losing the outer layer nature of this piece`,

    footwear: `ITEM ROLE LOCK — STANDALONE FOOTWEAR:
${tag}
This is a SHOE, BOOT, SANDAL, or SNEAKER — a standalone footwear item.
✓ ALLOWED: shown at foot level being tried on, placed on surface, held by hands, or as a close-up detail
✗ FORBIDDEN: building a complete outfit from this shoe reference alone
✗ FORBIDDEN: this footwear reference being treated as clothing
✗ FORBIDDEN: inventing pants, dresses, or any garment from this shoe image`,

    hosiery: `ITEM ROLE LOCK — HOSIERY / PANTYHOSE / STYLING LAYER:
${tag}
This is a HOSIERY or LAYERING PIECE (tights, pantyhose, leggings as underlay, stockings).
✓ ALLOWED: shown as a styling layer on legs, visible under or with another garment
✓ ALLOWED: shown being pulled up or adjusted at leg level
✗ FORBIDDEN: treating hosiery as thick pants or standalone bottom
✗ FORBIDDEN: making hosiery the dominant garment — it is a layering piece
✗ FORBIDDEN: losing the transparent or semi-transparent leg quality if the reference shows it`,

    bag: `ITEM ROLE LOCK — STANDALONE BAG / PURSE:
${tag}
This is a BAG — handbag, tote, clutch, crossbody, or shoulder bag.
✓ ALLOWED: held in hand, worn on shoulder/arm, resting on surface, or shown as hardware detail
✗ FORBIDDEN: building a full outfit around this bag reference
✗ FORBIDDEN: treating the bag as a clothing item
✗ FORBIDDEN: inventing garments from the bag image`,

    jewelry: `ITEM ROLE LOCK — JEWELRY PIECE:
${tag}
This is a JEWELRY PIECE (earrings, necklace, bracelet, ring, anklet).
✓ ALLOWED: worn on body (ear, neck, wrist, finger), held between fingers, or resting on fabric
✓ ALLOWED: macro or semi-macro framing that makes the jewelry clearly readable
✗ FORBIDDEN: generating a full outfit context for this shot
✗ FORBIDDEN: replacing this jewelry with generic/invented jewelry
✗ FORBIDDEN: the jewelry disappearing into the background
SIZE AND SCALE: Reproduce the EXACT size, proportion, and scale shown in the reference. Do NOT upsize or downsize.`,

    accessory: `ITEM ROLE LOCK — GENERIC ACCESSORY:
${tag}
This is a GENERIC ACCESSORY (belt, hat, glasses, scarf, cap, or similar).
✓ ALLOWED: worn as an accessory in its natural position, or shown as a detail
✓ ALLOWED: displayed/held clearly so it is the visual focus
✗ FORBIDDEN: treating this accessory as a main garment
✗ FORBIDDEN: losing the accessory behind other elements`,

    unknown_visual_item: `ITEM ROLE LOCK — VISUAL ITEM (AUTO-DETECTED):
${tag}
The exact type was auto-detected. Inspect the reference carefully before generating.
✓ Show it in a way consistent with what it actually IS in the reference.
✗ FORBIDDEN: assuming it is clothing if it appears to be an accessory or product.`,
  };

  return rules[rk] ?? `ITEM ROLE LOCK: Show this item faithfully as the type indicated — do not transform it into a different category of object.`;
}

// ── Haul Anatomy Block — reglas globales de anatomía ─────────────────────────
// Se inyecta en TODOS los story shots del haul. Previene errores de manos, pies, dedos.
function buildHaulAnatomyBlock(): string {
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🫀 ANATOMY INTEGRITY — GLOBAL HARD RULES (apply to every haul shot):

ONE PERSON ONLY. Do not generate background figures.
HANDS:   Exactly 2 hands. 5 fingers per hand. No extra hand. No fused fingers. No floating hand.
ARMS:    Exactly 2 arms. No third arm. No extra limb.
LEGS:    Exactly 2 legs. Both must be grounded and connected to the body.
FEET:    Exactly 2 feet. No floating shoe. Both feet must show the same footwear type and integration.

FINGER RULE: All 5 fingers must be individually distinguishable. No blob hands. No extra fingers. No missing finger.
FOOT/BOOT RULE: If legwear meets footwear, BOTH legs must show identical integration — no half-tuck, no shaft-through-fabric.
EARRING RULE: If earrings appear, both ears must show the SAME earring design. No mismatched earrings. No deformed ear.
BODY PROPORTIONS: Do not elongate, compress, or distort any body part. Maintain natural human proportions.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ── Haul Progress State — estado lógico de los ítems en este shot ────────────
// Genera el bloque de texto que le dice al modelo qué ítems ya fueron mostrados,
// cuál es el protagonista actual, y cuáles aún están pendientes.
// Evita que una prenda aparezca "puesta y a la vez intacta sobre la cama" en el mismo shot.
function buildHaulProgressBlock(
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
function buildHaulItemTypeBlock(item: HaulItem): string {
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
    case 'joyeria':        return 'jewelry';
    case 'accesorio':      return 'accessory';
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
    const promptKindLabel = resolvedKindToPromptLabel(resolvedKind);

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
      if (manualKind === 'joyeria') return 'jewelry';
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
    const promptKindLabel = resolvedKindToPromptLabel(resolvedKind);
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
  const lowerBrief = brief.toLowerCase();

  for (const verb of PAIRING_VERBS) {
    const verbIdx = lowerBrief.indexOf(verb);
    if (verbIdx === -1) continue;

    // Buscar el tag de outfit más cercano después del verbo
    const afterVerb = brief.slice(verbIdx);
    const outfitTagMatch = afterVerb.match(/@(outfit\d*|look\d*)\b/i);
    if (!outfitTagMatch) continue;

    const targetTag = taggedItems.find(t =>
      t.rawTag.toLowerCase() === outfitTagMatch[0].toLowerCase()
    );
    if (!targetTag?.resolvedItemId) continue;

    // Buscar el accesorio mencionado antes del verbo
    const beforeVerb = brief.slice(Math.max(0, verbIdx - 80), verbIdx).toLowerCase();
    const accCandidates = allItems.filter(it => it.accessoryEligible || it.kind === 'jewelry' || it.kind === 'bag');
    const sourceItem = accCandidates.find(acc => {
      const lbl = acc.label.toLowerCase();
      return beforeVerb.includes(lbl) || (acc.kind === 'jewelry' && beforeVerb.includes('aros')) || (acc.kind === 'jewelry' && beforeVerb.includes('aritos'));
    });

    if (sourceItem) {
      pairings.push({
        sourceItemId: sourceItem.id,
        targetItemId: targetTag.resolvedItemId,
        reason:       `User said "${sourceItem.label}" was used with ${targetTag.rawTag}`,
        rawText:      brief.slice(Math.max(0, verbIdx - 40), verbIdx + 40).trim(),
      });
    }
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

// ── Outfit Week — Weekly Edit / Weekly Favorites ─────────────
// Historia: "mis favoritos de la semana / outfits de la semana / accesorios de la semana"
// Planificación basada en roles narrativos + manifest de ítems con cobertura REAL garantizada.

// Clasifica un ítem por su posición en el array (outfit slots vs accesorio slots)
function classifyWeeklyItem(
  refUrl: string,
  sourceIndex: number,
  isOutfitSlot: boolean,
  slotIndex: number,
): import('./types').WeeklyItem {
  const kind: import('./types').WeeklyItemKind = isOutfitSlot ? 'outfit_set' : 'accessory';
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
  outfitItems: import('./types').WeeklyItem[],
  accItems: import('./types').WeeklyItem[],
): import('./types').WeeklySetDominantType {
  const total = outfitItems.length + accItems.length;
  if (total === 0) return 'mixed';
  if (outfitItems.length === 0 && accItems.length > 0) return 'accessories';
  if (outfitItems.length >= accItems.length * 2) return 'outfits';
  if (accItems.length > outfitItems.length) return 'accessories';
  return 'mixed';
}

// Compatibilidad accesorio ↔ outfit — 0–100
// Sin análisis visual: usa el tipo de ítem para determinar modo de integración.
// El prompt builder refina con instrucciones de compatibilidad de estilo/color.
function scoreWeeklyCompatibility(
  acc: import('./types').WeeklyItem,
  outfit: import('./types').WeeklyItem,
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
  dominant: import('./types').WeeklySetDominantType,
  outfitCount: number,
  accCount: number,
  count: number,
): import('./types').WeeklyShotRole[] {
  if (dominant === 'outfits' || (dominant === 'mixed' && outfitCount >= accCount)) {
    // Template A: outfits de la semana
    // Estructura: OVERVIEW → N look heroes → ACC_INTEGRATED × acc → CLOSER
    const roles: import('./types').WeeklyShotRole[] = ['WEEK_OVERVIEW'];
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
    ].slice(0, count) as import('./types').WeeklyShotRole[];
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
    ].slice(0, count) as import('./types').WeeklyShotRole[];
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
    ].slice(0, count) as import('./types').WeeklyShotRole[];
  }

  // mixed — balance
  const roles: import('./types').WeeklyShotRole[] = ['WEEK_OVERVIEW'];
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
  accessoryItems:    import('./types').WeeklyItem[],
  outfitItems:       import('./types').WeeklyItem[],
  compatPairs:       import('./types').WeeklyCompatibilityPair[],
  accCloseup:        boolean[],
  explicitPairings?: Record<string, string>,  // accId → outfitId — del brief (@accessory2 con @outfit3)
): import('./types').WeeklyAccessoryIntegrationEntry[] {
  const plan: import('./types').WeeklyAccessoryIntegrationEntry[] = [];
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
  dominant: import('./types').WeeklySetDominantType,
  existingRoles: import('./types').WeeklyShotRole[],
): { role: import('./types').WeeklyShotRole; reason: string } {
  if (dominant === 'outfits') {
    const candidates: Array<{ role: import('./types').WeeklyShotRole; avoid: import('./types').WeeklyShotRole[] }> = [
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
  outfitItems:      import('./types').WeeklyItem[],
  accessoryItems:   import('./types').WeeklyItem[],
  compatPairs:      import('./types').WeeklyCompatibilityPair[],
  accIntPlan:       import('./types').WeeklyAccessoryIntegrationEntry[],
  accCloseup:       boolean[],
  count:            number,
  dominant:         import('./types').WeeklySetDominantType,
  taggedOutfitOrder?: string[],  // IDs en orden del brief (patch v4)
): {
  shotPlan:        import('./types').WeeklyShotPlan[];
  redundancyDebug: import('./types').WeeklyRedundancyDebugEntry[];
  compositionMap:  import('./types').WeeklyCompositionVarietyMap;
} {
  const plan: import('./types').WeeklyShotPlan[] = [];
  const redundancyDebug: import('./types').WeeklyRedundancyDebugEntry[] = [];

  // Obtener template de roles para este dominantType
  const roleTemplate = getWeeklyRoleTemplate(dominant, outfitItems.length, accessoryItems.length, count);

  // Si hay orden explícito del brief, reordenar outfitItems para los hero slots
  // Los outfits taggeados van primero (en el orden del brief), los no taggeados al final
  let orderedOutfitItems = outfitItems;
  if (taggedOutfitOrder && taggedOutfitOrder.length > 0) {
    const taggedSet = new Set(taggedOutfitOrder);
    const inOrder   = taggedOutfitOrder.map(id => outfitItems.find(o => o.id === id)).filter(Boolean) as import('./types').WeeklyItem[];
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

    let shotPlan: import('./types').WeeklyShotPlan;

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
        redundancyDebug.push({ shotIndex: shotIdx, role: role as import('./types').WeeklyShotRole, score: 8, reason: 'No more outfits', replacedBecauseRedundant: true, replacementRole: altRole, replacementReason: reason });
      } else {
        const outfit = orderedOutfitItems[outfitCursor];
        outfitCursor++;
        const heroUseCount = outfitHeroCount[outfit.id] ?? 0;
        outfitHeroCount[outfit.id] = heroUseCount + 1;
        fullBodyCount.count++;

        // Todos los otros outfits como forbidden (no mezclar outfits en hero shots)
        const forbiddenOutfitIds = orderedOutfitItems.filter(o => o.id !== outfit.id).map(o => o.id);

        const redundancyScore = heroUseCount >= 1 ? 9 : fullBodyCount.count > orderedOutfitItems.length ? 6 : 0;
        let finalRole: import('./types').WeeklyShotRole = role;
        let replaced  = false;
        let replacementRole: import('./types').WeeklyShotRole | undefined;
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
          role: role as import('./types').WeeklyShotRole,
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
        const fallbackRole: import('./types').WeeklyShotRole = orderedOutfitItems.length > 0 ? 'WEEK_DETAIL' : 'WEEK_CLOSER';
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
          const isoRole: import('./types').WeeklyShotRole =
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

      let finalRole: import('./types').WeeklyShotRole = 'WEEK_CLOSER';
      let replaced  = false;
      let replacementRole: import('./types').WeeklyShotRole | undefined;
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
  const compositionMap: import('./types').WeeklyCompositionVarietyMap = {
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
  allItems:  import('./types').WeeklyItem[],
  shotPlan:  import('./types').WeeklyShotPlan[],
): Record<string, import('./types').WeeklyItemCoverage> {
  const map: Record<string, import('./types').WeeklyItemCoverage> = {};
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
  coverageMap: Record<string, import('./types').WeeklyItemCoverage>,
  allItems: import('./types').WeeklyItem[],
): import('./types').WeeklyDominanceCheck {
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
  refs:           import('./types').PhotodumpRefs,
  requestedCount: number,
  basePrompt?:    string,
): import('./types').WeeklyManifest {
  const allOutfitUrls  = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
  const allAccUrls     = (refs.accesorioRefs ?? []).filter(Boolean) as string[];
  const accCloseup     = refs.accesorioCloseup ?? [];

  const outfitItems: import('./types').WeeklyItem[] = allOutfitUrls.map((url, i) =>
    classifyWeeklyItem(url, i, true, i)
  );
  const accessoryItems: import('./types').WeeklyItem[] = allAccUrls.map((url, i) =>
    classifyWeeklyItem(url, outfitItems.length + i, false, i)
  );

  const allItems      = [...outfitItems, ...accessoryItems];

  // ── Reference Tag Resolution (patch v4) ──────────────────────
  // Si el brief contiene tags @outfit1, @outfit2, etc., resolverlos y enriquecer los ítems
  let referenceTagResolution: import('./types').ReferenceTagResolutionResult | undefined;

  if (basePrompt && basePrompt.includes('@')) {
    referenceTagResolution = resolveReferenceTagsFromBrief(basePrompt, outfitItems, accessoryItems, allItems);

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

  const outfitSets         = outfitItems;
  const standaloneGarments: import('./types').WeeklyItem[] = [];
  const shoes:     import('./types').WeeklyItem[] = [];
  const bags:      import('./types').WeeklyItem[] = [];
  const jewelry:   import('./types').WeeklyItem[] = [];
  const accessories = accessoryItems;
  const makeup:    import('./types').WeeklyItem[] = [];
  const products:  import('./types').WeeklyItem[] = [];

  const requiredItems = allItems;

  const dominantType = detectWeeklyDominantType(outfitItems, accessoryItems);

  // Compatibilidad cruzada — todos los pares accesorio × outfit
  const compatibilityPairs: import('./types').WeeklyCompatibilityPair[] = [];
  for (const acc of accessoryItems) {
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
    accessoryItems, outfitItems, compatibilityPairs, accCloseup, explicitPairingsMap,
  );

  // Plan de shots con roles narrativos
  // Pasar el orden de outfits por tags para respetar orden del brief
  const taggedOutfitOrder = referenceTagResolution
    ? referenceTagResolution.itemSemanticAssignments
        .filter(a => outfitItems.some(o => o.id === a.itemId))
        .map(a => a.itemId)
    : [];

  const { shotPlan, redundancyDebug, compositionMap } = buildWeeklyShotPlan(
    outfitItems, accessoryItems, compatibilityPairs, accIntPlan, accCloseup,
    requestedCount, dominantType, taggedOutfitOrder,
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
    }
  }

  // Avatar base clothing fingerprint
  const avatarBaseClothingFingerprint = buildAvatarBaseClothingFingerprint();

  // Coverage map clásico (binario) — compatibilidad con código existente
  const coverageMap: Record<string, import('./types').WeeklyCoverageEntry> = {};
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
  };
}

// Descripción legible del arco para debug
function buildWeeklyStructureDescription(
  plan: import('./types').WeeklyShotPlan[],
  dominant: import('./types').WeeklySetDominantType,
): string {
  const roles = plan.map(sp => sp.role).join(' → ');
  return `Weekly edit (${dominant}) | ${plan.length} shots | Arc: ${roles}`;
}

// Convierte un WeeklyShotPlan en un PhotodumpShotDirective con prompt completo
function weeklyRoleToDirective(
  sp:           import('./types').WeeklyShotPlan,
  position:     number,
  totalShots:   number,
  outfitItems:  import('./types').WeeklyItem[],
  accItems:     import('./types').WeeklyItem[],
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

  const roleDescriptions: Record<import('./types').WeeklyShotRole, { purpose: string; required: string[]; forbidden: string[]; beat: MomentType; framing: string; composition: string; angle: string }> = {
    WEEK_ANCHOR: {
      purpose: `Opening anchor of the weekly set. PRIMARY ITEM: ${primaryLabel || 'general mood'}. ${visualIntent}. Person in their space establishing visual world — light quality, ambient tone, environment. Full body or medium shot. Authentic, lived-in iPhone quality. Composition: ${compositionMode || 'authentic_natural'}.`,
      required: ['real_environment', 'authentic_mood', 'clear_identity', 'primary_item_readable'],
      forbidden: [...baseForbidden, 'white_background'],
      beat: 'context',
      framing: 'WIDE_FULL_BODY', composition: 'FULL_BODY_NATURAL', angle: 'EYE_LEVEL',
    },
    WEEK_OVERVIEW: {
      purpose: `Weekly selection overview. ALL WEEKLY ITEMS arranged naturally together — ${primaryLabel}${secondaryLabel ? ` and ${secondaryLabel}` : ''}. MUST show all items in one frame on a real surface (bed, rack, chair, floor). ${visualIntent}. The person may appear partially (hands, arms organizing) or not at all. NOT a worn look. NOT a collage. A real editorial photo of the week's picks together.`,
      required: ['all_primary_items_visible_and_readable', 'organized_natural_arrangement', 'real_surface', 'no_person_wearing_final_look'],
      forbidden: [...baseForbidden, 'collage_layout', 'catalog_grid', 'floating_items', 'person_already_dressed_in_final_outfit'],
      beat: 'context',
      framing: 'WIDE', composition: 'FLATLAY_OR_RACK_EDITORIAL', angle: 'SLIGHTLY_HIGH_OR_OVERHEAD',
    },
    WEEK_LOOK_HERO: {
      purpose: `Weekly look hero for ${primaryLabel}${semanticMoodLabel}. ${visualIntent}. Full body shot — outfit clearly readable head to toe. THIS outfit only — do NOT include elements from other uploaded outfits. Framing: ${compositionMode || rot.composition}. Angle: ${rot.angle}. Real environment, authentic attitude.${semanticIntent?.destination ? ` The mood of this look is "${semanticIntent.destination}" — reflect this in the environment and attitude.` : ''} NOT a catalog. NOT mannequin pose.`,
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
      purpose: `Accessory integrated shot: ${primaryLabel} worn/held WITH ${secondaryLabel || 'compatible outfit'}. ${visualIntent}. The accessory is clearly visible and readable as PART of the look — NOT isolated or floating. The outfit provides context. Show both items naturally together. Mode: ${compositionMode || 'worn_with_outfit'}.`,
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
  type:     'outfit' | 'accesorio' | 'producto' | 'escena';
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

function resolveTagType(base: string): 'outfit' | 'accesorio' | 'producto' | 'escena' | null {
  if (base === 'outfit' || base === 'look') return 'outfit';
  if (base === 'accesorio' || base === 'aro' || base === 'aros' || base === 'bag' || base === 'bolso' || base === 'zapato' || base === 'shoes') return 'accesorio';
  if (base === 'producto' || base === 'product') return 'producto';
  if (base === 'escena' || base === 'scene') return 'escena';
  return null;
}

function getUrlArrayForType(type: 'outfit' | 'accesorio' | 'producto' | 'escena', refs: PhotodumpRefs): string[] {
  if (type === 'outfit')    return [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
  if (type === 'accesorio') return (refs.accesorioRefs ?? []).filter(Boolean) as string[];
  if (type === 'producto')  return [refs.productRef, ...(refs.productRefs ?? [])].filter(Boolean) as string[];
  if (type === 'escena')    return [refs.sceneRef, ...(refs.sceneRefs ?? [])].filter(Boolean) as string[];
  return [];
}

function buildBriefTagRefMap(brief: string, refs: PhotodumpRefs): BriefTagRefMap {
  const allOutfitUrls   = getUrlArrayForType('outfit',    refs);
  const allAccUrls      = getUrlArrayForType('accesorio', refs);
  const allProductoUrls = getUrlArrayForType('producto',  refs);
  const allEscenaUrls   = getUrlArrayForType('escena',    refs);

  const tagMatches = [...brief.matchAll(/@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+)(\d*)/gi)];

  // Paso 1: construir info completa de cada tag encontrado en el brief
  const allSlotInfos: BriefTagSlotInfo[] = [];

  for (const m of tagMatches) {
    const base   = m[1].toLowerCase();
    const numStr = m[2];
    const humanN = numStr ? parseInt(numStr, 10) : 1;
    const idx    = humanN - 1;
    const type   = resolveTagType(base);
    if (!type) continue;

    const urlArr = getUrlArrayForType(type, refs);
    if (!urlArr[idx]) continue;  // slot no tiene imagen → ignorar

    const tagPos   = m.index ?? 0;
    const window   = brief.slice(Math.max(0, tagPos - 80), tagPos + 60);
    const briefCtx = window.replace(/@[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*/gi, '').replace(/\s+/g, ' ').trim().slice(0, 100);

    allSlotInfos.push({
      idx,
      url:      urlArr[idx],
      label:    `${type} slot ${humanN}`,
      tagRaw:   `@${m[1]}${m[2]}`,
      type,
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
  const shotModeBlock  = isFacelessShot ? STORY_MODE_FACELESS : STORY_MODE_DOMINANCE;

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
          const primaryIds       = weekPlan?.primaryItemIds.join(', ')   ?? 'first outfit';
          const secondaryIds     = weekPlan?.secondaryItemIds?.length ? weekPlan.secondaryItemIds.join(', ') : 'none';
          const forbiddenIds     = weekPlan?.forbiddenItemIds?.length  ? weekPlan.forbiddenItemIds.join(', ')  : '';
          const visualIntent     = weekPlan?.visualWeightIntent ?? '';
          const compositionMode  = weekPlan?.compositionMode    ?? '';
          const isOverview       = roleLabel.includes('OVERVIEW');
          const isDetail         = roleLabel.includes('DETAIL') || roleLabel.includes('ACCESSORY_DETAIL');
          const isAccessory      = roleLabel.includes('ACCESSORY');
          const isHero           = roleLabel === 'WEEK_LOOK_HERO' || roleLabel === 'WEEK_MIRROR_LOOK';
          // Semantic intent from tag resolver
          const semIntent        = weekPlan?.semanticIntentFromBrief;
          const resolvedTags     = weekPlan?.resolvedTagsUsed?.length ? weekPlan.resolvedTagsUsed.join(', ') : '';
          const moodLine         = semIntent?.mood || semIntent?.destination
            ? `MOOD / CONTEXT FROM BRIEF: "${[semIntent.mood, semIntent.destination].filter(Boolean).join(' — ')}"`
            : '';
          // Avatar base clothing fingerprint
          const fingerprint      = buildAvatarBaseClothingFingerprint();
          return `SHOT IDENTITY — WEEKLY EDIT:
- Face reference (appears 3 times): EXACT identity — same bone structure, same hair, same skin tone. No beautification.
${refs.bodyRef ? '- Body reference: establishes physique (build, proportions). Do NOT make the person heavier or slimmer than shown.' : ''}
- REF0: establishes the visual world — same light quality, same ambient mood, same color temperature.

WEEKLY ROLE: ${roleLabel}
PRIMARY ITEM(S) FOR THIS SHOT: ${primaryIds}
SECONDARY / INTEGRATED ITEM(S): ${secondaryIds}
VISUAL INTENT: ${visualIntent || `Show ${primaryIds} as the protagonist of this shot.`}
COMPOSITION MODE: ${compositionMode || 'authentic_natural'}
${resolvedTags ? `TAGS FROM BRIEF: ${resolvedTags}` : ''}
${moodLine}
${forbiddenIds ? `FORBIDDEN ITEMS IN FRAME — DO NOT SHOW: ${forbiddenIds}` : ''}

${isHero ? `HERO SHOT RULES:
- The person wears the ASSIGNED outfit (${primaryIds}) fully — head to toe readable.
- DO NOT mix in elements from other uploaded outfits.
- This specific outfit is the SOLE visual protagonist.
- Do NOT show other uploaded outfits in the background.${semIntent?.destination ? `\n- The vibe of this look is "${semIntent.destination}" — reflect this in the environment, body language, and mood.` : ''}` : ''}
${isOverview ? `OVERVIEW RULES:
- Show ALL weekly items arranged naturally together on a surface (bed, rack, chair, floor, table).
- Person may appear partially (hands organizing) or not at all.
- This is NOT a worn look. The person should NOT be modeling the outfit in this shot.
- Arrange items in an editorial, organized but real way — NOT a catalog grid, NOT a collage.` : ''}
${(isDetail || isAccessory) ? `ACCESSORY / DETAIL RULES:
- The reference image shows the EXACT piece. Reproduce faithfully — do NOT invent variants or fuse with other pieces.
- Do NOT substitute another piece for the specified accessory.
${weekPlan?.integratedWithOutfitId ? `- This accessory appears WITH a compatible outfit (${secondaryIds}) — show both naturally together.` : ''}` : ''}

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

  // ── HAUL LOCATION SEMANTICS — solo para outfit_haul ──────────────────────────
  // Evita que términos de ocasión ("para la oficina") contaminen el fondo de captura.
  const haulLocationSemanticsBlock = (() => {
    if (recipe !== 'outfit_haul') return '';
    const ctx = parseOutfitBriefContext(basePrompt);
    const isWearingOnly = ctx.wearingContextOnly === true;
    // Siempre inyectar el bloque de semántica de locación en haul.
    // Si wearingContextOnly=true, añadir advertencia explícita + forbidden list.
    // Si wearingContextOnly=false/undefined, solo el recordatorio base.
    const wearingOnlyWarning = isWearingOnly
      ? `
⚠️ CRITICAL — OCCASION ≠ LOCATION:
The brief says "${ctx.wearingContextStyleLabel ?? 'this occasion'}". This describes what the CLOTHES are for — NOT where the haul is filmed.
The user is doing a haul at HOME and these clothes happen to be workwear / occasion-appropriate.
DO NOT move the haul into an office, coworking space, corporate corridor, or workplace.
DO NOT generate: office lobby, building entrance, elevator, meeting room, coworking lounge, business corridor, reception desk, corporate interior.
The clothes may look polished and professional — the ROOM is still a bedroom / dressing room / home space.`
      : '';
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 HAUL LOCATION SEMANTICS (BINDING — DO NOT IGNORE):
A clothing haul is filmed in a HOME PREPARATION SPACE: bedroom, dressing room, closet room, or personal room.
The brief may mention an occasion (office, church, dinner, travel) — this describes WHERE THE CLOTHES WILL BE WORN, not where the haul is filmed.
${wearingOnlyWarning}
FORBIDDEN HAUL BACKGROUNDS (unless user explicitly requests them):
❌ office lobby or reception area
❌ coworking space or open-plan office
❌ corporate corridor or business hallway
❌ meeting room or boardroom
❌ building entrance or elevator lobby
❌ commercial showroom or retail space
❌ workplace lounge or office pantry
The haul ALWAYS stays in a home / personal / dressing environment unless the user says "film it in my office" or "at the office" explicitly.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  })();

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
