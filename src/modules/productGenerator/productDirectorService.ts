import { geminiService } from '../../services/geminiService';

/* ======================================================
   TYPES
====================================================== */

export type ProductObjective = 'social' | 'ecommerce' | 'technical_catalog' | 'ads';
export type ProductStyle = 'minimal' | 'premium' | 'lifestyle' | 'dark' | 'natural';
export type ProductGenerationMode = 'pack' | 'grid' | 'recreate';
export type ProductGridType = '1x2' | '2x2' | '3x3';

export type ProductCategory =
  | 'clothing' | 'footwear' | 'tech' | 'accessory'
  | 'jewelry' | 'cosmetic' | 'home' | 'food' | 'object';

export type ProductDirectorInput = {
  productImages: string[];
  productTitle: string;
  productDescription?: string;
  objective: ProductObjective;
  style?: ProductStyle;
  referenceImage?: string | null;
  mode: ProductGenerationMode;
  count?: number;
  gridType?: ProductGridType;
  /** Permite humanos en el resultado solo si la referencia los tiene. */
  allowHumanFromReference?: boolean;
  /** Forzar análisis Gemini (default: auto). */
  forceGeminiAnalysis?: boolean;
};

export type MasterContext = {
  background: string;
  lighting: string;
  colorTone: string;
  mood: string;
  environment: string;
};

export type Shot = {
  id: string;
  type: string;
  composition: string;
  framing: string;
  focus: string;
  environmentRules: string;
  /** Aspect ratio sugerido para este shot. */
  aspectRatio: '1:1' | '3:4' | '4:5' | '9:16';
};

/** Análisis del producto: categoría + descripciones para catalogar. */
export type ProductAnalysis = {
  category: ProductCategory;
  productAnchor: string;
  technicalDescription: string;
  commercialDescription: string;
  source: 'heuristic' | 'gemini' | 'hybrid';
  metadata: {
    material?: string;
    color?: string;
    [key: string]: unknown;
  };
};

export type ProductDirectorResult = {
  analysis: ProductAnalysis;
  masterContext: MasterContext;
  shots: Shot[];
};

export type ProductPromptPayload = {
  shotId: string;
  shotType: string;
  prompt: string;
  negativePrompt: string;
  referenceImages: string[];
  aspectRatio: '1:1' | '3:4' | '4:5' | '9:16';
};

/* ======================================================
   CORE RULES (ANTI-COPY SYSTEM)
====================================================== */

const PRODUCT_IDENTITY_RULES = [
  'CRITICAL PRODUCT RULES:',
  'Use the uploaded product images ONLY to understand product identity: shape, material, color and design.',
  'The product described in PRODUCT TITLE is the ONLY valid subject.',
  'All uploaded images represent the SAME product in different folds or positions.',
  'Do NOT replicate the original composition, camera angle, table, surface or background.',
  'Ignore any background elements such as tables, cables, textures or objects.',
  'Generate a NEW composition based on the selected style and shot definition.',
  'Each generated image MUST be visually different in composition and angle.'
].join('\n');

const PRODUCT_NEGATIVE_PROMPT = [
  'wrong product',
  'changed shape',
  'changed color',
  'extra objects',
  'text',
  'watermark',
  'distortion',
  'surreal',
  'cartoon',
  '3d render'
].join(', ');

/* ======================================================
   HEURISTIC ANALYSIS (sin llamar IA)
====================================================== */

const CATEGORY_KEYWORDS: Record<ProductCategory, string[]> = {
  clothing: ['polera', 'camiseta', 'remera', 'shirt', 'tshirt', 't-shirt', 'hoodie', 'poleron', 'sudadera', 'chaqueta', 'jacket', 'pantalon', 'pants', 'jeans', 'vestido', 'dress', 'falda', 'skirt', 'ropa', 'prenda'],
  footwear: ['zapatilla', 'zapatillas', 'sneaker', 'shoe', 'shoes', 'botin', 'bota', 'sandalia', 'calzado'],
  tech:     ['iphone', 'celular', 'telefono', 'tablet', 'laptop', 'notebook', 'teclado', 'mouse', 'audifono', 'camara', 'smartwatch', 'cargador', 'tech', 'electronica'],
  accessory:['aro', 'aros', 'pulsera', 'collar', 'cadena', 'gorro', 'beanie', 'lente', 'lentes', 'bolso', 'cartera'],
  jewelry:  ['joya', 'joyeria', 'anillo', 'plata', 'oro', 'gold', 'silver', 'brillante', 'diamante', 'perla', 'arete'],
  cosmetic: ['labial', 'crema', 'serum', 'perfume', 'maquillaje', 'cosmetico', 'shampoo', 'skincare', 'fragancia', 'lipstick'],
  home:     ['lampara', 'silla', 'mesa', 'cuadro', 'deco', 'decoracion', 'vela', 'mueble', 'cojin'],
  food:     ['cafe', 'chocolate', 'galleta', 'snack', 'bebida', 'miel', 'mermelada', 'comida', 'alimento'],
  object:   []
};

