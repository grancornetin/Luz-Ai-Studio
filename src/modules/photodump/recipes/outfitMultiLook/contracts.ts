/**
 * recipes/outfitMultiLook/contracts.ts
 *
 * Convierte cada look asignado por el reparto (allocator.ts) en uno o más
 * contratos explícitos: qué encuadre usa, qué referencias necesita, y qué
 * intensidad de pose le corresponde según su era (solo then_vs_now).
 *
 * Encuadre fijo por diseño (validado manualmente, ver manifiesto sección 3):
 * "full-body mirror selfie" idéntico en todos los shots de weekly/then_vs_now.
 * trip_recap usa un encuadre de tercera persona candid (no es mirror-selfie
 * — cada shot está en un lugar público distinto).
 *
 * curated_ideas es la única intención con MÁS de 1 shot por look (ver
 * manifiesto — pedido real del usuario: para que sirva como guía de estilo
 * necesita al menos un ángulo adicional además del frontal, y opcionalmente
 * accesorios enlazados). Cada look produce 2 ShotContract: 'frontal' (igual
 * al resto de intenciones) y 'variation' — el ángulo de variación rota
 * determinísticamente por look.sourceIndex, mismo principio que
 * NEUTRAL_POSE_VARIANTS en intelligenceLayer.ts, para que ningún set repita
 * el mismo ángulo de variación en dos looks consecutivos.
 *
 * Grupos de variación enriquecidos con el banco real (sep 2026, aplicando
 * la misma disciplina que outfit_check/poseClient.ts): se auditó volumen
 * real del banco de 733 fotos ANTES de elegir estos 3 grupos, y se verificó
 * el TEXTO de una muestra real de cada uno (no solo el conteo) — keywords
 * sueltas dieron falsos positivos en 2 rondas distintas: "espalda" solo
 * capturaba "espalda apoyada contra una pared" (no vista trasera del
 * outfit); "inclinad"/"apoyad" sueltas capturaban micro-giros de cabeza
 * ("cabeza ligeramente inclinada"), no la actitud corporal completa. Con
 * las frases exactas verificadas: back_view: 11 candidatos ("de espaldas a
 * la cámara"), side_profile: 31 ("de perfil derecho/izquierdo"),
 * alt_pose: 206 ("sentada"/"agachada"/"recostada", participio completo).
 * El 3er ángulo original ("fabric_detail_closeup") se descartó: solo 2
 * candidatos en todo el banco Y ya tenía un bug real documentado de
 * fidelidad de color (ver manifiesto 12_ESTADO_ACTUAL_retomar_aqui.md) —
 * en vez de forzarlo, se reemplazó por alt_pose (actitud corporal distinta
 * — sentada/agachada/recostada — mismo mirror-selfie, sigue mostrando el
 * outfit completo).
 */
import type {
  LookItem, MultiLookIntent, MultiLookAccessory, ShotContract, ReferencePolicy,
  CameraGrammarRef, LookPoseIntensity, MultiLookShotAngle,
} from './types';
import { fetchPoseCandidatesByKeyword, pickOneCandidate, buildPoseAttitudeLine } from '../outfitCheck/poseClient';

// Ángulos de variación disponibles para curated_ideas — rotados por posición
// del look, no elegidos al azar (reproducible, sin depender de Math.random).
const VARIATION_ANGLES: CameraGrammarRef[] = [
  { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'mirror_selfie_back_view' },
  { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'mirror_selfie_side_profile' },
  { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'mirror_selfie_alt_pose' },
];

// Palabras clave por grupo — cada una respaldada por el conteo real citado
// arriba. Ver getOutfitCheckPoseCandidates en api/gemini/content.ts (modo
// poseKeywordGroups) para el filtro real sobre subject_pose.
const POSE_KEYWORD_GROUPS: Record<string, string[]> = {
  mirror_selfie_back_view:    ['de espaldas'],
  mirror_selfie_side_profile: ['de perfil'],
  mirror_selfie_alt_pose:     ['sentada', 'sentado', 'agachada', 'agachado', 'recostada', 'recostado'],
};

function variationAngleFor(look: LookItem): CameraGrammarRef {
  const idx = ((look.sourceIndex % VARIATION_ANGLES.length) + VARIATION_ANGLES.length) % VARIATION_ANGLES.length;
  return VARIATION_ANGLES[idx];
}

