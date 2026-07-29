// Director Creativo: Gemini razona la historia completa de una receta en DOS pasos —
// decidir la combinación de piezas por shot, y luego redactar el prompt final por shot —
// en vez de que el motor "gane" candidatos por score numérico y los concatene mecánicamente.
//
// Por qué existe: un ranking por fit/matchScore no entiende que una pose sentada en un sofá
// bajo es físicamente incompatible con un escenario de barra alta de pie, o que dos shots
// seguidos con el mismo restaurante de fondo se ven repetitivos aunque cada uno por separado
// tenga buen fit. Eso requiere razonamiento, no aritmética — por eso Gemini ve los 7 shots
// (con sus pools de candidatos) DE UNA VEZ y decide la combinación como lo haría un director
// real: qué pose+outfit+escenario+luz tiene sentido junto, evitando repetir escenario/pose,
// nunca mencionando marcas, y nunca describiendo interfaz de cámara/apps en el resultado.
//
// Por qué DOS pasos (decidir / redactar) y no uno: en pruebas reales, pedirle a Gemini que
// devuelva 7 objetos con decisión + reasoning + finalPrompt de ~150 palabras cada uno en una
// sola respuesta causaba que omitiera un shotId completo del array (siempre el mismo, el más
// ambiguo — venue_scenic_moment, el que no tiene scenePool propio). Separar "decidir" (array
// corto de ids) de "redactar" (un prompt por decisión ya tomada) reduce la carga por llamada
// y baja la probabilidad de que se pierda un shot completo.

const vertex = require('../../vertex-client');

const DECIDE_SYSTEM_PROMPT = `Eres el Director Creativo de un motor de composición de fotos para contenido tipo "cámara-roll real de Instagram/iPhone" — nunca editorial ni publicitario.

Tu trabajo en este paso: para cada shot de una historia de N fotos, ELEGIR la mejor combinación de piezas del banco (pose/outfit de una señal + escenario/luz de otra, cuando corresponda). NO escribas el prompt final todavía — solo la decisión y el razonamiento.

# Reglas no negociables

1. **Coherencia física real**: la pose elegida debe ser físicamente posible en el escenario elegido (ej. una pose de "sentada con piernas cruzadas en banco bajo" no combina con un escenario de "parada en barra alta de pie"). Si ningún par pose+escenario del pool tiene sentido físico, elige la combinación más plausible — la redacción final resolverá la tensión después.
2. **Variedad de POSE entre shots, pero CONTINUIDAD DE MUNDO dentro del mismo sceneGroup**: cada shot trae un \`sceneGroup\` (ej. "main_venue", "transition"). Todos los shots que comparten el mismo sceneGroup deben usar el MISMO venue — mismo estilo decorativo, misma paleta de iluminación, misma identidad de lugar — como si fueran fotos tomadas la misma noche, en el mismo sitio. NO inventes un venue nuevo para cada shot del mismo grupo, aunque el pool de escenarios ofrezca variedad. Un sceneGroup distinto (ej. "transition") SÍ puede ser un lugar físicamente distinto, porque representa una transición legítima (ej. saliendo del lugar, camino de vuelta).
   - Procedimiento: para el PRIMER shot de cada sceneGroup (por orden de aparición), elegí el escenario del scenePool que mejor establece el venue — ese es el "escenario ancla" del grupo. Para el resto de los shots del MISMO sceneGroup, reusá ese mismo escenario ancla en vez de elegir uno distinto del pool aunque tenga mejor fit numérico.
   - Reportá en \`sceneAnchorId\` el itemId del escenario ancla que usaste para cada shot (el mismo valor para todos los shots de un mismo sceneGroup).
   - **Sub-zonas dentro del mismo venue**: un venue real de salida nocturna tiene varios rincones (la barra, una mesa, la pista, la entrada, la terraza) — la gente se mueve entre ellos durante la noche. Si mantener a la persona SIEMPRE en la posición exacta del escenario ancla obliga a repetir la misma composición shot tras shot, está permitido ubicarla en OTRA sub-zona plausible del mismo venue en vez de forzar el mismo encuadre — esto se resuelve en el razonamiento, el paso de redacción se encarga de la frase exacta.
   - Esta técnica es experimental; usala solo cuando el shot realmente lo pide (ej. un shot de "mesa compartida" cuando el venue ancla es una barra), no como variación gratuita.
3. **Usa el campo \`condition\` de cada señal** (dice "mantener: X; cambiar: Y") como guía de qué es intercambiable y qué no.
4. **Nunca repitas la misma señal (mismo itemId) como \`chosenPoseItemId\` en dos shots distintos de la misma historia** — aunque dos shots parezcan pedir lo mismo (ej. dos shots de "detalle del venue"), cada uno debe usar una señal DIFERENTE del pool para asegurar variedad visual real entre fotos de la misma historia.

# Obligatorio: un elemento por cada shot recibido, sin excepción

El array \`shots\` de tu respuesta debe tener EXACTAMENTE un elemento por cada shotId que recibiste en la entrada — ni uno menos. Si un shot te resulta difícil (pools chicos, poca variedad restante), igual debés elegir la mejor opción disponible y completarlo — nunca omitas un shotId del array de salida. Este paso es más liviano que redactar el prompt completo — no tenés excusa para omitir un shot acá.

# Formato de salida

Responde SOLO un JSON con esta forma exacta:
{
  "shots": [
    {
      "shotId": string,
      "chosenPoseItemId": string | null,       // itemId de la señal de pose/outfit elegida del pool
      "chosenSceneItemId": string | null,       // itemId de la señal de escenario elegida (null si needsScene es false o no aplica)
      "sceneAnchorId": string | null,           // itemId del escenario ancla del sceneGroup de este shot — MISMO valor para todos los shots del mismo sceneGroup
      "subZoneNote": string | null,             // si aplica sub-zona distinta al ancla (ej. "sentada en una mesa, no en la barra"), describilo brevemente en 1 frase; si no aplica, null
      "reasoning": string                       // 1 frase: por qué esta combinación tiene sentido físico y de variedad
    }
  ]
}`;

