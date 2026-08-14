/**
 * modules/photodump/director/openBank/openBankPromptBuilders.ts
 *
 * Construcción de schema/prompt del modo "banco abierto" — mismo patrón de
 * 2 llamadas (Decidir → Redactar) ya validado en producción por el modo
 * actual (director/promptBuilders.ts), pero sin lista de tipos de shot con
 * nombre fijo. El único criterio narrativo es el núcleo dual del manifiesto
 * de dirección (§4bis): "la noche fue memorable" + "se veía increíble en el
 * outfit" — cada shot debe aportar evidencia de al menos uno de los 2 ejes.
 *
 * Diseño de detalle rico sin 3ra llamada a Gemini: "Decidir" recibe el
 * panorama comprimido (1 línea/candidato, TODO el banco agrupado por
 * shot_type) para que el director vea la escala real y elija libremente qué
 * itemIds quiere usar — pero el TEXTO RICO (8 campos completos) de esos
 * itemIds elegidos recién se resuelve en código (buildRichDetailForChosen,
 * en openBankClientHelpers si hiciera falta, o inline en content.ts) antes
 * de pasarlo a "Redactar". Esto evita mandar el detalle completo de cientos
 * de candidatos (el problema de tamaño de prompt que ya causó timeouts
 * reales en el modo actual) sin sacrificar que el director razone con datos
 * reales, no solo con el resumen comprimido.
 */
import { HARD_RULES_TEXT as PHOTODUMP_HARD_RULES_TEXT } from '../hardRules.js';
import type { DirectorReferenceImage } from '../types';
import type { WideCandidatePool, OpenBankPlan, OpenBankAnalysisItem } from './openBankTypes';

export const OPEN_BANK_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    globalReasoning: { type: 'string' },
    timelineStages: { type: 'array', items: { type: 'string' } },
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          // Descripción corta en 2-5 palabras del tipo de foto (ej. "mirror
          // selfie con trago", "detalle de copa en la mesa") — NUNCA el
          // itemId del candidato, eso ya viaja en chosenCandidateId.
          vehicleLabel: { type: 'string' },
          narrativeAxis: { type: 'string', enum: ['memorable', 'outfit_increible', 'ambos'] },
          psychologicalDrive: { type: 'string', enum: ['attraction_self_presentation', 'status_control', 'belonging_social_validation'] },
          psychologicalReasoning: { type: 'string' },
          chosenCandidateId: { type: 'string' },
          shotReasoning: { type: 'string' },
          keptElements: { type: 'array', items: { type: 'string' } },
          discardedElements: { type: 'array', items: { type: 'string' } },
          needsVenueAnchor: { type: 'boolean' },
          continuityNote: { type: 'string' },
          accessoryReasoning: { type: 'string' },
          timelineStage: { type: 'string' },
          existenceReason: { type: 'string' },
          companionVisible: { type: 'boolean' },
          footwearVisible: { type: 'boolean' },
          protagonistVisible: { type: 'boolean' },
        },
        required: [
          'vehicleLabel', 'narrativeAxis', 'psychologicalDrive', 'psychologicalReasoning',
          'chosenCandidateId', 'shotReasoning',
          'keptElements', 'discardedElements', 'needsVenueAnchor', 'continuityNote',
          'accessoryReasoning', 'timelineStage', 'existenceReason',
          'companionVisible', 'footwearVisible', 'protagonistVisible',
        ],
      },
    },
  },
  required: ['globalReasoning', 'timelineStages', 'shots'],
};

export const OPEN_BANK_PROMPTS_SCHEMA = {
  type: 'object',
  properties: {
    shots: {
      type: 'array',
      items: {
        type: 'object',
        // shotIndex (no vehicleLabel) es el vínculo real con el plan — ver
        // bug real confirmado en producción (13 ago 2026): con vehicleLabel
        // como texto libre reescrito en una llamada separada, los 7/7 shots
        // de una sesión real no coincidieron (variación mínima de texto
        // rompe el match exacto). shotIndex es un número que Gemini solo
        // necesita leer y copiar del plan, no reescribir — mucho más
        // confiable que comparar strings.
        properties: { shotIndex: { type: 'integer' }, vehicleLabel: { type: 'string' }, finalPrompt: { type: 'string' } },
        required: ['shotIndex', 'vehicleLabel', 'finalPrompt'],
      },
    },
  },
  required: ['shots'],
};

