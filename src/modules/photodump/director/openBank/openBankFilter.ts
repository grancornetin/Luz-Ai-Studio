/**
 * modules/photodump/director/openBank/openBankFilter.ts
 *
 * Filtro de candidatos del modo "banco abierto" — reemplaza el Punto E del
 * modo actual (bankFilter.ts) SOLO en esta rama aislada. Diferencia central,
 * confirmada con datos reales de esta sesión (840 items del banco
 * revisados a mano, pool por pool, contra el modo actual): el filtro de
 * texto libre (coincidencia de palabras sueltas) trae en la práctica entre
 * 60% y 100% de candidatos ajenos al tipo de shot pedido, porque nunca
 * consulta shot_type/companion_present/subjects_visible — las 3 únicas
 * señales confirmadas como estructuradas y confiables del banco
 * (interpreted_signals.category y search_tags tienen 300+ variantes sueltas
 * sin normalizar, no sirven como filtro duro, solo de matiz).
 *
 * Acá se invierte el orden: primero se filtra por señal estructurada
 * (shot_type normalizado), y el texto libre queda solo para el resumen
 * comprimido de cada candidato — nunca decide qué entra al panorama.
 */
import type { OpenBankAnalysisItem, WideCandidate, WideCandidatePool } from './openBankTypes';

// Variantes de naming reales detectadas en el banco (auditoría de esta
// sesión: ~15% de items usan una variante distinta al valor canónico) — no
// es una normalización genérica, son los casos puntuales confirmados contra
// bank-snapshot.json.
const CANONICAL_SHOT_TYPES: Record<string, string> = {
  medium_cuerpo: 'medio_cuerpo',
  'three-quarter_shot': 'three_quarter_shot',
};

export function normalizeShotType(raw: string | undefined | null): string {
  if (!raw || raw === 'undefined') return 'unknown';
  const s = raw.toLowerCase().trim().replace(/-/g, '_');
  return CANONICAL_SHOT_TYPES[s] || s;
}

function isUsable(item: OpenBankAnalysisItem): boolean {
  const prohibited = item.analysis.prohibited_commercial_signals;
  if (prohibited && prohibited !== 'ninguno' && prohibited !== null
      && !(Array.isArray(prohibited) && prohibited.length === 0)) {
    return false;
  }
  return true;
}

function briefSummary(item: OpenBankAnalysisItem): string {
  const d = item.analysis.raw_visual_description || {};
  const parts = [d.subject_gesture, d.background_setting].filter(Boolean).join(' — ');
  return parts.slice(0, 100);
}

function toWideCandidate(item: OpenBankAnalysisItem): WideCandidate {
  const d = item.analysis.raw_visual_description || {};
  return {
    itemId: item.itemId,
    shotType: normalizeShotType(d.shot_type),
    companionPresent: item.analysis.companion_present === true,
    subjectsVisible: d.subjects_visible ?? 1,
    briefSummary: briefSummary(item),
  };
}

/**
 * Arma el panorama amplio: TODO el banco utilizable, agrupado por shotType
 * normalizado, en formato comprimido (1 línea por candidato) — sin filtrar
 * por brief todavía (eso lo hace Gemini razonando sobre el panorama
 * completo, no un pre-filtro de texto libre que puede descartar candidatos
 * relevantes por casualidad de palabras, como ya se confirmó que pasa en el
 * modo actual). maxPerType acota cuántos candidatos de cada shotType entran
 * al panorama, para controlar tamaño de prompt sin perder cobertura de la
 * VARIEDAD de tipos (todo shotType con contenido real queda representado).
 */
export function buildWideCandidatePool(
  bankItems: OpenBankAnalysisItem[],
  maxPerType: number = 25,
): WideCandidatePool {
  const usable = bankItems.filter(isUsable);
  const pool: WideCandidatePool = {};

  for (const item of usable) {
    const candidate = toWideCandidate(item);
    if (!pool[candidate.shotType]) pool[candidate.shotType] = [];
    if (pool[candidate.shotType].length < maxPerType) {
      pool[candidate.shotType].push(candidate);
    }
  }

  return pool;
}

export function countWideCandidatePool(pool: WideCandidatePool): number {
  return Object.values(pool).reduce((sum, arr) => sum + arr.length, 0);
}
