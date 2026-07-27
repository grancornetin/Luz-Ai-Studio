/*
 * Vertex AI adapter for SeaDream Prompt Studio.
 *
 * It deliberately accepts the small Anthropic-shaped request contract used by
 * the legacy UI and returns an Anthropic-shaped response. This lets the visual
 * engines keep their proven prompts, schemas and JSON parsers while the actual
 * inference is performed by Gemini on Vertex AI.
 */
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const TOKEN_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
let tokenCache = { accessToken: '', expiresAt: 0 };

function credentialPathFromEnvironment() {
  const configured = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()
    .replace(/^"(.*)"$/, '$1');
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(__dirname, configured);
  }
  return path.join(__dirname, 'Luz IA secrets', 'vertex-service-account.json');
}

function config() {
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';
  const model = process.env.VERTEX_GEMINI_MODEL || 'gemini-2.5-flash';
  const credentialPath = credentialPathFromEnvironment();
  if (!project) throw new Error('Falta GOOGLE_CLOUD_PROJECT (o VERTEX_PROJECT_ID).');
  if (!fs.existsSync(credentialPath)) {
    throw new Error(
      'No se encontró la cuenta de servicio. Coloca vertex-service-account.json en "' +
      path.join('Luz IA secrets', 'vertex-service-account.json') +
      '" o define GOOGLE_APPLICATION_CREDENTIALS con una ruta válida. Ruta revisada: ' + credentialPath
    );
  }
  let serviceAccount;
  try { serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8')); }
  catch (err) { throw new Error('No se pudo leer la cuenta de servicio: ' + err.message); }
  if (serviceAccount.type !== 'service_account' || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('El JSON de credenciales no corresponde a una cuenta de servicio válida.');
  }
  if (!/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(serviceAccount.private_key)) {
    throw new Error('La clave privada de la cuenta de servicio está incompleta o perdió sus saltos de línea.');
  }
  return { project, location, model, serviceAccount, credentialPath };
}

function base64url(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function requestJson(options, body) {
  const data = typeof body === 'string' ? body : JSON.stringify(body || {});
  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, headers: { ...(options.headers || {}), 'Content-Length': Buffer.byteLength(data) } }, res => {
      let response = '';
      res.on('data', chunk => { response += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = response ? JSON.parse(response) : {}; } catch (_) { parsed = { raw: response }; }
        resolve({ statusCode: res.statusCode || 500, body: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, () => req.destroy(new Error('Vertex AI excedió 180 segundos sin responder.')));
    req.write(data);
    req.end();
  });
}

async function accessToken(serviceAccount) {
  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: TOKEN_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + '.' + claims;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).end().sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const form = 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(unsigned + '.' + signature);
  const response = await requestJson({
    hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, form);
  if (response.statusCode < 200 || response.statusCode >= 300 || !response.body.access_token) {
    throw vertexError(response.statusCode, response.body, 'No se pudo autenticar la cuenta de servicio');
  }
  tokenCache = { accessToken: response.body.access_token, expiresAt: Date.now() + (Number(response.body.expires_in || 3600) * 1000) };
  return tokenCache.accessToken;
}

function toParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  return (Array.isArray(content) ? content : []).map(block => {
    if (block.type === 'text') return { text: String(block.text || '') };
    if (block.type === 'image' && block.source && block.source.type === 'base64') {
      return { inlineData: { mimeType: block.source.media_type || 'image/jpeg', data: block.source.data || '' } };
    }
    return null;
  }).filter(Boolean);
}

function toVertexRequest(payload) {
  const contents = (payload.messages || []).map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: toParts(message.content)
  })).filter(content => content.parts.length);
  const configuredMax = Math.max(8192, Number(process.env.VERTEX_MAX_OUTPUT_TOKENS || 32768));
  const request = {
    contents,
    generationConfig: { maxOutputTokens: Math.max(1, Math.min(Number(payload.max_tokens || 1800), configuredMax)) }
  };
  if (payload.response_mime_type === 'application/json') {
    request.generationConfig.responseMimeType = 'application/json';
  }
  // Gemini 2.5 Flash may spend the entire output budget on internal thinking,
  // especially in tiny connectivity tests. The legacy engines expect the
  // requested budget to be available for their JSON/text response, so keep
  // thinking disabled by default. It can be enabled explicitly later with
  // VERTEX_THINKING_BUDGET (> 0) without changing the browser clients.
  const thinkingBudget = Number(process.env.VERTEX_THINKING_BUDGET || 0);
  if (Number.isFinite(thinkingBudget) && thinkingBudget >= 0) {
    request.generationConfig.thinkingConfig = { thinkingBudget: Math.floor(thinkingBudget) };
  }
  if (payload.system) request.systemInstruction = { parts: [{ text: String(payload.system) }] };
  return request;
}

