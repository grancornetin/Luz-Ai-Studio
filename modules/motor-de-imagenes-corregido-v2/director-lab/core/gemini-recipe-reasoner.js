'use strict';

const psychologyContext = require('./psychology-context');

const MAX_RETRIES = 1;

// Razona sobre el brief libre del usuario usando el marco de psicología de
// Photodump + candidatos reales del Scene Bank — NO reinventa pose/HPI (eso
// sigue viniendo de los contratos ya validados en shotPool.ts/hpiService.ts).
// Devuelve nivel/energía/compañía/escena elegidos + la lectura psicológica y
// el razonamiento en texto, para trazabilidad.

function buildSystemPrompt() {
  const psychologyFramework = psychologyContext.getPsychologyFrameworkText();
  return [
    'Eres el Director Creativo de Photodump (Luz IA), especializado en la receta "outfit_night_out"',
    '(salida nocturna: preparación en casa + venue). Tu trabajo es interpretar el brief libre del usuario',
    'y decidir el nivel de la historia, la energía, si hay compañía, y — cuando no hay foto de referencia',
    'del lugar — elegir una escena REAL de la lista de candidatos que se te entrega (nunca inventar una).',
    '',
    'No decides pose, gesto ni expresión — eso ya está resuelto por contratos validados a mano.',
    'Tu aporte es la interpretación creativa: qué historia es esta, por qué, y qué escena real la sirve mejor.',
    '',
    'Usa este marco de psicología de venta ("vender sin vender") de Photodump para tu lectura:',
    psychologyFramework || '(marco no disponible, usa criterio general de contenido orgánico creíble)',
    '',
    'Responde solo JSON con esta forma exacta:',
    '{"level": "corto|completo|extendido", "energy": "elegante|fiesta", "hasCompanion": true|false,',
    '"sceneId": "string (uno de los candidatos dados) o null si ninguno calza", "sceneReason": "string",',
    '"psychologicalReading": {"primaryDrive": "string", "desiredIdentity": "string", "desiredFeeling": "string",',
    '"desiredExperience": "string", "cameraMotivationSummary": "string"},',
    '"reasoning": "string — por qué esta interpretación del brief, en 2-3 frases"}'
  ].join('\n');
}

function buildUserPayload({ brief, sceneCandidates }) {
  return JSON.stringify({
    brief,
    sceneCandidates: sceneCandidates.map(candidate => ({
      sceneId: candidate.sourceId,
      description: candidate.sourceText,
      settingCategory: candidate.settingCategory,
      capabilities: candidate.capabilities
    }))
  });
}

function parseGeminiJson(rawText) {
  const trimmed = rawText.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '');
  return JSON.parse(trimmed);
}

async function callGemini(geminiClient, systemPrompt, userPayload, correctionMessage) {
  const messages = [{ role: 'user', content: userPayload }];
  if (correctionMessage) {
    messages.push({ role: 'assistant', content: '(respuesta anterior inválida)' });
    messages.push({ role: 'user', content: correctionMessage });
  }
  const response = await geminiClient.generateAnthropicCompatible({
    system: systemPrompt,
    messages,
    max_tokens: 1536,
    response_mime_type: 'application/json'
  });
  const text = response.content && response.content[0] && response.content[0].text;
  return { parsed: parseGeminiJson(text), raw: response };
}

async function reasonAboutRecipe({ geminiClient, brief, sceneCandidates }) {
  const systemPrompt = buildSystemPrompt();
  const userPayload = buildUserPayload({ brief, sceneCandidates });

  let attempt = 0;
  let lastError = null;

  while (attempt <= MAX_RETRIES) {
    const correctionMessage = lastError
      ? `Tu respuesta anterior tenía un problema: ${lastError}. Responde de nuevo, usando SOLO un sceneId de la lista original (o null).`
      : null;

    let result;
    try {
      result = await callGemini(geminiClient, systemPrompt, userPayload, correctionMessage);
    } catch (err) {
      lastError = `error de parseo/llamada: ${err.message}`;
      attempt += 1;
      continue;
    }

    const parsed = result.parsed;
    const validLevel = ['corto', 'completo', 'extendido'].includes(parsed.level) ? parsed.level : null;
    const validEnergy = ['elegante', 'fiesta'].includes(parsed.energy) ? parsed.energy : null;

    let resolvedScene = null;
    if (parsed.sceneId) {
      resolvedScene = sceneCandidates.find(candidate => candidate.sourceId === parsed.sceneId) || null;
      if (!resolvedScene) {
        lastError = `sceneId inexistente en el pool enviado: ${parsed.sceneId}`;
        attempt += 1;
        continue;
      }
    }

    if (!validLevel || !validEnergy) {
      lastError = `level/energy inválidos: level=${parsed.level}, energy=${parsed.energy}`;
      attempt += 1;
      continue;
    }

    return {
      status: 'ok',
      level: validLevel,
      energy: validEnergy,
      hasCompanion: !!parsed.hasCompanion,
      scene: resolvedScene,
      sceneReason: parsed.sceneReason || '',
      psychologicalReading: parsed.psychologicalReading || null,
      reasoning: parsed.reasoning || ''
    };
  }

  return {
    status: 'needs_review',
    level: null, energy: null, hasCompanion: false, scene: null,
    sceneReason: '', psychologicalReading: null,
    reasoning: `No se pudo resolver un razonamiento válido tras ${MAX_RETRIES + 1} intento(s): ${lastError}`
  };
}

module.exports = { reasonAboutRecipe, buildSystemPrompt, buildUserPayload };
