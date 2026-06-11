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
There is no "first act" or "last act". Every image belongs to the same world.

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
- No single image announces itself as the "opener" or the "closer".
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

// Extrae señales de tiempo, ambiente y mood del brief del usuario para elevarlas
// como directiva dominante de iluminación/atmósfera. Sin esto, el modelo ignora
// contexto temporal ("noche de ópera") y genera luz de día por defecto.
// Retorna señales de contexto del brief separadas en tiempo, venue-destino y mood.
// El venue/ocasión es SIEMPRE el destino final de la historia — NUNCA la locación
// de cada shot individual. Los shots de preparación ocurren en casa/habitación.
function parseBriefContext(basePrompt: string): {
  timeSignal: string;
  venueSignal: string;       // ocasión/destino final (ópera, restaurante, etc.)
  isOccasionBrief: boolean;  // true si el brief menciona un destino/evento
} {
  const lower = basePrompt.toLowerCase();
  let timeSignal  = '';
  let venueSignal = '';

  if (lower.includes('noche') || lower.includes('night') || lower.includes('nocturno') || lower.includes('nocturna'))
    timeSignal = 'NIGHT — warm artificial light, evening atmosphere, no daylight';
  else if (lower.includes('atardecer') || lower.includes('sunset') || lower.includes('golden hour') || lower.includes('hora dorada'))
    timeSignal = 'GOLDEN HOUR — warm orange-gold directional light, long shadows';
  else if (lower.includes('mañana') || lower.includes('morning') || lower.includes('amanecer'))
    timeSignal = 'MORNING — soft cool-to-warm natural light, fresh atmosphere';
  else if (lower.includes('mediodía') || lower.includes('midday') || lower.includes('tarde'))
    timeSignal = 'AFTERNOON — strong natural light, clear shadows';

  if (lower.includes('ópera') || lower.includes('opera') || lower.includes('teatro') || lower.includes('theatre'))
    venueSignal = 'OCCASION: opera / theatre night — formal elegance, chandeliers, velvet, marble. This is the DESTINATION, not the prep location.';
  else if (lower.includes('cóctel') || lower.includes('cocktail') || lower.includes('gala') || lower.includes('evento'))
    venueSignal = 'OCCASION: formal social event — evening venue, elegant atmosphere. This is the DESTINATION, not the prep location.';
  else if (lower.includes('playa') || lower.includes('beach') || lower.includes('mar'))
    venueSignal = 'DESTINATION: beach / ocean — natural light, sand, water. This is the destination, not every shot\'s location.';
  else if (lower.includes('restaurant') || lower.includes('restaurante') || lower.includes('dinner') || lower.includes('cena'))
    venueSignal = 'OCCASION: restaurant / dinner — warm evening ambiance. This is the DESTINATION, not the prep location.';
  else if (lower.includes('viaje') || lower.includes('travel') || lower.includes('trip'))
    venueSignal = 'CONTEXT: travel — location-specific environment as destination.';

  return { timeSignal, venueSignal, isOccasionBrief: venueSignal !== '' };
}

export { parseBriefContext };

