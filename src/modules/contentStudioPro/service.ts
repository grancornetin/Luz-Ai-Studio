import { 
  Focus, ShotKey, ProductSize, ProductCategory, 
  ShotDirective, ShotRole, ShotFraming, ShotComposition, ShotExclusion,
  CATEGORY_LABELS 
} from './types';
import { ugcApiService } from '../../services/ugcApiService';

// ===================================================================
// DETECCIÓN DE CATEGORÍA DE PRODUCTO
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
  
  // Si es base64 puro, asumir PNG
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
// NEGATIVE PROMPT
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

const REF0_ANCHOR_RULE = `
╔═══════════════════════════════════════════════════════════════════╗
║                    LOCK SYSTEM (NUNCA CAMBIA)                    ║
╚═══════════════════════════════════════════════════════════════════╝

🔒 IDENTITY LOCK:
- Same person. Same face. Same features.
- NO variation allowed. NO face drift.

🔒 PRODUCT LOCK:
- Same product. Same materials. Same details.

🔒 OUTFIT LOCK:
- Same clothing. Same fit. Same fabric.

🔒 SCENE LOCK:
- Same environment. Same location.

🔒 SCALE LOCK:
- Maintain real-world proportions.
`;

const PARADIGM_RULE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 PARADIGM (CRITICAL):

You are NOT editing REF0.
You are capturing a NEW photograph from the SAME moment as REF0.
`;

// ===================================================================
// MODE DOMINANCE
// ===================================================================
function getModeDominance(focus: Focus): string {
  if (focus === 'AVATAR') {
    return `
😊 MODE DOMINANCE: AVATAR MODE
- Face is dominant (70-80% in CLOSE_UP)
- At least one SELFIE shot MANDATORY
- Digital influencer feel, not model
- Product shown as collaboration if present`;
  }
  if (focus === 'OUTFIT') {
    return `
👔 MODE DOMINANCE: OUTFIT MODE
- Full body visibility REQUIRED for HERO
- Outfit details (texture, fit, styling)
- Face is secondary, optional`;
  }
  if (focus === 'PRODUCT') {
    return `
📦 MODE DOMINANCE: PRODUCT MODE
- Product is visual hero (always visible)
- Avatar face visible and expressive in most shots
- Avatar shows emotion toward product
- Only DETAIL shots can exclude face`;
  }
  if (focus === 'SCENE') {
    return `
🏞️ MODE DOMINANCE: SCENE MODE
- Environment is hero (person 25-35% in WIDE)
- Avatar actively interacting with space
- Avatar face visible in at least 3 of 6 shots`;
  }
  return '';
}

// ===================================================================
// TRADUCIR SHOT DIRECTIVE A PROMPT
// ===================================================================
function translateDirectiveToPrompt(directive: ShotDirective, focus: Focus): string {
  const parts: string[] = [];
  
  if (directive.role === 'SELFIE') {
    parts.push(`
🔴 THIS IS A SELFIE SHOT
Camera at arm's length. Face fills 80% of frame.
One arm/shoulder partially visible.
NO third-person view. NO full body.`);
  } else if (directive.role === 'DETAIL') {
    parts.push(`
🔴 THIS IS AN EXTREME DETAIL SHOT
Camera 10-15cm from subject.
ONLY texture, material, or product surface visible.
NO face. NO full body. Detail fills 85-90% of frame.`);
  } else if (directive.role === 'EXPRESSION') {
    parts.push(`
