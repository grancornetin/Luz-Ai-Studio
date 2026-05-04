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
  productDescription?: string;e
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
   CORE RULES
====================================================== */

const PRODUCT_IDENTITY_RULES = [
  'CRITICAL PRODUCT IDENTITY RULES:',
  'Use the uploaded product images ONLY to understand the product identity: shape, material, color, proportions, real design and visible details.',
  'The product described in PRODUCT TITLE is the ONLY valid subject.',
  'All uploaded product images represent the SAME product in different folds, positions or angles.',
  'Any surface, table, background, cables, room elements, props or environment visible in the uploaded product images are NOT part of the product and must be ignored.',
  'Do NOT replicate the original composition, camera angle, table, surface, background or environment from the uploaded product images.',
  'Generate a NEW composition based on the selected style, objective and shot definition.',
  'Preserve product fidelity over creativity.'
].join('\n');

const PRODUCT_BRANDING_RULES = [
  'BRANDING IDENTITY RULE:',
  'The uploaded product images are the ONLY source of truth for branding, logos, labels, text, printed graphics and inscriptions on the product.',
  'If the uploaded product images do NOT contain logos, text, labels or branding, the generated product MUST NOT include any logos, text, labels, typography or branding.',
  'If the uploaded product images DO contain logos, text, labels or branding, reproduce ONLY those exact elements from the uploaded product images.',
  'Do NOT copy, adapt, imitate or recreate any text, brand name, logo, typography, label or inscription from the reference image.',
  'Branding from the reference image must be completely ignored.',
  'Do NOT invent new logos, labels, text, letters, symbols, slogans, product names or brand marks.'
].join('\n');

const REFERENCE_PRIORITY_RULES = [
  'REFERENCE MODE PRIORITY RULES:',
  'The inspiration/reference image defines the composition, lighting, camera distance, framing, mood, scene and visual hierarchy.',
  'The uploaded product images define ONLY the product identity.',
  'The uploaded product images are the ONLY source of truth for product design, colors, shape, material and product branding.',
  'Replace the product or main object from the reference image with the provided product.',
  'Do NOT mix the reference product with the uploaded product.',
  'Do NOT copy the uploaded product photo background, table, surface, scene or camera angle.',
  'Do NOT copy any text, logo, label or branding from the reference image.',
  'Keep the reference scene, lighting, framing and composition logic.',
  'Only the product should change; the product must remain accurate to the uploaded product images.'
].join('\n');

const SINGLE_IMAGE_RULE = [
  'SINGLE IMAGE OUTPUT RULE:',
  'Do NOT create collages, grids, split screens, contact sheets or multi-image compositions.',
  'Generate one clean product image for this shot only.'
].join('\n');

const GRID_SOURCE_IMAGE_RULE = [
  'GRID SOURCE IMAGE RULE:',
  'Generate only one clean individual product image for this shot.',
  'Do NOT create the final grid inside this image.',
  'Do NOT create collages, split screens, contact sheets or multi-image layouts.',
  'The app will assemble the grid later using the individual generated images.'
].join('\n');

const SHOT_VARIATION_RULES = [
  'SHOT VARIATION RULES:',
  'This shot must have its own distinct composition, camera angle and framing.',
  'Do not repeat the same layout from previous shots.',
  'Do not simply reproduce an uploaded product image.',
  'Do not create a near-duplicate of another generated shot.'
].join('\n');

const INPUT_ARTIFACT_RULES = [
  'INPUT ARTIFACT RULES:',
  'Ignore color swatches, palette dots, UI buttons, screenshots, website frames, app interface elements, watermarks, thumbnails, borders, labels or graphic overlays visible in the uploaded product images.',
  'These artifacts are not part of the product and must not appear in the generated image.',
  'Only the real product itself should be used as identity reference.'
].join('\n');

const HUMAN_CONTEXT_RULES = [
  'HUMAN CONTEXT RULES:',
  'Do not add human models, hands, body parts or faces by default.',
  'If the reference image clearly includes human presence as part of the original composition, it may be preserved only as part of that reference composition.',
  'Do not invent additional people, faces, hands, poses or body parts not required by the reference.'
].join('\n');

