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
 *
 * NOTA: 'genuine_pov' se eliminó del banco tras probarlo en producción — sin
 * una familia HPI real de respaldo (no existe banco de pose para "cámara =
 * mis propios ojos"), el resultado salía rígido y simétrico, tipo recorte de
 * catálogo, no creíble como un POV genuino. Todas las variantes que quedan
 * tienen celular visible en mano y familia HPI real verificada.
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
    sceneBlock: 'A full-body mirror selfie from a side profile angle — she has turned to show the silhouette of the outfit from the side, same place as the anchor. Full body visible head to toe, including footwear.',
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
    id: 'close_detail_hair',
    sceneBlock: 'A close, genuine selfie — framed from roughly the top of the head to the chest/upper torso, phone visible in hand. One hand casually touches her own hair. Natural, unposed, intimate framing — not a beauty portrait.',
    cameraGrammar: { framing: 'CLOSE_UP', angle: 'eye_level', composition: 'close_selfie_hair' },
    hpiPoseFamily: 'UPPER_BODY_SELFIE_POSE',
    hpiCameraFamily: 'DIRECT_CLOSEUP_PORTRAIT',
    footwearVisible: false, // close-up de torso/rostro, los pies no entran en el encuadre por diseño
  },
  // 2 variantes nuevas (sep 2026) — enriquecidas con el banco REAL de fotos
  // (bank-snapshot.json, 733 items), no con familias HPI (ver
  // fetchPoseCandidatesByKeyword en outfitCheck/poseClient.ts — el mismo
  // mecanismo ya usado en outfit_multi_look/contracts.ts). Se auditó volumen
  // real ANTES de sumarlas — mismo criterio que las demás vetas de este
  // módulo: filtrado a full_body/mirror_selfie sin acompañante (292 items),
  // y verificado a mano el texto de la muestra (no solo el conteo, la
  // primera pasada con keywords sueltas dio falsos positivos — "caminando"
  // real resultó ser solo 2 candidatos genuinos, descartada). hpiPoseFamily
  // queda null a propósito: el openbank resuelve la pose real, no hace
  // falta una familia HPI genérica encima (evita el mismo problema que ya
  // sacó a genuine_pov del banco — sin candidato real, HPI no aporta nada).
  {
    id: 'seated_showcase',
    sceneBlock: 'A full-body mirror selfie, seated — she is sitting on a real piece of furniture or surface in this place (bed edge, chair, bench, counter, ledge), full outfit still clearly visible head to toe including footwear.',
    cameraGrammar: { framing: 'FULL_BODY', angle: 'eye_level', composition: 'seated_showcase' },
    hpiPoseFamily: null,
    footwearVisible: true,
  },
  {
    id: 'leaning_wall',
    sceneBlock: 'A full-body mirror selfie, standing but leaning casually against a real wall or piece of furniture in this place — a relaxed, off-guard stance rather than a plain centered stand. Full body visible head to toe, including footwear.',
    cameraGrammar: { framing: 'FULL_BODY', angle: 'eye_level', composition: 'leaning_wall' },
    hpiPoseFamily: null,
    footwearVisible: true,
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
