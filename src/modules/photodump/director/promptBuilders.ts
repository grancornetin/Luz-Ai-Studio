/**
 * modules/photodump/director/promptBuilders.ts
 *
 * Funciones puras de construcción de schema/prompt del Director Creativo —
 * extraídas de api/gemini/content.ts para que puedan importarse también
 * desde un harness de pruebas (scripts/photodump-director/) sin duplicar
 * texto que diverge de producción. Cero dependencias de Vertex AI/Redis/
 * QStash acá — solo transformación de datos a texto.
 */
import { HARD_RULES_TEXT as PHOTODUMP_HARD_RULES_TEXT } from './hardRules';
import type { RecipeContract, ShotPools, DirectorPlan, DirectorReferenceImage } from './types';

export function buildPhotodumpDirectorPlanSchema(recipeContract: RecipeContract) {
  const validShotIds = [
    ...(recipeContract.fixedShotTypes || []).map(t => t.id),
    ...(recipeContract.nightMomentTypes || []).map(t => t.id),
  ];
  return {
    type: 'object',
    properties: {
      globalReasoning: { type: 'string' },
      // Línea de tiempo real de la noche, declarada UNA vez antes de asignar
      // shots — solo 2 a 4 BLOQUES amplios (no un momento por shot). Existe
      // únicamente para evitar contradicciones groseras de continuidad (bug
      // real: un shot de "yéndose en auto" seguido de otro shot en el mismo
      // venue con más gente, como si la noche siguiera después de haberse
      // ido) — no para ordenar la variedad de tipos de shot. Varios shots de
      // tipos distintos deben compartir el mismo bloque libremente; ver
      // buildPhotodumpDecidePrompt para la instrucción completa anti-guion.
      timelineStages: { type: 'array', items: { type: 'string' } },
      shots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            shotId: { type: 'string', enum: validShotIds },
            candidatesConsidered: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  itemId: { type: 'string' },
                  score: { type: 'number' },
                  keptElements: { type: 'array', items: { type: 'string' } },
                  discardedElements: { type: 'array', items: { type: 'string' } },
                },
                required: ['itemId', 'score', 'keptElements', 'discardedElements'],
              },
            },
            chosenCandidateId: { type: 'string' },
            shotReasoning: { type: 'string' },
            needsVenueAnchor: { type: 'boolean' },
            continuityNote: { type: 'string' },
            accessoryReasoning: { type: 'string' },
            // A qué momento de timelineStages pertenece este shot (debe ser
            // uno de los strings declarados ahí, en el mismo orden).
            timelineStage: { type: 'string' },
            // Filtro del manifiesto de dirección (§6, "esta foto existe
            // porque..."): quién sostiene la cámara y por qué esta foto
            // puntual merece publicarse. Obligatorio para descartar
            // candidatos del banco que son técnicamente válidos pero no
            // tienen una razón de captura creíble para ESTA protagonista en
            // ESTE momento (ej. una foto de espaldas sin rostro, sacada por
            // una amiga, que la propia protagonista no subiría a su feed).
            existenceReason: { type: 'string' },
          },
          required: ['shotId', 'candidatesConsidered', 'chosenCandidateId', 'shotReasoning', 'needsVenueAnchor', 'continuityNote', 'accessoryReasoning', 'timelineStage', 'existenceReason'],
        },
      },
    },
    required: ['globalReasoning', 'timelineStages', 'shots'],
  };
}

export const PHOTODUMP_PROMPTS_SCHEMA = {
  type: 'object',
  properties: {
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: { shotId: { type: 'string' }, finalPrompt: { type: 'string' } },
        required: ['shotId', 'finalPrompt'],
      },
    },
  },
  required: ['shots'],
};

