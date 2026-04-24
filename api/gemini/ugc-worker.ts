// api/gemini/ugc-worker.ts
// Worker que ejecuta la generación de imágenes fuera del ciclo de vida del handler principal.
// Es llamado por QStash, no directamente por el cliente.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Receiver } from '@upstash/qstash';
import { Redis } from '@upstash/redis';
import { GoogleGenAI } from '@google/genai';

// ─── Redis (mismo config que ugc.ts) ────────────────────────────────────────
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// ─── QStash Receiver (verifica que la petición viene de QStash) ──────────────
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// ─── Tipos (copiados de ugc.ts para no depender de imports) ─────────────────
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
}

// ─── Helpers Redis ───────────────────────────────────────────────────────────
async function saveJob(job: Job): Promise<void> {
  await redis.set(`job:${job.id}`, JSON.stringify(job), { ex: 3600 });
}

async function getJob(jobId: string): Promise<Job | null> {
  const data = await redis.get(`job:${jobId}`);
  if (!data) return null;
  if (typeof data === 'string') return JSON.parse(data);
  return data as Job;
}

// ─── Google GenAI (mismo config que ugc.ts) ──────────────────────────────────
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

// ─── Lógica de generación (idéntica a processGenerationJob en ugc.ts) ────────
async function processGenerationJob(jobId: string, parts: any[]): Promise<void> {
  let job = await getJob(jobId);
  if (!job) {
    console.error(`[Worker] Job ${jobId} not found in Redis`);
    return;
  }

  job.status = 'processing';
  job.updatedAt = Date.now();
  await saveJob(job);

  // Solo Flash — sin fallback a Pro para controlar costos.
  const MODEL    = 'gemini-3.1-flash-image-preview';
  const ai       = getGenAIClient('global');

  try {
    console.log(`[Worker Job ${jobId}] Using ${MODEL}`);
    const response = await ai.models.generateContent({
      model:    MODEL,
      contents: [{ role: 'user', parts }],
      config:   { responseModalities: ['TEXT', 'IMAGE'] },
    });

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          job.status    = 'completed';
          job.result    = `data:${mime};base64,${part.inlineData.data}`;
          job.updatedAt = Date.now();
          await saveJob(job);
          console.log(`[Worker Job ${jobId}] Completed`);
          return;
        }
      }
    }
    throw new Error('Model returned no image');
  } catch (e: any) {
    job.status    = 'failed';
    job.error     = e.message || 'Flash model failed';
    job.updatedAt = Date.now();
    await saveJob(job);
    console.error(`[Worker Job ${jobId}] Failed: ${e.message}`);
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo acepta POST (QStash siempre usa POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar firma de QStash para evitar llamadas no autorizadas
  const signature = req.headers['upstash-signature'] as string;

  if (!signature) {
    console.error('[Worker] Missing upstash-signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  try {
    // req.body ya es el objeto parseado por Vercel, necesitamos el body raw para verificar
    const bodyString = JSON.stringify(req.body);
    await receiver.verify({
      signature,
      body: bodyString,
    });
  } catch (err) {
    console.error('[Worker] Invalid QStash signature:', err);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: 'Missing jobId' });

  // Leer parts desde Redis — ugc.ts ya no los manda en el body de QStash
  // para evitar el límite de 1MB cuando hay referencias de imagen pesadas.
  const rawParts = await redis.get(`img_parts:${jobId}`);
  if (!rawParts) {
    console.error(`[UGCWorker] img_parts not found in Redis for job ${jobId}`);
    return res.status(404).json({ error: 'Parts not found for job' });
  }
  const parts = typeof rawParts === 'string' ? JSON.parse(rawParts) : rawParts;

  try {
    await processGenerationJob(jobId, parts);
    await redis.del(`img_parts:${jobId}`).catch(() => {});
    return res.status(200).json({ ok: true, jobId });
  } catch (error: any) {
    console.error(`[UGCWorker] Unhandled error for job ${jobId}:`, error.message);
    return res.status(500).json({ error: error.message });
  }
}