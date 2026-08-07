// api/photodump/director.ts
//
// Director Creativo de Photodump (arquitectura A-K del usuario) — endpoint
// server-side. Recibe { brief, recipe, level, hasCompanion }, corre el
// filtro del banco (Punto E, sin IA) + 2 llamadas a Gemini (Decidir: D+F+G,
// Redactar: H) y devuelve { plan, finalPrompts }.
//
// Corre server-side (no en el navegador) por 2 motivos:
//  1. El banco compilado pesa ~5.7MB — demasiado para bundlear en el cliente
//     y descargarlo en cada carga de la app.
//  2. Las credenciales de Vertex AI (GEMINI_SERVICE_ACCOUNT_KEY) nunca deben
//     exponerse al navegador — mismo motivo por el que todas las llamadas a
//     Gemini de la app pasan por endpoints como este, nunca por un cliente
//     instanciado en el browser.
//
// Modelo: gemini-2.5-flash @ us-central1 — mismo patrón que api/gemini/content.ts.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { setSecurityHeaders, setCorsHeaders, verifyAuth, checkRateLimit, getDataRatelimit } from '../../src/server/api/middleware.js';
import bankSnapshot from '../../src/data/photodump-bank/bank-snapshot.json';
import { buildShotPools } from '../../src/modules/photodump/director/bankFilter';
import { getRecipeContract } from '../../src/modules/photodump/director/recipeContracts';
import { HARD_RULES_TEXT } from '../../src/modules/photodump/director/hardRules';
import type { BankSnapshot, DirectorPlan, FinalPromptShot } from '../../src/modules/photodump/director/types';

function getCredentials(): Record<string, unknown> {
  const raw = process.env.GEMINI_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID!,
    location: 'us-central1',
    googleAuthOptions: { credentials: getCredentials() },
  });
}

function extractText(response: any): string {
  return response.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || '').filter(Boolean).join('') || '';
}

async function generateJson<T>(ai: GoogleGenAI, prompt: string, schema: Record<string, unknown>): Promise<T> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', responseSchema: schema },
  });
  const text = extractText(response);
  return JSON.parse(text) as T;
}

const DIRECTOR_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    globalReasoning: { type: 'string' },
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shotId: { type: 'string' },
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
        },
        required: ['shotId', 'candidatesConsidered', 'chosenCandidateId', 'shotReasoning', 'needsVenueAnchor', 'continuityNote'],
      },
    },
  },
  required: ['globalReasoning', 'shots'],
};

const PROMPTS_SCHEMA = {
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

const STYLE_RULES_TEXT = `
Camera roll quality: unedited photo, casual handheld feel, everyday smartphone capture, no catalogue finish, no beauty retouching, no editorial polish — a real, imperfect, authentic photo, not a professionally composed shot.
Avoid: editorial or catalog-like finish, overly polished or retouched skin, perfectly centered symmetric composition, walking or mid-stride pose, legs in a walking stance.
The background (when indoors/domestic) must be a real, lived-in space — never a photography studio, never a seamless backdrop, never a plain concrete or cyclorama floor.
She is standing still or naturally posed, not mid-stride.
`.trim();

function buildDecidePrompt(brief: string, recipeContract: ReturnType<typeof getRecipeContract>, level: string, shotPools: ReturnType<typeof buildShotPools>): string {
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

function buildWritePrompt(brief: string, plan: DirectorPlan): string {
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
`;
  }).join('\n');

  return `Sos el redactor final de prompts del Director Creativo de Photodump. Ya se decidió, para cada shot, qué elementos de qué candidato del banco son reutilizables — tu trabajo AHORA es escribir el prompt final en INGLÉS, listo para pegar en un generador de imágenes real.

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

interface DirectorRequest {
  brief: string;
  recipe: string;
  level: string;
  hasCompanion?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (setCorsHeaders(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  let uid = '';
  try {
    uid = await verifyAuth(req);
    if (!(await checkRateLimit(getDataRatelimit(), uid, res))) return;
  } catch {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const body = req.body as DirectorRequest;
    if (!body?.brief || !body?.recipe || !body?.level) {
      return res.status(400).json({ success: false, error: 'Faltan campos: brief, recipe, level' });
    }

    const recipeContract = getRecipeContract(body.recipe);
    const snapshot = bankSnapshot as unknown as BankSnapshot;

    const shotPools = buildShotPools(snapshot.items, body.brief, recipeContract);

    const ai = getGenAIClient();

    const decidePrompt = buildDecidePrompt(body.brief, recipeContract, body.level, shotPools);
    const plan = await generateJson<DirectorPlan>(ai, decidePrompt, DIRECTOR_PLAN_SCHEMA);

    const writePrompt = buildWritePrompt(body.brief, plan);
    const { shots: finalPrompts } = await generateJson<{ shots: FinalPromptShot[] }>(ai, writePrompt, PROMPTS_SCHEMA);

    return res.status(200).json({ success: true, plan, finalPrompts });
  } catch (error: any) {
    console.error('Photodump director error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
}
