/**
 * recipes/outfitRevealBasic/renderVariants.ts
 *
 * Banco de variantes para los shots 2 y 3 (no fijos) — cada una combina un
 * encuadre/ángulo real con una familia HPI verificada contra el banco real
 * (03_reglas_director_hpi_mujer_151.json, enriquecido julio 2026 con muchas
 * poses nuevas). Reemplaza el diseño anterior de 2 textos fijos y genéricos
 * (self_pov / close_detail), que resultó repetitivo y con drift de outfit
 * (el encuadre de POV recortaba el calzado sin que el prompt lo advirtiera).
 *
 * Se rotan determinísticamente por posición del shot dentro del set — nunca
 * se repite la misma variante dos veces en el mismo set de 3 (shot 1 siempre
 * es mirror_check full-body, shots 2 y 3 toman 2 variantes distintas de este
 * banco, en orden).
 */
import type { CameraGrammarRef } from './types';

export interface RevealVariant {
  id:            string;
  sceneBlock:    string;
  cameraGrammar: CameraGrammarRef;
  hpiPoseFamily: string | null;   // null = sin HPI (ej. POV genuino, sin familia real)
  hpiCameraFamily?: string;
  // Qué tan visible queda el calzado en este encuadre — controla si hay que
  // reforzar fidelidad de calzado en el prompt o si es aceptable que quede
  // fuera de cuadro (bug real: POV recortaba los pies sin avisarlo).
  footwearVisible: boolean;
}

export const REVEAL_VARIANTS: RevealVariant[] = [
  {
    id: 'lateral_silhouette',
    sceneBlock: 'A full-body mirror selfie from a side profile angle — she has turned to show the silhouette of the outfit from the side, same room as the anchor. Full body visible head to toe, including footwear.',
    cameraGrammar: { framing: 'FULL_BODY', angle: 'eye_level', composition: 'lateral_silhouette' },
    hpiPoseFamily: 'STANDING_LATERAL_SILHOUETTE_POSE',
    footwearVisible: true,
  },
  {
    id: 'three_quarter_showcase',
    sceneBlock: 'A full-body mirror selfie from a three-quarter angle — a natural turn showing more depth and dimension of the outfit than a straight-on shot. Full body visible head to toe, including footwear.',
    cameraGrammar: { framing: 'FULL_BODY', angle: 'three_quarter', composition: 'three_quarter_showcase' },
    hpiPoseFamily: 'STANDING_THREE_QUARTER_LANDMARK_POSE',
    footwearVisible: true,
  },
  {
    id: 'back_view',
    sceneBlock: 'A full-body mirror selfie from behind — she has turned around to show the back of the outfit in the mirror reflection. Full body visible head to toe, including footwear.',
    cameraGrammar: { framing: 'FULL_BODY', angle: 'eye_level', composition: 'back_view' },
    hpiPoseFamily: 'MIRROR_SELFIE_STANDING_POSE',
    hpiCameraFamily: 'POSTERIOR_BACK_VIEW_FRAMING',
    footwearVisible: true,
  },
  {
    id: 'over_shoulder_candid',
    sceneBlock: 'A candid mirror selfie glancing back over her shoulder — a natural, unposed moment, not a straight frontal stance. Full body or near-full body visible, including footwear if the pose allows it.',
    cameraGrammar: { framing: 'FULL_BODY', angle: 'over_shoulder', composition: 'over_shoulder_candid' },
    hpiPoseFamily: 'OVER_SHOULDER_HIP_HAND_POSE',
    hpiCameraFamily: 'OBSERVED_PROFILE_OR_CANDID',
    footwearVisible: true,
  },
  {
    id: 'genuine_pov',
    sceneBlock: 'A genuine first-person point-of-view shot — the camera IS her own eyes looking down at her own body and outfit. No phone visible anywhere in frame, no arm holding a phone, no face, no mirror. The framing is naturally cropped the way a real person\'s own gaze would be: chin barely at the top edge or not visible at all. This is literally what she sees when she looks down at herself — NOT a photo someone else took.',
    cameraGrammar: { framing: 'POV', angle: 'looking_down', composition: 'genuine_pov' },
    hpiPoseFamily: null,
    footwearVisible: false, // el encuadre POV mirando hacia abajo naturalmente puede no llegar a los pies
  },
  {
    id: 'close_detail_hair',
    sceneBlock: 'A close, genuine selfie — framed from roughly the top of the head to the chest/upper torso, phone visible in hand. One hand casually touches her own hair. Natural, unposed, intimate framing — not a beauty portrait.',
    cameraGrammar: { framing: 'CLOSE_UP', angle: 'eye_level', composition: 'close_selfie_hair' },
    hpiPoseFamily: 'UPPER_BODY_SELFIE_POSE',
    hpiCameraFamily: 'DIRECT_CLOSEUP_PORTRAIT',
    footwearVisible: false, // close-up de torso/rostro, los pies no entran en el encuadre por diseño
  },
];

// Hash simple y determinístico de un string — para variar la selección
// entre sesiones distintas (mismo criterio que un seed), sin depender de
// Math.random() (que rompería la consistencia REF0↔shot real dentro de la
// MISMA sesión, ya que buildOutfitRevealBasicDirectives() e index.ts calculan
// el plan por separado — ver nota en index.ts).
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Devuelve 2 variantes distintas del banco para esta sesión, variando entre
 * sesiones distintas (según seed, típicamente las refs subidas) pero
 * estables dentro de la MISMA sesión — nunca se repiten entre sí.
 */
export function pickVariantsForSet(seed: string): [RevealVariant, RevealVariant] {
  const n = REVEAL_VARIANTS.length;
  const first = hashString(seed) % n;
  const second = (first + 1 + (hashString(seed + '::2') % (n - 1))) % n;
  return [REVEAL_VARIANTS[first], REVEAL_VARIANTS[second]];
}
