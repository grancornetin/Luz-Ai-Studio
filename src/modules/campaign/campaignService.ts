import { geminiService } from '../../services/geminiService';
import { imageApiService, extractImageRef } from '../../services/imageApiService';
import { compressImageForUpload } from '../../utils/imageUtils';
import { ugcApiService } from '../../services/ugcApiService';
import {
  CampaignChannel, CampaignImageSlot, CampaignPiece, CampaignPlan,
  CampaignVisualSpine, CampaignStylingLock, CampaignAnchorAnalysis,
  ModoVisual, TextoEnImagenes, CAMPAIGN_CHANNEL_META, ANCHOR_IMAGE_COUNT,
} from './types';
import {
  initCampaignIntelligence,
  buildCampaignIntelligencePromptBlock,
  getTopFamilyFromPieces,
  getFamilyById,
  extractBlendText,
  extractBasePromptBlock,
  extractAnchorPromptBlock,
  extractGuardrails,
} from './campaignIntelligence';
import {
  initUgcIntelligence,
  buildUgcIntelligencePromptBlock,
  getUgcFamilyById,
  getTopUgcFamilyFromPieces,
} from './ugcIntelligence';
import {
  initHpiService,
  buildHpiBlock,
  getHpiNegatives,
  type HpiConfig,
} from '../../services/hpiService';

// Precarga los JSON de inteligencia visual en background al importar este módulo
initCampaignIntelligence();
initUgcIntelligence();
initHpiService();

// ─── Negativos base (anatomía + identidad + texto — siempre) ──
const NEGATIVE_BASE = [
  'blurry', 'low quality', 'low resolution', 'jpeg artifacts', 'pixelated',
  'overexposed', 'underexposed', 'watermark',
  'bad anatomy', 'deformed', 'mutated', 'disfigured',
  'extra limbs', 'extra fingers', 'missing fingers', 'fused fingers',
  'extra arms', 'extra legs', 'missing arms', 'missing legs',
  'deformed hands', 'malformed hands', 'abnormal body proportions',
  'floating limbs', 'disconnected limbs', 'body horror',
  'face distortion', 'crossed eyes',
  'wrong product', 'different product', 'generic product', 'color drift',
  'identity mixing', 'different person', 'composite artifacts', 'collage', 'different brand',
  'text overlay', 'text on image', 'typography', 'words', 'letters',
  'caption on photo', 'subtitle', 'label text', 'graphic design text',
].join(', ');

// Modo UGC: prohíbe todo lo "profesional/editorial" + drift de producto/escenario/persona
const NEGATIVE_UGC = [
  NEGATIVE_BASE,
  // Over-production
  'professional studio lighting', 'softbox lighting', 'glamour lighting', 'ring light',
  'beauty dish', 'strobe flash', 'perfectly even lighting',
  'commercial photography', 'editorial softening', 'commercial polish', 'brand lookbook',
  'high fashion look', 'luxury redesign', 'magazine spread', 'vogue editorial',
  // Retoque
  'skin smoothing', 'beauty filter', 'airbrushed', 'plastic skin', 'flawless skin',
  'no pores', 'porcelain skin', 'wax figure look', 'retouched skin',
  // Pose falsa
  'mannequin pose', 'catalog pose', 'runway pose', 'symmetric pose', 'stiff pose',
  'neutral blank expression', 'model stare',
  // Fondo de estudio
  'white seamless background', 'studio backdrop', 'neutral studio',
  // Encuadre cortado — crítico para el ancla
  'cropped body', 'bust shot', 'torso crop', 'waist crop', 'portrait crop',
  'close-up of face only', 'upper body only', 'cut off feet', 'headless body',
  'partial body', 'body out of frame', 'legs not visible', 'feet not visible',
  // Drift de producto — el producto no puede cambiar de forma, color ni categoría
  'different product shape', 'wrong product color', 'invented product', 'generic substitute',
  'product replacement', 'similar but different product', 'changed packaging',
  // Drift de escenario — el ambiente no puede saltar a uno nuevo
  'different location', 'location jump', 'new background', 'unrelated environment',
  'scene change', 'different setting', 'background swap',
  // Drift de identidad — la persona no puede cambiar
  'different face', 'face swap', 'identity change', 'different person appearance',
  'different skin tone', 'age change', 'hair color change',
].join(', ');

// Modo Editorial: prohíbe lo "amateur/casual" Y texto/póster/drift de outfits
const NEGATIVE_EDITORIAL = [
  NEGATIVE_BASE,
  'skin smoothing', 'beauty filter', 'airbrushed', 'plastic skin',
  'editorial over-processing', 'poor composition', 'bad lighting',
  'snapshot quality', 'phone photo', 'amateur photography',
  'casual snapshot', 'unflattering angle', 'busy background',
  // Texto dentro de imagen
  'slogan inside image', 'poster layout', 'magazine headline in image',
  'editorial text overlay', 'white border frame layout', 'graphic design text',
  'brand copy inside image', 'written words on photo', 'typographic poster',
  // Encuadre cortado — crítico para el ancla
  'cropped body', 'bust shot', 'torso crop', 'waist crop', 'portrait crop',
  'close-up of face only', 'upper body only', 'cut off feet', 'headless body',
  'partial body', 'body out of frame', 'legs not visible', 'feet not visible',
  // Drift de outfit/styling
  'catsuit', 'latex bodysuit', 'mini dress', 'micro skirt', 'sporty leggings',
  'casual pants', 'athleisure outfit', 'overly sensual styling',
  'outfit change from anchor', 'different fashion mood',
  // Drift de mundo visual
  'street background', 'neon night background', 'wood flat lay background',
  'white ecommerce background', 'dramatic unrelated lighting',
  'new environment not in anchor',
].join(', ');

function getNegative(modo: ModoVisual): string {
  return modo === 'ugc' ? NEGATIVE_UGC : NEGATIVE_EDITORIAL;
}

// ─── Selección inteligente de referencias ────────────────────
// Cuando Sofi sube muchas fotos del mismo producto, elegimos las más
// informativas para no desperdiciar el límite de 10 referencias de Gemini.
// Estrategia: máx 2 fotos de producto, 1 de modelo, 1 inspiración, 1 marca.

function selectBestRefs(slots: CampaignImageSlot[]): {
  productRefs:     CampaignImageSlot[];
  modelRef:        CampaignImageSlot | null;
  inspirationRef:  CampaignImageSlot | null;
  brandRef:        CampaignImageSlot | null;
} {
  const products     = slots.filter(s => s.role === 'product');
  const models       = slots.filter(s => s.role === 'model');
  const inspirations = slots.filter(s => s.role === 'inspiration');
  const brands       = slots.filter(s => s.role === 'brand');

  // Para productos: máximo 3 fotos para no saturar el payload
  // Si hay más de 3, tomamos primera + medio + última (máxima variedad de ángulos)
  let productRefs = products;
  if (products.length > 3) {
    const mid = Math.floor(products.length / 2);
    productRefs = [products[0], products[mid], products[products.length - 1]];
  }

  return {
    productRefs,
    modelRef:       models[0]                     ?? null,
    inspirationRef: slots.filter(s => s.role === 'inspiration')[0] ?? null,
    brandRef:       slots.filter(s => s.role === 'brand')[0]       ?? null,
  };
}

// ─── Construye el array de referencias estratificado ─────────
// Orden de prioridad visual: ancla primero (define outfit + mundo),
// luego producto (héroe visual), luego modelo (solo cara), luego resto.
// La ancla va duplicada para máximo peso — es la verdad visual aprobada
// por el usuario y define tanto el mundo como el styling del modelo.

async function buildStratifiedRefsCompressed(
  selected: ReturnType<typeof selectBestRefs>,
  anchorImage?: string,
): Promise<Array<{ data: string; mimeType: string }>> {
  const raw: string[] = [];

  // 1. Ancla aprobada — duplicada, va primero (define mundo visual + outfit)
  if (anchorImage) {
    raw.push(anchorImage);
    raw.push(anchorImage);
  }

  // 2. Producto — visual hero, duplicado si solo hay 1 ángulo
  selected.productRefs.forEach(r => raw.push(r.base64));
  if (selected.productRefs.length === 1) {
    raw.push(selected.productRefs[0].base64);
  }

  // 3. Modelo — solo cara/identidad, va después del ancla para no confundir outfit
  if (selected.modelRef) {
    raw.push(selected.modelRef.base64);
  }

  // 4. Inspiración
  if (selected.inspirationRef) raw.push(selected.inspirationRef.base64);

  // 5. Marca
  if (selected.brandRef) raw.push(selected.brandRef.base64);

  // Comprimir todas antes de enviar — evita 413
  const compressed = await Promise.all(
    raw.filter(Boolean).slice(0, 10).map(b64 =>
      compressImageForUpload(b64, 768, 0.80).catch(() => b64)
    )
  );

  return compressed
    .map((b64, i) => {
      try { return extractImageRef(b64, `campaignRef[${i}]`); }
      catch { return null; }
    })
    .filter(Boolean) as Array<{ data: string; mimeType: string }>;
}