const PRODUCT_NEGATIVE_PROMPT = [
  'wrong product',
  'changed product shape',
  'changed product color',
  'changed product material',
  'invented logo',
  'invented branding',
  'copied reference logo',
  'copied reference text',
  'random text',
  'unwanted text',
  'unwanted typography',
  'fake label',
  'new label',
  'watermark',
  'collage',
  'split screen',
  'multi image layout',
  'grid composition',
  'contact sheet',
  'duplicate product',
  'extra product',
  'unrelated clutter',
  'random props',
  'distortion',
  'surreal',
  'cartoon',
  '3d render',
  'cgi look',
  'low resolution',
  'blurred subject'
].join(', ');

/* ======================================================
   HEURISTIC ANALYSIS (sin llamar IA)
====================================================== */

const CATEGORY_KEYWORDS: Record<ProductCategory, string[]> = {
  clothing: [
    'polera', 'camiseta', 'remera', 'shirt', 'tshirt', 't-shirt',
    'hoodie', 'poleron', 'sudadera', 'chaqueta', 'jacket',
    'pantalon', 'pants', 'jeans', 'vestido', 'dress', 'falda',
    'skirt', 'ropa', 'prenda', 'pañuelo', 'panuelo', 'scarf',
    'bandana'
  ],
  footwear: [
    'zapatilla', 'zapatillas', 'sneaker', 'shoe', 'shoes',
    'botin', 'bota', 'sandalia', 'calzado'
  ],
  tech: [
    'iphone', 'celular', 'telefono', 'tablet', 'laptop',
    'notebook', 'teclado', 'mouse', 'audifono', 'camara',
    'smartwatch', 'cargador', 'tech', 'electronica'
  ],
  accessory: [
    'aro', 'aros', 'pulsera', 'collar', 'cadena', 'gorro',
    'beanie', 'lente', 'lentes', 'bolso', 'cartera'
  ],
  jewelry: [
    'joya', 'joyeria', 'anillo', 'plata', 'oro', 'gold',
    'silver', 'brillante', 'diamante', 'perla', 'arete'
  ],
  cosmetic: [
    'labial', 'crema', 'serum', 'perfume', 'maquillaje',
    'cosmetico', 'shampoo', 'skincare', 'fragancia', 'lipstick'
  ],
  home: [
    'lampara', 'silla', 'mesa', 'cuadro', 'deco', 'decoracion',
    'vela', 'mueble', 'cojin'
  ],
  food: [
    'cafe', 'chocolate', 'galleta', 'snack', 'bebida', 'miel',
    'mermelada', 'comida', 'alimento'
  ],
  object: []
};

const normalize = (s?: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

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

    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
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

  if (
    input.productImages.length >= 3
    && ['clothing', 'tech', 'footwear', 'cosmetic'].includes(heuristic.category)
  ) {
    return true;
  }

  if (heuristic.category === 'object') return true;

  return false;
};

