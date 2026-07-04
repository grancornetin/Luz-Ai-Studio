import React from 'react';
import { Trash2, Copy, RotateCcw, MoreVertical, Pencil } from 'lucide-react';
import type { ModulePreset } from '../../shared/presets/types';

interface PresetCardProps {
  preset: ModulePreset;
  onLoad: (preset: ModulePreset) => void;
  onUpdate: (preset: ModulePreset) => void;
  onDuplicate: (presetId: string) => void;
  onDelete: (presetId: string) => void;
}

export const PresetCard: React.FC<PresetCardProps> = ({
  preset, onLoad, onUpdate, onDuplicate, onDelete,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const date = new Date(preset.updatedAt).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl p-4 flex gap-3 hover:border-slate-300 transition-all group">

      {/* Thumbnail */}
      {preset.thumbnail ? (
        <img
          src={preset.thumbnail}
          alt={preset.name}
          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-slate-100"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-slate-100 flex-shrink-0 flex items-center justify-center">
          <span className="text-2xl">📦</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-slate-900 truncate">{preset.name}</p>
        {preset.description && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{preset.description}</p>
        )}
        <p className="text-xs text-slate-400 mt-1">{date}</p>
      </div>

      {/* Botón principal: restaurar */}
      <button
        onClick={() => onLoad(preset)}
        className="flex-shrink-0 self-center px-3 py-2 rounded-xl bg-brand-50 hover:bg-brand-100
                   text-brand-700 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Cargar
      </button>

      {/* Menú contextual */}
      <div className="flex-shrink-0 self-center relative">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-2xl
                            shadow-xl py-1 w-44 overflow-hidden">
              <button
                onClick={() => { setMenuOpen(false); onUpdate(preset); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700
                           hover:bg-slate-50 transition-colors"
              >
                <Pencil className="w-4 h-4 text-slate-400" /> Actualizar
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDuplicate(preset.id); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700
                           hover:bg-slate-50 transition-colors"
              >
                <Copy className="w-4 h-4 text-slate-400" /> Duplicar
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => { setMenuOpen(false); onDelete(preset.id); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600
                           hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
};
