// api/gemini/ugc.ts - Usando @upstash/redis con variables KV_REST_API_*
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { Redis } from '@upstash/redis';
import { Client as QStashClient } from '@upstash/qstash';
import { setCorsHeaders, setSecurityHeaders, validateBase64Image, validatePrompt, getImageRatelimit, checkRateLimit, sanitizeUid, verifyAuth } from '../_middleware.js';
import { concurrencyAcquire } from '../_concurrency.js';

const RETRY_DELAY_MS = 3000;

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
interface Job {
  id: string;
  status: JobStatus;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  shotIndex?: number;
  totalShots?: number;
  // Notificaciones Nivel 3
  uid?: string;
  sessionId?: string;
  module?: string;
  moduleLabel?: string;
  metadata?: Record<string, any>;
  refunded?: boolean;
  userPlan?: string;
}

// Usar variables KV_REST_API_* que Vercel inyecta automáticamente
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function generateJobId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function getCredentials(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

function getGenAIClient(location: string): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID!,
    location,
    googleAuthOptions: { credentials: getCredentials() },
  });
}

function cleanBase64(b64: string): string {
  if (!b64) return '';
  return b64.replace(/^data:image\/(png|jpeg|webp);base64,/, '').replace(/\s/g, '');
}

// Guardar job en Redis con TTL de 1 hora
async function saveJob(job: Job): Promise<void> {
  await redis.set(`job:${job.id}`, JSON.stringify(job), { ex: 3600 });
}

async function getJob(jobId: string): Promise<Job | null> {
  const data = await redis.get(`job:${jobId}`);
  if (!data) return null;
  if (typeof data === 'string') return JSON.parse(data);
  return data as Job;
}

