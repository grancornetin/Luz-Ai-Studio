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

// Pool ampliado del que se muestrea al azar (ver pickWeightedSample) — sin
// esto, dos sesiones con un brief parecido ("cena en un rooftop" lo escriben
// muchas usuarias casi igual) siempre recortan al mismo top-12 exacto, y el
// director tiende a preferir el de mayor relevanceScore dentro de ese grupo
// — con un banco de 300+ fotos por tipo de shot, la riqueza real del banco
// nunca se explota, todas las sesiones ven variaciones del mismo puñado de
// candidatos. 40 sigue siendo liviano de puntuar (no es lo que causaba el
// timeout — eso era mandarlos TODOS a Gemini, no filtrarlos en código).
const SAMPLE_POOL_SIZE = 40;

/**
 * Elige `count` candidatos al azar de `scored`, dando más chance (no
 * garantía) a los de mayor score — evita que el pool final sea siempre
 * determinístico (mismo brief → mismos 12 candidatos → mismo elegido en
 * cada sesión), sin perder relevancia real: un candidato con score 0 no
 * entra al pool ampliado en primer lugar (ver filtro `score > 0` en el
 * caller), así que la aleatoriedad ocurre solo entre candidatos ya
 * relevantes al brief.
 */
function pickWeightedSample<T>(scored: Array<{ item: T; score: number }>, count: number): Array<{ item: T; score: number }> {
  if (scored.length <= count) return scored;
  const pool = [...scored];
  const picked: Array<{ item: T; score: number }> = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, c) => sum + c.score + 1, 0); // +1: score 0 también puede salir sorteado
    let roll = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      roll -= pool[idx].score + 1;
      if (roll <= 0) break;
    }
    picked.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
  }
  return picked;
}

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
      .slice(0, SAMPLE_POOL_SIZE);

    const sampled = pickWeightedSample(scored, MAX_CANDIDATES_PER_SHOT)
      .sort((a, b) => b.score - a.score); // reordenar por score para que el director siga viendo primero los más relevantes en el texto del prompt

    pools[shotType.id] = sampled.map(({ item, score }) => summarizeCandidate(item, score));
  }

  return pools;
}
