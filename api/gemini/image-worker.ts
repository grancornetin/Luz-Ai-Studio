// api/gemini/image-worker.ts
// Worker genérico para generación de imágenes.
// Llamado exclusivamente por QStash — nunca por el cliente directamente.
//
// MODELOS PERMITIDOS: solo Gemini 3 @ global
//   1. gemini-3.1-flash-image-preview  (primario — más rápido)
//   2. gemini-3-pro-image-preview       (fallback — mayor fidelidad)
//
// gemini-2.5-flash-image está EXCLUIDO: no disponible en `global`
// y causa drift de identidad/estilo en generaciones con referencias.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Receiver } from '@upstash/qstash';
import { Redis } from '@upstash/redis';
import { GoogleGenAI } from '@google/genai';

// ─── Redis ───────────────────────────────────────────────────────────────────
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// ─── QStash Receiver ─────────────────────────────────────────────────────────
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey:    process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ImageJob {
  id: string;
  status: JobStatus;
  result?: string;   // data URL de la imagen completada
  error?: string;
  createdAt: number;
  updatedAt: number;
  // Metadatos opcionales para progreso en UI
  shotIndex?: number;
  totalShots?: number;
  module?: string;   // trazabilidad: 'product', 'outfit', 'clone', 'avatar', 'prompt', etc.
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

// ─── Google GenAI ─────────────────────────────────────────────────────────────
function getCredentials(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

function getGenAIClient(): GoogleGenAI {
  // Todos los modelos Gemini 3 image-preview están en `global`
  return new GoogleGenAI({
    vertexai: true,
    project:  process.env.GCP_PROJECT_ID!,
    location: 'global',
    googleAuthOptions: { credentials: getCredentials() },
  });
}

// ─── Lógica de generación ─────────────────────────────────────────────────────
// Solo usa gemini-3.1-flash-image-preview. Sin fallback a Pro para controlar costos.
async function processJob(jobId: string, parts: any[]): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    console.error(`[ImageWorker] Job ${jobId} not found in Redis`);
    return;
  }

  job.status    = 'processing';
  job.updatedAt = Date.now();
  await saveJob(job);

  const MODEL = 'gemini-3.1-flash-image-preview';
  const ai    = getGenAIClient();

  try {
    console.log(`[ImageWorker ${jobId}] Using ${MODEL}`);
    const response = await ai.models.generateContent({
      model:    MODEL,
      contents: [{ role: 'user', parts }],
      config:   { responseModalities: ['TEXT', 'IMAGE'] },
    });

    for (const candidate of (response.candidates || [])) {
      for (const part of (candidate.content?.parts || [])) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          job.status    = 'completed';
          job.result    = `data:${mime};base64,${part.inlineData.data}`;
          job.updatedAt = Date.now();
          await saveJob(job);
          console.log(`[ImageWorker ${jobId}] Completed`);
          return;
        }
      }
    }
    throw new Error('Model returned no image');
  } catch (err: any) {
    job.status    = 'failed';
    job.error     = err.message || 'Flash model failed';
    job.updatedAt = Date.now();
    await saveJob(job);
    console.error(`[ImageWorker ${jobId}] Failed: ${err.message}`);
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verificar firma QStash
  const signature = req.headers['upstash-signature'] as string;
  if (!signature) {
    console.error('[ImageWorker] Missing upstash-signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  try {
    await receiver.verify({ signature, body: JSON.stringify(req.body) });
  } catch {
    console.error('[ImageWorker] Invalid QStash signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: 'Missing jobId' });

  // Leer parts desde Redis — no vienen en el body de QStash para evitar el límite de 1MB
  const rawParts = await redis.get(`img_parts:${jobId}`);
  if (!rawParts) {
    console.error(`[ImageWorker] Parts not found in Redis for job ${jobId}`);
    return res.status(404).json({ error: 'Parts not found for job' });
  }
  const parts = typeof rawParts === 'string' ? JSON.parse(rawParts) : rawParts;

  try {
    await processJob(jobId, parts);
    // Limpiar parts de Redis una vez completado el job (el job en sí se mantiene 1h)
    await redis.del(`img_parts:${jobId}`);
    return res.status(200).json({ ok: true, jobId });
  } catch (err: any) {
    console.error(`[ImageWorker] Unhandled error for ${jobId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}