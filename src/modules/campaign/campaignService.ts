import { geminiService } from '../../services/geminiService';
import { imageApiService, extractImageRef } from '../../services/imageApiService';
import { compressImageForUpload } from '../../utils/imageUtils';
import {
  CampaignChannel, CampaignImageSlot, CampaignPiece, CampaignPlan,
  TextoEnImagenes, CAMPAIGN_CHANNEL_META, ANCHOR_IMAGE_COUNT,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN DIRECTOR SERVICE
//
// Flujo inspirado en UGC Studio:
//   1. Gemini 2.5 analiza brief + referencias → plan estratégico completo
//   2. Selección inteligente de referencias (elige las mejores fotos de producto)
//   3. Genera 2 imágenes "ancla" para que Sofi apruebe el estilo visual
//   4. Sofi elige un ancla → se analiza igual que REF0 en UGC Studio
//   5. Genera las N imágenes con [modelo x2, productos, ancla, inspiración, marca]
//      usando el mismo sistema de locks de identidad/producto/estilo que UGC
// ─────────────────────────────────────────────────────────────────────────────

const CAMPAIGN_NEGATIVE = [
  'blurry', 'distorted', 'low quality', 'bad anatomy',
  'extra fingers', 'deformed hands', 'mutated body',
  'bad lighting', 'low resolution', 'overexposed', 'underexposed',
  'ugly', 'poor composition', 'watermark',
  // Texto en imagen — siempre excluido salvo que el prompt lo pida explícitamente
  'text overlay', 'text on image', 'typography', 'words', 'letters',
  'caption on photo', 'subtitle', 'label text', 'graphic design text',
  'collage', 'composite artifacts', 'identity mixing',
  'face distortion', 'skin smoothing', 'beauty filter',
  'airbrushed', 'editorial over-processing', 'plastic skin',
  'wrong product', 'color drift', 'different brand',
].join(', ');

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
// Mismo orden que UGC Studio: identidad primero (duplicada), luego
// producto (duplicado), luego ancla/contexto, luego estilo/marca.

async function buildStratifiedRefsCompressed(
  selected: ReturnType<typeof selectBestRefs>,
  anchorImage?: string,
): Promise<Array<{ data: string; mimeType: string }>> {
  const raw: string[] = [];

  // 1. Modelo — identidad, duplicado para máximo peso
  if (selected.modelRef) {
    raw.push(selected.modelRef.base64);
    raw.push(selected.modelRef.base64);
  }

  // 2. Producto — visual hero, duplicado si solo hay 1
  selected.productRefs.forEach(r => raw.push(r.base64));
  if (selected.productRefs.length === 1) {
    raw.push(selected.productRefs[0].base64);
  }

  // 3. Ancla elegida por Sofi (REF0)
  if (anchorImage) raw.push(anchorImage);

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
function buildLockSystem(selected: ReturnType<typeof selectBestRefs>, hasAnchor: boolean): string {
  const locks: string[] = [];

  if (selected.modelRef) {
    locks.push(`🔒🔒🔒 IDENTITY LOCK (ABSOLUTE PRIORITY):
- MODEL REFERENCE appears MULTIPLE TIMES at the start of the reference list. That is intentional.
- The person's FACE must be EXACTLY the same as the model reference in every single image.
- Same bone structure, eye shape/color, nose, lips, jaw, hair color/texture, skin tone.
- NO face replacement. NO identity drift. NO different person.
- DO NOT average the face with the anchor image. Model reference OVERRIDES everything for identity.
- DO NOT composite — generate the person naturally from scratch.`);
  }

  if (selected.productRefs.length > 0) {
    locks.push(`🔒 PRODUCT LOCK:
- PRODUCT REFERENCE defines the exact product. Same shape, color, materials, labels, packaging.
- ${selected.productRefs.length > 1 ? `Multiple product angles provided — use all of them to understand the product fully.` : ''}
- NO reinterpretation. NO generic version. Reproduce exactly.`);
  }

  if (hasAnchor) {
    locks.push(`🔒🔒 ANCHOR/SESSION LOCK (VISUAL CONTINUITY):
- The ANCHOR IMAGE defines the visual world: lighting direction, color temperature, environment.
- Every campaign image must feel like it was taken in the SAME session as the anchor.
- Same color temperature — do NOT shift warm/cool.
- Same ambient light quality — do NOT add/remove light sources.
- Same overall contrast range — no HDR, no filters, no vignetting.
- Person at correct scale relative to environment.
- The anchor is a STYLE reference, NOT an element to copy literally.`);
  }

  if (selected.inspirationRef) {
    locks.push(`🔒 STYLE LOCK:
- INSPIRATION REFERENCE defines mood, lighting aesthetic, and composition style.
- Match the lighting direction, color temperature, and overall visual atmosphere.
- DO NOT copy the exact scene — use it as MOOD and COMPOSITION reference only.`);
  }

  if (selected.brandRef) {
    locks.push(`🔒 BRAND LOCK:
- BRAND REFERENCE defines color palette and visual identity.
- Maintain coherence with brand colors and aesthetic.`);
  }

  return locks.length === 0 ? '' : `
╔══════════════════════════════════════════════════════════════════╗
║           CAMPAIGN LOCK SYSTEM (NON-NEGOTIABLE)                 ║
╚══════════════════════════════════════════════════════════════════╝

${locks.join('\n\n')}`;
}

// ─── Prompt para imagen ancla ─────────────────────────────────
function buildAnchorPrompt(
  plan:     CampaignPlan,
  slots:    CampaignImageSlot[],
  selected: ReturnType<typeof selectBestRefs>,
  variant:  'A' | 'B',
): string {
  const hasModel    = !!selected.modelRef;
  const hasProduct  = selected.productRefs.length > 0;
  const hasInspo    = !!selected.inspirationRef;

  const refGuide = [
    hasModel    && `- FIRST IMAGES: MODEL REFERENCE — establishes the person's identity. Use EXACTLY.`,
    hasProduct  && `- PRODUCT REFERENCE(S): define the exact product. Show it prominently.`,
    hasInspo    && `- INSPIRATION REFERENCE: defines the mood, lighting, and aesthetic. Match it.`,
  ].filter(Boolean).join('\n');

  // Variant B usa una dirección visual diferente para dar contraste real
  const variantDirection = variant === 'A'
    ? `Natural lifestyle setting. Warm, inviting light. Product and person (if any) feel approachable and real.`
    : `Clean editorial setting. Cooler, more structured light. Strong composition. Product feels premium and aspirational.`;

  const lockSystem = buildLockSystem(selected, false);

  return `You are a professional commercial photographer and creative director.

Generate a CAMPAIGN ANCHOR IMAGE — this image will define the visual style for an entire campaign.

CAMPAIGN CONCEPT: "${plan.concepto}"
CAMPAIGN TAGLINE: "${plan.tagline}"
VISUAL DIRECTION (VARIANT ${variant}): ${variantDirection}

${refGuide ? `REFERENCE GUIDE:\n${refGuide}\n` : ''}

ANCHOR IMAGE REQUIREMENTS:
- This is the HERO image of the campaign — the most impactful, most polished piece
- ${hasProduct ? 'Product is the visual hero — prominently featured, well-lit, crystal clear' : 'Brand concept is the visual hero'}
- ${hasModel ? 'Person is present — natural pose, authentic expression, not catalog-stiff' : 'No person required — focus on product and atmosphere'}
- Professional commercial photography quality — could appear in a brand lookbook
- Lighting: ${variant === 'A' ? 'warm, golden hour or soft window light' : 'clean, diffused studio or overcast natural light'}
- Composition: intentional, not cluttered — hero element takes 40-60% of frame
- Background: ${variant === 'A' ? 'natural environment, lifestyle context' : 'minimal, clean, controlled'}

${lockSystem}

🚫 NO TEXT IN THE IMAGE — no typography, no overlaid words, no captions, no watermarks, no graphic design elements. Pure photography only. Text belongs in the caption, not in the photo. The anchor image is always pure photography — text decisions apply to derived campaign images only.

FINAL CHECKLIST:
${hasProduct ? '✓ Product matches product reference exactly — same shape, color, every detail\n' : ''}${hasModel ? '✓ Person matches model reference exactly — same face, hair, skin tone\n' : ''}${hasInspo ? '✓ Mood and lighting feel matches inspiration reference\n' : ''}✓ Image quality is campaign-ready — no obvious AI artifacts
✓ This image could be the cover of a brand campaign
✓ NO text, typography or graphic design elements in the image`;
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

// ─── Prompt para imagen de campaña derivada (con ancla) ───────
function buildDerivedImagePrompt(
  pieza:     CampaignPiece,
  plan:      CampaignPlan,
  selected:  ReturnType<typeof selectBestRefs>,
  hasAnchor: boolean,
): string {
  const hasModel   = !!selected.modelRef;
  const hasProduct = selected.productRefs.length > 0;

  const refGuide = [
    hasModel   && `- FIRST IMAGES: MODEL REFERENCE (appears multiple times) — IDENTITY LOCK. Use EXACTLY.`,
    hasProduct && `- PRODUCT REFERENCE(S): the exact product. Reproduce faithfully.`,
    hasAnchor  && `- ANCHOR IMAGE: the session's visual world — lighting, color temp, environment. Match it.`,
    !!selected.inspirationRef && `- INSPIRATION: mood and aesthetic reference.`,
    !!selected.brandRef       && `- BRAND: color palette and visual identity.`,
  ].filter(Boolean).join('\n');

  const lockSystem = buildLockSystem(selected, hasAnchor);

  return `⚠️⚠️⚠️ IDENTITY LOCK — READ THIS FIRST ⚠️⚠️⚠️
${hasModel ? `
🔴🔴🔴 CRITICAL: DO NOT AVERAGE THE MODEL WITH THE ANCHOR IMAGE OR ANY OTHER REFERENCE.
The MODEL REFERENCE images appear MULTIPLE TIMES at the start. That is intentional.
They are the ONLY source of truth for the person's identity.
If the anchor image shows a different face angle, IGNORE it for identity — use ONLY the model reference.
DO NOT blend, average, or interpolate between references for the face. 🔴🔴🔴
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${hasAnchor ? 'CREATE A NEW PHOTO FROM THE SAME SESSION AS THE ANCHOR IMAGE.' : 'CREATE A PROFESSIONAL CAMPAIGN PHOTO.'}

CAMPAIGN: "${plan.concepto}"
PIECE ROLE: ${pieza.rol} (Day ${pieza.dia} of 7)
CHANNEL: ${CAMPAIGN_CHANNEL_META[pieza.canal].label}

REFERENCE GUIDE:
${refGuide}

VISUAL DIRECTION:
${pieza.imagePrompt}

${hasAnchor ? `CONTINUITY WITH ANCHOR:
- Same color temperature as anchor — do NOT shift warm/cool.
- Same ambient light quality — same direction, same softness.
- Same overall aesthetic tone — this is part of the same campaign session.
- Person (if present) shares the anchor's lighting.
` : ''}

${lockSystem}

CHANNEL OPTIMIZATION:
${CAMPAIGN_CHANNEL_META[pieza.canal].label === 'Instagram Stories' || CAMPAIGN_CHANNEL_META[pieza.canal].label === 'TikTok'
  ? '- Vertical composition (9:16). Key elements in center-top zone. Text-safe margins.'
  : CAMPAIGN_CHANNEL_META[pieza.canal].label === 'WhatsApp / Catálogo'
  ? '- Square or slightly vertical. Clean, clear product focus. Simple background.'
  : '- Square or 4:5. Strong focal point. Scroll-stopping composition.'}

${buildTypographyInstructions(plan, pieza)}

FINAL CHECKLIST:
${hasModel   ? '✓ Person matches model reference exactly — face, hair, skin tone unchanged\n' : ''}${hasProduct ? '✓ Product matches product reference exactly — same shape, color, every detail\n' : ''}${hasAnchor  ? '✓ Color temperature and lighting match anchor image\n' : ''}✓ Shot role "${pieza.rol}" is clearly communicated
✓ Professional campaign quality — no obvious AI artifacts
${plan.textoEnImagenes === 'none' ? '✓ NO text, typography or graphic design elements in the image' : `✓ Typography style matches: ${plan.estiloTexto ?? 'clean designed text'}`}`;
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

  const prompt = `You are a senior creative director, marketing strategist, and prompt engineer specialized in Latin American e-commerce brands.

Your job: design a complete, executable campaign plan that a solo entrepreneur can follow in 7 days without feeling overwhelmed.

═══════════════════════════════════════════════
BRIEF:
"${idea}"
═══════════════════════════════════════════════
CHANNELS: ${canalesLabel}
IMAGES: ${imageCount}
${slotsContext ? `\nVISUAL REFERENCES:\n${slotsContext}` : ''}

THINK STEP BY STEP:
1. What does this entrepreneur actually need? (launch / sale / awareness / engagement)
2. Define a strong creative concept — the emotional thread tying all pieces together
3. Build a 3-act narrative: tension → revelation → transformation
4. Distribute ${imageCount} pieces across 7 days and selected channels (max 2/day)
5. Write copy that sounds human, warm, Latin American Spanish — never generic AI copy
6. Create NICHE-SPECIFIC hashtags — NOT generic like #emprendedora
7. For each piece, write an imagePrompt in ENGLISH — specific, visual, directional:
   "Commercial photography. [Subject]. [Composition]. [Lighting]. [Mood]. [Channel context]."
   IMPORTANT: imagePrompt must NEVER include any text, words, or typography instructions.
   Text decisions are handled separately — do NOT write "with text overlay", "with caption", etc.

TYPOGRAPHY DECISION (critical — analyze this carefully):
${hasInspirationImages
  ? `The entrepreneur uploaded INSPIRATION images. Analyze them to decide the text-in-image style:
- If the inspiration is UGC/lifestyle/product-only (no text on image) → textoEnImagenes: "none"
- If the inspiration has subtle text (a small phrase, minimal overlay) → textoEnImagenes: "minimal"
- If the inspiration has strong graphic text (editorial, magazine style, billboard) → textoEnImagenes: "editorial"
When textoEnImagenes is "minimal" or "editorial", describe the typography style you see or infer
from the inspiration in estiloTexto (font weight, color, placement, case — e.g., "serif white bold
uppercase, centered top third" or "thin sans-serif black, bottom-left aligned, sentence case").`
  : `No inspiration images uploaded. Default to textoEnImagenes: "none" unless the brief explicitly
mentions graphic text, poster-style, or editorial look. If so, infer a clean modern style.`}

NOT every image needs text — for "minimal" and "editorial" styles, only 30-50% of pieces should
have text. Use your creative judgment: text works best for teasers, launches, and closing pieces.
For product shots, lifestyle, and social proof — pure photography usually wins.

RULES:
- Exactly ${imageCount} pieces
- Max 2 pieces per day, spread across 7 days
- Copy feels written by a real person — emotion, specificity, real CTAs
- Instructions for Sofi: ONE simple action per piece
- Hashtags: real, niche-specific, researched for this product/category
- imagePrompt: English, 2-3 sentences, highly specific and visual — NO text/typography mentions ever

RESPOND ONLY WITH VALID JSON (no markdown):
{
  "concepto": "Creative thread — 1 evocative sentence",
  "promesa": "What this campaign promises to Sofi's customer — 1 sentence",
  "tagline": "Memorable campaign phrase — max 8 words in Spanish",
  "duracionDias": 7,
  "resumen": "2-3 sentences telling Sofi exactly what to do and why it will work",
  "textoEnImagenes": "none",
  "estiloTexto": null,
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
      "imagePrompt": "Commercial photography. [specific visual]. [composition]. [lighting]. [mood]. Optimized for Instagram Feed.",
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
        // Normalizar decisión tipográfica
        const textoMode: TextoEnImagenes =
          ['none', 'minimal', 'editorial'].includes(parsed.textoEnImagenes)
            ? parsed.textoEnImagenes
            : 'none';
        parsed.textoEnImagenes = textoMode;
        parsed.estiloTexto = parsed.estiloTexto ?? null;

        parsed.piezas = parsed.piezas.slice(0, imageCount).map((p: any, i: number) => ({
          ...p,
          id:       p.id ?? `pieza_${i + 1}`,
          imageUrl: '',
          hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
          // usaTexto: si el plan tiene texto, Gemini decide por pieza; si no, siempre false
          usaTexto: textoMode !== 'none' ? (p.usaTexto ?? false) : false,
        }));
        console.log('[CampaignDirector] Plan OK:', {
          concepto: parsed.concepto,
          piezas:   parsed.piezas.length,
          textoEnImagenes: parsed.textoEnImagenes,
          estiloTexto: parsed.estiloTexto,
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

  const generateOne = async (variant: 'A' | 'B', index: number): Promise<string> => {
    const params = {
      prompt:          buildAnchorPrompt(plan, slots, selected, variant),
      negative:        CAMPAIGN_NEGATIVE,
      referenceImages: refs,
      aspectRatio:     '3:4' as const,
      module:          'campaign_anchor',
      moduleLabel:     `Campaign Anchor ${variant}`,
      shotIndex:       index,
      totalShots:      ANCHOR_IMAGE_COUNT,
      uid:             sessionParams.uid,
      sessionId:       sessionParams.sessionId,
      metadata:        { variant, role: 'anchor' },
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
  plan:        CampaignPlan,
  slots:       CampaignImageSlot[],
  anchorImage: string,
  sessionParams: { uid?: string; sessionId?: string },
  onProgress?: (done: number, total: number, partialUrls?: string[]) => void,
): Promise<string[]> {
  const selected = selectBestRefs(slots);
  const refs     = await buildStratifiedRefsCompressed(selected, anchorImage);
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
    hasModel:   !!selected.modelRef,
    hasProduct: selected.productRefs.length > 0,
  });

  // Generamos cada pieza individualmente para poder mostrar URLs en tiempo real
  const partialResults: string[] = Array(total).fill('');

  const generateOne = async (pieza: CampaignPiece, index: number): Promise<string> => {
    const url = await imageApiService.generateImage({
      prompt:          buildDerivedImagePrompt(pieza, plan, selected, hasAnchor),
      negative:        CAMPAIGN_NEGATIVE,
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

  const settled = await Promise.allSettled(
    plan.piezas.map((pieza, i) => generateOne(pieza, i))
  );

  return settled.map(r => r.status === 'fulfilled' ? r.value : '');
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
    textoEnImagenes:   'none' as TextoEnImagenes,
    estiloTexto:       null,
    hashtagsComunidad: ['#emprendedoras', '#tiendaonline', '#negocio'],
    hashtagsNicho:     ['#emprendedoralatina', '#ecommercechile', '#shoplocal'],
    hashtagsColarga:   ['#productoshandmade', '#tiendaonlinechile', '#compralocal'],
    resumen:           'Seguí el plan día a día. Publicá cada pieza en el canal indicado y copiá el caption sugerido.',
  };
}
