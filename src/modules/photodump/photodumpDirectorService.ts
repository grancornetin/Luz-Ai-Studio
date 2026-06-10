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
}

export interface PhotodumpSessionPlan {
  narrative:        PhotodumpNarrative;
  protagonist:      PhotodumpProtagonist;
  destino:          PhotodumpDestino;
  storyTheme:       string;
  shots:            PhotodumpShotDirective[];
  assignedFamilies: StorySupportFamily[];   // Lista plana para compatibilidad
  sessionFamilies:  SessionFamilies;        // Separadas por clase para asignación ordenada
}

export interface PhotodumpREF0Result {
  imageUrl:    string;
  ref0Analysis: any;
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
phone visible in selfie, camera visible
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
phone visible in selfie, color temperature drift, filter drift
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
  refs?:      { avatarRef?: string | null; outfitRefs?: (string | null)[]; accesorioRefs?: (string | null)[]; accesorioCloseup?: boolean[]; sceneDestinoRef?: string | null },
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
    const hasDestino = !!refs?.sceneDestinoRef;
    const pool       = buildOutfitCheckShotPool();
    const baseKeys   = distributeOutfitCheckShots(count, hasDestino);
    // Agregar shots de close-up de accesorios (van AL FINAL, después del arco base)
    const closeupIndexes = (refs?.accesorioCloseup ?? [])
      .map((v, i) => v ? i : -1).filter(i => i >= 0);
    const allKeys = [...baseKeys, ...closeupIndexes.map(() => 'ACCESSORY_CLOSEUP')];
    return allKeys.map((key, i) => {
      const shot = pool.find(s => s.key === key) ?? pool[pool.length - 1];
      return { ...shot, arcPosition: i + 1, aspectRatio: ar };
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
      purpose: 'Selfie UGC auténtica o portrait íntimo con mood dominante. El ambiente envuelve a la persona. Luz, color y espacio son tan importantes como la cara. Se siente tomada en un momento real, no producida.',
      requiredElements: ['arm_extended_implied_pov', 'shoulder_visible_lower_frame', 'face_dominant_natural', 'handheld_organic_framing', 'no_phone_visible'],
      forbiddenElements: ['phone_visible', 'third_person_portrait_framing', 'professional_lighting', 'symmetric_composition', 'studio_feel', 'beautification'],
      variationSpace: [
        'selfie con fondo de calle o fachada, sonrisa suave y natural',
        'selfie levemente contrapicada, cielo o exterior suave de fondo, expresión alegre',
        'selfie interior, fondo bokeh de café o sala, expresión calmada',
        'selfie con entorno visible parcialmente, expresión espontánea como reacción a algo',
      ],
      framing:     'SELFIE',
      composition: 'HANDHELD_ASYMMETRIC',
      cameraAngle: 'SLIGHT_UPWARD_FROM_HAND_LEVEL',
    },
    {
      key:   'REVEAL_ANGLE',
      beat:  'reveal',
      role:  'REVEAL MOMENT',
      purpose: 'Un ángulo que muestra algo diferente del mismo mundo: espalda de la persona, reflejo en espejo, sombra proyectada, vista desde abajo, overhead del espacio. Un punto de vista que sorprende sin ser artificioso.',
      requiredElements: ['strong_emotional_resonance', 'memorable_composition', 'authentic_mood', 'unexpected_angle_or_perspective'],
      forbiddenElements: ['neutral_generic_pose', 'catalog_composition', 'ad_cta_feel', 'beautification', 'overly_posed'],
      variationSpace: [
        'espalda parcial mirando hacia algo fuera de frame, luz de hora dorada desde el frente',
        'reflejo en espejo con la cámara y el ambiente visible detrás',
        'sombra proyectada de la persona sobre una superficie interesante',
        'overhead del espacio desde arriba — la persona pequeña en el ambiente',
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

// ── Outfit Check shots ────────────────────────────────────────
// Historia: "Elegí este outfit para X ocasión"
// Arco: presentación de prendas → mirror check → detalle → selfie → destino

function buildOutfitCheckShotPool(): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  return [
    {
      key:   'OUTFIT_ARRIVING',
      beat:  'context',
      role:  'OUTFIT PRESENTATION',
      purpose: 'Las prendas se presentan antes de ser usadas. Sin avatar de cuerpo completo. Puede ser: rack con las prendas colgadas, manos sosteniendo cada prenda frente a cámara, flat lay sobre cama o silla, o manos extendiendo la prenda hacia el espejo. El outfit es el protagonista — la persona es el gesto.',
      requiredElements: ['garments_as_subject', 'no_full_body_avatar_walking', 'real_context_visible', 'outfit_clearly_readable'],
      forbiddenElements: ['avatar_walking_toward_camera', 'catalog_mannequin_pose', 'studio_backdrop', 'white_background', 'ad_composition', 'forced_action_pose'],
      variationSpace: [
        'manos sosteniendo la prenda principal extendida frente a cámara, habitación visible de fondo',
        'flat lay orgánico del outfit completo sobre cama, silla o piso — prendas y accesorios dispuestos naturalmente',
        'prendas colgadas en rack o perchero, manos parcialmente visibles acomodándolas, ambiente real de fondo',
        'overhead del outfit extendido sobre superficie — tela, alfombra, madera — con accesorios al costado',
      ],
      framing:     'MEDIUM_OR_OVERHEAD',
      composition: 'GARMENTS_AS_SUBJECT',
      cameraAngle: 'EYE_LEVEL_OR_OVERHEAD',
    },
    {
      key:   'OUTFIT_MIRROR_CHECK',
      beat:  'reveal',
      role:  'MIRROR CHECK',
      purpose: 'Full body del avatar frente al espejo con el outfit completo puesto. El espejo es el encuadre natural. Actitud, no pose. Puede ser selfie de espejo o alguien lo tomó desde atrás. El look completo es visible de pies a cabeza.',
      requiredElements: ['full_body_visible', 'mirror_frame_present_or_implied', 'complete_outfit_readable', 'authentic_attitude_not_catalog_stance'],
      forbiddenElements: ['catalog_symmetrical_pose', 'studio_lighting', 'white_background', 'mannequin_stance', 'beautification', 'phone_visible_in_mirror'],
      variationSpace: [
        'selfie de espejo full body, brazo extendido sosteniendo teléfono fuera de frame, actitud natural',
        'espejo de cuerpo entero con el avatar mirando su reflejo, ángulo lateral que muestra ambiente',
        'avatar frente al espejo, vista desde atrás mostrando el espejo y el outfit reflejado',
        'espejo de dormitorio o probador, avatar de frente con actitud relajada, ambiente visible alrededor',
      ],
      framing:     'WIDE_FULL_BODY',
      composition: 'MIRROR_FRAME_NATURAL',
      cameraAngle: 'EYE_LEVEL',
    },
    {
      key:   'OUTFIT_DETAIL',
      beat:  'detail',
      role:  'OUTFIT DETAIL',
      purpose: 'Close-up de una prenda o accesorio clave del look. Textura, cierre, color, material. Sin cara necesaria. El fragmento cuenta más que el todo. Puede ser la textura de una tela, un detalle de costura, una hebilla, un zapato, una cartera.',
      requiredElements: ['garment_or_accessory_fills_frame', 'texture_or_material_visible', 'real_light_showing_depth', 'intentional_tight_framing'],
      forbiddenElements: ['full_body_visible', 'face_dominant', 'catalog_product_shot', 'white_background', 'studio_lighting', 'forced_branding'],
      variationSpace: [
        'close-up de la textura de la prenda principal — tela, punto, costuras, terminaciones',
        'detalle del accesorio más importante: zapato, cartera, joya — luz lateral que muestra profundidad',
        'manos tocando o acomodando la prenda, detalle del gesto y el tejido',
        'fragmento del look: cintura con cinturón, hombro de una campera, escote con joya — ángulo íntimo',
      ],
      framing:     'CLOSE_UP_OR_EXTREME_CLOSE_UP',
      composition: 'DETAIL_FILL_FRAME',
      cameraAngle: 'TOP_DOWN_OR_MACRO_ANGLE',
    },
    {
      key:   'OUTFIT_READY',
      beat:  'emotion',
      role:  'READY SELFIE',
      purpose: 'Selfie o medium shot con el look puesto. Cara dominante, outfit visible parcialmente. El mood es "lista para salir" o "así salí". Expresión natural y con carácter — no pose de catálogo. Puede ser selfie UGC o foto tomada por otra persona.',
      requiredElements: ['face_dominant_natural', 'outfit_partially_visible', 'authentic_expression_or_mood', 'real_context_visible'],
      forbiddenElements: ['catalog_stance', 'beautification', 'studio_lighting', 'symmetric_ad_composition', 'mannequin_expression', 'phone_visible'],
      variationSpace: [
        'selfie UGC clásica — brazo extendido, cara levemente ladeada, outfit visible en el torso, ambiente de fondo',
        'medium shot tomado por alguien más, cara con actitud, hombros y parte del outfit visibles',
        'selfie contrapicada levemente, cielo o puerta de salida de fondo, expresión de "voy"',
        'close-up de cara con outfit visible en el cuello/hombros, expresión espontánea, ambiente cálido',
      ],
      framing:     'MEDIUM_OR_SELFIE',
      composition: 'FACE_DOMINANT_OUTFIT_VISIBLE',
      cameraAngle: 'SLIGHT_UPWARD_FROM_HAND_LEVEL',
    },
    {
      key:   'OUTFIT_DESTINATION',
      beat:  'atmosphere',
      role:  'DESTINATION SHOT',
      purpose: 'Avatar en el lugar destino con el outfit puesto. Full body integrado al ambiente final. Si hay escena_destino se usa ese lugar. Si no hay, es un segundo ángulo en la escena de prueba. El outfit y el lugar juntos cuentan el cierre de la historia.',
      requiredElements: ['full_body_visible', 'destination_environment_clearly_readable', 'complete_outfit_visible', 'person_belongs_in_space'],
      forbiddenElements: ['catalog_pose', 'studio_backdrop', 'generic_white_wall', 'mannequin_stance', 'beautification', 'ad_feel'],
      variationSpace: [
        'full body en el lugar destino — restaurante, calle, evento — outfit completo visible, actitud natural',
        'avatar apoyada en elemento del ambiente destino, pose con actitud, outfit completo desde la distancia',
        'medium shot en el lugar destino, ambiente claramente reconocible de fondo, cara y outfit visibles',
        'caminando o llegando al lugar, outfit en movimiento, ambiente destino de fondo',
      ],
      framing:     'WIDE_FULL_BODY',
      composition: 'PERSON_IN_DESTINATION_CONTEXT',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHTLY_LOW',
    },
    {
      key:   'ACCESSORY_CLOSEUP',
      beat:  'texture',
      role:  'ACCESSORY HERO',
      purpose: 'Macro o close-up extremo de un accesorio específico marcado por el usuario. El accesorio llena el frame. Luz que muestra su materialidad, textura y diseño. Sin persona necesaria. Este shot existe para destacar ese elemento en particular.',
      requiredElements: ['accessory_fills_frame', 'material_and_texture_clearly_visible', 'real_light_not_studio', 'intentional_macro_framing'],
      forbiddenElements: ['full_body_in_frame', 'catalog_white_background', 'studio_lighting', 'forced_branding', 'multiple_accessories_competing'],
      variationSpace: [
        'macro del accesorio sobre superficie de contraste, sombra lateral que muestra volumen y profundidad',
        'accesorio en mano o siendo sostenido, close-up que muestra diseño y material',
        'accesorio en su lugar de uso natural — puesto, colgando, en el ambiente — close-up',
        'overhead del accesorio sobre tela o superficie orgánica, luz de ventana, ángulo íntimo',
      ],
      framing:     'EXTREME_CLOSE_UP',
      composition: 'ACCESSORY_FILL_FRAME',
      cameraAngle: 'MACRO_OR_LOW_ANGLE',
    },
  ];
}

// Distribuye los shots de outfit_check según el count pedido.
// Los beats obligatorios son: ARRIVING → MIRROR_CHECK → DETAIL → READY → DESTINATION
// Si count < 5, se eliminan en este orden: DETAIL, READY (el arco mínimo es ARRIVING + MIRROR + DESTINATION)
// Los shots de ACCESSORY_CLOSEUP se agregan SOBRE el count (no reemplazan).
function distributeOutfitCheckShots(count: number, hasDestino: boolean): string[] {
  const fullArc = [
    'OUTFIT_ARRIVING',
    'OUTFIT_MIRROR_CHECK',
    'OUTFIT_DETAIL',
    'OUTFIT_READY',
    'OUTFIT_DESTINATION',
  ];
  // Si no hay escena_destino, el último shot es un segundo MIRROR_CHECK desde otro ángulo
  const arc = hasDestino ? fullArc : [...fullArc.slice(0, 4), 'OUTFIT_MIRROR_CHECK'];
  if (count >= 5) return arc;
  if (count === 4) return arc.filter(k => k !== 'OUTFIT_READY');
  if (count === 3) return ['OUTFIT_ARRIVING', 'OUTFIT_MIRROR_CHECK', 'OUTFIT_DESTINATION'];
  return ['OUTFIT_ARRIVING', 'OUTFIT_MIRROR_CHECK', 'OUTFIT_DESTINATION'];
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
): Promise<PhotodumpSessionPlan> {
  initPhotodumpIntelligence();
  const shots          = buildStoryDirectives(6, protagonist, destino, narrative, recipe, refs);
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

  const outfitRecipeDesc: Record<string, string> = {
    outfit_check: `SHOT: Full body of the person with the COMPLETE OUTFIT on, in the try-on space (room, mirror, fitting room).
Full body visible — the look must be readable from head to toe. Face visible, natural expression.
Real environment — natural light from a window, real walls, real floor. NOT a studio. NOT a catalog.
iPhone photo quality. This establishes: the person's identity, the outfit, and the visual world for the set.`,
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

  const prompt = `${LOCK_SYSTEM}

${PARADIGM_RULE}

${modeBlock}

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

  const imageUrl = await imageApiService.generateImage({
    prompt,
    negative:        NEGATIVE_FULL,
    referenceImages: await prepareRefs(refsToPass),
    aspectRatio:     getAspectRatio(destino),
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

  return { imageUrl, ref0Analysis };
}

// ── Generación de shots narrativos ───────────────────────────

function injectREF0Analysis(ref0Analysis: any): string {
  if (!ref0Analysis) return '';
  try {
    const l = ref0Analysis.lighting ?? {};
    const s = ref0Analysis.spatial  ?? {};
    return `
🔒 REF0 ANALYSIS LOCK (freeze these — do NOT change):
- Lighting: ${l.primarySource ?? 'natural'}, ${l.direction ?? 'ambient'}, ${l.colorTemperature ?? 'warm'}, ${l.shadowType ?? 'soft'}
- Environment: ${(s.elements ?? []).join(', ') || 'real scene'}, ${s.geometry ?? 'interior'}
- Color temperature: SAME as REF0 — do NOT shift warm/cool
- Skin tone rendering: SAME as REF0 — do NOT lighten or darken
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

export async function generatePhotodumpShot(
  shot:             PhotodumpShotDirective,
  refs:             PhotodumpRefs,
  ref0Url:          string,
  ref0Analysis:     any,
  basePrompt:       string,
  narrative:        PhotodumpNarrative,
  destino:          PhotodumpDestino,
  sessionParams:    { uid?: string; sessionId?: string },
  assignedFamilies: StorySupportFamily[] = [],
  sessionFamilies:  SessionFamilies = { storySupport: [], creatorAesthetic: [] },
  totalShots:       number = 4,
  protagonist:      PhotodumpProtagonist = 'person',
  recipe?:          string,
): Promise<string> {

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

  // HPI: inyectar solo en shots con avatar (no faceless, no shots de objeto puro)
  const hpiEligible = !isFacelessShot
    && !!refs.avatarRef
    && shot.key !== 'HAUL_INTRO'
    && shot.key !== 'OUTFIT_ARRIVING'
    && shot.key !== 'ACCESSORY_CLOSEUP'
    && shot.key !== 'UNBOXING_PACKAGING_CLOSED'
    && shot.key !== 'UNBOXING_PRODUCT_REVEAL'
    && shot.key !== 'UNBOXING_PRODUCT_DETAIL'
    && shot.key !== 'UNBOXING_ATMOSPHERE';
  const hpiBlock = hpiEligible
    ? buildHpiBlock({
        enabled:            true,
        gender:             refs.gender ?? 'female',
        modoVisual:         'ugc',
        includeGesture:     true,
        includePerformance: shot.beat === 'emotion' || shot.beat === 'candid',
      })
    : '';

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

  const prompt = `${LOCK_SYSTEM}

${PARADIGM_RULE}

${shotModeBlock}

${injectREF0Analysis(ref0Analysis)}

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

  return imageApiService.generateImage({
    prompt,
    negative:        NEGATIVE_SHORT,
    referenceImages: await prepareRefs(refsToPass),
    aspectRatio:     getAspectRatio(destino),
    uid:             sessionParams.uid,
    sessionId:       sessionParams.sessionId,
    module:          'photodump',
    moduleLabel:     'Photodump Mode',
    shotIndex:       shot.arcPosition,
    totalShots:      6,
    metadata:        { role: shot.role, beat: shot.beat, narrative },
  });
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