export const PHOTODUMP_STYLE_RULES_TEXT = `
Camera roll quality: unedited photo, casual handheld feel, everyday smartphone capture, no catalogue finish, no beauty retouching, no editorial polish — a real, imperfect, authentic photo, not a professionally composed shot.
Avoid: editorial or catalog-like finish, overly polished or retouched skin, perfectly centered symmetric composition, walking or mid-stride pose, legs in a walking stance.
The background (when indoors/domestic) must be a real, lived-in space — never a photography studio, never a seamless backdrop, never a plain concrete or cyclorama floor.
She is standing still or naturally posed, not mid-stride.
`.trim();

export function buildPhotodumpDecidePrompt(
  brief: string,
  recipeContract: RecipeContract,
  level: string,
  shotPools: ShotPools,
  referenceImages?: DirectorReferenceImage[],
): string {
  const levelInfo = recipeContract.shotsByLevel[level];
  // Nivel de 1 sola foto (ver 'una_foto' en shotsByLevel / 'single_hero_shot'
  // en nightMomentTypes): sin shots fijos — la idea es UNA imagen total, no
  // mirror_check + esta foto. Cualquier otro nivel sigue usando los shots
  // fijos normalmente.
  const isSingleShotLevel = levelInfo.count === 1;
  const referenceImagesList = (referenceImages && referenceImages.length > 0)
    ? referenceImages.map((img, i) => `${i + 1}. ${img.role}`).join('\n')
    : null;
  const fixedShotList = isSingleShotLevel
    ? '(ninguno — este nivel es de 1 sola foto, sin shots fijos de preparación)'
    : (recipeContract.fixedShotTypes || [])
        .map(t => `- ${t.id} (FIJO, usar exactamente 1 vez, siempre primero): ${t.description}${t.lightingRule ? `\n  REGLA DE ILUMINACIÓN: ${t.lightingRule}` : ''}`)
        .join('\n');
  const momentShotList = recipeContract.nightMomentTypes
    .map(t => {
      const axis = t.diversityAxis ? `\n  EJE DE DIVERSIDAD: ${t.diversityAxis}` : '';
      const bridge = t.attentionBridge ? `\n  POR QUÉ EXISTE ESTE SHOT (attention bridge): ${t.attentionBridge}` : '';
      return `- ${t.id}: ${t.description}${axis}${bridge}`;
    })
    .join('\n');

  const poolsText = Object.entries(shotPools)
    .map(([shotId, candidates]) => {
      const candidatesText = candidates.length === 0
        ? '  (sin candidatos relevantes encontrados en el banco para este tipo de shot)'
        : candidates.map(c => `  - itemId: ${c.itemId} (relevancia previa: ${c.relevanceScore})
    pose: ${c.pose || 'N/A'}
    gesto: ${c.gesture || 'N/A'}
    mirada: ${c.gaze || 'N/A'}
    outfit: ${c.outfit || 'N/A'}
    objetos: ${c.objects || 'N/A'}
    fondo: ${c.background || 'N/A'}
    luz: ${c.lighting || 'N/A'}
    encuadre: ${c.cameraFraming || 'N/A'}
    con acompañante: ${c.companionPresent}
    señales: ${(c.signals || []).map(s => `[${s.category}] ${s.signal} (${s.reusablePrimitive}) — ${(s.conditions || []).join(' | ')}`).join('; ')}`).join('\n');
      return `### Shot type: ${shotId}\n${candidatesText}`;
    })
    .join('\n\n');

  const referenceImagesBlock = referenceImagesList ? `
IMÁGENES REALES ADJUNTAS (en este orden, antes del texto de este prompt):
${referenceImagesList}

Estas son las referencias REALES del usuario para esta sesión — MIRALAS antes
de decidir qué elementos transferir de un candidato del banco. Regla dura:
nunca heredes una pose, gesto o composición de un candidato del banco que
dependa de una característica física que la referencia real de outfit/cuerpo
NO tiene. Ejemplo real de bug corregido: un candidato del banco tenía una
pose de "mano en el bolsillo", pero el outfit real de esta sesión era una
falda ajustada sin bolsillos visibles — esa pieza de la pose NO era
transferible y debía ir a discardedElements, no a keptElements, aunque el
resto de la pose (postura, mirada, encuadre) sí fuera reutilizable. Aplicá el
mismo criterio a cualquier característica física dependiente de la prenda:
bolsillos, tirantes, cierres, capas, largo, cómo se sostiene o dónde se
apoyan las manos según el corte real del outfit — todo eso lo define la
imagen de outfit real, nunca el candidato del banco.
` : '';

  return `Sos el Director Creativo de "Photodump", un módulo que genera fotos tipo rollo-de-fotos-real de una historia (ej. una salida nocturna) para una app de contenido para creadoras.

${PHOTODUMP_HARD_RULES_TEXT}
${referenceImagesBlock}
RECETA: ${recipeContract.label}
PSICOLOGÍA DE LA RECETA: ${recipeContract.psychology}
REGLAS ESPECÍFICAS DE ESTA RECETA:
${recipeContract.hardRules.map(r => `- ${r}`).join('\n')}

BRIEF DEL USUARIO: "${brief}"
NIVEL ELEGIDO: ${level} (${levelInfo.count} fotos) — ${levelInfo.description}

SHOTS FIJOS (siempre presentes, exactamente 1 vez cada uno):
${fixedShotList}

PSICOLOGÍA DE ESTOS TIPOS DE SHOT (importante para elegir bien, no son un
menú de opciones intercambiables): ninguno de estos tipos "muestra el
outfit" ni "muestra el lugar" de forma directa — cada uno es una forma
ALTERNATIVA de probar los mismos 2 ejes de la receta ("la noche fue
memorable" / "ella se veía increíble") desviando la atención hacia un
detalle concreto que el espectador usa para inferir el resto (ver
"attention bridge" de cada tipo abajo). Por eso varios tipos comparten el
mismo EJE DE DIVERSIDAD: si dos shots del mismo eje conviven en el mismo
set, se leen como la misma foto repetida aunque sus ids sean técnicamente
distintos — ej. pov_legs + food_detail + ambient_only son las 3 formas de
"detalle sin protagonista que insinúa el resto de la experiencia".

TIPOS DE MOMENTO DE NOCHE DISPONIBLES (elegir entre estos para completar el resto del set):
${momentShotList}

REGLA DURA DE DIVERSIDAD: ${recipeContract.nightMomentDiversityRule || 'Nunca elijas más de 1 tipo del mismo EJE DE DIVERSIDAD en un mismo set.'}

REGLA DE PRIORIDAD — diversidad NUNCA por encima de tener contenido real: la
diversidad de ejes es una preferencia, no una obligación ciega. Si un tipo de
shot (ej. car_transition) no tiene NINGÚN candidato del banco con contenido
real y útil para este brief puntual (el pool solo trae candidatos totalmente
ajenos, donde tendrías que descartar el 100% del contenido visual), NO lo
elijas solo para completar diversidad de ejes — preferí repetir un eje que sí
tiene candidatos reales y fuertes, o usar un tipo de shot distinto con mejor
respaldo. Un shot inventado desde cero sin ningún candidato real que lo
sustente tiende a salir genérico o con detalles inventados sin lógica (ej. un
car_transition sin ningún candidato de auto real terminó describiéndose tan
vacío que el generador de imágenes agregó objetos sin sentido narrativo,
como llaves sueltas o un café recién comprado a las 2am volviendo de la
cena). La diversidad se sacrifica antes que la calidad y coherencia real del
shot.

${isSingleShotLevel
  ? `Este nivel es de 1 SOLA FOTO — usá exactamente el tipo "single_hero_shot" y ningún otro. No hay shots fijos, no hay secuencia, no hay continuidad de venue entre shots porque solo existe este uno. La única foto del set debe resolver por sí sola ambos ejes narrativos de la receta (memorable + se veía increíble) — timelineStages en este caso es un array con 1 solo elemento (ej. ["el momento que resume la noche"]).`
  : (() => {
      const fixedCount = (recipeContract.fixedShotTypes || []).length;
      const momentCount = levelInfo.count - fixedCount;
      return `CANTIDAD TOTAL DE SHOTS — LÍMITE DURO, NO NEGOCIABLE: el array "shots" de
tu respuesta debe tener EXACTAMENTE ${levelInfo.count} elementos, ni uno más ni uno
menos (nunca un total mayor a ${levelInfo.count} aunque encuentres candidatos
excelentes de más tipos — elegí solo los mejores ${momentCount} momentos de
noche y descartá el resto). De esos ${levelInfo.count}: ${fixedCount} son los
shots fijos de arriba (cada uno exactamente 1 vez) y los otros ${momentCount}
salen de los tipos de momento de noche (no hace falta usarlos todos). Nunca
repitas el mismo shotId dos veces en el array — cada tipo de momento de noche
aparece como máximo 1 vez en el set completo (ya lo exige también la REGLA
DURA DE DIVERSIDAD, pero aplica igual aunque dos candidatos del mismo tipo
sean ambos muy buenos: elegís el mejor de los dos, no los dos). Nunca
reutilices el id de un shot fijo (ej. mirror_check) para representar un
momento de noche — son categorías separadas, aunque ambas puedan compartir
pose de espejo o similar.`;
    })()}

REGLA IMPORTANTE sobre qué NUNCA es reutilizable de un candidato, aunque el
resto de la pose/gesto sea excelente — mandalo siempre a discardedElements,
nunca a keptElements:
- El vestuario/outfit específico del candidato (color, prenda, cómo cae la
  ropa, si un hombro queda descubierto por una chaqueta cayéndose, etc.) —
  el outfit real siempre lo define la referencia del usuario, nunca la foto
  del banco.
- La iluminación del candidato, SALVO que coincida con la hora real del
  evento del brief. Si el brief implica una hora distinta a la de la foto
  del candidato (ej. brief de noche, candidato con luz de día), la
  iluminación va a discardedElements y se reemplaza por la iluminación que
  corresponde a la hora real del brief.

LÍNEA DE TIEMPO DE LA NOCHE (timelineStages, obligatorio, se declara UNA vez
antes de asignar shots): esto NO es un guion escena-por-escena ni un molde
fijo de "preparación → llegada → comida → fiesta → salida" — declará solo
entre 2 y 4 BLOQUES amplios y genéricos de la noche (ej. "en el venue,
temprano en la noche" y "en el venue, más avanzada la noche" pueden ser los
únicos 2 bloques de un set entero; a veces 1 solo bloque alcanza si toda la
noche transcurre en el mismo momento sin transición real). El propósito
ÚNICO de esta línea de tiempo es evitar contradicciones groseras de
continuidad (ver reglas duras abajo) — NO es para ordenar la variedad de
shots. Es normal y DESEABLE que varios shots de tipos completamente distintos
(pista de baile, cócteles, un rincón bonito del venue, un detalle sin
protagonista, un momento de grupo) compartan el MISMO bloque de la línea de
tiempo — no le asignes un bloque distinto a cada shot solo por variar el
texto, y no repitas el patrón "preparación, llegada, comida, postre, salida"
por default: ese orden ya fue el problema real detectado en producción
(sets que se sentían como un guion predecible en vez de un rollo de fotos
real). Priorizá SIEMPRE la diversidad de tipo de shot (REGLA DURA DE
DIVERSIDAD arriba) por sobre inventar progresión temporal — la variedad del
set viene de los tipos de shot elegidos, no de simular una cronología
detallada. Reglas duras de esta línea de tiempo (las únicas contradicciones
reales a evitar):
- Un shot que sugiere que la protagonista se está yendo del venue (ej.
  car_transition) nunca puede ir seguido de un shot que la muestra
  todavía/de nuevo en el venue con más gente — eso rompe la cronología. Fuera
  de este caso puntual, no hay restricción de orden entre shots del mismo
  bloque.
- La comida/bebida en la mesa debe ser consistente con el bloque en que
  aparece, pero nunca completamente vacía con restos — eso se lee como el
  final de la comida, no como algo que alguien fotografiaría con ganas de
  compartirlo. Preferí siempre el punto en que la comida/bebida se ve más
  atractiva (recién servida o a la mitad), no el más "realista" según cuánto
  tiempo pasó.
- car_transition (si se usa) representa el punto de vista de una PASAJERA,
  nunca de quien conduce — sin manos en el volante, sin llaves sueltas como
  si alguien acabara de aparcar, sin objetos que sugieran que la protagonista
  maneja. Si el candidato elegido mostraba a alguien conduciendo, esa parte
  va a discardedElements.

MOTIVO DE EXISTENCIA DE CADA FOTO (existenceReason, obligatorio, filtro del
manifiesto de dirección — "esta foto existe porque..."): antes de aceptar un
candidato del banco, preguntate quién sostiene la cámara en esta foto y si
la PROTAGONISTA de esta historia la subiría a su propio feed. Una foto de
espaldas, sin rostro visible, no posada, que solo demuestra "estuvo en una
fiesta con más gente" — es el tipo de foto que sacaría una amiga, no la que
la protagonista misma elegiría publicar de sí misma. Si un candidato del
banco tiene esa composición (de espaldas, sin rostro, no posada), es
válido igual SOLO si aporta algo que ningún otro shot del set ya aporta y
tiene una razón de existir real (ej. "queda claro que fue con amigas, dato
que no se repite en otro shot") — nunca lo elijas solo porque el candidato
puntuaba alto en pose/encuadre. Completá existenceReason con la respuesta
concreta a "esta foto existe porque...", nunca con una respuesta genérica
tipo "porque hay que mostrar el momento".

CANDIDATOS DEL BANCO POR TIPO DE SHOT (ya pre-filtrados, pueden no ser
perfectos — tu trabajo es evaluar cuáles tienen piezas útiles, aunque el
candidato en su conjunto no calce con el brief):

${poolsText}

INSTRUCCIÓN CENTRAL — cómo evaluar cada candidato:
Un candidato puede ser útil sin que TODO en él sirva. Ejemplo: si buscás un
shot "hero" para una cena en un rooftop con vestido plateado, y encontrás un
candidato que es un desayuno en una cafetería con jeans y blusa — el
escenario, la comida y el outfit de ESE candidato NO sirven (los reemplaza el
brief real: rooftop, comida de cena, vestido plateado). Pero si ese candidato
tiene una pose relajada con un brazo apoyado en la mesa, una expresión cálida
y una forma interesante de componer el plato/bebida frente a la persona —
ESO SÍ es reutilizable, independientemente del resto. Tu trabajo es separar
qué se mantiene (keptElements) de qué se descarta (discardedElements) para
cada candidato que consideres, y elegir el mejor punto de partida por shot.

Para cada shot, además, decidí si necesita anclar continuidad con el venue de
otros shots del set (needsVenueAnchor) y por qué (continuityNote).

RAZONAMIENTO DE ACCESORIOS (accessoryReasoning, obligatorio en cada shot):
la referencia de outfit del usuario puede incluir accesorios no-esenciales
(bolso, gafas, bufanda, joyas visibles) fusionados en la misma imagen. Por
default, esos accesorios DEBERÍAN seguir presentes en todos los shots del
mismo venue/momento — no desaparecen y reaparecen sin motivo, igual que en
la vida real alguien no se queda sin su bolso a mitad de la noche y lo
recupera después. Para cada shot, razoná explícitamente: ¿tiene sentido que
el/los accesorio(s) no-esenciales aparezcan en ESTE shot puntual, o hay una
razón física/narrativa real que los excluye de forma creíble (ej. bailando
con las manos libres, un POV mirando hacia abajo donde el bolso no entra en
cuadro, manos ocupadas sosteniendo comida o bebida, un brindis en primer
plano donde el encuadre no llega al torso)? Escribí esa decisión en
accessoryReasoning — nunca lo omitas ni lo dejes implícito. Si no hay una
razón real para excluirlos, la respuesta correcta es "se mantienen
presentes, sin motivo para excluirlos".

Devolvé el resultado en el formato JSON pedido.`;
}

