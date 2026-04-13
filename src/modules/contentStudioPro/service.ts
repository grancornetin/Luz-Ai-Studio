import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Style, Focus, ShotKey, ProductSize, ProductCategory, ShotDirective, ShotExclusion, ShotComposition } from './types';
import { buildUGCSessionPlanFromAnchor, detectProductCategory, analyzeProductRelevance } from './ugcDirectorService';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

function cleanBase64(b64: string): string {
  if (!b64) return "";
  return b64.replace(/^data:image\/(png|jpeg|webp);base64,/, "").replace(/\s/g, "");
}

// ===================================================================
// NEGATIVE PROMPT - REFORZADO
// ===================================================================
const NEGATIVE = `
face drift, identity change, different person, different face, different features,
product change, different product, different texture, different color, different shape,
outfit change, different clothing, different color, different pattern,
scene change, different background, different location,
scale distortion, wrong proportions,
walking, mid-stride, running, motion blur,
empty gaze, looking at nothing, staring into void,
unnatural hands, frozen hands, hands without purpose,
catalog pose, runway pose, overly staged,
studio lighting, perfect lighting, artificial look,
plastic skin, CGI look, AI artifacts,
watermark, signature, text overlay, logos,
talking without context, frozen mid-sentence,
new objects not in reference, added elements,
phone visible in selfie, camera visible,
collage, multiple images, grid, side by side,
micro adjustments only, same framing as REF0, identical composition,
overly constructed, rigid, artificial, diagram-like, staged,
static without interaction, mannequin-like, no movement,
similar expressions across shots, repetitive expressions,
same angle across all shots, same pose repeated,
medium shot disguised as detail, face visible in detail shot, full body in detail shot,
weak interaction, minimal hand movement, eye-level only, subtle angle changes,
extra limbs, duplicated arms, phantom hands, broken joints, impossible limb positions,
color drift, different color temperature, different white balance, different saturation,
filters, stylization, instagram filter, edited look, artificial lighting variation,
walking pose, mid-step, exaggerated motion, fake movement, unnatural leg positions,
superficial pose variation, same stance with minor hand variation,
role mixing, detail with face, hero with competition, interaction without action
`;

// ===================================================================
// RULE PRIORITY SYSTEM
// ===================================================================
const RULE_PRIORITY_SYSTEM = `
╔═══════════════════════════════════════════════════════════════════╗
║                    RULE PRIORITY SYSTEM                          ║
╚═══════════════════════════════════════════════════════════════════╝

1️⃣ REF0 CONSISTENCY (HIGHEST - NUNCA VIOLAR)
2️⃣ SHOT ROLE ENFORCEMENT (CRÍTICO - CADA SHOT CON SU ROL)
3️⃣ MODE DOMINANCE (AVATAR/OUTFIT/PRODUCT/SCENE)
4️⃣ FOCUS DOMINANCE
5️⃣ NO COMPETITION
6️⃣ DETAIL EXTREME RULE
7️⃣ SELFIE REQUIREMENT (AVATAR)
8️⃣ INTERACTION RULE
9️⃣ NO ROLE MIXING
🔟 COLOR CONSISTENCY
1️⃣1️⃣ BODY INTEGRITY
1️⃣2️⃣ COMPOSITION DIVERSITY
1️⃣3️⃣ ANTI-SIMILARITY
1️⃣4️⃣ NATURALITY (LOWEST)
`;

