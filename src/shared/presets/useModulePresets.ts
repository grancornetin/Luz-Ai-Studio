// ── useModulePresets — hook React para cualquier módulo ───────────────────
// Uso: const presetManager = useModulePresets('photodump', adapter, currentState)

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../modules/auth/AuthContext';
import { presetService } from './presetService';
import type { ModulePreset, ModulePresetAdapter, PresetAssetInput } from './types';

export interface SavePresetOptions {
  name: string;
  description?: string;
}

export interface UseModulePresetsReturn<TState> {
  presets: ModulePreset[];
  loading: boolean;
  saving: boolean;
  error: string | null;

  savePreset: (options: SavePresetOptions) => Promise<ModulePreset | null>;
  loadPreset: (preset: ModulePreset) => Partial<TState>;
  updatePreset: (presetId: string, options: SavePresetOptions) => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;
  duplicatePreset: (presetId: string) => Promise<void>;
  setDefaultPreset: (presetId: string | null) => Promise<void>;
  reload: () => Promise<void>;
  clearError: () => void;
}

export function useModulePresets<TState>(
  adapter: ModulePresetAdapter<TState>,
  currentState: TState,
): UseModulePresetsReturn<TState> {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [presets, setPresets]   = useState<ModulePreset[]>([]);
  const [loading, setLoading]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const list = await presetService.list(uid, adapter.moduleId);
      setPresets(list);
    } catch (e) {
      setError('Error al cargar presets');
    } finally {
      setLoading(false);
    }
  }, [uid, adapter.moduleId]);

  useEffect(() => { reload(); }, [reload]);

  const savePreset = useCallback(async (
    options: SavePresetOptions,
  ): Promise<ModulePreset | null> => {
    if (!uid) { setError('Debes iniciar sesión'); return null; }
    setSaving(true);
    setError(null);
    try {
      const config = adapter.serialize(currentState);

      // Recopilar assets que el adapter quiera subir
      const rawAssets: PresetAssetInput[] = adapter.getAssets
        ? adapter.getAssets(currentState)
        : [];

      const preset = await presetService.create(
        uid,
        {
          moduleId:    adapter.moduleId,
          name:        options.name,
          description: options.description,
          config,
          assets:      [],
          version:     adapter.version,
        },
        rawAssets,
      );
      setPresets(prev => [preset, ...prev]);
      return preset;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[presets] savePreset error:', msg, e);
      setError(`Error al guardar: ${msg}`);
      return null;
    } finally {
      setSaving(false);
    }
  }, [uid, adapter, currentState]);

  const loadPreset = useCallback((preset: ModulePreset): Partial<TState> => {
    if (adapter.validate && !adapter.validate(preset.config)) {
      setError('Este preset no es compatible con la versión actual');
      return {};
    }
    return adapter.deserialize(preset.config, preset.assets);
  }, [adapter]);

  const updatePreset = useCallback(async (
    presetId: string,
    options: SavePresetOptions,
  ): Promise<void> => {
    if (!uid) return;
    setSaving(true);
    try {
      const config = adapter.serialize(currentState);
      await presetService.update(uid, presetId, { name: options.name, description: options.description, config });
      setPresets(prev =>
        prev.map(p => p.id === presetId
          ? { ...p, name: options.name, description: options.description ?? p.description, config, updatedAt: Date.now() }
          : p,
        ),
      );
    } catch {
      setError('Error al actualizar el preset');
    } finally {
      setSaving(false);
    }
  }, [uid, adapter, currentState]);

  const deletePreset = useCallback(async (presetId: string): Promise<void> => {
    if (!uid) return;
    try {
      await presetService.delete(uid, presetId);
      setPresets(prev => prev.filter(p => p.id !== presetId));
    } catch {
      setError('Error al eliminar el preset');
    }
  }, [uid]);

  const duplicatePreset = useCallback(async (presetId: string): Promise<void> => {
    if (!uid) return;
    try {
      const copy = await presetService.duplicate(uid, presetId);
      setPresets(prev => [copy, ...prev]);
    } catch {
      setError('Error al duplicar el preset');
    }
  }, [uid]);

  const setDefaultPreset = useCallback(async (presetId: string | null): Promise<void> => {
    if (!uid) return;
    try {
      await presetService.setDefault(uid, adapter.moduleId, presetId);
      setPresets(prev => prev.map(p => ({ ...p, isDefault: p.id === presetId })));
    } catch {
      setError('Error al marcar el preset por defecto');
    }
  }, [uid, adapter.moduleId]);

  return {
    presets,
    loading,
    saving,
    error,
    savePreset,
    loadPreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    setDefaultPreset,
    reload,
    clearError: () => setError(null),
  };
}
