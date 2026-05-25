/**
 * photodumpDirectorService.ts
 * Director visual para Photodump Mode.
 * Arquitectura idéntica a UGC Studio (REF0, LOCK_SYSTEM, shot directives con forbidden elements)
 * pero orientada a storytelling orgánico en lugar de anuncios.
 *
 * UGC Studio  → Sesión fotográfica para ads (6 shots técnicos fijos)
 * Photodump   → Historia visual narrativa (N shots con arco: hook → development → closing)
 */
import { ugcApiService } from '../../services/ugcApiService';
import { imageApiService } from '../../services/imageApiService';
import { geminiService } from '../../services/geminiService';
import {
  PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
  PhotodumpRefs, NARRATIVE_META,
} from './types';
import {
  getStorySupportFamilies, initPhotodumpIntelligence, StorySupportFamily,
} from './photodumpIntelligence';

// ── Tipos ─────────────────────────────────────────────────────

export type StoryBeat = 'hook' | 'development' | 'closing';

export interface PhotodumpShotDirective {
  key:              string;          // 'S1' … 'S6'
  beat:             StoryBeat;
  role:             string;          // HOOK | DEVELOPMENT | CLOSING
  purpose:          string;          // descripción para el prompt Gemini
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
📖 MODE DOMINANCE: PHOTODUMP — ORGANIC STORY MODE

IDENTITY: This is a real person's Instagram photodump / carousel.
Think "my day", "how it went", "a moment I wanted to share".
The set tells a story. Each image is a chapter.
The person is the protagonist — not a model, not a brand ambassador.

CRITICAL RULES:
- NO commercial feel. NO ad composition. NO product placement vibe.
- Every shot must feel CANDID, LIVED-IN, AUTHENTIC.
- The person has a LIFE in these photos — they are not posing FOR a camera,
  they are being captured BY a camera that happens to be nearby.
- VARIETY IS MANDATORY: each shot must have a different framing, angle, and emotional tone.
- The set as a whole tells a coherent visual story with a beginning, middle, and end.

ANTI-AD RULES (NON-NEGOTIABLE):
- No product-first compositions (even if a product is present).
- No "look at the camera holding the product" shots unless it's the closing shot.
- No symmetric centered compositions that feel composed for a brand.
- No studio or controlled lighting feel.
- No text overlays, no logo placement, no brand color dominance.

WHAT MAKES A GREAT PHOTODUMP:
- First image stops the scroll — unusual angle, strong emotion, or beautiful moment.
- Middle images draw you into the world — details, textures, candid moments, context.
- Last image makes you save or share — a feeling, a mood, an emotion that lands.
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

function prepareRefs(refs: (string | null | undefined)[]): Array<{ data: string; mimeType: string }> {
  return refs.map(r => extractImageData(r)).filter(Boolean) as Array<{ data: string; mimeType: string }>;
}

function getAspectInstruction(destino: PhotodumpDestino): string {
  if (destino === 'feed')    return 'Compose for 4:5 portrait (Instagram feed). Subject fills 70-80% of frame.';
  if (destino === 'stories') return 'Compose for 9:16 full vertical (Stories/TikTok). Centered with breathing room top/bottom.';
  return 'Compose for 9:16 full vertical (TikTok). Bold framing, strong visual impact.';
}

// ── Shot Directives narrativos ────────────────────────────────

function buildStoryDirectives(
  count:       number,
  protagonist: PhotodumpProtagonist,
  destino:     PhotodumpDestino,
  narrative:   PhotodumpNarrative,
): PhotodumpShotDirective[] {

  const ar = destino === 'feed' ? '4/5' : '9/16';

  // Pool de shots disponibles según el protagonista
  const allShots: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] = protagonist === 'product'
    ? buildProductStoryShots()
    : buildPersonStoryShots();

  // Distribuir en arco narrativo
  const beats = distributeBeat(count);

