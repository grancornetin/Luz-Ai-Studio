import { GoogleGenAI } from "@google/genai";
import { 
  Focus, ShotKey, ProductSize, ProductCategory, 
  ShotDirective, ShotRole, ShotFraming, ShotComposition, ShotExclusion,
  CATEGORY_LABELS 
} from './types';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface UGCSessionPlan {
  sessionTheme: string;
  productCategory?: ProductCategory;
  shots: ShotDirective[];
}

function cleanBase64(b64: string): string {
  if (!b64) return "";
  return b64.replace(/^data:image\/(png|jpeg|webp);base64,/, "").replace(/\s/g, "");
}

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
  
  const ai = getAI();
  const parts: any[] = [];
  
  parts.push({ text: "PRODUCT IMAGE:" });
  parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanBase64(productRef) } });
  
  if (focus === 'OUTFIT' && outfitRef) {
    parts.push({ text: "OUTFIT REFERENCE:" });
    parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanBase64(outfitRef) } });
  }
  
  if (focus === 'SCENE' && sceneRef) {
    parts.push({ text: "SCENE REFERENCE:" });
    parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanBase64(sceneRef) } });
  }
  
  const contextText = sceneText ? `Scene description: ${sceneText}` : '';
  
  const directive = `
You are analyzing if a product/object is relevant to a ${focus.toUpperCase()} context.

${focus === 'OUTFIT' ? `
OUTFIT CONTEXT:
Determine if this product is a COMPLEMENT to the outfit:
- YES if it is: jewelry, bag, belt, hat, scarf, shoes, or any accessory
- NO if it is: electronics, food/drink, tools, or anything not meant to be worn
` : focus === 'SCENE' ? `
SCENE CONTEXT:
Determine if this product/object is RELEVANT to the scene:
- YES if it naturally belongs in this environment
- NO if it feels out of place
` : ''}

${contextText}

Respond ONLY with JSON:
{
  "isRelevant": boolean,
  "suggestion": "brief explanation",
  "productType": "jewelry|accessory|clothing|electronics|food|sports|home|other"
}`;

  parts.push({ text: directive });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: { responseMimeType: "application/json" }
    });

    const raw = (response as any)?.text ??
                (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.warn("[UGC Director] Error analyzing product relevance:", e);
    return { isRelevant: false, suggestion: "Could not determine", productType: "other" };
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

  const ai = getAI();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: "Analyze this outfit image. Respond ONLY with JSON." },
        { inlineData: { mimeType: "image/jpeg", data: cleanBase64(outfitRef) } },
        { text: `{
  "hasJacket": boolean,
  "hasPants": boolean,
  "hasShoes": boolean,
  "hasAccessories": boolean,
  "hasDetail": boolean,
  "fabricType": string,
  "colors": string[],
  "hasTop": boolean,
  "hasBottom": boolean,
  "hasBelt": boolean,
  "hasBag": boolean,
  "hasHat": boolean,
  "hasNecklace": boolean
}` }
      ],
      config: { responseMimeType: "application/json" }
    });

    const raw = (response as any)?.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
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

  const ai = getAI();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: "Analyze this scene. Respond ONLY with JSON." },
        { inlineData: { mimeType: "image/jpeg", data: cleanBase64(sceneRef) } },
        { text: `{
  "hasFurniture": boolean,
  "hasNature": boolean,
  "hasEquipment": boolean,
  "hasTable": boolean,
  "hasSeating": boolean,
  "hasWindows": boolean,
  "hasProps": boolean,
  "sceneType": string
}` }
      ],
      config: { responseMimeType: "application/json" }
    });
    const raw = (response as any)?.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
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
// SHOT PLAN - OUTFIT (6 SHOTS)
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
  
  // S1: HERO - outfit completo dominante
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: 'Mostrar el outfit completo de forma dominante y clara',
    requiredElements: ['full_body', 'outfit_visible', 'clean_composition'],
    forbiddenElements: ['close_up_crop', 'dominant_background', 'dominant_accessory'],
    variationSpace: ['pose_libera', 'frontal_o_tres_cuartos'],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['environment_dominance', 'irrelevant_objects'],
    intensity: 'normal'
  });
  
  // S2: DETAIL - extreme close-up de textura
  directives.push({
    key: 'S2',
    role: 'DETAIL',
    purpose: 'Extreme close-up de textura o material de la prenda',
    requiredElements: ['detail_fills_80_90_percent', 'texture_visible'],
    forbiddenElements: ['face', 'full_body', 'medium_framing'],
    variationSpace: ['acercamiento_agresivo', 'cualquier_textura'],
    framing: 'EXTREME_CLOSE',
    composition: 'EXTREME_CROP',
    exclusion: ['face', 'full_body', 'background', 'irrelevant_objects'],
    intensity: 'extreme'
  });
  
  // S3: INTERACTION - manos interactuando
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: 'Mostrar interacción natural con el outfit (ajustar, tocar)',
    requiredElements: ['hands_on_clothing', 'clear_action'],
    forbiddenElements: ['static_pose', 'no_interaction'],
    variationSpace: ['manos_ajustando', 'gesto_natural'],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['environment_dominance'],
    intensity: 'normal'
  });
  
  // S4: LIFESTYLE - contexto natural
  directives.push({
    key: 'S4',
    role: 'LIFESTYLE',
    purpose: 'Mostrar el outfit en un contexto natural y auténtico',
    requiredElements: ['natural_pose', 'context_visible'],
    forbiddenElements: ['walking_simulation', 'artificial_movement'],
    variationSpace: ['mirada_alternativa', 'postura_relajada'],
    framing: 'MEDIUM',
    composition: 'ASYMMETRIC',
    exclusion: ['irrelevant_objects'],
    intensity: 'normal'
  });
  
  // S5: ALT_ANGLE - ángulo diferente
  directives.push({
    key: 'S5',
    role: 'ALT_ANGLE',
    purpose: 'Mostrar outfit desde ángulo lateral o diferente',
    requiredElements: ['different_angle', 'outfit_visible'],
    forbiddenElements: ['frontal_symmetry', 'eye_level'],
    variationSpace: ['lateral', 'tres_cuartos'],
    framing: 'MEDIUM',
    composition: 'SIDE_ANGLE',
    exclusion: ['frontal_symmetry'],
    intensity: 'normal'
  });
  
  // S6: DETAIL o ACCESSORY - segundo detalle o accesorio
  if (hasShoes) {
    directives.push({
      key: 'S6',
      role: 'DETAIL',
      purpose: 'Extreme close-up de calzado y parte inferior',
      requiredElements: ['shoes_visible', 'detail_fills_frame'],
      forbiddenElements: ['face', 'upper_body'],
      variationSpace: ['angulo_bajo', 'crop_agresivo'],
      framing: 'EXTREME_CLOSE',
      composition: 'LOW_ANGLE',
      exclusion: ['face', 'environment_dominance'],
      intensity: 'extreme'
    });
  } else if (hasNecklace || hasBag || hasBelt || hasHat) {
    let accessoryText = '';
    if (hasNecklace) accessoryText = 'necklace';
    else if (hasBag) accessoryText = 'bag';
    else if (hasBelt) accessoryText = 'belt';
    else if (hasHat) accessoryText = 'hat';
    
    directives.push({
      key: 'S6',
      role: 'DETAIL',
      purpose: `Extreme close-up de ${accessoryText} como complemento`,
      requiredElements: ['accessory_visible', 'detail_fills_frame'],
      forbiddenElements: ['face_dominant', 'full_body'],
      variationSpace: ['crop_extremo', 'angulo_variable'],
      framing: 'EXTREME_CLOSE',
      composition: 'EXTREME_CROP',
      exclusion: ['face', 'full_body', 'background'],
      intensity: 'extreme'
    });
  } else {
    directives.push({
      key: 'S6',
      role: 'ALT_ANGLE',
      purpose: 'Mostrar outfit desde ángulo superior',
      requiredElements: ['different_angle', 'outfit_visible'],
      forbiddenElements: ['frontal_symmetry', 'eye_level'],
      variationSpace: ['angulo_picado'],
      framing: 'MEDIUM',
      composition: 'HIGH_ANGLE',
      exclusion: ['frontal_symmetry'],
      intensity: 'normal'
    });
  }
  
  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - AVATAR (6 SHOTS - CON SELFIE OBLIGATORIA)
