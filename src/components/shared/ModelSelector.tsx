// src/components/shared/ModelSelector.tsx
// Selector de modelo de generación de imágenes.
// Muestra las dos opciones con costo de créditos y descripción breve.

import React from 'react';
import { Zap, Sparkles } from 'lucide-react';
import type { ModelId } from '../../services/imageApiService';

interface ModelSelectorProps {
  value:     ModelId;
  onChange:  (model: ModelId) => void;
  disabled?: boolean;
  className?: string;
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
    label:   'Gemini Flash',
    desc:    'Alta calidad con referencias de imagen',
    credits: 2,
    icon:    <Sparkles className="w-4 h-4" />,
    color:   'text-indigo-600',
    ring:    'ring-indigo-500 bg-indigo-50 border-indigo-200',
  },
  {
    id:      'seedream',
    label:   'Seedream 4.5',
    desc:    'Rápido y económico, solo texto',
    credits: 1,
    icon:    <Zap className="w-4 h-4" />,
    color:   'text-emerald-600',
    ring:    'ring-emerald-500 bg-emerald-50 border-emerald-200',
  },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => (
  <div className={`flex gap-2 ${className}`}>
    {MODELS.map(m => {
      const active = value === m.id;
      return (
        <button
          key={m.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m.id)}
          className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border transition-all text-left ${
            active
              ? `ring-2 ${m.ring} border-transparent`
              : 'border-slate-100 bg-white hover:border-slate-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className={`flex-shrink-0 ${active ? m.color : 'text-slate-300'}`}>
            {m.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className={`text-[10px] font-black uppercase tracking-wide ${active ? 'text-slate-800' : 'text-slate-400'}`}>
                {m.label}
              </span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                active ? `${m.color} bg-white` : 'text-slate-300 bg-slate-50'
              }`}>
                {m.credits} cr.
              </span>
            </div>
            <p className={`text-[9px] font-medium leading-tight mt-0.5 ${active ? 'text-slate-500' : 'text-slate-300'}`}>
              {m.desc}
            </p>
          </div>
        </button>
      );
    })}
  </div>
);

export default ModelSelector;