  return beats.map((beat, i) => {
    // Asignar el shot más apropiado para este beat
    const pool = allShots.filter(s =>
      beat === 'hook'        ? s.beat === 'hook' :
      beat === 'closing'     ? s.beat === 'closing' :
      s.beat === 'development'
    );
    const shot = pool[i % pool.length] ?? allShots[i % allShots.length];
    return { ...shot, beat, arcPosition: i + 1, aspectRatio: ar };
  });
}

function distributeBeat(count: number): StoryBeat[] {
  if (count === 3) return ['hook', 'development', 'closing'];
  if (count === 4) return ['hook', 'development', 'development', 'closing'];
  if (count === 5) return ['hook', 'development', 'development', 'development', 'closing'];
  return ['hook', 'development', 'development', 'development', 'development', 'closing'];
}

// ── Person story shots ────────────────────────────────────────

function buildPersonStoryShots(): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  return [
    {
      key:   'HOOK_SCROLL_STOP',
      beat:  'hook',
      role:  'HOOK',
      purpose: 'La primera imagen que para el scroll. Ángulo o encuadre inesperado, emoción fuerte, o momento visualmente poderoso. El espectador no puede no detenerse. Medium shot o close-up, cara dominante, expresión con carácter.',
      requiredElements: ['face_dominant_or_striking_angle', 'strong_emotion_or_mood', 'unexpected_composition', 'authentic_not_posed'],
      forbiddenElements: ['symmetric_catalog_pose', 'neutral_expression', 'ad_composition', 'product_forward', 'studio_feel', 'beautification', 'mannequin_stance'],
      variationSpace: [
        'close-up ladeado desde abajo, cara mirando hacia arriba y al frente, expresión segura, luz lateral',
        'medium shot desde arriba, persona mirando hacia el costado, pelo moviéndose, fondo desenfocado',
        'close-up de tres cuartos con fondo de colores, expresión intensa o risas, luz natural dura',
        'encuadre apretado desde costado, cara en perfil mirando a cámara al último momento, ambiente urbano',
      ],
      framing:     'MEDIUM_OR_CLOSE_UP',
      composition: 'ASYMMETRIC_OR_UNEXPECTED',
      cameraAngle: 'LOW_ANGLE_OR_EYE_LEVEL',
    },
    {
      key:   'DEV_CANDID_MOMENT',
      beat:  'development',
      role:  'DEVELOPMENT',
      purpose: 'Momento candidato real. La persona no "posa" — está haciendo algo: tomando algo, mirando lejos, acomodándose el cabello, riendo con alguien fuera de frame. Foto tomada por un amigo cercano, no por un fotógrafo. Medium shot.',
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
      key:   'DEV_SELFIE_AUTHENTIC',
      beat:  'development',
      role:  'DEVELOPMENT',
      purpose: 'Selfie UGC auténtica — POV brazo extendido, hombro visible abajo del frame, cara cercana y ligeramente asimétrica. SIN teléfono visible. Luz natural. Se siente tomada en el momento, no producida.',
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
      key:   'DEV_LIFESTYLE_CONTEXT',
      beat:  'development',
      role:  'DEVELOPMENT',
      purpose: 'Full body integrado al ambiente. La persona pertenece al lugar — no está posando ANTE el lugar. Pose con actitud: apoyada, sentada, caminando lento. El ambiente es visible y cuenta algo de la historia.',
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
      key:   'DEV_DETAIL_TEXTURE',
      beat:  'development',
      role:  'DEVELOPMENT',
      purpose: 'Detail shot orgánico. Un elemento del frame — un detalle de la ropa, la textura de un material, las manos con algo, o un elemento del ambiente — contado como fragmento de la historia. Sin cara necesaria.',
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
      key:   'CLOSING_EMOTIONAL',
      beat:  'closing',
      role:  'CLOSING',
      purpose: 'La imagen que cierra la historia y genera acción — save, share, visita al perfil. Una emoción que queda, un momento que resume todo el set. Puede ser un close-up íntimo, una wide shot atmosférica, o una expresión que conecta directamente con quien mira.',
      requiredElements: ['strong_emotional_resonance', 'memorable_composition', 'authentic_mood', 'story_feels_complete'],
      forbiddenElements: ['neutral_generic_ending', 'catalog_final_shot', 'product_forward_close', 'ad_cta_feel', 'beautification', 'overly_posed'],
      variationSpace: [
        'close-up íntimo mirando a cámara, expresión suave y segura, como un último momento',
        'wide shot atmosférica — persona pequeña en el ambiente, luz de hora dorada o azul',
        'medium shot de espalda parcial mirando hacia algo fuera de frame, sensación de continuidad',
        'close-up de expresión de alegría genuina o risa compartida, ojos cálidos, último frame que queda en la memoria',
      ],
      framing:     'CLOSE_UP_OR_WIDE_ATMOSPHERIC',
      composition: 'EMOTIONALLY_DRIVEN',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHTLY_HIGH',
    },
  ];
}

