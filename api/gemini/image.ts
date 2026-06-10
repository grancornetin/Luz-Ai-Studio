// api/gemini/image.ts
// Orchestrator asíncrono para generación de imágenes.
// Recibe la petición, encola en QStash, responde 202 inmediatamente.
// El cliente hace polling a getJobStatus cada 2 s (ver imageApiService.ts).
//
// ─── MODELOS PERMITIDOS ───────────────────────────────────────────────────────
//   gemini-3.1-flash-image-preview  @ global  ← primario
//   gemini-3-pro-image-preview       @ global  ← fallback
//
// gemini-2.5-flash-image está EXCLUIDO: región us-central1 incompatible
// con las referencias de identidad y causa drift en todos los módulos.
// ─────────────────────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { Client as QStashClient } from '@upstash/qstash';

// ─── Redis ────────────────────────────────────────────────────────────────────
const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// ─── QStash ───────────────────────────────────────────────────────────────────
const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });

// ─── Tipos ────────────────────────────────────────────────────────────────────
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ImageJob {
  id: string;
  status: JobStatus;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  shotIndex?: number;
  totalShots?: number;
  module?: string;
  // Notificaciones Nivel 3 — el worker los lee desde el job en Redis
  uid?: string;
  sessionId?: string;
  moduleLabel?: string;
  metadata?: Record<string, any>;
  refunded?: boolean; // marcado por el worker cuando reembolsa server-side
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateJobId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function cleanBase64(b64: string): string {
  if (!b64) return '';
  return b64.replace(/^data:image\/(png|jpeg|webp|gif);base64,/, '').replace(/\s/g, '');
}

async function saveJob(job: ImageJob): Promise<void> {
  await redis.set(`img_job:${job.id}`, JSON.stringify(job), { ex: 3600 });
}

async function getJob(jobId: string): Promise<ImageJob | null> {
  const data = await redis.get(`img_job:${jobId}`);
  if (!data) return null;
  if (typeof data === 'string') return JSON.parse(data);
  return data as ImageJob;
}

import { setCorsHeaders, setSecurityHeaders, validateBase64Image, validatePrompt, getImageRatelimit, getBatchImageRatelimit, checkRateLimit, sanitizeUid, verifyAuth } from '../_middleware.js';

// ─── Circuit breaker ──────────────────────────────────────────────────────────
// Cuando un proveedor agota su cuota, se marca en Redis por 2h.
// El orchestrator elige el primer proveedor disponible automáticamente.
const CIRCUIT_TTL = 60 * 60 * 2; // 2 horas

async function isProviderDown(provider: string): Promise<boolean> {
  try {
    const val = await redis.get(`circuit:${provider}`);
    return val === 'down';
  } catch { return false; }
}

export async function markProviderDown(provider: string): Promise<void> {
  try {
    await redis.set(`circuit:${provider}`, 'down', { ex: CIRCUIT_TTL });
    console.warn(`[Circuit] ${provider} marcado como DOWN por ${CIRCUIT_TTL / 3600}h`);
  } catch {}
}

export async function markProviderUp(provider: string): Promise<void> {
  try {
    await redis.del(`circuit:${provider}`);
  } catch {}
}

// Elige el mejor proveedor disponible según preferencia del usuario y estado del circuit.
async function resolveProvider(requestedModel: string): Promise<'gemini' | 'seedream' | 'gptimage'> {
  let preferred: string[];
  if (requestedModel === 'seedream') {
    preferred = ['seedream', 'gemini'];   // fallback: Gemini
  } else if (requestedModel === 'gptimage') {
    preferred = ['gptimage'];             // sin fallback: si está caído, falla limpio
  } else {
    preferred = ['gemini', 'gptimage'];   // fallback: GPT Image 2 (mejor calidad que Seedream)
  }
  for (const p of preferred) {
    if (!(await isProviderDown(p))) return p as 'gemini' | 'seedream' | 'gptimage';
  }
  // Todos caídos — reintentar con el preferido (puede haberse recuperado)
  return preferred[0] as 'gemini' | 'seedream' | 'gptimage';
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (setCorsHeaders(req, res)) return;
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, payload } = req.body;
    if (!action) return res.status(400).json({ error: 'Missing action' });

    // ── Iniciar generación ────────────────────────────────────────────────────
    if (action === 'generateImageAsync') {
      const {
        prompt,
        negative,
        referenceImages,
        aspectRatio = '3:4',
        shotIndex,
        totalShots,
        module: moduleName,
        moduleLabel,
        sessionId,
        metadata,
        modelId = 'gemini',   // 'gemini' | 'seedream' | 'gptimage'
      } = payload;

      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
      const promptErr = validatePrompt(prompt);
      if (promptErr) return res.status(400).json({ error: promptErr });

      // ── Autenticación ─────────────────────────────────────────────────────
      // Dos modos válidos:
      //   1. Modo batch (importer interno): header Bearer == BATCH_INTERNAL_API_SECRET
      //      y module === 'batch_prompt_importer'.
      //   2. Modo usuario: token Firebase válido. El uid se obtiene SOLO del token,
      //      nunca del cuerpo del request (evita que un atacante use un uid ajeno).
      const isBatchModule = moduleName === 'batch_prompt_importer';
      const authHeader    = (req.headers.authorization || '').trim();
      const batchSecret   = process.env.BATCH_INTERNAL_API_SECRET || '';
      const isBatchAuthed = isBatchModule
        && batchSecret.length > 0
        && authHeader === `Bearer ${batchSecret}`;

      let verifiedUid: string | undefined;
      if (!isBatchAuthed) {
        try {
          verifiedUid = await verifyAuth(req);
        } catch {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      // Rate limiting — batch importer tiene su propio bucket sin límite práctico
      const isBatch = isBatchAuthed;
      const rlKey   = isBatch ? 'batch_importer' : sanitizeUid(verifiedUid!);
      const limiter = isBatch ? getBatchImageRatelimit() : getImageRatelimit();
      const allowed = await checkRateLimit(limiter, rlKey, res);
      if (!allowed) return;

      // Construir parts para el worker (igual que ugc-worker)
      const parts: any[] = [];

      if (Array.isArray(referenceImages)) {
        for (let i = 0; i < referenceImages.length; i++) {
          const ref = referenceImages[i];
          if (ref?.data && ref.data.length > 64) {
            // Validar imagen
            const imgErr = validateBase64Image(ref.data, ref.mimeType || 'image/jpeg');
            if (imgErr) return res.status(400).json({ error: `Reference image ${i + 1}: ${imgErr}` });
            parts.push({ text: `REF${i}:` });
            parts.push({
              inlineData: {
                mimeType: ref.mimeType || 'image/jpeg',
                data:     cleanBase64(ref.data),
              },
            });
          }
        }
      }

      let instruction = prompt;
      if (negative) instruction += `\nNEGATIVE: ${negative}`;
      parts.push({ text: instruction });

      // Crear job en Redis — las imágenes (parts) se guardan en Redis, NO en QStash
      // QStash tiene límite de 1MB por mensaje; las imágenes en base64 lo exceden fácilmente.
      const jobId = generateJobId();
      const safeUid = verifiedUid ? sanitizeUid(verifiedUid) : undefined;
      const job: ImageJob = {
        id:        jobId,
        status:    'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        shotIndex,
        totalShots,
        module: moduleName,
        uid:         safeUid,
        sessionId:   sessionId,
        moduleLabel: moduleLabel,
        metadata:    metadata,
      };

      // Elegir proveedor disponible (circuit breaker automático)
      const resolvedModel = await resolveProvider(modelId);
      const isSeedream    = resolvedModel === 'seedream';
      const isGptImage    = resolvedModel === 'gptimage';

      // Guardar parts en Redis para todos los modelos
      await Promise.all([
        saveJob(job),
        redis.set(`img_parts:${jobId}`, JSON.stringify(parts), { ex: 3600 }),
        // Guardar el modelo resuelto para que el cliente sepa cuál se usó
        redis.set(`img_model:${jobId}`, resolvedModel, { ex: 3600 }),
      ]);

      // Enrutar al worker según el modelo disponible
      let workerUrl: string;
      let workerBody: Record<string, unknown>;

      if (isSeedream) {
        workerUrl  = `${process.env.WORKER_BASE_URL}/api/gemini/evolink-worker`;
        workerBody = { jobId, prompt, aspectRatio, modelProvider: 'seedream' };
      } else if (isGptImage) {
        workerUrl  = `${process.env.WORKER_BASE_URL}/api/gemini/evolink-worker`;
        workerBody = { jobId, prompt, aspectRatio, modelProvider: 'gptimage' };
      } else {
        workerUrl  = `${process.env.WORKER_BASE_URL}/api/gemini/image-worker`;
        workerBody = { jobId };
      }

      await qstash.publishJSON({
        url:     workerUrl,
        body:    workerBody,
        retries: 2,
      });

      console.log(`[Image] Job ${jobId} enqueued model=${resolvedModel}${resolvedModel !== modelId ? ` (fallback desde ${modelId})` : ''} (module: ${moduleName || 'unknown'})`);
      return res.status(202).json({
        success: true,
        jobId,
        status: 'pending',
        shotIndex,
        totalShots,
      });
    }

    // ── Consultar estado ──────────────────────────────────────────────────────
    if (action === 'getJobStatus') {
      const { jobId } = payload;
      if (!jobId) return res.status(400).json({ error: 'Missing jobId' });

      const job = await getJob(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const response: any = {
        jobId:     job.id,
        status:    job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        shotIndex: job.shotIndex,
        totalShots: job.totalShots,
        // El cliente lo lee para saber si el server ya reembolsó (evita doble reembolso)
        refunded:  job.refunded === true,
      };
      if (job.status === 'completed') response.image = job.result;
      if (job.status === 'failed')    response.error = job.error;

      return res.status(200).json(response);
    }

    // ── Resetear circuit breakers (solo admin interno) ────────────────────────
    if (action === 'resetCircuits') {
      const secret = payload?.secret;
      const validSecret = process.env.ADMIN_SECRET || process.env.BATCH_ADMIN_SECRET;
      if (!validSecret || secret !== validSecret) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await Promise.all([
        redis.del('circuit:gemini'),
        redis.del('circuit:seedream'),
        redis.del('circuit:gptimage'),
      ]);
      return res.status(200).json({ ok: true, message: 'All circuits reset' });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err: any) {
    console.error('[Image] Handler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal error' });
  }
}