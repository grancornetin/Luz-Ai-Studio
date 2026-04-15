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
      text.includes('joya') || text.includes('ring') || text.includes('earring') || text.includes('necklace')) {
    return 'JEWELRY';
  }
  if (text.includes('labial') || text.includes('maquillaje') || text.includes('makeup') || text.includes('lipstick') ||
      text.includes('base') || text.includes('sombras')) {
    return 'MAKEUP';
  }
  if (text.includes('celular') || text.includes('laptop') || text.includes('tech') || text.includes('phone') ||
      text.includes('audifonos') || text.includes('tablet')) {
    return 'TECH';
  }
  if (text.includes('zapatilla') || text.includes('pelota') || text.includes('sports') || text.includes('shoes') ||
      text.includes('tenis') || text.includes('balon')) {
    return 'SPORTS';
  }
  if (text.includes('gorra') || text.includes('bolso') || text.includes('fashion') || text.includes('bag') ||
      text.includes('cinturon') || text.includes('bufanda')) {
    return 'FASHION';
  }
  if (text.includes('mueble') || text.includes('silla') || text.includes('home') || text.includes('furniture') ||
      text.includes('mesa') || text.includes('lampara')) {
    return 'HOME';
  }
  return 'GENERIC';
}

// ===================================================================
// FUNCIONES DE UTILIDAD
// ===================================================================
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

function prepareReferenceImages(refs: (string | null | undefined)[]): Array<{ data: string; mimeType: string }> {
  const result: Array<{ data: string; mimeType: string }> = [];
  
  for (const ref of refs) {
    const extracted = extractImageData(ref);
    if (extracted && extracted.data.length > 64) {
      result.push(extracted);
    }
  }
  
  return result;
}

// ===================================================================
// NEGATIVE PROMPT - REFORZADO CON ANTI-BEAUTIFICATION, ANTI-EDITORIAL, ANTI-DRIFT
// ===================================================================
const NEGATIVE = `
🔴🔴🔴 CRITICAL NEGATIVES - VIOLATION WILL INVALIDATE THE IMAGE 🔴🔴🔴

IDENTITY DRIFT (ABSOLUTELY FORBIDDEN):
different person, different face, different features, different bone structure,
face replacement, identity change, person swap, different ethnicity, different age,
woman replacing man, man replacing woman, different facial structure,
face that does NOT match the face reference EXACTLY

BEAUTIFICATION & EDITORIAL (FORBIDDEN):
beautification, skin smoothing, beauty filter, airbrushed, retouched, perfect skin,
editorial softening, high fashion look, luxury redesign, commercial polish,
professional studio lighting, softbox lighting, glamour lighting,
plastic skin, CGI skin, Instagram filter, FaceTune, porcelain skin,
flawless skin, no pores, wax figure look, mannequin skin

OUTFIT INVENTION (FORBIDDEN IN DETAIL SHOTS):
inventing fabric continuation, fake hem, imaginary pants length, non-existent shorts to pants transition,
adding tela where none exists, reconstructing garment structure beyond visible reference,
inventing shoes, inventing accessories, changing fabric texture, changing color,
altering garment length, adding folds that don't exist, changing silhouette

SCENE REDESIGN (FORBIDDEN):
different background, different location, relocated furniture, different walls, different floor,
added decor not in reference, prettier version of scene, idealized environment,
studio background replacing real scene, CGI background

COMPOSITION VIOLATIONS:
walking, mid-stride, running, motion blur, dynamic movement when static required,
empty gaze, looking at nothing, staring into void, dead eyes,
unnatural hands, frozen hands, hands without purpose, hands not interacting when required,
catalog pose, runway pose, overly staged, model pose, fashion week pose,
talking without context, frozen mid-sentence, open mouth without reason

TECHNICAL ARTIFACTS:
watermark, signature, text overlay, logos, brand names,
collage, multiple images, grid, side by side, before/after,
phone visible in selfie, camera visible, third-person selfie,
extra limbs, duplicated arms, phantom hands, broken joints, impossible limb positions,
color drift, different color temperature, different white balance, different saturation,
filters, stylization, edited look, artificial lighting variation

ROLE MIXING (FORBIDDEN):
detail shot with face visible, hero shot without proper framing,
selfie as third-person portrait, interaction without action,
expression without face dominance, context with person too large
`;

