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

// Detección de "vetas de escena" reales dentro del banco — problema
// encontrado en sesión de investigación manual (13 ago 2026): el banco tiene
// bolsones de contenido temáticamente coherente (ej. 5 fotos consecutivas de
// club real con neón/láser, itemIds img_1785331443144 a _157) que
// buildWideCandidatePool NUNCA exponía al director, porque agrupa solo por
// shot_type y toma los primeros N candidatos por orden del banco — esas 5
// fotos de club estaban en la posición 143-182 dentro de su shot_type
// (medio_cuerpo/full_body), muy por detrás de cualquier maxPerType usado en
// producción (confirmado con datos: 0/5 entraban con maxPerType=25). El
// director nunca podía elegir lo que nunca veía, sin importar cuántas veces
// se corriera. Esta lista es un pre-filtro de texto simple (no reemplaza el
// juicio visual de Gemini, solo garantiza que la ESCENA llegue al panorama)
// — confirmado contra bank-snapshot.json que estas palabras aparecen en
// background_setting real, no son especulación.
const SCENE_KEYWORDS: Record<string, string[]> = {
  club_discoteca: ['discoteca', 'club nocturno', 'neón', 'neon', 'láser', 'laser', 'pista de baile', ' dj ', 'luces de fiesta'],
  auto_transicion: ['interior de un coche', 'interior de un vehículo', 'interior de un auto', 'asiento trasero', 'asiento del copiloto', 'asiento del conductor'],
  rooftop_terraza_nocturna: ['terraza', 'rooftop', 'azotea', 'balcón'],
  restaurante_bar_nocturno: ['restaurante', 'bar con', 'bar elegante', 'bar de'],
};

export function detectSceneTag(item: OpenBankAnalysisItem): string | null {
  const bg = (item.analysis.raw_visual_description?.background_setting || '').toLowerCase();
  for (const [tag, keywords] of Object.entries(SCENE_KEYWORDS)) {
    if (keywords.some(k => bg.includes(k))) return tag;
  }
  return null;
}

// Detección de "preparación en casa" — a diferencia de SCENE_KEYWORDS (que
// mira background_setting), esta señal vive en outfit_visible: bata,
// pijama, toalla. Encontrada al probar el filtro de tono ampliado (13 ago
// 2026, pedido del usuario de permitir bata/pijama en la etapa de
// preparación): con un brief que pedía explícitamente "recién duchada en
// bata", el director SÍ reconoció la regla en su razonamiento
// (discardedElements decía "reemplazar con una bata") pero no tenía ningún
// candidato real de bata en su panorama de 208 finalistas — mismo problema
// estructural que las escenas de club/auto/rooftop, resuelto con el mismo
// mecanismo: garantizar que la veta llegue al panorama sin depender del
// corte posicional de maxPerType.
const PREPARATION_OUTFIT_KEYWORDS = ['bata', 'pijama', 'toalla', 'albornoz', 'ropa de dormir'];

export function detectPreparationScene(item: OpenBankAnalysisItem): boolean {
  const outfit = (item.analysis.raw_visual_description?.outfit_visible || '').toLowerCase();
  return PREPARATION_OUTFIT_KEYWORDS.some(k => outfit.includes(k));
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

// Exportada (no solo local a este archivo) porque getOutfitCheckPoseCandidates
// (api/gemini/content.ts) la reusa para el mismo propósito — mezcla
// determinística por seed de sesión — sin duplicar la implementación.
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
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
 *
 * BUG REAL corregido (prueba 24, 27 ago 2026, diagnóstico del usuario): el
 * corte `< maxPerType` siempre tomaba los candidatos en el mismo orden fijo
 * del banco compilado — para un shotType con muchos más items reales que el
 * tope (ej. selfie_frontal: 118 reales, tope 25), el director SIEMPRE veía
 * exactamente los mismos primeros 25 en TODAS las sesiones, sin importar
 * cuántas veces se corriera, y por lo tanto tendía a repetir el mismo puñado
 * de poses de selfie una y otra vez — el banco tenía variedad real (~100
 * candidatos más) que nunca llegaba siquiera a mostrarse. Mismo patrón ya
 * identificado antes para "vetas de escena" (ver detectSceneTag/
 * detectPreparationScene abajo) pero sin resolver para el caso general del
 * corte por shotType. Fix: mezclar `usable` con un hash determinístico por
 * `seed` (mismo mecanismo que nightMoments.ts hashString/sort-by-hash-key)
 * ANTES de agrupar — con seed distinta cada sesión, cada corte de
 * maxPerType expone una porción distinta de los candidatos reales del
 * shotType, sin perder el control de tamaño del prompt.
 *
 * Además de por shotType, el pool incluye grupos extra por ESCENA detectada
 * (ver SCENE_KEYWORDS/detectSceneTag) con prefijo "escena:" — garantiza que
 * vetas de contenido temáticamente coherentes (club real, transición en
 * auto, rooftop de noche) lleguen al panorama aunque estén "enterradas" en
 * la cola de su shot_type y el corte por maxPerType las hubiera excluido.
 */
export function buildWideCandidatePool(
  bankItems: OpenBankAnalysisItem[],
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
      // Sin tope artificial: las vetas de escena son escasas por diseño
      // (confirmado: la más grande detectada tiene 5-6 items en todo el
      // banco), no hace falta recortarlas.
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