🔴 THIS IS A FACE EXPRESSION SHOT
Face fills 70-80% of frame.
Expression clearly different from other shots.
Body below shoulders NOT visible.`);
  }
  
  parts.push(`SHOT ROLE: ${directive.role}`);
  parts.push(`FRAMING: ${directive.framing === 'EXTREME_CLOSE' ? 'EXTREME CLOSE-UP - 85-90% FRAME FILL' : directive.framing}`);
  parts.push(`INTENTION: ${directive.purpose}`);
  
  if (directive.exclusion.length > 0) {
    parts.push(`EXCLUDE: ${directive.exclusion.join(', ')}`);
  }
  
  return parts.join('\n');
}

// ===================================================================
// GENERAR FONDO NEUTRO
// ===================================================================
async function generateNeutralScene(focus: Focus, productCategory?: ProductCategory): Promise<string> {
  if (focus === 'PRODUCT') {
    if (productCategory === 'JEWELRY') return 'Elegant vanity with mirror, soft natural window light';
    if (productCategory === 'MAKEUP') return 'Clean bathroom vanity with natural light';
    if (productCategory === 'TECH') return 'Modern desk with natural window light';
    if (productCategory === 'SPORTS') return 'Gym or sports environment, natural lighting';
    return 'Clean lifestyle space, natural window light';
  }
  return 'Clean lifestyle space, natural light, UGC content style';
}

async function generateNeutralOutfit(focus: Focus, productCategory?: ProductCategory): Promise<string> {
  if (focus === 'PRODUCT') {
    if (productCategory === 'JEWELRY') return 'Elegant casual outfit, neutral colors';
    if (productCategory === 'MAKEUP') return 'Clean natural look, simple top, neutral colors';
    return 'Casual comfortable outfit, neutral colors';
  }
  return 'Casual comfortable outfit, neutral colors';
}

// ===================================================================
// ANALIZAR RELEVANCIA DE PRODUCTO (vía API)
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
  
  const productImageData = extractImageData(productRef);
  if (!productImageData) {
    return { isRelevant: false, suggestion: 'Could not read product image', productType: 'other' };
  }
  
  const outfitImageData = outfitRef ? extractImageData(outfitRef) : null;
  const sceneImageData = sceneRef ? extractImageData(sceneRef) : null;
  
  try {
    return await ugcApiService.analyzeProductRelevance({
      productRef: productImageData,
      focus,
      outfitRef: outfitImageData,
      sceneRef: sceneImageData,
      sceneText,
    });
  } catch (e) {
    console.warn('[UGC] Error analyzing product relevance:', e);
    return { isRelevant: false, suggestion: 'Could not determine', productType: 'other' };
  }
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
    // No-op - autenticación en el servidor
  },

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
  ): Promise<string> {
    await this.ensureAccess();

    const useProduct = productIsRelevant !== false;
    
    // Preparar referencias
    const refsToPass: (string | null)[] = [faceRef];
    let promptExtra = '';

    // Outfit neutral si no hay referencia
    let finalOutfitRef = outfitRef;
    if (!outfitRef && (focus === 'PRODUCT' || focus === 'SCENE' || focus === 'AVATAR')) {
      const category = detectProductCategory(sceneText, productRef);
      const neutralOutfit = await generateNeutralOutfit(focus, category);
      promptExtra += `\nOutfit: ${neutralOutfit}`;
      finalOutfitRef = null;
    }
    refsToPass.push(finalOutfitRef);

    // Producto
    let finalProductRef = useProduct ? productRef : null;
    if (!finalProductRef && focus === 'PRODUCT') {
      throw new Error('Product reference required for PRODUCT focus');
    }
    refsToPass.push(finalProductRef);

    // Escena neutral si no hay referencia
    let finalSceneRef = sceneRef;
    if (!sceneRef && (focus === 'PRODUCT' || focus === 'OUTFIT' || focus === 'AVATAR')) {
      const category = detectProductCategory(sceneText, productRef);
      const neutralScene = await generateNeutralScene(focus, category);
      promptExtra += `\nScene: ${neutralScene}`;
      finalSceneRef = null;
    }
    refsToPass.push(finalSceneRef);

    const systemInstructions = `${RULE_PRIORITY_SYSTEM}\n${REF0_ANCHOR_RULE}\n${PARADIGM_RULE}\n${getModeDominance(focus)}`;

    const prompt = `
