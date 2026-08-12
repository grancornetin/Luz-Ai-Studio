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
          chosenCandidateId: { type: 'string' },
          shotReasoning: { type: 'string' },
          keptElements: { type: 'array', items: { type: 'string' } },
          discardedElements: { type: 'array', items: { type: 'string' } },
          needsVenueAnchor: { type: 'boolean' },
          continuityNote: { type: 'string' },
          accessoryReasoning: { type: 'string' },
          timelineStage: { type: 'string' },
          existenceReason: { type: 'string' },
        },
        required: [
          'vehicleLabel', 'narrativeAxis', 'chosenCandidateId', 'shotReasoning',
          'keptElements', 'discardedElements', 'needsVenueAnchor', 'continuityNote',
          'accessoryReasoning', 'timelineStage', 'existenceReason',
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
        properties: { vehicleLabel: { type: 'string' }, finalPrompt: { type: 'string' } },
        required: ['vehicleLabel', 'finalPrompt'],
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
    .map(([shotType, candidates]) => {
      const lines = candidates
        .map(c => `  ${c.itemId} | ${c.companionPresent ? 'con acompañante' : 'sola'} | subjects:${c.subjectsVisible} | ${c.briefSummary}`)
        .join('\n');
      return `### shot_type: ${shotType} (${candidates.length} candidatos)\n${lines}`;
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

CANTIDAD TOTAL DE SHOTS — LÍMITE DURO: el array "shots" debe tener
EXACTAMENTE ${totalShotsRequested} elementos, ni uno más ni uno menos.

DIVERSIDAD REAL: evitá que 2 o más shots del set se lean como la misma foto
repetida (mismo encuadre + mismo gesto + mismo tipo de detalle) — variá
shot_type, composición y qué eje narrativo aporta cada uno. Preferí SIEMPRE
un candidato real y fuerte del panorama de abajo antes que inventar una
escena sin respaldo — si para cierto tipo de encuadre no hay ningún
candidato relevante para este brief, no lo fuerces, elegí otro tipo con
mejor respaldo real.

vehicleLabel (obligatorio en cada shot): una descripción corta en 2-5
palabras del tipo de foto, en español, pensada para que un humano entienda
de un vistazo qué es (ej. "mirror selfie con trago", "detalle de copa en la
mesa", "retrato de cuerpo entero"). NUNCA uses el itemId del candidato como
vehicleLabel — el itemId va aparte, en chosenCandidateId.

PANORAMA DEL BANCO DISPONIBLE (agrupado por tipo de encuadre real —
shot_type — no por categoría narrativa; cada línea es un candidato real del
banco, resumido; elegí libremente de cualquier grupo, no hace falta usar
todos los grupos ni distribuir parejo entre ellos):

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
  const shotsText = plan.shots.map(shot => `
### Shot: ${shot.vehicleLabel}
Eje narrativo: ${shot.narrativeAxis}
Candidato de referencia elegido: ${shot.chosenCandidateId || '(ninguno, describir desde cero)'}
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

BRIEF REAL DEL USUARIO (la escena/lugar/hora real a describir, reemplaza cualquier escenario específico de los candidatos del banco): "${brief}"

ENERGÍA REAL DE ESTA NOCHE: ${energy === 'fiesta' ? 'FIESTA' : 'ELEGANTE (cena, previa, salida tranquila — sin pista de baile ni club)'}. REGLA DURA, aplica a CUALQUIER shot: si la energía es ELEGANTE, ningún prompt puede describir pista de baile, luces de club/neón/láser, gente bailando en grupo, ni ningún elemento de fiesta/discoteca — aunque el candidato del banco elegido tuviera esos elementos, van siempre a discardedElements y se reemplazan por el registro real de la noche.

REGLAS DE ESTILO FIJAS — aplican a TODOS los shots, agregalas al final de cada prompt:
${OPEN_BANK_STYLE_RULES_TEXT}

REGLA CENTRAL: para cada shot, describí SOLO la pose/gesto/mirada/encuadre/composición que se decidió mantener del candidato — nunca menciones el escenario, comida u outfit específico de la foto del banco si fueron marcados para descartar. El escenario debe ser el del brief real del usuario, y el outfit se resuelve por referencia de imagen (no hace falta describirlo en detalle) — mencionalo solo si es relevante para la pose.

REGLAS DURAS DE REDACCIÓN:
1. NUNCA describas ninguna prenda, color de ropa, o cómo cae/se acomoda la ropa del candidato del banco — el outfit lo resuelve la imagen de referencia del usuario, nunca texto describiendo ropa de otra persona.
2. La ILUMINACIÓN de cada shot debe corresponder a la HORA REAL del evento en el brief del usuario, no a la del candidato del banco, salvo que coincidan.

Si un shot dice que necesita continuidad de venue, agregá una línea explícita ("SCENE CONTINUITY: same venue as the previous shot — reuse the exact same background, furniture and lighting.") antes de la descripción de venue.

ACCESORIOS NO-ESENCIALES — REGLA DE SILENCIO POR DEFAULT: NO menciones el accesorio en el texto salvo que el razonamiento haya dado una razón real. Si el razonamiento es el default de protagonista-en-cuadro ("se mantienen presentes"), NO escribas nada — dejá que la imagen de referencia lo resuelva sola. Si el razonamiento es el default de plano-sin-protagonista ("no aparece en este plano"), escribí una línea breve dejándolo explícitamente fuera del encuadre.

DETALLE COMPLETO DE LOS CANDIDATOS ELEGIDOS (para redactar con precisión):
${richDetailBlock}

PLAN DE SHOTS YA DECIDIDO:
${shotsText}

Devolvé el resultado en el formato JSON pedido — un finalPrompt completo en inglés por cada shot (usá el mismo vehicleLabel del plan para identificar cada uno).`;
}
