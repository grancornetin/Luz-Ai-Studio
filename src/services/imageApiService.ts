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

import { getAuth } from 'firebase/auth';
import { generationHistoryService, MODULE_LABELS } from './generationHistoryService';
import { getCurrentUserPlan } from './userPlanStore';

const API_URL     = '/api/gemini/image';
const POLL_INTERVAL_MS      = 2000;  // 2 s entre polls
const MAX_POLL_ATTEMPTS     = 120;   // 120 × 2 s = 4 min — Gemini / Seedream
const MAX_POLL_ATTEMPTS_GPT = 210;   // 210 × 2 s = 7 min — GPT Image 2 (puede tardar hasta ~6 min)
const MAX_SILENT_RETRIES    = 2;     // el inicial + 1 retry para rate-limit
const RATE_LIMIT_BACKOFF_MS = [3000, 8000]; // 3s, 8s — backoff corto, el 429 es transiente

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
export function parseErrorCode(raw: unknown): AppError {
  // Extraer un string limpio de cualquier tipo de entrada
  let asString: string;
  if (typeof raw === 'string') {
    asString = raw;
  } else if (raw instanceof Error) {
    asString = raw.message;
  } else if (raw != null && typeof raw === 'object') {
    // Objeto estructurado: extraer code/message directamente sin JSON.stringify
    const obj = raw as Record<string, any>;
    const code = obj?.error?.code ?? obj?.code;
    const msg  = obj?.error?.message ?? obj?.message ?? '';
    if (code === 429 || String(code) === '429') {
      return { code: ErrorCode.RATE_LIMIT, message: 'Estamos preparando tus imágenes. Espera un momento y vuelve a intentar.' };
    }
    if (typeof msg === 'string' && msg) return parseErrorCode(msg);
    asString = typeof msg === 'string' ? msg : (String(code) || 'Error desconocido');
  } else {
    asString = '';
  }

  const lower = asString.toLowerCase();

  // Intentar extraer JSON si viene como string serializado
  try {
    const parsed = JSON.parse(asString);
    const code = parsed?.error?.code ?? parsed?.code;
    const msg  = parsed?.error?.message ?? parsed?.message ?? '';
    if (code === 429 || String(code) === '429') {
      return { code: ErrorCode.RATE_LIMIT, message: 'Estamos preparando tus imágenes. Espera un momento y vuelve a intentar.' };
    }
    if (typeof msg === 'string' && msg) return parseErrorCode(msg);
  } catch { /* no es JSON */ }

  if (lower.includes('concurrency_limit') || lower.includes('demasiadas generaciones activas')) {
    return { code: ErrorCode.RATE_LIMIT, message: 'Estamos preparando tus imágenes. Espera un momento y vuelve a intentar.' };
  }
  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('exhausted')) {
    return { code: ErrorCode.RATE_LIMIT, message: 'Estamos preparando tus imágenes. Espera un momento y vuelve a intentar.' };
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { code: ErrorCode.TIMEOUT, message: 'La generación tardó demasiado. Podés reintentar sin costo adicional.' };
  }
  if (lower.includes('no face') || lower.includes('face not detected') || lower.includes('no se detectó') || lower.includes('rostro no detectado') || lower.includes('face detection failed') || lower.includes('no human face')) {
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

  return { code: ErrorCode.UNKNOWN, message: asString || 'Ocurrió un error inesperado. Intenta de nuevo.' };
}

export type ModelId = 'gemini' | 'seedream' | 'gptimage';

export interface GenerateImageParams {
  prompt:           string;
  negative?:        string;
  referenceImages?: Array<{ data: string; mimeType: string; label?: string }>;
  aspectRatio?:     '1:1' | '3:4' | '4:3' | '4:5' | '9:16' | '16:9';
  shotIndex?:       number;
  totalShots?:      number;
  module?:          string;   // trazabilidad en logs
  moduleLabel?:     string;   // legible para mostrar en notificaciones
  modelId?:         ModelId;  // 'gemini' (default) | 'seedream' | 'gptimage'
  uid?:             string;   // uid del usuario autenticado (requerido en no-batch)
  sessionId?:       string;   // agrupa shots de un mismo set en la notificación
  metadata?:        Record<string, any>; // info libre para mostrar en el panel
  userPlan?:        string;   // plan del usuario — usado para prioridad y límite de concurrencia
  onStatusChange?:  (status: ImageJobStatus, image?: string, shotIndex?: number) => void;
}

