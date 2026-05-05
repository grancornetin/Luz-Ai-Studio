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
  'The uploaded product images are the ONLY source of truth for branding, logos, labels, text, printed graphics, monograms and inscriptions on the product.',
  'If the uploaded product images do NOT contain logos, text, labels or branding, the generated product MUST NOT include any logos, text, labels, typography or branding.',
  'If the uploaded product images DO contain logos, text, labels or branding, reproduce ONLY those exact elements from the uploaded product images.',
  'Do NOT copy, adapt, imitate or recreate any text, brand name, logo, typography, label, monogram or inscription from the reference image.',
  'Branding from the reference image must be completely ignored.',
  'Do NOT invent new logos, labels, text, letters, symbols, slogans, product names or brand marks.'
].join('\n');

const PRODUCT_ANATOMY_LOCK_RULES = [
  'PRODUCT ANATOMY LOCK RULE:',
  'The uploaded product anatomy must remain identical to the product shown in the uploaded product images.',
  'Preserve the exact structure, silhouette, proportions, functional parts, openings, handles, straps, caps, closures, soles, labels, textures, material finish and visible design details.',
  'Do NOT import anatomical features from the reference product.',
  'If the reference product has a feature that the uploaded product does not have, remove that feature and adapt the uploaded product naturally to the scene.',
  'If the uploaded product lacks a handle, strap, lid, opening, heel, closure or attachment shown in the reference, do NOT invent it.',
  'The product must fit the reference scene according to its own anatomy.',
  'Do NOT create a hybrid between the reference product and the uploaded product.'
].join('\n');

const PRODUCT_SILHOUETTE_RULES = [
  'PRODUCT SILHOUETTE OVERRIDE RULE:',
  'The product silhouette, cut, opening, structure, edge shape, profile, volume and proportions must come only from the uploaded product images.',
  'Do NOT preserve the reference product silhouette if it differs from the uploaded product.',
  'Replace the reference product completely with the uploaded product silhouette.',
  'If the reference product is similar but anatomically different, the uploaded product anatomy wins.'
].join('\n');

const PAIR_AND_MULTIPLE_PRODUCT_RULES = [
  'PAIR / MULTIPLE PRODUCT CONSISTENCY RULE:',
  'If the product appears more than once in the scene, every instance must share the same uploaded product identity, color, material, silhouette, anatomy and details.',
  'Do NOT make one product instance follow the reference and another follow the uploaded product.',
  'Do NOT duplicate the product unnaturally; only show multiple instances when the reference scene logically requires it or the product is naturally a pair.',
  'If the product is a pair, both items must look like the same product from the uploaded images.'
].join('\n');

const REFERENCE_PRIORITY_RULES = [
  'REFERENCE MODE PRIORITY RULES:',
  'The inspiration/reference image defines the composition, lighting, camera distance, framing, mood, scene and visual hierarchy.',
  'The uploaded product images define ONLY the product identity.',
  'The uploaded product images are the ONLY source of truth for product design, colors, shape, anatomy, material and product branding.',
  'Replace the product or main object from the reference image with the provided product.',
  'Do NOT mix the reference product with the uploaded product.',
  'Do NOT copy the uploaded product photo background, table, surface, scene or camera angle.',
  'Do NOT copy any text, logo, label or branding from the reference image.',
  'Keep the reference scene, lighting, framing and composition logic.',
  'Only the product should change; the product must remain accurate to the uploaded product images.'
].join('\n');

const REFERENCE_VISUAL_INTENTION_RULES = [
  'REFERENCE VISUAL INTENTION RULE:',
  'Preserve the visual intention of the reference image, not only the objects.',
  'Identify and preserve what makes the reference visually valuable: product placement, camera perspective, lifestyle context, color harmony, supporting props, mood, scene rhythm and relationship between elements.',
  'Do not reduce the reference to a generic scene if its appeal depends on a specific perspective, layout, color coordination or lifestyle story.'
].join('\n');

const REFERENCE_MATCH_CAMERA_LOCK_RULES = [
  'REFERENCE MATCH CAMERA LOCK:',
  'For REFERENCE_MATCH, preserve the reference camera angle, perspective, camera height, lens feeling, crop and spatial layout as closely as possible.',
  'If the reference is top-down, POV, overhead, low-angle, side-view, close-up, flat lay, mirror shot or handheld-style, keep that same camera perspective.',
  'Do NOT convert the reference perspective into a different type of shot.',
  'Do NOT change a POV/top-down reference into a frontal or side product shot.',
  'The camera position is part of the reference and must be respected.'
].join('\n');

const REFERENCE_LAYOUT_RULES = [
  'REFERENCE LAYOUT RULE:',
  'Preserve the main spatial relationship between the key elements in the reference image.',
  'Keep the relative placement of body parts, props, surface, background and product unless the product replacement makes it physically impossible.',
  'Preserve the general pose, product location, prop placement, negative space and directional flow from the reference.',
  'Do not rearrange the reference into a new composition when the user asked to recreate inspiration.'
].join('\n');