// ─── Lock system para campaña ─────────────────────────────────
// Prioridad 2: cada referencia tiene un rol EXPLÍCITO y ÚNICO.
// El modelo no puede mezclar roles — la ropa del avatar no define el outfit,
// la inspiración no define la persona, el producto es el héroe visual.
function buildLockSystem(
  selected:  ReturnType<typeof selectBestRefs>,
  hasAnchor: boolean,
  modo:      ModoVisual,
): string {
  const locks: string[] = [];

  if (selected.modelRef) {
    locks.push(`🔒🔒🔒 IDENTITY LOCK — MODEL REFERENCE (ABSOLUTE PRIORITY):
ROLE: This reference defines the person's FACE, PHYSICAL IDENTITY, and BODY.

FACIAL IDENTITY (must match exactly):
- Face shape, bone structure, eye shape/color, nose, lips, jaw line.
- Hair color, texture, and general length.
- Skin tone and undertone.

BODY FIDELITY (must match exactly — this is not optional):
- Body type, proportions, and silhouette must be preserved AS SEEN in the reference.
  If the person has curves, a fuller figure, a petite frame, or an athletic build — REPRODUCE IT faithfully.
- DO NOT slim down, elongate, normalize, or idealize the body toward any "standard" shape.
- Clothing and garments must drape and fit the body AS IT IS.
  The fabric adapts to the person's actual shape — NOT the person to the fabric.
- Hip-to-waist ratio, shoulder width, and overall body weight must remain visually consistent.

VISIBLE MARKS (context-aware — do not force):
- Tattoos, birthmarks, scars, or distinctive skin marks visible in the reference:
  reproduce them ONLY if the current outfit and scene would naturally expose that skin area.
  If the garment covers the area — do NOT force the marks to appear. This is correct behavior.
- DO NOT invent marks that are not in the reference.

WHAT THIS REFERENCE DOES NOT DEFINE:
- Outfit, clothing, accessories, or background — those come from the creative concept.
- NO face replacement, NO identity drift, NO averaging with anchor or other refs.
- Generate the person naturally in the new scene — do NOT paste or composite.`);
  }

  if (selected.productRefs.length > 0) {
    locks.push(`🔒🔒 PRODUCT LOCK — PRODUCT REFERENCE (HERO):
ROLE: This reference defines the EXACT product to feature. It is the VISUAL HERO.
- Same shape, color, materials, labels, packaging — EXACTLY as shown.
- The product must be CLEARLY VISIBLE and IDENTIFIABLE in the image.
- ${selected.productRefs.length > 1 ? 'Multiple angles provided — use all to understand the product fully.' : ''}
- DO NOT replace with a generic version, similar product, or invented variation.
- DO NOT hide it, blur it, or make it secondary if it is the main subject.`);
  }

  if (hasAnchor) {
    locks.push(`🔒🔒🔒 ANCHOR LOCK — APPROVED SESSION IMAGE (APPEARS TWICE AT THE TOP — MAXIMUM PRIORITY):
ROLE: This is the anchor image approved by the user. It defines:
  1. THE VISUAL WORLD — lighting, environment, color temperature, atmosphere.
  2. THE STYLING SYSTEM — what the model wears (garment type, silhouette, color family, formality level).
- Every derived image must feel shot in the SAME SESSION as this anchor.
- Same lighting direction and quality — do NOT shift warm/cool or change light source type.
- Same environment — do NOT jump to a different location or visual world.
- Same outfit system — do NOT invent new garment categories outside what the anchor establishes.
  The model must wear clothing COHERENT with the anchor's styling, even if the exact garment varies.
- DO NOT replicate the exact composition — shoot a new angle of the same world.
- The anchor is the VISUAL TRUTH. It overrides any conflicting instruction below.`);
  }

  if (selected.inspirationRef) {
    locks.push(`🔒 AESTHETIC LOCK — INSPIRATION REFERENCE:
ROLE: This defines MOOD, COMPOSITION STYLE and AESTHETIC DIRECTION only.
- Use it to understand: framing, atmosphere, color grading preference.
- DO NOT copy the scene, people, or products from this reference.
- DO NOT use it to define identity, outfit, or product.`);
  }

  if (selected.brandRef) {
    locks.push(`🔒 BRAND LOCK — BRAND REFERENCE:
ROLE: Defines COLOR PALETTE and VISUAL IDENTITY coherence only.
- Maintain harmony with brand colors and aesthetic — subtly, not literally.
- DO NOT copy the layout, graphics, or text from this reference.`);
  }

  // Prioridad 3: si no hay modelo, dar instrucciones explícitas de casting
  if (!selected.modelRef) {
    locks.push(`📋 CASTING NOTE (no model reference provided):
Create a person that fits this campaign's target audience perfectly:
- Age range, style, and energy consistent with the product and concept.
- Appearance that resonates with the target customer — aspirational but relatable.
- ${modo === 'ugc' ? 'Looks like a real person, NOT a professional model.' : 'Polished and aspirational, consistent with the brand positioning.'}`);
  }

  return locks.length === 0 ? '' : `
╔══════════════════════════════════════════════════════════════════╗
║      REFERENCE ROLE SYSTEM — READ BEFORE GENERATING            ║
╚══════════════════════════════════════════════════════════════════╝

${locks.join('\n\n')}`;
}

// ─── Descripción de producto para ancla UGC ──────────────────
// En modo UGC no hay spine que describa el producto con texto.
// Este bloque lo suple: le dice a la IA exactamente qué conservar
// del producto antes de que empiece a interpretar las referencias.
function buildUgcProductLock(
  selected: ReturnType<typeof selectBestRefs>,
  plan?:    CampaignPlan,
): string {
  if (selected.productRefs.length === 0) return '';
  const angles = selected.productRefs.length;
  const concept = plan?.concepto ?? '';
  return `🔒 PRODUCT IDENTITY CONTRACT (UGC ANCHOR):
The product shown in the PRODUCT REFERENCE image(s) is the ONLY product allowed in this image.
- Same exact shape, silhouette, and size proportions.
- Same exact color(s), finish, and surface texture.
- Same exact labels, logos, packaging details — do NOT invent or simplify.
- ${angles > 1 ? `${angles} angles provided — study all to understand the full product. Use the one most natural for this scene.` : 'One angle provided — reproduce it faithfully. Do NOT improvise other angles that contradict it.'}
- The product must be CLEARLY READABLE in the image — not blurred, obscured, or cropped away.
- ${concept ? `Campaign concept: "${concept}" — product interaction must feel coherent with this, not generic.` : ''}
🚫 Do NOT replace with: a similar product, a generic version, an invented variation, or a product with different colors or shape.`;
}

// ─── Paradigma de los dos modos visuales ──────────────────────
const UGC_PARADIGM = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 VISUAL MODE: iPhone UGC — ORGANIC REAL-LIFE CAPTURE

You are NOT creating a commercial photograph.
You are capturing a SPONTANEOUS REAL MOMENT with an iPhone.

This is the kind of content a real influencer or customer posts on Instagram.
It looks like life, not like an ad.

- Light: NATURAL ONLY — window, sun, outdoor. Never softbox, ring light, or studio.
- Skin: REAL TEXTURE — pores, natural imperfections are CORRECT and REQUIRED.
- Pose: ORGANIC — weight shifted, mid-movement, asymmetric. NEVER symmetric/catalog.
- Background: REAL LIFE — café, street, home, park. NEVER neutral studio backdrop.
- Feel: "someone captured this in the moment" — handheld, alive, authentic.
- FORBIDDEN: commercial polish, beauty retouching, editorial softening, studio setup.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

const EDITORIAL_PARADIGM = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📷 VISUAL MODE: EDITORIAL CAMPAIGN — PREMIUM BRAND PHOTOGRAPHY

You are a creative director shooting a premium brand campaign.
Every image is intentional and could appear in Vogue or a brand lookbook.

- Light: CONTROLLED AND BEAUTIFUL — golden hour, clean window, dramatic natural.
- Composition: INTENTIONAL — rule of thirds, deliberate negative space, strong focal.
- Pose: EXPRESSIVE AND POLISHED — confident, aspirational, purposeful.
- Background: curated real-world OR minimal clean — whichever serves the concept.
- Feel: "a photographer directed this" — elevated, aspirational, brand-worthy.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// ─── Prompt para imagen ancla ─────────────────────────────────
// Variant A = UGC/iPhone orgánico
// Variant B = Editorial/lookbook
function buildAnchorPrompt(
  plan:     CampaignPlan,
  selected: ReturnType<typeof selectBestRefs>,
  variant:  'A' | 'B',
): string {
  const hasModel   = !!selected.modelRef;
  const hasProduct = selected.productRefs.length > 0;
  const modo: ModoVisual = variant === 'A' ? 'ugc' : 'editorial';
  const paradigm   = modo === 'ugc' ? UGC_PARADIGM : EDITORIAL_PARADIGM;
  const lockSystem = buildLockSystem(selected, false, modo);

  const lightingNote = modo === 'ugc'
    ? 'Natural ambient — window, sun, or outdoor. Imperfect and alive.'
    : 'Beautiful controlled natural light — golden hour or clean window.';
  const poseNote = modo === 'ugc'
    ? (hasModel ? 'Full body visible head-to-toe. Organic, asymmetric, mid-movement. Weight shifted. NOT catalog. Feet must be in frame.' : 'Organic product placement in real-life context.')
    : (hasModel ? 'Full body visible head-to-toe. Confident and expressive. Aspirational, not stiff. Feet must be in frame.' : 'Hero product — perfectly lit, intentional composition.');
  const bgNote = modo === 'ugc'
    ? 'Real inhabited environment — home, café, street.'
    : 'Curated environment OR minimal clean — serves the concept.';

  const ugcProductLock = modo === 'ugc' && hasProduct
    ? `\n\n${buildUgcProductLock(selected, plan)}`
    : '';

  const stylingNote = variant === 'B' && hasModel
    ? `\nSTYLING NOTE FOR ANCHOR B:
If a model is present, use an ELEGANT and COHERENT outfit aligned with the campaign concept.
The outfit will define the styling language for all derived images — make it refined, editorial, and product-forward.
The product must remain the visual hero — the model supports the product, not the other way around.`
    : variant === 'A' && hasModel
    ? `\nSTYLING NOTE FOR ANCHOR A (UGC):
Person wears CASUAL, REAL-LIFE clothing coherent with the campaign concept and target audience.
NOT: luxury outfits, editorial looks, or anything that reads as "brand shoot".
YES: the kind of outfit the target customer actually wears day-to-day.
The styling must feel like it was chosen by the creator, not by a stylist.
This outfit category will carry through all derived UGC images — choose it deliberately.`
    : '';

  return `⚠️ ANCHOR FRAMING — ABSOLUTE RULE, READ FIRST:
FULL BODY SHOT — HEAD TO TOE. This is the single most important constraint of this image.
The model's complete body must be visible: face, torso, legs, and feet — all in frame.
Outfit and footwear must be fully visible with no cropping.
ANY pose is valid (standing, seated, leaning, lying down) as long as the full body is visible.
STRICTLY FORBIDDEN: close-up, bust shot, portrait crop, waist crop, torso-only, legs-only, or any frame where feet or head are cut off.
If you cannot fit the full body in the frame — zoom out until you can.

${paradigm}

CAMPAIGN BRIEF:
Concept: "${plan.concepto}"
Tagline: "${plan.tagline}"
${plan.clienteIdeal ? `Target audience: ${plan.clienteIdeal}` : ''}
${plan.dolorCentral ? `Core tension resolved: ${plan.dolorCentral}` : ''}
${ugcProductLock}

ANCHOR IMAGE TASK:
This image defines the visual world for the ENTIRE campaign. All other images inherit its mood, outfit, and environment.
The anchor must establish the complete visual truth: full outfit, full body, complete environment — no gaps for the AI to invent.

- ${hasProduct ? 'Product is the VISUAL HERO — clearly identifiable, prominent, exactly as in reference.' : 'The concept emotion is the visual hero.'}
- ${hasModel ? 'Person: identity from MODEL REFERENCE only (face/hair/skin). Outfit comes from creative concept aligned with the campaign styling direction.' : 'No specific person required — cast someone fitting the target audience.'}
- Lighting: ${lightingNote}
- Pose/Placement: ${poseNote}
- Background: ${bgNote}
${stylingNote}

${lockSystem}

🚫 NO TEXT IN THE IMAGE — pure photography only. No typography, no overlay, no poster layout, no slogan, no magazine headline, no white border frame, no brand copy inside the photo.
🚫 NO disembodied product scale — do NOT place the product floating in the foreground at a scale disproportionate to the model. Product and model must share the same spatial plane (worn, held, or placed at body level).
🚫 NO cropped body — the anchor MUST show the full body head-to-toe. Feet must be visible.

FINAL CHECKLIST:
${hasProduct ? '✓ Product is the visual hero — same product, same shape and color as product reference\n' : ''}${hasModel ? '✓ Face AND body from MODEL REFERENCE — same face, same body type, same proportions\n' : ''}${hasModel ? '✓ Outfit is coherent with campaign concept, NOT copied from the model reference photo\n' : ''}✓ FULL BODY visible — head to toe, complete outfit and footwear, no cropping of lower body
✓ Visual mode: ${modo === 'ugc' ? 'organic iPhone feel, real skin, no studio' : 'editorial quality, intentional composition, NO text inside image'}
✓ NO text, no graphic design layout, no reference board artifacts
✓ Product and model in same spatial plane — no disproportionate foreground product floating in front of a distant model`;
}

