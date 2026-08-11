// api/gemini/content.ts
// Maneja: extractAvatarProfile, analyzeProduct, analyzeOutfit, generateText
// Modelo: gemini-2.5-flash @ us-central1 (verificado)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { Redis } from '@upstash/redis';
import { Client as QStashClient, Receiver } from '@upstash/qstash';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildShotPools as buildPhotodumpShotPools } from '../../src/modules/photodump/director/bankFilter.js';
import { getRecipeContract as getPhotodumpRecipeContract } from '../../src/modules/photodump/director/recipeContracts.js';
import {
  buildPhotodumpDirectorPlanSchema,
  PHOTODUMP_PROMPTS_SCHEMA,
  buildPhotodumpDecidePrompt,
  buildPhotodumpWritePrompt,
  sanitizeDirectorPlan,
} from '../../src/modules/photodump/director/promptBuilders.js';
import type { BankSnapshot as PhotodumpBankSnapshot, DirectorPlan as PhotodumpDirectorPlan, FinalPromptShot as PhotodumpFinalPromptShot, DirectorReferenceImage as PhotodumpDirectorReferenceImage } from '../../src/modules/photodump/director/types.js';

interface PhotodumpDirectorPayload {
  brief?: string;
  recipe?: string;
  level?: string;
  hasCompanion?: boolean;
  referenceImages?: PhotodumpDirectorReferenceImage[];
}

// BUG REAL corregido: `import photodumpBankSnapshot from '....json'` rompía
// TODO este endpoint en producción (Vercel/Node ESM real, no el entorno de
// tsc/Vite) con TypeError ERR_IMPORT_ATTRIBUTES_MISSING — un import estático
// de JSON en ESM requiere `with { type: 'json' }`, que Vercel no soporta acá.
// El error rompía el módulo completo al cargarse, ANTES de correr ningún
// handler — por eso también fallaban acciones sin relación con el director
// (ej. generateCaptions). Lectura lazy con fs + cache en variable de módulo:
// no depende de import attributes y no penaliza acciones que nunca llaman al
// director (el archivo de 5.7MB solo se lee la primera vez que se usa).
let photodumpBankSnapshotCache: PhotodumpBankSnapshot | null = null;
function loadPhotodumpBankSnapshot(): PhotodumpBankSnapshot {
  if (!photodumpBankSnapshotCache) {
    const path = join(process.cwd(), 'src/data/photodump-bank/bank-snapshot.json');
    photodumpBankSnapshotCache = JSON.parse(readFileSync(path, 'utf-8')) as PhotodumpBankSnapshot;
  }
  return photodumpBankSnapshotCache;
}