const REFERENCE_MATCH_STRICTNESS_RULES = [
  'REFERENCE_MATCH STRICTNESS RULE:',
  'This shot must prioritize faithful recreation over creative variation.',
  'Do not change the main camera angle, object placement, pose, layout, framing or scene structure.',
  'Small adjustments are allowed only when required to fit the uploaded product anatomy naturally into the reference scene.',
  'The output should feel like the same visual idea and same camera setup with the user product replacing the reference product.'
].join('\n');

const REFERENCE_VARIATION_CONTROL_RULES = [
  'REFERENCE_VARIATION CONTROL RULE:',
  'This shot may create a subtle variation, but only one visual factor may change: crop, slight angle, product position, or small prop spacing.',
  'Do not create a new unrelated scene.',
  'Do not change the reference mood, scene family, lighting family or core layout.',
  'The variation must still be recognizably derived from the reference image.'
].join('\n');

const WORN_PRODUCT_INTEGRATION_RULES = [
  'WORN / HELD PRODUCT INTEGRATION RULE:',
  'If the reference shows the product being worn, held, carried or used, preserve the same use context.',
  'The uploaded product must adapt to the body, hand, foot, surface or holder position without changing its identity or anatomy.',
  'Do not turn a worn or held product scene into a standalone product shot.',
  'Do not force the body or hand to use product features that the uploaded product does not have.',
  'The product should be integrated naturally according to its own structure.'
].join('\n');

const PRODUCT_VISIBILITY_RULES = [
  'PRODUCT VISIBILITY RULE:',
  'The uploaded product must remain clearly visible and recognizable as the main product, even inside a lifestyle set with many props.',
  'Supporting props may exist, but they must not cover, hide, replace or visually overpower the uploaded product.',
  'The product should remain readable at first glance.',
  'Do not let the scene become only a portrait, outfit photo, prop arrangement or background image where the product is secondary.'
].join('\n');

const COORDINATED_SET_HARMONY_RULES = [
  'COORDINATED SET HARMONY RULE:',
  'If the reference shows a coordinated lifestyle set where props visually match the reference product, supporting prop colors may be subtly adapted to harmonize with the uploaded product color and material.',
  'Preserve prop types, scene structure and layout; only adapt secondary colors when it supports the original coordinated-set concept.',
  'Do not change the uploaded product color.',
  'Do not recolor every object; only adjust minor supporting props when needed to preserve the visual idea that the set feels coordinated.',
  'The coordinated set must feel natural, commercial and believable.'
].join('\n');

const SUPPORTING_PROP_RULES = [
  'SUPPORTING PROP RULES:',
  'Preserve the type and role of important supporting props from the reference when they define the lifestyle concept.',
  'Supporting props should support the product story, not compete with the uploaded product.',
  'Do not introduce unrelated props that are not part of the reference idea.',
  'Do not remove key props if they are central to the reference concept, unless they physically conflict with the uploaded product.'
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

const HUMAN_PRODUCT_HIERARCHY_RULES = [
  'HUMAN PRODUCT HIERARCHY RULE:',
  'If the reference includes a person, the person may support the lifestyle context, but the uploaded product must remain clearly visible and recognizable.',
  'Do not turn the image into a portrait where the product is secondary or obscured.',
  'Human presence must serve the product scene, not replace the product as the main commercial subject.'
].join('\n');

const PRODUCT_NEGATIVE_PROMPT = [
  'wrong product',
  'changed product shape',
  'changed product color',
  'changed product material',
  'changed product anatomy',
  'imported reference product anatomy',
  'hybrid product',
  'invented handle',
  'invented strap',
  'invented lid',
  'invented closure',
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
  'product hidden',
  'product obscured',
  'product not visible',
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
    'botin', 'bota', 'sandalia', 'calzado', 'tacon', 'tacones',
    'stiletto', 'pump', 'pumps', 'heel', 'heels', 'zapato',
    'zapatos'
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
  object: [
    'botella', 'bottle', 'termo', 'thermos', 'vaso', 'cup',
    'tumbler', 'drinkware', 'mug', 'frasco', 'jar'
  ]
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
      'Analyze only the product itself. Ignore backgrounds, surfaces, UI elements, color swatches, watermarks, and any reference-scene artifacts.',
      'Describe the product anatomy precisely: silhouette, proportions, functional parts, openings, handles, straps, caps, closures, soles, texture, material finish, labels and visible design details.',
      'Do not include reference-scene objects or backgrounds as product features.'
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
      colorTone: 'match the reference image color palette and temperature while preserving the uploaded product color',
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
      return 'match the reference image composition, camera perspective, framing, layout and visual hierarchy';

    case 'REFERENCE_VARIATION':
      return 'subtle variation of the reference composition while keeping the same visual intention, layout family and scene logic';

    default:
      return 'balanced product-first composition';
  }
};