// ── Destination inference ─────────────────────────────────────
// Lee el brief y deduce si hay un destino final explícito.
// Esto desacopla "hay un destino implícito" de "el usuario subió una foto de destino".
export function inferDestinationFromBrief(basePrompt: string): InferredDestination {
  const lower = basePrompt.toLowerCase();
  if (lower.includes('ópera') || lower.includes('opera') || lower.includes('teatro') || lower.includes('theatre') || lower.includes('ballet'))
    return 'opera_theatre';
  if (lower.includes('cóctel') || lower.includes('cocktail') || lower.includes('gala') || lower.includes('evento formal') || lower.includes('black tie'))
    return 'cocktail_gala';
  if (lower.includes('restaurant') || lower.includes('restaurante') || lower.includes('dinner') || lower.includes('cena') || lower.includes('date night'))
    return 'restaurant_dinner';
  if (lower.includes('playa') || lower.includes('beach') || lower.includes('mar ') || lower.includes('ocean') || lower.includes('pool'))
    return 'beach_outdoor';
  if (lower.includes('viaje') || lower.includes('travel') || lower.includes('trip') || lower.includes('vuelo') || lower.includes('airport'))
    return 'travel_transit';
  if (lower.includes('salir') || lower.includes('salida') || lower.includes('noche') || lower.includes('night out') || lower.includes('going out'))
    return 'generic_outing';
  return 'none';
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

    case 'OUTFIT_MIRROR_CHECK':
      return 'wearing_full_outfit';

    case 'OUTFIT_READY':
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
    if (style === 'flat_lay')        return 'detail_macro'; // close-up de elemento del flat lay
    return 'detail_macro';
  }

  if (shotKey === 'OUTFIT_MIRROR_CHECK') return 'mirror_selfie_phone_hidden';
  if (shotKey === 'OUTFIT_READY')        return 'selfie_pov';
  if (shotKey === 'OUTFIT_DESTINATION')  return 'full_body_room';

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
      return `📍 SCENE LOCK — DESTINATION:
This is the CLOSING SHOT. The scene changes to the FINAL DESTINATION of the brief.
Location: ${destDesc}
CRITICAL: Do NOT replicate the prep room walls, furniture, or lighting.
Same person, same outfit, same identity — NEW final destination space.
The story ends HERE — in the place the brief implied from the start.`;
  }
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
  const incompatibleKeys = ['OUTFIT_ARRIVING', 'OUTFIT_DETAIL', 'ACCESSORY_CLOSEUP'];
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
): string[] {
  const contradictions: string[] = [];
  const isOutfitCheck = recipe === 'outfit_check';

  if (isOutfitCheck) {
    // Destino inferido pero no hay OUTFIT_DESTINATION en el plan
    if (inferredDest !== 'none' && !hasDestPhoto && !allShotKeys.includes('OUTFIT_DESTINATION'))
      contradictions.push('destination inferred from brief but no OUTFIT_DESTINATION shot in plan');

    // Brief de noche pero shot no tiene tiempo nocturno
    if (timeSignal.includes('NIGHT') && shot.key === 'OUTFIT_ARRIVING')
      contradictions.push('brief says NIGHT — REF0/prep shots must use warm artificial light, NOT daylight');

    // wearState full outfit pero zapatos no marcados como worn
    if ((shot.wearState === 'wearing_full_outfit' || shot.wearState === 'destination_arrived') &&
        shot.itemStatePlan?.some(p => p.item === 'shoes' && p.requiredState !== 'worn' && p.mustBeVisible))
      contradictions.push('wearState=wearing_full_outfit but itemStatePlan has shoes !== worn');

    // Mirror sin política de teléfono prohibido
    if ((shot.cameraMode === 'mirror_selfie' || shot.cameraMode === 'mirror_selfie_phone_hidden') &&
        shot.phonePolicy !== 'forbidden')
      contradictions.push('cameraMode=mirror_selfie_phone_hidden but phonePolicy is not forbidden');

    // detail_macro pero subjectPresence=full_body
    if (shot.cameraMode === 'detail_macro' && shot.subjectPresence === 'full_body')
      contradictions.push('cameraMode=detail_macro but subjectPresence=full_body — should be object_detail or hands_only');

    // HPI en shot de objeto/detalle
    if (shot.hpiAllowed && ['OUTFIT_ARRIVING', 'OUTFIT_DETAIL', 'ACCESSORY_CLOSEUP'].includes(shot.key ?? ''))
      contradictions.push('hpiAllowed=true on object/detail shot — HPI must be disabled here');

    // Shot final no marcado como closing
    if (shot.isFinalShot && !shot.isClosingShot)
      contradictions.push('final shot is not marked as closing shot');

    // Closing shot bloqueado a prep space con destino disponible
    if (shot.isClosingShot && shot.sceneLockPolicy !== 'destination_allowed' &&
        (inferredDest !== 'none' || hasDestPhoto))
      contradictions.push('closing shot has sceneLockPolicy !== destination_allowed despite inferred/uploaded destination');
  }

  return contradictions;
}

