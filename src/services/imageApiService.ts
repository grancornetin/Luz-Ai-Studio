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
const MAX_SILENT_RETRIES = 1;      // 1 intento total (sin retry silencioso) — evita 429 acumulado

export type ImageJobStatus = 'pending' | 'processing' | 'retrying' | 'completed' | 'failed';

// ─── Códigos de error estandarizados ─────────────────────────────────────────

export enum ErrorCode {
  NO_CREDITS       = 'NO_CREDITS',
  INVALID_IMAGE    = 'INVALID_IMAGE',
  FACE_NOT_DETECTED = 'FACE_NOT_DETECTED',
  CONTENT_BLOCKED  = 'CONTENT_BLOCKED',
  TIMEOUT          = 'TIMEOUT',
  SERVER_ERROR     = 'SERVER_ERROR',
  RATE_LIMIT       = 'RATE_LIMIT',
  UNKNOWN          = 'UNKNOWN',
}

/** Errores imputables al sistema (se reembolsan créditos) */
export const REFUNDABLE_ERRORS = new Set<ErrorCode>([
  ErrorCode.SERVER_ERROR,
  ErrorCode.TIMEOUT,
  ErrorCode.RATE_LIMIT,
]);

export interface AppError {
  message: string;
  code: ErrorCode;
}

/** Convierte un mensaje de error crudo en un AppError con código clasificado */
export function parseErrorCode(raw: string): AppError {
  const lower = (raw || '').toLowerCase();

  // Intentar extraer JSON de la API
  try {
    const parsed = JSON.parse(raw);
    const code = parsed?.error?.code ?? parsed?.code;
    const msg  = parsed?.error?.message ?? parsed?.message ?? '';
    if (code === 429 || String(code) === '429') {
      return { code: ErrorCode.RATE_LIMIT, message: 'Demasiadas solicitudes simultáneas. Espera unos segundos e intenta de nuevo.' };
    }
    if (msg) return parseErrorCode(msg); // recursión con el mensaje extraído
  } catch { /* no es JSON */ }

  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('exhausted')) {
    return { code: ErrorCode.RATE_LIMIT, message: 'Demasiadas solicitudes simultáneas. Espera unos segundos e intenta de nuevo.' };
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { code: ErrorCode.TIMEOUT, message: 'La generación tardó demasiado. Puedes reintentar — tus créditos serán reembolsados.' };
  }
  if (lower.includes('face') || lower.includes('rostro') || lower.includes('no face') || lower.includes('face not detected')) {
    return { code: ErrorCode.FACE_NOT_DETECTED, message: 'No se detectó un rostro claro en la foto. Prueba con otra imagen donde el rostro sea visible de frente.' };
  }
  if (lower.includes('content') && (lower.includes('filter') || lower.includes('block') || lower.includes('policy') || lower.includes('safety'))) {
    return { code: ErrorCode.CONTENT_BLOCKED, message: 'El contenido fue bloqueado por las políticas de seguridad de la IA. Ajusta el prompt o la imagen de referencia.' };
  }
  if (lower.includes('invalid image') || lower.includes('unsupported') || lower.includes('corrupt') || lower.includes('bad image')) {
    return { code: ErrorCode.INVALID_IMAGE, message: 'La imagen no es válida o no puede procesarse. Sube otra imagen en formato JPG o PNG.' };
  }
  if (lower.includes('credit') || lower.includes('crédito') || lower.includes('insufficient')) {
    return { code: ErrorCode.NO_CREDITS, message: 'No tienes suficientes créditos para esta generación.' };
  }
  if (lower.includes('500') || lower.includes('internal server') || lower.includes('server error') || lower.includes('failed to start')) {
    return { code: ErrorCode.SERVER_ERROR, message: 'Error interno del servidor. Tus créditos serán reembolsados automáticamente. Intenta de nuevo.' };
  }

  return { code: ErrorCode.UNKNOWN, message: raw || 'Ocurrió un error inesperado. Intenta de nuevo.' };
}

export type ModelId = 'gemini' | 'seedream';

export interface GenerateImageParams {
  prompt:           string;
  negative?:        string;
  referenceImages?: Array<{ data: string; mimeType: string }>;
  aspectRatio?:     '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  shotIndex?:       number;
  totalShots?:      number;
  module?:          string;   // trazabilidad en logs
  modelId?:         ModelId;  // 'gemini' (default) | 'seedream'
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
        modelId:         params.modelId || 'gemini',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const appErr = parseErrorCode(`${res.status} ${text}`);
    const err = new Error(appErr.message) as any;
    err.code = appErr.code;
    throw err;
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

// Convierte mensajes técnicos de la API en mensajes amigables para el usuario.
// Maneja tanto strings planos como JSON crudo con estructura { error: { code, message } }
function friendlyApiError(raw: string): string {
  // Intentar extraer el mensaje real si viene como JSON
  let msg = (raw || '').toLowerCase();
  try {
    const parsed = JSON.parse(raw);
    const code = parsed?.error?.code ?? parsed?.code;
    const message = parsed?.error?.message ?? parsed?.message ?? '';
    if (code === 429 || String(code) === '429') {
      return 'Espera un momento — demasiadas solicitudes. Intenta de nuevo en unos segundos.';
    }
    msg = message.toLowerCase();
  } catch { /* no es JSON, usar el string raw */ }

  if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('resource has been exhausted') || msg.includes('exhausted')) {
    return 'Espera un momento — demasiadas solicitudes. Intenta de nuevo en unos segundos.';
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'La generación tardó demasiado. Intenta de nuevo.';
  }
  if (msg.includes('content') && (msg.includes('filter') || msg.includes('block') || msg.includes('policy'))) {
    return 'El contenido fue bloqueado por las políticas de la IA. Ajusta el prompt e intenta de nuevo.';
  }
  return raw;
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
    if (job.status === 'failed') {
      const appErr = parseErrorCode(job.error || 'Image generation failed');
      const err = new Error(appErr.message) as any;
      err.code = appErr.code;
      throw err;
    }
  }

  const timeoutErr = new Error(`La generación tardó demasiado. Tus créditos serán reembolsados automáticamente.`) as any;
  timeoutErr.code = ErrorCode.TIMEOUT;
  throw timeoutErr;
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
