import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface SavePresetModalProps {
  open: boolean;
  saving: boolean;
  initialName?: string;
  initialDescription?: string;
  mode?: 'save' | 'update';
  onConfirm: (name: string, description: string) => void;
  onClose: () => void;
}

export const SavePresetModal: React.FC<SavePresetModalProps> = ({
  open, saving, initialName = '', initialDescription = '', mode = 'save', onConfirm, onClose,
}) => {
  const [name, setName]           = useState(initialName);
  const [description, setDesc]    = useState(initialDescription);

  useEffect(() => {
    if (open) { setName(initialName); setDesc(initialDescription); }
  }, [open, initialName, initialDescription]);

  if (!open) return null;

  const label = mode === 'update' ? 'Actualizar configuración' : 'Guardar configuración';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5">

        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">{label}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Nombre
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Favoritos de la semana verano — 4 looks"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900
                         placeholder:text-slate-400 focus:outline-none focus:border-brand-400 transition-colors"
              maxLength={60}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Descripción <span className="text-slate-400 font-normal normal-case">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Notas sobre esta configuración..."
              rows={2}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900
                         placeholder:text-slate-400 focus:outline-none focus:border-brand-400 transition-colors resize-none"
              maxLength={200}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 text-xs
                       font-black uppercase tracking-widest hover:border-slate-300 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(name.trim(), description.trim())}
            disabled={!name.trim() || saving}
            className="flex-1 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-xs
                       font-black uppercase tracking-widest transition-all flex items-center
                       justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : label}
          </button>
        </div>

      </div>
    </div>
  );
};
