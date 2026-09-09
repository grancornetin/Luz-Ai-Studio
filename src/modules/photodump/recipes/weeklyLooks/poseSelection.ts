/**
 * recipes/weeklyLooks/poseSelection.ts
 *
 * Cita pose/actitud real del banco para cada shot, filtrada por el
 * CaptureStyle elegido por el usuario (mirror_selfie | third_person) — NUNCA
 * deja que Gemini invente la mecánica de cámara libremente (instrucción
 * explícita del usuario, sep 2026: "debemos alimentarlo del banco... no
 * debemos dejar que gemini actúe sin dirección").
 *
 * Auditoría real del banco (733 fotos, sep 2026) que respalda estos 2
 * filtros — corregida una vez en la misma sesión tras un primer conteo
 * equivocado (confiar solo en shot_type==='full_body' subestimaba
 * mirror_selfie: shot_type 'mirror_selfie' no distingue encuadre, mezcla
 * cuerpo completo con otros; capture_signature sí es la señal confiable de
 * mecánica de cámara):
 *
 *   - mirror_selfie:  shot_type 'mirror_selfie' (118 candidatos reales,
 *     capture_signature 'mirror_selfie_phone' en 115 de ellos — celular
 *     siempre visible en pose/gesto).
 *   - third_person:   shot_type 'full_body' + capture_signature
 *     'handheld_phone_natural' (139 candidatos reales — sin celular en
 *     cuadro, cámara de tercero/timer/trípode).
 *
 * Ambos con volumen real sólido — la elección de estilo no compromete
 * variedad de pose entre shots del mismo set.
 */
import { fetchOutfitCheckPoseCandidates, pickOneCandidate, buildPoseAttitudeLine } from '../outfitCheck/poseClient';
import type { CaptureStyle } from './types';

const CAPTURE_STYLE_FILTER: Record<CaptureStyle, { shotTypes: string[]; captureSignatures: string[] }> = {
  mirror_selfie: {
    shotTypes:          ['mirror_selfie'],
    captureSignatures:  ['mirror_selfie_phone'],
  },
  third_person: {
    shotTypes:          ['full_body'],
    captureSignatures:  ['handheld_phone_natural'],
  },
};

// Un mapa shot_type -> candidatos por seedKey — misma llamada de red sirve
// para todos los shots del set (mismo patrón que poseAttitudeCache en
// weeklyFavoritesV2/index.ts).
const candidatePoolCache = new Map<string, Awaited<ReturnType<typeof fetchOutfitCheckPoseCandidates>>>();

// mirror_selfie citando una postura sentada/en el piso (sep 2026, bug real
// confirmado): un candidato "sentada en el suelo, mano en la mejilla" se
// citó para un shot de reflejo de vidrio de pie — el resultado mezcló una
// pose de piso con un fondo de pie, sumando confusión a la geometría de
// reflejo que ya venía forzada. shot_type 'mirror_selfie' no distingue
// postura (de pie vs. sentada) — volumen real verificado: 9 de 115
// candidatos son sentada/suelo/arrodillada, volumen bajo, se excluyen por
// keyword en vez de filtrar del lado del endpoint (caso puntual de esta
// receta, no vale la pena un modo de exclusión genérico todavía).
const SEATED_POSE_KEYWORDS = ['sentad', 'suelo', 'piso', 'acostad', 'recostad', 'reclinad', 'arrodillad'];

function isSeatedPose(candidate: { pose: string }): boolean {
  const pose = candidate.pose.toLowerCase();
  return SEATED_POSE_KEYWORDS.some(k => pose.includes(k));
}

async function getCandidatePool(captureStyle: CaptureStyle, seedKey: string) {
  const cacheKey = `${captureStyle}::${seedKey}`;
  const cached = candidatePoolCache.get(cacheKey);
  if (cached) return cached;

  const filter = CAPTURE_STYLE_FILTER[captureStyle];
  // excludeCompanion=true: bug real confirmado (sep 2026) — un candidato de
  // fiesta/grupo (companion_present=true) citó "mira hacia el grupo de
  // personas" y el modelo generó un tercero real en la foto. weeklyLooks es
  // siempre una sola persona en cuadro, nunca grupo.
  const rawPool = await fetchOutfitCheckPoseCandidates(filter.shotTypes, seedKey, 10, filter.captureSignatures, true);
  const pool: typeof rawPool = {};
  for (const [shotType, candidates] of Object.entries(rawPool)) {
    pool[shotType] = candidates.filter(c => !isSeatedPose(c));
  }
  candidatePoolCache.set(cacheKey, pool);
  return pool;
}

/**
 * Elige una pose citada del banco para un shot específico, determinística
 * por shotId (mismo shot del mismo set → mismo candidato). Devuelve ''
 * (nunca lanza) si no hay candidatos disponibles — el caller cae al texto
 * genérico ya validado del promptBuilder.
 */
export async function selectPoseAttitudeLine(
  captureStyle: CaptureStyle,
  seedKey:      string,
  shotId:       string,
): Promise<string> {
  const pool = await getCandidatePool(captureStyle, seedKey);
  const filter = CAPTURE_STYLE_FILTER[captureStyle];
  const pooled = filter.shotTypes.flatMap(t => pool[t] ?? []);
  const chosen = pickOneCandidate(pooled, `${seedKey}::${shotId}`);
  return buildPoseAttitudeLine(chosen);
}

/** Texto de mecánica de cámara — inyectado siempre, además de la pose citada,
 * para que el modelo nunca ambigüe si hay celular en cuadro o no (mismo
 * principio que la corrección de la regla de selfie de brazo extendido en
 * hardRules.ts: la mecánica de cámara debe ser explícita, no implícita). */
export function captureStyleMechanicsLine(captureStyle: CaptureStyle): string {
  return captureStyle === 'mirror_selfie'
    ? 'This is a mirror selfie — the phone must be clearly visible in her hand, held up toward the mirror at face or chest height. This is what reads as a self-taken photo.'
    : 'This is a photo taken by someone else (or a timer/tripod) — no phone visible in her hands. She poses naturally toward the camera, not looking at or holding any device.';
}