// ===================================================================
// LOCK SYSTEM - VERSIÓN FUERTE
// ===================================================================
const LOCK_SYSTEM = `
╔═══════════════════════════════════════════════════════════════════╗
║                    LOCK SYSTEM (NUNCA CAMBIA)                    ║
╚═══════════════════════════════════════════════════════════════════╝

🔒 IDENTITY LOCK:
- Same person. Same face. Same features.
- NO variation allowed. NO face drift.
- The person MUST be IDENTICAL to REF1 (faceRef).

🔒 PRODUCT LOCK:
- Same product. Same materials. Same details.
- Same texture. Same color. Same shape.
- NO changes. NO reinterpretation.

🔒 OUTFIT LOCK:
- Same clothing. Same fit. Same fabric.
- Same color. Same pattern.
- NO changes. NO variation.

🔒 SCENE LOCK:
- Same environment. Same location.
- Same lighting conditions.
- NO relocation. NO changes.

🔒 SCALE LOCK:
- Maintain real-world proportions.
- NO distortion.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CRITICAL - SAME SESSION PARADIGM:
- You are taking a NEW photo of the SAME person, SAME outfit, SAME place.
- Think of yourself as a photographer with a camera, moving around the same scene.
- The person, clothes, product, and location NEVER change.
- Only your camera position, distance, and angle change.
- Do NOT reinterpret the references. Do NOT approximate.

If ANY locked element changes, the output is INVALID.
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
😊 MODE DOMINANCE: AVATAR MODE (DIGITAL INFLUENCER)

CONCEPT: This is a digital influencer's Instagram feed. Each photo tells a story.

PRIORITY ORDER:
1. FACE (MAX priority - must be dominant, expressive, alive)
2. Expression (clear, varied, authentic — NOT empty or mannequin-like)
3. SELFIE (at least ONE per session - MANDATORY)
4. Product (if present: treat as brand collaboration — show it naturally, like an influencer who received a PR package)
5. Outfit (secondary, natural context)

CRITICAL RULES:
- Face must fill 70-80% of frame in CLOSE_UP/EXPRESSION shots
- At least one SELFIE shot (arm visible, handheld phone feel)
- If product is present, include it naturally in INTERACTION and LIFESTYLE shots (like showing it to followers)
- The avatar must feel like a REAL PERSON with personality, not a model
- Think: "this is someone's real Instagram carousel"`;
  }
  
  if (focus === 'OUTFIT') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👔 MODE DOMINANCE: OUTFIT MODE

PRIORITY ORDER:
1. FULL BODY (MAX priority - complete silhouette)
2. Outfit details (texture, fit, styling)
3. Face (optional, secondary)
4. Product (optional, only if complement)

- Full body visibility is REQUIRED for HERO shot
- Composition centered on clothing silhouette
- Detail shots must show fabric, texture, or accessories
- Face may be partially visible but not dominant`;
  }
  
  if (focus === 'PRODUCT') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 MODE DOMINANCE: PRODUCT MODE (REVIEW / UNBOXING)

CONCEPT: An influencer reviewing a product. The product is the hero, but the avatar is the emotional narrator who makes the viewer WANT to buy it.

PRIORITY ORDER:
1. PRODUCT (visual hero — always clearly visible and attractive)
2. AVATAR FACE (emotional narrator — visible and expressive in most shots)
3. Hands (for interaction and demonstration)
4. Environment (context for real-world usage)

CRITICAL RULES:
- Product must be clearly visible in EVERY shot except pure EXPRESSION
- Avatar's FACE must be visible and expressive in at least 4 of 6 shots
- The avatar shows EMOTION: satisfaction, excitement, genuine interest toward the product
- ONLY in DETAIL shots can the face be excluded (extreme product close-up)
- Think: "this is a TikTok product review, the person is showing you why you need this"
- The viewer should feel the DESIRE to buy the product through the avatar's enthusiasm`;
  }
  
  if (focus === 'SCENE') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏞️ MODE DOMINANCE: SCENE MODE (PLACE REVIEW / EXPERIENCE)

CONCEPT: An influencer visiting a restaurant, hotel, spa, or venue and sharing the experience with followers. The space is the star, but the avatar is LIVING the experience.

PRIORITY ORDER:
1. ENVIRONMENT (the place is the main subject)
2. AVATAR EXPERIENCE (the person enjoying, interacting, reacting to the place)
3. Place details (food, decoration, architecture, ambiance)

