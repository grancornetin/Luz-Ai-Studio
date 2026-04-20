import { 
  Focus, ShotKey, ProductSize, ProductCategory, 
  ShotDirective, ShotRole, ShotFraming, ShotComposition, ShotExclusion, DetailTarget,
  REF0Analysis,
  CATEGORY_LABELS 
} from './types';
import { ugcApiService, REF0Analysis as ApiREF0Analysis } from '../../services/ugcApiService';
import { buildUGCSessionPlanFromAnchor, analyzeProductRelevance as analyzeProductRelevanceDirect } from './ugcDirectorService';

// ===================================================================
// DETECCIÓN DE CATEGORÍA DE PRODUCTO (wrapper)
// ===================================================================
export function detectProductCategory(sceneText?: string, productRef?: string | null): ProductCategory {
  const text = (sceneText || '').toLowerCase();
  
  if (text.includes('anillo') || text.includes('arete') || text.includes('collar') || text.includes('pulsera') || 
      text.includes('joya') || text.includes('ring') || text.includes('earring') || text.includes('necklace') ||
      text.includes('gafa') || text.includes('lentes') || text.includes('sunglasses')) {
    return 'JEWELRY';
  }
  if (text.includes('labial') || text.includes('maquillaje') || text.includes('makeup') || text.includes('lipstick') ||
      text.includes('base') || text.includes('sombras') || text.includes('crema') || text.includes('serum')) {
    return 'MAKEUP';
  }
  if (text.includes('celular') || text.includes('laptop') || text.includes('tech') || text.includes('phone') ||
      text.includes('audifonos') || text.includes('auriculares') || text.includes('tablet') || text.includes('speaker')) {
    return 'TECH';
  }
  if (text.includes('zapatilla') || text.includes('pelota') || text.includes('sports') || text.includes('shoes') ||
      text.includes('tenis') || text.includes('balon') || text.includes('gym') || text.includes('deporte')) {
    return 'SPORTS';
  }
  if (text.includes('gorra') || text.includes('bolso') || text.includes('cartera') || text.includes('fashion') || 
      text.includes('bag') || text.includes('cinturon') || text.includes('bufanda') || text.includes('ropa')) {
    return 'FASHION';
  }
  if (text.includes('mueble') || text.includes('silla') || text.includes('home') || text.includes('furniture') ||
      text.includes('mesa') || text.includes('lampara') || text.includes('vela') || text.includes('decoracion')) {
    return 'HOME';
  }
  return 'GENERIC';
}

// ===================================================================
// FUNCIONES DE UTILIDAD CON COMPRESIÓN DE IMÁGENES
// ===================================================================

async function compressImage(base64: string, maxWidth: number = 1024, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = reject;
    img.src = base64;
  });
}

function extractImageData(img: string | null | undefined): { data: string; mimeType: string } | null {
  if (!img) return null;
  
  const trimmed = img.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return { mimeType: 'image/png', data: trimmed };
  }
  
  return null;
}

async function prepareReferenceImagesCompressed(refs: (string | null | undefined)[]): Promise<Array<{ data: string; mimeType: string }>> {
  const result: Array<{ data: string; mimeType: string }> = [];
  
  for (const ref of refs) {
    if (!ref) continue;
    
    let compressedRef = ref;
    try {
      compressedRef = await compressImage(ref, 1024, 0.7);
    } catch (e) {
      console.warn("[UGC] Error compressing image, using original:", e);
    }
    
    const extracted = extractImageData(compressedRef);
    if (extracted && extracted.data.length > 64) {
      result.push(extracted);
    }
  }
  
  return result;
}

// ===================================================================
// NEGATIVE PROMPT — VERSIÓN COMPLETA PARA MASTER
// ===================================================================
const NEGATIVE_FULL = `
🔴🔴🔴 CRITICAL NEGATIVES — VIOLATION WILL INVALIDATE THE IMAGE 🔴🔴🔴

IDENTITY DRIFT (ABSOLUTELY FORBIDDEN):
different person, different face, different features, different bone structure,
face replacement, identity change, person swap, different ethnicity, different age,
woman replacing man, man replacing woman, different facial structure,
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

OUTFIT INVENTION (FORBIDDEN IN DETAIL SHOTS):
inventing fabric continuation, fake hem, imaginary pants length, non-existent shorts to pants transition,
adding fabric where none exists, reconstructing garment structure beyond visible reference,
inventing shoes, inventing accessories, changing fabric texture, changing color,
altering garment length, adding folds that don't exist, changing silhouette,
changing shoe design, different number of straps, different strap routing,
simplified heel, different heel shape or height, different toe box shape,
changing tights color or opacity, changing hosiery from black to any other color,
changing accessory hardware, reinterpreting product design

SCENE REDESIGN (FORBIDDEN):
different background, different location, relocated furniture, different walls, different floor,
added decor not in reference, prettier version of scene, idealized environment,
studio background replacing real scene, CGI background,
person floating over the scene, compositing artifacts, person not sharing the scene's light

COMPOSITION VIOLATIONS:
walking, mid-stride, running, motion blur when static required,
empty gaze, looking at nothing, dead eyes,
unnatural hands, frozen hands, hands without purpose,
catalog pose, runway pose, overly staged, fashion week pose,
mannequin stiffness, symmetric catalog stance

TECHNICAL ARTIFACTS:
watermark, signature, text overlay, logos without being the product itself,
collage, multiple images, grid, side by side, before/after,
composite image, face pasted over body, face reference used as overlay layer,
reference image inserted as collage element, photomontage, multiple exposures,
phone visible in selfie, camera visible, third-person selfie framed as first-person,
extra limbs, duplicated arms, phantom hands, broken joints, impossible limb positions,
color drift between shots, different color temperature, different white balance,
filters, stylization, artificial lighting variation between shots

SCENE INTEGRATION FAILURES:
person with different lighting than the scene background,
person casting no shadow when scene has shadows,
person at wrong scale relative to scene elements,
person floating or appearing pasted onto the background
`;

// Negative prompt corto para shots derivados (evita timeout)
const NEGATIVE_SHORT = `
face replacement, identity change, different person, different face,
different hair color, different hair texture, different eye color,
different bone structure, averaging face with other references,
using REF0 person instead of face reference person,
composite image, face pasted over body, face reference used as overlay,
collage artifact, photomontage, reference image inserted as layer,
beautification, skin smoothing, editorial look, studio lighting,
luxury redesign, mannequin pose, catalog stance, walking blur,
outfit invention, fake fabric, extra clothing,
different shoe design, different shoe straps, different heel shape,
different heel height, simplified shoe, reinterpreted shoe,
different tights color, different tights opacity, different hosiery,
phone visible in selfie, third-person selfie,
different background, scene redesign,
person floating over background, lighting mismatch person vs scene,
color temperature drift, filter drift between shots
`;

