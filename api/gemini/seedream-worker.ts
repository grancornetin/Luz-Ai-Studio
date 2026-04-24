// api/gemini/seedream-worker.ts
// Worker de Seedream 4.5 vía EvoLink.
// Llamado exclusivamente por QStash — nunca por el cliente directamente.
//
// Flujo:
//   1. Recibe { jobId, prompt, aspectRatio } desde QStash
//   2. POST a EvoLink /images/generations → obtiene task_id
//   3. Polling a EvoLink /tasks/{task_id} hasta completed (máx 30 intentos × 2s)
//   4. Descarga la imagen y la convierte a data URL base64
//   5. Actualiza Redis img_job:{jobId} con resultado

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Receiver } from '@upstash/qstash';
import { Redis } from '@upstash/redis';

// ─── Redis ───────────────────────────────────────────────────────────────────
const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// ─── QStash Receiver ─────────────────────────────────────────────────────────
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey:    process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// ─── EvoLink config ───────────────────────────────────────────────────────────
const EVOLINK_BASE_URL  = process.env.EVOLINK_BASE_URL || 'https://api.evolink.ai/v1';
const EVOLINK_API_KEY   = process.env.EVOLINK_API_KEY  || '';
const SEEDREAM_MODEL_ID = process.env.SEEDREAM_MODEL_ID || 'doubao-seedream-4.5';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ImageJob {
  id:         string;
  status:     JobStatus;
  result?:    string;
  error?:     string;
  createdAt:  number;
  updatedAt:  number;
  shotIndex?: number;
  totalShots?: number;
  module?:    string;
}

// ─── Helpers Redis ────────────────────────────────────────────────────────────
async function saveJob(job: ImageJob): Promise<void> {
  await redis.set(`img_job:${job.id}`, JSON.stringify(job), { ex: 3600 });
}

async function getJob(jobId: string): Promise<ImageJob | null> {
  const data = await redis.get(`img_job:${jobId}`);
  if (!data) return null;
  if (typeof data === 'string') return JSON.parse(data);
  return data as ImageJob;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Mapeo de aspectRatio a tamaño EvoLink ────────────────────────────────────
function toEvolinkSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    '1:1':  '1024x1024',
    '3:4':  '768x1024',
    '4:3':  '1024x768',
    '9:16': '576x1024',
    '16:9': '1024x576',
  };
  return map[aspectRatio] || '1024x1024';
}