const WRITE_SYSTEM_PROMPT = `Eres el redactor de prompts de un motor de composición de fotos para contenido tipo "cámara-roll real de Instagram/iPhone" — nunca editorial ni publicitario.

Recibirás, para cada shot de una historia ya decidida, la señal de pose elegida, la señal de escenario elegida (si aplica), el sceneAnchorId compartido del grupo, y una nota de sub-zona si el director la dejó. Tu trabajo es escribir el \`finalPrompt\` de cada shot.

# Reglas no negociables

1. **Nunca menciones marcas, logos, ni texto de marca reconocible** — ni en el prompt final ni al describir objetos (ej. "vaso con logo de sirena verde" debe convertirse en "vaso genérico" o eliminarse esa mención).
2. **Nunca describas interfaz de cámara, apps, botones, timestamps, ni overlays de redes sociales** — es una foto real, no una captura de pantalla de una app de cámara.
3. **Nunca incluyas objetos del FONDO de la foto original de la pose si el escenario elegido es distinto** (ej. si la pose viene de una foto en un estacionamiento pero el escenario elegido es un bar, no menciones "autos estacionados" ni "tuberías del techo" — esos elementos pertenecían al fondo original, no viajan con la pose).
4. **Todos los shots que comparten sceneAnchorId deben describir el MISMO venue** — mismo estilo decorativo, misma paleta de iluminación — aunque el ángulo, la pose o la sub-zona cambien.
5. **Sub-zonas dentro del mismo venue**: si el shot trae \`subZoneNote\` (ej. "sentada en una mesa, no en la barra"), describí a la persona YA INSTALADA en esa sub-zona ("now seated at a table inside the same restaurant", "standing near the entrance of the same bar") — NUNCA con verbo de tránsito ("walking to", "moving towards", "heading over"): eso genera poses de "medio paso" no orgánicas, o fuerza un plano tan abierto que la persona se ve pequeña y pierde protagonismo. Ancla siempre la frase a "the same [venue]" para no perder la identidad del lugar, pero el verbo debe ser de estado ("is now sitting/standing at"), nunca de movimiento.
6. Cada prompt final debe describir: estilo de captura (celular, luz natural, sin UI de cámara), pose/gesto/mirada, outfit, escenario, iluminación — TODO en inglés, listo para un generador de imágenes tipo Midjourney/Higgsfield. Nunca mezcles español en el finalPrompt.

# Obligatorio: un finalPrompt por cada shot recibido, sin excepción

# Formato de salida

Responde SOLO un JSON con esta forma exacta:
{
  "shots": [
    { "shotId": string, "finalPrompt": string }
  ]
}`;

