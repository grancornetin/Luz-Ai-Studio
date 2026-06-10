import type { GrowthStrategicPlan } from '../../growthPlannerTypes';
import type { GenerationSessionStatus, VisiblePlannerOutput } from './types';

const SESSION_KEY = 'luz_growth_planner_generation_session_v2_4';
const READY_KEY = 'luz_growth_planner_last_ready_v2_4';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface StoredGenerationSession {
  id: string;
  status: GenerationSessionStatus;
  startedAt: number;
  updatedAt: number;
}

export interface StoredReadyPlanner {
  savedAt: number;
  plan: GrowthStrategicPlan;
  visiblePlanOutput: VisiblePlannerOutput;
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a recovery convenience. Generation must not fail when it is unavailable.
  }
}

export function startGenerationSession(): StoredGenerationSession {
  const now = Date.now();
  const session = { id: `growth-${now}`, status: 'started' as const, startedAt: now, updatedAt: now };
  writeJson(SESSION_KEY, session);
  return session;
}

export function updateGenerationSession(status: GenerationSessionStatus): void {
  const session = readJson<StoredGenerationSession>(SESSION_KEY);
  if (!session || session.status === 'ready') return;
  writeJson(SESSION_KEY, { ...session, status, updatedAt: Date.now() });
}

export function markGenerationSessionReady(plan: GrowthStrategicPlan, visiblePlanOutput: VisiblePlannerOutput): void {
  const now = Date.now();
  const session = readJson<StoredGenerationSession>(SESSION_KEY);
  writeJson(SESSION_KEY, session
    ? { ...session, status: 'ready', updatedAt: now }
    : { id: `growth-${now}`, status: 'ready', startedAt: now, updatedAt: now });
  writeJson(READY_KEY, { savedAt: Date.now(), plan, visiblePlanOutput } satisfies StoredReadyPlanner);
}

export function loadRecentReadyPlanner(): StoredReadyPlanner | null {
  const ready = readJson<StoredReadyPlanner>(READY_KEY);
  if (!ready || Date.now() - ready.savedAt > MAX_AGE_MS) return null;
  return ready;
}

export function loadInterruptedGenerationSession(): StoredGenerationSession | null {
  const session = readJson<StoredGenerationSession>(SESSION_KEY);
  if (!session || session.status === 'ready' || Date.now() - session.updatedAt > MAX_AGE_MS) return null;
  return session;
}

export function clearGenerationSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
