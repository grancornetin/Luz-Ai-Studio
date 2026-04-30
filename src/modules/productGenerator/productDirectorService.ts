// src/modules/productGenerator/productDirectorService.ts
import { geminiService } from '../../services/geminiService';

export type ProductObjective = 'social' | 'ecommerce' | 'technical_catalog' | 'ads';
export type ProductStyle = 'minimal' | 'premium' | 'lifestyle' | 'dark' | 'natural';
export type ProductGenerationMode = 'pack' | 'grid' | 'recreate';
export type ProductGridType = '1x2' | '2x2' | '3x3';

export type ProductCategory =
  | 'clothing'
  | 'footwear'
  | 'tech'
  | 'accessory'
  | 'jewelry'
  | 'cosmetic'
  | 'home'
  | 'food'
  | 'object';

export type ProductStructure = 'flat' | 'volumetric' | 'flexible' | 'small';
export type ProductDetailLevel = 'low' | 'medium' | 'high';
export type ProductUsageContext = 'wearable' | 'handheld' | 'static';

export type ProductShotType =
  | 'HERO'
  | 'ANGLE'
  | 'DETAIL'
  | 'CONTEXT'
  | 'BACK'
  | 'TOP'
  | 'FRONT'
  | 'SIDE'
  | 'REFERENCE_MATCH'
  | 'REFERENCE_VARIATION'
  | 'VARIATION';