CRITICAL RULES:
- In WIDE shots: person occupies 25-35% of frame (NOT tiny, NOT dominant)
- In MEDIUM shots: person occupies 40-50%, actively interacting with the space
- Avatar's face and expressions must be visible in at least 3 of 6 shots
- The avatar must show GENUINE enjoyment of the space
- Include at least one DETAIL shot of an attractive element (food, decor, architecture)
- Include at least one EXPRESSION shot showing the avatar's reaction to the place
- Think: "this is an Instagram review of a place — the person is telling you why you should visit"`;
  }
  
  return '';
};

// ===================================================================
// ROLE ENFORCEMENT - REGLAS DURAS POR ROL
// ===================================================================
const getRoleEnforcement = (role: string, focus: Focus): string => {
  if (role === 'HERO') {
    return `
🔴 HERO ROLE ENFORCEMENT (HARD):
- Primary image of the session
- Full composition, clean framing
- Subject fully visible, NO extreme crop
- NO distractions, NO competing elements
- Must be visually dominant
- For OUTFIT: full body visible, outfit is the star
- For AVATAR: face clear, medium shot (waist up), NOT full body wide
- For PRODUCT: product centered and clearly visible, avatar face ALSO visible and expressive
- For SCENE: environment prominent, avatar visible and engaged with the space`;
  }
  
  if (role === 'DETAIL') {
    return `
🔴 DETAIL ROLE ENFORCEMENT (HARD - EXTREME):
- MUST be EXTREME close-up
- Subject fills 80-90% of frame (ABSOLUTE)
- Face is FORBIDDEN (unless product is eyewear)
- Full body is FORBIDDEN
- Background MUST be blurred or absent
- Focus on texture, material, or unique feature
- If it looks like a MEDIUM shot, it is INVALID`;
  }
  
  if (role === 'INTERACTION') {
    return `
🔴 INTERACTION ROLE ENFORCEMENT (HARD):
- Hands MUST be visibly interacting
- Clear action required (adjusting, holding, touching)
- Mid shot framing (upper body + hands)
- Static pose without action is FORBIDDEN
- Interaction must feel natural, not posed
- For OUTFIT: adjusting clothing or touching accessory
- For PRODUCT: holding or demonstrating product
- For AVATAR: natural gesture (touching hair, chin on hand)`;
  }
  
  if (role === 'LIFESTYLE') {
    return `
🔴 LIFESTYLE ROLE ENFORCEMENT:
- Person is STATIC: standing still, sitting, or leaning against something
- Weight on BOTH feet, NOT mid-step, NOT walking
- Legs together or slightly apart, NEVER in stride position
- Context/environment visible
- Subtle movement allowed (head turn, weight shift)
- Authentic, candid feel
- Not overly posed or theatrical`;
  }
  
  if (role === 'ALT_ANGLE') {
    return `
🔴 ALT ANGLE ROLE ENFORCEMENT:
- Camera angle MUST differ from HERO
- Eye-level alone is NOT enough
- Valid: side angle, low angle, high angle, 3/4 profile
- Must change composition significantly
- Subtle angle changes are INVALID`;
  }
  
  if (role === 'EXPRESSION') {
    return `
🔴 EXPRESSION ROLE ENFORCEMENT:
- Face MUST fill 70-80% of frame
- Expression MUST be PERCEPTUALLY DISTINCT from other shots
${focus === 'PRODUCT' ? '- Show genuine emotion TOWARD the product (satisfaction, excitement, delight)' : ''}
${focus === 'SCENE' ? '- Show genuine enjoyment or reaction TO the place (impressed, relaxed, delighted)' : ''}
${focus === 'AVATAR' ? '- Valid: smile, confident, thoughtful, candid, joyful' : ''}
- Subtle micro-expressions are INVALID
- Viewer must identify emotion at a glance`;
  }
  
  if (role === 'SELFIE') {
    return `
