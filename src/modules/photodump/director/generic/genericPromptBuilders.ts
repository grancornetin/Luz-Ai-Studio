/**
 * modules/photodump/director/generic/genericPromptBuilders.ts
 *
 * Construcción de schema/prompt del Director Creativo GENÉRICO — sucesor de
 * director/openBank/openBankPromptBuilders.ts (837 líneas escritas para
 * outfit_night_out a lo largo de 28+ pruebas reales). outfit_night_out se
 * retira del producto; outfit_check es la primera receta que necesita el
 * MISMO mecanismo (banco real, sin categorías de shot con nombre fijo,
 * razonamiento libre de Gemini en 2 pasos Decidir→Redactar).
 *
 * División real de lo que se separó (auditoría hecha línea por línea del
 * archivo original antes de escribir este):
 *  - GENÉRICO, se queda tal cual (movido sin reescribir): reglas anti-
 *    alucinación, keptElements/discardedElements, accessoryReasoning,
 *    existenceReason, outfitFramingVisible/footwearVisible/
 *    protagonistVisible/companionVisible, mecánica física de selfie/mirror/
 *    gesto posado (los 3 bugs reales de esa sección), "no lenguaje
 *    inferencial", "prohibido X or Y", "no empezar en la llegada" (se
 *    generaliza a "no empezar en el default obvio de esta receta").
 *  - ESPECÍFICO de night_out, se movió al contrato de esa receta (donde
 *    sigue existiendo mientras la receta no se borre del todo): núcleo
 *    narrativo "noche memorable + outfit increíble", reglas de auto/trago/
 *    baño, filtro de tono de "ropa interior solo en preparación".
 *  - GENERALIZADO de nombre (misma lógica, vocabulario neutro): venue →
 *    "lugar" (placeAnchorLabel del contrato), isMainVenue → isMainPlace,
 *    needsVenueAnchor → needsPlaceAnchor, OpenBankVenueObservation →
 *    PlaceObservation.
 */
import { HARD_RULES_TEXT as PHOTODUMP_HARD_RULES_TEXT } from '../hardRules.js';
import type { DirectorReferenceImage } from '../types';
import type {
  WideCandidatePool, GenericPlan, GenericAnalysisItem, GenericShotDecision,
  PlaceObservation, RecipeDirectorContract,
} from './genericTypes';

export function buildGenericPlanSchema(contract: RecipeDirectorContract) {
  return {
    type: 'object',
    properties: {
      globalReasoning: { type: 'string' },
      timelineStages: { type: 'array', items: { type: 'string' } },
      shots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            vehicleLabel: { type: 'string' },
            narrativeAxis: { type: 'string', enum: contract.narrativeAxisValues },
            psychologicalDrive: { type: 'string', enum: contract.relevantDrives },
            psychologicalReasoning: { type: 'string' },
            chosenCandidateId: { type: 'string' },
            shotReasoning: { type: 'string' },
            keptElements: { type: 'array', items: { type: 'string' } },
            discardedElements: { type: 'array', items: { type: 'string' } },
            needsPlaceAnchor: { type: 'boolean' },
            continuityNote: { type: 'string' },
            isMainPlace: { type: 'boolean' },
            accessoryReasoning: { type: 'string' },
            timelineStage: { type: 'string' },
            existenceReason: { type: 'string' },
            companionVisible: { type: 'boolean' },
            footwearVisible: { type: 'boolean' },
            protagonistVisible: { type: 'boolean' },
            outfitFramingVisible: { type: 'boolean' },
          },
          required: [
            'vehicleLabel', 'narrativeAxis', 'psychologicalDrive', 'psychologicalReasoning',
            'chosenCandidateId', 'shotReasoning',
            'keptElements', 'discardedElements', 'needsPlaceAnchor', 'continuityNote', 'isMainPlace',
            'accessoryReasoning', 'timelineStage', 'existenceReason',
            'companionVisible', 'footwearVisible', 'protagonistVisible', 'outfitFramingVisible',
          ],
        },
      },
    },
    required: ['globalReasoning', 'timelineStages', 'shots'],
  };
}

export const GENERIC_PROMPTS_SCHEMA = {
  type: 'object',
  properties: {
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: { shotIndex: { type: 'integer' }, vehicleLabel: { type: 'string' }, finalPrompt: { type: 'string' } },
        required: ['shotIndex', 'vehicleLabel', 'finalPrompt'],
      },
    },
  },
  required: ['shots'],
};

// Finding 005 (recipes/manifiesto de dirección/10_experimental_findings_001.md,
// validado julio 2026): el lenguaje de "camera roll" arregla la TEXTURA de la
// foto, no su COMPOSICIÓN — sin esto, el modelo compone como campaña editorial
// (sujeto centrado, mirada directa, fondo perfectamente enmarcado) aunque la
// textura ya sea correcta. Genérico, aplica a cualquier receta.
const UGC_CASUAL_COMPOSITION_BLOCK =
  'She is positioned off-center in the frame, not in the middle — standing toward one side with open space on the other side. ' +
  'Her gaze is directed away from the camera — toward the view, into the distance, or over her shoulder — not looking directly and posed at the lens, as if captured candidly rather than staged for it, EXCEPT for shots that are explicitly a selfie or a posed portrait moment, where direct eye contact with the camera is the natural choice. ' +
  'Framing is imperfect and casual: a slightly tilted horizon line, extra space to one side, or feet slightly cropped — the unstudied framing of a quick phone photo, not a professional composition.';

export const GENERIC_STYLE_RULES_TEXT = `
Camera roll quality: unedited photo, casual handheld feel, everyday smartphone capture, no catalogue finish, no beauty retouching, no editorial polish — a real, imperfect, authentic photo, not a professionally composed shot.
Avoid: editorial or catalog-like finish, overly polished or retouched skin, perfectly centered symmetric composition, walking or mid-stride pose, legs in a walking stance.
The background (when indoors/domestic) must be a real, lived-in space — never a photography studio, never a seamless backdrop, never a plain concrete or cyclorama floor.
She is standing still or naturally posed, not mid-stride.
Flat, even smartphone flash/ambient lighting — NOT a shallow depth of field, NOT heavy background bokeh, NOT a visible rim light or backlight outlining her silhouette against a dark background. The background stays reasonably legible (softly out of focus at most), never reduced to abstract blurred light dots — that look reads as a professional camera with a wide aperture, not a phone.
${UGC_CASUAL_COMPOSITION_BLOCK}
`.trim();