// ─── Lógica principal ─────────────────────────────────────────────────────────
async function processSeedreamJob(
  jobId: string,
  prompt: string,
  aspectRatio: string,
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    console.error(`[SeedreamWorker] Job ${jobId} not found in Redis`);
    return;
  }

  job.status    = 'processing';
  job.updatedAt = Date.now();
  await saveJob(job);

  // ── Paso 1: iniciar generación en EvoLink ─────────────────────────────────
  if (!EVOLINK_API_KEY) {
    job.status    = 'failed';
    job.error     = 'EVOLINK_API_KEY not configured in environment variables';
    job.updatedAt = Date.now();
    await saveJob(job);
    console.error(`[SeedreamWorker ${jobId}] Missing EVOLINK_API_KEY env var`);
    return;
  }

  let taskId: string;
  try {
    console.log(`[SeedreamWorker ${jobId}] Using key: ${EVOLINK_API_KEY.slice(0, 8)}...`);
    const startRes = await fetch(`${EVOLINK_BASE_URL}/images/generations`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${EVOLINK_API_KEY}`,
      },
      body: JSON.stringify({
        model:  SEEDREAM_MODEL_ID,
        prompt,
        size:   toEvolinkSize(aspectRatio),
      }),
    });

    if (!startRes.ok) {
      const errText = await startRes.text().catch(() => '');
      throw new Error(`EvoLink start failed ${startRes.status}: ${errText}`);
    }

    const startData = await startRes.json();
    // EvoLink devuelve { id: "...", status: "pending", ... }
    taskId = startData.id || startData.task_id;
    if (!taskId) throw new Error('EvoLink returned no task_id');

    console.log(`[SeedreamWorker ${jobId}] EvoLink task started: ${taskId}`);
  } catch (err: any) {
    job.status    = 'failed';
    job.error     = `EvoLink start error: ${err.message}`;
    job.updatedAt = Date.now();
    await saveJob(job);
    return;
  }

  // ── Paso 2: polling a EvoLink hasta completed ─────────────────────────────
  const MAX_ATTEMPTS  = 30;
  const POLL_DELAY_MS = 2000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_DELAY_MS);

    let taskData: any;
    try {
      const pollRes = await fetch(`${EVOLINK_BASE_URL}/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${EVOLINK_API_KEY}` },
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text().catch(() => '');
        throw new Error(`EvoLink poll failed ${pollRes.status}: ${errText}`);
      }
      taskData = await pollRes.json();
    } catch (err: any) {
      console.warn(`[SeedreamWorker ${jobId}] Poll attempt ${attempt + 1} error: ${err.message}`);
      continue; // reintentar
    }

    const status = taskData.status;
    console.log(`[SeedreamWorker ${jobId}] Attempt ${attempt + 1}: status=${status}`);

    if (status === 'completed' || status === 'succeeded') {
      // Extraer URL de la imagen — EvoLink puede devolverla en distintas rutas
      const imageUrl: string | undefined =
        taskData.result_data?.[0]?.url ||
        taskData.results?.[0]?.url      ||
        taskData.output?.[0]?.url       ||
        taskData.data?.[0]?.url         ||
        taskData.image_url;

      if (!imageUrl) {
        job.status    = 'failed';
        job.error     = 'EvoLink completed but no image URL in response';
        job.updatedAt = Date.now();
        await saveJob(job);
        return;
      }

      // ── Paso 3: descargar imagen y convertir a data URL base64 ─────────────
      try {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);

        const contentType = imgRes.headers.get('content-type') || 'image/png';
        const mimeType = contentType.split(';')[0].trim();
        const arrayBuffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;

        job.status    = 'completed';
        job.result    = dataUrl;
        job.updatedAt = Date.now();
        await saveJob(job);
        console.log(`[SeedreamWorker ${jobId}] Completed successfully`);
      } catch (err: any) {
        job.status    = 'failed';
        job.error     = `Image download error: ${err.message}`;
        job.updatedAt = Date.now();
        await saveJob(job);
      }
      return;
    }

    if (status === 'failed' || status === 'error') {
      const errMsg = taskData.error || taskData.message || 'EvoLink task failed';
      job.status    = 'failed';
      job.error     = errMsg;
      job.updatedAt = Date.now();
      await saveJob(job);
      console.error(`[SeedreamWorker ${jobId}] EvoLink task failed: ${errMsg}`);
      return;
    }

    // status === 'pending' | 'running' | 'processing' → seguir esperando
  }

  // Timeout
  job.status    = 'failed';
  job.error     = `EvoLink timeout after ${MAX_ATTEMPTS * POLL_DELAY_MS / 1000}s`;
  job.updatedAt = Date.now();
  await saveJob(job);
  console.error(`[SeedreamWorker ${jobId}] Timeout`);
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const signature = req.headers['upstash-signature'] as string;
  if (!signature) {
    console.error('[SeedreamWorker] Missing upstash-signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  try {
    await receiver.verify({ signature, body: JSON.stringify(req.body) });
  } catch {
    console.error('[SeedreamWorker] Invalid QStash signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { jobId, prompt, aspectRatio = '1:1' } = req.body;
  if (!jobId || !prompt) {
    return res.status(400).json({ error: 'Missing jobId or prompt' });
  }

  try {
    await processSeedreamJob(jobId, prompt, aspectRatio);
    return res.status(200).json({ ok: true, jobId });
  } catch (err: any) {
    console.error(`[SeedreamWorker] Unhandled error for ${jobId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
