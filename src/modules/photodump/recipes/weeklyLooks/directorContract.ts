/**
 * recipes/weeklyLooks/directorContract.ts
 *
 * Contrato de weeklyLooks para el Director Creativo GENÉRICO (ver
 * director/generic/). Migración sep 2026, pedido explícito del usuario tras
 * varias rondas de fixes de texto fijo (objetos ajenos citados del banco,
 * geometría de reflejo contradictoria, pose "en cuclillas" chocando con
 * NO_WALKING_LINE) — la hipótesis es que el Director, al RAZONAR sobre cada
 * candidato antes de citarlo (en vez de pegar texto fijo que puede
 * contradecir otro texto fijo), evita esa clase entera de contradicciones.
 *
 * Diferencia central respecto al contrato de outfit_check: acá el usuario
 * YA ELIGIÓ una restricción dura antes de generar — captureStyle
 * (mirror_selfie | third_person) — no es algo que el Director deba inferir
 * del brief. El pool de candidatos que ve el Director YA viene pre-filtrado
 * por captureStyle antes de que Gemini lo vea (ver directorAdapter.ts) —
 * nunca depende de que Gemini respete una instrucción de texto para esto,
 * mismo principio que ya costó 3 rondas de fixes aprender con el motor de
 * texto fijo.
 *
 * EL LUGAR, EN MODO varied_place, TAMBIÉN LO DECIDE EL DIRECTOR (decisión
 * explícita, sep 2026): el redactor compartido (buildGenericWritePrompt)
 * está diseñado para resolver el lugar desde el BRIEF REAL del usuario —
 * pelear contra ese diseño con una regla de texto ("nunca menciones el
 * lugar") hubiera sido frágil. Se retira, para este camino, el análisis
 * separado de analyzeWeeklyLooksPlaces/placesClient.ts en varied_place
 * (sigue existiendo para el fallback de texto fijo si el Director falla).
 *
 * EN MODO same_place, el lugar NO lo redacta el Director en texto — mismo
 * patrón que ya usaba el motor de texto fijo: el primer shot genera el
 * lugar real (imagen), y esa MISMA imagen se pasa como referencia visual
 * directa al resto de los shots (ver directorAdapter.ts) — más simple y
 * confiable que re-describir el lugar en texto para cada shot.
 *
 * placeMode (same_place | varied_place) SÍ sigue siendo una decisión previa
 * del usuario, no algo librado al Director — por eso el contrato es una
 * FUNCIÓN, no un objeto estático: buildWeeklyLooksDirectorContract(placeMode)
 * ajusta usesSharedPlaceAnchor y las reglas de continuidad según lo que el
 * usuario ya eligió.
 */
import type { RecipeDirectorContract } from '../../director/generic/genericTypes';
import type { PlaceMode, CaptureStyle } from './types';

