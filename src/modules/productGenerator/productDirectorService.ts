// src/modules/productGenerator/productDirectorService.ts
import { geminiService } from '../../services/geminiService';

/* ======================================================
   PRODUCT DIRECTOR SERVICE

   This file is intentionally verbose.
   It builds the product strategy, shot plan and prompt payloads for
   Product Photography / Product Generator.

   Main goals:
   - Preserve product identity and anatomy.
   - Respect reference image composition when recreating inspiration.
   - Avoid invented logos, labels, handles, straps, lids, soles, closures, etc.
   - Adapt human interaction to the uploaded product, never the product to the interaction.
   - Preserve reference perspective, layout and left-right orientation.
   - Support coordinated lifestyle sets where secondary props can harmonize with the uploaded product.
   - Keep exports stable for the existing module.

====================================================== */

/* ======================================================
   TYPES
====================================================== */

export type ProductObjective = 'social' | 'ecommerce' | 'technical_catalog' | 'ads';

export type ProductStyle =
  | 'minimal'
  | 'premium'
  | 'lifestyle'
  | 'dark'
  | 'natural';

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

export type ProductStructure =
  | 'flat'
  | 'volumetric'
  | 'flexible'
  | 'small';

export type ProductDetailLevel =
  | 'low'
  | 'medium'
  | 'high';

export type ProductUsageContext =
  | 'wearable'
  | 'handheld'
  | 'static';

export type ProductRecommendedDisplay =
  | 'isolated_product'
  | 'ghost_mannequin'
  | 'flat_lay'
  | 'surface_still_life'
  | 'context_scene';

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
  /** Fuerza análisis Gemini. Si no viene, el director decide automáticamente. */
  forceGeminiAnalysis?: boolean;
};

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

export type ProductAnalysis = {
  category: ProductCategory;
  structure: ProductStructure;
  hasFrontBack: boolean;
  detailLevel: ProductDetailLevel;
  usageContext: ProductUsageContext;
  requiresModel: false;
  allowsHumanContext: boolean;
  recommendedDisplay: ProductRecommendedDisplay;
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

/* ======================================================
   CONSTANTS
====================================================== */

const ALL_CATEGORIES: ProductCategory[] = [
  'clothing',
  'footwear',
  'tech',
  'accessory',
  'jewelry',
  'cosmetic',
  'home',
  'food',
  'object',
];

const CATEGORY_KEYWORDS: Record<ProductCategory, string[]> = {
  clothing: [
    'polera',
    'camiseta',
    'remera',
    'playera',
    'shirt',
    'tshirt',
    't-shirt',
    'hoodie',
    'poleron',
    'sudadera',
    'chaqueta',
    'jacket',
    'pantalon',
    'pants',
    'jeans',
    'vestido',
    'dress',
    'falda',
    'skirt',
    'ropa',
    'prenda',
    'oversize',
    'boxy',
    'boxyfit',
    'regular fit',
    'comfort fit',
    'manga larga',
    'manga corta',
    'pañuelo',
    'panuelo',
    'scarf',
    'bandana',
  ],
  footwear: [
    'zapatilla',
    'zapatillas',
    'sneaker',
    'sneakers',
    'shoe',
    'shoes',
    'botin',
    'bota',
    'sandalia',
    'calzado',
    'zapato',
    'zapatos',
    'tacon',
    'tacones',
    'stiletto',
    'pump',
    'pumps',
    'heel',
    'heels',
  ],
  tech: [
    'iphone',
    'celular',
    'telefono',
    'tablet',
    'laptop',
    'notebook',
    'teclado',
    'mouse',
    'audifono',
    'audifonos',
    'camara',
    'smartwatch',
    'cargador',
    'tech',
    'electronica',
  ],
  accessory: [
    'aro',
    'aros',
    'pulsera',
    'collar',
    'cadena',
    'pinza',
    'gorro',
    'beanie',
    'lente',
    'lentes',
    'bolso',
    'cartera',
    'pouch',
    'wallet',
    'bag',
    'tote',
  ],
  jewelry: [
    'joya',
    'joyeria',
    'anillo',
    'plata',
    'oro',
    'gold',
    'silver',
    'brillante',
    'diamante',
    'perla',
    'pendiente',
    'arete',
  ],
  cosmetic: [
    'labial',
    'crema',
    'serum',
    'perfume',
    'maquillaje',
    'cosmetico',
    'shampoo',
    'skincare',
    'fragancia',
    'lipstick',
    'gloss',
    'makeup',
  ],
  home: [
    'lampara',
    'silla',
    'mesa',
    'cuadro',
    'deco',
    'decoracion',
    'vela',
    'organizador',
    'mueble',
    'cojin',
  ],
  food: [
    'cafe',
    'chocolate',
    'galleta',
    'snack',
    'bebida',
    'miel',
    'mermelada',
    'comida',
    'alimento',
  ],
  object: [
    'botella',
    'bottle',
    'termo',
    'thermos',
    'vaso',
    'cup',
    'tumbler',
    'drinkware',
    'mug',
    'frasco',
    'jar',
    'objeto',
  ],
};

const HUMAN_REFERENCE_WORDS: string[] = [
  'person',
  'people',
  'human',
  'model',
  'hand',
  'hands',
  'face',
  'body',
  'wearing',
  'worn',
  'persona',
  'modelo',
  'mano',
  'manos',
  'rostro',
  'cuerpo',
  'usando',
  'vistiendo',
];

const HUMAN_COMPATIBLE_REFERENCE_SHOTS: ProductShotType[] = [
  'REFERENCE_MATCH',
  'REFERENCE_VARIATION',
  'CONTEXT',
];

/* ======================================================
   GLOBAL PROMPT RULES
====================================================== */

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
  'invented straw',
  'invented closure',
  'invented opening',
  'invented heel',
  'invented sole',
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
  'signature',
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
  'deformed geometry',
  'warped product',
  'melted product',
  'unrealistic surreal scene',
  'cartoon',
  'illustration',
  'cgi look',
  '3d render look',
  'low resolution',
  'blurred subject',
].join(', ');

const SOURCE_ORDER_RULE = [
  'REFERENCE ORDER RULE:',
  'When a reference image is provided, the FIRST image is the visual reference to recreate.',
  'All following images are product identity images only.',
  'The reference image controls the scene, camera, lighting and layout.',
  'The product images control product identity, anatomy, material, color, branding and real design details.',
].join('\n');

