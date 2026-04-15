import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Style, Focus, ShotKey, ProductSize, ProductCategory, ShotDirective, ShotExclusion, ShotComposition, REF0Analysis } from './types';
import { buildUGCSessionPlanFromAnchor, detectProductCategory, analyzeProductRelevance, analyzeREF0 } from './ugcDirectorService';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

function cleanBase64(b64: string): string {
  if (!b64) return "";
  return b64.replace(/^data:image\/(png|jpeg|webp);base64,/, "").replace(/\s/g, "");
}

// ===================================================================
// NEGATIVE PROMPT - REFORZADO CON ANTI-BEAUTIFICATION Y ANTI-EDITORIAL
// ===================================================================
const NEGATIVE = `
face drift, identity change, different person, different face, different features,
product change, different product, different texture, different color, different shape,
outfit change, different clothing, different color, different pattern,
scene change, different background, different location, relocated furniture, different walls,
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
role mixing, detail with face, hero with competition, interaction without action,
beautification, skin smoothing, beauty filter, airbrushed, retouched, perfect skin,
editorial softening, high fashion, luxury redesign, redesigned furniture, added decor,
idealized scene, prettier than original, different spatial layout,
face not dominant in avatar mode, outfit detail dominating avatar,
face dominant in outfit mode,
selfie with phone visible, selfie as third-person portrait,
beauty pass, commercial look, professional studio feel, unnatural perfection
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
7️⃣ SELFIE PHYSICS (arm-length, handheld, no phone)
8️⃣ INTERACTION RULE
9️⃣ NO ROLE MIXING
🔟 COLOR CONSISTENCY
1️⃣1️⃣ BODY INTEGRITY
1️⃣2️⃣ COMPOSITION DIVERSITY
1️⃣3️⃣ ANTI-SIMILARITY
1️⃣4️⃣ NATURALITY (LOWEST)
`;

// ===================================================================
// LOCK SYSTEM - VERSIÓN FUERTE CON IDENTITY LOCK
// ===================================================================
const LOCK_SYSTEM = `
╔═══════════════════════════════════════════════════════════════════╗
║                    LOCK SYSTEM (NUNCA CAMBIA)                    ║
╚═══════════════════════════════════════════════════════════════════╝

🔒 IDENTITY LOCK (HARD):
- The person MUST be EXACTLY the same as REF1 (faceRef).
- Same face, same features, same bone structure.
- NO beautification, NO skin smoothing, NO different person.
- NO reinterpretation, NO approximation.

🔒 PRODUCT LOCK:
- Same product. Same materials. Same details.
- Same texture. Same color. Same shape.
- NO changes. NO reinterpretation.

🔒 OUTFIT LOCK:
- Same clothing. Same fit. Same fabric.
- Same color. Same pattern.
- NO changes. NO variation.

🔒 SCENE LOCK (NO REDESIGN):
- Same environment. Same location. Same walls, same floor, same furniture.
- NO idealization, NO added decor, NO prettier version.
- The scene must be IDENTICAL to REF4.

🔒 SCALE LOCK:
- Maintain real-world proportions.
- NO distortion.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CRITICAL - SAME SESSION PARADIGM:
- You are taking a NEW photo of the SAME person, SAME outfit, SAME product, SAME place.
- Think of yourself as a photographer with a phone, moving around the same scene.
- The person, clothes, product, and location NEVER change.
- Only your camera position, distance, and angle change.
- Do NOT reinterpret, do NOT beautify, do NOT redesign.

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
😊 MODE DOMINANCE: AVATAR MODE (DIGITAL INFLUENCER - FACE DOMINANT)

CRITICAL RULES:
- FACE is the ABSOLUTE HERO in EVERY shot.
- No outfit detail shot should dominate over the face.
- No accessory should be the main subject.
- The person's presence, expression, and personality are the focus.

PRIORITY ORDER:
1. FACE (dominant, expressive, alive)
2. Expression (clear, varied, authentic)
3. SELFIE (at least ONE per session - MANDATORY, with arm evidence)
4. Product (if present: brand collaboration, shown naturally)
5. Outfit (secondary, background context only)

FORBIDDEN in AVATAR mode:
- Detail shots of belt, bag, shoes as main subject
- Outfit dominating the frame
- Full-body wide shots as hero (only as lifestyle context)
- Face not clearly visible in expression/selfie shots

The avatar is a REAL PERSON telling a story, not a mannequin showing clothes.
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

PRIORITY ORDER:
1. FULL BODY (complete silhouette)
2. Outfit details (texture, fit, styling)
3. Face (optional, secondary)
4. Product (only if complement)

REQUIRED:
- One HERO full-body shot showing entire outfit
- Detail shots of fabric, texture, accessories
- Silhouette and fit are the focus

Face may be visible but should NOT dominate the frame.
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
1. PRODUCT (clearly visible, attractive)
2. AVATAR FACE (emotional narrator)
3. Hands (interaction)
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
- The space must be IDENTICAL to REF0.

PRIORITY ORDER:
1. ENVIRONMENT (exactly as in REF0)
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
const getRoleEnforcement = (role: string, focus: Focus): string => {
  if (role === 'HERO') {
    if (focus === 'AVATAR') {
      return `