// ===================================================================
// RULE PRIORITY SYSTEM
// ===================================================================
const RULE_PRIORITY_SYSTEM = `
╔═══════════════════════════════════════════════════════════════════╗
║                    RULE PRIORITY SYSTEM                          ║
╚═══════════════════════════════════════════════════════════════════╝

1️⃣ IDENTITY LOCK (HIGHEST — FACE MUST REMAIN IDENTICAL TO FACE REF)
2️⃣ VISUAL CONTINUITY LOCK (LIGHT, COLOR TEMP, SCENE FROM REF0 — NO DRIFT)
3️⃣ SHOT ROLE ENFORCEMENT (CADA SHOT CON SU ROL ESPECÍFICO)
4️⃣ MODE DOMINANCE (AVATAR/OUTFIT/PRODUCT/SCENE — NUNCA MEZCLAR)
5️⃣ SCENE INTEGRATION (PERSON BELONGS IN SCENE — SAME LIGHT, SAME SHADOW)
6️⃣ DETAIL EXTREME RULE (NO FACE, NO EXTRA GEOMETRY, NO INVENTED FABRIC)
7️⃣ SELFIE PHYSICS (arm-length POV, handheld, no phone, shoulder visible)
8️⃣ INTERACTION RULE (hands must be doing something with clear intention)
9️⃣ ANTI-BEAUTIFICATION (NO editorial, NO skin smoothing, REAL skin texture)
🔟 SHOT DIVERSITY (cada shot difiere en framing/ángulo/distancia/rol)
`;

// ===================================================================
// LOCK SYSTEM — VERSIÓN REFORZADA CON CONTINUIDAD VISUAL
// ===================================================================
const LOCK_SYSTEM = `
╔═══════════════════════════════════════════════════════════════════╗
║              LOCK SYSTEM (NON-NEGOTIABLE — NEVER CHANGES)        ║
╚═══════════════════════════════════════════════════════════════════╝

🔒🔒🔒 IDENTITY LOCK (HARD — ABSOLUTE PRIORITY — READ BEFORE ANYTHING ELSE):
- The face reference appears MULTIPLE TIMES in this request. That is intentional.
  It means: this face is the non-negotiable ground truth. Do not average it. Do not override it.
- The person's FACE MUST be EXACTLY the same as face reference in every single shot.
- Same bone structure, same eye shape and color, same nose, same lips, same jaw, same chin.
- Same hair: color, length, texture, wave/straight/curly pattern.
- Same skin tone: undertone, warmth, complexion depth.
- Same person. Every shot. Zero exceptions.
- NO face replacement, NO identity drift, NO different person.
- NO beautification, NO skin smoothing.
- The face reference OVERRIDES every other image — including REF0 — for who the person is.

⚠️ ANTI-COLLAGE / ANTI-COMPOSITE RULE (CRITICAL):
- The face reference is a VISUAL GUIDE for identity ONLY — NOT an element to be placed into the image.
- DO NOT paste, overlay, composite, or layer the face reference into the generated image.
- DO NOT treat any reference image as a collage layer to be inserted.
- The result must be a SINGLE SEAMLESS PHOTOGRAPH generated from scratch.
- If the face reference is a close-up headshot: use it to understand who the person is, then generate the full scene naturally with that person in it.
- A composite image (person's body + pasted face reference) is a HARD FAILURE.

🔒🔒 VISUAL CONTINUITY LOCK (PREVENTS DRIFT BETWEEN SHOTS):
- Same color temperature across all shots — do NOT shift warm/cool.
- Same skin tone rendering — do NOT lighten or darken the person's skin.
- Same ambient light quality — do NOT add or remove light sources.
- Same overall contrast range — do NOT add HDR, drama, or filters.
- No Instagram-style color grading. No desaturation. No vignetting.
- Every shot must look like it was taken in the same session, same day.

🔒 PRODUCT LOCK:
- Same product. Same materials. Same details. Same texture. Same color.
- NO changes. NO reinterpretation. NO different version of the product.

🔒 OUTFIT LOCK:
- Same clothing. Same fit. Same fabric. Same color. Same pattern.
- NO changes. NO invented fabric continuation beyond visible reference.
- For DETAIL shots: ONLY show what exists in reference. NO reconstruction.

🔒 SCENE LOCK (NO REDESIGN, NO COMPOSITING):
- Same environment. Same walls, same floor, same furniture.
- Person MUST share the scene's lighting — same shadows, same direction.
- Person at correct scale relative to scene elements.
- NO idealization, NO added decor, NO prettier version.
- NO compositing artifacts — the person belongs in the scene physically.

🔒 SCALE LOCK:
- Maintain real-world proportions. NO distortion.
`;

const REF0_ANCHOR_RULE = LOCK_SYSTEM;

// ===================================================================
// PARADIGM RULE
// ===================================================================
const PARADIGM_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 PARADIGM (CRITICAL):

You are NOT editing REF0.
You are capturing a NEW photograph taken at the SAME moment as REF0.

REF0 defines the reality of this session. Every shot is a new angle
of that same physical reality.

Do NOT produce a slightly modified version of REF0.
Do NOT add new elements, furniture, lighting, or backgrounds.
Each image must feel like a photographer moved to a new position.
`;

// ===================================================================
// MODE DOMINANCE (CRÍTICO — POR ENFOQUE)
// COMPLETAMENTE REDISEÑADO CON REGLAS ESPECÍFICAS
// ===================================================================
const getModeDominance = (focus: Focus): string => {
  if (focus === 'AVATAR') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
😊 MODE DOMINANCE: AVATAR MODE (DIGITAL INFLUENCER — REAL iPhone FEED)

IDENTITY: This is a real influencer's Instagram feed. Every shot must
feel like content a real person posted — lived-in, authentic, organic.

CRITICAL RULES:
- FACE is the ABSOLUTE HERO in most shots.
- The aesthetic is "iPhone photo taken by a friend or self-taken" — NOT editorial.
- SELFIE (S2) is MANDATORY: POV arm-length, no phone visible, handheld feel.
- Outfit and accessories are SECONDARY — they exist but don't compete with face.
- Environment is real: café, street, park, home — NEVER neutral studio.

SESSION FEEL:
- Shots 1-3: Face-dominant, showing personality and expression.
- Shot 4: Full body with attitude — NOT a catalog pose. Weight shifted, natural stance.
- Shot 5: Hands doing something real (coffee, book, phone, flower).
- Shot 6: Person integrated into real context, lifestyle.

SELFIE PHYSICS (NON-NEGOTIABLE):
- Camera held at arm's length by the person.
- Shoulder visible at bottom of frame.
- Phone/camera is NOT visible — it's the viewer's POV.
- Slight asymmetry, slight upward angle from hand level.
- Handheld imperfection is correct, NOT a flaw.

FORBIDDEN in AVATAR mode:
- Detail shots of belt, bag, or shoes as the MAIN subject
- More than 2 full-body wide shots
- Outfit competing with face for attention
- Any shot that looks like a clothing catalog
- Symmetric stiff poses
- Studio backgrounds or neutral walls only
`;
  }
  
  if (focus === 'OUTFIT') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👔 MODE DOMINANCE: OUTFIT MODE (OUTFIT CHECK / TRY-ON HAUL)

IDENTITY: This is a fashion content creator doing an outfit check.
Think Instagram outfit posts, try-on hauls, GRWM casual content.
Every shot must show the outfit with ATTITUDE — not as a mannequin.

CRITICAL RULES:
- OUTFIT is the ABSOLUTE HERO in every shot.
- Hero shot (S1): FULL BODY with ATTITUDE — weight shifted, natural stance.
  NOT a symmetric mannequin pose. The person has personality.
- Detail shots (S2/S6): EXTREME CROP on the specific target ONLY.
  For shoe shots: ONLY shoe + ankle + floor. NO invented pant leg.
  For accessory shots: the accessory with body as anchor.
- Interaction shot (S3): hands touching the garment naturally.
- Lifestyle shot (S4): outfit in relaxed context, fabric draping naturally.
- Alt angle shot (S5): full body from a SIGNIFICANTLY different angle.

