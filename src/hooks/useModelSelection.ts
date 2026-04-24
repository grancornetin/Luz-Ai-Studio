// src/hooks/useModelSelection.ts
// Hook que consume el ModelSelectionContext global.
// Todos los módulos comparten el mismo estado — no hay desincronización.

import { useContext } from 'react';
import { ModelSelectionContext } from '../contexts/ModelSelectionContext';

export function useModelSelection() {
  return useContext(ModelSelectionContext);
}
