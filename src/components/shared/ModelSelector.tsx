// src/components/shared/ModelSelector.tsx
// Selector de modelo de generación de imágenes.

import React from 'react';
import { Zap, Sparkles, Target } from 'lucide-react';
import type { ModelId } from '../../services/imageApiService';

interface ModelSelectorProps {
  value:     ModelId;
  onChange:  (model: ModelId) => void;
  disabled?: boolean;
  className?: string;
  exclude?:  ModelId[];
}

const MODELS: {
  id:      ModelId;
  label:   string;
  desc:    string;
  credits: number;
  icon:    React.ReactNode;
  color:   string;
  ring:    string;
}[] = [
  {
    id:      'gemini',
    label:   'Mayor fidelidad',
    desc:    'Ideal para usar fotos de referencia',
    credits: 2,
    icon:    <Target className="w-4 h-4" />,
    color:   'text-yellow-500',
    ring:    'ring-yellow-400 bg-yellow-50 border-yellow-200',
  },
  {
    id:      'seedream',
    label:   'Más rápida',
    desc:    'Usa menos créditos',
    credits: 1,
    icon:    <Zap className="w-4 h-4" />,
    color:   'text-emerald-600',
    ring:    'ring-emerald-500 bg-emerald-50 border-emerald-200',
  },
  {
    id:      'gptimage',
    label:   'Más creativa',
    desc:    'Ideal para ideas con muchos detalles',
    credits: 2,
    icon:    <Sparkles className="w-4 h-4" />,
    color:   'text-violet-600',
    ring:    'ring-violet-500 bg-violet-50 border-violet-200',
  },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  exclude = [],
}) => (
  <div className={`space-y-1.5 ${className}`}>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
      Opción de calidad · activa: <span className="text-slate-700">{MODELS.find(m => m.id === value)?.label}</span>
    </p>
    <div className="flex flex-col gap-2 min-w-0">
      {MODELS.filter(m => !exclude.includes(m.id)).map(m => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.id)}
            aria-pressed={active}
            className={`w-full min-w-0 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border-2 transition-all text-left ${
              active
                ? `${m.ring} shadow-md`
                : 'border-slate-100 bg-white hover:border-slate-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className={`flex-shrink-0 ${active ? m.color : 'text-slate-300'}`}>
              {m.icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`block text-[11px] font-black uppercase tracking-wide ${active ? 'text-slate-800' : 'text-slate-500'}`}>
                {m.label}
              </span>
              <p className={`text-[11px] font-medium leading-snug mt-0.5 ${active ? 'text-slate-600' : 'text-slate-400'}`}>
                {m.desc}
              </p>
            </div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
              active ? `${m.color} bg-white border border-current` : 'text-slate-400 bg-slate-50'
            }`}>
              {m.credits} cr.
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

export default ModelSelector;