function formatWidePool(pool: WideCandidatePool): string {
  return Object.entries(pool)
    .map(([groupKey, candidates]) => {
      const lines = candidates
        .map(c => `  ${c.itemId} | ${c.companionPresent ? 'con acompañante' : 'sola'} | subjects:${c.subjectsVisible} | ${c.briefSummary}`)
        .join('\n');
      const label = groupKey.startsWith('escena:') ? groupKey : `shot_type: ${groupKey}`;
      return `### ${label} (${candidates.length} candidatos)\n${lines}`;
    })
    .join('\n\n');
}

export function buildGenericDecidePrompt(
  contract: RecipeDirectorContract,
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

  const axisA = contract.narrativeAxisValues[0];
  const axisB = contract.narrativeAxisValues[1];

  return `Sos el Director Creativo de "Photodump", un módulo que genera fotos tipo rollo-de-fotos-real de una historia para una app de contenido para creadoras.

${PHOTODUMP_HARD_RULES_TEXT}
${referenceImagesBlock}
BRIEF DEL USUARIO: "${brief}"

NÚCLEO NARRATIVO DE ESTA HISTORIA (el único criterio narrativo — no hay una lista fija de "tipos de foto" a rellenar):
> ${contract.narrativeCore}

Cada shot que elijas debe aportar evidencia real de AL MENOS UNO de estos 2
ejes (${contract.narrativeAxisLabels[axisA] ?? axisA} o ${contract.narrativeAxisLabels[axisB] ?? axisB}) — marcalo en narrativeAxis. Los
shots más fuertes aportan a los 2 a la vez. NO existe una secuencia canónica
de shots ni un orden obligatorio — un set real de fotos puede empezar directo
en el momento fuerte, puede repetir el mismo tipo de encuadre dos veces si
cuenta algo distinto cada vez, puede saltarse la preparación por completo.
Vos decidís, para ESTE brief puntual, qué combinación de fotos cuenta mejor
esta historia — no rellenes categorías, componé la historia real.

LECTURA PSICOLÓGICA DE CADA CANDIDATO (manifiesto §3, obligatoria antes de
elegir): la razón por la que un tipo de foto genera atención real en redes
casi nunca es "se ve linda" — es que activa un impulso motivacional
específico. Para esta receta, los impulsos relevantes son:
${contract.relevantDrivesText}
Antes de elegir un candidato, preguntate: ¿qué impulso de estos hace que
ESTE tipo de foto específico genere atención real si alguien la publicara?
Usá esa lectura para juzgar si el candidato es realmente fuerte (no solo si
combina con el brief en palabras) y para decidir qué pose/ángulo/gesto vale
la pena heredar en keptElements. Declará el impulso identificado en
psychologicalDrive, y en psychologicalReasoning explicá en 1-2 frases POR
QUÉ ese candidato puntual activa ese impulso.
REGLA DURA: psychologicalReasoning es tu razonamiento INTERNO de director,
nunca se traduce a texto literal en el prompt final ni implica prometer un
resultado social (pretendientes, envidia, aceptación) — eso viola los
guardrails del manifiesto (§15). Se usa solo para elegir mejor la pose y
justificar por qué el candidato es fuerte, nunca aparece en shotReasoning
ni en existenceReason con ese lenguaje: esos campos siempre describen la
experiencia propia de la protagonista (self-focused), nunca el efecto que
la foto tendría en terceros (other-focused).

FILTRO DE TONO Y PLAUSIBILIDAD (específico de esta receta):
${contract.toneRulesText}

CANTIDAD TOTAL DE SHOTS — LÍMITE DURO: el array "shots" debe tener
EXACTAMENTE ${totalShotsRequested} elementos, ni uno más ni uno menos.
${totalShotsRequested === 1 ? `
CASO ESPECIAL — 1 SOLA FOTO EN TODO EL SET: esta sesión pide UNA ÚNICA
imagen, no un set. Todo lo de abajo (diversidad entre shots, continuidad de
lugar entre shots, línea de tiempo de varios momentos) fue escrito pensando
en sets de varias fotos — con 1 sola foto no aplica nada de eso, porque no
hay "otro shot" con el que comparar o dar continuidad.

El criterio para elegir el candidato NO es una checklist de composición
("que se vea el cuerpo completo", "que salga de pie o sentada") — es una
SENSACIÓN psicológica concreta: la protagonista se ve increíble, se sacó una
foto instagrameable, se ve de infarto, se sintió poderosa, deseable, bella,
encontró un lugar/momento con carácter y se retrató ahí. Esa sensación es lo
que tiene que transmitir la ÚNICA foto de este set — más que cualquier regla
de encuadre. Un candidato de medio cuerpo con una pose expresiva, una mirada
segura, un contexto con carácter propio y detalle real puede transmitir esa
sensación mucho mejor que un candidato de cuerpo entero parada neutra
mirando derecho a cámara — priorizá la intensidad de esa sensación por sobre
cuánto cuerpo entra en el encuadre.
El outfit debe seguir siendo identificable (no un plano que lo oculte por
completo), pero no hace falta que se vea de arriba a abajo.
Evitá elegir un candidato pensado para ser "un detalle dentro de una
secuencia" (un detail shot sin protagonista, un plano de pies o manos, un
close-up de un accesorio solo) — acá no hay otras fotos que completen el
resto de la historia, todo tiene que estar en este único frame.
` : ''}

DIVERSIDAD REAL — qué SÍ puede repetirse vs. qué NO (confirmado contra datos
reales del banco, no es una prohibición general de repetir nada):
- SÍ es válido, y de hecho enriquece, que un mismo accesorio reaparezca en
  varios shots (bolso, gafas de sol, teléfono) — es lo esperable de una
  sesión real con un solo outfit, no una señal de repetición pobre. Lo mismo
  aplica a "de pie, cuerpo completo mostrando el outfit" como encuadre
  general — puede aparecer en más de un momento SI el gesto, la mirada o la
  interacción con el entorno cambian entre esos shots.
- NO es válido que 2+ shots compartan el mismo gesto Y la misma expresión Y
  el mismo tipo de encuadre a la vez — eso sí se lee como la misma foto
  duplicada. Si notás que 2 candidatos elegidos comparten esa combinación
  completa, cambiá uno de los dos por una variante distinta.
- El banco tiene mucha más variedad real de la que parece a primera vista:
  además de los momentos "posados" obvios, hay cientos de candidatos reales
  de interacción con elementos del entorno — escaleras, barandas o balcones,
  paredes con textura/decoración interesante, ventanas o vidrios, espejos,
  entradas o umbrales — usalos para variar composición real en vez de
  repetir siempre el mismo tipo de plano. Revisá el panorama de abajo por
  este tipo de candidatos antes de conformarte con los tipos más obvios.
Preferí SIEMPRE un candidato real y fuerte del panorama de abajo antes que
inventar una escena sin respaldo — si para cierto tipo de encuadre no hay
ningún candidato relevante para este brief, no lo fuerces, elegí otro tipo
con mejor respaldo real.

VARIEDAD DE TIPO DE FOTO Y DETAIL SHOTS (3 bugs reales relacionados,
consolidados): un rollo real no es solo fotos de ella posando — también
incluye fotos de lo que la rodea (un detalle del outfit, la vista, un objeto
del momento). El banco tiene evidencia real de sobra para esto (grupos
"detail_closeup"/"flat_lay").
- CUÁNDO USARLO: si ya tenés 2-3 shots fuertes de la protagonista y el
  resto del cupo no tiene una idea igual de fuerte/natural, la señal
  correcta es sumar un detail shot sin ella — NO forzar una pose/ángulo raro
  para seguir mostrándola. Un set más corto con shots todos fuertes vale más
  que llegar al número pedido a costa de 1-2 shots poco naturales.
- CÓMO EJECUTARLO: cuando protagonistVisible=false, eso tiene que reflejarse
  TAMBIÉN en chosenCandidateId/keptElements — no elijas un candidato donde
  ella sostiene el objeto si el objetivo es que no esté en cuadro.
- QUÉ NO CALIFICA COMO DETAIL SHOT VÁLIDO (bug real confirmado, prueba 22
  ago 2026, reacción textual del usuario: "WTF, es una aberración, qué
  aporta, qué lo justifica, es absurda"): un plano cenital de sus propios
  pies/piernas apoyados en una superficie (grupo "pov_down" del banco) NO
  tiene el mismo valor narrativo que un objeto/vista/outfit sobre una
  superficie real — no transmite ningún eje del núcleo narrativo, es un
  plano que existe en el banco por variedad fotográfica pura, no porque
  alguien publicaría genuinamente esa foto. Antes de elegir un candidato de
  detail shot, aplicá el mismo filtro de existenceReason que a cualquier
  otro shot: si no podés completar "esta foto existe porque..." con una
  razón real y específica (no genérica), no es un detail shot válido para
  este set — preferí quedarte con menos shots totales antes que sumar uno así.

SELFIE DE BRAZO EXTENDIDO (bug real confirmado 2 veces): distinto del
mirror selfie (requiere espejo real) y del plano posado por otra persona —
es el tipo de foto más natural y frecuente de un rollo real, y suele faltar
por completo si no se lo pide explícitamente. Para un set de 5+ shots, salvo
que el brief lo haga implausible, el plan DEBE incluir al menos 1
(candidatos reales en "selfie_frontal"/"close_up"). Regla física no
negociable: por la distancia real del brazo, SOLO puede mostrar rostro/
hombros/torso superior — nunca piernas, calzado, ni el outfit completo. Si
el objetivo de un shot es mostrar el outfit completo, ESE shot no puede ser
selfie de brazo — usá plano posado o mirror selfie. Cuando elijas uno,
dejalo explícito en vehicleLabel (ej. "selfie de brazo extendido").

DÓNDE SE TOMA UN SELFIE (bug real confirmado, prueba 22 ago 2026): tanto el
selfie de brazo extendido como el mirror selfie tienen una lógica social real
detrás de POR QUÉ se eligen para publicar — nadie se saca este tipo de foto
en cualquier parte concurrida, se busca un momento/rincón donde no haya
desconocidos ni elementos de fondo que compitan por la atención con la
protagonista. El banco tiene decenas de ejemplos reales de este patrón
(selfies en fondos despejados, rincones bonitos, vistas, o con como mucho
1-2 personas reconocibles y desenfocadas, nunca una multitud nítida) — al
elegir candidato y redactar el fondo, priorizá un sector despejado por sobre
el área central concurrida para CUALQUIER shot tipo selfie.

NO DUPLICAR "DE PIE, FRONTAL, CUERPO ENTERO" (bug real: 2 fotos casi
idénticas en el mismo set — de pie, torso derecho a cámara, sonriendo, sin
interacción). Válido UNA vez por set como máximo — el siguiente shot de pie
necesita algo real que lo diferencie: giro de torso/mirada, interacción con
el entorno, u ángulo distinto.

CUIDADO: EL TEXTO DEL ANÁLISIS PUEDE "APLANAR" UNA POSE QUE EN LA FOTO REAL
ES VIVA (ver también la regla de "pose mugshot" en las reglas no
negociables arriba). subject_pose a veces resume una foto con piernas
cruzadas, codos marcados, actitud real, en términos neutros/simétricos —
pérdida de matiz al resumir, no la pose real. Si el resto del candidato es
fuerte pero subject_pose suena plano, redactá la pose heredada agregando el
elemento de vida que probablemente se perdió: peso cargado en una pierna,
quiebre de cadera, codo marcado, mentón/mirada con actitud.

REGLA ANTI-ALUCINACIÓN — verificación obligatoria antes de responder: cada
shot debe usar un itemId DISTINTO del panorama (nunca repitas
chosenCandidateId entre 2 shots del mismo set). Si en algún shotReasoning
vas a escribir una comparación entre shots, releé primero los 2 itemIds
involucrados en el panorama de arriba y confirmá que la comparación es
literalmente cierta — nunca afirmes que 2 candidatos son "la misma imagen"
a menos que sean exactamente el mismo itemId.

vehicleLabel (obligatorio en cada shot): una descripción corta en 2-5
palabras del tipo de foto, en español, pensada para que un humano entienda
de un vistazo qué es. NUNCA uses el itemId del candidato como vehicleLabel.

PANORAMA DEL BANCO DISPONIBLE (agrupado por tipo de encuadre real —
shot_type — no por categoría narrativa; cada línea es un candidato real del
banco, resumido; elegí libremente de cualquier grupo, no hace falta usar
todos los grupos ni distribuir parejo entre ellos). Además de los grupos por
shot_type, hay grupos "escena:X" que resaltan vetas de ambiente/contexto
real del banco — un mismo candidato puede aparecer tanto en su grupo de
shot_type como en su grupo de escena, es la misma foto, no la cuentes dos
veces al armar el set:

${formatWidePool(widePool)}

INSTRUCCIÓN CENTRAL — cómo evaluar cada candidato:
Un candidato puede ser útil sin que TODO en él sirva. El escenario, outfit
específico y acompañante de CADA candidato son solo inspiración de pose/
gesto/composición — el brief real y las referencias del usuario siempre
reemplazan lo específico del candidato del banco. Para cada shot elegido,
completá keptElements (qué SÍ es transferible: pose, gesto, mirada, tipo de
encuadre) y discardedElements (qué NO: vestuario del candidato, escenario
específico, iluminación si no coincide con la hora real del brief).

RAZONAMIENTO DE ACCESORIOS (accessoryReasoning, obligatorio en cada shot):
si el shot muestra a la protagonista sosteniendo/llevando el accesorio con
naturalidad, el default es "se mantienen presentes, sin motivo para
excluirlos". Si el shot NO tiene a la protagonista en cuadro o sus manos
ocupadas en otra cosa, el default es "no aparece en este plano — no hay
razón real para que esté en la escena".

MOTIVO DE EXISTENCIA (existenceReason, obligatorio): completá "esta foto
existe porque..." con la razón concreta por la que la PROTAGONISTA
publicaría esta foto — nunca una respuesta genérica tipo "para mostrar el
momento".

REFERENCIAS REALES A ENRUTAR (companionVisible, footwearVisible,
protagonistVisible, outfitFramingVisible — obligatorios en cada shot,
controlan qué fotos de referencia reales se usan para generar la imagen, no
son solo descriptivos):
- protagonistVisible: default true — false SOLO para un detail shot real
  donde la protagonista NO aparece en cuadro. Si tenés dudas, dejalo en true.
- companionVisible: true SOLO si el prompt final de ESTE shot va a describir
  a un acompañante real y reconocible en cuadro — no una mano genérica de
  fondo, no "alguien fuera de cuadro". Declararlo mal genera una persona
  inventada en la imagen final.
- footwearVisible: true si el encuadre elegido muestra los pies/calzado de
  la protagonista dentro del plano — false si es un encuadre que corta
  antes (close-up de rostro, medio cuerpo, plano de manos/objeto).
- outfitFramingVisible: false SOLO para un close-up real donde el encuadre
  corta a la altura del pecho/cuello hacia arriba — la prenda apenas se ve
  o no se ve en absoluto. true para cualquier encuadre que sí muestre el
  torso/prenda con claridad. Esta señal decide si se manda o no la foto de
  referencia de outfit completo (cuerpo entero) al generador: cuando un
  shot pide un close-up de rostro EN TEXTO pero igual recibe esa referencia
  de cuerpo entero, el generador tiende a copiar su composición y termina
  produciendo un plano de cuerpo entero en vez del close-up pedido. Si
  tenés dudas, dejalo en true (el default seguro que prioriza fidelidad de
  outfit).

LÍNEA DE TIEMPO (timelineStages, 2 a 4 bloques amplios) — solo para evitar
contradicciones groseras de continuidad, nunca para forzar una progresión
estricta shot-a-shot.

${contract.extraContinuityRulesText}

${contract.usesSharedPlaceAnchor ? `
isMainPlace (obligatorio en cada shot, controla qué imagen real se usa como
ancla de continuidad — no es solo descriptivo): true si este shot ocurre en
el ${contract.placeAnchorLabel} PRINCIPAL de la historia, false si ocurre en
cualquier otra etapa. El PRIMER shot del set con isMainPlace=true es el que
fija la imagen de ancla real para TODOS los shots posteriores que también
tengan isMainPlace=true — sin importar si ese lugar principal empieza en el
shot 1, 2 o 4 del set. Esto aplica a CUALQUIER tipo de shot de ese lugar
principal, no solo los que muestran a la protagonista. Un shot puede tener
needsPlaceAnchor=true (aporta continuidad de lugar con el resto) e
isMainPlace=false a la vez NUNCA — si comparte lugar con otros shots, es
porque es parte del lugar principal.