🔴 SELFIE ROLE ENFORCEMENT (AVATAR - MANDATORY):
- Camera at arm's length perspective
- Visible: shoulder, up to mid-forearm, face
- Phone/camera MUST NOT be visible
- Handheld camera feel, slight asymmetry allowed
- Third-person perspective is FORBIDDEN
- Full body is FORBIDDEN
- At least ONE selfie per AVATAR session REQUIRED`;
  }
  
  if (role === 'CONTEXT') {
    return `
🔴 CONTEXT ROLE ENFORCEMENT (SCENE):
- Environment MUST be the hero
- Wide shot showing full space
- Person visible and recognizable (25-35% of frame), NOT tiny
- Person should appear engaged with the space, not just standing
- Scene details clearly visible`;
  }
  
  return '';
};

// ===================================================================
// VALIDATION LAYER - CHECKLIST PRE-GENERACIÓN
// ===================================================================
const getValidationChecklist = (directive: ShotDirective, focus: Focus): string => {
  const checks: string[] = [];
  
  checks.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ VALIDATION CHECKLIST (PRE-GENERATION):

Before generating this image, verify:

1. ROLE CLARITY:
   - Is the role ${directive.role} clearly identifiable?
   - Does the image serve ONLY this role?

2. NO ROLE MIXING:
   - Is this ONLY ${directive.role}? Not mixing with other roles?
   - DETAIL should NOT show face
   - HERO should NOT be extreme crop
   - INTERACTION must show clear action

3. MODE CONSISTENCY:
   ${focus === 'AVATAR' ? '- Is face dominant? (AVATAR mode)' : ''}
   ${focus === 'OUTFIT' ? '- Is full body visible? (OUTFIT mode)' : ''}
   ${focus === 'PRODUCT' ? '- Is product the hero? (PRODUCT mode)' : ''}
   ${focus === 'SCENE' ? '- Is environment the hero? (SCENE mode)' : ''}

4. NO ARTIFACTS:
   - No extra limbs, no distorted hands
   - No color shifts, no filters
   - Consistent lighting

5. COMPOSITION DIVERSITY:
   - Different from previous shots
   - Different angle, framing, or interaction

If any check fails, regenerate the image.
`);
  
  return checks.join('\n');
};

// ===================================================================
// FOCUS DOMINANCE RULE
// ===================================================================
const FOCUS_DOMINANCE_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 FOCUS DOMINANCE (CRITICAL):

- AVATAR → Digital influencer. Face and personality dominate. Product shown as collaboration if present.
- PRODUCT → Product review. Product is visual hero, avatar is emotional narrator with visible face.
- OUTFIT → Try-on content. Clothing dominates, avatar models the outfit naturally.
- SCENE → Place review. Environment is hero, avatar is living the experience with genuine reactions.

The avatar is ALWAYS a real person telling a story, never a mannequin or prop.
`;

const NO_COMPETITION_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 NO COMPETITION RULE:

Only ONE element can be visually dominant in each image.
The selected focus MUST be that element.

If any secondary element competes for attention with the main focus,
the output is INVALID.
`;

// ===================================================================
// SHOT TYPE CONSTRAINTS
// ===================================================================
const SHOT_TYPE_CONSTRAINTS = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 SHOT TYPE CONSTRAINTS:

EXTREME_CLOSE:
- Subject fills 80-90% of frame
- Face and full body FORBIDDEN
- Shallow depth of field REQUIRED

CLOSE_UP:
- Subject fills 70-80% of frame
- Background minimal
- Detail visible

MEDIUM:
- Upper body visible
- Person occupies 40-50% of frame
- Interaction visible

WIDE:
- Full body visible
- Person occupies 30-40% of frame
- Environment prominent

SELFIE:
- Arm's length perspective
- Visible: shoulder, up to mid-forearm, face
- Phone NOT visible
`;

// ===================================================================
// COLOR CONSISTENCY RULE
// ===================================================================
const COLOR_CONSISTENCY_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 COLOR CONSISTENCY RULE:

All shots must maintain identical color grading and lighting tone.

Requirements:
- No filters, no stylization
- No variation in warmth, contrast, or saturation
- Colors must match exactly across all images

If any shot appears filtered or stylized, the output is INVALID.
`;