const PRODUCT_IDENTITY_RULES = [
  'CRITICAL PRODUCT IDENTITY RULES:',
  'Use the uploaded product images ONLY to understand the product identity: shape, material, color, proportions, real design and visible details.',
  'The product described in PRODUCT TITLE is the ONLY valid subject.',
  'All uploaded product images represent the SAME product in different positions, angles or folds.',
  'Any surface, table, background, cables, room elements, UI elements, color swatches, props or environment visible in the uploaded product images are NOT part of the product and must be ignored.',
  'Do NOT replicate the original composition, camera angle, table, surface, background or environment from the uploaded product images.',
  'Generate a NEW composition based on the selected style, objective and shot definition unless a reference image is explicitly provided.',
  'Preserve product fidelity over creativity.',
].join('\n');

const PRODUCT_ANATOMY_LOCK_RULES = [
  'PRODUCT ANATOMY LOCK RULE:',
  'The uploaded product anatomy must remain identical to the product shown in the uploaded product images.',
  'Preserve the exact structure, silhouette, proportions, functional parts, openings, handles, straps, caps, closures, soles, labels, textures, material finish and visible design details.',
  'Do NOT import anatomical features from the reference product.',
  'If the reference product has a feature that the uploaded product does not have, remove that feature and adapt the uploaded product naturally to the scene.',
  'If the uploaded product lacks a handle, strap, lid, opening, straw, heel, sole, closure or attachment shown in the reference, do NOT invent it.',
  'The product must fit the reference scene according to its own anatomy.',
  'The product anatomy must never change to fit the reference interaction.',
  'Do NOT create a hybrid between the reference product and the uploaded product.',
].join('\n');

const INTERACTION_ADAPTATION_RULES = [
  'INTERACTION ADAPTATION RULE:',
  'If the reference product is held, carried, worn or used through a feature that the uploaded product does not have, do NOT invent that feature.',
  'Instead, adapt the hand, body, strap, pose, placement or contact point so the uploaded product is used naturally according to its real anatomy.',
  'The interaction must change to fit the uploaded product anatomy.',
  'The product anatomy must never change to fit the interaction from the reference.',
  'Example principle: if the reference uses a side handle but the uploaded product has no side handle, the hand should hold the product body, top loop, strap, cap area, or natural contact point instead.',
  'Example principle: if the reference product has a straw but the uploaded product has no straw, do not add a straw.',
  'Example principle: if the reference footwear is a boot but the uploaded product is a stiletto, the foot pose may adapt, but the product must remain a stiletto.',
].join('\n');

const PRODUCT_SILHOUETTE_RULES = [
  'PRODUCT SILHOUETTE OVERRIDE RULE:',
  'The product silhouette, cut, opening, structure, edge shape, profile, volume and proportions must come only from the uploaded product images.',
  'Do NOT preserve the reference product silhouette if it differs from the uploaded product.',
  'Replace the reference product completely with the uploaded product silhouette.',
  'If the reference product is similar but anatomically different, the uploaded product anatomy wins.',
].join('\n');

const PRODUCT_BRANDING_RULES = [
  'BRANDING IDENTITY RULE:',
  'The uploaded product images are the ONLY source of truth for branding, logos, labels, text, printed graphics, monograms and inscriptions on the product.',
  'If the uploaded product images do NOT contain logos, text, labels or branding, the generated product MUST NOT include any logos, text, labels, typography or branding.',
  'If the uploaded product images DO contain logos, text, labels or branding, reproduce ONLY those exact elements from the uploaded product images.',
  'Do NOT copy, adapt, imitate or recreate any text, brand name, logo, typography, label, monogram or inscription from the reference image.',
  'Branding from the reference image must be completely ignored.',
  'Do NOT invent new logos, labels, text, letters, symbols, slogans, product names or brand marks.',
].join('\n');

const PRODUCT_VISIBILITY_RULES = [
  'PRODUCT VISIBILITY RULE:',
  'The uploaded product must remain clearly visible and recognizable as the main product, even inside a lifestyle set with many props.',
  'Supporting props may exist, but they must not cover, hide, replace or visually overpower the uploaded product.',
  'The product should remain readable at first glance.',
  'Do not let the scene become only a portrait, outfit photo, prop arrangement or background image where the product is secondary.',
].join('\n');

const PAIR_AND_MULTIPLE_PRODUCT_RULES = [
  'PAIR / MULTIPLE PRODUCT CONSISTENCY RULE:',
  'If the product appears more than once in the scene, every instance must share the same uploaded product identity, color, material, silhouette, anatomy and details.',
  'Do NOT make one product instance follow the reference and another follow the uploaded product.',
  'Do NOT duplicate the product unnaturally; only show multiple instances when the reference scene logically requires it or the product is naturally a pair.',
  'If the product is a pair, both items must look like the same product from the uploaded images.',
].join('\n');

const INPUT_ARTIFACT_RULES = [
  'INPUT ARTIFACT RULES:',
  'Ignore color swatches, palette dots, UI buttons, screenshots, website frames, app interface elements, watermarks, thumbnails, borders, labels or graphic overlays visible in the uploaded product images.',
  'These artifacts are not part of the product and must not appear in the generated image.',
  'Only the real product itself should be used as identity reference.',
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
  'Only the product should change; the product must remain accurate to the uploaded product images.',
].join('\n');

const REFERENCE_INTENTION_READING_RULES = [
  'REFERENCE INTENTION READING:',
  'Before generating, identify the main visual intention of the reference image.',
  'Possible intentions include: product replacement, coordinated lifestyle set, human lifestyle use, product close-up, flat lay styling, car routine setup, desk routine setup, fashion or outfit pairing, POV perspective, premium minimal still life, hand-held use, or catalog-inspired detail.',
  'Preserve the intention first, then replace the product.',
  'Do not treat every reference as a generic product scene.',
  'If the reference depends on a specific perspective, color harmony, prop relationship or use context, preserve that intention.',
].join('\n');

const REFERENCE_VISUAL_INTENTION_RULES = [
  'REFERENCE VISUAL INTENTION RULE:',
  'Preserve the visual intention of the reference image, not only the objects.',
  'Identify and preserve what makes the reference visually valuable: product placement, camera perspective, lifestyle context, color harmony, supporting props, mood, scene rhythm and relationship between elements.',
  'Do not reduce the reference to a generic scene if its appeal depends on a specific perspective, layout, color coordination or lifestyle story.',
].join('\n');

