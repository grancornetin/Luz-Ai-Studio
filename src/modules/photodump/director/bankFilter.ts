/**
 * modules/photodump/director/bankFilter.ts
 *
 * Punto E del diagrama del usuario: primer barrido al banco, sin IA — reduce
 * las ~840 imágenes aprobadas a un pool manejable por shot, ANTES de
 * gastarlas en la llamada a Gemini (Punto F/G). Portado desde
 * scripts/photodump-director/bankFilter.js (ver ese archivo para el
 * historial completo de por qué NO se filtra por category/reusable_primitive
 * de forma estricta, ni por uses[].recipe como filtro excluyente).
 *
 * Corre server-side (importado por api/photodump/director.ts) — no forma
 * parte del bundle del cliente. Vive en src/modules/photodump/director/
 * junto al resto de tipos/contrato/reglas del director porque es lógica de
 * negocio pura (transformación de datos), agnóstica de dónde corre.
 */
import type { BankAnalysisItem, CandidateSummary, RecipeContract, ShotPools } from './types';

// Bajado de 40 a 12: con 1 shot fijo + 9 tipos rotables, 40 candidatos por
// tipo (cada uno con pose/gesto/mirada/outfit/objetos/fondo/luz/encuadre/
// señales en texto) armaba un prompt de "Decidir" enorme — causa real de los
// 504 (timeout) vistos en producción. 12 sigue dando variedad real de
// candidatos por shot sin disparar la duración de la llamada a Gemini.
const MAX_CANDIDATES_PER_SHOT = 12;

function normalizeText(s: string | undefined | null): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractKeywords(brief: string): string[] {
  const stopwords = new Set(['de', 'en', 'la', 'el', 'un', 'una', 'con', 'para', 'y', 'los', 'las', 'del']);
  return normalizeText(brief)
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
}

function scoreItemForShot(item: BankAnalysisItem, briefKeywords: string[], nightMomentDescription: string): number {
  const searchableText = normalizeText([
    ...(item.analysis.interpreted_signals || []).flatMap(sig => [
      sig.category, sig.reusable_primitive, sig.signal,
    ]),
    ...(item.analysis.search_tags?.setting || []),
    item.analysis.raw_visual_description?.background_setting,
    item.analysis.raw_visual_description?.subject_pose,
  ].filter(Boolean).join(' '));

  let score = 0;
  for (const kw of briefKeywords) {
    if (searchableText.includes(kw)) score += 1;
  }

  const momentKeywords = extractKeywords(nightMomentDescription);
  for (const kw of momentKeywords) {
    if (searchableText.includes(kw)) score += 1;
  }

  return score;
}

function summarizeCandidate(item: BankAnalysisItem, relevanceScore: number): CandidateSummary {
  return {
    itemId: item.itemId,
    relevanceScore,
    pose: item.analysis.raw_visual_description?.subject_pose,
    gesture: item.analysis.raw_visual_description?.subject_gesture,
    gaze: item.analysis.raw_visual_description?.subject_gaze,
    outfit: item.analysis.raw_visual_description?.outfit_visible,
    objects: item.analysis.raw_visual_description?.visible_objects,
    background: item.analysis.raw_visual_description?.background_setting,
    lighting: item.analysis.raw_visual_description?.lighting,
    cameraFraming: item.analysis.raw_visual_description?.camera_framing,
    companionPresent: item.analysis.companion_present,
    signals: (item.analysis.interpreted_signals || []).map(sig => ({
      signal: sig.signal,
      category: sig.category,
      reusablePrimitive: sig.reusable_primitive,
      conditions: (sig.uses || []).map(u => u.condition).filter((c): c is string => Boolean(c)),
    })),
  };
}

/**
 * Devuelve, por cada tipo de shot (fijo + banco rotable), un pool acotado de
 * candidatos del banco — ordenados por relevancia laxa, sin excluir nada por
 * receta. Cada candidato viaja resumido para no encarecer la llamada
 * siguiente.
 */
export function buildShotPools(bankItems: BankAnalysisItem[], brief: string, recipeContract: RecipeContract): ShotPools {
  const briefKeywords = extractKeywords(brief);
  const shotTypes = [...(recipeContract.fixedShotTypes || []), ...(recipeContract.nightMomentTypes || [])];
  const pools: ShotPools = {};

  for (const shotType of shotTypes) {
    const scored = bankItems
      .filter(item => {
        const prohibited = item.analysis.prohibited_commercial_signals;
        if (prohibited && prohibited !== 'ninguno' && prohibited !== null
            && !(Array.isArray(prohibited) && prohibited.length === 0)) {
          return false;
        }
        return true;
      })
      .map(item => ({ item, score: scoreItemForShot(item, briefKeywords, shotType.description) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CANDIDATES_PER_SHOT);

    pools[shotType.id] = scored.map(({ item, score }) => summarizeCandidate(item, score));
  }

  return pools;
}