export const OPEN_BANK_STYLE_RULES_TEXT = `
Camera roll quality: unedited photo, casual handheld feel, everyday smartphone capture, no catalogue finish, no beauty retouching, no editorial polish — a real, imperfect, authentic photo, not a professionally composed shot.
Avoid: editorial or catalog-like finish, overly polished or retouched skin, perfectly centered symmetric composition, walking or mid-stride pose, legs in a walking stance.
The background (when indoors/domestic) must be a real, lived-in space — never a photography studio, never a seamless backdrop, never a plain concrete or cyclorama floor.
She is standing still or naturally posed, not mid-stride.
`.trim();

function formatWidePool(pool: WideCandidatePool): string {
  return Object.entries(pool)
    .map(([groupKey, candidates]) => {
      const lines = candidates
        .map(c => `  ${c.itemId} | ${c.companionPresent ? 'con acompañante' : 'sola'} | subjects:${c.subjectsVisible} | ${c.briefSummary}`)
        .join('\n');
      // groupKey ya viene prefijado como "escena:X" cuando es una veta de
      // ambiente/escena (ver detectSceneTag) — el resto son shot_type reales.
      const label = groupKey.startsWith('escena:') ? groupKey : `shot_type: ${groupKey}`;
      return `### ${label} (${candidates.length} candidatos)\n${lines}`;
    })
    .join('\n\n');
}

