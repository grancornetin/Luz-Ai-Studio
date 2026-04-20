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
// ===================================================================
export async function analyzeREF0(image0Url: string): Promise<REF0Analysis> {
  try {
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
// ANALIZAR SI EL PRODUCTO ES RELEVANTE
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
// ANALIZAR REFERENCIA DE OUTFIT
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
  bottomType: 'shorts' | 'pants' | 'skirt' | 'unknown';
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
      hasNecklace: false,
      bottomType: 'unknown'
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
      hasNecklace: false,
      bottomType: 'unknown'
    };
  }
  
  try {
    const result = await ugcApiService.analyzeOutfit({
      imageData: match[2],
      mimeType: match[1]
    });
    
    let bottomType: 'shorts' | 'pants' | 'skirt' | 'unknown' = 'unknown';
    if (result.bottomType) {
      bottomType = result.bottomType;
    } else if (result.hasPants && !result.hasShorts) {
      bottomType = 'pants';
    } else if (result.hasShorts) {
      bottomType = 'shorts';
    }
    
    return {
      ...result,
      bottomType
    };
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
      hasNecklace: false,
      bottomType: 'unknown'
    };
  }
}

// ===================================================================
// ANALIZAR REFERENCIA DE ESCENA
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
// SHOT PLAN - AVATAR (6 SHOTS)
// ===================================================================
function buildAvatarShotDirectives(
  shotCount: number = 6,
  hasProduct: boolean = false,
  hasOutfit: boolean = false,
  hasScene: boolean = false
): ShotDirective[] {
  const outfitLockNotice = hasOutfit 
    ? "🔒 MISMO OUTFIT que la referencia (NO cambiar ropa entre shots)."
    : "Outfit realista generado (sin referencia, puede variar contextualmente).";
  const sceneLockNotice = hasScene
    ? "🔒 MISMA ESCENA que la referencia (NO cambiar fondo entre shots)."
    : "Escena realista generada (casa, café, parque, etc. - nunca estudio).";

  const directives: ShotDirective[] = [];

  // S1: HERO - Medium shot, cara dominante
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: `Retrato principal. Medium shot (waist-up), cara dominante (40-50% frame). Expresión cálida y auténtica. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['face_dominant_40_50_percent', 'waist_up_framing', 'authentic_warm_expression', 'face_clear'],
    forbiddenElements: ['full_body', 'outfit_dominance', 'beautification', 'neutral_expression'],
    variationSpace: ['sonrisa suave y natural', 'mirada directa a cámara', 'expresión abierta y amigable', 'confianza tranquila'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening', 'full_body'],
    intensity: 'normal'
  });

  // S2: SELFIE - Selfie UGC auténtica
  directives.push({
    key: 'S2',
    role: 'SELFIE',
    purpose: `Selfie UGC auténtica. Brazo extendido, hombro visible, cámara sostenida por la persona. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['arm_extended_visible', 'shoulder_visible_bottom_frame', 'handheld_feel', 'face_dominant', 'slight_asymmetry'],
    forbiddenElements: ['third_person_perspective', 'full_body', 'studio_composition', 'beautification', 'phone_visible'],
    variationSpace: ['asimetría natural de selfie', 'ligera distorsión de lente', 'encuadre cercano al rostro', 'brazo ligeramente inclinado'],
    framing: 'SELFIE',
    composition: 'ASYMMETRIC',
    exclusion: ['full_body', 'third_person_perspective', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S3: EXPRESSION - Close-up expresión diferente a S1
  directives.push({
    key: 'S3',
    role: 'EXPRESSION',
    purpose: `Close-up facial con expresión diferente a S1. Rostro llena 70-80% del frame. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['face_fills_70_80_percent', 'expression_clearly_different_from_S1', 'authentic_emotion'],
    forbiddenElements: ['same_expression_as_S1', 'micro_expression', 'beautification', 'editorial_softening'],
    variationSpace: ['alegría genuina', 'sorpresa positiva', 'pensativa y reflexiva', 'sonrisa amplia y feliz', 'risa natural'],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['background', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S4: MODEL POSE - Full body posado para cámara (como si alguien le tomara una foto)
  directives.push({
    key: 'S4',
    role: 'HERO',  // Reutilizamos HERO pero con propósito de modelo
    purpose: `Full body posado para cámara. Avatar en pose natural pero consciente, como si alguien le estuviera tomando una foto. Expresión confiada o natural. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['full_body_visible', 'posed_for_camera', 'face_visible_natural_expression', 'outfit_visible_complete'],
    forbiddenElements: ['walking', 'motion_blur', 'beautification', 'editorial_overposing'],
    variationSpace: ['de pie con manos en caderas', 'apoyada en una pared', 'caminando lentamente mirando a cámara', 'sentada en escalera', 'mano en el bolsillo mirando a cámara'],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S5: INTERACTION - Manos interactuando con objeto
  directives.push({
    key: 'S5',
    role: 'INTERACTION',
    purpose: `Manos interactuando con objeto (bebida, libro, móvil, etc.). Rostro visible y comprometido. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: hasProduct 
      ? ['hands_on_product', 'face_visible', 'natural_interaction']
      : ['hands_visible_interacting', 'object_visible', 'face_visible'],
    forbiddenElements: ['static_hands', 'no_object', 'face_hidden', 'artificial_pose'],
    variationSpace: hasProduct
      ? ['sosteniendo producto mostrando', 'usando producto demostrando', 'mostrando resultado positivo']
      : ['sosteniendo taza de café', 'hojeando un libro', 'mirando el móvil', 'tocándose el cabello', 'sosteniendo una flor'],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['background_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S6: LIFESTYLE - Contexto natural, persona relajada
  directives.push({
    key: 'S6',
    role: 'LIFESTYLE',
    purpose: `Contexto natural (casa, café, parque). Persona relajada, ambiente visible pero secundario. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['face_visible', 'natural_relaxed_expression', 'context_visible', 'authentic_candid_feel'],
    forbiddenElements: ['artificial_pose', 'face_not_visible', 'environment_dominance', 'beautification'],
    variationSpace: ['sentada en sofá con bebida', 'paseando por el parque', 'en cafetería mirando por la ventana', 'recostada en la cama con libro', 'de pie en la cocina preparando algo'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - OUTFIT (6 SHOTS - CLOTHING DOMINANT, MISMO OUTFIT)
// ===================================================================
function buildOutfitShotDirectives(
  outfitAnalysis: any,
  productIsRelevant: boolean,
  productType: string,
  shotCount: number,
  hasScene: boolean = false
): ShotDirective[] {
  const directives: ShotDirective[] = [];
  const hasShoes = outfitAnalysis.hasShoes;
  const hasAccessories = outfitAnalysis.hasAccessories;
  const hasNecklace = outfitAnalysis.hasNecklace;
  const hasBag = outfitAnalysis.hasBag;
  const hasBelt = outfitAnalysis.hasBelt;
  const hasHat = outfitAnalysis.hasHat;
  const fabricType = outfitAnalysis.fabricType;
  const bottomType = outfitAnalysis.bottomType || 'unknown';
  const sceneLockNotice = hasScene ? "🔒 MISMA ESCENA que la referencia (fondo consistente)." : "Fondo realista generado (no estudio).";

  // NOTA: 🔒 MISMO OUTFIT en todos los shots

  // S1: HERO - Full body frontal
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: `FULL BODY head-to-toe frontal. Outfit COMPLETO visible. Cara secundaria (max 15% del frame). ${sceneLockNotice} 🔒 MISMO OUTFIT.`,
    requiredElements: ['full_body_head_to_toe', 'outfit_dominant_70_80_percent', 'face_secondary_max_15_percent', 'complete_silhouette', 'static_neutral_pose'],
    forbiddenElements: ['face_dominant', 'cropped_head_or_feet', 'movement_walking', 'environmental_distraction', 'outfit_hidden_any_part'],
    variationSpace: ['de pie con brazos al lado', 'mano en cadera', 'mirada natural hacia cámara', 'pose frontal neutra'],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S2: DETAIL - Zapatos (extreme crop, anti-invención)
  if (hasShoes) {
    directives.push({
      key: 'S2',
      role: 'DETAIL',
      detailTarget: 'shoe',
      purpose: `EXTREME close-up SOLO zapato, tobillo, piso. ${bottomType === 'shorts' ? 'Si shorts, NO inventar pantalón.' : 'NO tela adicional.'} 85-90% frame. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['shoes_dominant_85_90_percent', 'ankle_visible', 'floor_visible', 'no_invented_fabric', 'detail_clear'],
      forbiddenElements: ['face', 'upper_body', 'invented_pant_leg', 'invented_hem', 'medium_framing', 'full_leg_visible'],
      variationSpace: ['zapatos de pie sobre suelo', 'sentado mostrando zapatos', 'ángulo lateral del zapato', 'desde arriba mostrando detalle'],
      framing: 'EXTREME_CLOSE',
      composition: 'EXTREME_CROP',
      exclusion: ['face', 'full_body', 'invented_clothing', 'beautification', 'fabric_continuation'],
      intensity: 'extreme'
    });
  } else {
    directives.push({
      key: 'S2',
      role: 'DETAIL',
      detailTarget: fabricType !== 'unknown' ? 'fabric' : 'texture',
      purpose: `Extreme close-up de textura de ${fabricType !== 'unknown' ? 'tela' : 'material'}. SOLO textura, sin prenda completa. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['detail_fills_80_90_percent', 'texture_visible', 'no_face', 'no_garment_silhouette'],
      forbiddenElements: ['face', 'full_body', 'medium_framing', 'beautification', 'garment_shape_visible'],
      variationSpace: ['acercamiento macro de tejido', 'detalle de costura', 'textura vista muy de cerca', 'luz mostrando material'],
      framing: 'EXTREME_CLOSE',
      composition: 'EXTREME_CROP',
      exclusion: ['face', 'full_body', 'background', 'beautification', 'editorial_softening'],
      intensity: 'extreme'
    });
  }

  // S3: INTERACTION - Manos ajustando/tocando ropa
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: `Manos AJUSTANDO/TOCANDO la ropa. MISMO outfit. ${sceneLockNotice}`,
    requiredElements: ['hands_on_clothing', 'hands_visible', 'clothing_texture_shown', 'clear_touch_or_adjustment_action', 'outfit_visible'],
    forbiddenElements: ['static_hands', 'hands_hidden', 'no_clear_interaction', 'outfit_hidden'],
    variationSpace: ['ajustando el cuello de la camisa', 'tocando la tela de la manga', 'arreglando el dobladillo', 'alisando la cintura'],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S4: LIFESTYLE - Sentada/relajada
  directives.push({
    key: 'S4',
    role: 'LIFESTYLE',
    purpose: `MISMO outfit, sentada en sofá o contexto relajado. Mostrando caída de tela. ${sceneLockNotice}`,
    requiredElements: ['person_sitting_or_resting', 'outfit_visible', 'fabric_drape_visible', 'relaxed_pose', 'same_outfit'],
    forbiddenElements: ['walking_movement', 'movement_artificial', 'outfit_hidden', 'person_too_small'],
    variationSpace: ['sentada en sofá con piernas cruzadas', 'recostada en sillón', 'apoyada en mesa', 'sentada en escalón'],
    framing: 'MEDIUM',
    composition: 'ASYMMETRIC',
    exclusion: ['beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S5: ALT_ANGLE - Full body lateral o 3/4
  directives.push({
    key: 'S5',
    role: 'ALT_ANGLE',
    purpose: `FULL BODY lateral o 3/4 SIGNIFICATIVAMENTE diferente de S1. MISMO outfit. ${sceneLockNotice}`,
    requiredElements: ['full_body_head_to_toe', 'different_angle_lateral_or_profile', 'outfit_visible_complete', 'silhouette_visible', 'angle_significantly_different_from_S1'],
    forbiddenElements: ['frontal_angle', 'too_similar_to_S1', 'outfit_hidden', 'face_only_focus'],
    variationSpace: ['lateral 90 grados', 'tres cuartos 45 grados', 'de espaldas mirando hacia atrás', 'perfil completo'],
    framing: 'WIDE',
    composition: 'SIDE_ANGLE',
    exclusion: ['frontal_symmetry', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S6: DETAIL - Accesorio (macro)
  if (hasBag || hasBelt || hasNecklace || hasHat) {
    let accessoryTarget: DetailTarget = 'fabric';
    if (hasBag) accessoryTarget = 'bag';
    else if (hasBelt) accessoryTarget = 'belt';
    else if (hasNecklace) accessoryTarget = 'necklace';
    else if (hasHat) accessoryTarget = 'feature';
    
    directives.push({
      key: 'S6',
      role: 'DETAIL',
      detailTarget: accessoryTarget,
      purpose: `EXTREME macro detail de ${accessoryTarget}. Solo el accesorio llena 85-90% del frame. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['accessory_dominant_85_90_percent', 'detail_texture_visible', 'macro_feeling', 'no_outfit_visible_except_necessary_body_part'],
      forbiddenElements: ['face', 'full_body', 'full_outfit_visible', 'tiny_accessory'],
      variationSpace: ['macro close-up mostrando textura', 'ángulo lateral del accesorio', 'luz reflejando brillo', 'detalle de cierre o broche'],
      framing: 'EXTREME_CLOSE',
      composition: 'EXTREME_CROP',
      exclusion: ['face', 'full_body', 'background', 'beautification', 'editorial_softening'],
      intensity: 'extreme'
    });
  } else {
    directives.push({
      key: 'S6',
      role: 'ALT_ANGLE',
      purpose: `Outfit desde ángulo superior, mostrando caída de tela. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['different_angle', 'outfit_visible', 'fabric_flow'],
      forbiddenElements: ['frontal_symmetry', 'eye_level', 'face_dominant', 'beautification'],
      variationSpace: ['ángulo picado desde arriba', 'vista cenital parcial', 'desde escalera superior'],
      framing: 'MEDIUM',
      composition: 'HIGH_ANGLE',
      exclusion: ['frontal_symmetry', 'beautification', 'editorial_softening'],
      intensity: 'normal'
    });
  }

  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - PRODUCTO (6 SHOTS)
// ===================================================================
function buildProductShotDirectives(
  productCategory: ProductCategory,
  productSize?: ProductSize,
  shotCount: number = 6,
  hasOutfit: boolean = false,
  hasScene: boolean = false
): ShotDirective[] {
  const outfitLockNotice = hasOutfit ? "🔒 MISMO OUTFIT que la referencia (secundario)." : "Outfit realista generado (sin referencia).";
  const sceneLockNotice = hasScene ? "🔒 MISMA ESCENA que la referencia (contexto real)." : "Escena realista generada (contexto de uso).";

  const directives: ShotDirective[] = [];

  // S1: HERO - producto + cara, producto dominante
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: `Producto como héroe visual. Avatar PRESENTA el producto con entusiasmo. Producto domina (40-50% frame). ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['product_visible_clear', 'product_dominant_40_50_percent', 'face_visible_smiling', 'presenting_gesture', 'hands_holding_product'],
    forbiddenElements: ['background_dominant', 'face_cropped', 'hands_hidden', 'static_pose', 'neutral_expression'],
    variationSpace: ['sosteniendo producto a la altura del pecho', 'mostrando producto con ambas manos', 'producto cerca de la cámara', 'expresión de orgullo o satisfacción'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S2: DETAIL - flat lay o macro, sin persona
  directives.push({
    key: 'S2',
    role: 'DETAIL',
    detailTarget: 'product',
    purpose: `Flat lay o close-up detail del producto mostrando texturas, colores, materiales. SOLO producto visible. ${sceneLockNotice}`,
    requiredElements: ['detail_fills_80_90_percent', 'product_texture_visible', 'no_person', 'product_only', 'clear_lighting'],
    forbiddenElements: ['face', 'hands', 'body', 'person_any_part', 'medium_framing', 'dim_lighting'],
    variationSpace: ['flat lay desde arriba', 'ángulo 45 grados', 'macro de textura', 'producto sobre fondo neutro', 'detalle de logotipo'],
    framing: 'EXTREME_CLOSE',
    composition: 'EXTREME_CROP',
    exclusion: ['face', 'full_body', 'background', 'beautification', 'editorial_softening'],
    intensity: 'extreme'
  });

  // S3: INTERACTION - demostración de uso
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: `Avatar DEMOSTRANDO/USANDO el producto. Manos interactuando, cara visible con expresión positiva. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['hands_on_product', 'demonstration_action_clear', 'face_visible', 'positive_expression', 'product_clearly_visible'],
    forbiddenElements: ['static_pose', 'hands_not_visible', 'neutral_expression', 'product_hidden', 'blurry_product'],
    variationSpace: ['aplicando producto', 'demostrando uso', 'mostrando resultado', 'expresión de sorpresa positiva', 'satisfacción al usarlo'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S4: LIFESTYLE - producto en contexto
  directives.push({
    key: 'S4',
    role: 'LIFESTYLE',
    purpose: `Producto en contexto natural de uso. Avatar disfrutando, emocionado. Producto visible, ambiente visible pero secundario. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['context_visible', 'product_in_use', 'person_visible', 'authentic_feeling', 'positive_emotion_visible', 'face_visible'],
    forbiddenElements: ['staged_feel', 'artificial_lighting', 'product_hidden', 'person_too_small', 'neutral_expression'],
    variationSpace: ['en casa usando producto', 'en la calle con producto', 'contexto de vacaciones', 'disfrutando con amigos', 'momento cotidiano'],
    framing: 'WIDE',
    composition: 'ASYMMETRIC',
    exclusion: ['beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S5: EXPRESSION - emoción positiva
  directives.push({
    key: 'S5',
    role: 'EXPRESSION',
    purpose: `Close-up del avatar con expresión de SATISFACCIÓN/SORPRESA/EMOCIÓN hacia el producto. Producto PARCIALMENTE visible. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['face_fills_70_80_percent', 'clear_positive_emotion', 'product_partially_visible', 'face_dominant', 'genuine_reaction'],
    forbiddenElements: ['neutral_expression', 'product_completely_hidden', 'tiny_face', 'blurred_expression'],
    variationSpace: ['sorpresa positiva', 'satisfacción obvia', 'alegría genuina', 'asombro', 'emoción contenida'],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['background', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S6: ALT_ANGLE - ángulo diferente
  directives.push({
    key: 'S6',
    role: 'ALT_ANGLE',
    purpose: `Producto desde ángulo SIGNIFICATIVAMENTE diferente (lateral, arriba, abajo). Avatar visible presentando. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['different_angle_from_hero', 'product_visible_clear', 'person_visible', 'angle_significantly_different'],
    forbiddenElements: ['same_angle_as_S1', 'product_hidden', 'angle_too_similar'],
    variationSpace: ['lateral 45 grados', 'desde arriba', 'contrapicado', 'tres cuartos', 'sobre el hombro'],
    framing: 'MEDIUM',
    composition: 'SIDE_ANGLE',
    exclusion: ['frontal_symmetry', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - ESCENA (6 SHOTS - LUGAR DOMINANTE)
// ===================================================================
function buildSceneShotDirectives(
  sceneAnalysis: any,
  productIsRelevant: boolean,
  shotCount: number = 6,
  hasOutfit: boolean = false
): ShotDirective[] {
  const hasSeating = sceneAnalysis?.hasSeating || false;
  const hasTable = sceneAnalysis?.hasTable || false;
  const hasEquipment = sceneAnalysis?.hasEquipment || false;
  const hasNature = sceneAnalysis?.hasNature || false;
  const sceneType = sceneAnalysis?.sceneType || 'generic';
  const outfitLockNotice = hasOutfit ? "🔒 MISMO OUTFIT que la referencia (secundario)." : "Outfit realista generado (contextual).";

  let interactionType = 'relaxed in space';
  if (hasSeating) interactionType = 'sitting comfortably';
  else if (hasTable) interactionType = 'at the table enjoying';
  else if (hasEquipment) interactionType = 'using equipment';
  else if (hasNature) interactionType = 'enjoying nature';

  const directives: ShotDirective[] = [];

  // S1: CONTEXT - wide shot, lugar domina (65-75%), persona pequeña (25-35%)
  directives.push({
    key: 'S1',
    role: 'CONTEXT',
    purpose: `Lugar hermoso es PROTAGONISTA. Persona pequeña (25-35% del frame), visible pero como VISITANTE disfrutando. Wide shot. ${outfitLockNotice}`,
    requiredElements: ['environment_dominant_65_75_percent', 'space_beautiful_clear', 'person_visible_25_35_percent', 'wide_shot', 'person_enjoying_space'],
    forbiddenElements: ['person_dominant', 'person_cropped', 'ugly_space', 'poor_lighting', 'space_hidden'],
    variationSpace: ['vista amplia de montaña', 'plaza con arquitectura', 'interior de restaurante elegante', 'jardín con flores', 'playa al atardecer'],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['product', 'beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  // S2: LIFESTYLE - avatar viviendo el lugar
  directives.push({
    key: 'S2',
    role: 'LIFESTYLE',
    purpose: `Avatar VIVIENDO el lugar. ${interactionType}. Persona relajada, disfrutando. ${outfitLockNotice}`,
    requiredElements: ['person_in_space_relaxed', 'face_visible', 'environment_visible', 'authentic_enjoying_expression', 'person_40_50_percent', 'space_context_visible'],
    forbiddenElements: ['walking_movement', 'artificial_pose', 'person_too_small', 'environment_not_visible'],
    variationSpace: ['sentada en terraza', 'recostada en el césped', 'observando el paisaje', 'caminando lentamente', 'disfrutando de una bebida'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  // S3: INTERACTION - manos interactuando con elemento del lugar
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: `Manos TOCANDO/USANDO algo que el lugar ofrece (comida, decoración, planta). Avatar interactuando con lo ESPECÍFICO del lugar. ${outfitLockNotice}`,
    requiredElements: ['hands_on_place_element', 'place_element_visible', 'authentic_interaction', 'face_visible_engaged', 'place_context_clear'],
    forbiddenElements: ['hands_empty', 'generic_action', 'place_not_visible', 'artificial_touch'],
    variationSpace: ['tocando una flor', 'sirviendo vino', 'mirando un cuadro', 'probando comida', 'ajustando una lámpara'],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  // S4: DETAIL - belleza del lugar SIN persona
  directives.push({
    key: 'S4',
    role: 'DETAIL',
    detailTarget: 'feature',
    purpose: `Close-up hermoso de algo que hace el lugar especial. Comida, decoración, arquitectura, detalle visual. SIN persona. ${outfitLockNotice}`,
    requiredElements: ['detail_beautiful', 'place_feature_clear', 'no_person', 'high_quality_lighting', 'mostrando_belleza_lugar'],
    forbiddenElements: ['person_visible', 'ugly_detail', 'poor_lighting', 'blurry'],
    variationSpace: ['primer plano de comida', 'textura de pared antigua', 'lámpara decorativa', 'detalle de menú', 'flores en maceta'],
    framing: 'CLOSE_UP',
    composition: 'ASYMMETRIC',
    exclusion: ['face', 'full_body', 'beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  // S5: EXPRESSION - disfrute del lugar
  directives.push({
    key: 'S5',
    role: 'EXPRESSION',
    purpose: `Close-up rostro mostrando DISFRUTE/SORPRESA/ASOMBRO hacia el lugar. Cara llena 70-80% frame. Hint de ambiente atrás. ${outfitLockNotice}`,
    requiredElements: ['face_fills_70_80_percent', 'emotion_enjoying_place_clear', 'environment_hint_visible', 'authentic_reaction', 'positive_emotion'],
    forbiddenElements: ['neutral_expression', 'environment_completely_hidden', 'tiny_face'],
    variationSpace: ['asombro ante la vista', 'satisfacción al comer', 'relajación en la naturaleza', 'alegría por el lugar', 'sorpresa por la belleza'],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  // S6: ALT_ANGLE - nueva perspectiva del lugar
  directives.push({
    key: 'S6',
    role: 'ALT_ANGLE',
    purpose: `MISMO lugar desde ángulo SIGNIFICATIVAMENTE diferente. Wide shot mostrando perspectiva nueva. Persona pequeña (20-30%), lugar domina. ${outfitLockNotice}`,
    requiredElements: ['different_angle_from_S1', 'environment_dominant', 'wide_shot', 'person_visible_small', 'angle_significantly_different'],
    forbiddenElements: ['same_angle_as_S1', 'person_dominant', 'environment_not_visible'],
    variationSpace: ['desde el otro lado de la habitación', 'ángulo picado de la mesa', 'contrapicado de un edificio', 'lateral desde la izquierda', 'vista desde arriba'],
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
  const hasOutfit = !!refs?.outfitRef;
  const hasScene = !!refs?.sceneRef;
  const hasProduct = !!refs?.productRef && (focus === 'PRODUCT' || productIsRelevant !== false);

  let outfitAnalysis = null;
  let sceneAnalysis = null;
  let directives: ShotDirective[] = [];

  if (focus === 'AVATAR') {
    directives = buildAvatarShotDirectives(shotCount, hasProduct, hasOutfit, hasScene);
  } else if (focus === 'OUTFIT' && refs?.outfitRef) {
    outfitAnalysis = await analyzeOutfitReference(refs.outfitRef);
    directives = buildOutfitShotDirectives(outfitAnalysis, productIsRelevant || false, 'complement', shotCount, hasScene);
  } else if (focus === 'PRODUCT') {
    directives = buildProductShotDirectives(productCategory, productSize, shotCount, hasOutfit, hasScene);
  } else if (focus === 'SCENE') {
    if (refs?.sceneRef) {
      sceneAnalysis = await analyzeSceneReference(refs.sceneRef);
    }
    directives = buildSceneShotDirectives(sceneAnalysis, productIsRelevant || false, shotCount, hasOutfit);
  }
  
  while (directives.length < shotCount) {
    directives.push({
      key: `S${directives.length + 1}` as ShotKey,
      role: 'LIFESTYLE',
      purpose: `Mostrar ${focus} de forma natural y auténtica`,
      requiredElements: ['natural_pose', 'focus_visible'],
      forbiddenElements: ['artificial_composition', 'beautification', 'editorial_softening'],
      variationSpace: ['postura relajada', 'ángulo natural'],
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