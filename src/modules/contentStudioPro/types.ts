export type Focus = 'AVATAR' | 'PRODUCT' | 'OUTFIT' | 'SCENE';
export type Style = 'UGC_PREMIUM' | 'STUDIO_PRO';
export type ShotStatus = 'idle' | 'generating' | 'done' | 'error';
export type ShotKey = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
export type ProductSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export type ProductCategory = 
  | 'JEWELRY'
  | 'MAKEUP'
  | 'TECH'
  | 'SPORTS'
  | 'FASHION'
  | 'HOME'
  | 'GENERIC';

// ===================================================================
// SHOT ROLE SYSTEM - VERSIÓN COMPLETA
// ===================================================================

export type ShotRole = 
  | 'HERO'
  | 'DETAIL'
  | 'INTERACTION'
  | 'LIFESTYLE'
  | 'ALT_ANGLE'
  | 'EXPRESSION'
  | 'SELFIE'
  | 'CONTEXT';

export type DetailTarget = 
  | 'fabric'
  | 'texture'
  | 'seam'
  | 'button'
  | 'belt'
  | 'bag'
  | 'shoe'
  | 'necklace'
  | 'earring'
  | 'bracelet'
  | 'collar'
  | 'sleeve'
  | 'hem'
  | 'material'
  | 'logo'
  | 'feature'
  | 'face'        // Para AVATAR detail
  | 'hand_gesture'; // Para AVATAR interacción

export type ShotFraming = 'CLOSE_UP' | 'MEDIUM' | 'WIDE' | 'EXTREME_CLOSE' | 'SELFIE';

export type ShotComposition = 
  | 'FULL_BODY_CENTERED'
  | 'EXTREME_CROP'
  | 'SIDE_ANGLE'
  | 'LOW_ANGLE'
  | 'HIGH_ANGLE'
  | 'OVER_SHOULDER'
  | 'ASYMMETRIC'
  | 'THREE_QUARTERS'
  | 'EYE_LEVEL';

export type ShotExclusion = 
  | 'face'
  | 'full_body'
  | 'background'
  | 'product'
  | 'outfit'
  | 'accessories'
  | 'irrelevant_objects'
  | 'frontal_symmetry'
  | 'environment_dominance'
  | 'third_person_perspective'
  | 'product_dominance'
  | 'background_dominance'
  | 'beautification'
  | 'editorial_softening'
  | 'studio_polish'
  | 'luxury_redesign'
  | 'invented_clothing'
  | 'full_body_mannequin';

export type ShotIntensity = 'normal' | 'aggressive' | 'extreme';

export interface ShotDirective {
  key: ShotKey;
  role: ShotRole;
  detailTarget?: DetailTarget;
  purpose: string;
  requiredElements: string[];
  forbiddenElements: string[];
  variationSpace: string[];
  framing: ShotFraming;
  composition: ShotComposition;
  exclusion: ShotExclusion[];
  intensity?: ShotIntensity;
}

// ===================================================================
// REF0 ANALYSIS - PARA CONGELAR LUZ, ESPACIO Y POSE
// ===================================================================

export interface REF0Analysis {
  lighting: {
    primarySource: string;       // e.g. "window on the left"
    direction: string;           // e.g. "left to right"
    colorTemperature: string;    // e.g. "warm golden"
    shadowType: string;          // e.g. "soft diffused shadows to the right"
    intensity: string;           // e.g. "bright natural daylight"
  };
  spatial: {
    elements: string[];          // e.g. ["beige sofa", "wooden coffee table", "curtain"]
    walls: string;               // e.g. "white walls with beige curtain on left"
    floor: string;               // e.g. "light tile floor"
    geometry: string;            // e.g. "rectangular room, window behind, sofa on left"
  };
  poseContext: {
    hasSeating: boolean;
    hasLeaningSurface: boolean;
    hasTable: boolean;
    availableActions: string[];  // e.g. ["standing", "leaning on sofa arm", "sitting on sofa"]
  };
}