// ── Product story shots ────────────────────────────────────────

function buildProductStoryShots(): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  return [
    {
      key:   'HOOK_PRODUCT_STAR',
      beat:  'hook',
      role:  'HOOK',
      purpose: 'El producto como protagonista del primer frame. No un shot de catálogo — un momento en que el producto aparece en su contexto real de vida. Ángulo o luz que lo hace visualmente imposible de ignorar.',
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
      key:   'DEV_PRODUCT_IN_USE',
      beat:  'development',
      role:  'DEVELOPMENT',
      purpose: 'El producto siendo usado de forma real y natural. Manos activas, contexto de uso visible. No una demostración — un momento genuino de alguien usándolo.',
      requiredElements: ['hands_using_product_naturally', 'product_clearly_visible', 'context_of_use_real', 'action_has_intention'],
      forbiddenElements: ['static_product_display', 'forced_demonstration', 'studio_feel', 'ad_composition', 'product_floating'],
      variationSpace: [
        'manos aplicando, sosteniendo o usando el producto, gesto natural y cotidiano',
        'producto en su contexto de uso — cocina, baño, mesa, cartera',
        'overhead de la acción de usar el producto, manos visibles desde arriba',
        'medium shot de alguien con el producto en un momento casual real',
      ],
      framing:     'MEDIUM',
      composition: 'HANDS_AND_PRODUCT',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHT_OVERHEAD',
    },
    {
      key:   'DEV_PRODUCT_TEXTURE',
      beat:  'development',
      role:  'DEVELOPMENT',
      purpose: 'El detalle que enamora. Textura, materialidad, packaging, color. Un close-up que hace que quien mira quiera tocarlo.',
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
      key:   'DEV_PRODUCT_LIFESTYLE',
      beat:  'development',
      role:  'DEVELOPMENT',
      purpose: 'El producto integrado al lifestyle — no siendo demostrado, sino viviendo en el mundo real. Forma parte de la escena como un elemento más, no como el foco de una ad.',
      requiredElements: ['product_in_natural_scene', 'lifestyle_context_visible', 'product_not_highlighted_artificially'],
      forbiddenElements: ['product_isolated', 'ad_spotlight_on_product', 'catalog_background', 'forced_product_placement'],
      variationSpace: [
        'producto en la mesa con otros objetos del día, integrado naturalmente',
        'producto parcialmente visible en el contexto — asomándose de una cartera o sobre una silla',
        'wide del espacio con el producto como elemento de la escena',
        'overhead del flat lay del día — el producto como parte del mundo, no el centro',
      ],
      framing:     'WIDE_OR_MEDIUM',
      composition: 'PRODUCT_AS_ELEMENT_IN_SCENE',
      cameraAngle: 'OVERHEAD_OR_EYE_LEVEL',
    },
    {
      key:   'DEV_PRODUCT_OVERHEAD',
      beat:  'development',
      role:  'DEVELOPMENT',
      purpose: 'Overhead shot — flat lay orgánico. El producto con objetos que cuentan su mundo. No forzado ni simétrico — como si lo pusieran ahí de verdad.',
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
      key:   'CLOSING_PRODUCT_EMOTIONAL',
      beat:  'closing',
      role:  'CLOSING',
      purpose: 'El cierre de la historia del producto. Una imagen que hace que quien mira quiera tenerlo — no por ser un ad, sino por cómo encaja en una vida real que parece aspiracional.',
      requiredElements: ['product_visible', 'emotional_or_aesthetic_resonance', 'real_context', 'memorable_composition'],
      forbiddenElements: ['cta_feel', 'ad_ending', 'price_tag_or_text', 'white_background', 'studio'],
      variationSpace: [
        'producto sostenido o cerca de la persona en un momento de luz dorada',
        'producto en su lugar natural — estante, mesa de noche, tocador — con luz ambiental',
        'close-up íntimo del producto como cierre meditativo — el objeto como símbolo',
        'medium shot del producto con ambiente cálido que evoca el estilo de vida que representa',
      ],
      framing:     'MEDIUM_OR_CLOSE_UP',
      composition: 'EMOTIONALLY_DRIVEN',
      cameraAngle: 'EYE_LEVEL_OR_SLIGHT_LOW',
    },
  ];
}