/**
 * Corrige en código lo que el prompt de "Decidir" no siempre logra por sí
 * solo: pese a la instrucción explícita de cantidad exacta, Gemini a veces
 * devuelve más shots que levelInfo.count, con el mismo shotId repetido (bug
 * real observado con --level=extendido: pidió 7, devolvió 8-10, con
 * group_party_moment/single_hero_shot duplicados). No basta con reforzar el
 * texto del prompt — un límite de cardinalidad estricto necesita aplicarse
 * también en código después de recibir la respuesta, antes de redactar.
 */
export function sanitizeDirectorPlan(plan: DirectorPlan, recipeContract: RecipeContract, level: string): DirectorPlan {
  const levelInfo = recipeContract.shotsByLevel[level];
  const fixedIds = new Set((recipeContract.fixedShotTypes || []).map(t => t.id));

  // 1) Dedupe por shotId, quedándose con la primera aparición (el modelo
  // repite el candidato/razonamiento idéntico en los duplicados observados).
  const seen = new Set<string>();
  const deduped = plan.shots.filter(shot => {
    if (seen.has(shot.shotId)) return false;
    seen.add(shot.shotId);
    return true;
  });

  // 2) Si sigue sobrando, recorta al total exacto del nivel — prioriza shots
  // fijos (siempre entran) y luego los primeros N momentos de noche en el
  // orden en que el propio modelo los eligió (su orden de preferencia).
  const fixed = deduped.filter(s => fixedIds.has(s.shotId));
  const moments = deduped.filter(s => !fixedIds.has(s.shotId));
  const momentBudget = Math.max(0, levelInfo.count - fixed.length);
  const trimmedShots = [...fixed, ...moments.slice(0, momentBudget)];

  return { ...plan, shots: trimmedShots };
}

