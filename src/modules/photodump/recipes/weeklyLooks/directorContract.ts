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
import type { PlaceMode } from './types';

const SHARED_TONE_RULES = `La pregunta correcta para cada candidato es: "¿esta pose/actitud es
plausible en un mirror-selfie rápido de alguien mostrando su outfit del
día?", no "¿es la pose más dramática posible?".

RESTRICCIONES DURAS DE ESTA RECETA (ya decididas por el usuario ANTES de
esta sesión — nunca las reinterpretes ni las cambies):
- El pool de candidatos que ves ya viene filtrado a UN SOLO estilo de
  cámara (mirror selfie con celular visible, O foto tomada por un
  tercero/timer sin celular en cuadro) — mantené esa misma mecánica en
  TODOS los shots del set, nunca mezcles ambas.
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

SI EL SHOT ES UN MIRROR SELFIE — REGLAS DE LUGAR APRENDIDAS EN PRODUCCIÓN
(bugs reales ya confirmados, no las repitas):
- La superficie reflectante (espejo, vidriera, vidrio interior) debe ser
  lo bastante GRANDE para reflejar un cuerpo completo de forma natural —
  nunca un vidrio de auto ni ninguna superficie chica/angosta: eso fuerza
  al generador a alejar ópticamente a la persona de forma desproporcionada
  para que "entre" en el marco.
- Si el reflejo es en VIDRIO (vidriera, ventanal, pared de vidrio — no un
  espejo tradicional): son DOS planos reales superpuestos con
  transparencia — su reflejo Y lo que hay del otro lado del vidrio se ven
  simultáneamente, ninguno completamente nítido sobre el otro. Cualquier
  texto/cartel visible a través del vidrio desde el otro lado se lee AL
  REVÉS (espejado). El marco físico del vidrio debe verse en algún punto
  del encuadre. Su propio reflejo debe verse con MENOS contraste/
  saturación que una foto directa, con un leve brillo del vidrio
  superpuesto, iluminada por la luz de SU PROPIO lado del vidrio — nunca
  con la nitidez/modelado de luz de una foto tomada de frente.`;

export function buildWeeklyLooksDirectorContract(placeMode: PlaceMode): RecipeDirectorContract {
  const sharedPlace = placeMode === 'same_place';

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

    toneRulesText: SHARED_TONE_RULES,

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

${sharedPlace
  ? `MISMO LUGAR PARA TODO EL SET: nunca describas ni inventes el lugar/fondo en
el texto — la imagen ya generada del lugar se pasa como referencia visual
directa a cada shot (fuera de este texto), y el generador la reusa sola.
Tu texto describe SOLO pose, gesto, mirada y mecánica de cámara — cero
menciones de escenario, mobiliario o iluminación ambiental.`
  : `LUGAR VARIADO: SÍ describí el lugar de este shot en el texto — un lugar
real y concreto (nunca "a real place" genérico), coherente con el brief y
con el registro del outfit real de este look. Si el shot es un mirror
selfie en vidrio, aplicá las reglas de geometría de reflejo de arriba.`}`,
  };
}