const REFERENCE_MATCH_CAMERA_LOCK_RULES = [
  'REFERENCE MATCH CAMERA LOCK:',
  'For REFERENCE_MATCH, preserve the reference camera angle, perspective, camera height, lens feeling, crop, left-right orientation and spatial layout as closely as possible.',
  'If the reference is top-down, POV, overhead, low-angle, side-view, close-up, flat lay, mirror shot or handheld-style, keep that same camera perspective.',
  'Do NOT convert the reference perspective into a different type of shot.',
  'Do NOT change a POV/top-down reference into a frontal or side product shot.',
  'The camera position is part of the reference and must be respected.',
].join('\n');

const LEFT_RIGHT_ORIENTATION_RULES = [
  'LEFT-RIGHT ORIENTATION RULE:',
  'Preserve the left-right orientation of the reference image.',
  'Do NOT mirror, flip or reverse the scene unless physically necessary for product integration.',
  'Objects that appear on the left in the reference should remain on the left.',
  'Objects that appear on the right in the reference should remain on the right.',
  'Do not swap the main prop placement from one side of the image to the other.',
].join('\n');

const CAMERA_PERSPECTIVE_LOCK_RULES = [
  'CAMERA PERSPECTIVE LOCK:',
  'The camera angle, height, distance and orientation from the reference must be preserved.',
  'Do NOT reinterpret the reference as a new angle.',
  'If the reference is POV, top-down, side-view, close-up, car interior perspective, product-in-hand perspective or lifestyle mirror perspective, keep that same perspective.',
  'The final image should feel photographed from the same camera position as the reference unless the shot type is REFERENCE_VARIATION.',
].join('\n');

const REFERENCE_LAYOUT_RULES = [
  'REFERENCE LAYOUT RULE:',
  'Preserve the main spatial relationship between the key elements in the reference image.',
  'Keep the relative placement of body parts, props, surface, background and product unless the product replacement makes it physically impossible.',
  'Preserve the general pose, product location, prop placement, negative space and directional flow from the reference.',
  'Do not rearrange the reference into a new composition when the user asked to recreate inspiration.',
].join('\n');

const REFERENCE_MATCH_STRICTNESS_RULES = [
  'REFERENCE_MATCH STRICTNESS RULE:',
  'This shot must prioritize faithful recreation over creative variation.',
  'Do not change the main camera angle, object placement, pose, layout, framing or scene structure.',
  'Small adjustments are allowed only when required to fit the uploaded product anatomy naturally into the reference scene.',
  'The output should feel like the same visual idea and same camera setup with the user product replacing the reference product.',
].join('\n');

const REFERENCE_VARIATION_CONTROL_RULES = [
  'REFERENCE_VARIATION CONTROL RULE:',
  'This shot must keep the same concept, mood and scene family as the reference, but create a useful commercial alternative.',
  'Change exactly one or two of these: crop, product placement, supporting prop color harmony, small prop spacing, or camera distance.',
  'Do NOT repeat REFERENCE_MATCH.',
  'Do NOT create a new unrelated scene.',
  'Do not change the reference mood, scene family, lighting family or core layout.',
  'The variation must still be recognizably derived from the reference image.',
].join('\n');

const WORN_PRODUCT_INTEGRATION_RULES = [
  'WORN / HELD PRODUCT INTEGRATION RULE:',
  'If the reference shows the product being worn, held, carried or used, preserve the same use context.',
  'The uploaded product must adapt to the body, hand, foot, surface or holder position without changing its identity or anatomy.',
  'Do not turn a worn or held product scene into a standalone product shot.',
  'Do not force the body or hand to use product features that the uploaded product does not have.',
  'The product should be integrated naturally according to its own structure.',
].join('\n');

const COORDINATED_SET_ACTIVE_HARMONY_RULES = [
  'COORDINATED SET ACTIVE HARMONY RULE:',
  'If the reference image communicates a coordinated lifestyle set, actively adapt 1 to 3 secondary supporting props to harmonize with the uploaded product color and material.',
  'The uploaded product color must remain unchanged.',
  'Do not recolor the whole scene.',
  'Preserve the type and position of props, but adjust selected secondary prop colors so the set feels intentionally styled around the uploaded product.',
  'Choose subtle, believable color shifts only: phone case, small accessory, cosmetic packaging, tote print, headphone tone, pouch detail, notebook, cup sleeve or minor accent object.',
  'Do not change major environment colors such as car interior, wall, floor, skin tone, denim or large furniture unless the reference already depends on that color family.',
  'The coordinated set must feel natural, commercial and believable.',
].join('\n');

const SUPPORTING_PROP_RULES = [
  'SUPPORTING PROP RULES:',
  'Preserve the type and role of important supporting props from the reference when they define the lifestyle concept.',
  'Supporting props should support the product story, not compete with the uploaded product.',
  'Do not introduce unrelated props that are not part of the reference idea.',
  'Do not remove key props if they are central to the reference concept, unless they physically conflict with the uploaded product.',
  'When a prop exists only to visually coordinate with the reference product, its color may adapt subtly to coordinate with the uploaded product instead.',
].join('\n');

const HUMAN_CONTEXT_RULES = [
  'HUMAN CONTEXT RULES:',
  'Do not add human models, hands, body parts or faces by default.',
  'If the reference image clearly includes human presence as part of the original composition, it may be preserved only as part of that reference composition.',
  'Do not invent additional people, faces, hands, poses or body parts not required by the reference.',
].join('\n');

const HUMAN_PRODUCT_HIERARCHY_RULES = [
  'HUMAN PRODUCT HIERARCHY RULE:',
  'If the reference includes a person, the person may support the lifestyle context, but the uploaded product must remain clearly visible and recognizable.',
  'Do not turn the image into a portrait where the product is secondary or obscured.',
  'Human presence must serve the product scene, not replace the product as the main commercial subject.',
].join('\n');

const SINGLE_IMAGE_RULE = [
  'SINGLE IMAGE OUTPUT RULE:',
  'Do NOT create collages, grids, split screens, contact sheets or multi-image compositions.',
  'Generate one clean product image for this shot only.',
].join('\n');

const GRID_SOURCE_IMAGE_RULE = [
  'GRID SOURCE IMAGE RULE:',
  'Generate only one clean individual product image for this shot.',
  'Do NOT create the final grid inside this image.',
  'Do NOT create collages, split screens, contact sheets or multi-image layouts.',
  'The app will assemble the grid later using the individual generated images.',
].join('\n');