export function buildPhotodumpWritePrompt(brief: string, plan: DirectorPlan): string {
  const shotsText = plan.shots.map(shot => {
    const chosen = shot.candidatesConsidered.find(c => c.itemId === shot.chosenCandidateId);
    return `
### Shot: ${shot.shotId}
Candidato de referencia elegido: ${shot.chosenCandidateId || '(ninguno, describir desde cero)'}
Razonamiento: ${shot.shotReasoning}
Elementos a MANTENER de este candidato (pose/gesto/mirada/composición/encuadre — transferibles):
${(chosen?.keptElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
Elementos a DESCARTAR de este candidato (reemplazar por el brief real/las referencias del usuario):
${(chosen?.discardedElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
¿Necesita continuidad de venue con otro shot del set?: ${shot.needsVenueAnchor ? `Sí — ${shot.continuityNote}` : 'No'}
Momento de la noche (timeline): ${shot.timelineStage}
Por qué existe esta foto: ${shot.existenceReason}
Accesorios no-esenciales (bolso, gafas, bufanda) en este shot: ${shot.accessoryReasoning}
`;
  }).join('\n');

  return `Sos el redactor final de prompts del Director Creativo de Photodump. Ya se decidió, para cada shot, qué elementos de qué candidato del banco son reutilizables — tu trabajo AHORA es escribir el prompt final en INGLÉS, listo para pegar en un generador de imágenes real.

BRIEF REAL DEL USUARIO (la escena/lugar/hora real a describir, reemplaza cualquier escenario específico de los candidatos del banco): "${brief}"

REGLAS DE ESTILO FIJAS — aplican a TODOS los shots, agregalas al final de cada prompt:
${PHOTODUMP_STYLE_RULES_TEXT}

REGLA CENTRAL: para cada shot, describí SOLO la pose/gesto/mirada/encuadre/composición que se decidió mantener del candidato (ver "Elementos a MANTENER" de cada shot abajo) — nunca menciones el escenario, comida u outfit específico de la foto del banco si fueron marcados para descartar. En su lugar, el escenario debe ser el del brief real del usuario, y el outfit se resuelve por referencia de imagen (no hace falta describirlo en detalle, ya que se provee como imagen de referencia aparte) — mencionalo solo si es relevante para la pose (ej. "wearing the outfit shown in the reference").

REGLAS DURAS DE REDACCIÓN (aplican SIEMPRE, incluso si no aparecen explícitas en "Elementos a MANTENER" de un shot — son un respaldo, no dependas solo de esa lista):
1. NUNCA describas ninguna prenda, color de ropa, o cómo cae/se acomoda la ropa del candidato del banco (ej. "chaqueta cayéndose del hombro", "top negro", "jeans") — eso es vestuario del candidato, no de la protagonista real. El outfit lo resuelve la imagen de referencia del usuario, nunca texto describiendo ropa específica de otra persona.
2. La ILUMINACIÓN de cada shot debe corresponder a la HORA REAL del evento en el brief del usuario — no a la iluminación del candidato del banco, salvo que coincidan. Si el brief describe una salida de noche, TODOS los shots (incluido mirror_check) deben tener iluminación nocturna/artificial de interior — nunca luz de día natural, aunque el candidato elegido como inspiración de pose tuviera luz de día.

Si un shot dice que necesita continuidad de venue, agregá una línea explícita de continuidad ("SCENE CONTINUITY: same venue as the previous shot — reuse the exact same background, furniture and lighting.") antes de la descripción de venue.

MOMENTO DE LA NOCHE (timeline): cada shot indica a qué bloque amplio de la
noche pertenece — usalo solo para evitar contradicciones groseras (ej. un
shot de "yéndose" seguido de otro que la muestra todavía en el venue con más
gente). Nunca lo uses para inventar una progresión estricta shot-a-shot: si
hay comida/bebida en el shot, preferí siempre el punto en que se ve más
atractiva (recién servida o a la mitad), nunca un plato completamente vacío
con restos — independientemente de en qué bloque esté. Si el shot es
car_transition, describilo SIEMPRE desde el punto de vista de una pasajera
— nunca manos en el volante, nunca llaves sueltas sobre la consola como si
alguien acabara de estacionar.

ACCESORIOS NO-ESENCIALES — REGLA DE SILENCIO POR DEFAULT: cada shot trae su
razonamiento de accesorios (bolso, gafas, bufanda) — ver "Accesorios
no-esenciales" abajo. NO lo traduzcas a texto en todos los casos — mencionar
un accesorio, incluso para decir que está ausente, le da peso visual
innecesario y el generador de imágenes tiende a sobre-representarlo. Regla:
- Si el razonamiento es el default genérico ("se mantienen presentes, sin
  motivo para excluirlos"): NO escribas ninguna línea sobre el accesorio en
  el prompt. Dejá que la imagen de referencia del outfit (que ya lo incluye)
  resuelva su presencia por sí sola, sin texto adicional.
- Si el razonamiento dio una razón física/narrativa REAL y específica para
  excluirlo (manos ocupadas, POV que no lo encuadra, bailando): sí escribí
  esa razón en el prompt, una sola vez, de forma natural (ej. "Her hands are
  occupied holding the wine glasses for the toast.") — sin nombrar
  explícitamente que el bolso "no es el foco" o "no es necesario", alcanza
  con describir la acción real que ocupa las manos/cuerpo.

PLAN DE SHOTS YA DECIDIDO:
${shotsText}

Devolvé el resultado en el formato JSON pedido — un finalPrompt completo en inglés por cada shot.`;
}