// ─── Instrucciones tipográficas según la decisión del plan ────
function buildTypographyInstructions(
  plan:  CampaignPlan,
  pieza: CampaignPiece,
): string {
  const mode: TextoEnImagenes = plan.textoEnImagenes ?? 'none';

  // Si el modo global es none, o esta pieza específica no usa texto → bloqueo total
  if (mode === 'none' || !pieza.usaTexto) {
    return `🚫 NO TEXT IN THE IMAGE — no typography, no overlaid words, no captions, no watermarks. Pure photography only. Text belongs in the caption, not in the photo.`;
  }

  // Texto del titular acortado para usar en imagen (max ~6 palabras)
  const shortText = pieza.titular.split(' ').slice(0, 6).join(' ');
  const styleDesc = plan.estiloTexto ?? 'clean sans-serif, white, bold, centered';

  if (mode === 'minimal') {
    return `TYPOGRAPHY (MINIMAL):
- Include ONE short text element in the image: "${shortText}"
- Style: ${styleDesc}
- Text must feel DESIGNED, not pasted — integrated naturally into the composition
- Use NO MORE than one line of text
- Placement: top or bottom safe zone, leaving the main subject unobstructed
- The text should enhance the image, not compete with it
- DO NOT add captions, hashtags, CTAs, watermarks or any other text`;
  }

  // editorial
  return `TYPOGRAPHY (EDITORIAL):
- Text IS a core design element in this image — treat it like a magazine cover or billboard
- Main text: "${shortText}"
- Style: ${styleDesc}
- Typography must be INTENTIONAL — the font, size, weight, and placement should feel like a designed piece
- Can use 1-2 lines max — headline only, no body copy
- Integrate text with the composition: it can overlap the subject, sit in negative space, or anchor the layout
- The overall image must look like a professional editorial campaign piece
- DO NOT add captions, hashtags, CTAs, watermarks or secondary text elements`;
}

// ─── Campaign Anchor Contract ─────────────────────────────────
// Contrato visual obligatorio inyectado al inicio de cada prompt derivado.
// Cuando se dispone de anchorAnalysis (extraído de la imagen real elegida),
// usa datos concretos. Si no, usa los campos del plan como fallback.
//
// Prioridad aplicada:
//  1. Identidad de producto (referencias del usuario)
//  2. Campaign Anchor Contract — datos reales del ancla (este bloque)
//  3. Visual invariant locks
//  4. Rol del shot
//  5. Inteligencia visual / familia editorial
//  6. Variación creativa
function buildAnchorContract(
  plan:           CampaignPlan,
  selected:       ReturnType<typeof selectBestRefs>,
  pieceRole?:     string,
  anchorAnalysis?: CampaignAnchorAnalysis,
): string {
  const spine      = plan.visualSpine;
  const lock       = plan.stylingLock;
  const hasModel   = !!selected.modelRef;
  const hasProduct = selected.productRefs.length > 0;
  const aa         = anchorAnalysis; // alias corto

  // Sin spine ni análisis no hay contrato útil
  if (!spine && !aa) return '';

  // ── 1. Product Identity Invariants ──────────────────────────
  let productLine: string;
  if (aa?.product?.category) {
    productLine = `🔒 PRODUCT IDENTITY (extracted from anchor image):
  - Category: ${aa.product.category}
  - Color family: ${aa.product.colorFamily}
  - Material / texture: ${aa.product.materialDesc}
  - Dominance in composition: ${aa.product.dominanceLevel}
  - DO NOT change category, material, color, or scale. DO NOT replace with a generic or redesigned version.`;
  } else if (hasProduct) {
    productLine = `🔒 PRODUCT IDENTITY: Same product as in the PRODUCT REFERENCE — identical category, shape, silhouette, materials, colors, proportions, textures, and distinctive details. DO NOT replace or redesign.`;
  } else {
    productLine = `🔒 PRODUCT IDENTITY: No product reference provided — keep the product consistent with what appears in the anchor image.`;
  }

  // ── 2. Environment Invariants ────────────────────────────────
  let envLine: string;
  if (aa?.environment?.locationType) {
    envLine = `🔒 ENVIRONMENT (extracted from anchor image):
  - Location type: ${aa.environment.locationType}
  - Indoor / outdoor: ${aa.environment.indoorOutdoor}
  - Background: ${aa.environment.backgroundDesc}
  - Surface language: ${aa.environment.surfaceLanguage}
  - Production tier: ${aa.environment.productionTier}
  - Props level: ${aa.environment.propsLevel}
  - DO NOT jump to a different environment type. Same production tier throughout.`;
  } else {
    envLine = `🔒 ENVIRONMENT: ${spine?.campaignEnvironmentRule ?? 'Keep the same environment as the anchor.'}
  - Same location type, production tier, and surface language as the anchor.
  - DO NOT switch between studio/real, indoor/outdoor, or incompatible production tiers.`;
  }

  // ── 3. Lighting Invariants ───────────────────────────────────
  let lightLine: string;
  if (aa?.lighting?.primarySource) {
    lightLine = `🔒 LIGHTING (extracted from anchor image):
  - Source: ${aa.lighting.primarySource}
  - Direction: ${aa.lighting.direction}
  - Color temperature: ${aa.lighting.colorTemperature}
  - Shadow type: ${aa.lighting.shadowType}
  - Intensity: ${aa.lighting.intensity}
  - Production level: ${aa.lighting.productionLevel}
  - DO NOT shift color temperature, add/remove light sources, or change dramatic vs soft mood.`;
  } else {
    lightLine = `🔒 LIGHTING: ${spine?.campaignLightingRule ?? 'Same lighting as the anchor.'}
  - Same direction, color temperature, shadow type, and intensity as the anchor.
  - DO NOT shift warm/cool balance or change light source type.`;
  }

  // ── 4. Wardrobe / Styling Invariants ────────────────────────
  let wardrobeLine = '';
  if (aa?.styling?.hasVisiblePerson && aa.styling.garmentCategory) {
    const bodyTypeLine = aa.styling.bodyType
      ? `\n  - Body type: ${aa.styling.bodyType} — PRESERVE this body type exactly. Do NOT slim down, normalize, or idealize. Clothing must drape to fit this body, not the reverse.`
      : '';
    const marksLine = aa.styling.visibleMarks
      ? `\n  - Visible marks: ${aa.styling.visibleMarks} — reproduce ONLY if current outfit leaves that skin area exposed. If covered by clothing, omitting them is correct.`
      : '';
    wardrobeLine = `🔒 WARDROBE / BODY / STYLING (extracted from anchor image):
  - Garment category: ${aa.styling.garmentCategory} — DO NOT switch to a different garment category.
  - Color family: ${aa.styling.outfitColorFamily}
  - Formality: ${aa.styling.formalityTier} — DO NOT shift formality tier.
  - Silhouette: ${aa.styling.silhouette}${bodyTypeLine}${marksLine}
  - 🚫 ${aa.styling.doNotSwitch}
  - The outfit supports the product — product is always the visual hero.`;
  } else if (hasModel && lock?.hasVisibleModel) {
    const bodyTypeLine = lock.bodyType
      ? `\n  - Body type: ${lock.bodyType} — PRESERVE this body type exactly. Do NOT slim down, normalize, or idealize. Clothing must drape to fit this body, not the reverse.`
      : '';
    const marksLine = lock.visibleMarks
      ? `\n  - Visible marks: ${lock.visibleMarks} — reproduce ONLY if current outfit leaves that skin area exposed. If covered by clothing, omitting them is correct.`
      : '';
    wardrobeLine = `🔒 WARDROBE / BODY / STYLING:
  - Garment category: ${lock.garmentCategory} — DO NOT switch categories.
  - Color family: ${lock.outfitColorFamily}
  - Formality: ${lock.stylingFormality}
  - Silhouette: ${lock.silhouetteLogic}${bodyTypeLine}${marksLine}
  - 🚫 ${lock.doNotSwitch}
  - The outfit supports the product — product is always the visual hero.`;
  } else if (hasModel) {
    wardrobeLine = `🔒 WARDROBE / BODY / STYLING: Model is present. Keep outfit coherent with the anchor. DO NOT invent new garment categories or shift formality tier. Preserve the model's body type and proportions as seen in the anchor. Product is always the visual hero.`;
  }

  // ── 5. Model Presence Invariants ────────────────────────────
  const anchorHasModel = aa ? aa.styling.hasVisiblePerson : hasModel;
  let modelPresenceLine: string;
  if (anchorHasModel) {
    modelPresenceLine = `🔒 MODEL PRESENCE: Model is present in the anchor. Maintain consistent prominence, crop logic, face visibility, and product/model relationship. DO NOT flip to product-only unless this shot role explicitly requires it.`;
  } else {
    modelPresenceLine = `🔒 MODEL PRESENCE: Anchor is product-focused — no person visible. Keep the campaign product-focused. DO NOT introduce a person unless the piece role explicitly requires lifestyle context.`;
  }

  // ── 6. Composition Invariants ────────────────────────────────
  let compLine: string;
  if (aa?.composition?.framingStyle) {
    compLine = `🔒 COMPOSITION (extracted from anchor image):
  - Shot type: ${aa.composition.shotType}
  - Camera distance: ${aa.composition.cameraDistance}
  - Negative space: ${aa.composition.negativeSpace}
  - Visual hierarchy: ${aa.composition.visualHierarchy}
  - Framing style: ${aa.composition.framingStyle}
  - DO NOT flip framing style, change visual hierarchy, or place product floating disproportionately large.`;
  } else {
    compLine = `🔒 COMPOSITION: ${spine?.campaignCompositionRule ?? 'Keep the same composition language as the anchor.'}
  - Maintain product dominance, negative space, crop language, and visual hierarchy from the anchor.
  - DO NOT flip from minimal to busy or vice versa. DO NOT float product giant in foreground.`;
  }

  // ── 7. Campaign Mood Invariants ──────────────────────────────
  let moodLine: string;
  if (aa?.mood?.overallMood) {
    moodLine = `🔒 MOOD (extracted from anchor image):
  - Emotional register: ${aa.mood.emotionalRegister}
  - Energy level: ${aa.mood.energyLevel}
  - Color palette: ${aa.mood.colorPalette}
  - Overall mood: ${aa.mood.overallMood}
  - DO NOT break: ${spine?.campaignDoNotBreakRule ?? 'do not change the visual world established by the anchor.'}
  - Premium/casual tier, editorial/UGC register, and color feel must remain identical.`;
  } else {
    moodLine = `🔒 MOOD: ${spine?.campaignColorPaletteRule ?? 'Same color palette and mood as the anchor.'}
  - Preserve emotional register: ${plan.moodboardTexto ?? spine?.campaignVisualConcept ?? 'consistent with anchor.'}
  - DO NOT break: ${spine?.campaignDoNotBreakRule ?? 'do not change the visual world.'}`;
  }

  // ── Allowed vs forbidden ─────────────────────────────────────
  const variationLine = `✅ ALLOWED VARIATIONS (shot role determines these): angle · crop · camera distance · pose · product interaction type · product detail focus · body position · shot type (hero/detail/in-use/texture/lifestyle/closing)${pieceRole ? ` · this shot = ${pieceRole}` : ''}
🚫 FORBIDDEN DRIFT: product category/material/shape change · environment jump · lighting mood shift · outfit category switch · model presence flip · composition tier change · text/typography inside image · poster layout · product floating giant in foreground`;

  const sourceNote = aa
    ? '(invariants extracted from the actual chosen anchor image)'
    : '(invariants from campaign plan — anchor image is visual reference)';

  return `╔══════════════════════════════════════════════════════════════════════╗
║         CAMPAIGN ANCHOR CONTRACT — VISUAL INVARIANT LOCK            ║
║  Every derived image MUST obey this contract. No exceptions.        ║
║  The anchor image defines the visual truth. These rules are NOT     ║
║  suggestions. They are hard constraints above all creative logic.   ║
║  ${sourceNote.padEnd(68)}║
╚══════════════════════════════════════════════════════════════════════╝

This is a NEW ANGLE of the SAME SESSION as the anchor image.
Visual world, product, lighting, environment, styling, and mood are FIXED.
Only the shot type, angle, crop, and pose may change.

${productLine}

${envLine}

${lightLine}

${wardrobeLine ? wardrobeLine + '\n\n' : ''}${modelPresenceLine}

${compLine}

${moodLine}

${variationLine}

🚫 NO TEXT IN IMAGE — no typography, no overlay, no slogan, no caption, no poster layout, no magazine headline, no written words, no white border ad layout, no brand copy inside the photo. Copy lives in the caption field only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ─── Prompt para imagen de campaña derivada (con ancla) ───────
function buildDerivedImagePrompt(
  pieza:          CampaignPiece,
  plan:           CampaignPlan,
  selected:       ReturnType<typeof selectBestRefs>,
  hasAnchor:      boolean,
  anchorAnalysis?: CampaignAnchorAnalysis,
  hpiConfig?:     HpiConfig,
): string {
  const hasModel   = !!selected.modelRef;
  const hasProduct = selected.productRefs.length > 0;
  const modo: ModoVisual = plan.modoVisual ?? 'editorial';
  const paradigm   = modo === 'ugc' ? UGC_PARADIGM : EDITORIAL_PARADIGM;
  const lockSystem = buildLockSystem(selected, hasAnchor, modo);

  const canalLabel = CAMPAIGN_CHANNEL_META[pieza.canal]?.label ?? pieza.canal;
  const channelOpt = (canalLabel === 'Instagram Stories' || canalLabel === 'TikTok')
    ? 'Vertical 9:16. Key elements in center zone. Safe margins top and bottom.'
    : canalLabel === 'WhatsApp / Catálogo'
    ? 'Square or slightly vertical. Clean product focus. Simple background.'
    : 'Square or 4:5. Strong focal point. Scroll-stopping composition.';

  // ── Anchor Contract — contrato visual obligatorio que precede todo lo demás ──
  const anchorWorldLock = hasAnchor ? buildAnchorContract(plan, selected, pieza.rol, anchorAnalysis) : '';

  // ── Inteligencia visual de familia ────────────────────────────
  // UGC: siempre usamos el ID asignado por Gemini a la pieza — no hay spine editorial.
  // Editorial: si la pieza tiene un ID distinto al spine maestro, prevalece el spine
  //   para mantener coherencia visual en toda la campaña.
  const effectiveFamilyId = modo === 'ugc'
    ? (pieza.visualFamilyId ?? '')
    : (plan.visualSpine && pieza.visualFamilyId
        && pieza.visualFamilyId !== plan.visualSpine.campaignVisualFamilyId
      ? plan.visualSpine.campaignVisualFamilyId
      : (pieza.visualFamilyId ?? ''));

  let visualFamilyBlock = '';
  let guardrailsBlock = '';

  if (effectiveFamilyId) {
    const family = modo === 'ugc'
      ? getUgcFamilyById(effectiveFamilyId)
      : getFamilyById(effectiveFamilyId);

    if (family) {
      const blendText = extractBlendText(family);
      const baseBlock = extractBasePromptBlock(family);
      const guards    = extractGuardrails(family);

      if (blendText) {
        visualFamilyBlock += `\nVISUAL FAMILY DNA:\n${blendText}`;
      }
      if (baseBlock) {
        if (modo === 'ugc') {
          visualFamilyBlock += `\n\nUGC CREATOR BEHAVIOR PATTERN:\n${baseBlock}`;
          visualFamilyBlock += `\n(This describes CREATOR BEHAVIOR — extract the human interaction with the product. Do NOT copy the scene, location, or background. The environment comes from the Anchor Contract above.)`;
        } else {
          visualFamilyBlock += `\n\nTRANSFERABLE PROMPT BLOCK:\n${baseBlock}`;
          visualFamilyBlock += `\n(Use as pattern — adapt to the user's actual product. Never copy branding, logos or text from the source.)`;
        }
      }
      if (pieza.psychologicalGoal) {
        visualFamilyBlock += `\n\nPSYCHOLOGICAL GOAL FOR THIS PIECE:\n${pieza.psychologicalGoal}`;
      }
      if (guards.length > 0) {
        guardrailsBlock = `\nAI RISK GUARDRAILS:\n${guards.map(g => `- ${g}`).join('\n')}`;
      }
    }
  }

  // Bloque HPI — capa de dirección humana (expresión, pose, gesto, cámara, performance)
  // Solo aplica cuando hay modelo subido explícitamente.
  // Para shots de producto solo: NO inyectar — el ancla ya dice "no introducir persona"
  // y HPI con instrucciones de pose podría hacer que Gemini invente alguien.
  const hpiBlock = (hpiConfig && hasModel) ? buildHpiBlock(hpiConfig) : '';

  return `${anchorWorldLock ? anchorWorldLock + '\n' : ''}${paradigm}
${hasModel ? `🔴 IDENTITY LOCK: MODEL REF = face/hair/skin ONLY. Outfit category and styling family from ANCHOR CONTRACT above, NOT from model photo.\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${hasAnchor ? 'NEW PHOTO — SAME SESSION AS THE ANCHOR IMAGE. ANCHOR CONTRACT ABOVE IS BINDING.' : 'CAMPAIGN PHOTO.'}