QUÉ CANDIDATO CALIFICA PARA SER EL PRIMER SHOT isMainPlace=true DEL SET
(bug real confirmado, causa raíz investigada a fondo): la imagen de ESTE
shot puntual se usa como ancla visual real para TODOS los shots posteriores
del lugar principal — no es un shot más, es la ÚNICA fuente real de qué
mobiliario/piso/materiales existen ahí. Un candidato de pie, sin mesa/barra/
asiento visible en el encuadre (ej. de pie contra la vista, en un umbral o
línea de transición entre 2 zonas) deja una imagen ancla SIN NINGÚN
mobiliario real que los shots siguientes puedan observar y reusar — cada
shot que después necesite una mesa/asiento terminaría inventando el suyo,
sin ninguna continuidad real entre ellos. Regla dura: al elegir el candidato
para el PRIMER shot isMainPlace=true del set, preferí siempre uno que
muestre un espacio claramente ESTABLECIDO (sentada o de pie junto a un
mueble real y visible en el encuadre, con piso/suelo continuo de una sola
zona — nunca un umbral, rampa de acceso, pasillo de entrada, o línea de
transición entre 2 tipos de piso distintos) — aunque ese no sea el candidato
más fuerte en pose para ser "el primero" en otros sentidos.

NO ABANDONAR UN SUB-ESPACIO CERRADO APENAS ENTRADO (bug real confirmado,
reacción textual del usuario: "sin sentido, de pronto está frente a un
espejo tomándose la selfie en otra parte... se siente fuera de lugar e
ilógico para la historia"): si un shot entra a un sub-espacio cerrado (baño,
vestidor, ascensor) para un mirror selfie o un momento íntimo, el shot
INMEDIATAMENTE siguiente no puede volver de golpe a un área abierta sin
ninguna razón narrativa — ese salto se lee como que nunca estuvo ahí. Si el
candidato elegido para el sub-espacio es fuerte, preferí sacarle más de un
shot ahí antes de salir. Si narrativamente hace falta volver al área
abierta después, dejá al menos un shot de transición entre medio (o una
nota explícita en shotReasoning de por qué sale) — nunca un salto directo
sin ningún shot ni mención que lo explique.
` : `
isMainPlace/needsPlaceAnchor: esta receta NO usa anclaje de lugar
compartido entre shots — declará needsPlaceAnchor=false e isMainPlace=false
en todos los shots. Cada shot resuelve su propio contexto sin depender de
continuidad visual real con otro shot del set.
`}

Devolvé el resultado en el formato JSON pedido.`;
}

