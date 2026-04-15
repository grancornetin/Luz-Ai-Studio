import { 
  Focus, ShotKey, ProductSize, ProductCategory, 
  ShotDirective, ShotRole, ShotFraming, ShotComposition, ShotExclusion, DetailTarget,
  REF0Analysis,
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

function cleanBase64(b64: string): string {
  if (!b64) return "";
  return b64.replace(/^data:image\/(png|jpeg|webp);base64,/, "").replace(/\s/g, "");
}

// ===================================================================
// ANALIZAR REF0 PARA EXTRAER LIGHTING, SPATIAL Y POSE CONTEXT
// AHORA USA ugcApiService (backend)
// ===================================================================
export async function analyzeREF0(image0Url: string): Promise<REF0Analysis> {
  try {
    // Extraer datos de la imagen
    const match = image0Url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) {
      throw new Error('Invalid image format');
    }
    
    const result = await ugcApiService.analyzeREF0({
      imageData: match[2],
      mimeType: match[1]
    });
    
    return result;
  } catch (e) {
    console.warn("[UGC Director] Error analyzing REF0:", e);
    // Fallback conservador
    return {
      lighting: {
        primarySource: "natural window light",
        direction: "from the side",
        colorTemperature: "neutral daylight",
        shadowType: "soft diffused",
        intensity: "bright"
      },
      spatial: {
        elements: ["wall", "floor"],
        walls: "neutral colored wall",
        floor: "hard surface floor",
        geometry: "standard room"
      },
      poseContext: {
        hasSeating: false,
        hasLeaningSurface: false,
        hasTable: false,
        availableActions: ["standing"]
      }
    };
  }
}

// ===================================================================
// ANALIZAR SI EL PRODUCTO ES RELEVANTE (AHORA USA ugcApiService)
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
  
  // Extraer datos de la imagen
  const productMatch = productRef.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!productMatch) {
    return { isRelevant: false, suggestion: 'Could not read product image', productType: 'other' };
  }
  
  let outfitData = null;
  if (outfitRef) {
    const outfitMatch = outfitRef.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (outfitMatch) {
      outfitData = { data: outfitMatch[2], mimeType: outfitMatch[1] };
    }
  }
  
  let sceneData = null;
  if (sceneRef) {
    const sceneMatch = sceneRef.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (sceneMatch) {
      sceneData = { data: sceneMatch[2], mimeType: sceneMatch[1] };
    }
  }
  
  try {
    return await ugcApiService.analyzeProductRelevance({
      productRef: { data: productMatch[2], mimeType: productMatch[1] },
      focus,
      outfitRef: outfitData,
      sceneRef: sceneData,
      sceneText,
    });
  } catch (e) {
    console.warn("[UGC Director] Error analyzing product relevance:", e);
    return { isRelevant: false, suggestion: 'Could not determine', productType: 'other' };
  }
}

// ===================================================================
// ANALIZAR REFERENCIA DE OUTFIT (AHORA USA ugcApiService)
// ===================================================================
async function analyzeOutfitReference(outfitRef: string | null | undefined): Promise<{
  hasJacket: boolean;
  hasPants: boolean;
  hasShoes: boolean;
  hasAccessories: boolean;
  hasDetail: boolean;
  fabricType: string;
  colors: string[];
  hasTop: boolean;
  hasBottom: boolean;
  hasBelt: boolean;
  hasBag: boolean;
  hasHat: boolean;
  hasNecklace: boolean;
}> {
  if (!outfitRef) {
    return {
      hasJacket: false,
      hasPants: true,
      hasShoes: false,
      hasAccessories: false,
      hasDetail: false,
      fabricType: 'unknown',
      colors: [],
      hasTop: true,
      hasBottom: true,
      hasBelt: false,
      hasBag: false,
      hasHat: false,
      hasNecklace: false
    };
  }

  const match = outfitRef.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) {
    return {
      hasJacket: false,
      hasPants: true,
      hasShoes: false,
      hasAccessories: false,
      hasDetail: false,
      fabricType: 'unknown',
      colors: [],
      hasTop: true,
      hasBottom: true,
      hasBelt: false,
      hasBag: false,
      hasHat: false,
      hasNecklace: false
    };
  }
  
  try {
    return await ugcApiService.analyzeOutfit({
      imageData: match[2],
      mimeType: match[1]
    });
  } catch (e) {
    console.warn("[UGC Director] Error analyzing outfit:", e);
    return {
      hasJacket: false,
      hasPants: true,
      hasShoes: false,
      hasAccessories: false,
      hasDetail: false,
      fabricType: 'unknown',
      colors: [],
      hasTop: true,
      hasBottom: true,
      hasBelt: false,
      hasBag: false,
      hasHat: false,
      hasNecklace: false
    };
  }
}

