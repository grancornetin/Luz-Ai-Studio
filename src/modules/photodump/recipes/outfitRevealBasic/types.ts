/**
 * recipes/outfitRevealBasic/types.ts
 *
 * Tipos internos de la receta outfit_reveal_basic.
 *
 * Shot 1 (mirror_check) es fijo por diseño: full-body, cumple doble función
 * de ancla (identidad/cuerpo/cuarto) y primer shot publicable — mismo patrón
 * de fusión REF0+shot1 ya usado en outfitMultiLook/anchorFixed.ts.
 *
 * Shots 2 y 3 (variation) ya NO son conceptos fijos ("self_pov"/"close_detail")
 * — son posiciones que rotan sobre un banco de variantes reales (ángulo +
 * familia HPI), para evitar el bug real encontrado en producción: 2 textos
 * fijos y genéricos, uno de ellos (POV) repetitivo y propenso a drift de
 * outfit (recortaba el calzado del encuadre sin avisarlo en el prompt).
 */

export type RevealShotId = 'mirror_check' | 'variation_1' | 'variation_2';

export type RevealPoseFamilies = 'standing_anchor' | 'variation';

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
  shotId:          RevealShotId;
  cameraGrammar:   CameraGrammarRef;
  poseFamily:      RevealPoseFamilies;
  referencePolicy: ReferencePolicy;
  // Solo para shots de variación — índice determinístico dentro del banco
  // de RevealVariant (ver renderVariants.ts), evita repetir la misma
  // variante dos veces en el mismo set de 3.
  variantIndex?:   number;
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
  // Solo para shots de variación — fijado una vez en buildOutfitRevealBasicDirectives()
  // y transportado en el plan para que generateOutfitRevealBasicShot use
  // EXACTAMENTE la misma variante que se planificó, sin recalcular (evita que
  // el plan diga una variante y la generación real use otra).
  variantIndex?: number;
}

export interface OutfitRevealBasicShotDebug {
  shotId:             RevealShotId;
  referencesUsed:     string[];
  cameraGrammar:      CameraGrammarRef;
  routingValidation:  ValidationResult;
  promptSummary:      string;
}
