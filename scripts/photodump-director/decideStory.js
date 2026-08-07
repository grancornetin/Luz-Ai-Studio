/**
 * scripts/photodump-director/decideStory.js
 *
 * Puntos D + F + G del diagrama del usuario, en UNA sola llamada a Gemini
 * (ver justificación en el plan: el plan global de continuidad, G, necesita
 * estar presente MIENTRAS se eligen candidatos por shot, F, no después —
 * separarlas arriesga elegir candidatos sin visión de conjunto).
 *
 * - D (reglas duras) entra como contexto fijo (hardRules.js).
 * - E (pools de candidatos ya filtrados) es el input principal — armados
 *   antes de esta llamada por bankFilter.js, sin IA.
 * - F: por cada shot, el director evalúa los candidatos de su pool y decide
 *   qué PIEZAS de cada uno son reutilizables (pose/gesto/expresión/
 *   composición/encuadre) vs. qué se descarta (escena/comida/outfit
 *   específicos, que se reemplazan por las referencias reales del usuario o
 *   el brief) — el ejemplo del desayuno del usuario es la instrucción
 *   central de esta parte del prompt.
 * - G: con todos los shots ya decididos, arma el plan de continuidad — qué
 *   shots comparten "mundo" (venue) y qué elementos deben mantenerse
 *   consistentes entre ellos.
 * - El "punto medio" acordado para el Punto J (continuidad shot-a-shot) se
 *   resuelve ACÁ: cada shot del plan final ya declara si necesita el ancla
 *   de venue u otras referencias de continuidad, sin una llamada aparte por
 *   shot.
 */

import { HARD_RULES_TEXT } from './hardRules.js';
import { generateJson } from './geminiClient.js';

const DIRECTOR_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    globalReasoning: {
      type: 'string',
      description: 'Explicación breve de cómo se decidió contar esta historia en conjunto — el hilo narrativo de principio a fin.',
    },
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shotId: { type: 'string', description: 'El id del tipo de momento (de la lista de nightMomentTypes del contrato), ej. posed_portrait.' },
          candidatesConsidered: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemId: { type: 'string' },
                score: { type: 'number', description: 'Puntaje 0-10 de qué tan útil es este candidato para este shot.' },
                keptElements: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Qué partes de este candidato son reutilizables para este shot (ej. "pose relajada con codo apoyado en la mesa", "expresión cálida y sonriente", "forma en que el plato y la bebida están alineados frente a la persona").',
                },
                discardedElements: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Qué partes de este candidato NO se usan (ej. "escenario de cafetería", "comida de desayuno", "outfit de jeans y blusa") y por qué se descartan (porque el brief o las referencias del usuario ya definen eso).',
                },
              },
              required: ['itemId', 'score', 'keptElements', 'discardedElements'],
            },
          },
          chosenCandidateId: { type: 'string', description: 'El itemId del mejor candidato encontrado para este shot, o vacío si ninguno fue útil.' },
          shotReasoning: { type: 'string', description: 'Por qué este candidato (o ninguno) es el mejor punto de partida para este shot, en 1-2 oraciones.' },
          needsVenueAnchor: { type: 'boolean', description: 'Si este shot necesita referenciar la imagen-ancla del venue para mantener continuidad de lugar con otros shots del set.' },
          continuityNote: { type: 'string', description: 'Si needsVenueAnchor es true, qué específicamente debe mantenerse consistente (ej. "misma decoración de luces cálidas del rooftop, mismo tipo de mesa"). Vacío si no aplica.' },
        },
        required: ['shotId', 'candidatesConsidered', 'chosenCandidateId', 'shotReasoning', 'needsVenueAnchor', 'continuityNote'],
      },
    },
  },
  required: ['globalReasoning', 'shots'],
};

function buildPrompt({ brief, recipeContract, level, shotPools }) {
  const levelInfo = recipeContract.shotsByLevel[level];
  const fixedShotList = (recipeContract.fixedShotTypes || [])
    .map(t => `- ${t.id} (FIJO, usar exactamente 1 vez, siempre primero): ${t.description}${t.lightingRule ? `\n  REGLA DE ILUMINACIÓN: ${t.lightingRule}` : ''}`)
    .join('\n');
  const momentShotList = recipeContract.nightMomentTypes
    .map(t => `- ${t.id}: ${t.description}`)
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

  return `Sos el Director Creativo de "Photodump", un módulo que genera fotos tipo rollo-de-fotos-real de una historia (ej. una salida nocturna) para una app de contenido para creadoras.

${HARD_RULES_TEXT}

RECETA: ${recipeContract.label}
PSICOLOGÍA DE LA RECETA: ${recipeContract.psychology}
REGLAS ESPECÍFICAS DE ESTA RECETA:
${recipeContract.hardRules.map(r => `- ${r}`).join('\n')}

BRIEF DEL USUARIO: "${brief}"
NIVEL ELEGIDO: ${level} (${levelInfo.count} fotos) — ${levelInfo.description}

SHOTS FIJOS (siempre presentes, exactamente 1 vez cada uno):
${fixedShotList}

TIPOS DE MOMENTO DE NOCHE DISPONIBLES (elegir entre estos para completar el resto del set):
${momentShotList}

Para este set, tenés que incluir cada shot fijo exactamente 1 vez, y completar
el resto de los ${levelInfo.count} shots totales eligiendo entre los tipos de
momento de noche de arriba (no hace falta usarlos todos). Nunca reutilices el
id de un shot fijo (ej. mirror_check) para representar un momento de noche —
son categorías separadas, aunque ambas puedan compartir pose de espejo o
similar.

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

Devolvé el resultado en el formato JSON pedido.`;
}

export async function decideStory({ brief, recipeContract, level, shotPools }) {
  const prompt = buildPrompt({ brief, recipeContract, level, shotPools });
  const plan = await generateJson(prompt, DIRECTOR_PLAN_SCHEMA);
  return { plan, promptUsed: prompt };
}