// ── Generación del plan ───────────────────────────────────────

export async function buildPhotodumpSessionPlan(
  narrative:   PhotodumpNarrative,
  protagonist: PhotodumpProtagonist,
  destino:     PhotodumpDestino,
  basePrompt:  string,
): Promise<PhotodumpSessionPlan> {
  initPhotodumpIntelligence();
  const shots          = buildStoryDirectives(6, protagonist, destino, narrative);
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

export async function generatePhotodumpREF0(
  refs:        PhotodumpRefs,
  narrative:   PhotodumpNarrative,
  protagonist: PhotodumpProtagonist,
  destino:     PhotodumpDestino,
  basePrompt:  string,
  sessionParams: { uid?: string; sessionId?: string },
): Promise<PhotodumpREF0Result> {

  const aspectInstr = getAspectInstruction(destino);
  const narrativeCtx = NARRATIVE_META[narrative].label;

  // Referencia principal del protagonista
  const mainRef = refs.avatarRef ?? refs.productRef ?? refs.outfitRef ?? refs.sceneRef;
  if (!mainRef) throw new Error('Se necesita al menos una referencia para generar el ancla visual.');

  const outfitMode = refs.outfitMode ?? 'generate';

  // ── Construir lista de referencias ───────────────────────────
  // Avatar: cara x3 (identidad dominante) + cuerpo x1 (complexión secundaria)
  const refsToPass: (string | null)[] = [];
  if (refs.avatarRef) {
    refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
  }
  if (refs.bodyRef) {
    refsToPass.push(refs.bodyRef);
  }
  // Outfit: solo cuando el usuario cargó uno explícitamente
  if (outfitMode === 'upload' && refs.outfitRef) refsToPass.push(refs.outfitRef);
  // Producto: referencia principal + ángulos adicionales
  if (refs.productRef) refsToPass.push(refs.productRef);
  const extraProducts = (refs.productRefs ?? []).filter(Boolean) as string[];
  extraProducts.forEach(r => refsToPass.push(r));
  // Escena: siempre la escena principal en REF0
  if (refs.sceneRef) refsToPass.push(refs.sceneRef);

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

  const prompt = `${LOCK_SYSTEM}

${PARADIGM_RULE}

${STORY_MODE_DOMINANCE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 REF0 — VISUAL ANCHOR SHOT

STORY CONTEXT: "${basePrompt}"
NARRATIVE: ${narrativeCtx}
FORMAT: ${aspectInstr}

This is the ANCHOR image — it defines the visual world for the entire story set.
It must establish: color temperature, lighting quality, environment feel, and protagonist identity.

${protagonist === 'product'
  ? 'PROTAGONIST: The PRODUCT is the hero. Show it in its natural context with real, atmospheric lighting.'
  : protagonist === 'person'
    ? 'PROTAGONIST: The PERSON is the hero. Natural medium shot, authentic expression, real environment.'
    : 'PROTAGONIST: The PERSON and PRODUCT together. Natural interaction, real context.'
}

SHOT: Natural medium shot (waist-up or 3/4 body). Authentic, candid, story-opening feel.
iPhone photo quality — handheld, natural light, real skin texture, no studio polish.
The person looks like they are living their life — not posing for a photographer.
Environment is real, light is natural or ambient, mood is aspirational but authentic.

IDENTITY: Copy the face, hair, skin tone, and physical features EXACTLY from the face reference images.
${bodyInstruction}
${outfitInstruction}
${productInstruction}

Natural iPhone quality. UGC feel. One photo. Not a collage. Not a grid.

${NEGATIVE_FULL}`;

  const imageUrl = await imageApiService.generateImage({
    prompt,
    negative:        NEGATIVE_FULL,
    referenceImages: prepareRefs(refsToPass),
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

// Elige la familia narrativa más apropiada para un beat concreto.
// hook → story_opener / world_building
// Asigna familia por posición en el arco narrativo con criterio de tono coherente.
//
// Reglas de tono:
//   hook      → story_support con 'story_opener' o 'world_building'
//   closing   → story_support con 'mood_frame' o 'transition_frame'
//   detail shots (DEV_DETAIL_TEXTURE, DEV_PRODUCT_OVERHEAD, DEV_PRODUCT_TEXTURE)
//             → creator_aesthetic primero (composición más curada encaja bien)
//   development resto → story_support rotando por índice (nunca la misma dos veces seguidas)
//
// La rotación es por índice global del shot (shotIndex), no por contador interno,
// para que sea determinista y predecible en cada sesión.
function pickFamilyForShot(
  beat:     StoryBeat,
  shotKey:  string,
  shotIndex: number,
  sessionFamilies: SessionFamilies,
): StorySupportFamily | null {
  const { storySupport, creatorAesthetic } = sessionFamilies;
  if (storySupport.length === 0 && creatorAesthetic.length === 0) return null;

  // Shots de detalle: preferir creator_aesthetic si está disponible
  const isDetailShot = [
    'DEV_DETAIL_TEXTURE',
    'DEV_PRODUCT_OVERHEAD',
    'DEV_PRODUCT_TEXTURE',
  ].includes(shotKey);

  if (isDetailShot && creatorAesthetic.length > 0) {
    return creatorAesthetic[shotIndex % creatorAesthetic.length];
  }

  // Hook: buscar familia con posición story_opener o world_building
  if (beat === 'hook') {
    const match = storySupport.find(f =>
      f.storyFamilyValue?.recommendedSequencePositions?.some(
        p => ['story_opener', 'world_building'].includes(p)
      )
    );
    return match ?? storySupport[0] ?? creatorAesthetic[0] ?? null;
  }

  // Closing: buscar familia con posición mood_frame o transition_frame
  if (beat === 'closing') {
    const match = storySupport.find(f =>
      f.storyFamilyValue?.recommendedSequencePositions?.some(
        p => ['mood_frame', 'transition_frame', 'context_frame'].includes(p)
      )
    );
    return match ?? storySupport[storySupport.length - 1] ?? storySupport[0] ?? null;
  }

  // Development: rotar story_support por índice del shot para evitar repetición consecutiva
  if (storySupport.length > 0) {
    return storySupport[shotIndex % storySupport.length];
  }

  // Fallback: cualquier familia disponible
  return creatorAesthetic[0] ?? null;
}

// Construye el bloque de texto que se inyecta en el prompt con la inteligencia
// narrativa de la familia seleccionada. Solo incluye lo que aporta valor real.
function buildFamilyInjectBlock(family: StorySupportFamily): string {
  const lines: string[] = [
    '─────────────────────────────────────────────────────',
    '🎨 VISUAL FAMILY INTELLIGENCE (narrative guide):',
  ];
  if (family.storyDirective)
    lines.push(`  Narrative role: ${family.storyDirective}`);
  if (family.narrativeBehavior)
    lines.push(`  Visual behavior: ${family.narrativeBehavior}`);
  if (family.compositionPattern) {
    const c = family.compositionPattern;
    if (c.preferredShotType)  lines.push(`  Shot type: ${c.preferredShotType}`);
    if (c.preferredLighting)  lines.push(`  Lighting: ${c.preferredLighting} (${c.lightQuality})`);
    if (c.visualRhythm)       lines.push(`  Rhythm: ${c.visualRhythm}`);
  }
  if (family.psychologicalMechanisms.length > 0)
    lines.push(`  Emotional triggers: ${family.psychologicalMechanisms.slice(0, 3).join(', ')}`);
  if (family.promptBlock)
    lines.push(`  Visual reference: ${family.promptBlock}`);
  const exampleLabels = family.subfamilies.slice(0, 3).map(s => s.label).filter(Boolean);
  if (exampleLabels.length > 0)
    lines.push(`  Real shot examples: ${exampleLabels.join(', ')}`);
  lines.push('  Use this as creative direction — NOT as literal instruction.');
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
): Promise<string> {

  const aspectInstr = getAspectInstruction(destino);

  const outfitMode = refs.outfitMode ?? 'generate';

  // ── Construir lista de referencias por shot ───────────────────
  // Cara x2 (identidad) + cuerpo x1 + REF0 (ancla visual) + outfit + producto(s) + escena asignada
  const refsToPass: string[] = [];
  if (refs.avatarRef) refsToPass.push(refs.avatarRef, refs.avatarRef, refs.avatarRef);
  if (refs.bodyRef)   refsToPass.push(refs.bodyRef);
  refsToPass.push(ref0Url);
  if (outfitMode === 'upload' && refs.outfitRef) refsToPass.push(refs.outfitRef);
  if (refs.productRef) refsToPass.push(refs.productRef);
  const extraProducts = (refs.productRefs ?? []).filter(Boolean) as string[];
  extraProducts.forEach(r => refsToPass.push(r));
  // Escena: asignar según posición en el arco (0-indexed)
  const sceneForShot = getSceneRefForShot(refs, shot.arcPosition - 1, totalShots);
  if (sceneForShot) refsToPass.push(sceneForShot);

  const beatLabel =
    shot.beat === 'hook'        ? '🎣 HOOK — Para el scroll. La primera imagen de la historia.' :
    shot.beat === 'closing'     ? '✨ CLOSING — Cierre emocional. La imagen que queda.' :
                                  '📖 DEVELOPMENT — Desarrollo de la historia.';

  const selectedFamily = pickFamilyForShot(
    shot.beat, shot.key, shot.arcPosition - 1, sessionFamilies,
  );
  const familyBlock = selectedFamily ? buildFamilyInjectBlock(selectedFamily) : '';

  const prompt = `${LOCK_SYSTEM}

${PARADIGM_RULE}

${STORY_MODE_DOMINANCE}

${injectREF0Analysis(ref0Analysis)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 SHOT ${shot.arcPosition} of the story · ${beatLabel}

STORY CONTEXT: "${basePrompt}"
NARRATIVE: ${NARRATIVE_META[narrative].label}
FORMAT: ${aspectInstr}

${familyBlock}

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

SHOT IDENTITY:
- Face reference (appears multiple times): EXACT identity, same bone structure, same hair, same skin tone.
${refs.bodyRef ? '- Body reference: establishes physique (build, proportions). Do NOT make the person heavier or slimmer than shown.' : ''}
- REF0 (after face/body refs): establishes the visual world — same light, same scene, same color temp.
${buildOutfitLockBlock(outfitMode, basePrompt, !!refs.outfitRef)}
${extraProducts.length > 0 ? `PRODUCT MULTI-ANGLE: Multiple product references show the same object from different angles. Use all of them to reproduce it faithfully.` : ''}
${sceneForShot !== refs.sceneRef ? `SCENE NOTE: This shot uses an alternate scene reference (position ${shot.arcPosition} of ${totalShots} in the story arc). Integrate the person naturally into this new environment — same person, new setting.` : ''}
- This shot is part of a STORY — it must connect to the same narrative world established in REF0.

📱 iPhone UGC REALISM (NON-NEGOTIABLE):
You are taking a new iPhone-style photo inside the same existing moment as REF0.
Natural light, handheld imperfection, real skin texture, no studio polish.
The result must look like someone captured this moment on their phone — not a photographer.
Organic, imperfect, lived-in. NOT editorial. NOT advertising. NOT staged.

🚫 ONE SINGLE IMAGE:
Generate ONE photo. No collage. No grid. No side by side. No reference board.
Do NOT paste reference images into the output. Use them only as visual constraints.

${NEGATIVE_SHORT}`;

  return imageApiService.generateImage({
    prompt,
    negative:        NEGATIVE_SHORT,
    referenceImages: prepareRefs(refsToPass),
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

export async function generatePhotodumpCaptions(
  basePrompt:  string,
  narrative:   PhotodumpNarrative,
  shots:       PhotodumpShotDirective[],
): Promise<Array<{ caption: string; hashtags: string; moment: string }>> {

  const storyContext = NARRATIVE_META[narrative].label;
  const beatDescriptions = shots.map((s, i) =>
    `Image ${i + 1} [${s.beat.toUpperCase()}]: ${s.purpose.slice(0, 80)}`
  ).join('\n');

  const prompt = `You are a social media copywriter for a Spanish-speaking content creator.
Generate captions and hashtags for a ${shots.length}-image photodump carousel.

STORY CONTEXT: "${basePrompt}"
NARRATIVE: ${storyContext}

STORY STRUCTURE:
${beatDescriptions}

For each image provide:
1. "moment": story beat name in Spanish (3-5 words)
2. "caption": engaging caption in Spanish (max 140 chars, conversational, authentic voice, 1-2 emojis — sounds like a REAL person, NOT a brand)
3. "hashtags": 5-7 hashtags mix Spanish/English as single string

Rules:
- Captions must sound like someone talking to a friend, not writing an ad
- The set of captions should feel like chapters of the same story
- Vary the tone: some intimate, some energetic, some reflective

Output ONLY valid JSON array:
[{"moment":"...","caption":"...","hashtags":"..."}]`;

  try {
    const raw = await geminiService.generateText(prompt);
    const match = raw.replace(/```json|```/g, '').trim().match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, shots.length).map((c: any, i: number) => ({
          moment:   c.moment   ?? `Momento ${i + 1}`,
          caption:  c.caption  ?? '',
          hashtags: c.hashtags ?? '',
        }));
      }
    }
  } catch (err) {
    console.warn('[photodumpDirector] generateCaptions failed:', err);
  }

  // Fallback
  return shots.map((s, i) => ({
    moment:   s.beat === 'hook' ? 'La apertura' : s.beat === 'closing' ? 'El cierre' : `Momento ${i + 1}`,
    caption:  s.beat === 'hook' ? 'Así empieza ☀️' : s.beat === 'closing' ? 'Hasta la próxima 🌅' : 'Momentos así 💫',
    hashtags: '#lifestyle #organic #ugc #content #moments',
  }));
}

// ── Helper de UI ──────────────────────────────────────────────

export function getRefsAsArray(refs: PhotodumpRefs): string[] {
  return [refs.avatarRef, refs.productRef, refs.outfitRef, refs.sceneRef].filter(Boolean) as string[];
}