function getCredentials(): Record<string, unknown> {
  const raw = process.env.GEMINI_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
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
    | 'analyzeScene'
    | 'photodumpDirector'
    | 'photodumpDirectorStart'
    | 'photodumpDirectorStatus'
    | 'runPhotodumpDirectorJob';
  images?: string[];
  mimeTypes?: string[];
  prompt?: string;
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

// Job del Director Creativo de Photodump — mismo patrón que ContentJob, pero
// separado porque el resultado tiene forma propia (plan + finalPrompts, no
// text/json genérico) y porque el worker hace 2 llamadas secuenciales a
// Gemini (Decidir + Redactar), no 1. Corre en background vía QStash porque
// esas 2 llamadas juntas superan lo que una respuesta HTTP síncrona puede
// esperar de forma confiable (ver 504 real en producción — bug corregido acá
// pasando a este patrón en vez de seguir subiendo maxDuration).
interface PhotodumpDirectorJob {
  id: string;
  status: ContentJobStatus;
  uid: string;
  createdAt: number;
  updatedAt: number;
  plan?: PhotodumpDirectorPlan;
  finalPrompts?: PhotodumpFinalPromptShot[];
  error?: string;
}

async function saveDirectorJob(job: PhotodumpDirectorJob): Promise<void> {
  await redis.set(`photodump_director_job:${job.id}`, JSON.stringify(job), { ex: 3600 });
}

async function getDirectorJob(jobId: string): Promise<PhotodumpDirectorJob | null> {
  const data = await redis.get(`photodump_director_job:${jobId}`);
  if (!data) return null;
  if (typeof data === 'string') return JSON.parse(data) as PhotodumpDirectorJob;
  return data as PhotodumpDirectorJob;
}

function generateDirectorJobId(): string {
  return `pdd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

// ─── PHOTODUMP DIRECTOR CREATIVO (arquitectura A-K, ver plan) ───────────────
// Fusionado acá (en vez de un endpoint propio en api/photodump/director.ts)
// por el límite de 12 funciones serverless del plan Hobby de Vercel. Corre
// el filtro del banco (Punto E, sin IA) + 2 llamadas a Gemini (Decidir:
// D+F+G en una sola llamada; Redactar: H) — acción 'photodumpDirector'.

/**
 * BUG REAL corregido: el 429 RESOURCE_EXHAUSTED de Vertex AI visto en
 * producción es un rate-limit de cuota (proyecto+modelo+región, compartido
 * por TODAS las llamadas de texto de la app, no solo el director) — no un
 * bug de código. Es transitorio por naturaleza: la mitigación estándar de
 * Google es reintentar con backoff exponencial, no tratarlo como fallo
 * definitivo. El director hace 2 llamadas por sesión; con el patrón de job
 * en background (ver processPhotodumpDirectorJob) ya hay margen de tiempo
 * real para esperar y reintentar sin volver a exponer al usuario a un
 * timeout.
 */
async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  maxRetries: number = 3,
): Promise<Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      const is429 = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (!is429 || attempt === maxRetries) throw error;
      const backoffMs = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
      console.warn(`[PhotodumpDirector] 429 recibido, reintento ${attempt + 1}/${maxRetries} en ${backoffMs}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}

async function runPhotodumpDirector(
  ai: GoogleGenAI,
  payload: PhotodumpDirectorPayload,
): Promise<{ plan: PhotodumpDirectorPlan; finalPrompts: PhotodumpFinalPromptShot[] }> {
  const { brief, recipe, level, referenceImages } = payload;
  if (!brief || !recipe || !level) {
    throw new Error('Faltan campos: brief, recipe, level');
  }

  const recipeContract = getPhotodumpRecipeContract(recipe);
  const snapshot = loadPhotodumpBankSnapshot();
  const shotPools = buildPhotodumpShotPools(snapshot.items, brief, recipeContract);

  const decidePrompt = buildPhotodumpDecidePrompt(brief, recipeContract, level, shotPools, referenceImages);
  const decideParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  for (const img of referenceImages || []) {
    decideParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  decideParts.push({ text: decidePrompt });

  const decideResponse = await generateContentWithRetry(ai, {
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: decideParts }],
    config: { responseMimeType: 'application/json', responseSchema: buildPhotodumpDirectorPlanSchema(recipeContract) },
  });
  const rawPlan = JSON.parse(extractText(decideResponse)) as PhotodumpDirectorPlan;
  const plan = sanitizeDirectorPlan(rawPlan, recipeContract, level);

  // Mismo espaciado que ya usa el loop de generación de imágenes entre
  // shots (PhotodumpModule.tsx, 15s) para evitar rate-limit de Vertex AI —
  // sin esto, las 2 llamadas del director salían pegadas sin respiro.
  await new Promise(resolve => setTimeout(resolve, 8000));

  const writePrompt = buildPhotodumpWritePrompt(brief, plan);
  const writeResponse = await generateContentWithRetry(ai, {
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: writePrompt }] }],
    config: { responseMimeType: 'application/json', responseSchema: PHOTODUMP_PROMPTS_SCHEMA },
  });
  const { shots: finalPrompts } = JSON.parse(extractText(writeResponse)) as { shots: PhotodumpFinalPromptShot[] };

  return { plan, finalPrompts };
}

/**
 * Versión background del director — mismo patrón que processContentJob:
 * corre las 2 llamadas a Gemini (Decidir + Redactar) sin el límite de una
 * respuesta HTTP síncrona, y guarda el resultado en Redis para que el
 * cliente lo levante por polling (photodumpDirectorStatus). Invocada
 * exclusivamente por QStash vía la acción runPhotodumpDirectorJob.
 */