export interface Shot {
  key: ShotKey;
  name: string;
  promptUsed: string;
  negativeUsed: string;
  imageUrl?: string | null;
  status: ShotStatus;
  attempts: number;
  errorMsg?: string | null;
}

export interface ContentStudioProSet {
  id: string;
  createdAt: number;
  style: Style;
  focus: Focus;
  productSize?: ProductSize;
  productCategory?: ProductCategory;
  faceRefs: string[];
  productRef?: string | null;
  outfitRef?: string | null;
  sceneRef?: string | null;
  sceneText?: string;
  faceAnchorUrl?: string | null;
  image0Url?: string | null;
  ref0Analysis?: REF0Analysis;  // NUEVO: análisis guardado
  shots: Shot[];
  attemptsImage0: number;
}

export interface GalleryImage {
  url: string;
  type: 'master' | 'shot';
  shotKey?: ShotKey;
  shotIndex?: number;
}

// ===================================================================
// CONSTANTES Y UTILIDADES
// ===================================================================

export const FOCUS_LABELS: Record<Focus, string> = {
  AVATAR: 'Avatar / Persona',
  PRODUCT: 'Producto Hero',
  OUTFIT: 'Outfit / Moda',
  SCENE: 'Escenario / Lifestyle'
};

export const STYLE_LABELS: Record<Style, string> = {
  UGC_PREMIUM: 'UGC Premium (iPhone)',
  STUDIO_PRO: 'Estudio Profesional'
};

export const SIZE_LABELS: Record<ProductSize, string> = {
  SMALL: 'Pequeño (Joyas, Relojes)',
  MEDIUM: 'Mediano (Bolsos, Zapatos)',
  LARGE: 'Grande (Bicis, Muebles)'
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  JEWELRY: 'Joyería',
  MAKEUP: 'Maquillaje',
  TECH: 'Tecnología',
  SPORTS: 'Deportes',
  FASHION: 'Moda',
  HOME: 'Hogar',
  GENERIC: 'General'
};

export const ROLE_LABELS: Record<ShotRole, string> = {
  HERO: 'Hero - imagen principal dominante',
  DETAIL: 'Detalle - extreme close-up con target específico',
  INTERACTION: 'Interacción - acción clara con manos',
  LIFESTYLE: 'Lifestyle - contexto natural y relajado',
  ALT_ANGLE: 'Ángulo alternativo - perspectiva diferente',
  EXPRESSION: 'Expresión - close-up facial',
  SELFIE: 'Selfie - estilo UGC auténtico',
  CONTEXT: 'Contexto - espacio completo'
};

export const DETAIL_TARGET_LABELS: Record<DetailTarget, string> = {
  fabric: 'Textura de tela',
  texture: 'Textura general',
  seam: 'Costura',
  button: 'Botón',
  belt: 'Cinturón',
  bag: 'Bolso',
  shoe: 'Zapato',
  necklace: 'Collar',
  earring: 'Aretes',
  bracelet: 'Pulsera',
  collar: 'Cuello',
  sleeve: 'Manga',
  hem: 'Bajo',
  material: 'Material',
  logo: 'Logotipo',
  feature: 'Característica',
  face: 'Rostro',
  hand_gesture: 'Gesto de mano'
};

export const COMPOSITION_LABELS: Record<ShotComposition, string> = {
  FULL_BODY_CENTERED: 'Cuerpo completo centrado',
  EXTREME_CROP: 'Crop extremo - 80-90% del frame',
  SIDE_ANGLE: 'Ángulo lateral',
  LOW_ANGLE: 'Contrapicado',
  HIGH_ANGLE: 'Picado',
  OVER_SHOULDER: 'Sobre el hombro',
  ASYMMETRIC: 'Composición asimétrica',
  THREE_QUARTERS: 'Tres cuartos',
  EYE_LEVEL: 'Altura de ojos'
};

export function getShotCount(focus: Focus, productSize?: ProductSize): number {
  return 6; // TODOS 6 SHOTS
}