export function buildOpenBankDecidePrompt(
  brief: string,
  totalShotsRequested: number,
  widePool: WideCandidatePool,
  referenceImages?: DirectorReferenceImage[],
  energy?: 'elegante' | 'fiesta',
): string {
  const referenceImagesList = (referenceImages && referenceImages.length > 0)
    ? referenceImages.map((img, i) => `${i + 1}. ${img.role}`).join('\n')
    : null;
  const referenceImagesBlock = referenceImagesList ? `
IMÁGENES REALES ADJUNTAS (en este orden, antes del texto de este prompt):
${referenceImagesList}

Estas son las referencias REALES del usuario para esta sesión — MIRALAS antes
de decidir qué elementos transferir de un candidato del banco. Regla dura:
nunca heredes una pose, gesto o composición de un candidato del banco que
dependa de una característica física que la referencia real de outfit/cuerpo
NO tiene (ej. una pose de "mano en el bolsillo" con un outfit real que no
tiene bolsillos visibles — esa pieza de la pose va a discardedElements, no a
keptElements, aunque el resto de la pose sí sea transferible).
` : '';

  return `Sos el Director Creativo de "Photodump", un módulo que genera fotos tipo rollo-de-fotos-real de una historia (ej. una salida nocturna) para una app de contenido para creadoras.

${PHOTODUMP_HARD_RULES_TEXT}
${referenceImagesBlock}
BRIEF DEL USUARIO: "${brief}"

NÚCLEO NARRATIVO DE ESTA HISTORIA (el único criterio narrativo — no hay una lista fija de "tipos de foto" a rellenar):
> Ella tuvo una noche memorable, y se veía increíble en el outfit.

Cada shot que elijas debe aportar evidencia real de AL MENOS UNO de estos 2
ejes ("memorable" o "outfit_increible") — marcalo en narrativeAxis. Los
shots más fuertes aportan a los 2 a la vez (ej. sentada en la barra, outfit
legible, trago recién servido, ambiente del venue visible). NO existe una
secuencia canónica de shots ni un orden obligatorio de "preparación →
llegada → cena → salida" — un set real de fotos de una noche puede empezar
directo en el venue, puede repetir el mismo tipo de encuadre dos veces si
cuenta algo distinto cada vez, puede saltarse la preparación por completo.
Vos decidís, para ESTE brief puntual, qué combinación de fotos cuenta mejor
esta noche — no rellenes categorías, componé la historia real.

LECTURA PSICOLÓGICA DE CADA CANDIDATO (manifiesto §3, obligatoria antes de
elegir): la razón por la que un tipo de foto genera atención real en redes
casi nunca es "se ve linda" — es que activa un impulso motivacional
específico. Para esta receta, los 3 impulsos relevantes son:
- attraction_self_presentation: la pose/ángulo/gesto transmite confianza
  corporal y sensualidad DELIBERADA (no accidental) — mirror check, ángulo
  que alarga la silueta, mirada directa y segura a cámara.
- status_control: el entorno, la exclusividad del venue, la calidad de los
  objetos visibles o la sensación de acceso/dominio de la situación es lo
  que genera la reacción — no la pose de la protagonista en sí.
- belonging_social_validation: la foto funciona porque muestra pertenencia
  a un grupo/momento deseable (amigas, ambiente, código social reconocible)
  — la fuerza está en el contexto compartido, no en un individuo posando.
Antes de elegir un candidato, preguntate: ¿qué impulso de estos 3 hace que
ESTE tipo de foto específico genere atención real si alguien la publicara?
Usá esa lectura para juzgar si el candidato es realmente fuerte (no solo si
combina con el brief en palabras) y para decidir qué pose/ángulo/gesto vale
la pena heredar en keptElements. Declará el impulso identificado en
psychologicalDrive, y en psychologicalReasoning explicá en 1-2 frases POR
QUÉ ese candidato puntual activa ese impulso (ej. "la inclinación de cadera
y la mirada directa al espejo transmiten confianza corporal deliberada,
por eso una foto así genera atención real").
REGLA DURA: psychologicalReasoning es tu razonamiento INTERNO de director,
nunca se traduce a texto literal en el prompt final ni implica prometer un
resultado social (pretendientes, envidia, aceptación) — eso viola los
guardrails del manifiesto (§15). Se usa solo para elegir mejor la pose y
justificar por qué el candidato es fuerte, nunca aparece en shotReasoning
ni en existenceReason con ese lenguaje: esos campos siempre describen la
experiencia propia de la protagonista (self-focused: "se sintió increíble
con el outfit"), nunca el efecto que la foto tendría en terceros
(other-focused: "para que otros la deseen/envidien").

FILTRO DE TONO — depende del CONTEXTO NARRATIVO de cada shot, no es una
prohibición general de sensualidad. La pregunta correcta para cada
candidato es: "¿es plausible que la protagonista esté vestida así EN ESTE
MOMENTO de ESTA historia?", no "¿es sensual?" — la sensualidad en sí
(escote, silueta marcada, piernas, pose de confianza corporal) es parte
legítima de attraction_self_presentation y no hay que evitarla. La regla no
es una lista fija de prendas prohibidas — es un principio de plausibilidad
que se aplica al contexto real de CADA receta (nota: este prompt es
específico de outfit_night_out; si en el futuro se arma un prompt
equivalente para otra receta con un contexto físico distinto —ej. una
rutina de skincare donde aplicar crema en el cuerpo es la acción central, o
un día de playa/piscina donde bikini es la prenda esperada— esa regla debe
escribirse de nuevo con el contexto propio de esa receta, no heredar esta).

Para outfit_night_out específicamente, la línea de plausibilidad es:
- Si el shot ocurre en el venue, en tránsito (auto), o en cualquier momento
  donde la protagonista ya está "arreglada para salir": un candidato cuyo
  outfit_visible sea ropa interior/lencería NO es plausible ahí — no tiene
  sentido narrativo estar en ropa interior en un club, restaurante o auto
  camino a algún lado. Descartalo, sin importar qué tan bien encaje la pose
  con el brief.
- Si el shot ocurre en la etapa de PREPARACIÓN EN CASA (ej. "previa",
  "get ready with me", maquillándose, eligiendo el outfit, arreglándose el
  pelo) Y el brief describe o admite esa etapa: cualquier prenda plausible
  ANTES de estar vestida de salida es válida — bata, pijama, toalla,
  conjunto de loungewear, ropa deportiva de estar en casa. Es el momento
  natural en que alguien todavía no se puso el outfit de la noche. La línea
  sigue estando en ropa interior/lencería como prenda final y única visible
  (eso nunca es válido, ni siquiera en la preparación) — la diferencia es
  "está en bata/pijama antes de vestirse" (válido) vs. "está en ropa
  interior sin nada encima, posando" (nunca válido).
Si dudás sobre un candidato puntual, preguntate primero en qué etapa de la
noche va ese shot y si esa prenda tiene sentido ahí — no descartes por
sensualidad sola.

CANTIDAD TOTAL DE SHOTS — LÍMITE DURO: el array "shots" debe tener
EXACTAMENTE ${totalShotsRequested} elementos, ni uno más ni uno menos.

DIVERSIDAD REAL — qué SÍ puede repetirse vs. qué NO (confirmado contra datos
reales del banco, no es una prohibición general de repetir nada):
- SÍ es válido, y de hecho enriquece, que un mismo accesorio reaparezca en
  varios shots (bolso, gafas de sol, teléfono, la copa/trago en mano) — en
  el banco real, bolso aparece en ~32% de las fotos y gafas de sol en ~24%:
  es lo esperable de una sola noche real con un solo outfit, no una señal de
  repetición pobre. Lo mismo aplica a "de pie, cuerpo completo mostrando el
  outfit" como encuadre general — es más de la mitad del banco real — puede
  aparecer en más de un momento de la noche (llegada, mitad, despedida) SI
  el gesto, la mirada o la interacción con el entorno cambian entre esos
  shots.
- NO es válido que 2+ shots compartan el mismo gesto Y la misma expresión Y
  el mismo tipo de encuadre a la vez (ej. "sosteniendo la copa cerca de la
  boca, ojos cerrados, medium shot" en 2 shots distintos) — eso sí se lee
  como la misma foto duplicada. Si notás que 2 candidatos elegidos comparten
  esa combinación completa, cambiá uno de los dos por una variante distinta.
- El banco tiene mucha más variedad real de la que parece a primera vista:
  además de los momentos "posados" obvios, hay cientos de candidatos reales
  de interacción con elementos propios de un venue — escaleras, barandas o
  balcones, paredes con textura/decoración interesante, ventanas o vidrios,
  la barra del lugar, el espejo/mostrador de un baño elegante, entradas o
  umbrales, incluso el ascensor de llegada — usalos para variar composición
  real en vez de repetir siempre "de pie contra la baranda" o "sentada en la
  mesa". Revisá el panorama de abajo por este tipo de candidatos antes de
  conformarte con los tipos más obvios.
Preferí SIEMPRE un candidato real y fuerte del panorama de abajo antes que
inventar una escena sin respaldo — si para cierto tipo de encuadre no hay
ningún candidato relevante para este brief, no lo fuerces, elegí otro tipo
con mejor respaldo real.

VARIEDAD DE TIPO DE FOTO, NO SOLO DE POSE (bug real confirmado: un set
entero de 5 shots resultó en 5 fotos de la protagonista posando/mirando a
cámara, sin ninguna otra variedad — cada shot individualmente estaba bien
resuelto, pero el conjunto se sentía monótono porque TODOS compartían el
mismo tipo de foto: "ella es el sujeto central, mirando hacia algo"). Un
rollo real de fotos de una noche no es solo fotos de ella — también incluye
fotos de lo que la rodea: la comida/trago recién servido en la mesa (sin
que ella esté en cuadro), la vista del venue sola, un detalle del outfit o
un accesorio sobre la mesa, el ambiente del lugar. El banco tiene evidencia
real de sobra para esto (grupos shot_type "detail_closeup" y "flat_lay" —
revisalos en el panorama de abajo). Para un set de 5+ shots, considerá
activamente si 1-2 de ellos funcionan mejor como esta variante — no es
obligatorio, es una opción real que hay que evaluar, no descartar por
default. Cuando un shot NO muestra a la protagonista, marcá
protagonistVisible=false (ver más abajo) y priorizá que aporte al eje
outfit_increible mostrando algo tangible de la experiencia (el trago, la
vista, el detalle) — nunca lo uses solo para "llenar cupo" sin conexión
real a la historia.

REGLA ANTI-ALUCINACIÓN — verificación obligatoria antes de responder: cada
shot debe usar un itemId DISTINTO del panorama (nunca repitas
chosenCandidateId entre 2 shots del mismo set). Si en algún shotReasoning
vas a escribir una comparación entre shots (ej. "es la misma imagen que el
shot X", "similar al anterior", "hace de contraparte de..."), releé
primero los 2 itemIds involucrados en el panorama de arriba y confirmá que
la comparación es literalmente cierta — nunca afirmes que 2 candidatos son
"la misma imagen" o "la misma escena" a menos que sean exactamente el mismo
itemId. Si tenés dudas sobre si dos candidatos son iguales o distintos, no
lo afirmes — describí cada uno por separado con lo que ves en su propio
resumen.

vehicleLabel (obligatorio en cada shot): una descripción corta en 2-5
palabras del tipo de foto, en español, pensada para que un humano entienda
de un vistazo qué es (ej. "mirror selfie con trago", "detalle de copa en la
mesa", "retrato de cuerpo entero"). NUNCA uses el itemId del candidato como
vehicleLabel — el itemId va aparte, en chosenCandidateId.

PANORAMA DEL BANCO DISPONIBLE (agrupado por tipo de encuadre real —
shot_type — no por categoría narrativa; cada línea es un candidato real del
banco, resumido; elegí libremente de cualquier grupo, no hace falta usar
todos los grupos ni distribuir parejo entre ellos). Además de los grupos por
shot_type, hay grupos "escena:X" (ej. "escena:club_discoteca",
"escena:auto_transicion") que resaltan vetas de ambiente/contexto real del
banco — un mismo candidato puede aparecer tanto en su grupo de shot_type
como en su grupo de escena, es la misma foto, no la cuentes dos veces al
armar el set. Prestá atención especial a los grupos "escena:" cuando el
brief lo amerite (ej. si el brief menciona un club/discoteca, revisá primero
si existe "escena:club_discoteca" antes de conformarte con candidatos
genéricos de mirror_selfie o medio_cuerpo):

${formatWidePool(widePool)}

INSTRUCCIÓN CENTRAL — cómo evaluar cada candidato:
Un candidato puede ser útil sin que TODO en él sirva. El escenario, comida,
outfit específico y acompañante de CADA candidato son solo inspiración de
pose/gesto/composición — el brief real y las referencias del usuario
siempre reemplazan lo específico del candidato del banco. Para cada shot
elegido, completá keptElements (qué SÍ es transferible: pose, gesto,
mirada, tipo de encuadre) y discardedElements (qué NO: vestuario del
candidato, escenario específico, iluminación si no coincide con la hora
real del brief).

RAZONAMIENTO DE ACCESORIOS (accessoryReasoning, obligatorio en cada shot):
si el shot muestra a la protagonista sosteniendo/llevando el accesorio con
naturalidad, el default es "se mantienen presentes, sin motivo para
excluirlos". Si el shot NO tiene a la protagonista en cuadro o sus manos
ocupadas en otra cosa, el default es "no aparece en este plano — no hay
razón real para que esté en la escena" (nunca dejes un accesorio
"estacionado" en la escena sin que nadie lo sostenga ni haya una razón
narrativa real para que esté ahí).

MOTIVO DE EXISTENCIA (existenceReason, obligatorio): completá "esta foto
existe porque..." con la razón concreta por la que la PROTAGONISTA
publicaría esta foto — nunca una respuesta genérica tipo "para mostrar el
momento".

REFERENCIAS REALES A ENRUTAR (companionVisible, footwearVisible,
protagonistVisible — obligatorios en cada shot, controlan qué fotos de
referencia reales se usan para generar la imagen, no son solo descriptivos):
- protagonistVisible: default true — false SOLO para un detail shot real
  donde la protagonista NO aparece en cuadro (ver VARIEDAD DE TIPO DE FOTO
  arriba): comida/trago sin ella, la vista del venue sola, un objeto/detalle
  del outfit sobre una superficie. Declararlo false evita que el sistema
  fuerce su identidad/cuerpo/outfit en una imagen que no debería mostrarla —
  si tenés dudas sobre si ella aparece o no en el encuadre final, dejalo en
  true (el default seguro).
- companionVisible: true SOLO si el prompt final de ESTE shot va a describir
  a un acompañante real y reconocible en cuadro (rostro o cuerpo propio,
  parte identificable de una persona) — no una mano genérica de fondo, no
  "alguien fuera de cuadro", no un brindis contra una mano incidental de
  utilería. Si el candidato del banco tenía compañera pero decidiste
  descartar esa parte específica (va a discardedElements), companionVisible
  es false. Cuando sea true, se usa la foto de referencia real del
  acompañante que subió el usuario — declararlo mal genera una persona
  inventada en la imagen final, evitalo si tenés dudas.
- footwearVisible: true si el encuadre elegido (según lo que ves en el
  candidato real) muestra los pies/calzado de la protagonista dentro del
  plano — false si es un encuadre que corta antes (close-up de rostro,
  medio cuerpo, plano de manos/objeto).

LÍNEA DE TIEMPO (timelineStages, 2 a 4 bloques amplios, ej. "llegada al
venue" / "más avanzada la noche") — solo para evitar contradicciones
groseras de continuidad (un shot de "yéndose" seguido de otro que la
muestra todavía en el venue con más gente), nunca para forzar una
progresión estricta shot-a-shot.

REGLAS DURAS DE CONTINUIDAD:
- Si 2+ shots comparten el mismo venue, decidí needsVenueAnchor=true y
  describí en continuityNote qué debe mantenerse consistente entre ellos.
- Comida/bebida en mesa: siempre en el punto más atractivo (recién servida
  o a la mitad), nunca vacía con restos.
- Si algún shot muestra el interior de un auto, es SIEMPRE desde el punto
  de vista de una pasajera — nunca manos en el volante ni llaves sueltas
  como si alguien acabara de estacionar.

Devolvé el resultado en el formato JSON pedido.`;
}