// ===================================================================
function buildAvatarShotDirectives(shotCount: number = 6, hasProduct: boolean = false): ShotDirective[] {
  const directives: ShotDirective[] = [];
  
  // S1: HERO - retrato principal medio cuerpo, cara dominante
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: 'Retrato principal de influencer, rostro claro, composición limpia, medio cuerpo',
    requiredElements: ['face_clear', 'clean_composition', 'waist_up_framing'],
    forbiddenElements: ['outfit_dominance', 'extreme_crop', 'full_body_wide'],
    variationSpace: ['expresion_natural', 'composicion_centrada'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance'],
    intensity: 'normal'
  });
  
  // S2: SELFIE - OBLIGATORIO
  directives.push({
    key: 'S2',
    role: 'SELFIE',
    purpose: 'Selfie estilo UGC auténtico como lo haría un influencer real',
    requiredElements: ['arm_visible', 'close_camera', 'handheld_feel'],
    forbiddenElements: ['studio_composition', 'third_person_perspective', 'full_body'],
    variationSpace: ['encuadre_cercano', 'asimetria_natural', 'imperfeccion_permitida'],
    framing: 'SELFIE',
    composition: 'ASYMMETRIC',
    exclusion: ['full_body'],
    intensity: 'normal'
  });
  
  // S3: EXPRESSION - sonrisa cálida
  directives.push({
    key: 'S3',
    role: 'EXPRESSION',
    purpose: 'Close-up facial con expresión cálida y auténtica, como foto de perfil de Instagram',
    requiredElements: ['face_fills_70_80_percent', 'clear_expression', 'warm_smile'],
    forbiddenElements: ['subtle_micro_expression', 'same_as_other_shots'],
    variationSpace: ['sonrisa_suave', 'expresion_autentica'],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['background'],
    intensity: 'normal'
  });
  
  // S4: INTERACTION - con producto si existe, si no gesto natural
  directives.push({
    key: 'S4',
    role: 'INTERACTION',
    purpose: hasProduct 
      ? 'Interacción natural con el producto, como influencer mostrándolo a su audiencia'
      : 'Gesto natural con manos (tocar pelo, ajustar collar, mano en mentón)',
    requiredElements: hasProduct 
      ? ['hands_on_product', 'face_visible', 'natural_showing_gesture']
      : ['hands_visible', 'natural_gesture'],
    forbiddenElements: ['static_pose', 'no_interaction', 'walking_simulation'],
    variationSpace: hasProduct
      ? ['mostrando_producto', 'sosteniendo_producto', 'presentando_producto']
      : ['mano_en_menton', 'tocando_pelo', 'ajustando_collar'],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: ['background_dominance'],
    intensity: 'normal'
  });
  
  // S5: EXPRESSION - segunda expresión (confiada o pensativa)
  directives.push({
    key: 'S5',
    role: 'EXPRESSION',
    purpose: 'Expresión diferente: confiada, directa, o pensativa. Como otra foto del carrusel de Instagram',
    requiredElements: ['face_fills_70_80_percent', 'different_expression'],
    forbiddenElements: ['same_as_S3', 'micro_expression'],
    variationSpace: ['confiada', 'pensativa', 'mirada_alternativa'],
    framing: 'CLOSE_UP',
    composition: 'THREE_QUARTERS',
    exclusion: ['background'],
    intensity: 'normal'
  });
  
  // S6: LIFESTYLE - persona en contexto, con producto visible si existe
  directives.push({
    key: 'S6',
    role: 'LIFESTYLE',
    purpose: hasProduct
      ? 'Persona en contexto natural con el producto visible, como post de colaboración con marca'
      : 'Persona en contexto natural, sin poses forzadas, como foto candid de Instagram',
    requiredElements: hasProduct
      ? ['natural_context', 'product_visible', 'authentic_moment']
      : ['natural_context', 'authentic_moment'],
    forbiddenElements: ['walking_simulation', 'artificial_movement'],
    variationSpace: ['postura_relajada', 'contexto_visible'],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['environment_dominance'],
    intensity: 'normal'
  });
  
  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - PRODUCTO (4 o 6 SHOTS)
