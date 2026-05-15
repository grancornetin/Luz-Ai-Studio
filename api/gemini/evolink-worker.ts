// api/gemini/evolink-worker.ts
// Worker unificado para todos los modelos EvoLink (Seedream 4.5, GPT Image 2, etc.)
// Llamado exclusivamente por QStash — nunca por el cliente directamente.
//
// Flujo:
//   1. Recibe { jobId, prompt, aspectRatio, modelProvider } desde QStash
//   2. POST a EvoLink /images/generations con el model ID correspondiente
//   3. Polling a EvoLink /tasks/{task_id} hasta completed
//   4. Descarga la imagen y la convierte a data URL base64
//   5. Actualiza Redis img_job:{jobId} con resultado

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Receiver } from '@upstash/qstash';
import { Redis } from '@upstash/redis';
import { reportShotResult, appendToHistory } from '../_notifications.js';

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
const EVOLINK_BASE_URL   = process.env.EVOLINK_BASE_URL  || 'https://api.evolink.ai/v1';
const EVOLINK_API_KEY    = process.env.EVOLINK_API_KEY   || '';
const SEEDREAM_MODEL_ID  = process.env.SEEDREAM_MODEL_ID || 'doubao-seedream-4.5';
const GPT_IMAGE_MODEL_ID = process.env.GPT_IMAGE_MODEL_ID || 'gpt-image-2';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type JobStatus      = 'pending' | 'processing' | 'completed' | 'failed';
type ModelProvider  = 'seedream' | 'gptimage';

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
  // Notificaciones Nivel 3
  uid?:         string;
  sessionId?:   string;
  moduleLabel?: string;
  metadata?:    Record<string, any>;
  refunded?:    boolean;
}

// ─── Config por proveedor ─────────────────────────────────────────────────────
const PROVIDER_CONFIG: Record<ModelProvider, {
  modelId:     string;
  maxRefs:     number;
  pollDelayMs: number;
  maxAttempts: number;
  circuitKey:  string;
}> = {
  seedream: {
    modelId:     SEEDREAM_MODEL_ID,
    maxRefs:     5,
    pollDelayMs: 2000,
    maxAttempts: 45,
    circuitKey:  'circuit:seedream',
  },
  gptimage: {
    modelId:     GPT_IMAGE_MODEL_ID,
    maxRefs:     16,
    pollDelayMs: 2000,  // 2s — igual que Seedream, GPT Image 2 suele responder en 30-60s
    maxAttempts: 55,    // 55 × 2s = 110s — cabe con margen en maxDuration:150s de Vercel
    circuitKey:  'circuit:gptimage',
  },
};

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

