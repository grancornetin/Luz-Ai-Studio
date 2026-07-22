/**
 * recipes/outfitRevealBasic/types.ts
 *
 * Tipos internos de la receta outfit_reveal_basic. A diferencia de
 * outfit_multi_look, acá NO hay looks múltiples ni intenciones — es una sola
 * narrativa fija de 3 shots (mirror check, self-POV, close-up), diseñada y
 * validada a mano (ver manifiesto
 * 10_session_log_outfit_reveal_basic_validation.md sección 3).
 *
 * El primer shot (mirror_check) cumple doble función: ancla identidad/cuerpo/
 * cuarto Y es el primer shot publicable — mismo patrón de fusión REF0+shot1
 * ya usado en outfitMultiLook/anchorFixed.ts.
 */

export type RevealShotId = 'mirror_check' | 'self_pov' | 'close_detail';

export type RevealPoseFamilies = 'standing' | 'pov_no_hpi' | 'upper_body';

export interface CameraGrammarRef {
  framing:     string;
  angle:       string;
  composition: string;
}

export interface ReferencePolicy {
  useIdentityRef: boolean;
  useBodyRef:     boolean;
  useOutfitRefs:  boolean;
}

export interface ShotContract {
  shotId:         RevealShotId;
  cameraGrammar:  CameraGrammarRef;
  poseFamily:     RevealPoseFamilies;
  referencePolicy: ReferencePolicy;
}

export interface ValidationResult {
  passed: boolean;
  errors: string[];
}

export interface RoutedReferences {
  orderedUrls: string[];
  breakdown: {
    identity?: string;
    body?:     string;
    outfits:   string[];
  };
}

export interface OutfitRevealBasicShotPlan {
  shotId: RevealShotId;
}

export interface OutfitRevealBasicShotDebug {
  shotId:             RevealShotId;
  referencesUsed:     string[];
  cameraGrammar:      CameraGrammarRef;
  routingValidation:  ValidationResult;
  promptSummary:      string;
}