const SHOT_VARIATION_RULES = [
  'SHOT VARIATION RULES:',
  'This shot must have its own distinct composition, camera angle and framing.',
  'Do not repeat the same layout from previous shots.',
  'Do not simply reproduce an uploaded product image.',
  'Do not create a near-duplicate of another generated shot.',
].join('\n');

/* ======================================================
   UTILS
====================================================== */

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

  if (!cleaned) {
    return fallback;
  }

  return (
    cleaned
      .replace(/\b(held by|worn by|modeled by|on a person|on a human|mannequin|hanger)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || fallback
  );
};

const getModeFromInput = (input: ProductDirectorInput): ProductGenerationMode => {
  if (input.referenceImage) {
    return 'recreate';
  }

  return input.mode;
};

const categoryFromString = (raw?: string): ProductCategory | null => {
  const value = normalize(raw);

  if (!value) {
    return null;
  }

  if (['clothing', 'ropa', 'textil', 'garment', 'apparel'].some((k) => value.includes(k))) {
    return 'clothing';
  }

  if (['footwear', 'calzado', 'shoe', 'shoes', 'sneaker', 'zapatilla', 'zapato', 'tacon'].some((k) => value.includes(k))) {
    return 'footwear';
  }

  if (['tech', 'electronics', 'electronica', 'technology'].some((k) => value.includes(k))) {
    return 'tech';
  }

  if (['jewelry', 'joyeria', 'joya'].some((k) => value.includes(k))) {
    return 'jewelry';
  }

  if (['accessory', 'accesorio', 'accessories'].some((k) => value.includes(k))) {
    return 'accessory';
  }

  if (['cosmetic', 'cosmetico', 'beauty', 'skincare'].some((k) => value.includes(k))) {
    return 'cosmetic';
  }

  if (['home', 'hogar', 'decoracion', 'deco'].some((k) => value.includes(k))) {
    return 'home';
  }

  if (['food', 'comida', 'alimento'].some((k) => value.includes(k))) {
    return 'food';
  }

  if (['object', 'objeto', 'botella', 'bottle', 'termo', 'thermos', 'tumbler', 'drinkware'].some((k) => value.includes(k))) {
    return 'object';
  }

  return null;
};

const hasHumanReferenceLanguage = (input: ProductDirectorInput): boolean => {
  const combined = normalize(`${input.productTitle} ${input.productDescription || ''}`);
  return HUMAN_REFERENCE_WORDS.some((word) => combined.includes(normalize(word)));
};

const getAspectRatioForObjective = (objective: ProductObjective): ProductPromptPayload['aspectRatio'] => {
  if (objective === 'social') {
    return '4:5';
  }

  if (objective === 'ads') {
    return '1:1';
  }

  if (objective === 'technical_catalog') {
    return '1:1';
  }

  return '1:1';
};

const getOutputStructureRule = (mode: ProductGenerationMode): string => {
  if (mode === 'grid') {
    return GRID_SOURCE_IMAGE_RULE;
  }

  return SINGLE_IMAGE_RULE;
};

const unique = <T,>(items: T[]): T[] => Array.from(new Set(items));

const joinPrompt = (items: Array<string | undefined | null | false>): string =>
  items.filter(Boolean).join('\n');

const isOneOfCategories = (category: ProductCategory, categories: ProductCategory[]): boolean =>
  categories.includes(category);

const isHumanCompatibleShot = (shotType: ProductShotType): boolean =>
  HUMAN_COMPATIBLE_REFERENCE_SHOTS.includes(shotType);

/* ======================================================
   CATEGORY DEFAULTS
====================================================== */

const getCategoryDefaults = (
  category: ProductCategory,
): Pick<
  ProductAnalysis,
  'structure' | 'hasFrontBack' | 'detailLevel' | 'usageContext' | 'recommendedDisplay'
> => {
  switch (category) {
    case 'clothing':
      return {
        structure: 'flexible',
        hasFrontBack: true,
        detailLevel: 'high',
        usageContext: 'wearable',
        recommendedDisplay: 'ghost_mannequin',
      };

    case 'footwear':
      return {
        structure: 'volumetric',
        hasFrontBack: true,
        detailLevel: 'high',
        usageContext: 'wearable',
        recommendedDisplay: 'surface_still_life',
      };

    case 'tech':
      return {
        structure: 'volumetric',
        hasFrontBack: true,
        detailLevel: 'high',
        usageContext: 'handheld',
        recommendedDisplay: 'isolated_product',
      };

    case 'jewelry':
    case 'accessory':
      return {
        structure: 'small',
        hasFrontBack: false,
        detailLevel: 'high',
        usageContext: 'static',
        recommendedDisplay: 'surface_still_life',
      };

    case 'cosmetic':
      return {
        structure: 'volumetric',
        hasFrontBack: true,
        detailLevel: 'high',
        usageContext: 'handheld',
        recommendedDisplay: 'surface_still_life',
      };

    case 'home':
      return {
        structure: 'volumetric',
        hasFrontBack: false,
        detailLevel: 'medium',
        usageContext: 'static',
        recommendedDisplay: 'context_scene',
      };

    case 'food':
      return {
        structure: 'volumetric',
        hasFrontBack: false,
        detailLevel: 'medium',
        usageContext: 'static',
        recommendedDisplay: 'surface_still_life',
      };

    case 'object':
    default:
      return {
        structure: 'volumetric',
        hasFrontBack: false,
        detailLevel: 'medium',
        usageContext: 'static',
        recommendedDisplay: 'isolated_product',
      };
  }
};

/* ======================================================
   PRODUCT ANALYSIS
====================================================== */

