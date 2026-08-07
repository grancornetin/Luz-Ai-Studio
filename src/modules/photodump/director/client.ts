/**
 * modules/photodump/director/client.ts
 *
 * Cliente client-side del Director Creativo — llama a /api/photodump/director
 * (donde corren el filtro del banco, Decidir y Redactar) y devuelve el
 * resultado. Este es el ÚNICO archivo del director que se bundlea con la
 * app real (el resto de la lógica — bankFilter, hardRules, recipeContracts,
 * el banco compilado — vive del lado del endpoint, ver api/photodump/director.ts).
 */
import { getAuth } from 'firebase/auth';
import type { DirectorPlan, FinalPromptShot } from './types';

const DIRECTOR_ENDPOINT = '/api/photodump/director';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DirectorResponse {
  plan: DirectorPlan;
  finalPrompts: FinalPromptShot[];
}

/**
 * Corre el Director Creativo completo (filtro + decidir + redactar) para un
 * brief y receta dados. Lanza si algo falla — el caller (nightMoments.ts /
 * outfitNightOut/index.ts) es responsable de capturar y caer al sistema
 * estático, nunca de propagar el error al usuario final.
 */
export async function runDirector(brief: string, recipe: string, level: string, hasCompanion: boolean): Promise<DirectorResponse> {
  const res = await fetch(DIRECTOR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body: JSON.stringify({ brief, recipe, level, hasCompanion }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Director endpoint error: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Director call failed');
  return { plan: data.plan, finalPrompts: data.finalPrompts };
}