// ===================================================================
// ANALIZAR REFERENCIA DE ESCENA (AHORA USA ugcApiService)
// ===================================================================
async function analyzeSceneReference(sceneRef: string | null | undefined): Promise<{
  hasFurniture: boolean;
  hasNature: boolean;
  hasEquipment: boolean;
  hasTable: boolean;
  hasSeating: boolean;
  hasWindows: boolean;
  hasProps: boolean;
  sceneType: string;
}> {
  if (!sceneRef) {
    return {
      hasFurniture: false,
      hasNature: false,
      hasEquipment: false,
      hasTable: false,
      hasSeating: false,
      hasWindows: false,
      hasProps: false,
      sceneType: 'generic'
    };
  }

  const match = sceneRef.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) {
    return {
      hasFurniture: false,
      hasNature: false,
      hasEquipment: false,
      hasTable: false,
      hasSeating: false,
      hasWindows: false,
      hasProps: false,
      sceneType: 'generic'
    };
  }
  
  try {
    return await ugcApiService.analyzeScene({
      imageData: match[2],
      mimeType: match[1]
    });
  } catch (e) {
    console.warn("[UGC Director] Error analyzing scene:", e);
    return {
      hasFurniture: false,
      hasNature: false,
      hasEquipment: false,
      hasTable: false,
      hasSeating: false,
      hasWindows: false,
      hasProps: false,
      sceneType: 'generic'
    };
  }
}

