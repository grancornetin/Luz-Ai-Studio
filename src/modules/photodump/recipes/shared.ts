/**
 * recipes/shared.ts
 * Núcleo REALMENTE compartido de photodumpDirectorService.ts — Fase 1 de extracción.
 *
 * Contiene tipos, constantes de bloques de prompt globales, y helpers puros que
 * se usan en TODAS o CASI TODAS las recetas de Photodump (unboxing, outfit_check,
 * outfit_haul, outfit_week, day_in_life/launch/bts/travel).
 *
 * Código movido tal cual desde photodumpDirectorService.ts — sin reescribir lógica.
 * Ver reporte de la Fase 1 para el detalle de qué se movió y qué se dejó, y por qué.
 */
import { compressImageForUpload } from '../../../utils/imageUtils';
import {
  PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
  WearState, CameraMode,
  OutfitItemPlan, SceneLockPolicy,
  OutfitComposition, InferredDestination,
  PoseIntent, EnvironmentAffordance, SceneContinuityMode,
} from '../types';
import { StorySupportFamily } from '../photodumpIntelligence';

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
  detailKind?:               import('../types').DetailKind;
  continuityMode?:           SceneContinuityMode;
  environmentAffordances?:   EnvironmentAffordance[];
  closureReason?:            string;
  // Haul: plan de ítems por shot — qué aparece, se sostiene, está prohibido
  haulItemPlan?:             import('../types').HaulShotItemPlan;
  // Weekly edit: plan de rol narrativo + routing de ítems por shot
  weeklyItemPlan?:           import('../types').WeeklyShotPlan;
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
  // SessionFamilies vive en photodumpDirectorService.ts (no forma parte del índice mapeado de fase 1).
  // Import de tipo inline para evitar un import físico circular shared.ts <-> photodumpDirectorService.ts.
  sessionFamilies:      import('../photodumpDirectorService').SessionFamilies;  // Separadas por clase para asignación ordenada
  presentationStyle?:   OutfitPresentationStyle; // Solo presente en recetas outfit
}

export interface PhotodumpREF0Result {
  imageUrl:    string;
  ref0Analysis: any;
  prompt:      string;
  refsCount:   number;
}

// ── Sistema de prompts (copiado y adaptado de UGC Studio) ─────

export const NEGATIVE_FULL = `
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

export const NEGATIVE_SHORT = `
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

export const LOCK_SYSTEM = `
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

export const PARADIGM_RULE = `
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

export const STORY_MODE_DOMINANCE = `
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

export const STORY_MODE_FACELESS = `
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

// ── Global Stability Blocks (patch v5) ───────────────────────
//
// Seis bloques de texto reutilizables que se inyectan en TODOS los shots
// de todas las recetas visuales. Son reglas universales, no parches por receta.
// Están diseñados para coexistir con LOCK_SYSTEM y NEGATIVE_SHORT sin
// duplicar instrucciones — cada bloque cubre un dominio distinto.

// 1. SCENE FINGERPRINT LOCK — Continuidad del mundo visual entre shots
export const GLOBAL_SCENE_LOCK = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 SCENE FINGERPRINT LOCK (BINDING — ALL SHOTS):

The physical world established by REF0 is the ONLY permitted environment for this session.

ARCHITECTURE IS FROZEN — these elements must NOT change between shots:
  • Same room type (bedroom, studio, living room, etc.)
  • Same walls — color, texture, paint, panels
  • Same floor material — same tiles, wood, carpet, or surface
  • Same window position — same side, same size, same light direction
  • Same ceiling height impression
  • Same dominant furniture arrangement — do NOT move large pieces between shots

LARGE PROPS — inventory from REF0 only:
  • Beds, sofas, and chairs: same count, same position. Do NOT add a second bed or second sofa.
  • Racks: allowed ONLY if REF0 shows a rack. Do NOT invent a rack.
  • Full-length mirrors: allowed ONLY if REF0 shows a mirror. Do NOT invent a mirror.
  • Desks, tables: only if present in REF0.
  • Do NOT add office furniture, store shelving, lobbies, or commercial environments.

