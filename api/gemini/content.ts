// api/gemini/content.ts
// Maneja: extractAvatarProfile, analyzeProduct, analyzeOutfit, generateText
// Modelo: gemini-2.5-flash @ us-central1 (verificado)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { Redis } from '@upstash/redis';
import { Client as QStashClient, Receiver } from '@upstash/qstash';

function getCredentials(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

function getGenAIClient(location: string = 'us-central1'): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID!,
    location,
    googleAuthOptions: { credentials: getCredentials() },
  });
}

interface ContentRequest {
  action:
    | 'extractAvatarProfile'
    | 'analyzeProduct'
    | 'analyzeOutfit'
    | 'analyzeVisualRefs'
    | 'generateText'
    | 'generateTextAsync'
    | 'getContentJobStatus'
    | 'runContentJob'
    | 'generatePlainText'
    | 'assistantChat'
    | 'analyzeREF0'
    | 'inferGender'
    | 'analyzeAnchor'
    | 'analyzeProductRelevance'
    | 'analyzeUGCOutfit'
    | 'analyzeScene';
  images?: string[];
  mimeTypes?: string[];
  prompt: string;
  schema?: Record<string, unknown>;
  model?: string;
  generationConfig?: Record<string, unknown>;
  payload?: Record<string, any>;
}

type ContentJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ContentJob {
  id: string;
  status: ContentJobStatus;
  uid: string;
  createdAt: number;
  updatedAt: number;
  text?: string;
  json?: unknown;
  error?: string;
}

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