CAMPAIGN: "${plan.concepto}"
${plan.clienteIdeal ? `Target audience: ${plan.clienteIdeal}` : ''}
PIECE ROLE: ${pieza.rol} — Day ${pieza.dia} of 7
CHANNEL: ${canalLabel}

VISUAL DIRECTION FOR THIS PIECE (obeys Anchor Contract above):
${pieza.imagePrompt}

${lockSystem}
${visualFamilyBlock}
${guardrailsBlock}
${hpiBlock ? '\n' + hpiBlock : ''}

CHANNEL: ${channelOpt}

${buildTypographyInstructions(plan, pieza)}

🚫 FINAL HARD BLOCKS (reinforce Anchor Contract): no text/typography/overlay · no outfit category change · no environment jump · no product shape/material/category change · product+model share same spatial plane · no mood/lighting shift · no poster layout

✅ FINAL CHECKLIST: ${hasProduct ? 'product = same category/shape/material as reference · ' : ''}${hasModel ? 'face = model ref only · outfit category = anchor system · ' : ''}no text inside image · same visual world as anchor · same production level as anchor`;
}

// ─── buildCampaignPlan ────────────────────────────────────────
export async function buildCampaignPlan(
  idea:       string,
  canales:    CampaignChannel[],
  imageCount: number,
  slots:      CampaignImageSlot[],
): Promise<CampaignPlan> {
  const canalesLabel = canales.map(c => CAMPAIGN_CHANNEL_META[c].label).join(', ');
  const selected     = selectBestRefs(slots);

  const slotsContext = [
    selected.productRefs.length > 0 && `- ${selected.productRefs.length} PRODUCT IMAGE(S) attached: analyze the product type, colors, packaging, commercial positioning. ${selected.productRefs.length > 1 ? 'Multiple angles provided — understand the product fully.' : ''}`,
    selected.inspirationRef          && '- INSPIRATION IMAGE attached: analyze the visual mood, lighting style, color palette, and aesthetic.',
    selected.brandRef                && '- BRAND IMAGE attached: analyze brand colors, style, and visual identity.',
    selected.modelRef                && '- MODEL IMAGE attached: this person will star in the campaign.',
  ].filter(Boolean).join('\n');

  const hasInspirationImages = !!selected.inspirationRef;

  // ── Inteligencia visual (editorial + UGC) ─────────────────────
  // El modo visual final se decide cuando el usuario elige el ancla.
  // Incluimos ambos bloques para que Gemini pueda asignar familias
  // de cualquier modo desde el inicio. Si no hay familias, el bloque
  // queda vacío y no afecta nada.
  const editorialBlock = buildCampaignIntelligencePromptBlock('editorial');
  const ugcBlock       = buildUgcIntelligencePromptBlock();
  const intelligenceBlock = [editorialBlock, ugcBlock].filter(Boolean).join('\n\n');

  // ── Prioridad 1: Prompt en dos fases (Director Creativo → Brief de Fotógrafo) ──
  // VISUAL SPINE CONTEXT: instrucciones para que Gemini elija UNA familia visual maestra
  // y defina las reglas unificadoras de toda la campaña. Esto evita que cada pieza
  // use un mundo visual distinto (botín oscuro / catálogo blanco / neón nocturno).
  const prompt = `You are a senior creative team working together: Creative Director, Photographer, Community Manager, and Marketing Strategist — all specialized in Latin American e-commerce brands.

You work in two phases:

═══════════════════════════════════════════════════
PHASE 1 — CREATIVE DIRECTOR: Situation Analysis
═══════════════════════════════════════════════════

CLIENT BRIEF: "${idea}"
CHANNELS: ${canalesLabel}
IMAGES TO PRODUCE: ${imageCount}

${slotsContext ? `WHAT WE HAVE TO WORK WITH:\n${slotsContext}` : 'No visual references provided — work from the brief alone.'}

Answer these questions to build the creative foundation:
1. What does this entrepreneur REALLY need right now? (launch / sale / awareness / engagement)
2. Who is the EXACT ideal customer? (age, lifestyle, pain point, desires — be specific, not generic)
3. What is the CENTRAL TENSION this product resolves? ("I want X but I have problem Y")
4. What is the single most powerful creative concept — the emotional thread?
5. What is the 3-act narrative arc: tension → revelation → transformation?

REFERENCE ROLES (critical — establish this before any visual decisions):
${selected.modelRef ? `- MODEL: provides FACE and IDENTITY only. The outfit in their reference photo is IRRELEVANT to campaign styling.` : `- NO MODEL PROVIDED: describe the ideal person to cast based on the target audience.`}
${selected.productRefs.length > 0 ? `- PRODUCT: the VISUAL HERO of every image. Must be clearly identifiable.` : `- NO PRODUCT PHOTO: describe the product based on brief.`}
${selected.inspirationRef ? `- INSPIRATION: defines visual aesthetic and mood only. Does NOT define people or products.` : ``}
${selected.brandRef ? `- BRAND: defines color palette and visual identity only.` : ``}