SMALL PROPS — controlled evolution:
  • Small items (cups, books, candles) may appear or disappear naturally between shots.
  • Maximum 1–3 small neutral props per shot unless the shot role explicitly requires more.
  • Clothing from the uploaded item set may move around naturally.

STRICT PROHIBITIONS (all shots, no exceptions):
  ❌ Do NOT invent a new room or new architectural space.
  ❌ Do NOT add a second bed that wasn't in REF0.
  ❌ Do NOT add a full-length mirror that wasn't in REF0.
  ❌ Do NOT add a clothing rack that wasn't in REF0.
  ❌ Do NOT add office, coworking, lobby, store, or street elements.
  ❌ Do NOT change the wall color or architecture between shots.
  ❌ Do NOT redesign the room to look bigger, cleaner, or more aspirational.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// 2. AVATAR BASE CLOTHING SUPPRESSION — Ropa del avatar nunca es contenido
export const GLOBAL_AVATAR_SUPPRESSION = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 AVATAR BASE CLOTHING SUPPRESSION (GLOBAL RULE — ALL SHOTS):

The avatar/body/identity reference images are IDENTITY ANCHORS ONLY.
Their purpose: face, skin tone, hair, bone structure, body proportions.

THE CLOTHING VISIBLE ON AVATAR OR BODY REFERENCES IS NOT A CONTENT ITEM:
  • Any bodysuit, catsuit, base shirt, base jeans, tights, or base garment on the avatar reference is identity context — NOT a weekly outfit, haul item, or styling option.
  • Do NOT use avatar base clothing as a fallback when no primary garment is assigned.
  • Do NOT let avatar base clothing become the dominant wardrobe in any story shot.
  • Do NOT recolor, restyle, or present avatar base clothing as a new look.
  • REF0 clothing is also NOT a wardrobe item — use REF0 only for room, light, and environment.

WHEN A PRIMARY SLOT ITEM IS ASSIGNED:
  • The person MUST wear the assigned slot item — not the avatar's base clothes.
  • The slot reference fully controls the wardrobe. Avatar base clothing is invisible.

WHEN NO PRIMARY SLOT ITEM IS ASSIGNED (overview, detail, or no-person shot):
  • Do NOT fall back to avatar base clothing as a fashion statement.
  • Use a simple neutral base (plain fitted top + simple pants/shorts) invented by the system,
    OR show hands only, OR show a flatlay/product shot without a person.
  • A neutral system-invented base is NOT a content item and must not be promoted as one.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// 3. WARDROBE PHYSICAL INTEGRATION — La ropa se porta como objetos físicos reales
export const GLOBAL_WARDROBE_PHYSICS = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👗 WARDROBE PHYSICAL INTEGRATION (ALL SHOTS WITH GARMENTS):

Treat all clothing as real physical objects worn on a real body — not painted textures.

LAYER ORDER:
  • Outerwear goes OVER inner layers. Jackets over shirts. Coats over sweaters.
  • Do NOT fuse garments at collar, waist, or sleeve — each layer must be distinct.
  • Do NOT swap a jacket for a top or a dress for a catsuit.
  • Do NOT transform a skirt into pants or vice versa.

FOOTWEAR + LEGWEAR INTEGRATION (symmetry is mandatory):
  • Both legs must follow the same physical logic — left and right must be identical.
  • If pants are tucked into boots → BOTH legs tucked, same depth, same coverage.
  • If boots are over pants → BOTH legs show the same overlap and drape.
  • If wearing heels with a skirt → BOTH feet at the same angle, consistent heel visibility.
  • If wearing tights/pantyhose → continuous layer, no cuts, no phantom legs, same sheen both sides.
  • No half-tuck / half-outside aberrations. No boot shaft piercing through solid fabric.
  • No floating straps. No mismatched ankle coverage left vs. right.
  • Choose ONE plausible real-world configuration for the footwear/legwear interaction and apply it perfectly to both sides.

STRAPS, TIES, AND THIN ELEMENTS:
  • Thin straps (heels, bikini tops, crossbody bags) must connect to the body in an anatomically plausible way.
  • No duplicate straps, no straps fused to skin, no floating attachment points.