export const heuristicAnalyzeProduct = (input: ProductDirectorInput): ProductAnalysis => {
  const title = normalize(input.productTitle);
  const description = normalize(input.productDescription);
  const combined = `${title} ${description}`.trim();

  let bestCategory: ProductCategory = 'object';
  let bestScore = 0;

  ALL_CATEGORIES.forEach((category) => {
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
    0.25
    + (bestScore > 0 ? 0.35 : 0)
    + (bestScore > 1 ? 0.15 : 0)
    + (hasMultipleImages ? 0.15 : 0)
    + (hasManyImages ? 0.1 : 0)
    + (input.productDescription ? 0.05 : 0),
  );

  return {
    category: bestCategory,
    ...defaults,
    requiresModel: false,
    allowsHumanContext: Boolean(
      input.referenceImage && (input.allowHumanFromReference || hasHumanReferenceLanguage(input)),
    ),
    confidence,
    source: 'heuristic',
    productAnchor: sanitizeAnchor(`${input.productTitle}. ${input.productDescription || ''}`),
    technicalDescription: cleanText(input.productDescription) || `Product titled ${input.productTitle}.`,
    commercialDescription: cleanText(input.productDescription) || `Commercial product photography for ${input.productTitle}.`,
    metadata: {
      category: bestCategory,
      frontBackReason: defaults.hasFrontBack
        ? 'Category usually requires front and back coverage.'
        : 'Category does not always require front and back coverage.',
    },
  };
};

const shouldUseGeminiAnalysis = (input: ProductDirectorInput, heuristic: ProductAnalysis): boolean => {
  if (input.forceGeminiAnalysis) {
    return true;
  }

  if (heuristic.confidence < 0.72) {
    return true;
  }

  if (
    input.productImages.length >= 3
    && isOneOfCategories(heuristic.category, ['clothing', 'tech', 'footwear', 'cosmetic'])
  ) {
    return true;
  }

  if (input.referenceImage) {
    return true;
  }

  return false;
};

export const geminiAnalyzeProduct = async (
  input: ProductDirectorInput,
): Promise<GeminiProductAnalysisRaw | null> => {
  if (!input.productImages.length) {
    return null;
  }

  try {
    const description = [
      input.productTitle,
      input.productDescription,
      'Analyze only the uploaded product itself.',
      'Ignore backgrounds, surfaces, UI elements, color swatches, watermarks, screenshots, props and any reference-scene artifacts.',
      'Describe the exact product anatomy: silhouette, proportions, functional parts, openings, handles, straps, caps, closures, soles, texture, material finish, labels and visible design details.',
      'Do not include reference-scene objects or backgrounds as product features.',
    ].filter(Boolean).join('\n');

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
  geminiRaw: GeminiProductAnalysisRaw | null,
): ProductAnalysis => {
  if (!geminiRaw) {
    return heuristic;
  }

  const geminiCategory =
    categoryFromString(geminiRaw.metadata?.category)
    || categoryFromString(geminiRaw.technical_description)
    || heuristic.category;

  const defaults = getCategoryDefaults(geminiCategory);
  const productAnchor = sanitizeAnchor(geminiRaw.product_prompt || heuristic.productAnchor);
  const confidence = clamp01(Math.max(heuristic.confidence, 0.78) + (geminiRaw.product_prompt ? 0.1 : 0));

  return {
    category: geminiCategory,
    ...defaults,
    requiresModel: false,
    allowsHumanContext: Boolean(
      input.referenceImage && (input.allowHumanFromReference || hasHumanReferenceLanguage(input)),
    ),
    confidence,
    source: 'hybrid',
    productAnchor,
    technicalDescription: cleanText(geminiRaw.technical_description) || heuristic.technicalDescription,
    commercialDescription: cleanText(geminiRaw.commercial_description) || heuristic.commercialDescription,
    metadata: {
      ...heuristic.metadata,
      ...geminiRaw.metadata,
      category: geminiCategory,
      frontBackReason: defaults.hasFrontBack
        ? 'Gemini/category merge indicates product benefits from front/back coverage.'
        : 'Gemini/category merge does not require front/back coverage by default.',
    },
  };
};

/* ======================================================
   MASTER CONTEXT
====================================================== */

export const buildMasterContext = (
  input: ProductDirectorInput,
  analysis: ProductAnalysis,
): MasterContext => {
  if (input.referenceImage) {
    return {
      background: 'match the visual background family, setting, surface, depth and composition logic from the uploaded reference image',
      lighting: 'match the reference image lighting direction, softness, contrast and shadow behavior',
      colorTone: 'match the reference image color palette and temperature while preserving the uploaded product color',
      mood: 'reference-led product photography, faithful but realistic',
      environment: analysis.allowsHumanContext
        ? 'recreate the reference environment; human context is allowed only because the reference includes it or the user provided it'
        : 'recreate the reference environment without adding new human subjects unless the reference physically requires hands/body for product use',
      constraints: {
        consistency: 'all generated images must feel like the same visual idea derived from the reference',
        realism: 'natural realistic product photography; no surreal elements, no artificial fantasy composition',
        humanPolicy: analysis.allowsHumanContext
          ? 'human presence may be kept only if clearly part of the reference composition; never invent extra people'
          : 'no human models, no hands, no body parts unless the uploaded reference clearly requires them for faithful product use',
      },
    };
  }

  const style = input.style || 'minimal';
  const objective = input.objective;

  const objectiveContext: Record<ProductObjective, Pick<MasterContext, 'mood' | 'environment'>> = {
    social: {
      mood: 'organic attractive product content for social media',
      environment: 'simple real-life styled product scene',
    },
    ecommerce: {
      mood: 'clean commercial ecommerce product photography',
      environment: 'controlled studio or clean neutral product setup',
    },
    technical_catalog: {
      mood: 'clear technical product documentation',
      environment: 'neutral catalog setup with minimal distractions',
    },
    ads: {
      mood: 'premium advertising product photography',
      environment: 'controlled campaign-style product set',
    },
  };

  const styleContext: Record<ProductStyle, Pick<MasterContext, 'background' | 'lighting' | 'colorTone'>> = {
    minimal: {
      background: 'clean white, off-white or soft neutral background',
      lighting: 'soft diffused studio lighting with natural contact shadows',
      colorTone: 'neutral accurate tones',
    },
    premium: {
      background: 'elegant minimal background with premium surface, no clutter',
      lighting: 'controlled high-end studio lighting with subtle contrast',
      colorTone: 'refined warm-neutral tones',
    },
    lifestyle: {
      background: 'realistic simple environment related to the product use, minimal props',
      lighting: 'natural window light or soft ambient daylight',
      colorTone: 'warm organic tones',
    },
    dark: {
      background: 'dark matte background or deep neutral surface',
      lighting: 'controlled directional light with clean shadows',
      colorTone: 'deep contrast tones while preserving true product color',
    },
    natural: {
      background: 'soft neutral textured surface, natural material background',
      lighting: 'soft natural daylight with realistic shadows',
      colorTone: 'natural warm tones',
    },
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

      case 'footwear':
        return 'Use polished fashion product styling, accurate silhouette and clean material highlights.';

      case 'home':
        return 'Use realistic interior context only when it supports product scale and clarity.';

      case 'food':
        return 'Use appetizing but accurate food/product styling with clean surfaces.';

      case 'object':
      default:
        return 'Use simple product-first scene with no distracting props.';
    }
  })();

  return {
    background: styleContext[style].background,
    lighting: styleContext[style].lighting,
    colorTone: styleContext[style].colorTone,
    mood: objectiveContext[objective].mood,
    environment: `${objectiveContext[objective].environment}. ${categoryAdjustment}`,
    constraints: {
      consistency: 'all shots must maintain the same lighting family, background family, color temperature and product identity',
      realism: 'realistic product photography; no surreal ideas, no impossible physics, no artificial CGI look',
      humanPolicy: 'do not add human models, hands, body parts or mannequin bodies by default; ghost mannequin is allowed for clothing only',
    },
  };
};