// ===================================================================
function buildProductShotDirectives(
  productCategory: ProductCategory,
  productSize?: ProductSize,
  shotCount: number = 6
): ShotDirective[] {
  
  const directives: ShotDirective[] = [];
  
  // S1: HERO - avatar presentando el producto, ambos visibles
  directives.push({
    key: 'S1',
    role: 'HERO',
    purpose: 'Avatar presentando el producto como un influencer haciendo review. Producto y cara visibles.',
    requiredElements: ['product_visible', 'product_dominant', 'face_visible', 'presenting_gesture'],
    forbiddenElements: ['background_dominant', 'face_cropped_out'],
    variationSpace: ['producto_en_mano', 'mostrando_a_camara'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance'],
    intensity: 'normal'
  });
  
  // S2: DETAIL - extreme close-up del producto
  directives.push({
    key: 'S2',
    role: 'DETAIL',
    purpose: 'Extreme close-up de textura, material o característica única del producto',
    requiredElements: ['detail_fills_80_90_percent', 'texture_visible'],
    forbiddenElements: ['face', 'full_body', 'medium_framing'],
    variationSpace: ['macro_detail', 'shallow_depth'],
    framing: 'EXTREME_CLOSE',
    composition: 'EXTREME_CROP',
    exclusion: ['face', 'full_body', 'background', 'irrelevant_objects'],
    intensity: 'extreme'
  });
  
  // S3: INTERACTION - manos tocando/usando el producto, cara visible
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: 'Avatar usando o demostrando el producto activamente, como en un review real. Cara con expresión de satisfacción.',
    requiredElements: ['hands_on_product', 'demonstration_action', 'face_visible', 'positive_expression'],
    forbiddenElements: ['static_pose', 'no_interaction', 'face_hidden'],
    variationSpace: ['manos_usando', 'demostrando_producto', 'reaccion_positiva'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: ['environment_dominance'],
    intensity: 'normal'
  });
  
  // S4: LIFESTYLE - producto en contexto real, avatar disfrutándolo
  directives.push({
    key: 'S4',
    role: 'LIFESTYLE',
    purpose: 'Avatar con el producto en un contexto natural y cotidiano, como post orgánico de uso real',
    requiredElements: ['context_visible', 'product_in_use', 'person_visible', 'natural_setting'],
    forbiddenElements: ['studio_background', 'artificial_setting', 'walking_simulation'],
    variationSpace: ['contexto_natural', 'uso_cotidiano'],
    framing: 'WIDE',
    composition: 'ASYMMETRIC',
    exclusion: [],
    intensity: 'normal'
  });
  
  // S5: EXPRESSION - cara de satisfacción/emoción con producto parcialmente visible
  directives.push({
    key: 'S5',
    role: 'EXPRESSION',
    purpose: 'Close-up del avatar con expresión de satisfacción o emoción hacia el producto, como reacción de unboxing',
    requiredElements: ['face_fills_70_80_percent', 'positive_emotion', 'product_partially_visible'],
    forbiddenElements: ['neutral_expression', 'product_hidden_completely'],
    variationSpace: ['sorpresa_positiva', 'satisfaccion', 'emocion_genuina'],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: ['background'],
    intensity: 'normal'
  });
  
  // S6: ALT_ANGLE - producto desde ángulo diferente con avatar
  directives.push({
    key: 'S6',
    role: 'ALT_ANGLE',
    purpose: 'Producto desde ángulo diferente, avatar visible, como segundo ángulo de un review',
    requiredElements: ['different_angle', 'product_visible', 'person_visible'],
    forbiddenElements: ['same_angle_as_hero'],
    variationSpace: ['lateral', 'tres_cuartos', 'sobre_hombro'],
    framing: 'MEDIUM',
    composition: 'SIDE_ANGLE',
    exclusion: ['frontal_symmetry'],
    intensity: 'normal'
  });
  
  return directives.slice(0, shotCount);
}

