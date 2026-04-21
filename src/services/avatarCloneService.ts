// services/avatarCloneService.ts
const API_BASE = '/api/avatar/clone';

export interface StartCloneParams {
  mode: 'image' | 'manual';
  name: string;
  files?: string[];                // requerido si mode = 'image'
  identityPrompt?: string;         // requerido si mode = 'manual'
  negativePrompt?: string;         // requerido si mode = 'manual'
  gender: 'hombre' | 'mujer';
  personality?: string;
  expression?: string;
}

export async function startClone(params: StartCloneParams): Promise<{ jobId: string }> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'startClone', payload: params }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return { jobId: data.jobId };
}

export async function getCloneStatus(jobId: string): Promise<{
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string[];
  error?: string;
  updatedAt: number;
}> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getJobStatus', payload: { jobId } }),
  });
  if (!res.ok) throw new Error(`Failed to get status: ${res.status}`);
  return res.json();
}

export async function waitForCloneComplete(
  jobId: string,
  onProgress?: (status: string, result?: string[]) => void,
  maxAttempts = 90,
  intervalMs = 2000
): Promise<string[]> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getCloneStatus(jobId);
    onProgress?.(status.status, status.result);
    if (status.status === 'completed' && status.result) return status.result;
    if (status.status === 'failed') throw new Error(status.error || 'Clone failed');
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timeout waiting for clone completion');
}