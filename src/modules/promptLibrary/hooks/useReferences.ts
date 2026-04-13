import { useState, useCallback, useEffect } from 'react';
import { ReferenceSlot, ReferencePriority } from '../types/promptTypes';
import { referenceService } from '../services/referenceService';

const SESSION_KEY = 'prompt_library_studio_reference_slots';

const loadInitialSlots = (): ReferenceSlot[] => {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error loading reference slots from sessionStorage:', error);
  }

  return referenceService.createInitialSlots();
};

export const useReferences = () => {
  const [slots, setSlots] = useState<ReferenceSlot[]>(loadInitialSlots);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(slots));
    } catch (error) {
      console.error('Error saving reference slots to sessionStorage:', error);
    }
  }, [slots]);

  /**
   * Subir referencia
   */
  const uploadReference = useCallback(async (id: string, file: File) => {
    try {
      const dataUrl = await referenceService.processFile(file);

      setSlots(prev =>
        prev.map(slot =>
          slot.id === id
            ? { ...slot, imageUrl: dataUrl }
            : slot
        )
      );
    } catch (error) {
      console.error('Error uploading reference:', error);
    }
  }, []);

  /**
   * Eliminar referencia
   */
  const removeReference = useCallback((id: string) => {
    setSlots(prev =>
      prev.map(slot =>
        slot.id === id
          ? { ...slot, imageUrl: null }
          : slot
      )
    );
  }, []);

  /**
   * Cambiar prioridad de referencia
   */
  const setPriority = useCallback((id: string, priority: ReferencePriority) => {
    setSlots(prev =>
      prev.map(slot =>
        slot.id === id
          ? { ...slot, priority }
          : slot
      )
    );
  }, []);

  /**
   * Lock / unlock de identidad
   */
  const toggleLock = useCallback((id: string) => {
    setSlots(prev =>
      prev.map(slot =>
        slot.id === id
          ? { ...slot, locked: !slot.locked }
          : slot
      )
    );
  }, []);

  /**
   * Obtener solo imágenes de referencia activas
   */
  const getReferenceImages = useCallback(() => {
    return slots
      .map(slot => slot.imageUrl)
      .filter((img): img is string => Boolean(img));
  }, [slots]);

  /**
   * Obtener referencias activas completas
   */
  const getActiveReferences = useCallback(() => {
    return slots.filter(slot => slot.imageUrl !== null);
  }, [slots]);

  /**
   * Construir DNA completo de referencias
   */
  const buildDNA = useCallback(() => {
    return referenceService.buildReferenceDNA(slots);
  }, [slots]);

  /**
   * Reset de referencias para la sesión actual
   */
  const resetReferences = useCallback(() => {
    const fresh = referenceService.createInitialSlots();
    setSlots(fresh);

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
    } catch (error) {
      console.error('Error resetting reference slots in sessionStorage:', error);
    }
  }, []);

  return {
    slots,
    uploadReference,
    removeReference,
    setPriority,
    toggleLock,
    getReferenceImages,
    getActiveReferences,
    buildDNA,
    resetReferences
  };
};