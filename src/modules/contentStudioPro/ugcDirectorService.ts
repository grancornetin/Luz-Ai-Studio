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
      text.includes('joya') || text.includes('ring') || text.includes('earring') || text.includes('necklace') ||
      text.includes('gafa') || text.includes('lentes') || text.includes('sunglasses')) {
    return 'JEWELRY';
  }
  if (text.includes('labial') || text.includes('maquillaje') || text.includes('makeup') || text.includes('lipstick') ||
      text.includes('base') || text.includes('sombras') || text.includes('crema') || text.includes('serum')) {
    return 'MAKEUP';
  }
  if (text.includes('celular') || text.includes('laptop') || text.includes('tech') || text.includes('phone') ||
      text.includes('audifonos') || text.includes('auriculares') || text.includes('tablet') || text.includes('speaker')) {
    return 'TECH';
  }
  if (text.includes('zapatilla') || text.includes('pelota') || text.includes('sports') || text.includes('shoes') ||
      text.includes('tenis') || text.includes('balon') || text.includes('gym') || text.includes('deporte')) {
    return 'SPORTS';
  }
  if (text.includes('gorra') || text.includes('bolso') || text.includes('cartera') || text.includes('fashion') || 
      text.includes('bag') || text.includes('cinturon') || text.includes('bufanda') || text.includes('ropa') ||
      text.includes('vestido') || text.includes('camisa')) {
    return 'FASHION';
  }
  if (text.includes('mueble') || text.includes('silla') || text.includes('home') || text.includes('furniture') ||
      text.includes('mesa') || text.includes('lampara') || text.includes('vela') || text.includes('decoracion')) {
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
// "Influencer vivo. Feed de Instagram real. Selfies auténticas."
// ===================================================================
function buildAvatarShotDirectives(
  shotCount: number = 6,
  hasProduct: boolean = false,
  hasOutfit: boolean = false,
  hasScene: boolean = false
): ShotDirective[] {
  const outfitLockNotice = hasOutfit 
    ? "🔒 MISMO OUTFIT que la referencia. NO cambiar ninguna prenda."
    : "Outfit inventado coherente con la escena (nunca studio/fondo neutro).";
  const sceneLockNotice = hasScene
    ? "🔒 MISMA ESCENA que la referencia. NO mover ni rediseñar."
    : "Fondo real: café, calle, parque, interior de casa — NUNCA fondo neutro de estudio.";

  const directives: ShotDirective[] = [];

  // S1: HERO — Retrato iPhone, medium shot con cara dominante, mirada a cámara
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: `Retrato principal iPhone. Medium shot (waist-up). Cara llena 40-50% del frame, expresión abierta y cálida, mirada directa. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['face_dominant_40_50_percent', 'waist_up_framing', 'direct_eye_contact_camera', 'authentic_warm_expression', 'slight_smile_or_genuine_emotion'],
    forbiddenElements: ['full_body', 'studio_composition', 'neutral_blank_expression', 'editorial_softening', 'beautification', 'catalog_pose'],
    variationSpace: [
      'sonrisa suave con mirada directa, calle de fondo desenfocada',
      'expresión confiada y tranquila, café o interior cálido atrás',
      'risa genuina leve, ambiente natural detrás',
      'mirada pensativa y segura con fondo urbano suave'
    ],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S2: SELFIE — Selfie real tipo cámara frontal iPhone, sin teléfono visible
  directives.push({
    key: 'S2',
    role: 'SELFIE',
    purpose: `Selfie UGC auténtica iPhone. POV cámara frontal: brazo extendido implícito, hombro visible abajo del frame, antebrazo parcialmente en frame, cara cercana y ligeramente asimétrica. SIN teléfono visible. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['arm_extended_implied_pov', 'shoulder_visible_lower_frame', 'face_dominant_close_natural', 'slight_upward_angle_from_hand_level', 'handheld_organic_framing', 'no_phone_visible'],
    forbiddenElements: ['phone_visible', 'third_person_portrait', 'full_body', 'studio_lighting', 'symmetric_composition', 'professional_photographer_perspective', 'someone_else_taking_photo'],
    variationSpace: [
      'selfie cerca, fondo de calle o fachada de café suave atrás, sonrisa natural',
      'selfie levemente contrapicada, cielo o exterior de fondo, expresión alegre',
      'selfie interior, fondo bokeh de cafetería o sala, expresión casual',
      'selfie en espejo parcial, pero SIN ver el teléfono, brazo en frame'
    ],
    framing: 'SELFIE',
    composition: 'ASYMMETRIC',
    exclusion: ['full_body', 'third_person_perspective', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S3: EXPRESSION — Close-up facial emocional, diferente a S1
  directives.push({
    key: 'S3',
    role: 'EXPRESSION',
    purpose: `Close-up facial. Cara llena 70-80% del frame. Emoción CLARAMENTE diferente a S1 (si S1 fue sonrisa suave, aquí puede ser risa abierta, sorpresa, o expresión pensativa). Textura de piel real, sin retoque. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['face_fills_70_80_percent', 'emotion_perceptually_distinct_from_S1', 'authentic_emotion_clear', 'natural_skin_texture', 'real_imperfections_allowed'],
    forbiddenElements: ['same_expression_as_S1', 'micro_expression', 'beautification', 'airbrushed_skin', 'editorial_softening', 'full_body'],
    variationSpace: [
      'risa genuina abierta, teeth visible, ojos reducidos de alegría',
      'sorpresa positiva — cejas levantadas, boca levemente abierta',
      'expresión pensativa, mirando ligeramente hacia un lado',
      'entusiasmo real — ojos brillantes, sonrisa contenida pero emocionada'
    ],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['background', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S4: LIFESTYLE POSE — Full body en ambiente real, pose con actitud e intención
  directives.push({
    key: 'S4',
    role: 'LIFESTYLE',
    purpose: `Full body en ambiente real. Pose con actitud e intención: apoyada en pared, sentada en escalón, caminando lentamente mirando a cámara, parada con peso en una cadera. NO maniquí. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['full_body_visible', 'natural_weight_shifted_pose', 'face_visible_natural_expression', 'outfit_visible_complete', 'environment_visible_real'],
    forbiddenElements: ['mannequin_stiff_pose', 'walking_motion_blur', 'catalog_symmetrical_stance', 'beautification', 'studio_backdrop'],
    variationSpace: [
      'apoyada en pared de ladrillo o fachada, un pie ligeramente cruzado, mirando a cámara',
      'sentada en escalones o borde de fuente, codo en rodilla, expresión relajada',
      'parada en acera con bolso, peso en una cadera, mirada lateral o directa',
      'caminando lento mirando a cámara, brazo en movimiento natural, calle de fondo'
    ],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S5: INTERACTION — Manos interactuando con algo del ambiente o un prop
  directives.push({
    key: 'S5',
    role: 'INTERACTION',
    purpose: `Manos en acción con elemento real del ambiente (taza, flor, teléfono, bolso, menú, libro). Cara visible y comprometida con la acción. Medium shot. NO pose estática sin propósito. ${hasProduct ? '🔒 producto visible si aplica.' : ''} ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: hasProduct 
      ? ['hands_on_product', 'face_visible_engaged', 'product_visible_natural']
      : ['hands_interacting_real_object', 'object_clearly_visible', 'face_visible_engaged', 'action_has_clear_intention'],
    forbiddenElements: ['static_purposeless_hands', 'no_object_or_prop', 'face_not_visible', 'artificial_forced_pose'],
    variationSpace: hasProduct
      ? [
          'sosteniendo producto hacia la cámara con una mano, cara sonriente al lado',
          'abriendo o usando el producto con ambas manos, cara de interés',
          'sosteniendo producto cerca del pecho mirando a cámara con confianza'
        ]
      : [
          'sosteniendo taza de café con ambas manos, vapor visible, cara cálida',
          'hojeando un libro o revista en café, mirada hacia el objeto',
          'tocándose el cabello con una mano mientras mira al frente, otra mano en bolso',
          'sosteniendo flores o ramo liviano mirando a cámara',
          'mirando el teléfono levemente, cara ligeramente inclinada, expresión natural'
        ],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['background_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S6: LIFESTYLE CONTEXT — Lifestyle natural, persona integrada al ambiente
  directives.push({
    key: 'S6',
    role: 'LIFESTYLE',
    purpose: `Persona integrada al ambiente. Lifestyle cotidiano. Puede ser sentada tomando café, viendo una vitrina, paseando con bolso, o simplemente existiendo en el espacio. Ambiente visible y cálido. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['face_visible', 'natural_relaxed_expression', 'environment_clearly_visible', 'authentic_candid_lived_in_feel', 'person_belongs_in_space'],
    forbiddenElements: ['artificial_pose', 'face_not_visible', 'studio_feel', 'beautification', 'environment_neutral_blank'],
    variationSpace: [
      'sentada en terraza de café con bebida, mirando suavemente hacia el frente',
      'de pie mirando una vitrina, media vuelta hacia cámara',
      'caminando por una calle con bolso, mirada suelta y natural',
      'recostada en sillón de casa o sala, libro en mano, expresión calmada'
    ],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - OUTFIT (6 SHOTS)
// "Outfit check real. Try-on haul. Poses con actitud. Sin maniquíes."
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
  const sceneLockNotice = hasScene 
    ? "🔒 MISMA ESCENA que la referencia. NO rediseñar el fondo." 
    : "Fondo real contextual: sala con luz natural, café, calle exterior — NUNCA estudio neutro.";

  // S1: HERO — Full body con actitud real, no maniquí
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: `FULL BODY head-to-toe. Outfit COMPLETO visible. Pose con actitud real: no maniquí, no simétrico. Peso en una cadera, brazo en movimiento o mano en bolsillo, mirada natural. ${sceneLockNotice} 🔒 MISMO OUTFIT.`,
    requiredElements: ['full_body_head_to_toe', 'outfit_complete_visible', 'pose_with_attitude_weight_shifted', 'natural_stance_not_mannequin', 'face_visible_natural'],
    forbiddenElements: ['symmetric_mannequin_stance', 'catalog_posture', 'face_dominant_over_outfit', 'cropped_head_or_feet', 'outfit_any_part_hidden', 'walking_blur'],
    variationSpace: [
      'de pie con peso en cadera derecha, mano en bolsillo, mirada directa y confiada',
      'apoyada levemente en pared con un hombro, brazos cruzados suavemente o sueltos, actitud relajada',
      'full body frontal con brazo levemente alejado del cuerpo, cabeza ligeramente girada',
      'un pie ligeramente cruzado delante del otro, manos en bolsillos o sosteniendo bolso'
    ],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S2: DETAIL — Calzado o textura principal (con narrativa, no macro muerto)
  if (hasShoes) {
    directives.push({
      key: 'S2',
      role: 'DETAIL',
      detailTarget: 'shoe',
      purpose: `Close-up de calzado con narrativa. Ángulo interesante: zapato de costado con tobillo visible, desde arriba con el floor en frame, o sentada con piernas cruzadas mostrando el zapato. 85-90% del frame. ${bottomType === 'shorts' ? 'Outfit tiene shorts: NO inventar pantorrilla ni pantalón largo.' : 'NO inventar tela adicional.'} 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['shoe_dominant_85_90_percent', 'interesting_angle_not_flat_overhead', 'floor_or_leg_context_natural', 'no_invented_garment_above'],
      forbiddenElements: ['flat_overhead_boring_angle', 'face', 'upper_body', 'invented_pant_leg', 'invented_hem', 'fabric_continuation_non_existent'],
      variationSpace: [
        'ángulo lateral bajo (cámara a 15cm del suelo), zapato de perfil con floor visible',
        'sentada con piernas cruzadas, zapato en primer plano, jeans o falda natural de fondo',
        'desde ligeramente arriba con el pie de puntillas mostrando el zapato completo',
        'detalle del zapato sostenido con la mano — dedos visibles tocando el material'
      ],
      framing: 'EXTREME_CLOSE',
      composition: 'EXTREME_CROP',
      exclusion: ['face', 'full_body', 'invented_clothing', 'beautification'],
      intensity: 'extreme'
    });
  } else {
    directives.push({
      key: 'S2',
      role: 'DETAIL',
      detailTarget: fabricType !== 'unknown' ? 'fabric' : 'texture',
      purpose: `Extreme close-up textura de tela con intención. Busca el momento más interesante de la prenda: costuras, dobladillo, punto de botón, material visto de cerca. Luz lateral mostrando textura real. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['texture_detail_fills_85_90_percent', 'interesting_lighting_on_fabric', 'authentic_material_visible', 'no_face', 'no_full_garment_silhouette'],
      forbiddenElements: ['face', 'full_body', 'flat_boring_texture', 'beautification'],
      variationSpace: [
        'detalle de costura lateral con luz rasante mostrando relieve de tela',
        'dobladillo de manga o pantalón en extreme close-up con suelo o mano de fondo',
        'botón o presilla en primer plano con tela desenfocada hacia atrás',
        'tejido o punto con luz lateral revelando textura real del material'
      ],
      framing: 'EXTREME_CLOSE',
      composition: 'EXTREME_CROP',
      exclusion: ['face', 'full_body', 'background', 'beautification', 'editorial_softening'],
      intensity: 'extreme'
    });
  }

  // S3: INTERACTION — Manos tocando/ajustando ropa con vida
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: `Manos con vida interactuando con la ropa: ajustando cuello, alisando manga, tocando tela de la cadera, arreglando cintura. Medium shot. Cara visible y natural. La acción debe verse real y cotidiana, no posada. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
    requiredElements: ['hands_actively_touching_or_adjusting_garment', 'action_looks_natural_not_staged', 'face_visible_natural', 'garment_texture_in_frame'],
    forbiddenElements: ['static_rigid_hands', 'hands_frozen_without_purpose', 'forced_editorial_gesture', 'outfit_not_visible', 'face_not_visible'],
    variationSpace: [
      'manos ajustando el cuello o escote de la prenda con gesto natural',
      'mano pasando por el borde de la manga o puño — acción de ajuste',
      'ambas manos en la cintura alisando la tela ligeramente, cara mirando a cámara',
      'una mano tocando la tela del muslo mientras la otra está suelta, pose relajada'
    ],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S4: LIFESTYLE OUTFIT — Sentada o recostada con actitud, mostrando la ropa en reposo
  directives.push({
    key: 'S4',
    role: 'LIFESTYLE',
    purpose: `Outfit en reposo natural: sentada en sofá, escalera o silla, o apoyada en superficie. La ropa cae naturalmente. Muestra la silueta desde otro ángulo. NO pose de catálogo. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
    requiredElements: ['seated_or_leaning_natural_pose', 'outfit_visible_fabric_drape', 'natural_weight_and_gravity_visible_in_clothing', 'face_visible_natural_relaxed'],
    forbiddenElements: ['catalog_seated_pose', 'stiff_upright_mannequin_seated', 'outfit_hidden', 'face_not_visible'],
    variationSpace: [
      'sentada en sofá con una pierna cruzada, mano en la rodilla, mirando a cámara con expresión calmada',
      'sentada en escalera o escalón exterior con los brazos sobre las rodillas',
      'recostada hacia atrás en sillón mostrando la silueta del outfit de frente',
      'apoyada en una mesa o mostrador, un codo sobre la superficie, outfit natural'
    ],
    framing: 'MEDIUM',
    composition: 'ASYMMETRIC',
    exclusion: ['beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S5: ALT_ANGLE — Full body lateral o de espaldas, silueta completa del outfit
  directives.push({
    key: 'S5',
    role: 'ALT_ANGLE',
    purpose: `Full body desde ángulo SIGNIFICATIVAMENTE diferente a S1. Lateral, tres cuartos, o de espaldas mirando sobre el hombro. Silueta completa visible. La diferencia visual debe ser obvia. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
    requiredElements: ['full_body_head_to_toe', 'angle_clearly_different_from_S1_minimum_45_degrees', 'outfit_complete_silhouette_visible', 'perceptually_different_from_S1'],
    forbiddenElements: ['same_frontal_angle_as_S1', 'micro_angle_variation', 'outfit_hidden_or_cropped', 'face_only_focus'],
    variationSpace: [
      'full body lateral 90 grados — perfil completo del outfit visible',
      'tres cuartos 45 grados — hombro y cadera del outfit en primer plano',
      'de espaldas mirando por encima del hombro hacia la cámara — silueta trasera del outfit',
      'desde ligero ángulo picado, full body del outfit visible con suelo en parte del frame'
    ],
    framing: 'WIDE',
    composition: 'SIDE_ANGLE',
    exclusion: ['frontal_symmetry', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S6: DETAIL — Accesorio principal (bolso, collar, gafas) o selfie POV del outfit
  if (hasBag) {
    directives.push({
      key: 'S6',
      role: 'DETAIL',
      detailTarget: 'bag',
      purpose: `Bolso como protagonista con contexto. NO flat lay aislado. Bolso sostenido con mano visible o colgando del hombro, arm visible, material y color claros. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['bag_dominant_70_80_percent', 'hand_or_arm_visible_holding_or_carrying', 'bag_material_texture_visible', 'context_natural'],
      forbiddenElements: ['isolated_floating_bag', 'flat_lay_no_person', 'full_face_visible', 'outfit_completely_dominant'],
      variationSpace: [
        'mano sosteniendo el bolso por el asa, bolso de costado mostrando su forma completa',
        'bolso colgando del hombro, brazo y parte del torso visible, bolso en primer plano',
        'mano abriendo el bolso — dedos visibles, interior parcialmente visible',
        'bolso apoyado en superficie (mesa, escalón) con manos rodeándolo naturalmente'
      ],
      framing: 'CLOSE_UP',
      composition: 'ASYMMETRIC',
      exclusion: ['face', 'full_body', 'beautification', 'editorial_softening'],
      intensity: 'normal'
    });
  } else if (hasNecklace || (hasAccessories && !hasBag)) {
    const accessoryTarget: DetailTarget = hasNecklace ? 'necklace' : (hasBelt ? 'belt' : 'feature');
    directives.push({
      key: 'S6',
      role: 'DETAIL',
      detailTarget: accessoryTarget,
      purpose: `Close-up del accesorio principal (${accessoryTarget}) en contexto corporal. El accesorio domina el frame pero con una parte del cuerpo como anclaje (cuello, hombro, muñeca). 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['accessory_dominant_75_85_percent', 'body_part_as_natural_anchor', 'accessory_material_visible', 'interesting_light'],
      forbiddenElements: ['full_face', 'full_body', 'accessory_too_small', 'flat_isolated_accessory'],
      variationSpace: [
        'collar visto desde ligero ángulo picado con cuello y escote como contexto',
        'pendiente en primer plano con perfil del oído y cabello de fondo bokeh',
        'muñeca con pulsera sosteniendo algo, accesorio en primer plano',
        'cinturón en primer plano con cadera y tela de fondo suave'
      ],
      framing: 'CLOSE_UP',
      composition: 'EXTREME_CROP',
      exclusion: ['face', 'full_body', 'beautification'],
      intensity: 'normal'
    });
  } else if (hasHat) {
    directives.push({
      key: 'S6',
      role: 'SELFIE',
      purpose: `Selfie POV mostrando el outfit completo desde perspectiva de la persona. Brazo extendido desde abajo, full body parcial visible desde arriba. Outfit y entorno visibles. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['pov_selfie_downward_angle', 'outfit_visible_top_to_partial_bottom', 'arm_extended_visible', 'environment_visible_around'],
      forbiddenElements: ['phone_visible', 'third_person_view', 'face_only_no_outfit', 'beautification'],
      variationSpace: [
        'selfie POV inclinada hacia abajo mostrando outfit desde pecho hacia abajo, calzado visible',
        'selfie desde arriba del hombro mostrando silueta del outfit completa',
        'selfie POV exterior con suelo y outfit visible desde perspectiva personal'
      ],
      framing: 'SELFIE',
      composition: 'ASYMMETRIC',
      exclusion: ['face', 'full_body_mannequin', 'beautification'],
      intensity: 'normal'
    });
  } else {
    directives.push({
      key: 'S6',
      role: 'SELFIE',
      purpose: `Selfie POV del outfit: cámara apuntando hacia abajo desde la perspectiva de la persona, mostrando el outfit desde el pecho hasta los pies. Brazo extendido visible. 🔒 MISMO OUTFIT. ${sceneLockNotice}`,
      requiredElements: ['pov_looking_down_selfie_angle', 'outfit_visible_chest_to_shoes', 'arm_visible', 'natural_environment_around'],
      forbiddenElements: ['phone_visible', 'third_person_view', 'full_face_dominant', 'mannequin_feel'],
      variationSpace: [
        'selfie POV mirando hacia abajo — outfit visible desde pecho hasta zapatos',
        'selfie desde altura de hombro apuntando al outfit completo con fondo real alrededor',
        'POV de alguien mirando su propio outfit — piernas y zapatos visibles desde arriba'
      ],
      framing: 'SELFIE',
      composition: 'ASYMMETRIC',
      exclusion: ['face', 'beautification'],
      intensity: 'normal'
    });
  }

  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - PRODUCTO (6 SHOTS)
// "Review UGC real. El avatar convence al cliente. Producto claro."
// Adaptado por categoría de producto.
// ===================================================================
function buildProductShotDirectives(
  productCategory: ProductCategory,
  productSize?: ProductSize,
  shotCount: number = 6,
  hasOutfit: boolean = false,
  hasScene: boolean = false
): ShotDirective[] {
  const outfitLockNotice = hasOutfit ? "🔒 MISMO OUTFIT que la referencia (secundario, no competir)." : "Outfit casual natural coherente con el producto.";
  const sceneLockNotice = hasScene ? "🔒 MISMA ESCENA que la referencia (contexto de uso real)." : "Ambiente real contextual al producto — NUNCA estudio neutro.";

  // Contextos específicos por categoría para prompts más ricos
  const categoryContext: Record<ProductCategory, { holding: string; using: string; context: string }> = {
    JEWELRY: {
      holding: 'joya sostenida con dedos delicados o puesta en el cuerpo (cuello, muñeca, oreja)',
      using: 'poniendo o ajustando la joya frente a espejo o simplemente luciendo con orgullo',
      context: 'tocador, baño con luz natural, o ambiente cálido íntimo'
    },
    MAKEUP: {
      holding: 'producto sostenido cerca del rostro, labio o mejilla de forma natural',
      using: 'aplicando el producto o mostrando el resultado en el rostro con expresión satisfecha',
      context: 'espejo de baño o vanidad con luz natural, tocador íntimo'
    },
    TECH: {
      holding: 'dispositivo sostenido con naturalidad como si acabara de usarlo',
      using: 'usando activamente el dispositivo o mostrándolo con entusiasmo',
      context: 'escritorio en casa, café moderno, o sofá cómodo'
    },
    SPORTS: {
      holding: 'producto sostenido antes o después de usarlo, en contexto deportivo',
      using: 'usando el producto en actividad o mostrando beneficios con energía',
      context: 'gimnasio, cancha, parque, o espacio deportivo natural'
    },
    FASHION: {
      holding: 'accesorio de moda sostenido o llevado con actitud natural',
      using: 'luciendo el accesorio con outfit completo visible, actitud de estilo',
      context: 'ambiente urbano, boutique, o interior moderno con luz natural'
    },
    HOME: {
      holding: 'objeto del hogar mostrado con contexto del espacio real',
      using: 'usando el objeto en el hogar de manera natural',
      context: 'sala, cocina o espacio donde el objeto vive naturalmente'
    },
    GENERIC: {
      holding: 'producto sostenido de forma natural con una o dos manos',
      using: 'usando o demostrando el producto con emoción positiva',
      context: 'ambiente casual de casa o exterior cotidiano'
    }
  };

  const ctx = categoryContext[productCategory] || categoryContext.GENERIC;
  const directives: ShotDirective[] = [];

  // S1: HERO — Cara + producto, presentación con entusiasmo
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: `Hero review UGC: ${ctx.holding}. Cara visible con expresión positiva y entusiasta. Producto claramente visible (40% frame), cara comprometida (30% frame). Sensación de "te recomiendo esto". ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['product_clearly_visible_40_percent', 'face_expressive_positive_30_percent', 'presenting_or_holding_naturally', 'genuine_enthusiasm_not_forced'],
    forbiddenElements: ['neutral_blank_expression', 'product_hidden_behind_body', 'studio_lighting', 'catalog_pose', 'product_too_small'],
    variationSpace: [
      `sosteniendo ${ctx.holding} a la altura del pecho/hombro, cara al lado sonriendo con entusiasmo`,
      `producto sostenido con ambas manos mostrándolo hacia la cámara, expresión de "mira qué bueno"`,
      `${ctx.holding} cerca de la cara, expresión de orgullo o satisfacción genuina`,
      `sosteniendo producto con una mano, otra mano gesticulando hacia él, cara expresiva`
    ],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S2: INTERACTION — Demostración real de uso (cara + manos + producto)
  directives.push({
    key: 'S2',
    role: 'INTERACTION',
    purpose: `Demostración real de uso: ${ctx.using}. Manos activas, cara visible con expresión positiva. Sensación de "así se usa" o "mira el resultado". ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['hands_actively_using_or_demonstrating_product', 'product_visible_in_use', 'face_visible_positive_expression', 'action_looks_authentic_not_staged'],
    forbiddenElements: ['static_hands_not_doing_anything', 'product_hidden', 'neutral_face', 'forced_unnatural_gesture'],
    variationSpace: [
      `${ctx.using} — expresión de satisfacción real`,
      `manos interactuando con el producto activamente, cara mostrando el proceso con alegría`,
      `demostración del producto en acción, cara de quien confirma que funciona bien`,
      `aplicando, abriendo, encendiendo o usando el producto según su naturaleza — cara expresiva`
    ],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S3: LIFESTYLE — Producto en contexto natural de uso (no demo activa)
  directives.push({
    key: 'S3',
    role: 'LIFESTYLE',
    purpose: `Producto en contexto de vida real: ${ctx.context}. Avatar usando o teniendo el producto de forma natural y relajada, como si fuera su rutina. Ambiente claramente visible. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['product_visible_in_natural_context', 'environment_clearly_visible', 'person_relaxed_authentic', 'scene_context_supports_product'],
    forbiddenElements: ['staged_demo_feel', 'product_hidden', 'neutral_background_only', 'forced_smile'],
    variationSpace: [
      `en ${ctx.context} con el producto a la vista de forma natural, persona relajada`,
      `lifestyle UGC auténtico: persona en su mundo con el producto presente sin exagerar`,
      `momento cotidiano donde el producto aparece de forma orgánica y creíble`,
      `sentada o de pie en ${ctx.context}, producto visible, expresión natural de quien disfruta`
    ],
    framing: 'WIDE',
    composition: 'ASYMMETRIC',
    exclusion: ['beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S4: SELFIE — Selfie real sosteniendo o mostrando el producto
  directives.push({
    key: 'S4',
    role: 'SELFIE',
    purpose: `Selfie UGC real: brazo extendido implícito, cara cercana, producto visible en frame. Sin teléfono. Sensación de alguien compartiendo su compra en Instagram stories. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['selfie_pov_arm_length', 'face_dominant_close', 'product_visible_in_frame', 'no_phone_visible', 'handheld_organic_feel'],
    forbiddenElements: ['phone_visible', 'third_person_portrait', 'product_completely_hidden', 'studio_lighting', 'professional_framing'],
    variationSpace: [
      'selfie cercana con el producto sostenido al lado de la cara, sonrisa natural',
      'selfie con el producto en primer plano y cara detrás expresiva',
      'selfie mostrando el producto sostenido frente a sí, cara visible lateral',
      'selfie estilo stories: cara y producto, expresión de quien comparte algo que le gusta'
    ],
    framing: 'SELFIE',
    composition: 'ASYMMETRIC',
    exclusion: ['full_body', 'third_person_perspective', 'beautification'],
    intensity: 'normal'
  });

  // S5: EXPRESSION — Emoción hacia el producto, cara dominante
  directives.push({
    key: 'S5',
    role: 'EXPRESSION',
    purpose: `Close-up facial mostrando la EMOCIÓN real hacia el producto. Cara llena 70-80% del frame. Producto parcialmente visible al borde. Expresión claramente diferente a los otros shots. ${outfitLockNotice} ${sceneLockNotice}`,
    requiredElements: ['face_fills_70_80_percent', 'clear_genuine_emotion_towards_product', 'product_partially_visible_edge_of_frame', 'expression_different_from_other_shots'],
    forbiddenElements: ['neutral_blank_expression', 'product_completely_hidden', 'tiny_face', 'beautification', 'editorial_softening'],
    variationSpace: [
      'sorpresa genuina positiva — cejas levantadas, expresión de "wow"',
      'satisfacción obvia — sonrisa con sentido, ojos expresivos',
      'entusiasmo contenido — sonrisa amplia, cara de quien recomienda con convicción',
      'emoción al ver/tocar el producto — reacción auténtica de genuina aprobación'
    ],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['background', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S6: DETAIL del producto — Macro/close del producto sin persona
  // (Único shot sin persona, pero justificado: muestra el producto solo como en un unboxing/review)
  directives.push({
    key: 'S6',
    role: 'DETAIL',
    detailTarget: 'feature',
    purpose: `Detalle visual del producto solo: textura, material, logo, apertura, mecanismo, packaging. Producto como objeto deseado. Ángulo elegante que resalte su calidad. Fondo real contextual, no neutro de estudio. ${sceneLockNotice}`,
    requiredElements: ['product_fills_80_90_percent', 'product_texture_or_detail_visible', 'interesting_angle_not_flat', 'natural_real_background_context'],
    forbiddenElements: ['person_visible', 'ugly_flat_boring_angle', 'studio_white_background', 'poor_lighting'],
    variationSpace: [
      'ángulo 45 grados mostrando el volumen del producto con luz lateral natural',
      'macro de la textura, material o logo del producto — detalles en primer plano',
      'producto sobre la superficie del contexto real (mesa, cama, escritorio)',
      'apertura o mecanismo del producto en acción — detalle funcional atractivo'
    ],
    framing: 'EXTREME_CLOSE',
    composition: 'EXTREME_CROP',
    exclusion: ['face', 'full_body', 'beautification', 'editorial_softening'],
    intensity: 'extreme'
  });

  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - ESCENA (6 SHOTS)
// "El avatar PERTENECE al lugar. Luz compartida. No compositing."
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
  const hasFurniture = sceneAnalysis?.hasFurniture || false;
  const hasWindows = sceneAnalysis?.hasWindows || false;
  const sceneType = sceneAnalysis?.sceneType || 'generic';
  const outfitLockNotice = hasOutfit ? "🔒 MISMO OUTFIT que la referencia (secundario)." : "Outfit casual coherente con la escena, nunca estudio.";

  // Determinar tipo de interacción dominante basado en el análisis
  let primaryInteraction = 'explorando el espacio con curiosidad';
  let secondaryInteraction = 'disfrutando del lugar en reposo';
  if (hasTable && hasSeating) {
    primaryInteraction = 'sentada en la mesa, disfrutando de una bebida o comida';
    secondaryInteraction = 'interactuando con algo sobre la mesa';
  } else if (hasSeating) {
    primaryInteraction = 'sentada cómodamente, integrada al espacio';
    secondaryInteraction = 'apoyada o recostada en el mobiliario';
  } else if (hasNature) {
    primaryInteraction = 'en medio del entorno natural, rodeada de elementos del lugar';
    secondaryInteraction = 'tocando o interactuando con elementos naturales';
  } else if (hasEquipment) {
    primaryInteraction = 'usando o interactuando con el equipamiento del lugar';
    secondaryInteraction = 'observando o demostrando el equipo';
  }

  const directives: ShotDirective[] = [];

  // S1: WIDE CONTEXT — El lugar domina, persona pequeña pero INTEGRADA (no pegada)
  directives.push({
    key: 'S1',
    role: 'CONTEXT',
    purpose: `Lugar PROTAGONISTA. Wide shot: escena ocupa 65-75% del frame. Persona visible (25-35%) pero INTEGRADA al espacio: misma luz, mismas sombras, perspectiva consistente. La persona PERTENECE al lugar, no está pegada sobre él. ${outfitLockNotice}`,
    requiredElements: ['environment_dominant_65_75_percent', 'person_integrated_with_correct_lighting', 'person_casts_shadow_on_scene', 'perspective_consistent_person_scene', 'wide_shot_establishing', 'place_beautiful_or_distinctive'],
    forbiddenElements: ['person_dominant_over_scene', 'person_floating_over_background', 'lighting_inconsistency_person_vs_scene', 'photomontage_compositing_feel', 'ugly_scene', 'scene_hidden'],
    variationSpace: [
      `wide shot del lugar con la persona pequeña ${primaryInteraction}, perspectiva coherente`,
      `vista amplia estableciendo el espacio, persona como visitante natural integrada a la luz del lugar`,
      `encuadre amplio que muestra la belleza del lugar, persona en escala humana real dentro del espacio`,
      `full scene dominando, persona en tercio inferior/lateral del frame, parte natural del ambiente`
    ],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['product', 'beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  // S2: LIFESTYLE EN LUGAR — Persona viviendo el espacio, integrada, cara visible
  directives.push({
    key: 'S2',
    role: 'LIFESTYLE',
    purpose: `Avatar VIVIENDO el lugar de forma auténtica: ${primaryInteraction}. Persona ocupa 40-50% del frame. Cara visible con expresión de disfrute real. MISMA luz del lugar en la persona. Espacio visible alrededor. ${outfitLockNotice}`,
    requiredElements: ['person_40_50_percent', 'scene_40_50_percent_around_person', 'face_visible_enjoying', 'consistent_lighting_person_scene', 'person_doing_something_natural_in_space'],
    forbiddenElements: ['person_floating_pasted_on_background', 'artificial_pose_disconnected_from_space', 'different_lighting_on_person_vs_scene', 'scene_not_visible', 'static_mannequin_in_front_of_backdrop'],
    variationSpace: [
      `${primaryInteraction} — cara con expresión cálida de disfrute`,
      `persona disfrutando del lugar con la misma luz ambiental del espacio en su piel`,
      `${secondaryInteraction} — pose natural y relajada integrada al espacio`,
      `persona en el lugar como si fuera su ambiente habitual, cara expresa disfrute auténtico`
    ],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  // S3: INTERACTION FÍSICA — Manos tocando algo específico del lugar
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: `Avatar tocando/usando algo ESPECÍFICO del lugar (copa, plato, flor, libro, manija, producto del local). La interacción ANCLA a la persona en el espacio: misma escala, misma luz, sombras coherentes. Cara visible y comprometida. ${outfitLockNotice}`,
    requiredElements: ['hands_touching_specific_element_of_place', 'element_clearly_identifiable_as_part_of_scene', 'face_visible_engaged', 'correct_scale_person_vs_element', 'consistent_lighting'],
    forbiddenElements: ['hands_touching_generic_prop_not_from_scene', 'floating_person_with_pasted_hands', 'artificial_scale', 'lighting_mismatch', 'place_not_visible'],
    variationSpace: [
      hasTable ? 'manos sosteniendo taza o copa con el logo/ambiente del lugar visible' : `manos tocando elemento característico del lugar — ${primaryInteraction}`,
      hasNature ? 'manos tocando hoja, flor o elemento natural del entorno' : 'manos ajustando o interactuando con algo del local',
      `acción específica de ${primaryInteraction} — manos activas, cara expresiva y comprometida`,
      `interacción auténtica con objeto del lugar, perspectiva y escala correctas`
    ],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  // S4: EXPRESSION EN EL LUGAR — Close-up cara con hint del ambiente
  // CAMBIO CLAVE: persona siempre visible, no eliminar persona en S4
  directives.push({
    key: 'S4',
    role: 'EXPRESSION',
    purpose: `Close-up facial de la EMOCIÓN de vivir el lugar. Cara llena 60-70% del frame. SIEMPRE con hint del ambiente del lugar visible alrededor (bokeh del lugar, luz específica del lugar). La luz del ambiente TIÑE la cara. Expresión de disfrute/asombro/satisfacción genuina. ${outfitLockNotice}`,
    requiredElements: ['face_fills_60_70_percent', 'scene_ambient_light_visible_on_face', 'environment_hint_visible_bokeh_or_partial', 'authentic_emotion_enjoying_place', 'no_studio_light_only_scene_ambient'],
    forbiddenElements: ['completely_dark_or_neutral_background', 'studio_lighting_ignoring_scene', 'neutral_blank_expression', 'scene_completely_invisible'],
    variationSpace: [
      'cara iluminada por la luz específica del lugar, expresión de asombro o deleite',
      'close-up facial con bokeh del ambiente del lugar atrás, emoción de satisfacción real',
      'cara mostrando reacción genuina al lugar: sorpresa, placer, relajación profunda',
      'expresión íntima de alguien que disfruta genuinamente del espacio que habita'
    ],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  // S5: DETALLE DEL LUGAR — Elemento hermoso o característico del espacio
  // CAMBIO: persona parcialmente en frame para anclaje, no solo el elemento solo
  directives.push({
    key: 'S5',
    role: 'DETAIL',
    detailTarget: 'feature',
    purpose: `Detalle hermoso o característico del lugar. El elemento del lugar domina (70-80%) pero con un fragmento del avatar como anclaje: mano, brazo, hombro — que muestra que la persona ESTÁ en ese lugar y comparte su luz. ${outfitLockNotice}`,
    requiredElements: ['place_detail_dominant_70_80_percent', 'partial_person_as_anchor_hand_or_arm', 'person_fragment_shares_same_light_as_detail', 'detail_beautiful_or_distinctive', 'interesting_angle'],
    forbiddenElements: ['isolated_detail_without_person_anchor', 'full_face_visible', 'full_body', 'lighting_mismatch_between_person_and_detail', 'ugly_or_banal_detail'],
    variationSpace: [
      hasTable ? 'plato o copa del lugar en primer plano, mano de la persona rozándolo suavemente, mismo ambiente de luz' : 'elemento arquitectónico o decorativo del lugar con mano/brazo como contexto humano',
      hasNature ? 'elemento natural del lugar (flor, hoja, agua) con fragmento de la persona compartiendo la luz' : 'detalle del local/espacio con anclaje de presencia humana',
      `detalle característico del lugar con brazo o mano visible como testigo — perspectiva auténtica`,
      `elemento que hace especial al lugar, con presencia humana mínima pero real y anclada`
    ],
    framing: 'CLOSE_UP',
    composition: 'ASYMMETRIC',
    exclusion: ['full_body', 'beautification', 'editorial_softening'],
    intensity: 'normal'
  });

  // S6: ALT_ANGLE DEL LUGAR — Nueva perspectiva del espacio, persona visible
  directives.push({
    key: 'S6',
    role: 'ALT_ANGLE',
    purpose: `MISMO lugar desde ángulo SIGNIFICATIVAMENTE diferente al S1. Wide shot nueva perspectiva: picado, contrapicado, lateral opuesto, rincón diferente. Persona visible (20-30%), integrada con la luz del espacio. ${outfitLockNotice}`,
    requiredElements: ['angle_clearly_different_from_S1', 'environment_dominant', 'wide_shot', 'person_visible_integrated_correct_scale', 'new_perspective_of_same_place'],
    forbiddenElements: ['same_angle_as_S1', 'person_floating_pasted', 'environment_not_recognizable', 'lighting_mismatch'],
    variationSpace: [
      'desde ángulo opuesto del S1, mismo espacio, nueva perspectiva — persona pequeña integrada',
      'picado desde arriba del lugar, persona visible abajo en escala real y correcta',
      'lateral del lugar desde un rincón diferente al S1, persona al fondo con la luz del lugar',
      'contrapicado si es posible, lugar dominando desde abajo, persona en escala natural'
    ],
    framing: 'WIDE',
    composition: 'SIDE_ANGLE',
    exclusion: ['beautification', 'editorial_softening', 'luxury_redesign'],
    intensity: 'normal'
  });

  return directives.slice(0, shotCount);
}

// ===================================================================
// INTERFACE RESULTADO DEL PLAN
// ===================================================================
interface UGCSessionPlan {
  sessionTheme: string;
  productCategory: ProductCategory;
  shots: ShotDirective[];
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
  } else if (focus === 'OUTFIT') {
    // Outfit sin referencia — usar defaults razonables
    directives = buildOutfitShotDirectives({
      hasShoes: true, hasPants: true, hasShoes: true, hasAccessories: false,
      hasDetail: true, fabricType: 'unknown', colors: [], hasTop: true,
      hasBottom: true, hasBelt: false, hasBag: false, hasHat: false,
      hasNecklace: false, bottomType: 'unknown'
    }, productIsRelevant || false, 'complement', shotCount, hasScene);
  } else if (focus === 'PRODUCT') {
    directives = buildProductShotDirectives(productCategory, productSize, shotCount, hasOutfit, hasScene);
  } else if (focus === 'SCENE') {
    if (refs?.sceneRef) {
      sceneAnalysis = await analyzeSceneReference(refs.sceneRef);
    }
    directives = buildSceneShotDirectives(sceneAnalysis, productIsRelevant || false, shotCount, hasOutfit);
  }
  
  // Fallback por si algún enfoque produce menos de 6 shots
  while (directives.length < shotCount) {
    directives.push({
      key: `S${directives.length + 1}` as ShotKey,
      role: 'LIFESTYLE',
      purpose: `Shot adicional — ${focus} de forma natural y auténtica, persona en ambiente real`,
      requiredElements: ['natural_pose', 'focus_visible', 'real_environment'],
      forbiddenElements: ['artificial_composition', 'beautification', 'editorial_softening', 'studio_backdrop'],
      variationSpace: ['postura relajada en ambiente real', 'ángulo natural con contexto visible'],
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