DETAIL SHOT ANTI-INVENTION RULES (HARD):
- SHOE DETAIL: ONLY shoe, ankle, floor. DO NOT invent tela above.
  If reference shows shorts → do NOT add pants to fill the frame.
  If reference shows pants → show exactly the hem visible, not more.
- FABRIC DETAIL: ONLY the texture. NO full garment silhouette. NO face.
- ACCESSORY DETAIL: ONLY the accessory + minimal body anchor.

POSES MUST HAVE LIFE:
- No symmetric "arms at sides" catalog stance.
- Weight must be on ONE hip (not both equally).
- Arms: in pockets, holding bag, one raised, or naturally bent.
- Head may be tilted, looking slightly off, or looking at camera with attitude.

OUTFIT CHECK SESSION FEEL:
- Looks like a real person's fashion content, not a product catalog.
- The person exists inside the clothes, not the clothes existing separately.
`;
  }
  
  if (focus === 'PRODUCT') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 MODE DOMINANCE: PRODUCT MODE (REVIEW / RECOMMENDATION / UGC)

IDENTITY: This is authentic UGC product content — the kind a real
customer or influencer would post. Think "honest review", "I love this",
"unboxing reaction", "watch me use this".

CRITICAL RULES:
- PRODUCT is visually dominant in most shots.
- AVATAR's FACE must be visible and EXPRESSIVE in at least 4 of 6 shots.
- The avatar should feel like a REAL person genuinely recommending the product.
- NOT a stock photo. NOT a commercial ad. NOT editorial.

PRIORITY ORDER:
1. PRODUCT (clearly visible, attractive, identical to productRef)
2. AVATAR FACE (emotional narrator — must show genuine reaction)
3. Hands (active interaction, demonstration)
4. Environment (real context of product use — never studio)

EMOTION SPECTRUM (use variety across shots):
- Surprise/delight at the product
- Satisfaction after using it
- Pride showing it off
- Authentic enthusiasm (not fake grin)

PRODUCT-FACE BALANCE:
- Product should be CLEARLY legible (brand, texture, shape visible).
- Face should show REAL emotion — not the standard commercial smile.
- The viewer should want the product because the person's reaction is real.

FORBIDDEN:
- Person with neutral/empty expression while holding product.
- Product too small to read or identify.
- Studio white background unless absolutely contextual.
- Person's face cropped while product is shown.
`;
  }
  
  if (focus === 'SCENE') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏞️ MODE DOMINANCE: SCENE MODE (PLACE REVIEW — AVATAR LIVES HERE)

IDENTITY: This is content from someone visiting or reviewing a place.
Think "day in my life at this restaurant", "exploring this neighborhood",
"this café is everything". The PLACE is the hero but the PERSON BELONGS
physically in the space.

CRITICAL RULES:
- ENVIRONMENT is the visual hero in wide shots.
- Person must share the scene's PHYSICAL REALITY:
  → Same light direction on their body as the scene's light.
  → Person casts shadows consistent with scene lighting.
  → Person at correct scale relative to scene elements.
  → NO compositing artifacts. NO pasted-over-background feel.
- Avatar's face visible and expressive when visible.
- Place details shown as they ARE — NO redesign, NO idealization.

SCENE INTEGRATION (THE MOST IMPORTANT RULE):
The person MUST BELONG PHYSICALLY IN THE SCENE.
This means:
- If the scene has warm side-lighting → the person has warm side-lighting.
- If the scene has shadows on the floor → the person casts a shadow too.
- If the scene is a dimly lit restaurant → the person is in that same dim light.
- The person's skin and clothing pick up the scene's color cast.
- Scale: a chair that's 80cm high looks 80cm high relative to the person.

FORBIDDEN:
- Person appearing to float over the background.
- Person with different color temperature than the scene.
- Person with studio lighting in a naturally-lit scene.
- Redesigning the scene (NO added furniture, NO beautification of space).
- Empty expression — person must visibly enjoy/experience the place.
- Shot S4 (detail) eliminating the person entirely — always keep a body anchor.
`;
  }
  
  return '';
};

// ===================================================================
// ROLE ENFORCEMENT — REGLAS DURAS POR ROL (MEJORADAS)
// ===================================================================
const getRoleEnforcement = (role: string, focus: Focus, detailTarget?: string): string => {
  if (role === 'HERO') {
    if (focus === 'AVATAR') {
      return `
🔴 HERO ROLE ENFORCEMENT (AVATAR):
- MEDIUM shot (waist up) — NOT full body wide shot
- Face MUST be clear, dominant (40-50% frame), expressive
- Outfit is secondary background — does NOT compete
- NO extreme crop, NO full body as hero
- Expression: warm, authentic, direct to camera`;
    }
    if (focus === 'OUTFIT') {
      return `
🔴 HERO ROLE ENFORCEMENT (OUTFIT — ANTI-MANNEQUIN):
- FULL BODY visible head to toe — NO cropping
- Outfit is the ONLY visual hero
- Face visible but secondary (max 15% of frame)
- POSE MUST HAVE ATTITUDE: weight shifted to one hip,
  arms naturally bent or in pockets — NOT symmetric catalog stance
- The person wears the outfit with confidence and personality
- NO mannequin pose. NO symmetric "arms at sides" stance.`;
    }
    if (focus === 'PRODUCT') {
      return `
🔴 HERO ROLE ENFORCEMENT (PRODUCT):
- Product and face BOTH visible and prominent
- Product visually dominant (40% frame)
- Face shows genuine enthusiasm or positive emotion
- NOT a neutral holding pose — the person is engaged`;
    }
    return `
🔴 HERO ROLE ENFORCEMENT:
- Primary image of the session
- Subject fully visible, NOT extreme crop
- NO distractions, NO competing elements`;
  }
  
  if (role === 'SELFIE') {
    return `
🔴 SELFIE ROLE ENFORCEMENT (STRICT PHYSICS — NO FAKE SELFIES):
- This IS a first-person selfie. Camera held at arm's length by the person.
- VISIBLE IN FRAME: shoulder, elbow, partial forearm, full face, hint of chest/outfit.
- Phone/camera is NOT visible — the viewer is the camera.
- POV: slight upward angle from hand level (not eye level — the arm is extended DOWN).
- Handheld framing: slight asymmetry, organic composition.
- FORBIDDEN: third-person portrait (someone else holding the camera), full body, studio.
- FORBIDDEN: phone appearing in the frame.
- FORBIDDEN: selfie that looks like a portrait taken by a photographer.
- The arm extending from the lower frame MUST imply the person is holding the camera.
- Natural skin texture, NO beautification, NO softbox lighting.`;
  }
  
  if (role === 'DETAIL') {
    if (focus === 'AVATAR') {
      return `