const BODY_INTEGRITY_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧍 BODY INTEGRITY RULE:

The subject must have anatomically correct body structure.

Requirements:
- No extra limbs, duplicated arms, or phantom hands
- No broken joints or impossible limb positions

If any anatomical inconsistency appears, the output is INVALID.
`;

const COMPOSITION_DIVERSITY_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 COMPOSITION DIVERSITY RULE:

Each shot should clearly differ in camera distance and framing.

Prefer:
- Varying crop between shots
- Different subject positioning
- Mix of close, medium, and wide shots
`;

const ANTI_SIMILARITY_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 ANTI-SIMILARITY RULE:

- Do NOT create a visually similar image to REF0
- Each shot should feel like it was taken from a different camera position
`;

const NATURALITY_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌿 NATURALITY RULE:

The image must feel NATURAL, ORGANIC, and REALISTIC.

If the image looks overly constructed, rigid, or artificial, the output is INVALID.
`;

// ===================================================================
// TRADUCIR SHOT DIRECTIVE A PROMPT
// ===================================================================
function translateDirectiveToPrompt(directive: ShotDirective, focus: Focus): string {
  const parts: string[] = [];
  
  // INSTRUCCIÓN ULTRA-DIRECTA PRIMERO según rol
  if (directive.role === 'SELFIE') {
    parts.push(`
🔴🔴🔴 THIS IS A SELFIE SHOT 🔴🔴🔴
The camera is held by the person at arm's length.
FRAMING: Face and upper chest fill 80% of frame.
One arm/shoulder is partially visible (holding the camera).
NO third-person view. NO full body. NO studio composition.
This must look like the person took this photo themselves with their phone.
    `);
  } else if (directive.role === 'DETAIL') {
    parts.push(`
🔴🔴🔴 THIS IS AN EXTREME DETAIL SHOT 🔴🔴🔴
The camera is 10-15cm from the subject.
ONLY texture, fabric, material, or product surface visible.
NO face. NO full body. NO medium shot. NO person visible.
The detail fills 85-90% of the entire frame.
Background is completely blurred or absent.
Think MACRO PHOTOGRAPHY.
    `);
  } else if (directive.role === 'EXPRESSION') {
    parts.push(`
🔴🔴🔴 THIS IS A FACE EXPRESSION SHOT 🔴🔴🔴
Face fills 70-80% of the frame.
Expression must be clearly different from other shots.
Body below shoulders is NOT visible or barely visible.
This is a PORTRAIT, not a medium shot, not a full body shot.
    `);
  } else if (directive.role === 'HERO' && focus === 'AVATAR') {
    parts.push(`
🔴🔴🔴 THIS IS AN AVATAR HERO SHOT 🔴🔴🔴
Person visible from waist up. Face is the dominant element.
NOT full body. NOT wide shot. Medium framing centered on the person.
    `);
  }
  
  parts.push(`SHOT ROLE: ${directive.role}`);
  parts.push(getRoleEnforcement(directive.role, focus));
  parts.push(`FRAMING: ${directive.framing === 'EXTREME_CLOSE' ? 'EXTREME CLOSE-UP - 85-90% FRAME FILL' : directive.framing}`);
  parts.push(`INTENTION: ${directive.purpose}`);
  
  if (directive.exclusion.length > 0) {
    const exclusionText = directive.exclusion.map(e => `EXCLUDE: ${e}`).join('; ');
    parts.push(`EXCLUSIONS: ${exclusionText}`);
  }
  
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
// MOTOR DE GENERACIÓN
// ===================================================================
async function generateWithResilience(
  prompt: string,
  refs: (string | null)[],
  systemInstructions: string
): Promise<string> {
  const ai = getAI();
  const parts: any[] = [];
  let textPrompt = "";
  let imageAdded = false;

  refs.forEach((img, idx) => {
    if (img && img.length > 50 && !imageAdded) {
      textPrompt += `[Image REF${idx} provided]\n`;
      const mimeMatch = img.match(/^data:(image\/(png|jpeg|webp));base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      parts.push({ inlineData: { mimeType, data: cleanBase64(img) } });
      imageAdded = true;
    }
  });

  textPrompt += `${systemInstructions}\n\nTASK:\n${prompt}\n\nNEGATIVE:\n${NEGATIVE}`;
  parts.push({ text: textPrompt });

  const IMAGE_MODELS = ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

  const isRecoverable = (e: any) => {
    const m = e?.message || JSON.stringify(e);
    return ['500', 'INTERNAL', '503', 'UNAVAILABLE', 'high demand', 'overloaded', 'timeout', 'DEADLINE', '429'].some(s => m.includes(s));
  };

  const callModel = (modelId: string) => {
    const config: any = {
      imageConfig: { aspectRatio: "3:4" }
    };
    if (modelId !== 'gemini-2.5-flash-image') {
      config.imageConfig.imageSize = "1K";
    }
    return ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config
    });
  };

  let response: any = null;
  let lastError: any = null;

  for (let mi = 0; mi < IMAGE_MODELS.length; mi++) {
    const max = mi === 0 ? 2 : 1;
    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        console.log(`[UGC] Intentando: ${IMAGE_MODELS[mi]} (intento ${attempt})`);
        response = await callModel(IMAGE_MODELS[mi]);
        break;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || '';
        if (['SAFETY', 'BLOCKED', 'prohibited'].some(s => msg.includes(s))) throw new Error("Content blocked.");
        if (msg.includes('404') || msg.includes('not found')) break;
        if (isRecoverable(err)) {
          if (attempt === max && mi < IMAGE_MODELS.length - 1) break;
          if (attempt < max) await new Promise(r => setTimeout(r, attempt * 2000));
          else if (mi === IMAGE_MODELS.length - 1) throw new Error(`Service unavailable. Details: ${msg}`);
        } else throw new Error(`API Error: ${msg}`);
      }
    }
    if (response) break;
  }

  if (!response) throw lastError || new Error("No image generated");

  const candidate = (response as any).candidates?.[0];
  const img = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);
  if (img?.inlineData?.data) return `data:image/png;base64,${img.inlineData.data}`;
  if (candidate?.finishReason === 'SAFETY') throw new Error("Content blocked.");
  throw new Error("No valid image.");
}