═══════════════════════════════════════════════════
PHASE 2 — PHOTOGRAPHER + COMMUNITY MANAGER + MARKETER
═══════════════════════════════════════════════════

Using the creative foundation above, now produce the full campaign plan.

CAMPAIGN VISUAL SPINE (critical — define this FIRST):
Before assigning any imagePrompt, choose ONE master visual family for the entire campaign.
The campaign must look like a UNIFIED editorial series — not 8 random images of the same product.

Rules:
- Choose ONE family from the editorial library as "campaignVisualFamilyId" — this is the master.
- Each piece may have its own "visualFamilyId" ONLY if it is compatible with the master family.
  If it is not compatible, it must use the master family ID. Never mix incompatible visual worlds.
- Define "campaignVisualConcept": one sentence describing the shared visual world.
- Define "campaignLightingRule": one rule for lighting that applies to ALL pieces.
- Define "campaignEnvironmentRule": one rule for environment/location type for ALL pieces.
- Define "campaignCompositionRule": one rule for composition approach for ALL pieces.
- Define "campaignColorPaletteRule": one sentence defining the shared color palette.
- Define "campaignDoNotBreakRule": what must NEVER change across any piece (e.g. "no white e-commerce backgrounds, no neon night scenes, no flat lay wood surfaces in the same campaign").
- Pieces vary by CAMPAIGN ROLE (hero, detail, lifestyle, texture, social proof, closing), NOT by visual world.
- For footwear/fashion: AVOID mixing white ecommerce, dark studio, neon night, warm interior, wood flat lay in the same campaign unless the campaignVisualConcept explicitly justifies it.

CAMPAIGN STYLING LOCK (define if a model will appear in any piece):
This lock RESTRICTS the AI from inventing new outfits. It describes the styling family to PRESERVE across all model shots.
The anchor image will establish the actual visual — this lock is a constraint, not a creative direction.
- "hasVisibleModel": true only if campaign pieces will show a person with visible clothing.
- "outfitColorFamily": the color family the outfit should belong to — aligned with the product and concept (e.g. "black — solid dark tones", "warm neutrals — cream, sand").
- "garmentCategory": the garment type to use for model shots (e.g. "long midi skirt", "tailored trousers", "structured coat"). Choose ONE category and keep it.
- "stylingFormality": formality that fits the product ("formal editorial", "smart casual", "casual"). Footwear campaigns: match the boot's formality.
- "silhouetteLogic": "structured/refined", "flowing/ethereal", "oversized/relaxed" — match the product's character.
- "fashionMood": 3-4 words (e.g. "editorial minimalist", "luxury understated", "urban editorial"). Product is hero.
- "doNotSwitch": explicit prohibition on garment category changes (e.g. "no mini dress, no catsuit, no leggings, no casual pants — keep the refined long silhouette throughout").
If no model is planned, set hasVisibleModel to false and leave other fields as empty strings.

PHOTOGRAPHER BRIEF (imagePrompt rules):
- Write each imagePrompt as a photographer's shot brief — specific scene, subject position, lighting quality, composition, emotion.
- The PRODUCT (boot/shoe/footwear) is the visual hero. It must be CLEARLY VISIBLE and named explicitly in every prompt.
- Vary by SHOT TYPE, not by world: hero product shot / worn close-up / walking/leg crop / detail shot / model seated / model standing / closing editorial shot.
- If a person is present: describe ONLY pose, expression, body action, and approximate garment type from the styling lock. Do NOT invent new garment categories. Do NOT name brands.
- NEVER mention text, slogan, typography, headline, caption, or graphic design in imagePrompt. The copy lives in the caption field, NOT inside the image.
- NEVER describe poster layouts, magazine spreads, or editorial text compositions in imagePrompt.
- Format: "[Shot type]. [Product placement and visibility]. [Subject action if model present]. [Lighting from campaign spine]. [Composition]. [Mood]."
- All 8 prompts must describe variations within the SAME world (same light, same background, same palette) — never jump to a new environment.
- The campaign should feel like ONE editorial product shoot with multiple angles, NOT multiple concepts.

TYPOGRAPHY DECISION:
${hasInspirationImages
  ? `Analyze the INSPIRATION images carefully:
- If inspiration is UGC/lifestyle/product-only (no graphic text) → textoEnImagenes: "none"
- If inspiration has subtle text overlay → textoEnImagenes: "minimal"
- If inspiration has strong graphic/editorial text → textoEnImagenes: "editorial"
When not "none": describe typography in estiloTexto (weight, color, placement, case).`
  : `No inspiration uploaded → textoEnImagenes: "none" unless brief mentions poster/graphic/editorial style.`}
Only 30-50% of pieces should have text in "minimal"/"editorial" mode. Use text for teasers and launches; pure photography for product and lifestyle shots.

RULES:
- Exactly ${imageCount} pieces, max 2/day, spread across 7 days
- Copy: human, warm, Latin American Spanish — emotion, specificity, real CTAs
- Hashtags: niche-specific, researched, NOT generic

${intelligenceBlock ? intelligenceBlock + '\n' : ''}
RESPOND ONLY WITH VALID JSON (no markdown, no explanations outside the JSON):
{
  "concepto": "The emotional thread — 1 evocative sentence",
  "promesa": "What the campaign promises to the customer — 1 sentence",
  "tagline": "Memorable phrase — max 8 words in Spanish",
  "duracionDias": 7,
  "resumen": "2-3 sentences: what to do and why it works",
  "clienteIdeal": "Exact target: age, lifestyle, pain, desire — 1 specific sentence",
  "dolorCentral": "The core tension this product resolves — 1 sentence",
  "moodboardTexto": "Visual world description: environment, light quality, color palette, energy — 2 sentences",
  "textoEnImagenes": "none",
  "estiloTexto": null,
  "modoVisual": "ugc",
  "visualSpine": {
    "campaignVisualFamilyId": "ID of the master visual family from the editorial library",
    "campaignVisualConcept": "One sentence: the shared visual world that unifies all 8 images",
    "campaignLightingRule": "Lighting rule that applies to every single piece",
    "campaignEnvironmentRule": "Environment/location rule for all pieces",
    "campaignCompositionRule": "Composition approach that runs through the entire campaign",
    "campaignColorPaletteRule": "The unified color palette description",
    "campaignDoNotBreakRule": "What must never change or be mixed in any piece of this campaign"
  },
  "stylingLock": {
    "hasVisibleModel": false,
    "outfitColorFamily": "black — solid black or very dark tones",
    "garmentCategory": "long midi skirt or tailored trousers",
    "stylingFormality": "formal editorial",
    "silhouetteLogic": "structured and refined",
    "fashionMood": "editorial minimalist — product-forward",
    "doNotSwitch": "do not switch to mini dress, catsuit, leggings or casual pants; keep the elegant refined silhouette throughout the campaign"
  },
  "hashtagsComunidad": ["#tag1","#tag2","#tag3"],
  "hashtagsNicho": ["#tag4","#tag5","#tag6","#tag7"],
  "hashtagsColarga": ["#tag8","#tag9","#tag10"],
  "piezas": [
    {
      "id": "pieza_1",
      "dia": 1,
      "semana": 1,
      "canal": "instagram_feed",
      "rol": "Teaser",
      "usaTexto": false,
      "visualFamilyId": "same as campaignVisualFamilyId or compatible sub-family",
      "psychologicalGoal": "",
      "imagePrompt": "[Scene consistent with campaignVisualConcept]. [Subject and what they're doing]. [Lighting per campaignLightingRule]. [Composition per campaignCompositionRule]. [Mood]. [Channel].",
      "titular": "Short impactful headline max 60 chars in Spanish",
      "caption": "Full post text Latin American Spanish with emojis if natural max 200 chars",
      "cta": "Specific call to action max 40 chars",
      "hashtags": ["#hashtag1","#hashtag2","#hashtag3","#hashtag4"],
      "instruccion": "One simple specific action for Sofi",
      "horaRecomendada": "19:00"
    }
  ]
}`;

  try {
    console.log('[CampaignDirector] buildCampaignPlan', { slots: slots.length, canales, imageCount });
    const raw     = await geminiService.generateCampaignPlan(prompt, slots);
    const cleaned = (typeof raw === 'string' ? raw : JSON.stringify(raw))
      .replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}/);

    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed?.piezas && Array.isArray(parsed.piezas) && parsed.piezas.length > 0) {
        const textoMode: TextoEnImagenes =
          ['none', 'minimal', 'editorial'].includes(parsed.textoEnImagenes)
            ? parsed.textoEnImagenes : 'none';
        parsed.textoEnImagenes = textoMode;
        parsed.estiloTexto     = parsed.estiloTexto ?? null;
        // modoVisual viene del plan de Gemini pero se sobreescribirá cuando la usuaria elija el ancla
        parsed.modoVisual      = (['ugc', 'editorial'].includes(parsed.modoVisual) ? parsed.modoVisual : 'ugc') as ModoVisual;
        parsed.clienteIdeal    = parsed.clienteIdeal ?? null;
        parsed.dolorCentral    = parsed.dolorCentral ?? null;
        parsed.moodboardTexto  = parsed.moodboardTexto ?? null;

        // Normalizar visualSpine
        const rawSpine = parsed.visualSpine;
        if (rawSpine && typeof rawSpine === 'object' && rawSpine.campaignVisualFamilyId) {
          parsed.visualSpine = {
            campaignVisualFamilyId:   String(rawSpine.campaignVisualFamilyId ?? ''),
            campaignVisualConcept:    String(rawSpine.campaignVisualConcept  ?? ''),
            campaignLightingRule:     String(rawSpine.campaignLightingRule   ?? ''),
            campaignEnvironmentRule:  String(rawSpine.campaignEnvironmentRule ?? ''),
            campaignCompositionRule:  String(rawSpine.campaignCompositionRule ?? ''),
            campaignColorPaletteRule: String(rawSpine.campaignColorPaletteRule ?? ''),
            campaignDoNotBreakRule:   String(rawSpine.campaignDoNotBreakRule  ?? ''),
          } as CampaignVisualSpine;
        } else {
          parsed.visualSpine = undefined;
        }

        // Normalizar stylingLock
        const rawLock = parsed.stylingLock;
        if (rawLock && typeof rawLock === 'object') {
          parsed.stylingLock = {
            hasVisibleModel:   rawLock.hasVisibleModel === true,
            outfitColorFamily: String(rawLock.outfitColorFamily ?? ''),
            garmentCategory:   String(rawLock.garmentCategory   ?? ''),
            stylingFormality:  String(rawLock.stylingFormality   ?? ''),
            silhouetteLogic:   String(rawLock.silhouetteLogic    ?? ''),
            fashionMood:       String(rawLock.fashionMood        ?? ''),
            doNotSwitch:       String(rawLock.doNotSwitch        ?? ''),
          } as CampaignStylingLock;
        } else {
          parsed.stylingLock = undefined;
        }

        const masterFamilyId = (parsed.visualSpine as CampaignVisualSpine | undefined)?.campaignVisualFamilyId ?? '';

        parsed.piezas = parsed.piezas.slice(0, imageCount).map((p: any, i: number) => ({
          ...p,
          id:                p.id ?? `pieza_${i + 1}`,
          imageUrl:          '',
          hashtags:          Array.isArray(p.hashtags) ? p.hashtags : [],
          usaTexto:          textoMode !== 'none' ? (p.usaTexto ?? false) : false,
          // Si la pieza no tiene familia o tiene una familia distinta a la maestra,
          // forzar la familia maestra para mantener la columna vertebral visual
          visualFamilyId:    typeof p.visualFamilyId === 'string' && p.visualFamilyId
            ? p.visualFamilyId  // se reconciliará en buildDerivedImagePrompt
            : masterFamilyId,
          psychologicalGoal: typeof p.psychologicalGoal === 'string' ? p.psychologicalGoal : '',
        }));
        console.log('[CampaignDirector] Plan OK:', {
          concepto: parsed.concepto, piezas: parsed.piezas.length,
          modoVisual: parsed.modoVisual, textoEnImagenes: parsed.textoEnImagenes,
          clienteIdeal: parsed.clienteIdeal,
          visualSpine: parsed.visualSpine?.campaignVisualFamilyId,
          stylingLock: parsed.stylingLock?.hasVisibleModel ? parsed.stylingLock.garmentCategory : 'no model',
        });
        return parsed as CampaignPlan;
      }
    }
    throw new Error('Invalid plan structure from Gemini');
  } catch (err) {
    console.warn('[CampaignDirector] buildCampaignPlan fallback:', err);
    return buildFallbackPlan(idea, canales, imageCount);
  }
}

// ─── generateAnchorImages — genera 2 opciones de ancla ────────
export async function generateAnchorImages(
  plan:    CampaignPlan,
  slots:   CampaignImageSlot[],
  sessionParams: { uid?: string; sessionId?: string },
  onProgress?: (done: number, total: number, partialUrls?: string[]) => void,
): Promise<string[]> {
  const selected = selectBestRefs(slots);
  const refs     = await buildStratifiedRefsCompressed(selected);

  // Generamos las 2 anclas en paralelo pero capturamos cada URL al terminar
  // para poder mostrarlas en la UI en tiempo real
  const partialResults: string[] = ['', ''];

  // Para la variante B (editorial) usamos el visual spine del plan (familia maestra).
  // Para la variante A (ugc) usamos la familia ugc_core más frecuente en las piezas.
  // Si no hay spine, fallback a la familia más frecuente.
  const spine = plan.visualSpine;
  const topEditorialFamily = spine?.campaignVisualFamilyId
    ? (getFamilyById(spine.campaignVisualFamilyId) ?? getTopFamilyFromPieces(plan.piezas ?? []))
    : getTopFamilyFromPieces(plan.piezas ?? []);
  const topUgcFamily = getTopUgcFamilyFromPieces(plan.piezas ?? []);

  const generateOne = async (variant: 'A' | 'B', index: number): Promise<string> => {
    const modo: ModoVisual = variant === 'A' ? 'ugc' : 'editorial';
    let basePrompt = buildAnchorPrompt(plan, selected, variant);

    if (variant === 'B') {
      // Inyectar visual spine completo en el anchor editorial
      if (spine) {
        basePrompt += `\n\n╔══════════════════════════════════════════════════════════════════╗