🔴 DETAIL ROLE ENFORCEMENT (AVATAR):
- ALLOWED details: face close-up, hand gesture, product interaction
- FORBIDDEN: outfit details (belt, bag, shoes) as main subject
- The detail must serve the person's story, not the clothing`;
    }
    if (focus === 'OUTFIT' && detailTarget === 'shoe') {
      return `
🔴 DETAIL ROLE ENFORCEMENT (OUTFIT — SHOE — ANTI-INVENTION):
- EXTREME close-up of SHOE ONLY
- Frame fill: 85-90% shoe, ankle, floor
- FORBIDDEN: pant leg, hem, fabric continuation, invented shorts, invented pants.
- The shoe exists. What's above it: ONLY show what the reference shows.
- If reference shows shorts → do NOT add pant leg (shorts end above knee).
- If reference shows pants → show exactly the visible hem, nothing more.
- The shoe detail shows ONLY what physically exists in the reference.
- Interesting angle: side profile, slight above, or held by hand.`;
    }
    if (focus === 'SCENE') {
      return `
🔴 DETAIL ROLE ENFORCEMENT (SCENE):
- Scene element is dominant (70-80% of frame).
- A minimal body fragment (hand, arm, shoulder) MUST be visible as anchor.
- The body fragment shares the SAME LIGHT as the scene element.
- NO isolated scene element without human presence.
- The detail reveals something specific and beautiful about the place.`;
    }
    return `
🔴 DETAIL ROLE ENFORCEMENT (HARD):
- EXTREME close-up — subject fills 85-90% of frame.
- Face is FORBIDDEN (unless detail target is explicitly face).
- Full body is FORBIDDEN.
- Background MUST be blurred or absent.
- If it looks like a MEDIUM shot, it is INVALID.
- For clothing details: ONLY show the target. DO NOT invent garment structure.
- DO NOT add hems, seams, or fabric that doesn't exist in reference.`;
  }
  
  if (role === 'INTERACTION') {
    return `
🔴 INTERACTION ROLE ENFORCEMENT (HANDS MUST DO SOMETHING REAL):
- Hands MUST be visibly and actively interacting.
- Clear action required: adjusting, holding, touching, using, opening, demonstrating.
- Mid shot framing: upper body + hands clearly visible.
- The ACTION must look natural and purposeful — NOT forced.
- Static pose without active hand use is FORBIDDEN.
- Face should be visible and engaged with the action.
- The interaction tells a story: what is the person doing and why?`;
  }
  
  if (role === 'EXPRESSION') {
    return `
🔴 EXPRESSION ROLE ENFORCEMENT:
- Face MUST fill 70-80% of frame.
- Expression MUST be PERCEPTUALLY DISTINCT from other expression/hero shots.
- NO beautification, NO skin smoothing, NO retouching.
- Natural skin texture, pores, fine lines are ALLOWED and CORRECT.
- Viewer must identify the emotion at a glance.
- This is a REAL person with REAL skin expressing GENUINE emotion.
- NOT a beauty portrait. NOT a model's blank stare.`;
  }
  
  if (role === 'LIFESTYLE') {
    return `
🔴 LIFESTYLE ROLE ENFORCEMENT:
- Person is STATIC: standing still, sitting, or leaning — weight settled.
- NOT mid-step, NOT walking, NOT in dynamic motion.
- Context/environment clearly visible around the person.
- Authentic, candid feel — NOT editorial, NOT staged.
- Face visible with natural, relaxed expression.
- The person looks like they exist in this space naturally.`;
  }
  
  if (role === 'ALT_ANGLE') {
    return `
🔴 ALT ANGLE ROLE ENFORCEMENT:
- Camera angle MUST differ SIGNIFICANTLY from the HERO shot.
- "Slightly to the left" is NOT sufficient — needs ≥45° difference.
- Valid options: full side profile (90°), 3/4 profile (45°), low angle from below,
  high angle from above, behind with face turned back.
- The viewer must immediately perceive this as a DIFFERENT angle.
- Subtle angle changes (5-15°) are INVALID.`;
  }
  
  if (role === 'CONTEXT') {
    return `
🔴 CONTEXT ROLE ENFORCEMENT (SCENE):
- Environment is the hero (65-75% of frame) — exactly as in scene reference.
- NO redesign, NO added furniture, NO beautification of the scene.
- Person visible (25-35% of frame), integrated physically into the space.
- Person shares the scene's lighting — same direction, same color temp.
- Person at correct scale relative to scene elements.
- Scene details must match scene reference exactly.`;
  }
  
  return '';
};

// ===================================================================
// SHOT DIVERSITY ENFORCEMENT
// ===================================================================
const getShotDiversityRule = (shotKey: string, role: string): string => {
  return `
🔴 SHOT DIVERSITY REQUIREMENT (${shotKey}):
- This shot MUST be PERCEPTUALLY DIFFERENT from every other shot in the session.
- Change at least ONE of: camera distance, framing, angle, role, interaction, expression.
- Do NOT produce a slightly modified version of another shot.
- Each image should feel like a completely different photograph.
- For ALT_ANGLE: angle must be ≥45° different from HERO.
- For EXPRESSION: emotion must be clearly different from other expression shots.
- For DETAIL: target must be unique (not repeating another detail shot's subject).
`;
};