// Reduce cada candidato a solo lo que Gemini necesita para razonar — evita mandar el
// raw_visual_description completo de 6 candidatos x 7 shots (carísimo en tokens); solo lo
// esencial para decidir coherencia física y redactar el prompt.
function summarizeCandidate(c) {
  if (!c) return null;
  const raw = c.rawVisualDescription || {};
  return {
    itemId: c.itemId,
    signal: c.signal,
    reusablePrimitive: c.reusablePrimitive,
    category: c.category,
    fit: c.fit,
    condition: c.condition,
    captureSignature: c.captureSignature,
    pose: raw.subject_pose,
    gesture: raw.subject_gesture,
    gaze: raw.subject_gaze,
    outfit: raw.outfit_visible,
    framing: raw.camera_framing,
    setting: raw.background_setting,
    lighting: raw.lighting,
  };
}

function buildDecideUserPrompt(brief, recipeName, shotPools) {
  const shotsPayload = shotPools.map(sp => ({
    shotId: sp.shotId,
    role: sp.role,
    note: sp.note,
    sceneGroup: sp.sceneGroup || 'main_venue',
    needsScene: sp.needsScene,
    posePool: sp.pool.map(summarizeCandidate),
    scenePool: sp.needsScene ? sp.scenePool.map(summarizeCandidate) : [],
  }));

  return JSON.stringify({
    brief,
    recipe: recipeName,
    instructions: 'Para cada shot, elegí una señal de posePool (y de scenePool si needsScene es true). Si needsScene es false, el escenario ya viene incluido en la señal elegida de posePool. Shots con el mismo sceneGroup deben usar el MISMO escenario ancla (ver regla 2).',
    shots: shotsPayload,
  }, null, 1);
}

async function callGemini(system, userPrompt, maxTokens) {
  const result = await vertex.generateAnthropicCompatible({
    system,
    messages: [{ role: 'user', content: userPrompt }],
    response_mime_type: 'application/json',
    max_tokens: maxTokens,
  });
  const text = (result.content || []).map(b => b.text || '').join('');
  if (process.env.DIRECTOR_DEBUG) console.error(`--- RAW RESPONSE (${system === DECIDE_SYSTEM_PROMPT ? 'DECIDE' : 'WRITE'}) ---\n`, text, '\n--- END ---');
  return JSON.parse(text);
}

