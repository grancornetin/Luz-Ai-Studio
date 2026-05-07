import { geminiService } from '../../services/geminiService';
import { imageApiService, extractImageRef } from '../../services/imageApiService';
import {
  CampaignChannel, CampaignImageSlot, CampaignPiece, CampaignPlan,
  CAMPAIGN_CHANNEL_META,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN DIRECTOR SERVICE
//
// Arquitectura inspirada en UGC Studio:
//   1. Gemini 2.5 analiza el brief + imágenes de referencia → construye el plan
//      estratégico completo (concepto, piezas, copy, hashtags, calendario)
//   2. Por cada pieza, se construye un prompt de imagen con los mismos locks
//      de identidad/producto/marca que usa UGC Studio
//   3. Las referencias se pasan estratificadas: producto primero (2x), luego
//      inspiración, luego marca — igual que UGC duplica la cara para reforzar
//   4. La generación usa imageApiService directamente (mismo path que UGC)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Negative prompt compartido con UGC Studio ───────────────
const CAMPAIGN_NEGATIVE = [
  'blurry', 'distorted', 'low quality', 'bad anatomy',
  'extra fingers', 'deformed hands', 'mutated body',
  'bad lighting', 'low resolution', 'overexposed', 'underexposed',
  'ugly', 'poor composition', 'watermark', 'text overlay',
  'collage', 'composite artifacts', 'identity mixing',
  'face distortion', 'skin smoothing', 'beauty filter',
  'airbrushed', 'editorial over-processing', 'plastic skin',
  'wrong product', 'different brand', 'color drift',
].join(', ');

// ─── Lock system para campaña (versión campaign de UGC LOCK_SYSTEM) ──────────
function buildCampaignLockSystem(slots: CampaignImageSlot[]): string {
  const hasProduct     = slots.some(s => s.role === 'product');
  const hasModel       = slots.some(s => s.role === 'model');
  const hasBrand       = slots.some(s => s.role === 'brand');
  const hasInspiration = slots.some(s => s.role === 'inspiration');

  const locks: string[] = [];

  if (hasProduct) locks.push(`🔒 PRODUCT LOCK:
- The product shown in the PRODUCT REFERENCE must appear EXACTLY as-is.
- Same shape, same color, same materials, same label/packaging details.
- NO reinterpretation. NO generic version. NO different product.
- If the product has text or logo, reproduce it faithfully.`);

  if (hasModel) locks.push(`🔒🔒🔒 IDENTITY LOCK (ABSOLUTE PRIORITY):
- The MODEL REFERENCE defines the ONLY person allowed in this image.
- Same face, bone structure, skin tone, hair color, texture, eye color. EXACT.
- NO face replacement, NO identity drift, NO different person.
- DO NOT composite or paste the face reference — generate the person naturally.`);

  if (hasBrand) locks.push(`🔒 BRAND LOCK:
- The BRAND REFERENCE defines the visual identity: colors, style, aesthetic.
- Maintain color palette coherence with brand reference.
- NO clashing colors. NO visual style that contradicts the brand.`);

  if (hasInspiration) locks.push(`🔒 STYLE LOCK:
- The INSPIRATION REFERENCE defines the visual mood, lighting, and composition style.
- Match the lighting direction, color temperature, and overall aesthetic.
- DO NOT copy the exact scene — use it as MOOD and STYLE reference only.`);

  if (locks.length === 0) return '';

  return `
╔══════════════════════════════════════════════════════════════════╗
║           CAMPAIGN LOCK SYSTEM (NON-NEGOTIABLE)                 ║
╚══════════════════════════════════════════════════════════════════╝

${locks.join('\n\n')}

🔒 VISUAL CONTINUITY LOCK (ALL PIECES MUST FEEL FROM SAME SESSION):
- Same color temperature across all images.
- Same overall lighting quality — do NOT shift warm/cool between pieces.
- Same aesthetic tone — every piece must feel like the same campaign.
- No Instagram-style color grading. No vignetting. No filters.
`;
}

// ─── Construye el prompt de imagen para una pieza específica ──
function buildImagePrompt(
  piece: CampaignPiece,
  slots: CampaignImageSlot[],
  campaignConcept: string,
  channelLabel: string,
): string {
  const hasProduct     = slots.some(s => s.role === 'product');
  const hasModel       = slots.some(s => s.role === 'model');
  const hasInspiration = slots.some(s => s.role === 'inspiration');
  const hasBrand       = slots.some(s => s.role === 'brand');

  const refGuide = [
    hasModel       && '- FIRST IMAGES: MODEL REFERENCE — defines the person\'s identity. Use EXACTLY.',
    hasProduct     && '- PRODUCT REFERENCE: defines the exact product to show.',
    hasInspiration && '- INSPIRATION REFERENCE: defines the mood, lighting style, and aesthetic.',
    hasBrand       && '- BRAND REFERENCE: defines color palette and visual identity.',
  ].filter(Boolean).join('\n');

  const lockSystem = buildCampaignLockSystem(slots);

  return `You are a professional commercial photographer and creative director.
Generate a high-quality campaign image for the following brief.

CAMPAIGN CONCEPT: "${campaignConcept}"
PIECE ROLE: ${piece.rol}
CHANNEL: ${channelLabel}
DAY: ${piece.dia} of 7

${refGuide ? `REFERENCE GUIDE:\n${refGuide}\n` : ''}

VISUAL DIRECTION:
${piece.imagePrompt}

TECHNICAL REQUIREMENTS:
- Professional commercial photography quality
- ${channelLabel === 'Instagram Stories' || channelLabel === 'TikTok' ? 'Vertical format (9:16 feel), mobile-first composition' : 'Clean, editorial composition'}
- Natural lighting preferred over studio unless brief specifies otherwise
- High resolution, sharp focus on hero element
- ${hasModel ? 'Person is STATIC — no mid-walk, no blurred motion' : 'Product centered and well-lit'}
- Authentic, not over-processed — real quality, not AI-obvious

${lockSystem}

FINAL CHECKLIST:
${hasProduct ? '✓ Product matches product reference exactly\n' : ''}${hasModel ? '✓ Person matches model reference exactly\n' : ''}${hasInspiration ? '✓ Mood and lighting matches inspiration reference\n' : ''}${hasBrand ? '✓ Color palette coherent with brand reference\n' : ''}✓ Image feels professional and campaign-ready
✓ Suitable for ${channelLabel}
✓ Represents "${piece.rol}" role in the campaign narrative`;
}

// ─── buildCampaignPlan — el "director creativo" ───────────────
export async function buildCampaignPlan(
  idea:       string,
  canales:    CampaignChannel[],
  imageCount: number,
  slots:      CampaignImageSlot[],
): Promise<CampaignPlan> {

  const canalesLabel = canales.map(c => CAMPAIGN_CHANNEL_META[c].label).join(', ');

  const hasProduct     = slots.some(s => s.role === 'product');
  const hasInspiration = slots.some(s => s.role === 'inspiration');
  const hasBrand       = slots.some(s => s.role === 'brand');
  const hasModel       = slots.some(s => s.role === 'model');

  const slotsContext = [
    hasProduct     && '- PRODUCT IMAGE attached: analyze the product type, colors, packaging, and commercial positioning.',
    hasInspiration && '- INSPIRATION IMAGE attached: analyze the visual mood, lighting style, color palette, and aesthetic.',
    hasBrand       && '- BRAND IMAGE attached: analyze brand colors, style, and visual identity.',
    hasModel       && '- MODEL/AVATAR IMAGE attached: this person will star in the campaign.',
  ].filter(Boolean).join('\n');

  const prompt = `You are a senior creative director, marketing strategist, and prompt engineer specialized in Latin American e-commerce brands (fashion, cosmetics, lifestyle, artisan products).

Your job: analyze the brief below and design a complete campaign plan that a solo entrepreneur can execute in 7 days without feeling overwhelmed.

═══════════════════════════════════════════════
BRAND BRIEF (written by the entrepreneur):
"${idea}"
═══════════════════════════════════════════════

PUBLISHING CHANNELS: ${canalesLabel}
NUMBER OF IMAGES TO GENERATE: ${imageCount}
${slotsContext ? `\nVISUAL REFERENCES PROVIDED:\n${slotsContext}` : ''}

YOUR TASK — think step by step:

1. UNDERSTAND what this entrepreneur actually needs (launch? sale? awareness? engagement?)
2. DEFINE a strong creative concept — the emotional thread that ties all pieces together
3. BUILD a narrative arc: tension → revelation → transformation (like a 3-act story)
4. DISTRIBUTE ${imageCount} pieces across 7 days and the selected channels
5. WRITE copy that sounds human, warm, in Latin American Spanish — never generic
6. CREATE strategic hashtags specific to this niche — not #emprendedora or #negocio
7. For each piece, write an imagePrompt in ENGLISH that a Gemini image model can execute
   — the imagePrompt must be specific, visual, directional (lighting, composition, mood, subject)
   — if references were provided, the imagePrompt must reference them explicitly
   — format: "Commercial photography. [Subject/hero]. [Composition]. [Lighting]. [Mood]. [Channel context]."

STRICT RULES:
- Exactly ${imageCount} pieces — no more, no less
- Max 2 pieces per day across 7 days
- Each piece has a CLEAR NARRATIVE ROLE (Teaser / Launch / Benefit / Trust / Urgency / Close / Bonus)
- Copy must feel written by a real person, not AI — include emotion, specificity, real CTAs
- Instructions for Sofi must be ONE simple action ("Publicá esto el lunes a las 19hs. Respondé todos los comentarios en la primera hora.")
- Hashtags must be REAL and NICHE-SPECIFIC — research the product category
- imagePrompt in English, 2-3 sentences, highly visual and specific

RESPOND ONLY WITH VALID JSON (no markdown, no explanation):
{
  "concepto": "The creative thread — 1 sentence, evocative",
  "promesa": "What this campaign promises to Sofi's customer — 1 sentence",
  "tagline": "Memorable campaign phrase — max 8 words in Spanish",
  "duracionDias": 7,
  "resumen": "2-3 sentences telling Sofi exactly what to do with this kit and why it will work",
  "hashtagsComunidad": ["#tag1", "#tag2", "#tag3"],
  "hashtagsNicho": ["#tag4", "#tag5", "#tag6", "#tag7"],
  "hashtagsColarga": ["#tag8", "#tag9", "#tag10"],
  "piezas": [
    {
      "id": "pieza_1",
      "dia": 1,
      "semana": 1,
      "canal": "instagram_feed",
      "rol": "Teaser",
      "imagePrompt": "Commercial photography. [Specific visual description in English]. [Composition]. [Lighting]. [Mood]. Optimized for Instagram Feed.",
      "titular": "Short impactful headline (max 60 chars in Spanish)",
      "caption": "Full post text in Latin American Spanish, with emojis if natural, max 200 chars",
      "cta": "Specific call to action (max 40 chars)",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4"],
      "instruccion": "One simple, specific action for Sofi to take",
      "horaRecomendada": "19:00"
    }
  ]
}`;

  try {
    console.log('[CampaignDirector] buildCampaignPlan start', { slots: slots.length, canales, imageCount });
    const raw = await geminiService.generateCampaignPlan(prompt, slots);
    console.log('[CampaignDirector] Gemini raw response length:', raw?.length);

    const cleaned = (typeof raw === 'string' ? raw : JSON.stringify(raw))
      .replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed?.piezas && Array.isArray(parsed.piezas) && parsed.piezas.length > 0) {
        parsed.piezas = parsed.piezas.slice(0, imageCount).map((p: any, i: number) => ({
          ...p,
          id:       p.id       ?? `pieza_${i + 1}`,
          imageUrl: '',
          hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
        }));
        console.log('[CampaignDirector] Plan construido:', { concepto: parsed.concepto, piezas: parsed.piezas.length });
        return parsed as CampaignPlan;
      }
    }
    throw new Error('Gemini returned invalid plan structure');
  } catch (err) {
    console.warn('[CampaignDirector] buildCampaignPlan failed, using fallback:', err);
    return buildFallbackPlan(idea, canales, imageCount);
  }
}