║   CAMPAIGN VISUAL SPINE — THIS ANCHOR DEFINES THE CAMPAIGN     ║
╚══════════════════════════════════════════════════════════════════╝
This image IS the visual reference for every other image in this campaign.
Establish these rules visually — all derived images will inherit them:

▸ Visual concept  : ${spine.campaignVisualConcept}
▸ Lighting        : ${spine.campaignLightingRule}
▸ Environment     : ${spine.campaignEnvironmentRule}
▸ Composition     : ${spine.campaignCompositionRule}
▸ Color palette   : ${spine.campaignColorPaletteRule}
🚫 Never break     : ${spine.campaignDoNotBreakRule}`;
      }
      if (topEditorialFamily) {
        const anchorBlock = extractAnchorPromptBlock(topEditorialFamily);
        if (anchorBlock) {
          basePrompt += `\n\nEDITORIAL VISUAL FAMILY ANCHOR:\n${anchorBlock}`;
        }
      }
    }

    if (variant === 'A' && topUgcFamily) {
      const anchorBlock = extractAnchorPromptBlock(topUgcFamily);
      if (anchorBlock) {
        basePrompt += `\n\nUGC VISUAL FAMILY ANCHOR:\n${anchorBlock}`;
      }
    }

    const params = {
      prompt:          basePrompt,
      negative:        getNegative(modo),
      referenceImages: refs,
      aspectRatio:     '3:4' as const,
      module:          'campaign_anchor',
      moduleLabel:     `Campaign Anchor ${variant}`,
      shotIndex:       index,
      totalShots:      ANCHOR_IMAGE_COUNT,
      uid:             sessionParams.uid,
      sessionId:       sessionParams.sessionId,
      metadata:        { variant, modo, role: 'anchor' },
    };
    const url = await imageApiService.generateImage(params);
    partialResults[index] = url ?? '';
    const done = partialResults.filter(Boolean).length;
    onProgress?.(done, ANCHOR_IMAGE_COUNT, [...partialResults]);
    return url ?? '';
  };

  console.log('[CampaignDirector] generateAnchorImages', { refs: refs.length });

  const [urlA, urlB] = await Promise.allSettled([
    generateOne('A', 0),
    generateOne('B', 1),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : ''));

  return [urlA, urlB];
}

// ─── generateCampaignImages — genera N imágenes con ancla ─────
export async function generateCampaignImages(
  plan:           CampaignPlan,
  slots:          CampaignImageSlot[],
  anchorImage:    string,
  sessionParams:  { uid?: string; sessionId?: string },
  onProgress?:    (done: number, total: number, partialUrls?: string[]) => void,
  anchorAnalysis?: CampaignAnchorAnalysis,
  hpiConfig?:     HpiConfig,
): Promise<string[]> {
  const selected  = selectBestRefs(slots);
  const refs      = await buildStratifiedRefsCompressed(selected, anchorImage);
  const hasAnchor = !!anchorImage;
  const total     = plan.piezas.length;

  const getAspectRatio = (canal: CampaignChannel): '3:4' | '9:16' | '1:1' => {
    if (canal === 'instagram_stories' || canal === 'tiktok') return '9:16';
    if (canal === 'whatsapp') return '1:1';
    return '3:4';
  };

  console.log('[CampaignDirector] generateCampaignImages', {
    total,
    refs: refs.length,
    hasAnchor,
    hasAnchorAnalysis: !!anchorAnalysis,
    hasModel:   !!selected.modelRef,
    hasProduct: selected.productRefs.length > 0,
  });

  const CONCURRENCY = 2;
  const partialResults: string[] = Array(total).fill('');
  const modo: ModoVisual = plan.modoVisual ?? 'editorial';

  // Negativos base del modo + negativos anatómicos HPI (si está habilitado)
  const hpiNegatives = (hpiConfig?.enabled && hpiConfig.gender)
    ? getHpiNegatives(hpiConfig.gender).join(', ')
    : '';
  const buildNegative = (m: ModoVisual) => {
    const base = getNegative(m);
    return hpiNegatives ? `${base}, ${hpiNegatives}` : base;
  };

  const generateOne = async (pieza: CampaignPiece, index: number): Promise<string> => {
    const url = await imageApiService.generateImage({
      prompt:          buildDerivedImagePrompt(pieza, plan, selected, hasAnchor, anchorAnalysis, hpiConfig),
      negative:        buildNegative(modo),
      referenceImages: refs,
      aspectRatio:     getAspectRatio(pieza.canal),
      module:          'campaign',
      moduleLabel:     'Campaign Generator',
      shotIndex:       index,
      totalShots:      total,
      uid:             sessionParams.uid,
      sessionId:       sessionParams.sessionId,
      metadata:        { role: pieza.rol, dia: pieza.dia, canal: pieza.canal },
    });
    partialResults[index] = url ?? '';
    const done = partialResults.filter(Boolean).length;
    onProgress?.(done, total, [...partialResults]);
    return url ?? '';
  };

  const results: string[] = Array(total).fill('');
  const queue = plan.piezas.map((pieza, i) => ({ pieza, i }));
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        results[item.i] = await generateOne(item.pieza, item.i);
      } catch {
        results[item.i] = '';
      }
    }
  });
  await Promise.all(workers);

  return results;
}

// ─── generateAnchorImagesFromBrief ────────────────────────────
// Nuevo flujo: genera las 2 anclas (UGC + Editorial) directamente
// desde el brief y las referencias, SIN plan previo.
// La inteligencia visual se usa para enriquecer la variante editorial.
// El plan se construye DESPUÉS de que el usuario elige una ancla.
export async function generateAnchorImagesFromBrief(
  idea:          string,
  slots:         CampaignImageSlot[],
  sessionParams: { uid?: string; sessionId?: string },
  onProgress?:   (done: number, total: number, partialUrls?: string[]) => void,
  hpiConfig?:    HpiConfig,
): Promise<string[]> {
  const selected = selectBestRefs(slots);
  const refs     = await buildStratifiedRefsCompressed(selected);
  const partialResults: string[] = ['', ''];

  // Para la variante editorial usamos familias editoriales; para UGC, familias ugc_core.
  // Se inyectan en el prompt de cada variante por separado.
  const editorialAnchorBlock = buildCampaignIntelligencePromptBlock('editorial');
  const ugcAnchorBlock       = buildUgcIntelligencePromptBlock();

  const hasProduct = selected.productRefs.length > 0;
  const hasModel   = !!selected.modelRef;

  const buildBriefAnchorPrompt = (variant: 'A' | 'B'): string => {
    const modo: ModoVisual = variant === 'A' ? 'ugc' : 'editorial';
    const anchorHpiConfig: HpiConfig | undefined = hpiConfig?.enabled
      ? { ...hpiConfig, modoVisual: modo }
      : undefined;
    const paradigm = modo === 'ugc' ? UGC_PARADIGM : EDITORIAL_PARADIGM;
    const lockSystem = buildLockSystem(selected, false, modo);

    const lightingNote = modo === 'ugc'
      ? 'Natural ambient — window, sun, or outdoor. Imperfect and alive.'
      : 'Beautiful controlled natural light — golden hour or clean window.';
    const poseNote = modo === 'ugc'
      ? (hasModel ? 'Full body visible head-to-toe. Organic, asymmetric, mid-movement. Feet must be in frame. NOT catalog.' : 'Organic product placement in real-life context.')
      : (hasModel ? 'Full body visible head-to-toe. Confident and expressive. Aspirational, not stiff. Feet must be in frame.' : 'Hero product — perfectly lit, intentional composition.');
    const bgNote = modo === 'ugc'
      ? 'Real inhabited environment — home, café, street.'
      : 'Curated environment OR minimal clean — serves the concept.';

    // Fix 4: inteligencia va al inicio, antes del lockSystem, para que tenga mayor peso
    const intelligenceSnippet = modo === 'ugc' ? ugcAnchorBlock : editorialAnchorBlock;
    const intelligenceHeader = intelligenceSnippet
      ? `${modo === 'ugc' ? 'UGC' : 'EDITORIAL'} VISUAL INTELLIGENCE:\n${intelligenceSnippet}\n\n`
      : '';

    // Fix 2: product lock explícito en UGC
    const ugcProductLock = modo === 'ugc' && hasProduct
      ? `\n\n${buildUgcProductLock(selected)}`
      : '';

    // Fix 3: styling note para UGC
    const stylingNote = modo === 'ugc' && hasModel
      ? `\nSTYLING NOTE (UGC):