// ─── Mapeo de aspectRatio ─────────────────────────────────────────────────────
function toEvolinkSize(aspectRatio: string): string {
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
// UGC Studio envía face duplicada para ponderar en Gemini — con EvoLink
// deduplicamos para no enviar referencias repetidas.
function extractReferenceDataUrls(parts: any[]): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (part?.inlineData?.data) {
      const mime    = part.inlineData.mimeType || 'image/jpeg';
      const trimmed = part.inlineData.data;
      const mid     = Math.floor(trimmed.length / 2);
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

// ─── Notificación + historial al terminar el job ──────────────────────────────
async function persistJobOutcome(job: ImageJob, success: boolean): Promise<void> {
  if (!job.uid || !job.sessionId || job.totalShots == null || job.shotIndex == null) {
    return;
  }
  try {
    await reportShotResult({
      uid: job.uid,
      sessionId: job.sessionId,
      module: job.module || 'unknown',
      moduleLabel: job.moduleLabel,
      totalShots: job.totalShots,
      shotIndex: job.shotIndex,
      shotStatus: success ? 'completed' : 'failed',
      imageUrl: success ? job.result : undefined,
      error: success ? undefined : job.error,
      metadata: job.metadata,
    });
    if (!success) {
      job.refunded = true;
      await saveJob(job);
    }
    if (success && job.result) {
      await appendToHistory({
        uid: job.uid,
        imageUrl: job.result,
        module: job.module || 'unknown',
        moduleLabel: job.moduleLabel,
        creditsUsed: 1,
        metadata: job.metadata,
        config: {
          shotIndex: job.shotIndex,
          totalShots: job.totalShots,
          sessionId: job.sessionId,
        },
      });
    }
  } catch (err: any) {
    console.error(`[EvolinkWorker ${job.id}] persistJobOutcome failed:`, err.message);
  }
}

// ─── Lógica principal ─────────────────────────────────────────────────────────
async function processEvolinkJob(
  jobId:         string,
  prompt:        string,
  aspectRatio:   string,
  modelProvider: ModelProvider,
): Promise<void> {
  const config = PROVIDER_CONFIG[modelProvider];
  const tag    = `[EvolinkWorker:${modelProvider} ${jobId}]`;

  const job = await getJob(jobId);
  if (!job) {
    console.error(`${tag} Job not found in Redis`);
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
    console.error(`${tag} Missing EVOLINK_API_KEY env var`);
    await persistJobOutcome(job, false);
    return;
  }

  // Leer referencias de imagen desde Redis
  let referenceDataUrls: string[] = [];
  try {
    const rawParts = await redis.get(`img_parts:${jobId}`);
    if (rawParts) {
      const parts = typeof rawParts === 'string' ? JSON.parse(rawParts) : rawParts;
      referenceDataUrls = extractReferenceDataUrls(parts);
      console.log(`${tag} Found ${referenceDataUrls.length} reference image(s)`);
    }
  } catch (e) {
    console.warn(`${tag} Could not read img_parts from Redis:`, e);
  }

  const refsToSend = referenceDataUrls.slice(0, config.maxRefs);

  const evolinkBody: Record<string, unknown> = {
    model:  config.modelId,
    prompt,
    size:   toEvolinkSize(aspectRatio),
  };

  // GPT Image 2 soporta parámetro resolution; Seedream lo ignora si se lo pasamos
  // Product Studio (module='product') pide 4K para mayor calidad comercial.
  // Todo lo demás (outfit, etc.) usa 1K — suficiente y más barato.
  if (modelProvider === 'gptimage') {
    const modules2K = ['product', 'prompt_studio', 'campaign', 'campaign_anchor'];
    evolinkBody.resolution = modules2K.includes(job.module ?? '') ? '2K' : '1K';
  }

  // CRÍTICO: no mezclar image_url + image_urls — algunos gateways priorizan
  // image_url e ignoran el array, dejando outfit/producto sin efecto.
  if (refsToSend.length === 1) {
    evolinkBody.image_url = refsToSend[0];
  } else if (refsToSend.length > 1) {
    evolinkBody.image_urls = refsToSend;
  }

  console.log(`${tag} Sending ${refsToSend.length} refs, model=${config.modelId}`);

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
          await redis.set(config.circuitKey, 'down', { ex: 60 * 60 * 2 });
          console.warn(`${tag} Rate limit detectado — circuit abierto por 2h`);
        }
      }
      throw new Error(`EvoLink start failed ${startRes.status}: ${errText}`);
    }

    const startData = await startRes.json();
    taskId = startData.id || startData.task_id;
    if (!taskId) throw new Error('EvoLink returned no task_id');

    // Loguear costo estimado para calibrar precios por resolución
    const creditsReserved = startData.usage?.credits_reserved ?? 'n/a';
    const billingRule     = startData.usage?.billing_rule     ?? 'n/a';
    console.log(`[EvoLink:COST] model=${config.modelId} module=${job.module ?? 'unknown'} resolution=${evolinkBody.resolution ?? 'n/a'} size=${evolinkBody.size} credits_reserved=${creditsReserved} billing_rule=${billingRule} taskId=${taskId}`);
  } catch (err: any) {
    job.status    = 'failed';
    job.error     = `EvoLink start error: ${err.message}`;
    job.updatedAt = Date.now();
    await saveJob(job);
    await persistJobOutcome(job, false);
    return;
  }

  // ── Polling ───────────────────────────────────────────────────────────────
  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    await sleep(config.pollDelayMs);

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
      console.warn(`${tag} Poll attempt ${attempt + 1} error: ${err.message}`);
      continue;
    }

    const status = taskData.status;
    console.log(`${tag} Attempt ${attempt + 1}: status=${status}`);

    if (status === 'completed' || status === 'succeeded') {
      // Loguear costo real al completar (puede diferir del estimado inicial)
      const finalCredits = taskData.usage?.credits_used ?? taskData.usage?.credits_reserved ?? 'n/a';
      console.log(`[EvoLink:COST_FINAL] model=${config.modelId} module=${job.module ?? 'unknown'} resolution=${evolinkBody.resolution ?? 'n/a'} size=${evolinkBody.size} credits_final=${finalCredits} taskId=${taskId}`);

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
        await persistJobOutcome(job, false);
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
        console.log(`${tag} Completed successfully`);
        await persistJobOutcome(job, true);
      } catch (err: any) {
        job.status    = 'failed';
        job.error     = `Image download error: ${err.message}`;
        job.updatedAt = Date.now();
        await saveJob(job);
        await persistJobOutcome(job, false);
      }
      return;
    }

    if (status === 'failed' || status === 'error') {
      const errMsg = taskData.error || taskData.message || 'EvoLink task failed';
      job.status    = 'failed';
      job.error     = errMsg;
      job.updatedAt = Date.now();
      await saveJob(job);
      console.error(`${tag} EvoLink task failed: ${errMsg}`);
      await persistJobOutcome(job, false);
      return;
    }
  }

  job.status    = 'failed';
  job.error     = `EvoLink timeout after ${config.maxAttempts * config.pollDelayMs / 1000}s`;
  job.updatedAt = Date.now();
  await saveJob(job);
  console.error(`${tag} Timeout`);
  await persistJobOutcome(job, false);
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const signature = req.headers['upstash-signature'] as string;
  if (!signature) {
    console.error('[EvolinkWorker] Missing upstash-signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  try {
    await receiver.verify({ signature, body: JSON.stringify(req.body) });
  } catch {
    console.error('[EvolinkWorker] Invalid QStash signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { jobId, prompt, aspectRatio = '1:1', modelProvider = 'seedream' } = req.body;
  if (!jobId || !prompt) {
    return res.status(400).json({ error: 'Missing jobId or prompt' });
  }

  if (modelProvider !== 'seedream' && modelProvider !== 'gptimage') {
    return res.status(400).json({ error: `Unknown modelProvider: ${modelProvider}` });
  }

  try {
    await processEvolinkJob(jobId, prompt, aspectRatio, modelProvider as ModelProvider);
    return res.status(200).json({ ok: true, jobId });
  } catch (err: any) {
    console.error(`[EvolinkWorker] Unhandled error for ${jobId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