// ===================================================================
// RULE PRIORITY SYSTEM
// ===================================================================
const RULE_PRIORITY_SYSTEM = `
╔═══════════════════════════════════════════════════════════════════╗
║                    RULE PRIORITY SYSTEM                          ║
╚═══════════════════════════════════════════════════════════════════╝

1️⃣ IDENTITY LOCK (HIGHEST - FACE MUST REMAIN IDENTICAL TO FACE REF)
2️⃣ REF0 CONSISTENCY (SECOND - LIGHT, SPACE, ACTIONS FROM REF0)
3️⃣ SHOT ROLE ENFORCEMENT (CRÍTICO - CADA SHOT CON SU ROL ESPECÍFICO)
4️⃣ MODE DOMINANCE (AVATAR/OUTFIT/PRODUCT/SCENE - NUNCA MEZCLAR)
5️⃣ DETAIL EXTREME RULE (NO FACE, NO EXTRA GEOMETRY)
6️⃣ SELFIE PHYSICS (arm-length, handheld, no phone, shoulder visible)
7️⃣ INTERACTION RULE (hands must be doing something)
8️⃣ NO ROLE MIXING (un shot = un rol)
9️⃣ ANTI-BEAUTIFICATION (NO editorial, NO skin smoothing)
🔟 SHOT DIVERSITY (cada shot debe diferir en framing/ángulo/distancia)
`;

// ===================================================================
// LOCK SYSTEM - VERSIÓN FUERTE CON IDENTITY LOCK
// ===================================================================
const LOCK_SYSTEM = `
╔═══════════════════════════════════════════════════════════════════╗
║                    LOCK SYSTEM (NUNCA CAMBIA)                    ║
╚═══════════════════════════════════════════════════════════════════╝

🔒🔒🔒 IDENTITY LOCK (HARD - ABSOLUTE PRIORITY):
- The person's FACE MUST be EXACTLY the same as face reference.
- Same face, same features, same bone structure, same person.
- NO face replacement, NO identity drift, NO different person.
- NO beautification, NO skin smoothing, NO different expression that changes identity.
- The face reference OVERRIDES any other image for identity.

🔒 PRODUCT LOCK:
- Same product. Same materials. Same details.
- Same texture. Same color. Same shape.
- NO changes. NO reinterpretation.

🔒 OUTFIT LOCK:
- Same clothing. Same fit. Same fabric.
- Same color. Same pattern. Same length.
- NO changes. NO invented fabric continuation.
- For DETAIL shots: ONLY show what is visible in reference. NO reconstruction.

🔒 SCENE LOCK (NO REDESIGN):
- Same environment. Same location. Same walls, same floor, same furniture.
- NO idealization, NO added decor, NO prettier version.
- The scene must be IDENTICAL to scene reference.

🔒 SCALE LOCK:
- Maintain real-world proportions.
- NO distortion.
`;

const REF0_ANCHOR_RULE = LOCK_SYSTEM;

// ===================================================================
// PARADIGM RULE
// ===================================================================
const PARADIGM_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 PARADIGM (CRITICAL):

You are NOT editing REF0.
You are capturing a NEW photograph from the SAME moment as REF0.

REF0 defines the reality. You are taking a different shot of that same reality.

Do NOT produce a slightly modified version of REF0.
Each image must feel like a new photograph taken by a photographer.
`;

// ===================================================================
// MODE DOMINANCE (CRÍTICO - POR ENFOQUE)
// ===================================================================
const getModeDominance = (focus: Focus): string => {
  if (focus === 'AVATAR') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
😊 MODE DOMINANCE: AVATAR MODE (DIGITAL INFLUENCER - FACE DOMINANT)

CRITICAL RULES:
- FACE is the ABSOLUTE HERO in EVERY shot.
- MAXIMUM 1 full body shot per session.
- SELFIE is MANDATORY (at least 1, with physical arm evidence).
- Outfit, accessories, product are SECONDARY background only.
- No detail shot of outfit as main subject.

COMPOSITION LIMITS:
- At least 2 face-led shots (expression, close-up, selfie)
- SELFIE must show: arm extended, shoulder visible, handheld feel
- HERO: medium shot (waist up), face dominant
- LIFESTYLE: person visible, but face remains clear
- FORBIDDEN: outfit detail shots, accessory-led shots, full-body hero

PRIORITY ORDER:
1. FACE (dominant, expressive, alive, identical to faceRef)
2. Expression (clear, varied, authentic)
3. SELFIE (mandatory, with arm evidence)
4. Product/Outfit (secondary, background only)

FORBIDDEN in AVATAR mode:
- Detail shots of belt, bag, shoes as main subject
- Outfit dominating the frame
- More than 1 full-body wide shot
- Face not clearly visible in expression/selfie shots
- Any shot where outfit competes with face for attention
`;
  }
  
  if (focus === 'OUTFIT') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👔 MODE DOMINANCE: OUTFIT MODE (CLOTHING DOMINANT)

