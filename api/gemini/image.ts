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

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
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
      } = payload;

      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

      // Construir parts para el worker (igual que ugc-worker)
      const parts: any[] = [];

      if (Array.isArray(referenceImages)) {
        for (let i = 0; i < referenceImages.length; i++) {
          const ref = referenceImages[i];
          if (ref?.data && ref.data.length > 64) {
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
      const job: ImageJob = {
        id:        jobId,
        status:    'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        shotIndex,
        totalShots,
        module: moduleName,
      };

      // Guardar job y parts por separado en Redis
      await Promise.all([
        saveJob(job),
        redis.set(`img_parts:${jobId}`, JSON.stringify(parts), { ex: 3600 }),
      ]);

      // Encolar en QStash → image-worker — solo el jobId, sin imágenes
      const workerUrl = `${process.env.WORKER_BASE_URL}/api/gemini/image-worker`;
      await qstash.publishJSON({
        url:     workerUrl,
        body:    { jobId },   // ← solo jobId, el worker lee parts desde Redis
        retries: 2,
      });

      console.log(`[Image] Job ${jobId} enqueued (module: ${moduleName || 'unknown'}) → ${workerUrl}`);
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
      };
      if (job.status === 'completed') response.image = job.result;
      if (job.status === 'failed')    response.error = job.error;

      return res.status(200).json(response);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err: any) {
    console.error('[Image] Handler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal error' });
  }
}