// ===================================================================
// SHOT PLAN - ESCENA (4 SHOTS)
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
    purpose: 'Mostrar el espacio completo, como la primera foto de una review de un lugar. Avatar visible pero el espacio domina.',
    requiredElements: ['environment_full_view', 'space_dominant', 'person_visible_30_percent'],
    forbiddenElements: ['person_dominant', 'product_dominant'],
    variationSpace: ['angulo_establecimiento', 'vista_completa'],
    framing: 'WIDE',
    composition: 'FULL_BODY_CENTERED',
    exclusion: ['product'],
    intensity: 'normal'
  });
  
  // S2: LIFESTYLE - avatar viviendo el espacio
  directives.push({
    key: 'S2',
    role: 'LIFESTYLE',
    purpose: `Avatar ${interactionType} en el espacio, como si estuviera disfrutando el lugar. Foto natural tipo review.`,
    requiredElements: ['person_in_space', 'natural_interaction', 'person_occupies_40_percent', 'face_visible'],
    forbiddenElements: ['static_pose', 'artificial_movement', 'walking_simulation'],
    variationSpace: ['sentado', 'de_pie_relajado', 'apoyado'],
    framing: 'MEDIUM',
    composition: 'EYE_LEVEL',
    exclusion: [],
    intensity: 'normal'
  });
  
  // S3: INTERACTION - avatar interactuando con elementos del lugar
  directives.push({
    key: 'S3',
    role: 'INTERACTION',
    purpose: 'Avatar interactuando con un elemento del espacio (menú, bebida, objeto del lugar). Como foto de experiencia.',
    requiredElements: ['hands_interacting', 'scene_element_visible', 'face_visible', 'natural_action'],
    forbiddenElements: ['static_pose', 'no_interaction'],
    variationSpace: ['tocando_elemento', 'usando_servicio', 'disfrutando_comida'],
    framing: 'MEDIUM',
    composition: 'THREE_QUARTERS',
    exclusion: [],
    intensity: 'normal'
  });
  
  // S4: DETAIL - detalle del espacio/decoración/comida
  directives.push({
    key: 'S4',
    role: 'DETAIL',
    purpose: 'Close-up de un detalle atractivo del lugar: decoración, comida, textura, detalle arquitectónico.',
    requiredElements: ['environment_detail', 'attractive_element'],
    forbiddenElements: ['face_dominant', 'full_body'],
    variationSpace: ['decoracion', 'comida', 'textura_del_lugar'],
    framing: 'CLOSE_UP',
    composition: 'ASYMMETRIC',
    exclusion: ['face', 'full_body'],
    intensity: 'normal'
  });
  
  // S5: EXPRESSION - avatar disfrutando, reacción al lugar
  directives.push({
    key: 'S5',
    role: 'EXPRESSION',
    purpose: 'Close-up del avatar con expresión de disfrute o satisfacción en el lugar. Como selfie de experiencia.',
    requiredElements: ['face_fills_70_80_percent', 'positive_expression', 'environment_hint_visible'],
    forbiddenElements: ['neutral_expression', 'environment_hidden'],
    variationSpace: ['disfrutando', 'satisfecho', 'impresionado'],
    framing: 'CLOSE_UP',
    composition: 'EYE_LEVEL',
    exclusion: [],
    intensity: 'normal'
  });
  
  // S6: ALT_ANGLE - perspectiva diferente del espacio con avatar
  directives.push({
    key: 'S6',
    role: 'ALT_ANGLE',
    purpose: 'Ángulo diferente del espacio, avatar visible, como segunda foto panorámica de la review.',
    requiredElements: ['different_angle', 'environment_visible', 'person_visible'],
    forbiddenElements: ['same_angle_as_S1'],
    variationSpace: ['lateral', 'contrapicado', 'picado'],
    framing: 'WIDE',
    composition: 'SIDE_ANGLE',
    exclusion: [],
    intensity: 'normal'
  });
  
  return directives.slice(0, shotCount);
}