/* ======================================================
   SHOT SELECTION
====================================================== */

export const selectShotTypes = (
  input: ProductDirectorInput,
  analysis: ProductAnalysis,
): ProductShotType[] => {
  const mode = getModeFromInput(input);

  if (mode === 'recreate') {
    return input.count === 2
      ? ['REFERENCE_MATCH', 'REFERENCE_VARIATION']
      : ['REFERENCE_MATCH'];
  }

  if (mode === 'grid') {
    if (input.gridType === '1x2') {
      if (analysis.category === 'clothing') {
        return ['FRONT', 'BACK'];
      }

      return ['FRONT', 'ANGLE'];
    }

    if (input.gridType === '2x2') {
      if (analysis.category === 'clothing') {
        return ['FRONT', 'BACK', 'DETAIL', 'CONTEXT'];
      }

      if (analysis.category === 'tech') {
        return ['FRONT', 'ANGLE', 'BACK', 'TOP'];
      }

      if (isOneOfCategories(analysis.category, ['jewelry', 'accessory'])) {
        return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT'];
      }

      return ['FRONT', 'ANGLE', 'SIDE', 'DETAIL'];
    }

    return ['HERO', 'FRONT', 'BACK', 'SIDE', 'ANGLE', 'DETAIL', 'TOP', 'CONTEXT', 'VARIATION'];
  }

  const count = input.count || 2;

  if (count <= 1) {
    return ['HERO'];
  }

  if (count === 2) {
    if (analysis.category === 'clothing') {
      return ['HERO', 'BACK'];
    }

    return ['HERO', 'ANGLE'];
  }

  if (count === 4) {
    if (analysis.category === 'clothing') {
      return ['HERO', 'BACK', 'DETAIL', 'CONTEXT'];
    }

    if (analysis.category === 'tech') {
      return ['HERO', 'ANGLE', 'DETAIL', 'TOP'];
    }

    if (analysis.category === 'cosmetic') {
      return ['HERO', 'DETAIL', 'ANGLE', 'CONTEXT'];
    }

    if (isOneOfCategories(analysis.category, ['jewelry', 'accessory'])) {
      return ['HERO', 'DETAIL', 'ANGLE', 'CONTEXT'];
    }

    return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT'];
  }

  if (analysis.category === 'clothing') {
    return ['HERO', 'FRONT', 'BACK', 'DETAIL', 'CONTEXT', 'VARIATION'];
  }

  if (analysis.category === 'tech') {
    return ['HERO', 'FRONT', 'ANGLE', 'BACK', 'DETAIL', 'TOP'];
  }

  if (analysis.category === 'cosmetic') {
    return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT', 'TOP', 'VARIATION'];
  }

  if (isOneOfCategories(analysis.category, ['jewelry', 'accessory'])) {
    return ['HERO', 'ANGLE', 'DETAIL', 'TOP', 'CONTEXT', 'VARIATION'];
  }

  return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT', 'TOP', 'VARIATION'];
};

/* ======================================================
   SHOT RULE COMPOSITION
====================================================== */

const buildBasePreserveRule = (analysis: ProductAnalysis): string => {
  const anatomy = [
    'preserve exact product shape',
    'proportions',
    'material',
    'color',
    'visible details',
    'anatomy',
    'functional parts',
    'openings',
    'handles',
    'straps',
    'caps',
    'closures',
    'soles',
    'labels if present',
    'branding if present',
  ].join(', ');

  return `${anatomy}; source of truth is the uploaded product images; product category: ${analysis.category}; product display: ${analysis.recommendedDisplay}`;
};

const buildBaseAvoidRule = (analysis: ProductAnalysis): string => {
  const humanAvoid = analysis.allowsHumanContext
    ? 'avoid extra people'
    : 'avoid human models, hands, body parts, mannequin bodies unless the reference clearly requires them for faithful product use';

  return [
    humanAvoid,
    'avoid extra products',
    'avoid invented logos',
    'avoid imported reference product anatomy',
    'avoid invented handles',
    'avoid invented straps',
    'avoid invented lids',
    'avoid invented straws',
    'avoid text overlays',
    'avoid distortion',
    'avoid unrealistic elements',
  ].join(', ');
};

const buildReferenceMatchEnvironmentRules = (): string =>
  joinPrompt([
    SOURCE_ORDER_RULE,
    REFERENCE_PRIORITY_RULES,
    REFERENCE_INTENTION_READING_RULES,
    REFERENCE_VISUAL_INTENTION_RULES,
    REFERENCE_MATCH_CAMERA_LOCK_RULES,
    LEFT_RIGHT_ORIENTATION_RULES,
    CAMERA_PERSPECTIVE_LOCK_RULES,
    REFERENCE_LAYOUT_RULES,
    REFERENCE_MATCH_STRICTNESS_RULES,
    PRODUCT_IDENTITY_RULES,
    PRODUCT_ANATOMY_LOCK_RULES,
    INTERACTION_ADAPTATION_RULES,
    PRODUCT_SILHOUETTE_RULES,
    PAIR_AND_MULTIPLE_PRODUCT_RULES,
    PRODUCT_BRANDING_RULES,
    PRODUCT_VISIBILITY_RULES,
    COORDINATED_SET_ACTIVE_HARMONY_RULES,
    SUPPORTING_PROP_RULES,
    INPUT_ARTIFACT_RULES,
    HUMAN_CONTEXT_RULES,
    HUMAN_PRODUCT_HIERARCHY_RULES,
    WORN_PRODUCT_INTEGRATION_RULES,
    'This shot should be the closest faithful recreation of the reference image.',
    'Only replace the product; do not change the reference scene unnecessarily.',
    'Maintain realistic product integration into the reference scene.',
    'Do not copy text, labels or branding from the reference product.',
  ]);