// ── Mecánica de cámara — DECIDIDA POR EL USUARIO, no inferible del brief ──
// El pool de candidatos ya viene pre-filtrado por captureStyle antes de que
// el Director lo vea (filterBankItemsForCaptureStyle en api/gemini/content.ts).
// PERO el filtro de pool NO alcanza: el prompt genérico compartido
// (buildGenericWritePrompt) tiene su propia lógica que, ante un plano posado
// sin compañía visible, "resuelve como selfie de brazo extendido en su lugar"
// — empuja ACTIVAMENTE hacia la selfie. Sin una regla dura en texto que diga
// qué mecánica es y cuál está PROHIBIDA, el Director redacta mirror selfies
// aunque el usuario haya elegido "foto de tercero" (bug real confirmado,
// prueba 4 sep 2026: captureStyle 'third_person' llegó bien al backend y los
// 3 shots salieron redactados como "taking a mirror selfie ... smartphone
// visible in the reflection"). Por eso va también como bloque de texto.
const CAMERA_MECHANICS_RULE: Record<CaptureStyle, string> = {
  mirror_selfie: `MECÁNICA DE CÁMARA DE ESTE SET — MIRROR SELFIE (el usuario la eligió, es
fija para TODOS los shots, nunca la cambies ni mezcles con otra):
- Cada shot es un mirror selfie: la protagonista se fotografía a sí misma en
  el reflejo de un espejo (o vidriera/vidrio grande). El celular SIEMPRE
  visible en su mano levantada, en el reflejo, cerca del rostro — es lo que
  explica físicamente por qué existe la imagen.
- La superficie reflectante debe ser lo bastante GRANDE para reflejar un
  cuerpo completo de forma natural — nunca un vidrio de auto ni una
  superficie chica/angosta (fuerza al generador a alejar ópticamente a la
  persona de forma desproporcionada para que "entre" en el marco).
- Si el reflejo es en VIDRIO (vidriera, ventanal, pared de vidrio — no un
  espejo tradicional): son DOS planos reales superpuestos con transparencia
  — su reflejo Y lo que hay del otro lado del vidrio se ven simultáneamente,
  ninguno completamente nítido sobre el otro. Cualquier texto/cartel visible
  a través del vidrio desde el otro lado se lee AL REVÉS (espejado). El marco
  físico del vidrio debe verse en algún punto del encuadre. Su propio reflejo
  se ve con MENOS contraste/saturación que una foto directa, con un leve
  brillo del vidrio superpuesto, iluminada por la luz de SU PROPIO lado del
  vidrio — nunca con la nitidez/modelado de luz de una foto tomada de frente.`,

  third_person: `MECÁNICA DE CÁMARA DE ESTE SET — FOTO TOMADA POR OTRA PERSONA (el usuario
la eligió, es fija para TODOS los shots, nunca la cambies ni mezcles con
otra):
- Cada shot es una foto que le sacó ALGUIEN MÁS (una amiga, la pareja) o un
  timer/trípode. Plano normal de tercero, a la altura del pecho o los ojos,
  a un par de metros de distancia.
- PROHIBIDO cualquier espejo o reflejo como mecanismo de la foto. Una foto
  de tercero frente a un espejo mostraría el reflejo de quien la toma — es
  un absurdo lógico. Si el candidato del banco elegido implica un espejo o
  un mirror selfie, descartá esa parte: la pose se adapta a un plano de
  tercero directo, sin ninguna superficie reflectante en el encuadre.
- PROHIBIDO el celular en la mano de la protagonista o en cuadro — nadie se
  fotografía a sí misma en este modo. Sus dos manos están libres (o
  sosteniendo como mucho su propio bolso).
- PROHIBIDO el ángulo/encuadre de selfie de brazo extendido (plano cerrado
  al rostro, brazo saliendo hacia la cámara). Es siempre un plano abierto,
  cuerpo completo, tomado desde la distancia a la que estaría parada otra
  persona.
- La mirada puede ir a cámara (le pidió a la amiga "sacame una") o perdida
  hacia un lado con naturalidad — las dos son válidas para un plano de
  tercero. Lo que NO va es la pose rígida de "posar para el lente" con
  barbilla en alto y contrapposto marcado (eso lo vuelve editorial).`,
};