function generateContentJobId(): string {
  return `content_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function saveContentJob(job: ContentJob): Promise<void> {
  await redis.set(`content_job:${job.id}`, JSON.stringify(job), { ex: 3600 });
}

async function getContentJob(jobId: string): Promise<ContentJob | null> {
  const data = await redis.get(`content_job:${jobId}`);
  if (!data) return null;
  if (typeof data === 'string') return JSON.parse(data) as ContentJob;
  return data as ContentJob;
}

import {
  checkRateLimit,
  getDataRatelimit,
  setSecurityHeaders,
  setCorsHeaders,
  validateBase64Image,
  validatePrompt,
  validateChatPrompt,
  verifyAuth,
} from '../../src/server/api/middleware.js';

function extractText(response: any): string {
  return response.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || '').filter(Boolean).join('') || '';
}

function cleanJsonText(text: string): string {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

function extractJsonCandidate(text: string): string {
  const clean = cleanJsonText(text);
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) return clean.slice(start, end + 1);
  return clean;
}

function balanceJsonClosings(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') stack.push('}');
    if (char === '[') stack.push(']');
    if ((char === '}' || char === ']') && stack[stack.length - 1] === char) stack.pop();
  }

  return text + stack.reverse().join('');
}

function repairJsonText(text: string): string {
  return balanceJsonClosings(extractJsonCandidate(text)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*{/g, '},{')
    .replace(/]\s*\[/g, '],[')
    .replace(/"\s*\n\s*"/g, '","'));
}

function parseJsonMaybe(text: string): unknown {
  const candidate = extractJsonCandidate(text);
  const attempts = [candidate, repairJsonText(candidate)];
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Try the next cleanup strategy.
    }
  }
  return null;
}

function cleanBase64(b64: string): string {
  if (!b64) return '';
  return b64.replace(/^data:image\/(png|jpeg|webp);base64,/, '').replace(/\s/g, '');
}

function buildParts(body: Pick<ContentRequest, 'images' | 'mimeTypes' | 'prompt'>): any[] {
  const parts: Array<any> = [];
  if (body.images && body.images.length > 0) {
    for (let i = 0; i < body.images.length; i++) {
      parts.push({
        inlineData: {
          mimeType: body.mimeTypes?.[i] || 'image/jpeg',
          data: body.images[i],
        },
      });
    }
  }
  parts.push({ text: body.prompt });
  return parts;
}

async function processContentJob(jobId: string): Promise<void> {
  const job = await getContentJob(jobId);
  if (!job) {
    console.error(`[ContentJob ${jobId}] job not found`);
    return;
  }

  const storedPayload = await redis.get(`content_payload:${jobId}`);
  if (!storedPayload) {
    job.status = 'failed';
    job.error = 'Payload no encontrado para la generacion.';
    job.updatedAt = Date.now();
    await saveContentJob(job);
    return;
  }

  const body = typeof storedPayload === 'string'
    ? JSON.parse(storedPayload) as ContentRequest
    : storedPayload as ContentRequest;
  const modelName = body.model || 'gemini-2.5-flash';
  const ai = getGenAIClient('us-central1');
  const config: Record<string, unknown> = { ...(body.generationConfig || {}) };
  if (body.schema) {
    config.responseMimeType = 'application/json';
    config.responseSchema = body.schema;
  } else {
    config.responseMimeType = 'application/json';
  }

  job.status = 'processing';
  job.updatedAt = Date.now();
  await saveContentJob(job);

  const abort = new AbortController();
  const abortTimer = setTimeout(() => abort.abort(), 50_000);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: buildParts(body) }],
      config,
      abortSignal: abort.signal,
    } as any);

    clearTimeout(abortTimer);
    const text = extractText(response);
    job.status = 'completed';
    job.text = text;
    job.json = parseJsonMaybe(text);
    job.updatedAt = Date.now();
    await saveContentJob(job);
    await redis.del(`content_payload:${jobId}`).catch(() => {});
  } catch (error: any) {
    clearTimeout(abortTimer);
    job.status = 'failed';
    job.error = error.name === 'AbortError' || error.message?.includes('aborted')
      ? 'La generacion tardo demasiado. Reintenta con menos imagenes o un plan de menor duracion.'
      : error.message || 'Error generando contenido.';
    job.updatedAt = Date.now();
    await saveContentJob(job);
    console.error(`[ContentJob ${jobId}] failed:`, job.error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  // CORS restringido a dominios autorizados (lista blanca centralizada en _middleware.ts).
  // Aunque este endpoint requiere Bearer token, abrir CORS a "*" permitiría que un
  // sitio malicioso fuerce al navegador a invocarlo si llega a tener un token leakeado.
  if (setCorsHeaders(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body as ContentRequest;
  if (!body.action) return res.status(400).json({ error: 'Missing action' });

  if (body.action === 'runContentJob') {
    const signature = req.headers['upstash-signature'] as string;
    if (!signature) return res.status(401).json({ error: 'Missing signature' });
    try {
      await receiver.verify({ signature, body: JSON.stringify(req.body) });
    } catch {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const jobId = body.payload?.jobId;
    if (!jobId) return res.status(400).json({ error: 'Missing jobId' });
    await processContentJob(jobId);
    return res.status(200).json({ ok: true, jobId });
  }

  let uid = '';
  try {
    uid = await verifyAuth(req);
    if (!(await checkRateLimit(getDataRatelimit(), uid, res))) return;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payloadOnlyActions = ['analyzeREF0', 'inferGender', 'analyzeAnchor', 'analyzeProductRelevance', 'analyzeUGCOutfit', 'analyzeScene', 'getContentJobStatus'];
    if (!body.action || (!body.prompt && !payloadOnlyActions.includes(body.action))) {
      return res.status(400).json({ error: 'Missing action or prompt' });
    }

    if (body.action === 'getContentJobStatus') {
      const jobId = body.payload?.jobId;
      if (!jobId) return res.status(400).json({ error: 'Missing jobId' });
      const job = await getContentJob(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (job.uid !== uid) return res.status(403).json({ error: 'Forbidden' });
      return res.status(200).json({
        success: true,
        jobId: job.id,
        status: job.status,
        text: job.status === 'completed' ? job.text : undefined,
        json: job.status === 'completed' ? job.json : undefined,
        error: job.status === 'failed' ? job.error : undefined,
      });
    }

    // Validar prompt — chat usa límite estricto, análisis de imagen el general
    // Las acciones que usan payload en lugar de prompt se saltan esta validación.
    if (!payloadOnlyActions.includes(body.action)) {
      const promptErr = body.action === 'assistantChat'
        ? validateChatPrompt(body.prompt)
        : validatePrompt(body.prompt);
      if (promptErr) return res.status(400).json({ error: promptErr });
    }

    // Validar imágenes si las hay
    if (body.images?.length) {
      for (let i = 0; i < body.images.length; i++) {
        const imgErr = validateBase64Image(body.images[i], body.mimeTypes?.[i] || 'image/jpeg');
        if (imgErr) return res.status(400).json({ error: `Image ${i + 1}: ${imgErr}` });
      }
    }

    if (body.action === 'generateTextAsync') {
      const jobId = generateContentJobId();
      const job: ContentJob = {
        id: jobId,
        status: 'pending',
        uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await Promise.all([
        saveContentJob(job),
        redis.set(`content_payload:${jobId}`, JSON.stringify(body), { ex: 3600 }),
      ]);

      const proto = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = process.env.WORKER_BASE_URL || `${proto}://${host}`;
      await qstash.publishJSON({
        url: `${baseUrl}/api/gemini/content`,
        body: { action: 'runContentJob', payload: { jobId } },
        retries: 1,
      });

      return res.status(202).json({
        success: true,
        jobId,
        status: 'pending',
      });
    }

    const modelName = body.model || 'gemini-2.5-flash';
    const ai = getGenAIClient('us-central1');

    // Configuración base
    const config: Record<string, unknown> = { ...(body.generationConfig || {}) };

    // assistantChat devuelve texto plano (nunca JSON)
    // generateText y acciones con schema fuerzan JSON
    if (body.schema) {
      config.responseMimeType = 'application/json';
      config.responseSchema = body.schema;
    } else if (body.action === 'generateText') {
      config.responseMimeType = 'application/json';
    }
    // generatePlainText y assistantChat: sin responseMimeType → texto plano

    const parts = buildParts(body);

    // ─── ACCIÓN ESPECÍFICA: generatePlainText ───────────────────────
    // Devuelve texto plano sin forzar JSON — para mejoras de texto libre.
    if (body.action === 'generatePlainText') {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: {},
      });

      const text = extractText(response);

      return res.status(200).json({ success: true, text });
    }

    // ─── ACCIÓN ESPECÍFICA: assistantChat ────────────────────────────
    if (body.action === 'assistantChat') {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: {}, // texto plano, sin JSON forzado
      });

      const text = extractText(response);

      return res.status(200).json({ success: true, text });
    }

    // ─── ACCIÓN ESPECÍFICA: analyzeVisualRefs ────────────────────────────
    // Analiza N imágenes en una sola llamada multimodal y devuelve un JSON
    // indexado por posición. Reutilizable por cualquier módulo.
    if (body.action === 'analyzeVisualRefs') {
      config.responseMimeType = 'application/json';

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config,
      });

      const rawText = extractText(response) || '{}';
      const cleanText = rawText.replace(/```json\s*|\s*```/g, '').trim();

      let parsedJson: unknown = null;
      try {
        parsedJson = JSON.parse(cleanText);
      } catch {
        parsedJson = parseJsonMaybe(cleanText);
      }

      if (!parsedJson) {
        return res.status(422).json({ success: false, error: 'Invalid JSON from analyzeVisualRefs', raw: cleanText });
      }

      return res.status(200).json({ success: true, text: cleanText, json: parsedJson });
    }

    // ─── ACCIÓN ESPECÍFICA: analyzeOutfit ─────────────────────────────
    if (body.action === 'analyzeOutfit') {
      // Forzar JSON incluso sin schema explícito
      config.responseMimeType = 'application/json';
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config,
      });

      const rawText = extractText(response) || '{}';
      
      // Limpiar markdown o basura que a veces devuelve el modelo
      const cleanText = rawText.replace(/```json\s*|\s*```/g, '').trim();
      
      let parsedJson: unknown = null;
      try {
        parsedJson = JSON.parse(cleanText);
      } catch (e) {
        console.error('Failed to parse analyzeOutfit JSON:', cleanText);
        return res.status(422).json({ 
          success: false, 
          error: 'Invalid JSON response from model', 
          raw: cleanText 
        });
      }

      return res.status(200).json({ success: true, text: cleanText, json: parsedJson });
    }

    // ─── ACCIONES DE ANÁLISIS UGC (migradas desde ugc.ts) ────────────
    // Usan payload.imageData / payload.mimeType en lugar de body.images[]
    // para mantener compatibilidad con el contrato original de ugcApiService.

    if (body.action === 'analyzeREF0') {
      const { imageData, mimeType } = body.payload || {};
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [
            { text: 'Analyze this image. Respond ONLY with JSON.' },
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
            { text: `{
  "lighting": { "primarySource": "string", "direction": "string", "colorTemperature": "string", "shadowType": "string", "intensity": "string" },
  "spatial": { "elements": ["string"], "walls": "string", "floor": "string", "geometry": "string" },
  "poseContext": { "hasSeating": "boolean", "hasLeaningSurface": "boolean", "hasTable": "boolean", "availableActions": ["string"] }
}` },
          ]},
        ],
        config: { responseMimeType: 'application/json' },
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return res.status(200).json(JSON.parse(text.replace(/```json|```/g, '').trim()));
    }

    if (body.action === 'inferGender') {
      const { imageData, mimeType } = body.payload || {};
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [
            { text: 'Look at this photo of a person. Determine their apparent gender presentation for the purpose of generating appropriate HPI pose and expression guidance, and for writing correctly-gendered Spanish captions. Respond ONLY with JSON.' },
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
            { text: '{"gender": "female" | "male" | "neutral"}' },
          ]},
        ],
        config: { responseMimeType: 'application/json' },
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return res.status(200).json(JSON.parse(text.replace(/```json|```/g, '').trim()));
    }

    if (body.action === 'analyzeAnchor') {
      const { imageData, mimeType } = body.payload || {};
      const anchorSchema = `{
  "lighting": { "primarySource": "string", "direction": "string", "colorTemperature": "string", "shadowType": "string", "intensity": "string", "productionLevel": "string" },
  "environment": { "locationType": "string", "indoorOutdoor": "string", "backgroundDesc": "string", "surfaceLanguage": "string", "productionTier": "string", "propsLevel": "string" },
  "styling": { "hasVisiblePerson": false, "garmentCategory": "string", "outfitColorFamily": "string", "formalityTier": "string", "silhouette": "string", "doNotSwitch": "string", "bodyType": "string", "visibleMarks": "string" },
  "product": { "category": "string", "colorFamily": "string", "materialDesc": "string", "dominanceLevel": "string" },
  "composition": { "shotType": "string", "cameraDistance": "string", "negativeSpace": "string", "visualHierarchy": "string", "framingStyle": "string" },
  "mood": { "emotionalRegister": "string", "energyLevel": "string", "colorPalette": "string", "overallMood": "string" }
}`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [
            { text: 'You are a visual analyst for a campaign generator. Analyze this anchor image and extract ALL visual invariants that must be preserved across every derived campaign image. Be specific and concrete. Respond ONLY with the JSON object below.' },
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
            { text: anchorSchema },
          ]},
        ],
        config: { responseMimeType: 'application/json' },
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return res.status(200).json(JSON.parse(text.replace(/```json|```/g, '').trim()));
    }

    if (body.action === 'analyzeProductRelevance') {
      const { productRef, focus, outfitRef, sceneRef, sceneText } = body.payload || {};
      const parts: any[] = [];
      if (productRef?.data) {
        parts.push({ text: 'PRODUCT IMAGE:' });
        parts.push({ inlineData: { mimeType: productRef.mimeType || 'image/jpeg', data: cleanBase64(productRef.data) } });
      }
      if (focus === 'OUTFIT' && outfitRef?.data) {
        parts.push({ text: 'OUTFIT REFERENCE:' });
        parts.push({ inlineData: { mimeType: outfitRef.mimeType || 'image/jpeg', data: cleanBase64(outfitRef.data) } });
      }
      if (focus === 'SCENE' && sceneRef?.data) {
        parts.push({ text: 'SCENE REFERENCE:' });
        parts.push({ inlineData: { mimeType: sceneRef.mimeType || 'image/jpeg', data: cleanBase64(sceneRef.data) } });
      }
      parts.push({ text: `
Analyze if product is relevant to ${focus} context.
${focus === 'OUTFIT' ? 'Is this a complement to the outfit (jewelry, bag, belt, shoes = YES)?' : ''}
${focus === 'SCENE' ? 'Does this product naturally belong in this environment?' : ''}
${sceneText ? `Scene description: ${sceneText}` : ''}
Respond ONLY with JSON: { "isRelevant": boolean, "suggestion": "string", "productType": "jewelry|accessory|clothing|electronics|food|sports|home|other" }
` });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json' },
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return res.status(200).json(JSON.parse(text.replace(/```json|```/g, '').trim()));
    }

    if (body.action === 'analyzeUGCOutfit') {
      const { imageData, mimeType } = body.payload || {};
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [
            { text: 'Analyze this outfit. Respond ONLY with JSON.' },
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
            { text: '{ "hasJacket": "boolean", "hasPants": "boolean", "hasShoes": "boolean", "hasAccessories": "boolean", "hasDetail": "boolean", "fabricType": "string", "colors": ["string"], "hasTop": "boolean", "hasBottom": "boolean", "hasBelt": "boolean", "hasBag": "boolean", "hasHat": "boolean", "hasNecklace": "boolean", "bottomType": "shorts|pants|skirt|unknown" }' },
          ]},
        ],
        config: { responseMimeType: 'application/json' },
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return res.status(200).json(JSON.parse(text.replace(/```json|```/g, '').trim()));
    }

    if (body.action === 'analyzeScene') {
      const { imageData, mimeType } = body.payload || {};
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [
            { text: 'Analyze this scene. Respond ONLY with JSON.' },
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
            { text: '{ "hasFurniture": "boolean", "hasNature": "boolean", "hasEquipment": "boolean", "hasTable": "boolean", "hasSeating": "boolean", "hasWindows": "boolean", "hasProps": "boolean", "sceneType": "string" }' },
          ]},
        ],
        config: { responseMimeType: 'application/json' },
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return res.status(200).json(JSON.parse(text.replace(/```json|```/g, '').trim()));
    }

    // ─── RESTO DE ACCIONES ───────────────────────────────────────────
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts }],
      config,
    });

    const textContent = extractText(response);

    let parsedJson: unknown = null;
    if (config.responseMimeType === 'application/json' || body.action === 'generateText') {
      try {
        const clean = textContent.replace(/```json\s*|\s*```/g, '').trim();
        parsedJson = JSON.parse(clean);
      } catch { /* not json */ }
    }

    return res.status(200).json({ success: true, text: textContent, json: parsedJson });
  } catch (error: any) {
    console.error('Content error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
}