// ===================================================================
// INYECTAR REF0 ANALYSIS EN PROMPT
// ===================================================================
const injectREF0Analysis = (analysis: REF0Analysis | undefined): string => {
  if (!analysis) return '';
  
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 REF0 VISUAL CONTINUITY LOCK (DO NOT DRIFT FROM THIS):

LIGHTING (IDENTICAL across ALL shots — NO changes):
- Primary source: ${analysis.lighting.primarySource}
- Direction: ${analysis.lighting.direction}
- Color temperature: ${analysis.lighting.colorTemperature}
- Shadow type: ${analysis.lighting.shadowType}
- Intensity: ${analysis.lighting.intensity}

SPATIAL (IDENTICAL — NO REDESIGN, NO ADDED ELEMENTS):
- Scene elements: ${analysis.spatial.elements.join(', ')}
- Walls: ${analysis.spatial.walls}
- Floor: ${analysis.spatial.floor}
- Geometry: ${analysis.spatial.geometry}

AVAILABLE PERSON ACTIONS (stay within these options):
- ${analysis.poseContext.availableActions.join(', ')}

CRITICAL CONTINUITY RULES:
- Do NOT shift the color temperature from ${analysis.lighting.colorTemperature}.
- Do NOT add or remove light sources.
- Do NOT change the skin tone rendering or saturation.
- Every shot must look like it was taken in the SAME session as REF0.
- The environment must be IDENTICAL to REF0 — same walls, same furniture, same light.
`;
};

// ===================================================================
// GENERAR FONDO NEUTRO (REALISTA, NUNCA ESTUDIO)
// ===================================================================
async function generateNeutralScene(focus: Focus, productCategory?: ProductCategory): Promise<string> {
  if (focus === 'PRODUCT') {
    if (productCategory === 'JEWELRY') return 'Cozy bedroom vanity with warm natural light, wooden dresser, personal atmosphere';
    if (productCategory === 'MAKEUP') return 'Bright bathroom with morning window light, clean counter, fresh and personal feel';
    if (productCategory === 'TECH') return 'Modern home workspace with natural window light, plants, casual desk setup';
    if (productCategory === 'SPORTS') return 'Home interior near a window with natural light, casual and active atmosphere';
    return 'Cozy living room with natural window light, comfortable casual lifestyle setting';
  }
  if (focus === 'OUTFIT') return 'Apartment living room with large windows, natural daylight, warm tones, real home setting';
  if (focus === 'AVATAR') return 'Cozy street café terrace with natural light, stone or brick wall in background';
  return 'Bright natural interior with window light, lived-in home environment';
}

async function generateNeutralOutfit(focus: Focus, productCategory?: ProductCategory): Promise<string> {
  if (focus === 'PRODUCT') {
    if (productCategory === 'JEWELRY') return 'Simple elegant outfit: clean blouse, neutral tone, minimal to let jewelry stand out';
    if (productCategory === 'MAKEUP') return 'Natural casual look: basic ribbed top, clean and understated';
    if (productCategory === 'TECH') return 'Casual modern outfit: clean hoodie, jeans, everyday tech lifestyle';
    return 'Casual everyday outfit, neutral tones, comfortable and real';
  }
  if (focus === 'SCENE') return 'Casual outfit appropriate and coherent with the scene, natural everyday clothing';
  return 'Casual comfortable outfit, everyday style, natural fabrics, non-distracting';
}

// ===================================================================
// TRADUCIR SHOT DIRECTIVE A PROMPT — VERSIÓN DINÁMICA MEJORADA
// ===================================================================
function translateDirectiveToPrompt(directive: ShotDirective, focus: Focus, ref0Analysis?: REF0Analysis): string {
  const parts: string[] = [];
  
  const variation = directive.variationSpace && directive.variationSpace.length > 0
    ? directive.variationSpace[Math.floor(Math.random() * directive.variationSpace.length)]
    : '';
  
  if (directive.role === 'SELFIE') {
    parts.push(`
🔴🔴🔴 AUTHENTIC UGC SELFIE — STRICT PHYSICS 🔴🔴🔴

This is a FIRST-PERSON selfie taken by the person themselves.
The viewer IS the camera being held by the person at arm's length.

PHYSICAL REQUIREMENTS (NON-NEGOTIABLE):
- The person holds the camera/phone at arm's length.
- Visible in frame from bottom: shoulder, partial forearm, upper arm.
- The arm extends from the LOWER portion of the frame (not the center).
- Slight upward angle from hand level — NOT eye level.
- Handheld framing: organic slight asymmetry, imperfect edge alignment.
- Phone/camera is NOT visible — it's the viewer's POV device.
- NO third-person perspective. NO portrait taken by someone else.
- NO symmetric professional framing.

SPECIFIC FRAMING: ${variation || 'Close selfie showing face, shoulder, and partial arm.'}

FORBIDDEN: phone visible, symmetric composition, studio lighting,
           full body, third-person perspective, someone else taking the photo.`);
  } 
  else if (directive.role === 'DETAIL') {
    const target = directive.detailTarget || 'texture';
    if (target === 'shoe') {
      parts.push(`
🔴🔴🔴 EXTREME SHOE DETAIL — ANTI-INVENTION STRICT 🔴🔴🔴

Camera is 10-15cm from the shoe.
WHAT YOU SEE: shoe, ankle, and floor/ground only.
WHAT YOU DO NOT INVENT: pant leg, hem, shorts, ANY fabric above the ankle.

The reference shows what's above the ankle. Do NOT add what isn't there.
- If reference shows shorts → the leg is bare above the ankle. Do NOT add pants.
- If reference shows pants → show ONLY the exact hem visible. Nothing more.

FRAMING: ${variation || 'Shoe fills 85-90% of frame. Interesting angle: side profile, slight above.'}
NO face. NO full body. NO upper body. NO invented clothing.`);
    } else if (target === 'fabric' || target === 'texture') {
      parts.push(`
🔴🔴🔴 EXTREME FABRIC TEXTURE DETAIL 🔴🔴🔴

Camera is 10-15cm from the fabric surface.
ONLY: texture, weave, material surface.
NOT: garment silhouette, full clothing item, face, body, background.

${variation || 'The fabric fills 85-90% of frame. Show the texture quality and material reality.'}
Light should reveal the texture (side lighting preferred for showing depth).`);
    } else if (focus === 'SCENE') {
      parts.push(`
🔴🔴🔴 SCENE DETAIL WITH HUMAN ANCHOR 🔴🔴🔴

The scene element is DOMINANT (70-80% of frame).
A MINIMAL BODY FRAGMENT (hand, arm, or shoulder) is visible as anchor.
This fragment shares the EXACT SAME LIGHT as the scene element.
This proves the person physically exists in this space.

SCENE ELEMENT: ${variation || 'A beautiful or distinctive element of the place.'}
Body anchor: natural position — NOT forced or awkward.
The person's fragment of body confirms they are in this place, sharing its light.`);
    } else {
      parts.push(`
🔴🔴🔴 EXTREME DETAIL SHOT — TARGET: ${target} 🔴🔴🔴

Camera distance: 10-15cm from the target.
ONLY the target (${target}) fills 85-90% of frame.
NO face. NO full body. NO surrounding elements beyond natural context.
NO invented geometry or non-existent structure.
${variation || 'Interesting angle that reveals the target\'s quality and texture.'}`);
    }
  } 
  else if (directive.role === 'EXPRESSION') {
    parts.push(`
🔴🔴🔴 AUTHENTIC FACE EXPRESSION — REAL EMOTION, NO FILTER 🔴🔴🔴

Face fills 70-80% of frame.
Expression: ${variation || 'genuine, clearly different from other shots in the session'}.
Natural skin texture MUST be visible — pores, fine lines, subtle imperfections are CORRECT.
This is a REAL person with REAL skin, NOT a beauty filter output.

⚠️ CRITICAL ANTI-COLLAGE RULE:
The face reference is a GUIDE for identity ONLY.
DO NOT insert, paste, overlay, or composite the face reference as a layer into this image.
DO NOT treat the face reference as an image element to be placed into the scene.
The face must be GENERATED as part of this photograph from scratch, using the reference ONLY to know what the person looks like.
If the face reference is a close-up headshot: use it to understand identity, then generate the full shot naturally.
RESULT: a single seamless photograph — NOT a composite, NOT a collage, NOT a face pasted over a body.

NO beautification. NO skin smoothing. NO softbox. NO retouching.
This face must be IDENTICAL to face reference.
The emotion must be PERCEIVABLE at a glance.`);
  } 
  else if (directive.role === 'HERO') {
    if (focus === 'AVATAR') {
      parts.push(`
🔴🔴🔴 AVATAR HERO — FACE DOMINANT, WARM AND REAL 🔴🔴🔴

MEDIUM shot (waist up). NOT full body.
Face takes 40-50% of frame — CLEAR, DOMINANT, EXPRESSIVE.
Expression: ${variation || 'warm, authentic, direct eye contact with camera'}.
Outfit is secondary — exists but does NOT compete for attention.
The person feels like a real influencer's hero post — organic, not editorial.

NO outfit competition. NO accessory focus. NO catalog posture.
The face MUST be IDENTICAL to face reference.`);
    } else if (focus === 'OUTFIT') {
      parts.push(`
🔴🔴🔴 OUTFIT HERO — FULL BODY WITH ATTITUDE, NOT MANNEQUIN 🔴🔴🔴

FULL BODY visible head to toe — NO cropping of head or feet.
The outfit is the VISUAL HERO — complete silhouette, fit, and style.
${variation || 'Weight shifted to one hip. Arms natural: in pockets, holding bag, or naturally bent.'}

ANTI-MANNEQUIN: The person has weight, personality, and attitude.
The stance is NATURAL — NOT the symmetric "arms at sides" catalog pose.
Face may be visible but is secondary (max 15% of frame).
The outfit MUST be IDENTICAL to outfit reference.`);
    } else if (focus === 'PRODUCT') {
      parts.push(`
🔴🔴🔴 PRODUCT HERO — PRODUCT + GENUINE REACTION 🔴🔴🔴

Product is visually dominant (40% frame), clearly legible.
Face shows GENUINE POSITIVE EMOTION (30% frame) — NOT neutral holding pose.
${variation || 'Presenting or holding the product naturally with enthusiasm.'}
The viewer should want to buy the product because the person\'s reaction is real.

The product MUST be IDENTICAL to product reference.
The face MUST be IDENTICAL to face reference.`);
    } else {
      parts.push(`
🔴🔴🔴 HERO SHOT — PRIMARY IMAGE OF SESSION 🔴🔴🔴
Subject fully visible. ${variation || 'Natural, clear, authentic composition.'}
NO extreme crop. NO distractions.`);
    }
  }
  else if (directive.role === 'INTERACTION') {
    parts.push(`
🔴🔴🔴 INTERACTION SHOT — HANDS IN ACTIVE REAL ACTION 🔴🔴🔴

Hands MUST be VISIBLY AND ACTIVELY doing something.
The action: ${variation || 'clear, natural, purposeful — adjusting, holding, touching, using'}.
The action tells a story — WHY are the hands doing this?
Face visible and ENGAGED with the action (not looking away randomly).
Mid shot: upper body + hands clearly visible.

FORBIDDEN: static frozen hands, purposeless hand placement, 
           forced unnatural gesture, face not engaged with action.`);
  }
  else if (directive.role === 'LIFESTYLE') {
    parts.push(`
🔴🔴🔴 LIFESTYLE SHOT — PERSON EXISTS IN THIS SPACE 🔴🔴🔴

Person is STATIC: weight settled, standing still, sitting, or leaning.
NOT mid-step. NOT walking. Weight is GROUNDED.
Context/environment CLEARLY VISIBLE around the person.
Authentic lived-in feel — NOT editorial, NOT staged, NOT catalog.
Face visible, natural, relaxed expression.
${variation || 'Person looks like they naturally exist and belong in this environment.'}`);
  }
  else if (directive.role === 'ALT_ANGLE') {
    parts.push(`
🔴🔴🔴 ALTERNATE ANGLE — SIGNIFICANTLY DIFFERENT PERSPECTIVE 🔴🔴🔴

Camera angle MUST be SIGNIFICANTLY different from the HERO shot (≥45°).
${variation || 'Valid options: full side profile (90°), 3/4 profile (45°), low angle, high angle, behind.'}
The viewer must IMMEDIATELY perceive this as a different angle, not a minor adjustment.
Same subject, same session, completely new perspective.

FORBIDDEN: subtle angle variation (5-15°), same frontal framing as HERO.`);
  }
  else if (directive.role === 'CONTEXT') {
    parts.push(`
🔴🔴🔴 CONTEXT SHOT — ENVIRONMENT DOMINANT, PERSON INTEGRATED 🔴🔴🔴

Environment is the hero (65-75% of frame).
Person visible (25-35%) as a natural visitor to this space — integrated.
Person PHYSICALLY BELONGS in the scene: same lighting, same shadows, correct scale.
${variation || 'Wide establishing shot showing the place\'s character and beauty.'}
Person enjoying/experiencing the space — NOT pasted over it.

FORBIDDEN: scene redesign, person floating over background, 
           lighting mismatch person vs scene, person at wrong scale.`);
  }
  
  // Agregar reglas base
  parts.push(`SHOT KEY: ${directive.key} | ROLE: ${directive.role}`);
  parts.push(getRoleEnforcement(directive.role, focus, directive.detailTarget));
  parts.push(getShotDiversityRule(directive.key, directive.role));
  parts.push(`FRAMING: ${directive.framing === 'EXTREME_CLOSE' ? 'EXTREME CLOSE-UP — 85-90% FRAME FILL' : directive.framing}`);
  parts.push(`SHOT INTENTION: ${directive.purpose}`);
  
  if (directive.requiredElements.length > 0) {
    const requiredText = directive.requiredElements.map(e => e.replace(/_/g, ' ')).join(', ');
    parts.push(`REQUIRED ELEMENTS: ${requiredText}`);
  }
  
  if (directive.forbiddenElements.length > 0) {
    const forbiddenText = directive.forbiddenElements.map(e => e.replace(/_/g, ' ')).join(', ');
    parts.push(`FORBIDDEN ELEMENTS: ${forbiddenText}`);
  }
  
  if (directive.exclusion.length > 0) {
    const exclusionText = directive.exclusion.map(e => `EXCLUDE: ${e}`).join('; ');
    parts.push(`EXCLUSIONS: ${exclusionText}`);
  }
  
  parts.push(`
🔒🔒🔒 FACE IDENTITY LOCK 🔒🔒🔒
- The person's face MUST be EXACTLY the same as the face reference.
- NO face replacement. NO identity drift. NO different person.
- The face reference OVERRIDES any other image for identity.
- This is NON-NEGOTIABLE.`);
  
  return parts.join('\n');
}