CRITICAL RULES:
- OUTFIT is the ABSOLUTE HERO in EVERY shot.
- Face is secondary, can be cropped or partially visible.
- Full body visibility is REQUIRED for HERO shot.
- DETAIL shots must show ONLY the target (shoe, fabric, accessory)
- NO inventing fabric continuation beyond what is visible

DETAIL SHOT RULES (CRITICAL):
- DETAIL + shoe: ONLY shoe, ankle, floor. NO pant leg, NO hem, NO fabric continuation.
- DETAIL + fabric: ONLY texture, NO full garment, NO face, NO body.
- DETAIL + accessory: ONLY the accessory, NO surrounding garment.
- DO NOT reconstruct garment structure. Only show what exists.

PRIORITY ORDER:
1. FULL BODY (complete silhouette, outfit clearly visible)
2. Outfit details (texture, fit, styling - target only)
3. Face (optional, secondary, may be cropped)
4. Product (only if complement)

REQUIRED:
- One HERO full-body shot showing entire outfit
- Detail shots with EXTREME CROP (85-90% frame fill)
- No face in detail shots unless role is EXPRESSION
`;
  }
  
  if (focus === 'PRODUCT') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 MODE DOMINANCE: PRODUCT MODE (REVIEW / UNBOXING)

CRITICAL RULES:
- PRODUCT is the visual hero.
- Avatar's FACE must be visible and expressive in at least 4 of 6 shots.
- The avatar shows genuine emotion toward the product.

PRIORITY ORDER:
1. PRODUCT (clearly visible, attractive, identical to productRef)
2. AVATAR FACE (emotional narrator, identical to faceRef)
3. Hands (interaction with product)
4. Environment (context)

REQUIRED:
- Hero shot: product and face both visible
- Expression shots showing positive emotion
- Detail shots of product texture (no face)
- Lifestyle shot with product in use
`;
  }
  
  if (focus === 'SCENE') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏞️ MODE DOMINANCE: SCENE MODE (PLACE REVIEW - NO REDESIGN)

CRITICAL RULES:
- ENVIRONMENT is the hero.
- NO redesign, NO idealization, NO added furniture.
- The space must be IDENTICAL to scene reference.

PRIORITY ORDER:
1. ENVIRONMENT (exactly as in reference)
2. AVATAR EXPERIENCE (person enjoying, reacting)
3. Place details (as they are, not embellished)

REQUIRED:
- Wide shot: person occupies 25-35% of frame
- Avatar's face visible and expressive
- Detail shot of authentic element (no beautification)
- Expression shot showing genuine enjoyment
`;
  }
  
  return '';
};

// ===================================================================
// ROLE ENFORCEMENT - REGLAS DURAS POR ROL
// ===================================================================
const getRoleEnforcement = (role: string, focus: Focus, detailTarget?: string): string => {
  if (role === 'HERO') {
    if (focus === 'AVATAR') {
      return `
🔴 HERO ROLE ENFORCEMENT (AVATAR):
- MEDIUM shot (waist up), NOT full body wide
- Face MUST be clear, dominant, expressive
- Outfit is secondary, NOT competing
- NO extreme crop, NO full body as hero
- Face takes 40-50% of frame`;
    }
    if (focus === 'OUTFIT') {
      return `
🔴 HERO ROLE ENFORCEMENT (OUTFIT):
- FULL BODY visible head to toe
- Outfit is the ONLY visual hero
- Face may be visible but secondary (max 15% of frame)
- Composition centered on clothing silhouette
- No face dominance, no expression focus`;
    }
    if (focus === 'PRODUCT') {
      return `
🔴 HERO ROLE ENFORCEMENT (PRODUCT):
- Product and face both visible
- Product is visually dominant
- Avatar's face shows positive expression
- Clean composition, no distractions`;
    }
    return `
🔴 HERO ROLE ENFORCEMENT:
- Primary image of the session
- Subject fully visible, NO extreme crop
- NO distractions, NO competing elements`;
  }
  
  if (role === 'SELFIE') {
    return `