TRANSPARENCY AND LAYERING:
  • If a garment is sheer/translucent, preserve that quality — do NOT replace it with an opaque layer.
  • Do NOT invent a prominent undergarment that was not in the slot reference.
  • A modest render is acceptable, but do NOT change the garment category.

GARMENT CONTINUITY BELOW THE FRAME:
  • Do NOT invent hem lines, shoe types, or pant lengths that conflict with the reference.
  • If the reference is cropped and you cannot verify the bottom, choose the most plausible continuation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// 4. ANATOMY SAFETY — Una persona, dos brazos, dos manos, sin aberraciones
export const GLOBAL_ANATOMY_SAFETY = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🫀 HUMAN ANATOMY SAFETY (ALL SHOTS WITH A PERSON):

PERSON COUNT: Exactly ONE main person unless this shot's role explicitly requires more.

LIMBS AND BODY PARTS (hard limits):
  • The subject has exactly TWO arms, TWO hands, TWO legs, TWO feet, ONE head.
  • Hands must be anatomically connected to wrists — no floating hands, no phantom hands.
  • No extra fingers beyond the natural count.
  • No duplicated arms, detached limbs, warped feet, or partial phantom people.
  • No ghost silhouettes in background, doorways, or reflections.

MIRROR SHOTS (apply only when framing requires a mirror):
  • Use a mirror ONLY if REF0 or the scene fingerprint established a mirror.
  • If a mirror appears, the reflection must show the SAME person, SAME outfit, SAME room.
  • The reflection must NOT show a different outfit, a second room, or a different bed.
  • The reflection must NOT be treated as an independent second person.
  • Mirror and direct view must have consistent light direction.

REFLECTION SAFETY:
  • A mirror reflection of the protagonist is still the same protagonist — NOT a second person.
  • Background figures visible through windows, in blurred backgrounds, or in reflections are FORBIDDEN.
  • Any second person appearing in the frame is a hard generation error.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// 5. VISUAL ITEM FIDELITY — La referencia visual manda, sin recolorear ni reemplazar
export const GLOBAL_VISUAL_FIDELITY = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 VISUAL ITEM FIDELITY (BINDING — ALL SHOTS WITH A SLOT ITEM):

The uploaded slot reference is the sole source of truth for any item.
Do NOT describe, imagine, or invent the item — use what the image shows.

PRESERVE EXACTLY:
  • Garment category (dress stays a dress, pants stay pants, jacket stays a jacket)
  • Dominant color and any secondary colors or color blocking
  • Material impression (matte, shiny, knit, denim, satin, leather, etc.)
  • Surface pattern (solid, striped, plaid, floral, printed, textured)
  • Silhouette and fit (oversized, fitted, wide-leg, A-line, etc.)
  • Hemline length
  • Visible hardware, buttons, zippers, lace, embroidery, or embellishments

PROHIBITED MODIFICATIONS:
  ❌ Do NOT recolor the item — not even slightly.
  ❌ Do NOT simplify a complex pattern to a solid color.
  ❌ Do NOT replace the item with a visually similar generic garment.
  ❌ Do NOT merge the item with avatar base clothing.
  ❌ Do NOT upgrade the item to a luxury or editorial version.
  ❌ Do NOT downgrade the item to a simpler everyday version.
  ❌ If the shot cannot show the full item, show the most distinctive visible portion faithfully — do not alter what IS visible.

This rule applies to ALL slot types: outfits, accessories, bags, shoes, jewelry, makeup, products, packaging.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// 6. NO EXTERNAL BRANDING — Ninguna marca externa en ningún output
export const GLOBAL_NO_BRANDING = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚷 NO EXTERNAL BRANDING OR READABLE TEXT (ABSOLUTE — ALL SHOTS):