const getFraming = (type: string): string => {
  switch (type) {
    case 'DETAIL':
      return 'macro close-up';

    case 'REFERENCE_MATCH':
      return 'match reference framing, crop, camera height, lens feeling and perspective';

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
      return 'replace the reference product with the uploaded product while preserving the reference structure and product visibility';

    case 'REFERENCE_VARIATION':
      return 'same reference idea with slight angle, crop or product position variation while preserving the reference visual intention';

    default:
      return 'full product visibility and product fidelity';
  }
};

const getEnvironmentRules = (type: string): string => {
  if (type === 'REFERENCE_MATCH') {
    return [
      REFERENCE_PRIORITY_RULES,
      REFERENCE_VISUAL_INTENTION_RULES,
      REFERENCE_MATCH_CAMERA_LOCK_RULES,
      REFERENCE_LAYOUT_RULES,
      REFERENCE_MATCH_STRICTNESS_RULES,
      PRODUCT_ANATOMY_LOCK_RULES,
      PRODUCT_SILHOUETTE_RULES,
      PAIR_AND_MULTIPLE_PRODUCT_RULES,
      PRODUCT_BRANDING_RULES,
      PRODUCT_VISIBILITY_RULES,
      COORDINATED_SET_HARMONY_RULES,
      SUPPORTING_PROP_RULES,
      INPUT_ARTIFACT_RULES,
      HUMAN_CONTEXT_RULES,
      HUMAN_PRODUCT_HIERARCHY_RULES,
      WORN_PRODUCT_INTEGRATION_RULES,
      'This shot should be the closest faithful recreation of the reference image.',
      'Only replace the product; do not change the reference scene unnecessarily.',
      'Maintain realistic product integration into the reference scene.',
      'Do not copy text, labels or branding from the reference product.'
    ].join('\n');
  }

  if (type === 'REFERENCE_VARIATION') {
    return [
      REFERENCE_PRIORITY_RULES,
      REFERENCE_VISUAL_INTENTION_RULES,
      REFERENCE_LAYOUT_RULES,
      REFERENCE_VARIATION_CONTROL_RULES,
      PRODUCT_ANATOMY_LOCK_RULES,
      PRODUCT_SILHOUETTE_RULES,
      PAIR_AND_MULTIPLE_PRODUCT_RULES,
      PRODUCT_BRANDING_RULES,
      PRODUCT_VISIBILITY_RULES,
      COORDINATED_SET_HARMONY_RULES,
      SUPPORTING_PROP_RULES,
      INPUT_ARTIFACT_RULES,
      HUMAN_CONTEXT_RULES,
      HUMAN_PRODUCT_HIERARCHY_RULES,
      WORN_PRODUCT_INTEGRATION_RULES,
      'Create a subtle variation of the reference, not a new unrelated scene.',
      'Change only one visual factor: slightly different angle, crop, product position or minor prop spacing.',
      'Keep the same lighting and background family from the reference.',
      'Do not copy text, labels or branding from the reference product.'
    ].join('\n');
  }

  return [
    PRODUCT_IDENTITY_RULES,
    PRODUCT_ANATOMY_LOCK_RULES,
    PRODUCT_SILHOUETTE_RULES,
    PAIR_AND_MULTIPLE_PRODUCT_RULES,
    PRODUCT_BRANDING_RULES,
    PRODUCT_VISIBILITY_RULES,
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

    const referenceModeRules = isReferenceShot
      ? [
          REFERENCE_PRIORITY_RULES,
          REFERENCE_VISUAL_INTENTION_RULES,
          REFERENCE_LAYOUT_RULES,
          shot.type === 'REFERENCE_MATCH'
            ? REFERENCE_MATCH_CAMERA_LOCK_RULES
            : REFERENCE_VARIATION_CONTROL_RULES
        ].join('\n')
      : PRODUCT_IDENTITY_RULES;

    return {
      shotId: shot.id,
      shotType: shot.type,
      referenceImages,
      negativePrompt: PRODUCT_NEGATIVE_PROMPT,
      aspectRatio: shot.aspectRatio,
      prompt: [
        'Photorealistic product photography.',

        referenceModeRules,
        PRODUCT_ANATOMY_LOCK_RULES,
        PRODUCT_SILHOUETTE_RULES,
        PAIR_AND_MULTIPLE_PRODUCT_RULES,
        PRODUCT_BRANDING_RULES,
        PRODUCT_VISIBILITY_RULES,

        isReferenceShot ? COORDINATED_SET_HARMONY_RULES : '',
        isReferenceShot ? SUPPORTING_PROP_RULES : '',
        INPUT_ARTIFACT_RULES,
        HUMAN_CONTEXT_RULES,
        isReferenceShot ? HUMAN_PRODUCT_HIERARCHY_RULES : '',
        isReferenceShot ? WORN_PRODUCT_INTEGRATION_RULES : '',

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
          ? 'Reference image controls scene, lighting, camera perspective and composition. Product images control only product identity, product anatomy, product design, product color, product material and product branding.'
          : 'Product images control only product identity, product anatomy, product design, product color, product material and product branding. Scene and composition must be newly generated.',
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
