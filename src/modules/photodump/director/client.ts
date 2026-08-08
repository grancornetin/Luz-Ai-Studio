/**
 * modules/photodump/director/client.ts
 *
 * Cliente client-side del Director Creativo — llama a /api/gemini/content
 * (acciones photodumpDirectorStart/photodumpDirectorStatus, fusionadas ahí en
 * vez de un endpoint propio por el límite de 12 funciones serverless del plan
 * Hobby de Vercel) y devuelve el resultado. Este es el ÚNICO archivo del
 * director que se bundlea con la app real — el resto de la lógica
 * (bankFilter, hardRules, recipeContracts, el banco compilado) vive del lado
 * del endpoint, ver la sección "PHOTODUMP DIRECTOR CREATIVO" en
 * api/gemini/content.ts.
 *
 * BUG REAL corregido: la versión anterior llamaba a una acción síncrona
 * ('photodumpDirector') que hace 2 llamadas secuenciales a Gemini (Decidir +
 * Redactar) dentro de una sola respuesta HTTP — confirmado en producción que
 * eso superaba el tiempo que una función serverless/el propio navegador
 * pueden sostener de forma confiable (504 real en logs). Ahora usa el mismo
 * patrón start→poll que ya usa imageApiService.ts para generación de
 * imágenes: encolar el trabajo (responde al instante) y consultar el estado
 * cada pocos segundos hasta que el resultado esté listo.
 */
import { getAuth } from 'firebase/auth';
import type { DirectorPlan, FinalPromptShot } from './types';

const CONTENT_ENDPOINT = '/api/gemini/content';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // ~2 minutos de margen total

type DirectorJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DirectorResponse {
  plan: DirectorPlan;
  finalPrompts: FinalPromptShot[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startDirectorJob(brief: string, recipe: string, level: string, hasCompanion: boolean): Promise<string> {
  const res = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({
      action: 'photodumpDirectorStart',
      payload: { brief, recipe, level, hasCompanion },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Director endpoint error: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success || !data.jobId) throw new Error(data.error || 'Director call failed to start');
  return data.jobId;
}

async function pollDirectorJob(jobId: string): Promise<{
  status: DirectorJobStatus;
  plan?: DirectorPlan;
  finalPrompts?: FinalPromptShot[];
  error?: string;
}> {
  const res = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({
      action: 'photodumpDirectorStatus',
      payload: { jobId },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Director poll error: ${res.status}`);
  }
  return res.json();
}

/**
 * Corre el Director Creativo completo (filtro + decidir + redactar) para un
 * brief y receta dados. Lanza si algo falla — el caller (nightMoments.ts /
 * outfitNightOut/index.ts) es responsable de capturar y caer al sistema
 * estático, nunca de propagar el error al usuario final.
 */
export async function runDirector(brief: string, recipe: string, level: string, hasCompanion: boolean): Promise<DirectorResponse> {
  const jobId = await startDirectorJob(brief, recipe, level, hasCompanion);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const job = await pollDirectorJob(jobId);

    if (job.status === 'completed' && job.plan && job.finalPrompts) {
      return { plan: job.plan, finalPrompts: job.finalPrompts };
    }
    if (job.status === 'failed') {
      throw new Error(job.error || 'Director job failed');
    }
    // pending/processing: seguir esperando
  }

  throw new Error('Director job timed out esperando el resultado.');
}