/** Genera un sessionId único para un set de imágenes. Usar uno por set. */
export function newSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function startJob(params: GenerateImageParams): Promise<{ jobId: string; shotIndex?: number }> {
  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
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
        moduleLabel:     params.moduleLabel,
        modelId:         params.modelId || 'gemini',
        uid:             params.uid ?? getAuth().currentUser?.uid,
        sessionId:       params.sessionId,
        metadata:        params.metadata,
        userPlan:        params.userPlan ?? getCurrentUserPlan(),
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[ImageAPI] startJob HTTP ${res.status}:`, text.slice(0, 500));
    const appErr = parseErrorCode(`${res.status} ${text}`);
    const err = new Error(appErr.message) as any;
    err.code = appErr.code;
    err.raw = text;
    throw err;
  }

  return res.json();
}

async function pollJob(jobId: string): Promise<{
  status: ImageJobStatus;
  image?: string;
  error?: string;
  shotIndex?: number;
  refunded?: boolean;
}> {
  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({
      action:  'getJobStatus',
      payload: { jobId },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[ImageAPI] pollJob HTTP ${res.status}:`, text.slice(0, 500));
    throw new Error(`Poll failed: ${res.status}`);
  }
  return res.json();
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Convierte mensajes técnicos de la API en mensajes amigables para el usuario.
// Maneja tanto strings planos como JSON crudo con estructura { error: { code, message } }
function friendlyApiError(raw: unknown): string {
  const appErr = parseErrorCode(raw);
  return appErr.message;
}

// ─── Función principal ────────────────────────────────────────────────────────

// Intentos de polling donde un 404 se trata como "job aún inicializando"
// (cubre race conditions entre Redis write y replicación o delay de QStash)
const MAX_404_GRACE = 8;

async function generateImageOnce(params: GenerateImageParams): Promise<string> {
  const { jobId, shotIndex } = await startJob(params);

  params.onStatusChange?.('pending', undefined, shotIndex);

  let notFoundCount = 0;
  const maxAttempts = params.modelId === 'gptimage' ? MAX_POLL_ATTEMPTS_GPT : MAX_POLL_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    let job: Awaited<ReturnType<typeof pollJob>>;
    try {
      job = await pollJob(jobId);
    } catch (pollErr: any) {
      // 404 puede ser transitorio: job aún no visible en Redis o replicación pendiente
      if (pollErr.message?.includes('404') && notFoundCount < MAX_404_GRACE) {
        notFoundCount++;
        console.warn(`[ImageAPI] Poll 404 (${notFoundCount}/${MAX_404_GRACE}) for ${jobId}, retrying...`);
        continue;
      }
      throw pollErr;
    }

    notFoundCount = 0; // reset si el job ya responde
    params.onStatusChange?.(job.status as ImageJobStatus, job.image, shotIndex ?? job.shotIndex);

    if (job.status === 'completed' && job.image) return job.image;
    if (job.status === 'failed') {
      const appErr = parseErrorCode(job.error ?? 'Image generation failed');
      const err = new Error(appErr.message) as any;
      err.code = appErr.code;
      throw err;
    }
  }

  const timeoutErr = new Error(`La generación tardó demasiado. Podés reintentar sin costo adicional.`) as any;
  timeoutErr.code = ErrorCode.TIMEOUT;
  throw timeoutErr;
}

function resolveHistoryModule(module?: string): string {
  if (!module) return 'unknown';
  if (module === 'product' || module.includes('product')) return 'catalog';
  if (module.includes('cloneImage') || module.includes('scene')) return 'scene_clone';
  if (module.includes('avatarService') || module.includes('model_dna')) return 'model_dna';
  if (module.includes('ugc') || module.includes('content_studio')) return 'content_studio_pro';
  return module;
}

function historyReferencesFromParams(params: GenerateImageParams) {
  return (params.referenceImages || []).map((ref, index) => ({
    label: ref.label || `Referencia ${index + 1}`,
    mimeType: ref.mimeType,
    role: ref.label || `REF${index}`,
    imageUrl: `data:${ref.mimeType || 'image/jpeg'};base64,${ref.data}`,
  }));
}

function saveGeneratedImageToHistory(image: string, params: GenerateImageParams): void {
  const module = resolveHistoryModule(params.module);
  generationHistoryService.save({
    imageUrl: image,
    module,
    moduleLabel: params.moduleLabel || MODULE_LABELS[module] || params.module || 'Generacion',
    creditsUsed: 0,
    promptText: params.prompt,
    source: 'client',
    config: {
      aspectRatio: params.aspectRatio || '3:4',
      modelId: params.modelId || 'gemini',
      negative: params.negative,
      shotIndex: params.shotIndex,
      totalShots: params.totalShots,
      sessionId: params.sessionId,
    },
    metadata: params.metadata,
    references: historyReferencesFromParams(params),
  }).catch((err) => {
    console.warn('[History] Auto-save failed:', err?.message || err);
  });
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
        const image = await generateImageOnce(params);
        saveGeneratedImageToHistory(image, params);
        return image;
      } catch (err: any) {
        lastError = err;
        console.warn(`[ImageAPI] Attempt ${retry + 1} failed: ${err.message}`);
        // Solo hace backoff y reintenta en rate-limit; cualquier otro error falla de inmediato
        if (err.code !== ErrorCode.RATE_LIMIT) break;
        if (retry < MAX_SILENT_RETRIES - 1) {
          const delay = RATE_LIMIT_BACKOFF_MS[retry] ?? 5000;
          console.info(`[ImageAPI] Rate limit hit — waiting ${delay / 1000}s before retry ${retry + 2}...`);
          await sleep(delay);
        }
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
