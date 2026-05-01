import { geminiService } from '../../services/geminiService';

/* ======================================================
   TYPES
====================================================== */

export type ProductObjective = 'social' | 'ecommerce' | 'technical_catalog' | 'ads';
export type ProductStyle = 'minimal' | 'premium' | 'lifestyle' | 'dark' | 'natural';
export type ProductGenerationMode = 'pack' | 'grid' | 'recreate';
export type ProductGridType = '1x2' | '2x2' | '3x3';

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
};

export type ProductDirectorResult = {
  masterContext: MasterContext;
  shots: Shot[];
};

export type ProductPromptPayload = {
  shotId: string;
  shotType: string;
  prompt: string;
  negativePrompt: string;
  referenceImages: string[];
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
   MAIN DIRECTOR
====================================================== */

export const runProductDirector = async (
  input: ProductDirectorInput
): Promise<ProductDirectorResult> => {

  if (!input.productImages.length) {
    throw new Error('At least one product image is required');
  }

  const masterContext = buildMasterContext(input);
  const shotTypes = selectShotTypes(input);

  const shots: Shot[] = shotTypes.map((type: string, index: number) =>
    buildShot(type, index)
  );

  return {
    masterContext,
    shots
  };
};

/* ======================================================
   MASTER CONTEXT
====================================================== */

const buildMasterContext = (input: ProductDirectorInput): MasterContext => {

  if (input.referenceImage) {
    return {
      background: 'match reference background',
      lighting: 'match reference lighting',
      colorTone: 'match reference tone',
      mood: 'reference-based product photography',
      environment: 'reference environment'
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

  if (input.referenceImage) {
    return input.count === 2
      ? ['REFERENCE_MATCH', 'REFERENCE_VARIATION']
      : ['REFERENCE_MATCH'];
  }

  if (input.mode === 'grid') {

    if (input.gridType === '1x2') {
      return ['FRONT', 'ANGLE'];
    }

    if (input.gridType === '2x2') {
      return ['FRONT', 'BACK', 'DETAIL', 'CONTEXT'];
    }

    return [
      'HERO',
      'FRONT',
      'BACK',
      'SIDE',
      'ANGLE',
      'DETAIL',
      'TOP',
      'CONTEXT'
    ];
  }

  if (input.count === 2) return ['HERO', 'ANGLE'];
  if (input.count === 4) return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT'];

  return ['HERO', 'ANGLE', 'DETAIL', 'CONTEXT', 'BACK', 'TOP'];
};

/* ======================================================
   SHOT BUILDER
====================================================== */

const buildShot = (type: string, index: number): Shot => {
  return {
    id: `shot_${index + 1}`,
    type,
    composition: getComposition(type),
    framing: getFraming(type),
    focus: getFocus(type),
    environmentRules: getEnvironmentRules()
  };
};

/* ======================================================
   SHOT DEFINITIONS
====================================================== */

const getComposition = (type: string): string => {
  switch (type) {
    case 'HERO': return 'product centered and dominant';
    case 'ANGLE': return 'three quarter angle';
    case 'DETAIL': return 'close-up detail';
    case 'CONTEXT': return 'product placed in realistic environment';
    case 'BACK': return 'rear view';
    case 'TOP': return 'top view';
    case 'REFERENCE_MATCH': return 'match reference composition';
    case 'REFERENCE_VARIATION': return 'slight variation of reference';
    default: return 'balanced composition';
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
   PROMPT BUILDER (RESPETANDO TU CONTRATO ORIGINAL)
====================================================== */

export const buildPromptPayloadsFromDirectorResult = (
  input: ProductDirectorInput,
  result: ProductDirectorResult
): ProductPromptPayload[] => {

  const referenceImages: string[] = input.referenceImage
    ? [...input.productImages, input.referenceImage]
    : input.productImages;

  return result.shots.map((shot: Shot) => ({
    shotId: shot.id,
    shotType: shot.type,
    referenceImages,
    negativePrompt: PRODUCT_NEGATIVE_PROMPT,
    prompt: [
      'Photorealistic product photography.',

      PRODUCT_IDENTITY_RULES,

      `PRODUCT TITLE: ${input.productTitle}`,
      input.productDescription ? `DESCRIPTION: ${input.productDescription}` : '',

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
      shot.environmentRules
    ].filter(Boolean).join('\n')
  }));
};

/* ======================================================
   EXPORT
====================================================== */

export const productDirectorService = {
  run: runProductDirector,
  buildPromptPayloadsFromDirectorResult
};