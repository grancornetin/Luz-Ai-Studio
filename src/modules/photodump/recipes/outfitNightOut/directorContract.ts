/**
 * recipes/outfitNightOut/directorContract.ts
 *
 * Contrato de outfit_night_out para el Director Creativo GENÉRICO (ver
 * director/generic/). El texto de este archivo es una extracción tal cual
 * (sin reescribir el contenido) de director/openBank/openBankPromptBuilders.ts
 * — el archivo original que se escribió a lo largo de 28+ pruebas reales
 * específicamente para esta receta.
 *
 * outfit_night_out está retirándose del producto — este contrato existe
 * mientras el módulo siga presente, no se espera que reciba más ajustes.
 */
import type { RecipeDirectorContract } from '../../director/generic/genericTypes';

export const OUTFIT_NIGHT_OUT_DIRECTOR_CONTRACT: RecipeDirectorContract = {
  recipeId: 'outfit_night_out',

  narrativeCore: 'Ella tuvo una noche memorable, y se veía increíble en el outfit.',

  narrativeAxisValues: ['memorable', 'outfit_increible', 'ambos'],
  narrativeAxisLabels: {
    memorable: '"memorable" — la noche fue memorable',
    outfit_increible: '"outfit_increible" — se veía increíble en el outfit',
  },

  relevantDrives: ['attraction_self_presentation', 'status_control', 'belonging_social_validation'],
  relevantDrivesText: `- attraction_self_presentation: la pose/ángulo/gesto transmite confianza
  corporal y sensualidad DELIBERADA (no accidental) — mirror check, ángulo
  que alarga la silueta, mirada directa y segura a cámara.
- status_control: el entorno, la exclusividad del venue, la calidad de los
  objetos visibles o la sensación de acceso/dominio de la situación es lo
  que genera la reacción — no la pose de la protagonista en sí.
- belonging_social_validation: la foto funciona porque muestra pertenencia
  a un grupo/momento deseable (amigas, ambiente, código social reconocible)
  — la fuerza está en el contexto compartido, no en un individuo posando.`,

  toneRulesText: `FILTRO DE TONO — depende del CONTEXTO NARRATIVO de cada shot, no es una
prohibición general de sensualidad. La pregunta correcta para cada
candidato es: "¿es plausible que la protagonista esté vestida así EN ESTE
MOMENTO de ESTA historia?", no "¿es sensual?" — la sensualidad en sí
(escote, silueta marcada, piernas, pose de confianza corporal) es parte
legítima de attraction_self_presentation y no hay que evitarla.

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
  conjunto de loungewear, ropa deportiva de estar en casa. La línea sigue
  estando en ropa interior/lencería como prenda final y única visible (eso
  nunca es válido, ni siquiera en la preparación).
Si dudás sobre un candidato puntual, preguntate primero en qué etapa de la
noche va ese shot y si esa prenda tiene sentido ahí — no descartes por
sensualidad sola.`,

  usesSharedPlaceAnchor: true,
  placeAnchorLabel: 'venue',

  extraContinuityRulesText: `PROHIBIDO EMPEZAR POR DEFAULT EN "LA LLEGADA" (bug real recurrente,
confirmado incluso después de pedir explícitamente que no hubiera una
secuencia canónica — el modelo vuelve a esta estructura por default salvo
que se le prohíba activamente): el primer bloque de timelineStages NO
puede ser "llegada"/"arrival"/"llegando al lugar" ni ningún sinónimo, salvo
que el BRIEF del usuario mencione explícitamente el momento de llegar. Sin
esa mención explícita en el brief, elegí un punto de entrada distinto que
sea el más fuerte narrativamente para ESTE brief puntual — a mitad de la
cena, un momento de disfrute ya avanzado, el cierre de la noche — nunca la
opción por default de "primero mostramos cómo llega".

REGLAS DURAS DE CONTINUIDAD:
- Comida/bebida en mesa: siempre en el punto más atractivo (recién servida
  o a la mitad), nunca vacía con restos.
- Si algún shot muestra el interior de un auto, es SIEMPRE desde el punto
  de vista de una pasajera — nunca manos en el volante ni llaves sueltas
  como si alguien acabara de estacionar. Preferí, salvo que el banco no
  tenga ningún candidato real de este tipo, un candidato de SELFIE
  AUTO-CAPTURADA (rostro y parte del torso, brazo propio sosteniendo el
  teléfono o ángulo que lo implica) por sobre un candidato compuesto como
  si otra persona la fotografiara desde afuera/al lado.

SI UN MIRROR SELFIE OCURRE EN EL BAÑO/ASCENSOR, NO LLEVES EL TRAGO (bug
real confirmado: keptElements incluyó "holding a drink" para un mirror
selfie en el baño — nadie se lleva su copa a un espacio así en la vida
real). El teléfono y el bolso sí pueden seguir (se los lleva), la copa se
queda en la mesa.

CONTINUIDAD DEL TRAGO/BEBIDA ENTRE SHOTS DEL MISMO SET (bug real confirmado
2 veces): si más de un shot del set muestra a la protagonista con un trago
en mano, o un detail shot del trago sobre la mesa, ese trago tiene que ser
el MISMO en todos esos shots — mismo tipo de copa, mismo color/contenido.`,

  extraWriteRulesText: `COHERENCIA SOCIAL DE LO QUE SE LLEVA A UN ESPACIO CERRADO DERIVADO DEL VENUE (baño, ascensor): un mirror selfie de baño con la protagonista sosteniendo un trago de la mesa no es creíble — nadie se lleva su copa al baño en una situación social real. A este tipo de espacio solo la siguen objetos que alguien realmente se llevaría (el teléfono, el bolso).`,
};