const buildReferenceVariationEnvironmentRules = (): string =>
  joinPrompt([
    SOURCE_ORDER_RULE,
    REFERENCE_PRIORITY_RULES,
    REFERENCE_INTENTION_READING_RULES,
    REFERENCE_VISUAL_INTENTION_RULES,
    REFERENCE_LAYOUT_RULES,
    REFERENCE_VARIATION_CONTROL_RULES,
    PRODUCT_IDENTITY_RULES,
    PRODUCT_ANATOMY_LOCK_RULES,
    INTERACTION_ADAPTATION_RULES,
    PRODUCT_SILHOUETTE_RULES,
    PAIR_AND_MULTIPLE_PRODUCT_RULES,
    PRODUCT_BRANDING_RULES,
    PRODUCT_VISIBILITY_RULES,
    COORDINATED_SET_ACTIVE_HARMONY_RULES,
    SUPPORTING_PROP_RULES,
    INPUT_ARTIFACT_RULES,
    HUMAN_CONTEXT_RULES,
    HUMAN_PRODUCT_HIERARCHY_RULES,
    WORN_PRODUCT_INTEGRATION_RULES,
    'Create a useful commercial alternative derived from the reference, not a new unrelated scene.',
    'If REFERENCE_MATCH preserved exact placement, REFERENCE_VARIATION should provide a meaningful but controlled alternative.',
    'Change one or two controlled elements only: crop, product placement, prop spacing, or secondary prop color harmony.',
    'Keep the same lighting and background family from the reference.',
    'Do not copy text, labels or branding from the reference product.',
  ]);

const buildDefaultEnvironmentRules = (): string =>
  joinPrompt([
    PRODUCT_IDENTITY_RULES,
    PRODUCT_ANATOMY_LOCK_RULES,
    PRODUCT_SILHOUETTE_RULES,
    PAIR_AND_MULTIPLE_PRODUCT_RULES,
    PRODUCT_BRANDING_RULES,
    PRODUCT_VISIBILITY_RULES,
    INPUT_ARTIFACT_RULES,
    HUMAN_CONTEXT_RULES,
    SHOT_VARIATION_RULES,
    'Maintain realism and product accuracy at all times.',
  ]);

/* ======================================================
   SHOT DEFINITIONS
====================================================== */

const getShotDefinition = (
  type: ProductShotType,
  analysis: ProductAnalysis,
): Omit<ShotPlan, 'id' | 'type' | 'priority'> => {
  const basePreserve = buildBasePreserveRule(analysis);
  const baseAvoid = buildBaseAvoidRule(analysis);

  switch (type) {
    case 'HERO':
      return {
        composition: 'main product shot; product centered or clearly dominant in frame',
        framing: 'medium product shot with the full product visible and balanced negative space',
        focus: 'entire product clearly visible, sharp and readable at first glance',
        productEmphasis: 'overall shape, color, material and product identity',
        environmentRules: 'clean product-first scene, no distracting objects',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid },
      };

    case 'FRONT':
      return {
        composition: 'straight-on front view, product aligned and easy to understand',
        framing: 'full product in frame, minimal perspective distortion',
        focus: 'front-facing design, main visible face, labels or graphics if present',
        productEmphasis: 'front design and true proportions',
        environmentRules: 'simple neutral setup, technical clarity over creativity',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid },
      };

    case 'BACK':
      return {
        composition: 'clear back view of the product',
        framing: 'full product in frame, straight or slightly elevated angle',
        focus: 'back details, rear design, closure, seams or secondary graphics',
        productEmphasis: analysis.hasFrontBack
          ? 'back design and secondary construction details'
          : 'secondary side/details if back is not relevant',
        environmentRules: 'same visual family as the front shot',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid },
      };

    case 'SIDE':
      return {
        composition: 'side profile view showing thickness, depth or silhouette',
        framing: 'full product side view, clean geometry',
        focus: 'side structure, depth and product volume',
        productEmphasis: 'profile, thickness, side construction',
        environmentRules: 'controlled neutral setup, no scene clutter',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid },
      };

    case 'ANGLE':
      return {
        composition: 'three-quarter product angle, natural commercial perspective',
        framing: 'medium shot, full product visible with slight perspective depth',
        focus: 'volume, silhouette and premium product presence',
        productEmphasis: 'dimensional shape and material response to light',
        environmentRules: 'same lighting and background family as hero shot',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid },
      };

    case 'DETAIL':
      return {
        composition: 'tight crop on the most important product detail',
        framing: 'macro or close-up product shot, no excessive blur',
        focus: 'texture, material, stitching, finish, surface, branding area or functional detail',
        productEmphasis: 'quality and craftsmanship without inventing details',
        environmentRules: 'minimal background; product detail must dominate',
        constraints: {
          preserveProduct: `${basePreserve}; do not invent new patterns or textures`,
          avoid: baseAvoid,
        },
      };

    case 'TOP':
      return {
        composition: 'top-down or elevated view showing layout and shape clearly',
        framing: 'flat-lay or overhead product composition',
        focus: 'top surface, outline and arrangement',
        productEmphasis: 'shape clarity and product completeness',
        environmentRules: 'simple surface, realistic contact shadows, no clutter',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid },
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
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid },
      };

    case 'VARIATION':
      return {
        composition: 'creative but realistic variation of the hero/product scene',
        framing: 'alternative crop or perspective while keeping product readable',
        focus: 'fresh visual angle without changing the product',
        productEmphasis: 'same product identity with a different visual rhythm',
        environmentRules: 'same background and lighting family; no absurd props or fantasy elements',
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid },
      };

    case 'REFERENCE_MATCH':
      return {
        composition: 'faithfully match the uploaded inspiration image composition, spatial layout and left-right orientation as closely as possible',
        framing: 'match reference framing, crop, camera distance, camera height, perspective, lens feeling and visual hierarchy',
        focus: 'replace the reference subject with the uploaded product while preserving exact product anatomy and product accuracy',
        productEmphasis: 'uploaded product identity inside the reference visual intention',
        environmentRules: buildReferenceMatchEnvironmentRules(),
        constraints: {
          preserveProduct: `${basePreserve}; never change product anatomy to fit the reference`,
          avoid: baseAvoid,
        },
      };

    case 'REFERENCE_VARIATION':
      return {
        composition: 'same reference idea with a controlled commercial variation; not a repeat of REFERENCE_MATCH',
        framing: 'similar crop and camera distance with a controlled crop, spacing or product placement adjustment',
        focus: 'same reference visual intention, product accuracy remains the priority',
        productEmphasis: 'uploaded product identity remains the priority while producing a useful alternate image',
        environmentRules: buildReferenceVariationEnvironmentRules(),
        constraints: {
          preserveProduct: `${basePreserve}; never change product anatomy to fit the reference`,
          avoid: baseAvoid,
        },
      };

    default:
      return {
        composition: 'product-first realistic shot',
        framing: 'clear product framing',
        focus: 'product accuracy',
        productEmphasis: 'product identity',
        environmentRules: buildDefaultEnvironmentRules(),
        constraints: { preserveProduct: basePreserve, avoid: baseAvoid },
      };
  }
};