// Reconstruye texto rico (8 campos) SOLO para los itemIds que Gemini eligió
// en "Decidir" — evita mandar detalle completo de cientos de candidatos en
// el panorama. Idéntica a la versión de openBank, sin cambios.
export function buildRichDetailBlock(chosenIds: string[], bankItems: GenericAnalysisItem[]): string {
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

export function buildGenericWritePrompt(
  contract: RecipeDirectorContract,
  brief: string,
  plan: GenericPlan,
  richDetailBlock: string,
  energy?: 'elegante' | 'fiesta',
): string {
  const shotsText = plan.shots.map((shot, i) => `
### Shot #${i + 1}: ${shot.vehicleLabel}
Eje narrativo: ${shot.narrativeAxis}
${shot.protagonistVisible === false ? 'ESTE SHOT ES UN DETAIL SHOT SIN LA PROTAGONISTA EN CUADRO — no la describas, ni su rostro, cuerpo ni outfit; el prompt final debe poder generarse sin ninguna referencia de identidad/cuerpo/outfit de ella. Describí solo el objeto/vista/detalle.\n' : ''}Candidato de referencia elegido: ${shot.chosenCandidateId || '(ninguno, describir desde cero)'}
Razonamiento: ${shot.shotReasoning}
Elementos a MANTENER (pose/gesto/mirada/composición/encuadre — transferibles):
${(shot.keptElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
Elementos a DESCARTAR (reemplazar por el brief real/las referencias del usuario):
${(shot.discardedElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
¿Necesita continuidad de ${contract.placeAnchorLabel} con otro shot del set?: ${shot.needsPlaceAnchor ? `Sí — ${shot.continuityNote}` : 'No'}
Momento (timeline): ${shot.timelineStage}
Por qué existe esta foto: ${shot.existenceReason}
Accesorios no-esenciales (bolso, gafas, bufanda) en este shot: ${shot.accessoryReasoning}
`).join('\n');

  return `Sos el redactor final de prompts del Director Creativo de Photodump. Ya se decidió, para cada shot, qué elementos de qué candidato del banco son reutilizables — tu trabajo AHORA es escribir el prompt final en INGLÉS, listo para pegar en un generador de imágenes real.

${PHOTODUMP_HARD_RULES_TEXT}

BRIEF REAL DEL USUARIO (la escena/lugar/hora real a describir, reemplaza cualquier escenario específico de los candidatos del banco): "${brief}"

ENERGÍA REAL: ${energy === 'fiesta' ? 'FIESTA' : 'ELEGANTE (sin pista de baile ni club)'}. REGLA DURA, aplica a CUALQUIER shot: si la energía es ELEGANTE, ningún prompt puede describir pista de baile, luces de club/neón/láser, gente bailando en grupo, ni ningún elemento de fiesta/discoteca — aunque el candidato del banco elegido tuviera esos elementos, van siempre a discardedElements y se reemplazan por el registro real de la historia.

REGLAS DE ESTILO FIJAS — aplican a TODOS los shots, agregalas al final de cada prompt:
${GENERIC_STYLE_RULES_TEXT}

REGLA CENTRAL: para cada shot, describí SOLO la pose/gesto/mirada/encuadre/composición que se decidió mantener del candidato — nunca menciones el escenario u outfit específico de la foto del banco si fueron marcados para descartar. El escenario debe ser el del brief real del usuario, y el outfit se resuelve por referencia de imagen (no hace falta describirlo en detalle) — mencionalo solo si es relevante para la pose.

REGLAS DURAS DE REDACCIÓN:
1. NUNCA describas ninguna prenda, color de ropa, o cómo cae/se acomoda la ropa del candidato del banco — el outfit lo resuelve la imagen de referencia del usuario, nunca texto describiendo ropa de otra persona. Esto incluye NO INVENTAR prendas nuevas que no están en ninguna referencia ni en el candidato. Si necesitás describir que se ve piel/un hombro/una prenda deslizándose para la pose, primero verificá que esa prenda exista en la referencia real del usuario (mirá el richDetailBlock/outfit real, no lo asumas) — si no podés confirmarlo, no lo menciones y dejá que la imagen de referencia del outfit resuelva qué prendas hay.
   MISMA REGLA APLICA A ACCESORIOS HEREDADOS DEL CANDIDATO, NO SOLO PRENDAS (bug real confirmado: un selfie de noche salió con lentes de sol puestos — ningún texto los pedía explícitamente, pero el candidato de referencia del banco los tenía, y además es implausible llevar lentes oscuros de noche). Antes de heredar cualquier objeto del candidato que no sea pose/gesto/encuadre (joyas puntuales, lentes, sombreros, accesorios de pelo), preguntate: (a) ¿está confirmado en alguna referencia real del usuario?, y (b) ¿tiene sentido lógico en el momento real descrito en el brief (hora, clima, contexto)? Si no podés confirmar ambas, no lo menciones ni lo heredes — va a discardedElements.
2. La ILUMINACIÓN de cada shot debe corresponder a la HORA REAL del evento en el brief del usuario, no a la del candidato del banco, salvo que coincidan.
3. FIDELIDAD DE PROPORCIÓN CORPORAL (misma prioridad que la identidad): nunca describas la silueta o contextura de la protagonista de forma genérica ni distinta a la de la referencia real de cuerpo — no la endereces, adelgaces, ni le agregues curvas que la referencia no tiene. Si el gesto/pose de un candidato del banco implica una silueta que no calza con el cuerpo real de la referencia, ajustá la descripción de la pose para que sea físicamente coherente con el cuerpo real, no al revés.
4. PROPS/SUPERFICIES HEREDADAS DEL CANDIDATO (espejos, vidrios, muebles decorativos que no forman parte del brief real): nunca los copies literal sin verificar que tienen un lugar lógico en el escenario real. Si el candidato elegido incluye un espejo/vidrio/mueble que no tiene sentido en el lugar del brief, resolvé la pose con el equivalente real del lugar o quitalo del todo — nunca describas un mueble/superficie flotante sin justificación física.
5. MECÁNICA FÍSICA DE CÓMO SE TOMÓ LA FOTO (bug real confirmado 2 veces, en 2 direcciones opuestas — no es un detalle menor: primero un gesto posado se redactó con ángulo de selfie sin ninguna cámara real; después un MIRROR SELFIE real se redactó "sin mostrar el teléfono", dejando el reflejo del espejo sin explicación de cómo se tomó, porque esa instrucción es de la lectura equivocada). Cualquier gesto donde la mano de la protagonista esté cerca de su propio rostro, O cualquier shot que use un espejo/reflejo, es AMBIGUO por defecto — nunca lo dejes sin resolver. Primero preguntate cuál de estas 3 lecturas es más creíble para ESTE momento puntual (no hay una respuesta fija: ¿hay compañía real que podría estar tomando la foto? ¿es un momento íntimo/solitario donde una selfie es lo más natural? ¿el shot ya usa un espejo/reflejo?), y describila sin ambigüedad:
   a) Selfie de brazo extendido (SIN espejo en el encuadre): SIEMPRE mostrá el teléfono en cuadro, sostenido por su propia mano cerca del rostro — es lo que físicamente explica el encuadre y lo que distingue una selfie real de una foto tomada por otra persona (bug real confirmado, prueba 3 sep 2026: un selfie de auto redactado SIN el teléfono en cuadro — solo "ángulo elevado" en texto, sin el objeto — resultó en una foto de tercero: encuadre amplio mostrando el tablero completo y a ella de perfil, sin ningún teléfono visible, exactamente la perspectiva de alguien más sacándole la foto desde el asiento de al lado). El teléfono en la mano ES el ancla física que fuerza al generador a un encuadre cercano — omitirlo es lo que produce el plano de tercero, no lo evita. Describí explícitamente: el teléfono (color/modelo genérico, ej. "dark gray smartphone") sostenido con el brazo/codo DOBLADO y cerca del propio cuerpo/rostro, visible en el borde del encuadre — nunca el brazo extendido lejos hacia el frente.
      CHEQUEO FINAL — "PERSPECTIVA SIN FOTÓGRAFO POSIBLE" (categoría de fallo
      crítico ya nombrada en el protocolo de validación manual de la app,
      07_manual_revalidation_protocol.md): antes de cerrar la descripción de
      un selfie de brazo, verificá mentalmente: "si un brazo humano real
      sostuviera el teléfono con el codo doblado cerca del cuerpo, ¿el
      encuadre resultante mostraría ESTO?" — un selfie de brazo real NUNCA
      muestra el cuerpo completo, ni a la persona de perfil completo, ni el
      interior completo de un auto/habitación desde una distancia amplia;
      el encuadre queda necesariamente apretado y cercano (rostro + hombros
      + como mucho torso superior, CON el teléfono visible en el borde del
      encuadre sosteniendo la toma). Si tu descripción incluye piernas, un
      ángulo de perfil completo, "mostrando el interior" como parte central
      del encuadre, O NO MENCIONA EL TELÉFONO EN CUADRO, no es un selfie de
      brazo real — es una perspectiva de tercero sin nadie que la tome.
      Reescribí el encuadre como un plano cerrado real, con el teléfono
      visible, antes de continuar.
   b) Mirror selfie (el shot muestra un espejo/reflejo real): acá el teléfono SÍ debe describirse, sostenido por la mano levantada hacia el rostro, visible EN EL REFLEJO — es lo que explica físicamente por qué existe esa imagen reflejada. Nunca omitas el teléfono en un mirror selfie: sin él, el reflejo queda sin justificación.
   c) Gesto posado captado por otra persona (compañía real presente, o casual/candid, SIN espejo ni selfie): la mano puede estar cerca de la cara con total naturalidad (tocándose el pelo, la mejilla, el cuello) porque hay alguien más sosteniendo la cámara — plano normal de tercero, sin ángulo elevado ni espejo.
      SOLO VÁLIDA CON UNA RAZÓN REAL DE QUIÉN TOMA LA FOTO (bug real
      confirmado, reacción textual del usuario: "se siente fingido y poco
      natural, no aporta mucho, no se ve como una foto instagram que
      alguien subiría naturalmente, aparece más bien una foto editorial de
      una campaña"): esta lectura NUNCA es el default cuando el shot no
      tiene compañía — si companionVisible=false y el shotReasoning no da
      una razón candid explícita, un plano posado y mirando fijo a cámara
      con ambas manos/brazos en una pose deliberada no tiene quién lo haya
      tomado — se lee como una foto de campaña/editorial, no como un
      momento real. En ese caso, resolvé el shot como (a) o (b) en vez de
      (c): una selfie de brazo real es la lectura por default para un
      momento solitario sin compañía.
   Nunca mezcles estas lecturas en el mismo shot — esa mezcla es la ambigüedad real que rompe la sensación de "esta foto existe porque..." del manifiesto.
6. SOLO DESCRIPCIÓN VISUAL LITERAL — NUNCA LENGUAJE INFERENCIAL O NARRATIVO: el finalPrompt lo lee un generador de imágenes, no un humano que entiende contexto — cualquier frase que describa un ESTADO o una HISTORIA inferida en vez de algo literalmente visible en el frame es ruido que el generador no puede ejecutar. Los campos shotReasoning/existenceReason que recibiste arriba SON narrativos a propósito — son insumo para que entiendas la intención, nunca texto a trasladar literal al finalPrompt. Ejemplos de lo que NO va en el finalPrompt: "she seems to have moved to a different part of the venue", "as if she just finished something", "suggesting a shift in mood", "implying she recently arrived" — todo esto se resuelve describiendo directamente lo que está en cuadro. Antes de escribir cualquier frase del finalPrompt, preguntate: ¿esto describe algo que la cámara literalmente ve, o es mi inferencia de qué pasó/está por pasar? Si es lo segundo, reescribilo como el objeto/pose/detalle concreto que sostiene esa inferencia.
   OJO CON LA VERSIÓN CORTA DEL MISMO ERROR — es la más frecuente y la más fácil de dejar pasar (bug real confirmado 2 veces en la misma sesión, en 2 formas distintas: "...suggesting the end of dinner"; "...implying a moment of personal enjoyment or contemplation"). En ambos casos la PRIMERA mitad de la frase es descripción visual literal perfecta — el problema es la coletilla pegada al final que la traduce a significado. REGLA MECÁNICA: después de escribir cualquier frase del finalPrompt, buscá si termina en "suggesting...", "implying...", "indicating...", "hinting at...", "as if...", "characteristic of..." (cuando se usa para justificar una emoción/momento, no una textura/material) — si aparece cualquiera de esas construcciones, BORRÁ esa parte de la frase y dejá solo la descripción física de antes. Esto aplica en particular a la dirección de la mirada (gaze) y a la expresión facial: "she looks slightly downward and to the left" es literal y correcta, agregarle "implying contemplation" no lo es.

${contract.extraWriteRulesText}

Si un shot dice que necesita continuidad de ${contract.placeAnchorLabel} con otro shot del set, agregá una línea explícita ("SCENE CONTINUITY: same ${contract.placeAnchorLabel} as the previous shot — reuse the exact same background, furniture and lighting — including the same specific table, chairs and any furniture already described in that shot, not a new one.") antes de la descripción del lugar — la continuidad de mobiliario es tan importante como la del fondo, no solo el "lugar" en abstracto.

ANCLAJE ESPACIAL DEL MOBILIARIO (bug real confirmado: una silla/mesa "reusada" correctamente en cuanto a estilo/material igual apareció sola junto a la baranda, sin ningún otro mueble alrededor, mientras el fondo mostraba una fila entera de mesas ocupadas con sillas idénticas — se leyó como una silla arrastrada ahí solo para la foto). Nombrar el mueble no alcanza — hay que ubicarlo respecto al elemento fijo más cercano ya establecido en shots anteriores del mismo set. Además, si la pose de este shot puntual hace que la protagonista apoye una mano/brazo en un mueble, ese mueble debe estar descrito como visible y CERCA de esa mano en este encuadre — nunca asumas que "ya se estableció en otro shot" alcanza para que aparezca en este.

PROHIBIDO EL ELEMENTO "O ALTERNATIVO" EN LA DESCRIPCIÓN DEL LUGAR (bug real confirmado 2 veces sobre el mismo tipo de elemento — una baranda: "the rooftop railing is glass or dark metal", y en ese mismo shot la mano apoyada terminó sin ningún apoyo visible, reforzando que esta ambigüedad no es cosmética, produce fallas geométricas reales): la palabra "or" es la señal de que no se decidió qué hay realmente ahí, dejándoselo "a elección" al generador de imágenes. El finalPrompt describe UN lugar concreto, nunca una posibilidad entre varias. Nunca escribas "X or Y", "either X or Y", "possibly X" en la descripción del lugar o del mobiliario.
CHEQUEO MECÁNICO FINAL: antes de entregar el finalPrompt, releelo buscando literalmente la palabra " or " en cualquier descripción de objeto/material/mobiliario/lugar — si aparece, no es una ambigüedad de estilo, es una decisión no tomada; elegí una sola opción concreta y reescribí esa frase antes de responder.

ACCESORIOS NO-ESENCIALES — REGLA DE SILENCIO POR DEFAULT: NO menciones el accesorio en el texto salvo que el razonamiento haya dado una razón real. Si el razonamiento es el default de protagonista-en-cuadro ("se mantienen presentes"), NO escribas nada — dejá que la imagen de referencia lo resuelva sola. Si el razonamiento es el default de plano-sin-protagonista ("no aparece en este plano"), escribí una línea breve dejándolo explícitamente fuera del encuadre.

DETALLE COMPLETO DE LOS CANDIDATOS ELEGIDOS (para redactar con precisión):
${richDetailBlock}

PLAN DE SHOTS YA DECIDIDO:
${shotsText}

Devolvé el resultado en el formato JSON pedido — un finalPrompt completo en inglés por cada shot. IMPORTANTE: en cada shot del array de salida, copiá literal el número que aparece después de "Shot #" en shotIndex (ej. "Shot #3" → shotIndex: 3) — es el identificador real que usa el sistema para emparejar tu prompt con el plan, más confiable que el texto de vehicleLabel. Incluí también vehicleLabel (mismo texto del plan) solo como referencia legible.`;
}

// Schema de un solo shot — reusa el mismo shape que GENERIC_PROMPTS_SCHEMA
// pero sin el array, para la llamada puntual de re-redactado.
export const GENERIC_SINGLE_SHOT_SCHEMA = {
  type: 'object',
  properties: { finalPrompt: { type: 'string' } },
  required: ['finalPrompt'],
};

/**
 * Re-redacta UN shot puntual con continuidad de lugar, DESPUÉS de que la
 * imagen del shot anterior ya existe — reemplaza buildGenericWritePrompt
 * para este caso específico (needsPlaceAnchor=true, shot no es el primero
 * del set). En vez de la instrucción abstracta "reuse the exact same
 * place" (una promesa de texto que el modelo cumple inventando su propia
 * versión de los elementos), acá se inyecta una OBSERVACIÓN REAL de qué
 * hay en la imagen anterior.
 */
export function buildGenericPlaceAwareRewritePrompt(
  contract: RecipeDirectorContract,
  brief: string,
  shot: GenericShotDecision,
  richDetailBlock: string,
  placeObservation: PlaceObservation,
  energy?: 'elegante' | 'fiesta',
): string {
  const shotText = `### Shot: ${shot.vehicleLabel}
Eje narrativo: ${shot.narrativeAxis}
${shot.protagonistVisible === false ? 'ESTE SHOT ES UN DETAIL SHOT SIN LA PROTAGONISTA EN CUADRO — no la describas, ni su rostro, cuerpo ni outfit; el prompt final debe poder generarse sin ninguna referencia de identidad/cuerpo/outfit de ella. Describí solo el objeto/vista/detalle.\n' : ''}Candidato de referencia elegido: ${shot.chosenCandidateId || '(ninguno, describir desde cero)'}
Razonamiento: ${shot.shotReasoning}
Elementos a MANTENER (pose/gesto/mirada/composición/encuadre — transferibles):
${(shot.keptElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
Elementos a DESCARTAR (reemplazar por el brief real/las referencias del usuario):
${(shot.discardedElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
¿El director marcó que este shot necesita continuidad explícita de ${contract.placeAnchorLabel} con otro shot?: ${shot.needsPlaceAnchor ? `Sí — ${shot.continuityNote}` : `No lo marcó explícitamente, pero la imagen de referencia de abajo es del mismo ${contract.placeAnchorLabel} principal de la historia — usala igual como contexto de qué lugar es, adaptando según lo que este shot puntual necesite (ver más abajo).`}
Momento (timeline): ${shot.timelineStage}
Por qué existe esta foto: ${shot.existenceReason}
Accesorios no-esenciales (bolso, gafas, bufanda) en este shot: ${shot.accessoryReasoning}`;

  return `Sos el redactor final de prompts del Director Creativo de Photodump. Ya se decidió qué elementos de qué candidato del banco son reutilizables para este shot — tu trabajo AHORA es escribir el prompt final en INGLÉS, listo para pegar en un generador de imágenes real.

${PHOTODUMP_HARD_RULES_TEXT}

BRIEF REAL DEL USUARIO (la escena/lugar/hora real a describir): "${brief}"

ENERGÍA REAL: ${energy === 'fiesta' ? 'FIESTA' : 'ELEGANTE (sin pista de baile ni club)'}. REGLA DURA: si la energía es ELEGANTE, el prompt no puede describir pista de baile, luces de club/neón/láser, gente bailando en grupo, ni ningún elemento de fiesta/discoteca.

REGLAS DE ESTILO FIJAS — agregalas al final del prompt:
${GENERIC_STYLE_RULES_TEXT}

CONTINUIDAD DE ${contract.placeAnchorLabel.toUpperCase()} — ESTO NO ES UNA INSTRUCCIÓN ABSTRACTA, ES UNA OBSERVACIÓN REAL de la imagen ancla de este mismo set, ya generada (SIEMPRE la del primer shot del lugar principal, no necesariamente el shot inmediato anterior — así todo el set queda anclado al mismo origen, sin que un shot intermedio pueda desviar el estilo del resto):
"${placeObservation.observedElements}"

Cómo usar esta observación depende de si el director marcó continuidad explícita (ver arriba):
- Si SÍ la marcó ("Sí — ..."): este shot comparte el mismo encuadre/mobiliario que otro shot puntual del set — describí el lugar USANDO los elementos reales de la observación — mismo material, mismo estilo, misma posición relativa — en vez de inventar tu propia versión. Si tu pose necesita que la protagonista esté cerca de un elemento, usá el elemento real descrito arriba y su posición real en el encuadre — si hace falta, ajustá la pose para que sea coherente con dónde está realmente ese elemento, nunca inventes uno nuevo donde te convenga para la pose.
- Si NO la marcó explícitamente: este shot puede ser otro rincón/ángulo del MISMO lugar — no estás obligado a mostrar exactamente el mismo mueble, pero SÍ tenés que mantener el mismo estilo/material/paleta que la observación describe — nunca contradigas el estilo ya establecido inventando una estética distinta.

DENSIDAD DE GENTE DEL LUGAR, NO SOLO EL MOBILIARIO (bug real confirmado):
si la observación de arriba menciona gente real de fondo, ese mismo nivel de
actividad tiene que mantenerse en este shot (salvo que el shot ocurra en un
espacio interior cerrado distinto, ver más abajo) — un lugar que se ve
concurrido en un shot y completamente desierto en el siguiente, con el mismo
mobiliario exacto, se lee como que el lugar cerró entre una foto y la otra.
Si la observación no menciona gente (o dice explícitamente que está vacío),
no inventes gente nueva tampoco.

ESTILO DE MATERIALES TAMBIÉN APLICA A MARCOS/DETALLES DECORATIVOS, NO SOLO
AL FONDO (bug real confirmado): si un shot usa un espejo/marco/objeto
decorativo que no es parte del mobiliario principal ya observado, ese
objeto también tiene que matchear el estilo general del lugar. No alcanza
con que el FONDO reflejado coincida — cualquier objeto/marco nuevo que se
introduzca en el shot debe ser del mismo lenguaje visual que ya estableció
la observación.

COPIÁ LOS DATOS CONCRETOS DE LA OBSERVACIÓN, NO LA PARAFRASEÉS EN ABSTRACTO (aplica sobre todo cuando SÍ hay continuidad explícita marcada): si la observación dice un material/color/posición específico, ese texto (o su traducción literal al inglés) tiene que aparecer en el finalPrompt — no la reemplaces por una descripción genérica ni por una alternativa. Nunca escribas "X or Y" en la descripción del lugar: la observación de arriba ya te dice qué hay, elegí eso y solo eso, sin ofrecer alternativas al generador de imágenes. CHEQUEO MECÁNICO FINAL: antes de responder, releé el finalPrompt buscando literalmente " or " en cualquier descripción de objeto/material — si aparece, elegí una sola opción concreta y reescribí esa frase.
${placeObservation.isEnclosedSubSpace ? `
ESTE SHOT OCURRE EN UN ESPACIO INTERIOR CERRADO DERIVADO DEL LUGAR PRINCIPAL (ej. un baño): NO fuerces que se vea el lugar principal de fondo a través de una puerta/ventana abierta solo para "cumplir" con la continuidad — eso es forzar el objeto, no razonar la continuidad. Una puerta cerrada, o simplemente no describir la puerta en absoluto, es la opción correcta. La continuidad de este shot con el resto del set se sostiene con la MISMA ROPA/vibe de la protagonista y la coherencia de que es el mismo momento — no necesita ver literalmente el resto del lugar.
COHERENCIA SOCIAL DE LO QUE SE LLEVA AL ESPACIO CERRADO (bug real confirmado): un mirror selfie de baño incluyó a la protagonista sosteniendo un trago de la mesa — nadie se lleva su copa al baño en una situación social real, es un detalle que rompe la credibilidad del momento aunque el resto de la pose esté bien resuelta. Al espacio cerrado solo la siguen objetos que alguien realmente se llevaría (el teléfono, el bolso) — un trago, un plato de comida, o cualquier cosa que se deja en la mesa/barra por norma social, NO debe aparecer en este shot salvo que el shotReasoning dé una razón real y explícita para lo contrario.` : ''}

REGLAS DURAS DE REDACCIÓN:
1. NUNCA describas ninguna prenda, color de ropa, o cómo cae/se acomoda la ropa del candidato del banco — el outfit lo resuelve la imagen de referencia del usuario. Tampoco inventes prendas nuevas que no están en ninguna referencia — si no podés confirmar que la prenda existe en la referencia real del outfit, no la menciones.
2. La ILUMINACIÓN debe corresponder a la observación real de arriba (misma familia de luz que el resto del set), no al candidato del banco.
3. FIDELIDAD DE PROPORCIÓN CORPORAL (misma prioridad que la identidad): no endereces, adelgaces, ni le agregues curvas a la protagonista que la referencia real de cuerpo no tiene.
4. MECÁNICA FÍSICA DE CÓMO SE TOMÓ LA FOTO: si hay un gesto con la mano cerca del rostro o un espejo/reflejo, resolvé sin ambigüedad si es selfie de brazo extendido (sin mostrar el teléfono), mirror selfie (teléfono SÍ visible en el reflejo), o gesto captado por otra persona (mano libre, sin ángulo de selfie) — nunca mezclar estas 3 lecturas. En un selfie de brazo extendido, el codo va DOBLADO y cerca del cuerpo/rostro, nunca extendido lejos hacia el frente. CHEQUEO "PERSPECTIVA SIN FOTÓGRAFO POSIBLE": un selfie de brazo real NUNCA muestra cuerpo completo, perfil completo, ni el interior amplio de un auto/habitación — si tu descripción incluye piernas o "mostrar el interior" como parte central del encuadre, no es un selfie de brazo real, reescribilo como plano cerrado. "Gesto captado por otra persona" SOLO es válida si hay compañía real (companionVisible=true) o el shotReasoning da una razón candid explícita — sin eso, un plano posado mirando fijo a cámara no tiene quién lo haya tomado y se lee como foto de campaña/editorial, no como un momento real; en ese caso resolvé como selfie de brazo extendido en su lugar.
5. SOLO DESCRIPCIÓN VISUAL LITERAL — NUNCA LENGUAJE INFERENCIAL O NARRATIVO: el finalPrompt lo lee un generador de imágenes, no puede ejecutar frases como "she seems to have moved to a different part of the place" — describí directamente lo que está en cuadro. shotReasoning/existenceReason son insumo para entender la intención, nunca texto a trasladar literal. Ojo con la versión corta del mismo error (describir bien el objeto/mirada/expresión literal y después agregarle una coletilla tipo "suggesting..." o "implying..." pegada al final) — si ya describiste algo con precisión física, PARÁ ahí.

${contract.extraWriteRulesText}

ACCESORIOS NO-ESENCIALES — REGLA DE SILENCIO POR DEFAULT: no menciones el accesorio salvo que el razonamiento haya dado una razón real.

DETALLE DEL CANDIDATO ELEGIDO (para redactar con precisión):
${richDetailBlock}

SHOT A REDACTAR:
${shotText}

Devolvé el resultado en el formato JSON pedido — solo finalPrompt, en inglés.`;
}