// ─── generateCampaignImages — generación con refs estratificadas ──────────────
// Mismo approach que UGC Studio: producto duplicado para mayor peso,
// luego inspiración y marca como contexto visual.
export async function generateCampaignImages(
  plan:       CampaignPlan,
  slots:      CampaignImageSlot[],
  sessionParams: {
    uid?:         string;
    sessionId?:   string;
  },
  onProgress?: (completed: number, total: number) => void,
): Promise<string[]> {

  const productSlots     = slots.filter(s => s.role === 'product');
  const modelSlots       = slots.filter(s => s.role === 'model');
  const inspirationSlots = slots.filter(s => s.role === 'inspiration');
  const brandSlots       = slots.filter(s => s.role === 'brand');

  // Estratificación de referencias — igual que UGC:
  // Modelo duplicado para máximo peso de identidad
  // Producto duplicado para respeto del objeto
  // Inspiración y marca como contexto secundario
  const buildRefs = (): Array<{ data: string; mimeType: string }> => {
    const refs: string[] = [];

    // Modelo primero (identidad) — duplicado si existe
    modelSlots.forEach(s => refs.push(s.base64));
    if (modelSlots.length > 0) refs.push(modelSlots[0].base64); // duplicar

    // Producto (héroe visual) — duplicado si existe
    productSlots.forEach(s => refs.push(s.base64));
    if (productSlots.length > 0) refs.push(productSlots[0].base64); // duplicar

    // Inspiración (mood/estilo)
    inspirationSlots.forEach(s => refs.push(s.base64));

    // Marca (paleta/identidad visual)
    brandSlots.forEach(s => refs.push(s.base64));

    return refs
      .filter(Boolean)
      .map((b64, i) => {
        try { return extractImageRef(b64, `campaignRef[${i}]`); }
        catch { return null; }
      })
      .filter(Boolean) as Array<{ data: string; mimeType: string }>;
  };

  const refs = buildRefs();
  const total = plan.piezas.length;

  console.log('[CampaignDirector] generateCampaignImages', {
    total,
    refs: refs.length,
    hasModel: modelSlots.length > 0,
    hasProduct: productSlots.length > 0,
  });

  // Determinar aspect ratio por canal — igual que UGC usa 3:4
  const getAspectRatio = (canal: CampaignChannel): '3:4' | '9:16' | '1:1' | '4:3' => {
    if (canal === 'instagram_stories' || canal === 'tiktok') return '9:16';
    if (canal === 'whatsapp') return '1:1';
    return '3:4';
  };

  const jobs = plan.piezas.map((pieza, i) => ({
    prompt:          buildImagePrompt(pieza, slots, plan.concepto, CAMPAIGN_CHANNEL_META[pieza.canal].label),
    negative:        CAMPAIGN_NEGATIVE,
    referenceImages: refs,
    aspectRatio:     getAspectRatio(pieza.canal),
    module:          'campaign',
    moduleLabel:     'Campaign Generator',
    shotIndex:       i,
    totalShots:      total,
    uid:             sessionParams.uid,
    sessionId:       sessionParams.sessionId,
    metadata:        { role: pieza.rol, dia: pieza.dia, canal: pieza.canal },
  }));

  const results = await imageApiService.generateBatch(jobs, (done, t) => {
    onProgress?.(done, t);
  });

  return results.map(r => r ?? '');
}