🔴 HERO ROLE ENFORCEMENT (AVATAR):
- MEDIUM shot (waist up), NOT full body wide
- Face MUST be clear, dominant, expressive
- Outfit is secondary, NOT competing
- NO extreme crop, NO full body as hero
- NO beautification, NO skin smoothing`;
    }
    if (focus === 'OUTFIT') {
      return `
🔴 HERO ROLE ENFORCEMENT (OUTFIT):
- FULL BODY visible head to toe
- Outfit is the ONLY visual hero
- Face may be visible but secondary
- Composition centered on clothing silhouette`;
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
🔴 SELFIE ROLE ENFORCEMENT (HARD PHYSICS):
- Camera held at arm's length by the person
- Visible: shoulder, elbow, up to mid-forearm, face
- Phone/camera MUST NOT be visible
- Handheld framing, slight asymmetry allowed
- NO third-person perspective, NO full body
- The viewer should feel like the person took this photo themselves
- This is NOT a portrait taken by someone else`;
  }
  
  if (role === 'DETAIL') {
    if (focus === 'AVATAR') {
      return `
🔴 DETAIL ROLE ENFORCEMENT (AVATAR):
- ALLOWED details: face close-up, hand gesture, product interaction
- FORBIDDEN: outfit details (belt, bag, shoes) as main subject
- The detail must serve the person's story, not the clothing`;
    }
    return `
🔴 DETAIL ROLE ENFORCEMENT (HARD):
- EXTREME close-up
- Subject fills 85-90% of frame (ABSOLUTE)
- Face is FORBIDDEN (unless detail target is face)
- Full body is FORBIDDEN
- Background MUST be blurred or absent
- If it looks like a MEDIUM shot, it is INVALID`;
  }
  
  if (role === 'INTERACTION') {
    return `
🔴 INTERACTION ROLE ENFORCEMENT (HARD):
- Hands MUST be visibly interacting
- Clear action required (adjusting, holding, touching)
- Mid shot framing (upper body + hands)
- Static pose without action is FORBIDDEN`;
  }
  
  if (role === 'EXPRESSION') {
    return `
🔴 EXPRESSION ROLE ENFORCEMENT:
- Face MUST fill 70-80% of frame
- Expression MUST be PERCEPTUALLY DISTINCT from other shots
- NO beautification, NO skin smoothing
- Viewer must identify emotion at a glance`;
  }
  
  if (role === 'LIFESTYLE') {
    return `
🔴 LIFESTYLE ROLE ENFORCEMENT:
- Person is STATIC: standing still, sitting, or leaning
- Weight on BOTH feet, NOT mid-step, NOT walking
- Context/environment visible
- Authentic, candid feel`;
  }
  
  if (role === 'ALT_ANGLE') {
    return `
🔴 ALT ANGLE ROLE ENFORCEMENT:
- Camera angle MUST differ significantly from HERO
- Eye-level alone is NOT enough
- Valid: side angle, low angle, high angle, 3/4 profile
- Subtle angle changes are INVALID`;
  }
  
  if (role === 'CONTEXT') {
    return `
🔴 CONTEXT ROLE ENFORCEMENT (SCENE):
- Environment is the hero, exactly as in REF0
- NO redesign, NO added furniture, NO beautification
- Person visible (25-35% of frame), engaged with space
- Scene details must match REF0 exactly`;
  }
  
  return '';
};

