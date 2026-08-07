/**
 * scripts/photodump-director/writePrompts.js
 *
 * Punto H del diagrama del usuario: toma el plan ya decidido (salida de
 * decideStory.js — qué candidato se eligió por shot, qué se mantiene/
 * descarta de cada uno, la nota de continuidad) y redacta el PROMPT FINAL
 * en inglés de cada shot — texto plano, listo para pegar directo en
 * Higgsfield y generar a mano. Es una llamada a Gemini separada de
 * decideStory (mismo criterio que ya usaba el trainer viejo: separar
 * "decidir" de "redactar" evita que Gemini omita shots en una respuesta muy
 * larga que mezcla las dos cosas).
 *
 * El estilo/vocabulario de las líneas fijas (cámara de rollo de celular, sin
 * acabado editorial, nunca fondo de estudio) es el mismo que ya usa
 * producción real en src/modules/photodump/recipes/shared.ts — se replica
 * el texto acá (no se importa el .ts directo porque este es un script JS
 * plano fuera del build de la app) para que el prompt final tenga el mismo
 * nivel de detalle que un shot real generado por la app.
 */

import { generateJson } from './geminiClient.js';

// Mismas líneas de shared.ts (IPHONE_CAMERA_ROLL_LINE, AVOID_EDITORIAL_LINE,
// NO_STUDIO_BACKDROP_LINE, NO_WALKING_LINE) — copiadas textual para mantener
// consistencia de estilo con lo que ya genera producción.
const STYLE_RULES_TEXT = `
Camera roll quality: unedited photo, casual handheld feel, everyday smartphone capture, no catalogue finish, no beauty retouching, no editorial polish — a real, imperfect, authentic photo, not a professionally composed shot.
Avoid: editorial or catalog-like finish, overly polished or retouched skin, perfectly centered symmetric composition, walking or mid-stride pose, legs in a walking stance.
The background (when indoors/domestic) must be a real, lived-in space — never a photography studio, never a seamless backdrop, never a plain concrete or cyclorama floor.
She is standing still or naturally posed, not mid-stride.
`.trim();

const PROMPTS_SCHEMA = {
  type: 'object',
  properties: {
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shotId: { type: 'string' },
          finalPrompt: {
            type: 'string',
            description: 'El prompt final en inglés, texto plano, listo para pegar en un generador de imágenes tipo Higgsfield. Debe describir pose, gesto, mirada, encuadre, ángulo de cámara, iluminación y composición — nunca mencionar el escenario/comida/outfit específico del candidato del banco si esos fueron descartados, en su lugar usar el brief real del usuario para esos elementos.',
          },
        },
        required: ['shotId', 'finalPrompt'],
      },
    },
  },
  required: ['shots'],
};

function buildPrompt({ brief, plan }) {
  const shotsText = plan.shots.map(shot => `
### Shot: ${shot.shotId}
Candidato de referencia elegido: ${shot.chosenCandidateId || '(ninguno, describir desde cero)'}
Razonamiento: ${shot.shotReasoning}
Elementos a MANTENER de este candidato (pose/gesto/mirada/composición/encuadre — transferibles):
${(shot.candidatesConsidered.find(c => c.itemId === shot.chosenCandidateId)?.keptElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
Elementos a DESCARTAR de este candidato (reemplazar por el brief real/las referencias del usuario):
${(shot.candidatesConsidered.find(c => c.itemId === shot.chosenCandidateId)?.discardedElements || []).map(e => `  - ${e}`).join('\n') || '  (ninguno específico)'}
¿Necesita continuidad de venue con otro shot del set?: ${shot.needsVenueAnchor ? `Sí — ${shot.continuityNote}` : 'No'}
`).join('\n');

  return `Sos el redactor final de prompts del Director Creativo de Photodump. Ya se decidió, para cada shot, qué elementos de qué candidato del banco son reutilizables — tu trabajo AHORA es escribir el prompt final en INGLÉS, listo para pegar en un generador de imágenes real (Higgsfield).

BRIEF REAL DEL USUARIO (la escena/lugar/hora real a describir, reemplaza cualquier escenario específico de los candidatos del banco): "${brief}"

REGLAS DE ESTILO FIJAS — aplican a TODOS los shots, agregalas al final de cada prompt:
${STYLE_RULES_TEXT}

REGLA CENTRAL: para cada shot, describí SOLO la pose/gesto/mirada/encuadre/composición que se decidió mantener del candidato (ver "Elementos a MANTENER" de cada shot abajo) — nunca menciones el escenario, comida u outfit específico de la foto del banco si fueron marcados para descartar. En su lugar, el escenario debe ser el del brief real del usuario, y el outfit se resuelve por referencia de imagen (no hace falta describirlo en detalle, ya que se provee como imagen de referencia aparte) — mencionalo solo si es relevante para la pose (ej. "wearing the outfit shown in the reference").

REGLAS DURAS DE REDACCIÓN (aplican SIEMPRE, incluso si no aparecen explícitas en "Elementos a MANTENER" de un shot — son un respaldo, no dependas solo de esa lista):
1. NUNCA describas ninguna prenda, color de ropa, o cómo cae/se acomoda la ropa del candidato del banco (ej. "chaqueta cayéndose del hombro", "top negro", "jeans") — eso es vestuario del candidato, no de la protagonista real. El outfit lo resuelve la imagen de referencia del usuario, nunca texto describiendo ropa específica de otra persona.
2. La ILUMINACIÓN de cada shot debe corresponder a la HORA REAL del evento en el brief del usuario — no a la iluminación del candidato del banco, salvo que coincidan. Si el brief describe una salida de noche, TODOS los shots (incluido mirror_check) deben tener iluminación nocturna/artificial de interior — nunca luz de día natural, aunque el candidato elegido como inspiración de pose tuviera luz de día.

Si un shot dice que necesita continuidad de venue, agregá una línea explícita de continuidad ("SCENE CONTINUITY: same venue as the previous shot — reuse the exact same background, furniture and lighting.") antes de la descripción de venue.

PLAN DE SHOTS YA DECIDIDO:
${shotsText}

Devolvé el resultado en el formato JSON pedido — un finalPrompt completo en inglés por cada shot.`;
}

export async function writePrompts({ brief, plan }) {
  const prompt = buildPrompt({ brief, plan });
  const result = await generateJson(prompt, PROMPTS_SCHEMA);
  return result;
}
