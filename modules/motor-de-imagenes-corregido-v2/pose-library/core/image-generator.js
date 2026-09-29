// Fase SKETCH: genera el "pose/expression intent transfer proxy" (maniquí
// B&N) a partir de la imagen original + el prompt maestro correspondiente,
// usando el SDK @google/genai (gemini-3.1-flash-image, location "global").
//
// No reutiliza vertex-client.js: ese cliente solo genera texto/JSON via
// REST manual, no soporta responseModalities ni devuelve inlineData.

const { GoogleGenAI } = require('@google/genai');
const { readServiceAccount } = require('./credentials');

const MODEL_PRIMARY = process.env.POSE_LIBRARY_IMAGE_MODEL || 'gemini-3.1-flash-image';
// 'gemini-3-pro-image-preview' devuelve 404 en este proyecto (luz-ai-studio) —
// el nombre real disponible es 'gemini-3-pro-image' (confirmado por prueba directa).
const MODEL_FALLBACK = process.env.POSE_LIBRARY_IMAGE_MODEL_FALLBACK || 'gemini-3-pro-image';
const DEFAULT_TIMEOUT_MS = 180000;

let clientCache = null;

function getClient() {
  if (clientCache) return clientCache;
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID;
  if (!project) throw new Error('Falta GOOGLE_CLOUD_PROJECT para el cliente de generación de imagen.');
  clientCache = new GoogleGenAI({
    vertexai: true,
    project,
    location: 'global',
    googleAuthOptions: { credentials: readServiceAccount() }
  });
  return clientCache;
}

// El mensaje anterior solo miraba finishReason/safetyRatings del primer
// candidate y descartaba todo lo demás — con "UNKNOWN" no había forma de
// saber si candidates venía vacío, si había un promptFeedback.blockReason
// (bloqueo de contenido a nivel de prompt completo, distinto de SAFETY por
// candidate), o si el modelo devolvió texto en vez de imagen. Ahora arma un
// mensaje con todo lo disponible y además loguea el response crudo
// (recortado) para poder diagnosticar el patrón real en vez de adivinar.
function sketchError(response) {
  const candidates = response.candidates || [];
  const firstCandidate = candidates[0];
  const finishReason = firstCandidate?.finishReason;
  const safetyRatings = firstCandidate?.safetyRatings || [];
  const promptFeedback = response.promptFeedback;

  const safetyIssues = safetyRatings
    .filter(r => r.blocked || r.probability === 'HIGH' || r.probability === 'MEDIUM')
    .map(r => r.category);

  if (promptFeedback?.blockReason) {
    return new Error(`Prompt bloqueado por filtros de contenido de Google (blockReason: ${promptFeedback.blockReason}).`);
  }
  if (finishReason === 'SAFETY' || safetyIssues.length > 0) {
    return new Error(
      'Prompt bloqueado por filtros de contenido de Google' +
      (safetyIssues.length ? ` (${safetyIssues.join(', ')})` : '') +
      '.'
    );
  }
  if (!candidates.length) {
    return new Error('El modelo no devolvió ningún candidate (respuesta vacía).');
  }

  // El modelo respondió pero solo con texto, sin imagen — capturamos ese
  // texto porque suele explicar el motivo real (ej. rechazo explicado).
  const textParts = (firstCandidate.content?.parts || []).filter(p => p.text).map(p => p.text).join(' ').trim();
  const textSnippet = textParts ? ` Texto devuelto: "${textParts.slice(0, 200)}"` : '';
  return new Error(`El modelo no generó imagen (finishReason: ${finishReason || 'UNKNOWN'}).${textSnippet}`);
}

async function generateSketch(buffer, mimeType, masterPromptText, { model = MODEL_PRIMARY, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const ai = getClient();
  const contents = [{
    role: 'user',
    parts: [
      { text: masterPromptText },
      { inlineData: { mimeType, data: buffer.toString('base64') } }
    ]
  }];

  const abort = new AbortController();
  const abortTimer = setTimeout(() => abort.abort(), timeoutMs);

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents,
      config: { responseModalities: ['TEXT', 'IMAGE'] },
      abortSignal: abort.signal
    });
  } catch (err) {
    if (err.name === 'AbortError' || /aborted/i.test(err.message || '')) {
      const timeoutErr = new Error(`Generación de sketch excedió ${Math.round(timeoutMs / 1000)}s sin responder.`);
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    const statusCode = err.status || err.statusCode;
    if (statusCode === 429 || /rate|quota|resource_exhausted/i.test(err.message || '')) {
      err.isRateLimit = true;
    }
    if (statusCode === 503 || /overload|unavailable/i.test(err.message || '')) {
      err.isOverloaded = true;
    }
    throw err;
  } finally {
    clearTimeout(abortTimer);
  }

  const candidates = response.candidates || [];
  for (const candidate of candidates) {
    for (const part of (candidate.content?.parts || [])) {
      if (part.inlineData?.data) {
        return {
          buffer: Buffer.from(part.inlineData.data, 'base64'),
          mimeType: part.inlineData.mimeType || 'image/png'
        };
      }
    }
  }

  logFailedResponse(response);
  throw sketchError(response);
}

// Log aparte (fuera de bank.json, para no inflarlo) con el response crudo
// cada vez que no hay imagen — permite diagnosticar el patrón real
// (¿siempre el mismo blockReason? ¿siempre las mismas poses?) en vez de
// adivinar a partir de un mensaje de una sola línea.
const fs = require('fs');
const path = require('path');
const store = require('./store');
function logFailedResponse(response) {
  try {
    const logDir = path.join(store.DATA_DIR, 'failed-sketch-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const file = path.join(logDir, `${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify({
      at: new Date().toISOString(),
      promptFeedback: response.promptFeedback || null,
      candidates: (response.candidates || []).map(c => ({
        finishReason: c.finishReason,
        safetyRatings: c.safetyRatings,
        textParts: (c.content?.parts || []).filter(p => p.text).map(p => p.text)
      }))
    }, null, 2));
  } catch (_) { /* el log es diagnóstico, nunca debe romper el flujo real */ }
}

// Intenta MODEL_PRIMARY primero. Ante 429/503 relanza el error (lo maneja el
// backoff del job-runner, no consume el fallback en cuota). Ante cualquier
// otro error (bloqueo de contenido, respuesta vacía, timeout), reintenta una
// vez con MODEL_FALLBACK antes de rendirse.
async function generateSketchWithFallback(buffer, mimeType, masterPromptText, options = {}) {
  try {
    return await generateSketch(buffer, mimeType, masterPromptText, { ...options, model: MODEL_PRIMARY });
  } catch (err) {
    if (err.isRateLimit || err.isOverloaded) throw err;
    return generateSketch(buffer, mimeType, masterPromptText, { ...options, model: MODEL_FALLBACK });
  }
}

module.exports = { generateSketch, generateSketchWithFallback, MODEL_PRIMARY, MODEL_FALLBACK };