// ===================================================================
// DIRECTOR PRINCIPAL
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
  
  if (focus === 'OUTFIT' && refs?.outfitRef) {
    outfitAnalysis = await analyzeOutfitReference(refs.outfitRef);
    directives = buildOutfitShotDirectives(outfitAnalysis, productIsRelevant || false, 'complement', shotCount);
  } else if (focus === 'AVATAR') {
    directives = buildAvatarShotDirectives(shotCount, !!(refs?.productRef));
  } else if (focus === 'PRODUCT') {
    directives = buildProductShotDirectives(productCategory, productSize, shotCount);
  } else if (focus === 'SCENE') {
    if (refs?.sceneRef) {
      sceneAnalysis = await analyzeSceneReference(refs.sceneRef);
    }
    directives = buildSceneShotDirectives(sceneAnalysis, productIsRelevant || false, shotCount);
  }
  
  // Asegurar número correcto de shots
  while (directives.length < shotCount) {
    directives.push({
      key: `S${directives.length + 1}` as ShotKey,
      role: 'LIFESTYLE',
      purpose: `Mostrar ${focus} de forma natural y auténtica`,
      requiredElements: ['natural_pose', 'focus_visible'],
      forbiddenElements: ['artificial_composition'],
      variationSpace: ['postura_relajada', 'angulo_natural'],
      framing: 'MEDIUM',
      composition: 'EYE_LEVEL',
      exclusion: [],
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