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
 * El banco de noche (ver nightMoments.ts) surge de analizar 23 imágenes
 * reales de salidas nocturnas — no es un pool de "momentos narrativos"
 * (llegada/social/cierre) sino de tipos de encuadre/sujeto (retrato posado,
 * detalle de manos, grupo, movimiento/energía, POV de piernas, ambiental,
 * auto), cada uno parametrizado por energía (elegante/fiesta) y venue.
 */

export type NightOutFixedShotId = 'presentation' | 'tryon_detail' | 'mirror_check';

export type NightMomentId =
  | 'posed_portrait'
  | 'hands_detail'
  | 'group_moment'
  | 'motion_energy'
  | 'pov_legs'
  | 'ambient_only'
  | 'car_transition';

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
}
