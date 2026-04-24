// src/hooks/useModelSelection.ts
// Gestiona la selección de modelo de generación de imágenes.
// Persiste en localStorage para mantener la preferencia entre sesiones.

import { useState, useCallback } from 'react';
import type { ModelId } from '../services/imageApiService';

const LS_KEY = 'luz_model_preference';

function readStored(): ModelId {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === 'gemini' || v === 'seedream') return v;
  } catch { /* ignore */ }
  return 'gemini';
}

export function useModelSelection() {
  const [modelId, setModelIdState] = useState<ModelId>(readStored);

  const setModelId = useCallback((m: ModelId) => {
    setModelIdState(m);
    try { localStorage.setItem(LS_KEY, m); } catch { /* ignore */ }
  }, []);

  return { modelId, setModelId };
}
