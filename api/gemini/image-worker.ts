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
import { reportShotResult, appendToHistory } from '../_notifications.js';

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
  // Notificaciones Nivel 3 — vienen del orchestrator (image.ts)
  uid?: string;
  sessionId?: string;
  moduleLabel?: string;
  metadata?: Record<string, any>;
  refunded?: boolean;
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

// ─── Notificación + historial al terminar el job ──────────────────────────────
// Persiste el resultado a Firestore (notificación) y a Redis (historial).
// Si falla, el reembolso lo hace reportShotResult dentro de la transacción.
async function persistJobOutcome(job: ImageJob, success: boolean): Promise<void> {
  if (!job.uid || !job.sessionId || job.totalShots == null || job.shotIndex == null) {
    // Backwards compatibility: jobs viejos sin uid/sessionId — no notificamos
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

    // Marcar el job como reembolsado para que el cliente no lo vuelva a hacer
    if (!success) {
      job.refunded = true;
      await saveJob(job);
    }

    // Si la imagen salió bien, también la guardamos al historial (malla de seguridad).
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
    console.error(`[ImageWorker ${job.id}] persistJobOutcome failed:`, err.message);
  }
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

  // Timeout de 50s — deja 10s de margen antes del límite de 60s de Vercel
  // para que el job quede en 'failed' en Redis (no en 'processing' huérfano)
  const abort = new AbortController();
  const abortTimer = setTimeout(() => abort.abort(), 50_000);

  try {
    console.log(`[ImageWorker ${jobId}] Using ${MODEL}`);
    const response = await ai.models.generateContent({
      model:    MODEL,
      contents: [{ role: 'user', parts }],
      config:   { responseModalities: ['TEXT', 'IMAGE'] },
      abortSignal: abort.signal,
    } as any);

    clearTimeout(abortTimer);
    const candidates = response.candidates || [];

    for (const candidate of candidates) {
      for (const part of (candidate.content?.parts || [])) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          job.status    = 'completed';
          job.result    = `data:${mime};base64,${part.inlineData.data}`;
          job.updatedAt = Date.now();
          await saveJob(job);
          console.log(`[ImageWorker ${jobId}] Completed`);
          await persistJobOutcome(job, true);
          return;
        }
      }
    }

    // Sin imagen — inspeccionar por qué (filtro de contenido vs error real)
    const firstCandidate = candidates[0];
    const finishReason   = firstCandidate?.finishReason || 'UNKNOWN';
    const safetyIssues   = firstCandidate?.safetyRatings
      ?.filter((r: any) => r.blocked || r.probability === 'HIGH' || r.probability === 'MEDIUM')
      ?.map((r: any) => r.category)
      ?? [];

    if (finishReason === 'SAFETY' || safetyIssues.length > 0) {
      throw new Error(
        `Prompt bloqueado por filtros de contenido de Google` +
        (safetyIssues.length > 0 ? ` (${safetyIssues.join(', ')})` : '') +
        `. Intenta suavizar términos como "seductive", "voluptuous" o similares.`
      );
    }

    throw new Error(`El modelo no generó imagen (finishReason: ${finishReason}). Reformula el prompt.`);
  } catch (err: any) {
    clearTimeout(abortTimer);
    // Timeout propio (AbortError) — marcar failed para que el cliente no espere 4 min
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      job.error = 'El modelo tardó demasiado. Reintentá en unos segundos.';
    }
    // Marcar gemini como DOWN si es rate limit de Vertex
    else if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429')) {
      await redis.set('circuit:gemini', 'down', { ex: 60 * 60 * 2 });
      console.warn(`[ImageWorker] Rate limit Vertex — circuit gemini abierto por 2h`);
      job.error = err.message || 'Flash model failed';
    } else {
      job.error = err.message || 'Flash model failed';
    }
    job.status    = 'failed';
    job.updatedAt = Date.now();
    await saveJob(job);
    console.error(`[ImageWorker ${jobId}] Failed: ${job.error}`);
    await persistJobOutcome(job, false);
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
