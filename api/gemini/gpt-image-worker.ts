// api/gemini/gpt-image-worker.ts
// Worker de GPT Image 2 vía EvoLink.
// Llamado exclusivamente por QStash — nunca por el cliente directamente.
//
// Flujo:
//   1. Recibe { jobId, prompt, aspectRatio } desde QStash
//   2. POST a EvoLink /images/generations (model: gpt-image-2-beta) → obtiene task_id
//   3. Polling a EvoLink /tasks/{task_id} hasta completed (máx 45 intentos × 3s)
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
const EVOLINK_BASE_URL    = process.env.EVOLINK_BASE_URL || 'https://api.evolink.ai/v1';
const EVOLINK_API_KEY     = process.env.EVOLINK_API_KEY  || '';
const GPT_IMAGE_MODEL_ID  = process.env.GPT_IMAGE_MODEL_ID || 'gpt-image-2-beta';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ImageJob {
  id:          string;
  status:      JobStatus;
  result?:     string;
  error?:      string;
  createdAt:   number;
  updatedAt:   number;
  shotIndex?:  number;
  totalShots?: number;
  module?:     string;
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

// ─── Mapeo de aspectRatio al formato que acepta GPT Image 2 ──────────────────
function toGptImageSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    '1:1':  '1:1',
    '3:4':  '3:4',
    '4:3':  '4:3',
    '9:16': '9:16',
    '16:9': '16:9',
  };
  return map[aspectRatio] || '1:1';
}

// ─── Extrae referencias de imagen desde los parts guardados en Redis ──────────
function extractReferenceDataUrls(parts: any[]): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (part?.inlineData?.data) {
      const mime      = part.inlineData.mimeType || 'image/jpeg';
      const trimmed   = part.inlineData.data;
      const mid       = Math.floor(trimmed.length / 2);
      const fingerprint = [
        trimmed.length,
        trimmed.slice(0, 80),
        trimmed.slice(Math.max(0, mid - 40), mid + 40),
        trimmed.slice(-80),
      ].join('|');
      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        refs.push(`data:${mime};base64,${trimmed}`);
      }
    }
  }
  return refs;
}

// ─── Lógica principal ─────────────────────────────────────────────────────────
async function processGptImageJob(
  jobId: string,
  prompt: string,
  aspectRatio: string,
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    console.error(`[GptImageWorker] Job ${jobId} not found in Redis`);
    return;
  }

  job.status    = 'processing';
  job.updatedAt = Date.now();
  await saveJob(job);

  if (!EVOLINK_API_KEY) {
    job.status    = 'failed';
    job.error     = 'EVOLINK_API_KEY not configured in environment variables';
    job.updatedAt = Date.now();
    await saveJob(job);
    console.error(`[GptImageWorker ${jobId}] Missing EVOLINK_API_KEY env var`);
    return;
  }

  // Leer referencias de imagen desde Redis
  let referenceDataUrls: string[] = [];
  try {
    const rawParts = await redis.get(`img_parts:${jobId}`);
    if (rawParts) {
      const parts = typeof rawParts === 'string' ? JSON.parse(rawParts) : rawParts;
      referenceDataUrls = extractReferenceDataUrls(parts);
      console.log(`[GptImageWorker ${jobId}] Found ${referenceDataUrls.length} reference image(s)`);
    }
  } catch (e) {
    console.warn(`[GptImageWorker ${jobId}] Could not read img_parts from Redis:`, e);
  }

  // GPT Image 2 acepta hasta 16 referencias
  const MAX_REFS    = 16;
  const refsToSend  = referenceDataUrls.slice(0, MAX_REFS);

  const evolinkBody: Record<string, unknown> = {
    model:      GPT_IMAGE_MODEL_ID,
    prompt,
    size:       toGptImageSize(aspectRatio),
    resolution: '1K',
  };

  if (refsToSend.length === 1) {
    evolinkBody.image_urls = refsToSend;
  } else if (refsToSend.length > 1) {
    evolinkBody.image_urls = refsToSend;
  }

  console.log(`[GptImageWorker ${jobId}] Sending ${refsToSend.length} refs, model=${GPT_IMAGE_MODEL_ID}`);

  let taskId: string;
  try {
    const startRes = await fetch(`${EVOLINK_BASE_URL}/images/generations`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${EVOLINK_API_KEY}`,
      },
      body: JSON.stringify(evolinkBody),
    });

    if (!startRes.ok) {
      const errText = await startRes.text().catch(() => '');
      if (startRes.status === 429 || startRes.status === 500) {
        const isRateLimit = errText.includes('rate limit') || errText.includes('Rate limit') || errText.includes('daily');
        if (isRateLimit) {
          await redis.set('circuit:gptimage', 'down', { ex: 60 * 60 * 2 });
          console.warn(`[GptImageWorker] Rate limit detectado — circuit gptimage abierto por 2h`);
        }
      }
      throw new Error(`EvoLink start failed ${startRes.status}: ${errText}`);
    }

    const startData = await startRes.json();
    taskId = startData.id || startData.task_id;
    if (!taskId) throw new Error('EvoLink returned no task_id');

    console.log(`[GptImageWorker ${jobId}] EvoLink task started: ${taskId}`);
  } catch (err: any) {
    job.status    = 'failed';
    job.error     = `EvoLink start error: ${err.message}`;
    job.updatedAt = Date.now();
    await saveJob(job);
    return;
  }

  // ── Polling hasta completed ───────────────────────────────────────────────
  // GPT Image 2 es más lento que Seedream — usamos 3s entre polls
  const MAX_ATTEMPTS  = 45;   // 45 × 3s = 135s máximo
  const POLL_DELAY_MS = 3000;

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
      console.warn(`[GptImageWorker ${jobId}] Poll attempt ${attempt + 1} error: ${err.message}`);
      continue;
    }

    const status = taskData.status;
    console.log(`[GptImageWorker ${jobId}] Attempt ${attempt + 1}: status=${status}`);

    if (status === 'completed' || status === 'succeeded') {
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

      try {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);

        const contentType = imgRes.headers.get('content-type') || 'image/png';
        const mimeType    = contentType.split(';')[0].trim();
        const arrayBuffer = await imgRes.arrayBuffer();
        const base64      = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl     = `data:${mimeType};base64,${base64}`;

        job.status    = 'completed';
        job.result    = dataUrl;
        job.updatedAt = Date.now();
        await saveJob(job);
        await redis.del(`img_parts:${jobId}`).catch(() => {});
        console.log(`[GptImageWorker ${jobId}] Completed successfully`);
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
      console.error(`[GptImageWorker ${jobId}] EvoLink task failed: ${errMsg}`);
      return;
    }
  }

  job.status    = 'failed';
  job.error     = `EvoLink timeout after ${MAX_ATTEMPTS * POLL_DELAY_MS / 1000}s`;
  job.updatedAt = Date.now();
  await saveJob(job);
  console.error(`[GptImageWorker ${jobId}] Timeout`);
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const signature = req.headers['upstash-signature'] as string;
  if (!signature) {
    console.error('[GptImageWorker] Missing upstash-signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  try {
    await receiver.verify({ signature, body: JSON.stringify(req.body) });
  } catch {
    console.error('[GptImageWorker] Invalid QStash signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { jobId, prompt, aspectRatio = '1:1' } = req.body;
  if (!jobId || !prompt) {
    return res.status(400).json({ error: 'Missing jobId or prompt' });
  }

  try {
    await processGptImageJob(jobId, prompt, aspectRatio);
    return res.status(200).json({ ok: true, jobId });
  } catch (err: any) {
    console.error(`[GptImageWorker] Unhandled error for ${jobId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