// Una sola llamada de red por sesión (los 3 grupos juntos), mismo criterio
// que outfitCheckPoseCandidates — nunca una llamada por shot. Devuelve mapa
// vacío (nunca lanza) si falla; el caller cae a los textos genéricos ya
// validados de promptBuilder.ts, nunca bloquea la generación por esto.
export async function fetchMultiLookVariationPoses(
  seed: string,
): Promise<Record<string, import('../outfitCheck/poseClient').OutfitCheckPoseCandidate[]>> {
  return fetchPoseCandidatesByKeyword(POSE_KEYWORD_GROUPS, seed, 5);
}

function cameraGrammarFor(intent: MultiLookIntent, look: LookItem, angle: MultiLookShotAngle): CameraGrammarRef {
  if (intent === 'trip_recap') {
    return { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'candid_off_center' };
  }
  if (intent === 'curated_ideas' && angle === 'variation') {
    return variationAngleFor(look);
  }
  return { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'mirror_selfie' };
}

// then_vs_now: la jerarquía de pose vive por look, no por mecanismo de
// generación distinto (ver manifiesto sección 6bis) — before = baja
// presencia deliberada, after = alto impacto deliberado. El resto de
// intenciones no tiene jerarquía, pose neutral en todos los looks.
function poseIntensityFor(intent: MultiLookIntent, look: LookItem): LookPoseIntensity {
  if (intent !== 'then_vs_now') return 'neutral';
  if (look.era === 'before') return 'low_presence';
  if (look.era === 'after') return 'high_impact';
  return 'neutral';
}

function referencePolicyFor(look: LookItem, linkedAccessoryUrls: string[]): ReferencePolicy {
  return {
    useIdentityRef: true,
    useBodyRef:     true,
    useAnchorRef:   true,
    activeLookRef:  look.refUrl,
    linkedAccessoryUrls: linkedAccessoryUrls.length > 0 ? linkedAccessoryUrls : undefined,
  };
}

function accessoryUrlsFor(look: LookItem, accessories: MultiLookAccessory[]): string[] {
  return accessories.filter(a => a.linkedLookIds.includes(look.id)).map(a => a.refUrl);
}

export function buildShotContract(
  look:              LookItem,
  intent:            MultiLookIntent,
  angle:             MultiLookShotAngle = 'frontal',
  chainAnchorUrl?:   string,
  accessories:       MultiLookAccessory[] = [],
  poseAttitudeLine?: string,
): ShotContract {
  return {
    shotId:          angle === 'frontal' ? `shot_${look.id}` : `shot_${look.id}_${angle}`,
    look,
    referencePolicy: referencePolicyFor(look, accessoryUrlsFor(look, accessories)),
    cameraGrammar:   cameraGrammarFor(intent, look, angle),
    poseIntensity:   poseIntensityFor(intent, look),
    angle,
    chainAnchorUrl,
    poseAttitudeLine,
  };
}

export async function buildShotContracts(
  looks:       LookItem[],
  intent:      MultiLookIntent,
  chainAnchorByLookId?: Map<string, string>,
  accessories: MultiLookAccessory[] = [],
  seedKey?:    string,
): Promise<ShotContract[]> {
  // Una sola llamada de red para todo el set (nunca por shot) — solo se usa
  // en curated_ideas, único caso con shots de variación.
  const variationPoses = (intent === 'curated_ideas' && seedKey)
    ? await fetchMultiLookVariationPoses(seedKey)
    : {};

  const contracts: ShotContract[] = [];
  for (const look of looks) {
    const chainAnchorUrl = chainAnchorByLookId?.get(look.id);
    contracts.push(buildShotContract(look, intent, 'frontal', chainAnchorUrl, accessories));
    if (intent === 'curated_ideas') {
      const composition = variationAngleFor(look).composition;
      const candidates = variationPoses[composition] ?? [];
      const chosen = pickOneCandidate(candidates, `${seedKey ?? ''}::${look.id}`);
      const poseAttitudeLine = buildPoseAttitudeLine(chosen) || undefined;
      contracts.push(buildShotContract(look, intent, 'variation', chainAnchorUrl, accessories, poseAttitudeLine));
    }
  }
  return contracts;
}