// Paso 1: decidir qué señales combina cada shot (sin redactar el prompt todavía).
async function decideStory(brief, recipeName, shotPools) {
  const userPrompt = buildDecideUserPrompt(brief, recipeName, shotPools);
  const parsed = await callGemini(DECIDE_SYSTEM_PROMPT, userPrompt, 4000);

  const missingShotIds = shotPools
    .map(sp => sp.shotId)
    .filter(id => !(parsed.shots || []).some(s => s.shotId === id));

  // El director puede omitir algún shotId a pesar de la instrucción — se corrige con un
  // fallback mecánico de DECISIÓN (elige el mejor candidato por fit, hereda el ancla de
  // escena del grupo si ya existe). El paso de redacción trata este shot igual que
  // cualquier otro, así que no hereda ningún bug de texto crudo/mezcla de idioma.
  missingShotIds.forEach(shotId => {
    const sp = shotPools.find(s => s.shotId === shotId);

    const groupAnchorId = (parsed.shots || []).find(s => {
      const otherSp = shotPools.find(x => x.shotId === s.shotId);
      return otherSp?.sceneGroup === sp.sceneGroup && s.sceneAnchorId;
    })?.sceneAnchorId;

    // Nunca repetir una señal ya elegida como chosenPoseItemId en otro shot de la misma
    // historia (ej. dos shots de "detalle del venue" cayendo en la misma foto top-fit) —
    // el fallback debe buscar la siguiente opción disponible del pool, no siempre pool[0].
    const usedPoseIds = new Set((parsed.shots || []).map(s => s.chosenPoseItemId).filter(Boolean));

    const fallbackPose = !sp.needsScene && groupAnchorId
      ? (sp.pool.find(c => c.itemId === groupAnchorId && !usedPoseIds.has(c.itemId))
        || sp.pool.find(c => !usedPoseIds.has(c.itemId))
        || sp.pool[0] || null)
      : (sp.pool.find(c => !usedPoseIds.has(c.itemId)) || sp.pool[0] || null);
    const fallbackScene = sp.needsScene
      ? (sp.scenePool.find(c => c.itemId === groupAnchorId) || sp.scenePool[0] || null)
      : null;
    parsed.shots = parsed.shots || [];
    parsed.shots.push({
      shotId,
      chosenPoseItemId: fallbackPose?.itemId || null,
      chosenSceneItemId: fallbackScene?.itemId || null,
      sceneAnchorId: groupAnchorId || fallbackScene?.itemId || null,
      subZoneNote: null,
      reasoning: '(fallback mecánico: el director omitió este shot en el paso de decisión, se eligió el candidato de mejor fit disponible, evitando repetir señales ya usadas, heredando el ancla de escena del grupo)',
    });
  });

  return shotPools.map(sp => {
    const decided = (parsed.shots || []).find(s => s.shotId === sp.shotId);
    const poseCandidate = sp.pool.find(c => c.itemId === decided?.chosenPoseItemId) || null;
    const sceneCandidate = sp.scenePool.find(c => c.itemId === decided?.chosenSceneItemId) || null;
    return {
      shotId: sp.shotId,
      role: sp.role,
      note: sp.note,
      sceneGroup: sp.sceneGroup,
      poseCandidate,
      sceneCandidate,
      sceneAnchorId: decided?.sceneAnchorId || null,
      subZoneNote: decided?.subZoneNote || null,
      reasoning: decided?.reasoning || null,
    };
  });
}

function buildWriteUserPrompt(decidedShots) {
  const shotsPayload = decidedShots.map(s => ({
    shotId: s.shotId,
    sceneGroup: s.sceneGroup,
    sceneAnchorId: s.sceneAnchorId,
    subZoneNote: s.subZoneNote,
    pose: summarizeCandidate(s.poseCandidate),
    scene: summarizeCandidate(s.sceneCandidate),
  }));

  return JSON.stringify({
    instructions: 'Escribí finalPrompt para cada shot, combinando pose y scene (si scene es null, la escena ya viene incluida en pose). Shots con el mismo sceneAnchorId deben describir el mismo venue.',
    shots: shotsPayload,
  }, null, 1);
}

// Paso 2: redactar el finalPrompt de cada shot ya decidido.
async function writePrompts(decidedShots) {
  const userPrompt = buildWriteUserPrompt(decidedShots);
  const parsed = await callGemini(WRITE_SYSTEM_PROMPT, userPrompt, 6000);

  return decidedShots.map(s => {
    const written = (parsed.shots || []).find(w => w.shotId === s.shotId);
    return {
      ...s,
      // Si el paso de redacción también omite un shot (más raro, porque es trabajo más
      // acotado por ítem), cae a un fallback mecánico simple en vez de dejarlo sin prompt.
      finalPrompt: written?.finalPrompt || buildFallbackPrompt(s.poseCandidate, s.sceneCandidate, !!s.sceneCandidate),
    };
  });
}

async function directStory(brief, recipeName, shotPools) {
  const decidedShots = await decideStory(brief, recipeName, shotPools);
  return writePrompts(decidedShots);
}

// Fallback mecánico simple (sin razonamiento) para el caso raro donde el paso de redacción
// omite un shot — concatena lo esencial en vez de dejar el shot completamente vacío.
function buildFallbackPrompt(poseCandidate, sceneCandidate, needsScene) {
  if (!poseCandidate) return null;
  const raw = poseCandidate.rawVisualDescription || {};
  const sceneRaw = needsScene ? (sceneCandidate?.rawVisualDescription || {}) : raw;
  const parts = [
    'A real iPhone photo, handheld, natural lighting, no camera UI or app interface visible.',
    raw.subject_pose,
    raw.outfit_visible,
    sceneRaw.background_setting,
    sceneRaw.lighting,
  ].filter(Boolean);
  return parts.join(' ');
}

module.exports = { directStory, decideStory, writePrompts };
