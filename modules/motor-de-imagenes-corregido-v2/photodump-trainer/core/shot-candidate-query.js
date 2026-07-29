// Motor de composición: traduce un brief libre ("brunch en la playa") a criterios de
// búsqueda, y devuelve candidatos de shot rankeados desde el banco ya analizado.
//
// Implementa la primera versión real de buildShotCandidates() diseñado conceptualmente
// en src/modules/photodump/recipes/manifiesto de direccion/08_knowledge_bank_query_design.md

const vertex = require('../../vertex-client');
const store = require('./store');
const { getRecipeTemplate, isExcludedPrimitive } = require('./recipe-templates');
const { normalizeCategory } = require('./category-normalizer');

const BRIEF_TO_QUERY_PROMPT = `Eres un traductor de briefs de contenido a criterios de búsqueda estructurados.

Recibirás un brief corto en lenguaje natural (ej. "brunch en la playa", "night out elegante en un rooftop") y debés traducirlo a un objeto JSON con estos campos, basándote SOLO en lo que el brief implica razonablemente:

{
  "setting_keywords": [string],       // lugares/ambientes que implica el brief (ej. ["playa", "exterior", "restaurante"])
  "activity_keywords": [string],      // actividades que implica (ej. ["comida_bebida", "brunch", "socializar"])
  "product_categories": [string],     // SOLO de este enum: outfit | calzado | bolsos | joyeria | maquillaje | skincare | cabello | tecnologia | papeleria | mobiliario | comida_bebida | ninguno
  "time_of_day_guess": string,        // "día" | "noche" | "atardecer" | "no_determinable"
  "mood_keywords": [string]           // adjetivos de intención/mood que implica (ej. ["relajado", "aspiracional", "casual"])
}

Responde solo el JSON, sin texto adicional.`;

async function translateBriefToQuery(brief) {
  const result = await vertex.generateAnthropicCompatible({
    system: BRIEF_TO_QUERY_PROMPT,
    messages: [{ role: 'user', content: brief }],
    response_mime_type: 'application/json',
    max_tokens: 500
  });
  const text = (result.content || []).map(b => b.text || '').join('');
  return JSON.parse(text);
}

// Puntaje de cuánto matchea un item del banco contra la query traducida.
// No es exacto/booleano — suma señales parciales, porque el vocabulario del banco
// (setting, activity_context) es texto libre normalizado, no un enum cerrado total.
function scoreItemAgainstQuery(item, analysis, query) {
  let score = 0;
  const matchedOn = [];

  const settingTags = (analysis.search_tags?.setting || []).map(s => s.toLowerCase());
  const activityContext = (analysis.search_tags?.activity_context || '').toLowerCase();
  const categories = analysis.search_tags?.product_categories_present || [];

  query.setting_keywords.forEach(kw => {
    if (settingTags.some(tag => tag.includes(kw.toLowerCase()) || kw.toLowerCase().includes(tag))) {
      score += 3;
      matchedOn.push(`setting:${kw}`);
    }
  });

  query.activity_keywords.forEach(kw => {
    if (activityContext.includes(kw.toLowerCase())) {
      score += 3;
      matchedOn.push(`activity:${kw}`);
    }
  });

  query.product_categories.forEach(cat => {
    if (categories.includes(cat)) {
      score += 2;
      matchedOn.push(`category:${cat}`);
    }
  });

  if (query.time_of_day_guess && query.time_of_day_guess !== 'no_determinable') {
    if ((analysis.search_tags?.time_of_day_guess || '').includes(query.time_of_day_guess)) {
      score += 1;
      matchedOn.push('time_of_day');
    }
  }

  return { score, matchedOn };
}