// ===================================================================
// INYECTAR REF0 ANALYSIS EN PROMPT (para congelar luz, espacio, acciones)
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
// TRADUCIR SHOT DIRECTIVE A PROMPT
// ===================================================================
function translateDirectiveToPrompt(directive: ShotDirective, focus: Focus, ref0Analysis?: REF0Analysis): string {
  const parts: string[] = [];
  
  // Instrucción ultra-directa según rol
  if (directive.role === 'SELFIE') {
    parts.push(`
🔴🔴🔴 THIS IS A SELFIE SHOT - PHYSICAL RULES 🔴🔴🔴
- The person holds the camera at arm's length.
- Visible: shoulder, elbow, up to mid-forearm, face.
- Phone/camera is NOT visible (it's the POV).
- Handheld framing, slight asymmetry is natural.
- NO third-person view. NO full body.
- This must look like the person took it themselves.
    `);
  } else if (directive.role === 'DETAIL' && focus !== 'AVATAR') {
    parts.push(`
🔴🔴🔴 THIS IS AN EXTREME DETAIL SHOT 🔴🔴🔴
- Camera is 10-15cm from the subject.
- ONLY texture, fabric, material, or product surface visible.
- NO face. NO full body. NO medium shot.
- The detail fills 85-90% of the entire frame.
- Think MACRO PHOTOGRAPHY.
    `);
  } else if (directive.role === 'EXPRESSION') {
    parts.push(`
🔴🔴🔴 THIS IS A FACE EXPRESSION SHOT 🔴🔴🔴
- Face fills 70-80% of the frame.
- Expression must be clearly different from other shots.
- NO beautification, NO skin smoothing.
- This is a REAL PERSON, not a model.
    `);
  } else if (directive.role === 'HERO' && focus === 'AVATAR') {
    parts.push(`
🔴🔴🔴 THIS IS AN AVATAR HERO SHOT 🔴🔴🔴
- MEDIUM shot (waist up). Face is dominant.
- NOT full body. NOT wide shot.
- Outfit is secondary background.
- The person's expression and presence are the focus.
    `);
  } else if (directive.role === 'HERO' && focus === 'OUTFIT') {
    parts.push(`
🔴🔴🔴 THIS IS AN OUTFIT HERO SHOT 🔴🔴🔴
- FULL BODY visible head to toe.
- The outfit is the ONLY hero.
- Face may be visible but secondary.
- Show the complete silhouette.
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
  ref0Analysis?: REF0Analysis;
  shots: ShotDirective[];
}

export const contentStudioService = {
  async ensureAccess() {
    if (typeof window !== 'undefined' && (window as any).aistudio)
      if (!(await (window as any).aistudio.hasSelectedApiKey()))
        await (window as any).aistudio.openSelectKey();
  },

  // ──────────────────────────────────────────────────────────────
  // buildSessionPlan - AHORA USA EL DIRECTOR AVANZADO
  // ──────────────────────────────────────────────────────────────
  async buildSessionPlan(
    focus: Focus,
    refs: { productRef?: string | null; outfitRef?: string | null; sceneRef?: string | null; sceneText?: string },
    productSize?: ProductSize,
    productIsRelevant?: boolean
  ): Promise<SessionPlan> {
    // Usar el director real de ugcDirectorService
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
    _style: Style,
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
- Natural lighting, iPhone quality, UGC feel.
- NO beautification, NO skin smoothing, NO studio look.`;

    const imageUrl = await generateWithResilience(prompt, refsToPass, system);
    
    // Analizar REF0 para congelar luz, espacio y acciones
    const analysis = await analyzeREF0(imageUrl);
    console.log("[UGC] REF0 Analysis completed:", analysis);
    
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
    _style: Style,
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

CRITICAL - SAME SESSION:
- Keep PERSON, PRODUCT, OUTFIT, SCENE IDENTICAL to REF0
- Only change framing, distance, angle, interaction

Natural UGC aesthetic.`;

      // Fallback con solo las referencias mínimas
      const refs = [image0, faceRef];
      if (outfitRef) refs.push(outfitRef);
      if (productRef) refs.push(productRef);
      if (sceneRef) refs.push(sceneRef);
      
      return generateWithResilience(fallbackPrompt, refs, '');
    }

    const directivePrompt = translateDirectiveToPrompt(directive, focus, ref0Analysis);
    const ref0AnalysisBlock = injectREF0Analysis(ref0Analysis);

    const system = `${PARADIGM_RULE}\n${REF0_ANCHOR_RULE}\n${getModeDominance(focus)}\n${COLOR_CONSISTENCY_RULE}\n${BODY_INTEGRITY_RULE}`;

    // Construir prompt con todas las referencias relevantes
    const prompt = `
CREATE A NEW PHOTO FROM THE SAME SESSION AS REF0.

CRITICAL - LOCK SYSTEM ACTIVE:
- The person's face MUST be IDENTICAL to REF0 and faceRef
- The outfit MUST be IDENTICAL to REF0 and outfitRef (if provided)
- The product MUST be IDENTICAL to REF0 and productRef (if provided)
- The scene MUST be IDENTICAL to REF0 and sceneRef (if provided)

${ref0AnalysisBlock}

${directivePrompt}

CRITICAL REMINDERS:
- The ${focus.toUpperCase()} must be the VISUAL HERO according to MODE DOMINANCE
- Keep PERSON, PRODUCT, OUTFIT, SCENE identical to REF0
- Only change: framing, distance, angle, interaction, expression
- NO beautification, NO skin smoothing, NO studio polish, NO editorial softening
- Natural UGC aesthetic (iPhone quality, organic lighting, slight imperfections allowed)
- ⚠️ ROLE ENFORCEMENT CONSTRAINTS ARE MANDATORY
- ⚠️ NO ROLE MIXING - Each image serves ONE role only
- ⚠️ LOCK SYSTEM ACTIVE - NO IDENTITY DRIFT, NO SCENE REDESIGN`;

    // Construir array de referencias con TODAS las disponibles
    const refs: (string | null)[] = [image0, faceRef];
    if (outfitRef) refs.push(outfitRef);
    if (productRef && productIsRelevant !== false) refs.push(productRef);
    if (sceneRef) refs.push(sceneRef);
    
    return generateWithResilience(prompt, refs, system);
  },
};

// ===================================================================
// CONSTANTES ADICIONALES (referenciadas)
// ===================================================================
const FOCUS_DOMINANCE_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 FOCUS DOMINANCE (CRITICAL):

- AVATAR → Face dominates. Outfit secondary. Product as collaboration.
- PRODUCT → Product hero, avatar emotional narrator, face visible.
- OUTFIT → Clothing hero, full body, face secondary.
- SCENE → Environment hero, no redesign, avatar experiences.
`;

const NO_COMPETITION_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 NO COMPETITION RULE:

Only ONE element can be visually dominant in each image.
The selected focus MUST be that element.

If any secondary element competes for attention with the main focus,
the output is INVALID.
`;

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