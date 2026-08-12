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
import type { DirectorPlan, FinalPromptShot, DirectorReferenceImage } from './types';
import type { OpenBankPlan, OpenBankFinalPromptShot } from './openBank/openBankTypes';

export type { DirectorReferenceImage };

const CONTENT_ENDPOINT = '/api/gemini/content';
const POLL_INTERVAL_MS = 3000;

/**
 * BUG REAL corregido: MAX_POLL_ATTEMPTS era un valor fijo (40 × 3s = 120s),
 * exactamente IGUAL al maxDuration del servidor (120s, ver vercel.json) — el
 * cliente se rendía de esperar justo cuando el servidor recién tenía margen
 * para terminar. Confirmado en producción con un set de 7 shots: "Director
 * job timed out esperando el resultado" mientras el trabajo real seguía
 * corriendo del lado del servidor. El trabajo escala con la cantidad de
 * shots (más candidatos considerados en "Decidir", más prompts completos
 * que redactar en "Redactar" — la respuesta de 7 shots es notablemente más
 * larga que la de 3), así que el margen de espera del cliente también debe
 * escalar por nivel en vez de ser un techo fijo.
 *
 * BUG REAL corregido (2): confirmado en logs reales de producción que un
 * 429 de cuota compartida (proyecto+modelo+región, no exclusivo de esta
 * sesión) puede golpear la llamada "Redactar" y el reintento con backoff no
 * siempre alcanza a completarse dentro de la ventana anterior — el cliente
 * abandonaba el polling minutos antes de que el servidor pudiera terminar.
 * maxDuration del servidor subió a 300s (vercel.json) y el backoff de
 * generateContentWithRetry ahora puede tardar hasta ~80s por llamada en el
 * peor caso (4 reintentos, 5s/10s/20s/40s+jitter) — el margen del cliente
 * debe cubrir ESE peor caso, no solo el tiempo feliz sin reintentos.
 */
function maxPollAttemptsForLevel(level: string): number {
  const totalWaitSeconds: Record<string, number> = {
    corto: 180,      // 3 shots
    completo: 240,   // 5 shots
    extendido: 290,  // 7 shots — cerca del maxDuration real del servidor (300s)
  };
  const seconds = totalWaitSeconds[level] ?? 240;
  return Math.ceil((seconds * 1000) / POLL_INTERVAL_MS);
}

type DirectorJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Unión honesta: modo 'categorized' devuelve DirectorPlan/FinalPromptShot
// (shotId de un enum fijo), modo 'open_bank' devuelve OpenBankPlan/
// OpenBankFinalPromptShot (vehicleLabel libre) — el caller debe chequear
// directorMode antes de leer campos específicos de una u otra forma (ver
// tryDirector en outfitNightOut/index.ts, que corta el flujo antes de leer
// shotId cuando el modo es open_bank).
export interface DirectorResponse {
  plan: DirectorPlan | OpenBankPlan;
  finalPrompts: (FinalPromptShot | OpenBankFinalPromptShot)[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startDirectorJob(
  brief: string,
  recipe: string,
  level: string,
  hasCompanion: boolean,
  referenceImages: DirectorReferenceImage[],
  directorMode: 'categorized' | 'open_bank',
): Promise<string> {
  const res = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({
      action: 'photodumpDirectorStart',
      payload: { brief, recipe, level, hasCompanion, referenceImages, directorMode },
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
 *
 * referenceImages: identidad/cuerpo/outfit/escena/acompañante reales del
 * usuario (ya comprimidas y en base64, mismo formato que prepareRefs en
 * recipes/shared.ts) — pedido real del usuario tras ver al director heredar
 * una pose "mano en el bolsillo" de un candidato del banco sobre un outfit
 * real (falda) sin bolsillos visibles. Sin ver la imagen real, el director
 * no tiene forma de validar que una pose transferida sea físicamente posible
 * con el outfit/cuerpo reales — solo compara texto contra texto.
 */
export async function runDirector(
  brief: string,
  recipe: string,
  level: string,
  hasCompanion: boolean,
  referenceImages: DirectorReferenceImage[] = [],
  // Toggle discreto de la UI de Photodump — bypass aislado y reversible
  // (ver plan de sesión). Default 'categorized': cualquier caller que no lo
  // pase corre exactamente el pipeline actual, sin cambios.
  directorMode: 'categorized' | 'open_bank' = 'categorized',
): Promise<DirectorResponse> {
  const jobId = await startDirectorJob(brief, recipe, level, hasCompanion, referenceImages, directorMode);
  const maxAttempts = maxPollAttemptsForLevel(level);

  // BUG REAL corregido: un solo poll que devolviera un 500 transitorio
  // (pico de carga, error momentáneo de Redis, lo que sea — el trabajo del
  // director en el servidor sigue corriendo bien, el problema es SOLO en
  // leer su estado) abortaba TODO el intento del director de inmediato, en
  // vez de simplemente reintentar ese poll puntual y seguir esperando. Con
  // ~90 polls en una sesión larga (nivel extendido), la probabilidad de que
  // 1 solo poll falle por una causa transitoria no es despreciable — no
  // debería tirar abajo un trabajo que legítimamente sigue en curso.
  // Máximo 5 fallos de POLL consecutivos antes de rendirse (no cuenta contra
  // maxAttempts, que es para "sigue procesando", no para "no pude ni
  // preguntar").
  let consecutivePollErrors = 0;
  const MAX_CONSECUTIVE_POLL_ERRORS = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    let job: Awaited<ReturnType<typeof pollDirectorJob>>;
    try {
      job = await pollDirectorJob(jobId);
      consecutivePollErrors = 0;
    } catch (pollErr) {
      consecutivePollErrors++;
      console.warn(`[Director] poll falló (intento ${consecutivePollErrors}/${MAX_CONSECUTIVE_POLL_ERRORS}), reintentando:`, pollErr);
      if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        throw pollErr instanceof Error ? pollErr : new Error('Director poll falló repetidamente.');
      }
      continue;
    }

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