// ===================================================================
// SERVICIO PÚBLICO
// ===================================================================
export interface SessionPlan {
  anchor: string;
  productCategory?: ProductCategory;
  shots: ShotDirective[];
}

export const contentStudioService = {
  async ensureAccess() {
    if (typeof window !== 'undefined' && (window as any).aistudio)
      if (!(await (window as any).aistudio.hasSelectedApiKey()))
        await (window as any).aistudio.openSelectKey();
  },

  async generateImage0(
    faceRef: string,
    productRef: string | null,
    outfitRef: string | null,
    sceneRef: string | null,
    sceneText: string,
    _style: Style,
    focus: Focus = 'AVATAR',
    productSize?: ProductSize,
    productIsRelevant?: boolean
  ): Promise<string> {
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

    const system = `${RULE_PRIORITY_SYSTEM}\n${REF0_ANCHOR_RULE}\n${PARADIGM_RULE}\n${getModeDominance(focus)}\n${FOCUS_DOMINANCE_RULE}\n${NO_COMPETITION_RULE}\n${SHOT_TYPE_CONSTRAINTS}\n${COLOR_CONSISTENCY_RULE}\n${BODY_INTEGRITY_RULE}\n${COMPOSITION_DIVERSITY_RULE}\n${ANTI_SIMILARITY_RULE}\n${NATURALITY_RULE}`;

    const prompt = `
CREATE THE ANCHOR IMAGE (REF0):

This is a SINGLE REALISTIC PHOTO. NOT a collage. NOT multiple images.

CRITICAL - LOCK SYSTEM ACTIVE:
- The person MUST be IDENTICAL to REF1 (faceRef)
- The outfit MUST be IDENTICAL to REF2 (outfitRef if provided)
- The product MUST be IDENTICAL to REF3 (productRef if provided)
- The scene MUST be IDENTICAL to REF4 (sceneRef if provided)

Use EXACTLY these references:
- Person: REF1 (face) - MUST be IDENTICAL
${finalOutfitRef ? '- Outfit: REF2 (clothing) - MUST be EXACT' : promptExtra.includes('Outfit:') ? '- Outfit: ' + promptExtra.match(/Outfit: (.*)/)?.[1] : ''}
${finalProductRef ? '- Product: REF3 - MUST be EXACT' : ''}
${finalSceneRef ? '- Scene: REF4 - MUST be EXACT' : promptExtra.includes('Scene:') ? '- Scene: ' + promptExtra.match(/Scene: (.*)/)?.[1] : ''}

RULES:
${focus === 'AVATAR' ? '- 3rd person perspective. MEDIUM shot (waist up). Face is the dominant element.' : '- 3rd person perspective (NOT selfie). Full body visible.'}
- Person interacts with ${finalProductRef ? 'product' : 'environment'} naturally.
- Person is STATIC (standing still, sitting, or leaning — NOT walking, NOT mid-step).
- Natural lighting, iPhone quality, UGC feel.`;

    return generateWithResilience(prompt, refsToPass, system);
  },

  async generateDerivedShot(
    image0: string,
    faceRef: string,
    focusRef: string | null,
    _style: Style,
    focus: Focus,
    shotKey: ShotKey,
    productSize?: ProductSize,
    sessionPlan?: SessionPlan,
    productIsRelevant?: boolean
  ): Promise<string> {
    await this.ensureAccess();

    const directive = sessionPlan?.shots?.find(s => s.key === shotKey);
    
    if (!directive) {
      console.warn(`[UGC] No directive found for ${shotKey}, usando fallback`);
      const fallbackPrompt = `
CREATE A NEW PHOTO from the same session as REF0 for ${shotKey}.

CRITICAL - SAME SESSION:
- Keep PERSON, PRODUCT, OUTFIT, SCENE IDENTICAL to REF0
- Only change framing, distance, angle, interaction

Natural UGC aesthetic.`;

      return generateWithResilience(fallbackPrompt, [image0, faceRef, focusRef], '');
    }

    const directivePrompt = translateDirectiveToPrompt(directive, focus);

    const system = `${PARADIGM_RULE}\n${REF0_ANCHOR_RULE}\n${getModeDominance(focus)}\n${COLOR_CONSISTENCY_RULE}\n${BODY_INTEGRITY_RULE}`;

    const prompt = `
CREATE A NEW PHOTO FROM THE SAME SESSION AS REF0.

CRITICAL - LOCK SYSTEM ACTIVE:
- The person's face MUST be IDENTICAL to REF0
- The outfit MUST be IDENTICAL to REF0
- The product MUST be IDENTICAL to REF0 (if present)
- The scene MUST be IDENTICAL to REF0

REF0 shows the exact reality. You are taking a different shot of that same reality.

${directivePrompt}

CRITICAL REMINDERS:
- The ${focus.toUpperCase()} must be the VISUAL HERO
- Keep PERSON, PRODUCT, OUTFIT, SCENE identical to REF0
- Only change: framing, distance, angle, interaction, expression
- Natural UGC aesthetic (iPhone quality, organic lighting)
- ⚠️ ROLE ENFORCEMENT CONSTRAINTS ARE MANDATORY
- ⚠️ NO ROLE MIXING - Each image serves ONE role only
- ⚠️ LOCK SYSTEM ACTIVE - NO IDENTITY DRIFT ALLOWED`;

    return generateWithResilience(prompt, [image0, faceRef, focusRef], system);
  },

  buildSessionPlan: buildUGCSessionPlanFromAnchor,
};