// src/services/imageApiService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Servicio cliente universal para generación de imágenes asíncrona.
// Todos los módulos deben usar este servicio — nunca llamar a api/gemini/image
// directamente, nunca usar el modelo FAST (gemini-2.5-flash-image).
//
// Flujo:
//   1. POST /api/gemini/image { action: 'generateImageAsync', payload }
//      → 202 + jobId (respuesta inmediata)
//   2. Polling cada POLL_INTERVAL_MS hasta completado o timeout
//   3. Auto-retry silencioso hasta MAX_SILENT_RETRIES si el job falla
//
// Los módulos reciben onStatusChange para actualizar su propia UI.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL     = '/api/gemini/image';
const POLL_INTERVAL_MS   = 2000;   // 2 s entre polls
const MAX_POLL_ATTEMPTS  = 90;     // 90 × 2 s = 3 minutos máximo
const MAX_SILENT_RETRIES = 3;      // reintentos silenciosos antes de propagar error

export type ImageJobStatus = 'pending' | 'processing' | 'retrying' | 'completed' | 'failed';

export interface GenerateImageParams {
  prompt:           string;
  negative?:        string;
  referenceImages?: Array<{ data: string; mimeType: string }>;
  aspectRatio?:     '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  shotIndex?:       number;
  totalShots?:      number;
  module?:          string;   // trazabilidad en logs
  onStatusChange?:  (status: ImageJobStatus, image?: string, shotIndex?: number) => void;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function startJob(params: GenerateImageParams): Promise<{ jobId: string; shotIndex?: number }> {
  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generateImageAsync',
      payload: {
        prompt:          params.prompt,
        negative:        params.negative,
        referenceImages: params.referenceImages,
        aspectRatio:     params.aspectRatio || '3:4',
        shotIndex:       params.shotIndex,
        totalShots:      params.totalShots,
        module:          params.module,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to start image job: ${res.status} ${text}`);
  }

  return res.json();
}

async function pollJob(jobId: string): Promise<{
  status: ImageJobStatus;
  image?: string;
  error?: string;
  shotIndex?: number;
}> {
  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action:  'getJobStatus',
      payload: { jobId },
    }),
  });

  if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
  return res.json();
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Función principal ────────────────────────────────────────────────────────

async function generateImageOnce(params: GenerateImageParams): Promise<string> {
  const { jobId, shotIndex } = await startJob(params);

  params.onStatusChange?.('pending', undefined, shotIndex);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const job = await pollJob(jobId);
    params.onStatusChange?.(job.status as ImageJobStatus, job.image, shotIndex ?? job.shotIndex);

    if (job.status === 'completed' && job.image) return job.image;
    if (job.status === 'failed')   throw new Error(job.error || 'Image generation failed');
  }

  throw new Error(`Image generation timeout after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

// ─── API pública ──────────────────────────────────────────────────────────────

export const imageApiService = {

  /**
   * Genera una imagen de forma asíncrona con reintentos silenciosos.
   * El módulo llamante recibe actualizaciones de estado via onStatusChange.
   */
  async generateImage(params: GenerateImageParams): Promise<string> {
    let lastError: Error = new Error('Unknown error');

    for (let retry = 0; retry < MAX_SILENT_RETRIES; retry++) {
      try {
        if (retry > 0) {
          console.log(`[ImageAPI] Silent retry ${retry}/${MAX_SILENT_RETRIES - 1} for ${params.module || 'unknown'}`);
          params.onStatusChange?.('retrying', undefined, params.shotIndex);
          await sleep(1500); // pequeña pausa antes de reintentar
        }
        return await generateImageOnce(params);
      } catch (err: any) {
        lastError = err;
        console.warn(`[ImageAPI] Attempt ${retry + 1} failed: ${err.message}`);
      }
    }

    params.onStatusChange?.('failed', undefined, params.shotIndex);
    throw lastError;
  },

  /**
   * Genera múltiples imágenes en paralelo, cada una con su propio jobId y polling.
   * Ideal para batch (product shots, campaign, photodump).
   * Retorna las que se completaron; las fallidas quedan como null.
   */
  async generateBatch(
    jobs: GenerateImageParams[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<(string | null)[]> {
    let completed = 0;
    const total   = jobs.length;

    const results = await Promise.allSettled(
      jobs.map(async (params) => {
        const image = await imageApiService.generateImage(params);
        completed++;
        onProgress?.(completed, total);
        return image;
      })
    );

    return results.map(r => r.status === 'fulfilled' ? r.value : null);
  },
};

// ─── Helpers de extracción de imágenes (copiados de geminiService para no romper imports) ─

export function parseDataUrl(image: string): { mimeType: string; base64: string } | null {
  const trimmed = (image || '').trim();
  const match   = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

export function extractImageRef(
  img: string,
  label?: string,
): { data: string; mimeType: string } {
  const raw = (img || '').trim();
  if (!raw || raw === 'null' || raw === 'undefined') {
    throw new Error(`Invalid image reference (empty)${label ? `: ${label}` : ''}`);
  }
  const parsed = parseDataUrl(raw);
  if (parsed) {
    return { data: parsed.base64.replace(/\s+/g, ''), mimeType: parsed.mimeType };
  }
  const cleaned = (raw.includes(',') ? raw.split(',')[1] : raw).replace(/\s+/g, '');
  return { data: cleaned, mimeType: 'image/jpeg' };
}