async function processGenerationJob(
  jobId: string,
  parts: any[],
  aspectRatio: string
): Promise<void> {
  let job = await getJob(jobId);
  if (!job) return;

  job.status = 'processing';
  job.updatedAt = Date.now();
  await saveJob(job);

  try {
    // IMPORTANT: Only Gemini 3 models are allowed for image generation.
    // Gemini 2.5 is intentionally excluded — it produces identity/style drift
    // that breaks the UGC consistency guarantees of this module.
    // If all Gemini 3 attempts fail, the job fails cleanly and the client-side
    // auto-retry system (3 silent retries) handles the recovery.
    const models = [
      { name: 'gemini-3.1-flash-image-preview', location: 'global' },
      { name: 'gemini-3-pro-image-preview',      location: 'global' },
    ];

    for (const model of models) {
      try {
        console.log(`[UGC Job ${jobId}] Trying model: ${model.name}`);
        const ai = getGenAIClient(model.location);
        const response = await ai.models.generateContent({
          model: model.name,
          contents: [{ role: 'user', parts }],
          config: { responseModalities: ['TEXT', 'IMAGE'] },
        });

        for (const candidate of (response.candidates || [])) {
          for (const part of (candidate.content?.parts || [])) {
            if (part.inlineData?.data) {
              const mime = part.inlineData.mimeType || 'image/png';
              const imageData = `data:${mime};base64,${part.inlineData.data}`;
              job.status = 'completed';
              job.result = imageData;
              job.updatedAt = Date.now();
              await saveJob(job);
              console.log(`[UGC Job ${jobId}] Completed with ${model.name}`);
              return;
            }
          }
        }
      } catch (e: any) {
        console.warn(`[UGC Job ${jobId}] Model ${model.name} failed:`, e.message);
      }
    }
    throw new Error('All models failed');
  } catch (error: any) {
    job.status = 'failed';
    job.error = error.message;
    job.updatedAt = Date.now();
    await saveJob(job);
    console.error(`[UGC Job ${jobId}] Failed:`, error.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (setCorsHeaders(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, payload } = req.body;
    if (!action) return res.status(400).json({ error: 'Missing action' });

    // ── Autenticación obligatoria para TODAS las acciones de este endpoint ──
    // Esto evita que un atacante consuma cuota de Gemini gratis o cree jobs
    // a nombre de otro usuario (todas las acciones cobran o devuelven datos).
    let verifiedUid: string;
    try {
      verifiedUid = await verifyAuth(req);
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Rate limiting en generaciones
    if (action === 'generateImageAsync') {
      const rlKey = sanitizeUid(verifiedUid);
      const allowed = await checkRateLimit(getImageRatelimit(), rlKey, res);
      if (!allowed) return;

      // Validar prompt
      if (payload?.prompt) {
        const promptErr = validatePrompt(payload.prompt);
        if (promptErr) return res.status(400).json({ error: promptErr });
      }
    }

    // Iniciar generación asíncrona
    if (action === 'generateImageAsync') {
      const {
        prompt, referenceImages, aspectRatio = '3:4',
        shotIndex, totalShots, modelId = 'gemini',
        sessionId, module: moduleName, moduleLabel, metadata,
        userPlan,
      } = payload;
      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

      const parts: any[] = [];
      if (referenceImages?.length) {
        for (const ref of referenceImages) {
          if (ref.data && ref.data.length > 64) {
            parts.push({ text: 'REF:' });
            parts.push({ inlineData: { mimeType: ref.mimeType || 'image/jpeg', data: cleanBase64(ref.data) } });
          }
        }
      }
      parts.push({ text: prompt });

      const jobId   = generateJobId();
      const safeUid = sanitizeUid(verifiedUid);
      const now     = Date.now();
      const plan    = (userPlan as string) || 'free';

      // Control de concurrencia: limitar jobs activos por usuario según su plan
      const hasSlot = await concurrencyAcquire(safeUid, plan);
      if (!hasSlot) {
        return res.status(429).json({
          error: 'Estamos preparando tus imágenes. Espera un momento y vuelve a intentar.',
          code:  'CONCURRENCY_LIMIT',
        });
      }

      // Prioridad en cola: menor número = se despacha antes
      // studio y admin van primero, free va último
      const PLAN_PRIORITY: Record<string, number> = {
        admin: 1, studio: 1, pro: 2, starter: 3, weekly: 4, free: 5,
      };
      const priority   = PLAN_PRIORITY[plan] ?? 5;
      // score = prioridad * 1e13 + timestamp → desempate FIFO dentro del mismo plan
      const queueScore = priority * 1e13 + now;

      const job: Job = {
        id: jobId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        shotIndex,
        totalShots,
        uid: safeUid,
        sessionId,
        module: moduleName,
        moduleLabel,
        metadata,
        userPlan: plan,
      };

      const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });
      const isSeedream = modelId === 'seedream';

      if (isSeedream) {
        // Seedream no usa la cola de prioridad — va directo a su worker
        await Promise.all([
          saveJob(job),
          redis.set(`img_parts:${jobId}`, JSON.stringify(parts), { ex: 3600 }),
        ]);
        const seedreamUrl = `${process.env.WORKER_BASE_URL}/api/gemini/seedream-worker`;
        await qstash.publishJSON({ url: seedreamUrl, body: { jobId, prompt, aspectRatio }, retries: 2 });
        console.log(`[UGC] Seedream job ${jobId} dispatched directly`);
      } else {
        // Gemini: encolar con prioridad en Redis sorted set
        // Guardamos _queueScore en el job para poder re-encolar si el dispatcher falla
        (job as any)._queueScore = queueScore;
        await Promise.all([
          saveJob(job),
          redis.set(`img_parts:${jobId}`, JSON.stringify(parts), { ex: 3600 }),
          redis.zadd('queue:gemini', { score: queueScore, member: jobId }),
        ]);
        // Despertar al dispatcher para que procese la cola inmediatamente
        const dispatcherUrl = `${process.env.WORKER_BASE_URL}/api/gemini/queue-dispatcher`;
        await qstash.publishJSON({ url: dispatcherUrl, body: { trigger: 'enqueue', jobId }, retries: 1 });
        console.log(`[UGC] Job ${jobId} queued (plan=${userPlan ?? 'unknown'} priority=${priority} score=${queueScore})`);
      }

      return res.status(202).json({ success: true, jobId, status: 'pending', shotIndex, totalShots });
    }

    // Consultar estado
    if (action === 'getJobStatus') {
      const { jobId } = payload;
      if (!jobId) return res.status(400).json({ error: 'Missing jobId' });

      const job = await getJob(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const response: any = {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        shotIndex: job.shotIndex,
        totalShots: job.totalShots,
        refunded: job.refunded === true,
      };
      if (job.status === 'completed') response.image = job.result;
      if (job.status === 'failed') response.error = job.error;
      return res.status(200).json(response);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('UGC API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'UGC generation failed' });
  }
}