const geminiAnalyze = async (input: ProductDirectorInput): Promise<GeminiAnalysisRaw | null> => {
  if (!input.productImages.length) return null;

  try {
    const desc = [
      input.productTitle,
      input.productDescription,
      'Analyze only the product itself. Ignore backgrounds, surfaces, UI elements, color swatches, watermarks, and any reference-scene artifacts.'
    ].filter(Boolean).join('\n');

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

  const normalizedInput: ProductDirectorInput = {
    ...input,
    mode: input.referenceImage ? 'recreate' : input.mode,
    count: input.referenceImage ? (input.count === 2 ? 2 : 1) : input.count,
  };

  const heuristic = heuristicAnalyze(normalizedInput);
  const geminiRaw = shouldUseGemini(normalizedInput, heuristic)
    ? await geminiAnalyze(normalizedInput)
    : null;

  const analysis = mergeAnalysis(heuristic, geminiRaw);
  const masterContext = buildMasterContext(normalizedInput);
  const shotTypes = selectShotTypes(normalizedInput);

  const shots: Shot[] = shotTypes.map((type, index) =>
    buildShot(type, index, normalizedInput.objective)
  );

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
      background: 'match the reference image background family, surface, depth and scene structure',
      lighting: 'match the reference image lighting direction, softness, contrast and shadow behavior',
      colorTone: 'match the reference image color palette and temperature without changing the product color',
      mood: 'reference-based product photography with faithful scene recreation',
      environment: input.allowHumanFromReference
        ? 'reference environment; human presence may be preserved only if the reference clearly contains it'
        : 'reference environment; if humans are present in the reference, preserve only what is necessary for faithful composition and do not invent new humans',
    };
  }

  switch (input.style) {
    case 'minimal':
      return {
        background: 'clean white or beige background',
        lighting: 'soft diffused light',
        colorTone: 'neutral',
        mood: 'minimal',
        environment: 'studio'
      };

    case 'premium':
      return {
        background: 'dark elegant surface',
        lighting: 'cinematic lighting',
        colorTone: 'neutral dark',
        mood: 'luxury premium',
        environment: 'studio'
      };

    case 'lifestyle':
      return {
        background: 'real environment',
        lighting: 'natural light',
        colorTone: 'warm',
        mood: 'lifestyle',
        environment: 'real setting'
      };

    case 'dark':
      return {
        background: 'black background',
        lighting: 'strong directional light',
        colorTone: 'high contrast',
        mood: 'dramatic',
        environment: 'studio'
      };

    case 'natural':
      return {
        background: 'wood or organic textures',
        lighting: 'soft warm light',
        colorTone: 'earth tones',
        mood: 'natural',
        environment: 'organic'
      };

    default:
      return {
        background: 'neutral background',
        lighting: 'soft lighting',
        colorTone: 'balanced',
        mood: 'neutral',
        environment: 'studio'
      };
  }
};

/* ======================================================
   SHOT SELECTION
====================================================== */