const SHARED_TONE_RULES = `La pregunta correcta para cada candidato es: "¿esta pose/actitud es
plausible en una foto rápida y casual de alguien mostrando su outfit del
día?", no "¿es la pose más dramática posible?".

RESTRICCIONES DURAS DE ESTA RECETA (ya decididas por el usuario ANTES de
esta sesión — nunca las reinterpretes ni las cambies):
- El pool de candidatos que ves ya viene filtrado a UN SOLO estilo de
  cámara — mantené esa misma mecánica en TODOS los shots del set, nunca
  mezcles. La regla de mecánica de cámara puntual de este set está más
  abajo, es una restricción DURA.
- CUERPO COMPLETO SIEMPRE: cada shot debe mostrar a la protagonista de
  pie, de cabeza a pies, calzado incluido — nunca un plano que la corte
  antes de los pies o que la muestre sentada/en cuclillas/recostada. Un
  candidato del banco cuya pose implique estar sentada, en el piso,
  arrodillada o en cuclillas NO es válido para esta receta, aunque el
  resto de su actitud sea buena — descartalo.
- NUNCA UN OBJETO AJENO EN LA MANO: si el candidato elegido menciona un
  objeto sostenido (una taza, una laptop, una copa, comida, un cuaderno,
  cualquier cosa que no sea el celular del selfie), ese objeto va a
  discardedElements — solo se hereda la posición del brazo/mano, nunca el
  objeto en sí. Ya se confirmó en producción que dejar pasar esto genera
  props sin ninguna razón de estar en la escena (una laptop en plena
  calle, una copa de vino en un ascensor).
- NUNCA UN TERCERO REAL EN CUADRO: cada shot es de una sola persona. Si el
  candidato elegido tiene companionPresent=true o describe a otras
  personas relevantes en la escena (no solo paisaje humano de fondo muy
  lejano e incidental), descartalo — no es válido para esta receta.

ESTO NO ES UNA SESIÓN DE FOTOS — EL LUGAR ES LA VIDA REAL DE LA PERSONA, NO
UN SET (bug real confirmado sep 2026: shots que salían como portada de
revista aunque el prompt final tenía todas las reglas de "camera roll" —
porque el LUGAR y la POSE elegidos ya eran de producción editorial, y ni la
mejor regla de textura arregla eso):
- El brief describe el CONTEXTO DE VIDA de la persona (su trabajo, su viaje,
  su semana), NO el escenario literal de cada foto. Un brief "looks de
  oficina" NO significa "todos los shots en la oficina" — significa la vida
  de alguien que trabaja en oficina: el espejo del cuarto antes de salir,
  el ascensor del edificio, el baño del piso, la vereda de camino al metro,
  a veces sí la oficina. Elegí para cada shot un lugar REAL Y COTIDIANO de
  esa vida, y VARIALO — el lugar literal del brief es UNO de los válidos,
  nunca el default de todos.
- PROHIBIDOS los lugares que existen "para sacar fotos": terraza lounge de
  diseño, rooftop con vista panorámica, pasillo de arquitectura minimalista,
  jardín con macetero escultórico, pared de color liso tipo estudio, café
  de estética curada. Si el lugar suena a locación de campaña o a "spot
  instagrameable", está mal. Lugares válidos: un dormitorio real y
  desordenado, un pasillo de edificio común, un ascensor, un baño, una
  cocina, la vereda de una calle cualquiera, un estacionamiento, la entrada
  de un supermercado, una parada de bus — lugares donde la gente REALMENTE
  está mientras hace su día, no adonde va a producir contenido.
- PROHIBIDO el vocabulario de pose editorial al elegir el candidato o
  describir su actitud: "elegante", "sofisticada", "poised", pie apoyado en
  el borde de un macetero/escalón "de forma elegante", torso en contrapposto
  marcado, barbilla en alto, una mano en la cadera "con actitud". La pose se
  hereda CRUDA de una foto casual real del banco — la mecánica corporal tal
  cual, sin embellecerla ni darle intención de modelo. Si al describir la
  pose te salen adjetivos de revista, estás componiendo una sesión, no
  heredando un momento real.

CADA SHOT NECESITA ACTITUD — NUNCA UNA POSE FOFA/DE FOTO DE DOCUMENTO (bug
real confirmado sep 2026: en un set de 3, un shot salió de frente a cámara,
piernas juntas y rectas, bolso agarrado con las dos manos frente al cuerpo,
cara neutra — una pose rígida y sin vida que desentonaba con los otros 2 y
que "nadie subiría"). Esto NO contradice la regla de no-editorial de arriba:
- La línea entre "editorial" y "fofo" es real y hay un punto medio, que es
  el que buscamos: una persona real parada con naturalidad SIEMPRE tiene el
  peso en una pierna, el torso o la cadera con algo de giro/asimetría, los
  brazos haciendo algo (uno en el bolsillo, ajustándose el pelo, el bolso
  colgado de un hombro) — no está en posición de firmes.
- PROHIBIDO: pose simétrica y frontal a cámara con las dos piernas juntas y
  rectas; los dos brazos pegados al cuerpo o sosteniendo algo con las dos
  manos frente al torso (lectura defensiva, "de escudo"); cara
  completamente neutra sin ninguna micro-expresión.
- El bolso, si aparece, va colgado del hombro o del antebrazo, o sostenido
  con UNA mano al costado del cuerpo — nunca abrazado con las dos manos
  adelante.
- Descartá un candidato del banco cuya actitud sea plana aunque el encuadre
  sea correcto — en un set de varios shots, la variedad de actitud entre
  ellos es parte de lo que hace creíble que son días distintos.`;

