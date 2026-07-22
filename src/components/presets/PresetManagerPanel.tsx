// ── PresetManagerPanel — panel UI reutilizable para cualquier módulo ──────
// Se integra en el módulo pasando el hook useModulePresets y callbacks de restauración.

import React, { useState } from 'react';
import { BookMarked, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { PresetCard } from './PresetCard';
import { SavePresetModal } from './SavePresetModal';
import type { ModulePreset } from '../../shared/presets/types';
import type { UseModulePresetsReturn, SavePresetOptions } from '../../shared/presets/useModulePresets';

interface PresetManagerPanelProps<TState> {
  manager: UseModulePresetsReturn<TState>;
  onLoad: (state: Partial<TState>) => void;
  // Nombre automático sugerido cuando se abre el modal de guardar
  suggestedName?: string;
  emptyLabel?: string;
}

export function PresetManagerPanel<TState>({
  manager, onLoad, suggestedName = '', emptyLabel = 'No hay presets guardados',
}: PresetManagerPanelProps<TState>) {
  const {
    presets, loading, saving, error,
    savePreset, loadPreset, updatePreset, deletePreset, duplicatePreset, setDefaultPreset,
    reload, clearError,
  } = manager;

  const [saveModalOpen,   setSaveModalOpen]   = useState(false);
  const [updateTarget,    setUpdateTarget]    = useState<ModulePreset | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveConfirm = async (name: string, description: string) => {
    const preset = await savePreset({ name, description });
    if (preset) setSaveModalOpen(false);
  };

  const handleUpdateConfirm = async (name: string, description: string) => {
    if (!updateTarget) return;
    await updatePreset(updateTarget.id, { name, description });
    setUpdateTarget(null);
  };

  const handleLoad = (preset: ModulePreset) => {
    const state = loadPreset(preset);
    onLoad(state);
  };

  const handleDelete = async (presetId: string) => {
    await deletePreset(presetId);
    setConfirmDeleteId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">
            Presets guardados
          </span>
          {presets.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-500 font-bold">
              {presets.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            title="Recargar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSaveModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700
                       text-white text-xs font-black uppercase tracking-widest transition-all shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            Guardar actual
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={clearError} className="text-red-400 hover:text-red-600 text-xs font-bold">
            Cerrar
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-[82px] rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : presets.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <BookMarked className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{emptyLabel}</p>
          <p className="text-xs mt-1">Guardá la configuración actual para reutilizarla.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 px-1">
            Marcá un preset como <span className="font-bold text-amber-600">default</span> para que se precargue solo al entrar al módulo.
          </p>
          {presets.map(preset => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onLoad={handleLoad}
              onUpdate={p => setUpdateTarget(p)}
              onDuplicate={duplicatePreset}
              onDelete={id => setConfirmDeleteId(id)}
              onSetDefault={setDefaultPreset}
            />
          ))}
        </div>
      )}

      {/* Modal guardar */}
      <SavePresetModal
        open={saveModalOpen}
        saving={saving}
        initialName={suggestedName}
        mode="save"
        onConfirm={handleSaveConfirm}
        onClose={() => setSaveModalOpen(false)}
      />

      {/* Modal actualizar */}
      <SavePresetModal
        open={!!updateTarget}
        saving={saving}
        initialName={updateTarget?.name ?? ''}
        initialDescription={updateTarget?.description ?? ''}
        mode="update"
        onConfirm={handleUpdateConfirm}
        onClose={() => setUpdateTarget(null)}
      />

      {/* Confirmación de eliminación */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 space-y-5 text-center">
            <p className="text-base font-black text-slate-900">¿Eliminar preset?</p>
            <p className="text-sm text-slate-500">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 text-xs
                           font-black uppercase tracking-widest hover:border-slate-300 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs
                           font-black uppercase tracking-widest transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