export function getShotKeys(count: number): ShotKey[] {
  const keys: ShotKey[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  return keys.slice(0, count);
}

export function getSlotLabel(slot: 'face' | 'outfit' | 'product' | 'scene', focus: Focus): string {
  const labels: Record<string, Record<Focus, string>> = {
    face: {
      AVATAR: 'Rostro (ADN)',
      PRODUCT: 'Rostro (ADN)',
      OUTFIT: 'Rostro (ADN)',
      SCENE: 'Rostro (ADN)'
    },
    outfit: {
      AVATAR: 'Outfit',
      PRODUCT: 'Outfit',
      OUTFIT: 'Outfit',
      SCENE: 'Outfit'
    },
    product: {
      AVATAR: 'Prop / Objeto adicional',
      PRODUCT: 'Producto',
      OUTFIT: 'Objeto complementario',
      SCENE: 'Prop / Objeto adicional'
    },
    scene: {
      AVATAR: 'Escena',
      PRODUCT: 'Escena',
      OUTFIT: 'Escena',
      SCENE: 'Escena'
    }
  };
  
  return labels[slot]?.[focus] || slot;
}

export function getTooltip(slot: 'face' | 'outfit' | 'product' | 'scene', focus: Focus): string {
  const tooltips: Record<string, Record<Focus, string>> = {
    face: {
      AVATAR: 'Obligatorio. Define la identidad de tu avatar',
      PRODUCT: 'Obligatorio. Define quién usa el producto',
      OUTFIT: 'Obligatorio. Define quién viste el outfit',
      SCENE: 'Obligatorio. Define quién interactúa con la escena'
    },
    outfit: {
      AVATAR: 'Opcional. Sube la ropa que quieres que use tu avatar',
      PRODUCT: 'Opcional. Si no subes, se asignará ropa coherente con el producto',
      OUTFIT: 'Obligatorio. La ropa será la protagonista de la sesión',
      SCENE: 'Opcional. Si no subes, se asignará ropa coherente con la escena'
    },
    product: {
      AVATAR: 'Opcional. Sube un objeto para dar contexto a tu avatar',
      PRODUCT: 'Obligatorio. El producto será el héroe de todas las imágenes',
      OUTFIT: 'Opcional. Marca el checkbox si es complemento del outfit',
      SCENE: 'Opcional. Marca el checkbox si es coherente con la escena'
    },
    scene: {
      AVATAR: 'Opcional. Sube un lugar para dar contexto a tu avatar',
      PRODUCT: 'Opcional. Si no subes, se asignará fondo coherente con el producto',
      OUTFIT: 'Opcional. Si no subes, se asignará fondo coherente con el outfit',
      SCENE: 'Obligatorio. El lugar será el protagonista de la sesión'
    }
  };
  
  return tooltips[slot]?.[focus] || 'Sube una imagen de referencia';
}

export function isSlotRequired(slot: 'face' | 'outfit' | 'product' | 'scene', focus: Focus): boolean {
  if (slot === 'face') return true;
  if (slot === 'outfit' && focus === 'OUTFIT') return true;
  if (slot === 'product' && focus === 'PRODUCT') return true;
  if (slot === 'scene' && focus === 'SCENE') return true;
  return false;
}

export function shouldShowComplementCheckbox(focus: Focus, hasProduct: boolean): boolean {
  return (focus === 'OUTFIT' || focus === 'SCENE') && hasProduct;
}

export function getShotCountText(focus: Focus, productSize?: ProductSize): string {
  const count = getShotCount(focus, productSize);
  return `${count} shots`;
}

export function getFocusDescription(focus: Focus): string {
  const descriptions: Record<Focus, string> = {
    AVATAR: 'Influencer digital. Selfie obligatoria. Expresiones auténticas. El rostro es el héroe.',
    PRODUCT: 'Review de producto. El avatar convence al cliente con emoción real. Producto y cara visibles.',
    OUTFIT: 'Try-on haul. La ropa es la protagonista. Silueta, texturas y estilo completo.',
    SCENE: 'Review de lugar. El avatar vive el espacio. Ambiente, interacciones y experiencia.'
  };
  return descriptions[focus];
}