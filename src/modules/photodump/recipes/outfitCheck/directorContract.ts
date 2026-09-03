/**
 * recipes/outfitCheck/directorContract.ts
 *
 * Contrato de outfit_check para el Director Creativo GENÉRICO (ver
 * director/generic/). Pedido explícito del usuario (sep 2026): Outfit
 * Check pasa a razonar con el mismo Director Creativo que usaba
 * outfit_night_out (banco real + Gemini decidiendo/redactando libremente),
 * en vez del arco de vehículos fijos que existía hasta ahora
 * (outfitCheck.ts) — que queda como fallback/legado mientras se valida el
 * director en producción, sin borrarse todavía.
 *
 * Diferencia central respecto al contrato de night_out: la OCASIÓN
 * ("para una cita en el cine", "para el cumpleaños de mi hermana", "para
 * ir al museo") ya no se busca en una lista cerrada de clases con nombre
 * (destinationClass en outfitCheck.ts, 10 valores fijos: ópera, brunch,
 * oficina...) — Gemini lee el brief real directamente y decide qué lugar,
 * luz y actitud corresponde a ESA ocasión puntual, sin límite de cuáles
 * ocasiones existen. Esto resuelve el bug real reportado (prueba 2, sep
 * 2026): "Outfit Check para una cita en el cine" nunca llegaba al cine
 * porque "cine" no estaba en la lista fija — el set entero se quedaba en
 * el dormitorio.
 */
import type { RecipeDirectorContract } from '../../director/generic/genericTypes';

export const OUTFIT_CHECK_DIRECTOR_CONTRACT: RecipeDirectorContract = {
  recipeId: 'outfit_check',

  narrativeCore: 'Ella eligió este outfit para una ocasión real de su vida, y se veía increíble para eso — quiso mostrarlo.',

  narrativeAxisValues: ['ocasion', 'outfit_increible', 'ambos'],
  narrativeAxisLabels: {
    ocasion: '"ocasion" — la elección de outfit tiene sentido real para la ocasión del brief',
    outfit_increible: '"outfit_increible" — se veía increíble en el outfit',
  },

  relevantDrives: ['attraction_self_presentation', 'status_control', 'competence_mastery'],
  relevantDrivesText: `- attraction_self_presentation: la pose/ángulo/gesto transmite confianza
  corporal y seguridad DELIBERADA en el look elegido — mirror check, ángulo
  que favorece la silueta, mirada directa y segura a cámara.
- status_control: el lugar/ocasión real (su exclusividad, su código social)
  hace que el outfit elegido se lea como una decisión acertada — no la pose
  de la protagonista en sí, sino que el outfit calza perfecto con dónde va.
- competence_mastery: la foto funciona porque transmite "supe elegir bien
  para esta ocasión" — buen gusto, criterio de estilista propio, la
  satisfacción de haber acertado el outfit correcto para el momento
  correcto (distinto de attraction: acá el impulso es la competencia
  personal de saber vestirse bien, no la sensualidad ni el estatus del
  entorno).`,

  toneRulesText: `La pregunta correcta para cada candidato es: "¿es plausible que alguien
elija vestirse así para ESTA ocasión puntual del brief?", no "¿es
sensual?" — la sensualidad/seguridad corporal en sí es parte legítima de
attraction_self_presentation y no hay que evitarla.

LA OCASIÓN LA DEFINE EL BRIEF, SIN LISTA CERRADA (principio central de este
contrato, reemplaza cualquier lista fija de "tipos de ocasión" que pudiera
existir en versiones anteriores de esta receta): leé el brief real del
usuario y razoná qué lugar, qué luz, qué código de vestimenta y qué actitud
corporal corresponde a ESA ocasión específica — sea una que ya conocés bien
(una cena, una gala, la oficina) o una menos obvia (el cine, un cumpleaños
ajeno, un museo, una feria, tomar un café con una amiga). Nunca fuerces la
ocasión real del brief a encajar en la categoría más parecida que se te
ocurra — si el brief dice "cita en el cine", el destino real de la historia
ES el cine (entrada del cine, sala, dulcería, la fila para las entradas),
no un restaurante genérico ni "salida nocturna" sin más. Si el brief no da
ninguna pista de lugar/ocasión concreta, es válido resolver la historia
sin salir de la preparación (mirror check, selfie lista para salir) — eso
no es un error, es la lectura correcta cuando no hay destino real que
mostrar.

PLAUSIBILIDAD DE VESTUARIO SEGÚN LA ETAPA:
- Si el shot ocurre en el momento/lugar real de la ocasión (ya "arreglada"
  para eso): un candidato cuyo outfit_visible sea ropa interior/lencería NO
  es plausible ahí — descartalo, sin importar qué tan bien encaje la pose.
- Si el shot ocurre en la etapa de PREPARACIÓN EN CASA (eligiendo el
  outfit, mirándose al espejo, arreglándose) Y el brief admite esa etapa:
  cualquier prenda plausible ANTES de estar vestida del todo es válida —
  bata, pijama, toalla, loungewear. La línea sigue estando en ropa
  interior/lencería como prenda final y única visible (nunca válido, ni
  siquiera en preparación).`,

  usesSharedPlaceAnchor: true,
  placeAnchorLabel: 'destino',

  extraContinuityRulesText: `PROHIBIDO EMPEZAR POR DEFAULT EN "YA ARREGLADA/SALIENDO" SIN RAZÓN
(mismo bug real que ya se confirmó en otra receta de esta app con "la
llegada" — el modelo tiende a un default obvio salvo que se le prohíba
activamente): el primer bloque de timelineStages no tiene por qué ser
"eligiendo qué ponerse" solo porque es el orden obvio de contar un outfit
check. Si el brief o el banco dan pie a un punto de entrada más fuerte
(directo en el destino, a mitad de la ocasión), usalo — la preparación es
un recurso narrativo, no un paso obligatorio.

REGLA DE ELECCIÓN DE VEHÍCULO DE PREPARACIÓN: si el set incluye un shot que
muestra CÓMO se armó/eligió el look antes de ponérselo (prendas tomadas de
donde estaban guardadas), ese mueble de guardado real depende del cuarto —
puede ser un closet, un armario, un walk-in closet, una percha de pared, o
un rack si el cuarto real lo tiene — nunca asumas por default que es
siempre un rack metálico de tienda: mostrá VARIAS prendas del look juntas,
tomadas de donde estén guardadas en ESE cuarto real, coherente con el
resto de la decoración.`,

  extraWriteRulesText: `COHERENCIA SOCIAL DE LO QUE SE LLEVA A UN ESPACIO CERRADO DERIVADO DEL DESTINO (baño, probador): un mirror selfie en ese espacio con la protagonista sosteniendo algo que dejó en otro lado (bebida, comida) no es creíble. A ese tipo de espacio solo la siguen objetos que alguien realmente se llevaría (el teléfono, el bolso).`,
};