// ===================================================================
// MOTOR DE GENERACIÓN CON POLLING
// ===================================================================
async function generateWithPolling(
  prompt: string,
  refs: (string | null)[],
  systemInstructions: string,
  isDerivedShot: boolean = false,
  shotIndex?: number,
  totalShots?: number,
  onStatusChange?: (status: string, image?: string) => void
): Promise<string> {
  const referenceImages = await prepareReferenceImagesCompressed(refs);
  const negativePrompt = isDerivedShot ? NEGATIVE_SHORT : NEGATIVE_FULL;
  const fullPrompt = `${systemInstructions}\n\nTASK:\n${prompt}\n\nNEGATIVE:\n${negativePrompt}`;
  
  return ugcApiService.generateImageAsync({
    prompt: fullPrompt,
    referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    aspectRatio: '3:4',
    shotIndex,
    totalShots,
    onStatusChange,
  });
}

// ===================================================================
// ANALIZAR RELEVANCIA DE PRODUCTO (wrapper)
// ===================================================================
export async function analyzeProductRelevance(
  productRef: string | null | undefined,
  focus: Focus,
  outfitRef?: string | null,
  sceneRef?: string | null,
  sceneText?: string
): Promise<{ isRelevant: boolean; suggestion: string; productType: string }> {
  if (!productRef) {
    return { isRelevant: false, suggestion: '', productType: 'none' };
  }
  
  return analyzeProductRelevanceDirect(productRef, focus, outfitRef, sceneRef, sceneText);
}

// ===================================================================
// SERVICIO PÚBLICO
// ===================================================================
export interface SessionPlan {
  anchor: string;
  productCategory?: ProductCategory;
  ref0Analysis?: REF0Analysis;
  shots: ShotDirective[];
}