// ─── Fallback si Gemini falla ─────────────────────────────────
function buildFallbackPlan(
  idea:       string,
  canales:    CampaignChannel[],
  imageCount: number,
): CampaignPlan {
  const roles = ['Teaser', 'Lanzamiento', 'Beneficio', 'Confianza', 'Conversión', 'Recordatorio', 'Cierre', 'Bonus'];

  const piezas: CampaignPiece[] = Array.from({ length: imageCount }, (_, i) => ({
    id:              `pieza_${i + 1}`,
    dia:             Math.min(i + 1, 7),
    semana:          1,
    canal:           canales[i % canales.length],
    rol:             roles[i] ?? `Escena ${i + 1}`,
    imagePrompt:     'Commercial photography. Product on clean neutral surface, soft warm studio lighting, shallow depth of field. Professional e-commerce style. High resolution.',
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
    hashtagsComunidad: ['#emprendedoras', '#tiendaonline', '#negocio'],
    hashtagsNicho:     ['#emprendedoralatina', '#ecommercechile', '#shoplocal'],
    hashtagsColarga:   ['#productoshandmade', '#tiendaonlinechile', '#compralocal'],
    resumen:           'Seguí el plan día a día. Publicá cada pieza en el canal indicado y copiá el caption sugerido. Con constancia, esta campaña va a hacer crecer tu alcance.',
  };
}
