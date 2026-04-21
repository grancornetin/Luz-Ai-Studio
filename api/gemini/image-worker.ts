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
// Intenta Flash primero (más rápido), luego Pro como fallback.
// Si ambos fallan, el job queda en 'failed' y el cliente maneja el reintento.
async function processJob(jobId: string, parts: any[]): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    console.error(`[ImageWorker] Job ${jobId} not found in Redis`);
    return;
  }

  job.status    = 'processing';
  job.updatedAt = Date.now();
  await saveJob(job);

  const models = [
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
  ];

  const ai = getGenAIClient();

  for (const modelName of models) {
    try {
      console.log(`[ImageWorker ${jobId}] Trying ${modelName}`);
      const response = await ai.models.generateContent({
        model:    modelName,
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
            console.log(`[ImageWorker ${jobId}] Completed with ${modelName}`);
            return;
          }
        }
      }
      // El modelo respondió pero sin imagen — intentar el siguiente
      console.warn(`[ImageWorker ${jobId}] ${modelName} returned no image`);
    } catch (err: any) {
      console.warn(`[ImageWorker ${jobId}] ${modelName} error: ${err.message}`);
    }
  }

  // Todos los modelos fallaron
  job.status    = 'failed';
  job.error     = 'All Gemini 3 models failed to return an image';
  job.updatedAt = Date.now();
  await saveJob(job);
  console.error(`[ImageWorker ${jobId}] All models failed`);
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

  const { jobId, parts } = req.body;
  if (!jobId || !parts) {
    return res.status(400).json({ error: 'Missing jobId or parts' });
  }

  try {
    await processJob(jobId, parts);
    return res.status(200).json({ ok: true, jobId });
  } catch (err: any) {
    console.error(`[ImageWorker] Unhandled error for ${jobId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
