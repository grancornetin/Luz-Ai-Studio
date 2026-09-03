/**
 * recipes/outfitCheck/poseClient.ts
 *
 * Puerta de entrada de outfit_check al banco de fotos de Photodump —
 * necesaria porque, a diferencia de outfit_night_out (open_bank), esta
 * receta corre 100% client-side (photodumpDirectorService.ts arma el prompt
 * final en el navegador) y nunca llamó a Gemini para razonar. El banco de
 * 733 fotos solo existe server-side (ver loadPhotodumpBankSnapshot en
 * api/gemini/content.ts) — este archivo es el único punto de contacto real
 * entre outfit_check y ese banco: una llamada liviana, sin Gemini, que pide
 * "candidatos reales de este tipo de encuadre" y devuelve su pose/gesto/
 * mirada en texto, para que el prompt final describa una actitud real en
 * vez de inventar una genérica cada vez.
 *
 * Deliberadamente NO reusa director/client.ts (el cliente de
 * outfit_night_out) — mismo principio de aislamiento que ya sigue todo el
 * proyecto: cada receta tiene su propia puerta al banco, ninguna depende de
 * la otra por dentro, aunque ambas llamen al mismo endpoint compartido.
 */
import { getAuth } from 'firebase/auth';

const CONTENT_ENDPOINT = '/api/gemini/content';

export interface OutfitCheckPoseCandidate {
  itemId:  string;
  pose:    string;
  gesture: string;
  gaze:    string;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Pide candidatos reales del banco para uno o más shot_type a la vez (una
 * sola llamada de red por sesión, no una por shot) — devuelve un mapa
 * shot_type normalizado → hasta `perType` candidatos, mezclados
 * determinísticamente por `seed` (misma sesión = mismo resultado, sesión
 * distinta = variedad real, mismo mecanismo que buildWideCandidatePool en
 * open_bank).
 *
 * Devuelve un mapa vacío (nunca lanza) si la llamada falla — el caller debe
 * caer a redactar sin referencia real del banco, nunca romper la
 * generación por esto.
 */
export async function fetchOutfitCheckPoseCandidates(
  shotTypes: string[],
  seed: string,
  perType: number = 3,
): Promise<Record<string, OutfitCheckPoseCandidate[]>> {
  if (shotTypes.length === 0) return {};
  try {
    const res = await fetch(CONTENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body: JSON.stringify({
        action: 'getOutfitCheckPoseCandidates',
        payload: { shotTypes, seed, perType },
      }),
    });
    if (!res.ok) {
      console.warn(`[outfitCheck] fetchOutfitCheckPoseCandidates: el endpoint devolvió ${res.status}`);
      return {};
    }
    const data = await res.json();
    return (data?.candidatesByType && typeof data.candidatesByType === 'object') ? data.candidatesByType : {};
  } catch (err) {
    console.warn('[outfitCheck] fetchOutfitCheckPoseCandidates: excepción en la llamada', err);
    return {};
  }
}

/**
 * Mismo endpoint que fetchOutfitCheckPoseCandidates, pero filtrando por
 * palabra clave sobre subject_pose en vez de shot_type — necesario cuando lo
 * que hace falta distinguir es ACTITUD CORPORAL (sentada/inclinada/apoyada),
 * algo que shot_type no captura (solo tipo de encuadre: full_body,
 * mirror_selfie, close_up...). A diferencia de category/search_tags
 * (descartados en julio 2026 por no confiables, ver openBankFilter.ts),
 * cada grupo de palabras debe validarse con volumen real ANTES de usarse
 * (ver recipes/outfitMultiLook/contracts.ts para el caso real que motivó
 * esto). Devuelve mapa vacío (nunca lanza) si la llamada falla — mismo
 * contrato que fetchOutfitCheckPoseCandidates.
 */
export async function fetchPoseCandidatesByKeyword(
  keywordGroups: Record<string, string[]>,
  seed: string,
  perType: number = 3,
): Promise<Record<string, OutfitCheckPoseCandidate[]>> {
  if (Object.keys(keywordGroups).length === 0) return {};
  try {
    const res = await fetch(CONTENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body: JSON.stringify({
        action: 'getOutfitCheckPoseCandidates',
        payload: { poseKeywordGroups: keywordGroups, seed, perType },
      }),
    });
    if (!res.ok) {
      console.warn(`[outfitMultiLook] fetchPoseCandidatesByKeyword: el endpoint devolvió ${res.status}`);
      return {};
    }
    const data = await res.json();
    return (data?.candidatesByType && typeof data.candidatesByType === 'object') ? data.candidatesByType : {};
  } catch (err) {
    console.warn('[outfitMultiLook] fetchPoseCandidatesByKeyword: excepción en la llamada', err);
    return {};
  }
}

/**
 * Elige UN candidato determinístico de la lista (mismo shot del mismo brief
 * → mismo candidato, para que plan y prompt final no diverjan si se llama
 * más de una vez) — nunca aleatorio con Math.random(), mismo hashString que
 * ya usa el resto del banco.
 */
export function pickOneCandidate<T extends { itemId: string }>(
  candidates: T[],
  seedKey: string,
): T | null {
  if (candidates.length === 0) return null;
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % candidates.length;
  return candidates[idx];
}

/**
 * Traduce pose/gesto/mirada de un candidato real del banco a un bloque de
 * texto para inyectar en variationSpace/purpose de un shot — mismo
 * principio que keptElements en open_bank: se transfiere SOLO actitud
 * corporal/gesto/mirada, nunca el escenario, outfit ni iluminación del
 * candidato (eso lo resuelve el brief real + la referencia de outfit del
 * usuario). Sin candidato disponible, devuelve '' — el shot cae a su
 * variationSpace genérico ya validado, nunca se bloquea por esto.
 */
export function buildPoseAttitudeLine(candidate: OutfitCheckPoseCandidate | null): string {
  if (!candidate) return '';
  const parts = [candidate.pose, candidate.gesture, candidate.gaze].filter(Boolean);
  if (parts.length === 0) return '';
  return `REAL ATTITUDE REFERENCE (pose/gesture/gaze only — ignore any outfit, scene, or lighting implied by this description, those come from the brief and the outfit reference): ${parts.join(' — ')}`;
}
