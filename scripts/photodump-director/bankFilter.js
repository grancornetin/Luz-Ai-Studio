/**
 * scripts/photodump-director/bankFilter.js
 *
 * Punto E del diagrama del usuario: primer barrido al banco, sin IA — reduce
 * las ~840 imágenes aprobadas a un pool manejable por shot, ANTES de
 * gastarlas en la llamada a Gemini (Punto F/G). Es un filtro amplio y
 * permisivo, no una decisión fina — esa parte queda para el razonamiento de
 * Gemini, que sí puede entender matices de texto libre.
 *
 * Por qué no se filtra por category/reusable_primitive de forma estricta:
 * confirmado sobre el banco real que `category` tiene 372 variantes de texto
 * libre sin normalizar (ej. "accesorio"/"accesorios"/"accessory" son el
 * mismo concepto escrito distinto) — un matching exacto de texto perdería
 * señales reales por variación de escritura. El único campo realmente
 * controlado es `search_tags.narrative_beat_fit` (8 valores fijos), así que
 * es el filtro duro; el resto (category, reusable_primitive, setting, el
 * texto de `signal`) se usa como coincidencia laxa de palabras clave, solo
 * para acotar el volumen — la decisión fina de qué es transferible queda
 * para el razonamiento de Gemini en la llamada "Decidir".
 *
 * IMPORTANTE (corrección ya confirmada en esta sesión): NUNCA filtrar de
 * forma excluyente por `uses[].recipe === recipeActual` — eso pierde
 * señales reales que son mecánicamente transferibles pero fueron etiquetadas
 * bajo otra receta (ej. una pose de "brindis" analizada para day_in_life
 * sirve igual para outfit_night_out). El campo recipe solo se usa como
 * empate/desempate de puntuación, nunca como filtro que excluye candidatos.
 */

const MAX_CANDIDATES_PER_SHOT = 40;

function normalizeText(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, ''); // sin acentos
}

function extractKeywords(brief) {
  const stopwords = new Set(['de', 'en', 'la', 'el', 'un', 'una', 'con', 'para', 'y', 'los', 'las', 'del']);
  return normalizeText(brief)
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
}

/**
 * Puntúa qué tan relevante es un item del banco para un shot dado, sumando
 * coincidencias laxas de palabras clave del brief contra category,
 * reusable_primitive, signal, y setting de cada interpreted_signal.
 */
function scoreItemForShot(item, briefKeywords, nightMomentDescription) {
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

/**
 * Devuelve, por cada tipo de momento/shot del contrato de receta, un pool
 * acotado de candidatos del banco — ordenados por relevancia laxa, sin
 * excluir nada por receta. Cada candidato viaja resumido (no el análisis
 * completo) para no encarecer la llamada siguiente.
 */
export function buildShotPools(bankItems, brief, recipeContract) {
  const briefKeywords = extractKeywords(brief);

  const shotTypes = [
    ...(recipeContract.fixedShotTypes || []),
    ...(recipeContract.nightMomentTypes || []),
  ];
  const pools = {};

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
      .map(item => ({
        item,
        score: scoreItemForShot(item, briefKeywords, shotType.description),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CANDIDATES_PER_SHOT);

    pools[shotType.id] = scored.map(({ item, score }) => summarizeCandidate(item, score));
  }

  return pools;
}

/**
 * Resumen liviano de un candidato — lo que efectivamente se manda a Gemini.
 * Se omiten campos que no aportan a la decisión (usage, elapsedMs, etc.) y
 * se recorta interpreted_signals a lo esencial para no inflar tokens.
 */
function summarizeCandidate(item, relevanceScore) {
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
      conditions: (sig.uses || []).map(u => u.condition),
    })),
    searchTags: item.analysis.search_tags,
  };
}
