// src/contexts/ModelSelectionContext.tsx
// Fuente única de verdad para el modelo de generación activo.
// Un solo estado compartido por toda la app — sin posibilidad de desincronización.

import React, { createContext, useState, useCallback } from 'react';
import type { ModelId } from '../services/imageApiService';

const LS_KEY = 'luz_model_preference';

function readStored(): ModelId {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === 'gemini' || v === 'seedream') return v;
  } catch { /* ignore */ }
  return 'gemini'; // default siempre Gemini
}

interface ModelSelectionContextType {
  modelId:    ModelId;
  setModelId: (m: ModelId) => void;
}

export const ModelSelectionContext = createContext<ModelSelectionContextType>({
  modelId:    'gemini',
  setModelId: () => {},
});

export const ModelSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modelId, setModelIdState] = useState<ModelId>(readStored);

  const setModelId = useCallback((m: ModelId) => {
    setModelIdState(m);
    try { localStorage.setItem(LS_KEY, m); } catch { /* ignore */ }
  }, []);

  return (
    <ModelSelectionContext.Provider value={{ modelId, setModelId }}>
      {children}
    </ModelSelectionContext.Provider>
  );
};
