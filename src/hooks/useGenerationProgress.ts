import { useState, useEffect, useCallback, useRef } from 'react';
import type { CompletedShot, ProgressStep } from '../components/shared/GenerationProgress';

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hora

interface JobState {
  steps: ProgressStep[];
  currentStepIndex: number;
  completedShots: CompletedShot[];
  totalShots: number;
  startedAt: number;
  done: boolean;
}

function loadJob(jobId: string): JobState | null {
  try {
    const raw = localStorage.getItem(`job_${jobId}`);
    if (!raw) return null;
    const parsed: JobState & { startedAt: number } = JSON.parse(raw);
    if (Date.now() - parsed.startedAt > JOB_TTL_MS) {
      localStorage.removeItem(`job_${jobId}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveJob(jobId: string, state: JobState) {
  try {
    localStorage.setItem(`job_${jobId}`, JSON.stringify(state));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function useGenerationProgress(jobId: string, steps: ProgressStep[], totalShots: number) {
  const startedAt = useRef(Date.now());

  const initial: JobState = loadJob(jobId) ?? {
    steps,
    currentStepIndex: 0,
    completedShots: [],
    totalShots,
    startedAt: startedAt.current,
    done: false,
  };

  const [state, setState] = useState<JobState>(initial);

  // ETA dinámico: tiempo transcurrido / pasos completados * pasos restantes
  const [etaSeconds, setEtaSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.done) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const completedSteps = state.currentStepIndex;
      if (completedSteps > 0) {
        const secPerStep = elapsed / completedSteps;
        const remaining = (state.steps.length - completedSteps) * secPerStep;
        setEtaSeconds(Math.max(0, Math.round(remaining)));
      } else {
        // estimación inicial lineal: 20s por paso
        setEtaSeconds(Math.max(0, state.steps.length * 20 - Math.round(elapsed)));
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.currentStepIndex, state.done, state.steps.length]);

  const advance = useCallback((newStepIndex: number) => {
    setState(prev => {
      const next = { ...prev, currentStepIndex: newStepIndex };
      saveJob(jobId, next);
      return next;
    });
  }, [jobId]);

  const addShot = useCallback((shot: CompletedShot) => {
    setState(prev => {
      const next = { ...prev, completedShots: [...prev.completedShots, shot] };
      saveJob(jobId, next);
      return next;
    });
  }, [jobId]);

  const finish = useCallback(() => {
    setState(prev => {
      const next = { ...prev, done: true, currentStepIndex: prev.steps.length - 1 };
      saveJob(jobId, next);
      return next;
    });
  }, [jobId]);

  const clear = useCallback(() => {
    localStorage.removeItem(`job_${jobId}`);
  }, [jobId]);

  return {
    currentStepIndex: state.currentStepIndex,
    completedShots: state.completedShots,
    done: state.done,
    etaSeconds,
    advance,
    addShot,
    finish,
    clear,
  };
}