export type GeminiProductAnalysisRaw = {
  technical_description?: string;
  commercial_description?: string;
  product_prompt?: string;
  metadata?: {
    material?: string;
    color?: string;
    category?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ProductDirectorInput = {
  productImages: string[];
  productTitle: string;
  productDescription?: string;
  objective: ProductObjective;
  style?: ProductStyle;
  referenceImage?: string | null;
  mode: ProductGenerationMode;
  count?: 1 | 2 | 4 | 6;
  gridType?: ProductGridType;
  forceGeminiAnalysis?: boolean;
  allowHumanFromReference?: boolean;
};

export type ProductAnalysis = {
  category: ProductCategory;
  structure: ProductStructure;
  hasFrontBack: boolean;
  detailLevel: ProductDetailLevel;
  usageContext: ProductUsageContext;
  requiresModel: false;
  allowsHumanContext: boolean;
  recommendedDisplay: 'isolated_product' | 'ghost_mannequin' | 'flat_lay' | 'surface_still_life' | 'context_scene';
  confidence: number;
  source: 'heuristic' | 'gemini' | 'hybrid';
  productAnchor: string;
  technicalDescription: string;
  commercialDescription: string;
  metadata: {
    material?: string;
    color?: string;
    category?: string;
    frontBackReason?: string;
    [key: string]: unknown;
  };
};

export type MasterContext = {
  background: string;
  lighting: string;
  colorTone: string;
  mood: string;
  environment: string;
  constraints: {
    consistency: string;
    realism: string;
    humanPolicy: string;
  };
};

export type ShotPlan = {
  id: string;
  type: ProductShotType;
  priority: number;
  composition: string;
  framing: string;
  focus: string;
  productEmphasis: string;
  environmentRules: string;
  constraints: {
    preserveProduct: string;
    avoid: string;
  };
};

export type ProductDirectorResult = {
  analysis: ProductAnalysis;
  masterContext: MasterContext;
  shots: ShotPlan[];
};

export type ProductPromptPayload = {
  shotId: string;
  shotType: ProductShotType;
  prompt: string;
  negativePrompt: string;
  referenceImages: string[];
  aspectRatio: '1:1' | '3:4' | '4:5' | '9:16';
};

const CATEGORY_KEYWORDS: Record<ProductCategory, string[]> = {
  clothing: [
    'polera', 'camiseta', 'remera', 'playera', 'shirt', 'tshirt', 't-shirt', 'hoodie', 'poleron', 'sudadera',
    'chaqueta', 'jacket', 'pantalon', 'pants', 'jeans', 'vestido', 'dress', 'falda', 'skirt', 'ropa', 'prenda',
    'oversize', 'boxy', 'boxyfit', 'regular fit', 'comfort fit', 'manga larga', 'manga corta'
  ],
  footwear: ['zapatilla', 'zapatillas', 'sneaker', 'sneakers', 'shoe', 'shoes', 'botin', 'bota', 'sandalia', 'calzado'],
  tech: ['iphone', 'celular', 'telefono', 'tablet', 'laptop', 'notebook', 'teclado', 'mouse', 'audifono', 'camara', 'smartwatch', 'cargador', 'tech', 'electronica'],
  accessory: ['aro', 'aros', 'anillo', 'pulsera', 'collar', 'cadena', 'pinza', 'gorro', 'beanie', 'lente', 'lentes', 'bolso', 'cartera'],
  jewelry: ['joya', 'joyeria', 'plata', 'oro', 'gold', 'silver', 'brillante', 'diamante', 'perla', 'pendiente', 'arete'],
  cosmetic: ['labial', 'crema', 'serum', 'perfume', 'maquillaje', 'cosmetico', 'shampoo', 'skincare', 'fragancia', 'lipstick'],
  home: ['lampara', 'silla', 'mesa', 'cuadro', 'deco', 'decoracion', 'vela', 'organizador', 'mueble', 'cojin'],
  food: ['cafe', 'chocolate', 'galleta', 'snack', 'bebida', 'miel', 'mermelada', 'comida', 'alimento'],
  object: []
};

const HUMAN_REFERENCE_WORDS = [
  'person', 'people', 'human', 'model', 'hand', 'hands', 'face', 'body', 'wearing', 'worn', 'persona', 'modelo', 'mano', 'manos', 'rostro', 'cuerpo', 'usando', 'vistiendo'
];

const PRODUCT_NEGATIVE_PROMPT = [
  'wrong product',
  'changed product shape',
  'changed color',
  'invented logo',
  'invented branding',
  'extra text',
  'typography',
  'watermark',
  'signature',
  'deformed geometry',
  'warped product',
  'melted product',
  'duplicate product',
  'unrealistic surreal scene',
  'cartoon',
  'illustration',
  'cgi look',
  '3d render look',
  'low resolution',
  'blurred subject'
].join(', ');

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalize = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const cleanText = (value?: string): string =>
  (value || '').replace(/\s+/g, ' ').trim();

const sanitizeAnchor = (value: string): string => {
  const fallback = 'accurate product reference, preserve exact shape, material, color, proportions and visible design details';
  const cleaned = cleanText(value);
  if (!cleaned) return fallback;

  return cleaned
    .replace(/\b(held by|worn by|modeled by|on a person|on a human|mannequin|hanger)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
};

const getModeFromInput = (input: ProductDirectorInput): ProductGenerationMode => {
  if (input.referenceImage) return 'recreate';
  return input.mode;
};

const categoryFromString = (raw?: string): ProductCategory | null => {
  const value = normalize(raw);
  if (!value) return null;

  if (['clothing', 'ropa', 'textil', 'garment', 'apparel'].some(k => value.includes(k))) return 'clothing';
  if (['footwear', 'calzado', 'shoe', 'sneaker', 'zapatilla'].some(k => value.includes(k))) return 'footwear';
  if (['tech', 'electronics', 'electronica', 'technology'].some(k => value.includes(k))) return 'tech';
  if (['jewelry', 'joyeria', 'joya'].some(k => value.includes(k))) return 'jewelry';
  if (['accessory', 'accesorio', 'accessories'].some(k => value.includes(k))) return 'accessory';
  if (['cosmetic', 'cosmetico', 'beauty', 'skincare'].some(k => value.includes(k))) return 'cosmetic';
  if (['home', 'hogar', 'decoracion', 'deco'].some(k => value.includes(k))) return 'home';
  if (['food', 'comida', 'alimento'].some(k => value.includes(k))) return 'food';

  return null;
};

const getCategoryDefaults = (category: ProductCategory): Pick<ProductAnalysis, 'structure' | 'hasFrontBack' | 'detailLevel' | 'usageContext' | 'recommendedDisplay'> => {
  switch (category) {
    case 'clothing':
      return {
        structure: 'flexible',
        hasFrontBack: true,
        detailLevel: 'high',
        usageContext: 'wearable',
        recommendedDisplay: 'ghost_mannequin'
      };
    case 'footwear':
      return {
        structure: 'volumetric',
        hasFrontBack: true,
        detailLevel: 'high',
        usageContext: 'wearable',
        recommendedDisplay: 'surface_still_life'
      };
    case 'tech':
      return {
        structure: 'volumetric',
        hasFrontBack: true,
        detailLevel: 'high',
        usageContext: 'handheld',
        recommendedDisplay: 'isolated_product'
      };
    case 'jewelry':
    case 'accessory':
      return {
        structure: 'small',
        hasFrontBack: false,
        detailLevel: 'high',
        usageContext: 'static',
        recommendedDisplay: 'surface_still_life'
      };
    case 'cosmetic':
      return {
        structure: 'volumetric',
        hasFrontBack: true,
        detailLevel: 'high',
        usageContext: 'handheld',
        recommendedDisplay: 'surface_still_life'
      };
    case 'home':
      return {
        structure: 'volumetric',
        hasFrontBack: false,
        detailLevel: 'medium',
        usageContext: 'static',
        recommendedDisplay: 'context_scene'
      };
    case 'food':
      return {
        structure: 'volumetric',
        hasFrontBack: false,
        detailLevel: 'medium',
        usageContext: 'static',
        recommendedDisplay: 'surface_still_life'
      };
    default:
      return {
        structure: 'volumetric',
        hasFrontBack: false,
        detailLevel: 'medium',
        usageContext: 'static',
        recommendedDisplay: 'isolated_product'
      };
  }
};

export const heuristicAnalyzeProduct = (input: ProductDirectorInput): ProductAnalysis => {
  const title = normalize(input.productTitle);
  const description = normalize(input.productDescription);
  const combined = `${title} ${description}`.trim();

  let bestCategory: ProductCategory = 'object';
  let bestScore = 0;

  (Object.keys(CATEGORY_KEYWORDS) as ProductCategory[]).forEach((category) => {
    const score = CATEGORY_KEYWORDS[category].reduce((acc, keyword) => {
      return combined.includes(normalize(keyword)) ? acc + 1 : acc;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  const defaults = getCategoryDefaults(bestCategory);
  const hasMultipleImages = input.productImages.length >= 2;
  const hasManyImages = input.productImages.length >= 3;

  const confidence = clamp01(
    0.25 +
    (bestScore > 0 ? 0.35 : 0) +
    (bestScore > 1 ? 0.15 : 0) +
    (hasMultipleImages ? 0.15 : 0) +
    (hasManyImages ? 0.1 : 0) +
    (input.productDescription ? 0.05 : 0)
  );

  return {
    category: bestCategory,
    ...defaults,
    requiresModel: false,
    allowsHumanContext: Boolean(input.referenceImage && input.allowHumanFromReference),
    confidence,
    source: 'heuristic',
    productAnchor: sanitizeAnchor(`${input.productTitle}. ${input.productDescription || ''}`),
    technicalDescription: cleanText(input.productDescription) || `Product titled ${input.productTitle}.`,
    commercialDescription: cleanText(input.productDescription) || `Commercial product photography for ${input.productTitle}.`,
    metadata: {
      category: bestCategory,
      frontBackReason: defaults.hasFrontBack ? 'Category usually requires front and back coverage.' : 'Category does not always require front and back coverage.'
    }
  };
};

const shouldUseGeminiAnalysis = (input: ProductDirectorInput, heuristic: ProductAnalysis): boolean => {
  if (input.forceGeminiAnalysis) return true;
  if (heuristic.confidence < 0.72) return true;
  if (input.productImages.length >= 3 && ['clothing', 'tech', 'footwear', 'cosmetic'].includes(heuristic.category)) return true;
  if (input.referenceImage) return true;
  return false;
};

export const geminiAnalyzeProduct = async (input: ProductDirectorInput): Promise<GeminiProductAnalysisRaw | null> => {
  if (!input.productImages.length) return null;

  try {
    const description = [input.productTitle, input.productDescription].filter(Boolean).join('\n');
    const result = await geminiService.analyzeProduct(input.productImages, description);
    return result as GeminiProductAnalysisRaw;
  } catch (error) {
    console.warn('[ProductDirector] Gemini product analysis failed. Falling back to heuristic analysis.', error);
    return null;
  }
};

export const mergeProductAnalysis = (
  input: ProductDirectorInput,
  heuristic: ProductAnalysis,
  geminiRaw: GeminiProductAnalysisRaw | null
): ProductAnalysis => {
  if (!geminiRaw) return heuristic;

  const geminiCategory = categoryFromString(geminiRaw.metadata?.category) || categoryFromString(geminiRaw.technical_description) || heuristic.category;
  const defaults = getCategoryDefaults(geminiCategory);
  const productAnchor = sanitizeAnchor(geminiRaw.product_prompt || heuristic.productAnchor);

  const confidence = clamp01(Math.max(heuristic.confidence, 0.78) + (geminiRaw.product_prompt ? 0.1 : 0));

  return {
    category: geminiCategory,
    ...defaults,
    requiresModel: false,
    allowsHumanContext: Boolean(input.referenceImage && input.allowHumanFromReference),
    confidence,
    source: 'hybrid',
    productAnchor,
    technicalDescription: cleanText(geminiRaw.technical_description) || heuristic.technicalDescription,
    commercialDescription: cleanText(geminiRaw.commercial_description) || heuristic.commercialDescription,
    metadata: {
      ...heuristic.metadata,
      ...geminiRaw.metadata,
      category: geminiCategory,
      frontBackReason: defaults.hasFrontBack ? 'Gemini/category merge indicates product benefits from front/back coverage.' : 'Gemini/category merge does not require front/back coverage by default.'
    }
  };
};

export const buildMasterContext = (input: ProductDirectorInput, analysis: ProductAnalysis): MasterContext => {
  if (input.referenceImage) {
    return {
      background: 'match the visual background family, setting, surface, depth and composition logic from the uploaded reference image',
      lighting: 'match the reference image lighting direction, softness, contrast and shadow behavior',
      colorTone: 'match the reference image color palette and temperature without changing the product color',
      mood: 'reference-led product photography, faithful but realistic',
      environment: analysis.allowsHumanContext
        ? 'recreate the reference environment; human context is allowed only because the reference includes it or the user provided it'
        : 'recreate the reference environment without adding new human subjects',
      constraints: {
        consistency: 'all generated images must feel like the same visual idea derived from the reference',
        realism: 'natural realistic product photography; no surreal elements, no artificial fantasy composition',
        humanPolicy: analysis.allowsHumanContext
          ? 'human presence may be kept only if clearly part of the reference composition; never invent extra people'
          : 'no human models, no hands, no body parts unless the uploaded reference clearly requires it'
      }
    };
  }

  const style = input.style || 'minimal';
  const objective = input.objective;

  const objectiveContext: Record<ProductObjective, Partial<MasterContext>> = {
    social: {
      mood: 'organic attractive product content for social media',
      environment: 'simple real-life styled product scene'
    },
    ecommerce: {
      mood: 'clean commercial ecommerce product photography',
      environment: 'controlled studio or clean neutral product setup'
    },
    technical_catalog: {
      mood: 'clear technical product documentation',
      environment: 'neutral catalog setup with minimal distractions'
    },
    ads: {
      mood: 'premium advertising product photography',
      environment: 'controlled campaign-style product set'
    }
  };

  const styleContext: Record<ProductStyle, Pick<MasterContext, 'background' | 'lighting' | 'colorTone'>> = {
    minimal: {
      background: 'clean white, off-white or soft neutral background',
      lighting: 'soft diffused studio lighting with natural contact shadows',
      colorTone: 'neutral accurate tones'
    },
    premium: {
      background: 'elegant minimal background with premium surface, no clutter',
      lighting: 'controlled high-end studio lighting with subtle contrast',
      colorTone: 'refined warm-neutral tones'
    },
    lifestyle: {
      background: 'realistic simple environment related to the product use, minimal props',
      lighting: 'natural window light or soft ambient daylight',
      colorTone: 'warm organic tones'
    },
    dark: {
      background: 'dark matte background or deep neutral surface',
      lighting: 'controlled directional light with clean shadows',
      colorTone: 'deep contrast tones while preserving true product color'
    },
    natural: {
      background: 'soft neutral textured surface, natural material background',
      lighting: 'soft natural daylight with realistic shadows',
      colorTone: 'natural warm tones'
    }
  };

  const categoryAdjustment = (() => {
    switch (analysis.category) {
      case 'clothing':
        return 'Use ghost mannequin, clean hanger-free flat product styling, or natural garment shape. No human model by default.';
      case 'tech':
        return 'Use precise reflections, clean edges, controlled shadows and minimal surfaces.';
      case 'jewelry':
      case 'accessory':
        return 'Use close premium surfaces such as linen, marble, paper or matte display base.';
      case 'cosmetic':
        return 'Use clean beauty product styling with soft highlights, controlled reflections and accurate label area.';
      default:
        return 'Use simple product-first scene with no distracting props.';
    }
  })();

  return {
    background: styleContext[style].background,
    lighting: styleContext[style].lighting,
    colorTone: styleContext[style].colorTone,
    mood: objectiveContext[objective].mood || 'realistic product photography',
    environment: `${objectiveContext[objective].environment || 'controlled product environment'}. ${categoryAdjustment}`,
    constraints: {
      consistency: 'all shots must maintain the same lighting family, background family, color temperature and product identity',
      realism: 'realistic product photography; no surreal ideas, no impossible physics, no artificial CGI look',
      humanPolicy: 'do not add human models, hands, body parts or mannequin bodies by default; ghost mannequin is allowed for clothing only'
    }
  };
};

const unique = <T,>(items: T[]): T[] => Array.from(new Set(items));

export const selectShotTypes = (input: ProductDirectorInput, analysis: ProductAnalysis): ProductShotType[] => {
  const mode = getModeFromInput(input);

  if (mode === 'recreate') {
    return input.count === 2 ? ['REFERENCE_MATCH', 'REFERENCE_VARIATION'] : ['REFERENCE_MATCH'];
  }

  if (mode === 'grid') {
    if (input.gridType === '1x2') {
      if (analysis.category === 'clothing') return ['FRONT', 'BACK'];
      return ['FRONT', 'ANGLE'];
    }

    if (input.gridType === '2x2') {
      if (analysis.category === 'clothing') return ['FRONT', 'BACK', 'DETAIL', 'CONTEXT'];
      if (analysis.category === 'tech') return ['FRONT', 'ANGLE', 'BACK', 'TOP'];
      if (analysis.category === 'jewelry' || analysis.category === 'accessory') return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT'];
      return ['FRONT', 'ANGLE', 'SIDE', 'DETAIL'];
    }

    return ['HERO', 'FRONT', 'BACK', 'SIDE', 'ANGLE', 'DETAIL', 'TOP', 'CONTEXT', 'VARIATION'];
  }

  const count = input.count || 2;

  if (count === 2) {
    if (analysis.category === 'clothing') return ['HERO', 'BACK'];
    return ['HERO', 'ANGLE'];
  }

  if (count === 4) {
    if (analysis.category === 'clothing') return ['HERO', 'BACK', 'DETAIL', 'CONTEXT'];
    if (analysis.category === 'tech') return ['HERO', 'ANGLE', 'DETAIL', 'TOP'];
    if (analysis.category === 'cosmetic') return ['HERO', 'DETAIL', 'ANGLE', 'CONTEXT'];
    if (analysis.category === 'jewelry' || analysis.category === 'accessory') return ['HERO', 'DETAIL', 'ANGLE', 'CONTEXT'];
    return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT'];
  }

  if (analysis.category === 'clothing') return ['HERO', 'FRONT', 'BACK', 'DETAIL', 'CONTEXT', 'VARIATION'];
  if (analysis.category === 'tech') return ['HERO', 'FRONT', 'ANGLE', 'BACK', 'DETAIL', 'TOP'];
  if (analysis.category === 'cosmetic') return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT', 'TOP', 'VARIATION'];
  if (analysis.category === 'jewelry' || analysis.category === 'accessory') return ['HERO', 'ANGLE', 'DETAIL', 'TOP', 'CONTEXT', 'VARIATION'];
  return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT', 'TOP', 'VARIATION'];
};

const getShotDefinition = (type: ProductShotType, analysis: ProductAnalysis): Omit<ShotPlan, 'id' | 'type' | 'priority'> => {
  const basePreserve = 'preserve exact product shape, proportions, material, color, visible details and identity from the uploaded product images';
  const baseAvoid = analysis.allowsHumanContext
    ? 'avoid extra people, extra products, invented logos, text overlays, distortion or unrealistic elements'
    : 'avoid human models, hands, body parts, mannequin bodies, extra products, invented logos, text overlays, distortion or unrealistic elements';

  switch (type) {
    case 'HERO':
      return {
        composition: 'main product shot; product centered or clearly dominant in frame',
        framing: 'medium product shot with the full product visible and balanced negative space',
        focus: 'entire product clearly visible, sharp and readable at first glance',
        productEmphasis: 'overall shape, color, material and product identity',
        environmentRules: 'clean product-first scene, no distracting objects',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    case 'FRONT':
      return {
        composition: 'straight-on front view, product aligned and easy to understand',
        framing: 'full product in frame, minimal perspective distortion',
        focus: 'front-facing design, main visible face, labels or graphics if present',
        productEmphasis: 'front design and true proportions',
        environmentRules: 'simple neutral setup, technical clarity over creativity',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    case 'BACK':
      return {
        composition: 'clear back view of the product',
        framing: 'full product in frame, straight or slightly elevated angle',
        focus: 'back details, rear design, closure, seams or secondary graphics',
        productEmphasis: analysis.hasFrontBack ? 'back design and secondary construction details' : 'secondary side/details if back is not relevant',
        environmentRules: 'same visual family as the front shot',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    case 'SIDE':
      return {
        composition: 'side profile view showing thickness, depth or silhouette',
        framing: 'full product side view, clean geometry',
        focus: 'side structure, depth and product volume',
        productEmphasis: 'profile, thickness, side construction',
        environmentRules: 'controlled neutral setup, no scene clutter',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    case 'ANGLE':
      return {
        composition: 'three-quarter product angle, natural commercial perspective',
        framing: 'medium shot, full product visible with slight perspective depth',
        focus: 'volume, silhouette and premium product presence',
        productEmphasis: 'dimensional shape and material response to light',
        environmentRules: 'same lighting and background family as hero shot',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    case 'DETAIL':
      return {
        composition: 'tight crop on the most important product detail',
        framing: 'macro or close-up product shot, no excessive blur',
        focus: 'texture, material, stitching, finish, surface, branding area or functional detail',
        productEmphasis: 'quality and craftsmanship without inventing details',
        environmentRules: 'minimal background; product detail must dominate',
        constraints: { preserveProduct: `${basePreserve}; do not invent new patterns or textures`, avoid: baseAvoid }
      };
    case 'TOP':
      return {
        composition: 'top-down or elevated view showing layout and shape clearly',
        framing: 'flat-lay or overhead product composition',
        focus: 'top surface, outline and arrangement',
        productEmphasis: 'shape clarity and product completeness',
        environmentRules: 'simple surface, realistic contact shadows, no clutter',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    case 'CONTEXT':
      return {
        composition: 'product placed in a believable context scene without losing product dominance',
        framing: 'medium product scene, product remains the clear subject',
        focus: 'product use context, scale and desirability',
        productEmphasis: 'why the product is attractive or useful',
        environmentRules: analysis.allowsHumanContext
          ? 'context may follow uploaded reference; do not invent extra people or distracting actions'
          : 'no human subjects; use surfaces, room elements or props only when they support the product',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    case 'VARIATION':
      return {
        composition: 'creative but realistic variation of the hero/product scene',
        framing: 'alternative crop or perspective while keeping product readable',
        focus: 'fresh visual angle without changing the product',
        productEmphasis: 'same product identity with a different visual rhythm',
        environmentRules: 'same background and lighting family; no absurd props or fantasy elements',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    case 'REFERENCE_MATCH':
      return {
        composition: 'match the uploaded inspiration image composition as closely as possible',
        framing: 'match reference framing, crop, camera distance and visual hierarchy',
        focus: 'replace the reference subject with the uploaded product while preserving product accuracy',
        productEmphasis: 'product identity inside the reference style',
        environmentRules: 'copy lighting, mood, background family and setup from reference; do not invent a different scene',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    case 'REFERENCE_VARIATION':
      return {
        composition: 'slight believable variation of the reference composition',
        framing: 'similar crop and camera distance with a subtle angle or layout adjustment',
        focus: 'same reference idea, slightly different perspective',
        productEmphasis: 'product identity remains the priority',
        environmentRules: 'same reference lighting and background family; no new scene invention',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
    default:
      return {
        composition: 'product-first realistic shot',
        framing: 'clear product framing',
        focus: 'product accuracy',
        productEmphasis: 'product identity',
        environmentRules: 'simple realistic environment',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid }
      };
  }
};

export const buildShotPlans = (shotTypes: ProductShotType[], analysis: ProductAnalysis): ShotPlan[] => {
  return unique(shotTypes).map((type, index) => ({
    id: `shot_${index + 1}`,
    type,
    priority: index + 1,
    ...getShotDefinition(type, analysis)
  }));
};

export const runProductDirector = async (input: ProductDirectorInput): Promise<ProductDirectorResult> => {
  if (!input.productImages.length) {
    throw new Error('ProductDirector requires at least one product image.');
  }

  if (!cleanText(input.productTitle)) {
    throw new Error('ProductDirector requires a product title.');
  }

  const normalizedInput: ProductDirectorInput = {
    ...input,
    mode: getModeFromInput(input),
    count: input.referenceImage ? (input.count === 2 ? 2 : 1) : input.count,
    allowHumanFromReference: Boolean(input.allowHumanFromReference)
  };

  const heuristic = heuristicAnalyzeProduct(normalizedInput);
  const geminiRaw = shouldUseGeminiAnalysis(normalizedInput, heuristic)
    ? await geminiAnalyzeProduct(normalizedInput)
    : null;

  const analysis = mergeProductAnalysis(normalizedInput, heuristic, geminiRaw);
  const masterContext = buildMasterContext(normalizedInput, analysis);
  const shotTypes = selectShotTypes(normalizedInput, analysis);
  const shots = buildShotPlans(shotTypes, analysis);

  return {
    analysis,
    masterContext,
    shots
  };
};

export const buildPromptPayloadsFromDirectorResult = (
  input: ProductDirectorInput,
  result: ProductDirectorResult
): ProductPromptPayload[] => {
  const referenceImages = input.referenceImage
    ? [...input.productImages, input.referenceImage]
    : input.productImages;

  return result.shots.map((shot) => ({
    shotId: shot.id,
    shotType: shot.type,
    referenceImages,
    aspectRatio: input.objective === 'social' ? '4:5' : '1:1',
    negativePrompt: PRODUCT_NEGATIVE_PROMPT,
    prompt: [
      'Photorealistic product photography.',
      `PRODUCT TITLE: ${input.productTitle}`,
      input.productDescription ? `USER PRODUCT CONTEXT: ${input.productDescription}` : '',
      `PRODUCT ANCHOR: ${result.analysis.productAnchor}`,
      `TECHNICAL DESCRIPTION: ${result.analysis.technicalDescription}`,
      '',
      'MASTER CONTEXT:',
      `Background: ${result.masterContext.background}`,
      `Lighting: ${result.masterContext.lighting}`,
      `Color tone: ${result.masterContext.colorTone}`,
      `Mood: ${result.masterContext.mood}`,
      `Environment: ${result.masterContext.environment}`,
      `Consistency rule: ${result.masterContext.constraints.consistency}`,
      `Realism rule: ${result.masterContext.constraints.realism}`,
      `Human policy: ${result.masterContext.constraints.humanPolicy}`,
      '',
      `SHOT TYPE: ${shot.type}`,
      `Composition: ${shot.composition}`,
      `Framing: ${shot.framing}`,
      `Focus: ${shot.focus}`,
      `Product emphasis: ${shot.productEmphasis}`,
      `Environment rules: ${shot.environmentRules}`,
      '',
      'HARD PRODUCT RULES:',
      shot.constraints.preserveProduct,
      `Avoid: ${shot.constraints.avoid}`,
      'The uploaded product images are the source of truth. Prioritize product fidelity over creativity.'
    ].filter(Boolean).join('\n')
  }));
};

export const productDirectorService = {
  run: runProductDirector,
  heuristicAnalyzeProduct,
  geminiAnalyzeProduct,
  mergeProductAnalysis,
  buildMasterContext,
  selectShotTypes,
  buildShotPlans,
  buildPromptPayloadsFromDirectorResult
};