export const contentStudioService = {
  async ensureAccess() {
    // No-op — autenticación en el servidor
  },

  // ──────────────────────────────────────────────────────────────
  // buildSessionPlan — USA EL DIRECTOR AVANZADO
  // ──────────────────────────────────────────────────────────────
  async buildSessionPlan(
    focus: Focus,
    refs: { productRef?: string | null; outfitRef?: string | null; sceneRef?: string | null; sceneText?: string },
    productSize?: ProductSize,
    productIsRelevant?: boolean
  ): Promise<SessionPlan> {
    const plan = await buildUGCSessionPlanFromAnchor(
      "",
      focus,
      refs,
      productSize,
      productIsRelevant
    );
    
    return {
      anchor: plan.sessionTheme,
      productCategory: plan.productCategory,
      shots: plan.shots
    };
  },

  // ──────────────────────────────────────────────────────────────
  // generateImage0 — GENERA REF0 CON PROMPT ESPECÍFICO POR ENFOQUE
  // ──────────────────────────────────────────────────────────────
  async generateImage0(
    faceRef: string,
    productRef: string | null,
    outfitRef: string | null,
    sceneRef: string | null,
    sceneText: string,
    _style: any,
    focus: Focus = 'AVATAR',
    productSize?: ProductSize,
    productIsRelevant?: boolean,
    onStatusChange?: (status: string, image?: string) => void
  ): Promise<{ imageUrl: string; analysis: REF0Analysis }> {
    await this.ensureAccess();

    const useProduct = productIsRelevant !== false;
    // IDENTITY-FIRST: faceRef en posición 0 y 1 para máximo peso de identidad.
    // El modelo siempre leerá las primeras referencias con mayor peso.
    const refsToPass: (string | null)[] = [faceRef, faceRef];
    let promptExtra = '';

    let finalOutfitRef = outfitRef;
    if (!outfitRef && (focus === 'PRODUCT' || focus === 'SCENE' || focus === 'AVATAR')) {
      const category = detectProductCategory(sceneText, productRef);
      const neutralOutfit = await generateNeutralOutfit(focus, category);
      promptExtra += `\nOutfit context: ${neutralOutfit}`;
      finalOutfitRef = null;
    }
    refsToPass.push(finalOutfitRef);

    let finalProductRef = useProduct ? productRef : null;
    if (!finalProductRef && focus === 'PRODUCT') throw new Error("Product reference required for PRODUCT focus");
    refsToPass.push(finalProductRef);

    let finalSceneRef = sceneRef;
    if (!sceneRef && (focus === 'PRODUCT' || focus === 'OUTFIT' || focus === 'AVATAR')) {
      const category = detectProductCategory(sceneText, productRef);
      const neutralScene = await generateNeutralScene(focus, category);
      promptExtra += `\nScene context: ${neutralScene}`;
      finalSceneRef = null;
    }
    refsToPass.push(finalSceneRef);

    const system = `${RULE_PRIORITY_SYSTEM}\n${REF0_ANCHOR_RULE}\n${PARADIGM_RULE}\n${getModeDominance(focus)}`;

    // ── Prompt REF0 diferenciado por enfoque ──────────────────
    const ref0PromptByFocus: Record<Focus, string> = {
      AVATAR: `
CREATE THE ANCHOR IMAGE (REF0) — AVATAR MODE:
UGC iPhone photo. The person IS the hero.
${focus === 'AVATAR' && finalProductRef ? 
  '3/4 shot (waist up). Face dominant (40-50%). Person relaxed and natural.' :
  'Medium shot (waist up). Face is dominant (40-50%). Warm, genuine expression. Mirada directa.'}
Natural environment (real café, street, home — NEVER studio backdrop).
Person looks like a real influencer in their natural habitat.
${promptExtra}`,
      
      OUTFIT: `
CREATE THE ANCHOR IMAGE (REF0) — OUTFIT MODE:
Outfit check photo. Full body visible head to toe.
The OUTFIT is the visual hero. The person wears it with ATTITUDE — NOT a mannequin.
Weight shifted to one hip. Natural stance. Real environment with natural light.
This is a try-on haul moment: the person exists inside the clothes.
${promptExtra}`,
      
      PRODUCT: `
CREATE THE ANCHOR IMAGE (REF0) — PRODUCT MODE:
UGC product review photo. Product and face both clearly visible.
Product is the visual hero. Person shows GENUINE enthusiasm — NOT neutral.
Person holds or presents the product naturally, as if recommending it.
Real lifestyle environment (not studio). Person and product feel authentic.

⚠️ PRODUCT PRIORITY DISAMBIGUATION:
The PRODUCT reference is the item being reviewed/featured. It OVERRIDES the outfit.
If the product reference shows footwear AND the outfit reference also shows footwear:
→ The person WEARS and SHOWS the PRODUCT footwear. The outfit's footwear is IGNORED.
→ The product is what the person is actively presenting, holding, wearing, or demonstrating.
→ The outfit provides clothing context ONLY — it does NOT determine what product is shown.
The product reference is the single source of truth for what object appears as hero.
${promptExtra}`,
      
      SCENE: `
CREATE THE ANCHOR IMAGE (REF0) — SCENE MODE:
Place review / lifestyle photo. The ENVIRONMENT is the hero.
Person is PHYSICALLY PRESENT in the scene — NOT pasted over it.
CRITICAL: The person MUST share the scene's lighting (same direction, color temp, shadows).
Wide enough to show the environment (55-65%) with person naturally placed (35-45%).
The person looks like they genuinely belong in this space.
${promptExtra}`
    };

    const prompt = `
⚠️⚠️⚠️ REFERENCE IMAGE 1 AND 2 ARE THE FACE IDENTITY LOCK. ⚠️⚠️⚠️
The person in THIS IMAGE is the ONLY person allowed in this generation.
Copy their face, bone structure, skin tone, hair color and texture, eye color, and all facial features EXACTLY.
Do NOT substitute this person for any other. Do NOT average with other references.
The face in references 1 and 2 is the GROUND TRUTH identity. NEVER override it.

${ref0PromptByFocus[focus]}

🔒 LOCK SYSTEM:
- FACE: IDENTICAL to face reference (refs 1 and 2). Non-negotiable.
${finalOutfitRef ? '- OUTFIT: IDENTICAL to outfit reference. Same garments, same fit, same color, same fabric.' : ''}
${finalProductRef ? `- PRODUCT: IDENTICAL to product reference. Same exact shape, color, material, design details.
  ${focus === 'PRODUCT' ? '  ⚠️ PRODUCT OVERRIDES OUTFIT: If product and outfit both contain footwear, the person wears and shows the PRODUCT footwear — not the outfit footwear.' : ''}` : ''}
${finalSceneRef ? '- SCENE: IDENTICAL to scene reference. Person shares the scene\'s light.' : ''}

UNIVERSAL RULES:
- Natural iPhone quality. UGC feel. NO studio polish.
- NO beautification. NO skin smoothing. NO editorial softening.
- NO luxury redesign. NO filter overlay.
- Person must look REAL: natural skin texture, genuine expression.
- Person is STATIC (standing still, sitting, or leaning — NOT mid-walk).`;

    const imageUrl = await generateWithPolling(prompt, refsToPass, system, false, undefined, undefined, onStatusChange);
    
    // Analizar REF0 para congelar luz, espacio y acciones
    const imageData = extractImageData(imageUrl);
    let analysis: REF0Analysis;
    
    if (imageData) {
      try {
        analysis = await ugcApiService.analyzeREF0({
          imageData: imageData.data,
          mimeType: imageData.mimeType
        });
      } catch (e) {
        console.warn("[UGC] Error analyzing REF0, using fallback:", e);
        analysis = {
          lighting: { primarySource: "natural light", direction: "from front", colorTemperature: "neutral", shadowType: "soft", intensity: "medium" },
          spatial: { elements: ["wall", "floor"], walls: "neutral wall", floor: "hard floor", geometry: "standard" },
          poseContext: { hasSeating: false, hasLeaningSurface: false, hasTable: false, availableActions: ["standing"] }
        };
      }
    } else {
      analysis = {
        lighting: { primarySource: "natural light", direction: "from front", colorTemperature: "neutral", shadowType: "soft", intensity: "medium" },
        spatial: { elements: ["wall", "floor"], walls: "neutral wall", floor: "hard floor", geometry: "standard" },
        poseContext: { hasSeating: false, hasLeaningSurface: false, hasTable: false, availableActions: ["standing"] }
      };
    }
    
    return { imageUrl, analysis };
  },

  // ──────────────────────────────────────────────────────────────
  // generateDerivedShotAsync — GENERA SHOT DERIVADO CON POLLING
  // ──────────────────────────────────────────────────────────────
  async generateDerivedShotAsync(
    image0: string,
    faceRef: string,
    outfitRef: string | null,
    productRef: string | null,
    sceneRef: string | null,
    _style: any,
    focus: Focus,
    shotKey: ShotKey,
    productSize?: ProductSize,
    sessionPlan?: SessionPlan,
    productIsRelevant?: boolean,
    ref0Analysis?: REF0Analysis,
    shotIndex?: number,
    totalShots?: number,
    onStatusChange?: (status: string, imageUrl?: string) => void
  ): Promise<string> {
    await this.ensureAccess();

    const directive = sessionPlan?.shots?.find(s => s.key === shotKey);
    
    if (!directive) {
      console.warn(`[UGC] No directive found for ${shotKey}, usando fallback`);
      const fallbackPrompt = `
⚠️⚠️⚠️ IDENTITY LOCK — ABSOLUTE PRIORITY ⚠️⚠️⚠️
References 2, 3, and 4 are the FACE IDENTITY. This is the ONLY person allowed.
Copy their face EXACTLY: bone structure, eye color/shape, hair color/texture, skin tone.
Do NOT substitute, average, or replace this person for any reason.

CREATE A NEW PHOTO from the same session as REF0 for ${shotKey}.

ONLY change: framing, distance, angle, interaction, expression.
Keep everything else identical to REF0 and the references.

Same color temperature as REF0. Same ambient light. Same environment.
Natural UGC aesthetic. NO beautification. NO studio polish.`;

      const refs = [image0, faceRef, faceRef, faceRef];
      if (outfitRef) refs.push(outfitRef);
      if (productRef && productIsRelevant !== false) refs.push(productRef);
      if (sceneRef) refs.push(sceneRef);
      
      return generateWithPolling(fallbackPrompt, refs, '', true, shotIndex, totalShots, onStatusChange);
    }

    const directivePrompt = translateDirectiveToPrompt(directive, focus, ref0Analysis);
    const ref0AnalysisBlock = injectREF0Analysis(ref0Analysis);

    const system = `${PARADIGM_RULE}\n${REF0_ANCHOR_RULE}\n${getModeDominance(focus)}`;

    const prompt = `
⚠️⚠️⚠️ IDENTITY LOCK — READ THIS FIRST BEFORE ANYTHING ELSE ⚠️⚠️⚠️

References 2 and 3 in this request are the FACE IDENTITY.
This is the ONLY person permitted in this image.
- Copy their face EXACTLY: bone structure, eye shape, eye color, nose, lips, jaw, chin, brow shape.
- Copy their hair EXACTLY: color, texture, length, wave pattern.
- Copy their skin tone EXACTLY: undertone, warmth, complexion.
- Do NOT average their face with REF0 or any other reference.
- Do NOT substitute a different person even if it seems to "fit" the shot better.
- If the shot role requires a different angle, expression, or distance — keep SAME FACE, change ONLY the angle/expression/distance.
- This constraint has ABSOLUTE priority over every other instruction in this prompt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE A NEW PHOTO FROM THE SAME SESSION AS REF0.

REFERENCE GUIDE:
- REF0 (ref 1): establishes the environment, lighting, and visual world of the session.
- FACE REF (refs 2 and 3): establishes the IDENTITY. This OVERRIDES REF0 for who the person is.
${outfitRef ? '- OUTFIT REF: establishes the exact garments. Must be reproduced identically.' : ''}
${productRef ? '- PRODUCT REF: establishes the exact product. Must be reproduced identically.' : ''}
${sceneRef ? '- SCENE REF: establishes the exact environment. Must be reproduced identically.' : ''}

VISUAL CONTINUITY LOCK (PREVENTS DRIFT):
- Same color temperature as REF0 — do NOT shift warm/cool.
- Same skin tone rendering as REF0 — do NOT lighten or darken.
- Same ambient light quality — do NOT add/remove light sources.
- Same contrast range — do NOT add HDR, drama, or filters.

${outfitRef ? `OUTFIT LOCK:
- The outfit MUST be IDENTICAL to outfitRef. Same garments, same fit, same color, same fabric.
- SHOE SPECIFICITY LOCK: Reproduce the exact shoe design from the outfit reference.
  Same number of straps, same strap routing, same heel shape and height, same toe shape,
  same hardware (buckles, clasps), same material finish (patent, suede, matte), same color.
  Do NOT simplify, reinterpret, or generalize the shoe. It must be recognizably the same shoe.
- For DETAIL shoe shots: ONLY shoe, ankle, floor. NO pant leg. NO invented fabric.
- Tight/opaque/sheer level of hosiery must match outfit reference. Do NOT change color or opacity of tights/stockings.` : ''}
${productRef ? `PRODUCT LOCK:
- The product MUST be IDENTICAL to productRef. Same exact shape, color, material, all design details.
- PRODUCT OVERRIDES OUTFIT for the featured item: if both contain the same item type (e.g. footwear),
  the PRODUCT reference is what the person presents/wears/features. The outfit provides clothing context only.
- Do NOT substitute, reinterpret, or generalize the product. It must be recognizably the same item.` : ''}
${sceneRef ? `SCENE LOCK:\n- The scene MUST be IDENTICAL to sceneRef. NO redesign.\n- Person SHARES the scene's lighting — same direction, same color temp.\n- Person at correct scale relative to scene elements.` : ''}

${ref0AnalysisBlock}

${directivePrompt}

FINAL CHECKLIST (apply before finalizing):
✓ The person's face matches face references (refs 2 and 3) exactly.
✓ The outfit matches outfit reference (if provided) exactly.
✓ The product matches product reference (if provided) exactly.
✓ The scene matches scene/REF0 exactly — no redesign.
✓ Color temperature matches REF0.
✓ NO beautification, NO skin smoothing, NO editorial softening.
✓ Natural UGC iPhone quality — real skin texture, organic lighting.
✓ The shot role is correctly executed (no role mixing).`;

    // IDENTITY-FIRST refs: REF0 primero (establece el mundo visual),
    // luego faceRef TRES veces para que el modelo lo priorice sobre cualquier otra referencia.
    // El número de repeticiones del faceRef compensa el peso que el modelo da a REF0.
    const refs: (string | null)[] = [image0, faceRef, faceRef, faceRef];
    if (outfitRef) refs.push(outfitRef);
    if (productRef && productIsRelevant !== false) refs.push(productRef);
    if (sceneRef) refs.push(sceneRef);
    
    return generateWithPolling(prompt, refs, system, true, shotIndex, totalShots, onStatusChange);
  },

  // ──────────────────────────────────────────────────────────────
  // generateDerivedShot — Versión síncrona legacy
  // ──────────────────────────────────────────────────────────────
  async generateDerivedShot(
    image0: string,
    faceRef: string,
    outfitRef: string | null,
    productRef: string | null,
    sceneRef: string | null,
    _style: any,
    focus: Focus,
    shotKey: ShotKey,
    productSize?: ProductSize,
    sessionPlan?: SessionPlan,
    productIsRelevant?: boolean,
    ref0Analysis?: REF0Analysis
  ): Promise<string> {
    return this.generateDerivedShotAsync(
      image0, faceRef, outfitRef, productRef, sceneRef,
      _style, focus, shotKey, productSize,
      sessionPlan, productIsRelevant, ref0Analysis,
      undefined, undefined, undefined
    );
  },
};