const selectShotTypes = (input: ProductDirectorInput): string[] => {

  if (input.referenceImage || input.mode === 'recreate') {
    return input.count === 2
      ? ['REFERENCE_MATCH', 'REFERENCE_VARIATION']
      : ['REFERENCE_MATCH'];
  }

  if (input.mode === 'grid') {
    if (input.gridType === '1x2') return ['FRONT', 'ANGLE'];
    if (input.gridType === '2x2') return ['FRONT', 'BACK', 'DETAIL', 'CONTEXT'];

    return [
      'HERO',
      'FRONT',
      'BACK',
      'SIDE',
      'ANGLE',
      'DETAIL',
      'TOP',
      'CONTEXT',
      'VARIATION'
    ];
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
  const aspectRatio: Shot['aspectRatio'] =
    objective === 'social' ? '4:5'
    : objective === 'ads' ? '1:1'
    : objective === 'technical_catalog' ? '1:1'
    : '3:4';

  return {
    id: `shot_${index + 1}`,
    type,
    composition: getComposition(type),
    framing: getFraming(type),
    focus: getFocus(type),
    environmentRules: getEnvironmentRules(type),
    aspectRatio,
  };
};

/* ======================================================
   SHOT DEFINITIONS
====================================================== */

const getComposition = (type: string): string => {
  switch (type) {
    case 'HERO':
      return 'product centered and dominant in a fresh product-first composition';

    case 'ANGLE':
      return 'three quarter angle, not copied from the uploaded product photos';

    case 'DETAIL':
      return 'close-up detail focused on material, texture or finish';

    case 'CONTEXT':
      return 'product placed in a realistic environment created from the selected style';

    case 'BACK':
      return 'rear view or secondary side view when relevant';

    case 'TOP':
      return 'top-down or elevated product view';

    case 'FRONT':
      return 'straight front view with clean geometry';

    case 'SIDE':
      return 'side profile view showing depth or silhouette';

    case 'VARIATION':
      return 'creative but realistic variation with a new angle and layout';

    case 'REFERENCE_MATCH':
      return 'match the reference image composition, framing and visual hierarchy';

    case 'REFERENCE_VARIATION':
      return 'slight variation of the reference composition while keeping the same visual idea';

    default:
      return 'balanced product-first composition';
  }
};

const getFraming = (type: string): string => {
  switch (type) {
    case 'DETAIL':
      return 'macro close-up';

    case 'REFERENCE_MATCH':
      return 'match reference framing and crop';

    case 'REFERENCE_VARIATION':
      return 'similar crop and camera distance to the reference with a subtle variation';

    case 'TOP':
      return 'overhead or elevated shot';

    default:
      return 'medium shot';
  }
};

const getFocus = (type: string): string => {
  switch (type) {
    case 'DETAIL':
      return 'texture, material, stitching, surface, finish or functional detail';

    case 'REFERENCE_MATCH':
      return 'replace the reference product with the uploaded product while preserving the reference structure';

    case 'REFERENCE_VARIATION':
      return 'same reference idea with slight angle or layout variation';

    default:
      return 'full product visibility and product fidelity';
  }
};

const getEnvironmentRules = (type: string): string => {
  if (type === 'REFERENCE_MATCH') {
    return [
      REFERENCE_PRIORITY_RULES,
      PRODUCT_BRANDING_RULES,
      INPUT_ARTIFACT_RULES,
      HUMAN_CONTEXT_RULES,
      'This shot should be the closest faithful recreation of the reference image.',
      'Only replace the product; do not change the reference scene unnecessarily.',
      'Maintain realistic product integration into the reference scene.',
      'Do not copy text, labels or branding from the reference product.'
    ].join('\n');
  }

  if (type === 'REFERENCE_VARIATION') {
    return [
      REFERENCE_PRIORITY_RULES,
      PRODUCT_BRANDING_RULES,
      INPUT_ARTIFACT_RULES,
      HUMAN_CONTEXT_RULES,
      'Create a subtle variation of the reference, not a new unrelated scene.',
      'Change only one visual factor: slightly different angle, crop or product position.',
      'Keep the same lighting and background family from the reference.',
      'Do not copy text, labels or branding from the reference product.'
    ].join('\n');
  }

  return [
    PRODUCT_IDENTITY_RULES,
    PRODUCT_BRANDING_RULES,
    INPUT_ARTIFACT_RULES,
    HUMAN_CONTEXT_RULES,
    SHOT_VARIATION_RULES,
    'Maintain realism and product accuracy at all times.'
  ].join('\n');
};

/* ======================================================
   PROMPT BUILDER
====================================================== */

export const buildPromptPayloadsFromDirectorResult = (
  input: ProductDirectorInput,
  result: ProductDirectorResult
): ProductPromptPayload[] => {

  const normalizedMode: ProductGenerationMode = input.referenceImage ? 'recreate' : input.mode;

  const referenceImages: string[] = input.referenceImage
    ? [input.referenceImage, ...input.productImages]
    : input.productImages;

  return result.shots.map((shot) => {
    const isReferenceShot = shot.type === 'REFERENCE_MATCH' || shot.type === 'REFERENCE_VARIATION';

    const outputStructureRule =
      normalizedMode === 'grid'
        ? GRID_SOURCE_IMAGE_RULE
        : SINGLE_IMAGE_RULE;

    return {
      shotId: shot.id,
      shotType: shot.type,
      referenceImages,
      negativePrompt: PRODUCT_NEGATIVE_PROMPT,
      aspectRatio: shot.aspectRatio,
      prompt: [
        'Photorealistic product photography.',

        isReferenceShot ? REFERENCE_PRIORITY_RULES : PRODUCT_IDENTITY_RULES,
        PRODUCT_BRANDING_RULES,
        INPUT_ARTIFACT_RULES,
        HUMAN_CONTEXT_RULES,
        outputStructureRule,

        isReferenceShot ? '' : SHOT_VARIATION_RULES,

        `PRODUCT TITLE: ${input.productTitle}`,
        input.productDescription ? `DESCRIPTION: ${input.productDescription}` : '',
        `PRODUCT ANCHOR: ${result.analysis.productAnchor}`,
        `TECHNICAL DESCRIPTION: ${result.analysis.technicalDescription}`,
        `COMMERCIAL DESCRIPTION: ${result.analysis.commercialDescription}`,

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
        'SHOT-SPECIFIC RULES:',
        shot.environmentRules,

        '',
        'FINAL HARD RULE:',
        input.referenceImage
          ? 'Reference image controls scene, lighting and composition. Product images control only product identity, product design and product branding.'
          : 'Product images control only product identity, product design and product branding. Scene and composition must be newly generated.',
      ].filter(Boolean).join('\n'),
    };
  });
};

/* ======================================================
   EXPORT
====================================================== */

export const productDirectorService = {
  run: runProductDirector,
  buildPromptPayloadsFromDirectorResult,
};