// Devuelve, para cada señal (interpreted_signal) de cada imagen aprobada del banco,
// un candidato con su score de relevancia contra la query — no imágenes enteras,
// SEÑALES individuales, porque eso es lo recombinable de verdad.
async function buildShotCandidates(brief, { onlyApproved = true, minScore = 1, alreadyUsedPrimitives = [] } = {}) {
  const query = await translateBriefToQuery(brief);
  const bank = store.loadBank();

  const usedSet = new Set(alreadyUsedPrimitives);
  const candidates = [];

  bank.items.forEach(item => {
    if (item.status !== 'done') return;
    if (onlyApproved && item.review !== 'approved') return;

    const entry = store.loadAnalysis(item.id);
    if (!entry || !entry.analysis) return;
    const analysis = entry.analysis;

    const { score: itemScore, matchedOn } = scoreItemAgainstQuery(item, analysis, query);
    if (itemScore < minScore) return;

    // El banco existe para entrenar contenido tipo cámara-roll de celular, nunca editorial/estudio —
    // una señal cuya foto de origen tiene iluminación de estudio armada arrastraría ese look si se
    // recombina literalmente, así que se descarta como candidato (aunque el resto del análisis sirva).
    const captureSignature = analysis.search_tags?.capture_signature || analysis.raw_visual_description?.capture_signature;
    if (captureSignature === 'studio_lighting_setup') return;

    // Descarta imágenes donde el propio análisis marcó una fuga de marca en
    // prohibited_commercial_signals (ej. "logo de sirena verde visible") — en esos casos el
    // resto de raw_visual_description (visible_objects) a veces repite el detalle igual, y
    // no hay forma confiable de limpiar el texto sin arriesgar dejar pasar el logo al prompt
    // final. Es ~3% del banco (17/575) — mejor descartar la imagen entera que filtrar el texto.
    const prohibited = (analysis.prohibited_commercial_signals || '').toLowerCase().trim();
    if (prohibited && prohibited !== 'ninguno') return;

    (analysis.interpreted_signals || []).forEach(signal => {
      if (usedSet.has(signal.reusable_primitive)) return; // control de diversidad básico
      // Fotos "a medio paso" no se ven orgánicas — se descartan como candidato en toda receta,
      // no solo night_out (ver recipe-templates.js para el criterio completo).
      if (isExcludedPrimitive(signal.reusable_primitive)) return;

      const bestUse = (signal.uses || []).sort((a, b) => b.fit - a.fit)[0];
      // Se guardan TODAS las uses (no solo la de mejor fit) para poder filtrar por receta
      // específica en buildRecipeStory sin perder candidatos donde esa receta no era la top.
      candidates.push({
        itemId: item.id,
        sourceName: item.name,
        matchScore: itemScore,
        matchedOn,
        signal: signal.signal,
        category: normalizeCategory(signal.category),
        rawCategory: signal.category,
        reusablePrimitive: signal.reusable_primitive,
        narrativeBeatFit: analysis.search_tags?.narrative_beat_fit || [],
        setting: analysis.search_tags?.setting || [],
        timeOfDayGuess: analysis.search_tags?.time_of_day_guess || 'no_determinable',
        fit: bestUse ? bestUse.fit : null,
        recipe: bestUse ? bestUse.recipe : null,
        allUses: signal.uses || [],
        condition: bestUse ? bestUse.condition : null,
        captureSignature,
        rawVisualDescription: analysis.raw_visual_description
      });
    });
  });

  candidates.sort((a, b) => (b.matchScore + (b.fit || 0) / 10) - (a.matchScore + (a.fit || 0) / 10));

  return { query, candidates };
}

const MAX_POOL_PER_SHOT = 6;

