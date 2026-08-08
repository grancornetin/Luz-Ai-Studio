/**
 * recipes/outfitNightOut/types.ts
 *
 * Tipos internos de la receta outfit_night_out.
 *
 * 3 shots fijos de preparación (presentation, tryon_detail, mirror_check) +
 * un banco de "momentos de noche" (NightMomentId) elegidos según el nivel
 * (Corto/Completo/Extendido). mirror_check cumple doble función de ancla
 * (identidad/cuerpo/cuarto de prep) y primer shot publicable en el nivel
 * Corto — mismo patrón de fusión REF0+shot1 ya usado en
 * outfitRevealBasic/outfitMultiLook.
 *
 * presentation/tryon_detail (preparación en casa) YA NO aparecen en el nivel
 * Extendido — se reemplazaron por más momentos de noche (experiencia/
 * sensación, "vender sin vender"). Siguen existiendo como contratos fijos
 * porque quedan disponibles para Completo, pero Extendido es 100% mirror_check
 * + banco de noche (ver levelResolver.ts).
 *
 * El banco de noche (ver nightMoments.ts) surge de analizar 23 imágenes
 * reales de salidas nocturnas compartidas en el chat — no es un pool de
 * "momentos narrativos" (llegada/social/cierre) sino de tipos de
 * encuadre/sujeto (retrato posado, grupo, movimiento/energía, POV de
 * piernas, ambiental, auto, comida, brindis, fiesta grupal), cada uno
 * parametrizado por energía (elegante/fiesta) y venue.
 *
 * 'hands_detail' (detalle de manos sosteniendo el trago) se eliminó del
 * banco: sin una familia de cámara real que fuerce una distancia/ángulo
 * físicamente distinto al shot vecino, el modelo lo resolvía como un simple
 * recorte/zoom sobre la composición ya generada en vez de una toma nueva
 * (mismo tipo de bug que el de HPI: un eje real tratado solo como texto de
 * contenido, sin restricción dura). El trago como protagonista ya está
 * cubierto sin mano en cuadro por 'ambient_only', y como prop secundario en
 * 'posed_portrait'/'pov_legs'/'group_moment'.
 *
 * 'food_detail', 'toast_moment' y 'group_party_moment' (reemplazó a
 * 'view_moment') se reescribieron con base en el banco real de ~1030
 * imágenes analizadas del proyecto (src/data/Analisis de datos/analisis
 * con genero.md + analisis pre genero.md) — la primera versión de estas 3
 * entradas fue inventada de memoria sin verificar contra ese banco, lo cual
 * el usuario corrigió explícitamente. Cada entrada cita el itemId real de
 * las imágenes que la respaldan (ver comentarios inline en nightMoments.ts).
 */

export type NightOutFixedShotId = 'presentation' | 'tryon_detail' | 'mirror_check';

export type NightMomentId =
  | 'posed_portrait'
  | 'group_moment'
  | 'motion_energy'
  | 'pov_legs'
  | 'ambient_only'
  | 'car_transition'
  | 'food_detail'
  | 'toast_moment'
  | 'group_party_moment';

export type NightOutShotId = NightOutFixedShotId | NightMomentId;

export type NightOutEnergy = 'elegante' | 'fiesta';

export type NightOutLevel = 'corto' | 'completo' | 'extendido';

export interface CameraGrammarRef {
  framing:     string;
  angle:       string;
  composition: string;
}

export interface ReferencePolicy {
  useIdentityRef: boolean;
  useBodyRef:     boolean;
  useOutfitRefs:  boolean;
  useCompanionRef?: boolean;
}

export interface ShotContract {
  shotId:          NightOutShotId;
  cameraGrammar:   CameraGrammarRef;
  referencePolicy: ReferencePolicy;
  // Solo para shots de tipo NightMoment — familia HPI real verificada contra
  // el JSON, o null si no aplica ninguna con confianza (se describe a mano).
  hpiPoseFamily?:  string | null;
  hpiCameraFamily?: string;
  // Controla si el prompt debe reforzar fidelidad de calzado (igual criterio
  // que outfitRevealBasic/renderVariants.ts) — varias entradas del banco de
  // noche son detalle de manos/objeto o POV que no necesariamente muestran
  // los pies en cuadro.
  footwearVisible: boolean;
}

export interface ValidationResult {
  passed: boolean;
  errors: string[];
}

export interface RoutedReferences {
  orderedUrls: string[];
  breakdown: {
    identity?:  string;
    body?:      string;
    outfits:    string[];
    companion?: string;
  };
}

export interface OutfitNightOutShotPlan {
  shotId: NightOutShotId;
  // Presente solo cuando shotId es un NightMoment con familia HPI a resolver
  // en runtime (no hace falta un índice de variante — el shotId ya identifica
  // la entrada única del banco, a diferencia del banco rotable de
  // outfitRevealBasic que sí necesita variantIndex).
}

export interface OutfitNightOutShotDebug {
  shotId:            NightOutShotId;
  referencesUsed:    string[];
  cameraGrammar:     CameraGrammarRef;
  routingValidation: ValidationResult;
  promptSummary:     string;
  // true si el texto de este shot vino del Director Creativo (banco real +
  // razonamiento de Gemini), false si vino del banco estático de
  // nightMoments.ts — ya sea porque el director falló para esta sesión, o
  // porque el shot es uno de los 3 fijos sin cobertura del director todavía.
  // Ver directorFailureReason en la sesión si usedDirector es false por falla.
  usedDirector: boolean;
}