function oauthErrorMessage(statusCode, body, fallback) {
  const nested = body && typeof body.error === 'object' ? body.error : null;
  const oauthCode = body && typeof body.error === 'string' ? body.error : '';
  const providerMessage =
    (nested && nested.message) ||
    (body && body.error_description) ||
    (body && body.message) ||
    '';
  const rawMessage = [oauthCode, providerMessage].filter(Boolean).join(': ');
  if (!rawMessage) return fallback || ('Vertex AI error ' + statusCode);

  if (/invalid_grant/i.test(rawMessage) && /signature/i.test(rawMessage)) {
    return 'Google rechazó la firma de la cuenta de servicio. La clave puede estar revocada, deshabilitada, dañada o no corresponder al client_email del JSON. Detalle: ' + rawMessage;
  }
  if (/invalid_grant/i.test(rawMessage) && /(clock|iat|exp|too early|too late|time)/i.test(rawMessage)) {
    return 'Google rechazó el JWT por la hora del equipo. Activa la sincronización automática de fecha, hora y zona horaria en Windows. Detalle: ' + rawMessage;
  }
  if (/unauthorized_client|invalid_client/i.test(rawMessage)) {
    return 'Google no reconoce o no autoriza esta cuenta de servicio. Verifica que la cuenta y su clave sigan activas. Detalle: ' + rawMessage;
  }
  if (statusCode === 403 || /permission|forbidden/i.test(rawMessage)) {
    return 'La cuenta se autenticó, pero no tiene permiso para usar Vertex AI en este proyecto. Verifica roles/aiplatform.user, Vertex AI API y facturación. Detalle: ' + rawMessage;
  }
  return rawMessage;
}

function vertexError(statusCode, body, fallback) {
  const message = oauthErrorMessage(statusCode, body, fallback);
  const err = new Error(message);
  err.statusCode = statusCode;
  err.isRateLimit = statusCode === 429 || /rate|quota/i.test(message);
  err.isOverloaded = statusCode === 503 || /overload|unavailable/i.test(message);
  return err;
}

function emptyResponseMessage(body) {
  const candidate = body && body.candidates && body.candidates[0];
  const finishReason = candidate && candidate.finishReason;
  const blockReason = body && body.promptFeedback && body.promptFeedback.blockReason;
  const details = [];
  if (finishReason) details.push('finishReason=' + finishReason);
  if (blockReason) details.push('blockReason=' + blockReason);
  return 'Gemini respondió sin texto' + (details.length ? ' (' + details.join(', ') + ')' : '') +
    '. Si fue MAX_TOKENS, aumenta el límite; si aparece un bloqueo, revisa el prompt o la imagen.';
}

async function generateAnthropicCompatible(payload) {
  const cfg = config();
  const token = await accessToken(cfg.serviceAccount);
  const request = toVertexRequest(payload);
  const endpoint = `/${cfg.location}-aiplatform.googleapis.com`;
  const path = `/v1/projects/${encodeURIComponent(cfg.project)}/locations/${encodeURIComponent(cfg.location)}/publishers/google/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const response = await requestJson({
    hostname: cfg.location + '-aiplatform.googleapis.com', path, method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  }, request);
  if (response.statusCode < 200 || response.statusCode >= 300) throw vertexError(response.statusCode, response.body);
  const candidate = response.body && response.body.candidates && response.body.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts || [];
  const text = parts.map(part => part.text || '').join('');
  if (!text) throw vertexError(502, response.body, emptyResponseMessage(response.body));
  const usage = response.body.usageMetadata || {};
  return {
    id: response.body.responseId || 'vertex-' + Date.now(),
    type: 'message', role: 'assistant', model: cfg.model,
    content: [{ type: 'text', text }],
    usage: { input_tokens: usage.promptTokenCount || 0, output_tokens: usage.candidatesTokenCount || 0 },
    stop_reason: candidate && candidate.finishReason || null,
    finish_reason: candidate && candidate.finishReason || null,
    _vertex: {
      model: cfg.model,
      location: cfg.location,
      finishReason: candidate && candidate.finishReason || null,
      maxOutputTokens: request.generationConfig.maxOutputTokens
    }
  };
}

function publicConfig() {
  try {
    const cfg = config();
    return { ready: true, provider: 'Vertex AI', model: cfg.model, location: cfg.location, projectConfigured: true };
  } catch (err) { return { ready: false, provider: 'Vertex AI', error: err.message }; }
}

module.exports = { generateAnthropicCompatible, publicConfig };