// ── Bloque de contexto global del brief — inyectado en REF0 y shots de destino.
// Para shots de preparación (ARRIVING, MIRROR, DETAIL, READY), usar extractShotLocationOverride.
function extractBriefContextBlock(basePrompt: string): string {
  const { timeSignal, venueSignal } = parseBriefContext(basePrompt);
  if (!timeSignal && !venueSignal) return '';

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🎯 SCENE CONTEXT DIRECTIVE (OVERRIDES DEFAULT LIGHTING ASSUMPTIONS):',
    'The user\'s brief contains explicit context clues. These are BINDING directives — not suggestions.',
    'They override the model\'s default tendency to generate daytime/neutral lighting.',
  ];
  if (timeSignal) lines.push(`  • ${timeSignal}`);
  if (venueSignal) lines.push(`  • ${venueSignal}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n');
}

// Para shots de PREPARACIÓN en recetas de outfit: ancla la locación del shot
// al espacio de REF0 (nunca al venue del brief).
// La ópera/gala/restaurante es el destino — no donde la persona se prueba el outfit.
const PREP_SHOT_KEYS = new Set(['OUTFIT_ARRIVING', 'OUTFIT_MIRROR_CHECK', 'OUTFIT_DETAIL', 'OUTFIT_READY']);

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
    const inferredDest   = inferDestinationFromBrief(basePrompt ?? '');
    // El arco usa destino si hay destino inferido en brief O si el usuario subió una foto de destino
    const shouldUseDestinationClosure = hasDestino || (inferredDest !== 'none');
    const pool           = buildOutfitCheckShotPool(style, inferredDest, hasDestino);
    const baseKeys       = distributeOutfitCheckShots(count, shouldUseDestinationClosure);
    // Shots de close-up de accesorios van ANTES del último shot (closing shot siempre al final)
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
        : key === 'OUTFIT_ARRIVING' || key === 'OUTFIT_DETAIL' || key === 'ACCESSORY_CLOSEUP'
          ? 'prep_space_or_surface'
          : key === 'OUTFIT_READY'
            ? 'prep_space_or_pre_exit'
            : 'prep_space';
      const phonePolicy = key === 'OUTFIT_MIRROR_CHECK'
        ? 'forbidden' as const
        : 'not_applicable' as const;
      return {
        ...shot,
        arcPosition: i + 1,
        aspectRatio: ar,
        isFinalShot,
        isClosingShot,
        closingStrategy: closingStrategy as any,
        sceneLockPolicy,
        phonePolicy,
      };
    });
  }

  if (recipe === 'outfit_haul') {
    // outfitCount = cuántas prendas subió el usuario (sin contar accesorios)
    const allOutfits  = [refs?.avatarRef ? refs : null, ...(refs?.outfitRefs ?? [])].filter(Boolean);
    const outfitCount = Math.max(1, (refs?.outfitRefs ?? []).filter(Boolean).length + (refs?.avatarRef ? 1 : 0));
    const haulCount   = Math.max(1, outfitCount);
    const pool        = buildOutfitHaulShotPool(haulCount);
    // El arco del haul: INTRO + TRY_ON × N + WINNER = haulCount + 1 shots base
    // Si count > shots base, rellenamos con shots de detalle de prenda (rotando)
    const baseShots = pool.slice(0, Math.min(pool.length, count));
    const closeupIndexes = (refs?.accesorioCloseup ?? [])
      .map((v, i) => v ? i : -1).filter(i => i >= 0);
    const allShots = [...baseShots, ...closeupIndexes.map(() => {
      const accPool = buildOutfitCheckShotPool();
      return accPool.find(s => s.key === 'ACCESSORY_CLOSEUP')!;
    })];
    return allShots.map((shot, i) => ({ ...shot, arcPosition: i + 1, aspectRatio: ar }));
  }

  if (recipe === 'outfit_week') {
    const outfitCount = Math.max(1, [refs?.avatarRef, ...(refs?.outfitRefs ?? [])].filter(Boolean).length);
    // Generar un shot por outfit (o por count si es mayor que outfits)
    const weekCount   = Math.max(count, outfitCount);
    const pool        = buildOutfitWeekShotPool(weekCount);
    const baseShots   = pool.slice(0, count);
    const closeupIndexes = (refs?.accesorioCloseup ?? [])
      .map((v, i) => v ? i : -1).filter(i => i >= 0);
    const accPool = closeupIndexes.length > 0 ? buildOutfitCheckShotPool() : [];
    const accShot = accPool.find(s => s.key === 'ACCESSORY_CLOSEUP');
    const allShots = [
      ...baseShots,
      ...closeupIndexes.map(() => accShot!),
    ];
    return allShots.map((shot, i) => ({ ...shot, arcPosition: i + 1, aspectRatio: ar }));
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
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const arrivingVariants = getArrivingVariants(presentationStyle);
  const wearArriving     = resolveWearState('OUTFIT_ARRIVING', presentationStyle);
  const wearDetail       = resolveWearState('OUTFIT_DETAIL', presentationStyle);
  const camArriving      = resolveCameraMode('OUTFIT_ARRIVING', presentationStyle);
  const camDetail        = resolveCameraMode('OUTFIT_DETAIL', presentationStyle);

  // Cierre de destino: si el brief menciona un destino O el usuario subió foto de destino,
  // la última imagen sintetiza ese lugar. Si no, cierra con un segundo ángulo en la prep space.
  const hasDestination = hasDestinoRef || (inferredDest && inferredDest !== 'none');
  const destDesc       = inferredDest && inferredDest !== 'none'
    ? getDestinationDescription(inferredDest)
    : 'lifestyle setting — street, entrance, or ambient exterior that matches the outfit mood';

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
      // subjectPresence se deriva del cameraMode real, no del shot genérico
      subjectPresence: camDetail === 'detail_macro' ? 'object_detail'
                     : camDetail === 'hands_presenter_closeup' ? 'hands_only'
                     : 'full_body',
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
        ? `La persona en el destino final con el outfit completo. El ambiente es: ${destDesc}. Full body integrado al lugar. El outfit y el entorno juntos cierran la historia.`
        : 'Momento final con el look completo: segundo ángulo en la misma prep space, o exterior de salida justo antes de irse. El outfit se ve completo y la historia cierra con actitud.',
      requiredElements: hasDestination
        ? ['full_body_visible', 'destination_environment_clearly_readable', 'complete_outfit_visible', 'person_belongs_in_space']
        : ['full_body_visible_or_medium_shot', 'complete_outfit_readable', 'confident_closing_attitude', 'real_environment'],
      forbiddenElements: [
        'catalog_pose',
        'studio_backdrop',
        'generic_white_wall',
        'mannequin_stance',
        'ad_feel',
        'flat_lay_garments',
        ...(hasDestination ? ['prep_space_bedroom_or_mirror'] : []),
      ],
      variationSpace: hasDestination
        ? [
            `full body en ${destDesc} — outfit completo visible, actitud natural, ambiente claramente reconocible`,
            `avatar apoyada en elemento del ambiente destino (columna, barra, entrada), pose con actitud, outfit completo`,
            `medium shot en el destino, ambiente de fondo claramente legible, cara y outfit visibles, expresión segura`,
            `llegando o caminando hacia el lugar, outfit en movimiento, ambiente destino de fondo orgánico`,
          ]
        : [
            'full body en pasillo o entrada del apartamento, actitud de "voy a salir", look completo visible',
            'medium shot en el mismo cuarto desde otro ángulo, outfit leído desde la cintura hacia arriba, expresión resuelta',
            'persona apoyada en marco de puerta o pared, look completo, actitud de pre-salida',
            'selfie de cuerpo entero en pasillo o exterior inmediato, outfit completo visible, mood de cierre',
          ],
      framing:         'WIDE_FULL_BODY',
      composition:     hasDestination ? 'PERSON_IN_DESTINATION_CONTEXT' : 'FULL_BODY_NATURAL_CLOSING',
      cameraAngle:     'EYE_LEVEL_OR_SLIGHTLY_LOW',
      wearState:       'destination_arrived',
      cameraMode:      'full_body_room',
      narrativeStage:  'destination',
      hpiAllowed:      true,
      hpiScope:        'full',
      subjectPresence: 'full_body',
      itemStatePlan:   [
        { item: 'top',    requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'bottom', requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'dress',  requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'shoes',  requiredState: 'worn', mustBeVisible: true,  mayBeDuplicated: false },
        { item: 'bag',    requiredState: 'worn', mustBeVisible: false, mayBeDuplicated: false },
      ],
      phonePolicy:     'not_applicable',
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
// Los beats obligatorios son: ARRIVING → MIRROR_CHECK → DETAIL → READY → DESTINATION
// Si count < 5, se eliminan en este orden: DETAIL, READY (el arco mínimo es ARRIVING + MIRROR + DESTINATION)
// Los shots de ACCESSORY_CLOSEUP se insertan ANTES del último shot (no al final).
// hasDestinationClosure: true si hay destino inferido en brief O si el usuario subió sceneDestinoRef.
function distributeOutfitCheckShots(count: number, hasDestinationClosure: boolean): string[] {
  const fullArc = [
    'OUTFIT_ARRIVING',
    'OUTFIT_MIRROR_CHECK',
    'OUTFIT_DETAIL',
    'OUTFIT_READY',
    'OUTFIT_DESTINATION',
  ];
  // Si no hay destino (ni inferido ni subido), el último shot es un cierre en prep space
  const arc = hasDestinationClosure ? fullArc : [...fullArc.slice(0, 4), 'OUTFIT_MIRROR_CHECK'];
  if (count >= 5) return arc;
  if (count === 4) return arc.filter(k => k !== 'OUTFIT_READY');
  if (count === 3) return ['OUTFIT_ARRIVING', 'OUTFIT_MIRROR_CHECK', hasDestinationClosure ? 'OUTFIT_DESTINATION' : 'OUTFIT_READY'];
  return ['OUTFIT_ARRIVING', 'OUTFIT_MIRROR_CHECK', hasDestinationClosure ? 'OUTFIT_DESTINATION' : 'OUTFIT_READY'];
}

// ── Outfit Haul shots ────────────────────────────────────────
// Historia: "Me probé todo esto / esta es mi cápsula"
// Arco: intro de prendas → try-on progresivo con desorden creciente → prenda ganadora

function buildOutfitHaulShotPool(outfitCount: number): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const pool: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] = [
    {
      key:   'HAUL_INTRO',
      beat:  'context',
      role:  'HAUL INTRO',
      purpose: 'Presentación de todas las prendas antes de empezar a probarlas. Flat lay o rack con el conjunto visible. Sin avatar de cuerpo completo. Establece la cantidad y variedad del haul. Comunica "esto es lo que me voy a probar".',
      requiredElements: ['multiple_garments_visible', 'real_context_not_studio', 'variety_of_pieces_readable', 'organic_arrangement_not_catalog'],
      forbiddenElements: ['full_body_avatar_posing', 'white_background', 'studio_lighting', 'catalog_product_grid', 'forced_symmetry'],
      variationSpace: [
        'flat lay de todas las prendas sobre cama — organizadas pero no perfectas, algunas superpuestas',
        'prendas colgadas en rack o silla, manos parcialmente visibles acomodando la última pieza',
        'overhead de las prendas extendidas sobre piso o cama, accesorios dispersos al costado',
        'manos sosteniendo varias prendas al mismo tiempo, extendiéndolas frente a cámara',
      ],
      framing:     'WIDE_OR_OVERHEAD',
      composition: 'GARMENTS_COLLECTION_VISIBLE',
      cameraAngle: 'OVERHEAD_OR_EYE_LEVEL',
    },
  ];

  // Shot de try-on por cada prenda (índice 0-based de la prenda)
  for (let i = 0; i < outfitCount; i++) {
    const isLast     = i === outfitCount - 1;
    const pilesCount = i; // cuántas prendas ya están apiladas en el fondo
    const pileDesc   = pilesCount === 0
      ? 'El espacio está ordenado — es la primera prenda.'
      : pilesCount === 1
        ? 'En el fondo hay 1 prenda descartada apilada sobre una superficie (cama, silla o perchero).'
        : `En el fondo hay ${pilesCount} prendas descartadas apiladas — el caos crece de forma natural.`;

    pool.push({
      key:   isLast ? 'HAUL_WINNER' : `HAUL_TRY_ON_${i + 1}`,
      beat:  isLast ? 'emotion' : 'action',
      role:  isLast ? 'HAUL WINNER' : `TRY-ON ${i + 1} of ${outfitCount}`,
      purpose: isLast
        ? `El avatar con la prenda ganadora — la que eligió quedarse. ${pileDesc} Expresión de decisión tomada o satisfacción. Full body o medium shot, outfit completo visible.`
        : `El avatar vistiéndose la prenda ${i + 1} de ${outfitCount}. ${pileDesc} Actitud natural — se está probando, evaluando, moviéndose. No es una pose de catálogo.`,
      requiredElements: isLast
        ? ['full_body_or_medium_avatar', 'winning_outfit_clearly_visible', 'discarded_pile_visible_in_background', 'satisfied_or_decisive_expression']
        : ['avatar_wearing_garment', 'garment_fully_visible', 'real_environment_visible', 'natural_try_on_attitude'],
      forbiddenElements: ['catalog_stance', 'studio_backdrop', 'white_background', 'mannequin_pose', 'beautification', 'ad_composition'],
      variationSpace: isLast
        ? [
            'full body del avatar con la prenda ganadora, fondo con ropa apilada visible, expresión resuelta',
            'medium shot con la prenda ganadora, actitud de "esta es la elegida", ropa descartada parcialmente visible',
            'selfie en espejo con la prenda ganadora puesta, caos del haul visible en el reflejo',
            'avatar mirando la prenda que lleva puesta, manos ajustándola, satisfacción genuina',
          ]
        : [
            `full body con la prenda ${i + 1} puesta, actitud de evaluación — dando vuelta, mirándose`,
            `medium shot con la prenda ${i + 1}, expresión de "¿qué pienso?", ambiente real de fondo`,
            `avatar ajustándose la prenda ${i + 1}, manos activas, gesto natural de quien se prueba algo`,
            `full body con la prenda ${i + 1}, mirando hacia abajo evaluando el look, ambiente visible`,
          ],
      framing:     isLast ? 'WIDE_FULL_BODY' : 'MEDIUM_OR_WIDE',
      composition: isLast ? 'WINNER_WITH_CHAOS_BACKGROUND' : 'TRY_ON_IN_CONTEXT',
      cameraAngle: 'EYE_LEVEL',
    });
  }

  return pool;
}

// ── Outfit Week shots ────────────────────────────────────────
// Historia: "Estos fueron mis outfits de la semana / del mes / de la ocasión"
// Cada shot = un outfit completo, full body. Variedad de ángulos y mood entre shots.

function buildOutfitWeekShotPool(outfitCount: number): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  // Rotación de framings y ángulos para que ningún shot se sienta idéntico al anterior
  const framingRotation = [
    { framing: 'WIDE_FULL_BODY', composition: 'FULL_BODY_NATURAL', angle: 'EYE_LEVEL_OR_SLIGHTLY_LOW' },
    { framing: 'WIDE_FULL_BODY', composition: 'MIRROR_SELFIE_FULL_BODY', angle: 'EYE_LEVEL' },
    { framing: 'MEDIUM', composition: 'THREE_QUARTERS_NATURAL', angle: 'EYE_LEVEL' },
    { framing: 'WIDE_FULL_BODY', composition: 'FULL_BODY_IN_CONTEXT', angle: 'SLIGHTLY_LOW_LOOKING_UP' },
    { framing: 'MEDIUM', composition: 'CANDID_IN_SPACE', angle: 'EYE_LEVEL' },
    { framing: 'WIDE_FULL_BODY', composition: 'WALKING_OR_ARRIVING', angle: 'EYE_LEVEL' },
    { framing: 'MEDIUM', composition: 'LEANING_OR_RESTING', angle: 'EYE_LEVEL_OR_SLIGHTLY_HIGH' },
  ];

  return Array.from({ length: outfitCount }, (_, i) => {
    const rot = framingRotation[i % framingRotation.length];
    return {
      key:   `WEEK_OUTFIT_${i + 1}`,
      beat:  'context' as MomentType,
      role:  `OUTFIT ${i + 1} of ${outfitCount}`,
      purpose: `El avatar con el outfit ${i + 1} completo. Full body visible. El look debe leerse completamente. Ambiente real — puede ser interior o exterior. La luz y el ángulo varían respecto al shot anterior para dar sensación de días distintos.`,
      requiredElements: ['full_body_visible', 'complete_outfit_readable_head_to_toe', 'real_environment_not_studio', 'authentic_attitude'],
      forbiddenElements: ['catalog_mannequin_pose', 'studio_backdrop', 'white_background', 'identical_framing_as_prior_shot', 'beautification', 'ad_feel'],
      variationSpace: [
        `full body con outfit ${i + 1}, pose natural apoyada o de pie, ambiente real de fondo`,
        `selfie de espejo full body con outfit ${i + 1}, actitud casual, ambiente del día visible`,
        `medium shot con outfit ${i + 1}, tres cuartos, ángulo levemente distinto al anterior`,
        `full body caminando o llegando a algún lugar con outfit ${i + 1}, movimiento orgánico`,
      ],
      framing:     rot.framing,
      composition: rot.composition,
      cameraAngle: rot.angle,
    };
  });
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

  const { timeSignal } = parseBriefContext(basePrompt);
  const ref0LightingNote = timeSignal.includes('NIGHT')
    ? `Lighting: warm artificial indoor light — bedroom lamp, ceiling light, or vanity light. NO daylight. NO window sunlight. This is an evening/night getting-ready scene.`
    : timeSignal.includes('GOLDEN')
      ? `Lighting: warm golden-hour light coming through a window. Soft and directional.`
      : timeSignal.includes('MORNING')
        ? `Lighting: soft cool-to-warm natural window light. Fresh morning atmosphere.`
        : `Lighting: real indoor light from the try-on space — natural window light or ambient room light. Authentic, not studio.`;

  const outfitRecipeDesc: Record<string, string> = {
    outfit_check: `SHOT: Full body of the person with the COMPLETE OUTFIT on, in the try-on space (room, mirror, fitting room, or dressing area).
Full body visible — the look must be readable from head to toe. Face visible, natural expression.
${ref0LightingNote}
Real walls, real floor. NOT a studio. NOT a catalog. NOT the event venue.
iPhone photo quality. This establishes: the person's identity, the outfit, and the visual world for the set.
IMPORTANT: This is the PREPARATION space — not the event destination. Even if the brief mentions opera or gala, this shot is in the getting-ready space.`,
    outfit_haul: `SHOT: Full body of the person in the haul space (bedroom, fitting room), holding or wearing the first garment.
The space should feel lived-in — a bed, a rack, a chair nearby. Natural light.
Face visible, natural expression. The garments are the stars — the person is the presenter.
iPhone photo quality. This establishes the identity, the space, and the mood of the haul.`,
    outfit_week: `SHOT: Full body of the person with the FIRST OUTFIT on, in the general environment for the week set.
Full body visible — the look must be readable head to toe. Real environment, authentic light.
This REF0 establishes the visual world: same light quality, same ambient mood, across all the week's outfits.
iPhone photo quality. NOT a catalog. NOT a studio.`,
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

  const briefContextBlock = extractBriefContextBlock(basePrompt);

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

    // Prep shots y shots neutros: anclar escena, luz y tono de piel.
    // Filtrar elementos que son piezas del outfit — no deben congelarse como ambiente.
    const OUTFIT_ITEM_KEYWORDS = [
      'heel', 'shoe', 'shoes', 'boot', 'boots', 'sneaker',
      'bag', 'purse', 'clutch', 'handbag',
      'jacket', 'blazer', 'coat',
      'dress', 'skirt', 'pants', 'jeans', 'trousers',
      'top', 'shirt', 'blouse', 'tshirt',
      'corset', 'bustier', 'bodysuit',
      'accessory', 'accessories', 'jewelry', 'necklace', 'bracelet', 'earring',
      'scarf', 'hat', 'glove',
    ];
    const envElements = (s.elements ?? []).filter((el: string) =>
      !OUTFIT_ITEM_KEYWORDS.some(kw => el.toLowerCase().includes(kw))
    );
    return `
🔒 REF0 ANALYSIS LOCK (freeze these — do NOT change):
- Lighting: ${l.primarySource ?? 'natural'}, ${l.direction ?? 'ambient'}, ${l.colorTemperature ?? 'warm'}, ${l.shadowType ?? 'soft'}
- Environment: ${envElements.join(', ') || 'real scene'}, ${s.geometry ?? 'interior'}
- Color temperature: SAME as REF0 — do NOT shift warm/cool
- Skin tone rendering: SAME as REF0 — do NOT lighten or darken
NOTE: Outfit items (shoes, bag, garments) detected in REF0 are NOT fixed environment elements.
They may move, be worn, or appear differently per shot — that is intentional and correct.
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
): Promise<PhotodumpShotResult> {

  const aspectInstr = getAspectInstruction(destino);
  const isUnboxing  = recipe === 'unboxing';

  const outfitMode = refs.outfitMode ?? 'generate';

  // ── Outfit por shot: cada prenda se asigna a un shot distinto ─
  const { outfitUrl: outfitForThisShot, isFlatLay } = getOutfitForShot(refs, shot.arcPosition - 1);

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
  } else if (recipe === 'outfit_check' || recipe === 'outfit_haul' || recipe === 'outfit_week') {
    // Outfit recipes: avatar x3 (identidad dominante) + ref0 + prenda(s) de este shot + escena
    if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
    if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
    refsToPass.push(ref0Url);

    const allOutfits = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];

    if (shot.key === 'ACCESSORY_CLOSEUP') {
      // Shot de close-up de accesorio: pasar el accesorio específico
      // El índice del accesorio se codifica en el arcPosition relativo a los shots base
      const allAccesorios = (refs.accesorioRefs ?? []).filter(Boolean) as string[];
      // Calcular qué accesorio corresponde a este shot de closeup (orden de aparición)
      const closeupShots  = allAccesorios.length;
      const accIdx        = (shot.arcPosition - 1) % Math.max(closeupShots, 1);
      if (allAccesorios[accIdx]) refsToPass.push(allAccesorios[accIdx]);
    } else if (recipe === 'outfit_haul') {
      // Haul: cada shot muestra la prenda correspondiente a su posición en el arco
      // Shot 0 = HAUL_INTRO (no outfit específico), Shot 1..N = prenda i, Shot N+1 = ganadora
      const shotOutfitIndex = shot.arcPosition - 2; // 0-indexed después del INTRO
      if (shotOutfitIndex >= 0 && allOutfits[shotOutfitIndex]) {
        refsToPass.push(allOutfits[shotOutfitIndex]);
      }
    } else if (recipe === 'outfit_week') {
      // Week: cada shot tiene un outfit distinto
      const weekOutfitIndex = shot.arcPosition - 1; // 0-indexed
      if (allOutfits[weekOutfitIndex % Math.max(allOutfits.length, 1)]) {
        refsToPass.push(allOutfits[weekOutfitIndex % allOutfits.length]);
      }
    } else {
      // outfit_check: mismo outfit (look completo) en todos los shots
      allOutfits.slice(0, 2).forEach(r => refsToPass.push(r));
    }

    // Escena: outfit_check usa scenePruebaRef hasta el penúltimo shot, sceneDestinoRef en el último
    if (recipe === 'outfit_check') {
      const isLastShot = shot.key === 'OUTFIT_DESTINATION';
      const sceneRef   = isLastShot
        ? (refs.sceneDestinoRef ?? refs.scenePruebaRef ?? refs.sceneRef)
        : (refs.scenePruebaRef ?? refs.sceneRef);
      if (sceneRef) refsToPass.push(sceneRef);
    } else {
      if (refs.sceneRef) refsToPass.push(refs.sceneRef);
    }
  } else {
    // Comportamiento original para todas las demás recetas
    if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
    if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
    refsToPass.push(ref0Url);
    if (outfitForThisShot) refsToPass.push(outfitForThisShot);
    if (refs.productRef) refsToPass.push(refs.productRef);
    const extraProducts = (refs.productRefs ?? []).filter(Boolean) as string[];
    extraProducts.forEach(r => refsToPass.push(r));
    const sceneForShot = getSceneRefForShot(refs, shot.arcPosition - 1, totalShots);
    if (sceneForShot) refsToPass.push(sceneForShot);
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
  const familyBlock = selectedFamily ? buildFamilyInjectBlock(selectedFamily) : '';

  // HPI: filtrado por compatibilidad con el shot actual.
  // Prioridad: shot.hpiAllowed explícito (outfit_check) > reglas globales por shotKey.
  const shotHpiAllowed  = shot.hpiAllowed;  // undefined = no definido (shots no-outfit)
  const globalHpiBlock  = !isFacelessShot
    && !!refs.avatarRef
    && shot.key !== 'HAUL_INTRO'
    && shot.key !== 'OUTFIT_ARRIVING'
    && shot.key !== 'ACCESSORY_CLOSEUP'
    && shot.key !== 'UNBOXING_PACKAGING_CLOSED'
    && shot.key !== 'UNBOXING_PRODUCT_REVEAL'
    && shot.key !== 'UNBOXING_PRODUCT_DETAIL'
    && shot.key !== 'UNBOXING_ATMOSPHERE';

  const hpiEligible = typeof shotHpiAllowed === 'boolean'
    ? shotHpiAllowed && !!refs.avatarRef && !isFacelessShot
    : globalHpiBlock;

  // Determinar qué tipo de microacción HPI es compatible con este shot
  const hpiScope = shot.hpiScope ?? 'full';
  const rawHpiBlock = hpiEligible
    ? buildHpiBlock({
        enabled:            true,
        gender:             refs.gender ?? 'female',
        modoVisual:         'ugc',
        includeGesture:     true,
        includePerformance: hpiScope === 'full' && (shot.beat === 'emotion' || shot.beat === 'candid'),
        ...( hpiScope === 'micro_action_only' && {
          _scopeNote: 'MICRO ACTION ONLY: adjusting a strap, hand on hip, slight torso turn, checking shoe — NO full-body dance pose, NO gym move, NO athletic stance',
        } as any ),
        ...( hpiScope === 'gesture_only' && {
          _scopeNote: 'GESTURE ONLY: one hand holding an accessory naturally — NO body pose, NO full stance',
        } as any ),
      })
    : '';
  // Para outfit_check: filtrar HPI incompatible con la narrativa de outfit
  const hpiBlock = (recipe === 'outfit_check' || recipe === 'outfit_haul')
    ? filterHpiForOutfitCheck(rawHpiBlock, shot.key ?? '')
    : rawHpiBlock;

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

  // Instrucción de outfit específica para este shot
  const shotOutfitInstruction = isOutfitShot
    ? shot.key === 'HAUL_INTRO' || shot.key === 'OUTFIT_ARRIVING'
      ? `OUTFIT PRESENTATION: The garment references show the exact pieces to display. Show them as objects — on a rack, laid flat, or held by hands. The garments must be clearly readable. Do NOT show a full-body catalog pose.`
      : shot.key === 'ACCESSORY_CLOSEUP'
        ? `ACCESSORY CLOSE-UP: The accessory reference shows the exact piece to feature. Fill the frame with it. Reproduce it faithfully — same color, material, hardware, design. Real light, real surface. No person needed.`
        : recipe === 'outfit_haul'
          ? `OUTFIT THIS SHOT: The garment reference for this shot is the SPECIFIC piece the person is wearing in this try-on moment. Copy it EXACTLY — same color, fabric, cut, fit. The person wears it naturally, not for a catalog.`
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
${recipe === 'outfit_haul' && shot.key !== 'HAUL_INTRO' ? `HAUL PROGRESSION: ${shot.purpose}` : ''}

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
    : `📱 iPhone UGC REALISM (NON-NEGOTIABLE):
You are taking a new iPhone-style photo inside the same existing moment as REF0.
Natural light, handheld imperfection, real skin texture, no studio polish.
The result must look like someone captured this moment on their phone — not a photographer.
Organic, imperfect, lived-in. NOT editorial. NOT advertising. NOT staged.`;

  const briefContextBlock   = extractBriefContextBlock(basePrompt);
  const hasUserSceneRef = !!(refs.scenePruebaRef || refs.sceneRef);
  const inferredDestForShot = recipe === 'outfit_check' ? inferDestinationFromBrief(basePrompt) : 'none';
  const destDescForShot     = getDestinationDescription(inferredDestForShot);
  // Closing shots usan la sceneLockPolicy del shot para determinar libertad de escena.
  // Prep shots y otros sin sceneLockPolicy definida usan extractShotLocationOverride legado.
  const shotLocationOverride = shot.sceneLockPolicy
    ? (buildSceneLockPolicyBlock(shot.sceneLockPolicy, destDescForShot, hasUserSceneRef) ?? '')
    : extractShotLocationOverride(basePrompt, shot.key, hasUserSceneRef);
  const styleCoherenceBlock  = buildStyleCoherenceBlock(presentationStyle, shot.key);

  const prompt = `${LOCK_SYSTEM}

${PARADIGM_RULE}

${shotModeBlock}

${briefContextBlock}

${shotLocationOverride}

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
  return { imageUrl, prompt, refsCount: preparedRefs.length };
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
