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
  // Solo shots de variación (sep 2026): línea de actitud real citada del
  // banco de fotos (openbank) para la composición que le tocó — ver
  // fetchPoseCandidatesByKeyword en outfitCheck/poseClient.ts. undefined si
  // no hay candidato disponible (el shot cae al sceneBlock genérico solo).
  poseAttitudeLine?: string;
  // TODOS los shots (sep 2026): lugares coherentes con el registro/
  // formalidad real del outfit (ver outfitRegisterClient.ts) — un vestido
  // de gala no debe terminar en un lugar campestre solo porque tiene
  // espejo. undefined = fallback genérico (mismo texto ya validado, sin
  // restricción de registro).
  coherentPlaces?: string;
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
  // Solo shots de variación (sep 2026): línea de actitud real ya resuelta en
  // buildOutfitRevealBasicDirectives — viaja acá para que
  // generateOutfitRevealBasicShot no repita la llamada de red al generar la
  // imagen real (misma llamada de sesión, nunca una por shot).
  poseAttitudeLine?: string;
  // TODOS los shots (sep 2026): lugares coherentes con el registro del
  // outfit, ya resueltos una vez — ver ShotContract.coherentPlaces arriba.
  coherentPlaces?: string;
}

export interface OutfitRevealBasicShotDebug {
  shotId:             RevealShotId;
  referencesUsed:     string[];
  cameraGrammar:      CameraGrammarRef;
  routingValidation:  ValidationResult;
  promptSummary:      string;
}