const normalize = (s?: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const cleanText = (s?: string): string => (s || '').replace(/\s+/g, ' ').trim();

const heuristicAnalyze = (input: ProductDirectorInput): ProductAnalysis => {
  const combined = `${normalize(input.productTitle)} ${normalize(input.productDescription)}`.trim();
  let bestCategory: ProductCategory = 'object';
  let bestScore = 0;

  (Object.keys(CATEGORY_KEYWORDS) as ProductCategory[]).forEach((cat) => {
    const score = CATEGORY_KEYWORDS[cat].reduce(
      (acc, kw) => combined.includes(normalize(kw)) ? acc + 1 : acc,
      0,
    );
    if (score > bestScore) { bestScore = score; bestCategory = cat; }
  });

  const anchor = cleanText(`${input.productTitle}. ${input.productDescription || ''}`)
    || `Product titled ${input.productTitle}.`;

  return {
    category: bestCategory,
    productAnchor: anchor,
    technicalDescription: cleanText(input.productDescription) || `Product titled ${input.productTitle}.`,
    commercialDescription: cleanText(input.productDescription) || `Commercial product photography for ${input.productTitle}.`,
    source: 'heuristic',
    metadata: { category: bestCategory },
  };
};

/* ======================================================
   GEMINI ANALYSIS (cuando heurística no alcanza)
====================================================== */

type GeminiAnalysisRaw = {
  technical_description?: string;
  commercial_description?: string;
  product_prompt?: string;
  metadata?: { material?: string; color?: string; category?: string; [k: string]: unknown };
};

const shouldUseGemini = (input: ProductDirectorInput, heuristic: ProductAnalysis): boolean => {
  if (input.forceGeminiAnalysis) return true;
  // Cuando hay 3+ fotos en categorías "complejas" (ropa/tech/cosmético), Gemini ayuda.
  if (input.productImages.length >= 3 && ['clothing', 'tech', 'footwear', 'cosmetic'].includes(heuristic.category)) return true;
  // Si la categoría salió 'object' (no detectó nada), pedir ayuda a Gemini.
  if (heuristic.category === 'object') return true;
  return false;
};

const geminiAnalyze = async (input: ProductDirectorInput): Promise<GeminiAnalysisRaw | null> => {
  if (!input.productImages.length) return null;
  try {
    const desc = [input.productTitle, input.productDescription].filter(Boolean).join('\n');
    const result = await geminiService.analyzeProduct(input.productImages, desc);
    return result as GeminiAnalysisRaw;
  } catch (err) {
    console.warn('[ProductDirector] Gemini analyze failed, using heuristic only.', err);
    return null;
  }
};

const mergeAnalysis = (
  heuristic: ProductAnalysis,
  gemini: GeminiAnalysisRaw | null,
): ProductAnalysis => {
  if (!gemini) return heuristic;
  return {
    ...heuristic,
    source: 'hybrid',
    productAnchor: cleanText(gemini.product_prompt) || heuristic.productAnchor,
    technicalDescription: cleanText(gemini.technical_description) || heuristic.technicalDescription,
    commercialDescription: cleanText(gemini.commercial_description) || heuristic.commercialDescription,
    metadata: {
      ...heuristic.metadata,
      ...gemini.metadata,
    },
  };
};

/* ======================================================
   MAIN DIRECTOR
====================================================== */

export const runProductDirector = async (
  input: ProductDirectorInput
): Promise<ProductDirectorResult> => {

  if (!input.productImages.length) {
    throw new Error('At least one product image is required');
  }

  // 1) Análisis del producto: heurística + Gemini si vale la pena.
  const heuristic = heuristicAnalyze(input);
  const geminiRaw = shouldUseGemini(input, heuristic) ? await geminiAnalyze(input) : null;
  const analysis = mergeAnalysis(heuristic, geminiRaw);

  // 2) Master context.
  const masterContext = buildMasterContext(input);

  // 3) Selección de shot types.
  const shotTypes = selectShotTypes(input);

  // 4) Build shots con aspectRatio segun objective.
  const shots: Shot[] = shotTypes.map((type, index) => buildShot(type, index, input.objective));

  return {
    analysis,
    masterContext,
    shots,
  };
};

/* ======================================================
   MASTER CONTEXT
====================================================== */

const buildMasterContext = (input: ProductDirectorInput): MasterContext => {

  if (input.referenceImage) {
    return {
      background:  'match reference background',
      lighting:    'match reference lighting',
      colorTone:   'match reference tone',
      mood:        'reference-based product photography',
      environment: input.allowHumanFromReference
        ? 'reference environment; human presence allowed only if the reference clearly contains it'
        : 'reference environment without inventing humans',
    };
  }

  switch (input.style) {
    case 'minimal':
      return { background: 'clean white or beige background', lighting: 'soft diffused light', colorTone: 'neutral',          mood: 'minimal',         environment: 'studio'   };
    case 'premium':
      return { background: 'dark elegant surface',            lighting: 'cinematic lighting',  colorTone: 'neutral dark',     mood: 'luxury premium',  environment: 'studio'   };
    case 'lifestyle':
      return { background: 'real environment',                lighting: 'natural light',       colorTone: 'warm',             mood: 'lifestyle',       environment: 'real setting' };
    case 'dark':
      return { background: 'black background',                lighting: 'strong directional light', colorTone: 'high contrast', mood: 'dramatic',     environment: 'studio'   };
    case 'natural':
      return { background: 'wood or organic textures',        lighting: 'soft warm light',     colorTone: 'earth tones',      mood: 'natural',         environment: 'organic'  };
    default:
      return { background: 'neutral background',              lighting: 'soft lighting',       colorTone: 'balanced',         mood: 'neutral',         environment: 'studio'   };
  }
};

/* ======================================================
   SHOT SELECTION
====================================================== */

const selectShotTypes = (input: ProductDirectorInput): string[] => {

  if (input.referenceImage) {
    return input.count === 2
      ? ['REFERENCE_MATCH', 'REFERENCE_VARIATION']
      : ['REFERENCE_MATCH'];
  }

  if (input.mode === 'grid') {
    if (input.gridType === '1x2') return ['FRONT', 'ANGLE'];
    if (input.gridType === '2x2') return ['FRONT', 'BACK', 'DETAIL', 'CONTEXT'];
    return ['HERO', 'FRONT', 'BACK', 'SIDE', 'ANGLE', 'DETAIL', 'TOP', 'CONTEXT', 'VARIATION'];
  }

  if (input.count === 1) return ['HERO'];
  if (input.count === 2) return ['HERO', 'ANGLE'];
  if (input.count === 4) return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT'];

  return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT', 'BACK', 'TOP'];
};

/* ======================================================
   SHOT BUILDER
====================================================== */

const buildShot = (type: string, index: number, objective: ProductObjective): Shot => {
  // Aspect ratio según objetivo: social pide vertical 4:5, ecommerce/catálogo cuadrado, ads horizontal-ish.
  const aspectRatio: Shot['aspectRatio'] =
    objective === 'social' ? '4:5'
    : objective === 'ads' ? '1:1'
    : objective === 'technical_catalog' ? '1:1'
    : '3:4'; // ecommerce default

  return {
    id: `shot_${index + 1}`,
    type,
    composition: getComposition(type),
    framing: getFraming(type),
    focus: getFocus(type),
    environmentRules: getEnvironmentRules(),
    aspectRatio,
  };
};

/* ======================================================
   SHOT DEFINITIONS
====================================================== */

const getComposition = (type: string): string => {
  switch (type) {
    case 'HERO':                return 'product centered and dominant';
    case 'ANGLE':               return 'three quarter angle';
    case 'DETAIL':              return 'close-up detail';
    case 'CONTEXT':             return 'product placed in realistic environment';
    case 'BACK':                return 'rear view';
    case 'TOP':                 return 'top view';
    case 'FRONT':               return 'straight front view';
    case 'SIDE':                return 'side profile view';
    case 'VARIATION':           return 'creative but realistic variation';
    case 'REFERENCE_MATCH':     return 'match reference composition';
    case 'REFERENCE_VARIATION': return 'slight variation of reference';
    default:                    return 'balanced composition';
  }
};

const getFraming = (type: string): string =>
  type === 'DETAIL' ? 'macro close-up' : 'medium shot';

const getFocus = (type: string): string =>
  type === 'DETAIL' ? 'texture and material' : 'full product';

const getEnvironmentRules = (): string => `
${PRODUCT_IDENTITY_RULES}

Each shot must have a unique composition and camera angle.
Do not repeat layouts or perspectives.
Maintain realism and product accuracy.
`;

/* ======================================================
   PROMPT BUILDER
====================================================== */

export const buildPromptPayloadsFromDirectorResult = (
  input: ProductDirectorInput,
  result: ProductDirectorResult
): ProductPromptPayload[] => {

  const referenceImages: string[] = input.referenceImage
    ? [...input.productImages, input.referenceImage]
    : input.productImages;

  return result.shots.map((shot) => ({
    shotId: shot.id,
    shotType: shot.type,
    referenceImages,
    negativePrompt: PRODUCT_NEGATIVE_PROMPT,
    aspectRatio: shot.aspectRatio,
    prompt: [
      'Photorealistic product photography.',
      PRODUCT_IDENTITY_RULES,
      `PRODUCT TITLE: ${input.productTitle}`,
      input.productDescription ? `DESCRIPTION: ${input.productDescription}` : '',
      `PRODUCT ANCHOR: ${result.analysis.productAnchor}`,
      '',
      'MASTER CONTEXT:',
      `Background: ${result.masterContext.background}`,
      `Lighting: ${result.masterContext.lighting}`,
      `Color tone: ${result.masterContext.colorTone}`,
      `Mood: ${result.masterContext.mood}`,
      `Environment: ${result.masterContext.environment}`,
      '',
      `SHOT TYPE: ${shot.type}`,
      `Composition: ${shot.composition}`,
      `Framing: ${shot.framing}`,
      `Focus: ${shot.focus}`,
      '',
      shot.environmentRules,
    ].filter(Boolean).join('\n'),
  }));
};

/* ======================================================
   EXPORT
====================================================== */

export const productDirectorService = {
  run: runProductDirector,
  buildPromptPayloadsFromDirectorResult,
};