async function processPhotodumpDirectorJob(jobId: string): Promise<void> {
  const job = await getDirectorJob(jobId);
  if (!job) {
    console.error(`[PhotodumpDirectorJob ${jobId}] job not found`);
    return;
  }

  const storedPayload = await redis.get(`photodump_director_payload:${jobId}`);
  if (!storedPayload) {
    job.status = 'failed';
    job.error = 'Payload no encontrado para el director.';
    job.updatedAt = Date.now();
    await saveDirectorJob(job);
    return;
  }

  const payload = typeof storedPayload === 'string'
    ? JSON.parse(storedPayload) as PhotodumpDirectorPayload
    : storedPayload as PhotodumpDirectorPayload;

  job.status = 'processing';
  job.updatedAt = Date.now();
  await saveDirectorJob(job);

  try {
    const ai = getGenAIClient('us-central1');
    const { plan, finalPrompts } = await runPhotodumpDirector(ai, payload);
    job.status = 'completed';
    job.plan = plan;
    job.finalPrompts = finalPrompts;
    job.updatedAt = Date.now();
    await saveDirectorJob(job);
    await redis.del(`photodump_director_payload:${jobId}`).catch(() => {});
  } catch (error: any) {
    job.status = 'failed';
    job.error = error?.message || 'Error corriendo el Director Creativo.';
    job.updatedAt = Date.now();
    await saveDirectorJob(job);
    console.error(`[PhotodumpDirectorJob ${jobId}] failed:`, job.error);
  }
}
// ─── FIN PHOTODUMP DIRECTOR CREATIVO ────────────────────────────────────────

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

  if (body.action === 'runPhotodumpDirectorJob') {
    const signature = req.headers['upstash-signature'] as string;
    if (!signature) return res.status(401).json({ error: 'Missing signature' });
    try {
      await receiver.verify({ signature, body: JSON.stringify(req.body) });
    } catch {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const jobId = body.payload?.jobId;
    if (!jobId) return res.status(400).json({ error: 'Missing jobId' });
    await processPhotodumpDirectorJob(jobId);
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
    const payloadOnlyActions = ['analyzeREF0', 'inferGender', 'analyzeAnchor', 'analyzeProductRelevance', 'analyzeUGCOutfit', 'analyzeScene', 'getContentJobStatus', 'photodumpDirector', 'photodumpDirectorStart', 'photodumpDirectorStatus'];
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

    if (body.action === 'photodumpDirectorStart') {
      const { brief, recipe, level, hasCompanion, referenceImages } = body.payload || {};
      if (!brief || !recipe || !level) {
        return res.status(400).json({ error: 'Faltan campos: brief, recipe, level' });
      }
      const jobId = generateDirectorJobId();
      const job: PhotodumpDirectorJob = {
        id: jobId,
        status: 'pending',
        uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await Promise.all([
        saveDirectorJob(job),
        redis.set(`photodump_director_payload:${jobId}`, JSON.stringify({ brief, recipe, level, hasCompanion, referenceImages }), { ex: 3600 }),
      ]);

      const proto = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = process.env.WORKER_BASE_URL || `${proto}://${host}`;
      await qstash.publishJSON({
        url: `${baseUrl}/api/gemini/content`,
        body: { action: 'runPhotodumpDirectorJob', payload: { jobId } },
        retries: 1,
      });

      return res.status(202).json({ success: true, jobId, status: 'pending' });
    }

    if (body.action === 'photodumpDirectorStatus') {
      const jobId = body.payload?.jobId;
      if (!jobId) return res.status(400).json({ error: 'Missing jobId' });
      const job = await getDirectorJob(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (job.uid !== uid) return res.status(403).json({ error: 'Forbidden' });
      return res.status(200).json({
        success: true,
        jobId: job.id,
        status: job.status,
        plan: job.status === 'completed' ? job.plan : undefined,
        finalPrompts: job.status === 'completed' ? job.finalPrompts : undefined,
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

    // ─── ACCIÓN ESPECÍFICA: photodumpDirector ────────────────────────
    if (body.action === 'photodumpDirector') {
      const { plan, finalPrompts } = await runPhotodumpDirector(ai, body.payload || {});
      return res.status(200).json({ success: true, plan, finalPrompts });
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