export const buildShotPlans = (
  shotTypes: ProductShotType[],
  analysis: ProductAnalysis,
): ShotPlan[] => {
  return unique(shotTypes).map((type, index) => ({
    id: `shot_${index + 1}`,
    type,
    priority: index + 1,
    ...getShotDefinition(type, analysis),
  }));
};

/* ======================================================
   MAIN DIRECTOR
====================================================== */

export const runProductDirector = async (
  input: ProductDirectorInput,
): Promise<ProductDirectorResult> => {
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
    allowHumanFromReference: Boolean(input.allowHumanFromReference || hasHumanReferenceLanguage(input)),
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
    shots,
  };
};

/* ======================================================
   PROMPT BUILDER
====================================================== */

const buildReferencePromptRules = (shot: ShotPlan): string => {
  if (shot.type === 'REFERENCE_MATCH') {
    return joinPrompt([
      SOURCE_ORDER_RULE,
      REFERENCE_PRIORITY_RULES,
      REFERENCE_INTENTION_READING_RULES,
      REFERENCE_VISUAL_INTENTION_RULES,
      REFERENCE_MATCH_CAMERA_LOCK_RULES,
      LEFT_RIGHT_ORIENTATION_RULES,
      CAMERA_PERSPECTIVE_LOCK_RULES,
      REFERENCE_LAYOUT_RULES,
      REFERENCE_MATCH_STRICTNESS_RULES,
    ]);
  }

  return joinPrompt([
    SOURCE_ORDER_RULE,
    REFERENCE_PRIORITY_RULES,
    REFERENCE_INTENTION_READING_RULES,
    REFERENCE_VISUAL_INTENTION_RULES,
    REFERENCE_LAYOUT_RULES,
    REFERENCE_VARIATION_CONTROL_RULES,
  ]);
};

const buildProductHardRules = (shot: ShotPlan): string =>
  joinPrompt([
    PRODUCT_IDENTITY_RULES,
    PRODUCT_ANATOMY_LOCK_RULES,
    INTERACTION_ADAPTATION_RULES,
    PRODUCT_SILHOUETTE_RULES,
    PAIR_AND_MULTIPLE_PRODUCT_RULES,
    PRODUCT_BRANDING_RULES,
    PRODUCT_VISIBILITY_RULES,
    INPUT_ARTIFACT_RULES,
    isHumanCompatibleShot(shot.type) ? WORN_PRODUCT_INTEGRATION_RULES : '',
    isHumanCompatibleShot(shot.type) ? HUMAN_PRODUCT_HIERARCHY_RULES : '',
    HUMAN_CONTEXT_RULES,
  ]);

const buildContextualReferenceRules = (shot: ShotPlan): string => {
  if (shot.type !== 'REFERENCE_MATCH' && shot.type !== 'REFERENCE_VARIATION') {
    return '';
  }

  return joinPrompt([
    COORDINATED_SET_ACTIVE_HARMONY_RULES,
    SUPPORTING_PROP_RULES,
  ]);
};

export const buildPromptPayloadsFromDirectorResult = (
  input: ProductDirectorInput,
  result: ProductDirectorResult,
): ProductPromptPayload[] => {
  const normalizedMode = getModeFromInput(input);
  const referenceImages = input.referenceImage
    ? [input.referenceImage, ...input.productImages]
    : input.productImages;

  return result.shots.map((shot) => {
    const isReferenceShot = shot.type === 'REFERENCE_MATCH' || shot.type === 'REFERENCE_VARIATION';
    const outputStructureRule = getOutputStructureRule(normalizedMode);
    const aspectRatio = getAspectRatioForObjective(input.objective);

    return {
      shotId: shot.id,
      shotType: shot.type,
      referenceImages,
      aspectRatio,
      negativePrompt: PRODUCT_NEGATIVE_PROMPT,
      prompt: [
        'Photorealistic product photography.',

        isReferenceShot ? buildReferencePromptRules(shot) : '',
        buildProductHardRules(shot),
        isReferenceShot ? buildContextualReferenceRules(shot) : '',
        outputStructureRule,
        isReferenceShot ? '' : SHOT_VARIATION_RULES,

        `PRODUCT TITLE: ${input.productTitle}`,
        input.productDescription ? `USER PRODUCT CONTEXT: ${input.productDescription}` : '',
        `PRODUCT CATEGORY: ${result.analysis.category}`,
        `PRODUCT STRUCTURE: ${result.analysis.structure}`,
        `PRODUCT USAGE CONTEXT: ${result.analysis.usageContext}`,
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

        '',
        'FINAL HARD RULE:',
        input.referenceImage
          ? 'Reference image controls scene, lighting, camera perspective, layout and visual intention. Product images control only product identity, product anatomy, product design, product color, product material and product branding. If reference interaction conflicts with product anatomy, change the interaction, never the product.'
          : 'Product images control only product identity, product anatomy, product design, product color, product material and product branding. Scene and composition must be newly generated.',
      ].filter(Boolean).join('\n'),
    };
  });
};

/* ======================================================
   SERVICE EXPORT
====================================================== */

export const productDirectorService = {
  run: runProductDirector,
  heuristicAnalyzeProduct,
  geminiAnalyzeProduct,
  mergeProductAnalysis,
  buildMasterContext,
  selectShotTypes,
  buildShotPlans,
  buildPromptPayloadsFromDirectorResult,
};