🔴 SELFIE ROLE ENFORCEMENT (HARD PHYSICS - AUTHENTIC ONLY):
- Camera held at arm's length by the person
- Visible: shoulder, elbow, up to mid-forearm, face
- Phone/camera MUST NOT be visible (it's the POV)
- Handheld framing, slight asymmetry, slight lens distortion allowed
- NO third-person perspective, NO full body
- This is NOT a portrait taken by someone else
- Slight imperfections, natural skin texture, NO beautification
- The person's arm MUST be visible in the frame
- Shoulder MUST be visible at bottom of frame
- Feels like a real person taking a selfie, not a professional photo`;
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
🔴 DETAIL ROLE ENFORCEMENT (OUTFIT - SHOE):
- EXTREME close-up of SHOE ONLY
- Frame fill: 85-90% shoe, ankle, floor
- FORBIDDEN: pant leg, hem, fabric continuation, shorts, pants
- DO NOT invent clothing above the shoe
- If reference shows shorts, do NOT add pant leg
- The shoe detail shows ONLY what exists in the reference
- NO reconstruction of garment structure`;
    }
    return `
🔴 DETAIL ROLE ENFORCEMENT (HARD):
- EXTREME close-up
- Subject fills 85-90% of frame (ABSOLUTE)
- Face is FORBIDDEN (unless detail target is face)
- Full body is FORBIDDEN
- Background MUST be blurred or absent
- If it looks like a MEDIUM shot, it is INVALID
- For clothing details: ONLY show the target (fabric, texture, accessory)
- DO NOT invent garment structure beyond what is visible
- DO NOT add hems, seams, or fabric that doesn't exist in reference`;
  }
  
  if (role === 'INTERACTION') {
    return `
🔴 INTERACTION ROLE ENFORCEMENT (HARD):
- Hands MUST be visibly interacting
- Clear action required (adjusting, holding, touching, using)
- Mid shot framing (upper body + hands)
- Static pose without action is FORBIDDEN
- Face should be visible and engaged with the action`;
  }
  
  if (role === 'EXPRESSION') {
    return `
🔴 EXPRESSION ROLE ENFORCEMENT:
- Face MUST fill 70-80% of frame
- Expression MUST be PERCEPTUALLY DISTINCT from other shots
- NO beautification, NO skin smoothing, NO retouching
- Viewer must identify emotion at a glance
- Natural skin texture, pores, imperfections allowed
- This is a REAL PERSON expressing emotion, not a model`;
  }
  
  if (role === 'LIFESTYLE') {
    return `
🔴 LIFESTYLE ROLE ENFORCEMENT:
- Person is STATIC: standing still, sitting, or leaning
- Weight on BOTH feet, NOT mid-step, NOT walking
- Context/environment visible
- Authentic, candid feel
- Face should be visible and natural
- NO editorial posing, NO fashion walk`;
  }
  
  if (role === 'ALT_ANGLE') {
    return `
🔴 ALT ANGLE ROLE ENFORCEMENT:
- Camera angle MUST differ significantly from HERO
- Eye-level alone is NOT enough
- Valid: side angle (45-90°), low angle (from below), high angle (from above), 3/4 profile
- Subtle angle changes (5-10°) are INVALID
- The shot must feel perceptually different`;
  }
  
  if (role === 'CONTEXT') {
    return `
🔴 CONTEXT ROLE ENFORCEMENT (SCENE):
- Environment is the hero, exactly as in scene reference
- NO redesign, NO added furniture, NO beautification
- Person visible (25-35% of frame), engaged with space
- Scene details must match scene reference exactly
- Person is a guest in the space, not the focus`;
  }
  
  return '';
};

// ===================================================================
// SHOT DIVERSITY ENFORCEMENT
// ===================================================================
const getShotDiversityRule = (shotKey: string, role: string): string => {
  return `
🔴 SHOT DIVERSITY REQUIREMENT:
- This shot (${shotKey}) must be PERCEPTUALLY DIFFERENT from other shots in the session
- Change at least ONE of: distance, framing, angle, role, interaction type
- Do NOT produce a slightly modified version of another shot
- Each image should feel like a different photograph, not a sequence of micro-adjustments
- If this is an ALT_ANGLE shot, the angle must be SIGNIFICANTLY different (≥30° difference)
- If this is an EXPRESSION shot, the emotion must be CLEARLY different from other expression shots
- If this is a DETAIL shot, the target must be UNIQUE (not repeating another detail shot)
`;
};