// ===================================================================
// SHOT PLAN - AVATAR (6 SHOTS - ROSTRO DOMINANTE, SELFIE OBLIGATORIA)
// ===================================================================
function buildAvatarShotDirectives(shotCount: number = 6, hasProduct: boolean = false): ShotDirective[] {
  const directives: ShotDirective[] = [];
  
  // S1: HERO - retrato medio cuerpo, cara dominante
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: 'Retrato principal de influencer. Rostro claro, medio cuerpo, expresión auténtica. El rostro es el héroe.',
    requiredElements: ['face_clear', 'waist_up_framing', 'authentic_expression'],
    forbiddenElements: ['outfit_dominance', 'extreme_crop', 'full_body_wide', 'beautification', 'editorial_softening'],
    variationSpace: ['expresion_natural', 'composicion_centrada'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S2: SELFIE - OBLIGATORIA, con física real
  directives.push({
    key: 'S2',
    role: 'SELFIE',
    purpose: 'Selfie estilo UGC auténtico. Brazo extendido, hombro visible, cámara sostenida por la persona.',
    requiredElements: ['arm_visible', 'shoulder_visible', 'handheld_perspective', 'close_camera'],
    forbiddenElements: ['third_person_perspective', 'full_body', 'studio_composition', 'beautification', 'phone_visible'],
    variationSpace: ['encuadre_cercano', 'asimetria_natural', 'imperfeccion_permitida'],
    framing: 'SELFIE',
    composition: 'ASYMMETRIC',
    exclusion: ['full_body', 'third_person_perspective', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S3: EXPRESSION - sonrisa cálida
  directives.push({
    key: 'S3',
    role: 'EXPRESSION',
    purpose: 'Close-up facial con expresión cálida y auténtica. Rostro llena 70-80% del frame.',
    requiredElements: ['face_fills_70_80_percent', 'clear_expression', 'warm_smile'],
    forbiddenElements: ['subtle_micro_expression', 'same_as_other_shots', 'beautification', 'editorial_softening'],
    variationSpace: ['sonrisa_suave', 'expresion_autentica'],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['background', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S4: EXPRESSION - expresión diferente (confiada o pensativa)
  directives.push({
    key: 'S4',
    role: 'EXPRESSION',
    purpose: 'Expresión diferente: confiada, directa, o pensativa. Rostro domina.',
    requiredElements: ['face_fills_70_80_percent', 'different_expression', 'clear_emotion'],
    forbiddenElements: ['same_as_S3', 'micro_expression', 'beautification', 'editorial_softening'],
    variationSpace: ['confiada', 'pensativa', 'mirada_alternativa'],
    framing: 'CLOSE_UP',
    composition: 'THREE_QUARTERS',
    exclusion: ['background', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S5: INTERACTION - gesto natural con manos (NO detail de outfit)
  directives.push({
    key: 'S5',
    role: 'INTERACTION',
    purpose: hasProduct 
      ? 'Gesto natural con el producto, como influencer mostrándolo. Rostro y manos visibles.'
      : 'Gesto natural con manos (tocar pelo, ajustar collar, mano en mentón). Rostro domina.',
    requiredElements: hasProduct 
      ? ['face_visible', 'hands_on_product', 'natural_gesture']
      : ['face_visible', 'hands_visible', 'natural_gesture'],
    forbiddenElements: ['outfit_dominance', 'static_pose', 'no_interaction', 'accessory_detail_only', 'beautification'],
    variationSpace: hasProduct
      ? ['mostrando_producto', 'sosteniendo_producto']
      : ['mano_en_menton', 'tocando_pelo', 'ajustando_collar'],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['background_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S6: LIFESTYLE - contexto natural, persona en ambiente
  directives.push({
    key: 'S6',
    role: 'LIFESTYLE',
    purpose: hasProduct
      ? 'Persona en contexto natural con producto visible, como post de colaboración. Rostro visible.'
      : 'Persona en contexto natural, como foto candid de Instagram. Rostro visible.',
    requiredElements: hasProduct
      ? ['face_visible', 'product_visible', 'natural_context']
      : ['face_visible', 'natural_context', 'authentic_moment'],
    forbiddenElements: ['walking_simulation', 'artificial_movement', 'outfit_dominance', 'beautification'],
    variationSpace: ['postura_relajada', 'contexto_visible'],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - OUTFIT (6 SHOTS - ROPA DOMINANTE, CARA SECUNDARIA)
// ===================================================================
function buildOutfitShotDirectives(
  outfitAnalysis: any,
  productIsRelevant: boolean,
  productType: string,
  shotCount: number
): ShotDirective[] {
  
  const directives: ShotDirective[] = [];
  
  const hasShoes = outfitAnalysis.hasShoes;
  const hasAccessories = outfitAnalysis.hasAccessories;
  const hasNecklace = outfitAnalysis.hasNecklace;
  const hasBag = outfitAnalysis.hasBag;
  const hasBelt = outfitAnalysis.hasBelt;
  const hasHat = outfitAnalysis.hasHat;
  const fabricType = outfitAnalysis.fabricType;
  
  // S1: HERO - outfit completo, cara secundaria o ausente
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: 'Outfit completo head to toe. La ropa es la protagonista. Cara visible pero secundaria.',
    requiredElements: ['full_body', 'outfit_visible', 'complete_silhouette'],
    forbiddenElements: ['face_dominant', 'close_up_crop', 'dominant_background'],
    variationSpace: ['frontal_o_tres_cuartos', 'pose_natural'],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S2: DETAIL - extreme close-up de textura/fabric
  directives.push({
    key: 'S2',
    role: 'DETAIL',
    detailTarget: fabricType !== 'unknown' ? 'fabric' : 'texture',
    purpose: `Extreme close-up de ${fabricType !== 'unknown' ? 'textura de tela' : 'detalle de material'}. Cara NO visible.`,
    requiredElements: ['detail_fills_80_90_percent', 'texture_visible', 'no_face'],
    forbiddenElements: ['face', 'full_body', 'medium_framing', 'beautification'],
    variationSpace: ['acercamiento_agresivo', 'macro_detail'],
    framing: 'EXTREME_CLOSE',
    composition: 'EXTREME_CROP',
    exclusion: ['face', 'full_body', 'background', 'beautification', 'editorial_softening'],
    intensity: 'extreme'
  });
  
  // S3: INTERACTION - manos interactuando con la prenda
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: 'Manos ajustando o tocando la ropa. La prenda sigue siendo el foco.',
    requiredElements: ['hands_on_clothing', 'clear_action', 'outfit_visible'],
    forbiddenElements: ['static_pose', 'no_interaction', 'face_dominant', 'beautification'],
    variationSpace: ['manos_ajustando', 'tocando_tejido'],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S4: LIFESTYLE - contexto natural, ropa visible
  directives.push({
    key: 'S4',
    role: 'LIFESTYLE',
    purpose: 'Outfit en contexto natural, como look cotidiano. La ropa sigue siendo protagonista.',
    requiredElements: ['outfit_visible', 'natural_context', 'person_static'],
    forbiddenElements: ['walking_simulation', 'artificial_movement', 'face_dominant', 'beautification'],
    variationSpace: ['postura_relajada', 'contexto_visible'],
    framing: 'MEDIUM',
    composition: 'ASYMMETRIC',
    exclusion: ['beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S5: ALT_ANGLE - ángulo diferente mostrando silueta
  directives.push({
    key: 'S5',
    role: 'ALT_ANGLE',
    purpose: 'Outfit desde ángulo lateral o diferente. Silueta de la ropa.',
    requiredElements: ['different_angle', 'outfit_visible', 'silhouette_visible'],
    forbiddenElements: ['frontal_symmetry', 'eye_level_only', 'face_dominant', 'beautification'],
    variationSpace: ['lateral', 'tres_cuartos', 'contrapicado'],
    framing: 'MEDIUM',
    composition: 'SIDE_ANGLE',
    exclusion: ['frontal_symmetry', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S6: DETAIL - calzado o accesorio
  if (hasShoes) {
    directives.push({
      key: 'S6',
      role: 'DETAIL',
      detailTarget: 'shoe',
      purpose: 'Extreme close-up de calzado. Parte inferior del look.',
      requiredElements: ['shoes_visible', 'detail_fills_frame', 'no_face'],
      forbiddenElements: ['face', 'upper_body', 'beautification'],
      variationSpace: ['angulo_bajo', 'crop_agresivo'],
      framing: 'EXTREME_CLOSE',
      composition: 'LOW_ANGLE',
      exclusion: ['face', 'environment_dominance', 'beautification', 'editorial_softening'],
      intensity: 'extreme'
    });
  } else if (hasBag || hasBelt || hasNecklace || hasHat) {
    let accessoryTarget: DetailTarget = 'fabric';
    if (hasBag) accessoryTarget = 'bag';
    else if (hasBelt) accessoryTarget = 'belt';
    else if (hasNecklace) accessoryTarget = 'necklace';
    
    directives.push({
      key: 'S6',
      role: 'DETAIL',
      detailTarget: accessoryTarget,
      purpose: 'Extreme close-up de accesorio que complementa el look.',
      requiredElements: ['accessory_visible', 'detail_fills_frame', 'no_face'],
      forbiddenElements: ['face_dominant', 'full_body', 'beautification'],
      variationSpace: ['crop_extremo', 'angulo_variable'],
      framing: 'EXTREME_CLOSE',
      composition: 'EXTREME_CROP',
      exclusion: ['face', 'full_body', 'background', 'beautification', 'editorial_softening'],
      intensity: 'extreme'
    });
  } else {
    directives.push({
      key: 'S6',
      role: 'ALT_ANGLE',
      purpose: 'Outfit desde ángulo superior, mostrando caída de tela.',
      requiredElements: ['different_angle', 'outfit_visible', 'fabric_flow'],
      forbiddenElements: ['frontal_symmetry', 'eye_level', 'face_dominant', 'beautification'],
      variationSpace: ['angulo_picado'],
      framing: 'MEDIUM',
      composition: 'HIGH_ANGLE',
      exclusion: ['frontal_symmetry', 'beautification', 'editorial_softening'],
      intensity: 'normal'
    });
  }
  
  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - PRODUCTO (6 SHOTS - PRODUCTO HÉROE, CARA VISIBLE)
// ===================================================================
function buildProductShotDirectives(
  productCategory: ProductCategory,
  productSize?: ProductSize,
  shotCount: number = 6
): ShotDirective[] {
  
  const directives: ShotDirective[] = [];
  
  // S1: HERO - producto y cara visibles, producto domina
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: 'Producto como héroe visual. Avatar presenta el producto. Ambos visibles.',
    requiredElements: ['product_visible', 'product_dominant', 'face_visible', 'presenting_gesture'],
    forbiddenElements: ['background_dominant', 'face_cropped_out', 'beautification', 'editorial_softening'],
    variationSpace: ['producto_en_mano', 'mostrando_a_camara'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S2: DETAIL - extreme close-up del producto
  directives.push({
    key: 'S2',
    role: 'DETAIL',
    detailTarget: 'texture',
    purpose: 'Extreme close-up de textura, material o característica única del producto.',
    requiredElements: ['detail_fills_80_90_percent', 'texture_visible', 'no_face'],
    forbiddenElements: ['face', 'full_body', 'medium_framing', 'beautification'],
    variationSpace: ['macro_detail', 'shallow_depth'],
    framing: 'EXTREME_CLOSE',
    composition: 'EXTREME_CROP',
    exclusion: ['face', 'full_body', 'background', 'beautification', 'editorial_softening'],
    intensity: 'extreme'
  });
  
  // S3: INTERACTION - manos usando producto, cara visible
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: 'Avatar usando o demostrando el producto. Cara con expresión positiva.',
    requiredElements: ['hands_on_product', 'demonstration_action', 'face_visible', 'positive_expression'],
    forbiddenElements: ['static_pose', 'no_interaction', 'face_hidden', 'beautification'],
    variationSpace: ['manos_usando', 'demostrando_producto'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S4: LIFESTYLE - producto en contexto, avatar disfrutando
  directives.push({
    key: 'S4',
    role: 'LIFESTYLE',
    purpose: 'Producto en contexto natural. Avatar usándolo o interactuando.',
    requiredElements: ['context_visible', 'product_in_use', 'person_visible', 'natural_setting'],
    forbiddenElements: ['studio_background', 'artificial_setting', 'walking_simulation', 'beautification'],
    variationSpace: ['contexto_natural', 'uso_cotidiano'],
    framing: 'WIDE',
    composition: 'ASYMMETRIC',
    exclusion: ['beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S5: EXPRESSION - cara de satisfacción con producto
  directives.push({
    key: 'S5',
    role: 'EXPRESSION',
    purpose: 'Close-up del avatar con expresión de satisfacción hacia el producto.',
    requiredElements: ['face_fills_70_80_percent', 'positive_emotion', 'product_partially_visible'],
    forbiddenElements: ['neutral_expression', 'product_hidden_completely', 'beautification', 'editorial_softening'],
    variationSpace: ['sorpresa_positiva', 'satisfaccion', 'emocion_genuina'],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['background', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  // S6: ALT_ANGLE - producto desde otro ángulo
  directives.push({
    key: 'S6',
    role: 'ALT_ANGLE',
    purpose: 'Producto desde ángulo diferente, avatar visible.',
    requiredElements: ['different_angle', 'product_visible', 'person_visible'],
    forbiddenElements: ['same_angle_as_hero', 'beautification'],
    variationSpace: ['lateral', 'tres_cuartos', 'sobre_hombro'],
    framing: 'MEDIUM',
    composition: 'SIDE_ANGLE',
    exclusion: ['frontal_symmetry', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });
  
  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - ESCENA (6 SHOTS - ESPACIO DOMINANTE, AVATAR VIVE EXPERIENCIA)
// ===================================================================
function buildSceneShotDirectives(
  sceneAnalysis: any,
  productIsRelevant: boolean,
  shotCount: number = 6
): ShotDirective[] {
  
  const hasSeating = sceneAnalysis?.hasSeating || false;
  const hasTable = sceneAnalysis?.hasTable || false;
  const hasEquipment = sceneAnalysis?.hasEquipment || false;
  const hasNature = sceneAnalysis?.hasNature || false;
  const sceneType = sceneAnalysis?.sceneType || 'generic';
  
  let interactionType = 'relaxed in space';
  if (hasSeating) interactionType = 'sitting comfortably';
  else if (hasTable) interactionType = 'at the table enjoying';
  else if (hasEquipment) interactionType = 'using equipment';
  else if (hasNature) interactionType = 'enjoying nature';
  
  const directives: ShotDirective[] = [];
  
  // S1: CONTEXT - espacio completo con avatar como referencia
  directives.push({
    key: 'S1',
    role: 'CONTEXT',
    purpose: 'Espacio completo. El lugar es el protagonista. Avatar visible pero secundario.',
    requiredElements: ['environment_full_view', 'space_dominant', 'person_visible_25_35_percent'],
    forbiddenElements: ['person_dominant', 'product_dominant', 'beautification', 'luxury_redesign'],
    variationSpace: ['angulo_establecimiento', 'vista_completa'],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['product', 'beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });
  
  // S2: LIFESTYLE - avatar viviendo el espacio
  directives.push({
    key: 'S2',
    role: 'LIFESTYLE',
    purpose: `Avatar ${interactionType} en el espacio. Experiencia auténtica, no posada.`,
    requiredElements: ['person_in_space', 'natural_interaction', 'person_occupies_40_percent', 'face_visible'],
    forbiddenElements: ['static_pose', 'artificial_movement', 'walking_simulation', 'beautification'],
    variationSpace: ['sentado', 'de_pie_relajado', 'apoyado'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });
  
  // S3: INTERACTION - avatar interactuando con elementos del lugar
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: 'Avatar interactuando con un elemento del espacio. Experiencia real.',
    requiredElements: ['hands_interacting', 'scene_element_visible', 'face_visible', 'natural_action'],
    forbiddenElements: ['static_pose', 'no_interaction', 'beautification'],
    variationSpace: ['tocando_elemento', 'usando_servicio', 'disfrutando_comida'],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });
  
  // S4: DETAIL - detalle del espacio (decoración, textura, comida)
  directives.push({
    key: 'S4',
    role: 'DETAIL',
    detailTarget: 'feature',
    purpose: 'Detalle atractivo del lugar. Sin idealizar ni embellecer.',
    requiredElements: ['environment_detail', 'authentic_element', 'no_face'],
    forbiddenElements: ['face_dominant', 'full_body', 'beautification', 'luxury_redesign'],
    variationSpace: ['decoracion', 'textura_del_lugar', 'comida_real'],
    framing: 'CLOSE_UP',
    composition: 'ASYMMETRIC',
    exclusion: ['face', 'full_body', 'beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });
  
  // S5: EXPRESSION - avatar disfrutando, reacción al lugar
  directives.push({
    key: 'S5',
    role: 'EXPRESSION',
    purpose: 'Close-up del avatar con expresión de disfrute. Reacción auténtica al lugar.',
    requiredElements: ['face_fills_70_80_percent', 'positive_expression', 'environment_hint_visible'],
    forbiddenElements: ['neutral_expression', 'environment_hidden', 'beautification', 'editorial_softening'],
    variationSpace: ['disfrutando', 'satisfecho', 'impresionado'],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });
  
  // S6: ALT_ANGLE - perspectiva diferente del espacio
  directives.push({
    key: 'S6',
    role: 'ALT_ANGLE',
    purpose: 'Ángulo diferente del espacio. Mismo lugar, nueva perspectiva.',
    requiredElements: ['different_angle', 'environment_visible', 'person_visible'],
    forbiddenElements: ['same_angle_as_S1', 'beautification', 'luxury_redesign'],
    variationSpace: ['lateral', 'contrapicado', 'picado'],
    framing: 'WIDE',
    composition: 'SIDE_ANGLE',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });
  
  return directives.slice(0, shotCount);
}

// ===================================================================
// DIRECTOR PRINCIPAL - buildUGCSessionPlanFromAnchor
// ===================================================================
export async function buildUGCSessionPlanFromAnchor(
  anchor: string,
  focus: Focus,
  refs?: {
    productRef?: string | null;
    outfitRef?: string | null;
    sceneRef?: string | null;
    sceneText?: string;
  },
  productSize?: ProductSize,
  productIsRelevant?: boolean
): Promise<UGCSessionPlan> {

  const productCategory = detectProductCategory(refs?.sceneText || undefined, refs?.productRef);
  const shotCount = 6;
  
  let outfitAnalysis = null;
  let sceneAnalysis = null;
  let directives: ShotDirective[] = [];
  
  if (focus === 'AVATAR') {
    directives = buildAvatarShotDirectives(shotCount, !!(refs?.productRef));
  } else if (focus === 'OUTFIT' && refs?.outfitRef) {
    outfitAnalysis = await analyzeOutfitReference(refs.outfitRef);
    directives = buildOutfitShotDirectives(outfitAnalysis, productIsRelevant || false, 'complement', shotCount);
  } else if (focus === 'PRODUCT') {
    directives = buildProductShotDirectives(productCategory, productSize, shotCount);
  } else if (focus === 'SCENE') {
    if (refs?.sceneRef) {
      sceneAnalysis = await analyzeSceneReference(refs.sceneRef);
    }
    directives = buildSceneShotDirectives(sceneAnalysis, productIsRelevant || false, shotCount);
  }
  
  while (directives.length < shotCount) {
    directives.push({
      key: `S${directives.length + 1}` as ShotKey,
      role: 'LIFESTYLE',
      purpose: `Mostrar ${focus} de forma natural y auténtica`,
      requiredElements: ['natural_pose', 'focus_visible'],
      forbiddenElements: ['artificial_composition', 'beautification', 'editorial_softening'],
      variationSpace: ['postura_relajada', 'angulo_natural'],
      framing: 'MEDIUM',
      composition: 'EYE_LEVEL',
      exclusion: ['beautification', 'editorial_softening'],
      intensity: 'normal'
    });
  }
  
  directives = directives.slice(0, shotCount);
  
  const sessionTheme = `${focus} UGC Session${productCategory !== 'GENERIC' && focus === 'PRODUCT' ? ` - ${CATEGORY_LABELS[productCategory]}` : ''}`;
  
  return {
    sessionTheme,
    productCategory,
    shots: directives
  };
}