export function buildWeeklyLooksDirectorContract(
  placeMode:    PlaceMode,
  captureStyle: CaptureStyle,
): RecipeDirectorContract {
  const sharedPlace = placeMode === 'same_place';
  const isMirror = captureStyle === 'mirror_selfie';

  return {
    recipeId: 'weekly_looks',

    narrativeCore: 'Ella usó varios looks completos y distintos esta semana — cada foto muestra un outfit real, completo, en un momento genuino, nunca una sesión de fotos armada.',

    narrativeAxisValues: ['variedad_real', 'autenticidad_rutina', 'ambos'],
    narrativeAxisLabels: {
      variedad_real: '"variedad_real" — el look de este shot se lee como un outfit completo y distinto de los demás del set, no una repetición de ángulo',
      autenticidad_rutina: '"autenticidad_rutina" — el momento/actitud se siente como parte real de su semana, no una pose de producción',
    },

    relevantDrives: ['attraction_self_presentation', 'competence_mastery', 'ease_energy_saving'],
    relevantDrivesText: `- attraction_self_presentation: la pose/actitud transmite que se veía bien
  ESE día con ESE look — confianza corporal genuina, no forzada.
- competence_mastery: la variedad de looks en sí es la prueba de buen
  criterio de estilista propio — supo armar varios outfits distintos que
  funcionan, no un solo look bueno repetido con otro nombre.
- ease_energy_saving: el momento de la foto no debería sentirse producido
  — es la selfie rápida de "ya estoy lista, así me veía hoy", no una
  sesión con intención de generar contenido.`,

    toneRulesText: `${CAMERA_MECHANICS_RULE[captureStyle]}\n\n${SHARED_TONE_RULES}`,

    usesSharedPlaceAnchor: sharedPlace,
    placeAnchorLabel: 'lugar',

    extraContinuityRulesText: sharedPlace
      ? `EL USUARIO YA ELIGIÓ "MISMO LUGAR PARA TODO EL SET" — cada shot es un
look/outfit distinto pero TODOS ocurren en el mismo lugar físico exacto
(mismo cuarto, mismo pasillo, mismo lugar de siempre) — distintos días,
misma ubicación. El primer shot fija ese lugar; todos los demás deben
marcar needsPlaceAnchor=true y describir el MISMO lugar, nunca uno nuevo.`
      : `EL USUARIO YA ELIGIÓ "LUGAR VARIADO" — cada shot de este set es un look
y un momento INDEPENDIENTE de los demás, en un lugar real DISTINTO cada
vez, coherente con qué tan formal o casual es ESE outfit puntual y con el
brief real del usuario. No hay continuidad de lugar obligatoria entre
shots — nunca reuses el mismo lugar en dos shots del mismo set salvo que
sea la única opción plausible para ese registro.`,

    extraWriteRulesText: `Fidelidad de outfit ya la resuelve la imagen de referencia de cada shot —
nunca describas prendas específicas del candidato del banco elegido, ni
siquiera como base: el outfit real de este shot puede ser completamente
distinto en formalidad al del candidato citado (solo se hereda pose/
gesto/mecánica de cámara, nunca outfit).

MECÁNICA DE CÁMARA — RESTRICCIÓN DURA DE ESTE SET (el usuario la eligió,
no la cambies aunque el candidato del banco implique otra cosa):
${isMirror
  ? `Todos los shots son MIRROR SELFIE: el celular SIEMPRE visible en la mano
levantada de la protagonista, en el reflejo, cerca del rostro. Hay un
espejo (o vidrio/vidriera grande) real en el encuadre. Nunca redactes este
shot como una foto tomada por otra persona.`
  : `Todos los shots son FOTO TOMADA POR OTRA PERSONA (amiga/pareja) o
timer/trípode. PROHIBIDO: cualquier espejo o reflejo como mecanismo de la
foto (una foto de tercero frente a un espejo mostraría a quien la toma —
absurdo lógico); el celular en la mano de la protagonista o en cuadro; el
ángulo/encuadre de selfie de brazo extendido. Es siempre un plano abierto,
cuerpo completo, desde la distancia a la que estaría parada otra persona,
con las dos manos de la protagonista libres. Si el candidato del banco
elegido implica un espejo/selfie, adaptá SOLO la mecánica corporal de la
pose a un plano de tercero directo — descartá el espejo, el celular y el
ángulo de selfie.`}

${sharedPlace
  ? `MISMO LUGAR PARA TODO EL SET: nunca describas ni inventes el lugar/fondo en
el texto — la imagen ya generada del lugar se pasa como referencia visual
directa a cada shot (fuera de este texto), y el generador la reusa sola.
Tu texto describe SOLO pose, gesto, mirada y mecánica de cámara — cero
menciones de escenario, mobiliario o iluminación ambiental.`
  : `LUGAR VARIADO: SÍ describí el lugar de este shot en el texto — un lugar
real, concreto y COTIDIANO (nunca "a real place" genérico), sacado de la
vida real de la persona que describe el brief, no un escenario de sesión de
fotos. Repasá la regla de arriba "ESTO NO ES UNA SESIÓN DE FOTOS": nada de
terraza lounge, rooftop con vista, arquitectura minimalista, jardín de
diseño, café de estética curada — sí un dormitorio real, un pasillo de
edificio, un ascensor, un baño, una vereda cualquiera. El brief da el
contexto de vida (qué hace la persona), no el set literal de esta foto —
elegí un lugar donde esa persona realmente estaría, y que sea DISTINTO al
de los otros shots del set.${isMirror ? ' Si el shot es un mirror selfie en vidrio, aplicá las reglas de geometría de reflejo de arriba.' : ''}
Al describir la pose: trasladá la mecánica corporal cruda del candidato
real, sin adjetivos de revista ("elegante", "poised", "con actitud") ni
apoyos escenográficos inventados (pie en el borde de un macetero, mano
"posada" sobre una baranda de diseño). Si ya describiste dónde está cada
brazo/pierna con precisión física, PARÁ ahí — no le agregues intención de
modelo.
PERO tampoco la dejes fofa: repasá la regla de arriba "CADA SHOT NECESITA
ACTITUD". Toda persona real parada con naturalidad tiene el peso en una
pierna y algo de asimetría en torso/cadera/brazos — nunca de firmes,
frontal y simétrica. Prohibido: piernas juntas y rectas de frente a cámara;
los dos brazos pegados al cuerpo o sosteniendo algo con las dos manos
frente al torso; el bolso abrazado adelante (va al hombro o en una mano al
costado); cara 100% neutra. Si el candidato del banco elegido tiene una
actitud plana, elegí otro — no "arregles" una pose muerta con texto.`}`,
  };
}