// ===================================================================
// INYECTAR REF0 ANALYSIS EN PROMPT
// ===================================================================
const injectREF0Analysis = (analysis: REF0Analysis | undefined): string => {
  if (!analysis) return '';
  
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 REF0 ANALYSIS (LOCKED - DO NOT CHANGE):

LIGHTING (must remain IDENTICAL):
- Primary source: ${analysis.lighting.primarySource}
- Direction: ${analysis.lighting.direction}
- Color temperature: ${analysis.lighting.colorTemperature}
- Shadow type: ${analysis.lighting.shadowType}
- Intensity: ${analysis.lighting.intensity}

SPATIAL (must remain IDENTICAL - NO REDESIGN):
- Elements: ${analysis.spatial.elements.join(', ')}
- Walls: ${analysis.spatial.walls}
- Floor: ${analysis.spatial.floor}
- Geometry: ${analysis.spatial.geometry}

POSSIBLE ACTIONS (stay within these):
- ${analysis.poseContext.availableActions.join(', ')}

CRITICAL: Do NOT change lighting, do NOT redesign the space, do NOT add new furniture.
The environment must look exactly as in REF0.
`;
};

// ===================================================================
// TRADUCIR SHOT DIRECTIVE A PROMPT - VERSIÓN REFORZADA
// ===================================================================
function translateDirectiveToPrompt(directive: ShotDirective, focus: Focus, ref0Analysis?: REF0Analysis): string {
  const parts: string[] = [];
  
  // SELFIE - física real, no selfie bonita
  if (directive.role === 'SELFIE') {
    parts.push(`
🔴🔴🔴 THIS IS AN AUTHENTIC SELFIE - PHYSICAL RULES 🔴🔴🔴
- The person holds the camera at arm's length.
- Visible in frame: shoulder, elbow, up to mid-forearm, full face.
- Phone/camera is NOT visible (it's the viewer's POV).
- Handheld framing: slight asymmetry, natural imperfection, slight lens distortion.
- NO third-person view. NO full body. NO professional portrait.
- The arm extending from bottom/side of frame MUST be visible.
- Shoulder visible at bottom edge.
- This feels like a real person taking a selfie, not a staged photo.
- NO beautification, NO skin smoothing, NO studio lighting.`);
  } 
  // DETAIL - extremo, sin invención de geometría
  else if (directive.role === 'DETAIL') {
    const target = directive.detailTarget || 'texture';
    if (target === 'shoe') {
      parts.push(`
🔴🔴🔴 EXTREME SHOE DETAIL - NO FABRIC INVENTION 🔴🔴🔴
- Camera distance: 10-15cm from the shoe.
- ONLY visible: shoe, ankle, floor/ground.
- FORBIDDEN: pant leg, hem, shorts, fabric continuation, fake clothing.
- DO NOT invent tela, DO NOT add pants where none exist.
- If reference shows shorts, the shoe detail shows shorts ending above shoe - NO pant leg added.
- The shoe fills 85-90% of frame.
- NO face. NO full body. NO upper body.
- This is a PRODUCT/SHOE detail, not a clothing detail.`);
    } else if (target === 'fabric' || target === 'texture') {
      parts.push(`
🔴🔴🔴 EXTREME FABRIC DETAIL - TEXTURE ONLY 🔴🔴🔴
- Camera distance: 10-15cm from the fabric.
- ONLY texture, weave, material surface visible.
- NO garment silhouette, NO full clothing item, NO face, NO body.
- The fabric fills 85-90% of frame.
- Background completely blurred or absent.
- This is MATERIAL texture, not clothing styling.`);
    } else {
      parts.push(`
🔴🔴🔴 EXTREME DETAIL SHOT - TARGET: ${target} 🔴🔴🔴
- Camera distance: 10-15cm from the target.
- ONLY the target (${target}) fills 85-90% of frame.
- NO face. NO full body. NO surrounding elements.
- NO invention of non-existent geometry.
- Background blurred or absent.`);
    }
  } 
  // EXPRESSION - cara domina, sin beautification
  else if (directive.role === 'EXPRESSION') {
    parts.push(`
🔴🔴🔴 AUTHENTIC FACE EXPRESSION - NO BEAUTIFICATION 🔴🔴🔴
- Face fills 70-80% of frame.
- Expression must be clearly different from other shots.
- Natural skin texture, pores, imperfections visible and ALLOWED.
- NO beautification, NO skin smoothing, NO retouching.
- NO studio lighting, NO softbox.
- This is a REAL PERSON expressing genuine emotion.
- The face MUST be IDENTICAL to face reference.`);
  } 
  // HERO según modo
  else if (directive.role === 'HERO') {
    if (focus === 'AVATAR') {
      parts.push(`
🔴🔴🔴 AVATAR HERO SHOT - FACE DOMINANT 🔴🔴🔴
- MEDIUM shot (waist up). NOT full body.
- Face takes 40-50% of frame - CLEAR, DOMINANT, EXPRESSIVE.
- Outfit is secondary background only.
- Person's expression and presence are the focus.
- NO outfit competition, NO accessory focus.
- The face MUST be IDENTICAL to face reference.`);
    } else if (focus === 'OUTFIT') {
      parts.push(`
🔴🔴🔴 OUTFIT HERO SHOT - CLOTHING DOMINANT 🔴🔴🔴
- FULL BODY visible head to toe.
- The outfit is the ONLY visual hero.
- Face may be visible but secondary (max 15% of frame).
- Show complete silhouette, fit, drape.
- The outfit MUST be IDENTICAL to outfit reference.`);
    } else if (focus === 'PRODUCT') {
      parts.push(`
🔴🔴🔴 PRODUCT HERO SHOT - PRODUCT DOMINANT 🔴🔴🔴
- Product and face both visible.
- Product is visually dominant (40-50% of frame).
- Avatar's face shows positive expression (20-30% of frame).
- The product MUST be IDENTICAL to product reference.`);
    }
  }
  // INTERACTION
  else if (directive.role === 'INTERACTION') {
    parts.push(`
🔴🔴🔴 INTERACTION SHOT - HANDS IN ACTION 🔴🔴🔴
- Hands MUST be visibly interacting with something.
- Clear action: adjusting, holding, touching, using, demonstrating.
- Mid shot framing: upper body + hands visible.
- Face visible and engaged with the action.
- Static pose without interaction is FORBIDDEN.
- NO frozen hands, NO purposeless hand placement.`);
  }
  // LIFESTYLE
  else if (directive.role === 'LIFESTYLE') {
    parts.push(`
🔴🔴🔴 LIFESTYLE SHOT - AUTHENTIC MOMENT 🔴🔴🔴
- Person is STATIC: standing still, sitting, or leaning.
- NOT walking, NOT mid-step, NOT in motion.
- Context/environment visible around the person.
- Authentic, candid feel - NOT editorial.
- Face visible with natural expression.
- Person occupies 40-50% of frame, environment the rest.`);
  }
  // ALT_ANGLE
  else if (directive.role === 'ALT_ANGLE') {
    parts.push(`
🔴🔴🔴 ALTERNATE ANGLE - SIGNIFICANTLY DIFFERENT 🔴🔴🔴
- Camera angle MUST differ significantly from HERO shot.
- Valid options: side angle (45-90°), low angle (from below), high angle (from above), 3/4 profile.
- Eye-level alone is NOT sufficient (needs ≥30° difference).
- Same subject, different perspective.
- This is NOT a micro-adjustment.`);
  }
  
  // Agregar reglas base
  parts.push(`SHOT ROLE: ${directive.role}`);
  parts.push(getRoleEnforcement(directive.role, focus, directive.detailTarget));
  parts.push(getShotDiversityRule(directive.key, directive.role));
  parts.push(`FRAMING: ${directive.framing === 'EXTREME_CLOSE' ? 'EXTREME CLOSE-UP - 85-90% FRAME FILL' : directive.framing}`);
  parts.push(`INTENTION: ${directive.purpose}`);
  
  if (directive.requiredElements.length > 0) {
    parts.push(`REQUIRED ELEMENTS: ${directive.requiredElements.join(', ')}`);
  }
  
  if (directive.forbiddenElements.length > 0) {
    parts.push(`FORBIDDEN ELEMENTS: ${directive.forbiddenElements.join(', ')}`);
  }
  
  if (directive.exclusion.length > 0) {
    const exclusionText = directive.exclusion.map(e => `EXCLUDE: ${e}`).join('; ');
    parts.push(`EXCLUSIONS: ${exclusionText}`);
  }
  
  // Face lock adicional para todos los shots
  parts.push(`
🔒🔒🔒 FACE IDENTITY LOCK 🔒🔒🔒
- The person's face MUST be EXACTLY the same as the face reference.
- NO face replacement. NO identity drift. NO different person.
- The face reference OVERRIDES any other image for identity.
- This is NON-NEGOTIABLE.`);
  
  return parts.join('\n');
}

// ===================================================================
// GENERAR FONDO NEUTRO
// ===================================================================
async function generateNeutralScene(focus: Focus, productCategory?: ProductCategory): Promise<string> {
  if (focus === 'PRODUCT') {
    if (productCategory === 'JEWELRY') return 'Elegant vanity with mirror, soft natural window light, warm and cozy atmosphere, UGC style';
    if (productCategory === 'MAKEUP') return 'Clean bathroom vanity with natural light, modern minimalist style, UGC beauty content';
    if (productCategory === 'TECH') return 'Modern desk with natural window light, clean organized workspace, UGC tech lifestyle';
    if (productCategory === 'SPORTS') return 'Gym or sports environment, natural lighting, dynamic but calm atmosphere, UGC sports content';
    if (productCategory === 'FASHION') return 'Walk-in closet with mirror, natural light, stylish and organized, UGC fashion content';
    return 'Clean lifestyle space, natural window light, cozy atmosphere, UGC content style';
  }
  if (focus === 'OUTFIT') return 'Modern walk-in closet or dressing room with natural light, clean background, UGC fashion content';
  if (focus === 'AVATAR') return 'Cozy living space with natural window light, relaxed atmosphere, UGC lifestyle content';
  return 'Clean lifestyle space, natural light, UGC content style';
}

async function generateNeutralOutfit(focus: Focus, productCategory?: ProductCategory): Promise<string> {
  if (focus === 'PRODUCT') {
    if (productCategory === 'JEWELRY') return 'Elegant casual outfit that complements jewelry, neutral colors, soft fabrics, UGC style';
    if (productCategory === 'MAKEUP') return 'Clean natural look, simple top, neutral colors, UGC beauty style';
    if (productCategory === 'TECH') return 'Casual modern outfit, comfortable style, UGC tech lifestyle';
    if (productCategory === 'SPORTS') return 'Athletic casual wear, comfortable and sporty, UGC sports style';
    return 'Casual comfortable outfit, neutral colors, UGC lifestyle style';
  }
  if (focus === 'SCENE') return 'Casual outfit appropriate for the scene, natural and comfortable, UGC style';
  return 'Casual comfortable outfit, neutral colors, UGC lifestyle style';
}

// ===================================================================
// MOTOR DE GENERACIÓN (usa ugcApiService)
// ===================================================================
async function generateWithResilience(
  prompt: string,
  refs: (string | null)[],
  systemInstructions: string
): Promise<string> {
  const referenceImages = prepareReferenceImages(refs);
  
  const fullPrompt = `${systemInstructions}\n\nTASK:\n${prompt}\n\nNEGATIVE:\n${NEGATIVE}`;
  
  return ugcApiService.generateImage0({
    prompt: fullPrompt,
    referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    aspectRatio: '3:4',
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
    // No-op - autenticación en el servidor
  },

  // ──────────────────────────────────────────────────────────────
  // buildSessionPlan - USA EL DIRECTOR AVANZADO
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
  // generateImage0 - GENERA REF0 Y ANALIZA LUZ/ESPACIO
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
    productIsRelevant?: boolean
  ): Promise<{ imageUrl: string; analysis: REF0Analysis }> {
    await this.ensureAccess();

    const useProduct = productIsRelevant !== false;
    const refsToPass: (string | null)[] = [faceRef];
    let promptExtra = '';

    let finalOutfitRef = outfitRef;
    if (!outfitRef && (focus === 'PRODUCT' || focus === 'SCENE' || focus === 'AVATAR')) {
      const category = detectProductCategory(sceneText, productRef);
      const neutralOutfit = await generateNeutralOutfit(focus, category);
      promptExtra += `\nOutfit: ${neutralOutfit}`;
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
      promptExtra += `\nScene: ${neutralScene}`;
      finalSceneRef = null;
    }
    refsToPass.push(finalSceneRef);

    const system = `${RULE_PRIORITY_SYSTEM}\n${REF0_ANCHOR_RULE}\n${PARADIGM_RULE}\n${getModeDominance(focus)}`;

    const prompt = `
CREATE THE ANCHOR IMAGE (REF0):

This is a SINGLE REALISTIC PHOTO. NOT a collage. NOT multiple images.

🔒 CRITICAL - LOCK SYSTEM ACTIVE:
- The person's FACE MUST be IDENTICAL to face reference. NO face replacement.
- The outfit MUST be IDENTICAL to outfit reference (if provided)
- The product MUST be IDENTICAL to product reference (if provided)
- The scene MUST be IDENTICAL to scene reference (if provided)

RULES:
${focus === 'AVATAR' ? '- 3rd person perspective. MEDIUM shot (waist up). Face is the dominant element (40-50% of frame).' : '- 3rd person perspective (NOT selfie). Full body visible.'}
- Person interacts with ${finalProductRef ? 'product' : 'environment'} naturally.
- Person is STATIC (standing still, sitting, or leaning — NOT walking, NOT mid-step).
- Natural lighting, iPhone quality, UGC feel.
- NO beautification, NO skin smoothing, NO studio look.
- NO editorial softening, NO luxury redesign.
- The face MUST look like a real person, not a filtered model.`;

    const imageUrl = await generateWithResilience(prompt, refsToPass, system);
    
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
  // generateDerivedShot - RECIBE TODAS LAS REFERENCIAS Y USA REF0Analysis
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
    await this.ensureAccess();

    const directive = sessionPlan?.shots?.find(s => s.key === shotKey);
    
    if (!directive) {
      console.warn(`[UGC] No directive found for ${shotKey}, usando fallback`);
      const fallbackPrompt = `
CREATE A NEW PHOTO from the same session as REF0 for ${shotKey}.

🔒 CRITICAL - SAME SESSION:
- Keep PERSON'S FACE IDENTICAL to faceRef (NO face replacement)
- Keep PRODUCT, OUTFIT, SCENE IDENTICAL to REF0
- Only change framing, distance, angle, interaction

Natural UGC aesthetic. NO beautification.`;

      const refs = [image0, faceRef, faceRef]; // faceRef duplicado para reforzar
      if (outfitRef) refs.push(outfitRef);
      if (productRef && productIsRelevant !== false) refs.push(productRef);
      if (sceneRef) refs.push(sceneRef);
      
      return generateWithResilience(fallbackPrompt, refs, '');
    }

    const directivePrompt = translateDirectiveToPrompt(directive, focus, ref0Analysis);
    const ref0AnalysisBlock = injectREF0Analysis(ref0Analysis);

    const system = `${PARADIGM_RULE}\n${REF0_ANCHOR_RULE}\n${getModeDominance(focus)}`;

    const prompt = `
CREATE A NEW PHOTO FROM THE SAME SESSION AS REF0.

🔒🔒🔒 CRITICAL - LOCK SYSTEM ACTIVE (NON-NEGOTIABLE):

IDENTITY LOCK:
- The person's FACE MUST be IDENTICAL to faceRef.
- The faceRef OVERRIDES any other image for identity.
- NO face drift, NO face replacement, NO different person.

PRODUCT LOCK (if productRef exists):
- The product MUST be IDENTICAL to productRef.

OUTFIT LOCK (if outfitRef exists):
- The outfit MUST be IDENTICAL to outfitRef.
- For DETAIL shoe shots: ONLY shoe, ankle, floor. NO pant leg, NO fabric continuation.

SCENE LOCK (if sceneRef exists):
- The scene MUST be IDENTICAL to sceneRef.
- NO redesign, NO added furniture, NO beautification.

${ref0AnalysisBlock}

${directivePrompt}

CRITICAL REMINDERS:
- The ${focus.toUpperCase()} must be the VISUAL HERO according to MODE DOMINANCE
- Keep PERSON'S FACE, PRODUCT, OUTFIT, SCENE identical to references
- Only change: framing, distance, angle, interaction, expression
- NO beautification, NO skin smoothing, NO studio polish, NO editorial softening
- NO face replacement, NO identity drift
- Natural UGC aesthetic (iPhone quality, organic lighting, slight imperfections allowed)
- ⚠️ ROLE ENFORCEMENT CONSTRAINTS ARE MANDATORY
- ⚠️ NO ROLE MIXING - Each image serves ONE role only
- ⚠️ LOCK SYSTEM ACTIVE - NO IDENTITY DRIFT, NO SCENE REDESIGN, NO FABRIC INVENTION`;

    // Duplicar faceRef para reforzar el lock de identidad
    const refs: (string | null)[] = [image0, faceRef, faceRef];
    if (outfitRef) refs.push(outfitRef);
    if (productRef && productIsRelevant !== false) refs.push(productRef);
    if (sceneRef) refs.push(sceneRef);
    
    return generateWithResilience(prompt, refs, system);
  },
};