Person wears CASUAL, REAL-LIFE clothing coherent with the campaign brief and target audience.
NOT: luxury outfits, editorial looks, or anything that reads as "brand shoot".
YES: the kind of outfit the target customer actually wears day-to-day.
The styling must feel chosen by the creator, not by a stylist.
This outfit category will carry through all derived UGC images — choose it deliberately.`
      : modo === 'editorial' && hasModel
      ? `\nSTYLING NOTE (EDITORIAL):
Person wears an ELEGANT and COHERENT outfit aligned with the campaign concept.
The outfit defines the styling language for all derived images — make it refined and product-forward.`
      : '';

    return `⚠️ ANCHOR FRAMING — ABSOLUTE RULE, READ FIRST:
FULL BODY SHOT — HEAD TO TOE. This is the single most important constraint of this image.
The model's complete body must be visible: face, torso, legs, and feet — all in frame.
Outfit and footwear must be fully visible with no cropping.
ANY pose is valid (standing, seated, leaning, lying down) as long as the full body is visible.
STRICTLY FORBIDDEN: close-up, bust shot, portrait crop, waist crop, torso-only, legs-only, or any frame where feet or head are cut off.
If you cannot fit the full body in the frame — zoom out until you can.

${paradigm}

${intelligenceHeader}CAMPAIGN BRIEF: "${idea}"
${ugcProductLock}

ANCHOR IMAGE TASK:
This image will define the visual world for the ENTIRE campaign. All other images will inherit its mood, outfit, and environment.
The anchor must establish the complete visual truth: full outfit, full body, complete environment — no gaps for the AI to invent.

- ${hasProduct ? 'Product is the VISUAL HERO — clearly identifiable, prominent, exactly as in the reference.' : 'The concept emotion is the visual hero.'}
- ${hasModel ? 'Person: identity from MODEL REFERENCE only (face/hair/skin). Outfit comes from the creative concept — NOT from the model reference photo.' : 'No specific person required — cast someone fitting the brief.'}
- Lighting: ${lightingNote}
- Pose/Placement: ${poseNote}
- Background: ${bgNote}
${stylingNote}

${lockSystem}

🚫 NO TEXT IN THE IMAGE — pure photography only. No typography, no overlay, no slogan, no magazine headline, no poster layout, no brand copy inside the photo.
🚫 NO disembodied product — do NOT place the product floating disproportionately large in the foreground with a tiny model behind.
🚫 NO cropped body — the anchor MUST show the full body head-to-toe. Feet must be visible.
${anchorHpiConfig && hasModel ? '\n' + buildHpiBlock(anchorHpiConfig) : ''}

FINAL CHECKLIST:
${hasProduct ? '✓ Product is the visual hero — same shape and color as product reference\n' : ''}${hasModel ? '✓ Face AND body from MODEL REFERENCE — same face, same body type, same proportions\n' : ''}${hasModel ? '✓ Outfit is real-life casual coherent with the brief, NOT copied from the model reference photo\n' : ''}✓ FULL BODY visible — head to toe, complete outfit and footwear, no cropping of lower body
✓ Visual mode: ${modo === 'ugc' ? 'organic iPhone feel, real skin, no studio' : 'editorial quality, intentional composition'}
✓ NO text, no graphic design layout
✓ Product and model in same spatial plane — no disproportionate foreground product`;
  };

  const generateOne = async (variant: 'A' | 'B', index: number): Promise<string> => {
    const modo: ModoVisual = variant === 'A' ? 'ugc' : 'editorial';
    const url = await imageApiService.generateImage({
      prompt:          buildBriefAnchorPrompt(variant),
      negative:        getNegative(modo),
      referenceImages: refs,
      aspectRatio:     '3:4' as const,
      module:          'campaign_anchor',
      moduleLabel:     `Campaign Anchor ${variant}`,
      shotIndex:       index,
      totalShots:      ANCHOR_IMAGE_COUNT,
      uid:             sessionParams.uid,
      sessionId:       sessionParams.sessionId,
      metadata:        { variant, modo, role: 'anchor' },
    });
    partialResults[index] = url ?? '';
    const done = partialResults.filter(Boolean).length;
    onProgress?.(done, ANCHOR_IMAGE_COUNT, [...partialResults]);
    return url ?? '';
  };

  console.log('[CampaignDirector] generateAnchorImagesFromBrief', { refs: refs.length });

  const [urlA, urlB] = await Promise.allSettled([
    generateOne('A', 0),
    generateOne('B', 1),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : ''));

  return [urlA, urlB];
}

// ─── analyzeAnchorImage ───────────────────────────────────────
// Extrae las invariantes visuales reales de la imagen ancla elegida.
// Equivalente al analyzeREF0 de ContentStudioPro.
// Si falla, retorna null — el sistema usa el plan como fallback.
export async function analyzeAnchorImage(
  anchorImageBase64: string,
): Promise<CampaignAnchorAnalysis | null> {
  try {
    const mimeType = anchorImageBase64.startsWith('data:')
      ? anchorImageBase64.split(';')[0].split(':')[1]
      : 'image/jpeg';
    const imageData = anchorImageBase64.startsWith('data:')
      ? anchorImageBase64.split(',')[1]
      : anchorImageBase64;

    const analysis = await ugcApiService.analyzeAnchor({ imageData, mimeType });
    console.log('[CampaignDirector] Anchor analysis OK:', {
      lighting: analysis.lighting?.primarySource,
      environment: analysis.environment?.locationType,
      hasModel: analysis.styling?.hasVisiblePerson,
      product: analysis.product?.category,
    });
    return analysis;
  } catch (err) {
    console.warn('[CampaignDirector] analyzeAnchorImage failed, using plan fallback:', err);
    return null;
  }
}

// ─── buildCampaignPlanFromAnchor ──────────────────────────────
// Construye el plan de campaña usando la imagen ancla real + su análisis.
// A diferencia de buildCampaignPlan, aquí Gemini ya conoce el ancla real
// y puede alinear el plan con sus invariantes visuales concretas.
export async function buildCampaignPlanFromAnchor(
  idea:           string,
  canales:        CampaignChannel[],
  imageCount:     number,
  slots:          CampaignImageSlot[],
  anchorAnalysis: CampaignAnchorAnalysis | null,
  modoVisual:     ModoVisual,
): Promise<CampaignPlan> {
  const canalesLabel = canales.map(c => CAMPAIGN_CHANNEL_META[c].label).join(', ');
  const selected     = selectBestRefs(slots);

  const slotsContext = [
    selected.productRefs.length > 0 && `- ${selected.productRefs.length} PRODUCT IMAGE(S) attached.`,
    selected.inspirationRef          && '- INSPIRATION IMAGE attached.',
    selected.brandRef                && '- BRAND IMAGE attached.',
    selected.modelRef                && '- MODEL IMAGE attached.',
  ].filter(Boolean).join('\n');

  // Bloque de invariantes del ancla para orientar a Gemini
  const anchorContext = anchorAnalysis ? `
ANCHOR IMAGE ANALYSIS (the user has already chosen this anchor — your plan MUST be coherent with it):
- Lighting: ${anchorAnalysis.lighting.primarySource}, ${anchorAnalysis.lighting.colorTemperature}, ${anchorAnalysis.lighting.productionLevel}
- Environment: ${anchorAnalysis.environment.locationType} · ${anchorAnalysis.environment.indoorOutdoor} · ${anchorAnalysis.environment.productionTier}
- Product visible: ${anchorAnalysis.product.category} · ${anchorAnalysis.product.colorFamily} · ${anchorAnalysis.product.dominanceLevel}
- Model present: ${anchorAnalysis.styling.hasVisiblePerson ? `YES — ${anchorAnalysis.styling.garmentCategory}, ${anchorAnalysis.styling.formalityTier}${anchorAnalysis.styling.bodyType ? `, body type: ${anchorAnalysis.styling.bodyType}` : ''}` : 'NO'}
- Composition: ${anchorAnalysis.composition.framingStyle} · ${anchorAnalysis.composition.visualHierarchy}
- Mood: ${anchorAnalysis.mood.overallMood} · ${anchorAnalysis.mood.emotionalRegister}
- Visual mode chosen: ${modoVisual.toUpperCase()}

All imagePrompts MUST describe shots that feel like they were taken in the SAME SESSION as this anchor.
The visualSpine and stylingLock you output MUST match these extracted invariants.
` : `Visual mode chosen: ${modoVisual.toUpperCase()}`;

  const intelligenceBlock = modoVisual === 'ugc'
    ? buildUgcIntelligencePromptBlock()
    : buildCampaignIntelligencePromptBlock(modoVisual);
  const hasInspirationImages = !!selected.inspirationRef;

  const prompt = `You are a senior creative team: Creative Director, Photographer, Community Manager, and Marketing Strategist — specialized in Latin American e-commerce brands.

The user has already chosen their anchor image (visual style). Your job is to build a campaign plan that is 100% coherent with that anchor.

═══════════════════════════════════════════════════
ANCHOR + BRIEF CONTEXT
═══════════════════════════════════════════════════

CLIENT BRIEF: "${idea}"
CHANNELS: ${canalesLabel}
IMAGES TO PRODUCE: ${imageCount}
${slotsContext ? `\nREFERENCES:\n${slotsContext}` : ''}

${anchorContext}

═══════════════════════════════════════════════════
YOUR TASK: BUILD THE CAMPAIGN PLAN
═══════════════════════════════════════════════════

PHASE 1 — CREATIVE DIRECTOR:
1. What does this entrepreneur need? (launch / sale / awareness / engagement)
2. Who is the EXACT ideal customer? (age, lifestyle, pain, desires — specific)
3. What is the CENTRAL TENSION this product resolves?
4. What is the single most powerful creative concept — the emotional thread?
5. What is the 3-act narrative: tension → revelation → transformation?

PHASE 2 — PHOTOGRAPHER + COMMUNITY MANAGER + MARKETER:

CAMPAIGN VISUAL SPINE (must match anchor analysis above):
- "campaignVisualFamilyId": choose from editorial library — must match the anchor's visual world
- "campaignVisualConcept": one sentence describing the shared world (coherent with anchor)
- "campaignLightingRule": derived from anchor's actual lighting
- "campaignEnvironmentRule": derived from anchor's actual environment
- "campaignCompositionRule": derived from anchor's composition style
- "campaignColorPaletteRule": derived from anchor's color palette
- "campaignDoNotBreakRule": what must never change (based on anchor's invariants)

CAMPAIGN STYLING LOCK (if model is visible in anchor):
${anchorAnalysis?.styling?.hasVisiblePerson ? `Model IS visible in anchor. Extract from anchor:
- "hasVisibleModel": true
- "outfitColorFamily": "${anchorAnalysis.styling.outfitColorFamily}"
- "garmentCategory": "${anchorAnalysis.styling.garmentCategory}"
- "stylingFormality": "${anchorAnalysis.styling.formalityTier}"
- "silhouetteLogic": "${anchorAnalysis.styling.silhouette}"
- "fashionMood": derive from anchor mood
- "doNotSwitch": "${anchorAnalysis.styling.doNotSwitch}"` : `Model is NOT visible in anchor. Set hasVisibleModel: false.`}

PHOTOGRAPHER BRIEF (imagePrompt rules):
- Each imagePrompt is a NEW ANGLE of the SAME SESSION as the anchor
- Vary: shot type, angle, crop, pose, product interaction, camera distance
- DO NOT vary: environment, lighting mood, production tier, outfit category, product identity
- Format: "[Shot type]. [Product placement]. [Subject action if model]. [Lighting from anchor]. [Composition]. [Mood]."
- NEVER mention text, slogan, typography, headline in imagePrompt

TYPOGRAPHY: ${hasInspirationImages ? 'Analyze inspiration images for text style.' : 'No inspiration — use textoEnImagenes: "none" unless brief mentions poster/graphic style.'}

RULES:
- Exactly ${imageCount} pieces, max 2/day, spread across 7 days
- Copy: human, warm, Latin American Spanish
- Hashtags: niche-specific

${intelligenceBlock ? intelligenceBlock + '\n' : ''}
RESPOND ONLY WITH VALID JSON (no markdown, no explanations outside JSON):
{
  "concepto": "emotional thread — 1 evocative sentence",
  "promesa": "what the campaign promises — 1 sentence",
  "tagline": "memorable phrase max 8 words in Spanish",
  "duracionDias": 7,
  "resumen": "2-3 sentences: what to do and why it works",
  "clienteIdeal": "exact target: age, lifestyle, pain, desire",
  "dolorCentral": "core tension this product resolves",
  "moodboardTexto": "visual world description: environment, light, color, energy — 2 sentences",
  "textoEnImagenes": "none",
  "estiloTexto": null,
  "modoVisual": "${modoVisual}",
  "visualSpine": {
    "campaignVisualFamilyId": "ID from editorial library matching anchor world",
    "campaignVisualConcept": "shared visual world — coherent with anchor",
    "campaignLightingRule": "lighting rule derived from anchor",
    "campaignEnvironmentRule": "environment rule derived from anchor",
    "campaignCompositionRule": "composition approach from anchor",
    "campaignColorPaletteRule": "color palette from anchor",
    "campaignDoNotBreakRule": "what must never change — based on anchor invariants"
  },
  "stylingLock": {
    "hasVisibleModel": ${anchorAnalysis?.styling?.hasVisiblePerson ?? false},
    "outfitColorFamily": "${anchorAnalysis?.styling?.outfitColorFamily ?? ''}",
    "garmentCategory": "${anchorAnalysis?.styling?.garmentCategory ?? ''}",
    "stylingFormality": "${anchorAnalysis?.styling?.formalityTier ?? ''}",
    "silhouetteLogic": "${anchorAnalysis?.styling?.silhouette ?? ''}",
    "fashionMood": "derive from anchor mood and brief",
    "doNotSwitch": "${anchorAnalysis?.styling?.doNotSwitch ?? ''}"
  },
  "hashtagsComunidad": ["#tag1","#tag2","#tag3"],
  "hashtagsNicho": ["#tag4","#tag5","#tag6","#tag7"],
  "hashtagsColarga": ["#tag8","#tag9","#tag10"],
  "piezas": [
    {
      "id": "pieza_1",
      "dia": 1,
      "semana": 1,
      "canal": "instagram_feed",
      "rol": "Teaser",
      "usaTexto": false,
      "visualFamilyId": "same as campaignVisualFamilyId",
      "psychologicalGoal": "",
      "imagePrompt": "New angle of anchor session. [Shot type]. [Product placement]. [Lighting from anchor]. [Composition]. [Mood].",
      "titular": "Short impactful headline max 60 chars in Spanish",
      "caption": "Full post text Latin American Spanish with emojis max 200 chars",
      "cta": "Specific call to action max 40 chars",
      "hashtags": ["#hashtag1","#hashtag2","#hashtag3","#hashtag4"],
      "instruccion": "One simple specific action",
      "horaRecomendada": "19:00"
    }
  ]
}`;

  try {
    console.log('[CampaignDirector] buildCampaignPlanFromAnchor', { modoVisual, hasAnalysis: !!anchorAnalysis });
    const raw     = await geminiService.generateCampaignPlan(prompt, slots);
    const cleaned = (typeof raw === 'string' ? raw : JSON.stringify(raw))
      .replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}/);

    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed?.piezas && Array.isArray(parsed.piezas) && parsed.piezas.length > 0) {
        const textoMode: TextoEnImagenes =
          ['none', 'minimal', 'editorial'].includes(parsed.textoEnImagenes)
            ? parsed.textoEnImagenes : 'none';
        parsed.textoEnImagenes = textoMode;
        parsed.estiloTexto     = parsed.estiloTexto ?? null;
        parsed.modoVisual      = modoVisual; // forzar el modo del ancla elegida
        parsed.clienteIdeal    = parsed.clienteIdeal ?? null;
        parsed.dolorCentral    = parsed.dolorCentral ?? null;
        parsed.moodboardTexto  = parsed.moodboardTexto ?? null;

        const rawSpine = parsed.visualSpine;
        if (rawSpine && typeof rawSpine === 'object' && rawSpine.campaignVisualFamilyId) {
          parsed.visualSpine = {
            campaignVisualFamilyId:   String(rawSpine.campaignVisualFamilyId ?? ''),
            campaignVisualConcept:    String(rawSpine.campaignVisualConcept  ?? ''),
            campaignLightingRule:     String(rawSpine.campaignLightingRule   ?? ''),
            campaignEnvironmentRule:  String(rawSpine.campaignEnvironmentRule ?? ''),
            campaignCompositionRule:  String(rawSpine.campaignCompositionRule ?? ''),
            campaignColorPaletteRule: String(rawSpine.campaignColorPaletteRule ?? ''),
            campaignDoNotBreakRule:   String(rawSpine.campaignDoNotBreakRule  ?? ''),
          } as CampaignVisualSpine;
        } else {
          parsed.visualSpine = undefined;
        }

        const rawLock = parsed.stylingLock;
        if (rawLock && typeof rawLock === 'object') {
          parsed.stylingLock = {
            hasVisibleModel:   rawLock.hasVisibleModel === true,
            outfitColorFamily: String(rawLock.outfitColorFamily ?? anchorAnalysis?.styling?.outfitColorFamily ?? ''),
            garmentCategory:   String(rawLock.garmentCategory   ?? anchorAnalysis?.styling?.garmentCategory   ?? ''),
            stylingFormality:  String(rawLock.stylingFormality   ?? anchorAnalysis?.styling?.formalityTier     ?? ''),
            silhouetteLogic:   String(rawLock.silhouetteLogic    ?? anchorAnalysis?.styling?.silhouette        ?? ''),
            fashionMood:       String(rawLock.fashionMood        ?? ''),
            doNotSwitch:       String(rawLock.doNotSwitch        ?? anchorAnalysis?.styling?.doNotSwitch       ?? ''),
            bodyType:          String(anchorAnalysis?.styling?.bodyType    ?? ''),
            visibleMarks:      String(anchorAnalysis?.styling?.visibleMarks ?? ''),
          } as CampaignStylingLock;
        } else {
          parsed.stylingLock = undefined;
        }

        const masterFamilyId = (parsed.visualSpine as CampaignVisualSpine | undefined)?.campaignVisualFamilyId ?? '';
        parsed.piezas = parsed.piezas.slice(0, imageCount).map((p: any, i: number) => ({
          ...p,
          id:                p.id ?? `pieza_${i + 1}`,
          imageUrl:          '',
          hashtags:          Array.isArray(p.hashtags) ? p.hashtags : [],
          usaTexto:          textoMode !== 'none' ? (p.usaTexto ?? false) : false,
          visualFamilyId:    typeof p.visualFamilyId === 'string' && p.visualFamilyId
            ? p.visualFamilyId : masterFamilyId,
          psychologicalGoal: typeof p.psychologicalGoal === 'string' ? p.psychologicalGoal : '',
        }));

        console.log('[CampaignDirector] PlanFromAnchor OK:', {
          concepto: parsed.concepto, piezas: parsed.piezas.length,
          modoVisual: parsed.modoVisual,
          visualSpine: parsed.visualSpine?.campaignVisualFamilyId,
          stylingLock: parsed.stylingLock?.hasVisibleModel ? parsed.stylingLock.garmentCategory : 'no model',
        });
        return parsed as CampaignPlan;
      }
    }
    throw new Error('Invalid plan structure from Gemini');
  } catch (err) {
    console.warn('[CampaignDirector] buildCampaignPlanFromAnchor fallback:', err);
    return buildFallbackPlan(idea, canales, imageCount);
  }
}

// ─── Fallback ─────────────────────────────────────────────────
function buildFallbackPlan(
  idea:       string,
  canales:    CampaignChannel[],
  imageCount: number,
): CampaignPlan {
  const roles = ['Teaser','Lanzamiento','Beneficio','Confianza','Conversión','Recordatorio','Cierre','Bonus'];
  const piezas: CampaignPiece[] = Array.from({ length: imageCount }, (_, i) => ({
    id:              `pieza_${i + 1}`,
    dia:             Math.min(i + 1, 7),
    semana:          1,
    canal:           canales[i % canales.length],
    rol:             roles[i] ?? `Escena ${i + 1}`,
    imagePrompt:     'Commercial photography. Product on clean neutral surface, soft warm studio lighting, shallow depth of field. Professional e-commerce style.',
    imageUrl:        '',
    titular:         'Descubrí lo nuevo',
    caption:         'Algo especial para vos. ✨ No te lo pierdas.',
    cta:             'Escribime al DM',
    hashtags:        ['#emprendedora', '#tiendaonline', '#nuevoproducto'],
    instruccion:     `Publicá esta imagen el día ${Math.min(i + 1, 7)} a las 19:00hs.`,
    horaRecomendada: '19:00',
  }));

  return {
    concepto:          'Tu producto, en su mejor versión',
    promesa:           'Mostrar lo que vendés con la calidad visual que merece',
    tagline:           'Hecho para destacar.',
    duracionDias:      7,
    piezas,
    modoVisual:        'ugc' as ModoVisual,
    textoEnImagenes:   'none' as TextoEnImagenes,
    estiloTexto:       null,
    clienteIdeal:      null,
    dolorCentral:      null,
    moodboardTexto:    null,
    hashtagsComunidad: ['#emprendedoras', '#tiendaonline', '#negocio'],
    hashtagsNicho:     ['#emprendedoralatina', '#ecommercechile', '#shoplocal'],
    hashtagsColarga:   ['#productoshandmade', '#tiendaonlinechile', '#compralocal'],
    resumen:           'Seguí el plan día a día. Publicá cada pieza en el canal indicado y copiá el caption sugerido.',
  };
}
