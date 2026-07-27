import type {
  DirectorLabProject, DirectorLabRecipe, DirectorLabCase, DirectorReference,
  DirectorRun, DirectorEvaluation, DirectorLabStatus
} from './types';

const BASE_URL = 'http://localhost:3131/api/director-lab';

class DirectorLabApiError extends Error {
  stage?: string;
  cause?: string;
  suggestedAction?: string;
  constructor(payload: { stage?: string; cause?: string; suggestedAction?: string }, status: number) {
    super(payload.cause || `Error ${status} en Director Lab`);
    this.stage = payload.stage;
    this.cause = payload.cause;
    this.suggestedAction = payload.suggestedAction;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
    });
  } catch (err) {
    throw new Error(
      'No se pudo conectar con el servidor local de Director Lab en http://localhost:3131. ' +
      '¿Está corriendo "node server.js" dentro de modules/motor-de-imagenes-corregido-v2?'
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new DirectorLabApiError(body, res.status);
  return body as T;
}

export const directorLabClient = {
  getStatus: () => request<DirectorLabStatus>('/status'),

  listProjects: () => request<{ projects: DirectorLabProject[] }>('/projects'),
  createProject: (data: { name: string; description?: string }) =>
    request<DirectorLabProject>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  listRecipes: (projectId: string) => request<{ recipes: DirectorLabRecipe[] }>(`/recipes?projectId=${encodeURIComponent(projectId)}`),
  createRecipe: (data: { projectId: string; name: string }) =>
    request<DirectorLabRecipe>('/recipes', { method: 'POST', body: JSON.stringify(data) }),

  listCases: (recipeId: string) => request<{ cases: DirectorLabCase[] }>(`/cases?recipeId=${encodeURIComponent(recipeId)}`),
  createCase: (data: { projectId: string; recipeId: string; name: string; brief?: unknown }) =>
    request<DirectorLabCase>('/cases', { method: 'POST', body: JSON.stringify(data) }),
  getCase: (caseId: string) => request<DirectorLabCase>(`/cases/${encodeURIComponent(caseId)}`),

  listReferences: (caseId: string) => request<{ references: DirectorReference[] }>(`/references?caseId=${encodeURIComponent(caseId)}`),
  createReference: (data: { caseId: string; role: string; alias?: string; notes?: string; assetDataUrl?: string }) =>
    request<DirectorReference>('/references', { method: 'POST', body: JSON.stringify(data) }),

  runDirector: (input: Record<string, unknown>) =>
    request<DirectorRun>('/runs', { method: 'POST', body: JSON.stringify(input) }),
  getRun: (runId: string) => request<DirectorRun>(`/runs/${encodeURIComponent(runId)}`),

  uploadResult: (runId: string, data: { assetDataUrl: string; note?: string }) =>
    request(`/runs/${encodeURIComponent(runId)}/results`, { method: 'POST', body: JSON.stringify(data) }),

  submitEvaluation: (runId: string, data: Partial<DirectorEvaluation>) =>
    request<DirectorEvaluation>(`/runs/${encodeURIComponent(runId)}/evaluations`, { method: 'POST', body: JSON.stringify(data) }),

  compareRuns: (leftId: string, rightId: string) =>
    request<{ left: DirectorRun; right: DirectorRun }>(`/compare?left=${encodeURIComponent(leftId)}&right=${encodeURIComponent(rightId)}`),

  exportCaseUrl: (caseId: string) => `${BASE_URL}/export/${encodeURIComponent(caseId)}`,
  exportCaseMarkdownUrl: (caseId: string) => `${BASE_URL}/export/${encodeURIComponent(caseId)}/markdown`
};

export { DirectorLabApiError };
