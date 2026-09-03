/**
 * modules/photodump/director/generic/genericClient.ts
 *
 * Cliente client-side del Director Creativo GENÉRICO — mismo patrón
 * start→poll que director/client.ts (runDirector, para el sistema
 * categorized/open_bank de outfit_night_out), portado y generalizado para
 * cualquier receta con RecipeDirectorContract propio (ver
 * GENERIC_DIRECTOR_CONTRACTS en api/gemini/content.ts). Reusa las mismas
 * acciones photodumpDirectorStart/photodumpDirectorStatus del servidor
 * (directorMode='generic'), no un endpoint nuevo.
 *
 * Deliberadamente un archivo propio, no una extensión de
 * director/client.ts — mismo principio de aislamiento que el resto del
 * proyecto: el director genérico no depende de tipos/funciones específicos
 * de night_out (DirectorPlan, OpenBankPlan), y night_out puede retirarse
 * sin arrastrar este archivo.
 */
import { getAuth } from 'firebase/auth';
import type { GenericPlan, GenericFinalPromptShot, GenericShotDecision, PlaceObservation } from './genericTypes';

export interface GenericDirectorReferenceImage {
  role: string;
  data: string;
  mimeType: string;
}

const CONTENT_ENDPOINT = '/api/gemini/content';
const POLL_INTERVAL_MS = 3000;

// Margen de espera del cliente escalado por cantidad de shots — mismo
// principio que maxPollAttemptsForLevel en director/client.ts (el trabajo
// real de "Decidir"+"Redactar" crece con la cantidad de shots), pero acá
// count es un número directo, no un nombre de nivel con tabla fija.
function maxPollAttemptsForCount(count: number): number {
  const totalWaitSeconds = Math.min(290, 120 + count * 25);
  return Math.ceil((totalWaitSeconds * 1000) / POLL_INTERVAL_MS);
}

type DirectorJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface GenericDirectorResponse {
  plan: GenericPlan;
  finalPrompts: GenericFinalPromptShot[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startGenericDirectorJob(
  brief: string,
  recipe: string,
  count: number,
  referenceImages: GenericDirectorReferenceImage[],
): Promise<string> {
  const res = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({
      action: 'photodumpDirectorStart',
      payload: { brief, recipe, referenceImages, directorMode: 'generic', count },
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

async function pollGenericDirectorJob(jobId: string): Promise<{
  status: DirectorJobStatus;
  plan?: GenericPlan;
  finalPrompts?: GenericFinalPromptShot[];
  error?: string;
}> {
  const res = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({ action: 'photodumpDirectorStatus', payload: { jobId } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Director poll error: ${res.status}`);
  }
  return res.json();
}

/**
 * Corre el Director Creativo genérico completo (filtro + decidir +
 * redactar) para un brief, receta y cantidad exacta de shots — lanza si
 * algo falla, el caller es responsable de capturar y caer a un fallback
 * seguro, nunca de propagar el error al usuario final.
 */
export async function runGenericDirector(
  brief: string,
  recipe: string,
  count: number,
  referenceImages: GenericDirectorReferenceImage[] = [],
): Promise<GenericDirectorResponse> {
  const jobId = await startGenericDirectorJob(brief, recipe, count, referenceImages);
  const maxAttempts = maxPollAttemptsForCount(count);

  let consecutivePollErrors = 0;
  const MAX_CONSECUTIVE_POLL_ERRORS = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    let job: Awaited<ReturnType<typeof pollGenericDirectorJob>>;
    try {
      job = await pollGenericDirectorJob(jobId);
      consecutivePollErrors = 0;
    } catch (pollErr) {
      consecutivePollErrors++;
      console.warn(`[GenericDirector] poll falló (intento ${consecutivePollErrors}/${MAX_CONSECUTIVE_POLL_ERRORS}), reintentando:`, pollErr);
      if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        throw pollErr instanceof Error ? pollErr : new Error('Generic director poll falló repetidamente.');
      }
      continue;
    }

    if (job.status === 'completed' && job.plan && job.finalPrompts) {
      return { plan: job.plan, finalPrompts: job.finalPrompts };
    }
    if (job.status === 'failed') {
      throw new Error(job.error || 'Generic director job failed');
    }
  }

  throw new Error('Generic director job timed out esperando el resultado.');
}

// ── Continuidad de lugar con imagen real ────────────────────────────────
// Mismo mecanismo que analyzeOpenBankVenue/redactOpenBankSingleShot en
// director/client.ts, generalizado por receta (el server resuelve el
// RecipeDirectorContract a partir de `recipe`).

async function extractImageParts(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  const directMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (directMatch) {
    return { mimeType: directMatch[1], data: directMatch[2] };
  }
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.warn(`[genericDirector] extractImageParts: fetch de la imagen ancla devolvió ${res.status} (${imageUrl})`);
      return null;
    }
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2] };
  } catch (err) {
    console.warn(`[genericDirector] extractImageParts: excepción al leer la imagen ancla (${imageUrl})`, err);
    return null;
  }
}

export async function analyzeGenericPlace(recipe: string, imageUrl: string): Promise<PlaceObservation | null> {
  const parts = await extractImageParts(imageUrl);
  if (!parts) return null;
  try {
    const res = await fetch(CONTENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body: JSON.stringify({ action: 'analyzeGenericPlace', payload: { ...parts, recipe } }),
    });
    if (!res.ok) {
      console.warn(`[genericDirector] analyzeGenericPlace: el endpoint devolvió ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (typeof data?.observedElements !== 'string') return null;
    return { observedElements: data.observedElements, isEnclosedSubSpace: !!data.isEnclosedSubSpace };
  } catch (err) {
    console.warn('[genericDirector] analyzeGenericPlace: excepción en la llamada', err);
    return null;
  }
}

export async function redactGenericSingleShot(
  recipe: string,
  brief: string,
  shot: GenericShotDecision,
  placeObservation: PlaceObservation,
  energy: 'elegante' | 'fiesta',
): Promise<string | null> {
  try {
    const res = await fetch(CONTENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body: JSON.stringify({
        action: 'redactGenericSingleShot',
        payload: { brief, shot, placeObservation, energy, recipe },
      }),
    });
    if (!res.ok) {
      console.warn(`[genericDirector] redactGenericSingleShot: el endpoint devolvió ${res.status}`);
      return null;
    }
    const data = await res.json();
    return typeof data?.finalPrompt === 'string' ? data.finalPrompt : null;
  } catch (err) {
    console.warn('[genericDirector] redactGenericSingleShot: excepción en la llamada', err);
    return null;
  }
}