FORBIDDEN in every generated image:
  ❌ Readable brand names on clothing, bags, boxes, packaging, or surfaces
  ❌ Store logos: ZARA, H&M, Shein, Pull&Bear, Nike, Adidas, Chanel, Louis Vuitton, Amazon, MercadoLibre, or ANY retail or luxury brand
  ❌ Price tags, hang tags, or receipts with readable text
  ❌ Shopping bags with brand logos or store names
  ❌ Promotional text, discount stickers, QR codes, or barcodes
  ❌ Watermarks, UI overlays, caption text, or labels on the image
  ❌ Any readable text on walls, furniture, or clothing unless explicitly uploaded by the user

ALL PACKAGING AND BAGS MUST BE:
  ✓ Plain, generic, and unbranded
  ✓ Solid color or simple texture — no logo, no wordmark, no emblem
  ✓ Neutral paper bags, plain boxes, or non-branded containers

EXCEPTION: Only if the user explicitly uploaded a branded item as a slot reference AND the recipe requires showing it — reproduce that specific item faithfully. Do not magnify or feature incidental logos in the background.

This rule protects content creators who are building their own brand.
Inventing external brands damages their credibility and undermines their business.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// ── Outfit composition inference ──────────────────────────────
// Infiere la composición del outfit desde el brief y los refs disponibles.
export function inferOutfitComposition(refs: Partial<import('../types').PhotodumpRefs>, basePrompt: string): OutfitComposition {
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
export function buildItemStatePlanForShot(
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
export function injectWearStateBlock(wearState: WearState): string {
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
export function injectCameraModeBlock(mode: CameraMode): string {
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

// ── Pose Intent: elige la intención de pose adaptativa para el cierre ──────────
// NO usa reglas por venue. Usa señales de affordance del entorno + tono del brief.
export function resolveClosurePoseIntent(
  briefCtx:        import('../types').OutfitBriefContext,
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

// ── Helpers puros genéricos ────────────────────────────────────

export function getAspectRatio(destino: PhotodumpDestino): '4:5' | '9:16' {
  return destino === 'feed' ? '4:5' : '9:16';
}

export function extractImageData(img: string | null | undefined): { data: string; mimeType: string } | null {
  if (!img) return null;
  const match = img.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  if (/^[A-Za-z0-9+/=]+$/.test(img.trim())) return { mimeType: 'image/jpeg', data: img.trim() };
  return null;
}

// Cap máximo de referencias por llamada al modelo — evita error 413
// Con compresión activa (768px / quality 0.72) cada imagen ~60-120KB base64.
// 10 imágenes ≈ 600KB-1.2MB, bien dentro del límite de 4.5MB de Vercel.
export const MAX_REFS = 10;
// Parámetros de compresión agresivos para payload mínimo
export const REF_MAX_WIDTH = 768;
export const REF_QUALITY   = 0.72;

export async function prepareRefs(refs: (string | null | undefined)[]): Promise<Array<{ data: string; mimeType: string }>> {
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

export function getAspectInstruction(destino: PhotodumpDestino): string {
  if (destino === 'feed')    return 'Compose for 4:5 portrait (Instagram feed). Subject fills 70-80% of frame.';
  if (destino === 'stories') return 'Compose for 9:16 full vertical (Stories/TikTok). Centered with breathing room top/bottom.';
  return 'Compose for 9:16 full vertical (TikTok). Bold framing, strong visual impact.';
}

// ── Avatar Base Clothing Fingerprint — Global (patch v4) ──────
// Genera un fingerprint textual de la ropa del avatar para usarlo como negative constraint.
// Se llama antes de generar prompts en cualquier receta donde avatarRef existe.
// El fingerprint se inyecta en cada story shot como "FORBIDDEN WARDROBE".

export function buildAvatarBaseClothingFingerprint(
  avatarDescription?: string,
): import('../types').AvatarBaseClothingFingerprint {
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
  fingerprint: import('../types').AvatarBaseClothingFingerprint,
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

// Descripción textual del destino inferido para inyectar en el prompt del DESTINATION shot.
// Usada como fallback legado por el ensamblador compartido para cualquier receta que no
// use el router semántico completo de outfit_check (parseOutfitBriefContext).
export function getDestinationDescription(dest: InferredDestination): string {
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
