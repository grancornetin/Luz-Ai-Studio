/**
 * modules/photodump/director/generic/genericFilter.ts
 *
 * Filtro de candidatos del Director Creativo genérico — portado sin
 * cambios de lógica desde director/openBank/openBankFilter.ts (ese archivo
 * era ya 100% agnóstico de receta, no tenía nada específico de
 * outfit_night_out; el único cambio acá es el nombre de los tipos
 * importados, de OpenBank* a Generic*). Ver ese archivo original para el
 * historial completo de por qué se filtra por shot_type normalizado y no
 * por category/search_tags de texto libre.
 */
import type { GenericAnalysisItem, WideCandidate, WideCandidatePool } from './genericTypes';

const CANONICAL_SHOT_TYPES: Record<string, string> = {
  medium_cuerpo: 'medio_cuerpo',
  'three-quarter_shot': 'three_quarter_shot',
};

export function normalizeShotType(raw: string | undefined | null): string {
  if (!raw || raw === 'undefined') return 'unknown';
  const s = raw.toLowerCase().trim().replace(/-/g, '_');
  return CANONICAL_SHOT_TYPES[s] || s;
}

function isUsable(item: GenericAnalysisItem): boolean {
  const prohibited = item.analysis.prohibited_commercial_signals;
  if (prohibited && prohibited !== 'ninguno' && prohibited !== null
      && !(Array.isArray(prohibited) && prohibited.length === 0)) {
    return false;
  }
  return true;
}

function briefSummary(item: GenericAnalysisItem): string {
  const d = item.analysis.raw_visual_description || {};
  const parts = [d.subject_gesture, d.background_setting].filter(Boolean).join(' — ');
  return parts.slice(0, 100);
}

// Detección de "vetas de escena" reales dentro del banco — ver historial
// completo en el openBankFilter.ts original (sesión 13 ago 2026). Lista
// deliberadamente genérica (no atada a night_out): un candidato de
// escena:club_discoteca o escena:auto_transicion sirve igual para cualquier
// receta cuyo brief mencione ese contexto.
const SCENE_KEYWORDS: Record<string, string[]> = {
  club_discoteca: ['discoteca', 'club nocturno', 'neón', 'neon', 'láser', 'laser', 'pista de baile', ' dj ', 'luces de fiesta'],
  auto_transicion: ['interior de un coche', 'interior de un vehículo', 'interior de un auto', 'asiento trasero', 'asiento del copiloto', 'asiento del conductor'],
  rooftop_terraza_nocturna: ['terraza', 'rooftop', 'azotea', 'balcón'],
  restaurante_bar_nocturno: ['restaurante', 'bar con', 'bar elegante', 'bar de'],
};

export function detectSceneTag(item: GenericAnalysisItem): string | null {
  const bg = (item.analysis.raw_visual_description?.background_setting || '').toLowerCase();
  for (const [tag, keywords] of Object.entries(SCENE_KEYWORDS)) {
    if (keywords.some(k => bg.includes(k))) return tag;
  }
  return null;
}

const PREPARATION_OUTFIT_KEYWORDS = ['bata', 'pijama', 'toalla', 'albornoz', 'ropa de dormir'];

export function detectPreparationScene(item: GenericAnalysisItem): boolean {
  const outfit = (item.analysis.raw_visual_description?.outfit_visible || '').toLowerCase();
  return PREPARATION_OUTFIT_KEYWORDS.some(k => outfit.includes(k));
}

function toWideCandidate(item: GenericAnalysisItem): WideCandidate {
  const d = item.analysis.raw_visual_description || {};
  return {
    itemId: item.itemId,
    shotType: normalizeShotType(d.shot_type),
    companionPresent: item.analysis.companion_present === true,
    subjectsVisible: d.subjects_visible ?? 1,
    briefSummary: briefSummary(item),
  };
}

// Exportada — genericPromptBuilders.ts (o cualquier caller server-side que
// necesite mezcla determinística por seed) la reusa en vez de duplicarla.
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function buildWideCandidatePool(
  bankItems: GenericAnalysisItem[],
  maxPerType: number = 25,
  seed?: string,
): WideCandidatePool {
  const usableUnordered = bankItems.filter(isUsable);
  const usable = seed
    ? usableUnordered
        .map(item => ({ item, key: hashString(`${seed}::widepool::${item.itemId}`) }))
        .sort((a, b) => a.key - b.key)
        .map(({ item }) => item)
    : usableUnordered;
  const pool: WideCandidatePool = {};

  for (const item of usable) {
    const candidate = toWideCandidate(item);
    if (!pool[candidate.shotType]) pool[candidate.shotType] = [];
    if (pool[candidate.shotType].length < maxPerType) {
      pool[candidate.shotType].push(candidate);
    }

    const sceneTag = detectSceneTag(item);
    if (sceneTag) {
      const key = `escena:${sceneTag}`;
      if (!pool[key]) pool[key] = [];
      pool[key].push(candidate);
    }

    if (detectPreparationScene(item)) {
      const key = 'escena:preparacion_bata_toalla';
      if (!pool[key]) pool[key] = [];
      pool[key].push(candidate);
    }
  }

  return pool;
}

export function countWideCandidatePool(pool: WideCandidatePool): number {
  return Object.values(pool).reduce((sum, arr) => sum + arr.length, 0);
}