// Reconstruye texto rico (8 campos) SOLO para los itemIds que Gemini eligió
// en "Decidir" — evita mandar detalle completo de cientos de candidatos en
// el panorama (ver comentario de cabecera del archivo).
export function buildRichDetailBlock(chosenIds: string[], bankItems: OpenBankAnalysisItem[]): string {
  const byId = new Map(bankItems.map(it => [it.itemId, it]));
  return chosenIds
    .map(id => {
      const item = byId.get(id);
      if (!item) return `### ${id}\n  (candidato no encontrado en el banco — puede haber sido inventado, ignorar)`;
      const d = item.analysis.raw_visual_description || {};
      return `### ${id}
  pose: ${d.subject_pose || 'N/A'}
  gesto: ${d.subject_gesture || 'N/A'}
  mirada: ${d.subject_gaze || 'N/A'}
  outfit: ${d.outfit_visible || 'N/A'}
  objetos: ${d.visible_objects || 'N/A'}
  fondo: ${d.background_setting || 'N/A'}
  luz: ${d.lighting || 'N/A'}
  encuadre: ${d.camera_framing || 'N/A'}`;
    })
    .join('\n\n');
}

export function buildOpenBankWritePrompt(
  brief: string,
  plan: OpenBankPlan,
  richDetailBlock: string,
  energy?: 'elegante' | 'fiesta',
): string {
  const shotsText = plan.shots.map((shot, i) => `
### Shot #${i + 1}: ${shot.vehicleLabel}
Eje narrativo: ${shot.narrativeAxis}
${shot.protagonistVisible === false ? 'ESTE SHOT ES UN DETAIL SHOT SIN LA PROTAGONISTA EN CUADRO — no la describas, ni su rostro, cuerpo ni outfit; el prompt final debe poder generarse sin ninguna referencia de identidad/cuerpo/outfit de ella. Describí solo el objeto/comida/vista/detalle del venue.\n' : ''}Candidato de referencia elegido: ${shot.chosenCandidateId || '(ninguno, describir desde cero)'}
Razonamiento: ${shot.shotReasoning}
Elementos a MANTENER (pose/gesto/mirada/composición/encuadre — transferibles):
${(shot.keptElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
Elementos a DESCARTAR (reemplazar por el brief real/las referencias del usuario):
${(shot.discardedElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
¿Necesita continuidad de venue con otro shot del set?: ${shot.needsVenueAnchor ? `Sí — ${shot.continuityNote}` : 'No'}
Momento de la noche (timeline): ${shot.timelineStage}
Por qué existe esta foto: ${shot.existenceReason}
Accesorios no-esenciales (bolso, gafas, bufanda) en este shot: ${shot.accessoryReasoning}
`).join('\n');

  return `Sos el redactor final de prompts del Director Creativo de Photodump. Ya se decidió, para cada shot, qué elementos de qué candidato del banco son reutilizables — tu trabajo AHORA es escribir el prompt final en INGLÉS, listo para pegar en un generador de imágenes real.

${PHOTODUMP_HARD_RULES_TEXT}

BRIEF REAL DEL USUARIO (la escena/lugar/hora real a describir, reemplaza cualquier escenario específico de los candidatos del banco): "${brief}"

ENERGÍA REAL DE ESTA NOCHE: ${energy === 'fiesta' ? 'FIESTA' : 'ELEGANTE (cena, previa, salida tranquila — sin pista de baile ni club)'}. REGLA DURA, aplica a CUALQUIER shot: si la energía es ELEGANTE, ningún prompt puede describir pista de baile, luces de club/neón/láser, gente bailando en grupo, ni ningún elemento de fiesta/discoteca — aunque el candidato del banco elegido tuviera esos elementos, van siempre a discardedElements y se reemplazan por el registro real de la noche.

REGLAS DE ESTILO FIJAS — aplican a TODOS los shots, agregalas al final de cada prompt:
${OPEN_BANK_STYLE_RULES_TEXT}

REGLA CENTRAL: para cada shot, describí SOLO la pose/gesto/mirada/encuadre/composición que se decidió mantener del candidato — nunca menciones el escenario, comida u outfit específico de la foto del banco si fueron marcados para descartar. El escenario debe ser el del brief real del usuario, y el outfit se resuelve por referencia de imagen (no hace falta describirlo en detalle) — mencionalo solo si es relevante para la pose.

REGLAS DURAS DE REDACCIÓN:
1. NUNCA describas ninguna prenda, color de ropa, o cómo cae/se acomoda la ropa del candidato del banco — el outfit lo resuelve la imagen de referencia del usuario, nunca texto describiendo ropa de otra persona.
2. La ILUMINACIÓN de cada shot debe corresponder a la HORA REAL del evento en el brief del usuario, no a la del candidato del banco, salvo que coincidan.
3. FIDELIDAD DE PROPORCIÓN CORPORAL (misma prioridad que la identidad): nunca describas la silueta o contextura de la protagonista de forma genérica ni distinta a la de la referencia real de cuerpo — no la endereces, adelgaces, ni le agregues curvas que la referencia no tiene. Si el gesto/pose de un candidato del banco implica una silueta que no calza con el cuerpo real de la referencia (ej. una pose que depende de una cintura muy marcada que la referencia no tiene), ajustá la descripción de la pose para que sea físicamente coherente con el cuerpo real, no al revés.
4. PROPS/SUPERFICIES HEREDADAS DEL CANDIDATO (espejos, vidrios, muebles decorativos que no forman parte del brief real): nunca los copies literal sin verificar que tienen un lugar lógico en el venue real — ver regla 6 de las reglas no negociables arriba. Si el candidato elegido incluye un espejo/vidrio/mueble que no tiene sentido en el venue del brief, resolvé la pose con el equivalente real del venue (un vidrio/baranda propio del lugar, el espejo de un baño si el shot ocurre ahí) o quitalo del todo — nunca describas un mueble/superficie flotante sin justificación física.
5. MECÁNICA FÍSICA DE CÓMO SE TOMÓ LA FOTO (bug real confirmado 2 veces, en 2 direcciones opuestas — no es un detalle menor: primero un gesto posado se redactó con ángulo de selfie sin ninguna cámara real; después un MIRROR SELFIE real se redactó "sin mostrar el teléfono", dejando el reflejo del espejo sin explicación de cómo se tomó, porque esa instrucción es de la lectura equivocada). Cualquier gesto donde la mano de la protagonista esté cerca de su propio rostro, O cualquier shot que use un espejo/reflejo, es AMBIGUO por defecto — nunca lo dejes sin resolver. Primero preguntate cuál de estas 3 lecturas es más creíble para ESTE momento puntual de la noche (no hay una respuesta fija, depende del contexto de cada shot: ¿hay compañía real que podría estar tomando la foto? ¿es un momento íntimo/solitario donde una selfie es lo más natural? ¿el shot ya usa un espejo/reflejo del venue?), y describila sin ambigüedad:
   a) Selfie de brazo extendido (SIN espejo en el encuadre): el ángulo/encuadre debe leerse como autocaptura (perspectiva ligeramente elevada, como fotografiándose a sí misma) — pero NUNCA muestres el teléfono en cuadro ni la mano sosteniéndolo; se resuelve solo con el ángulo de cámara y la postura del brazo, nunca describiendo el objeto.
   b) Mirror selfie (el shot muestra un espejo/reflejo real, ver regla 6 de las reglas no negociables sobre cuándo un espejo es creíble en el venue): acá el teléfono SÍ debe describirse, sostenido por la mano levantada hacia el rostro, visible EN EL REFLEJO — es lo que explica físicamente por qué existe esa imagen reflejada. Nunca omitas el teléfono en un mirror selfie: sin él, el reflejo queda sin justificación.
   c) Gesto posado captado por otra persona (compañía real presente, o casual/candid, SIN espejo ni selfie): la mano puede estar cerca de la cara con total naturalidad (tocándose el pelo, la mejilla, el cuello) porque hay alguien más sosteniendo la cámara — plano normal de tercero, sin ángulo elevado ni espejo.
   Nunca mezcles estas lecturas en el mismo shot (ej. mano posada "libre" en la cara pero con ángulo de selfie, o un mirror selfie sin el teléfono en el reflejo) — esa mezcla es la ambigüedad real que rompe la sensación de "esta foto existe porque..." del manifiesto.

Si un shot dice que necesita continuidad de venue con otro shot del set, agregá una línea explícita ("SCENE CONTINUITY: same venue as the previous shot — reuse the exact same background, furniture and lighting — including the same specific table, chairs and any furniture already described in that shot, not a new one.") antes de la descripción de venue — la continuidad de mobiliario es tan importante como la del fondo, no solo el "lugar" en abstracto.

ACCESORIOS NO-ESENCIALES — REGLA DE SILENCIO POR DEFAULT: NO menciones el accesorio en el texto salvo que el razonamiento haya dado una razón real. Si el razonamiento es el default de protagonista-en-cuadro ("se mantienen presentes"), NO escribas nada — dejá que la imagen de referencia lo resuelva sola. Si el razonamiento es el default de plano-sin-protagonista ("no aparece en este plano"), escribí una línea breve dejándolo explícitamente fuera del encuadre.

DETALLE COMPLETO DE LOS CANDIDATOS ELEGIDOS (para redactar con precisión):
${richDetailBlock}

PLAN DE SHOTS YA DECIDIDO:
${shotsText}

Devolvé el resultado en el formato JSON pedido — un finalPrompt completo en inglés por cada shot. IMPORTANTE: en cada shot del array de salida, copiá literal el número que aparece después de "Shot #" en shotIndex (ej. "Shot #3" → shotIndex: 3) — es el identificador real que usa el sistema para emparejar tu prompt con el plan, más confiable que el texto de vehicleLabel. Incluí también vehicleLabel (mismo texto del plan) solo como referencia legible.`;
}