CREATE THE ANCHOR IMAGE (REF0):

CRITICAL - LOCK SYSTEM ACTIVE:
- The person MUST be IDENTICAL to face reference
- The outfit MUST be IDENTICAL to outfit reference (if provided)
- The product MUST be IDENTICAL to product reference (if provided)
- The scene MUST be IDENTICAL to scene reference (if provided)

RULES:
${focus === 'AVATAR' ? '- 3rd person perspective. MEDIUM shot (waist up). Face is dominant.' : '- 3rd person perspective. Full body visible.'}
- Person interacts with environment naturally.
- Person is STATIC (standing still, sitting, or leaning - NOT walking).
- Natural lighting, iPhone quality, UGC feel.`;

    // Preparar imágenes de referencia para la API
    const referenceImages = prepareReferenceImages(refsToPass);
    
    return ugcApiService.generateImage0({
      prompt: `${systemInstructions}\n\n${prompt}\n\nNEGATIVE:\n${NEGATIVE}\n${promptExtra}`,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      aspectRatio: '3:4',
    });
  },

  async generateDerivedShot(
    image0: string,
    faceRef: string,
    focusRef: string | null,
    _style: any,
    focus: Focus,
    shotKey: ShotKey,
    productSize?: ProductSize,
    sessionPlan?: SessionPlan,
    productIsRelevant?: boolean
  ): Promise<string> {
    await this.ensureAccess();

    const directive = sessionPlan?.shots?.find(s => s.key === shotKey);
    
    const systemInstructions = `${PARADIGM_RULE}\n${REF0_ANCHOR_RULE}\n${getModeDominance(focus)}`;

    let directivePrompt = '';
    if (directive) {
      directivePrompt = translateDirectiveToPrompt(directive, focus);
    } else {
      directivePrompt = `
CREATE A NEW PHOTO from the same session as REF0 for ${shotKey}.

CRITICAL - SAME SESSION:
- Keep PERSON, PRODUCT, OUTFIT, SCENE IDENTICAL to REF0
- Only change framing, distance, angle, interaction`;
    }

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
- NO IDENTITY DRIFT ALLOWED`;

    // Preparar imágenes de referencia (REF0 + face)
    const referenceImages = prepareReferenceImages([image0, faceRef]);
    
    return ugcApiService.generateDerivedShot({
      prompt: `${systemInstructions}\n\n${prompt}\n\nNEGATIVE:\n${NEGATIVE}`,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      aspectRatio: '3:4',
    });
  },

  buildSessionPlan: async (anchor: string, focus: Focus, refs?: any, productSize?: ProductSize, productIsRelevant?: boolean): Promise<SessionPlan> => {
    // Versión simplificada - genera shot directives básicos
    const productCategory = detectProductCategory(refs?.sceneText || undefined, refs?.productRef);
    
    const shotKeys: ShotKey[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
    
    const shots: ShotDirective[] = shotKeys.map((key, idx) => ({
      key,
      role: idx === 0 ? 'HERO' : idx === 1 ? 'DETAIL' : idx === 2 ? 'INTERACTION' : idx === 3 ? 'LIFESTYLE' : idx === 4 ? 'EXPRESSION' : 'ALT_ANGLE',
      purpose: `Shot ${idx + 1} for ${focus} focus`,
      requiredElements: ['natural_pose', 'focus_visible'],
      forbiddenElements: [],
      variationSpace: ['different_angle', 'different_framing'],
      framing: idx === 0 ? 'MEDIUM' : idx === 1 ? 'EXTREME_CLOSE' : idx === 4 ? 'CLOSE_UP' : 'MEDIUM',
      composition: 'EYE_LEVEL',
      exclusion: [],
      intensity: 'normal'
    }));
    
    return {
      anchor,
      productCategory,
      shots,
    };
  },
};