// Arma los POOLS de candidatos por shot (no un ganador único) según la plantilla de roles
// narrativos de la receta — el recorte por señales (receta, categoría, exclusiones) queda
// acá; la decisión final de QUÉ combinación tiene sentido como conjunto (variedad, coherencia
// física entre pose y escenario) se delega al director creativo (creative-director.js), que
// ve los 7 pools juntos en una sola llamada, no shot por shot aislado.
async function buildShotPools(brief, recipeName, { onlyApproved = true } = {}) {
  const template = getRecipeTemplate(recipeName);
  if (!template) throw new Error(`No hay plantilla definida para la receta "${recipeName}"`);

  const { query, candidates } = await buildShotCandidates(brief, { onlyApproved, minScore: 0 });

  function passesExclusions(c) {
    if (template.excludeSignalCategories?.includes(c.category)) return false;
    if (template.excludePrimitivePatterns?.some(p => (c.reusablePrimitive || '').includes(p))) return false;
    return true;
  }

  // Candidatos que sirven para ESTA receta específica (alguna de sus uses[] apunta a recipeName),
  // salvo exclusiones explícitas de la plantilla (ej. preparación en night_out).
  const strictRecipeCandidates = candidates.filter(c =>
    (c.allUses || []).some(u => u.recipe === recipeName) && passesExclusions(c)
  );

  // Pool ampliado por MECÁNICA (no por receta ni hora del día): el `condition` de una señal
  // de categoría "prop" (ej. "sostener un cóctel") ya declara explícitamente qué es
  // intercambiable — normalmente "cambiar: el tipo de bebida" — y ESO incluye la hora del
  // día y el tipo de trago/vaso específico. Una señal de café de mediodía etiquetada como
  // day_in_life sirve igual para night_out: la mecánica de "sostener/mostrar una bebida en
  // primer plano" no depende de si el original era de noche o de día. Se acepta cualquier
  // señal de las categorías preferidas de la plantilla, sin filtrar por receta ni horario.
  const contextCandidates = candidates.filter(c => passesExclusions(c));

  const shotPools = template.shots.map(shotSpec => {
    let pool = strictRecipeCandidates.filter(c => c.narrativeBeatFit.includes(shotSpec.role));

    if (shotSpec.preferCategories?.length) {
      let preferred = pool.filter(c => shotSpec.preferCategories.includes(c.category));
      if (preferred.length < 3 && contextCandidates.length) {
        const fromContext = contextCandidates.filter(c =>
          shotSpec.preferCategories.includes(c.category) &&
          c.narrativeBeatFit.includes(shotSpec.role)
        );
        preferred = [...preferred, ...fromContext.filter(c => !preferred.some(p => p.itemId === c.itemId))];
      }
      pool = preferred;
    }

    const settingExclusions = [...(template.excludeSettingKeywords || []), ...(shotSpec.excludeSettingKeywords || [])];
    if (!shotSpec.needsScene && settingExclusions.length) {
      pool = pool.filter(c => !c.setting.some(s =>
        settingExclusions.some(kw => s.toLowerCase().includes(kw.toLowerCase()))
      ));
    }

    pool.sort((a, b) => (b.matchScore + (b.fit || 0) / 10) - (a.matchScore + (a.fit || 0) / 10));

    // Candidatos de escenario aparte, para shots que necesitan combinar pose + escena distinta
    // (needsScene: true) — el director creativo recibe ambos pools y decide la combinación.
    let scenePool = [];
    if (shotSpec.needsScene) {
      scenePool = candidates.filter(c =>
        c.category === 'escena_mundo' &&
        !(template.excludeSettingKeywords || []).some(kw => c.setting.some(s => s.toLowerCase().includes(kw.toLowerCase()))) &&
        (!template.validSettings?.length || c.setting.some(s => template.validSettings.some(kw => s.toLowerCase().includes(kw.toLowerCase()))))
      );
      scenePool.sort((a, b) => (b.fit || 0) - (a.fit || 0));
    }

    return {
      shotId: shotSpec.id,
      role: shotSpec.role,
      note: shotSpec.note,
      needsScene: !!shotSpec.needsScene,
      sceneGroup: shotSpec.sceneGroup || 'main_venue',
      pool: pool.slice(0, MAX_POOL_PER_SHOT),
      scenePool: scenePool.slice(0, MAX_POOL_PER_SHOT),
    };
  });

  return { query, recipe: recipeName, template, shotPools };
}

module.exports = { translateBriefToQuery, buildShotCandidates, buildShotPools };
